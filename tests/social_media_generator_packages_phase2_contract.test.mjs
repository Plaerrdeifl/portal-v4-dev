import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20260927003724_social_media_generator_packages_phase2.sql";
const readMigration = () =>
  fs.readFile(path.join(root, migrationPath), "utf8");

test("package templates have versioned draft/published state", async () => {
  const sql = await readMigration();
  assert.match(sql, /create table app_social_media\.package_templates/i);
  assert.match(sql, /create table app_social_media\.package_template_versions/i);
  assert.match(sql, /create table app_social_media\.package_template_version_items/i);
  assert.match(sql, /status in \('DRAFT', 'PUBLISHED'\)/i);
  assert.match(
    sql,
    /create unique index social_media_package_template_versions_one_draft_idx[\s\S]*where status = 'DRAFT'/i
  );
  assert.match(sql, /current_published_version_id uuid/i);
});

test("package items bind concrete template versions", async () => {
  const sql = await readMigration();
  assert.match(
    sql,
    /template_version_id uuid not null[\s\S]*references app_social_media\.template_versions\(id\)/i
  );
  assert.match(
    sql,
    /template_version\.status = 'PUBLISHED'/i
  );
  assert.match(
    sql,
    /SOCIAL_MEDIA_PACKAGE_ITEM_TEMPLATE_VERSION_INVALID/i
  );
});

test("package draft save uses optimistic revision and only mutable draft", async () => {
  const sql = await readMigration();
  const fn = sql.match(
    /create function app_private\.api_social_media_generator_package_template_draft_save[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(fn, /version\.status = 'DRAFT'/i);
  assert.match(fn, /version\.revision = v_expected_revision/i);
  assert.match(fn, /revision = version\.revision \+ 1/i);
  assert.match(fn, /SOCIAL_MEDIA_PACKAGE_DRAFT_VERSION_CONFLICT/i);
  assert.match(fn, /errcode = 'PT409'/i);
});

test("published package history points to immutable child template versions", async () => {
  const sql = await readMigration();
  const publish = sql.match(
    /create function app_private\.api_social_media_generator_package_template_publish[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(publish, /set status = 'PUBLISHED'/i);
  assert.match(
    publish,
    /current_published_version_id = v_version_id/i
  );
  assert.doesNotMatch(
    publish,
    /delete from app_social_media\.package_template_versions/i
  );
});

test("media packages instantiate linked drafts for every package slot", async () => {
  const sql = await readMigration();
  const create = sql.match(
    /create function app_private\.api_social_media_generator_media_package_create[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(sql, /create table app_social_media\.media_packages/i);
  assert.match(
    sql,
    /add column media_package_id uuid[\s\S]*add column package_slot_key text/i
  );
  assert.match(
    sql,
    /create unique index social_media_drafts_media_package_slot_idx/i
  );
  assert.match(create, /template_version\.status = 'PUBLISHED'/i);
  assert.match(create, /insert into app_social_media\.drafts/i);
  assert.match(create, /v_item\.template_version_id/i);
  assert.match(create, /v_media_package_id, v_item\.slot_key/i);
});

test("shared media-package data is optimistic and separate from draft layout", async () => {
  const sql = await readMigration();
  const save = sql.match(
    /create function app_private\.api_social_media_generator_media_package_data_save[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(sql, /data jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /version bigint not null default 1/i);
  assert.match(save, /media_package\.version = v_expected_version/i);
  assert.match(save, /version = media_package\.version \+ 1/i);
  assert.match(save, /SOCIAL_MEDIA_MEDIA_PACKAGE_VERSION_CONFLICT/i);
  assert.match(save, /errcode = 'PT409'/i);
});

test("package and media-package actions remain behind pd_api", async () => {
  const sql = await readMigration();
  const actions = [
    "social_media_generator_package_templates_list",
    "social_media_generator_package_template_get",
    "social_media_generator_package_template_create",
    "social_media_generator_package_template_draft_begin",
    "social_media_generator_package_template_draft_save",
    "social_media_generator_package_template_publish",
    "social_media_generator_package_template_favorite_set",
    "social_media_generator_media_package_create",
    "social_media_generator_media_packages_list",
    "social_media_generator_media_package_get",
    "social_media_generator_media_package_data_save"
  ];
  for (const action of actions) {
    assert.match(sql, new RegExp(`when '${action}'`, "i"));
  }
  assert.match(
    sql,
    /when 'social_media_generator_package_templates_list' then 'READ'/i
  );
  assert.match(
    sql,
    /when 'social_media_generator_media_package_data_save' then 'USER_MUTATION'/i
  );
});

test("package tables keep browser roles at default deny", async () => {
  const sql = await readMigration();
  for (const table of [
    "package_templates",
    "package_template_versions",
    "package_template_version_items",
    "package_template_favorites",
    "media_packages"
  ]) {
    assert.match(
      sql,
      new RegExp(
        `alter table app_social_media\\.${table} enable row level security`,
        "i"
      )
    );
  }
  assert.match(
    sql,
    /revoke all on all tables in schema app_social_media[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.doesNotMatch(
    sql,
    /grant\s+(?:select|insert|update|delete|all)[\s\S]*to\s+(?:anon|authenticated)/i
  );
});
