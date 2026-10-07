import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20260927002359_social_media_generator_templates_phase2.sql";
const readMigration = () =>
  fs.readFile(path.join(root, migrationPath), "utf8");

test("phase 2 adds versioned templates and per-user favorites", async () => {
  const sql = await readMigration();

  assert.match(sql, /create table app_social_media\.templates/i);
  assert.match(sql, /create table app_social_media\.template_versions/i);
  assert.match(sql, /create table app_social_media\.template_favorites/i);
  assert.match(sql, /status in \('DRAFT', 'PUBLISHED'\)/i);
  assert.match(sql, /version_number bigint not null/i);
  assert.match(sql, /revision bigint not null default 1/i);
  assert.match(sql, /current_published_version_id uuid/i);
  assert.match(
    sql,
    /create unique index social_media_template_versions_one_draft_idx[\s\S]*where status = 'DRAFT'/i
  );
  assert.match(
    sql,
    /primary key \(user_id, template_id\)/i
  );
});

test("drafts reference the concrete template version", async () => {
  const sql = await readMigration();

  assert.match(
    sql,
    /alter table app_social_media\.drafts[\s\S]*add column template_version_id uuid/i
  );
  assert.match(
    sql,
    /references app_social_media\.template_versions\(id\) on delete restrict/i
  );
  assert.match(
    sql,
    /'templateVersionId', draft\.template_version_id/i
  );
  assert.match(
    sql,
    /SOCIAL_MEDIA_GENERATOR_DRAFT_CREATED_FROM_TEMPLATE/i
  );
});

test("template draft saves are optimistic and published versions are not edited", async () => {
  const sql = await readMigration();
  const saveFunction = sql.match(
    /create function app_private\.api_social_media_generator_template_draft_save[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(saveFunction, /version\.status = 'DRAFT'/i);
  assert.match(saveFunction, /version\.revision = v_expected_revision/i);
  assert.match(saveFunction, /revision = version\.revision \+ 1/i);
  assert.match(saveFunction, /SOCIAL_MEDIA_TEMPLATE_DRAFT_VERSION_CONFLICT/i);
  assert.match(saveFunction, /errcode = 'PT409'/i);
  assert.doesNotMatch(saveFunction, /status = 'PUBLISHED'/i);
});

test("publishing preserves history and moves only the current published pointer", async () => {
  const sql = await readMigration();
  const publishFunction = sql.match(
    /create function app_private\.api_social_media_generator_template_publish[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(publishFunction, /set status = 'PUBLISHED'/i);
  assert.match(publishFunction, /published_by = v_user_id/i);
  assert.match(publishFunction, /published_at = pg_catalog\.now\(\)/i);
  assert.match(
    publishFunction,
    /current_published_version_id = v_version_id/i
  );
  assert.doesNotMatch(
    publishFunction,
    /delete from app_social_media\.template_versions/i
  );
  assert.doesNotMatch(
    publishFunction,
    /update app_social_media\.template_versions[\s\S]*status = 'DRAFT'[\s\S]*where[\s\S]*status = 'PUBLISHED'/i
  );
});

test("new template drafts derive from the latest published document", async () => {
  const sql = await readMigration();
  const beginFunction = sql.match(
    /create function app_private\.api_social_media_generator_template_draft_begin[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(beginFunction, /template\.current_published_version_id/i);
  assert.match(
    beginFunction,
    /select version\.document, version\.document_schema_version/i
  );
  assert.match(
    beginFunction,
    /max\(version\.version_number\), 0\) \+ 1/i
  );
  assert.match(beginFunction, /'DRAFT'/i);
});

test("template-created drafts only use published versions and clone the document identity", async () => {
  const sql = await readMigration();
  const createFunction = sql.match(
    /create function app_private\.api_social_media_generator_draft_create_from_template[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(createFunction, /version\.status = 'PUBLISHED'/i);
  assert.match(createFunction, /template\.is_active/i);
  assert.match(createFunction, /extensions\.gen_random_uuid\(\)::text/i);
  assert.match(createFunction, /'\{metadata,templateVersionId\}'/i);
  assert.match(createFunction, /template_version_id/i);
});

test("all phase 2 actions stay behind pd_api and platform write guards", async () => {
  const sql = await readMigration();
  const actions = [
    "social_media_generator_templates_list",
    "social_media_generator_template_get",
    "social_media_generator_template_create",
    "social_media_generator_template_draft_begin",
    "social_media_generator_template_draft_save",
    "social_media_generator_template_publish",
    "social_media_generator_template_favorite_set",
    "social_media_generator_draft_create_from_template"
  ];

  for (const action of actions) {
    assert.match(sql, new RegExp(`when '${action}'`, "i"));
  }

  assert.match(
    sql,
    /when 'social_media_generator_templates_list' then 'READ'/i
  );
  assert.match(
    sql,
    /when 'social_media_generator_template_get' then 'READ'/i
  );
  assert.match(
    sql,
    /when 'social_media_generator_template_publish' then 'USER_MUTATION'/i
  );
  assert.match(
    sql,
    /pd_api_dispatch_current_before_social_media_generator_templates_phase2/i
  );
});

test("phase 2 keeps browser roles at default deny", async () => {
  const sql = await readMigration();

  for (const table of [
    "templates",
    "template_versions",
    "template_favorites"
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
  assert.match(
    sql,
    /revoke all on function[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.doesNotMatch(
    sql,
    /grant\s+(?:select|insert|update|delete|all)[\s\S]*to\s+(?:anon|authenticated)/i
  );
  assert.doesNotMatch(sql, /service[_-]?role[_-]?(?:key|secret)/i);
});
