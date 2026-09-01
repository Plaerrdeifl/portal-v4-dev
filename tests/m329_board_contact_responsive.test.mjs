import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [responsive, publicBootstrap, portalBootstrap] = await Promise.all([
  read("js/m329-board-contact-responsive.js"),
  read("js/m327-r1-guest-contact-polish.js"),
  read("js/m328-trip-subpage-back.js")
]);

test("narrow Vorstand cards keep both labeled contact buttons side by side, contained and larger", () => {
  assert.match(responsive, /container-type:inline-size/);
  assert.match(responsive, /container-name:m329-board-card/);
  assert.match(responsive, /@container m329-board-card \(max-width:16rem\)/);
  assert.match(responsive, /grid-template-columns:minmax\(0,1\.18fr\) minmax\(0,\.82fr\)!important/);
  assert.match(responsive, /padding-inline:\.12rem!important/);
  assert.match(responsive, /min-height:2\.32rem!important/);
  assert.match(responsive, /font-size:\.63rem!important/);
  assert.match(responsive, /overflow:hidden!important/);
  assert.match(responsive, /position:static!important/);
  assert.match(responsive, /transform:none!important/);
  assert.match(responsive, /m329-v2-board-actions/);
  assert.doesNotMatch(responsive, /grid-template-columns:1fr!important/);
});

test("Vorstand-only responsive polish does not change the Fanbus contact card", () => {
  assert.doesNotMatch(responsive, /m329-contact-panel/);
  assert.doesNotMatch(responsive, /m329PortalFanbusContacts/);
});

test("responsive Vorstand polish loads in both existing portal entry points", () => {
  assert.match(publicBootstrap, /m329-board-contact-responsive\.js\?v=20260901-m329-board-responsive4/);
  assert.match(portalBootstrap, /m329-board-contact-responsive\.js\?v=20260901-m329-board-responsive4/);
});

test("responsive Vorstand polish stays isolated from Liveticker", () => {
  assert.doesNotMatch(responsive, /liveticker/i);
});
