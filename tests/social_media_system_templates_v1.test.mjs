import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath =
  "supabase/migrations/20260929043817_social_media_system_templates_v1.sql";
const readMigration = () =>
  fs.readFile(path.join(root, migrationPath), "utf8");

test("system templates reuse the versioned generator model", async () => {
  const sql = await readMigration();

  for (const key of [
    "LIVETICKER_POST",
    "LIVETICKER_STORY",
    "FANBUS_POST",
    "FANBUS_STORY"
  ]) {
    assert.match(sql, new RegExp("'" + key + "'"));
  }
  assert.match(sql, /add column system_key text/i);
  assert.match(sql, /unique \(system_key\)/i);
  assert.doesNotMatch(sql, /create table app_social_media\.system_templates/i);
});

test("system template bindings remain protected while layout stays in documents", async () => {
  const sql = await readMigration();

  for (const binding of [
    "liveticker.homeTeamName",
    "liveticker.awayTeamName",
    "liveticker.homeLogoHref",
    "liveticker.awayLogoHref",
    "liveticker.score",
    "liveticker.resultSuffix",
    "liveticker.goalScorers",
    "fanbus.destination",
    "fanbus.tripLabel",
    "fanbus.weekday",
    "fanbus.eventDate",
    "fanbus.eventTime",
    "fanbus.price",
    "fanbus.registrationDeadlineDate",
    "fanbus.registrationDeadlineTime",
    "fanbus.departureInfo",
    "fanbus.boardingStops",
    "fanbus.remainingCapacity",
    "fanbus.contact1Name",
    "fanbus.contact1Phone",
    "fanbus.contact2Name",
    "fanbus.contact2Phone"
  ]) {
    assert.ok(sql.includes(binding), "binding missing: " + binding);
  }
  assert.match(sql, /'liveticker-goal-scorers'/i);
  assert.match(sql, /'fanbus-boarding-stops'/i);
  assert.match(sql, /SOCIAL_MEDIA_SYSTEM_TEMPLATE_BINDING_REQUIRED/i);
  assert.match(sql, /SOCIAL_MEDIA_SYSTEM_TEMPLATE_IDENTITY_LOCKED/i);
});

test("Liveticker requests freeze concrete published POST and STORY versions", async () => {
  const sql = await readMigration();

  assert.match(sql, /post_template_version_id uuid/i);
  assert.match(sql, /story_template_version_id uuid/i);
  assert.match(
    sql,
    /social_media_generator_system_template_version\('LIVETICKER_POST'\)/i
  );
  assert.match(
    sql,
    /social_media_generator_system_template_version\('LIVETICKER_STORY'\)/i
  );
  assert.match(sql, /'templates'.*jsonb_build_object/is);
  assert.match(sql, /'versionId', v_request\.post_template_version_id/i);
  assert.match(sql, /'versionId', v_request\.story_template_version_id/i);
  assert.match(sql, /LIVETICKER_TEMPLATE_NOT_PUBLISHED/i);
});

test("Fanbus drafts freeze published template version and central data snapshot", async () => {
  const sql = await readMigration();

  assert.match(sql, /api_social_media_generator_fanbus_draft_create/i);
  assert.match(sql, /'FANBUS_' \|\| v_kind/i);
  assert.match(sql, /template_version_id, binding_context/i);
  assert.match(sql, /social_media_generator_fanbus_binding_context/i);
  assert.match(sql, /fanbus\.boardingStops/i);
  assert.match(sql, /FANBUS_TEMPLATE_NOT_PUBLISHED/i);
  assert.match(
    sql,
    /when 'social_media_generator_fanbus_draft_create' then 'USER_MUTATION'/i
  );
});

test("new system workflow stays behind pd_api and default deny", async () => {
  const sql = await readMigration();

  assert.match(
    sql,
    /revoke all on function[\s\S]*api_social_media_generator_fanbus_draft_create\(jsonb\)[\s\S]*from public, anon, authenticated, service_role/i
  );
  assert.match(
    sql,
    /grant execute on function[\s\S]*api_social_media_generator_fanbus_draft_create\(jsonb\)[\s\S]*to postgres/i
  );
  assert.match(
    sql,
    /grant execute on function[\s\S]*pd_social_media_liveticker_render_worker_claim\(\)[\s\S]*to postgres, service_role/i
  );
  assert.doesNotMatch(
    sql,
    /grant\s+(?:select|insert|update|delete|all)[\s\S]*to\s+(?:anon|authenticated)/i
  );
});
