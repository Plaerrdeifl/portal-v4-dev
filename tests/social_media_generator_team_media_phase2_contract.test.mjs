import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20260927070708_social_media_generator_team_media_phase2.sql";
const readMigration = () =>
  fs.readFile(path.join(root, migrationPath), "utf8");

test("generator team media reuses canonical liveticker team logos read-only", async () => {
  const sql = await readMigration();

  assert.match(sql, /from app_modules\.liveticker_teams as team/i);
  assert.match(sql, /where team\.is_active/i);
  assert.match(sql, /'logoUploaded', team\.logo_data is not null/i);
  assert.match(sql, /'logoSha256', team\.logo_sha256/i);
  assert.match(sql, /'logoAssetPath', team\.logo_asset_path/i);
  assert.doesNotMatch(
    sql,
    /insert into app_modules\.liveticker_teams|update app_modules\.liveticker_teams|delete from app_modules\.liveticker_teams/i
  );
});

test("logo bytes are loaded separately and require generator access", async () => {
  const sql = await readMigration();
  const getLogo = sql.match(
    /create function app_private\.api_social_media_generator_media_team_logo_get[\s\S]+?\n\$function\$;/i
  )?.[0] || "";

  assert.match(getLogo, /social_media_generator_require_access\(\)/i);
  assert.match(getLogo, /'dataBase64'/i);
  assert.match(getLogo, /encode\(v_team\.logo_data, 'base64'\)/i);
  assert.match(getLogo, /SOCIAL_MEDIA_TEAM_ID_REQUIRED/i);
  assert.match(getLogo, /SOCIAL_MEDIA_TEAM_NOT_FOUND/i);
});

test("team-media actions stay behind pd_api and are classified READ", async () => {
  const sql = await readMigration();

  for (const action of [
    "social_media_generator_media_teams_list",
    "social_media_generator_media_team_logo_get"
  ]) {
    assert.match(sql, new RegExp("when '" + action + "'", "i"));
    assert.match(
      sql,
      new RegExp("when '" + action + "' then 'READ'", "i")
    );
  }

  assert.match(
    sql,
    /revoke all on function[\s\S]*api_social_media_generator_media_teams_list\(\)[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.match(
    sql,
    /grant execute on function[\s\S]*api_social_media_generator_media_team_logo_get\(jsonb\)[\s\S]*to postgres/i
  );
});
