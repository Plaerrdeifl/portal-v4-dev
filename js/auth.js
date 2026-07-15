import { CONFIG } from "./config.js";
import { api, isTransportError } from "./api.js";
import { storage } from "./storage.js";

const EMPTY_STATE = Object.freeze({
  authenticated: false,
  sessionToken: "",
  expires: 0,
  user: null,
  portal: null,
  navigation: null,
  initialData: null,
  backend: null,
  notice: null,
  profileRequired: false,
  profile: null,
  registration: null,
  connectionPending: false,
  lastValidatedAt: 0
});

const SESSION_EXPIRY_BUFFER_MS = 30000;
const AUTH_ERROR_CODES = new Set([
  "AUTH_REQUIRED",
  "AUTHENTICATION_REQUIRED",
  "SESSION_EXPIRED",
  "SESSION_REVOKED"
]);

let state = { ...EMPTY_STATE };
let initialized = false;
let initializePromise = null;
let loginPromise = null;
let reconnectPromise = null;

function emitChange() {
  window.dispatchEvent(new CustomEvent("pd-auth-change", { detail: auth.current() }));
}

function wait(ms) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function errorText(error) {
  return String(error?.message || error || "Unbekannter Fehler");
}

function isAuthenticationFailure(error) {
  const code = String(error?.code || "").toUpperCase();
  if (AUTH_ERROR_CODES.has(code)) return true;
  if (code && code !== "BACKEND_RESPONSE" && code !== "BACKEND_ERROR") return false;
  return /AUTHENTICATION_REQUIRED|AUTH_REQUIRED|Sitzung[^.]*abgelaufen|ungültige Sitzung|Bitte zuerst anmelden/i.test(errorText(error));
}

function persistedSession() {
  const value = storage.get(CONFIG.auth.storageKey, null);
  if (!value || typeof value !== "object" || !value.sessionToken || !value.expires) return null;
  if (Number(value.expires) <= Date.now() + SESSION_EXPIRY_BUFFER_MS) return null;
  return value;
}

function clearPersisted() {
  storage.remove(CONFIG.auth.storageKey);
  storage.remove(CONFIG.auth.dataKey);
}

function persistSession(session, initialData = null, profile = null) {
  const record = {
    sessionToken: String(session?.sessionToken || state.sessionToken || ""),
    expires: Number(session?.expires || state.expires || 0),
    user: initialData?.user || session?.user || state.user || null,
    portal: initialData?.portal || state.portal || null,
    navigation: initialData?.navigation || state.navigation || null,
    profileRequired: Boolean(profile?.required ?? session?.user?.profileRequired ?? state.profileRequired),
    profile: profile || state.profile || null
  };
  if (!record.sessionToken || !record.expires) throw new Error("Das Backend hat keine gültige Sitzung geliefert.");
  storage.set(CONFIG.auth.storageKey, record);
  if (initialData) storage.set(CONFIG.auth.dataKey, initialData);
  return record;
}

function setSession(session, initialData = null, profile = null, notice = null) {
  const saved = persistSession(session, initialData, profile);
  state = {
    ...state,
    authenticated: true,
    sessionToken: saved.sessionToken,
    expires: saved.expires,
    user: initialData?.user || session?.user || saved.user,
    portal: initialData?.portal || saved.portal,
    navigation: initialData?.navigation || saved.navigation,
    initialData: initialData || storage.get(CONFIG.auth.dataKey, null),
    profileRequired: Boolean(profile?.required ?? saved.profileRequired),
    profile: profile || saved.profile,
    registration: null,
    notice,
    connectionPending: false,
    lastValidatedAt: Date.now()
  };
}

function restoreSavedSession(saved) {
  if (!saved) return;
  const initialData = storage.get(CONFIG.auth.dataKey, null);
  state = {
    ...EMPTY_STATE,
    authenticated: true,
    sessionToken: String(saved.sessionToken || ""),
    expires: Number(saved.expires || 0),
    user: saved.user || initialData?.user || null,
    portal: saved.portal || initialData?.portal || null,
    navigation: saved.navigation || initialData?.navigation || null,
    initialData,
    profileRequired: Boolean(saved.profileRequired),
    profile: saved.profile || null,
    connectionPending: true,
    notice: { type: "warning", message: "Deine Sitzung wird wieder mit dem Backend verbunden." }
  };
}

