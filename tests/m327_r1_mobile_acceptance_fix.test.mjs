import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  isM327SeparatorOnly,
  m327ContactLabel,
  m327UserFacingContactText,
  normalizeM327PhoneHref
} from "../js/m327-r1-acceptance-polish.js";

const polishSource = fs.readFileSync(
  new URL("../js/m327-r1-acceptance-polish.js", import.meta.url),
  "utf8"
);
const pagesSource = fs.readFileSync(
  new URL("../js/pages.js", import.meta.url),
  "utf8"
);
const guestHtml = fs.readFileSync(
  new URL("../fanbus-anmeldung.html", import.meta.url),
  "utf8"
);
const guestWrapper = fs.readFileSync(
  new URL("../js/m327-r1-guest-contact-polish.js", import.meta.url),
  "utf8"
);

test("M327 rejects separator-only departure information", () => {
  assert.equal(isM327SeparatorOnly("•"), true);
  assert.equal(isM327SeparatorOnly("  • · –  "), true);
  assert.equal(isM327SeparatorOnly("—"), true);
  assert.equal(isM327SeparatorOnly("Icedome • 14:30 Uhr"), false);
  assert.equal(isM327SeparatorOnly("16:30 Uhr"), false);
  assert.match(polishSource, /Noch nicht festgelegt/);
});

test("M327 keeps the trip status badge on one line without shrinking it", () => {
  assert.match(polishSource, /statusBadge\.style\.whiteSpace = "nowrap"/);
  assert.match(polishSource, /statusBadge\.style\.flex = "0 0 auto"/);
  assert.match(polishSource, /content\.style\.minWidth = "0"/);
});

test("M327 normalizes public Bus-Orga contact text and links", () => {
  assert.equal(m327UserFacingContactText("BUS_ORGA kontaktieren"), "Bus-Orga kontaktieren");
  assert.equal(
    m327UserFacingContactText("Bitte wende dich an unsere BUS_ORGA."),
    "Bitte wende dich an unsere Bus-Orga."
  );
  assert.equal(m327ContactLabel("BUS_ORGA", true), "E-Mail");
  assert.equal(m327ContactLabel("Pascal", false), "Pascal");
  assert.equal(m327ContactLabel("Luca:", false), "Luca");
  assert.equal(normalizeM327PhoneHref("0172 9744908"), "01729744908");
  assert.equal(normalizeM327PhoneHref("+49 172 9744908"), "+491729744908");
  assert.match(polishSource, /mailto:/);
  assert.match(polishSource, /tel:/);
  assert.match(polishSource, /document\.createTextNode\(" "\)/);
});

test("M327 renders bookings collapsed first and expands details on demand", () => {
  assert.match(polishSource, /m327-booking-expanded/);
  assert.match(polishSource, /body\.hidden = true/);
  assert.match(polishSource, /aria-expanded/);
  assert.match(polishSource, /role", "button"/);
  assert.match(polishSource, /tabindex", "0"/);
  assert.match(polishSource, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(polishSource, /Buchungsdetails öffnen oder schließen/);
  assert.match(polishSource, /m327-booking-chevron/);
  assert.match(polishSource, /setBookingExpanded/);
});

test("M327 acceptance polish is wired into portal and guest registration", () => {
  assert.match(pagesSource, /m327-r1-acceptance-polish\.js/);
  assert.match(guestHtml, /m327-r1-guest-contact-polish\.js/);
  assert.match(guestWrapper, /setupM327AcceptancePolish/);
  assert.match(guestWrapper, /m327-r1-acceptance-polish\.js/);
});
