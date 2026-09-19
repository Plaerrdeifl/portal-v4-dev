import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("DEV disables legacy graphic autoqueue so minute changes do not create flyers", async () => {
  const sql = await fs.readFile(
    path.join(root, "supabase/migrations/20260919142104_liveticker_disable_graphic_autqueue_dev_r1.sql"),
    "utf8"
  );
  assert.match(sql, /drop trigger if exists liveticker_graphic_autqueue_r1/i);
  assert.match(sql, /on app_modules\.liveticker_game_states/i);
});
