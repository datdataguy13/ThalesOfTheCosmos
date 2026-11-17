import { useState, useEffect, useRef } from 'react'

// Connect-the-stars: the stars of a constellation are shown without their
// lines. Tap one star, then another, to draw a line between them. Lines that
// belong to the real pattern stay; wrong ones fade away.

const W = 1000, H = 620, PAD = 0.12
const sx = (u) => W * (PAD + u * (1 - 2 * PAD))
const sy = (v) => H * (PAD + v * (1 - 2 * PAD))
const keyOf = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`)

// a sprinkle of faint background stars, the same every time
const DUST = Array.from({ length: 46 }, (_, i) => ({
  x: ((i * 73) % 100) / 100 * W,
  y: ((i * 131) % 100) / 100 * H,
  r: 1.5 + ((i * 37) % 10) / 4,
  o: 0.2 + ((i * 17) % 10) / 25,
}))

export default function ConstellationGame({ constellations, drawn, onSolved, onStory }) {
  const [idx, setIdx] = useState(0)
  const [made, setMade] = useState(() => new Set())
  const [pick, setPick] = useState(null)
  const [wrong, setWrong] = useState(null)
  const [peek, setPeek] = useState(false)
  const [hint, setHint] = useState(null)
  const timers = useRef([])

  const c = constellations[idx]
  const wanted = c.links.map(([a, b]) => keyOf(a, b))
  const solved = made.size === wanted.length

  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)) }
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  useEffect(() => clearTimers, [])

  function start(i) {
    clearTimers()
    setIdx(i); setMade(new Set()); setPick(null); setWrong(null); setPeek(false); setHint(null)
  }

  function tap(i) {
    if (solved) return
    setHint(null)
    if (pick == null) { setPick(i); return }
    if (pick === i) { setPick(null); return }
    const key = keyOf(pick, i)
    if (wanted.includes(key)) {
      const next = new Set(made).add(key)
      setMade(next)
      if (next.size === wanted.length) { setPick(null); onSolved(c.name); return }
      // keep drawing from this star if it still has lines to find
      const more = wanted.some((k) => !next.has(k) && k.split('-').map(Number).includes(i))
      setPick(more ? i : null)
    } else {
      setWrong([pick, i])
      later(() => setWrong(null), 650)
    }
  }

  function showHint() {
    const missing = wanted.find((k) => !made.has(k))
    if (!missing) return
    setHint(missing.split('-').map(Number))
    later(() => setHint(null), 1800)
  }

  function showPeek() {
    setPeek(true)
    later(() => setPeek(false), 1600)
  }

  const line = ([a, b], cls, key) => (
    <line key={key} className={cls} x1={sx(c.stars[a][0])} y1={sy(c.stars[a][1])} x2={sx(c.stars[b][0])} y2={sy(c.stars[b][1])} />
  )

  return (
    <div className="panel game">
      <div className="game-top">
        <div>
          <span className="tag">Draw it yourself</span>
          <h3>{c.name} <span className="ctitle">· {c.title}</span></h3>
        </div>
        <label className="gamepick">
          <span className="sr">Choose a constellation</span>
          <select value={idx} onChange={(e) => start(+e.target.value)}>
            {constellations.map((k, i) => <option key={k.name} value={i}>{drawn.has(k.name) ? '✓ ' : ''}{k.name}</option>)}
          </select>
        </label>
      </div>

      <div className="game-sky">
        <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Stars of ${c.name}`}>
          {DUST.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#dfe6ff" opacity={d.o} />)}
          {peek && c.links.map((l, i) => line(l, 'gline peek', 'p' + i))}
          {c.links.filter(([a, b]) => made.has(keyOf(a, b))).map((l, i) => line(l, 'gline' + (solved ? ' done' : ''), 'm' + i))}
          {wrong && line(wrong, 'gline wrong', 'w')}
          {c.stars.map(([u, v, mag], i) => {
            const on = pick === i || (hint && hint.includes(i))
            return (
              <g
                key={i} className={'gstar' + (on ? ' on' : '')} role="button" tabIndex={0}
                aria-label={`Star ${i + 1}${pick === i ? ', selected' : ''}`}
                onClick={() => tap(i)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(i) } }}
              >
                <circle className="hit" cx={sx(u)} cy={sy(v)} r={42} />
                <circle className="glow" cx={sx(u)} cy={sy(v)} r={14 + mag * 7} />
                <circle className="core" cx={sx(u)} cy={sy(v)} r={5 + mag * 2.6} />
              </g>
            )
          })}
        </svg>
      </div>

      <div className="game-bar">
        {solved ? (
          <>
            <div className="game-msg win">⭐ You drew {c.name} — {c.title}!</div>
            <div className="game-btns">
              <button className="gbtn" onClick={() => onStory(idx)}>📖 Read its story</button>
              <button className="gbtn primary" onClick={() => start((idx + 1) % constellations.length)}>Next one →</button>
            </div>
          </>
        ) : (
          <>
            <div className="game-msg">
              {pick == null ? 'Tap a star to start a line.' : 'Now tap the star it joins to.'}
              <span className="game-count"> {made.size} of {wanted.length} lines</span>
            </div>
            <div className="game-btns">
              <button className="gbtn" onClick={showHint}>💡 Hint</button>
              <button className="gbtn" onClick={showPeek}>👀 Peek</button>
              <button className="gbtn" onClick={() => start(idx)}>↺ Start over</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
