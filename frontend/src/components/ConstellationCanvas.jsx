import { useRef, useEffect } from 'react'

function draw(canvas, data, w, h) {
  const dpr = window.devicePixelRatio || 1
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  // faint background stars (deterministic so they don't flicker on redraw)
  ctx.fillStyle = 'rgba(223,230,255,0.5)'
  for (let i = 0; i < 40; i++) {
    const rx = ((i * 73) % 100) / 100 * w
    const ry = ((i * 131) % 100) / 100 * h
    const s = ((i * 37) % 10) / 10 * 0.9 + 0.2
    ctx.globalAlpha = 0.25 + ((i * 17) % 10) / 20
    ctx.beginPath()
    ctx.arc(rx, ry, s, 0, 2 * Math.PI)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  const pad = 0.14
  const px = (u) => w * (pad + u * (1 - 2 * pad))
  const py = (v) => h * (pad + v * (1 - 2 * pad))

  // connecting lines
  ctx.strokeStyle = 'rgba(134,173,255,0.55)'
  ctx.lineWidth = 1.3
  for (const [i, j] of data.links) {
    ctx.beginPath()
    ctx.moveTo(px(data.stars[i][0]), py(data.stars[i][1]))
    ctx.lineTo(px(data.stars[j][0]), py(data.stars[j][1]))
    ctx.stroke()
  }

  // stars with a soft glow
  for (const [u, v, mag] of data.stars) {
    const x = px(u), y = py(v), r = 1.6 + mag * 1.5
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2)
    g.addColorStop(0, 'rgba(255,255,255,0.9)')
    g.addColorStop(0.3, 'rgba(255,228,170,0.5)')
    g.addColorStop(1, 'rgba(255,228,170,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r * 3.2, 0, 2 * Math.PI)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(x, y, r * 0.7, 0, 2 * Math.PI)
    ctx.fill()
  }
}

// Fills its parent's width; height set by the `ratio` (height = width * ratio).
export default function ConstellationCanvas({ data, ratio = 0.6, maxHeight = 320 }) {
  const ref = useRef(null)
  const wrapRef = useRef(null)
  useEffect(() => {
    const wrap = wrapRef.current
    const cv = ref.current
    if (!wrap || !cv) return
    function render() {
      const w = wrap.clientWidth
      const h = Math.min(w * ratio, maxHeight)
      draw(cv, data, w, h)
    }
    render()
    const ro = new ResizeObserver(render)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [data, ratio, maxHeight])
  return (
    <div ref={wrapRef} className="cc-wrap">
      <canvas ref={ref} />
    </div>
  )
}
