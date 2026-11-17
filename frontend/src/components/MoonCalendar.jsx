import { useState, useEffect, useMemo } from 'react'
import Moon from './Moon.jsx'
import { moonPhaseAt, n360 } from '../astro.js'
import { toISO, fromISO } from '../lib/time.js'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MARKERS = [[0, 'New'], [90, '1st Qtr'], [180, 'Full'], [270, 'Last Qtr']]
const HOUR = 3600000

// Which of the four main phases (if any) happens during a day: the Moon's
// angle from the Sun passes the target between one midnight and the next.
function markerFor(startMs) {
  const before = moonPhaseAt(startMs).elong
  const after = moonPhaseAt(startMs + 24 * HOUR).elong
  for (const [target, label] of MARKERS) {
    if (n360(before - target) > 300 && n360(after - target) < 60) return label
  }
  return null
}

// A whole month of Moons. Tap a night to jump to it.
export default function MoonCalendar({ dateStr, todayStr, onPick, southern, tzHours }) {
  const selected = fromISO(dateStr)
  const [view, setView] = useState({ y: selected.getFullYear(), m: selected.getMonth() })

  // follow the date picker when it moves to another month
  useEffect(() => {
    const d = fromISO(dateStr)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }, [dateStr])

  const days = useMemo(() => {
    const count = new Date(view.y, view.m + 1, 0).getDate()
    return Array.from({ length: count }, (_, i) => {
      const day = i + 1
      const midnight = Date.UTC(view.y, view.m, day) - tzHours * HOUR // the place's midnight
      return {
        day,
        iso: toISO(new Date(view.y, view.m, day)),
        frac: moonPhaseAt(midnight + 21 * HOUR).frac, // how it looks at 9pm
        marker: markerFor(midnight),
      }
    })
  }, [view, tzHours])

  const blanks = new Date(view.y, view.m, 1).getDay()
  const title = new Date(view.y, view.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const step = (n) => setView((v) => { const d = new Date(v.y, v.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })

  return (
    <div className="mooncal">
      <div className="mooncal-head">
        <button className="calnav" onClick={() => step(-1)} aria-label="Previous month">‹</button>
        <h3>{title}</h3>
        <button className="calnav" onClick={() => step(1)} aria-label="Next month">›</button>
      </div>
      <div className="mooncal-grid">
        {WEEKDAYS.map((w) => <div className="calwd" key={w}>{w}</div>)}
        {Array.from({ length: blanks }, (_, i) => <div key={'b' + i} />)}
        {days.map((d) => (
          <button
            key={d.iso}
            className={'calday' + (d.iso === dateStr ? ' sel' : '') + (d.iso === todayStr ? ' today' : '') + (d.marker ? ' main' : '')}
            onClick={() => onPick(d.iso)}
            aria-label={`${title} ${d.day}${d.marker ? ', ' + d.marker + ' Moon' : ''}`}
            aria-pressed={d.iso === dateStr}
          >
            <span className="calnum">{d.day}</span>
            <Moon frac={d.frac} size={30} flip={southern} />
            <span className="calmark">{d.marker || ''}</span>
          </button>
        ))}
      </div>
      <p className="note">Each little Moon shows how it looks that evening. Tap a night to see its whole sky.</p>
    </div>
  )
}
