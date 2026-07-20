import { CONFIG } from "./config.js";

let initialized = false;
let deferredPrompt = null;
let registration = null;

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;
  registration = await navigator.serviceWorker.register(CONFIG.pwa.serviceWorker, { scope: "./" });
  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    worker?.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        window.dispatchEvent(new CustomEvent("pd-update-available", { detail: registration }));
      }
    });
  });
  return registration;
}

export function initializeInstall() {
  if (initialized) return;
  initialized = true;
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    window.dispatchEvent(new CustomEvent("pd-install-state-change"));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("pd-install-state-change"));
  });
  registerServiceWorker().catch(error => console.warn("Service Worker konnte nicht registriert werden", error));
}

export function installState() {
  return {
    standalone: isStandalone(),
    ios: isIos(),
    promptAvailable: Boolean(deferredPrompt)
  };
}

export async function requestInstall() {
  if (isStandalone()) return { installed: true, outcome: "already-installed" };
  if (!deferredPrompt) return { installed: false, outcome: "instructions" };
  const prompt = deferredPrompt;
  deferredPrompt = null;
  await prompt.prompt();
  const choice = await prompt.userChoice;
  window.dispatchEvent(new CustomEvent("pd-install-state-change"));
  return { installed: choice?.outcome === "accepted", outcome: choice?.outcome || "dismissed" };
}

export function activateUpdate() {
  registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
}
