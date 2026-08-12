import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

const migrationPath = "supabase/migrations/20260812191937_add_fanbus_reopen_m310_r1.sql";
const originalMigrationPath = "supabase/migrations/20260810181918_add_internal_fanbus_api_m310_r1.sql";

const [migration, originalMigration, ui] = await Promise.all([
  read(migrationPath),
  read(originalMigrationPath),
  read("js/modules/fanbuses.js")
]);

function functionBlock(source, name, nextMarker) {
  const start = source.indexOf(name);
  const end = source.indexOf(nextMarker, start + name.length);
  assert.notEqual(start, -1, `Startmarker fehlt: ${name}`);
  assert.notEqual(end, -1, `Endmarker fehlt: ${nextMarker}`);
  return source.slice(start, end);
}

const reopen = functionBlock(
  migration,
  "create function app_private.api_fanbus_trip_reopen(p_payload jsonb)",
  "alter function public.pd_api(text, jsonb)"
);

test("M310 reopen is protected and accepts only id plus expectedRevision", () => {
  assert.match(reopen, /require_capability\('fanbus\.manage'\)/);
  assert.match(reopen, /p_payload \?& array\['id', 'expectedRevision'\]/);
  assert.match(
    reopen,
    /payload_key\.key <> all\(array\['id', 'expectedRevision'\]\)/
  );
});

test("M310 reopen requires CLOSED and rejects stale revisions", () => {
  assert.match(reopen, /where id = v_id\s+for update/);
  assert.match(
    reopen,
    /v_expected_revision <> v_existing\.revision[\s\S]+errcode = '40001'/
  );
  assert.match(reopen, /v_existing\.status <> 'CLOSED'/);
  assert.doesNotMatch(reopen, /status\s+in\s+\('DRAFT',\s*'PUBLISHED'\)/);
});

test("M310 reopen only changes status, revision and updater", () => {
  assert.match(
    reopen,
    /update app_modules\.fanbus_trips\s+set status = 'DRAFT',[\s\S]+revision = revision \+ 1,[\s\S]+updated_by = v_actor/
  );
  assert.doesNotMatch(
    reopen,
    /update app_modules\.fanbus_registrations|delete from app_modules\.fanbus_registrations|cancelled_at/
  );
});

test("M310 reopen writes audit and is dispatched through the protected pd_api chain", () => {
  assert.match(reopen, /'FANBUS_TRIP_REOPENED'/);
  assert.match(reopen, /'status', 'CLOSED'/);
  assert.match(reopen, /'status', 'DRAFT'/);
  assert.match(migration, /when 'fanbus_trip_reopen'/);
  assert.match(migration, /api_fanbus_trip_reopen/);
  assert.match(migration, /pd_api_before_fanbus_reopen_m310_r1/);
  assert.match(
    migration,
    /revoke all on function app_private\.api_fanbus_trip_reopen\(jsonb\)[\s\S]+service_role/
  );
});

test("M310 delete remains limited to empty DRAFT trips", () => {
  const deletion = functionBlock(
    originalMigration,
    "create function app_private.api_fanbus_trip_delete(p_payload jsonb)",
    "create function app_private.api_fanbus_registrations_list(p_payload jsonb)"
  );
  assert.match(deletion, /v_existing\.status <> 'DRAFT'/);
  assert.match(
    deletion,
    /if exists \([\s\S]+from app_modules\.fanbus_registrations[\s\S]+registration\.trip_id = v_id[\s\S]+errcode = '23503'/
  );
});

test("M310 editor uses fixed legal references and exposes no legal reference fields", () => {
  assert.match(
    ui,
    /const PRIVACY_REFERENCE = "https:\/\/plaerrdeifl\.de\/datenschutzerklaerung\/"/
  );
  assert.match(
    ui,
    /const TERMS_REFERENCE = "https:\/\/plaerrdeifl\.de\/fanbus-teilnahmebedingungen\/"/
  );
  assert.match(ui, /privacyReference: PRIVACY_REFERENCE/);
  assert.match(ui, /termsReference: TERMS_REFERENCE/);
  assert.doesNotMatch(ui, /name="privacyReference"/);
  assert.doesNotMatch(ui, /name="termsReference"/);
  assert.doesNotMatch(ui, />Datenschutz-Referenz/);
  assert.doesNotMatch(ui, />Teilnahmebedingungen-Referenz/);
});

test("M310 visible editor labels contain neither Berlin qualifier nor Euro qualifier", () => {
  assert.doesNotMatch(ui, />Abfahrt in Berlin/);
  assert.doesNotMatch(ui, />Anmeldung startet in Berlin/);
  assert.doesNotMatch(ui, />Anmeldung endet in Berlin/);
  assert.doesNotMatch(ui, />Fahrtpreis in Euro/);
  assert.match(ui, /const BERLIN_TIME_ZONE = "Europe\/Berlin"/);
  assert.match(ui, /berlinLocalToIso\(values\.departureAt/);
});

test("M310 reopen UI is capability-gated and uses the required confirmation", () => {
  assert.match(
    ui,
    /if \(canManage && trip\.status === "CLOSED"\)[\s\S]+data-m310-reopen[\s\S]+Wieder als Entwurf öffnen/
  );
  assert.match(ui, /title: "Fanbusfahrt wieder öffnen"/);
  assert.match(ui, /submitLabel: "Als Entwurf öffnen"/);
  assert.match(ui, /nicht öffentlich verfügbar/);
  assert.match(ui, /Löschen ist weiterhin nur möglich/);
  assert.match(ui, /"fanbus_trip_reopen"/);
});

test("M310 Excel export is only exposed through registration management capability", () => {
  assert.match(
    ui,
    /const addAction = hasCapability\("fanbus\.registrations\.manage"\)[\s\S]+data-m310-export-registrations>Excel exportieren/
  );
  assert.match(
    ui,
    /if \(!hasCapability\("fanbus\.registrations\.manage"\)\) return;[\s\S]+downloadFanbusRegistrationsXlsx\(trip, registrations\)/
  );
  assert.match(ui, /call\("fanbus_registrations_list", \{ tripId: trip\.id \}\)/);
});
