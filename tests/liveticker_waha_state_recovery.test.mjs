import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createWppStateReconciler,
  isWahaAlreadyRunningError,
  normalizeWppSnapshot,
  WPP_RECOVERY_COOLDOWN_MS
} from "../workers/liveticker-whatsapp/wpp-runtime.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const snapshot = (status, engineState = null) => normalizeWppSnapshot({
  status,
  engine: engineState ? { state: engineState } : undefined
});

function harness({ snapshots = [], actionResults = {}, currentTime = 1000 } = {}) {
  const queue = [...snapshots];
  const actions = [];
  const events = [];
  const waits = [];
  let time = currentTime;
  const reconciler = createWppStateReconciler({
    readSnapshot: async () => {
      assert.ok(queue.length, "unexpected WAHA state read");
      return queue.shift();
    },
    performAction: async action => {
      actions.push(action);
      const result = actionResults[action];
      if (result instanceof Error) throw result;
      if (typeof result === "function") return result(actions.length);
      return result;
    },
    wait: async delay => { waits.push(delay); },
    now: () => time,
    onEvent: (event, details) => events.push({ event, details })
  });
  return {
    actions,
    events,
    waits,
    reconcile: (desiredConnected, initial) => reconciler.reconcile(desiredConnected, initial),
    advance: delay => { time += delay; }
  };
}

test("WORKING plus CONNECTED is healthy and requires no recovery action", async () => {
  const h = harness();
  const result = await h.reconcile(true, snapshot("WORKING", "CONNECTED"));
  assert.equal(result.snapshot.state, "CONNECTED");
  assert.equal(result.changed, false);
  assert.deepEqual(h.actions, []);
  assert.deepEqual(h.waits, []);
});

test("STOPPED plus CONNECTED is reconciled as connected without start or restart", async () => {
  const h = harness();
  const inconsistent = snapshot("STOPPED", "CONNECTED");
  assert.equal(inconsistent.inconsistent, true);
  assert.equal(inconsistent.state, "CONNECTED");

  const result = await h.reconcile(true, inconsistent);
  assert.equal(result.snapshot.state, "CONNECTED");
  assert.deepEqual(h.actions, []);
  assert.equal(h.events.filter(item => item.event === "wpp_state_reconciled").length, 1);
});

test("an unreadable state is refreshed before any recovery action", async () => {
  const h = harness({ snapshots: [snapshot("WORKING", "CONNECTED")] });
  const result = await h.reconcile(true, {
    state: "ERROR",
    status: "UNKNOWN",
    engineState: "UNKNOWN",
    inconsistent: false,
    error: "fetch failed"
  });
  assert.equal(result.snapshot.state, "CONNECTED");
  assert.deepEqual(h.actions, []);
});

test("a genuinely stopped session uses the regular start path once", async () => {
  const h = harness({ snapshots: [snapshot("STARTING")] });
  const result = await h.reconcile(true, snapshot("STOPPED"));
  assert.equal(result.snapshot.state, "CONNECTING");
  assert.equal(result.transitionPending, true);
  assert.deepEqual(h.actions, ["start"]);
  assert.equal(h.actions.includes("restart"), false);
});

test("a regressed start transition is confirmed and recovered without a second start", async () => {
  const h = harness({
    snapshots: [
      snapshot("STARTING"),
      snapshot("STOPPED"),
      snapshot("STOPPED"),
      snapshot("WORKING", "CONNECTED")
    ]
  });
  const starting = await h.reconcile(true, snapshot("STOPPED"));
  assert.equal(starting.snapshot.state, "CONNECTING");

  const recovered = await h.reconcile(true, snapshot("STOPPED"));
  assert.equal(recovered.snapshot.state, "CONNECTED");
  assert.deepEqual(h.actions, ["start", "restart"]);
  assert.equal(h.actions.filter(action => action === "start").length, 1);
});

