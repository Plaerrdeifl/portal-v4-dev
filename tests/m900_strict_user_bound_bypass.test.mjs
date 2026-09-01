import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const migrationPath =
  "supabase/migrations/20260823154611_harden_release_bypass_strict_user_bound_m900_r1.sql";

function functionBlock(sql, signature, nextMarker) {
  const start = sql.indexOf(signature);
  const end = sql.indexOf(nextMarker, start);
  assert.ok(start >= 0 && end > start, `Missing function block: ${signature}`);
  return sql.slice(start, end);
}

test("strict-user-bound migration is additive, fail-closed and preserves token cryptography", async () => {
  const sql = await read(migrationPath);
  const create = functionBlock(
    sql,
    "create function app_private.create_platform_release_bypass",
    "create or replace function app_private.try_platform_release_bypass"
  );

  assert.match(sql, /if exists \([\s\S]*bound_user_id is null[\s\S]*PLATFORM_RELEASE_BYPASS_UNBOUND_ROWS_EXIST/);
  assert.doesNotMatch(sql, /delete from app_private\.platform_release_bypass_tokens/);
  assert.match(sql, /alter column bound_user_id set not null/);
  assert.match(create, /p_bound_user_id uuid\s*\)/);
  assert.doesNotMatch(create, /p_bound_user_id uuid default/i);
  assert.match(create, /p_bound_user_id is null/);
  assert.match(create, /portal_user\.status = 'ACTIVE'/);
  assert.match(create, /PLATFORM_RELEASE_BYPASS_INVALID/);
  assert.match(create, /extensions\.gen_random_bytes\(32\)/);
  assert.match(create, /extensions\.digest\(pg_catalog\.convert_to\(v_token, 'UTF8'\), 'sha256'\)/);
  assert.match(create, /'boundUserId', p_bound_user_id/);
});

test("bypass use requires an active matching actor and permanently denies public actions", async () => {
  const sql = await read(migrationPath);
  const use = functionBlock(
    sql,
    "create or replace function app_private.try_platform_release_bypass",
    "create or replace function app_private.require_platform_user_write_allowed"
  );
  const guard = functionBlock(
    sql,
    "create or replace function app_private.require_platform_user_write_allowed",
    "create or replace function app_private.revoke_platform_release_bypass"
  );

  assert.match(use, /if p_actor is null[\s\S]*return false/);
  assert.match(use, /portal_user\.id = p_actor[\s\S]*portal_user\.status = 'ACTIVE'/);
  assert.match(use, /bypass\.bound_user_id = p_actor/);
  assert.doesNotMatch(use, /bound_user_id is null\s+or/i);
  assert.match(use, /m150_submit_membership_application/);
  assert.match(use, /m310_submit_guest_fanbus_registration/);
  assert.match(use, /token_digest[\s\S]*environment = v_environment[\s\S]*run_id = v_run_id/);
  assert.match(use, /bypass\.is_active[\s\S]*revoked_at is null[\s\S]*expires_at > pg_catalog\.now\(\)/);
  assert.match(use, /'actorType', 'PORTAL_USER'/);
  assert.match(use, /'boundUserId', v_bypass\.bound_user_id/);
  assert.match(guard, /is_valid is distinct from true[\s\S]*PLATFORM_WRITE_UNAVAILABLE/);
  assert.match(guard, /if p_actor is not null[\s\S]*try_platform_release_bypass\(p_action, p_actor\)/);
});

test("public M150 and M310 no longer transport release headers while M210 does", async () => {
  const [m150, m210, m310, registration] = await Promise.all([
    read("supabase/functions/m150-membership-submit/index.ts"),
    read("supabase/functions/m210-ics-import/index.ts"),
    read("supabase/functions/m310-fanbus-register/index.ts"),
    read("js/fanbus-registration.js")
  ]);

  for (const source of [m150, m310, registration]) {
    assert.doesNotMatch(source, /releaseBypassHeaders/);
    assert.doesNotMatch(source, /X-PD-Release-Bypass/);
    assert.doesNotMatch(source, /X-PD-Release-Run/);
    assert.doesNotMatch(source, /X-PD-Environment/);
  }
  assert.match(m310, /"Access-Control-Allow-Headers": "apikey, content-type"/);
  assert.match(registration, /platformStatus\.mode !== "NORMAL"/);
  assert.doesNotMatch(registration, /hasReleaseTestContext/);

  assert.match(m210, /releaseBypassHeaders\(request\)/);
  assert.match(m210, /X-PD-Release-Bypass/);
  assert.match(m210, /X-PD-Release-Run/);
  assert.match(m210, /X-PD-Environment/);
  assert.match(m210, /m210_ics_import_preview/);
  assert.match(m210, /m210_ics_import_confirm/);
});

test("strict bypass storage and operations retain the exact private grant boundary", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on table app_private\.platform_release_bypass_tokens[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(sql, /revoke all on function[\s\S]*create_platform_release_bypass[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(sql, /grant execute on function[\s\S]*create_platform_release_bypass[\s\S]*to postgres/);
  assert.doesNotMatch(sql, /grant execute on function[\s\S]*to (?:anon|authenticated|service_role)/);
  for (const name of [
    "create_platform_release_bypass",
    "try_platform_release_bypass",
    "require_platform_user_write_allowed",
    "revoke_platform_release_bypass"
  ]) {
    const start = sql.indexOf(`function app_private.${name}`);
    const end = sql.indexOf("$function$;", start);
    assert.ok(start >= 0 && end > start, name);
    assert.match(sql.slice(start, end), /security definer[\s\S]*set search_path = ''/);
  }
});

test("audit metadata carries binding without raw token or digest", async () => {
  const sql = await read(migrationPath);
  for (const action of [
    "PLATFORM_RELEASE_BYPASS_CREATED",
    "PLATFORM_RELEASE_BYPASS_USED",
    "PLATFORM_RELEASE_BYPASS_REVOKED"
  ]) assert.match(sql, new RegExp(action));
  assert.match(sql, /'boundUserId'/);
  assert.match(sql, /'actorType', 'PORTAL_USER'/);
  const auditCalls = [...sql.matchAll(/perform app_private\.log_audit\(([\s\S]*?)\n\s*\);/g)]
    .map(match => match[1]);
  assert.equal(auditCalls.length, 3);
  for (const audit of auditCalls) {
    assert.doesNotMatch(audit, /v_token|token_digest/i);
  }
});
