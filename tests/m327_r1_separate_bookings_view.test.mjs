import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync(
  new URL("../pages/fanbuses.html", import.meta.url),
  "utf8"
);
const controller = fs.readFileSync(
  new URL("../js/modules/fanbus-my-bookings.js", import.meta.url),
  "utf8"
);

test("M327 keeps trip discovery and booking management as separate views", () => {
  assert.doesNotMatch(page, /m327-fanbus-tabs/);
  assert.doesNotMatch(page, /role="tablist"/);
  assert.match(page, /id="m327TripsPanel"[^>]*aria-label="Fanbusfahrten"/);
  assert.match(page, /id="m327MyBookingsPanel"[^>]*aria-label="Meine Fanbus-Buchungen"[^>]*hidden/);
  assert.match(page, /id="m327MyBookingsTab"[\s\S]*?Meine Buchungen<\/button>/);
  assert.match(page, /id="m327TripsTab"[\s\S]*?← Zurück<\/button>/);
});

test("M327 exposes booking management inside one compact personal action", () => {
  assert.match(page, /class="button small secondary m327-personal-fanbus-toggle"/);
  assert.match(page, /Buchungen &amp; Einstellungen/);
  assert.match(page, /id="m310FanbusActionMenu"[\s\S]*?id="m327MyBookingsTab"/);
  assert.match(page, /\.m327-personal-fanbus-toggle\{[\s\S]*?width:100%;/);
  assert.match(page, /Fahrten entdecken und anmelden/);
  assert.match(page, /Deine gebuchten Fahrten und Teilnehmer verwalten/);
});

test("M327 existing controller still switches the two panels and loads bookings on demand", () => {
  assert.match(controller, /const tripsTab = document\.getElementById\("m327TripsTab"\)/);
  assert.match(controller, /const bookingsTab = document\.getElementById\("m327MyBookingsTab"\)/);
  assert.match(controller, /tripsPanel\.hidden = my;/);
  assert.match(controller, /bookingsPanel\.hidden = !my;/);
  assert.match(controller, /if \(my\) void load\(\);/);
});
