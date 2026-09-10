import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const admin = readFileSync("js/modules/liveticker-admin.js", "utf8");

test("Liveticker template download embeds the standard background", () => {
  assert.match(admin, /async function downloadGraphicTemplate/);
  assert.match(admin, /#background_image/);
  assert.match(admin, /post-background\.jpg/);
  assert.match(admin, /story-background\.jpg/);
  assert.match(admin, /readAsDataURL/);
  assert.match(admin, /background_placeholder/);
  assert.match(admin, /standardHashes/);
  assert.match(admin, /standardHashes\.has/);
  assert.match(admin, /Vorlage herunterladen/);
  assert.match(admin, /GRAPHIC_TEMPLATE_MAX_BYTES = 1024 \* 1024/);
  assert.match(admin, /1 MiB/);
});

test("Liveticker standard background assets are shipped with the portal", () => {
  for (const path of ["assets/liveticker/backgrounds/post-background.jpg", "assets/liveticker/backgrounds/story-background.jpg"]) {
    const bytes = readFileSync(path);
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.ok(statSync(path).size > 100_000);
  }
});


test("Liveticker template upload accepts the self-contained standard SVG size", () => {
  const migration = readFileSync("supabase/migrations/20260910095000_liveticker_template_upload_1mib.sql", "utf8");
  assert.match(migration, /1048576/);
  assert.match(migration, /LIVETICKER_TEMPLATE_SAVE_LIMIT_SIGNATURE_MISSING/);
});
