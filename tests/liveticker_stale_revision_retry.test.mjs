import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const storagePath = resolve(root, "js/liveticker-game-storage.js");
const bootstrapPath = resolve(root, "js/liveticker-bootstrap.js");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260917203046_liveticker_stale_revision_conflict_hotfix_dev_r1.sql"
);

async function storageHarness(responses) {
  const source = (await readFile(storagePath, "utf8"))
    .replace(/^import .*;\n/gm, "")
    .replace("export async function prepareLivetickerGameStorage", "async function prepareLivetickerGameStorage");
  const calls = [];
  const queued = [];
  const errors = [];
  const storageWrites = [];
  let emittedStateSaved = 0;
  const context = {
    auth: {
      current: () => ({ authenticated: true, status: "ACTIVE" }),
      hasCapability: () => true
    },
    getSupabaseClient: () => ({
      auth: { getSession: async () => ({ data: { session: { access_token: "local-test" } } }) }
    }),
    fetch: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      const response = responses.shift();
      assert.ok(response, `unexpected RPC call ${url}`);
      if (response.wait) await response.wait;
      return {
        ok: response.ok ?? true,
        status: response.status ?? (response.ok === false ? 500 : 200),
        text: async () => JSON.stringify(response.body ?? response)
      };
    },
    window: {
      PD_RUNTIME_CONFIG: {
        environment: "DEV",
        supabaseUrl: "http://127.0.0.1:54321",
        supabasePublishableKey: "local-test"
      },
      dispatchEvent() {}
    },
    document: {
      hidden: false,
      querySelector: () => null,
      addEventListener() {},
      head: { append() {} }
    },
    localStorage: { getItem: () => null },
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    CustomEvent: class CustomEvent {
      constructor(type, init) { this.type = type; this.detail = init?.detail; }
    },
    queueMicrotask: callback => queued.push(callback),
    console: { error: error => errors.push(error), warn() {} },
    setInterval,
    clearInterval,
    Date,
    Intl,
    Math,
    JSON,
    Object,
    Map,
    Set,
    String,
    Number,
    Array,
    Promise
  };
  context.globalThis = context;
  context.localStorage.setItem = (key, value) => {
    const suppressed = context.PD_LIVETICKER_SUPPRESS_STATE_SAVED === true;
    storageWrites.push({ key, value, suppressed });
    if (key === "plaerrdeifl.livetickerPrototype.v3" && !suppressed) emittedStateSaved += 1;
  };
  vm.createContext(context);
  vm.runInContext(`${source}\n;globalThis.__syncTest = {\n` +
    `  syncLocalState,\n` +
    `  applyRemoteState,\n` +
    `  createSyncCircuitBreaker,\n` +
    `  setState(game, state) { config = window.PD_RUNTIME_CONFIG; selectedGame = game; serverState = normalizeState(state); clientState = snapshotClientState(state); },\n` +
    `  pending() { return pendingLocalState; },\n` +
    `  syncing() { return syncing; },\n` +
    `  suppression() { return globalThis.PD_LIVETICKER_SUPPRESS_STATE_SAVED; }\n` +
    `};`, context, { filename: storagePath });
  return {
    hooks: context.__syncTest,
    calls,
    queued,
    errors,
    storageWrites,
    emittedStateSaved: () => emittedStateSaved
  };
}

const game = { eventId: "10000000-0000-4000-8000-000000000001" };
const initial = { eventId: game.eventId, revision: 15, minute: 1, history: [] };
const changed = { minute: 2, history: [] };

test("remote state stays suppressed while a later user change still syncs", async () => {
  const bootstrap = await readFile(bootstrapPath, "utf8");
  const remote = { eventId: game.eventId, revision: 16, minute: 5, history: [] };
  const harness = await storageHarness([
    { eventId: game.eventId, revision: 17, minute: 6, history: [] }
  ]);
  harness.hooks.setState(game, initial);

  harness.hooks.applyRemoteState(remote);

  assert.match(bootstrap, /key !== STORAGE_KEY \|\| globalThis\.PD_LIVETICKER_SUPPRESS_STATE_SAVED === true/);
  assert.equal(harness.storageWrites.length, 1);
  assert.equal(harness.storageWrites[0].suppressed, true);
  assert.equal(harness.emittedStateSaved(), 0);
  assert.equal(harness.hooks.suppression(), undefined);

  await harness.hooks.syncLocalState({ minute: 6, history: [] });

  assert.equal(harness.calls.length, 1);
  assert.match(harness.calls[0].url, /pd_public_liveticker_sync$/);
  assert.equal(harness.calls[0].body.p_changes.minute, 6);
});

