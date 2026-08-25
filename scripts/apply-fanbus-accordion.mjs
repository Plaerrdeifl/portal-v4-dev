import { readFile, writeFile, rm } from "node:fs/promises";

const path = "js/modules/fanbuses.js";
let source = await readFile(path, "utf8");

source = source.replace(
  'let snapshot = { trips: [] };\nlet operationsUiState = { status: "ALL", bus: "ALL", stop: "ALL", search: "", scrollY: 0 };',
  'let snapshot = { trips: [] };\nlet openTripDetailId = "";\nlet operationsUiState = { status: "ALL", bus: "ALL", stop: "ALL", search: "", scrollY: 0 };'
);

const oldOpen = `function openTripDetail(trip) {
  const dialog = openDialog({
    title: trip.displayTitle || "Fanbusfahrt",
    kicker: \`${'${formatCalendarDate(trip.eventDate)} · ${eventTimeCompact(trip.eventTime)}'}\`,
    body: tripDetailMarkup(trip)
  });
  dialog.dataset.m310TripMode = "detail";
  bindTripDetail(dialog, trip);
  void hydrateTripDetailStops(dialog, trip);
}`;

const newOpen = `function closeInlineTripDetail() {
  document.querySelectorAll("[data-m310-inline-trip-detail]").forEach(detail => detail.remove());
  document.querySelectorAll("[data-m310-open-trip][aria-expanded=\\"true\\"]").forEach(record => {
    record.setAttribute("aria-expanded", "false");
    record.classList.remove("is-expanded");
  });
  openTripDetailId = "";
}

function openTripDetail(trip, record) {
  if (!trip || !record) return;

  if (openTripDetailId === trip.id && record.getAttribute("aria-expanded") === "true") {
    closeInlineTripDetail();
    return;
  }

  closeInlineTripDetail();
  openTripDetailId = trip.id;
  record.setAttribute("aria-expanded", "true");
  record.classList.add("is-expanded");

  const isTableRow = record.matches("tr");
  const detail = document.createElement(isTableRow ? "tr" : "section");
  detail.dataset.m310InlineTripDetail = trip.id;
  detail.className = isTableRow
    ? "v4-m310-inline-trip-detail-row"
    : "v4-m310-inline-trip-detail v4-m325-workspace";

  const detailBody = \`<div class="v4-m310-inline-trip-detail-shell">
    <div class="v4-m310-inline-trip-detail-heading">
      <div><strong>\${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</strong><small>\${escapeHtml(formatCalendarDate(trip.eventDate))} · \${escapeHtml(eventTimeCompact(trip.eventTime))}</small></div>
      <button class="icon-button" type="button" data-m310-inline-trip-close aria-label="Fahrtdetails schließen">×</button>
    </div>
    <div id="v4DialogBody">\${tripDetailMarkup(trip)}</div>
  </div>\`;

  detail.innerHTML = isTableRow
    ? \`<td colspan="5">\${detailBody}</td>\`
    : detailBody;
  record.insertAdjacentElement("afterend", detail);

  detail.dataset.m310TripMode = "detail";
  detail.dataset.m310TripSurface = "inline";
  detail.dataset.v4DialogContext = \`trip-inline:\${trip.id}\`;
  detail.open = true;
  detail.close = closeInlineTripDetail;
  detail.querySelector("[data-m310-inline-trip-close]")?.addEventListener("click", closeInlineTripDetail);
  bindTripDetail(detail, trip);
  void hydrateTripDetailStops(detail, trip);
}`;

if (!source.includes(oldOpen)) throw new Error("openTripDetail baseline not found");
source = source.replace(oldOpen, newOpen);

source = source.replace(
  '      if (trip) openTripDetail(trip);',
  '      if (trip) openTripDetail(trip, record);'
);

const oldRouteRestore = `  const detailTrip = items.find(item => item.id === routeQuery.get("detail"));
  if (detailTrip) {
    window.history.replaceState(null, "", "#/fanbuses");
    openTripDetail(detailTrip);
  }
  setStatus("Aktuell", "success");`;

const newRouteRestore = `  const detailTrip = items.find(item => item.id === routeQuery.get("detail"));
  if (detailTrip) {
    window.history.replaceState(null, "", "#/fanbuses");
    const records = [...panel.querySelectorAll(\`[data-m310-open-trip="\${CSS.escape(detailTrip.id)}"]\`)];
    const record = records.find(item => item.offsetParent !== null) || records[0];
    if (record) openTripDetail(detailTrip, record);
  }
  setStatus("Aktuell", "success");`;

if (!source.includes(oldRouteRestore)) throw new Error("detail route restore baseline not found");
source = source.replace(oldRouteRestore, newRouteRestore);

await writeFile(path, source, "utf8");

const uxPath = "js/p800-r2-fanbus-ux.js";
let ux = await readFile(uxPath, "utf8");
const styleAnchor = '  style.textContent = `\n';
if (!ux.includes(styleAnchor)) throw new Error("UX style anchor missing");
ux = ux.replace(styleAnchor, `  style.textContent = \`\n    .v4-m310-inline-trip-detail-row>td{padding:0!important;border-top:0!important}\n    .v4-m310-inline-trip-detail,.v4-m310-inline-trip-detail-row>td{background:var(--surface,#fff)}\n    .v4-m310-inline-trip-detail-shell{margin:0 0 14px;padding:14px;border:1px solid var(--line,#d8e2ee);border-radius:14px;background:var(--surface,#fff);box-shadow:0 8px 24px rgba(22,43,70,.08)}\n    .v4-m310-inline-trip-detail-row .v4-m310-inline-trip-detail-shell{margin:0 8px 12px}\n    .v4-m310-inline-trip-detail-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}\n    .v4-m310-inline-trip-detail-heading>div{display:grid;gap:2px;min-width:0}\n    .v4-m310-inline-trip-detail-heading small{color:var(--ink-500)}\n    [data-m310-open-trip].is-expanded .v4-row-chevron{transform:rotate(90deg)}\n`);
await writeFile(uxPath, ux, "utf8");

const test = `import assert from "node:assert/strict";\nimport fs from "node:fs/promises";\nimport path from "node:path";\nimport test from "node:test";\n\nconst root = path.resolve(import.meta.dirname, "..");\nconst read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");\n\ntest("Fanbus trip details expand inline below the selected trip", async () => {\n  const source = await read("js/modules/fanbuses.js");\n  const start = source.indexOf("function openTripDetail(trip, record)");\n  const end = source.indexOf("async function hydrateTripDetailStops", start);\n  const detail = source.slice(start, end);\n\n  assert.ok(start >= 0);\n  assert.match(detail, /data\\.m310InlineTripDetail/);\n  assert.match(detail, /insertAdjacentElement\\("afterend", detail\\)/);\n  assert.match(detail, /aria-expanded/);\n  assert.doesNotMatch(detail, /openDialog\\(/);\n  assert.doesNotMatch(detail, /window\\.location\\.hash/);\n});\n`;
await writeFile("tests/p800_r2_fanbus_accordion.test.mjs", test, "utf8");

await rm("scripts/apply-fanbus-accordion.mjs");
