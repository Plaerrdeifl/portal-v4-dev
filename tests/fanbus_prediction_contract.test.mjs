import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const migrationPath = "supabase/migrations/20260923042930_add_fanbus_prediction_game.sql";
const [migration, indexMigration, moduleSource, pageRouter, busOrga, css, sqlTest, concurrency] = await Promise.all([
  fs.readFile(path.join(root, migrationPath), "utf8"),
  fs.readFile(path.join(root, "supabase/migrations/20260923051216_index_fanbus_prediction_foreign_keys.sql"), "utf8"),
  fs.readFile(path.join(root, "js/modules/bus-orga-prediction.js"), "utf8"),
  fs.readFile(path.join(root, "js/pages.js"), "utf8"),
  fs.readFile(path.join(root, "js/modules/bus-orga-v2.js"), "utf8"),
  fs.readFile(path.join(root, "css/app.css"), "utf8"),
  fs.readFile(path.join(root, "supabase/tests/fanbus_prediction_game.sql"), "utf8"),
  fs.readFile(path.join(root, "tests/run-fanbus-prediction-concurrency.sh"), "utf8")
]);

test("prediction data is granular, snapshotted and default-deny", () => {
  for (const table of ["fanbus_prediction_games", "fanbus_prediction_participants", "fanbus_prediction_tips"]) {
    assert.match(migration, new RegExp(`create table app_modules\\.${table}`));
    assert.match(migration, new RegExp(`alter table app_modules\\.${table} enable row level security`));
  }
  assert.match(migration, /bus_id_snapshot uuid/);
  assert.match(migration, /bus_label_snapshot text/);
  assert.match(migration, /unique \(participant_id, dogs_goals, opponent_goals\)/);
  assert.match(migration, /tip_number between 1 and 3/);
  assert.match(migration, /revoke all on table[\s\S]*from public, anon, authenticated, service_role/);
  assert.doesNotMatch(migration, /grant\s+(select|insert|update|delete|all)\s+on\s+(table\s+)?app_modules/i);
  assert.match(indexMigration, /fanbus_prediction_participants_registration_lookup_idx/);
});

test("same-person updates use explicit optimistic concurrency", () => {
  assert.match(migration, /for update;[\s\S]*v_expected_revision[\s\S]*v_participant\.revision/);
  assert.match(migration, /using errcode = 'PT409'/);
  assert.match(migration, /for share;[\s\S]*v_game\.status <> 'OPEN'/);
  assert.match(concurrency, /expectedRevision',2/);
  assert.match(concurrency, /FANBUS_PREDICTION_CONCURRENCY_PASS/);
});

test("all browser actions stay behind pd_api and are classified", () => {
  for (const action of [
    "fanbus_prediction_options", "fanbus_prediction_games_list", "fanbus_prediction_game_create",
    "fanbus_prediction_game_detail", "fanbus_prediction_participants_search", "fanbus_prediction_entry_save",
    "fanbus_prediction_status_set", "fanbus_prediction_result_set", "fanbus_prediction_evaluation"
  ]) {
    assert.match(migration, new RegExp(`when '${action}'`));
  }
  assert.match(sqlTest, /public\.pd_api\('fanbus_prediction_games_list'/);
  assert.match(sqlTest, /User without Bus-Orga access is denied/);
});

test("mobile flow exposes search, numeric score inputs and direct next-person focus", () => {
  assert.match(moduleSource, /Teilnehmer suchen/);
  assert.match(moduleSource, /inputmode=\"numeric\"/);
  assert.match(moduleSource, /Tipp 1 ist erforderlich/);
  assert.match(moduleSource, /Dieser Tipp ist bereits vorhanden/);
  assert.match(moduleSource, /search\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(moduleSource, /submit\.disabled = true/);
  assert.match(moduleSource, /clearPredictionToasts/);
  assert.match(moduleSource, /"Tipps gespeichert\."\s*,\s*1800/);
  assert.match(moduleSource, /item\.registrationId === form\.elements\.registrationId\.value/);
  assert.match(moduleSource, /entry: button\.dataset\.predictionEntry/);
  assert.doesNotMatch(moduleSource, /window\.alert|alert\(/);
  assert.match(css, /\.pd-prediction-person-row[\s\S]*min-height:58px/);
  assert.match(css, /\.pd-prediction-tip-row input[\s\S]*height:46px/);
  assert.match(css, /\.pd-prediction-page \.button\.small \{ min-height:44px; \}/);
  assert.match(css, /@media \(max-width:360px\)/);
  assert.doesNotMatch(css, /\.pd-prediction-bus-tabs\s*\{[^}]*overflow-x:auto/);
});

test("Bus-Orga navigation and route load the prediction workspace", () => {
  assert.match(busOrga, /id: \"prediction\", title: \"Tippspiel\"/);
  assert.match(busOrga, /#\/bus-orga\?view=prediction/);
  assert.match(pageRouter, /view === \"prediction\"/);
  assert.match(pageRouter, /bus-orga-prediction\.js/);
});

test("acceptance SQL covers trip, manual, tips, snapshots, status, result and bus evaluation", () => {
  for (const marker of [
    "One tip can be saved", "A second tip can be added", "A third tip can be added",
    "More than three tips are rejected", "Duplicate tips", "stale same-person save",
    "snapshotted", "Closed game blocks", "can be reopened", "winner", "grouped by snapshotted buses",
    "Manual evaluation contains no bus evaluation", "Liveticker result"
  ]) assert.match(sqlTest, new RegExp(marker, "i"));
});
