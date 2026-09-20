import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  formatEventText,
  formatFinalSummary,
  formatGoalText,
  formatPenaltyText,
  formatSegmentSummary
} from "../js/liveticker-engine-v4.js";
import {
  LIVETICKER_DEFAULT_TEXTSYSTEM,
  LIVETICKER_OUTPUT_TYPE_KEYS,
  livetickerVariantsForType,
  normalizeLivetickerTemplateSnapshot,
  validateLivetickerTemplate
} from "../js/liveticker-output-templates.js";

const root = resolve(import.meta.dirname, "..");
const read = relative => readFile(resolve(root, relative), "utf8");
const opponent = { shortName: "Erfurt" };
const player = { number: "10", name: "Max Mustermann" };

function installVariants(variants) {
  globalThis.PD_LIVETICKER_OUTPUT_TEMPLATES = {
    templates: [],
    outputTypes: LIVETICKER_DEFAULT_TEXTSYSTEM.outputTypes,
    variants
  };
}

test.afterEach(() => {
  delete globalThis.PD_LIVETICKER_OUTPUT_TEMPLATES;
});

test("Mighty Dogs and opponent goals resolve independent variant groups", () => {
  installVariants([
    { id: "mighty-special", outputType: "goal_mighty", name: "Dogs", template: "DOGS {{minute}} {{score}}", sortOrder: 10, active: true, default: true },
    { id: "opponent-special", outputType: "goal_opponent", name: "Gegner", template: "GEGNER {{minute}} {{opponent_name}} {{score}}", sortOrder: 10, active: true, default: true }
  ]);
  const own = { id: "g1", type: "goal", team: "mighty", minute: 4, player, assists: [], outputVariantId: "mighty-special" };
  const away = { id: "g2", type: "goal", team: "opponent", minute: 8, player, assists: [], outputVariantId: "opponent-special" };
  const history = [own, away];

  assert.equal(formatGoalText(own, history, opponent), "DOGS 4 1 : 0");
  assert.equal(formatGoalText(away, history, opponent), "GEGNER 8 Erfurt 1 : 1");
});

test("one penalty output type renders both teams deterministically", () => {
  installVariants([
    { id: "penalty-both", outputType: "penalty", name: "Beide Teams", template: "{{minute}} Spielminute\n{{team_name}}\n{{penalties}}", sortOrder: 10, active: true, default: true }
  ]);
  const event = {
    id: "p1",
    type: "penalty",
    minute: 17,
    outputVariantId: "penalty-both",
    penalties: [
      { team: "mighty", duration: "2", reason: "Haken", player },
      { team: "opponent", duration: "5+20", reason: "Bandencheck", player: null }
    ]
  };
  const output = formatPenaltyText(event, opponent);

  assert.match(output, /^17 Spielminute\nMighty Dogs \+ Erfurt/m);
  assert.ok(output.indexOf("Mighty Dogs · 2 min") < output.indexOf("Erfurt · 5+20 min"));
  assert.match(output, /🚨 \*Erfurt · 5\+20 min · Bandencheck\*/);
  assert.equal((output.match(/17 Spielminute/g) || []).length, 1);
});

test("active runtime variants are dynamic while inactive referenced variants remain resolvable", () => {
  const snapshot = {
    variants: [
      { id: "active", outputType: "penalty", name: "Aktiv", sortOrder: 20, active: true },
      { id: "inactive", outputType: "penalty", name: "Alt", sortOrder: 10, active: false }
    ]
  };
  assert.deepEqual(livetickerVariantsForType(snapshot, "penalty").map(item => item.id), ["active"]);
  assert.deepEqual(livetickerVariantsForType(snapshot, "penalty", { includeInactive: true }).map(item => item.id), ["inactive", "active"]);
});

