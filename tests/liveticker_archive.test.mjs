import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("completed Liveticker games have a central archive marker and journal", async () => {
  const migration = await read("supabase/migrations/20260905175500_add_liveticker_archive_r1.sql");
  assert.match(migration, /add column completed_at timestamptz/);
  assert.match(migration, /GAME_COMPLETED/);
  assert.match(migration, /GAME_RESET/);
  assert.match(migration, /pd_public_liveticker_complete/);
  assert.match(migration, /liveticker_require_public_dev/);
  assert.match(migration, /completed_at is not null/);
});

test("completed games leave the active selector and reject further public writes", async () => {
  const migration = await read("supabase/migrations/20260905175500_add_liveticker_archive_r1.sql");
  assert.match(migration, /pd_public_liveticker_games_before_archive_r1/);
  assert.match(migration, /pd_public_liveticker_state_before_archive_r1/);
  assert.match(migration, /pd_public_liveticker_sync_before_archive_r1/);
  assert.match(migration, /'completedAt'/);
  assert.match(migration, /LIVETICKER_GAME_COMPLETED/);
  assert.match(migration, /state\.completed_at is not null/);
  assert.match(migration, /grant execute on function public\.pd_public_liveticker_games\(\) to anon, authenticated/);
  assert.match(migration, /grant execute on function public\.pd_public_liveticker_sync\(uuid, integer, jsonb, text\) to anon, authenticated/);
});

test("archive and reset stay behind liveticker.manage and pd_api", async () => {
  const migration = await read("supabase/migrations/20260905175500_add_liveticker_archive_r1.sql");
  assert.match(migration, /api_liveticker_archive_list/);
  assert.match(migration, /api_liveticker_game_reset/);
  assert.match(migration, /require_capability\('liveticker\.manage'\)/g);
  assert.match(migration, /when 'liveticker_archive_list' then/);
  assert.match(migration, /when 'liveticker_game_reset' then/);
  assert.match(migration, /when 'liveticker_archive_list' then 'READ'/);
  assert.match(migration, /when 'liveticker_game_reset' then 'USER_MUTATION'/);
  assert.match(migration, /LIVETICKER_GAME_RESET/);
  assert.doesNotMatch(migration, /grant (?:select|insert|update|delete) on table/i);
});

test("final summary archives the selected central game", async () => {
  const storage = await read("js/liveticker-game-storage.js");
  assert.match(storage, /completeSelectedGame/);
  assert.match(storage, /pd_public_liveticker_complete/);
  assert.match(storage, /#finalSummaryButton/);
  assert.match(storage, /p_expected_revision: serverState\.revision/);
  assert.match(storage, /Abgeschlossen · archiviert/);
});

test("portal Liveticker exposes archive drilldown and protected reset", async () => {
  const module = await read("js/modules/liveticker-admin.js");
  assert.match(module, /data-open-archive/);
  assert.match(module, /Spielarchiv/);
  assert.match(module, /liveticker_archive_list/);
  assert.match(module, /data-archive-event-id/);
  assert.match(module, /data-back-archive/);
  assert.match(module, /data-reset-archive-game/);
  assert.match(module, /liveticker_game_reset/);
  assert.match(module, /expectedRevision: game\.revision/);
  assert.match(module, /Das Kalenderspiel selbst bleibt bestehen/);
});
