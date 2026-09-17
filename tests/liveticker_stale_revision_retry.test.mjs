import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const storagePath = resolve(root, "js/liveticker-game-storage.js");
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
    localStorage: {
      getItem: () => null,
      setItem() {}
    },
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
  vm.createContext(context);
  vm.runInContext(`${source}\n;globalThis.__syncTest = {\n` +
    `  syncLocalState,\n` +
    `  setState(game, state) { config = window.PD_RUNTIME_CONFIG; selectedGame = game; serverState = normalizeState(state); },\n` +
    `  pending() { return pendingLocalState; },\n` +
    `  syncing() { return syncing; }\n` +
    `};`, context, { filename: storagePath });
  return { hooks: context.__syncTest, calls, queued, errors };
}

const game = { eventId: "10000000-0000-4000-8000-000000000001" };
const initial = { eventId: game.eventId, revision: 15, minute: 1, history: [] };
const changed = { minute: 2, history: [] };

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
