import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath = "supabase/migrations/20260906131925_add_fanbus_publishing_foundation_m340.sql";
const sqlTestPath = "supabase/tests/m340_f4_slice1.sql";
const concurrencyRunnerPath = "tests/run-m340-concurrency.sh";

const [migration, sqlTest, concurrencyRunner] = await Promise.all([
  fs.readFile(path.join(root, migrationPath), "utf8"),
  fs.readFile(path.join(root, sqlTestPath), "utf8"),
  fs.readFile(path.join(root, concurrencyRunnerPath), "utf8")
]);

function tableBlock(name) {
  const start = migration.indexOf(`create table app_modules.${name}`);
  assert.notEqual(start, -1, `${name} fehlt`);
  const end = migration.indexOf(";", start);
  return migration.slice(start, end + 1);
}

function functionBlock(signature, nextMarker) {
  const start = migration.indexOf(signature);
  assert.notEqual(start, -1, `${signature} fehlt`);
  const end = migration.indexOf(nextMarker, start + signature.length);
  assert.notEqual(end, -1, `Endmarker für ${signature} fehlt`);
  return migration.slice(start, end);
}

test("M340 creates exactly the frozen Place and aggregate foundation", () => {
  for (const table of [
    "fanbus_publishing_places",
    "fanbus_publishing_place_keys",
    "fanbus_publishing_event_places",
    "fanbus_publishing_place_landing_daily",
    "fanbus_publishing_trip_referral_daily"
  ]) {
    assert.match(migration, new RegExp(`create table app_modules\\.${table} \\(`));
    assert.match(migration, new RegExp(`alter table app_modules\\.${table} enable row level security`));
  }

  assert.match(tableBlock("fanbus_publishing_places"), /slug text not null unique/);
  assert.match(tableBlock("fanbus_publishing_places"), /char_length\(slug\) between 1 and 48/);
  assert.match(tableBlock("fanbus_publishing_places"), /slug ~ '\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$'/);
  assert.match(tableBlock("fanbus_publishing_place_keys"), /place_key text primary key/);
  assert.match(tableBlock("fanbus_publishing_event_places"), /event_id uuid primary key/);
  assert.match(tableBlock("fanbus_publishing_place_landing_daily"), /primary key \(place_id, day\)/);
  assert.match(tableBlock("fanbus_publishing_trip_referral_daily"), /primary key \(place_id, trip_id, day\)/);
});

