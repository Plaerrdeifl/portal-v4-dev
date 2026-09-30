import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const sql = await readFile(
  resolve(root, "supabase/migrations/20260930131000_identity_oauth_client_access_v1.sql"),
  "utf8"
);

test("identity OAuth access is dispatched through pd_api as a read action", () => {
  assert.match(sql, /when 'identity_oauth_client_access' then[\s\S]*api_identity_oauth_client_access/);
  assert.match(sql, /when 'identity_oauth_client_access' then 'READ'/);
  assert.match(sql, /rename to pd_api_dispatch_current_before_identity_oauth_v1/);
  assert.match(sql, /rename to platform_action_classification_before_identity_oauth_v1/);
});

test("identity OAuth access trusts only registered manual clients", () => {
  assert.match(sql, /from auth\.oauth_clients as c/);
  assert.match(sql, /c\.deleted_at is null/);
  assert.match(sql, /v_registration_type <> 'manual'/);
  assert.match(sql, /OAuth-Client ist nicht freigegeben/);
});

test("Nextcloud keeps its existing portal access rule", () => {
  assert.match(sql, /when 'nextcloud' then[\s\S]*nextcloud_sync\.user_has_access\(v_auth\)/);
});

test("WordPress access is derived from active SOCIAL_MEDIA team membership", () => {
  assert.match(sql, /when 'wordpress' then/);
  assert.match(sql, /app_portal\.team_memberships/);
  assert.match(sql, /team\.code = 'SOCIAL_MEDIA'/);
  assert.match(sql, /membership\.is_active = true/);
  assert.match(sql, /team\.is_active = true/);
});

test("identity helper functions are not directly executable by browser roles", () => {
  assert.match(
    sql,
    /revoke all on function app_private\.api_identity_oauth_client_access\(jsonb\)[\s\S]*from public, anon, authenticated/
  );
  assert.match(
    sql,
    /revoke all on function app_private\.pd_api_dispatch_current\(text, jsonb\)[\s\S]*from public, anon, authenticated/
  );
});
