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

  assert.match(model, /create function app_private\.liveticker_require_public_dev/);
  assert.match(model, /environment' <> 'DEV'/);
  assert.match(model, /mode' <> 'NORMAL'/);
  assert.match(model, /perform app_private\.liveticker_require_public_dev\(\)/);
  assert.match(hardening, /create or replace function public\.pd_public_liveticker_games/);
  assert.match(hardening, /create or replace function public\.pd_public_liveticker_state/);
  assert.equal((hardening.match(/perform app_private\.liveticker_require_public_dev\(\)/g) || []).length, 2);
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
});

test("existing V4 engine stays intact behind the central-storage bootstrap", async () => {
  const bootstrap = await read("js/liveticker-bootstrap.js");

  assert.match(bootstrap, /await import\("\.\/runtime-config\.js"\)/);
  assert.match(bootstrap, /prepareLivetickerGameStorage/);
  assert.match(bootstrap, /Storage\.prototype\.setItem/);
  assert.match(bootstrap, /pd-liveticker-state-saved/);
  assert.match(bootstrap, /liveticker-prototype-v4\.js/);
});
