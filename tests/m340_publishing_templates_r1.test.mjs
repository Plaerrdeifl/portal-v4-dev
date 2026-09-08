import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260908190557_m340_publishing_settings_templates_r1.sql");
const historical = read("supabase/migrations/20260908101657_m340_publishing_ux_templates.sql");
const portal = read("js/modules/m340-publishing.js");
const api = read("js/api.js");
const upload = read("supabase/functions/m340-publishing-templates/index.ts");
const workerGateway = read("supabase/functions/m340-publishing-worker/index.ts");
const worker = read("workers/m340-publishing/worker.py");

 test("historical template foundation is restored under the applied DEV migration version", () => {
  assert.match(historical, /m340-publishing-templates/);
  assert.match(historical, /fanbus_publishing_template_versions/);
  assert.match(historical, /pd_m340_fanbus_publishing_template_activate/);
});

test("output settings are private capability-gated and snapshot-frozen", () => {
  assert.match(migration, /fanbus_publishing_output_settings/);
  assert.match(migration, /require_capability\('fanbus\.publishing\.manage'\)/);
  assert.match(migration, /trip_label_enabled boolean not null default true/);
  assert.match(migration, /trip_label_text text not null default 'FANBUSFAHRT'/);
  assert.match(migration, /'schemaVersion',2/);
  assert.match(migration, /'publishing',jsonb_build_object/);
  assert.match(migration, /m340_fanbus_publishing_template_snapshot\(\)/);
  assert.match(migration, /fanbus_publishing_output_settings_update.*USER_MUTATION/s);
  assert.match(migration, /fanbus_publishing_template_upload_authorize.*USER_MUTATION/s);
});

test("template replacement remains private versioned and rollbackable", () => {
  assert.match(migration, /pd_m340_fanbus_publishing_template_resolve/);
  assert.match(migration, /fanbus_publishing_template_reset/);
  assert.match(historical, /fanbus_publishing_template_rollback/);
  assert.doesNotMatch(historical, /grant .*authenticated.*fanbus_publishing_template_versions/is);
});

test("portal exposes settings and exactly three template upload targets without previews", () => {
  assert.match(portal, /Flyer-Einstellungen/);
  assert.match(portal, /data-m340-label-form/);
  assert.match(portal, /fanbus_publishing_output_settings_update/);
  assert.match(portal, /uploadM340Template/);
  assert.match(portal, /data-m340-template-rollback/);
  assert.match(portal, /data-m340-template-reset/);
  assert.match(api, /functions\/v1\/m340-publishing-templates/);
  assert.doesNotMatch(portal, /<img[^>]+m340/i);
  assert.doesNotMatch(portal, /QR-Code herunterladen|data-m340-qr-download/);
});

test("upload gateway is DEV-only bounded and validates active SVG content", () => {
  assert.match(upload, /https:\/\/dev\.plaerrdeifl\.de/);
  assert.match(upload, /MAX_SVG_BYTES = 5 \* 1024 \* 1024/);
  assert.match(upload, /m340-trip-label-brush/);
  assert.match(upload, /m340-qr-vector/);
  assert.match(upload, /DOCTYPE\|<!ENTITY/);
  assert.match(upload, /foreignObject\|iframe\|object\|embed/);
  assert.match(upload, /Externe Ressourcen/);
  assert.match(upload, /fanbus_publishing_template_upload_authorize/);
  assert.match(upload, /pd_m340_fanbus_publishing_template_activate/);
  assert.match(upload, /SUPABASE_SECRET_KEYS/);
  assert.doesNotMatch(upload, /Authorization: `Bearer \$\{config\.serviceRoleKey\}`/);
});

test("worker gateway signs only a resolved private template version", () => {
  assert.match(workerGateway, /action === "template"/);
  assert.match(workerGateway, /pd_m340_fanbus_publishing_template_resolve/);
  assert.match(workerGateway, /storage\/v1\/object\/sign/);
  assert.match(workerGateway, /expiresIn: 300/);
  assert.doesNotMatch(workerGateway, /Authorization: `Bearer \$\{config\.supabaseSecretKey\}`/);
});

test("worker keeps v1 compatibility and renders v2 label plus dynamic brush", () => {
  assert.match(worker, /schema_version == 1/);
  assert.match(worker, /schema_version == 2/);
  assert.match(worker, /TRIP_LABEL_DEFAULT = "FANBUSFAHRT"/);
  assert.match(worker, /normalized\["tripLabel"\]\["text"\]/);
  assert.match(worker, /m340-trip-label-brush/);
  assert.match(worker, /--query-id=/);
  assert.match(worker, /data-m340-brush-scale/);
  assert.match(worker, /action": "template"/);
  assert.match(worker, /TEMPLATE_HASH_MISMATCH/);
});
