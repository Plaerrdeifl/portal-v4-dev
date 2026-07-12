export const CONFIG = Object.freeze({
  app: {
    name: "Plärrdeifl Portal",
    shortName: "Plärrdeifl",
    version: "phase1-1.0.0",
    build: "2026.07.12-github-pages-phase1",
    repository: "https://github.com/Plaerrdeifl/portal"
  },
  urls: {
    legacyPortal: "https://script.google.com/macros/s/AKfycbz6B2hdN-tytcK4_4uGgSzRvzvXpeLxYzwhhOxmeJKh6pQZ44JJccM5zuCehFc1oo_Olw/exec"
  },
  api: {
    enabled: false,
    baseUrl: "",
    timeoutMs: 15000
  },
  pwa: {
    serviceWorker: "./service-worker.js",
    installDismissKey: "pd_phase1_install_dismissed"
  }
});
