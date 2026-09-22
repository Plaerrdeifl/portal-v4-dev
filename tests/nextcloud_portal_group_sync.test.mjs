import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../supabase/migrations/20260922121500_nextcloud_portal_group_sync.sql",
  import.meta.url,
);

test("Nextcloud groups are derived from Portal sources", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /nextcloud_sync\.social_media_members\(\)/);
  assert.match(sql, /team\.code = 'SOCIAL_MEDIA'/);
  assert.match(sql, /nextcloud_sync\.board_members\(\)/);
  assert.match(sql, /app_private\.m150_current_board\(\)/);
  assert.match(sql, /'socialmedia'::text/);
  assert.match(sql, /'vorstand'::text/);
  assert.match(sql, /nextcloud_sync\.portal_group_members\(\)/);
});

test("Nextcloud sync role stays read-only and private", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /nextcloud_portal_sync/);
  assert.match(sql, /default_transaction_read_only = on/);
  assert.match(sql, /revoke all on schema nextcloud_sync from public/);
  assert.match(sql, /revoke all on function nextcloud_sync\.portal_group_members\(\) from public/);
  assert.match(sql, /grant execute on function nextcloud_sync\.portal_group_members\(\)[\s\S]*to nextcloud_portal_sync/);
});
