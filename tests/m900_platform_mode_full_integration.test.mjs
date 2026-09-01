import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const migrationPath = "supabase/migrations/20260823004248_harden_platform_mode_user_boundaries_m900_r1.sql";

test("M900 full integration guards all user mutation boundaries but no preview or worker", async () => {
  const [sql, m210, m150, m310] = await Promise.all([
    read(migrationPath),
    read("supabase/functions/m210-ics-import/index.ts"),
    read("supabase/functions/m150-membership-submit/index.ts"),
    read("supabase/functions/m310-fanbus-register/index.ts")
  ]);
  for (const name of [
    "m150_submit_membership_application",
    "m210_ics_import_confirm",
    "m310_submit_guest_fanbus_registration"
  ]) {
    assert.match(sql, new RegExp(`require_platform_user_write_allowed\\([\\s\\S]*?'${name}'`));
  }
  assert.doesNotMatch(sql, /m210_ics_import_preview[\s\S]*require_platform_user_write_allowed/);
  assert.match(m210, /m210_ics_import_preview/);
  assert.match(m210, /m210_ics_import_confirm[\s\S]*releaseBypassHeaders\(request\)/);
  for (const edge of [m150, m310]) {
    assert.doesNotMatch(edge, /X-PD-Release-Bypass/);
    assert.doesNotMatch(edge, /X-PD-Release-Run/);
    assert.doesNotMatch(edge, /X-PD-Environment/);
    assert.doesNotMatch(edge, /releaseBypassHeaders/);
  }
  for (const edge of [m210]) {
    assert.match(edge, /X-PD-Release-Bypass/);
    assert.match(edge, /X-PD-Release-Run/);
    assert.match(edge, /X-PD-Environment/);
  }
  for (const edge of [m150, m210, m310]) {
    assert.match(edge, /P0901/);
    assert.match(edge, /P0902/);
    assert.match(edge, /P0903/);
  }
});

test("release bypass is hash-only, bounded, bound and ops-only", async () => {
  const strict = await read(
    "supabase/migrations/20260823154611_harden_release_bypass_strict_user_bound_m900_r1.sql"
  );
  const sql = `${await read(migrationPath)}\n${strict}`;
  assert.match(sql, /create table app_private\.platform_release_bypass_tokens/);
  assert.match(sql, /token_digest text not null unique/);
  assert.match(sql, /extensions\.gen_random_bytes\(32\)/);
  assert.match(sql, /extensions\.digest\(convert_to\(v_token, 'UTF8'\), 'sha256'\)/);
  const insertStart = sql.indexOf("insert into app_private.platform_release_bypass_tokens (");
  const insertColumns = sql.slice(insertStart, sql.indexOf(")\n  values", insertStart));
  assert.doesNotMatch(insertColumns, /^\s*token\s*,?$/im);
  assert.match(sql, /expires_at <= created_at \+ interval '1 hour'/);
  assert.match(sql, /environment = v_environment/);
  assert.match(sql, /run_id = v_run_id/);
  assert.match(strict, /alter column bound_user_id set not null/);
  assert.match(strict, /bypass\.bound_user_id = p_actor/);
  assert.doesNotMatch(strict, /bound_user_id is null or/);
  assert.match(strict, /if p_actor is null[\s\S]*return false/);
  assert.match(sql, /PLATFORM_RELEASE_BYPASS_USED/);
  assert.match(sql, /'actorType'/);
  assert.match(sql, /'bypassUsed', true/);
  assert.match(sql, /revoke all on table app_private\.platform_release_bypass_tokens[\s\S]*?service_role/);
  assert.match(sql, /create_platform_release_bypass[\s\S]*?to postgres/);
  assert.doesNotMatch(sql, /grant execute on function app_private\.create_platform_release_bypass[\s\S]*?to (?:anon|authenticated|service_role)/);
});

