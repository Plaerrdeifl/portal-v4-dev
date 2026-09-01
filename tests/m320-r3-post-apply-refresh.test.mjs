import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ux = readFileSync(new URL("../js/m326-registration-status-ux.js", import.meta.url), "utf8");

test("M320 assignment apply refreshes the restored participant list", () => {
  assert.match(ux, /ASSIGNMENT_APPLY_ACTION = "fanbus_assignment_apply"/);
  assert.match(ux, /pd-api-before-call/);
  assert.match(ux, /pd-api-after-call/);
  assert.match(ux, /Teilnehmer und Anmeldungen/);
  assert.match(ux, /data-m310-participants/);
  assert.match(ux, /bindStaleParticipantCleanup/);
});