function registrationFromLocation() {
  const hash = String(location.hash || "");
  if (!hash.startsWith("#/login?") || !hash.includes("registrationToken=")) return null;
  const params = new URLSearchParams(hash.slice(hash.indexOf("?") + 1));
  const token = String(params.get("registrationToken") || "");
  if (!token) return null;
  const registration = {
    token,
    expires: Number(params.get("registrationExpires") || 0),
    profile: {
      vorname: String(params.get("vorname") || ""),
      nachname: String(params.get("nachname") || ""),
      email: String(params.get("email") || "")
    }
  };
  history.replaceState(null, "", "#/login");
  return registration;
}

async function bootstrapWithRetry(sessionToken, attempts = 2) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await api.bootstrap(sessionToken || "");
    } catch (error) {
      lastError = error;
      if (!isTransportError(error) || attempt >= attempts) throw error;
      await wait(350 * attempt);
      try {
        await api.reconnect();
      } catch (reconnectError) {
        lastError = reconnectError;
        if (attempt >= attempts - 1) throw reconnectError;
      }
    }
  }
  throw lastError || new Error("Backend-Verbindung fehlgeschlagen.");
}

async function applyBootstrapBundle(bundle, saved, callbackRegistration) {
  state.backend = bundle?.config || state.backend || null;

  if (!saved || !bundle?.authenticated || !bundle?.session) {
    clearPersisted();
    state = {
      ...EMPTY_STATE,
      backend: state.backend,
      registration: callbackRegistration,
      notice: callbackRegistration
        ? { type: "warning", message: "Vorname und Nachname müssen ergänzt und bestätigt werden." }
        : (saved ? { type: "warning", message: bundle?.authError || "Deine Sitzung ist abgelaufen. Bitte erneut anmelden." } : null),
      lastValidatedAt: Date.now()
    };
    return;
  }

  setSession(
    bundle.session,
    bundle.initialData || null,
    bundle.profile || null,
    bundle.initialError ? { type: "warning", message: bundle.initialError } : null
  );
  state.profileRequired = Boolean(bundle.profileRequired || state.profileRequired);
}

async function initializeInternal() {
  state = { ...EMPTY_STATE };
  const callbackRegistration = registrationFromLocation();
  const saved = persistedSession();
  if (saved) restoreSavedSession(saved);

  if (!navigator.onLine) {
    state = {
      ...state,
      registration: callbackRegistration || state.registration,
      connectionPending: Boolean(saved),
      notice: saved
        ? { type: "warning", message: "Offline. Deine Anmeldung bleibt gespeichert und wird nach der Wiederverbindung geprüft." }
        : { type: "warning", message: "Offline. Für die Anmeldung wird eine Internetverbindung benötigt." }
    };
    initialized = true;
    emitChange();
    return auth.current();
  }

  try {
    const bundle = await bootstrapWithRetry(saved?.sessionToken || "", saved ? 3 : 2);
    await applyBootstrapBundle(bundle, saved, callbackRegistration);
  } catch (error) {
    if (!saved || !isTransportError(error)) throw error;
    state = {
      ...state,
      registration: callbackRegistration || state.registration,
      connectionPending: true,
      notice: { type: "warning", message: "Backend vorübergehend nicht erreichbar. Deine Anmeldung bleibt erhalten und wird automatisch erneut geprüft." }
    };
  }

  initialized = true;
  emitChange();
  return auth.current();
}

