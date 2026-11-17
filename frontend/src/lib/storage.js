// storage.js — tiny wrappers around localStorage that never throw.
// Private browsing or blocked site data can make localStorage unavailable, so
// everything saved here is a convenience the app must work without.

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // nothing to do — the app carries on without remembering
  }
}
