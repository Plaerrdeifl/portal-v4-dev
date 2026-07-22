import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

test("authentication transitions have one central controller", async () => {
  const [app, pages, index, css] = await Promise.all([
    read("js/app.js"),
    read("js/pages.js"),
    read("index.html"),
    read("css/app.css")
  ]);

  assert.ok(app.includes("async function runAuthTransition"));
  assert.ok(app.includes("onGoogleCredential: signInWithGoogleCredential"));
  assert.ok(app.includes("await afterNextPaint()"));
  assert.ok(app.includes("document.documentElement.dataset.authTransition"));
  assert.ok(!app.includes("dataset.authReady"));
  assert.ok(!pages.includes('import { navigate } from "./router.js";'));
  assert.ok(!pages.includes("auth.signInWithGoogleIdToken"));
  assert.ok(pages.includes("context.onGoogleCredential"));
  assert.ok(!index.includes("data-auth-ready"));
  assert.ok(!index.includes("data-startup-state"));
  assert.ok(!css.includes("data-auth-ready"));
  assert.ok(!css.includes("data-startup-state"));
});

test("navigation uses one toggle state and a permanently visible structural footer", async () => {
  const [ui, sidebar, index, css] = await Promise.all([
    read("js/ui.js"),
    read("components/sidebar.html"),
    read("index.html"),
    read("css/app.css")
  ]);

  assert.ok(ui.includes("export function setMobileMenu"));
  assert.ok(ui.includes("export function toggleMobileMenu"));
  assert.ok(ui.includes('event.target.closest("#mobileMoreToggle")'));
  assert.ok(ui.includes("toggleMobileMenu();"));
  assert.ok(ui.includes('title: "Zur Startseite"'));
  assert.ok(sidebar.includes('id="portalNavFooter"'));
  assert.ok(index.includes('id="portalNavFooter"'));
  assert.ok(css.includes(".sidebar .nav-main{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}"));
  assert.ok(css.includes(".sidebar .nav-footer{flex:0 0 auto;overflow:visible"));
  assert.ok(css.includes(".sidebar{position:sticky"));
  assert.ok(css.includes("flex-direction:column;overflow:hidden}"));
  assert.ok(!css.includes('button[data-route="home"]{margin-top:auto}'));
});

test("forms, dialogs and Google button follow the global mobile contract", async () => {
  const [google, common, css] = await Promise.all([
    read("js/google-signin.js"),
    read("js/modules/common.js"),
    read("css/app.css")
  ]);

  assert.ok(google.includes("BUTTON_HORIZONTAL_INSET"));
  assert.ok(google.includes("availableButtonWidth"));
  assert.ok(google.includes("await afterLayout()"));
  assert.ok(google.includes("ResizeObserver"));
  assert.ok(!google.includes("width: 320"));
  assert.ok(common.includes("dialogReturnFocus"));
  assert.ok(common.includes("blurDialogFocus"));
  assert.ok(common.includes("focus({ preventScroll: true })"));
  assert.ok(css.includes("input,select,textarea{font-size:16px!important}"));
  assert.ok(css.includes("padding-inline:6px"));
  assert.ok(css.includes(".google-signin-slot>div{"));
  assert.ok(css.includes("overflow:hidden"));
  assert.ok(!css.includes(".fanclub-page{padding-bottom:calc"));
  assert.ok(css.includes(".v4-compact-page{min-height:0"));
});
