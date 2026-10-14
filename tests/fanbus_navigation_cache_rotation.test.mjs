import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(path, import.meta.url), "utf8");

const [worker, install, router, auth, ui] = await Promise.all([
  read("../service-worker.js"),
  read("../js/install.js"),
  read("../js/router.js"),
  read("../js/auth.js"),
  read("../js/ui.js")
]);

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `${startMarker} konnte nicht isoliert werden`);
  return source.slice(start, end);
}

test("Fanbus navigation rotates the Portal shell containing all changed navigation modules", () => {
  assert.match(
    worker,
    /const STARTUP_PERFORMANCE_CACHE_VERSION = "pd-portal-v4-fanbus-navigation-r1-20261014";/
  );
  assert.doesNotMatch(worker, /pd-portal-v4-fanbus-scope-exclusion-r1-20261014-shell/);

  const shell = sourceBlock(worker, "const SHELL = [", "];\n\nself.addEventListener(\"install\"");
  for (const asset of ["./js/router.js", "./js/auth.js", "./js/ui.js", "./js/app.js"]) {
    assert.match(shell, new RegExp(asset.replaceAll(".", "\\.")));
  }

  assert.match(router, /title:\s*"Fanbus-App"/);
  assert.match(router, /title:\s*"Fanbus-Verwaltung"/);
  assert.match(auth, /"fanbus-app"/);
  assert.match(ui, /"fanbus-app"/);
});

test("cache rotation installs and activates naturally without forced reload or skipWaiting", () => {
  const installHandler = sourceBlock(
    worker,
    'self.addEventListener("install", event => {',
    'self.addEventListener("activate", event => {'
  );
  const activateHandler = sourceBlock(
    worker,
    'self.addEventListener("activate", event => {',
    'self.addEventListener("message", event => {'
  );

  assert.match(installHandler, /caches\.open\(APP_CACHE\)\.then\(cache => cache\.addAll\(SHELL\)\)/);
  assert.doesNotMatch(installHandler, /skipWaiting/);
  assert.match(activateHandler, /key\.startsWith\("pd-portal-"\) && key !== APP_CACHE/);
  assert.match(activateHandler, /self\.clients\.claim\(\)/);
  assert.doesNotMatch(activateHandler, /skipWaiting|location\.reload/);

  assert.match(install, /reloadAfterExplicitUpdate = true;\s*registration\.waiting\.postMessage/);
  assert.match(install, /if \(!reloadAfterExplicitUpdate\) return;\s*reloadAfterExplicitUpdate = false;\s*location\.reload\(\)/);
});

test("navigation cache rotation retains Fanbus and OAuth worker boundaries", () => {
  const fanbusGuard = worker.indexOf('url.pathname === "/fanbus"');
  const oauthGuard = worker.indexOf('url.pathname.startsWith("/oauth/")');
  const navigationHandler = worker.indexOf('if (request.mode === "navigate")');

  assert.ok(fanbusGuard >= 0 && fanbusGuard < oauthGuard);
  assert.ok(oauthGuard >= 0 && oauthGuard < navigationHandler);
  assert.match(worker, /url\.pathname\.startsWith\("\/fanbus\/"\)/);
  assert.match(worker, /self\.addEventListener\("push"/);
  assert.match(worker, /self\.addEventListener\("notificationclick"/);
});
