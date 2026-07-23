import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("browser and standalone keep visible footer controls at bottom zero", async () => {
  const css = await read("css/app.css");

  assert.match(
    css,
    /@media\(max-width:860px\)\{[\s\S]*?\.mobile-bottom-nav\{[\s\S]*?bottom:0;/
  );

  assert.match(
    css,
    /@media\(display-mode:standalone\) and \(max-width:860px\)\{[\s\S]*?html\[data-portal-area="portal"\] \.mobile-bottom-nav\{\s*bottom:0!important;/
  );

  assert.doesNotMatch(css, /\.mobile-bottom-nav::after/);
});

test("standalone fixed surfaces stay above the visible footer", async () => {
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

  assert.doesNotMatch(
    css,
    /bottom:calc\(0px - var\(--safe-top\)\)!important;/
  );
});

test("standalone footer uses measured safe-bottom geometry", async () => {
  const [tokens, css] = await Promise.all([
    read("css/tokens.css"),
    read("css/app.css")
  ]);

  assert.match(tokens, /--mobile-nav-height:64px/);
  assert.match(tokens, /--mobile-safe-bottom:0px/);
  assert.match(css, /--mobile-safe-bottom:var\(--safe-bottom\)/);
  assert.match(css, /min-height:56px;\s*height:56px;/);
  assert.match(
    css,
    /height:calc\(var\(--mobile-nav-height\) \+ var\(--mobile-safe-bottom\)\)/
  );
});

test("cache busting identifies final opaque iOS bottom alignment", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-opaque-statusbar-bottomnav-final-r1/);
  assert.match(config, /20260723-ios-opaque-statusbar-bottomnav-final-r1/);
  assert.match(
    worker,
    /pd-portal-v4-web-push-r1-20260723/
  );
});
