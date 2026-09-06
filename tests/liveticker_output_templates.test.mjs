import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import {
  LIVETICKER_TEMPLATE_CONTEXTS,
  LIVETICKER_TEMPLATE_VARIABLES,
  livetickerSafeTokenInsertionRange,
  normalizeLivetickerTemplateSnapshot,
  planLivetickerProtectedEdit,
  renderLivetickerTemplate,
  validateLivetickerTemplate
} from "../js/liveticker-output-templates.js";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

const validOwn = "{{minute}}' {{scorer}} {{assists}}\n*{{mighty_score}}:{{opponent_score}}*";
const validPenalty = "{{minute}} Spielminute\nStrafe(n)\n\n{{penalties}}";
const detailedPenalty = "{{minute}} · {{team_name}} · {{opponent_name}}\n{{player_name}}\n{{jersey_number}}\n{{player}}\n{{penalty_duration}}\n{{penalty_reason}}\n{{penalty_line}}\n{{penalties}}";
const validOpponent = "{{minute}}' Tor {{opponent_name}} {{scorer}}\n*{{mighty_score}}:{{opponent_score}}*";

function dollarQuoted(source, tag) {
  const delimiter = `$${tag}$`;
  const start = source.indexOf(delimiter);
  const end = source.indexOf(delimiter, start + delimiter.length);
  assert.notEqual(start, -1, `Start von ${tag} fehlt`);
  assert.notEqual(end, -1, `Ende von ${tag} fehlt`);
  return source.slice(start + delimiter.length, end);
}

test("template validation blocks missing, unknown and malformed variables", () => {
  assert.equal(validateLivetickerTemplate(validOwn, "own").valid, true);
  assert.equal(validateLivetickerTemplate(validPenalty, "ownPenalty").valid, true);
  assert.equal(validateLivetickerTemplate(detailedPenalty, "opponentPenalty").valid, true);

  const missing = validateLivetickerTemplate("{{minute}} Spielminute", "own");
  assert.equal(missing.valid, false);
  assert.deepEqual([...missing.missingVariables], ["mighty_score", "opponent_score"]);

  const unknown = validateLivetickerTemplate(`${validOwn}\n{{unknown_player_name}}`, "own");
  assert.equal(unknown.valid, false);
  assert.deepEqual([...unknown.unknownVariables], ["unknown_player_name"]);

  const malformed = validateLivetickerTemplate(validOwn.replace("{{minute}}", "{{ minute }}"), "own");
  assert.equal(malformed.valid, false);
  assert.match(malformed.errors.join(" "), /technisch ungültig/);

  const missingPenaltyLines = validateLivetickerTemplate("{{minute}} Spielminute", "ownPenalty");
  assert.equal(missingPenaltyLines.valid, false);
  assert.deepEqual([...missingPenaltyLines.missingVariables], ["penalties"]);

  const unknownPenaltyVariable = validateLivetickerTemplate(`${validPenalty}\n{{penalty_player_guess}}`, "opponentPenalty");
  assert.equal(unknownPenaltyVariable.valid, false);
  assert.deepEqual([...unknownPenaltyVariable.unknownVariables], ["penalty_player_guess"]);

  const wrongContextVariable = validateLivetickerTemplate(`${validPenalty}\n{{scorer}}`, "ownPenalty");
  assert.equal(wrongContextVariable.valid, false);
  assert.deepEqual([...wrongContextVariable.unknownVariables], ["scorer"]);
});

test("penalty metadata and editor-required state mark only minute and penalties as required", () => {
  for (const contextKey of ["ownPenalty", "opponentPenalty"]) {
    const context = LIVETICKER_TEMPLATE_CONTEXTS[contextKey];
    const variables = LIVETICKER_TEMPLATE_VARIABLES.filter(variable => variable.contexts.includes(contextKey));
    assert.deepEqual([...context.required], ["minute", "penalties"]);
    assert.deepEqual(variables.filter(variable => !variable.optional).map(variable => variable.key), ["minute", "penalties"]);
    assert.deepEqual(variables.filter(variable => context.required.includes(variable.key)).map(variable => variable.key), ["minute", "penalties"]);
  }
});

test("renderer uses persisted text values and omits empty optional-variable lines", () => {
  const template = "CUSTOM {{minute}}\nTorschütze: {{scorer}}\nAssists: {{assists}}\n{{mighty_score}}:{{opponent_score}}";
  assert.equal(renderLivetickerTemplate(template, {
    minute: 17,
    scorer: "#84 Nils Melchior",
    assists: "",
    mighty_score: 2,
    opponent_score: 1
  }), "CUSTOM 17\nTorschütze: #84 Nils Melchior\n2:1");
});

