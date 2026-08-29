import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../supabase/migrations/20260829225223_m328_fanbus_draft_defaults.sql");
const tripEdit = read("../js/modules/bus-orga-trip-edit.js");
const busOrga = read("../js/modules/bus-orga-v3.js");

test("M328 new fanbus drafts receive the agreed automatic defaults", () => {
  assert.match(migration, /v_departure_local := \(v_event_date \+ v_event_time\) - interval '4 hours'/);
  assert.match(migration, /v_registration_closes_at := \(\(v_departure_local::date - 3\) \+ time '20:00'\) at time zone 'Europe\/Berlin'/);
  assert.match(migration, /lower\(btrim\(stop\.label\)\) = 'icedome'/);
  assert.match(migration, /lower\(btrim\(stop\.label\)\) = 'pendlerparkplatz'/);
  assert.match(migration, /v_departure_at - interval '30 minutes', 1, true/);
  assert.match(migration, /v_trip_id, v_icedome_id, v_departure_at, 2, true/);
  assert.match(migration, /default_boarding_stop_id,[\s\S]*bus_preference_enabled/);
  assert.match(migration, /v_icedome_id,[\s\S]*false,[\s\S]*v_actor/);
  assert.match(migration, /registration_opens_at,[\s\S]*null,[\s\S]*v_registration_closes_at/);
});

test("M328 trip editor no longer exposes or submits a registration start", () => {
  assert.doesNotMatch(tripEdit, /name="registrationOpensAt"/);
  assert.doesNotMatch(tripEdit, /Anmeldung beginnt/);
  assert.doesNotMatch(tripEdit, /Anmeldung geöffnet seit/);
  assert.doesNotMatch(tripEdit, /registrationOpensAt:/);
  assert.match(tripEdit, /name="registrationClosesAt"/);
});

test("M328 booking gear actions stay horizontal", () => {
  assert.match(busOrga, /\.m328-reg3-booking-menu\{[\s\S]*?display:flex!important;[\s\S]*?flex-direction:row!important;[\s\S]*?flex-wrap:nowrap!important;/);
  assert.match(busOrga, /\.m328-reg3-booking-menu \.button\{[\s\S]*?width:auto!important;[\s\S]*?flex:0 0 auto!important;/);
});