export const auth = {
  async initialize() {
    if (initialized) return this.current();
    if (initializePromise) return initializePromise;
    initializePromise = initializeInternal().finally(() => { initializePromise = null; });
    return initializePromise;
  },

  current() {
    return {
      authenticated: Boolean(state.authenticated),
      sessionToken: state.sessionToken || "",
      expires: Number(state.expires || 0),
      user: state.user || null,
      portal: state.portal || null,
      navigation: state.navigation || null,
      initialData: state.initialData || null,
      backend: state.backend || null,
      notice: state.notice || null,
      profileRequired: Boolean(state.profileRequired),
      profile: state.profile || null,
      registration: state.registration || null,
      loginInProgress: Boolean(loginPromise),
      connectionPending: Boolean(state.connectionPending),
      lastValidatedAt: Number(state.lastValidatedAt || 0)
    };
  },

  isAuthenticated() {
    return Boolean(state.authenticated && state.sessionToken && Number(state.expires) > Date.now() + SESSION_EXPIRY_BUFFER_MS);
  },

  hasPersistedSession() {
    return Boolean(persistedSession());
  },

  requiresProfile() {
    return this.isAuthenticated() && Boolean(state.profileRequired);
  },

  isAdmin() {
    return Boolean(state.user?.isAdmin);
  },

  canReadArea(area) {
    return this.isAuthenticated() && !this.requiresProfile() && (this.isAdmin() || Boolean(state.user?.permissions?.[area]?.read));
  },

  canWriteArea(area) {
    return this.isAuthenticated() && !this.requiresProfile() && (this.isAdmin() || Boolean(state.user?.permissions?.[area]?.write));
  },

  canAdminArea(area) {
    return this.isAuthenticated() && !this.requiresProfile() && (this.isAdmin() || Boolean(state.user?.permissions?.[area]?.admin));
  },

  portalFlag(name) {
    return Boolean(state.portal?.[name]);
  },

  appNavigation() {
    return [];
  },

  routeConfig() {
    return null;
  },

  canAccessRoute(key) {
    if (!this.isAuthenticated()) return false;
    if (key === "profile") return this.requiresProfile();
    if (this.requiresProfile()) return false;
    const nav = state.navigation || state.initialData?.navigation || {};
    if (key === "dashboard") return nav.dashboard !== false;
    if (key === "fanclub") return Boolean(nav.fanclub);
    if (key === "tasks") return Boolean(nav.tasks);
    if (key === "teams") return Boolean(nav.teams);
    if (key === "fanbuses") return nav.fanbuses !== false;
    if (key === "admin") return Boolean(nav.admin || this.isAdmin());
    return false;
  },

  async reconnect() {
    if (reconnectPromise) return reconnectPromise;
    const saved = persistedSession();
    const token = String(state.sessionToken || saved?.sessionToken || "");
    if (!token) return this.current();

    state.connectionPending = true;
    reconnectPromise = (async () => {
      await api.reconnect();
      const bundle = await bootstrapWithRetry(token, 2);
      await applyBootstrapBundle(bundle, saved || { sessionToken: token, expires: state.expires }, null);
      initialized = true;
      emitChange();
      return this.current();
    })().catch(error => {
      if (isAuthenticationFailure(error)) {
        clearPersisted();
        state = { ...EMPTY_STATE, backend: state.backend, notice: { type: "warning", message: "Deine Sitzung ist abgelaufen. Bitte erneut anmelden." }, lastValidatedAt: Date.now() };
        emitChange();
      } else {
        state.connectionPending = true;
        state.notice = { type: "warning", message: "Verbindung unterbrochen. Das Portal versucht es automatisch erneut." };
        emitChange();
      }
      throw error;
    }).finally(() => {
      reconnectPromise = null;
    });

    return reconnectPromise;
  },

  async signInWithGoogleCredential(credential, nonce) {
    if (loginPromise) return loginPromise;
    loginPromise = (async () => {
      const result = await api.loginWithGoogleCredential(credential, nonce);
      if (result?.registrationRequired) {
        clearPersisted();
        state = {
          ...EMPTY_STATE,
          backend: state.backend,
          registration: {
            token: result.registrationToken,
            expires: result.registrationExpires,
            profile: result.profile || {}
          },
          notice: { type: "warning", message: "Vorname und Nachname müssen ergänzt und bestätigt werden." },
          lastValidatedAt: Date.now()
        };
        emitChange();
        return this.current();
      }
      if (result?.pending) {
        clearPersisted();
        state = {
          ...EMPTY_STATE,
          backend: state.backend,
          notice: { type: "warning", message: "Dein Freischaltungsantrag wurde gespeichert.", email: result.request?.email || "" },
          lastValidatedAt: Date.now()
        };
        emitChange();
        return this.current();
      }
      if (!result?.sessionToken) throw new Error("Das Backend hat keine gültige Sitzung geliefert.");
      setSession(result, result.initialData || null, result.profile || null, { type: "success", message: "Google-Anmeldung erfolgreich." });
      state.profileRequired = Boolean(result.profileRequired || state.profileRequired);
      emitChange();
      return this.current();
    })().finally(() => {
      loginPromise = null;
    });
    return loginPromise;
  },

  async submitAccessRequest(data) {
    const registration = state.registration;
    if (!registration?.token) throw new Error("Bitte Google-Anmeldung erneut starten.");
    const result = await api.submitAccessRequest(registration.token, data || {});
    state.registration = null;
    state.notice = { type: "success", message: "Dein Freischaltungsantrag wurde vollständig gespeichert.", email: result?.request?.email || "" };
    emitChange();
    return result;
  },

  async completeProfile(data) {
    if (!this.requiresProfile()) throw new Error("Keine Profilvervollständigung erforderlich.");
    await api.dispatch(state.sessionToken, "apiCompleteRequiredProfile", data || {});
    state.profileRequired = false;
    state.profile = null;
    const initialData = await api.dispatch(state.sessionToken, "apiGetInitialData");
    setSession(
      { sessionToken: state.sessionToken, expires: state.expires, user: initialData.user },
      initialData,
      { required: false, state: "VOLLSTAENDIG" },
      { type: "success", message: "Profil wurde vervollständigt." }
    );
    emitChange();
    return this.current();
  },

  async login() {
    if (location.hash !== "#/login") location.hash = "#/login";
    return this.current();
  },

  async logout() {
    const token = state.sessionToken;
    try {
      if (token) await api.logout(token);
    } finally {
      try { window.google?.accounts?.id?.disableAutoSelect(); } catch (error) {}
      clearPersisted();
      state = { ...EMPTY_STATE, backend: state.backend, notice: { type: "success", message: "Du wurdest abgemeldet." }, lastValidatedAt: Date.now() };
      emitChange();
    }
  },

  async call(functionName, ...args) {
    if (!this.isAuthenticated()) throw new Error("Bitte zuerst anmelden.");
    try {
      const result = await api.dispatch(state.sessionToken, functionName, ...args);
      if (state.connectionPending) {
        state.connectionPending = false;
        state.lastValidatedAt = Date.now();
        emitChange();
      }
      return result;
    } catch (error) {
      if (error?.code === "PROFILE_COMPLETION_REQUIRED") {
        state.profileRequired = true;
        emitChange();
      } else if (isAuthenticationFailure(error)) {
        clearPersisted();
        state = { ...EMPTY_STATE, backend: state.backend, notice: { type: "warning", message: "Deine Sitzung ist abgelaufen." }, lastValidatedAt: Date.now() };
        emitChange();
      } else if (isTransportError(error)) {
        state.connectionPending = true;
        state.notice = { type: "warning", message: "Verbindung unterbrochen. Deine Anmeldung bleibt erhalten." };
        emitChange();
      }
      throw error;
    }
  },

  async readBatch(calls) {
    return this.call("apiReadBatch", Array.isArray(calls) ? calls : []);
  },

  async refreshInitialData() {
    if (!this.isAuthenticated() || this.requiresProfile()) return null;
    const initialData = await api.dispatch(state.sessionToken, "apiGetInitialData");
    setSession({ sessionToken: state.sessionToken, expires: state.expires, user: initialData.user }, initialData, { required: false }, null);
    emitChange();
    return initialData;
  },

  clearNotice() {
    state.notice = null;
  },

  openLegacyPortal() {
    window.open(CONFIG.urls.backend, "_blank", "noopener,noreferrer");
  }
};
