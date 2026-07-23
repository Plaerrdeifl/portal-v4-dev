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

test("login is compact, centered and visually self-contained", async () => {
  const [login, css] = await Promise.all([
    read("pages/login.html"),
    read("css/app.css")
  ]);

  assert.equal(login.includes("Mitgliederbereich"), false);
  assert.equal(login.includes("public-login-help-card"), false);
  assert.equal(login.includes("public-login-summary"), true);
  assert.equal(login.includes("googleSignInStatus"), true);
  assert.equal(login.includes("Sicher anmelden"), true);

  assert.equal(
    css.includes("Öffentliche Anmeldung über Google Identity Services"),
    true
  );
  assert.equal(css.includes("width:min(580px,100%)"), true);
  assert.equal(css.includes("width:min(660px,100%)"), true);
  assert.equal(css.includes("linear-gradient(90deg,#1689ff,#65b8ff)"), true);
  assert.equal(css.includes("oauth-popup-open"), false);
  assert.equal(css.includes('data-oauth-return="true"'), false);
});

test("official Google Identity Services replaces the manual OAuth window", async () => {
  const [
    auth,
    app,
    pages,
    googleSignIn,
    config,
    index,
    worker,
    runtimeWriter
  ] = await Promise.all([
    read("js/auth.js"),
    read("js/app.js"),
    read("js/pages.js"),
    read("js/google-signin.js"),
    read("js/config.js"),
    read("index.html"),
    read("service-worker.js"),
    read("scripts/write-runtime-config.mjs")
  ]);

  assert.equal(auth.includes("signInWithIdToken"), true);
  assert.equal(auth.includes("signInWithOAuth"), false);
  assert.equal(auth.includes("window.open("), false);
  assert.equal(auth.includes("signInWithGoogleIdToken"), true);
  assert.equal(auth.includes("credentials.nonce = rawNonce"), true);

  assert.equal(
    googleSignIn.includes("https://accounts.google.com/gsi/client?hl=de"),
    true
  );
  assert.equal(googleSignIn.includes("google.accounts.id"), false);
  assert.equal(googleSignIn.includes("window.google?.accounts?.id"), true);
  assert.equal(googleSignIn.includes('ux_mode: "popup"'), true);
  assert.equal(googleSignIn.includes('theme: "filled_blue"'), true);
  assert.equal(googleSignIn.includes('shape: "pill"'), true);
  assert.equal(googleSignIn.includes('size: "medium"'), true);
  assert.equal(googleSignIn.includes("width: 320"), false);
  assert.equal(googleSignIn.includes("BUTTON_HORIZONTAL_INSET"), true);
  assert.equal(googleSignIn.includes("await afterLayout()"), true);
  assert.equal(googleSignIn.includes("ResizeObserver"), true);
  assert.equal(googleSignIn.includes("use_fedcm_for_button: true"), true);
  assert.equal(googleSignIn.includes("button_auto_select: false"), true);
  assert.equal(googleSignIn.includes("use_fedcm_for_prompt"), false);
  assert.equal(googleSignIn.includes('crypto.subtle.digest("SHA-256"'), true);

  assert.equal(pages.includes("renderGoogleSignInButton"), true);
  assert.equal(pages.includes("context.onGoogleCredential"), true);
  assert.equal(pages.includes("auth.signInWithGoogleIdToken"), false);
  assert.equal(pages.includes("supabaseGoogleLogin"), false);

  assert.equal(app.includes("OAUTH_CHANNEL_NAME"), false);
  assert.equal(app.includes("prepareOAuthReturn"), false);
  assert.equal(app.includes("BroadcastChannel"), false);

  assert.equal(config.includes("googleClientId"), true);
  assert.equal(runtimeWriter.includes("googleClientId"), true);
  assert.equal(index.includes("./js/oauth-return-guard.js"), false);
  assert.equal(index.includes("https://accounts.google.com"), true);
  assert.equal(worker.includes("./js/google-signin.js"), true);
  assert.equal(worker.includes("./js/oauth-return-guard.js"), false);
  assert.equal(index.includes("20260723-ios-opaque-statusbar-bottomnav-final-r1"), true);
  assert.equal(
    worker.includes("pd-portal-v4-task-workflow-r2-core-20260723"),
    true
  );
});
