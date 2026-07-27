import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = join(root, "supabase", "migrations");

const migrationFiles = readdirSync(migrationDirectory)
  .filter((name) =>
    name.endsWith(
      "_harden_private_function_privileges_and_push_runtime.sql",
    ),
  );

test("exactly one environment-neutral push hardening migration exists", () => {
  assert.equal(migrationFiles.length, 1);
});

test("private functions are closed for browser roles", () => {
  const migration = readFileSync(
    join(migrationDirectory, migrationFiles[0]),
    "utf8",
  );

  assert.match(
    migration,
    /revoke all on all functions in schema app_private[\s\S]*from public, anon, authenticated;/i,
  );

  assert.match(
    migration,
    /alter default privileges in schema app_private[\s\S]*revoke execute on functions[\s\S]*from public, anon, authenticated;/i,
  );
});

test("push dispatch uses environment runtime configuration", () => {
  const migration = readFileSync(
    join(migrationDirectory, migrationFiles[0]),
    "utf8",
  );

  assert.match(migration, /'functionUrl'/);
  assert.match(migration, /'enabled', false/);
  assert.match(migration, /create or replace function app_private\.invoke_push_dispatch/);

  assert.doesNotMatch(
    migration,
    /tpieykhhawszlzsoflnl/i,
  );

  assert.doesNotMatch(
    migration,
    /wplescvhlgctynkfwvrj/i,
  );
});

test("public pd_api remains the only browser RPC entry", () => {
  const migration = readFileSync(
    join(migrationDirectory, migrationFiles[0]),
    "utf8",
  );

  assert.match(
    migration,
    /grant execute on function public\.pd_api\(text, jsonb\)[\s\S]*to anon, authenticated;/i,
  );
});