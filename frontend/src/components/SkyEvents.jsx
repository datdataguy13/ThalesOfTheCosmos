import { useState, useEffect, useMemo } from 'react'
import { upcomingEvents, highlights } from '../lib/events.js'
import { fmtTime, fmtDay } from '../lib/time.js'

const awayText = (n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 60 ? `In ${n} days` : `In ${Math.round(n / 30)} months`)
const heightWord = (alt) => (alt >= 60 ? 'right overhead' : alt >= 35 ? 'high in the sky' : 'low in the sky')

// Space Station flyovers. The orbit maths library is only downloaded when
// this panel is shown, and all the predicting happens on this device.
function IssPasses({ lat, lon, zone }) {
  const [state, setState] = useState({ status: 'loading', passes: [] })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', passes: [] })
    import('../lib/iss.js')
      .then((m) => m.getIssPasses(lat, lon))
      .then((passes) => { if (!cancelled) setState({ status: 'ok', passes }) })
      .catch(() => { if (!cancelled) setState({ status: 'error', passes: [] }) })
    return () => { cancelled = true }
  }, [lat, lon])

  return (
    <div className="panel pad">
      <div className="evhead">
        <span className="evico" aria-hidden="true">🛰️</span>
        <div>
          <h3>Space Station flyovers</h3>
          <p className="light small">Astronauts are living up there right now! It looks like a very bright star gliding silently across the sky — no blinking lights.</p>
        </div>
      </div>
      {state.status === 'loading' && <p className="light">Working out when it flies over you…</p>}
      {state.status === 'error' && <p className="light">Couldn't fetch the station's orbit just now — it needs the internet. Try again later.</p>}
      {state.status === 'ok' && state.passes.length === 0 && (
        <p className="light">No good flyovers in the next 10 days. The station is crossing your sky in daylight or while it's hidden in Earth's shadow — check back next week!</p>
      )}
      {state.status === 'ok' && state.passes.length > 0 && (
        <ul className="passes">
          {state.passes.slice(0, 5).map((p) => (
            <li key={p.start}>
              <div className="pwhen">
                <span className="pday">{fmtDay(p.start, zone)}</span>
                <span className="ptime">{fmtTime(p.start, zone)}</span>
              </div>
              <div className="pwhat">
                Look <b>{p.fromDir}</b>. It climbs {heightWord(p.maxAlt)} ({Math.round(p.maxAlt)}° up) and
                {p.fades ? <> fades out toward the <b>{p.toDir}</b> as it slips into Earth's shadow</> : <> sets toward the <b>{p.toDir}</b></>}.
                <span className="plen"> Visible for about {p.minutes} min.</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function SkyEvents({ lat, lon, zone, tzHours, today }) {
  const events = useMemo(() => highlights(upcomingEvents(today, lat, lon, tzHours)), [today, lat, lon, tzHours])
  return (
    <div className="evgrid">
      <IssPasses lat={lat} lon={lon} zone={zone} />
      <div className="panel pad">
        <div className="evhead">
          <span className="evico" aria-hidden="true">🗓️</span>
          <div>
            <h3>Sky calendar</h3>
            <p className="light small">Shooting stars, special Moons and eclipses to look forward to.</p>
          </div>
        </div>
        <ul className="events">
          {events.map((e) => (
            <li key={e.title + e.date.getTime()}>
              <span className="eico" aria-hidden="true">{e.ico}</span>
              <div>
                <div className="etitle">{e.title}</div>
                <div className="ewhen">
                  {e.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: e.daysAway > 300 ? 'numeric' : undefined })}
                  <span className={'eaway' + (e.daysAway <= 1 ? ' soon' : '')}>{awayText(e.daysAway)}</span>
                </div>
                <p className="etext">{e.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
