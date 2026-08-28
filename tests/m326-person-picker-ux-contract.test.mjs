// DEV recovery deploy marker: runtime source intentionally unchanged.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ux = readFileSync(new URL("../js/m326-person-picker-ux.js", import.meta.url), "utf8");
const composerUx = readFileSync(new URL("../js/m326-manual-composer-ux.js", import.meta.url), "utf8");
const defaultStopOverlay = readFileSync(
  new URL("../supabase/dev-overlays/20260828_m326_person_default_boarding_stop.sql", import.meta.url),
  "utf8"
);

test("M326 compact person picker is loaded in the portal", () => {
  assert.match(index, /js\/m326-person-picker-ux\.js\?v=20260828-m326-mobile-picker-r6/);
});

test("M326 manual composer detail UX is loaded in the portal", () => {
  assert.match(index, /js\/m326-manual-composer-ux\.js\?v=20260828-m326-composer-r1/);
});

test("M326 person picker uses the portal form grid instead of custom layout CSS", () => {
  assert.match(ux, /Art der Erfassung/);
  assert.match(ux, /Bestehende Person/);
  assert.match(ux, /Neuer Gast/);
  assert.match(ux, /v4-field-full form-grid/);
  assert.doesNotMatch(ux, /document\.createElement\("style"\)/);
});

test("M326 compact person picker does not dump the full directory initially", () => {
  assert.match(ux, /queryLength >= 2 \|\| filtered/);
  assert.match(ux, /MAX_VISIBLE_RESULTS = 8/);
  assert.match(ux, /Mindestens 2 Buchstaben eingeben oder einen Personentyp wählen/);
  assert.match(ux, /button\.hidden = index >= MAX_VISIBLE_RESULTS/);
});

test("M326 person picker removes the empty visual ALL filter but keeps ALL as search fallback", () => {
  assert.match(ux, /data-m326-source-filter=\"ALL\"/);
  assert.match(ux, /\?\.remove\(\)/);
  assert.match(ux, /return active\?\.dataset\.m326SourceFilter \|\| \"ALL\"/);
});

test("M326 person and guest modes are mutually exclusive even against portal important grid rules", () => {
  assert.match(ux, /function setFlowVisible\(element, visible\)/);
  assert.match(ux, /style\.setProperty\("display", "none", "important"\)/);
  assert.match(ux, /setFlowVisible\(personPane, !guest\)/);
  assert.match(ux, /setFlowVisible\(guestFields, guest\)/);
  assert.match(ux, /query\.disabled = guest/);
  assert.match(ux, /button\.disabled = guest/);
});

test("M326 picker opens without focusing a select, search or guest field", () => {
  assert.match(ux, /form\.tabIndex = -1/);
  assert.match(ux, /form\.focus\(\{ preventScroll: true \}\)/);
  assert.match(ux, /neutralizeInitialFieldFocus/);
  assert.doesNotMatch(ux, /modeSelect\.focus\(/);
  assert.doesNotMatch(ux, /query\.focus\(/);
  assert.doesNotMatch(ux, /firstName[^\n]*\.focus\(/);
});

test("M326 guest fields keep the existing portal half/full-width field contract", () => {
  assert.match(ux, /guestFields\.classList\.remove\("v4-smart-form"\)/);
  assert.match(ux, /querySelectorAll\("\.v4-field-full"\).*classList\.add\("full"\)/s);
});

test("M326 manual composer honors person default before the trip fallback", () => {
  assert.match(defaultStopOverlay, /fanbus_user_preferences/);
  assert.match(defaultStopOverlay, /defaultBoardingStopId/);
  assert.match(defaultStopOverlay, /defaultBoardingStopLabel/);
  assert.match(ux, /loadPersonDefaultStops/);
  assert.match(ux, /applyPreferredStopToComposer/);
  assert.match(ux, /text\.endsWith\(` · \$\{label\}`\)/);
  assert.match(ux, /select\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
  assert.match(ux, /Fahrt-Vorgabe bleibt bestehen/);
});

test("M326 composer overview contains information cards, not editable controls", () => {
  assert.match(composerUx, /data-m326-composer-source/);
  assert.match(composerUx, /style\.setProperty\("display", "none", "important"\)/);
  assert.match(composerUx, /v4-compact-record v4-interactive-card v4-m326-composer-overview/);
  assert.match(composerUx, /data-m326-composer-open-detail/);
  assert.match(composerUx, /Zustieg:/);
  assert.match(composerUx, /Buswunsch:/);
});

test("M326 composer edits a participant only through the detail dialog", () => {
  assert.match(composerUx, /title: name/);
  assert.match(composerUx, /kicker: "Teilnehmer bearbeiten"/);
  assert.match(composerUx, /submitLabel: "Änderungen übernehmen"/);
  assert.match(composerUx, /name="boardingStopId"/);
  assert.match(composerUx, /name="busPreference"/);
  assert.match(composerUx, /name="operationalNote"/);
  assert.match(composerUx, /Teilnehmer entfernen/);
  assert.match(composerUx, /dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/);
});

test("M326 composer removes duplicate name summary and uses count-aware submit wording", () => {
  assert.match(composerUx, /legacySummary\.style\.setProperty\("display", "none", "important"\)/);
  assert.match(composerUx, /1 Person ausgewählt/);
  assert.match(composerUx, /\$\{count\} Personen ausgewählt/);
  assert.match(composerUx, /"Person anmelden"/);
  assert.match(composerUx, /`\$\{count\} Personen anmelden`/);
});

test("M326 compact person picker follows dynamically created dialogs", () => {
  assert.match(ux, /new MutationObserver/);
  assert.match(ux, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
  assert.match(composerUx, /new MutationObserver/);
  assert.match(composerUx, /composerObserver\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
});
