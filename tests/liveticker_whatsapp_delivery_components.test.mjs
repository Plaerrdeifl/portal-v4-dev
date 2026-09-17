import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const migrationPath = "supabase/migrations/20260916064314_liveticker_whatsapp_delivery_components_dev_r1.sql";
const retryMigrationPath = "supabase/migrations/20260917055731_liveticker_whatsapp_delivery_retry_dev_r1.sql";

test("outbox contract supports exactly text, sticker, or sticker then text", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /alter column message drop not null/i);
  assert.match(sql, /delivery_mode in \('TEXT_ONLY', 'STICKER_THEN_TEXT', 'STICKER_ONLY'\)/i);
  assert.match(sql, /delivery_mode = 'TEXT_ONLY'[\s\S]*message is not null[\s\S]*sticker_status = 'NOT_REQUESTED'/i);
  assert.match(sql, /delivery_mode = 'STICKER_THEN_TEXT'[\s\S]*sticker_id is not null[\s\S]*message is not null/i);
  assert.match(sql, /delivery_mode = 'STICKER_ONLY'[\s\S]*sticker_id is not null[\s\S]*message is null[\s\S]*text_status = 'NOT_REQUESTED'/i);
  assert.match(sql, /char_length\(btrim\(message\)\) between 1 and 4000/i);
  assert.match(sql, /status <> 'SUCCEEDED'[\s\S]*sticker_status in \('NOT_REQUESTED', 'SENT'\)[\s\S]*text_status in \('NOT_REQUESTED', 'SENT'\)/i);
  assert.doesNotMatch(sql, /values\s*\([\s\S]{0,300}(?:'\.'|'\s')\s*,\s*v_sticker_id/i);
});

test("legacy jobs are backfilled without changing their delivery semantics", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /when sticker_id is null then 'TEXT_ONLY'\s+else 'STICKER_THEN_TEXT'/i);
  assert.match(sql, /when sticker_id is null then 'NOT_REQUESTED'/i);
  assert.match(sql, /when status = 'SUCCEEDED' then 'SENT'/i);
  assert.match(sql, /linked_action_id = client_action_id/i);
  assert.match(sql, /public\.pd_public_liveticker_sync_before_whatsapp_channel_r1/i);
  assert.match(sql, /case when nullif\(v_candidate ->> 'stickerId', ''\) is null then 'TEXT_ONLY' else 'STICKER_THEN_TEXT' end/i);
});

test("component status is durable in the outbox and exposed only through the worker gateway contract", async () => {
  const [sql, gateway, worker] = await Promise.all([
    read(migrationPath),
    read("supabase/functions/liveticker-whatsapp-worker/index.ts"),
    read("workers/liveticker-whatsapp/worker.mjs")
  ]);
  for (const column of [
    "sticker_status", "text_status", "sticker_waha_message_id", "sticker_sent_at",
    "text_waha_message_id", "text_sent_at"
  ]) assert.match(sql, new RegExp(`add column ${column}`, "i"));
  assert.match(sql, /'NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED'/i);
  assert.match(gateway, /sticker_status: stickerStatus/);
  assert.match(gateway, /text_status: textStatus/);
  assert.match(worker, /sentRecordFromJob\(job\)/);
  assert.match(worker, /failedComponent,\s*components: sentComponents\(record\)/);
});

test("stand-alone sticker enqueue uses the existing outbox without a fake action or text", async () => {
  const [sql, client, storage] = await Promise.all([
    read(migrationPath),
    read("js/liveticker-whatsapp-stickers.js"),
    read("js/liveticker-game-storage.js")
  ]);
  const enqueue = sql.match(/create function app_private\.api_liveticker_whatsapp_sticker_enqueue[\s\S]+?\n\$function\$;/i)?.[0] || "";
  assert.match(enqueue, /app_private\.liveticker_require_operator\(\)/i);
  assert.match(enqueue, /platform_release_environment\(\) is distinct from 'DEV'/i);
  assert.match(enqueue, /where sticker\.id = v_sticker_id and sticker\.active/i);
  assert.match(enqueue, /insert into app_modules\.liveticker_whatsapp_jobs/i);
  assert.match(enqueue, /'STICKER_ONLY',[\s\S]*'PENDING',[\s\S]*'NOT_REQUESTED'/i);
  assert.doesNotMatch(enqueue, /insert into app_modules\.liveticker_actions/i);
  assert.match(client, /api\.call\("liveticker_whatsapp_sticker_enqueue", stablePayload\)/);
  assert.match(storage, /"liveticker_whatsapp_sticker_enqueue"[\s\S]*\.includes\(event\.detail\?\.action\)[\s\S]*broadcastWhatsappWake\(\)/);
});

