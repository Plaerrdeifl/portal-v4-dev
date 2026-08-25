import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

test("Fanbus trips open as routed detail pages instead of the trip detail modal", async () => {
  const source = await read("js/modules/fanbuses.js");

  assert.match(source, /function openTripDetail\(trip\)/);
  assert.match(source, /data-m310-trip-page/);
  assert.match(source, /data-m310-trip-back/);
  assert.match(source, /#\/fanbuses\?detail=\$\{encodeURIComponent\(trip\.id\)\}/);
  const detailPage = source.slice(source.indexOf("function openTripDetail(trip)"), source.indexOf("async function hydrateTripDetailStops"));
  assert.doesNotMatch(detailPage, /openDialog\(/);
});
