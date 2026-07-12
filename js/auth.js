import { CONFIG } from "./config.js";
import { api } from "./api.js";
import { storage } from "./storage.js";

const EMPTY_STATE = Object.freeze({
  authenticated: false,
  sessionToken: "",
  expires: 0,
  user: null,
  portal: null,
  initialData: null,
  backend: null,
  notice: null
});

const INITIAL_DATA_ATTEMPTS = 3;
const SESSION_EXPIRY_BUFFER_MS = 30 * 1000;

let state = { ...EMPTY_STATE };
let initialized = false;
let initializePromise = null;
let loginPromise = null;

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
  return /AUTH_REQUIRED|Sitzung[^.]*abgelaufen|ungültige Sitzung|Sitzungstoken|Bitte zuerst anmelden/i.test(errorText(error));
}

function persistedSession() {
  const value = storage.get(CONFIG.auth.storageKey, null);
  if (!value || typeof value !== "object") return null;
  if (!value.sessionToken || !value.expires) return null;
  if (Number(value.expires) <= Date.now() + SESSION_EXPIRY_BUFFER_MS) return null;
  return value;
}

function saveSession(session, initialData = null) {
  const previous = storage.get(CONFIG.auth.storageKey, null) || {};
  const record = {
    sessionToken: String(session?.sessionToken || previous.sessionToken || ""),
    expires: Number(session?.expires || previous.expires || 0),
    user: initialData?.user || session?.user || previous.user || null,
    portal: initialData?.portal || session?.portal || previous.portal || null
  };
  if (!record.sessionToken || !record.expires) throw new Error("Das Backend hat keine gültige Sitzung geliefert.");
  storage.set(CONFIG.auth.storageKey, record);
  if (initialData) storage.set(CONFIG.auth.dataKey, initialData);
  return record;
}

function clearPersisted() {
  storage.remove(CONFIG.auth.storageKey);
  storage.remove(CONFIG.auth.dataKey);
}

async function loadInitialData(sessionToken) {
  return api.dispatch(sessionToken, "apiGetInitialData");
}

async function loadInitialDataWithRetry(sessionToken, attempts = INITIAL_DATA_ATTEMPTS) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await loadInitialData(sessionToken);
    } catch (error) {
      lastError = error;
      if (isAuthenticationFailure(error) || attempt >= attempts) break;
      await wait(400 * attempt);
    }
  }
  throw lastError || new Error("Startdaten konnten nicht geladen werden.");
}

function setAuthenticatedSessionOnly(session, notice = null) {
  const saved = saveSession(session, null);
  state = {
    authenticated: true,
    sessionToken: saved.sessionToken,
    expires: saved.expires,
    user: session?.user || saved.user || null,
    portal: session?.portal || saved.portal || null,
    initialData: storage.get(CONFIG.auth.dataKey, null),
    backend: state.backend,
    notice
  };
}

function setAuthenticated(session, initialData, notice = null) {
  const saved = saveSession(session, initialData);
  state = {
    authenticated: true,
    sessionToken: saved.sessionToken,
    expires: saved.expires,
    user: initialData?.user || saved.user,
    portal: initialData?.portal || saved.portal,
    initialData: initialData || null,
    backend: state.backend,
    notice
  };
}

