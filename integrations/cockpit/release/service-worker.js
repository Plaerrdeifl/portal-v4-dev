const COCKPIT_CACHE_PREFIX = 'pd-cockpit-'
const COCKPIT_CACHE = `${COCKPIT_CACHE_PREFIX}shell-v2`
const COCKPIT_PATH = '/cockpit/'
const COCKPIT_ASSET_PATH = `${COCKPIT_PATH}assets/`
const COCKPIT_RUNTIME_CONFIG = `${COCKPIT_PATH}runtime-config.js`
const COCKPIT_OFFLINE_DOCUMENT = `${COCKPIT_PATH}offline.html`

const COCKPIT_EMERGENCY_OFFLINE_DOCUMENT = `<!doctype html>
<html lang="de" data-cockpit-emergency-offline="v1">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <title>Cockpit offline</title>
  </head>
  <body>
    <main>
      <h1>Du bist offline</h1>
      <p>Das Cockpit bleibt gesperrt. Stelle die Verbindung wieder her und lade die Seite neu.</p>
    </main>
  </body>
</html>`

const COCKPIT_STATIC_FILES = [
  COCKPIT_OFFLINE_DOCUMENT,
  `${COCKPIT_PATH}manifest.webmanifest`,
  `${COCKPIT_PATH}icons/cockpit-192.png`,
  `${COCKPIT_PATH}icons/cockpit-512.png`,
  `${COCKPIT_PATH}icons/cockpit-maskable-192.png`,
  `${COCKPIT_PATH}icons/cockpit-maskable-512.png`
]

const COCKPIT_STATIC_PATHS = new Set(COCKPIT_STATIC_FILES)
const COCKPIT_ASSET_EXTENSION = /\.(?:css|js|mjs|png|jpe?g|webp|svg|ico|woff2?)$/i

function isCockpitStaticRequest(request, url) {
  if (request.method !== 'GET') return false
  if (url.origin !== self.location.origin) return false
  if (!url.pathname.startsWith(COCKPIT_PATH)) return false
  if (url.pathname === COCKPIT_RUNTIME_CONFIG) return false

  if (COCKPIT_STATIC_PATHS.has(url.pathname)) return true

  return url.pathname.startsWith(COCKPIT_ASSET_PATH)
    && COCKPIT_ASSET_EXTENSION.test(url.pathname)
    && ['script', 'style', 'font', 'image'].includes(request.destination)
}

function isCockpitNavigation(request, url) {
  return request.method === 'GET'
    && request.mode === 'navigate'
    && url.origin === self.location.origin
    && url.pathname.startsWith(COCKPIT_PATH)
}

function emergencyOfflineResponse() {
  return new Response(COCKPIT_EMERGENCY_OFFLINE_DOCUMENT, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'X-Cockpit-Offline': 'emergency'
    }
  })
}

async function offlineNavigationResponse() {
  const cache = await caches.open(COCKPIT_CACHE)
  const response = await cache.match(COCKPIT_OFFLINE_DOCUMENT)

  if (!response || !response.ok || response.redirected) {
    return emergencyOfflineResponse()
  }

  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(COCKPIT_CACHE).then((cache) => cache.addAll(COCKPIT_STATIC_FILES))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(COCKPIT_CACHE_PREFIX) && key !== COCKPIT_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (isCockpitNavigation(request, url)) {
    event.respondWith(
      fetch(request).catch(() => offlineNavigationResponse())
    )
    return
  }

  if (!isCockpitStaticRequest(request, url)) return

  event.respondWith((async () => {
    const cache = await caches.open(COCKPIT_CACHE)
    const cached = await cache.match(request)
    if (cached) return cached

    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      await cache.put(request, response.clone())
    }
    return response
  })())
})
