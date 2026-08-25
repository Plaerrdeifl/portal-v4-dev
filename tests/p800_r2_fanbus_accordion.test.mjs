import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

test("Fanbus trip details expand as one integrated accordion card", async () => {
  const [source, ux] = await Promise.all([
    read("js/modules/fanbuses.js"),
    read("js/p800-r2-fanbus-ux.js")
  ]);
  const start = source.indexOf("function openTripDetailAtRecord(trip, record)");
  const end = source.indexOf("async function hydrateTripDetailStops", start);
  const detail = source.slice(start, end);

  assert.ok(start >= 0);
  assert.match(source, /data-m310-trip-card/);
  assert.match(detail, /record.closest("\[data-m310-trip-card\]")/);
  assert.match(detail, /mobileCard?.append(detail)/);
  assert.match(detail, /insertAdjacentElement("afterend", detail)/);
  assert.match(detail, /aria-expanded/);
  assert.doesNotMatch(detail, /data-m310-inline-trip-close/);
  assert.ok(!detail.includes("openDialog("));
  assert.ok(!detail.includes("window.location.hash"));
  assert.match(source, /function openTripDetail(trip)/);
  assert.match(source, /if (trip) openTripDetailAtRecord(trip, record);/);
  assert.doesNotMatch(source, /if (trip) {s*window.location.hash = `#\/fanbuses\?detail=/);
  assert.match(ux, /.v4-m310-mobile-trip-card.is-expanded>/);
  assert.match(ux, /.v4-m310-inline-trip-detail .v4-m325-trip-date/);
  assert.match(ux, /border:0!important/);
});
