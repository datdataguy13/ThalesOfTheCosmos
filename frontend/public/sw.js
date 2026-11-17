// Service worker — lets the app open with no internet (in the garden, at a
// campsite) once it has been visited online.
//
// What it keeps: the app itself (page, scripts, styles, icons) and its fonts.
// What it never keeps: live data — weather, place names and the Space Station's
// orbit always come fresh from the network, and the app copes without them.

const CACHE = 'cosmos-shell-v1'
const BASE = self.registration.scope // e.g. https://example.github.io/ThalesOfTheCosmos/
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']

const isOurs = (url) => url.origin === self.location.origin && url.href.startsWith(BASE)
const isFont = (url) => FONT_HOSTS.includes(url.host)

// The files the page asks for directly (scripts, styles, icons, font sheet).
function filesNamedIn(html) {
  const out = new Set()
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    try {
      const url = new URL(m[1], BASE)
      if (isOurs(url) || isFont(url)) out.add(url.href)
    } catch {
      // not a URL we can use
    }
  }
  return [...out]
}

async function storePage(response) {
  const cache = await caches.open(CACHE)
  const html = await response.clone().text()
  await cache.put(BASE, response.clone())
  // After an update the old scripts and styles are no longer needed.
  const keep = new Set(filesNamedIn(html))
  for (const request of await cache.keys()) {
    if (request.url.startsWith(BASE + 'assets/') && !keep.has(request.url)) await cache.delete(request)
  }
  return html
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const response = await fetch(BASE, { cache: 'no-cache' })
    if (response.ok) {
      const html = await storePage(response)
      const cache = await caches.open(CACHE)
      await Promise.all(filesNamedIn(html).map((url) => cache.add(url).catch(() => {})))
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE) await caches.delete(name)
    await self.clients.claim()
  })())
})

// The page tells us which files it has already loaded (lazy-loaded scripts and
// the font files themselves), so the very first visit is enough to go offline.
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'keep' || !Array.isArray(data.urls)) return
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    for (const raw of data.urls) {
      try {
        const url = new URL(raw)
        if (!(isOurs(url) || isFont(url)) || url.href === BASE) continue
        if (!(await cache.match(url.href))) await cache.add(url.href)
      } catch {
        // skip anything that can't be fetched
      }
    }
  })())
})

// The page itself: newest version when online, the saved copy when not.
async function pageFirstFromNetwork(request) {
  try {
    const response = await fetch(request)
    if (response.ok) await storePage(response)
    return response
  } catch {
    const saved = await caches.match(BASE)
    if (saved) return saved
    throw new Error('offline and nothing saved yet')
  }
}

// App files and fonts: the saved copy if we have one, else fetch and save.
async function savedFirst(request, refresh) {
  const cache = await caches.open(CACHE)
  const saved = await cache.match(request)
  const fetching = (!saved || refresh)
    ? fetch(request).then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    : null
  if (saved) {
    if (fetching) fetching.catch(() => {}) // quietly refresh in the background
    return saved
  }
  return fetching
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (!isOurs(url) && !isFont(url)) return // live data goes straight to the network
  if (request.mode === 'navigate') {
    event.respondWith(pageFirstFromNetwork(request))
    return
  }
  // Files under assets/ have a fingerprint in their name and never change;
  // everything else (icons, manifest) is refreshed in the background.
  const fingerprinted = url.href.startsWith(BASE + 'assets/')
  event.respondWith(savedFirst(request, !fingerprinted))
})
