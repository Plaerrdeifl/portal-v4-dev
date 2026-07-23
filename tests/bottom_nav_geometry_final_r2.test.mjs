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

test("standalone PWA uses the measured iPhone bottom safe area", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /@media\(display-mode:standalone\) and \(max-width:860px\)\{\s*:root\{\s*--mobile-safe-bottom:var\(--safe-bottom\);\s*\}/
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

test("standalone footer stays at bottom zero without unreachable extensions", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /html\[data-portal-area="portal"\] \.mobile-bottom-nav\{[\s\S]*bottom:0!important;[\s\S]*overflow:visible!important;/
  );

  assert.doesNotMatch(
    css,
    /html\[data-portal-area="portal"\] \.mobile-bottom-nav::after/
  );

  assert.doesNotMatch(
    css,
    /bottom:calc\(0px - var\(--safe-top\)\)!important;/
  );
});

test("iOS uses an opaque status bar while preserving viewport-fit", async () => {
  const index = await read("index.html");

  assert.match(
    index,
    /apple-mobile-web-app-status-bar-style" content="black"/
  );

  assert.doesNotMatch(
    index,
    /apple-mobile-web-app-status-bar-style" content="black-translucent"/
  );

  assert.match(
    index,
    /content="width=device-width, initial-scale=1, viewport-fit=cover"/
  );
});

test("cache busting identifies opaque iOS status-bar geometry", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-opaque-statusbar-bottomnav-final-r1/);
  assert.match(config, /20260723-ios-opaque-statusbar-bottomnav-final-r1/);
  assert.match(
    worker,
    /pd-portal-v4-task-history-r1-30min-20260723/
  );
});
