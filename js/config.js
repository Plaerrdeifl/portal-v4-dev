export const CONFIG = Object.freeze({
  app: {
    name: "Plärrdeifl Portal",
    shortName: "Plärrdeifl",
    version: "phase2-1.0.0",
    build: "2026.07.12-github-pages-phase2",
    repository: "https://github.com/Plaerrdeifl/portal"
  },
  urls: {
    frontend: "https://plaerrdeifl.github.io/portal/",
    legacyPortal: "https://script.google.com/macros/s/AKfycbz6B2hdN-tytcK4_4uGgSzRvzvXpeLxYzwhhOxmeJKh6pQZ44JJccM5zuCehFc1oo_Olw/exec"
  },
  api: {
    enabled: true,
    bridgeUrl: "https://script.google.com/macros/s/AKfycbz6B2hdN-tytcK4_4uGgSzRvzvXpeLxYzwhhOxmeJKh6pQZ44JJccM5zuCehFc1oo_Olw/exec?pwa=bridge",
    allowedBridgeOrigins: [
      "https://script.google.com",
      "https://script.googleusercontent.com"
    ],
    readyTimeoutMs: 20000,
    requestTimeoutMs: 30000
  },
  auth: {
    storageKey: "pd_portal_pwa_session_v3",
    dataKey: "pd_portal_pwa_initial_v3"
  },
  pwa: {
    serviceWorker: "./service-worker.js",
    installDismissKey: "pd_phase2_install_dismissed"
  }
});
