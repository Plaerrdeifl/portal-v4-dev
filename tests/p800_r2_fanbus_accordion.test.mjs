import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

test("Fanbus trip details expand inline below the selected trip", async () => {
  const source = await read("js/modules/fanbuses.js");
  const start = source.indexOf("function openTripDetailAtRecord(trip, record)");
  const end = source.indexOf("async function hydrateTripDetailStops", start);
  const detail = source.slice(start, end);

  assert.ok(start >= 0);
  assert.match(detail, /dataset\.m310InlineTripDetail/);
  assert.match(detail, /insertAdjacentElement\("afterend", detail\)/);
  assert.match(detail, /aria-expanded/);
  assert.doesNotMatch(detail, /openDialog\(/);
  assert.doesNotMatch(detail, /window\.location\.hash/);
  assert.match(source, /function openTripDetail\(trip\)/);
});
