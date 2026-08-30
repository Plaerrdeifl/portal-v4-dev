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

test("M327 personal companion lists use the dedicated mobile polish", () => {
  assert.match(polish, /@media\(max-width:700px\)/);
  assert.match(polish, /\.v4-m325-companion-workspace > \.v4-m325-workspace-header/);
  assert.match(polish, /\.v4-m325-companion-workspace \.v4-m325-list-actions/);
  assert.match(polish, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(polish, /min-height:34px!important/);
});

test("M327 companion member actions keep move and edit compact with equal secondary actions", () => {
  assert.match(polish, /grid-template-columns:repeat\(8,minmax\(0,1fr\)\)!important/);
  assert.match(polish, /data-m325-edit-member[^\n]*\{[\s\S]*?grid-column:3 \/ span 6/);
  assert.match(polish, /data-m325-unlink-person[\s\S]*?grid-column:1 \/ span 4/);
  assert.match(polish, /data-m325-delete-member[^\n]*\{[\s\S]*?grid-column:5 \/ span 4/);
  assert.match(polish, /white-space:nowrap/);
});

test("M327 new companion list form is compact without changing companion business calls", () => {
  assert.match(polish, /\.v4-m325-new-list form\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto!important/);
  assert.match(polish, /\.v4-m325-new-list input\{[\s\S]*?min-height:36px!important/);
  assert.match(polish, /\.v4-m325-new-list \.button\{[\s\S]*?width:auto!important/);
  assert.doesNotMatch(polish, /\bcall\s*\(/);
  assert.doesNotMatch(polish, /fanbus_companion_|fanbus_selfservice/);
});

test("M327 companion polish is explicitly versioned from the fanbus page loader", () => {
  assert.match(
    pages,
    /\.\/m327-companion-lists-polish\.js\?v=20260830-m327-companion-lists1/
  );
  assert.match(pages, /"setupM327CompanionListsPolish"/);
});