test("portal fetches fresh status, fails closed, and has separate read-only and maintenance UX", async () => {
  const [platform, app, common, gate, html, worker] = await Promise.all([
    read("js/platform-mode.js"),
    read("js/app.js"),
    read("js/modules/common.js"),
    read("js/auth-gate.js"),
    read("index.html"),
    read("service-worker.js")
  ]);
  assert.match(platform, /pd_public_platform_status/);
  assert.match(platform, /cache: "no-store"/);
  assert.match(platform, /Cache-Control": "no-cache, no-store, max-age=0"/);
  assert.match(platform, /mode: "MAINTENANCE"[\s\S]*?available: false/);
  assert.doesNotMatch(platform, /localStorage|sessionStorage|indexedDB|document\.cookie/);
  assert.ok(app.indexOf("await platformMode.refresh()") < app.indexOf("await mountComponents()"));
  assert.match(common, /platformMode\.assertUserWriteAllowed\(\)/);
  assert.match(gate, /export function showMaintenance/);
  assert.match(html, /id="platformReadOnlyBanner"/);
  assert.match(html, /id="authGateMaintenance"/);
  assert.match(worker, /pd_public_platform_status[\s\S]*?cache: "no-store"/);
  assert.match(worker, /\.\/js\/platform-mode\.js/);
});

test("WordPress M150 and M310 fail closed while keeping admin configuration separate", async () => {
  const [m150, m310] = await Promise.all([
    read("wordpress/plugins/plaerrdeifl-m150-membership/plaerrdeifl-m150-membership.php"),
    read("wordpress/plugins/plaerrdeifl-m310-fanbus/plaerrdeifl-m310-fanbus.php")
  ]);
  assert.match(m150, /load_platform_status\(\$config\)/);
  assert.ok(m150.indexOf("load_platform_status($config)", m150.indexOf("handle_submission")) < m150.indexOf("consume_rate_limit()", m150.indexOf("handle_submission")));
  assert.match(m150, /PD_M150_PLATFORM_STATUS_URL/);
  assert.match(m150, /pd-m150-platform-notice/);
  assert.match(m310, /STATUS_RPC_PATH = '\/rest\/v1\/rpc\/pd_public_platform_status'/);
  assert.ok(m310.indexOf("load_public_trips($config)") < m310.indexOf("load_platform_status($config)"));
  assert.match(m310, /\$registration_allowed/);
  assert.match(m310, /pd-m310-registration-disabled/);
  for (const plugin of [m150, m310]) {
    assert.match(plugin, /Cache-Control'[\s\S]*?'no-cache, no-store, max-age=0'/);
  }
});

test("SQL verification covers modes, bypass failures, authorization and background isolation", async () => {
  const verification = await read("supabase/tests/m900_platform_mode_full_integration.sql");
  for (const phrase of [
    "READ_ONLY blockiert Leseweg",
    "NORMAL pd_api erreicht bestehende Fachvalidierung nicht",
    "NORMAL blockiert M150 auf Plattformebene",
    "NORMAL blockiert M210 Preview auf Plattformebene",
    "NORMAL blockiert M210 Confirm auf Plattformebene",
    "NORMAL blockiert M310 auf Plattformebene",
    "M150 wurde in READ_ONLY nicht blockiert",
    "M210 Confirm wurde in READ_ONLY nicht blockiert",
    "M310 wurde in READ_ONLY nicht blockiert",
    "M210 Preview wurde als Schreibweg blockiert",
    "Hintergrundworker wurde vom User-Guard blockiert",
    "Falscher Lauf ist nicht fail-closed",
    "Falsche Umgebung ist nicht fail-closed",
    "Malformed Token ist nicht fail-closed",
    "Unbekanntes Token ist nicht fail-closed",
    "Abgelaufenes Token ist nicht fail-closed",
    "Widerrufenes Token ist nicht fail-closed",
    "Bypass hat Fachberechtigung umgangen",
    "Bypass hat Fachvalidierung umgangen"
  ]) assert.match(verification, new RegExp(phrase));
});
