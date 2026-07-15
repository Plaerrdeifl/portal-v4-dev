export const CONFIG = Object.freeze({
  app: {
    name: "Plärrdeifl Portal",
    shortName: "Plärrdeifl",
    version: "v3.0.0 R7.1 M4",
    build: "2026.07.15-r7.1.m4-uiux-p1",
    repository: "https://github.com/Plaerrdeifl/portal"
  },
  urls: {
    frontend: "https://plaerrdeifl.github.io/portal/",
    backend: "https://script.google.com/macros/s/AKfycbz6B2hdN-tytcK4_4uGgSzRvzvXpeLxYzwhhOxmeJKh6pQZ44JJccM5zuCehFc1oo_Olw/exec"
  },
  api: {
    enabled: true,
    bridgeUrl: "https://script.google.com/macros/s/AKfycbz6B2hdN-tytcK4_4uGgSzRvzvXpeLxYzwhhOxmeJKh6pQZ44JJccM5zuCehFc1oo_Olw/exec?pwa=bridge",
    allowedBridgeOrigins: ["https://script.google.com", "https://script.googleusercontent.com"],
    readyTimeoutMs: 15000,
    requestTimeoutMs: 60000
  },
  auth: {
    storageKey: "pd_portal_pwa_session_r71_m4",
    dataKey: "pd_portal_pwa_initial_r71_m4"
  },
  pwa: {
    serviceWorker: "./service-worker.js?v=20260715-r71-m4-uiux-p1",
    installDismissKey: "pd_r71_m4_install_dismissed",
    updateReloadKey: "pd_r71_m4_update_reload",
    updateDismissKey: "pd_r71_m4_update_dismissed"
  },
  lists: { bookingLimit: 100, auditLimit: 200 }
});
