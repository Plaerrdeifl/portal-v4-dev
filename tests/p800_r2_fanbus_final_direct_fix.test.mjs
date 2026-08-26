import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

const [fanbuses, publicRegistration, fanbusUx, pages, index, publicHtml] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("js/fanbus-registration.js"),
  read("js/p800-r2-fanbus-ux.js"),
  read("js/pages.js"),
  read("index.html"),
  read("fanbus-anmeldung.html")
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

test("manual member selection hides capture mode through Fanbus source logic", () => {
  const setPerson = section(fanbuses, "function setManualRegistrationPerson", "function renderManualPersonPicker");
  const sync = section(fanbuses, "function syncManualRegistrationMode", "function bindManualConsentValidation");
  assert.match(setPerson, /syncManualRegistrationMode\(dialog\)/);
  assert.match(sync, /modeField\.hidden = !isGuest && Boolean\(personInput\?\.value\)/);
  assert.doesNotMatch(fanbusUx, /#m310ManualRegistrationForm:has/);
});

test("internal boarding-stop UI renders HH:MM before place without Uhr", () => {
  assert.match(fanbuses, /function formatBoardingStopTime\(value\)/);
  assert.match(fanbuses, /return toBerlinTimeInputValue\(value\) \|\| "Zeit offen"/);
  assert.match(fanbuses, /function boardingStopDisplay\(stop, fallback = "Zustieg"\)/);
  assert.match(fanbuses, /`\$\{formatBoardingStopTime\(stop\.departureAt\)\} · \$\{label\}`/);
  const row = section(fanbuses, "function tripStopEditorRow", "function tripForm");
  assert.ok(row.indexOf("<label>Uhrzeit") < row.indexOf("<label>Zustiegsort"));
  const manual = section(fanbuses, "function manualRegistrationForm", "function syncManualRegistrationMode");
  assert.match(manual, /escapeHtml\(boardingStopDisplay\(stop\)\)/);
});

test("public boarding-stop options render HH:MM before place", () => {
  const options = section(publicRegistration, "function boardingStopOptions", "function companionValues");
  assert.match(options, /`\$\{formatBerlinTime\(stop\.departureAt\)\} · \$\{stop\.label\}`/);
});

test("DOM rewrite hacks are removed and final Fanbus assets are cache-busted", () => {
  assert.doesNotMatch(fanbusUx, /function timeFirstBoardingStopText|normalizeBoardingStopLabels|new MutationObserver/);
  assert.match(pages, /fanbuses\.js\?v=20260826-p800-r2-final-direct-fix/);
  assert.match(index, /p800-r2-fanbus-ux\.js\?v=20260826-p800-r2-final-direct-fix/);
  assert.match(publicHtml, /<script type="module" src="\.\/js\/fanbus-registration\.js"><\/script>/);
});
