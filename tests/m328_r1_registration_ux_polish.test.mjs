import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pagesSource = read("../js/pages.js");
const nativeSource = read("../js/modules/bus-orga-v3.js");
const registrationSource = read("../js/modules/bus-orga-registration-v2.js");

test("M328 registration removes automatic input focus without a DOM overlay", () => {
  assert.match(pagesSource, /bus-orga-v3\.js/);
  assert.match(nativeSource, /hydrateBusOrgaRegistrationV2/);
  assert.doesNotMatch(pagesSource, /m328-registration-ux-polish\.js/);
  assert.doesNotMatch(registrationSource, /\.focus\s*\(/);
  assert.doesNotMatch(registrationSource, /autofocus/);
  assert.match(registrationSource, /data-m328-reg2-source/);
});

test("M328 registration header directly shows venue with date and time below", () => {
  assert.match(registrationSource, /<h2>Anmeldung • \$\{escapeHtml\(venue\)\}<\/h2>/);
  assert.match(registrationSource, /shortDate\(state\.trip\.eventDate\)/);
  assert.match(registrationSource, /eventTime\(state\.trip\.eventTime\)/);
  assert.doesNotMatch(registrationSource, /Ausgewählte Fahrt/);
  assert.doesNotMatch(registrationSource, /P300/);
});

test("M328 registration exposes a visible mixed booking stack", () => {
  assert.match(registrationSource, /Sammelerfassung/);
  assert.match(registrationSource, /Vorbereitete Buchungen/);
  assert.match(registrationSource, /Gemeinsame Buchung/);
  assert.match(registrationSource, /Einzelbuchung/);
  assert.match(registrationSource, /Alle Buchungen speichern/);
});