test("sync circuit breaker still opens after the bounded save burst", async () => {
  const harness = await storageHarness([]);
  const breaker = harness.hooks.createSyncCircuitBreaker({ windowMs: 5000, maxSaves: 2 });

  assert.equal(breaker.register(1000), false);
  assert.equal(breaker.register(1001), false);
  assert.equal(breaker.register(1002), true);
  assert.equal(breaker.isOpen(), true);
});

test("a failed sync never queues the same local state again", async () => {
  const harness = await storageHarness([{ ok: false, status: 500, body: { code: "XX000", message: "failure" } }]);
  harness.hooks.setState(game, initial);
  await harness.hooks.syncLocalState(changed);

  assert.equal(harness.calls.length, 1);
  assert.equal(harness.queued.length, 0);
  assert.equal(harness.hooks.pending(), null);
  assert.equal(harness.errors.length, 1);
});

test("PT409 refreshes state and performs exactly one controlled retry", async () => {
  const harness = await storageHarness([
    { ok: false, status: 409, body: { code: "PT409", message: "LIVETICKER_STALE_REVISION" } },
    { eventId: game.eventId, revision: 16, minute: 1, history: [] },
    { eventId: game.eventId, revision: 17, minute: 2, history: [] }
  ]);
  harness.hooks.setState(game, initial);
  await harness.hooks.syncLocalState(changed);

  assert.equal(harness.calls.length, 3);
  assert.match(harness.calls[0].url, /pd_public_liveticker_sync$/);
  assert.match(harness.calls[1].url, /pd_public_liveticker_state$/);
  assert.match(harness.calls[2].url, /pd_public_liveticker_sync$/);
  assert.equal(harness.calls[2].body.p_expected_revision, 16);
  assert.equal(harness.queued.length, 0);
});


test("PT409 retry preserves a remote goal that the stale browser has never seen", async () => {
  const remoteGoal = { id: "remote-goal-4", type: "goal", team: "mighty", minute: 31 };
  const localPenalty = { id: "local-penalty", type: "penalty", minute: 32, penalties: [] };
  const harness = await storageHarness([
    { ok: false, status: 409, body: { code: "PT409", message: "LIVETICKER_STALE_REVISION" } },
    { eventId: game.eventId, revision: 16, minute: 31, history: [remoteGoal] },
    { eventId: game.eventId, revision: 17, minute: 32, history: [remoteGoal, localPenalty] }
  ]);
  harness.hooks.setState(game, initial);

  await harness.hooks.syncLocalState({ minute: 32, history: [localPenalty] });

  assert.equal(harness.calls.length, 3);
  const retry = harness.calls[2].body.p_changes;
  assert.deepEqual(retry.deletes, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(retry.upserts)), [localPenalty]);
});

test("PT409 retry keeps an explicit local delete but never deletes a newly arrived remote action", async () => {
  const existingGoal = { id: "existing-goal", type: "goal", team: "mighty", minute: 10 };
  const remoteGoal = { id: "remote-goal-4", type: "goal", team: "mighty", minute: 31 };
  const base = { eventId: game.eventId, revision: 15, minute: 30, history: [existingGoal] };
  const harness = await storageHarness([
    { ok: false, status: 409, body: { code: "PT409", message: "LIVETICKER_STALE_REVISION" } },
    { eventId: game.eventId, revision: 16, minute: 31, history: [existingGoal, remoteGoal] },
    { eventId: game.eventId, revision: 17, minute: 31, history: [remoteGoal] }
  ]);
  harness.hooks.setState(game, base);

  await harness.hooks.syncLocalState({ minute: 30, history: [] });

  const retry = harness.calls[2].body.p_changes;
  assert.deepEqual(JSON.parse(JSON.stringify(retry.deletes)), ["existing-goal"]);
  assert.equal(retry.deletes.includes("remote-goal-4"), false);
});

