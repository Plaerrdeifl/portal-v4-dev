import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("iOS standalone keeps viewport-fit with the restored translucent status bar", async () => {
  const index = await read("index.html");

  assert.match(
    index,
    /<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">/
  );
  assert.match(
    index,
    /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/
  );
});

test("bottom navigation keeps one canonical geometry without counter-offset", async () => {
  const [tokens, css] = await Promise.all([
    read("css/tokens.css"),
    read("css/app.css")
  ]);

  assert.match(tokens, /--mobile-nav-height:64px/);
  assert.match(tokens, /--mobile-safe-bottom:0px/);

  assert.match(
    css,
    /\.mobile-bottom-nav\{[\s\S]*bottom:0;[\s\S]*height:calc\(var\(--mobile-nav-height\) \+ var\(--mobile-safe-bottom\)\)/
  );
  assert.match(
    css,
    /html\[data-portal-area="portal"\] \.mobile-bottom-nav\{[\s\S]*bottom:0!important/
  );

  assert.doesNotMatch(
    css,
    /\.mobile-bottom-nav\{[\s\S]*bottom:calc\(-/
  );
  assert.doesNotMatch(
    css,
    /translateY\(var\(--safe-top\)\)/
  );
});

test("cache busting identifies the final iOS standalone viewport release", async () => {
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
