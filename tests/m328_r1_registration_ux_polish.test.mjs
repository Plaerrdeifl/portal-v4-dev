import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pagesSource = read("../js/pages.js");
const polishSource = read("../js/m328-registration-ux-polish.js");

test("M328 registration removes automatic input focus after source switches", () => {
  assert.match(pagesSource, /m328-registration-ux-polish\.js/);
  assert.match(polishSource, /blurRegistrationField/);
  assert.match(polishSource, /data-m328-reg-source/);
  assert.match(polishSource, /data-m328-guest-form/);
  assert.match(polishSource, /queueMicrotask\(blurRegistrationField\)/);
  assert.doesNotMatch(polishSource, /\.focus\(/);
});

test("M328 registration header shows title with venue and date time below", () => {
  assert.match(polishSource, /`Anmeldung • \$\{tripMeta\.venue\}`/);
  assert.match(polishSource, /\[tripMeta\.date, tripMeta\.time\]/);
  assert.match(polishSource, /title\?\.after\(meta\)/);
  assert.match(polishSource, /trip\.remove\(\)/);
  assert.doesNotMatch(polishSource, /Ausgewählte Fahrt/);
});

test("M328 registration communicates mixed group and individual collection", () => {
  assert.match(polishSource, /heading\.textContent = "Hinzufügen"/);
  assert.match(polishSource, /kicker\.textContent = "Sammelanmeldung"/);
  assert.match(polishSource, /Einzelpersonen und Gruppen beliebig kombinieren/);
  assert.match(polishSource, /gemeinsam gespeichert/);
});
