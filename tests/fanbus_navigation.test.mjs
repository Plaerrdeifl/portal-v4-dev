import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("Portal navigation exposes the standalone Fanbus app without replacing legacy functions", async () => {
  const [router, auth, app] = await Promise.all([
    read("js/router.js"),
    read("js/auth.js"),
    read("js/app.js")
  ]);

  assert.match(
    router,
    /"fanbus-app":\s*\{[\s\S]*?title:\s*"Fanbus-App"[\s\S]*?externalPath:\s*"\/fanbus\/"/
  );
  assert.match(router, /"liveticker",\s*"fanbus-app",\s*"fanbuses",/);
  assert.match(auth, /\["dashboard",\s*"dates",\s*"fanbus-app"\]\.includes\(key\)/);
  assert.match(app, /window\.location\.assign\(target\.pathname \+ target\.search \+ target\.hash\)/);

  assert.match(
    router,
    /fanbuses:\s*\{[\s\S]*?title:\s*"Fanbus-Verwaltung"[\s\S]*?page:\s*"fanbuses\.html"/
  );
  assert.match(router, /fanbus:\s*\{\s*target:\s*"fanbuses"/);
});
