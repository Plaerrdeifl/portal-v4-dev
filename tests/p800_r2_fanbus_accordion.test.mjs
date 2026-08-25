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
  assert.ok(source.includes("data-m310-trip-card"));
  assert.ok(detail.includes('record.closest("[data-m310-trip-card]")'));
  assert.ok(detail.includes("mobileCard?.append(detail)"));
  assert.ok(detail.includes('record.insertAdjacentElement("afterend", detail)'));
  assert.ok(detail.includes("aria-expanded"));
  assert.ok(!detail.includes("data-m310-inline-trip-close"));
  assert.ok(!detail.includes("openDialog("));
  assert.ok(!detail.includes("window.location.hash"));
  assert.ok(source.includes("function openTripDetail(trip)"));
  assert.ok(source.includes("if (trip) openTripDetailAtRecord(trip, record);"));
  assert.ok(!source.includes("window.location.hash = `#/fanbuses?detail="));
  assert.ok(ux.includes(".v4-m310-mobile-trip-card.is-expanded>"));
  assert.ok(ux.includes(".v4-m310-inline-trip-detail .v4-m325-trip-date"));
  assert.ok(ux.includes("border:0!important"));
});
