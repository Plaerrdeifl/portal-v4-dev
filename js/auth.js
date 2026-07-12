import { CONFIG } from "./config.js";
import { api } from "./api.js";
import { storage } from "./storage.js";

const EMPTY_STATE = Object.freeze({
  authenticated: false,
  sessionToken: "",
  expires: 0,
  user: null,
  portal: null,
  backend: null,
  notice: null
});

let state = { ...EMPTY_STATE };

function emitChange() {
  window.dispatchEvent(new CustomEvent("pd-auth-change", { detail: auth.current() }));
}

function callbackParams() {
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

function cleanCallbackHash(target = "login") {
  const path = `${location.pathname}${location.search}#/${target}`;
  history.replaceState(null, "", path);
}

function persistedSession() {
  const value = storage.get(CONFIG.auth.storageKey, null);
  if (!value || typeof value !== "object") return null;
  if (!value.sessionToken || !value.expires || Number(value.expires) <= Date.now()) return null;
  return value;
}

function saveSession(session, initialData) {
  const record = {
    sessionToken: String(session.sessionToken || ""),
    expires: Number(session.expires || 0),
    user: (initialData && initialData.user) || session.user || null,
    portal: (initialData && initialData.portal) || null
  };
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

export const auth = {
  async initialize() {
    state = { ...EMPTY_STATE };
    await api.initialize();
    state.backend = await api.getConfig();

    const params = callbackParams();
    const ticket = String(params.get("ticket") || "").trim();
    const callbackStatus = String(params.get("status") || "").trim();

    if (callbackStatus === "pending") {
      clearPersisted();
      state.notice = {
        type: "warning",
        message: "Dein Google-Konto wurde zur Freischaltung eingereicht. Ein Portal-Admin muss den Antrag noch bestätigen.",
        email: String(params.get("email") || "")
      };
      cleanCallbackHash("login");
      emitChange();
      return this.current();
    }

    if (callbackStatus === "error") {
      clearPersisted();
      state.notice = {
        type: "error",
        message: String(params.get("message") || "Google-Anmeldung wurde nicht abgeschlossen.")
      };
      cleanCallbackHash("login");
      emitChange();
      return this.current();
    }

    if (ticket) {
      cleanCallbackHash("login");
      const session = await api.exchangeTicket(ticket);
      const initialData = await loadInitialData(session.sessionToken);
      const saved = saveSession(session, initialData);
      state = {
        authenticated: true,
        sessionToken: saved.sessionToken,
        expires: saved.expires,
        user: initialData.user || saved.user,
        portal: initialData.portal || null,
        initialData,
        backend: state.backend,
        notice: { type: "success", message: "Google-Anmeldung erfolgreich." }
      };
      emitChange();
      return this.current();
    }

    const saved = persistedSession();
    if (!saved) {
      clearPersisted();
      emitChange();
      return this.current();
    }

    try {
      const resumed = await api.resumeSession(saved.sessionToken);
      const initialData = await loadInitialData(resumed.sessionToken);
      const refreshed = saveSession(resumed, initialData);
      state = {
        authenticated: true,
        sessionToken: refreshed.sessionToken,
        expires: refreshed.expires,
        user: initialData.user || resumed.user || saved.user,
        portal: initialData.portal || saved.portal || null,
        initialData,
        backend: state.backend,
        notice: null
      };
    } catch (error) {
      clearPersisted();
      state = {
        ...EMPTY_STATE,
        backend: state.backend,
        notice: { type: "warning", message: "Deine Sitzung ist abgelaufen. Bitte erneut anmelden." }
      };
    }

    emitChange();
    return this.current();
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
      notice: state.notice || null
    };
  },

  isAuthenticated() {
    return Boolean(state.authenticated && state.sessionToken && Number(state.expires || 0) > Date.now());
  },

  isAdmin() {
    return Boolean(state.user && state.user.isAdmin);
  },

  canReadArea(area) {
    if (!this.isAuthenticated()) return false;
    if (!area || this.isAdmin()) return true;
    const permissions = (state.user && state.user.permissions) || {};
    return Boolean(permissions[area] && permissions[area].read);
  },

  canAccessRoute(key) {
    if (key === "home" || key === "login") return true;
    if (!this.isAuthenticated()) return false;
    const portal = state.portal || {};
    if (key === "dashboard") return this.canReadArea("Dashboard");
    if (key === "fanclub") return this.isAdmin() || Boolean(portal.memberActive);
    if (key === "teams") return this.isAdmin() || Boolean(portal.teamAccess);
    if (key === "fanbus") return portal.fanbusAccess !== false;
    if (key === "admin") return this.isAdmin() || Boolean(portal.adminAccess);
    return false;
  },

  async login() {
    const result = await api.createLoginUrl(CONFIG.urls.frontend);
    if (!result || !result.url) throw new Error("Google-Anmeldeadresse konnte nicht erstellt werden.");
    window.location.assign(result.url);
  },

  async logout() {
    const token = state.sessionToken;
    try {
      if (token) await api.logout(token);
    } finally {
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
      if (/AUTH_REQUIRED|abgelaufen|anmelden/i.test(String(error && error.message || ""))) {
        clearPersisted();
        state = { ...EMPTY_STATE, backend: state.backend, notice: { type: "warning", message: "Deine Sitzung ist abgelaufen. Bitte erneut anmelden." } };
        emitChange();
      }
      throw error;
    }
  },

  async refreshInitialData() {
    if (!this.isAuthenticated()) return null;
    const initialData = await loadInitialData(state.sessionToken);
    state.user = initialData.user || state.user;
    state.portal = initialData.portal || state.portal;
    state.initialData = initialData;
    saveSession({ sessionToken: state.sessionToken, expires: state.expires, user: state.user }, initialData);
    emitChange();
    return initialData;
  },

  clearNotice() {
    state.notice = null;
  },

  openLegacyPortal() {
    window.open(CONFIG.urls.legacyPortal, "_blank", "noopener,noreferrer");
  }
};
