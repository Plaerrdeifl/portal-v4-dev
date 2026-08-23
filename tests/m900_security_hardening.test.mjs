import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const migrationPath = "supabase/migrations/20260823073847_harden_security_boundaries_m900_r1.sql";

test("syntactically valid release context never opens the maintenance portal", async () => {
  const [platform, app, registration] = await Promise.all([
    read("js/platform-mode.js"),
    read("js/app.js"),
    read("js/fanbus-registration.js")
  ]);

  assert.match(platform, /export function hasReleaseTestContext/);
  assert.match(platform, /state\.mode === "READ_ONLY"[\s\S]*hasReleaseTestContext\(\)/);
  assert.doesNotMatch(platform, /state\.mode === "MAINTENANCE"[\s\S]{0,120}hasReleaseTestContext/);
  assert.match(app, /if \(platformStatus\.mode === "MAINTENANCE" \|\| !platformStatus\.available\)/);
  assert.doesNotMatch(app, /hasRelease(?:Bypass|TestContext)/);
  assert.match(platform, /X-PD-Release-Bypass/);
  assert.match(platform, /X-PD-Release-Run/);
  assert.match(platform, /X-PD-Environment/);
  assert.match(registration, /platformStatus\.mode === "READ_ONLY"[\s\S]*hasReleaseTestContext\(\)/);
  assert.doesNotMatch(registration, /platformStatus\.mode === "MAINTENANCE"[\s\S]{0,120}hasReleaseTestContext/);
});

