import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath = "supabase/migrations/20260907185349_add_fanbus_auto_place_resolution_m340.sql";
const [migration, publishing, sqlTest] = await Promise.all([
  fs.readFile(path.join(root, migrationPath), "utf8"),
  fs.readFile(path.join(root, "js/modules/m340-publishing.js"), "utf8"),
  fs.readFile(path.join(root, "supabase/tests/m340_auto_place_resolution.sql"), "utf8")
]);

function block(signature, endMarker) {
  const start = migration.indexOf(signature);
  assert.notEqual(start, -1, `${signature} fehlt`);
  const end = migration.indexOf(endMarker, start + signature.length);
  assert.notEqual(end, -1, `${endMarker} nach ${signature} fehlt`);
  return migration.slice(start, end);
}

test("new additive migration preserves historical migrations", () => {
  assert.match(migrationPath, /^supabase\/migrations\/\d{14}_/);
  assert.match(migration, /begin;[\s\S]*commit;/);
  assert.doesNotMatch(migration, /drop\s+(table|function)|truncate/i);
});

test("central resolver is server-side, atomic, idempotent and capability-gated", () => {
  const resolver = block(
    "create function app_private.fanbus_publishing_ensure_event_place",
    "create function app_private.api_fanbus_publishing_resolution_ensure"
  );
  assert.match(resolver, /from app_modules\.events[\s\S]*for update/);
  assert.match(resolver, /pg_advisory_xact_lock/);
  assert.match(resolver, /fanbus_publishing_normalize_place_key/);
  assert.match(resolver, /fanbus_publishing_resolution_aliases/);
  assert.match(resolver, /on conflict \(event_id\) do update/);
  assert.match(resolver, /'status', 'RESOLVED'/);
  assert.match(resolver, /'status', 'AMBIGUOUS'/);
  assert.match(resolver, /'status', 'MISSING_VENUE'/);
  assert.match(migration, /api_fanbus_publishing_resolution_(ensure|choose)[\s\S]*require_capability\('fanbus\.publishing\.manage'\)/);
});

