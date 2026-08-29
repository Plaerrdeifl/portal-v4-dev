import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pagesSource = read("../js/pages.js");
const nativeSource = read("../js/modules/bus-orga-v3.js");

test("M328 active booking is visually distinct from prepared bookings", () => {
  assert.match(nativeSource, /\.m328-reg3-booking\.is-active-booking\{[^}]*border:3px solid var\(--accent\)!important/);
  assert.match(nativeSource, /content:"Vorbereitet"/);
  assert.match(nativeSource, /activeStatus\.textContent = "Offen · wird bearbeitet"/);
});

test("M328 decision and active booking actions are explicit", () => {
  assert.match(nativeSource, /complete\.textContent !== "Zur Übersicht"/);
  assert.match(nativeSource, /complete\.textContent !== "Neue Buchung starten"/);
  assert.match(nativeSource, /Weitere Person hinzufügen/);
});

test("M328 active booking has a local save action without changing final submit", () => {
  assert.match(nativeSource, /participantCount > 1 \? "Buchungsgruppe speichern" : "Buchung speichern"/);
  assert.match(nativeSource, /Endgültig gespeichert wird weiterhin unten\./);
  assert.match(nativeSource, /saveButton\.addEventListener\("click", \(\) => complete\.click\(\)\)/);
  assert.doesNotMatch(nativeSource, /footer\.appendChild\(complete\)/);
});

test("M328 page cache-busts the active booking UX", () => {
  assert.match(pagesSource, /state=20260829-m328-r1-booking-state1/);
});
