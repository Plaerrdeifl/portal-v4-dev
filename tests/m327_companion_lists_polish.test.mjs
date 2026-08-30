import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const polish = fs.readFileSync(
  new URL("../js/m327-companion-lists-polish.js", import.meta.url),
  "utf8"
);
const pages = fs.readFileSync(
  new URL("../js/pages.js", import.meta.url),
  "utf8"
);

test("M327 personal companion lists use tap driven list and member rows", () => {
  assert.match(polish, /m327-companion-list-head/);
  assert.match(polish, /m327-companion-member-tappable/);
  assert.match(polish, /setListCollapsed/);
  assert.match(polish, /data-m325-edit-member/);
  assert.match(polish, /role", "button"/);
  assert.match(polish, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(polish, /@media\(max-width:700px\)/);
});

test("M327 secondary companion actions move into context menus", () => {
  assert.match(polish, /m327-companion-menu-toggle/);
  assert.match(polish, /summary\.textContent = "⋮"/);
  assert.match(polish, /Umbenennen/);
  assert.match(polish, /Gast hinzufügen/);
  assert.match(polish, /Portaluser suchen/);
  assert.match(polish, /Liste löschen/);
  assert.match(polish, /Verknüpfung lösen/);
  assert.match(polish, /Entfernen/);
  assert.match(polish, /m327-companion-original-actions\{display:none!important\}/);
});

test("M327 companion polish forwards existing actions instead of adding business calls", () => {
  assert.match(polish, /forwardAction/);
  assert.match(polish, /button\.click\(\)/);
  assert.match(polish, /data-m325-move-member/);
  assert.match(polish, /data-m325-delete-member/);
  assert.match(polish, /data-m325-delete-list/);
  assert.doesNotMatch(polish, /\bcall\s*\(/);
  assert.doesNotMatch(polish, /fanbus_companion_|fanbus_selfservice/);
});

test("M327 new companion list form stays compact", () => {
  assert.match(polish, /\.v4-m325-new-list form\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto!important/);
  assert.match(polish, /\.v4-m325-new-list \.button\{[\s\S]*?width:auto!important/);
  assert.match(polish, /@media\(max-width:350px\)/);
});

test("M327 companion polish is explicitly versioned from the fanbus page loader", () => {
  assert.match(
    pages,
    /\.\/m327-companion-lists-polish\.js\?v=20260830-m327-companion-tap1/
  );
  assert.match(pages, /"setupM327CompanionListsPolish"/);
});