test("a later save from the same stale browser still cannot delete remote actions merged by the server", async () => {
  const remoteGoal = { id: "remote-goal-4", type: "goal", team: "mighty", minute: 31 };
  const firstLocal = { id: "local-penalty-1", type: "penalty", minute: 32, penalties: [] };
  const secondLocal = { id: "local-penalty-2", type: "penalty", minute: 33, penalties: [] };
  const harness = await storageHarness([
    { ok: false, status: 409, body: { code: "PT409", message: "LIVETICKER_STALE_REVISION" } },
    { eventId: game.eventId, revision: 16, minute: 31, history: [remoteGoal] },
    { eventId: game.eventId, revision: 17, minute: 32, history: [remoteGoal, firstLocal] },
    { eventId: game.eventId, revision: 18, minute: 33, history: [remoteGoal, firstLocal, secondLocal] }
  ]);
  harness.hooks.setState(game, initial);

  await harness.hooks.syncLocalState({ minute: 32, history: [firstLocal] });
  await harness.hooks.syncLocalState({ minute: 33, history: [remoteGoal, firstLocal, secondLocal] });

  assert.equal(harness.calls.length, 4);
  const secondSave = harness.calls[3].body.p_changes;
  assert.deepEqual(secondSave.deletes, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(secondSave.upserts)), [secondLocal]);
});

test("a second PT409 stops without a third sync attempt", async () => {
  const harness = await storageHarness([
    { ok: false, status: 409, body: { code: "PT409", message: "LIVETICKER_STALE_REVISION" } },
    { eventId: game.eventId, revision: 16, minute: 1, history: [] },
    { ok: false, status: 409, body: { code: "PT409", message: "LIVETICKER_STALE_REVISION" } }
  ]);
  harness.hooks.setState(game, initial);
  await harness.hooks.syncLocalState(changed);

  assert.equal(harness.calls.length, 3);
  assert.equal(harness.queued.length, 0);
  assert.equal(harness.errors.length, 1);
});

test("a real 40001 is not mistaken for the Liveticker business conflict", async () => {
  const harness = await storageHarness([
    { ok: false, status: 500, body: { code: "40001", message: "could not serialize access" } }
  ]);
  harness.hooks.setState(game, initial);
  await harness.hooks.syncLocalState(changed);

  assert.equal(harness.calls.length, 1);
  assert.equal(harness.queued.length, 0);
});

test("a new user change arriving during sync is still queued and saved", async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const harness = await storageHarness([
    { wait, body: { eventId: game.eventId, revision: 16, minute: 2, history: [] } },
    { eventId: game.eventId, revision: 17, minute: 3, history: [] }
  ]);
  harness.hooks.setState(game, initial);

  const first = harness.hooks.syncLocalState({ minute: 2, history: [] });
  await Promise.resolve();
  await harness.hooks.syncLocalState({ minute: 3, history: [] });
  assert.equal(harness.hooks.pending().minute, 3);
  release();
  await first;
  assert.equal(harness.queued.length, 1);
  await harness.queued.shift()();

  assert.equal(harness.calls.length, 2);
  assert.equal(harness.calls[1].body.p_expected_revision, 16);
  assert.equal(harness.calls[1].body.p_changes.minute, 3);
});

test("the migration maps only Liveticker stale revisions to PT409", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /rename to pd_public_liveticker_sync_before_stale_revision_pt409_dev_r1/i);
  assert.match(sql, /rename to pd_public_liveticker_complete_before_stale_revision_pt409_r1/i);
  assert.equal((sql.match(/if v_message = 'LIVETICKER_STALE_REVISION'/g) || []).length, 2);
  assert.equal((sql.match(/raise sqlstate 'PT409'/g) || []).length, 2);
  assert.equal((sql.match(/when sqlstate '40001'/g) || []).length, 2);
  assert.equal((sql.match(/\n\s*raise;\n/g) || []).length, 2);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
  assert.match(sql, /grant execute on function public\.pd_public_liveticker_complete\(uuid, integer, text\)\s+to authenticated/i);
  assert.doesNotMatch(sql, /create table|alter table|insert into|update\s+app_modules|delete from/i);
});
