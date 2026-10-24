import assert from "node:assert/strict";
import test from "node:test";
import { inspectMigration, maskNonSql } from "../scripts/check-public-table-access.mjs";

const publicRead = [
  "create table public.sample (id bigint primary key);",
  "alter table public.sample enable row level security;",
  "grant select on public.sample to authenticated;"
].join("\n");

const privateTable = [
  "create table public.internal_data (id bigint primary key);",
  "alter table public.internal_data enable row level security;",
  "revoke all on public.internal_data from anon, authenticated, service_role;"
].join("\n");

test("public table with explicit minimal GRANT and RLS passes", () => {
  assert.deepEqual(inspectMigration(publicRead), []);
});

test("private table with explicit REVOKE and RLS passes", () => {
  assert.deepEqual(inspectMigration(privateTable), []);
});

test("missing grants and revokes require an explicit access decision", () => {
  assert.match(inspectMigration(publicRead.replace(/grant select[^;]+;/, "")).join("\n"), /explicit access decision/);
});

test("grants do not compensate for missing RLS", () => {
  assert.match(inspectMigration(publicRead.replace(/alter table[^;]+;/, "")).join("\n"), /ENABLE ROW LEVEL SECURITY/);
});

test("unqualified tables fail because their schema is ambiguous", () => {
  assert.match(inspectMigration("create table sample (id int);").join("\n"), /unqualified CREATE TABLE/);
});

test("private-schema tables do not need public grants", () => {
  assert.deepEqual(inspectMigration("create table app_modules.sample (id int);"), []);
});

test("GRANT ALL and GRANT to PUBLIC are rejected", () => {
  assert.match(inspectMigration(publicRead.replace("grant select", "grant all")).join("\n"), /GRANT ALL/);
  assert.match(inspectMigration(publicRead.replace("to authenticated", "to public, authenticated")).join("\n"), /PUBLIC role/);
});

test("legacy default grants and broad grants are rejected", () => {
  assert.match(inspectMigration("alter default privileges for role postgres in schema public grant all on tables to authenticated;").join("\n"), /no automatic GRANT/);
  assert.match(inspectMigration("grant select on all tables in schema public to anon;").join("\n"), /blanket GRANT/);
});

test("comments, single-quoted strings and dollar-quoted function bodies do not trigger", () => {
  const source = [
    "-- create table public.hidden (id int);",
    "/* create table public.blocked(id int); /* nested comment */ */",
    "select 'create table public.string (id int)';",
    "create function public.check_me() returns void language plpgsql as $body$",
    "begin",
    "raise notice 'create table public.body (id int)';",
    "end;",
    "$body$;"
  ].join("\n");
  assert.deepEqual(inspectMigration(source), []);
  assert.doesNotMatch(maskNonSql(source), /public\.hidden|public\.body|public\.string/);
});

test("quoted public identifiers are handled", () => {
  assert.deepEqual(inspectMigration([
    'create table "public"."Sample" (id int);',
    'alter table "public"."Sample" enable row level security;',
    'grant select on "public"."Sample" to authenticated;'
  ].join("\n")), []);
});

test("IF NOT EXISTS is allowed", () => {
  assert.deepEqual(inspectMigration(publicRead.replace("create table", "create table if not exists")), []);
});