test("Straf-Penalty, shootout attempt, period and final wording come from variants", () => {
  const variants = LIVETICKER_DEFAULT_TEXTSYSTEM.variants.map(variant => {
    if (variant.outputType === LIVETICKER_OUTPUT_TYPE_KEYS.PENALTY_SHOT) return { ...variant, template: "PENALTY {{minute}} {{shooter}} {{goalie}} {{result}}" };
    if (variant.outputType === LIVETICKER_OUTPUT_TYPE_KEYS.SHOOTOUT_ATTEMPT) return { ...variant, template: "VERSUCH {{team_name}} {{shooter}} {{result}}" };
    if (variant.outputType === LIVETICKER_OUTPUT_TYPE_KEYS.PERIOD_SUMMARY) return { ...variant, template: "DRITTEL {{period_label}} {{score_line}}\n{{own_goals}}\n{{opponent_goals}}" };
    if (variant.outputType === LIVETICKER_OUTPUT_TYPE_KEYS.FINAL_SUMMARY) return { ...variant, template: "ENDE {{score_line}}\n{{own_goals}}\n{{opponent_goals}}\n{{own_penalties}}\n{{opponent_penalties}}\n{{shootout_summary}}" };
    return variant;
  });
  installVariants(variants);
  const penaltyShot = { id: "ps", type: "penalty", subtype: "penalty_shot", minute: 11, team: "mighty", player, goalie: { number: "30", name: "Torwart" }, result: "scored", penalties: [{ team: "opponent" }] };
  const shootout = { id: "so", type: "shootout", team: "opponent", player, result: "missed" };
  const history = [penaltyShot];

  assert.match(formatEventText(penaltyShot, history, opponent), /^PENALTY 11 #10 Max Mustermann #30 Torwart ✅ verwandelt$/);
  assert.match(formatEventText(shootout, [shootout], opponent), /^VERSUCH Erfurt #10 Max Mustermann ❌ vergeben$/);
  assert.match(formatSegmentSummary(history, "P1", opponent), /^DRITTEL 1\. Drittel 1:0/);
  assert.match(formatFinalSummary(history, opponent), /^ENDE Mighty Dogs 1:0 Erfurt/);
});

test("period templates keep cumulative goal lists", () => {
  const history = [
    { id: "g1", type: "goal", team: "mighty", minute: 3, player, assists: [], style: "classic" },
    { id: "g2", type: "goal", team: "opponent", minute: 25, player, assists: [], style: "classic" },
    { id: "g3", type: "goal", team: "mighty", minute: 45, player, assists: [], style: "classic" }
  ];
  const p1 = formatSegmentSummary(history, "P1", opponent);
  const p2 = formatSegmentSummary(history, "P2", opponent);
  const p3 = formatSegmentSummary(history, "P3", opponent);
  assert.match(p1, /3 Spielminute/);
  assert.doesNotMatch(p1, /25 Spielminute/);
  assert.match(p2, /3 Spielminute/);
  assert.match(p2, /25 Spielminute/);
  assert.doesNotMatch(p2, /45 Spielminute/);
  assert.match(p3, /3 Spielminute/);
  assert.match(p3, /25 Spielminute/);
  assert.match(p3, /45 Spielminute/);
});

test("historical classic emotional and short actions retain the legacy renderer", () => {
  const templates = ["classic", "emotional", "short"].map((key, index) => ({
    key,
    title: key,
    ownGoalTitle: key,
    ownPenaltyTitle: key,
    opponentGoalTitle: key,
    opponentPenaltyTitle: key,
    ownGoalTemplate: `${key.toUpperCase()} {{minute}} {{score}}`,
    opponentGoalTemplate: `${key.toUpperCase()} {{minute}} {{opponent_name}} {{score}}`,
    ownPenaltyTemplate: `${key.toUpperCase()} {{minute}}\n{{penalties}}`,
    opponentPenaltyTemplate: `${key.toUpperCase()} {{minute}}\n{{penalties}}`,
    revision: index + 1
  }));
  globalThis.PD_LIVETICKER_OUTPUT_TEMPLATES = normalizeLivetickerTemplateSnapshot({ templates });
  const goal = { id: "old", type: "goal", team: "mighty", minute: 7, player, assists: [], style: "emotional" };
  const penalty = { id: "old-p", type: "penalty", minute: 9, style: "short", penalties: [{ team: "mighty", duration: "2", reason: "Haken", player }] };
  assert.equal(formatGoalText(goal, [goal], opponent), "EMOTIONAL 7 1 : 0");
  assert.match(formatPenaltyText(penalty, opponent), /^SHORT 9/);
});

test("V2 goal variants follow the new type contract without the legacy score requirement", () => {
  const ownV2 = validateLivetickerTemplate("{{minute}} Spielminute\nTOOOOR!", "goal_mighty");
  const opponentV2 = validateLivetickerTemplate("{{minute}} Spielminute\nTor {{opponent_name}}", "goal_opponent");
  const legacyOwn = validateLivetickerTemplate("{{minute}} Spielminute\nTOOOOR!", "own");

  assert.equal(ownV2.valid, true);
  assert.equal(opponentV2.valid, true);
  assert.equal(legacyOwn.valid, false);
  assert.match(legacyOwn.errors.join(" "), /Spielstand-Platzhalter fehlt/);
});

test("migration and portal expose full variant CRUD without changing the legacy table", async () => {
  const [migration, admin, engine, storage, html, implementation] = await Promise.all([
    read("supabase/migrations/20260920001157_liveticker_textsystem_v2.sql"),
    read("js/modules/liveticker-admin.js"),
    read("js/liveticker-engine-v4.js"),
    read("js/liveticker-game-storage.js"),
    read("liveticker/index.html"),
    read("docs/codex/LIVETICKER_TEXTSYSTEM_V2_IMPLEMENTATION.md")
  ]);
  assert.match(migration, /create table app_modules\.liveticker_output_types/);
  assert.match(migration, /create table app_modules\.liveticker_output_variants/);
  assert.doesNotMatch(migration, /drop table\s+app_modules\.liveticker_output_templates/i);
  assert.match(migration, /liveticker_output_variant_save/);
  assert.match(migration, /liveticker_output_variant_delete/);
  assert.match(migration, /pd_api_current_actions_before_liveticker_textsystem_v2/);
  assert.match(migration, /liveticker_output_variant_save[\s\S]*liveticker_output_variant_delete/);
  assert.match(migration, /returns jsonb language plpgsql security invoker set search_path=''/);
  assert.match(migration, /v_expected<>v_existing\.revision/);
  assert.match(migration, /payload->>'outputVariantId'=v_id::text/);
  assert.match(migration, /LIVETICKER_OUTPUT_VARIANT_CREATED/);
  assert.match(migration, /LIVETICKER_OUTPUT_VARIANT_UPDATED/);
  assert.match(migration, /LIVETICKER_OUTPUT_VARIANT_DELETED/);
  assert.match(admin, /Variante hinzufügen/);
  assert.match(admin, /Name der Variante/);
  assert.match(admin, /Deaktivieren/);
  assert.match(admin, /Als Standard/);
  assert.match(admin, /Sortierung/);
  assert.match(admin, /Beispielvorschau/);
  assert.match(html, /id="goalVariantOptions"/);
  assert.match(html, /id="penaltyVariantOptions"/);
  assert.doesNotMatch(html, /name="goalStyle"|name="penaltyStyle"/);
  assert.match(engine, /outputVariantId:/);
  assert.match(engine, /pd-liveticker-output-templates-updated/);
  assert.match(storage, /setInterval\(pollOutputTemplates, 30000\)/);
  assert.match(implementation, /`goal_mighty`/);
  assert.match(implementation, /`goal_opponent`/);
  assert.match(implementation, /`penalty`/);
});
