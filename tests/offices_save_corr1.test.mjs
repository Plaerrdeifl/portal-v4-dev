import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("office assignments capture the form before awaiting confirmation", async () => {
  const source = await read("js/modules/fanclub.js");
  const handler = source.indexOf(
    'document.getElementById("officeForm")?.addEventListener("submit"'
  );
  const capture = source.indexOf("const form = event.currentTarget;", handler);
  const confirmation = source.indexOf(
    "const confirmed = await confirmAction(",
    handler
  );

  assert.ok(handler >= 0, "office submit handler is missing");
  assert.ok(capture > handler, "form capture is missing");
  assert.ok(confirmation > capture, "form must be captured before await");
  assert.match(
    source,
    /if \(!\(form instanceof HTMLFormElement\)\)/
  );
  assert.doesNotMatch(
    source,
    /await confirmAction\([\s\S]{0,240}const form = event\.currentTarget;/
  );
});

test("office assignments are reloaded and verified before success", async () => {
  const source = await read("js/modules/fanclub.js");

  assert.match(source, /await call\("save_offices", \{ slots \}\);/);
  assert.match(source, /const refreshed = await call\("fanclub_snapshot"\);/);
  assert.match(source, /const completelySaved = \(/);
  assert.match(source, /savedOffices\.length === offices\.length/);
  assert.match(source, /String\(savedOffice\.memberId \|\| ""\)/);
  assert.match(
    source,
    /Die Vorstandsbesetzung wurde vom Server nicht vollständig bestätigt\./
  );
  assert.match(
    source,
    /const __V4_OFFICES_SAVE_CORR1_APPLIED__ = true;/
  );
});

test("office save correction rotates the PWA cache safely", async () => {
  const source = await read("service-worker.js");

  assert.match(
    source,
    /pd-portal-v4-offices-save-corr1-20260724/
  );
  assert.match(
    source,
    /pd-portal-v4-task-access-push-r3-20260724/
  );
});