test("generic enqueue validates explicit components and creates one combined delivery", async () => {
  const sql = await read(migrationPath);
  const enqueue = sql.match(/create function app_private\.api_liveticker_whatsapp_delivery_enqueue[\s\S]+?\n\$function\$;/i)?.[0] || "";
  assert.match(enqueue, /v_mode not in \('TEXT_ONLY', 'STICKER_THEN_TEXT', 'STICKER_ONLY'\)/i);
  assert.match(enqueue, /v_mode = 'TEXT_ONLY' and \(v_sticker_id_raw is not null or v_message is null\)/i);
  assert.match(enqueue, /v_mode = 'STICKER_THEN_TEXT' and \(v_sticker_id_raw is null or v_message is null\)/i);
  assert.match(enqueue, /v_mode = 'STICKER_ONLY' and \(v_sticker_id_raw is null or v_message is not null\)/i);
  assert.match(enqueue, /v_request_key := 'delivery:' \|\| v_idempotency_key::text/i);
  assert.match(enqueue, /on conflict \(event_id, client_action_id, publication_version\) do nothing/i);
  assert.match(enqueue, /insert into app_modules\.liveticker_whatsapp_jobs/i);
  assert.doesNotMatch(enqueue, /insert into app_modules\.liveticker_actions|sendStickerToWaha|sendTextToWaha/i);
});

test("linking an existing action only updates the sticker delivery relationship", async () => {
  const sql = await read(migrationPath);
  const link = sql.match(/create function app_private\.api_liveticker_whatsapp_delivery_link[\s\S]+?\n\$function\$;/i)?.[0] || "";
  assert.match(link, /v_job\.delivery_mode <> 'STICKER_ONLY'/i);
  assert.match(link, /where action\.event_id = v_job\.event_id[\s\S]*action\.client_action_id = v_action_id/i);
  assert.match(link, /update app_modules\.liveticker_whatsapp_jobs\s+set linked_action_id = v_action_id/i);
  assert.doesNotMatch(link, /insert into|message\s*=|text_status\s*=/i);
});

test("sticker metadata uses the existing team model and enforces audience integrity", async () => {
  const sql = await read(migrationPath);
  assert.match(sql, /audience text not null default 'GENERAL'/i);
  assert.match(sql, /opponent_team_id uuid references app_modules\.liveticker_teams\(id\) on delete restrict/i);
  assert.match(sql, /category text not null default 'GENERAL'/i);
  assert.match(sql, /audience in \('OUR_TEAM', 'OPPONENT', 'GENERAL'\)/i);
  assert.match(sql, /category in \('GOAL', 'AGAINST', 'PENALTY', 'VIDEO_REVIEW', 'GENERAL'\)/i);
  assert.match(sql, /audience = 'OPPONENT' and opponent_team_id is not null/i);
  assert.match(sql, /audience in \('OUR_TEAM', 'GENERAL'\) and opponent_team_id is null/i);
  assert.match(sql, /where team\.id = v_opponent_team_id[\s\S]*team\.is_active[\s\S]*not team\.is_home_club/i);
  assert.match(sql, /where v_include_inactive or sticker\.active/i);
});

test("new RPCs stay behind the existing dispatcher and capability boundary", async () => {
  const sql = await read(migrationPath);
  for (const action of [
    "liveticker_whatsapp_sticker_enqueue",
    "liveticker_whatsapp_delivery_enqueue",
    "liveticker_whatsapp_delivery_link",
    "liveticker_whatsapp_deliveries_list",
    "liveticker_whatsapp_sticker_metadata_set"
  ]) {
    assert.match(sql, new RegExp(`when '${action}'`, "i"));
  }
  assert.match(sql, /when 'liveticker_whatsapp_deliveries_list' then 'READ'/i);
  assert.match(sql, /when 'liveticker_whatsapp_sticker_enqueue' then 'USER_MUTATION'/i);
  assert.match(sql, /when 'liveticker_whatsapp_delivery_enqueue' then 'USER_MUTATION'/i);
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated, service_role/i);
  assert.doesNotMatch(sql, /service[_-]?role[_-]?(?:key|secret)|waha[_-]?api[_-]?key/i);
});

test("manual delivery retry atomically reactivates only failed components on the same job", async () => {
  const [sql, client, storage] = await Promise.all([
    read(retryMigrationPath),
    read("js/liveticker-whatsapp-stickers.js"),
    read("js/liveticker-game-storage.js")
  ]);
  const retry = sql.match(/create function app_private\.api_liveticker_whatsapp_delivery_retry[\s\S]+?\n\$function\$;/i)?.[0] || "";
  assert.match(retry, /app_private\.liveticker_require_operator\(\)/i);
  assert.match(retry, /platform_release_environment\(\) is distinct from 'DEV'/i);
  assert.match(retry, /liveticker_assert_supported_game\(v_event_id\)/i);
  assert.match(retry, /where job\.id = v_job_id[\s\S]*job\.event_id = v_event_id[\s\S]*for update/i);
  assert.match(retry, /v_job\.status <> 'FAILED'/i);
  assert.match(retry, /status = 'PENDING'[\s\S]*attempt_count = 0[\s\S]*next_attempt_at = pg_catalog\.now\(\)/i);
  assert.match(retry, /case when sticker_status = 'FAILED' then 'PENDING' else sticker_status end/i);
  assert.match(retry, /case when text_status = 'FAILED' then 'PENDING' else text_status end/i);
  assert.doesNotMatch(retry, /insert into|delete from|sticker_waha_message_id\s*=|text_waha_message_id\s*=|sticker_sent_at\s*=|text_sent_at\s*=/i);
  assert.match(sql, /when 'liveticker_whatsapp_delivery_retry' then 'USER_MUTATION'/i);
  assert.match(client, /api\.call\("liveticker_whatsapp_delivery_retry"/);
  assert.match(storage, /"liveticker_whatsapp_delivery_retry"/);
});
