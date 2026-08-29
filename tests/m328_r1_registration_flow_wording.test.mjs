import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pagesSource = read("../js/pages.js");
const wordingSource = read("../js/modules/bus-orga-registration-flow-wording.js");

test("M328 wires the registration flow wording after native registration hydration", () => {
  assert.match(pagesSource, /bus-orga-registration-flow-wording\.js\?v=20260829-m328-r1-flow-wording1/);
  assert.match(pagesSource, /setupM328RegistrationFlowWording/);
});

test("M328 decision and active booking actions use the approved wording", () => {
  assert.match(wordingSource, /decisionAction \? "Zur Übersicht" : "Neue Buchung starten"/);
  assert.match(wordingSource, /data-m328-reg3-target-more/);
  assert.match(wordingSource, /data-m328-reg3-target-complete/);
  assert.match(wordingSource, /m328-reg3-booking-complete/);
  assert.match(wordingSource, /completeAction\.setAttribute\("aria-label", label\)/);
});
