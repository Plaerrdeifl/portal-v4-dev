import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const files = {
  originalMigration: "supabase/migrations/20260907065000_add_fanbus_publishing_portal_read_m340.sql",
  correctionMigration: "supabase/migrations/20260907185349_add_fanbus_auto_place_resolution_m340.sql",
  publishing: "js/modules/m340-publishing.js",
  fanbuses: "js/modules/fanbuses.js",
  auth: "js/auth.js",
  busOrga: "js/m328-bus-orga-shell.js",
  busOrgaModule: "js/modules/bus-orga-v2.js",
  busOrgaV3: "js/modules/bus-orga-v3.js",
  app: "js/app.js",
  pages: "js/pages.js",
  index: "index.html",
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

test("corrected overview remains capability-protected and read-only", () => {
  const overview = functionBlock(
    content.correctionMigration,
    "create or replace function app_private.api_fanbus_publishing_overview",
    "alter function app_private.pd_api_dispatch_current"
  );
  assert.match(overview, /require_capability\('fanbus\.publishing\.manage'\)/);
  assert.doesNotMatch(overview, /insert\s+into|update\s+app_modules|delete\s+from/i);
  assert.match(content.originalMigration, /when 'fanbus_publishing_overview' then 'READ'/);
});

test("overview exposes publishing outcomes but no technical place management", () => {
  const migration = content.correctionMigration;
  for (const marker of [
    "'trips', v_trips", "'jobs', v_jobs", "'stats', jsonb_build_object",
    "'resolutionStatus'", "'shortlinkPath'", "'resolutionCandidates'",
    "'resultManifest', history.result_manifest"
  ]) assert.ok(migration.includes(marker), `${marker} fehlt`);
  assert.match(migration, /limit 50/);
  assert.match(migration, /- 29/);
  assert.doesNotMatch(migration, /'places',\s*v_places|'boundPlaceKey'|'placeSlug'|'placeDisplayName'/);
  assert.doesNotMatch(migration, /'claimToken'|'claim_token'|'requestSnapshot'|'request_snapshot'/);
});

test("anonymous stats remain aggregate-only and contain no request identity", () => {
  for (const marker of [
    "ip_address", "remote_addr", "user_agent", "cookie", "fingerprint",
    "device_id", "session_id", "visitor_id"
  ]) assert.doesNotMatch(content.correctionMigration, new RegExp(marker, "i"));
  assert.match(content.correctionMigration, /fanbus_publishing_place_landing_daily/);
  assert.match(content.correctionMigration, /fanbus_publishing_trip_referral_daily/);
  assert.match(content.correctionMigration, /landingCount/);
  assert.match(content.correctionMigration, /referralCount/);
});

test("corrected backend preserves default-deny and adds no public table grants", () => {
  assert.match(content.correctionMigration, /revoke all on function[\s\S]*api_fanbus_publishing_overview/);
  assert.match(content.correctionMigration, /revoke all on table[\s\S]*fanbus_publishing_resolution_aliases[\s\S]*fanbus_publishing_alias_candidates/);
  assert.doesNotMatch(content.correctionMigration, /grant\s+(select|insert|update|delete|all)\s+on\s+(table\s+)?app_modules/i);
  assert.doesNotMatch(content.correctionMigration, /grant execute on function app_private\.api_fanbus_publishing_overview/i);
});

test("portal uses automatic resolution and no manual place actions", () => {
  for (const action of [
    "fanbus_publishing_resolution_ensure", "fanbus_publishing_resolution_choose",
    "fanbus_publishing_overview", "fanbus_publishing_job_enqueue"
  ]) assert.match(content.publishing, new RegExp(`call\\(\\"${action}\\"`));

  for (const action of [
    "fanbus_publishing_place_create", "fanbus_publishing_place_key_add",
    "fanbus_publishing_event_place_bind"
  ]) assert.doesNotMatch(content.publishing, new RegExp(`call\\(\\"${action}\\"`));

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

test("normal workspace contains no technical place management", () => {
  for (const forbidden of [
    "Dauerhaften Ort anlegen", "Slugname", "Venue-Key", "Place-Key",
    "Ort zuordnen", "data-m340-place-form", "data-m340-key-form",
    "data-m340-bind-form"
  ]) assert.ok(!content.publishing.includes(forbidden), `${forbidden} darf nicht gerendert werden`);
  assert.doesNotMatch(content.publishing, /model\?\.places|renderPlaceCard|normalizePlaceKey/);
});

test("ambiguity control exists only in the AMBIGUOUS render branch", () => {
  const start = content.publishing.indexOf('resolutionStatus === "AMBIGUOUS"');
  const end = content.publishing.indexOf('Veranstaltungsort fehlt', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const branch = content.publishing.slice(start, end);
  assert.match(branch, /Kurzlink-Ziel prüfen/);
  assert.match(branch, /data-m340-ambiguity-form/);
  assert.match(branch, /candidate\.displayName/);
  assert.doesNotMatch(branch, /candidate\.placeKey|candidate\.slug|Slug|Venue-Key/);
  assert.match(content.publishing, /resolutionStatus === "RESOLVED"[\s\S]*data-m340-enqueue/);
  assert.match(content.publishing, /Veranstaltungsort fehlt[\s\S]*beim Spieltermin ergänzen/);
});

test("public links preserve DEV staging separation", () => {
  assert.match(content.publishing, /environment === "DEV"[\s\S]*https:\/\/staging\.plaerrdeifl\.de/);
  assert.match(content.publishing, /https:\/\/plaerrdeifl\.de/);
  assert.match(content.publishing, /shortlinkPath/);
  assert.doesNotMatch(content.publishing, /fanbus-anmeldung\?trip=.*shortlink|shortlink.*fanbus-anmeldung/i);
});

test("anonymous stats and browser security remain unchanged", () => {
  for (const marker of [
    "ip_address", "remote_addr", "user_agent", "cookie", "fingerprint",
    "device_id", "session_id", "visitor_id"
  ]) assert.doesNotMatch(content.correctionMigration, new RegExp(marker, "i"));
  for (const marker of [
    "service_role", "SUPABASE_SERVICE_ROLE_KEY", "M340_WORKER_TOKEN",
    "nextcloud_app_password", "X-M340-Worker-Token", "Authorization: Basic",
    "remote.php/dav/files", "worker_token"
  ]) assert.doesNotMatch(content.publishing, new RegExp(marker, "i"));
  assert.match(content.publishing, /downloadUrl/);
  assert.doesNotMatch(content.publishing, /nextcloudPath/);
  assert.doesNotMatch(content.publishing, /app_modules|fanbus_publishing_resolution_aliases|fanbus_publishing_alias_candidates/);
});

test("Bus-Orga integration and publishing capability remain intact", () => {
  assert.match(content.auth, /"fanbus\.publishing\.manage"/);
  assert.match(content.busOrga, /"fanbus\.publishing\.manage"/);
  assert.match(content.busOrgaModule, /"fanbus\.publishing\.manage"/);
  assert.match(content.busOrgaModule, /renderPublishing\(\)/);
  assert.match(content.busOrgaV3, /bus-orga-v2\.js\?[^"\n]*m340=20260907-m340-publishing-bus-orga1/);
  assert.match(content.pages, /bus-orga-v3\.js\?[^"\n]*m340=20260907-m340-publishing-bus-orga1/);
  assert.match(content.publishing, /window\.location\.hash = "#\/bus-orga"/);
});

test("publishing workspace is trip-based and exposes only three flyer downloads", () => {
  assert.match(content.css, /\.m340-publishing-trip-row/);
  assert.match(content.css, /\.m340-publishing-flyers/);
  assert.match(content.css, /\.m340-publishing-flyer-buttons/);
  assert.match(content.publishing, /<details class="m340-publishing-flyers">/);
  assert.match(content.publishing, /Instagram Post/);
  assert.match(content.publishing, /Instagram Story/);
  assert.match(content.publishing, /LED 16:9/);
  assert.doesNotMatch(content.publishing, /data-m340-preview|preview-dialog|Asset-Vorschau|Vorschau<\//);
  assert.doesNotMatch(content.publishing, /artifactLabel|case "QR"|QR-Code/);
  assert.doesNotMatch(content.publishing, /m340-publishing-daily|Kurzlink-Statistik<\/h3>/);
});

test("flyer delivery fetches the original public DAV file and stays inside the portal", () => {
  const fetchBlock = functionBlock(content.publishing, "async function fetchFlyerArtifact", "function downloadFlyerBlob");
  assert.match(content.publishing, /public\.php\/dav\/files\/\$\{encodeURIComponent\(token\)\}/);
  assert.match(fetchBlock, /method: "GET"/);
  assert.match(fetchBlock, /credentials: "omit"/);
  assert.match(fetchBlock, /response\.blob\(\)/);
  assert.match(fetchBlock, /Content-Disposition/);
  assert.match(fetchBlock, /Content-Type/);
  assert.match(fetchBlock, /blob\.size !== expectedBytes/);
  assert.doesNotMatch(fetchBlock, /headers\s*:/);
  assert.doesNotMatch(content.publishing, /\/preview/);
  assert.doesNotMatch(content.publishing, /href="\$\{escapeAttr\(artifact\.downloadUrl\)\}"/);
  assert.match(content.publishing, /data-m340-flyer-download/);
  assert.match(content.publishing, /navigator\.canShare\(\{ files: \[file\] \}\)/);
  assert.match(content.publishing, /navigator\.share\(\{ files: \[file\], title: label \}\)/);
  assert.match(content.publishing, /URL\.createObjectURL\(blob\)/);
  assert.match(content.publishing, /URL\.revokeObjectURL\(objectUrl\)/);
  assert.match(content.publishing, /Flyer konnte nicht geladen werden\. Bitte erneut versuchen\./);
});

test("each published trip shows its own shortlink counters", () => {
  assert.match(content.publishing, /trip\?\.landingCount/);
  assert.match(content.publishing, /trip\?\.referralCount/);
  assert.match(content.publishing, /Kurzlink-Statistik dieser Fahrt/);
  assert.match(content.publishing, /<span>Kurzlink<\/span>/);
  assert.match(content.publishing, /Veröffentlichte Fahrten/);
});

test("normal UI uses user-facing language only", () => {
  for (const forbidden of [
    "Dauerhafter Kurzlink", "dauerhaften Ortslink", "dauerhafter Ort",
    "Canonical Place", "technische Ortszuordnung", "Alias-Zuordnung"
  ]) assert.ok(!content.publishing.toLocaleLowerCase("de-DE").includes(forbidden.toLocaleLowerCase("de-DE")), `${forbidden} darf nicht sichtbar sein`);
  assert.match(content.publishing, /<span class="m340-publishing-kicker">Bus-Orga<\/span>/);
  assert.doesNotMatch(content.publishing, /<span class="m340-publishing-kicker">Fanbus<\/span>/);
});

test("active import chain carries the M340 cache key end-to-end", () => {
  const cacheKey = "m340=20260908-ios-download-r1";
  assert.ok(content.fanbuses.includes(`m340-publishing.js?v=20260908-ios-download-r1`));
  assert.ok(content.pages.includes(`fanbuses.js?v=20260826-p800-r2-final-direct-fix&groups=20260828-m310-r1&m327=20260828-m327-r1&completion=20260829-m328-final1&correction=20260830-m328-c1&${cacheKey}`));
  assert.match(content.app, /pages\.js\?[^"\n]*m340=20260908-ios-download-r1/);
  assert.match(content.index, /js\/app\.js\?[^"\n]*m340=20260908-ios-download-r1/);
  assert.match(content.index, /css\/app\.css\?[^"\n]*m340=20260908-ios-download-r1/);
});
