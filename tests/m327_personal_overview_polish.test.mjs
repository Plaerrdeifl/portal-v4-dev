import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const polish = fs.readFileSync(
  new URL("../js/m327-r1-acceptance-polish.js", import.meta.url),
  "utf8"
);

test("M327 collapsed bookings summarize participants and cancellations", () => {
  assert.match(polish, /function bookingParticipantOverview\(card\)/);
  assert.match(polish, /\.m327-participants > \.m327-participant/);
  assert.match(polish, /item\.status !== "Storniert"/);
  assert.match(polish, /companions\.length === 1/);
  assert.match(polish, /\$\{leadText\} \+ \$\{companions\[0\]\.name\}/);
  assert.match(polish, /companions\.length > 1/);
  assert.match(polish, /`Mitfahrer: \$\{item\.name\}`/);
  assert.match(polish, /summary\.replaceChildren\(\.\.\.rows\)/);
  assert.match(polish, /m327-booking-overview-line/);
  assert.match(polish, /data-tone="cancelled"/);
  assert.match(polish, /Buchung storniert/);
  assert.match(polish, /data-m327-booking-cancelled|m327BookingCancelled/);
});

test("M327 expanded active booking is only subtly highlighted", () => {
  assert.match(polish, /data-m327-expanded="true"/);
  assert.match(polish, /:not\(\[data-m327-booking-cancelled="true"\]\)/);
  assert.match(polish, /background:#f7fbff/);
  assert.match(polish, /border-color:color-mix\(in srgb,var\(--blue-700\) 20%,var\(--line\)\)/);
  assert.match(polish, /box-shadow:0 0 0 1px color-mix\(in srgb,var\(--blue-700\) 7%,transparent\)/);
});

test("M327 personal Fanbus dropdown is compact on mobile", () => {
  assert.match(polish, /#m310FanbusActionMenu\.m327-personal-fanbus-panel/);
  assert.match(polish, /width:min\(250px,calc\(100vw - 32px\)\)!important/);
  assert.match(polish, /> button\{[\s\S]*?min-height:39px/);
});

test("M327 companion workspace gets a compact mobile presentation only", () => {
  assert.match(polish, /\.v4-m325-companion-workspace > \.v4-m325-workspace-header/);
  assert.match(polish, /\.v4-m325-companion-workspace \.v4-m325-list-actions/);
  assert.match(polish, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(polish, /\.v4-m325-companion-workspace \.v4-m325-member-actions/);
  assert.match(polish, /grid-template-columns:40px 40px minmax\(0,1fr\)/);
  assert.doesNotMatch(polish, /\bcall\s*\(/);
  assert.doesNotMatch(polish, /fanbus_selfservice|fanbus_companion_/);
});
