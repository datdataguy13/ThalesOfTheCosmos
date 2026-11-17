// events.js — "coming up in the sky": meteor showers, eclipses, special Moons
// and nights when the Moon passes close to a bright planet.
//
// Meteor showers repeat on the same dates every year and eclipses are known
// years ahead, so those are simple lists. Everything about the Moon and the
// planets is worked out from the astronomy engine for the place being viewed.

import { computeSky, moonPhaseAt, nextMoonPhase, DEG, RAD } from '../astro.js'

const DAY = 86400000

// `month`/`day` is the evening the best night starts on. `rate` is roughly how
// many meteors an hour you might count from a dark place at the peak.
const METEOR_SHOWERS = [
  { name: 'Quadrantids', month: 1, day: 3, rate: 80, hemi: 'north', when: 'after midnight', from: 'an asteroid called 2003 EH1' },
  { name: 'Lyrids', month: 4, day: 22, rate: 18, hemi: 'both', when: 'after midnight', from: 'Comet Thatcher' },
  { name: 'Eta Aquariids', month: 5, day: 5, rate: 40, hemi: 'both', when: 'just before dawn', from: "Halley's Comet" },
  { name: 'Perseids', month: 8, day: 12, rate: 100, hemi: 'north', when: 'from late evening until dawn', from: 'Comet Swift–Tuttle' },
  { name: 'Orionids', month: 10, day: 21, rate: 20, hemi: 'both', when: 'after midnight', from: "Halley's Comet" },
  { name: 'Leonids', month: 11, day: 17, rate: 15, hemi: 'both', when: 'after midnight', from: 'Comet Tempel–Tuttle' },
  { name: 'Geminids', month: 12, day: 13, rate: 120, hemi: 'both', when: 'from mid-evening, all night long', from: 'an asteroid called Phaethon' },
  { name: 'Ursids', month: 12, day: 22, rate: 10, hemi: 'north', when: 'after midnight', from: 'Comet Tuttle' },
]

// Dates are the calendar day (UTC) of the middle of the eclipse.
const ECLIPSES = [
  { date: '2027-02-06', kind: 'solar', title: 'Ring-of-fire solar eclipse', where: 'Seen from Chile, Argentina and West Africa.' },
  { date: '2027-08-02', kind: 'solar', title: 'Total solar eclipse', where: 'Day turns to night across southern Spain, North Africa, Egypt and Saudi Arabia — over six minutes of darkness, the longest for many years.' },
  { date: '2028-01-12', kind: 'lunar', title: 'Partial lunar eclipse', where: "Earth's shadow takes a small bite out of the Moon. Seen from the Americas (on the evening of the 11th), Europe and Africa." },
  { date: '2028-01-26', kind: 'solar', title: 'Ring-of-fire solar eclipse', where: 'Seen from Ecuador, Peru, Brazil, Portugal and Spain.' },
  { date: '2028-07-22', kind: 'solar', title: 'Total solar eclipse', where: 'Day turns to night across Australia (including Sydney) and New Zealand.' },
  { date: '2028-12-31', kind: 'lunar', title: 'Total lunar eclipse', where: 'The Moon turns coppery red on New Year\'s Eve. Seen from Europe, Africa, Asia and Australia.' },
  { date: '2029-06-26', kind: 'lunar', title: 'Total lunar eclipse', where: 'The Moon turns deep red. Seen from the Americas (on the night of the 25th), Europe and Africa.' },
]

// Traditional names for each month's full Moon.
const FULL_MOON_NAMES = ['Wolf', 'Snow', 'Worm', 'Pink', 'Flower', 'Strawberry', 'Buck', 'Sturgeon', 'Harvest', "Hunter's", 'Beaver', 'Cold']

const BRIGHT_PLANETS = ['Venus', 'Mars', 'Jupiter', 'Saturn']
const NIGHT_HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5]

function separation(a, b) {
  const d1 = a.dec * DEG, d2 = b.dec * DEG, dra = (a.ra - b.ra) * DEG
  const cos = Math.sin(d1) * Math.sin(d2) + Math.cos(d1) * Math.cos(d2) * Math.cos(dra)
  return Math.acos(Math.max(-1, Math.min(1, cos))) * RAD
}

