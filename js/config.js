const runtime = window.PD_RUNTIME_CONFIG || {};

export const CONFIG = Object.freeze({
  app: {
    name: "Plärrdeifl Portal",
    shortName: "Plärrdeifl",
    version: "v4.0.0 Core",
    build: "2026.07.19-supabase-core",
    repository: "https://github.com/Plaerrdeifl/portal"
  },
  supabase: {
    url: String(runtime.supabaseUrl || "").trim(),
    publishableKey: String(runtime.supabasePublishableKey || runtime.supabaseAnonKey || "").trim(),
    environment: String(runtime.environment || "UNCONFIGURED").trim(),
    configured: Boolean(
      String(runtime.supabaseUrl || "").trim()
      && String(runtime.supabasePublishableKey || runtime.supabaseAnonKey || "").trim()
    )
  },
  auth: {
    postLoginRouteKey: "pd_v4_post_login_route"
  },
  pwa: {
    serviceWorker: "./service-worker.js?v=20260721-login-experience-1",
    installDismissKey: "pd_v4_install_dismissed",
    updateReloadKey: "pd_v4_update_reload",
    updateDismissKey: "pd_v4_update_dismissed"
  }
});
