import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function source(path) {
  return readFile(resolve(import.meta.dirname, "..", path), "utf8");
}

test("liveticker roster route is protected by portal navigation", async () => {
  const router = await source("js/router.js");
  const pages = await source("js/pages.js");
  assert.match(router, /liveticker:\s*\{/);
  assert.match(router, /page:\s*"liveticker-admin\.html"/);
  assert.match(router, /"liveticker",\s*\n\s*"fanbuses"/);
  assert.match(pages, /hydrateLivetickerAdmin/);
  assert.match(pages, /modules\/liveticker-admin\.js/);
});

test("roster module uses central pd_api actions and optimistic revisions", async () => {
  const module = await source("js/modules/liveticker-admin.js");
  assert.match(module, /liveticker_teams_list/);
  assert.match(module, /liveticker_team_save/);
  assert.match(module, /liveticker_player_save/);
  assert.match(module, /expectedRevision/);
  assert.match(module, /GOALIE/);
  assert.match(module, /DEFENSE/);
  assert.match(module, /FORWARD/);
});

test("team selection opens a dedicated detail view with back navigation", async () => {
  const module = await source("js/modules/liveticker-admin.js");
  assert.match(module, /data-back-teams/);
  assert.match(module, /currentTeamId\s*\?\s*teams\.find/);
  assert.match(module, /currentTeamId\s*=\s*"";\s*\n\s*render\(\)/);
  assert.doesNotMatch(module, /\|\|\s*teams\[0\]/);
  assert.doesNotMatch(module, /v4-team-layout/);
});

test("schema migration protects writes and seeds the first matchup", async () => {
  const migration = await source("supabase/migrations/20260905150000_add_liveticker_team_rosters_r1.sql");
  assert.match(migration, /'liveticker\.manage'/);
  assert.match(migration, /create table app_modules\.liveticker_teams/);
  assert.match(migration, /create table app_modules\.liveticker_players/);
  assert.match(migration, /when 'liveticker_teams_list' then 'READ'/);
  assert.match(migration, /when 'liveticker_team_save' then 'USER_MUTATION'/);
  assert.match(migration, /Mighty Dogs Schweinfurt/);
  assert.match(migration, /TecArt Black Dragons Erfurt/);
});

test("bootstrap exposes liveticker only through the central capability", async () => {
  const migration = await source("supabase/migrations/20260905151000_add_liveticker_navigation_r1.sql");
  assert.match(migration, /has_capability\(v_auth_id, 'liveticker\.manage'\)/);
  assert.match(migration, /\{navigation,liveticker\}/);
});
