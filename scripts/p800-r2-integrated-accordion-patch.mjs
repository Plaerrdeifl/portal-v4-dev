import fs from "node:fs";

const fanbusPath = "js/modules/fanbuses.js";
const uxPath = "js/p800-r2-fanbus-ux.js";
const testPath = "tests/p800_r2_fanbus_accordion.test.mjs";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Marker fehlt: ${label}`);
  return source.replace(from, to);
}

let source = fs.readFileSync(fanbusPath, "utf8");

source = replaceOnce(
  source,
  '${trip.venue ? `<div><span>Ziel / Ort</span><strong>${escapeHtml(trip.venue)}</strong></div>` : `<div><span>Ziel / Ort</span><strong>Noch nicht festgelegt</strong></div>`}',
  '${trip.venue ? `<div class="v4-m325-trip-venue"><span>Ziel / Ort</span><strong>${escapeHtml(trip.venue)}</strong></div>` : `<div class="v4-m325-trip-venue"><span>Ziel / Ort</span><strong>Noch nicht festgelegt</strong></div>`}',
  "trip venue class"
);
source = replaceOnce(
  source,
  '${trip.opponentName ? `<div class="full"><span>Gegner</span><strong>${escapeHtml(trip.opponentName)}</strong></div>` : ""}',
  '${trip.opponentName ? `<div class="full v4-m325-trip-opponent"><span>Gegner</span><strong>${escapeHtml(trip.opponentName)}</strong></div>` : ""}',
  "trip opponent class"
);

source = replaceOnce(
  source,
  '  document.querySelectorAll("[data-m310-inline-trip-detail]").forEach(detail => detail.remove());\n  document.querySelectorAll("[data-m310-open-trip][aria-expanded=\\"true\\"]").forEach(record => {',
  '  document.querySelectorAll("[data-m310-inline-trip-detail]").forEach(detail => detail.remove());\n  document.querySelectorAll("[data-m310-trip-card].is-expanded").forEach(card => card.classList.remove("is-expanded"));\n  document.querySelectorAll("[data-m310-open-trip][aria-expanded=\\"true\\"]").forEach(record => {',
  "inline card cleanup"
);

const openStartMarker = '  const isTableRow = record.matches("tr");';
const openEndMarker = '  detail.dataset.m310TripMode = "detail";';
const functionStart = source.indexOf("function openTripDetailAtRecord(trip, record)");
const openStart = source.indexOf(openStartMarker, functionStart);
const openEnd = source.indexOf(openEndMarker, openStart);
if (functionStart < 0 || openStart < 0 || openEnd < 0) throw new Error("openTripDetailAtRecord markers fehlen");
const integratedOpen = `  const isTableRow = record.matches("tr");
  const mobileCard = record.closest("[data-m310-trip-card]");
  if (mobileCard) mobileCard.classList.add("is-expanded");

  const detail = document.createElement(isTableRow ? "tr" : "div");
  detail.dataset.m310InlineTripDetail = trip.id;
  detail.className = isTableRow
    ? "v4-m310-inline-trip-detail-row"
    : "v4-m310-inline-trip-detail";

  const detailBody = \`<div class="v4-m310-inline-trip-detail-shell">
    <div id="v4DialogBody">\${tripDetailMarkup(trip)}</div>
  </div>\`;

  detail.innerHTML = isTableRow
    ? \`<td colspan="5">\${detailBody}</td>\`
    : detailBody;

  if (isTableRow) record.insertAdjacentElement("afterend", detail);
  else mobileCard?.append(detail);

`;
source = source.slice(0, openStart) + integratedOpen + source.slice(openEnd);
source = replaceOnce(
  source,
  '  detail.querySelector("[data-m310-inline-trip-close]")?.addEventListener("click", closeInlineTripDetail);\n',
  '',
  "remove duplicate close button binding"
);

