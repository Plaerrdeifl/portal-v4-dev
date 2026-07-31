import { CONFIG } from "./config.js?v=20260724-dashboard-delivery-corr2";

let initialized = false;
let deferredPrompt = null;
let registration = null;
let reloadAfterExplicitUpdate = false;

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function announceWaitingUpdate() {
  if (!registration?.waiting || !navigator.serviceWorker.controller) {
    return false;
  }

  window.dispatchEvent(
    new CustomEvent("pd-update-available", { detail: registration })
  );

  return true;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;

  registration = await navigator.serviceWorker.register(
    CONFIG.pwa.serviceWorker,
    { scope: "./" }
  );

  announceWaitingUpdate();

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;

    worker?.addEventListener("statechange", () => {
      if (
        worker.state === "installed"
        && navigator.serviceWorker.controller
      ) {
        announceWaitingUpdate();
      }
    });
  });

  await registration.update();
  announceWaitingUpdate();

  return registration;
}

export function initializeInstall() {
  if (initialized) return;
  initialized = true;

  navigator.serviceWorker?.addEventListener(
    "controllerchange",
    () => {
      if (!reloadAfterExplicitUpdate) return;

      reloadAfterExplicitUpdate = false;
      location.reload();
    }
  );

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    window.dispatchEvent(new CustomEvent("pd-install-state-change"));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("pd-install-state-change"));
  });

  registerServiceWorker().catch(error =>
    console.warn("Service Worker konnte nicht registriert werden", error)
  );
}

export function installState() {
  return {
    standalone: isStandalone(),
    ios: isIos(),
    promptAvailable: Boolean(deferredPrompt)
  };
}

export async function requestInstall() {
  if (isStandalone()) {
    return { installed: true, outcome: "already-installed" };
  }

  if (!deferredPrompt) {
    return { installed: false, outcome: "instructions" };
  }

  const prompt = deferredPrompt;
  deferredPrompt = null;

  await prompt.prompt();

  const choice = await prompt.userChoice;

  window.dispatchEvent(new CustomEvent("pd-install-state-change"));

  return {
    installed: choice?.outcome === "accepted",
    outcome: choice?.outcome || "dismissed"
  };
}

export async function activateUpdate() {
  if (!registration) return false;

  if (!registration.waiting) {
    await registration.update();
  }

  if (!registration.waiting) return false;

  reloadAfterExplicitUpdate = true;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
  return true;
}

const __V4_DASHBOARD_DELIVERY_CORR2__ = true;
