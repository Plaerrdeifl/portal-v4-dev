import assert from "node:assert/strict";
import test from "node:test";

import {
  createFanbusRegistrationsWorkbook,
  fanbusRegistrationExportRows,
  fanbusRegistrationsFilename
} from "../js/modules/fanbus-xlsx.js";

const trip = {
  displayTitle: "Auswärtsfahrt nach Landsberg",
  opponentName: "HC Landsberg Riverkings",
  venue: "Landsberg am Lech",
  eventDate: "2026-10-03",
  departureAt: "2026-10-03T14:30:00.000Z",
  capacity: 50
};

const registrations = [
  {
    id: "00000000-0000-4000-8000-000000000003",
    status: "CANCELLED",
    firstName: "Clara",
    lastName: "Gast",
    email: "clara@example.test",
    busPreference: "EGAL",
    source: "GUEST",
    registeredAt: "2026-09-01T08:00:00.000Z",
    cancelledAt: "2026-09-02T09:00:00.000Z"
  },
  {
    id: "00000000-0000-4000-8000-000000000001",
    memberId: "10000000-0000-4000-8000-000000000001",
    portalUserId: "20000000-0000-4000-8000-000000000001",
    status: "ACTIVE",
    firstName: "Anna",
    lastName: "Mitglied",
    email: "anna@example.test",
    busPreference: "RUHIG",
    source: "MANUAL",
    registeredAt: "2026-09-03T08:00:00.000Z",
    cancelledAt: null
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    portalUserId: "20000000-0000-4000-8000-000000000002",
    status: "ACTIVE",
    firstName: "Berta",
    lastName: "Portal",
    email: "berta@example.test",
    busPreference: "PARTY",
    source: "PORTAL",
    registeredAt: "2026-09-04T08:00:00.000Z",
    cancelledAt: null
  }
];

test("M310 XLSX rows include active and cancelled registrations in operational order", () => {
  const rows = fanbusRegistrationExportRows(registrations);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row[0]), ["Aktiv", "Aktiv", "Storniert"]);
  assert.deepEqual(rows.map(row => row[2]), ["Anna", "Berta", "Clara"]);
});

test("M310 XLSX maps person type, bus preference and registration source", () => {
  const rows = fanbusRegistrationExportRows(registrations);
  assert.deepEqual(rows.map(row => row[3]), ["Mitglied", "Portal-Nutzer", "Gast"]);
  assert.deepEqual(rows.map(row => row[5]), ["Ruhig", "Party", "Egal"]);
  assert.deepEqual(rows.map(row => row[6]), ["Manuell", "Portal", "Gast"]);
});

test("M310 export filename is safe and recognizable", () => {
  assert.equal(
    fanbusRegistrationsFilename(trip),
    "Fanbus_2026-10-03_HC-Landsberg-Riverkings_Anmeldungen.xlsx"
  );
});

test("M310 export is an actual XLSX ZIP document with usable worksheet metadata", async () => {
  const workbook = createFanbusRegistrationsWorkbook(trip, registrations);
  assert.equal(
    workbook.type,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  const bytes = new Uint8Array(await workbook.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);

  const packageText = new TextDecoder().decode(bytes);
  assert.match(packageText, /\[Content_Types\]\.xml/);
  assert.match(packageText, /xl\/worksheets\/sheet1\.xml/);
  assert.match(packageText, /sheet name="Anmeldungen"/);
  assert.match(packageText, /state="frozen"/);
  assert.match(packageText, /<autoFilter ref="A8:I11"\/>/);
  assert.match(packageText, /Aktiv/);
  assert.match(packageText, /Storniert/);
  assert.doesNotMatch(packageText, /00000000-0000-4000-8000-00000000000/);
  assert.doesNotMatch(packageText, /(?:^|\r?\n)Status,Nachname,Vorname,/);
});
