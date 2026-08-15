import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

const [fanbuses, css] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("css/app.css")
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

const operations = section(
  fanbuses,
  "async function renderOperationsWorkspace",
  "function filterOperations"
);

const cards = section(
  fanbuses,
  "function operationCards",
  "function filterOperations"
);

const binding = section(
  fanbuses,
  "function bindOperationActions",
  "async function openBoardingStops"
);

test("U5.2 Fahrtbetrieb has compact date title and check-in header", () => {
  assert.match(fanbuses, /function operationEventLabel\(trip\)/);
  assert.match(operations, /← Zurück/);
  assert.match(operations, /<h2>Fahrtbetrieb<\/h2>/);
  assert.match(operations, /formatCalendarDate\(trip\?\.eventDate\)/);
  assert.match(operations, /operationEventLabel\(trip\)/);
  assert.match(operations, /· Check-in<\/p>/);
  assert.doesNotMatch(operations, /Check-in Hinfahrt/);
  assert.match(
    css,
    /\.v4-m325-operations-workspace > \.v4-m325-workspace-header > \.button[\s\S]*min-height:\s*32px/
  );
});

test("U5.2 counters show Angemeldet Anwesend Bezahlt Fehlt", () => {
  assert.match(
    operations,
    /participants\.filter\(person => person\.isPaid === true\)\.length/
  );

  for (const label of ["Angemeldet", "Anwesend", "Bezahlt", "Fehlt"]) {
    assert.match(operations, new RegExp(`</strong>${label}</span>`));
  }

  assert.doesNotMatch(operations, /<\/strong>Offen<\/span>/);
  assert.doesNotMatch(operations, /<\/strong>No-Show<\/span>/);
});

test("U5.2 hides OPEN from visible Fahrtbetrieb controls", () => {
  assert.match(operations, /<option value="ALL">Alle<\/option>/);
  assert.match(operations, /<option value="PRESENT">Anwesend<\/option>/);
  assert.match(operations, /<option value="NO_SHOW">Fehlt<\/option>/);
  assert.doesNotMatch(operations, /<option value="OPEN">/);

  assert.doesNotMatch(cards, /↶ Offen/);
  assert.doesNotMatch(cards, />No-Show</);
  assert.doesNotMatch(cards, />Offen</);
});

test("U5.2 keeps payment independent and check-in reversible", () => {
  assert.match(cards, /data-m325-checkin="PRESENT"/);
  assert.match(cards, /data-m325-checkin="NO_SHOW"/);
  assert.match(cards, /data-current-status=/);
  assert.match(cards, /isPresent \? "primary" : "secondary"/);
  assert.match(cards, /isMissing \? "danger" : "secondary"/);
  assert.match(cards, /person\.isPaid \? "primary" : "secondary"/);
  assert.match(cards, /data-m325-paid=/);

  assert.match(binding, /const requestedStatus = button\.dataset\.m325Checkin/);
  assert.match(
    binding,
    /button\.dataset\.currentStatus === requestedStatus[\s\S]*\? "OPEN"[\s\S]*: requestedStatus/
  );
  assert.match(binding, /status: nextStatus/);
  assert.match(binding, /call\("fanbus_paid_set"/);
});
