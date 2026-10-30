// location.js — real device geolocation + turning coordinates into place names.
// Everything here degrades gracefully: if the browser blocks location or the
// network is down, callers fall back to the manual city picker.

export function getCurrentLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser cannot share its location.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        const msg = err.code === 1 ? 'Location permission was declined.'
          : err.code === 2 ? 'Your location is unavailable right now.'
          : err.code === 3 ? 'Finding your location took too long.'
          : 'Could not get your location.'
        reject(new Error(msg))
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000, ...options },
    )
  })
}

// Reverse geocode with the free, key-less BigDataCloud endpoint (CORS-enabled).
export async function placeNameFor(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    const r = await fetch(url)
    if (!r.ok) throw new Error('bad response')
    const d = await r.json()
    const place = d.city || d.locality || d.principalSubdivision
    const country = d.countryName
    if (place && country) return `${place}, ${country}`
    if (place) return place
    if (country) return country
  } catch {
    // fall through to a coordinate label
  }
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${ns}, ${Math.abs(lon).toFixed(2)}°${ew}`
}

// Search places by name with Open-Meteo's free geocoding API.
export async function searchCity(query) {
  const q = query.trim()
  if (q.length < 2) return []
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`
    const r = await fetch(url)
    if (!r.ok) throw new Error('bad response')
    const d = await r.json()
    return (d.results || []).map((x) => ({
      name: [x.name, x.admin1, x.country].filter(Boolean).join(', '),
      lat: x.latitude,
      lon: x.longitude,
    }))
  } catch {
    return []
  }
}
