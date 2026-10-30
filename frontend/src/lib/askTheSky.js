// askTheSky.js — a fully offline, kid-safe "sky expert".
// It answers common astronomy questions using a curated knowledge base plus the
// LIVE sky snapshot (so "can I see Saturn tonight?" gives a real answer for the
// chosen place and time). No network, no AI service, nothing leaves the device.

const PLANET_NAMES = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus']

export const SUGGESTIONS = [
  'Why does the Moon change shape?',
  'Can I see Saturn tonight?',
  'Why do stars twinkle?',
  'What is the brightest star?',
  'What is a shooting star?',
  'How far away is the Moon?',
  'What is the Milky Way?',
  'Why is Mars red?',
]

function planetStatus(key, sky) {
  const p = sky.planets[key]
  if (!p) return { up: false, reason: 'unknown' }
  const tooClose = p.elong < 12
  const alt = Math.round(p.alt)
  if (!sky.dark) return { up: false, reason: 'twilight', alt, dir: p.dir }
  if (tooClose) return { up: false, reason: 'sun', alt, dir: p.dir }
  if (p.alt <= 8) return { up: false, reason: 'below', alt, dir: p.dir }
  return { up: true, alt, dir: p.dir }
}

function findPlanet(q) {
  return PLANET_NAMES.find((n) => q.includes(n.toLowerCase()))
}

function findConstellation(q, constellations) {
  return constellations.find((c) => {
    const words = [c.name.toLowerCase(), ...c.title.toLowerCase().split(/[^a-z]+/)].filter((w) => w.length > 3)
    return words.some((w) => q.includes(w))
  })
}

