let initialized = false;
let deferredPrompt = null;

export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
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
