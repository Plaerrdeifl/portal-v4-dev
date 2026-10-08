import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20260926203855_social_media_generator_phase1.sql";
const integrationTestPath =
  "supabase/tests/social_media_generator_phase1.sql";
const readMigration = () => fs.readFile(path.join(root, migrationPath), "utf8");
const readIntegrationTest = () =>
  fs.readFile(path.join(root, integrationTestPath), "utf8");

test("phase 1 stays limited to preferences and owned drafts", async () => {
  const sql = await readMigration();

  assert.match(sql, /create schema if not exists app_social_media/i);
  assert.match(sql, /create table app_social_media\.user_preferences/i);
  assert.match(sql, /create table app_social_media\.drafts/i);
  assert.match(sql, /owner_user_id uuid not null/i);
  assert.match(sql, /document jsonb not null/i);
  assert.match(sql, /document_schema_version integer not null/i);
  assert.match(sql, /version bigint not null default 1/i);
  assert.doesNotMatch(
    sql,
    /create table app_social_media\.(?:templates|template_versions|media_packages|draft_locks|render_jobs)/i
  );
});

test("access reuses capability, social-media team, and admin wildcard", async () => {
  const sql = await readMigration();

  assert.match(sql, /'social_media_generator\.use'/i);
  assert.match(sql, /app_private\.has_capability\([\s\S]*'social_media_generator\.use'/i);
  assert.match(sql, /app_private\.has_capability\([\s\S]*'portal\.admin'/i);
  assert.match(sql, /team\.code = 'SOCIAL_MEDIA'/i);
  assert.match(sql, /membership\.is_active/i);
  assert.match(sql, /portal_user\.status = 'ACTIVE'/i);
  assert.match(sql, /SOCIAL_MEDIA_GENERATOR_ACCESS_REQUIRED[\s\S]*errcode = '42501'/i);
});

test("preferences are derived only from the authenticated user", async () => {
  const sql = await readMigration();
  const updateFunction = sql.match(
    /create function app_private\.api_social_media_generator_preferences_update[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(updateFunction, /social_media_generator_require_access\(\)/i);
  assert.match(updateFunction, /where preference\.user_id = v_user_id/i);
  assert.match(updateFunction, /values \(\s*v_user_id, v_expert_mode/i);
  assert.doesNotMatch(updateFunction, /p_payload\s*->>\s*'userId'/i);
});

test("validation matches the recursive graphics-core document contract", async () => {
  const [sql, sqlTest] = await Promise.all([
    readMigration(),
    readIntegrationTest()
  ]);
  const fixture = sqlTest.match(
    /v_document jsonb := jsonb_build_object\([\s\S]+?\n  \);/
  )?.[0] || "";

  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_ROOT_INVALID/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_SCHEMA_VERSION_UNSUPPORTED/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_TOO_LARGE/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_ID_INVALID/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_TITLE_INVALID/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_FORMAT_INVALID/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_FORMAT_DIMENSIONS_INVALID/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_ELEMENTS_INVALID/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_METADATA_INVALID/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_ELEMENT_ID_DUPLICATE/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_GROUP_CHILDREN_INVALID/i);
  assert.match(sql, /SOCIAL_MEDIA_DOCUMENT_NESTING_TOO_DEEP/i);
  assert.match(sql, /with recursive element_tree\(element, depth\)/i);
  assert.match(sql, /parent\.element -> 'children'/i);
  assert.match(sql, /parent\.depth \+ 1/i);
  assert.match(sql, /count\(distinct element ->> 'id'\)/i);
  assert.match(sql, /v_element_count > 5000/i);
  assert.match(sql, /v_max_allowed_element_depth constant integer := 32/i);
  assert.match(sql, /jsonb_array_length\(p_document -> 'elements'\) > 5000/i);
  assert.match(sql, /document = v_document/i);
  assert.doesNotMatch(sql, /svg\s+text|document_svg|svg_document/i);

  assert.match(fixture, /'schemaVersion', 1/i);
  assert.match(fixture, /'id', 'document-game-day-square'/i);
  assert.match(fixture, /'title', 'Spieltag Quadrat'/i);
  assert.match(fixture, /'format'[\s\S]*'width', 1080[\s\S]*'height', 1080/i);
  assert.match(fixture, /'type', 'group'[\s\S]*'children', jsonb_build_array/i);
  assert.match(fixture, /'type', 'text'/i);
  assert.match(fixture, /'text', 'Heimspiel'/i);
  for (const field of ['x', 'y', 'width', 'height', 'rotation']) {
    const minimumOccurrences = ['width', 'height'].includes(field) ? 3 : 2;
    assert.ok(
      (fixture.match(new RegExp(`'${field}'`, 'gi')) ?? []).length >=
        minimumOccurrences,
      `positive fixture must define ${field} for both group and text child`,
    );
  }
  assert.match(
    fixture,
    /'binding', jsonb_build_object\([\s\S]*?'key', 'event\.title'[\s\S]*?'source', 'central'[\s\S]*?'lastSyncedValue', 'Heimspiel'/i,
  );
  for (const field of [
    'fill',
    'stroke',
    'strokeWidth',
    'opacity',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'textAlign',
  ]) {
    assert.match(fixture, new RegExp(`'${field}'`, 'i'));
  }
  assert.doesNotMatch(fixture, /'path'|'color'/i);
  assert.match(fixture, /'metadata'[\s\S]*'createdAt'[\s\S]*'updatedAt'/i);
  assert.doesNotMatch(fixture, /'groups'|'bindings'/i);

  for (const expectedCase of [
    "Doppelte Top-Level-ID",
    "Doppelte ID innerhalb einer Gruppe",
    "Top-Level-/Nested-ID-Kollision",
    "Nested Child ohne ID",
    "GroupElement mit ungueltigen children",
    "Elementlimit wurde durch GroupElement umgangen",
    "Zu tiefe GroupElement-Verschachtelung",
    "Unbekannte schemaVersion"
  ]) {
    assert.ok(sqlTest.includes(expectedCase), `SQL-Testfall fehlt: ${expectedCase}`);
  }
});

test("draft saving is owner-bound and atomically versioned", async () => {
  const sql = await readMigration();
  const saveFunction = sql.match(
    /create function app_private\.api_social_media_generator_draft_save[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(saveFunction, /draft\.owner_user_id = v_user_id/i);
  assert.match(saveFunction, /draft\.version = v_expected_version/i);
  assert.match(saveFunction, /version = draft\.version \+ 1/i);
  assert.match(saveFunction, /SOCIAL_MEDIA_DRAFT_VERSION_CONFLICT/i);
  assert.match(saveFunction, /errcode = 'PT409'/i);
  assert.doesNotMatch(saveFunction, /p_payload\s*->>\s*'(?:ownerUserId|userId)'/i);
});

test("all six actions stay behind pd_api and platform write guards", async () => {
  const sql = await readMigration();
  const actions = [
    "social_media_generator_bootstrap",
    "social_media_generator_preferences_update",
    "social_media_generator_draft_create",
    "social_media_generator_draft_get",
    "social_media_generator_drafts_list",
    "social_media_generator_draft_save"
  ];

  for (const action of actions) {
    assert.match(sql, new RegExp(`when '${action}'`, "i"));
  }
  assert.match(sql, /when 'social_media_generator_bootstrap' then 'READ'/i);
  assert.match(sql, /when 'social_media_generator_draft_get' then 'READ'/i);
  assert.match(sql, /when 'social_media_generator_draft_save' then 'USER_MUTATION'/i);
  assert.match(sql, /pd_api_dispatch_current_before_social_media_generator_phase1/i);
});

test("private schema and helper functions keep browser roles at default deny", async () => {
  const sql = await readMigration();

  assert.match(sql, /alter table app_social_media\.user_preferences enable row level security/i);
  assert.match(sql, /alter table app_social_media\.drafts enable row level security/i);
  assert.match(
    sql,
    /revoke all on all tables in schema app_social_media\s+from public, anon, authenticated, service_role/i
  );
  assert.match(
    sql,
    /revoke all on function[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.doesNotMatch(sql, /grant\s+(?:select|insert|update|delete|all)[\s\S]*to\s+(?:anon|authenticated)/i);
  assert.doesNotMatch(sql, /service[_-]?role[_-]?(?:key|secret)/i);
});
