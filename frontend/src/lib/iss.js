// iss.js — when can you watch the International Space Station fly over?
//
// We download the station's current orbit (a public "two-line element" set —
// the request says nothing about who or where you are) and then do all the
// pass predictions on this device, so your location never leaves it.
//
// A pass is worth watching when three things are true at once:
//   1. the station is well above your horizon,
//   2. your sky is dark (the Sun is below the horizon for you), and
//   3. the station is still in sunlight, 400 km up — that's what makes it shine.

import { twoline2satrec, propagate, gstime, eciToEcf, ecfToLookAngles } from 'satellite.js'
import { sunAt, sunAltitude, dirOf, DEG, RAD } from '../astro.js'
import { load, save } from './storage.js'

const KEY = 'cosmos.iss-orbit'
const HOUR = 3600000
const FRESH = 12 * HOUR        // re-download the orbit twice a day
const USABLE = 5 * 24 * HOUR   // an older orbit is still fine for a few days offline
const EARTH_RADIUS_KM = 6378

function parseTle(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const line1 = lines.find((l) => l.startsWith('1 '))
  const line2 = lines.find((l) => l.startsWith('2 '))
  if (!line1 || !line2) throw new Error('unreadable orbit data')
  return { line1, line2 }
}

async function downloadOrbit() {
  try {
    const r = await fetch('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE')
    if (!r.ok) throw new Error('bad response')
    return parseTle(await r.text())
  } catch {
    const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544/tles')
    if (!r.ok) throw new Error('bad response')
    const d = await r.json()
    return parseTle(`${d.line1}\n${d.line2}`)
  }
}

async function getOrbit() {
  const cached = load(KEY, null)
  const age = cached ? Date.now() - cached.at : Infinity
  if (cached && age < FRESH) return cached
  try {
    const orbit = { ...(await downloadOrbit()), at: Date.now() }
    save(KEY, orbit)
    return orbit
  } catch (e) {
    if (cached && age < USABLE) return cached
    throw e
  }
}

// Is a satellite at `pos` (km, Earth-centred) outside Earth's shadow?
function inSunlight(pos, ms) {
  const sun = sunAt(ms)
  const ra = sun.ra * DEG, dec = sun.dec * DEG
  const s = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
  const along = pos.x * s[0] + pos.y * s[1] + pos.z * s[2]
  if (along > 0) return true // on the day side of the Earth
  const distSq = pos.x * pos.x + pos.y * pos.y + pos.z * pos.z
  return Math.sqrt(distSq - along * along) > EARTH_RADIUS_KM
}

// Scan forward in time and collect the passes you could actually see.
export function findPasses(orbit, lat, lon, fromMs, days = 10) {
  const satrec = twoline2satrec(orbit.line1, orbit.line2)
  const observer = { latitude: lat * DEG, longitude: lon * DEG, height: 0 }
  const STEP = 20000
  const MIN_HEIGHT = 10 // degrees above the horizon before we count it
  const DARK_ENOUGH = -4 // Sun this far below the horizon: the station outshines the twilight
  const passes = []
  let current = null

  const finish = () => {
    // worth going outside for: gets reasonably high and lasts a couple of minutes
    if (current && current.maxAlt >= 15 && current.end - current.start >= 100000) {
      passes.push({
        ...current,
        fromDir: dirOf(current.startAz),
        toDir: dirOf(current.endAz),
        minutes: Math.max(1, Math.round((current.end - current.start) / 60000)),
        // it winks out mid-sky when it slides into Earth's shadow
        fades: current.endAlt > 15,
      })
    }
    current = null
  }

  for (let ms = fromMs; ms < fromMs + days * 24 * HOUR; ms += STEP) {
    const date = new Date(ms)
    const state = propagate(satrec, date)
    if (!state || !state.position) { finish(); continue }
    const look = ecfToLookAngles(observer, eciToEcf(state.position, gstime(date)))
    const alt = look.elevation * RAD
    const visible = alt > MIN_HEIGHT
      && sunAltitude(ms, lat, lon) < DARK_ENOUGH
      && inSunlight(state.position, ms)
    if (!visible) { finish(); continue }
    const az = look.azimuth * RAD
    if (!current) current = { start: ms, startAz: az, maxAlt: alt, peak: ms }
    if (alt > current.maxAlt) { current.maxAlt = alt; current.peak = ms }
    current.end = ms
    current.endAz = az
    current.endAlt = alt
  }
  finish()
  return passes
}

export async function getIssPasses(lat, lon, fromMs = Date.now()) {
  return findPasses(await getOrbit(), lat, lon, fromMs)
}