test("template snapshot keeps fixed keys, editable titles and bodies", () => {
  const snapshot = normalizeLivetickerTemplateSnapshot({ templates: [{
    key: "classic",
    title: "Mein Titel",
    ownGoalTemplate: validOwn,
    ownPenaltyTemplate: validPenalty,
    opponentPenaltyTemplate: detailedPenalty,
    opponentGoalTemplate: validOpponent,
    revision: 7
  }] });
  assert.deepEqual(snapshot.templates[0], {
    key: "classic",
    title: "Mein Titel",
    ownGoalTemplate: validOwn,
    ownPenaltyTemplate: validPenalty,
    opponentPenaltyTemplate: detailedPenalty,
    opponentGoalTemplate: validOpponent,
    revision: 7
  });
});

test("legacy shared penalty text is exposed in both new contexts until the migration is applied", () => {
  const snapshot = normalizeLivetickerTemplateSnapshot({ templates: [{
    key: "classic",
    title: "Klassisch",
    ownGoalTemplate: validOwn,
    penaltyTemplate: validPenalty,
    opponentGoalTemplate: validOpponent,
    revision: 3
  }] });
  assert.equal(snapshot.templates[0].ownPenaltyTemplate, validPenalty);
  assert.equal(snapshot.templates[0].opponentPenaltyTemplate, validPenalty);
});

test("editor protects technical token names from partial text edits", () => {
  const template = "Tor in {{minute}} mit Text";
  const tokenStart = template.indexOf("{{minute}}");
  const insideTechnicalName = tokenStart + 4;
  const plan = planLivetickerProtectedEdit(
    template,
    insideTechnicalName,
    insideTechnicalName,
    "insertText"
  );

  assert.equal(plan.action, "block");
  assert.equal(plan.start, tokenStart + "{{minute}}".length);

  const chipRange = livetickerSafeTokenInsertionRange(
    template,
    insideTechnicalName,
    insideTechnicalName
  );
  const withChip = `${template.slice(0, chipRange.start)}{{assists}}${template.slice(chipRange.end)}`;
  assert.equal(withChip, "Tor in {{minute}}{{assists}} mit Text");
  assert.match(withChip, /\{\{minute\}\}/);
});

test("editor removes optional tokens atomically and required-token validation remains authoritative", () => {
  const optionalStart = validOwn.indexOf("{{scorer}}");
  const optionalEnd = optionalStart + "{{scorer}}".length;
  const optionalDelete = planLivetickerProtectedEdit(
    validOwn,
    optionalEnd,
    optionalEnd,
    "deleteContentBackward"
  );
  assert.deepEqual(optionalDelete, { action: "delete", start: optionalStart, end: optionalEnd });

  const withoutOptional = `${validOwn.slice(0, optionalDelete.start)}${validOwn.slice(optionalDelete.end)}`;
  assert.equal(withoutOptional.includes("{{scorer}}"), false);
  assert.equal(validateLivetickerTemplate(withoutOptional, "own").valid, true);

  const requiredStart = validOwn.indexOf("{{minute}}");
  const requiredDelete = planLivetickerProtectedEdit(
    validOwn,
    requiredStart + 3,
    requiredStart + 5,
    "deleteContentForward"
  );
  assert.deepEqual(requiredDelete, {
    action: "delete",
    start: requiredStart,
    end: requiredStart + "{{minute}}".length
  });

  const withoutRequired = `${validOwn.slice(0, requiredDelete.start)}${validOwn.slice(requiredDelete.end)}`;
  const validation = validateLivetickerTemplate(withoutRequired, "own");
  assert.equal(validation.valid, false);
  assert.deepEqual([...validation.missingVariables], ["minute"]);

  const penaltiesStart = validPenalty.indexOf("{{penalties}}");
  const protectedPenaltyName = planLivetickerProtectedEdit(
    validPenalty,
    penaltiesStart + 4,
    penaltiesStart + 4,
    "insertText"
  );
  assert.equal(protectedPenaltyName.action, "block");
  const penaltyDelete = planLivetickerProtectedEdit(
    validPenalty,
    penaltiesStart + "{{penalties}}".length,
    penaltiesStart + "{{penalties}}".length,
    "deleteContentBackward"
  );
  assert.deepEqual(penaltyDelete, {
    action: "delete",
    start: penaltiesStart,
    end: penaltiesStart + "{{penalties}}".length
  });
  const penaltyWithoutLines = `${validPenalty.slice(0, penaltyDelete.start)}${validPenalty.slice(penaltyDelete.end)}`;
  assert.deepEqual([...validateLivetickerTemplate(penaltyWithoutLines, "ownPenalty").missingVariables], ["penalties"]);

  const opponentPenaltyStart = detailedPenalty.indexOf("{{player_name}}");
  const opponentPenaltyDelete = planLivetickerProtectedEdit(
    detailedPenalty,
    opponentPenaltyStart + 5,
    opponentPenaltyStart + 5,
    "deleteContentForward"
  );
  assert.equal(opponentPenaltyDelete.action, "delete");
  assert.equal(opponentPenaltyDelete.start, opponentPenaltyStart);
  assert.equal(opponentPenaltyDelete.end, opponentPenaltyStart + "{{player_name}}".length);
});

