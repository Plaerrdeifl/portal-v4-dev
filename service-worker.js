const CACHE_VERSION = "pd-portal-v3-r71-m4-20260715-ui-race-hotfix-1";
const APP_CACHE = `${CACHE_VERSION}-shell`;
const BUILD_QUERY = "v=20260715-r71-m4-ui-race-hotfix-1";
const SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./css/tokens.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/mobile.css",
  "./js/config.js",
  "./js/storage.js",
  "./js/api.js",
  "./js/google-identity.js",
  "./js/auth.js",
  "./js/install.js",
  "./js/router.js",
  "./js/ui.js",
  `./js/pages.js?${BUILD_QUERY}`,
  `./js/app.js?${BUILD_QUERY}`,
  "./components/sidebar.html",
  "./components/topbar.html",
  "./assets/icons/icon-32.png",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-192.png",
  "./assets/icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(SHELL)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("pd-portal-") && key !== APP_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\/exec(?:\?|$)/.test(url.pathname) || url.searchParams.has("pwa")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => caches.match("./offline.html")));
    return;
  }

  if (["script", "style", "document"].includes(request.destination) || /\.(?:js|css|html|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => caches.match(request, { ignoreSearch: true }))
    );
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