test("Place normalization V1 is server-owned and ordered exactly", () => {
  const block = functionBlock(
    "create function app_private.fanbus_publishing_normalize_place_key",
    "create function app_private.fanbus_publishing_berlin_day"
  );
  for (const conversion of [
    ["'ä', 'ae'", "'ö', 'oe'"],
    ["'ö', 'oe'", "'ü', 'ue'"],
    ["'ü', 'ue'", "'ß', 'ss'"],
    ["'ß', 'ss'", "'[^a-z0-9]+'"]
  ]) {
    assert.ok(block.indexOf(conversion[0]) < block.indexOf(conversion[1]));
  }
  assert.match(block, /lower\(pg_catalog\.btrim/);
  assert.match(block, /'\[\^a-z0-9\]\+'/);
  assert.match(block, /pg_catalog\.btrim\([\s\S]*'-'/);
  assert.match(block, /'v1:' \|\| normalized\.value/);
});

test("slug permanence and persistent event binding are database-enforced", () => {
  assert.match(migration, /fanbus_publishing_places_guard_locked_slug/);
  assert.match(migration, /old\.slug_locked[\s\S]*new\.slug is distinct from old\.slug/);
  assert.match(migration, /new\.slug_locked is distinct from true/);
  assert.match(migration, /foreign key \(place_id, bound_place_key\)[\s\S]*fanbus_publishing_place_keys\(place_id, place_key\)/);
  assert.match(migration, /select event\.venue[\s\S]*fanbus_publishing_normalize_place_key\(v_venue\)/);
  assert.doesNotMatch(migration, /update app_modules\.events[\s\S]*place/i);
});

test("publishing administration uses only the frozen capability and team function", () => {
  assert.match(migration, /'fanbus\.publishing\.manage'/);
  assert.match(migration, /'BUS_PUBLISHING'/);
  assert.match(migration, /where team\.code = 'BUS_ORGA'/);
  for (const fn of [
    "api_fanbus_publishing_place_create",
    "api_fanbus_publishing_place_key_add",
    "api_fanbus_publishing_event_place_bind"
  ]) {
    const start = migration.indexOf(`create function app_private.${fn}`);
    assert.notEqual(start, -1);
    assert.match(migration.slice(start, start + 900), /require_capability\('fanbus\.publishing\.manage'\)/);
  }
  assert.doesNotMatch(migration, /require_capability\('fanbus\.manage'\)/);
  assert.match(migration, /when 'fanbus_publishing_place_create' then 'USER_MUTATION'/);
  assert.match(migration, /when 'fanbus_publishing_place_key_add' then 'USER_MUTATION'/);
  assert.match(migration, /when 'fanbus_publishing_event_place_bind' then 'USER_MUTATION'/);
});

test("central pd_api dispatcher routes every M340 mutation and classifies it as USER_MUTATION", () => {
  const dispatcher = functionBlock(
    "create function app_private.pd_api_dispatch_current(",
    "alter function app_private.platform_action_classification"
  );
  const classification = functionBlock(
    "create function app_private.platform_action_classification(p_action text)",
    "-- ============================================================\n-- 9. Explizite Funktionsrechte"
  );
  const routes = [
    ["fanbus_publishing_place_create", "api_fanbus_publishing_place_create"],
    ["fanbus_publishing_place_key_add", "api_fanbus_publishing_place_key_add"],
    ["fanbus_publishing_event_place_bind", "api_fanbus_publishing_event_place_bind"]
  ];

  for (const [action, target] of routes) {
    assert.match(
      dispatcher,
      new RegExp(`when '${action}' then\\s+return app_private\\.${target}\\(`)
    );
    assert.match(
      classification,
      new RegExp(`when '${action}' then 'USER_MUTATION'`)
    );
  }
});

test("SQL auth contract uses the complete public pd_api and M010 team-function path", () => {
  const start = sqlTest.indexOf("do $m340_pd_api_authorization$");
  const end = sqlTest.indexOf("$m340_pd_api_authorization$;", start + 1);
  assert.notEqual(start, -1, "M340 pd_api authorization fixture fehlt");
  assert.notEqual(end, -1, "M340 pd_api authorization fixture ist unvollständig");
  const authContract = sqlTest.slice(start, end);

  assert.match(authContract, /where code = 'PORTAL_USER'/);
  assert.match(authContract, /where code = 'BUS_ORGA'/);
  assert.match(authContract, /app_portal\.team_memberships/);
  assert.match(authContract, /app_portal\.team_function_assignments/);
  assert.match(authContract, /'BUS_PUBLISHING'/);
  assert.match(authContract, /has_capability\([\s\S]*'fanbus\.publishing\.manage'/);
  assert.match(
    authContract,
    /has_capability\(v_authorized, 'portal\.admin'\)[\s\S]*has_capability\(v_denied, 'portal\.admin'\)/
  );
  assert.match(authContract, /public\.pd_api\([\s\S]*'fanbus_publishing_place_create'/);
  assert.match(authContract, /public\.pd_api\([\s\S]*'fanbus_publishing_place_key_add'/);
  assert.match(authContract, /public\.pd_api\([\s\S]*'fanbus_publishing_event_place_bind'/);
  assert.match(authContract, /#>> '\{error,code\}'[\s\S]*'42501'/);
  assert.doesNotMatch(authContract, /app_private\.api_fanbus_publishing_/);
});

test("resolver delegates availability to the existing public Fanbus contract", () => {
  const openTrips = functionBlock(
    "create function app_private.fanbus_publishing_open_trips",
    "create function app_private.fanbus_publishing_record_place_landing"
  );
  const resolver = functionBlock(
    "create function public.pd_public_fanbus_ontour_resolve",
    "create function public.pd_public_fanbus_trip_referral_track"
  );

  assert.match(openTrips, /public\.pd_public_fanbus_trips\(\)/);
  assert.match(openTrips, /item\.value ->> 'registrationStatus' in \('OPEN', 'WAITLIST'\)/);
  assert.doesNotMatch(openTrips, /trip\.status = 'PUBLISHED'/);
  assert.doesNotMatch(openTrips, /registration_opens_at|registration_closes_at|effective_capacity/);
  for (const mode of ["SINGLE", "MULTIPLE", "FALLBACK"]) {
    assert.match(resolver, new RegExp(`'${mode}'`));
  }
  assert.match(resolver, /order by[\s\S]*event_date[\s\S]*event_time[\s\S]*departure_at[\s\S]*trip_id/);
  assert.doesNotMatch(resolver, /https?:\/\//);
});

test("Place Landing and Trip Referral remain separate best-effort aggregates", () => {
  const resolver = functionBlock(
    "create function public.pd_public_fanbus_ontour_resolve",
    "create function public.pd_public_fanbus_trip_referral_track"
  );
  const referral = functionBlock(
    "create function public.pd_public_fanbus_trip_referral_track",
    "-- ============================================================\n-- 8. Einbindung"
  );

  assert.match(resolver, /fanbus_publishing_record_place_landing/);
  assert.doesNotMatch(resolver, /fanbus_publishing_record_trip_referral/);
  assert.match(referral, /fanbus_publishing_open_trips\(v_place_id\)/);
  assert.match(referral, /fanbus_publishing_record_trip_referral/);
  assert.match(resolver, /exception when others then\s+null;/);
  assert.match(referral, /exception when others then\s+return jsonb_build_object\('tracked', false\)/);
  assert.match(migration, /on conflict \(place_id, day\) do update[\s\S]*landing_count \+ 1/);
  assert.match(migration, /on conflict \(place_id, trip_id, day\) do update[\s\S]*referral_count \+ 1/);
  assert.match(migration, /at time zone 'Europe\/Berlin'/);
});

test("tracking schema and RPC inputs contain no visitor or request metadata", () => {
  const trackingSchema = [
    tableBlock("fanbus_publishing_place_landing_daily"),
    tableBlock("fanbus_publishing_trip_referral_daily")
  ].join("\n");
  for (const forbidden of [
    "ip", "user_agent", "cookie", "session", "device", "fingerprint",
    "visitor", "user_id", "header", "profile"
  ]) {
    assert.doesNotMatch(trackingSchema, new RegExp(`\\b${forbidden}\\b`, "i"));
  }
  assert.match(migration, /pd_public_fanbus_trip_referral_track\(\s*p_slug text,\s*p_trip_id uuid\s*\)/);
});

test("table and function privileges preserve the Default-Deny boundary", () => {
  assert.match(migration, /revoke all on table[\s\S]*fanbus_publishing_trip_referral_daily[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(migration, /grant execute on function public\.pd_public_fanbus_ontour_resolve\(text\)[\s\S]*to anon, authenticated/);
  assert.match(migration, /grant execute on function public\.pd_public_fanbus_trip_referral_track\(text, uuid\)[\s\S]*to anon, authenticated/);
  assert.doesNotMatch(migration, /grant\s+(select|insert|update|delete|all)\s+on\s+(table\s+)?app_modules/i);
});

test("SQL and concurrency coverage lock the frozen acceptance contract", () => {
  for (const marker of [
    "M340_NORMALIZATION_OK",
    "M340_CONSTRAINTS_OK",
    "M340_BINDING_OK",
    "M340_RESOLVER_OK",
    "M340_TRACKING_OK",
    "M340_SECURITY_OK",
    "M340_PD_API_AUTHORIZATION_OK"
  ]) {
    assert.match(sqlTest, new RegExp(marker));
  }
  assert.match(concurrencyRunner, /M340_CONCURRENCY_PASS/);
  assert.match(concurrencyRunner, /seq 1 20/);
});

test("Slice 1 does not implement later M340 delivery areas", () => {
  for (const forbidden of [
    "wordpress/", "nextcloud", "webdav", "inkscape", "KOMIKAX",
    "publishing_queue", "svg", "qr-code"
  ]) {
    assert.doesNotMatch(migration, new RegExp(forbidden, "i"));
  }

  assert.doesNotMatch(migration, /create\s+or\s+replace\s+function\s+public\.pd_public_fanbus_trips/i);
  assert.doesNotMatch(migration, /alter\s+table\s+(?:public\.)?(?:events|fanbus_trips|fanbus_buses)\b/i);
});