async function initializeInternal() {
  state = { ...EMPTY_STATE };
  await api.initialize();
  state.backend = await api.getConfig();

  const saved = persistedSession();
  if (!saved) {
    clearPersisted();
    initialized = true;
    emitChange();
    return auth.current();
  }

  let resumed;
  try {
    resumed = await api.resumeSession(saved.sessionToken);
  } catch (error) {
    if (isAuthenticationFailure(error)) {
      clearPersisted();
      state = {
        ...EMPTY_STATE,
        backend: state.backend,
        notice: { type: "warning", message: "Deine Sitzung ist abgelaufen. Bitte erneut anmelden." }
      };
    } else {
      setAuthenticatedSessionOnly(saved, {
        type: "warning",
        message: "Die bestehende Sitzung wurde lokal wiederhergestellt. Das Backend ist momentan nicht vollständig erreichbar."
      });
    }
    initialized = true;
    emitChange();
    return auth.current();
  }

  // Eine vom Backend bestätigte Sitzung wird sofort gespeichert. Das Laden der
  // Startdaten ist ein separater Schritt und darf einen gültigen Login nicht löschen.
  setAuthenticatedSessionOnly(resumed, null);
  try {
    const initialData = await loadInitialDataWithRetry(resumed.sessionToken);
    setAuthenticated(resumed, initialData, null);
  } catch (error) {
    if (isAuthenticationFailure(error)) {
      clearPersisted();
      state = {
        ...EMPTY_STATE,
        backend: state.backend,
        notice: { type: "warning", message: "Deine Sitzung ist abgelaufen. Bitte erneut anmelden." }
      };
    } else {
      state.notice = {
        type: "warning",
        message: `Sitzung ist gültig, Portaldaten konnten noch nicht vollständig geladen werden: ${errorText(error)}`
      };
    }
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
      initialData: state.initialData || null,
      backend: state.backend || null,
      notice: state.notice || null,
      loginInProgress: Boolean(loginPromise)
    };
  },

  isAuthenticated() {
    return Boolean(state.authenticated && state.sessionToken && Number(state.expires || 0) > Date.now() + SESSION_EXPIRY_BUFFER_MS);
  },

  isAdmin() {
    return Boolean(state.user && state.user.isAdmin);
  },

  canReadArea(area) {
    if (!this.isAuthenticated()) return false;
    if (!area || this.isAdmin()) return true;
    const permissions = state.user?.permissions || {};
    return Boolean(permissions[area]?.read);
  },

  canWriteArea(area) {
    if (!this.isAuthenticated()) return false;
    if (!area || this.isAdmin()) return true;
    const permissions = state.user?.permissions || {};
    return Boolean(permissions[area]?.write);
  },

  canAdminArea(area) {
    if (!this.isAuthenticated()) return false;
    if (!area || this.isAdmin()) return true;
    const permissions = state.user?.permissions || {};
    return Boolean(permissions[area]?.admin);
  },

  portalFlag(name) {
    return Boolean(state.portal && state.portal[name]);
  },

  appNavigation() {
    return Array.isArray(state.portal?.appNavigation) ? state.portal.appNavigation.slice() : [];
  },

  routeConfig(key) {
    return this.appNavigation().find(item => String(item.id || item.target || "") === String(key || "")) || null;
  },

  canAccessRoute(key) {
    if (!this.isAuthenticated()) return false;
    const configuredItems = this.appNavigation();
    const configured = configuredItems.find(item => String(item.id || item.target || "") === String(key || ""));
    if (configuredItems.length) return Boolean(configured && configured.active !== false);

    const portal = state.portal || {};
    if (key === "dashboard") return true;
    if (key === "fanclub") return this.isAdmin() || Boolean(portal.memberActive) || this.canReadArea("Mitglieder");
    if (key === "cash") return this.isAdmin() || this.canReadArea("Kasse") || this.canReadArea("Beiträge") || this.canReadArea("Konten");
    if (key === "teams") return this.isAdmin() || Boolean(portal.teamAccess);
    if (key === "board") return this.isAdmin() || Boolean(portal.boardAccess);
    if (key === "fanbus") return portal.fanbusAccess !== false;
    if (key === "admin") return this.isAdmin() || Boolean(portal.adminAccess);
    return false;
  },

  async signInWithGoogleCredential(credential, nonce) {
    if (loginPromise) return loginPromise;

    loginPromise = (async () => {
      const result = await api.loginWithGoogleCredential(credential, nonce);
      if (result?.pending) {
        clearPersisted();
        state = {
          ...EMPTY_STATE,
          backend: state.backend,
          notice: {
            type: "warning",
            message: "Dein Google-Konto wurde zur Freischaltung eingereicht. Ein Portal-Admin muss den Antrag noch bestätigen.",
            email: String(result.request?.email || "")
          }
        };
        emitChange();
        return this.current();
      }

      if (!result?.sessionToken) throw new Error("Das Backend hat keine gültige Sitzung geliefert.");

      // Login sofort sichern, bevor weitere Daten geladen werden.
      setAuthenticatedSessionOnly(result, { type: "info", message: "Google-Anmeldung bestätigt. Portaldaten werden geladen …" });
      emitChange();

      try {
        const initialData = await loadInitialDataWithRetry(result.sessionToken);
        setAuthenticated(result, initialData, { type: "success", message: "Google-Anmeldung erfolgreich." });
      } catch (error) {
        if (isAuthenticationFailure(error)) {
          clearPersisted();
          state = {
            ...EMPTY_STATE,
            backend: state.backend,
            notice: { type: "error", message: "Die neue Sitzung konnte nicht bestätigt werden. Bitte erneut anmelden." }
          };
          throw error;
        }
        state.notice = {
          type: "warning",
          message: `Anmeldung war erfolgreich. Portaldaten konnten noch nicht vollständig geladen werden: ${errorText(error)}`
        };
      }

      emitChange();
      return this.current();
    })().finally(() => { loginPromise = null; });

    return loginPromise;
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
      state = { ...EMPTY_STATE, backend: state.backend, notice: { type: "success", message: "Du wurdest abgemeldet." } };
      emitChange();
    }
  },

  async call(functionName, ...args) {
    if (!this.isAuthenticated()) throw new Error("Bitte zuerst anmelden.");
    try {
      return await api.dispatch(state.sessionToken, functionName, ...args);
    } catch (error) {
      if (isAuthenticationFailure(error)) {
        clearPersisted();
        state = { ...EMPTY_STATE, backend: state.backend, notice: { type: "warning", message: "Deine Sitzung ist abgelaufen. Bitte erneut anmelden." } };
        emitChange();
      }
      throw error;
    }
  },

  async refreshInitialData() {
    if (!this.isAuthenticated()) return null;
    const initialData = await loadInitialDataWithRetry(state.sessionToken);
    state.user = initialData.user || state.user;
    state.portal = initialData.portal || state.portal;
    state.initialData = initialData;
    state.notice = null;
    saveSession({ sessionToken: state.sessionToken, expires: state.expires, user: state.user }, initialData);
    emitChange();
    return initialData;
  },

  clearNotice() { state.notice = null; },
  openLegacyPortal() { window.open(CONFIG.urls.legacyPortal, "_blank", "noopener,noreferrer"); }
};
