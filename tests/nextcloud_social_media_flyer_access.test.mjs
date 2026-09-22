import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("DEV publishing workers use isolated technical mounts instead of team group shares", async () => {
  const fanbus = await read("workers/m340-publishing/worker.py");
  const liveticker = await read("workers/liveticker-publishing/publishing_worker_dev.py");

  assert.match(fanbus, /"DEV": \{[\s\S]*?"nextcloud_root": "\/Publishing"[\s\S]*?"nextcloud_username": "m340-dev"/);
  assert.match(fanbus, /"PROD": \{[\s\S]*?"nextcloud_root": "\/Publishing"[\s\S]*?"nextcloud_username": "m340-prod"/);
  assert.doesNotMatch(fanbus, /NEXTCLOUD_SOCIAL_MEDIA_GROUP/);
  assert.doesNotMatch(fanbus, /"shareType": "1"/);
  assert.match(fanbus, /"shareType": "3"/);
  assert.match(fanbus, /ensure_publishing_root\(config\)/);

  assert.match(liveticker, /DEV_NEXTCLOUD_ROOT = '\/Publishing'/);
  assert.match(liveticker, /DEV_NEXTCLOUD_USER = 'liveticker-dev'/);
  assert.match(liveticker, /remote\.php\/dav\/files\/liveticker-dev/);
  assert.match(liveticker, /nextcloud_app_password/);
  assert.doesNotMatch(liveticker, /DEV_NEXTCLOUD_SOCIAL_MEDIA_GROUP/);
  assert.doesNotMatch(liveticker, /shareType.*1/);
  assert.match(liveticker, /ensure_collection_dev\(DEV_NEXTCLOUD_ROOT\)/);
});

test("DEV workers keep public artifact links while storage visibility comes from central mounts", async () => {
  const fanbus = await read("workers/m340-publishing/worker.py");
  const baseLiveticker = await read("scripts/liveticker-renderer/publishing_worker.py");

  assert.match(fanbus, /"shareType": "3"/);
  assert.match(fanbus, /"permissions": "1"/);
  assert.match(baseLiveticker, /'shareType': '3'/);
  assert.match(baseLiveticker, /'permissions': '1'/);
});
