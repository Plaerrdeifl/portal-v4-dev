import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath =>
  fs.readFile(path.join(root, relativePath), "utf8");

test("public home has no duplicated login or about buttons", async () => {
  const [home, index] = await Promise.all([
    read("pages/home.html"),
    read("index.html")
  ]);

  for (const source of [home, index]) {
    assert.equal(source.includes("public-home-actions"), false);
    assert.equal(source.includes("Anmelden oder ins Portal"), false);
    assert.equal(source.includes("Mehr über uns"), false);
  }
});

test("login is centered and contains only the primary login content", async () => {
  const [login, css] = await Promise.all([
    read("pages/login.html"),
    read("css/app.css")
  ]);

  assert.equal(login.includes("Mitgliederbereich"), false);
  assert.equal(login.includes("public-login-help-card"), false);
  assert.equal(login.includes("So funktioniert die Anmeldung"), false);
  assert.equal(login.includes("loginRetryButton"), false);
  assert.equal(login.includes('data-route="home"'), false);
  assert.equal(login.includes("public-login-inline"), true);
  assert.equal(login.includes("public-login-main"), true);

  assert.equal(
    css.includes("Öffentliche Anmeldung: kompakt, mittig und ohne Nebenkarte"),
    true
  );
  assert.equal(css.includes("align-content:center"), true);
  assert.equal(css.includes("text-align:center"), true);
});

test("Google OAuth uses a desktop popup and callback never renders home first", async () => {
  const [auth, app, pages, guard, index, worker] = await Promise.all([
    read("js/auth.js"),
    read("js/app.js"),
    read("js/pages.js"),
    read("js/oauth-return-guard.js"),
    read("index.html"),
    read("service-worker.js")
  ]);

  assert.equal(auth.includes("skipBrowserRedirect: true"), true);
  assert.equal(auth.includes('window.open('), true);
  assert.equal(auth.includes('width=${geometry.width}'), true);
  assert.equal(auth.includes('height=${geometry.height}'), true);
  assert.equal(auth.includes("async syncSession()"), true);

  assert.equal(app.includes("async function prepareOAuthReturn()"), true);
  assert.equal(app.includes("await prepareOAuthReturn()"), true);
  assert.equal(app.includes("bindOAuthPopupCompletion();"), true);
  assert.equal(app.includes("cleanOAuthLocation(oauthTarget(current))"), true);
  assert.equal(app.includes("BroadcastChannel"), true);

  assert.equal(pages.includes("result?.mode === \"popup\""), true);
  assert.equal(guard.includes('dataset.oauthReturn = "true"'), true);
  assert.equal(index.includes("./js/oauth-return-guard.js"), true);
  assert.equal(worker.includes("./js/oauth-return-guard.js"), true);
});

test("desktop Google button is compact and popup is centered over the browser", async () => {
  const [auth, css, index, config, worker] = await Promise.all([
    read("js/auth.js"),
    read("css/app.css"),
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.equal(auth.includes("const width = Math.min(440, availableWidth)"), true);
  assert.equal(auth.includes("const height = Math.min(600, availableHeight)"), true);
  assert.equal(auth.includes("window.screenLeft"), true);
  assert.equal(auth.includes("window.screenTop"), true);
  assert.equal(
    auth.includes("popup.resizeTo(geometry.width, geometry.height)"),
    true
  );
  assert.equal(
    auth.includes("popup.moveTo(geometry.left, geometry.top)"),
    true
  );
  assert.equal(
    auth.includes("oauthPopupFeatures(popupGeometry)"),
    true
  );
  assert.equal(
    auth.includes("positionOAuthPopup(popup, popupGeometry)"),
    true
  );

  assert.equal(css.includes("width:min(320px,100%)"), true);
  assert.equal(css.includes("justify-content:center"), true);
  assert.equal(css.includes("background:rgba(3,25,46,.18)"), true);
  assert.equal(css.includes("backdrop-filter:blur(1px)"), true);

  assert.equal(index.includes("20260721-login-popup-2"), true);
  assert.equal(config.includes("20260721-login-popup-2"), true);
  assert.equal(
    worker.includes("pd-portal-v4-login-popup-20260721-2"),
    true
  );
});
