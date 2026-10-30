import { useState, useMemo, useEffect, useRef } from 'react'
import { computeSky, altOf } from './astro.js'
import { CITIES } from './data/cities.js'
import { PLANETS } from './data/planets.js'
import { CONSTELLATIONS } from './data/constellations.js'
import { getCurrentLocation, placeNameFor, searchCity } from './lib/location.js'
import { getWeather } from './lib/weather.js'
import Starfield from './components/Starfield.jsx'
import Moon from './components/Moon.jsx'
import PlanetIcon from './components/PlanetIcon.jsx'
import ConstellationCanvas from './components/ConstellationCanvas.jsx'
import ConstellationModal from './components/ConstellationModal.jsx'
import AskSky from './components/AskSky.jsx'

const SKY_META = {
  clear: { label: 'Crystal clear', ico: '✨', stars: 'thousands of' },
  some: { label: 'A few clouds', ico: '🌤️', stars: 'plenty of' },
  cloudy: { label: 'Cloudy', ico: '☁️', stars: 'almost no' },
  city: { label: 'Bright city lights', ico: '🏙️', stars: 'the brightest' },
}
const PHASE_NAMES = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent']

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtDays = (n) => { const d = Math.round(n); return d <= 0 ? 'today' : d === 1 ? '1 day' : d + ' days' }
const hourText = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`

export default function App() {
  const now = new Date()
  const [theme, setTheme] = useState('auto')
  const [place, setPlace] = useState({ name: CITIES[0][0], lat: CITIES[0][1], lon: CITIES[0][2], source: 'default' })
  const [dateStr, setDateStr] = useState(toISO(now))
  const [hour, setHour] = useState(21)
  const [override, setOverride] = useState(null) // manual sky-condition override

  const [weather, setWeather] = useState(null)
  const [weatherState, setWeatherState] = useState('idle') // idle|loading|ok|error
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(null)

  // theme attribute
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // fetch live weather whenever the place changes
  useEffect(() => {
    let cancelled = false
    setWeatherState('loading')
    setOverride(null)
    getWeather(place.lat, place.lon)
      .then((w) => { if (!cancelled) { setWeather(w); setWeatherState('ok') } })
      .catch(() => { if (!cancelled) { setWeather(null); setWeatherState('error') } })
    return () => { cancelled = true }
  }, [place.lat, place.lon])

  // debounced city search
  const qRef = useRef()
  useEffect(() => {
    clearTimeout(qRef.current)
    if (query.trim().length < 2) { setResults([]); return }
    qRef.current = setTimeout(async () => setResults(await searchCity(query)), 300)
    return () => clearTimeout(qRef.current)
  }, [query])

  async function useMyLocation() {
    setLocating(true); setLocError('')
    try {
      const { lat, lon } = await getCurrentLocation()
      const name = await placeNameFor(lat, lon)
      setPlace({ name, lat, lon, source: 'gps' })
      setQuery(''); setResults([])
    } catch (e) {
      setLocError(e.message || 'Could not get your location.')
    } finally {
      setLocating(false)
    }
  }

  const dateObj = useMemo(() => { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d) }, [dateStr])
  const sky = useMemo(() => computeSky(dateObj, hour, place.lat, place.lon), [dateObj, hour, place.lat, place.lon])

  const condition = override || (weather && weather.condition) || 'clear'
  const meta = SKY_META[condition]
  const hourLabel = hourText(hour)
  const southern = place.lat < 0

  const planetState = (p) => {
    const d = sky.planets[p.key]
    const tooClose = d.elong < 12
    const up = d.alt > 8 && !tooClose && sky.dark
    return { d, tooClose, up }
  }

  const verdict = useMemo(() => {
    if (condition === 'cloudy') return {
      ico: '☁️', big: 'Clouds tonight — a cosy night in',
      lede: 'The sky is covered, so the stars are hidden. Check back tomorrow — the Moon and planets will have moved!',
    }
    const upPlanets = PLANETS.filter((p) => planetState(p).up).map((p) => p.key)
    const upConst = CONSTELLATIONS.filter((c) => altOf(c.ra, c.dec, sky) > 12).length
    const moonBright = sky.moon.illum > 0.65 && sky.moon.alt > 0
    if (!sky.dark) return {
      ico: '🌇', big: "It's not dark yet",
      lede: `At ${hourLabel} the Sun is still up or the sky is in twilight from ${place.name}. Try a later hour — the stars come out once it's properly dark.`,
    }
    if (condition === 'city') return {
      ico: '🏙️', big: 'City skies — hunt the bright ones',
      lede: `City lights hide the faint stars, but you can still spot the Moon, ${upPlanets.slice(0, 2).join(' and ') || 'bright planets'} and the brightest constellations like Orion.`,
    }
    return {
      ico: meta.ico,
      big: upPlanets.length >= 2 ? 'A great night to be outside!' : 'Plenty to spot tonight',
      lede: `From ${place.name} at ${hourLabel} you'll see ${meta.stars} stars. ${upPlanets.length ? `${upPlanets.length} planet${upPlanets.length > 1 ? 's are' : ' is'} up (${upPlanets.join(', ')}), and ` : ''}${upConst} of our constellations are above the horizon.${moonBright ? ' The bright Moon will wash out the faintest stars.' : ''}`,
    }
  }, [sky, condition, hourLabel, place.name, meta])

  const activePhaseIdx = PHASE_NAMES.indexOf(sky.moon.name)

  return (
    <>
      <header className="hero">
        <Starfield />
        <div className="wrap hero-inner">
          <div className="brandrow">
            <div className="brand">
              <svg className="mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <circle cx="24" cy="24" r="22" stroke="#ffd271" strokeWidth="1.5" opacity="0.5" />
                <path d="M30 13a13 13 0 1 0 5 15 10 10 0 1 1-5-15Z" fill="#f3efe0" />
                <circle cx="16" cy="12" r="1.4" fill="#ffd271" />
                <circle cx="37" cy="36" r="1.2" fill="#ffd271" />
                <circle cx="11" cy="30" r="1" fill="#fff" />
              </svg>
              <div>
                <h1>Thales of the Cosmos</h1>
                <div className="sub">What's in the sky tonight — a stargazing guide for curious kids</div>
              </div>
            </div>
            <button className="themebtn" onClick={() => setTheme((t) => (t === 'light' ? 'auto' : t === 'auto' ? 'dark' : 'light'))}>
              {theme === 'light' ? '☀️ Day' : theme === 'dark' ? '🌙 Night' : '🌓 Auto'}
            </button>
          </div>

          {/* location row */}
          <div className="locrow">
            <button className="locbtn" onClick={useMyLocation} disabled={locating}>
              {locating ? '📍 Finding you…' : '📍 Use my location'}
            </button>
            <div className="citysearch">
              <input
                type="text" value={query} placeholder="…or search for a city"
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search for a city"
              />
              {results.length > 0 && (
                <ul className="results">
                  {results.map((r, i) => (
                    <li key={i}>
                      <button onClick={() => { setPlace({ name: r.name, lat: r.lat, lon: r.lon, source: 'search' }); setQuery(''); setResults([]) }}>
                        {r.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="placechip">
              <span className="pin">🌍</span>
              <span>{place.name}</span>
            </div>
          </div>
          {locError && <div className="locerror">{locError} You can search for a city instead.</div>}

          {/* controls */}
          <div className="controls">
            <div className="ctrl">
              <label>Which night?</label>
              <input type="date" value={dateStr} onChange={(e) => e.target.value && setDateStr(e.target.value)} />
            </div>
            <div className="ctrl">
              <label>What time?</label>
              <select value={hour} onChange={(e) => setHour(+e.target.value)}>
                {[18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5].map((h) => (
                  <option key={h} value={h}>{hourText(h)}{h < 6 ? ' (after midnight)' : ''}</option>
                ))}
              </select>
            </div>
            <div className="ctrl">
              <label>Tonight's sky {weatherState === 'ok' && !override && <span className="live">● live</span>}</label>
              <select value={condition} onChange={(e) => setOverride(e.target.value)}>
                {Object.entries(SKY_META).map(([k, v]) => (
                  <option key={k} value={k}>{v.ico} {v.label}</option>
                ))}
              </select>
            </div>
            <div className="ctrl weatherbox">
              <label>Weather now</label>
              <div className="weatherval">
                {weatherState === 'loading' && 'checking…'}
                {weatherState === 'error' && 'unavailable — set it yourself'}
                {weatherState === 'ok' && weather && `${weather.description}${typeof weather.tempC === 'number' ? `, ${Math.round(weather.tempC)}°C` : ''}`}
                {weatherState === 'idle' && '—'}
              </div>
            </div>
          </div>

          <div className="verdict">
            <div className="ico">{verdict.ico}</div>
            <div>
              <div className="big">{verdict.big}</div>
              <div className="lede">{verdict.lede}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="wrap">
        {/* MOON */}
        <section>
          <div className="sechead">
            <span className="eyebrow">Step 1</span>
            <h2>The Moon tonight</h2>
            <p>The Moon changes shape a little every night — here's exactly how it looks{southern ? ' from the southern hemisphere' : ''}.</p>
          </div>
          <div className="panel">
            <div className="moongrid">
              <div className="moonstage">
                <Moon frac={sky.moon.frac} size={210} flip={southern} />
                <div className="moon-name">{sky.moon.name}</div>
              </div>
              <div>
                <div className="statrow">
                  <div className="stat"><div className="k">Lit up</div><div className="v">{Math.round(sky.moon.illum * 100)}%</div></div>
                  <div className="stat"><div className="k">Moon age</div><div className="v">{sky.moon.age.toFixed(1)} days</div></div>
                  <div className="stat"><div className="k">{sky.moon.waxing ? 'Next Full Moon' : 'Next New Moon'}</div>
                    <div className="v">{fmtDays(sky.moon.waxing ? sky.moon.toNextFull : sky.moon.toNextNew)}</div></div>
                  <div className="stat"><div className="k">Right now</div>
                    <div className="v">{sky.moon.alt > 0 ? `up, ${sky.moon.dir}` : 'below horizon'}</div></div>
                </div>
                <p className="explain">
                  {sky.moon.waxing
                    ? <>The Moon is <b>waxing</b> (growing). Each night a little more of its sunlit side turns to face us, until it becomes a full circle.</>
                    : <>The Moon is <b>waning</b> (shrinking). Each night a little less of its sunlit side faces us, until it fades to a thin sliver and disappears.</>}
                  {' '}We always see the same half of the Moon — the phases are just sunlight falling on it at different angles as it circles the Earth each month.
                </p>
                <p className="note">Tip: pick a few nights in a row with the date picker and watch the shape grow or shrink.</p>
              </div>
            </div>
            <div className="phstrip">
              {PHASE_NAMES.map((nm, i) => {
                const f = i / 8
                return (
                  <div className={'phase' + (i === activePhaseIdx ? ' active' : '')} key={nm}>
                    <Moon frac={f} size={44} flip={southern} />
                    <span className="pl">{nm}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ASK THE SKY */}
        <section>
          <div className="sechead">
            <span className="eyebrow">Step 2</span>
            <h2>Ask the sky</h2>
            <p>Let the kids type their own space questions and get friendly answers.</p>
          </div>
          <AskSky sky={sky} cityName={place.name} hourLabel={hourLabel} constellations={CONSTELLATIONS} />
        </section>

        {/* PLANETS */}
        <section>
          <div className="sechead">
            <span className="eyebrow">Step 3</span>
            <h2>Planets through the telescope</h2>
            <p>Which planets are above the horizon from {place.name} at {hourLabel}, and what you'd see.</p>
          </div>
          <div className="cards">
            {PLANETS.map((p) => {
              const { d, tooClose, up } = planetState(p)
              return (
                <div className={'pcard ' + (up ? 'up' : 'down')} key={p.key}>
                  <div className="top">
                    <PlanetIcon planet={p} />
                    <div>
                      <h3>{p.key}</h3>
                      {up ? <span className="badge on">● Up now · look {d.dir}</span>
                        : tooClose ? <span className="badge sun">☼ Too close to the Sun</span>
                          : !sky.dark ? <span className="badge off">🌇 Wait for dark</span>
                            : <span className="badge off">↓ Below the horizon</span>}
                    </div>
                  </div>
                  {up && <div className="where">{Math.round(d.alt)}° above the horizon, toward the {d.dir}</div>}
                  <div className="scope light">{p.scope}</div>
                  <div className="pfact">★ {p.fact}</div>
                </div>
              )
            })}
          </div>
          <p className="note">Planets slowly drift against the stars, so their positions change over weeks — try a date a month from now and watch them move. "Too close to the Sun" means the planet is lost in the Sun's glare for now.</p>
        </section>

        {/* CONSTELLATIONS */}
        <section>
          <div className="sechead">
            <span className="eyebrow">Step 4</span>
            <h2>Constellations &amp; their stories</h2>
            <p>Tap any card to see how to find it, hear the ancient story, and check if it's up tonight.</p>
          </div>
          <div className="cgrid">
            {CONSTELLATIONS.map((c, i) => {
              const alt = altOf(c.ra, c.dec, sky)
              const vis = alt > 12 ? ['hi', 'High & easy'] : alt > 0 ? ['lo', 'Low on horizon'] : ['no', 'Not up tonight']
              return (
                <button className="ccard" key={c.name} onClick={() => setOpen(i)}>
                  <div className="sky"><ConstellationCanvas data={c} ratio={0.6} maxHeight={170} /></div>
                  <div className="meta">
                    <h3>{c.name} <span className="ctitle">· {c.title}</span></h3>
                    <div className="row">
                      <span className="sea">{c.season}</span>
                      <span className={'vis ' + vis[0]}>{vis[1]}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <footer>
          <p><b>Thales of the Cosmos</b> is a learning tool. The Moon phase and planet positions are calculated from real astronomy for the night you pick, using your location and live weather; the star patterns are drawn to help you recognise each shape, not to exact scale.</p>
          <p className="note">Named after Thales of Miletus, one of the first people to study the stars with reason instead of myth — around 2,600 years ago.</p>
        </footer>
      </main>

      {open != null && (
        <ConstellationModal
          c={CONSTELLATIONS[open]} sky={sky} cityName={place.name} hourLabel={hourLabel}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
