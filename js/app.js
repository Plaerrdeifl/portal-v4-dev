import { CONFIG } from "./config.js";
import { auth } from "./auth.js";
import { currentRoute, legacyRouteRedirect, navigate, routes } from "./router.js";
import { hydratePage } from "./pages.js?v=20260715-r71-m4-ui-race-hotfix-1";
import { initializeInstall } from "./install.js";
import { storage } from "./storage.js";
import {
  bindGlobalUi,
  escapeHtml,
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

function allowedRoute(key) {
  const route = routes()[key];
  if (!route) return false;
  if (route.public) return !auth.isAuthenticated();
  if (route.system) return auth.canAccessRoute(key);
  return auth.canAccessRoute(key);
}

function mandatoryRoute() {
  if (auth.requiresProfile()) return "profile";
  return auth.isAuthenticated() ? "dashboard" : "home";
}

function isCurrentRender(renderId, key) {
  return renderId === routeRenderSequence && currentRoute() === key;
}

async function renderRoute() {
  if (legacyRouteRedirect()) return;

  let key = currentRoute();
  if (!authReady && key !== "home") key = "home";

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
  view.innerHTML = '<div class="loading-panel"><span class="spinner" aria-hidden="true"></span><strong>Ansicht wird geladen …</strong></div>';

  try {
    const fragment = await loadFragment(`./pages/${route.page}`, { signal: controller.signal });
    if (!isCurrent()) return;

    view.innerHTML = fragment;
    await hydratePage(key, { signal: controller.signal, isCurrent });
    if (!isCurrent()) return;

    view.focus({ preventScroll: true });
  } catch (error) {
    if (error?.name === "AbortError" || !isCurrent()) return;

    view.innerHTML = `<section class="card"><h2>Ansicht konnte nicht geladen werden</h2><p>${escapeHtml(error.message)}</p><button class="button secondary" type="button" onclick="location.reload()">Erneut versuchen</button></section>`;
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

async function refreshApp() {
  try {
    setConnectionStatus("Aktualisiere …", "warning");
    if (auth.isAuthenticated() && !auth.requiresProfile()) await auth.refreshInitialData();
    renderNavigation();
    updateUserChrome();
    await renderRoute();
    setConnectionStatus(
      auth.requiresProfile() ? "Profil unvollständig" : auth.isAuthenticated() ? "Sicher verbunden" : "Öffentlicher Bereich",
      auth.requiresProfile() ? "warning" : "success"
    );
  } catch (error) {
    setConnectionStatus("Verbindungsfehler", "warning");
    showToast(error.message || "Aktualisierung fehlgeschlagen.", "error", 6000);
  }
}

async function logout() {
  try {
    await auth.logout();
    renderNavigation();
    updateUserChrome();
    navigate("home");
    setConnectionStatus("Öffentlicher Bereich", "success");
  } catch (error) {
    showToast(error.message || "Abmeldung fehlgeschlagen.", "error");
  }
}

async function bootstrap() {
  try {
    initializeInstall();
    await mountComponents();
    document.getElementById("appShell").hidden = false;
    document.getElementById("appSplash")?.remove();
    bindGlobalUi({ onRefresh: refreshApp, onLogout: logout });
    window.addEventListener("hashchange", renderRoute);
    window.addEventListener("pd-auth-change", () => {
      renderNavigation();
      updateUserChrome();
      if (auth.requiresProfile() && currentRoute() !== "profile") navigate("profile", null, true);
    });

    setConnectionStatus("Backend wird geprüft", "warning");
    try {
      await auth.initialize();
      authReady = true;
      setConnectionStatus(
        auth.requiresProfile() ? "Profil unvollständig" : auth.isAuthenticated() ? "Sicher verbunden" : "Öffentlicher Bereich",
        auth.requiresProfile() ? "warning" : "success"
      );
    } catch (error) {
      authReady = true;
      setConnectionStatus("Backend nicht erreichbar", "warning");
      showToast(error.message || "Backend-Verbindung fehlgeschlagen.", "error", 8000);
    }

    renderNavigation();
    updateUserChrome();
    if (!location.hash) navigate(mandatoryRoute());
    else if (!allowedRoute(currentRoute()) || (auth.requiresProfile() && currentRoute() !== "profile")) navigate(mandatoryRoute(), null, true);
    else await renderRoute();

    registerServiceWorker();
  } catch (error) {
    const splash = document.getElementById("appSplash");
    if (splash) splash.innerHTML = `<strong>Portal konnte nicht gestartet werden</strong><span>${escapeHtml(error.message)}</span>`;
  }
}

window.addEventListener("online", () => setConnectionStatus(
  auth.requiresProfile() ? "Profil unvollständig" : auth.isAuthenticated() ? "Sicher verbunden" : "Öffentlicher Bereich",
  auth.requiresProfile() ? "warning" : "success"
));
window.addEventListener("offline", () => setConnectionStatus("Offline", "warning"));

bootstrap();