const hourText = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`

function meteorEvents(today, lat) {
  const out = []
  for (const s of METEOR_SHOWERS) {
    if (s.hemi === 'north' && lat < -10) continue
    for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
      const date = new Date(year, s.month - 1, s.day)
      const daysAway = Math.round((date - today) / DAY)
      if (daysAway < 0 || daysAway > 150) continue
      // How bright is the Moon in the small hours of the peak night?
      const moon = moonPhaseAt(date.getTime() + 26 * 3600000)
      const moonNote = moon.illum < 0.3
        ? 'The Moon will be out of the way, so the sky will be nice and dark.'
        : moon.illum < 0.7
          ? 'The Moon will hide a few of the faint ones.'
          : 'A bright Moon will hide the faint ones, but the brightest still shine through.'
      out.push({
        date, ico: '🌠', kind: 'meteors',
        title: `${s.name} meteor shower`,
        text: `Up to about ${s.rate} shooting stars an hour at the peak — best ${s.when}. They are tiny bits of dust left behind by ${s.from}, burning up as Earth flies through them. ${moonNote}`,
      })
    }
  }
  return out
}

function eclipseEvents(today) {
  return ECLIPSES
    .map((e) => { const [y, m, d] = e.date.split('-').map(Number); return { ...e, when: new Date(y, m - 1, d) } })
    .filter((e) => e.when >= today)
    .slice(0, 2)
    .map((e) => ({
      date: e.when, kind: 'eclipse', ico: e.kind === 'solar' ? '🌞' : '🌕',
      title: e.title,
      text: e.where + (e.kind === 'solar' ? ' Never look at the Sun without special eclipse glasses.' : ' Safe to watch with just your eyes.'),
    }))
}

function moonEvents(today, tzHours) {
  const toLocalDay = (ms) => { const d = new Date(ms + tzHours * 3600000); return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) }
  const from = today.getTime()
  const full = toLocalDay(nextMoonPhase(from, 180))
  const dark = toLocalDay(nextMoonPhase(from, 0))
  return [
    {
      date: full, ico: '🌕', kind: 'moon',
      title: `Full ${FULL_MOON_NAMES[full.getMonth()]} Moon`,
      text: `The whole face of the Moon is lit. People long ago gave every month's full Moon its own name — this one is the ${FULL_MOON_NAMES[full.getMonth()]} Moon. Watch it rise in the east around sunset.`,
    },
    {
      date: dark, ico: '🌑', kind: 'dark',
      title: 'New Moon — the darkest nights',
      text: 'The Moon is hidden near the Sun, so the sky is at its darkest. The nights around this date are the best time to see faint stars and the Milky Way.',
    },
  ]
}

// Nights in the next month when the Moon sits close to a bright planet.
function meetupEvents(today, lat, lon, tzHours) {
  const best = {} // planet -> closest approach found
  for (let n = 0; n < 31; n++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n)
    for (const hour of NIGHT_HOURS) {
      // hours after midnight belong to the same "night" but the next calendar day
      const day = hour < 12 ? new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1) : date
      const sky = computeSky(day, hour, lat, lon, tzHours)
      if (!sky.dark || sky.moon.alt < 8) continue
      for (const name of BRIGHT_PLANETS) {
        const p = sky.planets[name]
        if (p.alt < 8 || p.elong < 12) continue
        const sep = separation(sky.moon, p)
        if (sep < 6 && (!best[name] || sep < best[name].sep)) best[name] = { sep, date, hour, dir: p.dir }
      }
    }
  }
  return Object.entries(best).map(([name, b]) => ({
    date: b.date, ico: '🌙', kind: 'meetup',
    title: `The Moon visits ${name}`,
    text: `Look ${b.dir} around ${hourText(b.hour)}${b.hour < 12 ? ' (after midnight that night)' : ''}: the bright "star" right beside the Moon is really the planet ${name}. They only look close — ${name} is millions of times farther away.`,
  }))
}

// Everything coming up, soonest first. `today` is a Date at local midnight.
export function upcomingEvents(today, lat, lon, tzHours) {
  const events = [
    ...meteorEvents(today, lat),
    ...moonEvents(today, tzHours),
    ...meetupEvents(today, lat, lon, tzHours),
    ...eclipseEvents(today),
  ]
  return events
    .map((e) => ({ ...e, daysAway: Math.round((e.date - today) / DAY) }))
    .filter((e) => e.daysAway >= 0)
    .sort((a, b) => a.date - b.date)
}

// A short, varied list of highlights: the soonest few events, but no more
// than a couple of any one kind so meteor showers don't crowd everything out.
const MOST_PER_KIND = { meteors: 2, meetup: 1, moon: 1, eclipse: 1, dark: 0 }

export function highlights(events, max = 5) {
  const used = {}
  const out = []
  for (const e of events) {
    used[e.kind] = (used[e.kind] || 0) + 1
    if (used[e.kind] <= MOST_PER_KIND[e.kind]) out.push(e)
    if (out.length === max) break
  }
  return out
}
