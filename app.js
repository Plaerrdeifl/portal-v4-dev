let deferredInstallPrompt = null;

const installButton = document.getElementById('installButton');
const installStatus = document.getElementById('installStatus');

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function setStatus(text) {
  if (installStatus) installStatus.textContent = text;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
      setStatus(isStandalone() ? 'Als App gestartet.' : 'PWA bereit. Installation kann getestet werden.');
    } catch (error) {
      console.error('Service Worker konnte nicht registriert werden:', error);
      setStatus('PWA-Grundlage geladen, Service Worker noch nicht aktiv.');
    }
  });
} else {
  setStatus('Dieser Browser unterstützt keine Service Worker.');
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installButton) installButton.hidden = false;
  setStatus('Portal kann installiert werden.');
});

installButton?.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  setStatus('Portal wurde installiert.');
  if (installButton) installButton.hidden = true;
});
