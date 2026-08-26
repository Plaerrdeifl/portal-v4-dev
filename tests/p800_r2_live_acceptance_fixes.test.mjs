import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = file => readFile(join(root, file), "utf8");
const [fanbuses, common, dates, css, fanbusUx] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("js/modules/common.js"),
  read("js/modules/dates.js"),
  read("css/app.css"),
  read("js/p800-r2-fanbus-ux.js")
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

test("inline Fanbus detail never reuses the global dialog body id", () => {
  const inline = section(fanbuses, "function openTripDetailAtRecord", "async function hydrateTripDetailStops");
  assert.match(inline, /data-m310-inline-trip-body/);
  assert.doesNotMatch(inline, /id="v4DialogBody"/);
  assert.doesNotMatch(fanbuses, /<div id="v4DialogBody"/);

  const editor = section(fanbuses, "async function openInlineTripEditor", "function bindTripDetail");
  const restore = section(fanbuses, "function restoreTripOverview", "function syncTripDefaultStopOptions");
  assert.match(editor, /dialog\.querySelector\("\[data-m310-inline-trip-body\]"\)/);
  assert.match(restore, /dialog\.querySelector\("\[data-m310-inline-trip-body\]"\)/);
});

test("global dialog internals are scoped to the real dialog element", () => {
  assert.equal((common.match(/id="v4DialogBody"/g) || []).length, 1);
  assert.match(common, /function dialogBody\(dialog\)[\s\S]*dialog\?\.querySelector\("#v4DialogBody"\)/);
  assert.match(common, /dialog\.querySelector\("#v4DialogTitle"\)/);
  assert.match(common, /dialog\.querySelector\("#v4DialogKicker"\)/);
  assert.match(common, /bodyNode\.querySelector\("#v4DialogSubmit"\)/);
  assert.doesNotMatch(common, /document\.getElementById\("v4Dialog(?:Body|Title|Kicker|Submit)"\)/);
});

test("inline Fanbus editor remains in normal page scrolling", () => {
  assert.match(fanbusUx, /\[data-m310-inline-trip-body\]\{[^}]*max-height:none!important;[^}]*overflow:visible!important;[^}]*overscroll-behavior:auto!important;[^}]*touch-action:auto/);
  assert.doesNotMatch(fanbusUx, /\[data-m310-inline-trip-body\][^{]*\{[^}]*overscroll-behavior:contain/);
});

test("participant edit opens a loading child before parallel RPC completion", () => {
  const edit = section(fanbuses, "async function openRegistrationEdit", "function bindRegistrationActions");
  const openIndex = edit.indexOf("body: loading(\"Teilnehmer wird geladen …\")");
  const rpcIndex = edit.indexOf("await Promise.all");
  assert.ok(openIndex >= 0 && rpcIndex > openIndex);
  assert.match(edit, /fanbus_registration_operational_detail/);
  assert.match(edit, /fanbus_trip_boarding_stops_list/);
  assert.match(edit, /dialog\.dataset\.v4DialogContext !== loadingContextId/);
  assert.match(edit, /replaceCurrent: true/);
  assert.match(edit, /Teilnehmer konnte nicht geladen werden/);
});

test("participant more actions opens without an API preload", () => {
  const actions = section(fanbuses, "function openRegistrationActions", "function busCategoryLabel");
  assert.match(actions, /const dialog = openDialog\(/);
  assert.doesNotMatch(actions.slice(0, actions.indexOf("const dialog = openDialog(")), /\bawait\b|\bcall\(/);
  assert.match(actions, /void loadRegistrationIdentitySuggestion/);
});

test("bus action menu replaces its child without restoring and reopening the parent", () => {
  const actions = section(fanbuses, "function openBusActions", "async function occupancyData");
  assert.doesNotMatch(actions, /dialog\.close\(\)/);
  assert.match(actions, /openBusEditor[\s\S]*parentContextId,[\s\S]*replaceCurrent: true/);
  assert.match(actions, /openBusStops[\s\S]*parentContextId,[\s\S]*replaceCurrent: true/);
  assert.match(common, /if \(dialog\.open && !replaceCurrent\) saveDialogContext\(dialog\)/);
});

test("Fanbus deadline and mobile editor follow the final compact two-column contract", () => {
  const deadline = section(fanbuses, "function tripRegistrationDeadlineMarkup", "function normalizedTripDetailStops");
  assert.match(deadline, /class="full v4-m325-trip-registration-deadline"/);
  assert.match(fanbusUx, /v4-m325-trip-registration-deadline>span\{[^}]*white-space:nowrap/);
  assert.match(fanbusUx, /\.v4-m310-editor-fields\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  const mobile = section(fanbusUx, "@media (max-width:620px)", "@media (max-width:390px)");
  assert.match(mobile, /v4-m310-editor-fields\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(mobile, /v4-m310-trip-stop-editor-row\{grid-template-columns:104px minmax\(0,1fr\)/);
  assert.doesNotMatch(mobile, /(?:editor-fields|trip-stop-editor-row)\{grid-template-columns:1fr/);
  assert.match(fanbusUx, /v4-m310-editor-deadline,[^\n]*v4-m310-bus-preference-toggle\{grid-column:1\/-1\}/);
  assert.doesNotMatch(fanbusUx, /contain:inline-size/);
});

test("final Fanbus live polish uses direct person and boarding-stop rendering", () => {
  const setPerson = section(fanbuses, "function setManualRegistrationPerson", "function renderManualPersonPicker");
  const sync = section(fanbuses, "function syncManualRegistrationMode", "function bindManualConsentValidation");
  const row = section(fanbuses, "function tripStopEditorRow", "function tripForm");
  assert.match(setPerson, /syncManualRegistrationMode\(dialog\)/);
  assert.match(sync, /modeField\.hidden = !isGuest && Boolean\(personInput\?\.value\)/);
  assert.match(fanbuses, /function boardingStopDisplay\(stop, fallback = "Zustieg"\)/);
  assert.ok(row.indexOf("<label>Uhrzeit") < row.indexOf("<label>Zustiegsort"));
  assert.doesNotMatch(fanbusUx, /function timeFirstBoardingStopText|new MutationObserver|#m310ManualRegistrationForm:has/);
});
test("dates hide only the successful normal status and collapse mobile filters", () => {
  const render = section(dates, "function render()", "function eventForm");
  assert.doesNotMatch(render, /setStatus\("Aktuell",\s*"success"\)/);
  assert.match(render, /setStatus\(""\)/);
  assert.match(render, /data-m210-filter-details/);
  assert.match(render, /Filter\$\{activeFilterCount\(\)/);
  assert.match(render, /mobile \? mobileFiltersOpen : true/);
  assert.ok(render.indexOf("m210EventSearch") < render.indexOf("data-m210-filter-details"));
  assert.match(dates, /setStatus\("Lädt"\)/);
  assert.match(dates, /setStatus\("Fehler", "error"\)/);
  assert.match(css, /@media\(max-width:700px\)\{[\s\S]*\.v4-m210-filter-summary\{[\s\S]*display:flex!important/);
  assert.match(css, /v4-m210-filter-disclosure:not\(\[open\]\)>\.v4-m210-filter-fields\{[\s\S]*display:none/);
});

test("existing Fanbus accordion contract remains intact", () => {
  assert.match(fanbuses, /record\.setAttribute\("aria-expanded", "true"\)/);
  assert.match(fanbuses, /closeInlineTripDetail\(\)/);
  assert.match(fanbuses, /record\.insertAdjacentElement\("afterend", detail\)/);
  assert.doesNotMatch(fanbuses, /fanbus-detail\.html|#\/fanbus-detail/);
});
