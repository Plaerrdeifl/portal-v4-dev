import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(
  new URL("../liveticker-local-handoff.html", import.meta.url),
  "utf8"
);
const script = fs.readFileSync(
  new URL("../js/liveticker-local-handoff.js", import.meta.url),
  "utf8"
);

test("local Liveticker handoff uses exact DEV and LAN origins", () => {
  assert.equal(script.includes('const TARGET_ORIGIN = "http://192.168.178.117";'), true);
  assert.equal(script.includes('auth.hasCapability("liveticker.manage")'), true);
  assert.equal(script.includes('event.origin !== TARGET_ORIGIN'), true);
  assert.equal(script.includes('event.source !== targetWindow'), true);
});

test("local Liveticker handoff transfers session only via postMessage", () => {
  assert.equal(script.includes('"PD_LIVETICKER_SESSION"'), true);
  assert.equal(script.includes("accessToken: session.access_token"), true);
  assert.equal(script.includes("refreshToken: session.refresh_token"), true);
  assert.equal(script.includes("TARGET_URL +="), false);
  assert.equal(script.includes("access_token="), false);
  assert.equal(script.includes("refresh_token="), false);
});

test("handoff page reuses existing portal auth and official Google helper", () => {
  assert.equal(html.includes("./js/runtime-config.js"), true);
  assert.equal(script.includes('from "./auth.js"'), true);
  assert.equal(script.includes('from "./google-signin.js"'), true);
  assert.equal(script.includes("auth.signInWithGoogleIdToken"), true);
});
