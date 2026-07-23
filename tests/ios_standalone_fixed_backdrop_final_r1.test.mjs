import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("standalone controls remain visible at bottom zero", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /html\[data-portal-area="portal"\] \.mobile-bottom-nav\{\s*bottom:0!important;[\s\S]*?overflow:visible!important;/
  );

  assert.doesNotMatch(
    css,
    /bottom:calc\(0px - var\(--safe-top\)\)!important;/
  );
});

test("standalone backdrop is fixed outside overflow-hidden app containers", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /html\[data-portal-area="portal"\] \.mobile-bottom-nav::after\{\s*content:"";\s*position:fixed;\s*z-index:0;\s*top:100%;\s*left:0;\s*right:0;\s*height:var\(--safe-top\);\s*background:#03192e;\s*pointer-events:none;/
  );

  assert.doesNotMatch(
    css,
    /\.mobile-bottom-nav::after\{[\s\S]*?position:absolute;/
  );
});

test("standalone viewport containers remain intentionally clipped", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /html\[data-portal-area="portal"\]:not\(\[data-route="profile"\]\)\{[\s\S]*?height:100dvh;[\s\S]*?overflow:hidden!important;/
  );

  assert.match(
    css,
    /html\[data-portal-area="portal"\]:not\(\[data-route="profile"\]\) body\{[\s\S]*?height:100dvh;[\s\S]*?overflow:hidden!important;/
  );
});

test("footer and button geometry remain unchanged", async () => {
  const [tokens, css] = await Promise.all([
    read("css/tokens.css"),
    read("css/app.css")
  ]);

  assert.match(tokens, /--mobile-nav-height:64px/);
  assert.match(tokens, /--mobile-safe-bottom:0px/);
  assert.match(css, /--mobile-safe-bottom:10px/);
  assert.match(css, /min-height:56px;\s*height:56px;/);
});

test("cache identifies the fixed standalone backdrop release", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-standalone-geometry-diagnostic-r1/);
  assert.match(config, /20260723-ios-standalone-geometry-diagnostic-r1/);
  assert.match(
    worker,
    /pd-portal-v4-ios-standalone-geometry-diagnostic-r1-20260723/
  );
});
