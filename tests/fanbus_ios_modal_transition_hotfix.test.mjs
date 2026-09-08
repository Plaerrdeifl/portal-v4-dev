import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const tripDetail = read("../js/modules/bus-orga-trip-detail.js");
const pages = read("../js/pages.js");

test("Fanbus trip menu waits for native modal teardown before any action", () => {
  assert.match(tripDetail, /function afterNativeDialogClose\(dialog, callback\)/);
  assert.match(tripDetail, /dialog\.addEventListener\("close", handleClose, \{ once: true \}\)/);
  assert.match(tripDetail, /dialog\.close\?\.\(\);/);
  assert.match(tripDetail, /queueMicrotask\(\(\) => \{/);
  assert.match(tripDetail, /if \(dialog\.open\) \{[\s\S]*?removeEventListener\("close", handleClose\);[\s\S]*?return;/);
  assert.match(tripDetail, /requestAnimationFrame\(\(\) => \{[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?if \(!dialog\?\.open\) callback\(\);/);
});

test("Fanbus trip menu never navigates synchronously while the modal is closing", () => {
  const menuStart = tripDetail.indexOf("function openTripMenu(state)");
  const renderStart = tripDetail.indexOf("function renderPage(root, state)");
  assert.ok(menuStart >= 0 && renderStart > menuStart);
  const menu = tripDetail.slice(menuStart, renderStart);

  assert.match(menu, /afterNativeDialogClose\(dialog, \(\) => void handleAction\(action, state\.trip\)\)/);
  assert.doesNotMatch(menu, /dialog\.close\?\.\(\);[\s\S]{0,120}void handleAction/);
});

test("Fanbus iOS modal fix is cache-versioned at the dynamic trip-detail boundary", () => {
  assert.match(
    pages,
    /\.\/modules\/bus-orga-trip-detail\.js\?v=20260908-m328-ios-modal-recovery1/
  );
});
