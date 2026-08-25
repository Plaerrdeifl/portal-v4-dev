import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

test("P800-R2 Fanbus Verwaltung trennt Busse und Teilnehmer mobil sauber", async () => {
  const [fanbuses, common, css] = await Promise.all([
    read("js/modules/fanbuses.js"),
    read("js/modules/common.js"),
    read("css/app.css")
  ]);
  const occupancyStart = fanbuses.indexOf("function occupancyMarkup");
  const occupancyEnd = fanbuses.indexOf("function openBusActions", occupancyStart);
  const occupancy = fanbuses.slice(occupancyStart, occupancyEnd);
  assert.ok(occupancyStart >= 0 && occupancyEnd > occupancyStart);
  assert.doesNotMatch(occupancy, /Teilnehmer anzeigen/);
  assert.doesNotMatch(occupancy, /<summary>Teilnehmer/);
  assert.doesNotMatch(occupancy, /v4-m310-occupancy-groups/);
  assert.match(occupancy, /data-m310-bus-edit/);
  assert.match(occupancy, /data-m310-bus-delete/);
  assert.match(fanbuses, /isActive: false/);
  assert.doesNotMatch(fanbuses, /data-m320-open-registration/);
  assert.doesNotMatch(fanbuses, /v4-m310-registration-email/);
  assert.match(fanbuses, /data-m320-edit-registration/);
  assert.match(fanbuses, /data-m320-more-registration/);
  assert.match(fanbuses, /Buswunsch/);
  assert.doesNotMatch(fanbuses, /Buspräferenz/);
  assert.match(common, /restoreParent: false/);
  assert.match(css, /touch-action:pan-y!important/);
  assert.match(css, /max-height:calc\(100dvh - 96px\)!important/);
});