test("companion search is prefix-only, specific, bounded and privacy-minimal", async () => {
  const [sql, ui] = await Promise.all([
    read(migrationPath),
    read("js/modules/fanbuses.js")
  ]);
  const helperStart = sql.indexOf("create or replace function app_private.m325_portal_people_search");
  const helperEnd = sql.indexOf("create or replace function app_private.api_fanbus_companion_person_search", helperStart);
  const helper = sql.slice(helperStart, helperEnd);
  const companionStart = helperEnd;
  const companionEnd = sql.indexOf("create or replace function app_private.api_fanbus_registration_identity_search", companionStart);
  const companion = sql.slice(companionStart, companionEnd);

  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.match(helper, /portal_user\.status = 'ACTIVE'/);
  assert.match(helper, /pg_catalog\.left\([\s\S]*name_token\.value[\s\S]*pg_catalog\.length\(query_token\.value\)/);
  assert.match(helper, /limit 8/);
  assert.match(helper, /'portalUserId'/);
  assert.match(helper, /'displayName'/);
  assert.doesNotMatch(helper, /is_member|'isMember'|user_member_links|app_fanclub|\.email|\.phone/i);
  assert.match(companion, /pg_catalog\.length\(v_query\) < 5/);
  assert.match(companion, /pg_catalog\.length\(v_query\) > 120/);
  assert.match(companion, /length\(token\.value\) < 2/);
  assert.match(companion, /consume_companion_person_search_rate_limit\(v_actor\)/);
  assert.match(sql, /request_count < 30/);
  assert.match(sql, /interval '5 minutes'/);
  assert.match(ui, /minlength="5" maxlength="120"/);
  assert.doesNotMatch(ui, /person\.isMember/);
});

test("ownership and identity capability boundaries remain intact", async () => {
  const [baseline, operations] = await Promise.all([
    read("supabase/migrations/20260820120000_add_m325_r2_member_linking.sql"),
    read("supabase/migrations/20260814130000_add_fanbus_operations_m325_r1.sql")
  ]);
  const linkStart = baseline.indexOf("create function app_private.api_fanbus_companion_person_link");
  const linkEnd = baseline.indexOf("create or replace function app_private.api_fanbus_companion_duplicate_preview", linkStart);
  const linkBlock = baseline.slice(linkStart, linkEnd);
  assert.match(linkBlock, /list\.owner_user_id = v_actor/);
  assert.match(linkBlock, /for update of list, companion/);
  assert.match(linkBlock, /v_existing\.revision <> v_expected/);
  assert.match(operations, /api_fanbus_companion_members_reorder[\s\S]*owner_user_id\s*=\s*v_actor/);
  assert.match(baseline, /api_fanbus_registration_identity_search[\s\S]*require_capability\([\s\S]*fanbus\.participant_identity\.manage/);
  assert.match(baseline, /api_fanbus_registration_identity_link[\s\S]*m325_registration_identity_set/);
});

test("historical routers and private tables expose no direct client path", async () => {
  const sql = await read(migrationPath);
  const expectedRouters = [
    "events_r1", "fanbus_cancellation_m330_r1", "fanbus_m310_r1",
    "fanbus_manual_m310_r1", "fanbus_open_on_publish_m310_r1",
    "fanbus_operations_m325_r1", "fanbus_participants_m320_r1",
    "fanbus_registration_m310_r1", "fanbus_reopen_m310_r1", "joint_f1",
    "m010_r1", "m010_r2_team_functions", "m325_r2_member_linking",
    "member_detail", "membership_access_m150_r2",
    "membership_application_conversion_r1", "membership_application_withdraw_r1",
    "membership_applications_r1", "p800_u5_r1", "phase2_finalization",
    "phase2_sorting", "platform_mode_m900_r1", "task_access_push_r3",
    "task_workflow_r2", "user_task_access_r1", "web_push_r1"
  ].map(name => `pd_api_before_${name}`).sort();
  const routers = [...new Set([...sql.matchAll(/public\.(pd_api_before_[a-z0-9_]+)\(text, jsonb\)/g)]
    .map(match => match[1]))].sort();
  assert.deepEqual(routers, expectedRouters);
  assert.match(sql, /pd_api_before_events_r1[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(sql, /pd_api_before_events_r1[\s\S]*to postgres/);
  assert.match(sql, /revoke all on function public\.pd_api\(text, jsonb\)[\s\S]*grant execute on function public\.pd_api\(text, jsonb\) to authenticated/);
  assert.match(sql, /alter table app_private\.bootstrap_tokens enable row level security/);
  assert.match(sql, /bootstrap_tokens,[\s\S]*platform_release_bypass_tokens[\s\S]*from public, anon, authenticated, service_role/);
  assert.match(sql, /companion_person_search_rate_limits[\s\S]*enable row level security/);
});

test("public SECURITY DEFINER reads retain the reviewed exact grant matrix", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /grant execute on function public\.pd_public_events\(\) to anon/);
  assert.doesNotMatch(sql, /grant execute on function public\.pd_public_events\(\) to[^;]*authenticated/);
  for (const signature of [
    "pd_public_fanbus_trip\\(uuid\\)",
    "pd_public_fanbus_trip_boarding_stops\\(uuid\\)",
    "pd_public_fanbus_trips\\(\\)",
    "pd_public_platform_status\\(\\)"
  ]) {
    assert.match(sql, new RegExp(`public\\.${signature}[\\s\\S]*?to anon, authenticated`));
  }

  for (const functionName of [
    "consume_companion_person_search_rate_limit",
    "m325_portal_people_search",
    "api_fanbus_companion_person_search",
    "api_fanbus_registration_identity_search",
    "api_fanbus_registration_identity_suggestion",
    "create_platform_release_bypass",
    "revoke_platform_release_bypass"
  ]) {
    const start = sql.indexOf(functionName);
    const bodyEnd = sql.indexOf("$function$;", start);
    assert.ok(start >= 0 && bodyEnd > start, functionName);
    assert.match(sql.slice(start, bodyEnd), /security definer[\s\S]*set search_path = ''/);
  }
});

test("release bypass management is audited without token or digest disclosure", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /PLATFORM_RELEASE_BYPASS_CREATED/);
  assert.match(sql, /PLATFORM_RELEASE_BYPASS_REVOKED/);
  assert.match(sql, /'operatorRole', session_user/);
  assert.match(sql, /'runId', v_run_id/);
  const createAudit = sql.slice(
    sql.indexOf("'PLATFORM_RELEASE_BYPASS_CREATED'"),
    sql.indexOf("return pg_catalog.jsonb_build_object", sql.indexOf("'PLATFORM_RELEASE_BYPASS_CREATED'"))
  );
  assert.doesNotMatch(createAudit, /v_token|token_digest|digest\(/);
  assert.match(sql, /p_expires_at > now\(\) \+ interval '1 hour'/);
  assert.match(sql, /create_platform_release_bypass[\s\S]*revoke_platform_release_bypass[\s\S]*to postgres/);
});

test("dialog boundary rejects executable markup and unsafe attributes before DOM insertion", async () => {
  const common = await read("js/modules/common.js");
  assert.doesNotMatch(common, /bodyNode\.innerHTML/);
  assert.match(common, /template\.innerHTML = String\(markup \|\| ""\)/);
  assert.match(common, /DIALOG_ALLOWED_ELEMENTS/);
  assert.doesNotMatch(common.match(/DIALOG_ALLOWED_ELEMENTS = new Set\(\[([\s\S]*?)\]\)/)?.[1] || "", /"IMG"|"SCRIPT"|"SVG"|"IFRAME"/);
  assert.match(common, /!allowed \|\| name\.startsWith\("on"\) \|\| name === "style"/);
  assert.match(common, /DIALOG_UNSAFE_URL/);
  assert.match(common, /raw\.startsWith\("\/"\) && !raw\.startsWith\("\/\/"\)/);
  assert.match(common, /noopener/);
  assert.match(common, /noreferrer/);
  assert.match(common, /bodyNode\.replaceChildren\(safeDialogFragment\(body\)\)/);
  for (const payload of [
    "<img src=x onerror=alert(1)>",
    "<script>alert(1)</script>",
    "<a href=\"javascript:alert(1)\">x</a>",
    "<a href=\"//evil.example\">x</a>",
    "\" onfocus=\"alert(1)"
  ]) {
    assert.ok(/<(?:img|script)|javascript:|href=["']?\/\/|\bon[a-z]+\s*=/i.test(payload));
  }
});

test("repo auth defaults and WordPress cache versions are hardened consistently", async () => {
  const [config, m150, m310] = await Promise.all([
    read("supabase/config.toml"),
    read("wordpress/plugins/plaerrdeifl-m150-membership/plaerrdeifl-m150-membership.php"),
    read("wordpress/plugins/plaerrdeifl-m310-fanbus/plaerrdeifl-m310-fanbus.php")
  ]);
  assert.match(config, /minimum_password_length = 12/);
  assert.match(config, /password_requirements = "lower_upper_letters_digits_symbols"/);
  assert.match(config, /\[auth\.email\][\s\S]*enable_signup = false/);
  assert.match(config, /secure_password_change = true/);
  assert.match(config, /\[auth\.sms\][\s\S]*enable_signup = false/);
  for (const plugin of [m150, m310]) {
    assert.match(plugin, /Version: 1\.0\.5/);
    assert.match(plugin, /private const VERSION = '1\.0\.5'/);
    assert.match(plugin, /esc_html|esc_attr|esc_url/);
  }
});

test("security documentation records matrices, operations and audit policy", async () => {
  const doc = await read("docs/P900_M900_R1_SECURITY_HARDENING.md");
  for (const phrase of [
    "Public-RPC-Matrix", "Grant-Matrix", "Companion-Search-Privacy-Vertrag",
    "Release-Bypass-Bedrohungsmodell", "MUST AUDIT", "OPTIONAL / KEIN FULL BEFORE-AFTER",
    "Auth-Hardening Operations Note", "Remote-DEV- noch PROD-Auth-Konfiguration"
  ]) assert.match(doc, new RegExp(phrase));
  assert.doesNotMatch(doc, /(?:service_role|secret)[_-]?(?:key|token)\s*[:=]\s*[A-Za-z0-9._-]{20,}/i);
});
