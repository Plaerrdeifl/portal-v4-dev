import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ux = readFileSync(new URL("../js/m326-person-picker-ux.js", import.meta.url), "utf8");

test("M326 compact person picker is loaded in the portal", () => {
  assert.match(index, /js\/m326-person-picker-ux\.js\?v=20260827-m326-mobile-picker-r3/);
});

test("M326 person picker uses the portal form grid instead of custom layout CSS", () => {
  assert.match(ux, /Art der Erfassung/);
  assert.match(ux, /Bestehende Person/);
  assert.match(ux, /Neuer Gast/);
  assert.match(ux, /personPane\.className = "v4-field-full form-grid"/);
  assert.doesNotMatch(ux, /document\.createElement\("style"\)/);
});

test("M326 compact person picker does not dump the full directory initially", () => {
  assert.match(ux, /queryLength >= 2 \|\| filtered/);
  assert.match(ux, /MAX_VISIBLE_RESULTS = 8/);
  assert.match(ux, /Mindestens 2 Buchstaben eingeben oder einen Personentyp wählen/);
  assert.match(ux, /button\.hidden = index >= MAX_VISIBLE_RESULTS/);
});

test("M326 person and guest modes are mutually exclusive", () => {
  assert.match(ux, /guestFields\.classList\.remove\("v4-smart-form"\)/);
  assert.match(ux, /personPane\.hidden = guest/);
  assert.match(ux, /guestFields\.hidden = !guest/);
  assert.match(ux, /query\.disabled = guest/);
  assert.match(ux, /button\.disabled = guest/);
});

test("M326 mode switching does not auto-focus fields or open the mobile keyboard", () => {
  assert.doesNotMatch(ux, /\.focus\(\)/);
});

test("M326 guest fields keep the portal half/full-width field contract without overriding hidden", () => {
  assert.match(ux, /guestFields\.querySelectorAll\("\.v4-field-full"\)/);
  assert.match(ux, /element\.classList\.add\("full"\)/);
  assert.doesNotMatch(ux, /guestFields\.classList\.add\("v4-smart-form"\)/);
});

test("M326 compact person picker follows dynamically created dialogs", () => {
  assert.match(ux, /new MutationObserver/);
  assert.match(ux, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
});
