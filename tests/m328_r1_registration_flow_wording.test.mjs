import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pagesSource = read("../js/pages.js");
const wordingSource = read("../js/modules/bus-orga-registration-flow-wording.js");

test("M328 wires the registration flow wording after native registration hydration", () => {
  assert.match(pagesSource, /bus-orga-registration-flow-wording\.js\?v=20260829-m328-r1-flow-wording2/);
  assert.match(pagesSource, /setupM328RegistrationFlowWording/);
});

test("M328 decision wording stays explicit without an active new-booking shortcut", () => {
  assert.match(wordingSource, /if \(!completeAction \|\| !decisionAction\) return;/);
  assert.match(wordingSource, /const label = "Zur Übersicht"/);
  assert.doesNotMatch(wordingSource, /Neue Buchung starten/);
  assert.match(wordingSource, /data-m328-reg3-target-more/);
  assert.match(wordingSource, /data-m328-reg3-target-complete/);
  assert.match(wordingSource, /completeAction\.setAttribute\("aria-label", label\)/);
});
