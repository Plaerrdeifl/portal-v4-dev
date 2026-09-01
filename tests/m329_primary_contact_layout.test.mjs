import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [layout, publicBootstrap, portalBootstrap] = await Promise.all([
  read("js/m329-primary-contact-layout.js"),
  read("js/m327-r1-guest-contact-polish.js"),
  read("js/m328-trip-subpage-back.js")
]);

test("Fanbus contact heading and subtitle are centered", () => {
  assert.match(layout, /\.m329-contact-panel>header/);
  assert.match(layout, /text-align:center!important/);
  assert.match(layout, /justify-items:center!important/);
});

test("primary WhatsApp and email actions use a 50-50 grid", () => {
  assert.match(layout, /grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)!important/);
  assert.match(layout, /m329-primary-whatsapp/);
  assert.match(layout, /m329-primary-email/);
  assert.match(layout, /<span>E-Mail<\/span>/);
});

test("primary WhatsApp action is forced green and labeled WhatsApp", () => {
  assert.match(layout, /#25D366/);
  assert.match(layout, /background:#25D366!important/);
  assert.match(layout, /classList\.remove\("primary"\)/);
  assert.match(layout, /style\.setProperty\("background", "#25D366", "important"\)/);
  assert.match(layout, /whatsappLabel\.textContent = "WhatsApp"/);
});

test("primary email is derived from the public central Fanbus contact", () => {
  assert.match(layout, /pd_public_fanbus_contact/);
  assert.match(layout, /data\?\.primary\?\.emailHref/);
  assert.doesNotMatch(layout, /fanbus@plaerrdeifl\.de/);
});

test("primary contact layout loads in public and portal entry points with refreshed cache key", () => {
  assert.match(publicBootstrap, /m329-primary-contact-layout\.js\?v=20260901-m329-primary-contact2/);
  assert.match(portalBootstrap, /m329-primary-contact-layout\.js\?v=20260901-m329-primary-contact2/);
});

test("primary contact polish stays isolated from frozen Liveticker", () => {
  assert.doesNotMatch(layout, /liveticker/i);
  assert.doesNotMatch(publicBootstrap, /liveticker/i);
  assert.doesNotMatch(portalBootstrap, /liveticker/i);
});
