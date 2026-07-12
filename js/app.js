import { CONFIG } from "./config.js";
import { auth } from "./auth.js";
import { currentRoute, navigate, routes } from "./router.js";
import { hydratePage } from "./pages.js";
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

let deferredInstallPrompt = null;
let authReady = false;

function allowedRoute(key) {
  return auth.canAccessRoute(key);
}

async function renderRoute() {
  let key = currentRoute();
  if (!authReady && key !== "login" && key !== "home") key = "home";
  if (!allowedRoute(key)) {
    navigate(auth.isAuthenticated() ? "home" : "login");
    return;
  }

  const route = routes()[key];
  const view = document.getElementById("view");
  setRouteHeader(route);
  updateActiveNavigation();
  view.setAttribute("aria-busy", "true");
  try {
    view.innerHTML = await loadFragment(`./pages/${route.page}`);
    await hydratePage(key);
    view.focus({ preventScroll: true });
  } catch (error) {
    view.innerHTML = `<section class="card"><h2>Ansicht konnte nicht geladen werden</h2><p>${escapeHtml(error.message)}</p></section>`;
    showToast("Ansicht konnte nicht geladen werden.", "error");
  } finally {
    view.removeAttribute("aria-busy");
  }
}

function showServiceWorkerUpdate(registration) {
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
  dismiss.onclick = () => { banner.hidden = true; storage.set(CONFIG.pwa.updateDismissKey, true); };
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    showToast("Dieser Browser unterstützt keinen Service Worker.", "error");
    return;
  }
  try {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!storage.get(CONFIG.pwa.updateReloadKey, false)) return;
      storage.remove(CONFIG.pwa.updateReloadKey);
      window.location.reload();
    });
    const registration = await navigator.serviceWorker.register(CONFIG.pwa.serviceWorker, { scope: "./", updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    if (registration.waiting) showServiceWorkerUpdate(registration);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showServiceWorkerUpdate(registration);
      });
    });
    registration.update().catch(() => null);
  } catch (error) {
    showToast(`Service Worker: ${error.message}`, "error", 6000);
  }
}

function setupInstallPrompt() {
  const banner = document.getElementById("installBanner");
  const button = document.getElementById("installButton");
  const dismiss = document.getElementById("installDismiss");
  const dismissed = storage.get(CONFIG.pwa.installDismissKey, false);

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (!dismissed && !isStandalone()) banner.hidden = false;
  });

  button.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      showToast("Auf iPhone: Safari → Teilen → Zum Home-Bildschirm.");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    banner.hidden = true;
  });

  dismiss.addEventListener("click", () => {
    banner.hidden = true;
    storage.set(CONFIG.pwa.installDismissKey, true);
  });

  if (isIos() && !isStandalone() && !dismissed) {
    banner.hidden = false;
    button.textContent = "Anleitung";
  }
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

async function refreshApp() {
  try {
    setConnectionStatus("Aktualisiere …", "warning");
    if (auth.isAuthenticated()) await auth.refreshInitialData();
    renderNavigation();
    updateUserChrome();
    await renderRoute();
    setConnectionStatus(auth.isAuthenticated() ? "Sicher verbunden" : "Backend bereit", "success");
  } catch (error) {
    setConnectionStatus("Verbindungsfehler", "warning");
    showToast(error.message || "Aktualisierung fehlgeschlagen.", "error", 6000);
  }
}

async function logout() {
  try {
    setConnectionStatus("Abmeldung …", "warning");
    await auth.logout();
    renderNavigation();
    updateUserChrome();
    navigate("login");
    setConnectionStatus("Backend bereit", "success");
    showToast("Du wurdest abgemeldet.", "success");
  } catch (error) {
    showToast(error.message || "Abmeldung fehlgeschlagen.", "error");
  }
}

async function bootstrap() {
  try {
    await mountComponents();
    bindGlobalUi({ onRefresh: refreshApp, onLogout: logout });
    setupInstallPrompt();
    window.addEventListener("hashchange", renderRoute);
    window.addEventListener("pd-auth-change", () => {
      renderNavigation();
      updateUserChrome();
    });

    setConnectionStatus("Backend wird geprüft", "warning");
    try {
      await auth.initialize();
      authReady = true;
      setConnectionStatus(auth.isAuthenticated() ? "Sicher verbunden" : "Backend bereit", "success");
    } catch (error) {
      authReady = true;
      setConnectionStatus("Backend nicht erreichbar", "warning");
      showToast(error.message || "Backend-Verbindung fehlgeschlagen.", "error", 8000);
    }

    renderNavigation();
    updateUserChrome();

    const initial = currentRoute();
    const notice = auth.current().notice;
    if (notice && notice.message) showToast(notice.message, notice.type || "info", 5200);

    if (!location.hash) navigate(auth.isAuthenticated() ? "home" : "login");
    else if (auth.isAuthenticated() && initial === "login") navigate("home");
    else if (!allowedRoute(initial)) navigate(auth.isAuthenticated() ? "home" : "login");
    else await renderRoute();

    document.getElementById("appShell").hidden = false;
    document.getElementById("appSplash")?.remove();
    registerServiceWorker();
  } catch (error) {
    const splash = document.getElementById("appSplash");
    if (splash) splash.innerHTML = `<strong>Portal konnte nicht gestartet werden</strong><span>${escapeHtml(error.message)}</span>`;
  }
}

window.addEventListener("online", () => setConnectionStatus(auth.isAuthenticated() ? "Sicher verbunden" : "Backend bereit", "success"));
window.addEventListener("offline", () => setConnectionStatus("Offline", "warning"));

bootstrap();
