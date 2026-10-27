const COCKPIT_CACHE_PREFIX = 'pd-cockpit-'
const COCKPIT_CACHE = `${COCKPIT_CACHE_PREFIX}shell-v1`
const COCKPIT_PATH = '/cockpit/'
const COCKPIT_ASSET_PATH = `${COCKPIT_PATH}assets/`
const COCKPIT_RUNTIME_CONFIG = `${COCKPIT_PATH}runtime-config.js`
const COCKPIT_OFFLINE_DOCUMENT = `${COCKPIT_PATH}index.html`

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
      fetch(request).catch(async () => {
        const cache = await caches.open(COCKPIT_CACHE)
        return cache.match(COCKPIT_OFFLINE_DOCUMENT)
      })
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
