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

function cssRule(selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `CSS-Selektor fehlt: ${selector}`);
  const openingBrace = css.indexOf("{", start);
  const closingBrace = css.indexOf("}", openingBrace);
  return css.slice(openingBrace + 1, closingBrace);
}

function assertTwoLineMobileTitle(selector) {
  const rule = cssRule(selector);
  assert.match(rule, /display:\s*-webkit-box/);
  assert.match(rule, /-webkit-box-orient:\s*vertical/);
  assert.match(rule, /-webkit-line-clamp:\s*2/);
  assert.match(rule, /white-space:\s*normal/);
  assert.match(rule, /text-overflow:\s*clip/);
  assert.match(rule, /overflow:\s*hidden/);
  assert.match(rule, /min-width:\s*0/);
  assert.doesNotMatch(rule, /white-space:\s*nowrap/);
  assert.doesNotMatch(rule, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(rule, /(?:^|;)\s*(?:height|max-height)\s*:/);
}

test("M310 mobile card exposes one primary status and one capacity value", () => {
  assert.match(fanbuses, /function mobileTripStatus\(trip\)/);
  assert.match(fanbuses, /if \(trip\.status === "DRAFT"\) return \{ label: "Entwurf"/);
  assert.match(fanbuses, /NOT_STARTED: \{ label: "Startet später"/);
  assert.match(fanbuses, /v4-m310-mobile-trip-meta[\s\S]+mobileTripStatusBadge\(trip\)/);
  assert.doesNotMatch(fanbuses, /v4-m310-mobile-trip[\s\S]{0,900}tripBadges\(trip\)/);
  assert.match(fanbuses, /Kapazität offen/);
  assertTwoLineMobileTitle("#m310FanbusList .v4-m310-mobile-trip-title");
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

test("M310 editor remains content-sized and only scrolls when viewport space is exhausted", () => {
  const dialog = cssRule(".v4-dialog:has(#m310TripEditorForm)");
  const shell = cssRule(".v4-dialog:has(#m310TripEditorForm) .v4-dialog-shell");
  const body = cssRule(".v4-dialog:has(#m310TripEditorForm) #v4DialogBody");

  assert.match(dialog, /(?:^|;)\s*height:\s*auto!important/);
  assert.match(dialog, /max-height:\s*calc\(100dvh[^;]+safe-area-inset-top[^;]+safe-area-inset-bottom/);
  assert.match(shell, /(?:^|;)\s*height:\s*auto!important/);
  assert.match(shell, /max-height:\s*calc\(100dvh[^;]+safe-area-inset-top[^;]+safe-area-inset-bottom/);
  assert.doesNotMatch(shell, /(?:^|;)\s*height:\s*calc\(100dvh/);
  assert.match(body, /flex:\s*0 1 auto!important/);
  assert.match(body, /(?:^|;)\s*height:\s*auto!important/);
  assert.match(body, /min-height:\s*0!important/);
  assert.match(body, /overflow-y:\s*auto!important/);
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
  assertTwoLineMobileTitle(
    "#m210DatesList .v4-compact-record.v4-m210-mobile-event .v4-m210-mobile-event-title"
  );
});
