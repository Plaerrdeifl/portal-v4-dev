import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function read(path) {
  return readFile(resolve(root, path), "utf8");
}

test("static builds require an explicit environment", async () => {
  const build = await read("scripts/build-static.mjs");

  assert.match(build, /PORTAL_ENVIRONMENT/);
  assert.match(build, /new Set\(\["LOCAL", "DEV", "PROD"\]\)/);
  assert.match(
    build,
    /PORTAL_ENVIRONMENT muss ausdrücklich LOCAL, DEV oder PROD sein/
  );

  assert.doesNotMatch(
    build,
    /"--environment",\s*"DEV"/
  );
});

test("DEV and PROD require an exact Supabase project binding", async () => {
  const build = await read("scripts/build-static.mjs");

  assert.match(build, /SUPABASE_EXPECTED_PROJECT_REF/);
  assert.match(build, /const expectedHost = `\$\{projectRef\}\.supabase\.co`/);
  assert.match(build, /parsedUrl\.hostname !== expectedHost/);
  assert.match(
    build,
    /Für DEV und PROD sind SUPABASE_URL und SUPABASE_PUBLISHABLE_KEY erforderlich/
  );
});

test("remote builds cannot inherit a local runtime configuration", async () => {
  const build = await read("scripts/build-static.mjs");

  assert.match(build, /await rm\(runtimeOutput, \{ force: true \}\)/);
  assert.match(build, /if \(environment === "LOCAL"\)/);
  assert.match(build, /await cp\(localRuntime, runtimeOutput\)/);
});

test("DEV deployment declares and verifies the DEV environment", async () => {
  const workflow = await read(
    ".github/workflows/deploy-v4-dev-pages.yml"
  );

  assert.match(workflow, /PORTAL_ENVIRONMENT: DEV/);
  assert.match(
    workflow,
    /SUPABASE_EXPECTED_PROJECT_REF: \$\{\{ vars\.SUPABASE_PROJECT_REF \}\}/
  );
  assert.match(
    workflow,
    /grep -q '"environment": "DEV"' dist\/js\/runtime-config\.js/
  );
});
test("PROD cannot use the checked DEV Supabase project", async () => {
  const build = await read("scripts/build-static.mjs");

  assert.match(
    build,
    /const devProjectRef = "tpieykhhawszlzsoflnl"/
  );

  assert.match(
    build,
    /DEV muss an das festgelegte Supabase-DEV-Projekt gebunden sein/
  );

  assert.match(
    build,
    /PROD darf nicht mit dem Supabase-DEV-Projekt gebaut werden/
  );
});
test("pull requests run read-only tests and an exact DEV build", async () => {
  const workflow = await read(
    ".github/workflows/validate-pull-request.yml"
  );

  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /branches:\s*\n\s+- main/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /pages: write/);
  assert.doesNotMatch(workflow, /id-token: write/);

  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /PORTAL_ENVIRONMENT: DEV/);

  assert.match(
    workflow,
    /SUPABASE_EXPECTED_PROJECT_REF: \$\{\{ vars\.SUPABASE_PROJECT_REF \}\}/
  );

  assert.match(workflow, /run: npm run build/);
  assert.match(
    workflow,
    /tpieykhhawszlzsoflnl\.supabase\.co/
  );
});