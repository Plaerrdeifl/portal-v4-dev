import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const bookings = read("../js/modules/bus-orga-bookings.js");
const participantDialogs = read("../js/modules/bus-orga-participant-dialogs.js");
const participants = read("../js/modules/bus-orga-participants.js");
const workspaces = read("../js/modules/bus-orga-trip-workspaces.js");
const pages = read("../js/pages.js");
const migration = read("../supabase/migrations/20260924153153_fanbus_identity_search_short_names.sql");
const filterFixMigration = read("../supabase/migrations/20260924161551_fanbus_booking_append_and_identity_filter_fix.sql");

test("known-person picker filters categories, searches names and removes duplicates", () => {
  const start = bookings.indexOf("async function openAddPerson");
  const end = bookings.indexOf("async function setPrimaryPerson", start);
  const block = bookings.slice(start, end);

  for (const filter of ["ALL", "MEMBER", "REGULAR_RIDER", "PORTAL_USER"]) {
    assert.match(block, new RegExp(`data-m328-known-filter="${filter}"`));
  }
  assert.match(block, /data-m328-known-query/);
  assert.match(block, /personName\(item\.person\)\.toLocaleLowerCase\("de-DE"\)\.includes\(query\)/);
  assert.match(block, /representedPortalIds/);
  assert.match(block, /!representedPortalIds\.has\(person\.portalUserId\)/);
  assert.match(block, /bookedIdentityKeys\(state, riders\)/);
  assert.match(block, /!personAlreadyBooked\(person, currentIdentityKeys\)/);
  assert.match(bookings, /effectiveIdentityKey/);
  assert.match(bookings, /linkedPortalUserId/);
  assert.match(filterFixMigration, /'regularRiderId',\s*registration\.regular_rider_id/);
});

test("operator append sends the exact backend contract", () => {
  const start = bookings.indexOf("function appendParticipantPayload");
  const end = bookings.indexOf("async function openAddPerson", start);
  const block = bookings.slice(start, end);

  assert.match(block, /idempotencyKey: crypto\.randomUUID\(\)/);
  assert.match(block, /consentConfirmed: true/);
  assert.match(block, /source: "GUEST"/);
  assert.match(block, /boardingStopId/);
  assert.match(block, /busPreference/);
  assert.match(block, /participant: payload/);
  assert.doesNotMatch(block, /tripBoardingStopId:/);
});

test("booking portal-user assignment accepts two-character prefixes", () => {
  assert.match(participantDialogs, /minlength="2" maxlength="120"/);
  assert.match(participantDialogs, /query\.length < 2/);
  assert.match(participantDialogs, /Mindestens 2 Zeichen eingeben\./);
  assert.doesNotMatch(participantDialogs, /query\.length < 5/);

  assert.match(migration, /api_fanbus_registration_identity_search/);
  assert.match(migration, /require_capability\([\s\S]*'fanbus\.participant_identity\.manage'/);
  assert.match(migration, /pg_catalog\.length\(v_query\) < 2/);
  assert.match(migration, /pg_catalog\.length\(token\.value\) < 2/);
  assert.match(migration, /consume_companion_person_search_rate_limit\(v_actor\)/);
  assert.match(migration, /m325_portal_people_search\(v_query\)/);
  assert.doesNotMatch(migration, /api_fanbus_companion_person_search/);
});

test("cache-bust chain reaches both changed fanbus dialogs", () => {
  assert.match(pages, /bus-orga-bookings\.js[^"]*knownpeople=20260924-r2&appendfix=20260924-r1/);
  assert.match(pages, /bus-orga-trip-workspaces\.js[^"]*identitysearch=20260924-r1/);
  assert.match(workspaces, /bus-orga-participants\.js[^"]*identitysearch=20260924-r1/);
  assert.match(participants, /bus-orga-participant-dialogs\.js[^"]*identitysearch=20260924-r1/);
});
