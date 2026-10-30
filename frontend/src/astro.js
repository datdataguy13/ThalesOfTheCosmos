// astro.js — self-contained positional astronomy (no network, no dependencies).
// Accuracy is "field-guide" level: good enough to tell you what's up tonight,
// which way to look, and how the Moon looks. Not for spacecraft navigation :)

export const DEG = Math.PI / 180
export const RAD = 180 / Math.PI
export const n360 = (d) => ((d % 360) + 360) % 360
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x))

export function jdFromMs(ms) {
  return ms / 86400000 + 2440587.5
}

// JPL approximate orbital elements (value, rate per Julian century), valid ~1800-2050.
// [a, a', e, e', I, I', L, L', peri, peri', node, node']  (angles in degrees, a in AU)
const ELEM = {
  Mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.25032350, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  Venus: [0.72333566, 0.00000390, 0.00677672, -0.00004107, 3.39467605, -0.00078890, 181.97909950, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  Earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0.0, 0.0],
  Mars: [1.52371034, 0.00001847, 0.09339410, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  Jupiter: [5.20288700, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  Saturn: [9.53667594, -0.00125060, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
  Uranus: [19.18916464, -0.00196176, 0.04725744, -0.00004397, 0.77263783, -0.00242939, 313.23810451, 428.48202785, 170.95427630, 0.40805281, 74.01692503, 0.04240589],
}

function helio(name, T) {
  const e = ELEM[name]
  const a = e[0] + e[1] * T
  const ec = e[2] + e[3] * T
  const I = (e[4] + e[5] * T) * DEG
  const L = e[6] + e[7] * T
  const peri = e[8] + e[9] * T
  const node = (e[10] + e[11] * T) * DEG
  const w = peri * DEG - node
  let M = n360(L - peri)
  if (M > 180) M -= 360
  M *= DEG
  let E = M + ec * Math.sin(M)
  for (let i = 0; i < 8; i++) E -= (E - ec * Math.sin(E) - M) / (1 - ec * Math.cos(E))
  const xo = a * (Math.cos(E) - ec)
  const yo = a * Math.sqrt(1 - ec * ec) * Math.sin(E)
  const cw = Math.cos(w), sw = Math.sin(w), cn = Math.cos(node), sn = Math.sin(node), ci = Math.cos(I), si = Math.sin(I)
  return [
    (cw * cn - sw * sn * ci) * xo + (-sw * cn - cw * sn * ci) * yo,
    (cw * sn + sw * cn * ci) * xo + (-sw * sn + cw * cn * ci) * yo,
    (sw * si) * xo + (cw * si) * yo,
  ]
}

const OBL = 23.43928 * DEG
function eclToEq(v) {
  return [v[0], v[1] * Math.cos(OBL) - v[2] * Math.sin(OBL), v[1] * Math.sin(OBL) + v[2] * Math.cos(OBL)]
}
function toRaDec(v) {
  return {
    ra: n360(Math.atan2(v[1], v[0]) * RAD),
    dec: Math.atan2(v[2], Math.hypot(v[0], v[1])) * RAD,
  }
}

// altitude / azimuth from RA/Dec (deg), local sidereal time (deg), latitude (deg)
export function altaz(ra, dec, lst, lat) {
  const H = (lst - ra) * DEG, d = dec * DEG, p = lat * DEG
  const sinAlt = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H)
  const alt = Math.asin(clamp(sinAlt, -1, 1))
  const cosAz = (Math.sin(d) - Math.sin(p) * sinAlt) / (Math.cos(p) * Math.cos(alt))
  let az = Math.acos(clamp(cosAz, -1, 1)) * RAD
  if (Math.sin(H) > 0) az = 360 - az
  return { alt: alt * RAD, az }
}

export function gmst(JD) {
  return n360(280.46061837 + 360.98564736629 * (JD - 2451545.0))
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export const dirOf = (az) => COMPASS[Math.round(n360(az) / 22.5) % 16]

// Moon ecliptic position (short series, accurate to a fraction of a degree)
function moonRaDec(T) {
  const Lp = n360(218.3164477 + 481267.88123421 * T)
  const D = n360(297.8501921 + 445267.1114034 * T) * DEG
  const M = n360(357.5291092 + 35999.0502909 * T) * DEG
  const Mp = n360(134.9633964 + 477198.8675055 * T) * DEG
  const F = n360(93.2720950 + 483202.0175233 * T) * DEG
  const lon = Lp + 6.289 * Math.sin(Mp) + 1.274 * Math.sin(2 * D - Mp) + 0.658 * Math.sin(2 * D)
    + 0.214 * Math.sin(2 * Mp) - 0.186 * Math.sin(M) - 0.114 * Math.sin(2 * F)
    + 0.059 * Math.sin(2 * D - 2 * Mp) + 0.057 * Math.sin(2 * D - M - Mp)
  const lat = 5.128 * Math.sin(F) + 0.281 * Math.sin(Mp + F) + 0.278 * Math.sin(F - Mp)
    + 0.173 * Math.sin(2 * D - F)
  const l = lon * DEG, b = lat * DEG
  const v = [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)]
  return toRaDec(eclToEq(v))
}

const SYN = 29.530588853
const NEW0 = 2451550.1 // a known new moon (2000-01-06 18:14 UT)

export function moonPhase(JD) {
  const age = ((JD - NEW0) % SYN + SYN) % SYN
  const frac = age / SYN
  const illum = (1 - Math.cos(2 * Math.PI * frac)) / 2
  const waxing = frac < 0.5
  const toNextNew = ((1 - frac) % 1) * SYN
  const toNextFull = (((0.5 - frac) % 1 + 1) % 1) * SYN
  let name
  if (frac < 0.03 || frac > 0.97) name = 'New Moon'
  else if (frac < 0.22) name = 'Waxing Crescent'
  else if (frac < 0.28) name = 'First Quarter'
  else if (frac < 0.47) name = 'Waxing Gibbous'
  else if (frac < 0.53) name = 'Full Moon'
  else if (frac < 0.72) name = 'Waning Gibbous'
  else if (frac < 0.78) name = 'Last Quarter'
  else name = 'Waning Crescent'
  return { age, frac, illum, waxing, name, toNextNew, toNextFull }
}

// Full sky snapshot for a place and civil instant.
// dateObj: local Date (y/m/d used); hourLocal: 0-23; lat/lon in degrees (east +).
export function computeSky(dateObj, hourLocal, lat, lon) {
  const tz = Math.round(lon / 15)
  const ms = Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0)
    + (hourLocal - tz) * 3600 * 1000
  const JD = jdFromMs(ms)
  const T = (JD - 2451545) / 36525
  const lst = n360(gmst(JD) + lon)
  const earth = helio('Earth', T)
  const sunGeo = [-earth[0], -earth[1], -earth[2]]
  const sun = toRaDec(eclToEq(sunGeo))
  const sunAA = altaz(sun.ra, sun.dec, lst, lat)
  const dark = sunAA.alt < -6 // civil twilight or darker

  const planets = {}
  for (const p of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus']) {
    const h = helio(p, T)
    const geo = [h[0] - earth[0], h[1] - earth[1], h[2] - earth[2]]
    const rd = toRaDec(eclToEq(geo))
    const aa = altaz(rd.ra, rd.dec, lst, lat)
    const dot = (geo[0] * sunGeo[0] + geo[1] * sunGeo[1] + geo[2] * sunGeo[2])
      / (Math.hypot(...geo) * Math.hypot(...sunGeo))
    const elong = Math.acos(clamp(dot, -1, 1)) * RAD
    planets[p] = { alt: aa.alt, az: aa.az, dir: dirOf(aa.az), elong, dist: Math.hypot(...geo) }
  }

  const mrd = moonRaDec(T)
  const maa = altaz(mrd.ra, mrd.dec, lst, lat)
  const phase = moonPhase(JD)

  return {
    JD, lst, lat, lon, tz, dark,
    sun: { ...sun, ...sunAA },
    planets,
    moon: { ...phase, alt: maa.alt, az: maa.az, dir: dirOf(maa.az) },
  }
}

// Altitude of a fixed sky point (a constellation's center) for this sky snapshot.
export function altOf(ra, dec, sky) {
  return altaz(ra, dec, sky.lst, sky.lat).alt
}
