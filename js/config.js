const runtime =
  window.PD_RUNTIME_CONFIG || {};

export const CONFIG = Object.freeze({
  app: {
    name: "Plärrdeifl Portal",
    shortName: "Plärrdeifl",
    version: "v4.0.0 Core",
    build: "2026.07.29-login-first-auth-gate-r1",
    repository:
      "https://github.com/Plaerrdeifl/portal"
  },

  supabase: {
    url: String(
      runtime.supabaseUrl || ""
    ).trim(),

    publishableKey: String(
      runtime.supabasePublishableKey
      || runtime.supabaseAnonKey
      || ""
    ).trim(),

    environment: String(
      runtime.environment || "UNCONFIGURED"
    ).trim().toUpperCase(),

    configured: Boolean(
      String(runtime.supabaseUrl || "").trim()
      && String(
        runtime.supabasePublishableKey
        || runtime.supabaseAnonKey
        || ""
      ).trim()
    )
  },

  auth: {
    googleClientId: String(
      runtime.googleClientId
      || "628849757836-n6go6fl2j26pqbf640sg10gpmmbanlvg.apps.googleusercontent.com"
    ).trim(),

    postLoginRouteKey:
      "pd_v4_post_login_route"
  },

  legal: {
    imprintUrl: String(
      runtime.legalImprintUrl || ""
    ).trim(),

    privacyUrl: String(
      runtime.legalPrivacyUrl || ""
    ).trim()
  },

  pwa: {
    serviceWorker:
      "./service-worker.js?v=20260731-login-first-true-single-paint-r1",

    installDismissKey:
      "pd_v4_install_dismissed",

    updateReloadKey:
      "pd_v4_update_reload",

    updateDismissKey:
      "pd_v4_update_dismissed"
  }
});
