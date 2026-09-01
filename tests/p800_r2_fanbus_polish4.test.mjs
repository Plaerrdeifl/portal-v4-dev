import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const migrationPath = "supabase/migrations/20260826200358_p800_r2_fanbus_available_away_events_polish4.sql";

const [migration, fanbuses, ux, css] = await Promise.all([
  read(migrationPath),
  read("js/modules/fanbuses.js"),
  read("js/p800-r2-fanbus-ux.js"),
  read("css/app.css")
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

function cssRule(source, selector, from = 0) {
  const start = source.indexOf(selector, from);
  assert.notEqual(start, -1, `missing CSS selector: ${selector}`);
  const openingBrace = source.indexOf("{", start);
  const closingBrace = source.indexOf("}", openingBrace);
  return source.slice(openingBrace + 1, closingBrace);
}

test("Polish 4 offers only future away games without an existing Fanbus trip", () => {
  assert.match(migration, /create or replace function app_private\.api_fanbus_available_events\(\)/);
  assert.match(migration, /require_capability\('fanbus\.manage'\)/);
  assert.match(migration, /join app_modules\.event_games as game[\s\S]+game\.event_id = event\.id/);
  assert.match(migration, /event\.event_type = 'GAME'/);
  assert.match(migration, /game\.home_away = 'AWAY'/);
  assert.match(migration, /event\.event_date >=[\s\S]+time zone 'Europe\/Berlin'/);
  assert.match(
    migration,
    /not exists \([\s\S]+from app_modules\.fanbus_trips as trip[\s\S]+trip\.event_id = event\.id/
  );

  for (const field of ["id", "eventType", "displayTitle", "eventDate", "eventTime", "venue", "visibility"]) {
    assert.match(migration, new RegExp(`'${field}'`));
  }
  assert.match(migration, /order by[\s\S]+event\.event_date,[\s\S]+event\.event_time asc nulls first,[\s\S]+event\.id/);

  const create = section(fanbuses, "async function openTripCreate", "function defaultRegistrationClosesInput");
  assert.doesNotMatch(create, /\.filter\s*\(/);
  assert.doesNotMatch(create, /homeAway|home_away|\bAWAY\b/);
  assert.doesNotMatch(create, /(?:venue|displayTitle)[\s\S]{0,80}(?:includes|match|test|startsWith|endsWith)/);
});

test("Polish 4 keeps the Fanbus editor compact, time-first and unclipped on mobile", () => {
  const desktop = section(ux, ".v4-m310-editor-fields", "@media (max-width:620px)");
  const mobile = section(ux, "@media (max-width:620px)", "@media (max-width:430px)");
  const narrow = ux.slice(ux.indexOf("@media (max-width:350px)"));

  assert.match(desktop, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(desktop, /\.v4-m310-trip-stop-editor-row\{[^}]*grid-template-columns:104px minmax\(0,1fr\) auto/);
  assert.match(mobile, /\.v4-m310-editor-fields\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\);column-gap:8px\}/);
  assert.match(mobile, /\.v4-m310-trip-stop-editor-row\{grid-template-columns:112px minmax\(0,1fr\)\}/);
  assert.match(mobile, /\.v4-m310-trip-stop-remove\{grid-column:1\/-1;justify-self:end\}/);
  assert.match(mobile, /\.v4-m310-trip-default-stop\{grid-template-columns:minmax\(112px,\.45fr\) minmax\(0,1fr\)\}/);
  assert.doesNotMatch(mobile, /\.v4-m310-trip-default-stop\{grid-template-columns:1fr/);

  assert.match(desktop, /display:grid;gap:4px;width:100%;min-width:0;max-width:100%;font-weight:700/);
  assert.match(desktop, /display:block;box-sizing:border-box;width:100%;min-width:0;max-width:100%;inline-size:100%;min-inline-size:0;max-inline-size:100%/);
  assert.match(desktop, /\.v4-m310-editor-fields>label:has\(>input:is\([^}]+contain:inline-size;overflow:hidden/);
  assert.match(desktop, /\.v4-m310-trip-editor-form input:is\([^}]+-webkit-appearance:none!important;appearance:none!important/);
  assert.match(desktop, /min-inline-size:0!important;max-width:100%!important;max-inline-size:100%!important/);
  assert.match(narrow, /\.v4-m310-editor-fields,\.v4-m310-trip-stop-editor-row,\.v4-m310-trip-default-stop\{grid-template-columns:1fr\}/);
});

test("Polish 4 keeps guest identity fields hidden and collapses mode after person selection in source logic", () => {
  const form = section(fanbuses, "function manualRegistrationForm", "function syncManualRegistrationMode");
  const sync = section(fanbuses, "function syncManualRegistrationMode", "function bindManualConsentValidation");

  assert.equal((form.match(/data-m310-manual-guest hidden/g) || []).length, 3);
  assert.match(sync, /personField\.hidden = isGuest/);
  assert.match(sync, /personInput\.disabled = isGuest/);
  assert.match(sync, /field\.hidden = !isGuest/);
  assert.match(sync, /input\.disabled = !isGuest/);
  assert.match(sync, /input\.required = isGuest && input\.name !== "email"/);
  assert.match(sync, /modeField\.hidden = !isGuest && Boolean\(personInput\?\.value\)/);
  assert.match(fanbuses, /function setManualRegistrationPerson[\s\S]+syncManualRegistrationMode\(dialog\)/);

  const dialogLabel = css.indexOf(".v4-dialog label,");
  const hiddenLabel = css.indexOf(".v4-dialog label[hidden]", dialogLabel);
  assert.ok(dialogLabel >= 0 && hiddenLabel > dialogLabel);
  assert.match(cssRule(css, ".v4-dialog label[hidden]", dialogLabel), /display:none!important/);
});
