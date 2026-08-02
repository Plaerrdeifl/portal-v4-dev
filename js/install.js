import { CONFIG } from "./config.js?v=20260724-dashboard-delivery-corr2";

let initialized = false;
let registration = null;
let reloadAfterExplicitUpdate = false;

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
  if (!("serviceWorker" in navigator) || !window.isSecureContext) {
    return null;
  }

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

  registerServiceWorker().catch(error =>
    console.warn("Service Worker konnte nicht registriert werden", error)
  );
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
const __V4_PWA_INSTALL_GUIDANCE_R1__ = true;