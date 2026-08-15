import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

function formContaining(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing form marker: ${marker}`);
  const start = source.lastIndexOf("<form", markerIndex);
  const end = source.indexOf("</form>", markerIndex);
  assert.ok(start >= 0 && end > markerIndex, `missing form around marker: ${marker}`);
  return source.slice(start, end + "</form>".length);
}

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `missing source range: ${startMarker}`);
  return source.slice(start, end);
}

test("M325 defines private companion, stop and check-in data with default deny", async () => {
  const sql = await read("supabase/migrations/20260814130000_add_fanbus_operations_m325_r1.sql");
  for (const table of [
    "fanbus_companion_lists", "fanbus_companion_list_members", "fanbus_boarding_stops",
    "fanbus_trip_boarding_stops", "fanbus_bus_boarding_stops", "fanbus_participant_checkins"
  ]) {
    assert.match(sql, new RegExp(`create table app_modules\\.${table}`));
    assert.match(sql, new RegExp(`alter table app_modules\\.${table} enable row level security`));
  }
  assert.match(sql, /on delete set null/);
  assert.match(sql, /operational_note is null or length\(btrim\(operational_note\)\) <= 240/);
  assert.match(sql, /checkin_kind = 'OUTBOUND'/);
  assert.match(sql, /status in \('OPEN', 'PRESENT', 'NO_SHOW'\)/);
  assert.match(sql, /foreign key \(trip_boarding_stop_id, trip_id\)/);
  assert.match(sql, /FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP/);
  assert.doesNotMatch(sql, /payment_status|is_paid|\bpaid\b/i);
  assert.doesNotMatch(sql, /Barzahlung|Buskasse|return_checkin|Sitzplatz|QR|Ticket/i);
});

test("M325 routes writes through pd_api and preserves server-side concurrency", async () => {
  const sql = await read("supabase/migrations/20260814130000_add_fanbus_operations_m325_r1.sql");
  for (const action of [
    "fanbus_companion_lists_list", "fanbus_companion_duplicate_preview",
    "fanbus_companion_booking_submit", "fanbus_registration_update_m325",
    "fanbus_operations_snapshot", "fanbus_checkin_set"
  ]) assert.match(sql, new RegExp(`when '${action}'`));
  assert.match(sql, /for update/);
  assert.match(sql, /STALE_REVISION_OR_NOT_FOUND/);
  assert.match(sql, /FANBUS_COMPANION_CONFLICT/);
  assert.match(sql, /FANBUS_TEMPLATE_MEMBER_FORBIDDEN/);
  assert.match(sql, /FANBUS_IDEMPOTENCY_KEY_REUSED/);
  assert.match(sql, /FANBUS_BUS_STOP_IN_USE/);
  assert.match(sql, /FANBUS_ACTIVE_TRIP_STOP_REQUIRES_ACTIVE_MASTER/);
  assert.match(sql, /Shared lock order with M320 assignment changes: participant first, bus second/);
  assert.ok(sql.indexOf("from app_modules.fanbus_registrations\n  where id=v_id for update")
    < sql.indexOf("from app_modules.fanbus_buses bus\n    where bus.id=v_bus and bus.trip_id=v_row.trip_id for update"));
  assert.match(sql, /app\.m325_registration_context/);
  assert.match(sql, /FANBUS_CHECKIN_CHANGED/);
});

test("M325 extends public guest and portal registration only with bounded stop/note fields", async () => {
  const [edge, registration, standalone] = await Promise.all([
    read("supabase/functions/m310-fanbus-register/index.ts"),
    read("js/fanbus-registration.js"),
    read("fanbus-anmeldung.html")
  ]);
  assert.match(edge, /"boardingStopId", "operationalNote"/);
  assert.match(edge, /operationalNote\.trim\(\)\.length > 240/);
  assert.match(registration, /pd_public_fanbus_trip_boarding_stops/);
  assert.match(registration, /function renderBoardingStopFields/);
  assert.match(registration, /companionBoardingStopId/);
  assert.ok(registration.indexOf('call("fanbus_companion_duplicate_preview"')
    < registration.indexOf('"fanbus_companion_booking_submit"'));
  assert.match(registration, /templateMemberId/);
  assert.match(registration, /participants: payload\.companions/);
  assert.match(registration, /participants: templateCompanions/);
  assert.match(standalone, /data-m325-primary-stop="portal"/);
  assert.match(standalone, /data-m325-primary-stop="guest"/);
  assert.match(standalone, /data-m325-companion-list-members/);
  assert.match(standalone, /data-m325-duplicate-preview/);
});

test("M325 provides integrated, mobile-first companion and operations screens", async () => {
  const [ui, css, page] = await Promise.all([
    read("js/modules/fanbuses.js"), read("css/app.css"), read("pages/fanbuses.html")
  ]);
  assert.match(ui, /view=companions/);
  assert.match(ui, /view=operations/);
  assert.match(ui, /✓ Anwesend/);
  assert.match(ui, /No-Show/);
  assert.match(ui, /data-m325-operation-filters/);
  assert.match(ui, /name="status"/);
  assert.match(ui, /name="bus"/);
  assert.match(ui, /name="stop"/);
  assert.match(ui, /operationsUiState\.scrollY/);
  assert.match(ui, /fanbus_registration_update_m325/);
  assert.doesNotMatch(ui, /const identityNext = await call\("fanbus_registration_update"/);
  assert.match(ui, /const activeTripStops = tripStops\.filter\(stop => stop\.isActive\)/);
  assert.match(ui, /activeTripStops\.length/);
  assert.match(ui, /fanbus_bus_boarding_stops_set/);
  assert.match(ui, /fanbus_boarding_stops_reorder/);
  assert.match(ui, /fanbus_trip_boarding_stops_reorder/);
  assert.match(page, /id="m325CompanionListsButton"/);
  assert.match(css, /\.v4-m325-counters/);
  assert.match(css, /\.v4-m325-workspace \.button \{ min-height: 44px/);
});

test("M325 UI reuses portal smart forms, field widths, dialogs and action containers", async () => {
  const [ui, css, standalone, registration] = await Promise.all([
    read("js/modules/fanbuses.js"),
    read("css/app.css"),
    read("fanbus-anmeldung.html"),
    read("js/fanbus-registration.js")
  ]);

  const smartFormMarkers = [
    "data-m325-list-form",
    "data-m325-rename-form",
    "data-m325-member-form",
    "data-m325-operation-filters",
    "data-m325-master-stop",
    "data-m325-trip-stop",
    "data-m325-bus-stops",
    "data-m325-edit-master",
    "data-m325-edit-trip-stop"
  ];
  for (const marker of smartFormMarkers) {
    const form = formContaining(ui, marker);
    assert.match(form, /class="[^"]*\bform-grid\b[^"]*\bv4-smart-form\b/);
    assert.match(form, /v4-field-(?:full|half|four)/);
  }

  const masterForm = formContaining(ui, "data-m325-master-stop");
  assert.match(masterForm, /class="v4-field-half">Neuer Stammpunkt/);
  assert.match(masterForm, /class="v4-field-half">Adresse/);
  assert.match(masterForm, /class="v4-field-full">Standardhinweis/);
  assert.match(masterForm, /class="dialog-actions v4-detail-actions v4-field-full"/);

  const memberForm = formContaining(ui, "data-m325-member-form");
  assert.match(memberForm, /class="v4-field-half">Vorname/);
  assert.match(memberForm, /class="v4-field-half">Standard-Zustiegsort/);
  assert.match(memberForm, /class="v4-field-full">Operativer Hinweis/);

  const operationFilters = formContaining(ui, "data-m325-operation-filters");
  assert.match(operationFilters, /class="v4-field-full">Namenssuche/);
  assert.equal((operationFilters.match(/class="v4-field-four"/g) || []).length, 3);

  const companionWorkspace = sourceBetween(
    ui,
    "async function renderCompanionWorkspace",
    "function openCompanionListRename"
  );
  assert.doesNotMatch(companionWorkspace, /dialog-actions/);
  assert.match(companionWorkspace, /class="v4-detail-actions"><button[^>]+data-m325-back/);
  assert.match(companionWorkspace, /class="v4-detail-actions v4-field-full"><button[^>]+type="submit"/);
  assert.equal((companionWorkspace.match(/class="v4-row-actions"/g) || []).length, 2);

  const operationsWorkspace = sourceBetween(
    ui,
    "async function renderOperationsWorkspace",
    "function filterOperations"
  );
  assert.doesNotMatch(operationsWorkspace, /dialog-actions/);
  assert.match(operationsWorkspace, /class="v4-detail-actions"><button[^>]+data-m325-back/);
  assert.match(operationsWorkspace, /class="v4-row-actions"><button[^>]+data-m325-checkin/);

  const masterRecords = sourceBetween(ui, "const masterRecords", "const tripRecords");
  assert.match(masterRecords, /class="v4-row-actions">[\s\S]*data-m325-master-move/);
  assert.doesNotMatch(masterRecords, /dialog-actions/);

  const tripRecords = sourceBetween(ui, "const tripRecords", "const busStopForms");
  assert.match(tripRecords, /class="v4-row-actions">[\s\S]*data-m325-trip-move/);
  assert.doesNotMatch(tripRecords, /dialog-actions/);

  for (const marker of [
    "data-m325-rename-form",
    "data-m325-member-form",
    "data-m325-master-stop",
    "data-m325-trip-stop",
    "data-m325-bus-stops",
    "data-m325-edit-master",
    "data-m325-edit-trip-stop"
  ]) {
    assert.match(formContaining(ui, marker), /class="dialog-actions v4-detail-actions v4-field-full"/);
  }

  assert.match(ui, /openDialog\(\{ title: "Liste umbenennen"/);
  assert.doesNotMatch(`${ui}\n${css}`, /v4-m325-(?:dialog|form|button)\b/);
  assert.match(css, /\[data-m325-operation-filters\] > \.v4-field-four \{ grid-column: 1 \/ -1 !important; \}/);

  assert.match(standalone, /class="full" data-m325-primary-stop="portal"/);
  assert.match(standalone, /class="full" data-m325-companion-list/);
  assert.match(standalone, /class="fanbus-public-actions full"><button[^>]+data-m325-apply-companion-list/);
  assert.match(standalone, /\.fanbus-companion-head\{[^}]*flex-wrap:wrap/);
  assert.match(registration, /<div class="form-grid"><label>Vorname/);
  assert.match(registration, /<label class="full">Operativer Hinweis/);
});

test("M325 ships behavioral pgTAP coverage for the reviewed race and snapshot cases", async () => {
  const testSql = await read("supabase/tests/m325_fanbus.sql");
  assert.match(testSql, /select no_plan\(\)/);
  assert.match(testSql, /Finaler Insert-Guard erkennt Namenskonflikt unter Fahrt-Lock/);
  assert.match(testSql, /Finaler Konflikt rollt Primary und Companion gemeinsam zurück/);
  assert.match(testSql, /Stornierter Konflikt blockiert spätere Buchung nicht/);
  assert.match(testSql, /Snapshot gruppiert zwei Busse ohne Mehrzeilenfehler/);
  assert.match(testSql, /Snapshot gruppiert zwei Halte ohne Mehrzeilenfehler/);
  assert.match(testSql, /Fehlender Check-in wird im Snapshot als OPEN behandelt/);
  assert.match(testSql, /Gemischte Gruppe bucht Primary, Template- und normalen Mitfahrer atomar/);
  assert.match(testSql, /Konkrete Template-Fahrt-E-Mail wird normalisiert gespeichert/);
  assert.match(testSql, /Interne Fahrthaltliste verweigert normalen aktiven Usern den Zugriff/);
  assert.match(testSql, /Technischer Lockvertrag ordnet Teilnehmer-Lock vor Bus-Lock an/);
  assert.match(testSql, /Manuelle Erfassung bleibt ohne aktive Fahrtzustiege M320-kompatibel/);
  assert.match(testSql, /Fehler im Betriebsupdate rollt auch das vorherige Stammdatenupdate zurück/);
  assert.match(testSql, /Inaktiver Master kann kein neuer aktiver Fahrtzustieg werden/);
});
