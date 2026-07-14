export const CONFIG = Object.freeze({
  app: {
    name: "Plärrdeifl Portal",
    shortName: "Plärrdeifl",
    version: "v3.0.0 PWA FINAL",
    build: "2026.07.14-r7.1.performance-fast-hotfix-5",
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
    readyTimeoutMs: 15000,
    requestTimeoutMs: 60000
  },
  auth: {
    storageKey: "pd_portal_pwa_session_v3",
    dataKey: "pd_portal_pwa_initial_v3"
  },
  pwa: {
    serviceWorker: "./service-worker.js",
    installDismissKey: "pd_v3_final_install_dismissed",
    updateReloadKey: "pd_v3_final_update_reload",
    updateDismissKey: "pd_v3_final_update_dismissed"
  },
  lists: {
    bookingLimit: 100,
    auditLimit: 200
  }
});
