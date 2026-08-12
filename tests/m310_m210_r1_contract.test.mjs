import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

const [fanbuses, dates, css, migration] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("js/modules/dates.js"),
  read("css/app.css"),
  read("supabase/migrations/20260812223000_open_fanbus_registration_on_publish_m310_r1.sql")
]);

test("M310 mobile card exposes one primary status and one capacity value", () => {
  assert.match(fanbuses, /function mobileTripStatus\(trip\)/);
  assert.match(fanbuses, /if \(trip\.status === "DRAFT"\) return \{ label: "Entwurf"/);
  assert.match(fanbuses, /NOT_STARTED: \{ label: "Startet später"/);
  assert.match(fanbuses, /v4-m310-mobile-trip-meta[\s\S]+mobileTripStatusBadge\(trip\)/);
  assert.doesNotMatch(fanbuses, /v4-m310-mobile-trip[\s\S]{0,900}tripBadges\(trip\)/);
  assert.match(fanbuses, /Kapazität offen/);
  assert.match(css, /v4-m310-mobile-trip-title[\s\S]+-webkit-line-clamp:2/);
  assert.match(css, /v4-m310-mobile-trip>\.v4-row-chevron/);
});

test("M310 editor removes the manual start field and defaults the close date in Berlin calendar days", () => {
  assert.match(fanbuses, /Treffpunkt \/ Abfahrtsort/);
  assert.doesNotMatch(fanbuses, /name="registrationOpensAt"/);
  assert.doesNotMatch(fanbuses, />Anmeldung startet/);
  assert.match(fanbuses, /function defaultRegistrationClosesInput\(departureAt\)/);
  assert.match(fanbuses, /Number\(match\[3\]\) - 3/);
  assert.match(fanbuses, /T20:00/);
  assert.doesNotMatch(fanbuses, /registrationOpensAt: berlinLocalToIso/);
  assert.match(css, /:has\(#m310TripEditorForm\)[\s\S]+overflow-y:auto/);
});

test("M310 keeps an unsaved default auto-managed until the close field is edited", () => {
  assert.match(fanbuses, /let registrationClosesAutoManaged = !trip\.registrationClosesAt/);
  assert.match(
    fanbuses,
    /registrationCloses\?\.addEventListener\("input", disableRegistrationClosesAutoManagement\)/
  );
  assert.match(
    fanbuses,
    /registrationCloses\?\.addEventListener\("change", disableRegistrationClosesAutoManagement\)/
  );
  assert.match(
    fanbuses,
    /if \(!registrationCloses \|\| !registrationClosesAutoManaged \|\| !departure\.value\) return/
  );
  assert.match(
    fanbuses,
    /registrationCloses\.value = defaultRegistrationClosesInput\([\s\S]+berlinLocalToIso\(departure\.value/
  );
});

test("M310 publish sets the registration opening time on the server and published updates preserve it", () => {
  assert.match(migration, /v_published_at timestamptz;/);
  assert.doesNotMatch(migration, /v_published_at timestamptz := clock_timestamp\(\)/);
  const publishStart = migration.indexOf("create or replace function app_private.api_fanbus_trip_publish");
  const rowLock = migration.indexOf("for update", publishStart);
  const completeness = migration.indexOf(
    "Die Fanbusfahrt ist für die Veröffentlichung unvollständig.",
    publishStart
  );
  const publishedAt = migration.indexOf("v_published_at := clock_timestamp();", publishStart);
  assert.ok(rowLock !== -1 && completeness !== -1 && publishedAt > completeness && completeness > rowLock);
  assert.match(migration, /registration_opens_at = v_published_at/);
  assert.match(migration, /v_existing\.registration_closes_at <= v_published_at/);
  assert.match(migration, /when v_existing\.status = 'PUBLISHED' then v_existing\.registration_opens_at/);
  assert.match(migration, /require_capability\('fanbus\.manage'\)/);
  assert.match(migration, /v_existing\.status <> 'DRAFT'/);
  assert.match(migration, /v_expected_revision <> v_existing\.revision/);
  assert.match(migration, /'FANBUS_TRIP_PUBLISHED'/);
});

test("M210 mobile metadata is compact and home-away filtering composes with existing filters", () => {
  assert.match(dates, /let homeAwayFilter = "ALL"/);
  assert.match(dates, /event\.eventType === "GAME" \? homeAwayLabel\(event\.homeAway\) : typeLabel/);
  assert.doesNotMatch(dates, /event\.eventType === "GAME" && event\.homeAway \? ` ·/);
  assert.match(dates, /id="m210EventHomeAwayFilter"/);
  assert.match(dates, /matchesHomeAway = homeAwayFilter === "ALL"/);
  assert.match(dates, /matchesType && matchesVisibility && matchesHomeAway/);
  assert.match(css, /v4-m210-mobile-event-title[\s\S]+-webkit-line-clamp:2/);
});
