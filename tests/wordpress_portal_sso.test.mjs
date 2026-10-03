import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const php = await readFile(
  resolve(root, "wordpress/plugins/plaerrdeifl-pd-portal-sso/plaerrdeifl-pd-portal-sso.php"),
  "utf8"
);

test("WordPress SSO is fail-closed and uses only public OAuth client configuration", () => {
  assert.match(php, /PD_PORTAL_OAUTH_ISSUER/);
  assert.match(php, /PD_PORTAL_OAUTH_CLIENT_ID/);
  assert.match(php, /PD_PORTAL_SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(php, /PD_PORTAL_OAUTH_CLIENT_SECRET/);
  assert.match(php, /pd_portal_sso_config/);
  assert.doesNotMatch(php, /client_secret/i);
  assert.doesNotMatch(php, /service_role/i);
  assert.doesNotMatch(php, /tpieykhhawszlzsoflnl/);
});

test("WordPress SSO uses authorization code with PKCE and exact callback construction", () => {
  assert.match(php, /response_type'\s*=>\s*'code'/);
  assert.match(php, /code_challenge_method'\s*=>\s*'S256'/);
  assert.match(php, /code_verifier'\s*=>\s*\$verifier/);
  assert.match(php, /client_id'\s*=>\s*\$config\['client_id'\]/);
  assert.match(php, /admin-post\.php/);
  assert.match(php, /pd_portal_oauth_callback/);
});

test("WordPress requests only identity scopes and resolves identity through UserInfo", () => {
  assert.match(php, /PD_PORTAL_SSO_SCOPE = 'email profile'/);
  assert.match(php, /\/oauth\/userinfo/);
  assert.match(php, /email_verified/);
  assert.match(php, /PD_PORTAL_SSO_META_SUBJECT/);
});


test("WordPress rechecks portal access server-side after every OAuth token exchange", () => {
  assert.match(php, /\/rest\/v1\/rpc\/pd_api/);
  assert.match(php, /identity_oauth_client_access/);
  assert.match(php, /true === \( \$payload\['ok'\] \?\? false \)/);
  assert.match(php, /\$payload\['data'\]/);
  assert.match(php, /'apikey'\s*=>\s*\$config\['publishable_key'\]/);
  assert.match(php, /'Authorization'\s*=>\s*'Bearer '\s*\.\s*\$access_token/);

  const exchange = php.indexOf("$access_token = pd_portal_sso_exchange_code( $config, $code");
  const access = php.indexOf("$access = pd_portal_sso_check_client_access( $config, $access_token );", exchange);
  const userinfo = php.indexOf("$identity = pd_portal_sso_fetch_userinfo( $config, $access_token );", exchange);
  assert.ok(exchange >= 0 && access > exchange && userinfo > access);
});

test("WordPress revokes a cached Supabase OAuth grant when portal access is denied", () => {
  assert.match(php, /\/user\/oauth\/grants/);
  assert.match(php, /'method'\s*=>\s*'DELETE'/);
  assert.match(php, /pd_portal_sso_access_denied/);
  assert.match(php, /pd_portal_sso_revoke_grant\( \$config, \$access_token \)/);
});

test("new local WordPress users receive only the built-in author role", () => {
  assert.match(php, /'role'\s*=>\s*'author'/);
  assert.doesNotMatch(php, /administrator/);
  assert.match(php, /pd_portal_sso_managed/);
});

test("portal-linked WordPress users cannot fall back to a local password login", () => {
  assert.match(php, /add_filter\( 'authenticate', 'pd_portal_sso_block_password_login', 30, 3 \)/);
  assert.match(php, /Mit PD-Portal anmelden/);
});
