import { CONFIG } from "./config.js";
import { api } from "./api.js";
import { auth } from "./auth.js";
import {
  currentRoute,
  legacyRouteRedirect,
  routes
} from "./router.js";
import {
  hydratePage
} from "./pages.js?v=20260829-m328-r1-native-actions1";
import {
  activateUpdate,
  initializeInstall
} from "./install.js?v=20260802-pwa-install-guidance-r1";
import {
  initializeAuthGate,
  showApp,
  showChecking,
  showLogin,
  showMaintenance,
  showOpening,
  syncLegalLinks
} from "./auth-gate.js";
import { formatExpectedEnd, platformMode } from "./platform-mode.js";
import {
  bindGlobalUi,
  loadFragment,
  mountComponents,
  renderNavigation,
  setConnectionStatus,
  setRouteHeader,
  showToast,
  updateActiveNavigation,
  updateUserChrome
} from "./ui.js";

let renderSequence = 0;
let authEventQueued = false;
let authOperationActive = false;
let explicitRefreshActive = false;
let lastAuthRenderRevision = -1;
let apiActivity = api.activity();

function syncAuthRenderRevision(current = auth.current()) {
  lastAuthRenderRevision = Number(current.renderRevision || 0);
}

function renderPlatformMode(status) {
  document.documentElement.dataset.platformMode = status.mode;
  const banner = document.getElementById("platformReadOnlyBanner");
  const message = document.getElementById("platformReadOnlyMessage");
  const end = document.getElementById("platformReadOnlyEnd");
  if (!banner) return;

  const readOnly = status.mode === "READ_ONLY" && status.available;
  banner.hidden = !readOnly;
  if (message) {
    message.textContent = status.message || "Lesen ist weiterhin möglich; Änderungen sind vorübergehend gesperrt.";
  }
  const expectedEnd = formatExpectedEnd(status.expectedEnd);
  if (end) {
    end.textContent = expectedEnd ? `Voraussichtliches Ende: ${expectedEnd}` : "";
    end.hidden = !expectedEnd;
  }
}

function connectionState() {
  const current = auth.current();

  if (!navigator.onLine) {
    return { label: "Offline", type: "error" };
  }

  if (!CONFIG.supabase.configured) {
    return { label: "Fehler", type: "error" };
  }

  if (current.error || apiActivity.error) {
    return { label: "Fehler", type: "error" };
  }

  if (current.busy || apiActivity.busy) {
    return { label: "Lädt …", type: "loading" };
  }

  if (!current.authenticated) {
    return { label: "Live", type: "success" };
  }

  if (current.status === "ACTIVE") {
    return { label: "Live", type: "success" };
  }

  if (current.status === "BLOCKED") {
    return { label: "Fehler", type: "error" };
  }

  return { label: "Lädt …", type: "loading" };
}

function afterNextPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function replaceHash(target) {
  const normalized = String(target || "#/login");
  const hash = normalized.startsWith("#/")
    ? normalized
    : "#/" + normalized.replace(/^#?\/?/, "");
  history.replaceState(null, "", hash);
}

function rememberedTarget(current) {
  if (current.status !== "ACTIVE") return "";
  const remembered = auth.consumePostLoginRoute();
  if (!remembered || !remembered.startsWith("#/")) return "";

  const key = remembered.replace(/^#\/?/, "").split(/[?&]/)[0];
  if (!routes()[key] || routes()[key].public || key === "profile" || !auth.canAccessRoute(key)) {
    return "";
  }
  return remembered;
}

function authenticatedTarget(current, consumeRemembered = false) {
  if (current.status !== "ACTIVE") return "#/profile";
  if (consumeRemembered) {
    const remembered = rememberedTarget(current);
    if (remembered) return remembered;
  }
  return "#/dashboard";
}

function updateConnectionChrome() {
  const connection = connectionState();
  setConnectionStatus(connection.label, connection.type);
}

function updateChrome() {
  renderNavigation();
  updateUserChrome();
  updateActiveNavigation();
  updateConnectionChrome();
}

function enforceRoute(key) {
  const route = routes()[key];
  const current = auth.current();

  if (!route) {
    return current.authenticated
      ? authenticatedTarget(current).replace(/^#\//, "")
      : "login";
  }

  if (key === "login") {
    if (!current.authenticated) return "login";
    return current.status === "ACTIVE" ? "dashboard" : "profile";
  }

  if (!current.authenticated) {
    auth.rememberPostLoginRoute(location.hash);
    return "login";
  }

  if (auth.requiresProfile()) return "profile";
  if (!auth.canAccessRoute(key)) return "dashboard";
  return key;
}

async function renderRoute() {
  if (legacyRouteRedirect()) return;

  const requested = currentRoute();
  const allowed = enforceRoute(requested);

  if (allowed !== requested) {
    replaceHash("#/" + allowed);
    return renderRoute();
  }

  document.documentElement.dataset.route = allowed;
  const renderId = ++renderSequence;

  if (allowed === "login") {
    updateChrome();
    await showLogin({ onCredential: signInWithGoogleCredential });
    return;
  }

  const route = routes()[allowed];
  setRouteHeader(route);
  const view = document.getElementById("view");
  if (!view) throw new Error("Der Portal-Inhaltsbereich fehlt.");

  try {
    const html = await loadFragment("./pages/" + route.page);
    if (renderId !== renderSequence || currentRoute() !== allowed) return;

    view.innerHTML = html;
    await hydratePage(allowed, {
      isCurrent: () => renderId === renderSequence && currentRoute() === allowed
    });

    if (renderId !== renderSequence) return;
    syncLegalLinks();
    updateChrome();
    view.focus({ preventScroll: true });
    view.scrollTo({ top: 0, behavior: "instant" });
    await afterNextPaint();
    showApp({ authLayout: allowed === "profile" });
  } catch (error) {
    if (renderId !== renderSequence) return;
    const message = String(error?.message || error);
    view.innerHTML = '<section class="page"><article class="card notice error"><h2>Seite konnte nicht geladen werden</h2><p>' + message + '</p></article></section>';
    showApp({ authLayout: allowed === "profile" });
    showToast(message || "Seite konnte nicht geladen werden.", "error", 7000);
  }
}

function handleAuthChange() {
  if (authOperationActive || explicitRefreshActive || authEventQueued) return;
  authEventQueued = true;

  queueMicrotask(async () => {
    authEventQueued = false;
    if (authOperationActive || explicitRefreshActive) return;

    const current = auth.current();
    if (current.busy || current.status === "LOADING") return;

    const renderRelevantChange = Number(current.renderRevision || 0) !== lastAuthRenderRevision;
    syncAuthRenderRevision(current);
    let routeChanged = false;

    if (!current.authenticated && currentRoute() !== "login") {
      replaceHash("#/login");
      routeChanged = true;
    } else if (current.authenticated && currentRoute() === "login") {
      replaceHash(authenticatedTarget(current));
      routeChanged = true;
    }

    if (routeChanged || renderRelevantChange) {
      await renderRoute();
      return;
    }
    updateConnectionChrome();
  });
}

async function signInWithGoogleCredential(response, nonce) {
  if (authOperationActive) throw new Error("Eine Anmeldung wird bereits verarbeitet.");
  authOperationActive = true;
  showChecking("Google-Anmeldung wird geprüft …", "Portalstatus und Berechtigungen werden geladen.");

  try {
    const current = await auth.signInWithGoogleIdToken(response?.credential, nonce);
    syncAuthRenderRevision(current);
    replaceHash(authenticatedTarget(current, true));
    await renderRoute();
    if (current.status === "ACTIVE") showToast("Anmeldung erfolgreich.", "success");
  } catch (error) {
    await showLogin({
      onCredential: signInWithGoogleCredential,
      errorMessage: error?.message || "Anmeldung konnte nicht abgeschlossen werden."
    });
    throw error;
  } finally {
    authOperationActive = false;
  }
}

async function refreshCurrentView() {
  if (explicitRefreshActive) return;
  explicitRefreshActive = true;
  try {
    if (auth.isAuthenticated()) await auth.refresh();
    syncAuthRenderRevision();
    await renderRoute();
  } catch (error) {
    showToast(error?.message || "Aktualisierung fehlgeschlagen.", "error", 6500);
  } finally {
    explicitRefreshActive = false;
  }
}

async function logout() {
  if (authOperationActive) return;
  authOperationActive = true;
  showChecking("Abmeldung wird abgeschlossen …", "Die lokale Portalsitzung wird sicher beendet.");
  try {
    await auth.logout();
    syncAuthRenderRevision();
    replaceHash("#/login");
    await renderRoute();
    showToast("Du wurdest abgemeldet.", "success");
  } catch (error) {
    showToast(error?.message || "Abmeldung fehlgeschlagen.", "error", 6500);
    await renderRoute();
  } finally {
    authOperationActive = false;
  }
}

async function bootstrap() {
  initializeAuthGate();
  showOpening("Portal wird geöffnet …", "Sichere Anmeldung wird vorbereitet.");

  const platformStatus = await platformMode.refresh();
  renderPlatformMode(platformStatus);
  if (platformStatus.mode === "MAINTENANCE" || !platformStatus.available) {
    showMaintenance({
      message: platformStatus.message,
      expectedEnd: formatExpectedEnd(platformStatus.expectedEnd)
    });
    return;
  }

  await mountComponents();
  bindGlobalUi({ onRefresh: refreshCurrentView, onLogout: logout });
  initializeInstall();

  window.addEventListener("pd-update-available", () => {
    const banner = document.getElementById("updateBanner");
    if (banner) banner.hidden = false;
  });

  document.getElementById("updateButton")?.addEventListener("click", () => activateUpdate());
  document.getElementById("updateDismiss")?.addEventListener("click", () => {
    const banner = document.getElementById("updateBanner");
    if (banner) banner.hidden = true;
  });

  window.addEventListener("hashchange", () => {
    if (!authOperationActive) void renderRoute();
  });

  window.addEventListener("pd-api-state", event => {
    apiActivity = event.detail || api.activity();
    const connection = connectionState();
    setConnectionStatus(connection.label, connection.type);
  });

  window.addEventListener("online", refreshCurrentView);
  window.addEventListener("offline", updateChrome);

  await auth.initialize();
  window.addEventListener("pd-auth-change", handleAuthChange);

  const current = auth.current();
  syncAuthRenderRevision(current);
  const hadInitialHash = Boolean(location.hash);

  if (!hadInitialHash) {
    replaceHash(current.authenticated ? authenticatedTarget(current) : "#/login");
  } else if (current.authenticated && currentRoute() === "login") {
    replaceHash(authenticatedTarget(current));
  }

  await renderRoute();
}

bootstrap().catch(async error => {
  console.error(error);
  await showLogin({
    onCredential: signInWithGoogleCredential,
    errorMessage: error?.message || "Portalstart fehlgeschlagen."
  });
});
