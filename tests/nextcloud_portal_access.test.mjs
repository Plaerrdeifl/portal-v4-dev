import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../supabase/migrations/20260922171811_nextcloud_portal_access_board.sql",
  import.meta.url,
);
const consentUrl = new URL(
  "../oauth/consent/consent.js",
  import.meta.url,
);
const buildUrl = new URL(
  "../scripts/build-static.mjs",
  import.meta.url,
);

test("Nextcloud OAuth access uses the shared Portal group source", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(
    sql,
    /create or replace function nextcloud_sync\.user_has_access\(p_user_id uuid\)/,
  );
  assert.match(
    sql,
    /from nextcloud_sync\.portal_group_members\(\) as member/,
  );
  assert.match(
    sql,
    /v_nextcloud_access\s*:=\s*nextcloud_sync\.user_has_access\(v_auth\)/,
  );
  assert.match(sql, /'\{nextcloudAccess\}'/);
  assert.doesNotMatch(sql, /team\.code\s*=\s*'SOCIAL_MEDIA'/);
});

test("OAuth consent allows every Portal account granted by bootstrap", async () => {
  const source = await readFile(consentUrl, "utf8");

  assert.match(
    source,
    /state\.bootstrap\?\.nextcloudAccess !== true/,
  );
  assert.match(
    source,
    /Social-Media-Teams und den aktuellen Vorstand/,
  );
  assert.match(
    source,
    /getAuthorizationDetails\(authorizationId\)/,
  );
  assert.match(
    source,
    /approveAuthorization\(authorizationId\)/,
  );
});

test("DEV build publishes the OAuth consent route without a navigation redirect", async () => {
  const [source, redirects] = await Promise.all([
    readFile(buildUrl, "utf8"),
    readFile(new URL("../_redirects", import.meta.url), "utf8"),
  ]);

  assert.match(
    source,
    /const optionalDirectories = \[[\s\S]*"oauth"[\s\S]*\];/,
  );
  assert.match(
    source,
    /const optionalFiles = \[[\s\S]*"_redirects"[\s\S]*\];/,
  );
  assert.match(
    redirects,
    /^\/oauth\/consent\s+\/oauth\/consent\/index\.html\s+200$/m,
  );
});
