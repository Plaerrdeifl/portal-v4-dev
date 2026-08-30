import assert from "node:assert/strict";
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

test("M327 trip boarding stop readers expose central address and default note", () => {
  assert.match(migration, /create or replace function app_private\.api_fanbus_trip_boarding_stops_list/);
  assert.match(migration, /create or replace function public\.pd_public_fanbus_trip_boarding_stops/);
  assert.equal((migration.match(/'address', stop\.address/g) || []).length, 2);
  assert.equal((migration.match(/'defaultNote', stop\.default_note/g) || []).length, 2);
  assert.match(migration, /'tripNote', trip_stop\.trip_note/);
});

test("M327 public boarding stop reader remains limited to published public trips", () => {
  assert.match(migration, /trip\.status = 'PUBLISHED'/);
  assert.match(migration, /event\.visibility = 'PUBLIC'/);
  assert.match(migration, /trip_stop\.is_active/);
  assert.match(migration, /grant execute on function public\.pd_public_fanbus_trip_boarding_stops\(uuid\)/);
});

test("M327 expanded trip cards render address, central hint and optional trip hint", () => {
  assert.match(details, /data-m310-inline-trip-detail/);
  assert.match(details, /\.v4-m325-trip-stops/);
  assert.match(details, /stop\?\.address/);
  assert.match(details, /stop\?\.defaultNote/);
  assert.match(details, /stop\?\.tripNote/);
  assert.doesNotMatch(details, /`Hinweis: \$\{defaultNote\}`/);
  assert.match(details, /Fragen\\s\*&\\s\*Anmeldung:/);
  assert.match(details, /m327-trip-stop-note-label/);
  assert.match(details, /m327-trip-stop-note-value/);
  assert.match(details, /Fahrthinweis/);
  assert.match(details, /normalizedText\(tripNote\) !== normalizedText\(defaultNote\)/);
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
    /\.\/m327-boarding-stop-details\.js\?v=20260830-m327-stop-details1/
  );
  assert.match(pages, /"setupM327BoardingStopDetails"/);
});
