import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("Liveticker access is a Social-Media team function, not plain membership", async () => {
  const migration = await read("supabase/migrations/20260905151000_add_liveticker_navigation_r1.sql");

  assert.match(migration, /SOCIAL_MEDIA/);
  assert.match(migration, /SOCIAL_LIVETICKER/);
  assert.match(migration, /'liveticker\.manage'/);
  assert.match(migration, /team_function_capabilities/);
  assert.match(migration, /Keine automatische Zuweisung/);
  assert.doesNotMatch(migration, /insert into app_portal\.team_function_assignments/i);
});

test("existing team-function editor can assign Liveticker selectively", async () => {
  const teams = await read("js/modules/teams.js");

  assert.match(teams, /availableFunctions/);
  assert.match(teams, /set_team_functions/);
  assert.match(teams, /Fachfunktionen bearbeiten/);
  assert.match(teams, /functionCodes/);
});

test("DEV standalone Liveticker stays outside the portal auth gate", async () => {
  const prototype = await read("liveticker/index.html");
  const bootstrap = await read("js/liveticker-bootstrap.js");
  assert.match(prototype, /liveticker-bootstrap\.js/);
  assert.match(bootstrap, /liveticker-engine-v4\.js/);
  assert.match(bootstrap, /liveticker-v5-support\.js/);
  assert.doesNotMatch(prototype + bootstrap, /Google|auth-gate|Anmeldung erforderlich/i);
});
