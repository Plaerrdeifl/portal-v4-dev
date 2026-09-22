import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("DEV flyer workers expose their Nextcloud roots to the socialmedia group", async () => {
  const fanbus = await read("workers/m340-publishing/worker.py");
  const liveticker = await read("workers/liveticker-publishing/publishing_worker_dev.py");

  assert.match(fanbus, /NEXTCLOUD_SOCIAL_MEDIA_GROUP = "socialmedia"/);
  assert.match(fanbus, /"shareType": "1"/);
  assert.match(fanbus, /"shareWith": NEXTCLOUD_SOCIAL_MEDIA_GROUP/);
  assert.match(fanbus, /"permissions": "1"/);
  assert.match(fanbus, /ensure_social_media_access\(config\)/);
  assert.match(fanbus, /config\.nextcloud_root/);
  assert.match(fanbus, /NEXTCLOUD_LEGACY_DEV_ROOT = "\/Fanbus\/_DEV"/);
  assert.match(fanbus, /"MOVE"/);
  assert.match(fanbus, /method="DELETE"/);

  assert.match(liveticker, /DEV_NEXTCLOUD_ROOT = '\/Liveticker\/Liveticker - DEV'/);
  assert.match(liveticker, /DEV_NEXTCLOUD_SOCIAL_MEDIA_GROUP = 'socialmedia'/);
  assert.match(liveticker, /'shareType': '1'/);
  assert.match(liveticker, /'shareWith': DEV_NEXTCLOUD_SOCIAL_MEDIA_GROUP/);
  assert.match(liveticker, /'permissions': '1'/);
  assert.match(liveticker, /ensure_social_media_access_dev\(\)/);
  assert.match(liveticker, /DEV_LEGACY_NEXTCLOUD_ROOT = '\/Liveticker\/_DEV'/);
  assert.match(liveticker, /'MOVE'/);
  assert.match(liveticker, /method='DELETE'/);
});

test("social-media folder sharing is idempotent and preserves public artifact links", async () => {
  const fanbus = await read("workers/m340-publishing/worker.py");
  const liveticker = await read("workers/liveticker-publishing/publishing_worker_dev.py");

  assert.match(fanbus, /share_type == 1[\s\S]*permissions & 1 == 1[\s\S]*return/);
  assert.match(liveticker, /share_type == 1[\s\S]*permissions & 1 == 1[\s\S]*return/);
  assert.match(fanbus, /"shareType": "3"/);
  assert.match(liveticker, /base\.NEXTCLOUD_SHARE_API/);
});
