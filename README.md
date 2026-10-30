# 🔭 Thales of the Cosmos

### ▶ Try it live: **https://datdataguy13.github.io/ThalesOfTheCosmos/**

A kid-friendly stargazing guide. Enter where you are and it tells you — from real
astronomy — what's in the sky tonight: the Moon's phase, which planets are up and
what a telescope would show, and the constellations with the ancient stories
behind them. There's also an offline "Ask the sky" helper for curious questions.

Named after Thales of Miletus, one of the first people to study the stars with
reason instead of myth, around 2,600 years ago.

## What it does

- 🌙 **Moon phase** — drawn accurately for any date, with illumination, age, and
  the next full/new moon. Flips automatically for the southern hemisphere.
- 🪐 **Planets tonight** — real positions from orbital elements tell you which of
  Mercury→Uranus are above the horizon, where to look, and what you'd see in a scope.
- ⭐ **16 constellations** — each with a drawn star pattern, a kid-level myth you can
  have **read aloud**, how to find it, and whether it's up right now.
- 💬 **Ask the sky** — an offline, kid-safe Q&A engine that uses tonight's real sky data.
- 📍 **Your location** — uses the browser's geolocation (or search any city).
- ☁️ **Live weather** — pulled from the free Open-Meteo API to judge the stargazing.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
cd frontend
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173). Allow location access
when the browser asks, or search for your city.

To make a production build:

```bash
npm run build      # outputs to frontend/dist
npm run preview    # preview the production build
```

## Notes

- **Location & weather need the internet**; everything else (moon, planets,
  constellations, Ask-the-sky) works fully offline.
- Geolocation and the Web Speech API (read-aloud) require a **secure context** —
  `localhost` during development, or an `https://` URL when you deploy.
- The star patterns are drawn to be recognisable, not to exact scale.

See [`backend/README.md`](backend/README.md) for when you'd add a server (e.g. to
power "Ask the sky" with real Claude AI).
