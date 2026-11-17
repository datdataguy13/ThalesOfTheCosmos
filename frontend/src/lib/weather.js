// weather.js — live sky conditions from Open-Meteo (free, no API key needed).
// We translate the forecast into a simple stargazing condition the rest of the
// app already understands: 'clear' | 'some' | 'cloudy'. The same request also
// brings back the week's cloud forecast and the place's time zone.

const WMO = {
  0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Heavy showers',
  85: 'Snow showers', 86: 'Snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm',
}

function conditionFrom(cloudCover, code) {
  // Any precipitation / fog / storm → cloudy for stargazing purposes.
  if (code >= 45) return 'cloudy'
  if (cloudCover >= 70) return 'cloudy'
  if (cloudCover >= 30) return 'some'
  return 'clear'
}

// Evening cloud cover for each forecast night: the average over 8pm–midnight,
// which is when a family is most likely to be outside looking up.
function nightsFrom(hourly) {
  if (!hourly || !Array.isArray(hourly.time) || !Array.isArray(hourly.cloud_cover)) return []
  const byDate = new Map()
  hourly.time.forEach((stamp, i) => {
    const cover = hourly.cloud_cover[i]
    const hour = +stamp.slice(11, 13)
    if (typeof cover !== 'number' || hour < 20) return
    const date = stamp.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date).push(cover)
  })
  return [...byDate].map(([date, covers]) => ({
    date,
    cloud: Math.round(covers.reduce((a, b) => a + b, 0) / covers.length),
  }))
}

export async function getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,cloud_cover,weather_code,is_day`
    + `&hourly=cloud_cover&forecast_days=7&timezone=auto`
  const r = await fetch(url)
  if (!r.ok) throw new Error('Weather service is unavailable right now.')
  const d = await r.json()
  const c = d.current || {}
  const cloudCover = typeof c.cloud_cover === 'number' ? c.cloud_cover : 50
  const code = typeof c.weather_code === 'number' ? c.weather_code : 2
  return {
    cloudCover,
    tempC: c.temperature_2m,
    code,
    description: WMO[code] || 'Mixed skies',
    isDay: c.is_day === 1,
    condition: conditionFrom(cloudCover, code),
    timezone: typeof d.timezone === 'string' ? d.timezone : null,
    nights: nightsFrom(d.hourly),
  }
}
