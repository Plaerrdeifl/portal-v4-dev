import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ux = readFileSync(new URL("../js/m326-person-picker-ux.js", import.meta.url), "utf8");

test("M326 compact person picker is loaded in the portal", () => {
  assert.match(index, /js\/m326-person-picker-ux\.js\?v=20260827-m326-mobile-picker-r1/);
});

test("M326 compact person picker separates person and guest flows", () => {
  assert.match(ux, /Person auswählen/);
  assert.match(ux, /Gast anlegen/);
  assert.match(ux, /data-m326-picker-mode/);
  assert.match(ux, /guestFields\.hidden = !guest/);
});

test("M326 compact person picker does not dump the full directory initially", () => {
  assert.match(ux, /queryLength >= 2 \|\| filtered/);
  assert.match(ux, /MAX_VISIBLE_RESULTS = 8/);
  assert.match(ux, /Mindestens 2 Buchstaben eingeben oder einen Personentyp wählen/);
  assert.match(ux, /button\.hidden = index >= MAX_VISIBLE_RESULTS/);
});

test("M326 compact person picker follows dynamically created dialogs", () => {
  assert.match(ux, /new MutationObserver/);
  assert.match(ux, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
});
