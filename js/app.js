import { CONFIG } from "./config.js";
import { currentRoute, routes } from "./router.js";
import { apiStatus } from "./api.js";
import { storage } from "./storage.js";
import {
  applyLegacyLinks,
  bindGlobalUi,
  loadFragment,
  mountComponents,
  renderNavigation,
  setConnectionStatus,
  setRouteHeader,
  showToast,
  updateActiveNavigation
} from "./ui.js";

let deferredInstallPrompt = null;

async function renderRoute() {
  const key = currentRoute();
  const route = routes()[key];
  const view = document.getElementById("view");
  setRouteHeader(route);
  updateActiveNavigation();
  view.setAttribute("aria-busy", "true");
  try {
    view.innerHTML = await loadFragment(`./pages/${route.page}`);
    applyLegacyLinks();
    view.focus({ preventScroll: true });
  } catch (error) {
    view.innerHTML = `<section class="card"><h2>Ansicht konnte nicht geladen werden</h2><p>${escapeHtml(error.message)}</p></section>`;
    showToast("Ansicht konnte nicht geladen werden.", "error");
  } finally {
    view.removeAttribute("aria-busy");
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    setConnectionStatus("PWA nicht unterstützt", "warning");
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register(CONFIG.pwa.serviceWorker, { scope: "./" });
    await navigator.serviceWorker.ready;
    setConnectionStatus("PWA bereit", "success");
    registration.update().catch(() => null);
  } catch (error) {
    setConnectionStatus("PWA-Fehler", "warning");
    showToast(`Service Worker: ${error.message}`, "error", 5000);
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
function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

async function bootstrap() {
  try {
    await mountComponents();
    renderNavigation();
    bindGlobalUi();
    setupInstallPrompt();
    window.addEventListener("hashchange", renderRoute);
    if (!location.hash) history.replaceState(null, "", "#/home");
    await renderRoute();
    document.getElementById("appShell").hidden = false;
    document.getElementById("appSplash").remove();
    document.documentElement.dataset.api = apiStatus().enabled ? "enabled" : "disabled";
    registerServiceWorker();
  } catch (error) {
    const splash = document.getElementById("appSplash");
    if (splash) splash.innerHTML = `<strong>Portal konnte nicht gestartet werden</strong><span>${escapeHtml(error.message)}</span>`;
  }
}

bootstrap();