test("migration persists and seeds existing variants behind liveticker.manage", async () => {
  const initial = await read("supabase/migrations/20260905231529_add_liveticker_output_templates_r1.sql");
  const followup = await read("supabase/migrations/20260906004157_event_oriented_liveticker_templates_r2.sql");
  const split = await read("supabase/migrations/20260906013738_split_liveticker_penalty_templates_r3.sql");
  const migrations = initial + followup + split;
  assert.match(initial, /create table app_modules\.liveticker_output_templates/);
  assert.match(initial, /'classic',[\s\S]*?'Klassisch'/);
  assert.match(initial, /'emotional',[\s\S]*?'Emotional'/);
  assert.match(initial, /'short',[\s\S]*?'Kurz'/);
  assert.match(migrations, /require_capability\('liveticker\.manage'\)/g);
  assert.match(followup, /add column penalty_template text/);
  assert.match(followup, /when 'own' then[\s\S]*when 'penalty' then[\s\S]*when 'opponent' then/);
  assert.match(split, /rename column penalty_template to own_penalty_template/);
  assert.match(split, /set opponent_penalty_template = own_penalty_template/);
  assert.ok(split.indexOf("create or replace function app_private.liveticker_output_templates_validate_row()") < split.indexOf("update app_modules.liveticker_output_templates\nset opponent_penalty_template = own_penalty_template;"), "R3 must replace the row validator before the backfill update fires the existing trigger");
  assert.match(split, /'key', 'opponent_name',[^\n]+?'optional', true,[^\n]+?'ownPenalty', 'opponentPenalty'/);
  assert.match(split, /'key', 'team_name',[^\n]+?'optional', true,[^\n]+?'ownPenalty', 'opponentPenalty'/);
  assert.match(split, /when 'own_penalty' then[\s\S]*when 'opponent' then[\s\S]*when 'opponent_penalty' then/);
  assert.match(split, /where template_key = v_key\s+for update/);
  assert.match(split, /revision = revision \+ 1/);
  assert.match(followup, /new\.template_key is distinct from old\.template_key/);
  assert.match(initial, /before insert or update\s+on app_modules\.liveticker_output_templates/);
  assert.match(initial, /when 'liveticker_output_templates_list' then 'READ'/);
  assert.match(initial, /when 'liveticker_output_template_save' then 'USER_MUTATION'/);
  assert.match(initial, /liveticker_require_public_dev/);
  assert.doesNotMatch(split, /home_own|home_opponent|away_own|away_opponent/i);
  assert.doesNotMatch(migrations, /insert into app_portal\.capabilities/i);
  assert.doesNotMatch(migrations, /grant (?:select|insert|update|delete) on table/i);
});

