import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const registrationSource = read("../js/modules/bus-orga-registration-v3.js");
const nativeSource = read("../js/modules/bus-orga-v3.js");
const directUxSource = read("../js/modules/bus-orga-registration-booking-ux.js");
const flowWordingSource = read("../js/modules/bus-orga-registration-flow-wording.js");

test("M328 prepared bookings heading stays on one line with counters directly below", () => {
  assert.match(registrationSource, /class="m328-reg3-panel m328-reg3-prepared-panel"/);
  assert.match(registrationSource, /class="m328-reg3-panel-head m328-reg3-prepared-head"><h3>Vorbereitete Buchungen<\/h3><p class="m328-reg3-prepared-counts">/);
  assert.match(registrationSource, /id="m328Reg3BookingCount"[^>]*>0<\/span> Buchungen · <span id="m328Reg3ParticipantCount"[^>]*>0<\/span> Personen/);
  assert.match(registrationSource, /\.m328-reg3-prepared-head h3\{white-space:nowrap\}/);
  assert.match(registrationSource, /\.m328-reg3-prepared-head\{display:grid;[^}]*gap:3px/);
  assert.match(registrationSource, /\.m328-reg3-prepared-panel\{background:color-mix\(in srgb,var\(--blue-700\) 4%,var\(--surface\)\)/);
});

test("M328 prepared booking header keeps status inline and the participant area separate", () => {
  assert.match(registrationSource, /class="m328-reg3-booking-head-copy"><strong>Buchung \$\{bookingIndex \+ 1\} · \$\{count\}/);
  assert.match(registrationSource, /m328-reg3-booking-status-prepared">Vorbereitet<\/span>/);
  assert.match(registrationSource, /class="m328-reg3-booking-actions"><button class="icon-button m328-reg3-booking-settings"/);
  assert.match(registrationSource, /class="m328-reg3-booking-menu"[^>]*hidden><button[^>]*>Bearbeiten<\/button><button[^>]*>Löschen<\/button>/);
  assert.match(nativeSource, /\.m328-reg3-booking:not\(\.is-active-booking\) \.m328-reg3-booking-head\{[^}]*background:var\(--surface-soft\)/);
  assert.match(nativeSource, /\.m328-reg3-booking:not\(\.is-active-booking\)\{[^}]*background:var\(--surface\)/);
  assert.doesNotMatch(nativeSource, /content:"Vorbereitet"/);
});

test("M328 direct registration route loads its booking-state UX", () => {
  assert.match(flowWordingSource, /import \{ setupM328RegistrationBookingUx \} from "\.\/bus-orga-registration-booking-ux\.js\?v=20260830-m328-registration-booking-ux1"/);
  assert.match(flowWordingSource, /setupM328RegistrationBookingUx\(\)/);
  assert.match(directUxSource, /\.m328-reg3-booking:not\(\.is-active-booking\) \.m328-reg3-person\{display:none!important\}/);
  assert.match(directUxSource, /\.m328-reg3-booking\.is-active-booking \.m328-reg3-booking-overview\{display:none!important\}/);
  assert.match(directUxSource, /\.m328-reg3-booking-status\{display:none;/);
  assert.match(directUxSource, /@media\(max-width:520px\)[\s\S]*\.m328-reg3-booking-head-copy\{display:flex!important;flex-wrap:wrap!important/);
});

test("M328 active and inactive booking treatments remain visually distinct", () => {
  assert.match(nativeSource, /\.m328-reg3-booking\.is-active-booking\{[^}]*background:color-mix\(in srgb,var\(--warning\) 9%,var\(--surface\)\)/);
  assert.match(nativeSource, /\.m328-reg3-booking\.is-active-booking \.m328-reg3-booking-head\{[^}]*background:color-mix\(in srgb,var\(--warning\) 15%,var\(--surface\)\)/);
  assert.match(nativeSource, /\.m328-reg3-booking:not\(\.is-active-booking\):not\(\.is-decision-booking\) \.m328-reg3-booking-status-prepared/);
});

test("M328 person search renders name and type on one compact line", () => {
  assert.match(registrationSource, /class="m328-reg3-choice-copy"><strong>\$\{escapeHtml\(`\$\{choice\.firstName\} \$\{choice\.lastName\}`\)\}<\/strong><span class="m328-reg3-choice-separator"[^>]*>·<\/span><small>\$\{escapeHtml\(sourceLabel\(choice\.source\)\)\}<\/small>/);
  assert.match(registrationSource, /\.m328-reg3-choice-copy\{display:flex;[^}]*white-space:nowrap/);
  assert.match(registrationSource, /\.m328-reg3-choice-copy small\{flex:0 0 auto/);
  assert.doesNotMatch(registrationSource, /<span><strong>\$\{escapeHtml\(`\$\{choice\.firstName\} \$\{choice\.lastName\}`\)\}<\/strong><small>/);
});

test("M328 person search shows two compact results and scrolls beyond them", () => {
  assert.match(registrationSource, /\.m328-reg3-results\{--m328-reg3-result-height:36px;--m328-reg3-result-gap:5px;[^}]*max-height:calc\(var\(--m328-reg3-result-height\) \+ var\(--m328-reg3-result-height\) \+ var\(--m328-reg3-result-gap\)\);[^}]*overflow-y:auto/);
  assert.match(registrationSource, /\.m328-reg3-choice\{[^}]*height:var\(--m328-reg3-result-height\);[^}]*min-height:var\(--m328-reg3-result-height\);[^}]*max-height:var\(--m328-reg3-result-height\);[^}]*padding:4px 7px/);
  assert.match(registrationSource, /\.slice\(0, 50\)/);
});
