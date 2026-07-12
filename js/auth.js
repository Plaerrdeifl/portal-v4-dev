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

let state = { ...EMPTY_STATE };

function emitChange() {
  window.dispatchEvent(new CustomEvent("pd-auth-change", { detail: auth.current() }));
}

function callbackParams() {
  const query = new URLSearchParams(location.search || "");
  const hash = String(location.hash || "");
  const hashQuery = hash.includes("?") ? new URLSearchParams(hash.slice(hash.indexOf("?") + 1)) : new URLSearchParams();
  for (const [key, value] of hashQuery.entries()) query.set(key, value);
  return query;
}

function cleanCallbackAddress(target = "login") {
  try { history.replaceState(null, "", `${location.pathname}#/${target}`); }
  catch { location.hash = `#/${target}`; }
}

function persistedSession() {
  const value = storage.get(CONFIG.auth.storageKey, null);
  if (!value || typeof value !== "object") return null;
  if (!value.sessionToken || !value.expires || Number(value.expires) <= Date.now()) return null;
  return value;
}

function saveSession(session, initialData = null) {
  const record = {
    sessionToken: String(session?.sessionToken || ""),
    expires: Number(session?.expires || 0),
    user: initialData?.user || session?.user || null,
    portal: initialData?.portal || session?.portal || null
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
      cleanCallbackAddress("login");
      state.notice = {
        type: "warning",
        message: "Dein Google-Konto wurde zur Freischaltung eingereicht. Ein Portal-Admin muss den Antrag noch bestätigen.",
        email: String(params.get("email") || "")
      };
      emitChange();
      return this.current();
    }

    if (callbackStatus === "error") {
      clearPersisted();
      cleanCallbackAddress("login");
      state.notice = {
        type: "error",
        message: String(params.get("message") || "Google-Anmeldung wurde nicht abgeschlossen.")
      };
      emitChange();
      return this.current();
    }

    if (ticket) {
      const session = await api.exchangeTicket(ticket);
      // Die Sitzung wird sofort gesichert. Falls nur das Laden der Startdaten
      // scheitert, ist das einmalige Login-Ticket nicht verloren.
      saveSession(session, null);
      cleanCallbackAddress("home");
      try {
        const initialData = await loadInitialData(session.sessionToken);
        setAuthenticated(session, initialData, { type: "success", message: "Google-Anmeldung erfolgreich." });
      } catch (error) {
        state = {
          authenticated: true,
          sessionToken: session.sessionToken,
          expires: Number(session.expires || 0),
          user: session.user || null,
          portal: null,
          initialData: null,
          backend: state.backend,
          notice: { type: "warning", message: `Anmeldung erfolgreich, Startdaten konnten noch nicht geladen werden: ${error.message}` }
        };
      }
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
      setAuthenticated(resumed, initialData, null);
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

  async signInWithGoogleCredential(credential, nonce) {
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
    const initialData = await loadInitialData(result.sessionToken);
    setAuthenticated(result, initialData, { type: "success", message: "Google-Anmeldung erfolgreich." });
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
      state = { ...EMPTY_STATE, backend: state.backend, notice: { type: "success", message: "Du wurdest abgemeldet." } };
      emitChange();
    }
  },

  async call(functionName, ...args) {
    if (!this.isAuthenticated()) throw new Error("Bitte zuerst anmelden.");
    try {
      return await api.dispatch(state.sessionToken, functionName, ...args);
    } catch (error) {
      if (/AUTH_REQUIRED|abgelaufen|anmelden/i.test(String(error?.message || ""))) {
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

  clearNotice() { state.notice = null; },
  openLegacyPortal() { window.open(CONFIG.urls.legacyPortal, "_blank", "noopener,noreferrer"); }
};
