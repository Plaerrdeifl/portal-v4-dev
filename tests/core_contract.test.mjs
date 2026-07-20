import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("V4 entry point uses Supabase and no active Apps Script bridge", async () => {
  const html = await read("index.html");
  assert.match(html, /@supabase\/supabase-js@2/);
  assert.match(html, /js\/runtime-config\.js/);
  assert.match(html, /type="module" src="\.\/js\/app\.js/);
  assert.doesNotMatch(html, /<script[^>]+google-identity\.js/i);
  assert.doesNotMatch(html, /<script[^>]+m4-corr/i);
  assert.doesNotMatch(html, /script\.google\.com\/macros/i);
});

test("runtime configuration is generated and ignored", async () => {
  const ignore = await read(".gitignore");
  const example = await read("js/runtime-config.example.js");
  const generator = await read("scripts/write-runtime-config.mjs");
  assert.match(ignore, /^\/js\/runtime-config\.js$/m);
  assert.match(example, /supabasePublishableKey/);
  assert.match(generator, /SUPABASE_PUBLISHABLE_KEY/);
  assert.doesNotMatch(generator, /service[_-]?role/i);
});

test("database migrations are ordered and contain the core contract", async () => {
  const names = (await readdir(join(root, "supabase", "migrations")))
    .filter(name => name.endsWith(".sql"))
    .sort();
  assert.deepEqual(names, [
    "20260717182508_bootstrap_private_schema.sql",
    "20260719225500_create_application_schemas.sql",
    "20260719230000_create_portal_core_tables.sql",
    "20260719230100_seed_portal_core_authorization.sql",
    "20260719230200_create_portal_core_api.sql",
    "20260720152000_add_member_email_match_suggestion.sql"
  ]);

  const tables = await read(`supabase/migrations/${names[2]}`);
  const seed = await read(`supabase/migrations/${names[3]}`);
  const api = await read(`supabase/migrations/${names[4]}`);
  for (const schema of ["app_portal", "app_fanclub", "app_modules", "app_private"]) {
    assert.match(tables + api, new RegExp(schema.replace("_", "_")));
  }
  assert.match(tables, /enable row level security/g);
  assert.match(seed, /VORSTAND_1/);
  assert.match(seed, /SCHRIFTFUEHRER/);
  assert.match(seed, /PORTAL_USER/);
  assert.match(api, /create or replace function public\.pd_api/);
  assert.match(api, /grant execute on function public\.pd_api\(text, jsonb\) to authenticated/);
  assert.match(api, /grant execute on function public\.pd_create_bootstrap_token[\s\S]+to service_role/);
  assert.doesNotMatch(api, /grant\s+(?:all|select|insert|update|delete)[\s\S]+to\s+anon/i);
});

test("dynamic roles and fixed offices are documented as V4 decisions", async () => {
  const roles = await read("docs/CHANGE_DECISIONS/AE-V4-01_DYNAMIC_PORTAL_ROLES.md");
  const offices = await read("docs/CHANGE_DECISIONS/AE-V4-02_FIXED_OFFICES.md");
  assert.match(roles, /Rollen anlegen/);
  assert.match(roles, /letzten[\s\S]{0,80}administrativ/i);
  assert.match(offices, /dauerhaft genau fünf/i);
  assert.match(offices, /KASSIER/);
});

test("frontend modules use the single Supabase RPC boundary", async () => {
  const api = await read("js/api.js");
  assert.match(api, /client\.rpc\("pd_api"/);
  for (const file of ["admin", "dashboard", "fanclub", "profile", "tasks", "teams"]) {
    const source = await read(`js/modules/${file}.js`);
    assert.doesNotMatch(source, /script\.google\.com|google\.script\.run|pwaBridge/i);
  }
});

test("package is ESM-ready and pinned to the agreed toolchain", async () => {
  const pkg = JSON.parse(await read("package.json"));
  assert.equal(pkg.type, "module");
  assert.equal(pkg.devDependencies.supabase, "2.109.1");
  assert.equal(pkg.engines.node, ">=24.18.0 <25");
  assert.equal(pkg.packageManager, "npm@12.0.1");
});


test("route click handling ignores the html route marker", async () => {
  const ui = await read("js/ui.js");
  assert.match(
    ui,
    /closest\("button\[data-route\], a\[data-route\]"\)/
  );
  assert.doesNotMatch(ui, /closest\("\[data-route\]"\)/);
});


test("member email match migration is safe and confirmable", async () => {
  const migration = await read(
    "supabase/migrations/20260720152000_add_member_email_match_suggestion.sql"
  );
  const admin = await read("js/modules/admin.js");

  assert.ok(
    migration.includes(
      "create or replace function app_private.api_member_match"
    )
  );
  assert.ok(
    migration.includes("require_capability('users.manage')")
  );
  assert.ok(
    migration.includes("when 'member_match'")
  );
  assert.ok(
    migration.includes("lower(btrim(coalesce(member.email")
  );
  assert.ok(
    migration.includes("user_member_links")
  );

  assert.ok(
    admin.includes('call("member_match"')
  );
  assert.ok(
    admin.includes("Mitglied automatisch erkannt")
  );
  assert.ok(
    admin.includes("Bitte prüfen und bestätigen")
  );
  assert.ok(
    admin.includes("AMBIGUOUS")
  );
});
