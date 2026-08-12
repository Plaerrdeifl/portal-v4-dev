import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const migrationPath = "supabase/migrations/20260811123652_add_m210_ics_import_r2.sql";

test("M210-R2 adds only additive import metadata tables behind RLS", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /create table app_modules\.event_external_refs/);
  assert.match(sql, /unique \(source_type, source_key, external_uid\)/i);
  assert.match(sql, /event_id uuid not null[\s\S]*?references app_modules\.events\(id\)/);
  assert.match(sql, /create table app_modules\.event_import_runs/);
  for (const field of [
    "original_filename", "file_sha256", "file_size", "parsed_event_count",
    "new_count", "changed_count", "unchanged_count", "created_count",
    "updated_count", "actor", "confirmed_at"
  ]) assert.match(sql, new RegExp(`\\b${field}\\b`));
  assert.match(sql, /alter table app_modules\.event_external_refs enable row level security/);
  assert.match(sql, /alter table app_modules\.event_import_runs enable row level security/);
  assert.match(sql, /revoke all on table[\s\S]*?from public, anon, authenticated/);
  assert.doesNotMatch(sql, /alter table app_modules\.events[\s\S]*?add column/i);
  assert.doesNotMatch(sql, /create table[\s\S]*?(?:ics_file|ics_content|raw_ics)/i);
});

