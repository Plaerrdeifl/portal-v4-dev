import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const consent = await readFile(resolve(root, "oauth/consent/consent.js"), "utf8");
const html = await readFile(resolve(root, "oauth/consent/index.html"), "utf8");

test("consent UI is client-neutral before Supabase resolves the requesting application", () => {
  assert.match(html, /<title>Dienst verbinden – Plärrdeifl Portal<\/title>/);
  assert.match(html, /id="oauthTarget">Portal → externer Dienst/);
  assert.match(html, /id="oauthTitle">Dienst verbinden/);
  assert.doesNotMatch(html, /Portal → Nextcloud/);
});

test("consent UI renders actual OAuth client metadata and scopes", () => {
  assert.match(consent, /data\?\.client\?\.name/);
  assert.match(consent, /data\?\.client\?\.id/);
  assert.match(consent, /describeScopes\(data\?\.scope\)/);
  assert.match(consent, /document\.title = `\$\{displayName\} verbinden – Plärrdeifl Portal`/);
});

test("consent approval is impossible before server-side client access succeeds", () => {
  assert.match(
    consent,
    /currentAccess = await api\.call\("identity_oauth_client_access",[\s\S]*clientId: requestedClientId/,
  );
  assert.match(consent, /if \(currentAccess\?\.allowed !== true\)/);
  assert.match(
    consent,
    /if \(actionPending \|\| !currentAuthorization \|\| currentAccess\?\.allowed !== true\) return/,
  );
});

test("client-specific denial messages remain presentation-only", () => {
  assert.match(consent, /clientCode === "WORDPRESS"/);
  assert.match(consent, /Social-Media-Teams freigegeben/);
  assert.match(consent, /clientCode === "NEXTCLOUD"/);
  assert.match(consent, /Social-Media-Teams und den aktuellen Vorstand freigegeben/);
});
