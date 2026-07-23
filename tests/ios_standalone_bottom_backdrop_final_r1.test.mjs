import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("standalone footer content stays visible at bottom zero", async () => {
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

test("only the standalone footer background extends below the navigation", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /html\[data-portal-area="portal"\] \.mobile-bottom-nav::after\{\s*content:"";\s*position:absolute;\s*z-index:0;\s*top:100%;\s*left:0;\s*right:0;\s*height:var\(--safe-top\);\s*background:#03192e;\s*pointer-events:none;/
  );
});

test("standalone fixed surfaces remain aligned above visible navigation", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /html\[data-portal-area="portal"\] \.user-menu-panel\{\s*bottom:calc\(\s*var\(--mobile-nav-height\)\s*\+ var\(--mobile-safe-bottom\)\s*\+ 8px\s*\)!important;/
  );
  assert.match(
    css,
    /\.toast-region\{\s*bottom:calc\(\s*var\(--mobile-nav-height\)\s*\+ var\(--mobile-safe-bottom\)\s*\+ 14px\s*\)!important;/
  );
  assert.match(
    css,
    /\.install-banner\{\s*bottom:calc\(\s*var\(--mobile-nav-height\)\s*\+ var\(--mobile-safe-bottom\)\s*\+ 10px\s*\)!important;/
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

test("cache busting identifies final standalone bottom backdrop release", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-standalone-bottom-backdrop-final-r1/);
  assert.match(config, /20260723-ios-standalone-bottom-backdrop-final-r1/);
  assert.match(worker, /pd-portal-v4-ios-standalone-bottom-backdrop-final-r1-20260723/);
});
