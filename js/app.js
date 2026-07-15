import { CONFIG } from "./config.js";
import { auth } from "./auth.js";
import { currentRoute, legacyRouteRedirect, navigate, routes } from "./router.js";
import { hydratePage, preloadAuthenticatedModules } from "./pages.js?v=20260715-r71-m4-performance-finish-2";
import { warmupAuthenticatedData, resetWarmup } from "./warmup.js?v=20260715-r71-m4-performance-finish-2";
import { initializeInstall } from "./install.js";
import { storage } from "./storage.js";
import {
  bindGlobalUi,
  escapeHtml,
  hasFragment,
  loadFragment,
  mountComponents,
  renderNavigation,
  setConnectionStatus,
  setRouteHeader,
  showToast,
  updateActiveNavigation,
  updateUserChrome
} from "./ui.js";

let authReady = false;
let routeRenderSequence = 0;
let routeAbortController = null;
let reconnectTimer = 0;
let reconnectAttempt = 0;
let reconnectRunning = false;
let startupProgressTimer = 0;
let startupLongWaitTimer = 0;

function allowedRoute(key) {
  const route = routes()[key];
  if (!route) return false;
  if (route.public) return !auth.isAuthenticated();
  return auth.canAccessRoute(key);
}

function mandatoryRoute() {
  if (auth.requiresProfile()) return "profile";
  return auth.isAuthenticated() ? "dashboard" : "home";
}

function isCurrentRender(renderId, key) {
  return renderId === routeRenderSequence && currentRoute() === key;
}

function connectionLabel() {
  const current = auth.current();
  if (current.connectionPending) return { label: "Verbindung wird wiederhergestellt", type: "warning" };
  if (auth.requiresProfile()) return { label: "Profil unvollständig", type: "warning" };
  if (auth.isAuthenticated()) return { label: "Sicher verbunden", type: "success" };
  return { label: "Öffentlicher Bereich", type: "success" };
}

function updateConnectionChrome() {
  const { label, type } = connectionLabel();
  setConnectionStatus(label, type);
}

function clearReconnectTimer() {
  window.clearTimeout(reconnectTimer);
  reconnectTimer = 0;
}

function scheduleReconnect(delay = null) {
  if (!auth.current().connectionPending || reconnectRunning || reconnectTimer || !navigator.onLine) return;
  const waitMs = delay ?? Math.min(30000, 1500 * Math.pow(2, reconnectAttempt));
  reconnectTimer = window.setTimeout(async () => {
    reconnectTimer = 0;
    if (!auth.current().connectionPending || reconnectRunning || !navigator.onLine) return;
    reconnectRunning = true;
    try {
      await auth.reconnect();
      reconnectAttempt = 0;
      renderNavigation();
      updateUserChrome();
      updateConnectionChrome();
      await renderRoute();
    } catch (error) {
      reconnectAttempt += 1;
      updateConnectionChrome();
      scheduleReconnect();
    } finally {
      reconnectRunning = false;
    }
  }, waitMs);
}

function reconnectPanel(route) {
  return `<section class="card"><h2>${escapeHtml(route.title)}</h2><div class="notice warning"><strong>Verbindung wird wiederhergestellt</strong><br>Deine Anmeldung bleibt erhalten. Das Portal versucht automatisch, die Backend-Verbindung neu aufzubauen.</div><div class="dialog-actions"><button id="routeReconnectButton" class="button primary" type="button">Jetzt erneut verbinden</button></div></section>`;
}

