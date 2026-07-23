import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("browser navigation has no artificial bottom inset", async () => {
  const tokens = await read("css/tokens.css");

  assert.match(tokens, /--mobile-nav-height:64px/);
  assert.match(tokens, /--mobile-safe-bottom:0px/);
  assert.doesNotMatch(tokens, /--mobile-safe-bottom:34px/);
});

test("standalone PWA adds only ten pixels below the buttons", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /@media\(display-mode:standalone\) and \(max-width:860px\)\{\s*:root\{\s*--mobile-safe-bottom:10px;\s*\}/
  );

  assert.match(
    css,
    /\.mobile-bottom-nav\{[\s\S]*height:calc\(var\(--mobile-nav-height\) \+ var\(--mobile-safe-bottom\)\)/
  );

  assert.match(
    css,
    /\.mobile-bottom-nav\{[\s\S]*padding:\s*4px\s*max\(8px,var\(--safe-right\)\)\s*var\(--mobile-safe-bottom\)/
  );
});

test("no competing footer geometry or visual counter-offset remains", async () => {
  const css = await read("css/app.css");

  assert.doesNotMatch(css, /--mobile-safe-bottom:34px/);
  assert.doesNotMatch(css, /bottom:calc\(-/);
  assert.doesNotMatch(css, /translateY\(var\(--safe-top\)\)/);

  const standaloneAssignments =
    css.match(/--mobile-safe-bottom:10px/g) || [];
  assert.equal(standaloneAssignments.length, 1);
});

test("iOS status-bar experiment is reverted without changing viewport-fit", async () => {
  const index = await read("index.html");

  assert.match(
    index,
    /apple-mobile-web-app-status-bar-style" content="black-translucent"/
  );
  assert.match(
    index,
    /content="width=device-width, initial-scale=1, viewport-fit=cover"/
  );
});

test("cache busting identifies final bottom-navigation geometry R2", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-bottom-nav-geometry-final-r2/);
  assert.match(config, /20260723-bottom-nav-geometry-final-r2/);
  assert.match(
    worker,
    /pd-portal-v4-bottom-nav-geometry-final-r2-20260723/
  );
});
