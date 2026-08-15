import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const [fanbuses, css, sql] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("css/app.css"),
  read("supabase/migrations/20260815214000_p800_u5_fanbus_paid_marker.sql")
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

test("P800 U5 removes redundant detail status and overview navigation", () => {
  const detail = section(fanbuses, "function tripDetailMarkup", "function openTripDetail");
  const nav = section(fanbuses, "function tripNavigation", "function normalizedTripDetailStops");
  assert.doesNotMatch(detail, /tripBadges\(trip\)|v4-m310-trip-status|Treffpunkt \/ Abfahrtsort/);
  assert.doesNotMatch(nav, />Übersicht</);
  assert.match(nav, />Belegung</);
  assert.match(nav, />Fahrtbetrieb</);
  assert.match(fanbuses, /Anmeldeschluss:/);
});

test("P800 U5 renders deduplicated structured trip stops", () => {
  assert.match(fanbuses, /function normalizedTripDetailStops/);
  assert.match(fanbuses, /function tripDetailStopsMarkup/);
  assert.match(fanbuses, /fanbus_trip_boarding_stops_public/);
  assert.match(fanbuses, /fanbus_trip_boarding_stops_list/);
});

test("P800 U5 keeps mobile menu and Fahrtbetrieb navigation viewport-safe", () => {
  assert.match(css, /#m310FanbusManagement[\s\S]*margin-left:\s*auto/);
  assert.match(css, /\.v4-action-menu-panel[\s\S]*calc\(100vw - 24px\)/);
  assert.match(css, /\.v4-m310-trip-nav[\s\S]*flex-wrap:\s*nowrap/);
  assert.match(css, /\.v4-m310-trip-nav \.button[\s\S]*white-space:\s*nowrap/);
});

test("P800 U5 paid marker is persistent, manual and not finance-coupled", () => {
  assert.match(sql, /add column if not exists is_paid boolean not null default false/);
  assert.match(sql, /'isPaid',is_paid/);
  assert.match(sql, /function app_private\.api_fanbus_paid_set/);
  assert.match(sql, /FANBUS_PAID_MARKER_CHANGED/);
  assert.match(sql, /when 'fanbus_paid_set'/);
  assert.doesNotMatch(sql, /app_modules\.finance|cashbook|contribution/i);
  assert.match(fanbuses, /data-m325-paid/);
  assert.match(fanbuses, /call\("fanbus_paid_set"/);
});
