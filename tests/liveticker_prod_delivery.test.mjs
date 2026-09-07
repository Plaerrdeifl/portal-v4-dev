import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("PROD static build publishes the standalone Liveticker route", async () => {
  const build = await read("scripts/build-static.mjs");
  assert.match(build, /"liveticker"/);
});

test("standalone Liveticker stays hidden until active authorized login", async () => {
  const html = await read("liveticker/index.html");
  const gate = await read("js/liveticker-auth-bootstrap.js");

  assert.match(html, /<main id="tickerApp" class="shell" hidden>/);
  assert.match(html, /liveticker-auth-bootstrap\.js/);
  assert.match(gate, /await auth\.initialize\(\)/);
  assert.match(gate, /!state\?\.authenticated/);
  assert.match(gate, /state\.status !== "ACTIVE"/);
  assert.match(gate, /!auth\.hasCapability\("liveticker\.manage"\)/);
  assert.match(gate, /window\.location\.replace\("\.\.\/#\/login"\)/);
  assert.match(gate, /app\.hidden = false/);
  assert.match(gate, /await import\("\.\/liveticker-bootstrap\.js/);
});

test("calendar adapter accepts the current compact engine and injects calendar rosters", async () => {
  const adapter = await read("js/liveticker-bootstrap.js");
  const engine = await read("js/liveticker-engine-v4.js");

  const opponentSection = /export const OPPONENTS\s*=\s*Object\.freeze\(\{[\s\S]*?\}\);\s*(?=export const PENALTY_REASONS)/;
  const defaultStateSection = /function defaultState\(\)\s*\{[\s\S]*?\}\s*(?=function normalizeLoadedState)/;
  const rosterSection = /function rosterForTeam\(team,[^)]*\)\s*\{[\s\S]*?\}\s*(?=function fillPlayerSelect)/;

  assert.match(engine, opponentSection);
  assert.match(engine, defaultStateSection);
  assert.match(engine, rosterSection);
  assert.match(adapter, /replaceEngineSection/);
  assert.match(adapter, /PD_LIVETICKER_GAME_CONTEXT\?\.ownTeam\?\.players/);
  assert.match(adapter, /runtimeOpponentTeam\.players/);
  assert.doesNotMatch(adapter, /const opponentBlock = `export const OPPONENTS/);
});


test("PROD output templates stay authenticated and capability-gated", async () => {
  const migration = await read("supabase/migrations/20260906115000_liveticker_output_templates_prod_r1.sql");
  const storage = await read("js/liveticker-game-storage.js");
  const admin = await read("js/modules/liveticker-admin.js");

  assert.match(migration, /create function public\.pd_public_liveticker_templates\(\)/);
  assert.match(migration, /perform app_private\.liveticker_require_operator\(\)/);
  assert.match(migration, /revoke all on function public\.pd_public_liveticker_templates\(\) from public,anon,authenticated/);
  assert.match(migration, /grant execute on function public\.pd_public_liveticker_templates\(\) to authenticated/);
  assert.doesNotMatch(migration, /grant execute on function public\.pd_public_liveticker_templates\(\) to anon/);
  assert.match(storage, /Authorization: `Bearer \$\{token\}`/);
  assert.match(storage, /auth\.hasCapability\("liveticker\.manage"\)/);
  assert.match(admin, /call\("liveticker_output_templates_list"\)/);
  assert.match(admin, /call\("liveticker_output_template_save"/);
});

test("PROD editor ships the frozen four output contexts", async () => {
  const admin = await read("js/modules/liveticker-admin.js");
  const templates = await read("js/liveticker-output-templates.js");
  assert.match(admin, /Tore – Wir/);
  assert.match(admin, /Strafen – Wir/);
  assert.match(admin, /Tore – Die anderen/);
  assert.match(admin, /Strafen – Die anderen/);
  assert.match(templates, /ownPenaltyTemplate/);
  assert.match(templates, /opponentPenaltyTemplate/);
});


test("PROD Liveticker hotfix keeps option titles independent per output context", async () => {
  const migration = await read("supabase/migrations/20260906163500_liveticker_context_titles_prod_hotfix.sql");
  const templates = await read("js/liveticker-output-templates.js");
  const admin = await read("js/modules/liveticker-admin.js");
  const engine = await read("js/liveticker-engine-v4.js");

  assert.match(migration, /add column own_goal_title text/);
  assert.match(migration, /add column own_penalty_title text/);
  assert.match(migration, /add column opponent_goal_title text/);
  assert.match(migration, /add column opponent_penalty_title text/);
  assert.match(migration, /set own_goal_title = title,[\s\S]*own_penalty_title = title,[\s\S]*opponent_goal_title = title,[\s\S]*opponent_penalty_title = title/);
  assert.match(migration, /when 'own' then[\s\S]*v_own_goal_title:=v_context_title/);
  assert.match(migration, /when 'own_penalty' then[\s\S]*v_own_penalty_title:=v_context_title/);
  assert.match(migration, /when 'opponent' then[\s\S]*v_opponent_goal_title:=v_context_title/);
  assert.match(migration, /when 'opponent_penalty' then[\s\S]*v_opponent_penalty_title:=v_context_title/);
  assert.doesNotMatch(migration, /set title=v_context_title/);

  assert.match(templates, /titleField: "ownGoalTitle"/);
  assert.match(templates, /titleField: "ownPenaltyTitle"/);
  assert.match(templates, /titleField: "opponentGoalTitle"/);
  assert.match(templates, /titleField: "opponentPenaltyTitle"/);
  assert.match(admin, /template\[context\.titleField\]/);
  assert.match(admin, /Sichtbarer Buttonname/);
  assert.match(engine, /currentPenaltyTitleContext/);
  assert.match(engine, /selectedAction\(\) === "GOAL_OPPONENT" \? "opponent" : "own"/);
  assert.match(engine, /opponentPenaltyTitle/);
  assert.match(engine, /ownPenaltyTitle/);
});


test("PROD Liveticker teams use portal-owned codes and server-managed local logo assets", async () => {
  const migration = await read("supabase/migrations/20260906221000_liveticker_team_assets_prod_hotfix.sql");
  const admin = await read("js/modules/liveticker-admin.js");
  const build = await read("scripts/build-static.mjs");

  assert.match(migration, /add column team_code text/);
  assert.match(migration, /add column logo_asset_path text/);
  assert.match(migration, /team_code[\s\S]*A-Z0-9/);
  assert.match(migration, /\^\/assets\/liveticker\/teams\//);
  assert.doesNotMatch(migration, /team_[0-9]+\.png/);
  assert.match(migration, /'teamCode',t\.team_code/);
  assert.match(migration, /'logoAssetPath',t\.logo_asset_path/);
  assert.match(migration, /black-dragons-erfurt\.svg/);
  assert.match(migration, /team_code='TBD'/);
  assert.doesNotMatch(migration, /p_payload->>'logoUrl'/);
  assert.doesNotMatch(migration, /p_payload->>'logoAssetPath'/);
  assert.match(admin, /Teamkürzel/);
  assert.doesNotMatch(admin, /name="logoUrl"/);
  assert.doesNotMatch(admin, /name="logoAssetPath"/);
  assert.match(admin, /team\.logoAssetPath/);
  assert.match(admin, /lokales Portal-Asset/);
  assert.match(build, /"assets"/);
});


test("PROD Liveticker exposes exactly three repeatable manual output buttons", async () => {
  const html = await read("liveticker/index.html");
  const engine = await read("js/liveticker-engine-v4.js");
  const graphics = await read("js/liveticker-graphics-inline.js");
  const migration = await read("supabase/migrations/20260907210154_liveticker_manual_outputs_prod_hotfix.sql");

  assert.match(html, /id="period1OutputButton"[^>]*>1\. Drittel<\/button>/);
  assert.match(html, /id="period2OutputButton"[^>]*>2\. Drittel<\/button>/);
  assert.match(html, /id="finalOutputButton"[^>]*>Ende<\/button>/);
  assert.doesNotMatch(html, /periodSummaryButton|finalSummaryButton|periodGraphicButton|finalGraphicButton/);

  assert.match(engine, /period1OutputButton[\s\S]*formatSegmentSummary\(state\.history, "P1"/);
  assert.match(engine, /period2OutputButton[\s\S]*formatSegmentSummary\(state\.history, "P2"/);
  assert.match(engine, /finalOutputButton[\s\S]*formatFinalSummary\(state\.history, opponent\(\)\)/);

  assert.match(graphics, /PERIOD_1: document\.getElementById\("period1OutputButton"\)/);
  assert.match(graphics, /PERIOD_2: document\.getElementById\("period2OutputButton"\)/);
  assert.match(graphics, /FINAL: document\.getElementById\("finalOutputButton"\)/);
  assert.match(graphics, /api\.call\("liveticker_graphics_enqueue", \{ eventId, kind \}\)/);
  assert.doesNotMatch(graphics, /latestPeriodKind|currentGame\?\.completedAt|minute >= 20|minute >= 40/);
  assert.match(graphics, /job\?\.status === "SUCCEEDED"[\s\S]*`\$\{base\} · neu`/);

  assert.match(migration, /v_kind not in \('PERIOD_1','PERIOD_2','FINAL'\)/);
  assert.doesNotMatch(migration, /v_state\.minute < 20|v_state\.minute < 40|v_state\.completed_at is null/);
  assert.doesNotMatch(migration, /LIVETICKER_GRAPHIC_PERIOD_NOT_READY|LIVETICKER_GRAPHIC_FINAL_NOT_READY/);
});