test("migration backfill and collision handling are conservative", () => {
  assert.match(migration, /do \$m340_auto_place_backfill\$[\s\S]*event\.visibility = 'PUBLIC'[\s\S]*trip\.status = 'PUBLISHED'[\s\S]*fanbus_publishing_ensure_event_place\([\s\S]*null/);
  assert.match(migration, /M340_PUBLISHING_ALIAS_COLLISION/);
  assert.match(migration, /M340_PUBLISHING_SLUG_COLLISION/);
  assert.match(migration, /fanbus_publishing_jobs[\s\S]*fanbus_publishing_place_landing_daily[\s\S]*fanbus_publishing_trip_referral_daily[\s\S]*delete from app_modules\.fanbus_publishing_places/);
  assert.match(sqlTest, /M340_AUTO_HISTORICAL_ALIAS_REPAIR_OK/);
  assert.match(sqlTest, /M340_AUTO_SAME_VENUE_OK/);
  assert.match(sqlTest, /M340_AUTO_VENUE_CHANGE_OK/);
});

test("known aliases are evaluated before exact keys", () => {
  assert.match(migration, /'v1:landsberg-am-lech',[\s\S]*'v1:landsberg',[\s\S]*'landsberg',[\s\S]*'Landsberg'/);
  const resolver = block(
    "create function app_private.fanbus_publishing_ensure_event_place",
    "create function app_private.api_fanbus_publishing_resolution_ensure"
  );
  const aliasLookup = resolver.indexOf("fanbus_publishing_resolution_aliases");
  const exactLookup = resolver.indexOf("fanbus_publishing_place_keys", aliasLookup);
  assert.ok(aliasLookup >= 0 && exactLookup > aliasLookup, "Alias muss vor exaktem Place-Key geprüft werden");
  assert.match(resolver, /FANBUS_PUBLISHING_PLACE_AUTO_CREATED/);
  assert.match(resolver, /FANBUS_PUBLISHING_EVENT_PLACE_AUTO_RESOLVED/);
});

test("ambiguity rules are explicit, complete and cannot have loose candidates", () => {
  assert.match(migration, /resolution_kind\s+text\s+not null/);
  assert.match(migration, /resolution_kind in \('CANONICAL', 'AMBIGUOUS'\)/);
  assert.match(migration, /foreign key \(alias_place_key, resolution_kind\)[\s\S]*fanbus_publishing_resolution_aliases/);
  assert.match(migration, /fanbus_publishing_assert_resolution_rule[\s\S]*count\(\*\)[\s\S]*< 2/);
  assert.match(migration, /constraint trigger fanbus_publishing_resolution_aliases_complete/);
  assert.match(migration, /constraint trigger fanbus_publishing_alias_candidates_complete/);
  assert.match(sqlTest, /M340_AUTO_AMBIGUITY_SOURCE_OK/);
  assert.match(sqlTest, /M340_AUTO_AMBIGUITY_INCOMPLETE_OK/);
  assert.match(sqlTest, /set constraints[\s\S]*fanbus_publishing_resolution_aliases_complete[\s\S]*immediate/);
});

test("ambiguity choice validates candidates, persists a canonical rule and audits", () => {
  const choose = block(
    "create function app_private.api_fanbus_publishing_resolution_choose",
    "alter function app_private.api_fanbus_publishing_job_enqueue"
  );
  assert.match(choose, /fanbus_publishing_alias_candidates[\s\S]*count\(\*\)[\s\S]*< 2/);
  assert.match(choose, /insert into app_modules\.fanbus_publishing_place_keys/);
  assert.match(choose, /delete from app_modules\.fanbus_publishing_alias_candidates/);
  assert.match(choose, /update app_modules\.fanbus_publishing_resolution_aliases[\s\S]*resolution_kind = 'CANONICAL'/);
  assert.match(choose, /FANBUS_PUBLISHING_PLACE_AMBIGUITY_RESOLVED/);
  assert.doesNotMatch(choose, /p_payload\s*->>\s*'(?:slug|displayName)'/);
});

test("enqueue always resolves first and blocks unresolved jobs", () => {
  const enqueue = block(
    "create function app_private.api_fanbus_publishing_job_enqueue(p_payload jsonb)",
    "create or replace function app_private.api_fanbus_publishing_overview"
  );
  assert.match(enqueue, /fanbus_publishing_ensure_event_place/);
  assert.match(enqueue, /M340_PUBLISHING_PLACE_AMBIGUOUS/);
  assert.match(enqueue, /M340_PUBLISHING_VENUE_MISSING/);
  assert.match(enqueue, /api_fanbus_publishing_job_enqueue_before_auto_place_resolution/);
});

test("pd_api exposes only auto-resolution actions and deprecates manual place mutations", () => {
  const dispatch = block(
    "create function app_private.pd_api_dispatch_current(",
    "alter function app_private.platform_action_classification"
  );
  assert.match(dispatch, /fanbus_publishing_resolution_ensure/);
  assert.match(dispatch, /fanbus_publishing_resolution_choose/);
  assert.match(dispatch, /M340_PUBLISHING_MANUAL_PLACE_API_DEPRECATED/g);
  assert.match(migration, /when 'fanbus_publishing_resolution_ensure' then 'USER_MUTATION'/);
  assert.match(migration, /when 'fanbus_publishing_resolution_choose' then 'USER_MUTATION'/);
});

test("internal resolver tables remain default-deny", () => {
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all on table[\s\S]*fanbus_publishing_resolution_aliases[\s\S]*fanbus_publishing_alias_candidates[\s\S]*from public, anon, authenticated, service_role/);
  assert.doesNotMatch(migration, /grant\s+(select|insert|update|delete|all)\s+on\s+(table\s+)?app_modules/i);
});

test("portal branches only for real ambiguity and never accepts free place data", () => {
  assert.match(publishing, /resolutionStatus === "RESOLVED"/);
  assert.match(publishing, /resolutionStatus === "AMBIGUOUS"[\s\S]*data-m340-ambiguity-form/);
  assert.match(publishing, /Veranstaltungsort fehlt/);
  assert.match(publishing, /call\("fanbus_publishing_resolution_choose", \{ eventId, placeId \}\)/);
  assert.doesNotMatch(publishing, /name="slug"|name="displayName"|name="sourceLabel"/);
});

test("SQL regression suite contains mandatory A-J scenarios", () => {
  for (const marker of [
    "M340_AUTO_LANDSBERG_OK", "M340_AUTO_LANDSBERG_ALIAS_OK",
    "M340_AUTO_INACTIVE_CANONICAL_OK",
    "M340_AUTO_BAYREUTH_OK", "M340_AUTO_IDEMPOTENCY_OK", "M340_AUTO_SAME_VENUE_OK",
    "M340_AUTO_VENUE_CHANGE_OK", "M340_AUTO_HISTORICAL_ALIAS_REPAIR_OK",
    "M340_AUTO_KNOWN_ALIAS_OK", "M340_AUTO_AMBIGUOUS_OK",
    "M340_AUTO_INACTIVE_CANDIDATE_OK",
    "M340_AUTO_CHOICE_OK", "M340_AUTO_MISSING_VENUE_OK",
    "M340_AUTO_MANUAL_API_DEPRECATED_OK", "M340_AUTO_ENQUEUE_GUARD_OK"
  ]) assert.match(sqlTest, new RegExp(marker));
  assert.match(sqlTest, /^begin;[\s\S]*rollback;\s*$/m);
});
