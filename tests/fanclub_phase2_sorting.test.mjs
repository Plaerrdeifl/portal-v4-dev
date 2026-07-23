import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

const migrationPath = "supabase/migrations/20260722113000_add_fanclub_sort_positions.sql";

test("phase two persists deterministic positions for contribution classes and finance accounts", async () => {
  const migration = await read(migrationPath);

  assert.match(migration, /alter table app_fanclub\.contribution_classes\s+add column sort_position integer/);
  assert.match(migration, /alter table app_fanclub\.finance_accounts\s+add column sort_position integer/);
  assert.match(migration, /contribution_classes_sort_position_check/);
  assert.match(migration, /finance_accounts_sort_position_check/);
  assert.match(migration, /api_fanclub_snapshot_before_phase2_sorting/);
  assert.match(migration, /jsonb_array_elements/);
  assert.match(migration, /'position', contribution_class\.sort_position/);
  assert.match(migration, /'canDelete', not exists/);
  assert.match(migration, /'position', account\.sort_position/);
  assert.match(migration, /order by\s+contribution_class\.sort_position/);
  assert.match(migration, /order by\s+account\.sort_position/);
  assert.match(migration, /create or replace function app_private\.api_save_contribution_class/);
  assert.match(migration, /create or replace function app_private\.api_save_finance_account/);
  assert.match(migration, /sort_position = v_position/);
  assert.match(migration, /'position', v_position/);
  assert.match(migration, /api_delete_contribution_class/);
  assert.match(migration, /CONTRIBUTION_CLASS_DELETED/);
  assert.match(migration, /delete_contribution_class/);
  assert.match(migration, /wird bereits verwendet und kann nur deaktiviert werden/);
  assert.match(migration, /grant execute on function public\.pd_api\(text, jsonb\) to authenticated/);
});

test("fanclub frontend uses server positions and keeps the approved compact interaction model", async () => {
  const [fanclub, standard] = await Promise.all([
    read("js/modules/fanclub.js"),
    read("docs/UX_INTERACTION_STANDARD.md")
  ]);

  assert.match(fanclub, /function orderedByPosition/);
  assert.match(fanclub, /function nextPosition/);
  assert.equal((fanclub.match(/name="position"/g) || []).length, 2);
  assert.match(fanclub, /min="1" max="9999" step="1"/);
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

  assert.match(fanclub, /memberSearchInput/);
  assert.match(fanclub, /showInactiveMembers/);
  assert.match(fanclub, /manageBoardButton/);
  assert.match(fanclub, /v4-contribution-status/);
  assert.match(fanclub, /financeEntrySearch/);
  assert.match(fanclub, /showMoreFinanceEntries/);

  assert.match(standard, /## 11\. Verwaltbare Reihenfolge/);
  assert.match(standard, /Abstände in Zehnerschritten/);
  assert.match(standard, /serverseitig gespeichert/);
  assert.match(standard, /Löschen unbenutzter Stammdaten/);
  assert.match(standard, /nur deaktiviert werden/);
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
