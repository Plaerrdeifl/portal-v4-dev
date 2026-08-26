import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const migrationPath = "supabase/migrations/20260826193856_p800_r2_fanbus_available_away_events_polish4.sql";

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

test("Polish 4 stacks the Fanbus editor at the regular mobile breakpoint", () => {
  const desktop = section(ux, ".v4-m310-editor-fields", "@media (max-width:620px)");
  const mobile = section(ux, "@media (max-width:620px)", "@media (max-width:430px)");

  assert.match(desktop, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(desktop, /\.v4-m310-trip-stop-editor-row\{[^}]*grid-template-columns:minmax\(0,1fr\) 104px auto/);
  assert.match(mobile, /\.v4-m310-editor-fields\{grid-template-columns:1fr\}/);
  assert.match(mobile, /\.v4-m310-trip-stop-editor-row\{grid-template-columns:1fr\}/);
  assert.match(mobile, /\.v4-m310-trip-default-stop\{grid-template-columns:1fr\}/);
  assert.match(mobile, /\.v4-m310-trip-stop-remove\{grid-column:1;justify-self:start\}/);
});

test("Polish 4 keeps guest identity fields hidden in person mode", () => {
  const form = section(fanbuses, "function manualRegistrationForm", "function syncManualRegistrationMode");
  const sync = section(fanbuses, "function syncManualRegistrationMode", "function bindManualConsentValidation");

  assert.equal((form.match(/data-m310-manual-guest hidden/g) || []).length, 3);
  assert.match(sync, /personField\.hidden = isGuest/);
  assert.match(sync, /personInput\.disabled = isGuest/);
  assert.match(sync, /field\.hidden = !isGuest/);
  assert.match(sync, /input\.disabled = !isGuest/);
  assert.match(sync, /input\.required = isGuest && input\.name !== "email"/);

  const dialogLabel = css.indexOf(".v4-dialog label,");
  const hiddenLabel = css.indexOf(".v4-dialog label[hidden]", dialogLabel);
  assert.ok(dialogLabel >= 0 && hiddenLabel > dialogLabel);
  assert.match(cssRule(css, ".v4-dialog label[hidden]", dialogLabel), /display:none!important/);
});
