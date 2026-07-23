import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("standalone diagnostic measures viewport safe areas and navigation", async () => {
  const source = await read("js/standalone-geometry-diagnostic.js");

  for (const contract of [
    "visualViewport",
    "safe-area-inset-top",
    "safe-area-inset-bottom",
    "getBoundingClientRect",
    "gapToInnerBottom",
    "gapToVisualBottom",
    "devicePixelRatio",
    "screen.height",
    "GEOMETRIE-DIAGNOSE"
  ]) {
    assert.match(source, new RegExp(
      contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    ));
  }
});

test("diagnostic is limited to standalone display mode", async () => {
  const source = await read("js/standalone-geometry-diagnostic.js");

  assert.match(
    source,
    /matchMedia\("\(display-mode: standalone\)"\)/
  );
  assert.match(source, /navigator\.standalone/);
});

test("diagnostic release is loaded and cache-busted", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(
    index,
    /standalone-geometry-diagnostic\.js\?v=20260723-ios-standalone-geometry-diagnostic-r1/
  );
  assert.match(
    index,
    /20260723-ios-standalone-geometry-diagnostic-r1/
  );
  assert.match(
    config,
    /20260723-ios-standalone-geometry-diagnostic-r1/
  );
  assert.match(
    worker,
    /pd-portal-v4-ios-standalone-geometry-diagnostic-r1-20260723/
  );
});
