import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const migrationsDirectory = join(root, "supabase", "migrations");
const modelPath = "supabase/migrations/20260809094500_add_membership_application_public_intake_model_r1.sql";
const apiPath = "supabase/migrations/20260809095000_add_membership_application_public_intake_api_r1.sql";

const [model, api] = await Promise.all([read(modelPath), read(apiPath)]);

function block(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Startmarker fehlt: ${start}`);
  assert.notEqual(to, -1, `Endmarker fehlt: ${end}`);
  return source.slice(from, to);
}

test("F1.4A consists of exactly the two ordered intake migrations", async () => {
  const names = (await readdir(migrationsDirectory))
    .filter(name => /membership_application_public_intake/.test(name))
    .sort();
  assert.deepEqual(names, [
    "20260809094500_add_membership_application_public_intake_model_r1.sql",
    "20260809095000_add_membership_application_public_intake_api_r1.sql"
  ]);
});

test("the public wrapper is service-role-only and delegates without pd_api", () => {
  const wrapper = block(
    api,
    "create function public.m150_submit_membership_application",
    "revoke all on function app_private.m150_submit_membership_application"
  );
  assert.match(wrapper, /security definer/i);
  assert.match(wrapper, /set search_path = ''/i);
  assert.match(wrapper, /select app_private\.m150_submit_membership_application\(/i);
  assert.doesNotMatch(wrapper, /insert into|update |delete from|public\.pd_api/i);
  assert.match(api, /revoke all on function public\.m150_submit_membership_application\(jsonb, text\)[\s\S]+from public, anon, authenticated, service_role/i);
  assert.match(api, /grant execute on function public\.m150_submit_membership_application\(jsonb, text\)[\s\S]+to service_role/i);
  assert.doesNotMatch(api, /grant execute[\s\S]+to (?:anon|authenticated)/i);
  assert.doesNotMatch(api, /public\.pd_api|when 'membership_application/i);
});

test("private intake and technical idempotency remain default-deny", () => {
  const table = block(
    model,
    "create table app_private.membership_application_intake_idempotency",
    "create index membership_application_intake_application_idx"
  );
  assert.match(api, /create function app_private\.m150_submit_membership_application\(/i);
  assert.match(api, /revoke all on function app_private\.m150_submit_membership_application\(jsonb, text\)[\s\S]+from public, anon, authenticated, service_role/i);
  assert.match(model, /enable row level security/i);
  assert.match(model, /revoke all on table app_private\.membership_application_intake_idempotency[\s\S]+from public, anon, authenticated, service_role/i);
  assert.doesNotMatch(model + api, /grant (?:select|insert|update|delete|all) on (?:table )?(?:app_private|app_fanclub)\./i);

  for (const column of [
    "idempotency_key",
    "payload_sha256",
    "application_id",
    "outcome",
    "created_at"
  ]) {
    assert.match(table, new RegExp(`\\b${column}\\b`));
  }
  assert.doesNotMatch(
    table,
    /first_name|last_name|birth_date|email|phone|street|house_number|postal_code|city|applicant_message/i
  );
});

test("payload keys are explicitly whitelisted and fully validated", () => {
  const whitelist = block(api, "v_allowed_keys constant text[]", "v_required_keys constant text[]");
  const allowed = [
    "firstName",
    "lastName",
    "birthDate",
    "email",
    "phone",
    "street",
    "houseNumber",
    "postalCode",
    "city",
    "applicantMessage",
    "declarationConfirmed",
    "declarationVersion",
    "statutesConfirmed",
    "statutesVersion",
    "statutesReference"
  ];
  const actualAllowed = [...whitelist.matchAll(/'([^']+)'/g)]
    .map(match => match[1]);
  assert.deepEqual(actualAllowed, allowed);
  assert.match(api, /jsonb_typeof\(p_payload\) <> 'object'/i);
  assert.match(api, /jsonb_object_keys\(p_payload\)/i);
  assert.match(api, /not \(p_payload \?& v_required_keys\)/i);
  assert.match(api, /M150_PUBLIC_INTAKE_INVALID_PAYLOAD/);
  assert.match(api, /M150_PUBLIC_INTAKE_DECLARATION_REQUIRED/);
});

test("email is outer-trimmed before structural validation and duplicate matching", () => {
  assert.match(api, /v_email := btrim\(p_payload ->> 'email'\);/i);
  assert.ok(api.includes(
    "or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'"
  ));
  assert.match(
    api,
    /m150_normalize_email\(application\.email\)[\s\S]+m150_normalize_email\(v_email\)/i
  );
});

test("adult validation uses the Berlin calendar before every durable intake write", () => {
  assert.match(api, /clock_timestamp\(\) at time zone 'Europe\/Berlin'/i);
  assert.match(api, /v_birth_date \+ interval '18 years' > v_today/i);
  assert.doesNotMatch(api, /365(?:\.25)?|milliseconds?|86400000/i);
  assert.match(api, /M150_PUBLIC_INTAKE_ADULT_REQUIRED/);
  const adultCheck = api.indexOf("M150_PUBLIC_INTAKE_ADULT_REQUIRED");
  assert.ok(adultCheck >= 0);
  assert.ok(api.indexOf("insert into app_private.membership_application_intake_idempotency") > adultCheck);
  assert.ok(api.indexOf("insert into app_fanclub.membership_applications") > adultCheck);
});

test("new applications are server-timestamped PENDING records with the existing board snapshot", () => {
  const insert = block(
    api,
    "insert into app_fanclub.membership_applications",
    "returning id into v_application_id"
  );
  assert.match(insert, /'PENDING'/);
  assert.doesNotMatch(insert, /submitted_at/i);
  assert.match(api, /perform app_private\.m150_lock_board_roster\(\)/i);
  assert.match(api, /from app_private\.m150_current_board\(\) as board/i);
  assert.match(api, /v_board_count <> 5[\s\S]+v_board_offices <> 5[\s\S]+v_board_users <> 5/i);
  assert.match(api, /membership_application_board_roster[\s\S]+v_roster_count <> 5/i);
  assert.match(api, /M150_PUBLIC_INTAKE_BOARD_UNAVAILABLE/);
  assert.doesNotMatch(api, /portal\.admin|require_capability|has_capability/i);
});

test("PENDING duplicate rules use email or identity but never phone alone", () => {
  const duplicateLookup = block(
    api,
    "select application.id\n  into v_existing_application_id",
    "if v_existing_application_id is not null then"
  );
  assert.match(duplicateLookup, /m150_normalize_email\(application\.email\)/i);
  assert.match(duplicateLookup, /m150_normalize_name\(application\.first_name\)/i);
  assert.match(duplicateLookup, /m150_normalize_name\(application\.last_name\)/i);
  assert.match(duplicateLookup, /application\.birth_date = v_birth_date/i);
  assert.doesNotMatch(duplicateLookup, /phone/i);
  assert.match(model, /create unique index membership_applications_pending_email_unique[\s\S]+where status = 'PENDING'/i);
  assert.match(model, /create unique index membership_applications_pending_identity_unique[\s\S]+where status = 'PENDING'/i);
  assert.match(api, /when unique_violation then[\s\S]+outcome = 'DUPLICATE_PENDING'/i);
});

test("technical idempotency uses a database hash and detects key reuse", () => {
  assert.match(api, /extensions\.digest\(p_payload::text, 'sha256'\)/i);
  assert.match(api, /on conflict \(idempotency_key\) do nothing/i);
  assert.match(api, /payload_sha256 <> v_payload_sha256[\s\S]+M150_IDEMPOTENCY_KEY_REUSED/i);
  assert.match(api, /outcome = 'CREATED'/i);
  assert.match(api, /outcome = 'DUPLICATE_PENDING'/i);
  assert.match(api, /'accepted', true[\s\S]+'created', false[\s\S]+'applicationId'/i);
  assert.match(api, /'accepted', true[\s\S]+'created', true[\s\S]+'applicationId'/i);
});

test("public submission audit is minimal and adjacent domains are untouched", () => {
  const audit = block(
    api,
    "perform app_private.log_audit(",
    "return jsonb_build_object(\n    'accepted', true,\n    'created', true"
  );
  assert.match(audit, /MEMBERSHIP_APPLICATION_SUBMITTED_PUBLIC/);
  assert.match(audit, /'source', 'WORDPRESS_PUBLIC_INTAKE'/);
  assert.match(audit, /'status', 'PENDING'/);
  assert.doesNotMatch(audit, /v_first_name|v_last_name|v_birth_date|v_email|v_phone|v_street|v_applicant_message/i);
  assert.doesNotMatch(api, /(?:insert into|update|delete from)\s+app_fanclub\.members\b/i);
  assert.doesNotMatch(api, /(?:insert into|update|delete from)\s+app_portal\.(?:users|user_member_links|access_requests)\b/i);
  assert.doesNotMatch(api, /(?:insert into|update|delete from)\s+app_fanclub\.(?:office_slots|finance_|contribution_)/i);
  assert.doesNotMatch(api, /\b(?:sepa|payment)\b/i);
});

test("F1.2 and M210 migrations remain outside the new intake boundary", async () => {
  const legacyPaths = [
    "supabase/migrations/20260808150000_add_membership_application_model_r1.sql",
    "supabase/migrations/20260808151000_add_membership_application_internal_api_r1.sql",
    "supabase/migrations/20260809001000_add_membership_application_conversion_r1.sql",
    "supabase/migrations/20260809002000_add_membership_application_conversion_api_r1.sql",
    "supabase/migrations/20260808120000_add_internal_events_api_r1.sql",
    "supabase/migrations/20260808130000_add_public_events_read_api_r1.sql"
  ];
  const legacy = (await Promise.all(legacyPaths.map(read))).join("\n");
  assert.doesNotMatch(legacy, /m150_submit_membership_application|membership_application_intake_idempotency/i);
  assert.doesNotMatch(model + api, /pd_public_events|api_events|events_list/i);
});
