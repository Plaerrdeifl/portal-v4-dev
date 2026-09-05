import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("game storage is event-bound, revision-safe and journaled", async () => {
  const migration = await read("supabase/migrations/20260905161000_add_liveticker_game_storage_r1.sql");

  assert.match(migration, /create table app_modules\.liveticker_game_states/);
  assert.match(migration, /event_id uuid primary key references app_modules\.events/);
  assert.match(migration, /create table app_modules\.liveticker_actions/);
  assert.match(migration, /create table app_modules\.liveticker_journal/);
  assert.match(migration, /p_expected_revision integer/);
  assert.match(migration, /LIVETICKER_STALE_REVISION/);
  assert.match(migration, /ACTION_UPSERT/);
  assert.match(migration, /ACTION_REMOVE/);
  assert.match(migration, /MINUTE_SET/);
  assert.match(migration, /enable row level security/g);
  assert.doesNotMatch(migration, /grant (?:select|insert|update|delete) on table[\s\S]+to anon/i);
});

test("all anonymous Liveticker RPCs fail closed outside DEV", async () => {
  const model = await read("supabase/migrations/20260905161000_add_liveticker_game_storage_r1.sql");
  const hardening = await read("supabase/migrations/20260905161500_harden_liveticker_public_dev_only_r1.sql");
  const calendar = await read("supabase/migrations/20260905170500_liveticker_calendar_games_r1.sql");

  assert.match(model, /create function app_private\.liveticker_require_public_dev/);
  assert.match(model, /environment' <> 'DEV'/);
  assert.match(model, /mode' <> 'NORMAL'/);
  assert.match(hardening, /perform app_private\.liveticker_require_public_dev\(\)/);
  assert.match(calendar, /perform app_private\.liveticker_require_public_dev\(\)/);
});

test("browser adapter selects a GAME event and syncs only state diffs", async () => {
  const storage = await read("js/liveticker-game-storage.js");

  assert.match(storage, /SELECTED_EVENT_KEY/);
  assert.match(storage, /pd_public_liveticker_games/);
  assert.match(storage, /pd_public_liveticker_state/);
  assert.match(storage, /pd_public_liveticker_sync/);
  assert.match(storage, /p_expected_revision: serverState\.revision/);
  assert.match(storage, /upserts/);
  assert.match(storage, /deletes/);
  assert.match(storage, /changes\.minute/);
  assert.match(storage, /error\.code !== "40001"/);
  assert.match(storage, /window\.setInterval\(poll, 3000\)/);
  assert.match(storage, /PD_LIVETICKER_GAME_CONTEXT/);
  assert.match(storage, /game\.homeAway === "AWAY" \? "away" : "home"/);
});

test("calendar migration no longer filters games by an existing roster", async () => {
  const calendar = await read("supabase/migrations/20260905170500_liveticker_calendar_games_r1.sql");
  assert.match(calendar, /left join lateral/);
  assert.match(calendar, /game\.opponent_name/);
  assert.match(calendar, /'players'/);
  assert.match(calendar, /'\[\]'::jsonb/);
  assert.doesNotMatch(calendar, /join app_modules\.liveticker_teams as opponent_team\s+on/i);
});

test("runtime bootstrap injects selected team rosters without changing the V4 source file", async () => {
  const bootstrap = await read("js/liveticker-bootstrap.js");
  assert.match(bootstrap, /prepareLivetickerGameStorage/);
  assert.match(bootstrap, /runtimeOpponentSource/);
  assert.match(bootstrap, /PD_LIVETICKER_GAME_CONTEXT/);
  assert.match(bootstrap, /ownTeam\?\.players/);
  assert.match(bootstrap, /new Blob/);
  assert.match(bootstrap, /liveticker-v5-support/);
});
