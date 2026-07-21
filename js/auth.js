import { CONFIG } from "./config.js";
import { api } from "./api.js";
import {
  ConfigurationError,
  getSupabaseClient,
  isSupabaseConfigured
} from "./supabase-client.js";

const EMPTY = Object.freeze({
  initialized: false,
  session: null,
  bootstrap: null,
  busy: false,
  error: null
});

let state = { ...EMPTY };
let initializePromise = null;
let refreshPromise = null;
let authSubscription = null;

function emit() {
  window.dispatchEvent(
    new CustomEvent("pd-auth-change", { detail: auth.current() })
  );
}

function normalizedUser() {
  const user = state.bootstrap?.user;
  if (!user) return null;
  return {
    ...user,
    role: user.role?.name || user.role?.code || "Portaluser",
    roleData: user.role || null,
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim()
  };
}

function permissionSet() {
  return new Set(state.bootstrap?.permissions || []);
}

async function refreshBootstrap() {
  if (!state.session) {
    state.bootstrap = null;
    state.error = null;
    emit();
    return auth.current();
  }
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    state.busy = true;
    state.error = null;
    emit();
    try {
      state.bootstrap = await api.call("bootstrap");
      return auth.current();
    } catch (error) {
      state.error = error;
      throw error;
    } finally {
      state.busy = false;
      emit();
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function registerAuthListener(client) {
  if (authSubscription) return;
  const { data } = client.auth.onAuthStateChange((event, session) => {
    window.setTimeout(async () => {
      state.session = session || null;
      if (!session) {
        state.bootstrap = null;
        state.error = null;
        emit();
        return;
      }
      if (["SIGNED_IN", "INITIAL_SESSION", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
        try {
          await refreshBootstrap();
        } catch (error) {
          console.error("Portal-Bootstrap fehlgeschlagen", error);
        }
      }
    }, 0);
  });
  authSubscription = data.subscription;
}

const OAUTH_POPUP_NAME = "pdGoogleAuth";

function supportsOAuthPopup() {
  return window.matchMedia(
    "(min-width: 720px) and (pointer: fine)"
  ).matches;
}

function oauthPopupGeometry() {
  const availableWidth = Math.max(360, window.screen.availWidth - 40);
  const availableHeight = Math.max(520, window.screen.availHeight - 40);
  const width = Math.min(440, availableWidth);
  const height = Math.min(600, availableHeight);
  const browserLeft = Number.isFinite(window.screenLeft)
    ? window.screenLeft
    : window.screenX;
  const browserTop = Number.isFinite(window.screenTop)
    ? window.screenTop
    : window.screenY;
  const browserWidth = window.outerWidth || window.innerWidth || width;
  const browserHeight = window.outerHeight || window.innerHeight || height;
  const left = Math.max(
    0,
    Math.round(browserLeft + (browserWidth - width) / 2)
  );
  const top = Math.max(
    0,
    Math.round(browserTop + (browserHeight - height) / 2)
  );

  return { width, height, left, top };
}

function oauthPopupFeatures(geometry) {
  return [
    "popup=yes",
    `width=${geometry.width}`,
    `height=${geometry.height}`,
    `left=${geometry.left}`,
    `top=${geometry.top}`,
    "resizable=yes",
    "scrollbars=yes"
  ].join(",");
}

function positionOAuthPopup(popup, geometry) {
  if (!popup || !geometry) return;

  try {
    popup.resizeTo(geometry.width, geometry.height);
    popup.moveTo(geometry.left, geometry.top);
    popup.focus();
  } catch (error) {
    console.debug(
      "Das Google-Anmeldefenster konnte nicht nachpositioniert werden",
      error
    );
  }
}

export const auth = Object.freeze({
  async initialize() {
    if (state.initialized) return this.current();
    if (initializePromise) return initializePromise;

    initializePromise = (async () => {
      if (!isSupabaseConfigured()) {
        state = {
          ...state,
          initialized: true,
          error: new ConfigurationError(
            "Die Supabase-DEV-Verbindung ist noch nicht konfiguriert."
          )
        };
        emit();
        return this.current();
      }

      const client = getSupabaseClient();
      registerAuthListener(client);
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      state.session = data.session || null;
      state.initialized = true;
      if (state.session) await refreshBootstrap();
      emit();
      return this.current();
    })().catch(error => {
      state.initialized = true;
      state.error = error;
      emit();
      return this.current();
    }).finally(() => {
      initializePromise = null;
    });

    return initializePromise;
  },

  current() {
    return {
      initialized: Boolean(state.initialized),
      authenticated: Boolean(state.session),
      session: state.session,
      user: normalizedUser(),
      bootstrap: state.bootstrap,
      status: state.bootstrap?.state || (state.session ? "LOADING" : "SIGNED_OUT"),
      navigation: state.bootstrap?.navigation || {},
      permissions: state.bootstrap?.permissions || [],
      request: state.bootstrap?.request || null,
      suggestions: state.bootstrap?.suggestions || {},
      system: state.bootstrap?.system || {},
      busy: Boolean(state.busy),
      error: state.error
    };
  },

  isAuthenticated() {
    return Boolean(state.session);
  },

  hasPersistedSession() {
    return Boolean(state.session);
  },

  isActive() {
    return state.bootstrap?.state === "ACTIVE";
  },

  requiresProfile() {
    return Boolean(state.session) && !this.isActive();
  },

  isAdmin() {
    return permissionSet().has("portal.admin");
  },

  hasCapability(code) {
    return this.isActive() && (
      permissionSet().has("portal.admin")
      || permissionSet().has(code)
    );
  },

  canReadArea(area) {
    const mapping = {
      Mitglieder: "members.read",
      Rollen: "roles.manage",
      Teams: "teams.read",
      Aufgaben: "tasks.read"
    };
    return this.hasCapability(mapping[area] || String(area || ""));
  },

  canWriteArea(area) {
    const mapping = {
      Mitglieder: "members.manage",
      Rollen: "roles.manage",
      Teams: "teams.manage",
      Aufgaben: "tasks.manage"
    };
    return this.hasCapability(mapping[area] || String(area || ""));
  },

  canAdminArea(area) {
    return this.isAdmin() || this.canWriteArea(area);
  },

  canAccessRoute(key) {
    if (!this.isActive()) return key === "profile" && this.isAuthenticated();
    if (key === "profile") return false;
    if (key === "dashboard") return true;
    return Boolean(state.bootstrap?.navigation?.[key]);
  },

  async refresh() {
    return refreshBootstrap();
  },

  async signInWithGoogle() {
    const client = getSupabaseClient();
    const redirect = new URL(location.href);
    redirect.hash = "";
    redirect.search = "";

    const popupGeometry = supportsOAuthPopup()
      ? oauthPopupGeometry()
      : null;
    const popup = popupGeometry
      ? window.open(
          "about:blank",
          OAUTH_POPUP_NAME,
          oauthPopupFeatures(popupGeometry)
        )
      : null;

    positionOAuthPopup(popup, popupGeometry);

    try {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirect.toString(),
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account"
          }
        }
      });

      if (error) throw error;
      if (!data?.url) {
        throw new Error("Google-Anmeldung konnte nicht geöffnet werden.");
      }

      if (popup) {
        document.body.classList.add("oauth-popup-open");
        popup.location.replace(data.url);
        positionOAuthPopup(popup, popupGeometry);
        window.setTimeout(
          () => positionOAuthPopup(popup, popupGeometry),
          120
        );
        return { mode: "popup", popup };
      }

      location.assign(data.url);
      return { mode: "redirect", popup: null };
    } catch (error) {
      popup?.close();
      document.body.classList.remove("oauth-popup-open");
      throw error;
    }
  },

  async syncSession() {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();

    if (error) throw error;

    state.session = data.session || null;
    state.initialized = true;

    if (state.session) {
      await refreshBootstrap();
    } else {
      state.bootstrap = null;
      state.error = null;
      emit();
    }

    return this.current();
  },

  async submitAccessRequest(data) {
    state.bootstrap = await api.call("submit_access_request", data);
    emit();
    return this.current();
  },

  async claimInitialAdmin(data) {
    state.bootstrap = await api.call("claim_initial_admin", data);
    emit();
    return this.current();
  },

  async updateProfile(data) {
    state.bootstrap = await api.call("update_profile", data);
    emit();
    return this.current();
  },

  async logout() {
    if (!isSupabaseConfigured()) return;
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
    state.session = null;
    state.bootstrap = null;
    state.error = null;
    emit();
  },

  rememberPostLoginRoute(hash = location.hash) {
    try {
      sessionStorage.setItem(CONFIG.auth.postLoginRouteKey, String(hash || ""));
    } catch (error) {
      console.debug("Post-Login-Ziel konnte nicht gespeichert werden", error);
    }
  },

  consumePostLoginRoute() {
    try {
      const value = sessionStorage.getItem(CONFIG.auth.postLoginRouteKey) || "";
      sessionStorage.removeItem(CONFIG.auth.postLoginRouteKey);
      return value;
    } catch (error) {
      return "";
    }
  }
});