test("already-running start conflict refreshes to CONNECTED without restart", async () => {
  const conflict = Object.assign(
    new Error("WAHA POST start failed (422): Session 'Liveticker_Test' is already started."),
    { status: 422, data: { message: "Session 'Liveticker_Test' is already started." } }
  );
  assert.equal(isWahaAlreadyRunningError(conflict), true);

  const h = harness({
    snapshots: [snapshot("STOPPED", "CONNECTED")],
    actionResults: { start: conflict }
  });
  const result = await h.reconcile(true, snapshot("STOPPED"));
  assert.equal(result.snapshot.state, "CONNECTED");
  assert.deepEqual(h.actions, ["start"]);
  assert.equal(h.events.filter(item => item.event === "wpp_start_conflict").length, 1);
  assert.equal(h.events.some(item => item.event === "wpp_recovery_action"), false);
});

test("a confirmed inconsistent start performs exactly one controlled restart", async () => {
  const h = harness({
    snapshots: [
      snapshot("STOPPED"),
      snapshot("STOPPED"),
      snapshot("WORKING", "CONNECTED")
    ]
  });
  const result = await h.reconcile(true, snapshot("STOPPED"));
  assert.equal(result.snapshot.state, "CONNECTED");
  assert.deepEqual(h.actions, ["start", "restart"]);
  assert.deepEqual(h.waits, [1000]);
  assert.equal(h.events.filter(item => item.event === "wpp_recovery_action").length, 1);
  assert.equal(h.events.filter(item => item.event === "wpp_recovery_succeeded").length, 1);
});

test("failed recovery enters cooldown instead of a fast control loop", async () => {
  const restartFailure = new Error("WAHA restart failed");
  const h = harness({
    snapshots: [
      snapshot("STOPPED"),
      snapshot("STOPPED"),
      snapshot("STOPPED"),
      snapshot("STOPPED"),
      snapshot("STOPPED"),
      snapshot("STOPPED"),
      snapshot("STOPPED"),
      snapshot("STOPPED")
    ],
    actionResults: { restart: restartFailure }
  });

  const failed = await h.reconcile(true, snapshot("STOPPED"));
  assert.deepEqual(h.actions, ["start", "restart"]);
  assert.equal(failed.transitionPending, false);
  assert.match(failed.error, /restart failed/);
  assert.equal(h.events.filter(item => item.event === "wpp_recovery_failed").length, 1);

  const cooledDown = await h.reconcile(true, snapshot("STOPPED"));
  assert.deepEqual(h.actions, ["start", "restart"]);
  assert.equal(cooledDown.changed, false);
  assert.equal(cooledDown.cooldownUntil, failed.cooldownUntil);
  assert.equal(h.events.filter(item => item.event === "wpp_recovery_cooldown").length, 1);

  h.advance(WPP_RECOVERY_COOLDOWN_MS);
  const laterRetry = await h.reconcile(true, snapshot("STOPPED"));
  assert.match(laterRetry.error, /restart failed/);
  assert.deepEqual(h.actions, ["start", "restart", "start", "restart"]);
  assert.equal(h.events.filter(item => item.event === "wpp_recovery_failed").length, 2);
});

test("runtime recovery stays separate from the delivery queue", async () => {
  const [runtime, worker] = await Promise.all([
    read("workers/liveticker-whatsapp/wpp-runtime.mjs"),
    read("workers/liveticker-whatsapp/worker.mjs")
  ]);
  assert.doesNotMatch(runtime, /delivery\.mjs|claimJob|processJob|sendStickerToWaha|sendTextToWaha/);
  const refresh = worker.match(/async function refreshRuntimeControl[\s\S]*?\n\}/)?.[0] || "";
  assert.doesNotMatch(refresh, /claimJob|processJob|sendStickerToWaha|sendTextToWaha/);
  assert.match(worker, /if \(ready\) await drainQueue\(reason\)/);
});
