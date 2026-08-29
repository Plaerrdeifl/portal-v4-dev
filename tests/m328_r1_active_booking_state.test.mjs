import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pagesSource = read("../js/pages.js");
const nativeSource = read("../js/modules/bus-orga-v3.js");

test("M328 active booking is visually distinct from prepared bookings", () => {
  assert.match(nativeSource, /\.m328-reg3-booking\.is-active-booking\{[^}]*border:3px solid var\(--accent\)!important/);
  assert.match(nativeSource, /\.m328-reg3-booking\.is-active-booking\{[^}]*background:color-mix\(in srgb,var\(--warning\) 9%,var\(--surface\)\)/);
  assert.match(nativeSource, /\.m328-reg3-booking\.is-active-booking \+ \.m328-reg3-booking\{[^}]*margin-top:8px/);
  assert.match(nativeSource, /content:"Vorbereitet"/);
  assert.match(nativeSource, /activeStatus\.textContent = "Offen · wird bearbeitet"/);
});

test("M328 decision stays explicit while active booking has no new-booking shortcut", () => {
  assert.match(nativeSource, /complete\.textContent !== "Zur Übersicht"/);
  assert.match(nativeSource, /Weitere Person hinzufügen/);
  assert.match(nativeSource, /complete\.hidden = true/);
  assert.match(nativeSource, /if \(actions\) actions\.hidden = true/);
  assert.doesNotMatch(nativeSource, /Neue Buchung starten/);
});

test("M328 active booking has a local save action without changing final submit", () => {
  assert.match(nativeSource, /participantCount > 1 \? "Buchungsgruppe speichern" : "Buchung speichern"/);
  assert.match(nativeSource, /Endgültig gespeichert wird weiterhin unten\./);
  assert.match(nativeSource, /saveButton\.addEventListener\("click", \(\) => complete\.click\(\)\)/);
  assert.doesNotMatch(nativeSource, /footer\.appendChild\(complete\)/);
});

test("M328 active participants are compact editable cards with live summaries", () => {
  assert.match(nativeSource, /function decorateActiveParticipantCards\(activeBooking\)/);
  assert.match(nativeSource, /function activeParticipantSummaryText\(person\)/);
  assert.match(nativeSource, /details\.push\(sourceLabel\)/);
  assert.match(nativeSource, /details\.push\(stopLabel\)/);
  assert.match(nativeSource, /Buswunsch: \$\{preferenceLabel\}/);
  assert.match(nativeSource, /Hinweis: \$\{noteValue\}/);
  assert.match(nativeSource, /person\.classList\.toggle\("is-editing", opening\)/);
  assert.match(nativeSource, /person\.classList\.toggle\("is-editing", openOnRender\)/);
  assert.match(nativeSource, /event\.target\.closest\("button,input,select,textarea,a,label"\)/);
  assert.match(nativeSource, /\.m328-reg3-booking\.is-active-booking \.m328-reg3-person:not\(\.is-editing\)>label\{[^}]*display:none!important/);
  assert.match(nativeSource, /\.m328-reg3-booking\.is-active-booking \.m328-reg3-person:not\(\.is-editing\) \.m328-reg3-person-name small\{[^}]*display:none/);
  assert.match(nativeSource, /\.m328-reg3-active-person-summary-chevron/);
});

test("M328 page cache-busts the active participant card UX", () => {
  assert.match(pagesSource, /state=20260829-m328-r1-booking-state2/);
  assert.match(pagesSource, /cards=20260829-m328-r1-active-person-cards2/);
  assert.match(pagesSource, /rows=20260829-m328-r1-participant-row-edit1/);
  assert.match(pagesSource, /flow-wording2/);
});
