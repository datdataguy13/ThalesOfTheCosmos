import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import SKY from '../data/sky.json'
import {
  toHorizon, fromAltAz, toAltAz, cameraFromLook, cameraFromDevice, turnCamera, blendCamera,
  scaleFor, project, horizonCircle,
} from '../lib/dome.js'
import { dirOf, RAD, clamp, n360 } from '../astro.js'
import { drawMoon } from './Moon.jsx'

// The sky dome: tonight's real sky for this place and time. Look around by
// dragging (cursor or finger) or with the arrow keys; on a phone, "Point at
// the sky" makes the picture follow the phone like a window.

// our story constellations -> their id in the star data
const STORY_IDS = {
  Orion: 'Ori', 'Ursa Major': 'UMa', Cassiopeia: 'Cas', Leo: 'Leo', Taurus: 'Tau', Gemini: 'Gem',
  Scorpius: 'Sco', Sagittarius: 'Sgr', Cygnus: 'Cyg', Lyra: 'Lyr', Aquila: 'Aql', 'Boötes': 'Boo',
  Pegasus: 'Peg', Andromeda: 'And', 'Canis Major': 'CMa', Crux: 'Cru',
}
const STAR_COLOURS = ['#a9c1ff', '#cfdcff', '#ffffff', '#ffeccb', '#ffc79c']
const COMPASS = [['N', 0], ['NE', 45], ['E', 90], ['SE', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]]
// faintest stars shown for each kind of sky
const FAINTEST = { clear: 5.2, some: 4.5, city: 3.2, cloudy: 5.2 }
const MIN_FOV = 35, MAX_FOV = 120
const SKIP_NAMES = ['Toliman'] // shares a spot with Rigil Kentaurus

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const mixColour = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`

// Turn the catalogue into directions for this place and moment.
function buildScene(sky, planets, stories, southern) {
  const at = (ra, dec) => toHorizon(ra, dec, sky.lst, sky.lat)
  const n = SKY.stars.length / 4
  const stars = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const v = at(SKY.stars[i * 4], SKY.stars[i * 4 + 1])
    stars[i * 3] = v[0]; stars[i * 3 + 1] = v[1]; stars[i * 3 + 2] = v[2]
  }

  const storyOf = Object.fromEntries(stories.map((s, i) => [STORY_IDS[s.name], i]))
  const constellations = Object.entries(SKY.constellations).map(([id, c]) => {
    const paths = c.lines.map((path) => path.map(([ra, dec]) => at(ra, dec)))
    // label sits at the middle of the pattern
    const sum = [0, 0, 0]
    paths.forEach((p) => p.forEach((v) => { sum[0] += v[0]; sum[1] += v[1]; sum[2] += v[2] }))
    const len = Math.hypot(...sum) || 1
    const story = storyOf[id]
    return {
      id, paths, centre: sum.map((x) => x / len),
      story: story == null ? -1 : story,
      name: story == null ? c.name : stories[story].name,
    }
  })

  const named = SKY.named.filter((s) => !SKIP_NAMES.includes(s[0])).map(([name, ra, dec]) => ({ name, v: at(ra, dec) }))

  const moonSprite = document.createElement('canvas')
  drawMoon(moonSprite, sky.moon.frac, 48, southern)
  const bodies = [
    { key: 'Moon', label: 'Moon', v: fromAltAz(sky.moon.alt, sky.moon.az), kind: 'moon', sprite: moonSprite, size: 13, text: `The Moon — a ${sky.moon.name.toLowerCase()}, ${Math.round(sky.moon.illum * 100)}% lit` },
    ...planets.map((p) => {
      const d = sky.planets[p.key]
      return { key: p.key, label: p.key, v: fromAltAz(d.alt, d.az), kind: 'planet', colour: p.color, size: p.key === 'Venus' || p.key === 'Jupiter' ? 5 : p.key === 'Uranus' ? 2.5 : 4, text: `${p.key} — a planet, not a star`, hidden: d.elong < 12 }
    }),
    { key: 'Sun', label: 'Sun', v: fromAltAz(sky.sun.alt, sky.sun.az), kind: 'sun', size: 12, text: 'The Sun — never look at it directly' },
  ]
  return { stars, n, constellations, named, bodies }
}

export default function SkyDome({ sky, condition, planets, stories, southern, placeName, hourLabel, onStory }) {
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const frame = useRef(0)
  const hits = useRef([])
  // where we're looking; kept in a ref so dragging doesn't re-render React
  const view = useRef({ az: southern ? 0 : 180, alt: 20, fov: 95, sensorCam: null, azOffset: 0, target: null, targetUntil: 0, anim: null, size: { w: 0, h: 0 } })

  const [mode, setMode] = useState('drag') // 'drag' | 'sensor'
  const [expanded, setExpanded] = useState(false)
  const [caption, setCaption] = useState('')
  const [note, setNote] = useState('')
  const [goto, setGoto] = useState('')
  const modeRef = useRef(mode)
  modeRef.current = mode

  const canSense = useMemo(() => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
    && window.matchMedia && window.matchMedia('(pointer: coarse)').matches, [])

  const scene = useMemo(() => buildScene(sky, planets, stories, southern), [sky, planets, stories, southern])
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  // 0 = properly dark, 1 = Sun on the horizon or higher
  const daylight = clamp((sky.sun.alt + 12) / 12, 0, 1)
  const faintest = (FAINTEST[condition] || 5.2) - daylight * 7

  const currentCamera = () => {
    const v = view.current
    return modeRef.current === 'sensor' && v.sensorCam ? turnCamera(v.sensorCam, v.azOffset) : cameraFromLook(v.az, v.alt)
  }

  // ---------- drawing ----------
  const draw = useCallback(() => {
    frame.current = 0
    const canvas = canvasRef.current
    const v = view.current
    const { w, h } = v.size
    if (!canvas || !w || !h) return
    const sc = sceneRef.current
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // glide toward a "take me to" target
    if (v.anim) {
      const t = clamp((performance.now() - v.anim.start) / 700, 0, 1)
      const e = 1 - Math.pow(1 - t, 3)
      v.az = n360(v.anim.az0 + v.anim.daz * e)
      v.alt = v.anim.alt0 + (v.anim.alt1 - v.anim.alt0) * e
      if (t >= 1) v.anim = null
    }

    const cam = currentCamera()
    const cx = w / 2, cy = h / 2
    const scale = scaleFor(Math.max(w, h), v.fov)
    const P = (vec) => project(vec, cam, scale, cx, cy)
    const onScreen = (p, m = 30) => p[2] > -0.3 && p[0] > -m && p[0] < w + m && p[1] > -m && p[1] < h + m
    const found = []

    // sky colour: deep navy at night, blue when the Sun is up
    const sky0 = ctx.createLinearGradient(0, 0, 0, h)
    sky0.addColorStop(0, mixColour([5, 8, 26], [52, 104, 190], daylight))
    sky0.addColorStop(1, mixColour([14, 22, 54], [120, 168, 226], daylight))
    ctx.fillStyle = sky0
    ctx.fillRect(0, 0, w, h)

    // stars
    const zoom = clamp(95 / v.fov, 0.8, 1.8)
    for (let i = 0; i < sc.n; i++) {
      const mag = SKY.stars[i * 4 + 2]
      if (mag > faintest) break // the list is brightest-first
      const x3 = sc.stars[i * 3], y3 = sc.stars[i * 3 + 1], z3 = sc.stars[i * 3 + 2]
      const depth = x3 * cam.f[0] + y3 * cam.f[1] + z3 * cam.f[2]
      if (depth < -0.3) continue
      const k = scale * 2 / (1 + depth)
      const x = cx + (x3 * cam.r[0] + y3 * cam.r[1] + z3 * cam.r[2]) * k
      const y = cy - (x3 * cam.u[0] + y3 * cam.u[1] + z3 * cam.u[2]) * k
      if (x < -5 || x > w + 5 || y < -5 || y > h + 5) continue
      const r = Math.max(0.8, (4.3 - 0.62 * mag) * 0.72 * zoom)
      ctx.globalAlpha = clamp(1.2 - mag * 0.12, 0.55, 1)
      ctx.fillStyle = STAR_COLOURS[SKY.stars[i * 4 + 3]]
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 6.2832)
      ctx.fill()
      if (mag < 1.2) { // a soft glow around the brightest
        ctx.globalAlpha = 0.16
        ctx.beginPath()
        ctx.arc(x, y, r * 2.8, 0, 6.2832)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // constellation lines — story ones in gold, the rest faint blue
    const lineFade = 1 - daylight * 0.75
    for (const pass of [0, 1]) {
      ctx.beginPath()
      for (const c of sc.constellations) {
        if ((c.story >= 0) !== (pass === 1)) continue
        for (const path of c.paths) {
          let prev = null
          for (const vec of path) {
            const p = P(vec)
            if (prev && prev[2] > -0.2 && p[2] > -0.2) { ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]) }
            prev = p
          }
        }
      }
      ctx.strokeStyle = pass === 1 ? `rgba(255,210,113,${0.62 * lineFade})` : `rgba(134,173,255,${0.3 * lineFade})`
      ctx.lineWidth = pass === 1 ? 1.5 : 1
      ctx.stroke()
    }

    // Sun, Moon and planets
    for (const b of sc.bodies) {
      const p = P(b.v)
      if (!onScreen(p)) continue
      if (b.kind === 'moon') {
        ctx.drawImage(b.sprite, p[0] - b.size, p[1] - b.size, b.size * 2, b.size * 2)
      } else if (b.kind === 'sun') {
        const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], b.size * 3)
        g.addColorStop(0, 'rgba(255,244,200,1)'); g.addColorStop(0.35, 'rgba(255,214,120,.8)'); g.addColorStop(1, 'rgba(255,214,120,0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.arc(p[0], p[1], b.size * 3, 0, 6.2832); ctx.fill()
      } else {
        ctx.fillStyle = b.colour
        ctx.globalAlpha = 0.25
        ctx.beginPath(); ctx.arc(p[0], p[1], b.size * 2.6, 0, 6.2832); ctx.fill()
        ctx.globalAlpha = 1
        ctx.beginPath(); ctx.arc(p[0], p[1], b.size, 0, 6.2832); ctx.fill()
      }
    }

    // the ground, drawn over anything below the horizon
    const hz = horizonCircle(cam, scale, cx, cy)
    {
      ctx.beginPath()
      if (hz.radius < 30000) {
        if (hz.groundInside) ctx.arc(hz.x, hz.y, hz.radius, 0, 6.2832)
        else { ctx.rect(-10, -10, w + 20, h + 20); ctx.arc(hz.x, hz.y, hz.radius, 0, 6.2832, true) }
      } else {
        // looking almost exactly along the horizon: it's a straight line
        const dx = hz.b[0] - hz.a[0], dy = hz.b[1] - hz.a[1], len = Math.hypot(dx, dy) || 1
        let nx = -dy / len, ny = dx / len
        const side = (hz.probe[0] - hz.a[0]) * nx + (hz.probe[1] - hz.a[1]) * ny
        if ((side > 0) !== hz.probeIsGround) { nx = -nx; ny = -ny }
        const far = (w + h) * 4, ux = dx / len, uy = dy / len
        ctx.moveTo(hz.a[0] - ux * far, hz.a[1] - uy * far)
        ctx.lineTo(hz.a[0] + ux * far, hz.a[1] + uy * far)
        ctx.lineTo(hz.a[0] + ux * far + nx * far, hz.a[1] + uy * far + ny * far)
        ctx.lineTo(hz.a[0] - ux * far + nx * far, hz.a[1] - uy * far + ny * far)
        ctx.closePath()
      }
      ctx.fillStyle = 'rgba(9,16,14,0.9)'
      ctx.fill('evenodd')
      // horizon line
      ctx.beginPath()
      let started = false
      for (let az = 0; az <= 360; az += 3) {
        const p = P(fromAltAz(0, az))
        if (p[2] < -0.5) { started = false; continue }
        if (started) ctx.lineTo(p[0], p[1]); else { ctx.moveTo(p[0], p[1]); started = true }
      }
      ctx.strokeStyle = 'rgba(140,224,176,0.5)'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // compass points along the horizon
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const [name, az] of COMPASS) {
      const p = P(fromAltAz(-4.5, az))
      if (!onScreen(p, 0)) continue
      ctx.font = `${name.length === 1 ? '800 15px' : '700 11px'} Nunito, system-ui, sans-serif`
      ctx.fillStyle = name.length === 1 ? '#8ce0b0' : 'rgba(140,224,176,0.7)'
      ctx.fillText(name, p[0], p[1])
    }

    // labels (only for things above the horizon)
    const label = (text, x, y, font, colour) => {
      ctx.font = font
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(5,8,26,0.75)'
      ctx.strokeText(text, x, y)
      ctx.fillStyle = colour
      ctx.fillText(text, x, y)
    }
    for (const c of sc.constellations) {
      if (c.centre[2] < 0.03) continue
      const p = P(c.centre)
      if (!onScreen(p, 0)) continue
      if (c.story >= 0) {
        label(c.name, p[0], p[1], '800 13px Nunito, system-ui, sans-serif', `rgba(255,210,113,${0.95 * lineFade + 0.05})`)
        found.push({ x: p[0], y: p[1], r: 44, story: c.story })
      } else if (v.fov <= 100) {
        label(c.name, p[0], p[1], '600 10.5px Nunito, system-ui, sans-serif', `rgba(170,180,222,${0.6 * lineFade})`)
      }
    }
    if (v.fov <= 100 && daylight < 0.6) {
      ctx.textAlign = 'left'
      for (const s of sc.named) {
        if (s.v[2] < 0.02) continue
        const p = P(s.v)
        if (onScreen(p, 0)) label(s.name, p[0] + 7, p[1] - 7, '600 10.5px Nunito, system-ui, sans-serif', 'rgba(223,230,255,0.75)')
      }
      ctx.textAlign = 'center'
    }
    for (const b of sc.bodies) {
      const p = P(b.v)
      if (!onScreen(p)) continue
      found.push({ x: p[0], y: p[1], r: 28, body: b })
      if (b.v[2] < -0.02) continue
      label(b.label, p[0], p[1] + b.size + 11, '800 12.5px Nunito, system-ui, sans-serif', b.kind === 'planet' ? b.colour : '#fff')
    }

    // "take me to" target: a ring when it's in view, an arrow when it isn't
    if (v.target) {
      const p = P(v.target.v)
      const inView = p[2] > 0 && p[0] > 24 && p[0] < w - 24 && p[1] > 24 && p[1] < h - 24
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260)
      ctx.strokeStyle = '#ffd271'
      ctx.fillStyle = '#ffd271'
      if (inView) {
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.55 + 0.45 * pulse
        ctx.beginPath(); ctx.arc(p[0], p[1], 22 + pulse * 6, 0, 6.2832); ctx.stroke()
        ctx.globalAlpha = 1
      } else {
        // which way to turn: the target's direction as seen from the camera
        const ang = Math.atan2(-dot(v.target.v, cam.u), dot(v.target.v, cam.r))
        const ax = cx + Math.cos(ang) * (w / 2 - 34), ay = cy + Math.sin(ang) * (h / 2 - 34)
        ctx.save()
        ctx.translate(ax, ay); ctx.rotate(ang)
        ctx.beginPath(); ctx.moveTo(24 + pulse * 5, 0); ctx.lineTo(-10, -11); ctx.lineTo(-3, 0); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill()
        ctx.restore()
        ctx.textAlign = 'center'
        label(`${v.target.label} is this way`, clamp(ax - Math.cos(ang) * 30, 80, w - 80), clamp(ay - Math.sin(ang) * 30, 16, h - 16), '800 12px Nunito, system-ui, sans-serif', '#ffd271')
      }
      const keepGoing = modeRef.current === 'sensor' || performance.now() < v.targetUntil
      if (!keepGoing) v.target = null
      if (!frame.current) frame.current = requestAnimationFrame(draw) // keep the pulse moving
    }

    // in "window" mode a small ring marks the middle of the view
    if (modeRef.current === 'sensor') {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 6.2832); ctx.stroke()
    }

    hits.current = found
    if (v.anim && !frame.current) frame.current = requestAnimationFrame(draw)
  }, [daylight, faintest])

  const redraw = useCallback(() => { if (!frame.current) frame.current = requestAnimationFrame(draw) }, [draw])

  // redraw when the sky (time, place, weather) changes
  useEffect(() => { redraw() }, [scene, redraw])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  // keep the canvas the size of its stage
  useEffect(() => {
    const stage = stageRef.current, canvas = canvasRef.current
    if (!stage || !canvas) return
    const fit = () => {
      const w = stage.clientWidth, h = stage.clientHeight
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      view.current.size = { w, h }
      draw()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [draw, expanded])

  // ---------- looking around ----------
  const describe = () => {
    const look = toAltAz(currentCamera().f)
    return `Looking ${dirOf(look.az)}, ${look.alt > 60 ? 'almost straight up' : look.alt > 25 ? 'high in the sky' : look.alt > 5 ? 'low in the sky' : 'at the horizon'}`
  }

  function nudge(daz, dalt) {
    const v = view.current
    v.anim = null
    if (modeRef.current === 'sensor') v.azOffset += daz
    else { v.az = n360(v.az + daz); v.alt = clamp(v.alt + dalt, -15, 90) }
    redraw()
  }

  function zoomBy(factor) {
    view.current.fov = clamp(view.current.fov * factor, MIN_FOV, MAX_FOV)
    redraw()
  }

  function tap(x, y) {
    let best = null
    for (const hit of hits.current) {
      const d = Math.hypot(hit.x - x, hit.y - y)
      if (d < hit.r && (!best || d < best.d)) best = { ...hit, d }
    }
    if (!best) { setCaption(describe()); return }
    if (best.body) {
      const b = best.body, aa = toAltAz(b.v)
      setCaption(aa.alt > 0
        ? `${b.text}. It's ${Math.round(aa.alt)}° above the horizon, toward the ${dirOf(aa.az)}.`
        : `${b.text}. It's below the horizon right now.`)
    } else onStory(best.story)
  }

  const pointers = useRef(new Map())
  const gesture = useRef({ moved: 0, pinch: 0, fov: 0 })

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) gesture.current = { moved: 0, pinch: 0, fov: view.current.fov }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current.pinch = Math.hypot(a.x - b.x, a.y - b.y)
      gesture.current.fov = view.current.fov
      gesture.current.moved = 99 // a pinch is never a tap
    }
  }

  function onPointerMove(e) {
    const was = pointers.current.get(e.pointerId)
    if (!was) return
    const dx = e.clientX - was.x, dy = e.clientY - was.y
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const spread = Math.hypot(a.x - b.x, a.y - b.y)
      if (gesture.current.pinch > 0 && spread > 0) {
        view.current.fov = clamp(gesture.current.fov * gesture.current.pinch / spread, MIN_FOV, MAX_FOV)
        redraw()
      }
      return
    }
    gesture.current.moved += Math.abs(dx) + Math.abs(dy)
    // grab the sky and pull it: one pixel is this many degrees at the centre
    const { w, h } = view.current.size
    const degPerPx = RAD / scaleFor(Math.max(w, h), view.current.fov)
    nudge(-dx * degPerPx, dy * degPerPx)
  }

  function onPointerUp(e) {
    const had = pointers.current.delete(e.pointerId)
    if (had && pointers.current.size === 0 && gesture.current.moved < 6) {
      const box = e.currentTarget.getBoundingClientRect()
      tap(e.clientX - box.left, e.clientY - box.top)
    }
  }

  function onKeyDown(e) {
    const step = 6
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[e.key]) { e.preventDefault(); nudge(...moves[e.key]); setCaption(describe()) }
    else if (e.key === '+' || e.key === '=') zoomBy(0.85)
    else if (e.key === '-' || e.key === '_') zoomBy(1 / 0.85)
    else if (e.key === 'Escape' && expanded) setExpanded(false)
  }

  // ---------- "take me to…" ----------
  const places = useMemo(() => [
    ...scene.bodies.filter((b) => b.kind !== 'sun' && b.v[2] > 0.03 && !b.hidden).map((b) => ({ key: b.key, label: b.label, v: b.v })),
    ...scene.constellations.filter((c) => c.story >= 0 && c.centre[2] > 0.1).map((c) => ({ key: c.id, label: c.name, v: c.centre })),
  ], [scene])

  function goTo(key) {
    setGoto('')
    const place = places.find((p) => p.key === key)
    if (!place) return
    const v = view.current
    const aa = toAltAz(place.v)
    v.target = { v: place.v, label: place.label }
    v.targetUntil = performance.now() + 6000
    if (modeRef.current === 'drag') {
      const daz = ((aa.az - v.az + 540) % 360) - 180 // the short way round
      v.anim = { start: performance.now(), az0: v.az, daz, alt0: v.alt, alt1: clamp(aa.alt, -15, 90) }
      setCaption(`${place.label} is ${Math.round(aa.alt)}° above the horizon, toward the ${dirOf(aa.az)}.`)
    } else {
      setCaption(`Turn and tilt your phone to follow the arrow to ${place.label}.`)
    }
    redraw()
  }

  // ---------- phone motion sensors ----------
  async function toggleSensor() {
    setNote('')
    if (mode === 'sensor') { setMode('drag'); return }
    try {
      // iPhones ask permission the first time
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const answer = await DeviceOrientationEvent.requestPermission()
        if (answer !== 'granted') { setNote('Motion access was not allowed, so drag with your finger to look around.'); return }
      }
    } catch {
      setNote("Couldn't turn on the motion sensors here, so drag with your finger to look around.")
      return
    }
    view.current.sensorCam = null
    view.current.azOffset = 0
    setMode('sensor')
    setExpanded(true)
  }

  useEffect(() => {
    if (mode !== 'sensor') return
    const v = view.current
    let heard = false, warned = false
    const onOrient = (e) => {
      if (e.beta == null || e.gamma == null) return
      let alpha = e.alpha
      let fromNorth = e.absolute === true
      if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) {
        alpha = 360 - e.webkitCompassHeading // iPhone: compass heading, clockwise from north
        fromNorth = true
      }
      if (alpha == null) return
      heard = true
      if (!fromNorth && !warned) {
        warned = true
        setNote("This phone isn't sharing its compass, so the sky may be turned the wrong way. Drag sideways to line it up with something you can see, like the Moon.")
      }
      const angle = (window.screen.orientation && window.screen.orientation.angle) || 0
      const cam = cameraFromDevice(alpha, e.beta, e.gamma, angle)
      v.sensorCam = v.sensorCam ? blendCamera(v.sensorCam, cam, 0.22) : cam
      redraw()
    }
    const eventName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(eventName, onOrient)
    const giveUp = setTimeout(() => {
      if (heard) return
      setNote("This device isn't sharing its motion sensors, so drag to look around instead.")
      setMode('drag')
    }, 3000)
    return () => {
      clearTimeout(giveUp)
      window.removeEventListener(eventName, onOrient)
      // carry on in drag mode from wherever the phone was pointing
      if (v.sensorCam) {
        const look = toAltAz(turnCamera(v.sensorCam, v.azOffset).f)
        v.az = look.az
        v.alt = clamp(look.alt, -15, 90)
      }
      redraw()
    }
  }, [mode, redraw])

  // the expanded view covers the page, so stop the page behind from scrolling
  useEffect(() => {
    if (!expanded) return
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = before }
  }, [expanded])

  const sunUp = daylight > 0.5
  const help = mode === 'sensor'
    ? 'Hold your phone up like a window onto the sky and turn around.'
    : canSense ? 'Drag with your finger to look around. Pinch to zoom. Tap a gold name for its story.'
      : 'Drag with your cursor to look around (or use the arrow keys). Click a gold name for its story.'

  return (
    <div className={'dome panel' + (expanded ? ' expanded' : '')}>
      <div className="dome-bar">
        <select className="dome-goto" value={goto} onChange={(e) => goTo(e.target.value)} aria-label="Take me to something in the sky">
          <option value="">🔭 Take me to…</option>
          {places.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <div className="dome-tools">
          <button className="dbtn" onClick={() => zoomBy(1 / 0.8)} aria-label="Zoom out">−</button>
          <button className="dbtn" onClick={() => zoomBy(0.8)} aria-label="Zoom in">+</button>
          {canSense && (
            <button className={'dbtn wide' + (mode === 'sensor' ? ' on' : '')} onClick={toggleSensor} aria-pressed={mode === 'sensor'}>
              📱 {mode === 'sensor' ? 'Stop following' : 'Point at the sky'}
            </button>
          )}
          <button className="dbtn wide" onClick={() => setExpanded((x) => !x)} aria-pressed={expanded}>
            {expanded ? '✕ Close' : '⛶ Full screen'}
          </button>
        </div>
      </div>
      <div className="dome-stage" ref={stageRef}>
        <canvas
          ref={canvasRef} tabIndex={0} role="img"
          aria-label={`The sky from ${placeName} at ${hourLabel}. Use the arrow keys to look around and plus or minus to zoom.`}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        />
        {sunUp && <div className="dome-flag">☀️ The Sun is still up — the stars are there, but daylight hides them. Pick a later time.</div>}
      </div>
      <div className="dome-foot">
        <p className="dome-caption" aria-live="polite">{note || caption || help}</p>
        {(note || caption) && <p className="dome-help">{help}</p>}
      </div>
    </div>
  )
}
