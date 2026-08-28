import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const uiPath = path.join(root, "js/modules/m320-r3-auto-assignment.js");

test("M320-R3 resets the automatic-assignment entry after closing the preview", async () => {
  const ui = await fs.readFile(uiPath, "utf8");
  const clickStart = ui.indexOf('section.addEventListener("click", async () => {');
  const clickEnd = ui.indexOf("\n\n  body.prepend(section);", clickStart);

  assert.notEqual(clickStart, -1);
  assert.notEqual(clickEnd, -1);

  const handler = ui.slice(clickStart, clickEnd);

  assert.match(handler, /section\.disabled = true;/);
  assert.match(handler, /section\.setAttribute\("aria-busy", "true"\);/);
  assert.match(handler, /copy\.textContent = "Zuordnung wird berechnet …";/);
  assert.match(
    handler,
    /finally\s*\{[\s\S]*section\.disabled = false;[\s\S]*section\.removeAttribute\("aria-busy"\);[\s\S]*copy\.textContent = original;/
  );
  assert.doesNotMatch(handler, /if\s*\(section\.isConnected\)/);
});
