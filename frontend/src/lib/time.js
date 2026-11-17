// time.js — showing times on the clock of the place being viewed (which may
// not be the clock of the device, e.g. when you search for a faraway city).
//
// A "zone" is { name, hours }: `name` is an IANA time zone such as
// "America/Chicago" when the weather service told us one, and `hours` is the
// fallback UTC offset guessed from longitude.

// The UTC offset (hours) of a named time zone at a given instant, or null.
export function tzOffsetHours(timeZone, ms) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(new Date(ms))
    const get = (type) => +parts.find((p) => p.type === type).value
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
    return (asUtc - Math.floor(ms / 1000) * 1000) / 3600000
  } catch {
    return null
  }
}

function format(ms, zone, options) {
  if (zone && zone.name) {
    try {
      return new Intl.DateTimeFormat('en-US', { ...options, timeZone: zone.name }).format(new Date(ms))
    } catch {
      // unknown zone name — fall through to the fixed offset
    }
  }
  const hours = zone && typeof zone.hours === 'number' ? zone.hours : 0
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(new Date(ms + hours * 3600000))
}

// "7:42 PM"
export const fmtTime = (ms, zone) => format(ms, zone, { hour: 'numeric', minute: '2-digit' })
// "Tue, Nov 17"
export const fmtDay = (ms, zone) => format(ms, zone, { weekday: 'short', month: 'short', day: 'numeric' })
// "2026-11-17" on the place's calendar
export function isoDay(ms, zone) {
  const parts = format(ms, zone, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/')
  return `${parts[2]}-${parts[0]}-${parts[1]}`
}

// A calendar date (local y/m/d of a Date object) as "2026-11-17".
export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// ...and back to a Date at local midnight.
export function fromISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
