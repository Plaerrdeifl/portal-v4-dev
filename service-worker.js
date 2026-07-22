const CACHE_VERSION = "pd-portal-v4-global-ui-completion-r1-20260722";
const APP_CACHE = `${CACHE_VERSION}-shell`;
const SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./favicon.ico",
  "./manifest.webmanifest",
  "./css/tokens.css",
  "./css/app.css",
  "./js/config.js",
  "./js/supabase-client.js",
  "./js/api.js",
  "./js/auth.js",
  "./js/google-signin.js",
  "./js/install.js",
  "./js/router.js",
  "./js/ui.js",
  "./js/pages.js",
  "./js/app.js",
  "./js/modules/common.js",
  "./js/modules/profile.js",
  "./js/modules/dashboard.js",
  "./js/modules/fanclub.js",
  "./js/modules/tasks.js",
  "./js/modules/teams.js",
  "./js/modules/admin.js",
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

async function offlineDocument() {
  return (await caches.match("./offline.html", { ignoreSearch: true }))
    || new Response("<!doctype html><html lang=\"de\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Plärrdeifl Portal – Offline</title><body><main><h1>Gerade keine Verbindung</h1><p>Bitte stelle die Internetverbindung wieder her.</p></main></body></html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/js/runtime-config.js")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).then(response => response.ok ? response : offlineDocument()).catch(offlineDocument));
    return;
  }
  if (["script", "style", "document"].includes(request.destination) || /\.(?:js|css|html|webmanifest)$/i.test(url.pathname)) {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => caches.match(request, { ignoreSearch: true })));
    return;
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then(cached => cached || fetch(request)));
});