// Each rule: a test on the lowercased question, and an answer builder.
const RULES = [
  // ---- Moon ----
  {
    test: (q) => /(moon).*(shape|phase|change|grow|shrink|crescent|gibbous)|why.*moon|phases/.test(q),
    answer: (q, ctx) => {
      const m = ctx.sky.moon
      return `The Moon doesn't really change shape — we're just seeing sunlight hit it from different angles as it circles the Earth each month. Half the Moon is always lit by the Sun, but we only see part of that lit half, so it looks like it grows and shrinks. Tonight it's a ${m.name} with about ${Math.round(m.illum * 100)}% of its face lit up, and it's ${m.waxing ? 'waxing (growing fuller)' : 'waning (thinning down)'}.`
    },
  },
  {
    test: (q) => /(how far|distance).*(moon)|moon.*(how far|distance|away)/.test(q),
    answer: () => `The Moon is about 384,000 kilometres away (around 239,000 miles). That sounds huge, but you could line up about 30 Earths in the gap between us and the Moon. A rocket takes about three days to get there.`,
  },
  {
    test: (q) => /(how big|size).*(moon)|moon.*(how big|size)/.test(q),
    answer: () => `The Moon is about a quarter of the width of the Earth — roughly the same as the width of Australia. It only looks small because it's so far away.`,
  },
  // ---- Planets: specific visibility ----
  {
    test: (q) => findPlanet(q) && /(see|visible|out|up|tonight|look|find|where)/.test(q),
    answer: (q, ctx) => {
      const key = findPlanet(q)
      const s = planetStatus(key, ctx.sky)
      const scope = {
        Saturn: 'Through a telescope you could see its amazing rings!',
        Jupiter: 'Even binoculars would show its four biggest moons in a little line.',
        Mars: 'It looks like an orange-red star to your eyes.',
        Venus: "It's the brightest star-like dot in the whole sky.",
        Mercury: 'It only ever peeks out low down in the glow of sunrise or sunset.',
        Uranus: 'It is very faint — you really need a telescope and a dark sky.',
      }[key]
      if (s.up) return `Yes! From ${ctx.cityName} at ${ctx.hourLabel}, ${key} is up about ${s.alt}° above the horizon — look toward the ${s.dir}. ${scope}`
      if (s.reason === 'twilight') return `Not just yet. At ${ctx.hourLabel} the sky isn't dark enough from ${ctx.cityName}. Try a bit later tonight, once the stars come out, and check again.`
      if (s.reason === 'sun') return `Not right now — ${key} is sitting too close to the Sun in the sky, so it's lost in the glare. In a few weeks it will move away and become easy to spot again.`
      return `Not tonight from ${ctx.cityName} at ${ctx.hourLabel} — ${key} is below the horizon, on the other side of the Earth from you. Try a different time or date and it may pop up. ${scope}`
    },
  },
  {
    test: (q) => /(what|which).*(planet).*(see|tonight|visible|out|up)|planets? tonight/.test(q),
    answer: (q, ctx) => {
      const up = PLANET_NAMES.filter((k) => planetStatus(k, ctx.sky).up)
      if (!ctx.sky.dark) return `It isn't fully dark yet at ${ctx.hourLabel}, so the planets are hard to pick out. Try a later time and ask again!`
      if (up.length === 0) return `No bright planets are above the horizon from ${ctx.cityName} at ${ctx.hourLabel} right now — a good night for stars and the Moon instead. Try another date and the planets will shift into view.`
      const list = up.map((k) => `${k} (look ${ctx.sky.planets[k].dir})`).join(', ')
      return `Right now from ${ctx.cityName} you can hunt for: ${list}. Saturn and Jupiter are the best telescope targets if they're on the list!`
    },
  },
  {
    test: (q) => /why.*mars.*red|mars.*(red|orange)/.test(q),
    answer: () => `Mars looks red because its whole surface is covered in rusty dust — iron in the soil has reacted with tiny bits of oxygen over billions of years, just like a rusty nail. That's why it's nicknamed the Red Planet.`,
  },
  {
    test: (q) => /saturn.*ring|ring.*saturn/.test(q),
    answer: () => `Saturn's rings are made of billions of chunks of ice and rock, from pieces as small as a grain of sand to ones as big as a house, all orbiting the planet. They're over 280,000 km wide but in places only about 10 metres thick — incredibly thin for something so huge.`,
  },
  {
    test: (q) => /(biggest|largest).*planet|planet.*(biggest|largest)/.test(q),
    answer: () => `Jupiter is the biggest planet by far. It's so large that all the other seven planets could fit inside it, and it has a storm bigger than the whole Earth called the Great Red Spot.`,
  },
  {
    test: (q) => /(hottest).*planet|planet.*hottest/.test(q),
    answer: () => `Venus is the hottest planet, even hotter than Mercury which is closer to the Sun. Thick clouds trap the heat like a blanket, making it hot enough to melt lead — around 465°C.`,
  },
  // ---- Stars ----
  {
    test: (q) => /twinkle|why.*stars.*flicker|stars.*move/.test(q),
    answer: () => `Stars twinkle because their light has to pass through our wobbly, moving air before it reaches your eyes. The moving air bends the light a tiny bit this way and that, so the star seems to flicker. Fun clue: planets usually DON'T twinkle, so a steady bright "star" is often a planet!`,
  },
  {
    test: (q) => /brightest star/.test(q),
    answer: () => `The brightest star in the night sky is Sirius, the "Dog Star", in the constellation Canis Major. It's bright partly because it really is a hot, powerful star, and partly because it's one of our closest neighbours — only about 8.6 light-years away. (The Sun is far brighter, but it's a daytime star!)`,
  },
  {
    test: (q) => /(north star|pole star|polaris)|how.*find north/.test(q),
    answer: () => `The North Star is called Polaris. It sits almost exactly above the Earth's North Pole, so it barely moves all night while the other stars wheel around it — which made it a perfect guide for explorers. To find it, look at the Big Dipper and follow the two stars on the front of its bowl straight upward.`,
  },
  {
    test: (q) => /how many stars/.test(q),
    answer: () => `On a really dark night, your eyes can see roughly 2,000–3,000 stars at once. But our galaxy holds over 100 billion stars, and there are trillions of other galaxies — so the true number is more than anyone could ever count.`,
  },
  {
    test: (q) => /(sun).*(star)|is the sun a star/.test(q),
    answer: () => `Yes — the Sun is a star! It only looks different because it's so close to us. All the other stars are suns too, many of them far bigger and brighter, just unimaginably far away.`,
  },
  {
    test: (q) => /(how.*hot|temperature).*(sun)|sun.*hot/.test(q),
    answer: () => `The surface of the Sun is about 5,500°C, and its core is around 15 million°C. It makes all that heat and light by squeezing hydrogen atoms together deep inside — the same kind of power as a star factory.`,
  },
  {
    test: (q) => /(how far|distance).*(sun)|sun.*(how far|away)/.test(q),
    answer: () => `The Sun is about 150 million kilometres away. Its light is so fast that it still takes about 8 minutes to reach us — so the sunlight you feel actually left the Sun 8 minutes ago!`,
  },
  // ---- Deep sky & big ideas ----
  {
    test: (q) => /shooting star|falling star|meteor/.test(q),
    answer: () => `A shooting star isn't a star at all! It's a tiny piece of space dust or rock, often no bigger than a grain of sand, burning up as it zooms into our air and glows white-hot for a second. On certain nights (meteor showers) you can see dozens of them.`,
  },
  {
    test: (q) => /milky way/.test(q),
    answer: () => `The Milky Way is our home galaxy — a giant spinning city of over 100 billion stars, and our Sun is just one of them. On a dark night far from city lights, you can see it as a hazy glowing band across the sky: that's the light of countless stars too far away to see one by one.`,
  },
  {
    test: (q) => /what.*galaxy|galaxies/.test(q),
    answer: () => `A galaxy is an enormous family of stars, gas and dust held together by gravity — often hundreds of billions of stars swirling together. We live in one called the Milky Way, and there are trillions of other galaxies spread across the universe.`,
  },
  {
    test: (q) => /light year|light-year/.test(q),
    answer: () => `A light-year is a distance, not a time. It's how far light travels in one whole year — about 9.5 trillion kilometres. Because space is so vast, when you look at a star many light-years away, you're seeing light that left it years ago, so you're looking back in time!`,
  },
  {
    test: (q) => /black hole/.test(q),
    answer: () => `A black hole is a place where gravity is so incredibly strong that nothing can escape it — not even light, which is why it's black. Most form when a giant star runs out of fuel and collapses. There's a huge one hiding at the very centre of our Milky Way.`,
  },
  {
    test: (q) => /nebula|nebulae/.test(q),
    answer: () => `A nebula is a giant cloud of gas and dust floating in space. Some are nurseries where brand-new stars are being born, like the famous Orion Nebula. Others are the beautiful leftovers of stars that have died.`,
  },
  {
    test: (q) => /why.*(sky|space).*(dark|black)|why.*night.*dark/.test(q),
    answer: () => `The sky is dark at night because your side of the Earth is turned away from the Sun, so there's no sunlight lighting up our air and making it blue. Space itself looks black because it's mostly empty — there's nothing between the stars to catch the light.`,
  },
  {
    test: (q) => /space station|iss|satellite/.test(q),
    answer: () => `Yes! The International Space Station looks like a bright, steady "star" that glides smoothly across the sky in a few minutes — it doesn't blink or twinkle like a plane. It passes over most places every so often, usually best seen in the hour after sunset or before sunrise.`,
  },
  {
    test: (q) => /what.*constellation/.test(q),
    answer: () => `A constellation is a pattern that people long ago imagined by "joining the dots" between stars, like a cosmic connect-the-dots. The stars in a pattern usually aren't really near each other in space — they just happen to line up from where we stand. There are 88 official constellations covering the whole sky.`,
  },
  {
    test: (q) => /(eclipse)/.test(q),
    answer: () => `An eclipse happens when the Sun, Earth and Moon line up perfectly. In a solar eclipse the Moon slides in front of the Sun and turns day to twilight; in a lunar eclipse the Earth's shadow falls on the Moon and can turn it a spooky red. They're rare and always exciting to catch!`,
  },
  {
    test: (q) => /(alien|life).*(space|planet|mars|out there)|are we alone/.test(q),
    answer: () => `Nobody has found life beyond Earth yet — but scientists are searching hard! Mars, and some icy moons of Jupiter and Saturn with oceans under their ice, are the most exciting places to look. With billions of planets out there, it's one of the biggest questions in science.`,
  },
]

