import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, install] = await Promise.all([
  readFile(new URL("../js/app.js", import.meta.url), "utf8"),
  readFile(new URL("../js/install.js", import.meta.url), "utf8")
]);

test("service-worker changes do not automatically reload login", () => {
  assert.doesNotMatch(
    app,
    /serviceWorkerControllerSeen|serviceWorkerReloadRequested/
  );

  assert.doesNotMatch(
    app,
    /serviceWorker\?\.addEventListener\(\s*"controllerchange"/
  );

  assert.match(
    install,
    /if \(!reloadAfterExplicitUpdate\) return;/
  );
});

test("reload occurs only after explicit update activation", () => {
  assert.match(
    install,
    /let reloadAfterExplicitUpdate = false/
  );

  assert.match(
    install,
    /reloadAfterExplicitUpdate = true;\s*registration\.waiting\.postMessage/
  );

  assert.match(
    install,
    /if \(!reloadAfterExplicitUpdate\) return;\s*reloadAfterExplicitUpdate = false;\s*location\.reload\(\)/
  );
});
