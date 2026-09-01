import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [polish, publicBootstrap, portalBootstrap] = await Promise.all([
  read("js/m329-contact-white-card.js"),
  read("js/m327-r1-guest-contact-polish.js"),
  read("js/m328-trip-subpage-back.js")
]);

test("Portal Fanbus contact card matches the white homepage card layout", () => {
  assert.match(polish, /PORTAL_PANEL_ID = "m329PortalFanbusContacts"/);
  assert.match(polish, /background:#fff!important/);
  assert.match(polish, /width:100%!important/);
  assert.match(polish, /padding:\.82rem 1rem \.9rem!important/);
  assert.match(polish, /Kontakt zur Bus-Orga/);
});

test("Portal contact rows carry the agreed responsibilities", () => {
  assert.match(polish, /Allgemeine Fragen · Buchung & Anmeldung/);
  assert.match(polish, /Zustieg Münnerstadt · Pendlerparkplatz/);
  assert.match(polish, /Zustieg Schweinfurt · Icedome/);
  assert.doesNotMatch(polish, /0174 6681046/);
  assert.doesNotMatch(polish, /0172 9744908/);
});

test("all contact WhatsApp buttons use the subtle new visual treatment", () => {
  assert.match(polish, /m329-v2-whatsapp/);
  assert.match(polish, /background:#f2fbf5!important/);
  assert.match(polish, /border-color:#bde8cb!important/);
  assert.match(polish, /color:#14804a!important/);
  assert.match(polish, /<span>WhatsApp<\/span>/);
});

test("board phone links are replaced by the same labeled WhatsApp and call controls", () => {
  assert.match(polish, /\.m329-board-contact/);
  assert.match(polish, /m329-v2-board-actions/);
  assert.match(polish, /<span>WhatsApp<\/span>/);
  assert.match(polish, /<span>Anrufen<\/span>/);
  assert.match(polish, /m329-v2-call/);
  assert.match(polish, /m329-v2-board-card/);
});

test("WhatsApp navigation remains numeric and iPhone-PWA safe", () => {
  assert.ok(polish.includes('return /^https:\\/\\/wa\\.me\\/[1-9][0-9]{6,14}$/u.test(raw) ? raw : "";'));
  assert.match(polish, /window\.location\.assign\(href\)/);
  assert.match(polish, /event\.preventDefault\(\)/);
});

test("white-card polish is bootstrapped in both Fanbus portal entry points", () => {
  assert.match(publicBootstrap, /m329-contact-white-card\.js\?v=20260901-m329-white-card1/);
  assert.match(portalBootstrap, /m329-contact-white-card\.js\?v=20260901-m329-white-card1/);
});

test("contact visual alignment stays isolated from Liveticker", () => {
  assert.doesNotMatch(polish, /liveticker/i);
  assert.doesNotMatch(publicBootstrap, /liveticker/i);
  assert.doesNotMatch(portalBootstrap, /liveticker/i);
});
