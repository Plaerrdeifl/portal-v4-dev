import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { wppTogglePresentation } from "../js/liveticker-wpp-state.js";

const root = resolve(import.meta.dirname, "..");

test("disconnected state shows Verbinden even if desiredConnected is still true", () => {
  assert.deepEqual(
    wppTogglePresentation({ state: "DISCONNECTED", desiredConnected: true }, false),
    { disabled: false, label: "Verbinden", targetConnected: true }
  );
});

test("actual connection state wins over stale desiredConnected flag", () => {
  assert.deepEqual(
    wppTogglePresentation({ state: "CONNECTED", desiredConnected: false }, false),
    { disabled: false, label: "Trennen", targetConnected: false }
  );
});

test("transitions are locked with accurate labels", () => {
  assert.deepEqual(
    wppTogglePresentation({ state: "CONNECTING", desiredConnected: true }, false),
    { disabled: true, label: "Verbindet …", targetConnected: null }
  );
  assert.deepEqual(
    wppTogglePresentation({ state: "DISCONNECTING", desiredConnected: false }, false),
    { disabled: true, label: "Trennt …", targetConnected: null }
  );
});

test("error and unreachable states offer reconnect", () => {
  for (const state of ["ERROR", "UNREACHABLE"]) {
    assert.deepEqual(
      wppTogglePresentation({ state, desiredConnected: true }, false),
      { disabled: false, label: "Verbinden", targetConnected: true }
    );
  }
});

test("runtime toggle uses the tested presentation target rather than desiredConnected inversion", async () => {
  const source = await readFile(resolve(root, "js/liveticker-runtime-controls.js"), "utf8");
  assert.match(source, /const presentation = wppTogglePresentation\(wppRuntime, false\)/);
  assert.match(source, /const targetConnected = presentation\.targetConnected/);
  assert.doesNotMatch(source, /const targetConnected = wppRuntime\?\.desiredConnected === false/);
});
