import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  closeOtherStatusControls,
  closeStatusControl
} from "../js/liveticker-status-popovers.js";

const root = resolve(import.meta.dirname, "..");

test("only one status popover can remain open", () => {
  const graphic = { open: true };
  const wa = { open: true };
  const wpp = { open: true };
  const closed = closeOtherStatusControls([graphic, wa, wpp], wa);
  assert.equal(closed, 2);
  assert.equal(graphic.open, false);
  assert.equal(wa.open, true);
  assert.equal(wpp.open, false);
});

test("closeStatusControl closes an open control once", () => {
  const control = { open: true };
  assert.equal(closeStatusControl(control), true);
  assert.equal(control.open, false);
  assert.equal(closeStatusControl(control), false);
});

test("DEV runtime closes WA after success and exposes WPP as read-only", async () => {
  const runtime = await readFile(resolve(root, "js/liveticker-runtime-controls.js"), "utf8");
  assert.match(runtime, /closeStatusControl\(wa\.control\)/);
  assert.match(runtime, /const WPP_CONTROL_OWNER = false/);
  assert.match(runtime, /wpp\.toggle\.disabled = true/);
  assert.match(runtime, /"Steuerung nur in PROD"/);
  assert.doesNotMatch(runtime, /liveticker_wpp_runtime_set/);
});

test("graphics control closes after successful toggle", async () => {
  const graphics = await readFile(resolve(root, "js/liveticker-graphics-inline.js"), "utf8");
  assert.match(graphics, /PD_LIVETICKER_STATUS_POPOVERS\?\.close\?\.\(workerControl\)/);
});

test("DEV labels distinguish environment worker from global WPP", async () => {
  const html = await readFile(resolve(root, "liveticker/index.html"), "utf8");
  assert.match(html, />WA DEV</);
  assert.match(html, />WPP GLOBAL</);
  assert.match(html, /Globale WhatsApp-Verbindung für DEV und PROD/);
});

test("DEV cache chain loads the popover controller first", async () => {
  const auth = await readFile(resolve(root, "js/liveticker-auth-bootstrap.js"), "utf8");
  const html = await readFile(resolve(root, "liveticker/index.html"), "utf8");
  assert.match(auth, /liveticker-status-popovers\.js\?v=20260919-dev-popovers-r1/);
  assert.match(auth, /liveticker-runtime-controls\.js\?v=20260919-runtime-labels-r1/);
  assert.match(auth, /liveticker-graphics-inline\.js\?v=20260919-summary-caption-r2/);
  assert.match(html, /liveticker-auth-bootstrap\.js\?v=20260919-summary-caption-r2/);
});
