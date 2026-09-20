import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("client sends exact delete guards and keeps its sync baseline equal to server results", async () => {
  const storage = await read("js/liveticker-game-storage.js");
  assert.match(storage, /deleteGuards\.push\(\{ id, expected: cleanSyncAction\(item\) \}\)/);
  assert.match(storage, /changes\.deleteGuards = deleteGuards/);
  assert.match(storage, /changes\.deleteGuards = deletes\.map\(id => guardMap\.get\(id\)\)/);
  assert.match(storage, /clientState = snapshotClientState\(normalizeState\(result\)\)/);
  assert.match(storage, /clientState = snapshotClientState\(normalizeState\(fresh\)\)/);
  assert.match(storage, /delete clean\._whatsapp/);
});

test("server rejects unguarded or mismatched deletes before the legacy sync function can run", async () => {
  const migration = await read("supabase/migrations/20260918195910_liveticker_delete_guard_dev_r1.sql");
  assert.match(migration, /LIVETICKER_DELETE_GUARD_REQUIRED/);
  assert.match(migration, /LIVETICKER_DELETE_GUARD_MISMATCH/);
  assert.match(migration, /errcode = 'PT409'/);
  assert.match(migration, /action\.payload/);
  assert.match(migration, /action\.client_action_id = v_id/);
  assert.match(migration, /v_current is distinct from \(v_guard -> 'expected'\)/);
  assert.match(migration, /v_changes := p_changes - 'deleteGuards'/);
  assert.match(migration, /return public\.pd_public_liveticker_sync_before_delete_guard_dev_r1\(/);
});

test("delete guard rollout marker reaches the current liveticker storage chain", async () => {
  const [html, auth, bootstrap] = await Promise.all([
    read("liveticker/index.html"),
    read("js/liveticker-auth-bootstrap.js"),
    read("js/liveticker-bootstrap.js")
  ]);
  assert.match(html, /liveticker-auth-bootstrap\.js\?v=20260920-archive-finalization-r1/);
  assert.match(auth, /liveticker-bootstrap\.js\?v=20260920-archive-finalization-r1/);
  assert.match(bootstrap, /liveticker-game-storage\.js\?v=20260920-archive-finalization-r1/);
});

test("fresh server state is pushed into the running engine instead of only localStorage", async () => {
  const [storage, engine] = await Promise.all([
    read("js/liveticker-game-storage.js"),
    read("js/liveticker-engine-v4.js")
  ]);
  assert.match(storage, /pd-liveticker-remote-state/);
  assert.match(storage, /detail: \{ minute: next\.minute, history: next\.history \}/);
  assert.match(engine, /window\.addEventListener\("pd-liveticker-remote-state"/);
  assert.match(engine, /state = normalized/);
  assert.match(engine, /syncScore\(\)/);
  assert.match(engine, /renderHistory\(\)/);
});