export function askTheSky(question, ctx) {
  const q = (question || '').toLowerCase().trim()
  if (!q) return "Ask me anything about tonight's sky — the Moon, the planets, the stars, or how to find a constellation!"

  // A specific constellation by name ("tell me about Orion").
  const c = findConstellation(q, ctx.constellations)
  if (c && /(tell|about|story|myth|find|where|see|what is|who)/.test(q)) {
    const alt = ctx.altOf(c.ra, c.dec, ctx.sky)
    const where = alt > 12 ? `Good news — it's high in your sky right now, so it's easy to find tonight.`
      : alt > 0 ? `It's low on your horizon right now, so look for a clear view in that direction.`
      : `It's below the horizon from ${ctx.cityName} at ${ctx.hourLabel} tonight, but its best season is ${c.season}.`
    return `${c.name} (${c.title}). ${c.story[0]} ${c.find} ${where}`
  }

  for (const rule of RULES) {
    if (rule.test(q)) return rule.answer(q, ctx)
  }

  // Friendly fallback that still points somewhere useful.
  return `Great question! I'm a little stargazing helper, so I know most about the Moon, the planets, the stars and the constellations. Try asking me things like "Why does the Moon change shape?", "Can I see Jupiter tonight?" or "What is a shooting star?"`
}
