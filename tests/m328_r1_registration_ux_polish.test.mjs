import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pagesSource = read("../js/pages.js");
const nativeSource = read("../js/modules/bus-orga-v3.js");
const registrationSource = read("../js/modules/bus-orga-registration-v3.js");

test("M328 registration removes automatic input focus without a DOM overlay", () => {
  assert.match(pagesSource, /bus-orga-v3\.js/);
  assert.match(nativeSource, /hydrateBusOrgaRegistrationV3/);
  assert.doesNotMatch(pagesSource, /m328-registration-ux-polish\.js/);
  assert.doesNotMatch(registrationSource, /\.focus\s*\(/);
  assert.doesNotMatch(registrationSource, /autofocus/);
  assert.match(registrationSource, /clearUnexpectedFormFocus/);
});

test("M328 registration header directly shows venue with date and time below", () => {
  assert.match(registrationSource, /<h2>Anmeldung • \$\{escapeHtml\(venue\)\}<\/h2>/);
  assert.match(registrationSource, /shortDate\(state\.trip\.eventDate\)/);
  assert.match(registrationSource, /eventTime\(state\.trip\.eventTime\)/);
  assert.doesNotMatch(registrationSource, /Ausgewählte Fahrt/);
  assert.doesNotMatch(registrationSource, /P300/);
});

test("M328 registration starts with person search and source filters", () => {
  assert.match(registrationSource, /Person suchen/);
  assert.match(registrationSource, /Name eingeben …/);
  assert.match(registrationSource, /label: "Alle"/);
  assert.match(registrationSource, /label: "Mitglieder"/);
  assert.match(registrationSource, /label: "Portaluser"/);
  assert.match(registrationSource, /label: "Stammfahrer"/);
  assert.match(registrationSource, /＋ Gast hinzufügen/);
  assert.match(registrationSource, /＋ Gruppe auswählen/);
});

test("M328 guest submit text follows the active target booking", () => {
  assert.match(registrationSource, /state\.targetBookingId \? "Zu Buchung hinzufügen" : "Gast hinzufügen"/);
  assert.doesNotMatch(registrationSource, /Gast als Einzelbuchung|Gast zu Buchung hinzufügen/);
});

test("M328 registration keeps the mixed booking stack below search", () => {
  assert.match(registrationSource, /Vorbereitete Buchungen/);
  assert.match(registrationSource, /kind: "GROUP"/);
  assert.match(registrationSource, /kind: "INDIVIDUAL"/);
  assert.match(registrationSource, /data-m328-reg3-booking-card/);
  assert.match(registrationSource, /Alle Buchungen speichern/);
});

test("M328 prepared bookings use compact card interactions and boarding-stop summaries", () => {
  assert.match(registrationSource, /class="icon-button m328-reg3-remove-booking"/);
  assert.match(registrationSource, /aria-label="Buchung entfernen">×/);
  assert.doesNotMatch(registrationSource, />Entfernen<\/button>/);
  assert.doesNotMatch(nativeSource, /data-m328-booking-activate|activate\.textContent = "Bearbeiten"/);
  assert.match(registrationSource, /event\.target\.closest\("button,input,select,textarea,a,label"\)/);
  assert.match(registrationSource, /state\.targetBookingId = card\.dataset\.m328Reg3BookingCard/);
  assert.match(registrationSource, /function selectedStopLabel\(state, selected = ""\)/);
  assert.match(registrationSource, /refreshBookingOverview\(state, target, bookingIndex\)/);
});

test("M328 manual registration consent uses the approved information wording", () => {
  assert.match(registrationSource, /Alle manuell erfassten Personen wurden über die Teilnahmebedingungen und Datenschutzhinweise informiert\./);
  assert.doesNotMatch(registrationSource, /Für alle erfassten Personen wurden Teilnahmebedingungen und Datenschutzhinweise bestätigt\./);
});

test("M328 keeps one prepared booking active until the operator finishes", () => {
  const addOne = registrationSource.match(/function addToTargetOrNew\(state, participant\) \{[\s\S]*?\n\}/)?.[0] || "";
  const addMany = registrationSource.match(/function addManyToTargetOrNew\(state, participants\) \{[\s\S]*?\n\}/)?.[0] || "";
  const bookingCard = registrationSource.match(/function bookingCard\(state, booking, bookingIndex\) \{[\s\S]*?\n\}/)?.[0] || "";
  const renderTarget = registrationSource.match(/function renderTarget\(state\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(addOne, /state\.targetBookingId = null/);
  assert.doesNotMatch(addMany, /state\.targetBookingId = null/);
  assert.match(addMany, /state\.targetBookingId = booking\.clientId/);
  assert.match(bookingCard, /booking\.clientId === state\.targetBookingId/);
  assert.doesNotMatch(bookingCard, /Speichern|verwerfen/i);
  assert.match(registrationSource, /Du bearbeitest Buchung \$\{context\.index \+ 1\} · \$\{context\.booking\.participants\.length\}/);
  assert.match(registrationSource, /Weitere ausgewählte Personen werden dieser Buchung hinzugefügt\./);
  assert.match(registrationSource, /data-m328-reg3-target-done>Fertig<\/button>/);
  assert.match(renderTarget, /state\.targetBookingId = null;\s*renderBookingStack\(state\)/);
  assert.doesNotMatch(registrationSource, /data-m328-reg3-add-to-booking|＋ Person/);
});

test("M328 renders every prepared participant through one complete compact overview", () => {
  assert.match(registrationSource, /function participantOverview\(state, person\)/);
  assert.match(registrationSource, /booking\.participants\.map\(person => participantOverview\(state, person\)\)\.join\(""\)/);
  assert.doesNotMatch(registrationSource, /booking\.participants\.slice\(0, 3\)/);
  assert.match(registrationSource, /details = \[sourceLabel\(person\.source\)\]/);
  assert.match(registrationSource, /selectedStopLabel\(state, person\.boardingStopId\)/);
  assert.match(registrationSource, /preferenceLabel\(person\.busPreference \|\| "EGAL"\)/);
  assert.match(registrationSource, /Hinweis: \$\{person\.operationalNote\}/);
  assert.match(registrationSource, /refreshBookingOverview\(state, target, bookingIndex\)/);
});