const mobileStart = source.indexOf("function tripMobileList(items) {");
const mobileEnd = source.indexOf("function setStatus(label, type = \"\") {", mobileStart);
if (mobileStart < 0 || mobileEnd < 0) throw new Error("tripMobileList markers fehlen");
const mobileList = `function tripMobileList(items) {
  return \`<div class="v4-mobile-records v4-compact-record-list" aria-label="Fanbusfahrten">
    \${items.map(trip => \`<article class="v4-m310-mobile-trip-card" data-m310-trip-card="\${escapeAttr(trip.id)}">
      <button class="v4-compact-record v4-m310-mobile-trip" type="button" data-m310-open-trip="\${escapeAttr(trip.id)}" aria-expanded="false">
        <span class="v4-m310-mobile-trip-meta">
          <small>\${escapeHtml(formatCalendarDate(trip.eventDate))} · \${escapeHtml(eventTimeLabel(trip.eventTime))}</small>
          \${mobileTripStatusBadge(trip)}
        </span>
        <strong class="v4-m310-mobile-trip-title">\${escapeHtml(trip.displayTitle || "Fanbusfahrt")}</strong>
        <span class="v4-m310-mobile-trip-footer">
          <span>\${escapeHtml(trip.venue || trip.opponentName || "Ziel noch offen")}</span>
        </span>
        <span class="v4-row-chevron" aria-hidden="true">›</span>
      </button>
    </article>\`).join("")}
  </div>\`;
}

`;
source = source.slice(0, mobileStart) + mobileList + source.slice(mobileEnd);
fs.writeFileSync(fanbusPath, source);

let ux = fs.readFileSync(uxPath, "utf8");
const cssStart = ux.indexOf('    .v4-m310-inline-trip-detail-row>td{');
const cssEndMarker = '    [data-m310-open-trip].is-expanded .v4-row-chevron{transform:rotate(90deg)}';
const cssEnd = ux.indexOf(cssEndMarker, cssStart);
if (cssStart < 0 || cssEnd < 0) throw new Error("accordion CSS markers fehlen");
const cssReplacement = `    .v4-m310-inline-trip-detail-row>td{padding:0!important;border-top:0!important}
    .v4-m310-inline-trip-detail-row>td{background:var(--surface,#fff)}
    .v4-m310-inline-trip-detail-shell{margin:0;padding:14px 0 0;border:0;border-radius:0;background:transparent;box-shadow:none}
    .v4-m310-inline-trip-detail-row .v4-m310-inline-trip-detail-shell{margin:0 8px 12px;padding:14px}
    .v4-m310-inline-trip-detail .v4-m325-trip-lifecycle,
    .v4-m310-inline-trip-detail-row .v4-m325-trip-lifecycle,
    .v4-m310-inline-trip-detail .v4-m325-trip-date,
    .v4-m310-inline-trip-detail-row .v4-m325-trip-date,
    .v4-m310-inline-trip-detail .v4-m325-trip-venue,
    .v4-m310-inline-trip-detail-row .v4-m325-trip-venue,
    .v4-m310-inline-trip-detail .v4-m325-trip-opponent,
    .v4-m310-inline-trip-detail-row .v4-m325-trip-opponent{display:none}
    .v4-m310-mobile-trip-card{overflow:hidden;border:1px solid var(--line,#d8e2ee);border-radius:18px;background:var(--surface,#fff)}
    .v4-m310-mobile-trip-card>.v4-m310-mobile-trip{width:100%;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
    .v4-m310-mobile-trip-card.is-expanded>.v4-m310-mobile-trip{border-bottom:1px solid var(--line,#d8e2ee)!important}
    .v4-m310-mobile-trip-card>.v4-m310-inline-trip-detail{margin:0;padding:0 14px 14px;background:transparent}
    .v4-m310-mobile-trip-card>.v4-m310-inline-trip-detail .v4-m325-trip-detail{margin:0}
    [data-m310-open-trip].is-expanded .v4-row-chevron{transform:rotate(90deg)}`;
ux = ux.slice(0, cssStart) + cssReplacement + ux.slice(cssEnd + cssEndMarker.length);
fs.writeFileSync(uxPath, ux);

const test = `import assert from "node:assert/strict";
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
  assert.match(detail, /record\.closest\("\\[data-m310-trip-card\\]"\)/);
  assert.match(detail, /mobileCard\?\.append\(detail\)/);
  assert.match(detail, /insertAdjacentElement\("afterend", detail\)/);
  assert.match(detail, /aria-expanded/);
  assert.doesNotMatch(detail, /data-m310-inline-trip-close/);
  assert.doesNotMatch(detail, /openDialog\(/);
  assert.doesNotMatch(detail, /window\.location\.hash/);
  assert.match(source, /function openTripDetail\(trip\)/);
  assert.match(source, /if \(trip\) openTripDetailAtRecord\(trip, record\);/);
  assert.doesNotMatch(source, /if \(trip\) \{\s*window\.location\.hash = \`#\\/fanbuses\\?detail=/);
  assert.match(ux, /\.v4-m310-mobile-trip-card\.is-expanded>/);
  assert.match(ux, /\.v4-m310-inline-trip-detail \.v4-m325-trip-date/);
  assert.match(ux, /border:0!important/);
});
`;
fs.writeFileSync(testPath, test);
