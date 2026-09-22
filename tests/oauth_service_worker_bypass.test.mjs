import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const serviceWorkerUrl = new URL("../service-worker.js", import.meta.url);

test("same-origin OAuth routes bypass the Portal service worker", async () => {
  const source = await readFile(serviceWorkerUrl, "utf8");

  const oauthGuard = source.indexOf(
    'url.origin === self.location.origin'
  );
  const oauthPath = source.indexOf(
    'url.pathname.startsWith("/oauth/")'
  );
  const navigationHandler = source.indexOf(
    'if (request.mode === "navigate")'
  );

  assert.notEqual(oauthGuard, -1);
  assert.notEqual(oauthPath, -1);
  assert.notEqual(navigationHandler, -1);
  assert.ok(
    oauthGuard < navigationHandler && oauthPath < navigationHandler,
    "OAuth bypass must run before the navigation handler",
  );

  assert.match(
    source,
    /url\.origin === self\.location\.origin[\s\S]*url\.pathname\.startsWith\("\/oauth\/"\)[\s\S]*\{\s*return;\s*\}/,
  );
});
