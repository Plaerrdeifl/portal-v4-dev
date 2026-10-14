const FANBUS_CACHE_PREFIX = 'pd-fanbus-'
const FANBUS_CACHE = `${FANBUS_CACHE_PREFIX}shell-v1`
const FANBUS_PATH = '/fanbus/'
const FANBUS_ASSET_PATH = `${FANBUS_PATH}assets/`
const FANBUS_RUNTIME_CONFIG = `${FANBUS_PATH}runtime-config.js`

const FANBUS_STATIC_FILES = [
  `${FANBUS_PATH}manifest.webmanifest`,
  `${FANBUS_PATH}icons/fanbus-192.png`,
  `${FANBUS_PATH}icons/fanbus-512.png`,
  `${FANBUS_PATH}icons/fanbus-maskable-192.png`,
  `${FANBUS_PATH}icons/fanbus-maskable-512.png`
]

const FANBUS_STATIC_PATHS = new Set(FANBUS_STATIC_FILES)
const FANBUS_ASSET_EXTENSION = /\.(?:css|js|mjs|png|jpe?g|webp|svg|ico|woff2?)$/i

function isFanbusStaticRequest(request, url) {
  if (request.method !== 'GET') return false
  if (url.origin !== self.location.origin) return false
  if (!url.pathname.startsWith(FANBUS_PATH)) return false
  if (url.pathname === FANBUS_RUNTIME_CONFIG) return false

  if (FANBUS_STATIC_PATHS.has(url.pathname)) return true

  return url.pathname.startsWith(FANBUS_ASSET_PATH)
    && FANBUS_ASSET_EXTENSION.test(url.pathname)
    && ['script', 'style', 'font', 'image'].includes(request.destination)
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(FANBUS_CACHE).then((cache) => cache.addAll(FANBUS_STATIC_FILES))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(FANBUS_CACHE_PREFIX) && key !== FANBUS_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (!isFanbusStaticRequest(request, url)) return

  event.respondWith((async () => {
    const cache = await caches.open(FANBUS_CACHE)
    const cached = await cache.match(request)
    if (cached) return cached

    const response = await fetch(request)
    if (response.ok && response.type === 'basic') {
      await cache.put(request, response.clone())
    }
    return response
  })())
})
