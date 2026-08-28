import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  currentBerlinDate,
  groupFanbusTrips
} from "../js/modules/fanbus-trip-groups.js";

test("fanbus trips are grouped by lifecycle and date with useful per-group sorting", () => {
  const input = [
    { id: "active-later", status: "PUBLISHED", eventDate: "2026-10-20", eventTime: "18:00" },
    { id: "past-published", status: "PUBLISHED", eventDate: "2026-08-20", eventTime: "19:00" },
    { id: "draft-later", status: "DRAFT", eventDate: "2026-11-02", eventTime: "18:00" },
    { id: "cancelled-future", status: "CANCELLED", eventDate: "2026-12-01", eventTime: "18:00" },
    { id: "active-sooner", status: "PUBLISHED", eventDate: "2026-09-10", eventTime: "20:00" },
    { id: "draft-sooner", status: "DRAFT", eventDate: "2026-09-15", eventTime: "18:00" },
    { id: "past-draft", status: "DRAFT", eventDate: "2026-07-01", eventTime: "18:00" },
    { id: "today", status: "CLOSED", eventDate: "2026-08-28", eventTime: "14:00" }
  ];

  const groups = groupFanbusTrips(input, "2026-08-28");

  assert.deepEqual(groups.active.map(trip => trip.id), [
    "today",
    "active-sooner",
    "active-later"
  ]);
  assert.deepEqual(groups.planned.map(trip => trip.id), ["draft-sooner", "draft-later"]);
  assert.deepEqual(groups.history.map(trip => trip.id), [
    "cancelled-future",
    "past-published",
    "past-draft"
  ]);
  assert.deepEqual(input.map(trip => trip.id), [
    "active-later",
    "past-published",
    "draft-later",
    "cancelled-future",
    "active-sooner",
    "draft-sooner",
    "past-draft",
    "today"
  ]);
});

test("the current date follows Europe/Berlin at UTC day boundaries", () => {
  assert.equal(currentBerlinDate(new Date("2026-08-27T22:30:00.000Z")), "2026-08-28");
});

test("fanbus list renders all three responsive sections in the requested order", async () => {
  const source = await readFile(new URL("../js/modules/fanbuses.js", import.meta.url), "utf8");
  const active = source.indexOf('tripGroup("active", "Aktive Fahrten"');
  const planned = source.indexOf('tripGroup("planned", "Geplante Fahrten"');
  const history = source.indexOf('tripGroup("history", "Vergangene / abgesagte Fahrten"');

  assert.ok(active >= 0 && planned > active && history > planned);
  assert.match(source, /tripTable\(items\).*tripMobileList\(items\)/s);
  assert.match(source, /groupFanbusTrips\(items\)/);
});
