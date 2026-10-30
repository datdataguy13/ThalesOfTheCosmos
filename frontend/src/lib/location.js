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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, ...options },
    )
  })
}

// Pick the recognisable town name from BigDataCloud's response. The top-level
// `city`/`locality` fields are inconsistent between countries (e.g. a US town
// lands in `locality` while its `city` is an administrative township, but it's
// the reverse in London). The reliable signal is the administrative hierarchy:
// the real town is the entry *described* as a city/town, lowest admin level.
function pickTown(d) {
  const admin = (d.localityInfo && d.localityInfo.administrative) || []
  const cityLike = admin.filter((a) => /\b(city|town|village|municipalit)/i.test(a.description || ''))
  cityLike.sort((a, b) => (a.adminLevel || 99) - (b.adminLevel || 99) || (a.order || 0) - (b.order || 0))
  if (cityLike.length) return cityLike[0].name
  return d.locality || d.city || d.principalSubdivision || ''
}

// Reverse geocode with the free, key-less BigDataCloud endpoint (CORS-enabled).
export async function placeNameFor(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    const r = await fetch(url)
    if (!r.ok) throw new Error('bad response')
    const d = await r.json()
    const town = pickTown(d)
    // Add a region for context: the state/province, else the country.
    const sub = d.principalSubdivision
    const region = sub && sub !== town ? sub : (d.countryName && d.countryName !== town ? d.countryName : '')
    const name = [town, region].filter(Boolean).join(', ')
    if (name) return name
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
