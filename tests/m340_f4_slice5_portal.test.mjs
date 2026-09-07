import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const files = {
  migration: "supabase/migrations/20260907065000_add_fanbus_publishing_portal_read_m340.sql",
  publishing: "js/modules/m340-publishing.js",
  fanbuses: "js/modules/fanbuses.js",
  auth: "js/auth.js",
  busOrga: "js/m328-bus-orga-shell.js",
  busOrgaModule: "js/modules/bus-orga-v2.js",
  busOrgaV3: "js/modules/bus-orga-v3.js",
  pages: "js/pages.js",
  fanbusPage: "pages/fanbuses.html",
  busOrgaPage: "pages/bus-orga.html",
  css: "css/app.css"
};

const content = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, relative]) => [
    key,
    await fs.readFile(path.join(root, relative), "utf8")
  ])
));

function functionBlock(source, signature, nextMarker) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `${signature} fehlt`);
  const end = source.indexOf(nextMarker, start + signature.length);
  assert.notEqual(end, -1, `Endmarker für ${signature} fehlt`);
  return source.slice(start, end);
}

test("Slice 5 overview is capability-protected and read-only at the platform gate", () => {
  const overview = functionBlock(
    content.migration,
    "create function app_private.api_fanbus_publishing_overview",
    "alter function app_private.pd_api_dispatch_current"
  );
  assert.match(overview, /require_capability\('fanbus\.publishing\.manage'\)/);
  assert.match(content.migration, /if v_action = 'fanbus_publishing_overview'/);
  assert.match(content.migration, /when 'fanbus_publishing_overview' then 'READ'/);
  assert.doesNotMatch(overview, /insert\s+into|update\s+app_modules|delete\s+from/i);
});

test("overview exposes only the frozen publishing model and safe job history", () => {
  for (const marker of [
    "'places', v_places",
    "'trips', v_trips",
    "'jobs', v_jobs",
    "'stats', jsonb_build_object",
    "'shortlinkPath', '/ontour/' || place.slug",
    "'resultManifest', history.result_manifest"
  ]) {
    assert.ok(content.migration.includes(marker), `${marker} fehlt`);
  }
  assert.match(content.migration, /limit 50/);
  assert.match(content.migration, /- 29/);
  assert.doesNotMatch(content.migration, /'claimToken'|'claim_token'|'requestSnapshot'|'request_snapshot'/);
});

test("anonymous stats remain aggregate-only and contain no request identity", () => {
  const forbidden = [
    "ip_address", "remote_addr", "user_agent", "cookie", "fingerprint",
    "device_id", "session_id", "visitor_id"
  ];
  for (const marker of forbidden) {
    assert.doesNotMatch(content.migration, new RegExp(marker, "i"));
  }
  assert.match(content.migration, /fanbus_publishing_place_landing_daily/);
  assert.match(content.migration, /fanbus_publishing_trip_referral_daily/);
  assert.match(content.migration, /landingCount/);
  assert.match(content.migration, /referralCount/);
});

test("Slice 5 preserves default-deny and adds no public table grants", () => {
  assert.match(content.migration, /revoke all on function[\s\S]*api_fanbus_publishing_overview/);
  assert.doesNotMatch(content.migration, /grant\s+(select|insert|update|delete|all)\s+on\s+(table\s+)?app_modules/i);
  assert.doesNotMatch(content.migration, /grant execute on function app_private\.api_fanbus_publishing_overview/i);
});

test("portal workspace uses only frozen M340 actions and capability gate", () => {
  for (const action of [
    "fanbus_publishing_overview",
    "fanbus_publishing_place_create",
    "fanbus_publishing_place_key_add",
    "fanbus_publishing_event_place_bind",
    "fanbus_publishing_job_enqueue"
  ]) {
    assert.match(content.publishing, new RegExp(`call\\(\\"${action}\\"`));
  }
  assert.match(content.publishing, /M340_PUBLISHING_CAPABILITY = "fanbus\.publishing\.manage"/);
  assert.match(content.publishing, /hasCapability\(M340_PUBLISHING_CAPABILITY\)/);
  assert.match(content.fanbuses, /view=publishing/);
  assert.match(content.fanbuses, /renderM340PublishingWorkspace/);
  assert.doesNotMatch(content.fanbusPage, /m340PublishingButton/);
  assert.match(content.busOrgaPage, /id="m340PublishingSection"[\s\S]*id="m340PublishingEntry"[\s\S]*Flyer &amp; Kurzlinks/);
  assert.match(content.busOrgaModule, /hasCapability\("fanbus\.publishing\.manage"\)/);
  assert.match(content.busOrgaModule, /openWorkspace\("publishing"\)/);
  assert.match(content.busOrga, /\[data-m340-back\]/);
});

test("portal keeps durable public links separate from the DEV staging test base", () => {
  assert.match(content.publishing, /environment === "DEV"[\s\S]*https:\/\/staging\.plaerrdeifl\.de/);
  assert.match(content.publishing, /https:\/\/plaerrdeifl\.de\/ontour\/\$\{place\?\.slug/);
  assert.match(content.publishing, /shortlinkPath/);
  assert.doesNotMatch(content.publishing, /fanbus-anmeldung\?trip=.*shortlink|shortlink.*fanbus-anmeldung/i);
});

test("browser publishing surface contains no server credentials or direct WebDAV client", () => {
  const forbidden = [
    "service_role", "SUPABASE_SERVICE_ROLE_KEY", "M340_WORKER_TOKEN",
    "nextcloud_app_password", "X-M340-Worker-Token", "Authorization: Basic",
    "remote.php/dav/files", "worker_token"
  ];
  for (const marker of forbidden) {
    assert.doesNotMatch(content.publishing, new RegExp(marker, "i"));
  }
  assert.match(content.publishing, /nextcloudPath/);
});

test("Bus-Orga discovery includes the dedicated publishing capability", () => {
  assert.match(content.auth, /"fanbus\.publishing\.manage"/);
  assert.match(content.busOrga, /"fanbus\.publishing\.manage"/);
  assert.match(content.busOrgaModule, /"fanbus\.publishing\.manage"/);
  assert.match(content.busOrgaModule, /renderPublishing\(\)/);
  assert.match(content.busOrgaV3, /bus-orga-v2\.js\?[^"\n]*m340=20260907-m340-publishing-bus-orga1/);
  assert.match(content.pages, /bus-orga-v3\.js\?[^"\n]*m340=20260907-m340-publishing-bus-orga1/);
});

test("publishing workspace has responsive styling within the existing fanbus surface", () => {
  assert.match(content.css, /\.m340-publishing-workspace/);
  assert.match(content.css, /\.m340-publishing-metrics/);
  assert.match(content.css, /@media \(max-width: 700px\)/);
  assert.match(content.css, /@media \(max-width: 430px\)/);
});
