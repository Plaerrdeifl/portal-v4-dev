import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const pagesSource = read("../js/pages.js");
const tripCreateSource = read("../js/modules/bus-orga-trip-create.js");
const finalFixSource = read("../js/modules/m328-bus-orga-final-fixes.js");
const companionBaseSource = read("../js/m327-companion-lists-tap-base.js");
const companionFinalSource = read("../js/m327-companion-lists-final-polish.js");
const companionWrapperSource = read("../js/m327-companion-lists-polish.js");

test("M328 + Fahrt opens a native Bus-Orga creation workspace without a Fanbus detour", () => {
  assert.match(pagesSource, /view === "trip-create"/);
  assert.match(pagesSource, /bus-orga-trip-create\.js\?v=20260830-m328-trip-create-native2/);
  assert.match(finalFixSource, /location\.hash = "#\/bus-orga\?view=trip-create"/);
  assert.doesNotMatch(finalFixSource, /queueM328FanbusAction|#\/fanbuses\?orga=1/);
  assert.match(tripCreateSource, /call\("fanbus_available_events"\)/);
  assert.match(tripCreateSource, /call\("fanbus_trip_create", \{ eventId \}\)/);
  assert.match(tripCreateSource, /name="eventId"[^>]*required/);
  assert.doesNotMatch(tripCreateSource, /name="eventId"[^>]*checked/);
});

test("M328 publish refreshes the trip snapshot and uses the latest revision", () => {
  assert.match(pagesSource, /m328-bus-orga-final-fixes\.js\?v=20260830-m328-create-publish1/);
  assert.match(finalFixSource, /const data = await call\("fanbus_trips_list"\)/);
  assert.match(finalFixSource, /publishPreflight\(trip\)/);
  assert.match(finalFixSource, /call\("fanbus_trip_publish", \{[\s\S]*expectedRevision: Number\(trip\.revision\)/);
  assert.match(finalFixSource, /error\?\.code === "40001"/);
});

test("M327 companion menus use the real actions and stay above lower rows", () => {
  assert.match(companionBaseSource, /\[data-m325-add-member\]/);
  assert.match(companionBaseSource, /\[data-m325-search-person\]/);
  assert.doesNotMatch(companionBaseSource, /data-m325-add-guest|data-m325-add-portal-person/);
  assert.match(companionBaseSource, /m327-companion-menu-owner-open/);
  assert.match(companionBaseSource, /m327-companion-list-tappable\.m327-companion-menu-owner-open\{z-index:80\}/);
  assert.match(companionBaseSource, /m327-companion-menu-panel\{[^}]*z-index:110/);
});

test("M327 new-list form remains compact and inside the mobile viewport", () => {
  assert.match(companionFinalSource, /m327-final-new-list-panel\{[^}]*height:auto!important;min-height:0!important/);
  assert.match(companionFinalSource, /@media\(max-width:700px\)[\s\S]*m327-final-new-list-panel form\{grid-template-columns:minmax\(0,1fr\)!important\}/);
  assert.match(companionFinalSource, /m327-final-new-list-panel \.button\{width:100%!important/);
  assert.match(companionWrapperSource, /m327-companion-stable2/);
  assert.match(companionWrapperSource, /m327-companion-final3/);
  assert.match(pagesSource, /m327-companion-lists-polish\.js\?v=20260830-m327-companion-tap2/);
});
