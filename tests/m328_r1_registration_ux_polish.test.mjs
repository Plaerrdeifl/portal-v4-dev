import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pagesSource = read("../js/pages.js");
const nativeSource = read("../js/modules/bus-orga-v3.js");
const registrationSource = read("../js/modules/bus-orga-registration-v3.js");

function extractedFunction(name) {
  const block = registrationSource.match(new RegExp(`function ${name}\\([^]*?^\\}`, "m"))?.[0];
  assert.ok(block, `function ${name} must exist`);
  return block;
}

function bookingFlowHarness() {
  let nextId = 0;
  const source = [
    "assertBookingDecisionResolved",
    "activateBooking",
    "activateDecisionBooking",
    "completeBookingFlow",
    "addToTargetOrNew",
    "addManyToTargetOrNew"
  ].map(extractedFunction).join("\n");
  return Function("crypto", `${source}
    const participantIdentity = person => person.identityKey || person.name;
    const personName = person => person.name;
    const allParticipants = state => state.bookings.flatMap(booking => booking.participants);
    const totalParticipantCount = state => allParticipants(state).length;
    const assertParticipantAvailable = (state, participant) => {
      const key = participantIdentity(participant);
      if (allParticipants(state).some(item => participantIdentity(item) === key)) throw new Error("duplicate");
      return key;
    };
    const renderBookingStack = () => {};
    const renderTarget = () => {};
    return { addToTargetOrNew, addManyToTargetOrNew, activateBooking, activateDecisionBooking, completeBookingFlow };
  `)({ randomUUID: () => `booking-${++nextId}` });
}

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
  assert.match(registrationSource, /activateBooking\(state, card\.dataset\.m328Reg3BookingCard\)/);
  assert.match(registrationSource, /function selectedStopLabel\(state, selected = ""\)/);
  assert.match(registrationSource, /refreshBookingOverview\(state, target, bookingIndex\)/);
});

test("M328 manual registration consent uses the approved information wording", () => {
  assert.match(registrationSource, /Alle manuell erfassten Personen wurden über die Teilnahmebedingungen und Datenschutzhinweise informiert\./);
  assert.doesNotMatch(registrationSource, /Für alle erfassten Personen wurden Teilnahmebedingungen und Datenschutzhinweise bestätigt\./);
});

test("M328 guides the first person into a deliberate shared-or-complete decision", () => {
  const flow = bookingFlowHarness();
  const state = { bookings: [], targetBookingId: null, decisionBookingId: null };
  flow.addToTargetOrNew(state, { name: "Erste Person" });
  assert.equal(state.bookings.length, 1);
  assert.equal(state.bookings[0].participants.length, 1);
  assert.equal(state.targetBookingId, null);
  assert.equal(state.decisionBookingId, "booking-1");
  assert.throws(() => flow.addToTargetOrNew(state, { name: "Zu früh" }), /entscheide zuerst/);
  assert.match(registrationSource, /Wie möchtest du fortfahren\?/);
  assert.match(registrationSource, /Personen, die gemeinsam hinzugefügt werden, bilden eine zusammenhängende Buchung und erhalten dieselbe Buchungsnummer\./);
  assert.match(registrationSource, /data-m328-reg3-target-more>Weitere Person hinzufügen<\/button>/);
});

test("M328 adds second and third people to the explicitly activated booking", () => {
  const flow = bookingFlowHarness();
  const state = { bookings: [], targetBookingId: null, decisionBookingId: null };
  flow.addToTargetOrNew(state, { name: "Person 1" });
  assert.equal(flow.activateDecisionBooking(state), true);
  flow.addToTargetOrNew(state, { name: "Person 2" });
  flow.addToTargetOrNew(state, { name: "Person 3" });
  assert.equal(state.bookings.length, 1);
  assert.equal(state.bookings[0].participants.length, 3);
  assert.equal(state.targetBookingId, "booking-1");
  assert.equal(state.decisionBookingId, null);
  assert.match(registrationSource, /Gemeinsame Buchung aktiv · \$\{context\.booking\.participants\.length\}/);
  assert.match(registrationSource, /Weitere ausgewählte Personen werden dieser Buchung hinzugefügt und erhalten dieselbe Buchungsnummer\./);
});

test("M328 completing a booking makes the next person start a new booking", () => {
  const flow = bookingFlowHarness();
  const state = { bookings: [], targetBookingId: null, decisionBookingId: null };
  flow.addToTargetOrNew(state, { name: "Person 1" });
  flow.activateDecisionBooking(state);
  flow.addToTargetOrNew(state, { name: "Person 2" });
  flow.completeBookingFlow(state);
  flow.addToTargetOrNew(state, { name: "Person 3" });
  assert.equal(state.bookings.length, 2);
  assert.equal(state.bookings[0].participants.length, 2);
  assert.equal(state.bookings[1].participants.length, 1);
  assert.equal(state.targetBookingId, null);
  assert.equal(state.decisionBookingId, "booking-2");
  assert.match(registrationSource, /<strong>Neue Buchung<\/strong><span>Die nächste ausgewählte Person startet eine neue Buchung\.<\/span>/);
});

test("M328 reactivates an existing card and activates a new group immediately", () => {
  const flow = bookingFlowHarness();
  const state = { bookings: [], targetBookingId: null, decisionBookingId: null };
  flow.addToTargetOrNew(state, { name: "Einzelperson" });
  flow.completeBookingFlow(state);
  assert.equal(flow.activateBooking(state, "booking-1"), true);
  flow.addToTargetOrNew(state, { name: "Weitere Person" });
  assert.equal(state.bookings[0].participants.length, 2);
  flow.completeBookingFlow(state);
  flow.addManyToTargetOrNew(state, [{ name: "Gruppe 1" }, { name: "Gruppe 2" }]);
  assert.equal(state.bookings.length, 2);
  assert.equal(state.targetBookingId, "booking-2");
  assert.equal(state.bookings[1].participants.length, 2);
});

test("M328 treats a guest consistently in new and active bookings", () => {
  const flow = bookingFlowHarness();
  const state = { bookings: [], targetBookingId: null, decisionBookingId: null };
  flow.addToTargetOrNew(state, { name: "Gast 1", source: "GUEST" });
  assert.equal(state.decisionBookingId, "booking-1");
  flow.activateDecisionBooking(state);
  flow.addToTargetOrNew(state, { name: "Gast 2", source: "GUEST" });
  assert.equal(state.bookings.length, 1);
  assert.equal(state.bookings[0].participants.length, 2);
});

test("M328 uses only the non-wrapping booking completion action", () => {
  const bookingCard = registrationSource.match(/function bookingCard\(state, booking, bookingIndex\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(bookingCard, /Speichern|verwerfen/i);
  assert.match(registrationSource, /data-m328-reg3-target-complete>Buchung abschließen<\/button>/);
  assert.doesNotMatch(registrationSource, />Fertig<\/button>|data-m328-reg3-target-done/);
  assert.match(registrationSource, /\.m328-reg3-target-action\{[^}]*white-space:nowrap/);
  assert.match(registrationSource, /@media\(max-width:520px\)\{\.m328-reg3-target\{[^}]*flex-direction:column/);
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
