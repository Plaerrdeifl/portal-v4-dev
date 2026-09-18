import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("managed WhatsApp sticker delete archives rows and retains assets/history", async () => {
  const [migration, admin, helper, api, edge, pages] = await Promise.all([
    read("supabase/migrations/20260918064446_liveticker_whatsapp_sticker_soft_delete_dev_r1.sql"),
    read("js/modules/liveticker-admin.js"),
    read("js/liveticker-whatsapp-stickers.js"),
    read("js/api.js"),
    read("supabase/functions/liveticker-whatsapp-stickers/index.ts"),
    read("js/pages.js")
  ]);

  assert.match(migration, /add column archived_at timestamptz/);
  assert.match(migration, /add column archived_by uuid references app_portal\.users/);
  assert.match(migration, /archived_at is null or active = false/);
  assert.match(migration, /where active and archived_at is null/);
  assert.match(migration, /where sticker\.archived_at is null/);
  assert.match(migration, /'canDelete', true/);
  assert.doesNotMatch(migration, /LIVETICKER_WHATSAPP_STICKER_IN_USE/);
  assert.match(migration, /set active = false,[\s\S]*archived_at = v_archived_at/);
  assert.match(migration, /LIVETICKER_WHATSAPP_STICKER_ARCHIVED/);
  assert.match(migration, /'assetRetained', true/);
  assert.doesNotMatch(migration, /delete from app_modules\.liveticker_whatsapp_stickers/);

  assert.match(admin, /data-delete-sticker/);
  assert.doesNotMatch(admin, /sticker\.canDelete === false/);
  assert.match(admin, /Bereits vorhandene Versandhistorien bleiben erhalten/);
  assert.match(helper, /deleteWhatsappSticker/);
  assert.match(api, /deleteLivetickerWhatsappSticker/);
  assert.match(api, /method: "DELETE"/);

  assert.match(edge, /request\.method === "DELETE"/);
  assert.match(edge, /deleted\.archived !== true/);
  assert.match(edge, /deleted\.assetRetained !== true/);
  assert.doesNotMatch(edge, /storageDeleteManaged/);
  const removeStart = edge.indexOf("async function removeSticker");
  const serveStart = edge.indexOf("Deno.serve", removeStart);
  assert.doesNotMatch(edge.slice(removeStart, serveStart), /storage\/v1\/object/);
  assert.match(pages, /liveticker-admin\.js\?v=20260918-sticker-admin-r2/);
});
