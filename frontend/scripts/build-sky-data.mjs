// Builds src/data/sky.json — the real star positions and constellation lines
// used by the sky dome. Run it by hand only if you want to regenerate the data:
//
//   node scripts/build-sky-data.mjs
//
// Source: the d3-celestial project's data files (stars from the Hipparcos
// catalogue), Copyright (c) 2015 Olaf Frohn, BSD 3-Clause licence.
// https://github.com/ofrohn/d3-celestial

import { writeFileSync } from 'node:fs'

const SOURCE = 'https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/'
const FAINTEST = 5.2 // about what you can see by eye from a dark garden
const NAME_BRIGHTER_THAN = 1.7
const ALWAYS_NAME = ['Polaris']

const get = async (file) => {
  const r = await fetch(SOURCE + file)
  if (!r.ok) throw new Error(`could not download ${file}`)
  return r.json()
}
const round = (x, places = 2) => +x.toFixed(places)
const ra360 = (lon) => round(((lon % 360) + 360) % 360)

const [stars, lines, constellations, starNames] = await Promise.all([
  get('stars.6.json'), get('constellations.lines.json'), get('constellations.json'), get('starnames.json'),
])

// colour bucket from the star's B–V colour index: 0 blue … 4 orange-red
const colourOf = (bv) => (bv < 0 ? 0 : bv < 0.3 ? 1 : bv < 0.6 ? 2 : bv < 1.1 ? 3 : 4)

const bright = stars.features
  .filter((f) => f.properties.mag <= FAINTEST)
  .sort((a, b) => a.properties.mag - b.properties.mag)

const out = {
  credit: 'Star and constellation data derived from d3-celestial, Copyright (c) 2015 Olaf Frohn, BSD 3-Clause licence.',
  // flat list: ra, dec, magnitude, colour bucket — brightest first
  stars: bright.flatMap((f) => [
    ra360(f.geometry.coordinates[0]), round(f.geometry.coordinates[1]),
    round(f.properties.mag, 1), colourOf(parseFloat(f.properties.bv) || 0.5),
  ]),
  // [name, ra, dec] for the famous ones
  named: bright
    .map((f) => ({ f, name: (starNames[f.id] || {}).name }))
    .filter(({ f, name }) => name && (f.properties.mag < NAME_BRIGHTER_THAN || ALWAYS_NAME.includes(name)))
    .map(({ f, name }) => [name, ra360(f.geometry.coordinates[0]), round(f.geometry.coordinates[1])]),
  // id -> { name, at: [ra, dec] label position, lines: [[[ra, dec], …], …] }
  constellations: Object.fromEntries(constellations.features.map((c) => {
    const drawn = lines.features.find((l) => l.id === c.id)
    return [c.id, {
      name: c.properties.name,
      at: [ra360(c.geometry.coordinates[0]), round(c.geometry.coordinates[1])],
      lines: drawn ? drawn.geometry.coordinates.map((path) => path.map(([lon, lat]) => [ra360(lon), round(lat)])) : [],
    }]
  })),
}

const target = new URL('../src/data/sky.json', import.meta.url)
writeFileSync(target, JSON.stringify(out))
console.log(`${out.stars.length / 4} stars, ${out.named.length} named, ${Object.keys(out.constellations).length} constellations`)
console.log('named:', out.named.map((n) => n[0]).join(', '))
