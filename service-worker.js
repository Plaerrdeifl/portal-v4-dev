const CACHE_VERSION = "pd-portal-v3-r71-m4-20260715-performance-startup-finish-1";
const APP_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const BUILD_QUERY = "v=20260715-r71-m4-performance-startup-finish-1";
const SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./favicon.ico",
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
  "./js/warmup.js",
  `./js/pages.js?${BUILD_QUERY}`,
  `./js/app.js?${BUILD_QUERY}`,
  "./js/modules/common.js",
  "./js/modules/state.js",
  "./js/modules/dashboard.js",
  "./js/modules/fanclub.js",
  "./js/modules/tasks.js",
  "./js/modules/teams.js",
  "./js/modules/admin.js",
  "./js/modules/profile.js",
  "./components/sidebar.html",
  "./components/topbar.html",
  "./pages/home.html",
  "./pages/news.html",
  "./pages/dates.html",
  "./pages/about.html",
  "./pages/contact.html",
  "./pages/install.html",
  "./pages/login.html",
  "./pages/profile.html",
  "./pages/dashboard.html",
  "./pages/fanclub.html",
  "./pages/tasks.html",
  "./pages/teams.html",
  "./pages/fanbuses.html",
  "./pages/admin.html",
  "./assets/icons/icon-32.png",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-192.png",
  "./assets/icons/icon-maskable-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(APP_CACHE).then(cache => cache.addAll(SHELL))
  );
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

async function cachedIndex() {
  return (await caches.match("./index.html", { ignoreSearch: true }))
    || (await caches.match("./", { ignoreSearch: true }))
    || (await caches.match("./offline.html", { ignoreSearch: true }));
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await caches.match(request, { ignoreSearch: true });
  const update = fetch(request)
    .then(response => {
      if (response?.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || update || Response.error();
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(response => response.ok ? response : cachedIndex())
        .catch(() => cachedIndex())
    );
    return;
  }

  if (["script", "style", "document", "image", "font"].includes(request.destination)
      || /\.(?:js|css|html|webmanifest|png|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
