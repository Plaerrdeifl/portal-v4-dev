import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20261005083832_nextcloud_oauth_token_gate.sql",
  import.meta.url,
);
const configUrl = new URL("../supabase/config.toml", import.meta.url);

const [sql, config] = await Promise.all([
  readFile(migrationUrl, "utf8"),
  readFile(configUrl, "utf8"),
]);

test("OAuth access decision accepts an explicit user and keeps the central Nextcloud rule", () => {
  assert.match(
    sql,
    /identity_oauth_client_access_for_user\(\s*p_user_id uuid,\s*p_client_id uuid/s,
  );
  assert.match(sql, /nextcloud_sync\.user_has_access\(p_user_id\)/);
  const nextcloudBranch = sql.match(
    /when 'NEXTCLOUD' then([\s\S]*?)when 'WORDPRESS' then/,
  )?.[1] ?? "";
  assert.match(nextcloudBranch, /nextcloud_sync\.user_has_access\(p_user_id\)/);
  assert.doesNotMatch(nextcloudBranch, /team\.code\s*=\s*'SOCIAL_MEDIA'/);
  assert.match(
    sql,
    /api_identity_oauth_client_access[\s\S]*identity_oauth_client_access_for_user\(\s*v_auth,\s*v_client_id/s,
  );
});

test("custom access token hook uses event identity and OAuth client claims", () => {
  assert.match(sql, /p_event\s*->>\s*'user_id'/);
  assert.match(sql, /p_event\s*->\s*'claims'\s*->>\s*'client_id'/);
  assert.doesNotMatch(
    sql.match(/create or replace function app_private\.custom_access_token_hook[\s\S]*?\$function\$;/)?.[0] ?? "",
    /auth\.uid\(\)/,
  );
  assert.match(sql, /'http_code', 403/);
  assert.match(sql, /'clientCode', ''\) <> 'NEXTCLOUD'/);
  assert.match(
    sql,
    /nextcloud_sync\.user_has_access\(p_user_id\)[\s\S]*exception when others[\s\S]*'ACCESS_CHECK_FAILED'/,
  );
});

test("hook privileges are limited to the Supabase Auth administrator", () => {
  assert.match(sql, /security invoker/);
  assert.match(sql, /set search_path = ''/);
  assert.match(
    sql,
    /revoke all on function app_private\.custom_access_token_hook\(jsonb\)[\s\S]*from public, anon, authenticated, service_role/,
  );
  assert.match(
    sql,
    /grant execute[\s\S]*custom_access_token_hook\(jsonb\)[\s\S]*to supabase_auth_admin/,
  );
  assert.match(
    config,
    /\[auth\.hook\.custom_access_token\]\s+enabled = true\s+uri = "pg-functions:\/\/postgres\/app_private\/custom_access_token_hook"/,
  );
});
