import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(new URL("../pages/fanbuses.html", import.meta.url), "utf8");
const busOrgaShell = fs.readFileSync(new URL("../js/m328-bus-orga-shell.js", import.meta.url), "utf8");

test("Fanbus header uses personal actions instead of a gear", () => {
  assert.match(page, /id="m310FanbusActionToggle"[\s\S]*?Buchungen &amp; Einstellungen/);
  assert.match(page, /class="button small secondary m327-personal-fanbus-toggle"/);
  assert.doesNotMatch(page, />⚙️<\/button>/);
  assert.doesNotMatch(page, /class="icon-button v4-action-menu-toggle"/);
});

test("Personal Fanbus menu keeps bookings, standards and companions together", () => {
  const menuStart = page.indexOf('id="m310FanbusActionMenu"');
  const bookings = page.indexOf('id="m327MyBookingsTab"');
  const standards = page.indexOf('id="m325UserFanbusStandardsButton"');
  const companions = page.indexOf('id="m325CompanionListsButton"');
  assert.ok(menuStart >= 0);
  assert.ok(bookings > menuStart);
  assert.ok(standards > bookings);
  assert.ok(companions > standards);
});

test("Bus-Orga remains a separate action in the same header row", () => {
  assert.match(page, /class="m327-fanbus-user-actions"/);
  assert.match(busOrgaShell, /querySelector\("\.m327-fanbus-user-actions"\)/);
  assert.match(busOrgaShell, /button\.textContent = "🚌 Bus-Orga"/);
});
