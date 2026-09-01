import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../pages/fanbuses.html", import.meta.url), "utf8");

test("M327 mobile booking cards use compact layout overrides", () => {
  assert.match(html, /#m327MyBookingsPanel \.m327-booking-card\{[\s\S]*?gap:10px;[\s\S]*?padding:12px;/);
  assert.match(html, /#m327MyBookingsPanel \.m327-booking-meta>div:first-child\{\s*display:none;/);
  assert.match(html, /#m327MyBookingsPanel \.m327-participant\{[\s\S]*?gap:7px;[\s\S]*?padding:10px;/);
});

test("M327 participant facts render as compact label/value rows", () => {
  assert.match(html, /#m327MyBookingsPanel \.m327-participant-details\{[\s\S]*?grid-template-columns:1fr;/);
  assert.match(html, /grid-template-columns:minmax\(92px,\.85fr\) minmax\(0,1\.15fr\)/);
  assert.match(html, /#m327MyBookingsPanel \.m327-participant-details dd\{[\s\S]*?text-align:right;/);
});

test("M327 mobile keeps participant headers and actions compact", () => {
  assert.match(html, /#m327MyBookingsPanel \.m327-participant header\{[\s\S]*?flex-direction:row;[\s\S]*?align-items:center;/);
  assert.match(html, /#m327MyBookingsPanel \.m327-participant-actions \.button,[\s\S]*?#m327MyBookingsPanel \.m327-booking-actions \.button\{[\s\S]*?width:auto;[\s\S]*?min-height:38px;/);
  assert.doesNotMatch(html, /#m327MyBookingsPanel \.m327-participant-actions \.button[^}]*width:100%/);
});

test("M327 readonly contact block is compact and bullet-free", () => {
  assert.match(html, /#m327MyBookingsPanel \.m327-contact-block ul\{[\s\S]*?list-style:none;/);
  assert.match(html, /#m327MyBookingsPanel \.m327-contact-block li\{[\s\S]*?display:flex;/);
});
