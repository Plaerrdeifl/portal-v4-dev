import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const iosFieldFix = fs.readFileSync(
  new URL("../js/m328-trip-edit-ios-fields.js", import.meta.url),
  "utf8",
);
const indexHtml = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("M328 iOS temporal controls avoid the WebKit padded-width overflow", () => {
  assert.match(
    iosFieldFix,
    /input\[type="datetime-local"\],[\s\S]*?padding:0!important;/,
  );
  assert.match(
    iosFieldFix,
    /m328-trip-edit-stop-editor input\[type="time"\][\s\S]*?padding:0!important;/,
  );
  assert.doesNotMatch(iosFieldFix, /overflow:hidden!important;/);
  assert.doesNotMatch(iosFieldFix, /-webkit-appearance\s*:\s*none/);
});

test("M328 iOS stop editor keeps bounded columns and narrow fallback", () => {
  assert.match(
    iosFieldFix,
    /grid-template-columns:minmax\(112px,\.82fr\) minmax\(0,1\.18fr\)!important;/,
  );
  assert.match(
    iosFieldFix,
    /@media \(max-width:350px\)[\s\S]*?grid-template-columns:1fr!important;/,
  );
  assert.match(
    iosFieldFix,
    /m328-trip-edit-stop-editor select\{[\s\S]*?min-width:0!important;[\s\S]*?box-sizing:border-box!important;/,
  );
});

test("M328 iOS field fix is loaded with the current dedicated cache key", () => {
  assert.match(
    indexHtml,
    /m328-trip-edit-ios-fields\.js\?v=20260830-m328-trip-edit-ios-fields2/,
  );
});
