import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const migrationsDir = join(root, "supabase", "migrations");

test("PROD R2 D-046 enables only RLS on fanbus_m325_idempotency", async () => {
  const names = (await readdir(migrationsDir))
    .filter(name => name.endsWith("_harden_fanbus_m325_idempotency_rls.sql"));

  assert.equal(names.length, 1);

  const source = await readFile(join(migrationsDir, names[0]), "utf8");

  const executable = source
    .split("\n")
    .map(line => line.replace(/--.*$/, ""))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  assert.equal(
    executable,
    "alter table app_private.fanbus_m325_idempotency enable row level security;"
  );

  assert.doesNotMatch(executable, /force row level security/);
  assert.doesNotMatch(executable, /create\s+policy/);
  assert.doesNotMatch(executable, /\bgrant\b/);
  assert.doesNotMatch(executable, /\brevoke\b/);
  assert.doesNotMatch(executable, /\binsert\s+into\b/);
  assert.doesNotMatch(executable, /\bupdate\b/);
  assert.doesNotMatch(executable, /\bdelete\s+from\b/);
});