async function renderRoute() {
  if (legacyRouteRedirect()) return;

  let key = currentRoute();
  if (!authReady && key !== "home") return;

  if (auth.requiresProfile() && key !== "profile") {
    navigate("profile", null, true);
    return;
  }

  if (!allowedRoute(key)) {
    navigate(mandatoryRoute(), null, true);
    return;
  }

  const route = routes()[key];
  const view = document.getElementById("view");
  if (!view) return;

  const renderId = ++routeRenderSequence;
  routeAbortController?.abort();
  const controller = new AbortController();
  routeAbortController = controller;
  const isCurrent = () => isCurrentRender(renderId, key);

  setRouteHeader(route);
  updateActiveNavigation();
  view.setAttribute("aria-busy", "true");
  const fragmentPath = `./pages/${route.page}`;
  if (!hasFragment(fragmentPath)) {
    view.innerHTML = '<div class="loading-panel"><span class="spinner" aria-hidden="true"></span><strong>Ansicht wird geladen …</strong></div>';
  }

  try {
    const fragment = await loadFragment(fragmentPath, { signal: controller.signal });
    if (!isCurrent()) return;

    view.innerHTML = fragment;

    if (auth.current().connectionPending && !route.public && key !== "profile") {
      view.innerHTML = reconnectPanel(route);
      document.getElementById("routeReconnectButton")?.addEventListener("click", () => {
        clearReconnectTimer();
        scheduleReconnect(0);
      });
      scheduleReconnect();
      return;
    }

    await hydratePage(key, { signal: controller.signal, isCurrent });
    if (!isCurrent()) return;
    view.focus({ preventScroll: true });
  } catch (error) {
    if (error?.name === "AbortError" || !isCurrent()) return;
    view.innerHTML = `<section class="card"><h2>Ansicht konnte nicht geladen werden</h2><p>${escapeHtml(error.message)}</p><button id="routeRetryButton" class="button secondary" type="button">Erneut versuchen</button></section>`;
    document.getElementById("routeRetryButton")?.addEventListener("click", renderRoute);
    showToast("Ansicht konnte nicht geladen werden.", "error");
  } finally {
    if (isCurrent()) view.removeAttribute("aria-busy");
  }
}

function showUpdate(registration) {
  const banner = document.getElementById("updateBanner");
  const button = document.getElementById("updateButton");
  const dismiss = document.getElementById("updateDismiss");
  if (!banner || !registration?.waiting) return;

  banner.hidden = false;
  button.onclick = () => {
    storage.set(CONFIG.pwa.updateReloadKey, true);
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    button.disabled = true;
    button.textContent = "Wird aktualisiert …";
  };
  dismiss.onclick = () => {
    banner.hidden = true;
    storage.set(CONFIG.pwa.updateDismissKey, true);
  };
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (storage.get(CONFIG.pwa.updateReloadKey, false)) {
        storage.remove(CONFIG.pwa.updateReloadKey);
        location.reload();
      }
    });

    const registration = await navigator.serviceWorker.register(CONFIG.pwa.serviceWorker, {
      scope: "./",
      updateViaCache: "none"
    });
    await navigator.serviceWorker.ready;

    if (registration.waiting) showUpdate(registration);
    registration.addEventListener("updatefound", () => registration.installing?.addEventListener("statechange", () => {
      if (registration.installing?.state === "installed" && navigator.serviceWorker.controller) {
        showUpdate(registration);
      }
    }));
    registration.update().catch(() => null);
  } catch (error) {
    showToast(`Service Worker: ${error.message}`, "error", 6000);
  }
}

function clearStartupTimers() {
  window.clearTimeout(startupProgressTimer);
  window.clearTimeout(startupLongWaitTimer);
  startupProgressTimer = 0;
  startupLongWaitTimer = 0;
}

function setStartupProgress(message, detail = "", showReload = false) {
  const splash = document.getElementById("appSplash");
  const status = document.getElementById("splashStatus");
  const detailNode = document.getElementById("splashDetail");
  const reload = document.getElementById("splashReloadButton");
  if (status) status.textContent = message;
  if (detailNode) detailNode.textContent = detail;
  if (reload) {
    reload.hidden = !showReload;
    reload.onclick = showReload ? () => location.reload() : null;
  }
  if (splash) splash.setAttribute("aria-busy", "true");
}

function beginStartupProgress() {
  clearStartupTimers();
  document.documentElement.dataset.startupState = "loading";
  setStartupProgress("Portal wird vorbereitet …", "Sichere App-Oberfläche wird geladen.");
  startupProgressTimer = window.setTimeout(() => {
    setStartupProgress(
      "Login und Backend werden weiter geprüft …",
      "Der erste Verbindungsaufbau dauert länger als üblich. Deine Sitzung und Rechte bleiben erhalten."
    );
  }, 4500);
  startupLongWaitTimer = window.setTimeout(() => {
    setStartupProgress(
      "Backend-Verbindung dauert ungewöhnlich lange …",
      "Du kannst weiter warten oder den Verbindungsaufbau kontrolliert neu starten.",
      true
    );
  }, 15000);
}

function finishStartup() {
  clearStartupTimers();
  const shell = document.getElementById("appShell");
  const splash = document.getElementById("appSplash");
  if (shell) shell.hidden = false;
  document.documentElement.dataset.startupState = "complete";
  document.documentElement.dataset.startupComplete = "true";
  if (!splash) return;
  splash.setAttribute("aria-busy", "false");
  splash.classList.add("is-complete");
  window.setTimeout(() => splash.remove(), 220);
}

