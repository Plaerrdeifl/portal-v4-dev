import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("PWA bottom navigation uses a deterministic 34 pixel inset", async () => {
  const [tokens, css] = await Promise.all([
    read("css/tokens.css"),
    read("css/app.css")
  ]);

  assert.match(tokens, /--mobile-safe-bottom:34px/);
  assert.doesNotMatch(
    tokens,
    /--mobile-safe-bottom:[^;]*(?:env|clamp|min|max)\(/
  );

  assert.match(
    css,
    /height:calc\(var\(--mobile-nav-height\) \+ var\(--mobile-safe-bottom\)\)/
  );
  assert.match(
    css,
    /padding:\s*4px\s*max\(8px,var\(--safe-right\)\)\s*var\(--mobile-safe-bottom\)/
  );
});

test("all navigation-dependent spacing still uses one shared token", async () => {
  const css = await read("css/app.css");

  const matches = css.match(/var\(--mobile-safe-bottom\)/g) || [];
  assert.ok(matches.length >= 10);

  assert.doesNotMatch(
    css,
    /var\(--mobile-nav-height\) \+ var\(--safe-bottom\)/
  );
});

test("cache busting identifies the final PWA bottom navigation release", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-standalone-viewport-final-r1/);
  assert.match(config, /20260723-ios-standalone-viewport-final-r1/);
  assert.match(worker, /pd-portal-v4-ios-standalone-viewport-final-r1-20260723/);
});
