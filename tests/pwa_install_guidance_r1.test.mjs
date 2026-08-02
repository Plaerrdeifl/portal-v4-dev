import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  installPage,
  pages,
  install,
  index,
  config,
  app,
  worker,
  foundation
] = await Promise.all([
  readFile(new URL("../pages/install.html", import.meta.url), "utf8"),
  readFile(new URL("../js/pages.js", import.meta.url), "utf8"),
  readFile(new URL("../js/install.js", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../js/config.js", import.meta.url), "utf8"),
  readFile(new URL("../js/app.js", import.meta.url), "utf8"),
  readFile(new URL("../service-worker.js", import.meta.url), "utf8"),
  readFile(
    new URL("../scripts/check-frontend-foundation.mjs", import.meta.url),
    "utf8"
  )
]);

test("PWA installation uses Android and iOS guidance without an install button", () => {
  assert.doesNotMatch(
    installPage,
    /pageInstallButton|Portal installieren|<button/i
  );

  assert.match(installPage, /Android mit Chrome/);
  assert.match(installPage, /App installieren/);
  assert.match(installPage, /Zum Startbildschirm hinzufügen/);
  assert.match(installPage, /iPhone oder iPad mit Safari/);
  assert.match(installPage, /Zum Home-Bildschirm/);
  assert.match(installPage, /Als Web-App öffnen/);

  assert.doesNotMatch(
    pages,
    /requestInstall|pageInstallButton/
  );

  assert.doesNotMatch(
    pages,
    /import\s*\{\s*installState/
  );

  assert.match(
    pages,
    /instructions\.hidden = standalone/
  );

  assert.match(
    pages,
    /display-mode: standalone/
  );

  assert.doesNotMatch(
    install,
    /beforeinstallprompt|appinstalled|deferredPrompt|requestInstall/
  );

  assert.match(install, /registerServiceWorker/);
  assert.match(install, /activateUpdate/);
  assert.match(install, /__V4_DASHBOARD_DELIVERY_CORR2__/);
  assert.match(install, /__V4_PWA_INSTALL_GUIDANCE_R1__/);
});

test("PWA guidance release is consistent across runtime and checks", () => {
  const release = "20260802-pwa-install-guidance-r1";
  const cache = "pd-portal-v4-pwa-install-guidance-r1-20260802";

  assert.match(index, new RegExp(release));
  assert.match(config, new RegExp(release));
  assert.match(app, new RegExp(release));
  assert.match(worker, new RegExp(cache));
  assert.match(foundation, /Android mit Chrome/);

  assert.match(
    index,
    /src="\.\/js\/app\.js\?v=20260802-pwa-install-guidance-r1"/
  );

  assert.doesNotMatch(
    index,
    /<script[^>]+src="\.\/app\.js/i
  );
});