import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../js/app.js");
const bridge = read("../js/task-push-r3.js");
const worker = read("../service-worker.js");
const bookings = read("../js/modules/bus-orga-bookings.js");

function functionBlock(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} konnte nicht isoliert werden`);
  return source.slice(start, end);
}

function asyncFunctionBlock(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`async function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} konnte nicht isoliert werden`);
  return source.slice(start, end);
}

test("FANBUS-PROD-VISIBILITY-001: Root Cause bleibt im bestehenden Push-Bridge-Vertrag nachvollziehbar", () => {
  assert.match(worker, /type:\s*"PUSH_STATE_CHANGED"/);
  assert.match(bridge, /event\.data\?\.type === "PUSH_STATE_CHANGED"/);
  assert.match(bridge, /startsWith\("TASK_"\)/);
  assert.doesNotMatch(bridge, /startsWith\("FANBUS_"\)[\s\S]*refreshCurrentView/);
});

test("FANBUS_* Push fordert nur auf der aktiven Bus-Orga-Buchungsroute einen Refresh an", () => {
  const push = functionBlock(app, "handleFanbusPushStateChange", "handlePageShow");
  const guard = functionBlock(app, "fanbusBookingsRefreshAllowed", "scheduleFanbusBookingsRefresh");

  assert.match(push, /event\.data\?\.type !== "PUSH_STATE_CHANGED"/);
  assert.match(push, /startsWith\("FANBUS_"\)/);
  assert.match(push, /scheduleFanbusBookingsRefresh\(\)/);
  assert.match(guard, /currentRoute\(\) !== "bus-orga"/);
  assert.match(guard, /params\.get\("view"\) !== "bookings"/);
  assert.match(guard, /!params\.get\("trip"\)/);
});

test("Suspend -> visible und pageshow/BFCache triggern denselben gezielten Refresh", () => {
  const pageShow = functionBlock(app, "handlePageShow", "handleVisibilityChange");
  const visibility = functionBlock(app, "handleVisibilityChange", "renderRoute");

  assert.match(app, /let pwaWasHidden = document\.visibilityState === "hidden"/);
  assert.match(pageShow, /event\.persisted === true \|\| pwaWasHidden/);
  assert.match(pageShow, /scheduleFanbusBookingsRefresh\(\)/);
  assert.match(visibility, /document\.visibilityState !== "visible"/);
  assert.match(visibility, /pwaWasHidden = true/);
  assert.match(visibility, /if \(pwaWasHidden\) scheduleFanbusBookingsRefresh\(\)/);
  assert.match(app, /window\.addEventListener\("pageshow", handlePageShow\)/);
  assert.match(app, /document\.addEventListener\("visibilitychange", handleVisibilityChange\)/);
});

test("Push + pageshow + visibility werden per 250-ms-Debounce zusammengeführt", () => {
  const schedule = functionBlock(app, "scheduleFanbusBookingsRefresh", "handleFanbusPushStateChange");

  assert.match(app, /const FANBUS_REFRESH_DEBOUNCE_MS = 250/);
  assert.match(schedule, /window\.clearTimeout\(fanbusRefreshTimer\)/);
  assert.match(schedule, /window\.setTimeout\(/);
  assert.match(schedule, /FANBUS_REFRESH_DEBOUNCE_MS/);
  assert.match(schedule, /void refreshCurrentView\(\)/);
});

test("laufender zentraler Refresh wird nicht parallelisiert und höchstens einmal nachgezogen", () => {
  const refresh = asyncFunctionBlock(app, "refreshCurrentView", "logout");

  assert.match(refresh, /if \(explicitRefreshActive\) \{\s*explicitRefreshQueued = true;\s*return;/);
  assert.match(refresh, /do \{/);
  assert.match(refresh, /explicitRefreshQueued = false/);
  assert.match(refresh, /while \(explicitRefreshQueued\)/);
  assert.match(refresh, /await auth\.refresh\(\)/);
  assert.match(refresh, /await renderRoute\(\)/);
});

test("Auto-Refresh verwirft keine laufende Buchungsbearbeitung oder offene Dialoge", () => {
  const guard = functionBlock(app, "fanbusBookingsRefreshAllowed", "scheduleFanbusBookingsRefresh");

  assert.match(bookings, /data-m328-edit-form/);
  assert.match(guard, /\[data-m328-edit-form\], dialog\[open\]/);
  assert.match(guard, /document\.visibilityState !== "visible"/);
  assert.doesNotMatch(app, /location\.reload\s*\(/);
});

test("BUS_ORGA sieht die höchste Buchungsnummer zuerst", () => {
  const grouping = functionBlock(bookings, "groupBookings", "bookingStatus");

  assert.match(
    grouping,
    /sort\(\(a, b\) => String\(b\.number\)\.localeCompare\(String\(a\.number\), "de"\)\)/
  );
});

test("M020 Badge, selektive Quittierung und TASK_* Verhalten bleiben unangetastet nutzbar", () => {
  assert.match(bridge, /void synchronizeAuthoritativeBadge\(\)/);
  assert.match(bridge, /startsWith\("TASK_"\)/);
  assert.match(bridge, /mark_notification_read/);
  assert.match(bridge, /entityType:\s*"fanbus_trip_operational"/);
  assert.match(bridge, /notificationId:\s*pendingNotificationForRoute\("bus-orga"\)/);
  assert.match(worker, /params\.set\("notificationId", id\)/);
  assert.match(worker, /client\.navigate\(targetUrl\)/);
});
