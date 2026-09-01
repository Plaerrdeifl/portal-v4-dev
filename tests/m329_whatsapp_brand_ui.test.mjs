import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [brandUi, publicBootstrap, portalBootstrap] = await Promise.all([
  read("js/m329-whatsapp-brand-ui.js"),
  read("js/m327-r1-guest-contact-polish.js"),
  read("js/m328-trip-subpage-back.js")
]);

test("M329 WhatsApp actions use the white brand mark on WhatsApp green", () => {
  assert.match(brandUi, /#25D366/);
  assert.match(brandUi, /fill=\"#FFFFFF\"/);
  assert.match(brandUi, /M17\.472 14\.382/);
  assert.match(brandUi, /m329-whatsapp-brand-mark/);
  assert.match(brandUi, /\.m329-contact-action\.m329-whatsapp/);
  assert.match(brandUi, /\.m329-primary-whatsapp/);
  assert.doesNotMatch(brandUi, /currentColor/);
});

test("WhatsApp brand UI loads in public and portal Fanbus entry points", () => {
  assert.match(publicBootstrap, /m329-whatsapp-brand-ui\.js/);
  assert.match(portalBootstrap, /m329-whatsapp-brand-ui\.js/);
});

test("WhatsApp brand UI stays isolated from the frozen Liveticker", () => {
  assert.doesNotMatch(brandUi, /liveticker/i);
  assert.doesNotMatch(publicBootstrap, /liveticker/i);
  assert.doesNotMatch(portalBootstrap, /liveticker/i);
});