test("database seed texts reproduce all previous goal outputs", async () => {
  const migration = await read("supabase/migrations/20260905231529_add_liveticker_output_templates_r1.sql");
  const values = {
    minute: 18,
    scorer: "#84 Nils Melchior",
    assists: "#10 Kevin Heckenberger",
    mighty_score: 1,
    opponent_score: 0,
    opponent_name: "Erfurt"
  };

  assert.equal(renderLivetickerTemplate(dollarQuoted(migration, "classic_own"), values), "18 Spielminute\n*Tooooooor für unsere Schweinfurter Mighty Dogs*\n\nTorschütze: #84 Nils Melchior\nAssists: #10 Kevin Heckenberger\n\nNeuer Spielstand\n*1:0*");
  assert.equal(renderLivetickerTemplate(dollarQuoted(migration, "emotional_own"), values), "18 Spielminute\n🔥 *TOOOOOOOR MIGHTY DOGS!* 🔥\n\n#84 Nils Melchior\nAssists: #10 Kevin Heckenberger\n\nNeuer Spielstand\n*1:0*");
  assert.equal(renderLivetickerTemplate(dollarQuoted(migration, "short_own"), values), "18 Spielminute\n*TOOOOOR SCHWEINFURT!*\n#84 Nils Melchior\nAssists: #10 Kevin Heckenberger\n\n*1:0*");

  const opponentValues = { ...values, minute: 29, assists: "", mighty_score: 0, opponent_score: 1 };
  const opponentClassic = "29 Spielminute\nTor Erfurt\n#84 Nils Melchior\n\nNeuer Spielstand\n*0:1*";
  assert.equal(renderLivetickerTemplate(dollarQuoted(migration, "classic_opponent"), opponentValues), opponentClassic);
  assert.equal(renderLivetickerTemplate(dollarQuoted(migration, "emotional_opponent"), opponentValues), opponentClassic);
  assert.equal(renderLivetickerTemplate(dollarQuoted(migration, "short_opponent"), opponentValues), "29 Spielminute\nTor Erfurt\n#84 Nils Melchior\n\n*0:1*");
});

test("penalty seed reproduces the previous penalty output", async () => {
  const followup = await read("supabase/migrations/20260906004157_event_oriented_liveticker_templates_r2.sql");
  const split = await read("supabase/migrations/20260906013738_split_liveticker_penalty_templates_r3.sql");
  const seeded = dollarQuoted(followup, "penalty");
  assert.equal(renderLivetickerTemplate(seeded, {
    minute: 34,
    penalties: "Mighty Dogs · 2 min · Halten · #84 Nils Melchior\n🚨 *Erfurt · 5+20 min · Bandencheck · #27 Frédéric Potvin*"
  }), "34 Spielminute\nStrafe(n)\n\nMighty Dogs · 2 min · Halten · #84 Nils Melchior\n🚨 *Erfurt · 5+20 min · Bandencheck · #27 Frédéric Potvin*");
  assert.match(split, /rename column penalty_template to own_penalty_template/);
  assert.match(split, /set opponent_penalty_template = own_penalty_template/);
});

test("admin and runtime consume the same stored templates", async () => {
  const [admin, storage, engine] = await Promise.all([
    read("js/modules/liveticker-admin.js"),
    read("js/liveticker-game-storage.js"),
    read("js/liveticker-engine-v4.js")
  ]);
  assert.match(admin, /liveticker_output_templates_list/);
  assert.match(admin, /liveticker_output_template_save/);
  assert.match(admin, /Technischer Key · nicht editierbar/);
  assert.match(admin, /data-insert-variable/);
  assert.match(admin, /addEventListener\("beforeinput"/);
  assert.match(admin, /planLivetickerProtectedEdit/);
  assert.match(admin, /title: "Tore – Wir"[\s\S]*title: "Strafen – Wir"[\s\S]*title: "Tore – Die anderen"[\s\S]*title: "Strafen – Die anderen"/);
  assert.match(admin, /Option \$\{escapeHtml\(optionNumber\)\}/);
  assert.match(admin, /<h2>Liveticker-Editor<\/h2>/);
  assert.match(admin, /data-open-templates>Editor<\/button>/);
  assert.match(admin, /liveticker-output-template-form input:not\(\[type="checkbox"\]\),[\s\S]*font-size:16px!important/);
  assert.doesNotMatch(admin, /Standard wiederherstellen/i);
  assert.match(storage, /pd_public_liveticker_templates/);
  assert.match(storage, /PD_LIVETICKER_OUTPUT_TEMPLATES/);
  assert.match(storage, /window\.setInterval\(pollOutputTemplates, 30000\)/);
  assert.match(engine, /variant\.opponentGoalTemplate/);
  assert.match(engine, /variant\.ownGoalTemplate/);
  assert.match(engine, /variant\?\.ownPenaltyTemplate/);
  assert.match(engine, /variant\?\.opponentPenaltyTemplate/);
  assert.match(engine, /completeTickerSubmitLifecycle\(\{[\s\S]*renderOutput: \(\) => setOutput\([\s\S]*preservePenaltyDraft,[\s\S]*cancelEdit,[\s\S]*syncContext/);
  assert.doesNotMatch(engine, /setOutput\([^;]+\);\s*cancelEdit\(\);/);
  assert.doesNotMatch(engine, /homeOwnGoalTemplate|awayOwnGoalTemplate/);
  assert.doesNotMatch(admin + engine, /MutationObserver/);
  assert.doesNotMatch(engine, /TOOOOOOOR MIGHTY DOGS/);
});
