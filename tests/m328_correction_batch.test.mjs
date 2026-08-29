import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const registrationSource = read("../js/modules/bus-orga-registration-v3.js");
const nativeSource = read("../js/modules/bus-orga-v3.js");
const pagesSource = read("../js/pages.js");

function extractedFunction(name) {
  const block = registrationSource.match(new RegExp(`(?:async )?function ${name}\\([^]*?^\\}`, "m"))?.[0];
  assert.ok(block, `function ${name} must exist`);
  return block;
}

function duplicateHarness() {
  const source = [
    "normalizedDuplicateValue",
    "participantDuplicateKeys",
    "registrationDuplicateKeys",
    "duplicateConflicts",
    "duplicateBookingMessage",
    "isDuplicateSubmissionError"
  ].map(extractedFunction).join("\n");
  return Function(`${source}
    const personName = person => [person.firstName, person.lastName].filter(Boolean).join(" ");
    return { duplicateConflicts, duplicateBookingMessage, isDuplicateSubmissionError };
  `)();
}

test("M328 inactive prepared bookings are read-only until gear edit is chosen", () => {
  assert.match(nativeSource, /\.m328-reg3-booking:not\(\.is-active-booking\)\{[^}]*cursor:default/);
  assert.match(nativeSource, /\.m328-reg3-booking-overview-person\{[^}]*cursor:default/);
  assert.doesNotMatch(nativeSource, /\.m328-reg3-booking:not\(\.is-active-booking\) \.m328-reg3-booking-overview-person:hover/);
  assert.doesNotMatch(registrationSource, /querySelectorAll\("\[data-m328-reg3-booking-card\]"\).*addEventListener\("click"/s);
  assert.doesNotMatch(registrationSource, /data-m328-reg3-open-participant/);
  assert.match(registrationSource, /data-m328-reg3-booking-settings/);
  assert.match(registrationSource, /data-m328-reg3-edit-booking/);
  assert.match(registrationSource, /data-m328-reg3-remove-booking/);
  assert.match(registrationSource, /activateBooking\(state, button\.dataset\.m328Reg3EditBooking\)/);
});

test("M328 deleting a prepared booking retains the existing state cleanup", () => {
  const removeBooking = Function(`${extractedFunction("removeBooking")}; return removeBooking;`)();
  const state = {
    bookings: [{ clientId: "keep" }, { clientId: "remove" }],
    targetBookingId: "remove",
    decisionBookingId: "remove"
  };
  assert.equal(removeBooking(state, "remove"), true);
  assert.deepEqual(state.bookings, [{ clientId: "keep" }]);
  assert.equal(state.targetBookingId, null);
  assert.equal(state.decisionBookingId, null);
  assert.equal(removeBooking(state, "missing"), false);
});

test("M328 duplicate preflight names every safely matched person and booking", () => {
  const duplicate = duplicateHarness();
  const participants = [
    { firstName: "Benny", lastName: "Teubert", portalUserId: "portal-1" },
    { firstName: "Erika", lastName: "Muster", email: "ERIKA@example.org" }
  ];
  const registrations = [
    { portalUserId: "portal-1", status: "ACTIVE", bookingNumber: "FB-26-000123" },
    { email: "erika@example.org", status: "WAITLISTED", bookingNumber: "FB-26-000124" },
    { portalUserId: "portal-1", status: "CANCELLED", bookingNumber: "FB-26-000099" }
  ];
  const conflicts = duplicate.duplicateConflicts(participants, registrations);
  assert.deepEqual(conflicts, [
    { name: "Benny Teubert", bookingNumber: "FB-26-000123" },
    { name: "Erika Muster", bookingNumber: "FB-26-000124" }
  ]);
  assert.equal(
    duplicate.duplicateBookingMessage(conflicts),
    "Für folgende Personen besteht für diese Fahrt bereits eine Buchung: Benny Teubert (FB-26-000123), Erika Muster (FB-26-000124)."
  );
});

test("M328 final duplicate failures are translated without hiding successful submissions", () => {
  const duplicate = duplicateHarness();
  assert.equal(duplicate.isDuplicateSubmissionError({ code: "P3201", message: "FANBUS_BATCH_DUPLICATE" }), true);
  assert.equal(duplicate.isDuplicateSubmissionError({ code: "23505", message: "fanbus_registrations_active_member_uidx" }), true);
  assert.equal(duplicate.isDuplicateSubmissionError({ code: "23505", message: "fanbus_bookings_booking_number_key" }), false);
  assert.equal(
    duplicate.duplicateBookingMessage([], [{ firstName: "Benny", lastName: "Teubert" }]),
    "Mindestens eine der folgenden Personen besitzt für diese Fahrt bereits eine Buchung: Benny Teubert."
  );
  assert.match(registrationSource, /call\("fanbus_registrations_list", \{ tripId: state\.trip\.id \}\)/);
  assert.match(registrationSource, /preflightConflicts = await currentDuplicateConflicts\(state, participants\)/);
  assert.match(registrationSource, /call\("fanbus_registration_create_manual_batches"/);
  assert.match(registrationSource, /if \(isDuplicateSubmissionError\(error\)\)/);
  assert.match(registrationSource, /\["CREATED", "WAITLISTED"\]\.includes\(result\?\.outcome\)/);
});

test("M328 correction cache busts pages through V3 to its registration submodule", () => {
  assert.equal((pagesSource.match(/correction=20260830-m328-c1/g) || []).length, 1);
  assert.match(pagesSource, /bus-orga-v3\.js\?v=[^"\n]*correction=20260830-m328-c2/);
  assert.match(nativeSource, /bus-orga-registration-v3\.js\?v=[^"\n]*correction=20260830-m328-c1/);
  assert.match(nativeSource, /\.m328-reg3-booking-menu\{[^}]*flex-direction:row!important;[^}]*flex-wrap:nowrap!important;/s);
  assert.match(nativeSource, /\.m328-reg3-booking-menu \.button\{[^}]*width:auto!important;[^}]*flex:0 0 auto!important;/s);
});