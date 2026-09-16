import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migration = await fs.readFile(
  path.join(root, "supabase/migrations/20260916141500_shop_identity_r1.sql"),
  "utf8"
);
const adminOverride = await fs.readFile(
  path.join(root, "supabase/migrations/20260916182500_shop_admin_override_r1.sql"),
  "utf8"
);

test("shop identity is authenticated self-only and returns no PII", () => {
  assert.match(migration, /function public\.pd_shop_identity\(\)/);
  assert.match(migration, /require_active_user\(\)/);
  assert.match(migration, /user_member_links/);
  assert.match(migration, /member\.status = 'ACTIVE'/);
  assert.match(migration, /'PORTAL'/);
  assert.match(migration, /'MEMBER'/);
  assert.match(migration, /revoke all on function public\.pd_shop_identity\(\) from public, anon/);
  assert.match(migration, /grant execute on function public\.pd_shop_identity\(\) to authenticated/);
  assert.doesNotMatch(migration, /first_name|last_name|email|phone|street|house_number|postal_code/i);
});


test("shop identity exposes server-derived admin override without changing customer class", () => {
  assert.match(adminOverride, /app_private\.has_capability\(v_actor, 'portal\.admin'\)/);
  assert.match(adminOverride, /'isAdmin', v_is_admin/);
  assert.match(adminOverride, /when v_member_id is null then 'PORTAL'/);
  assert.doesNotMatch(adminOverride, /first_name|last_name|email|phone|street|house_number|postal_code/i);
});