function failStartup(error) {
  clearStartupTimers();
  document.documentElement.dataset.startupState = "failed";
  setStartupProgress(
    "Portal konnte nicht gestartet werden",
    error?.message || String(error || "Unbekannter Startfehler"),
    true
  );
}

function primeRouteFragments() {
  const entries = Object.values(routes());
  const schedule = window.requestIdleCallback || (callback => window.setTimeout(callback, 500));
  schedule(() => {
    entries.forEach(route => loadFragment(`./pages/${route.page}`).catch(() => null));
  });
}

async function refreshApp() {
  try {
    setConnectionStatus("Aktualisiere …", "warning");
    if (auth.current().connectionPending) await auth.reconnect();
    if (auth.isAuthenticated() && !auth.requiresProfile()) await auth.refreshInitialData();
    renderNavigation();
    updateUserChrome();
    await renderRoute();
    updateConnectionChrome();
  } catch (error) {
    updateConnectionChrome();
    showToast(error.message || "Aktualisierung fehlgeschlagen.", "error", 6000);
    if (auth.current().connectionPending) scheduleReconnect();
  }
}

async function logout() {
  try {
    clearReconnectTimer();
    await auth.logout();
    resetWarmup();
    renderNavigation();
    updateUserChrome();
    navigate("home");
    updateConnectionChrome();
  } catch (error) {
    showToast(error.message || "Abmeldung fehlgeschlagen.", "error");
  }
}

async function bootstrap() {
  try {
    beginStartupProgress();
    initializeInstall();
    setStartupProgress("App-Oberfläche wird vorbereitet …", "Navigation und Bedienoberfläche werden geladen.");
    await mountComponents();
    bindGlobalUi({ onRefresh: refreshApp, onLogout: logout });
    window.addEventListener("hashchange", renderRoute);
    window.addEventListener("pd-auth-change", () => {
      renderNavigation();
      updateUserChrome();
      updateConnectionChrome();
      if (auth.requiresProfile() && currentRoute() !== "profile") {
        navigate("profile", null, true);
        return;
      }
      if (!auth.isAuthenticated() && !routes()[currentRoute()]?.public) {
        resetWarmup();
        navigate("home", null, true);
        return;
      }
      if (auth.current().connectionPending) scheduleReconnect();
    });

    registerServiceWorker();
    primeRouteFragments();
    setConnectionStatus("Backend wird geprüft", "warning");
    setStartupProgress("Sichere Verbindung wird aufgebaut …", "Login, Sitzung und Backend werden geprüft.");
    try {
      await auth.initialize();
      authReady = true;
      updateConnectionChrome();
    } catch (error) {
      authReady = true;
      setConnectionStatus("Backend nicht erreichbar", "warning");
      showToast(error.message || "Backend-Verbindung fehlgeschlagen.", "error", 8000);
    }

    renderNavigation();
    updateUserChrome();
    if (auth.isAuthenticated() && !auth.requiresProfile()) {
      setStartupProgress("Benutzerprofil und Rechte sind geladen …", "Die erste Portalansicht wird jetzt vollständig vorbereitet.");
    }

    let startRoute=currentRoute();
    if (!location.hash || !allowedRoute(startRoute) || (auth.requiresProfile() && startRoute !== "profile")) {
      startRoute=mandatoryRoute();
      history.replaceState(null,"",`#/${startRoute}`);
    }
    setStartupProgress("Startansicht wird geladen …", "Das Portal wird erst angezeigt, wenn die erste Ansicht nutzbar ist.");
    await renderRoute();

    if (auth.current().connectionPending) scheduleReconnect();
    finishStartup();

    if (auth.isAuthenticated() && !auth.requiresProfile() && !auth.current().connectionPending) {
      // Fachdatencaches sofort im Hintergrund anstoßen, damit der erste Wechsel
      // zu Aufgaben/Fanclub denselben laufenden Request wiederverwendet.
      window.setTimeout(() => warmupAuthenticatedData().catch(() => null), 0);

      // Reine Modulimporte bleiben bewusst im Idle-Zeitfenster.
      const schedule = window.requestIdleCallback || (callback => window.setTimeout(callback, 350));
      schedule(() => preloadAuthenticatedModules().catch(() => null));
    }
  } catch (error) {
    failStartup(error);
  }
}

window.addEventListener("online", () => {
  updateConnectionChrome();
  if (auth.current().connectionPending) scheduleReconnect(0);
});
window.addEventListener("offline", () => setConnectionStatus("Offline", "warning"));

bootstrap();
