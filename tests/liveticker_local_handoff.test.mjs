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

test("local Liveticker handoff targets only the private LAN app", () => {
  assert.equal(script.includes('const TARGET_ORIGIN = "http://192.168.178.117";'), true);
  assert.equal(script.includes('auth.hasCapability("liveticker.manage")'), true);
});

test("local Liveticker handoff transfers the session only in the URL fragment", () => {
  assert.equal(script.includes('const SESSION_FRAGMENT_KEY = "pd_session";'), true);
  assert.equal(script.includes("encodeURIComponent(JSON.stringify"), true);
  assert.equal(script.includes("window.location.assign(target)"), true);
  assert.equal(script.includes("postMessage"), false);
  assert.equal(script.includes("?access_token="), false);
  assert.equal(script.includes("?refresh_token="), false);
  assert.equal(script.includes("access_token="), false);
  assert.equal(script.includes("refresh_token="), false);
});

test("handoff page reuses existing portal auth and official Google helper", () => {
  assert.equal(html.includes("./js/runtime-config.js"), true);
  assert.equal(script.includes('from "./auth.js"'), true);
  assert.equal(script.includes('from "./google-signin.js"'), true);
  assert.equal(script.includes("auth.signInWithGoogleIdToken"), true);
});
