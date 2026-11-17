import { useMemo } from 'react'
import Moon from './Moon.jsx'
import { computeSky } from '../astro.js'
import { fromISO } from '../lib/time.js'

// Scores each forecast night for stargazing: clear skies matter most, and a
// bright Moon that is up in the evening takes a little off (it washes out the
// faint stars).
function scoreNights(nights, lat, lon, tzHours) {
  return nights.map((n) => {
    const moon = computeSky(fromISO(n.date), 22, lat, lon, tzHours).moon
    const moonUp = moon.alt > 0
    const score = (100 - n.cloud) - (moonUp ? moon.illum * 35 : 0)
    const rating = score >= 70 ? ['great', 'Great'] : score >= 45 ? ['good', 'Good'] : score >= 25 ? ['soso', 'So-so'] : ['poor', 'Poor']
    return { ...n, moon, moonUp, score, rating }
  })
}

const skyIcon = (cloud) => (cloud < 25 ? '✨' : cloud < 60 ? '🌤️' : '☁️')

export default function BestNights({ nights, status, lat, lon, tzHours, southern, todayStr, dateStr, onPick }) {
  const scored = useMemo(() => scoreNights(nights || [], lat, lon, tzHours), [nights, lat, lon, tzHours])
  const best = scored.reduce((a, b) => (!a || b.score > a.score ? b : a), null)
  const hasGoodNight = best && best.score >= 45

  if (status === 'loading') return <div className="panel pad light">Checking the week's forecast…</div>
  if (!scored.length) {
    return <div className="panel pad light">The forecast isn't available right now (it needs the internet). Everything else on this page still works.</div>
  }

  const dayName = (iso) => (iso === todayStr ? 'Tonight' : fromISO(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }))

  return (
    <>
      <div className="nights">
        {scored.map((n) => {
          const isBest = hasGoodNight && n === best
          return (
            <button
              key={n.date}
              className={'night ' + n.rating[0] + (isBest ? ' best' : '') + (n.date === dateStr ? ' sel' : '')}
              onClick={() => onPick(n.date)}
              aria-pressed={n.date === dateStr}
            >
              {isBest && <span className="bestflag">★ Best night</span>}
              <span className="nday">{dayName(n.date)}</span>
              <span className="nico" aria-hidden="true">{skyIcon(n.cloud)}</span>
              <span className="ncloud">{n.cloud}% cloud</span>
              <Moon frac={n.moon.frac} size={26} flip={southern} />
              <span className="nmoon">{n.moonUp ? `Moon ${Math.round(n.moon.illum * 100)}%` : 'Moon down'}</span>
              <span className="nrate">{n.rating[1]}</span>
            </button>
          )
        })}
      </div>
      <p className="note">
        {hasGoodNight
          ? `${dayName(best.date)} looks best: ${best.cloud}% cloud in the evening${best.moonUp && best.moon.illum > 0.5 ? ', though a bright Moon will hide the faintest stars' : best.moonUp ? '' : ' and no Moon in the way'}. Tap a night to plan it.`
          : 'A cloudy week ahead — keep an eye out for a surprise clear evening. Tap a night to plan it.'}
      </p>
    </>
  )
}
