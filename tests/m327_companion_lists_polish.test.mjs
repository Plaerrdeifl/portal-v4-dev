import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const wrapper = fs.readFileSync(
  new URL("../js/m327-companion-lists-polish.js", import.meta.url),
  "utf8"
);
const base = fs.readFileSync(
  new URL("../js/m327-companion-lists-tap-base.js", import.meta.url),
  "utf8"
);
const finalPolish = fs.readFileSync(
  new URL("../js/m327-companion-lists-final-polish.js", import.meta.url),
  "utf8"
);
const pages = fs.readFileSync(
  new URL("../js/pages.js", import.meta.url),
  "utf8"
);

test("M327 personal companion lists keep the stable tap and menu base", () => {
  assert.match(base, /m327-companion-list-head/);
  assert.match(base, /m327-companion-member-tappable/);
  assert.match(base, /setListCollapsed/);
  assert.match(base, /data-m325-edit-member/);
  assert.match(base, /summary\.textContent = "⋮"/);
  assert.match(base, /Umbenennen/);
  assert.match(base, /Verknüpfung lösen/);
  assert.match(base, /m327-companion-original-actions\{display:none!important\}/);
  assert.doesNotMatch(base, /\bcall\s*\(/);
});

test("M327 final companion polish is isolated from the stable observer", () => {
  assert.match(wrapper, /m327-companion-lists-tap-base\.js\?v=20260830-m327-companion-stable2/);
  assert.match(wrapper, /m327-companion-lists-final-polish\.js\?v=20260830-m327-companion-final3/);
  assert.match(wrapper, /setupM327CompanionListsTapBase\(\)/);
  assert.match(wrapper, /setupM327CompanionListsFinalPolish\(\)/);
});

test("M327 final polish keeps DOM text writes idempotent to avoid observer loops", () => {
  assert.match(finalPolish, /function setTextIfChanged/);
  assert.match(finalPolish, /element\.textContent !== value/);
  assert.match(finalPolish, /new MutationObserver\(scheduleScan\)/);
  assert.match(finalPolish, /requestAnimationFrame/);
  assert.doesNotMatch(finalPolish, /if \(back instanceof HTMLButtonElement\) back\.textContent/);
  assert.doesNotMatch(finalPolish, /if \(intro instanceof HTMLElement\) intro\.textContent/);
});

test("M327 new companion list starts collapsed behind a compact plus action", () => {
  assert.match(finalPolish, /m327-final-new-list-toggle/);
  assert.match(finalPolish, /toggle\.textContent = "\+ Liste"/);
  assert.match(finalPolish, /newList\.hidden = true/);
  assert.match(finalPolish, /m327-final-new-list-panel\[hidden\]\{display:none!important\}/);
  assert.match(finalPolish, /grid-template-columns:minmax\(0,1fr\) auto!important/);
});

test("M327 linked portal companions show identity instead of readonly name fields", () => {
  assert.match(finalPolish, /first\.readOnly/);
  assert.match(finalPolish, /last\.readOnly/);
  assert.match(finalPolish, /m327-final-linked-name-field/);
  assert.match(finalPolish, /m327-final-linked-person-summary/);
  assert.match(finalPolish, /Portaluser · Name wird aus dem Profil übernommen/);
  assert.match(finalPolish, /textarea\.rows !== 3/);
});

test("M327 companion wrapper remains loaded from the fanbus page", () => {
  assert.match(
    pages,
    /\.\/m327-companion-lists-polish\.js\?v=20260830-m327-companion-tap2/
  );
  assert.match(pages, /"setupM327CompanionListsPolish"/);
});
