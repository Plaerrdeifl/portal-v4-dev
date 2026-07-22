import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("frontend foundation is canonical and keeps the mobile bottom navigation", async () => {
  const [html, appCss, ui, login, worker] = await Promise.all([
    read("index.html"),
    read("css/app.css"),
    read("js/ui.js"),
    read("pages/login.html"),
    read("service-worker.js")
  ]);

  const links = [
    ...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g)
  ].map(match => match[1].split("?")[0]);

  assert.deepEqual(
    links,
    ["./css/tokens.css", "./css/app.css"]
  );

  assert.equal(appCss.includes('data-route="login"'), false);
  assert.equal(appCss.includes("mobile-more-"), false);
  assert.equal(appCss.includes(".mobile-bottom-nav"), true);
  assert.equal(appCss.includes(".mobile-nav-button"), true);
  assert.equal(appCss.includes("var(--mobile-nav-height)"), true);

  assert.equal(html.includes('id="mobileNav"'), true);
  assert.equal(html.includes('id="mobileMorePanel"'), false);
  assert.equal(html.includes('id="authTransitionOverlay"'), false);

  assert.equal(ui.includes("MOBILE_PRIMARY"), true);
  assert.equal(ui.includes('more.id = "mobileMoreToggle"'), true);
  assert.equal(ui.includes('event.target.closest("#mobileMoreToggle")'), true);
  assert.equal(ui.includes("toggleMobileMenu();"), true);
  assert.equal(ui.includes("openMobileMore"), false);
  assert.equal(ui.includes("closeMobileMore"), false);

  assert.equal(login.includes("public-login-inline"), true);
  assert.equal(login.includes("auth-page"), false);

  assert.equal(worker.includes("css/app.css"), true);
  assert.equal(worker.includes("m4-corr"), false);
  assert.equal(worker.includes("uiux-p"), false);
});
