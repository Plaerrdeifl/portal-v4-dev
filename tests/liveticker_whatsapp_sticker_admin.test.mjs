import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("managed WhatsApp stickers can be renamed and only unused stickers can be deleted", async () => {
  const [migration, admin, helper, api, edge, pages] = await Promise.all([
    read("supabase/migrations/20260918060551_liveticker_whatsapp_sticker_admin_dev_r1.sql"),
    read("js/modules/liveticker-admin.js"),
    read("js/liveticker-whatsapp-stickers.js"),
    read("js/api.js"),
    read("supabase/functions/liveticker-whatsapp-stickers/index.ts"),
    read("js/pages.js")
  ]);

  assert.match(migration, /api_liveticker_whatsapp_sticker_rename/);
  assert.match(migration, /LIVETICKER_WHATSAPP_STICKER_RENAMED/);
  assert.match(migration, /api_liveticker_whatsapp_sticker_delete_authorize/);
  assert.match(migration, /pd_liveticker_whatsapp_sticker_delete/);
  assert.match(migration, /LIVETICKER_WHATSAPP_STICKER_IN_USE/);
  assert.match(migration, /where job\.sticker_id = p_sticker_id/);
  assert.match(migration, /'canDelete', not exists/);
  assert.match(migration, /grant execute on function public\.pd_liveticker_whatsapp_sticker_delete\(uuid, uuid\)\s+to service_role/i);

  assert.match(admin, /data-rename-sticker/);
  assert.match(admin, /data-delete-sticker/);
  assert.match(admin, /Sticker umbenennen/);
  assert.match(admin, /Sticker löschen\?/);
  assert.match(admin, /sticker\.canDelete === false/);
  assert.match(helper, /renameWhatsappSticker/);
  assert.match(helper, /deleteWhatsappSticker/);
  assert.match(api, /deleteLivetickerWhatsappSticker/);
  assert.match(api, /method: "DELETE"/);

  assert.match(edge, /Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"/);
  assert.match(edge, /liveticker_whatsapp_sticker_delete_authorize/);
  assert.match(edge, /pd_liveticker_whatsapp_sticker_delete/);
  assert.match(edge, /storageDeleteManaged/);
  assert.match(edge, /request\.method === "DELETE"/);
  assert.match(pages, /liveticker-admin\.js\?v=20260918-sticker-admin-r1/);
});
