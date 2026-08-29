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
  assert.match(registrationSource, /Gemeinsame Buchung/);
  assert.match(registrationSource, /Einzelbuchung/);
  assert.match(registrationSource, /data-m328-reg3-add-to-booking/);
  assert.match(registrationSource, /Alle Buchungen speichern/);
});

test("M328 prepared bookings use compact card interactions and boarding-stop summaries", () => {
  assert.match(registrationSource, /class="icon-button m328-reg3-remove-booking"/);
  assert.match(registrationSource, /aria-label="Buchung entfernen">×/);
  assert.doesNotMatch(registrationSource, />Entfernen<\/button>/);
  assert.doesNotMatch(nativeSource, /data-m328-booking-activate|activate\.textContent = "Bearbeiten"/);
  assert.match(nativeSource, /event\.target\.closest\("button,input,select,textarea,a,label"\)/);
  assert.match(nativeSource, /ui\.activeBookingId = id;\s*sync\(\);/);
  assert.match(registrationSource, /function selectedStopLabel\(state, selected = ""\)/);
  assert.match(registrationSource, /return `\$\{personName\(person\)\}\$\{stop \? ` · \$\{stop\}` : ""\}`/);
  assert.match(registrationSource, /summary\.textContent = bookingSummary\(state, booking\)/);
});

test("M328 manual registration consent uses the approved information wording", () => {
  assert.match(registrationSource, /Alle manuell erfassten Personen wurden über die Teilnahmebedingungen und Datenschutzhinweise informiert\./);
  assert.doesNotMatch(registrationSource, /Für alle erfassten Personen wurden Teilnahmebedingungen und Datenschutzhinweise bestätigt\./);
});
