import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("iOS standalone keeps viewport-fit with an opaque status bar", async () => {
  const index = await read("index.html");

  assert.match(
    index,
    /<meta name="apple-mobile-web-app-status-bar-style" content="black">/
  );

  assert.doesNotMatch(index, /black-translucent/);

  assert.match(
    index,
    /<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">/
  );
});

test("bottom navigation keeps browser geometry and standalone safe-bottom padding", async () => {
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
    /@media\(display-mode:standalone\) and \(max-width:860px\)\{\s*:root\{\s*--mobile-safe-bottom:var\(--safe-bottom\);/
  );

  assert.doesNotMatch(
    css,
    /\.mobile-bottom-nav::after/
  );

  assert.doesNotMatch(
    css,
    /translateY\(var\(--safe-top\)\)/
  );
});

test("cache busting identifies the opaque iOS standalone viewport release", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-opaque-statusbar-bottomnav-final-r1/);
  assert.match(config, /20260723-ios-opaque-statusbar-bottomnav-final-r1/);
  assert.match(
    worker,
    /pd-portal-v4-task-workflow-r2-core-20260723/
  );
});
