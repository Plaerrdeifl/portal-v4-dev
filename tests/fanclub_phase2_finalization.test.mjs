import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

const migrationPath = "supabase/migrations/20260722143000_finalize_fanclub_phase2.sql";

test("phase two finalization safely removes assignments and unused seasons", async () => {
  const migration = await read(migrationPath);

  assert.match(migration, /api_fanclub_snapshot_before_phase2_finalization/);
  assert.match(migration, /'canDelete', not exists/);
  assert.match(migration, /api_remove_member_contribution/);
  assert.match(migration, /MEMBER_CONTRIBUTION_REMOVED/);
  assert.match(migration, /contribution_payment_reports/);
  assert.match(migration, /api_delete_contribution_season/);
  assert.match(migration, /CONTRIBUTION_SEASON_DELETED/);
  assert.match(migration, /remove_member_contribution/);
  assert.match(migration, /delete_contribution_season/);
  assert.match(migration, /require_capability\('finance\.manage'\)/);
  assert.match(migration, /grant execute on function public\.pd_api\(text, jsonb\) to authenticated/);
});

test("fanclub UI hides positions outside edit mode and supports safe cleanup", async () => {
  const [fanclub, css] = await Promise.all([
    read("js/modules/fanclub.js"),
    read("css/app.css")
  ]);

  assert.doesNotMatch(fanclub, /Position \$\{escapeHtml\(item\.position\)\}/);
  assert.doesNotMatch(fanclub, /Position \$\{escapeHtml\(account\.position\)\}/);
  assert.match(
    fanclub,
    /const proposedPosition = contributionClass\.position\s+\|\| nextPosition\(contributionClasses\(\)\)/
  );
  assert.match(fanclub, /<label class="v4-field-four">Sortierung/);
  assert.doesNotMatch(fanclub, /contributionClass\.id \? `<label/);
  assert.match(
    fanclub,
    /account\.id \? `<label class="v4-field-three">Sortierung/
  );
  assert.match(fanclub, /Keine Beitragsklasse/);
  assert.match(fanclub, /call\("remove_member_contribution"/);
  assert.match(fanclub, /call\("delete_contribution_season"/);
  assert.match(fanclub, />Neues Beitragsjahr</);
  assert.match(fanclub, />Beitragsjahr bearbeiten</);
  assert.match(fanclub, />Beitragsjahr löschen</);
  assert.doesNotMatch(fanclub, />Aktuelles Jahr bearbeiten</);

  assert.match(css, /Phase 2 Fanclub-Abschluss/);
  assert.match(css, /\.v4-dialog \.button\{border:1px solid #1f2d3d/);
  assert.match(css, /\.v4-management-grid \.button\{width:100%/);
  assert.match(css, /@media\(max-width:860px\)\{\.v4-management-grid/);
});

test("cache busting identifies fanclub phase two finalization", async () => {
  const [index, config, worker] = await Promise.all([
    read("index.html"),
    read("js/config.js"),
    read("service-worker.js")
  ]);

  assert.match(index, /20260723-ios-standalone-bottom-alignment-final-r1/);
  assert.match(config, /20260723-ios-standalone-bottom-alignment-final-r1/);
  assert.match(worker, /pd-portal-v4-ios-standalone-bottom-alignment-final-r1-20260723/);
});
