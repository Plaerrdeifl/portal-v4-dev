import { CONFIG } from "./config.js";
import { auth } from "./auth.js";
import { currentRoute, legacyRouteRedirect, navigate, routes } from "./router.js";
import { hydratePage } from "./pages.js?v=20260715-r71-m4-startup-hotfix-3";
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

function startupPanel(message = "Login und Backend werden geprüft", detail = "Die sichere Verbindung zum Portal wird aufgebaut.", showReload = false) {
  const view = document.getElementById("view");
  if (!view) return;
  view.setAttribute("aria-busy", "true");
  view.innerHTML = `<section class="loading-panel" id="startupLoadingPanel" aria-live="polite"><span class="spinner" aria-hidden="true"></span><strong>${escapeHtml(message)}</strong><span>${escapeHtml(detail)}</span>${showReload ? '<button id="startupReloadButton" class="button secondary" type="button">Verbindung neu starten</button>' : ""}</section>`;
  document.getElementById("startupReloadButton")?.addEventListener("click", () => location.reload());
}

function beginStartupProgress() {
  clearStartupTimers();
  startupPanel();
  startupProgressTimer = window.setTimeout(() => {
    startupPanel(
      "Login und Backend werden weiter geprüft",
      "Der erste Verbindungsaufbau dauert länger als üblich. Deine Sitzung und Rechte werden noch nicht verändert."
    );
  }, 4500);
  startupLongWaitTimer = window.setTimeout(() => {
    startupPanel(
      "Backend-Verbindung dauert ungewöhnlich lange",
      "Du kannst noch warten oder den Verbindungsaufbau kontrolliert neu starten.",
      true
    );
  }, 15000);
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
    initializeInstall();
    await mountComponents();
    document.getElementById("appShell").hidden = false;
    beginStartupProgress();
    window.requestAnimationFrame(() => document.getElementById("appSplash")?.remove());
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
        navigate("home", null, true);
        return;
      }
      if (auth.current().connectionPending) scheduleReconnect();
    });

    setConnectionStatus("Backend wird geprüft", "warning");
    try {
      await auth.initialize();
      authReady = true;
      updateConnectionChrome();
    } catch (error) {
      authReady = true;
      setConnectionStatus("Backend nicht erreichbar", "warning");
      showToast(error.message || "Backend-Verbindung fehlgeschlagen.", "error", 8000);
    }

    clearStartupTimers();
    renderNavigation();
    updateUserChrome();
    if (!location.hash) {
      navigate(mandatoryRoute());
    } else if (!allowedRoute(currentRoute()) || (auth.requiresProfile() && currentRoute() !== "profile")) {
      navigate(mandatoryRoute(), null, true);
    } else {
      await renderRoute();
    }

    if (auth.current().connectionPending) scheduleReconnect();
    registerServiceWorker();
  } catch (error) {
    clearStartupTimers();
    const splash = document.getElementById("appSplash");
    if (splash) splash.innerHTML = `<strong>Portal konnte nicht gestartet werden</strong><span>${escapeHtml(error.message)}</span>`;
  }
}

window.addEventListener("online", () => {
  updateConnectionChrome();
  if (auth.current().connectionPending) scheduleReconnect(0);
});
window.addEventListener("offline", () => setConnectionStatus("Offline", "warning"));

bootstrap();
