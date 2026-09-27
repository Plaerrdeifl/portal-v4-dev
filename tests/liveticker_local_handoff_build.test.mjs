import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const build = fs.readFileSync(
  new URL("../scripts/build-static.mjs", import.meta.url),
  "utf8"
);

test("DEV static build publishes the local Liveticker handoff page", () => {
  assert.equal(build.includes('"liveticker-local-handoff.html"'), true);
});
