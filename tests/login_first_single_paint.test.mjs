import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(
  new URL("../js/app.js", import.meta.url),
  "utf8"
);

test("first service-worker claim does not visibly reload login", () => {
  assert.match(
    app,
    /let serviceWorkerControllerSeen\s*=\s*Boolean\(navigator\.serviceWorker\?\.controller\)/
  );

  assert.match(
    app,
    /if \(!serviceWorkerControllerSeen\) \{\s*serviceWorkerControllerSeen = true;\s*return;\s*\}/
  );

  assert.doesNotMatch(
    app,
    /"controllerchange",\s*\(\) => location\.reload\(\)/
  );
});

test("later service-worker replacements still reload once", () => {
  assert.match(
    app,
    /let serviceWorkerReloadRequested = false/
  );

  assert.match(
    app,
    /if \(serviceWorkerReloadRequested\) \{\s*return;\s*\}/
  );

  assert.match(
    app,
    /serviceWorkerReloadRequested = true;\s*location\.reload\(\)/
  );
});
