const CACHE_VERSION="pd-portal-v3-r71-m4-20260715-performance-finish-2";
const APP_CACHE=`${CACHE_VERSION}-shell`;
const SHELL=[
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
  "./js/pages.js?v=20260715-r71-m4-performance-finish-2",
  "./js/app.js?v=20260715-r71-m4-performance-finish-2",
  "./components/sidebar.html",
  "./components/topbar.html",
  "./assets/icons/icon-32.png",
  "./assets/icons/icon-180.png",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-192.png",
  "./assets/icons/icon-maskable-512.png"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(APP_CACHE).then(cache=>cache.addAll(SHELL)));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key.startsWith("pd-portal-")&&key!==APP_CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING")self.skipWaiting();
});

async function offlineDocument(){
  return (await caches.match("./offline.html",{ignoreSearch:true}))
    || new Response(
      "<!doctype html><html lang=\"de\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Plärrdeifl Portal – Offline</title><body><main><h1>Gerade keine Verbindung</h1><p>Die Portaloberfläche ist installiert. Bitte stelle die Internetverbindung wieder her.</p></main></body></html>",
      {headers:{"Content-Type":"text/html; charset=utf-8"}}
    );
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(/\/exec(?:\?|$)/.test(url.pathname)||url.searchParams.has("pwa"))return;

  if(request.mode==="navigate"){
    event.respondWith(
      fetch(request,{cache:"no-store"})
        .then(response=>response.ok?response:offlineDocument())
        .catch(()=>offlineDocument())
    );
    return;
  }

  if(["script","style","document"].includes(request.destination)||/\.(?:js|css|html|webmanifest)$/i.test(url.pathname)){
    event.respondWith(fetch(request,{cache:"no-store"}).catch(()=>caches.match(request,{ignoreSearch:true})));
    return;
  }

  event.respondWith(caches.match(request,{ignoreSearch:true}).then(cached=>cached||fetch(request)));
});
