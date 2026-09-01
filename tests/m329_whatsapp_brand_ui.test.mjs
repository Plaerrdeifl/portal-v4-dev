import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [brandUi, publicBootstrap, portalBootstrap] = await Promise.all([
  read("js/m329-whatsapp-brand-ui.js"),
  read("js/m327-r1-guest-contact-polish.js"),
  read("js/m328-trip-subpage-back.js")
]);

test("M329 WhatsApp actions use the white brand mark on WhatsApp green", () => {
  assert.match(brandUi, /#25D366/);
  assert.match(brandUi, /fill=\"#FFFFFF\"/);
  assert.match(brandUi, /M17\.472 14\.382/);
  assert.match(brandUi, /m329-whatsapp-brand-mark/);
  assert.match(brandUi, /\.m329-contact-action\.m329-whatsapp/);
  assert.match(brandUi, /\.m329-primary-whatsapp/);
  assert.doesNotMatch(brandUi, /currentColor/);
});

test("small WhatsApp action is hard-centered inside the clickable anchor", () => {
  assert.match(brandUi, /position:relative!important/);
  assert.match(brandUi, /position:absolute!important/);
  assert.match(brandUi, /left:50%!important/);
  assert.match(brandUi, /top:50%!important/);
  assert.match(brandUi, /translate\(-50%,-50%\)/);
  assert.match(brandUi, /pointer-events:none!important/);
  assert.match(brandUi, /pointer-events:auto!important/);
});

test("WhatsApp anchors use direct same-context navigation for iPhone PWA", () => {
  assert.match(brandUi, /button\.removeAttribute\("target"\)/);
  assert.match(brandUi, /window\.location\.assign\(href\)/);
  assert.match(brandUi, /event\.preventDefault\(\)/);
  assert.match(brandUi, /event\.stopPropagation\(\)/);
  assert.match(brandUi, /https:\\\/\\\/wa\\\.me/);
});

test("board cards hide the standalone phone number and center their content", () => {
  assert.match(brandUi, /m329-board-contact-number/);
  assert.match(brandUi, /\.remove\(\)/);
  assert.match(brandUi, /m329-board-card-centered/);
  assert.match(brandUi, /text-align:center!important/);
  assert.match(brandUi, /justify-content:center!important/);
  assert.match(brandUi, /margin-left:0!important/);
});

test("WhatsApp brand UI loads in public and portal Fanbus entry points with refreshed cache key", () => {
  assert.match(publicBootstrap, /m329-whatsapp-brand-ui\.js\?v=20260901-m329-whatsapp-brand3/);
  assert.match(portalBootstrap, /m329-whatsapp-brand-ui\.js\?v=20260901-m329-whatsapp-brand3/);
});

test("WhatsApp brand UI stays isolated from the frozen Liveticker", () => {
  assert.doesNotMatch(brandUi, /liveticker/i);
  assert.doesNotMatch(publicBootstrap, /liveticker/i);
  assert.doesNotMatch(portalBootstrap, /liveticker/i);
});
