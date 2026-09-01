import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20260830172000_m327_boarding_stop_public_details.sql", import.meta.url),
  "utf8"
);
const details = readFileSync(
  new URL("../js/m327-boarding-stop-details.js", import.meta.url),
  "utf8"
);
const pages = readFileSync(new URL("../js/pages.js", import.meta.url), "utf8");

const testableDetails = details.replace(
  'import { call, hasCapability } from "./modules/common.js";',
  "const call = async () => ({});\nconst hasCapability = () => false;"
);
const detailsModule = await import(
  `data:text/javascript;base64,${Buffer.from(testableDetails).toString("base64")}`
);
const { m327StructuredNoteParts } = detailsModule;

const muennerstadtStop = {
  label: "Pendlerparkplatz",
  address: "Münnerstadt",
  defaultNote: "Infos & telefonische Anmeldung:\n\nLuca: 0174 6681046"
};

const schweinfurtStop = {
  label: "Icedome",
  address: "Schweinfurt",
  defaultNote: "Infos & telefonische Anmeldung:\nPascal: 0172 9744908"
};

test("M327 trip boarding stop readers expose central address and default note", () => {
  assert.match(migration, /create or replace function app_private\.api_fanbus_trip_boarding_stops_list/);
  assert.match(migration, /create or replace function public\.pd_public_fanbus_trip_boarding_stops/);
  assert.equal((migration.match(/'address', stop\.address/g) || []).length, 2);
  assert.equal((migration.match(/'defaultNote', stop\.default_note/g) || []).length, 2);
  // R6 keeps the legacy field in the read contract for compatibility; the UI no longer consumes it.
  assert.match(migration, /'tripNote', trip_stop\.trip_note/);
});

test("M327 public boarding stop reader remains limited to published public trips", () => {
  assert.match(migration, /trip\.status = 'PUBLISHED'/);
  assert.match(migration, /event\.visibility = 'PUBLIC'/);
  assert.match(migration, /trip_stop\.is_active/);
  assert.match(migration, /grant execute on function public\.pd_public_fanbus_trip_boarding_stops\(uuid\)/);
});

test("M327 recognizes current PROD contact notes for Luca and Pascal", () => {
  assert.deepEqual(m327StructuredNoteParts(muennerstadtStop.defaultNote), {
    label: "Infos & telefonische Anmeldung:",
    value: "Luca: 0174 6681046",
    contact: { name: "Luca", phone: "0174 6681046" }
  });
  assert.deepEqual(m327StructuredNoteParts(schweinfurtStop.defaultNote), {
    label: "Infos & telefonische Anmeldung:",
    value: "Pascal: 0172 9744908",
    contact: { name: "Pascal", phone: "0172 9744908" }
  });
});

test("M327 expanded trip cards use the central boarding-stop note as the single note source", () => {
  assert.match(details, /data-m310-inline-trip-detail/);
  assert.match(details, /\.v4-m325-trip-stops/);
  assert.match(details, /stop\?\.address/);
  assert.match(details, /stop\?\.defaultNote/);
  assert.doesNotMatch(details, /stop\?\.tripNote/);
  assert.doesNotMatch(details, /Fahrthinweis/);
  assert.doesNotMatch(details, /SemanticDuplicateTripNote/);
  assert.doesNotMatch(details, /`Hinweis: \$\{defaultNote\}`/);
  assert.match(details, /Infos\\s\*&\\s\*telefonische\\s\+Anmeldung/);
  assert.match(details, /Fragen\\s\*&\\s\*Anmeldung/);
  assert.match(details, /m327-trip-stop-note-label/);
  assert.match(details, /m327-trip-stop-contact-line/);
  assert.match(details, /m327-trip-stop-contact-name/);
  assert.match(details, /m327-trip-stop-contact-phone/);
});

test("M327 mobile contact layout keeps phone numbers readable without forced user-text caps", () => {
  assert.match(details, /m327-trip-stop-contact-line\{display:flex;flex-wrap:wrap/);
  assert.match(details, /m327-trip-stop-contact-phone\{white-space:nowrap;overflow-wrap:normal;word-break:normal/);
  assert.match(details, /m327-trip-stop-address,.m327-trip-stop-note\{[^}]*overflow-wrap:break-word;word-break:normal;text-transform:none/);
});

test("M327 boarding stop detail enhancement only uses existing read contracts", () => {
  assert.match(details, /call\("fanbus_trip_boarding_stops_list", \{ tripId \}\)/);
  assert.match(details, /call\("fanbus_trip_boarding_stops_public", \{ tripId \}\)/);
  assert.doesNotMatch(details, /fanbus_trip_boarding_stops_set|fanbus_boarding_stop_(?:create|update|delete)/);
  assert.match(details, /vorhandene kompakte Zeit-\/Namensanzeige bleibt als Fallback/);
});

test("M327 boarding stop detail enhancement is explicitly versioned", () => {
  assert.match(
    pages,
    /\.\/m327-boarding-stop-details\.js\?v=20260901-m327-stop-details-hotfix1/
  );
  assert.match(pages, /"setupM327BoardingStopDetails"/);
});
