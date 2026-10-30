// weather.js — live sky conditions from Open-Meteo (free, no API key needed).
// We translate the forecast into a simple stargazing condition the rest of the
// app already understands: 'clear' | 'some' | 'cloudy'.

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

export async function getWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,cloud_cover,weather_code,is_day&timezone=auto`
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
  }
}
