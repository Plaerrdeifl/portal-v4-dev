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
let renderFingerprint = "";
let renderRevision = 0;

const PD_PUSH_LOGOUT_RECOVERY_PREFIX = "pdPushLogoutRecovery:";

function stableRenderValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableRenderValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stableRenderValue(value[key])])
    );
  }

  return value ?? null;
}

function currentRenderFingerprint() {
  const bootstrap = state.bootstrap
    ? { ...state.bootstrap }
    : null;

  if (bootstrap) {
    delete bootstrap.serverTime;
    if (Array.isArray(bootstrap.permissions)) {
      bootstrap.permissions = [...bootstrap.permissions].sort();
    }
  }

  return JSON.stringify(stableRenderValue({
    authenticated: Boolean(state.session),
    sessionUser: state.session?.user
      ? {
          id: state.session.user.id || null,
          email: state.session.user.email || null
        }
      : null,
    bootstrap
  }));
}

function emit() {
  const nextRenderFingerprint = currentRenderFingerprint();
  if (nextRenderFingerprint !== renderFingerprint) {
    renderFingerprint = nextRenderFingerprint;
    renderRevision += 1;
  }

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
    if (event === "INITIAL_SESSION") {
      return;
    }

    window.setTimeout(async () => {
      state.session = session || null;
      if (!session) {
        state.bootstrap = null;
        state.error = null;
        emit();
        return;
      }
      if (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
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

async function deactivateCurrentPushSubscriptionForLogout() {
  if (
    typeof navigator === "undefined"
    || !("serviceWorker" in navigator)
    || !state.session
  ) {
    return;
  }

  let subscription = null;
  try {
    const registration = await navigator.serviceWorker.getRegistration?.();
    if (!registration?.pushManager) return;
    subscription = await registration.pushManager.getSubscription();
  } catch {
    return;
  }

  if (!subscription) return;

  const userId = state.session?.user?.id;
  if (userId) {
    try {
      localStorage.setItem(`${PD_PUSH_LOGOUT_RECOVERY_PREFIX}${userId}`, "1");
    } catch (error) {
      console.debug("Push-Recovery-Marker konnte nicht gespeichert werden", error);
    }
  }

  try {
    await api.call("remove_push_subscription", {
      endpoint: subscription.endpoint
    });
  } catch {
    // Logout bleibt möglich. Ein veralteter Server-Endpunkt wird beim nächsten
    // Zustellversuch durch M020 über 404/410 dauerhaft deaktiviert.
  }

  try {
    await subscription.unsubscribe();
  } catch {
    // Lokales Unsubscribe ist best effort und darf den Logout nicht blockieren.
  }

  try {
    if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
  } catch {
    // Badge ist rein ergänzend.
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
      renderRevision,
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
    if (["dashboard", "dates"].includes(key)) return true;
    return Boolean(state.bootstrap?.navigation?.[key]);
  },

  async refresh() {
    return refreshBootstrap();
  },

  async signInWithGoogleIdToken(token, nonce = "") {
    const credential = String(token || "").trim();
    const rawNonce = String(nonce || "").trim();

    if (!credential) {
      throw new Error("Google hat kein gültiges ID-Token zurückgegeben.");
    }

    const client = getSupabaseClient();
    state.busy = true;
    state.error = null;
    emit();

    try {
      const credentials = {
        provider: "google",
        token: credential
      };

      if (rawNonce) credentials.nonce = rawNonce;

      const { data, error } = await client.auth.signInWithIdToken(credentials);
      if (error) throw error;
      if (!data?.session) {
        throw new Error("Die Google-Anmeldung hat keine Portalsitzung erzeugt.");
      }

      state.session = data.session;
      state.initialized = true;
      await refreshBootstrap();
      return this.current();
    } catch (error) {
      state.error = error;
      throw error;
    } finally {
      state.busy = false;
      emit();
    }
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

    await deactivateCurrentPushSubscriptionForLogout();

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
    } catch {
      return "";
    }
  }
});

const __M020_R1_LOGOUT_PUSH_CLEANUP__ = true;
