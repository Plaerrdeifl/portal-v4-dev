const CACHE_VERSION = "pd-portal-v3-final-rc1-20260712-1";
const APP_CACHE = `${CACHE_VERSION}-app`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "./", "./index.html", "./offline.html", "./manifest.webmanifest",
  "./css/tokens.css", "./css/layout.css", "./css/components.css", "./css/mobile.css",
  "./js/config.js", "./js/storage.js", "./js/api.js", "./js/auth.js", "./js/router.js", "./js/ui.js", "./js/pages.js", "./js/app.js",
  "./js/modules/common.js", "./js/modules/state.js", "./js/modules/dashboard.js", "./js/modules/fanclub.js", "./js/modules/teams.js", "./js/modules/fanbus.js", "./js/modules/admin.js",
  "./components/sidebar.html", "./components/topbar.html",
  "./pages/home.html", "./pages/login.html", "./pages/dashboard.html", "./pages/fanclub.html", "./pages/teams.html", "./pages/fanbus.html", "./pages/admin.html",
  "./assets/icons/icon-32.png", "./assets/icons/icon-180.png", "./assets/icons/icon-192.png", "./assets/icons/icon-512.png", "./assets/icons/icon-maskable-192.png", "./assets/icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("pd-portal-") && ![APP_CACHE, RUNTIME_CACHE].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirst(request, fallback) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response?.ok) (await caches.open(RUNTIME_CACHE)).put(request, response.clone());
    return response;
  } catch (error) {
    return (await caches.match(request)) || (fallback ? await caches.match(fallback) : Response.error());
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response?.ok) (await caches.open(RUNTIME_CACHE)).put(request, response.clone());
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./offline.html"));
    return;
  }

  const destination = request.destination;
  if (["script", "style", "document"].includes(destination) || /\.(?:html|js|css|json|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