test("preview resolves only stable external identity and returns exact classifications and diffs", async () => {
  const sql = await read(migrationPath);
  const preview = sql.slice(sql.indexOf("create or replace function public.m210_ics_import_preview"), sql.indexOf("create or replace function public.m210_ics_import_confirm"));
  assert.match(preview, /source_type = p_source_type[\s\S]*?source_key = p_source_key[\s\S]*?external_uid = v_uid/);
  assert.match(preview, /v_status := 'NEW'/);
  assert.match(preview, /v_status := 'CHANGED'/);
  assert.match(preview, /v_status := 'UNCHANGED'/);
  for (const field of ["eventDate", "eventTime", "endDate", "endTime", "venue", "homeAway", "opponentName"]) {
    assert.match(preview, new RegExp(`'field', '${field}'`));
  }
  assert.match(preview, /'eventId', v_ref\.event_id/);
  assert.match(preview, /'revision'.*v_event\.revision/s);
  assert.doesNotMatch(preview, /similarity|levenshtein|soundex|lower\(.*opponent|title\s*=/i);
});

test("confirm is locked, stale-safe, atomic and preserves manual fields and event ids", async () => {
  const sql = await read(migrationPath);
  const confirm = sql.slice(sql.indexOf("create or replace function public.m210_ics_import_confirm"));
  assert.match(confirm, /pg_advisory_xact_lock/);
  assert.match(confirm, /for update of ref, event/);
  assert.match(confirm, /v_preview -> 'state' is distinct from p_expected_state/);
  assert.match(confirm, /errcode = 'P2101'/);
  assert.match(confirm, /if v_status = 'NEW'[\s\S]*?insert into app_modules\.events[\s\S]*?insert into app_modules\.event_games[\s\S]*?insert into app_modules\.event_external_refs/);
  assert.match(confirm, /elsif v_status = 'CHANGED'[\s\S]*?update app_modules\.events[\s\S]*?where id = v_event_id/);
  assert.match(confirm, /else[\s\S]*?v_event_id := \(v_state_item ->> 'eventId'\)::uuid/);
  assert.doesNotMatch(confirm, /delete from app_modules\.events|delete from app_modules\.event_external_refs/);
  const eventUpdate = confirm.slice(confirm.indexOf("update app_modules.events"), confirm.indexOf("update app_modules.event_games"));
  assert.doesNotMatch(eventUpdate, /visibility\s*=|description\s*=|event_type\s*=|title\s*=/i);
  assert.match(confirm, /revision = revision \+ 1/);
  assert.match(confirm, /EVENT_ICS_IMPORT_CONFIRMED/);
});

test("import RPCs require events.manage and are not browser-callable", async () => {
  const sql = await read(migrationPath);
  assert.equal((sql.match(/has_capability\(p_actor, 'events\.manage'\)/g) || []).length, 2);
  assert.match(sql, /revoke all on function public\.m210_ics_import_preview[\s\S]*?from public, anon, authenticated/);
  assert.match(sql, /revoke all on function public\.m210_ics_import_confirm[\s\S]*?from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.m210_ics_import_preview[\s\S]*?to service_role/);
  assert.match(sql, /grant execute on function public\.m210_ics_import_confirm[\s\S]*?to service_role/);
  assert.doesNotMatch(sql, /events\.import/);
});

test("Edge Function reparses the same file, fingerprints preview state and exposes no free URL import", async () => {
  const edge = await read("supabase/functions/m210-ics-import/index.ts");
  const parser = await read("supabase/functions/m210-ics-import/ics-parser.js");
  assert.match(edge, /parseIcsFile\(new Uint8Array\(await file\.arrayBuffer\(\)\), file\.name\)/);
  assert.match(edge, /const fingerprint = await previewFingerprint\(parsed, state\)/);
  assert.match(edge, /fingerprint !== suppliedFingerprint/);
  assert.match(edge, /"PREVIEW_STALE"/);
  assert.match(edge, /authenticatedUserId\(token, config\)/);
  assert.match(edge, /request\.body\.getReader\(\)/);
  assert.match(edge, /total > MAX_REQUEST_BYTES/);
  for (const mimeType of [
    "text/calendar",
    "application/ics",
    "application/octet-stream",
    "binary/octet-stream"
  ]) assert.match(parser, new RegExp(`"${mimeType.replace("/", "\\/")}"`));
  assert.match(edge, /plausibleIcsMimeType\(file\.type\)/);
  assert.match(edge, /"INVALID_FILE_TYPE"/);
  assert.match(edge, /m210_ics_import_preview/);
  assert.match(edge, /m210_ics_import_confirm/);
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(parser, /fetch\(|XMLHttpRequest|WebSocket|Deno\.read|readFile/);
  assert.doesNotMatch(edge, /form\.get\(["']url|new URL\([^)]*(?:ics|file)/i);
});

test("dates UI uses the existing boundary, fixed profile, escaped preview and explicit confirmation", async () => {
  const html = await read("pages/dates.html");
  const dates = await read("js/modules/dates.js");
  const api = await read("js/api.js");
  assert.match(html, /id="m210ImportScheduleButton"[\s\S]*?>Spielplan importieren</);
  assert.match(dates, /hasCapability\("events\.manage"\)/);
  assert.match(dates, /sourceKey: "ERV_BAYERNLIGA_2026_27"/);
  assert.match(dates, /label: "ERV Bayernliga 2026\/27"/);
  assert.match(dates, /Import bestätigen/);
  assert.match(dates, /importIcs\("preview", selectedFile/);
  assert.match(dates, /importIcs\([\s\S]*?"confirm",[\s\S]*?selectedFile/);
  assert.match(dates, /runWrite\(/);
  const successfulPreview = dates.slice(
    dates.indexOf('preview = await importIcs("preview"'),
    dates.indexOf("} catch (error)", dates.indexOf('preview = await importIcs("preview"'))
  );
  assert.match(successfulPreview, /confirmButton\.disabled = false;[\s\S]*?confirmButton\.hidden = false;/);
  assert.match(dates, /escapeHtml\(item\.displayTitle/);
  assert.match(dates, /escapeHtml\(item\.uid\)/);
  assert.doesNotMatch(dates, /Mighty Dogs Schweinfurt/);
  assert.doesNotMatch(dates, /getSupabaseClient|supabase\.rpc|\.from\(/);
  assert.match(api, /\/functions\/v1\/m210-ics-import/);
  assert.doesNotMatch(api, /SUPABASE_SERVICE_ROLE|serviceRole/);
});

test("SQL verification covers idempotency, no fuzzy match, no deletion, stale preview, fanbus stability and rollback", async () => {
  const verification = await read("supabase/tests/m210_ics_import.sql");
  for (const phrase of [
    "NEW-Klassifikation", "UNCHANGED-Klassifikation", "CHANGED-Klassifikation",
    "Manuelles Event wurde fuzzy zugeordnet", "UNCHANGED hat die Revision erhöht",
    "In einer späteren Datei fehlendes Event wurde gelöscht", "Fanbusreferenz oder event_id wurde verändert",
    "Konkurrierender Confirm wurde nicht als PREVIEW_STALE abgewiesen",
    "Konkurrierender Confirm hat ein Duplikat erzeugt",
    "Veraltete Preview wurde bestätigt", "Fehlerhafter Import wurde teilweise geschrieben"
  ]) assert.match(verification, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
