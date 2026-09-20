const GOAL_CONTEXT_KEYS = Object.freeze(["own", "opponent", "goal_mighty", "goal_opponent"]);
const PENALTY_CONTEXT_KEYS = Object.freeze(["ownPenalty", "opponentPenalty", "penalty"]);

export const LIVETICKER_OUTPUT_TYPE_KEYS = Object.freeze({
  GOAL_MIGHTY: "goal_mighty",
  GOAL_OPPONENT: "goal_opponent",
  PENALTY: "penalty",
  PENALTY_SHOT: "penalty_shot",
  SHOOTOUT_ATTEMPT: "shootout_attempt",
  PERIOD_SUMMARY: "period_summary",
  FINAL_SUMMARY: "final_summary",
  GOAL_SUMMARY_LINE: "goal_summary_line",
  PENALTY_SUMMARY_LINE: "penalty_summary_line",
  PENALTY_SHOT_SUMMARY_LINE: "penalty_shot_summary_line",
  SHOOTOUT_SUMMARY_LINE: "shootout_summary_line",
  SHOOTOUT_SUMMARY: "shootout_summary",
  NO_GOALS: "no_goals",
  NO_PENALTIES: "no_penalties",
  MISSING_GOAL_SCORER: "missing_goal_scorer",
  MISSING_SHOOTER: "missing_shooter",
  MISSING_GOALIE: "missing_goalie"
});

export const LIVETICKER_TEMPLATE_VARIABLES = Object.freeze([
  Object.freeze({ key: "minute", label: "Spielminute", optional: false, contexts: Object.freeze([...GOAL_CONTEXT_KEYS, ...PENALTY_CONTEXT_KEYS, "penalty_shot", "goal_summary_line", "penalty_summary_line", "penalty_shot_summary_line"]) }),
  Object.freeze({ key: "scorer", label: "Torschütze (mit Trikotnummer)", optional: true, contexts: Object.freeze([...GOAL_CONTEXT_KEYS, "goal_summary_line"]) }),
  Object.freeze({ key: "assists", label: "Assists (mit Trikotnummern)", optional: true, contexts: GOAL_CONTEXT_KEYS }),
  Object.freeze({ key: "mighty_score", label: "Tore Mighty Dogs", optional: false, contexts: Object.freeze([...GOAL_CONTEXT_KEYS, "shootout_summary"]) }),
  Object.freeze({ key: "opponent_score", label: "Tore Gegner", optional: false, contexts: Object.freeze([...GOAL_CONTEXT_KEYS, "shootout_summary"]) }),
  Object.freeze({ key: "home_score", label: "Tore Heimmannschaft", optional: false, contexts: GOAL_CONTEXT_KEYS }),
  Object.freeze({ key: "away_score", label: "Tore Auswärtsmannschaft", optional: false, contexts: GOAL_CONTEXT_KEYS }),
  Object.freeze({ key: "score", label: "Spielstand Heim : Auswärts", optional: false, contexts: GOAL_CONTEXT_KEYS }),
  Object.freeze({ key: "opponent_name", label: "Kurzname Gegner", optional: true, contexts: Object.freeze(["opponent", "goal_mighty", "goal_opponent", ...PENALTY_CONTEXT_KEYS, "penalty_shot", "shootout_attempt", "period_summary", "final_summary", "shootout_summary"]) }),
  Object.freeze({ key: "player_name", label: "Spielername · nur bei einer Strafzeile", optional: true, contexts: PENALTY_CONTEXT_KEYS }),
  Object.freeze({ key: "jersey_number", label: "Trikotnummer · nur bei einer Strafzeile", optional: true, contexts: PENALTY_CONTEXT_KEYS }),
  Object.freeze({ key: "player", label: "Spieler mit Trikotnummer · nur bei einer Strafzeile", optional: true, contexts: Object.freeze([...PENALTY_CONTEXT_KEYS, "penalty_summary_line"]) }),
  Object.freeze({ key: "penalty_duration", label: "Strafdauer · nur bei einer Strafzeile", optional: true, contexts: Object.freeze([...PENALTY_CONTEXT_KEYS, "penalty_summary_line"]) }),
  Object.freeze({ key: "penalty_reason", label: "Strafgrund · nur bei einer Strafzeile", optional: true, contexts: Object.freeze([...PENALTY_CONTEXT_KEYS, "penalty_summary_line"]) }),
  Object.freeze({ key: "team_name", label: "Betroffenes Team", optional: true, contexts: Object.freeze([...PENALTY_CONTEXT_KEYS, "penalty_shot", "shootout_attempt", "shootout_summary_line"]) }),
  Object.freeze({ key: "penalty_line", label: "Vollständige Strafzeile · nur bei einer Strafzeile", optional: true, contexts: PENALTY_CONTEXT_KEYS }),
  Object.freeze({ key: "penalties", label: "Alle formatierten Strafzeilen", optional: false, contexts: PENALTY_CONTEXT_KEYS }),
  Object.freeze({ key: "shooter", label: "Schütze", optional: false, contexts: Object.freeze(["penalty_shot", "shootout_attempt", "penalty_shot_summary_line", "shootout_summary_line"]) }),
  Object.freeze({ key: "goalie", label: "Torhüter", optional: false, contexts: Object.freeze(["penalty_shot", "penalty_shot_summary_line"]) }),
  Object.freeze({ key: "result", label: "Ergebnis", optional: false, contexts: Object.freeze(["penalty_shot", "shootout_attempt", "penalty_shot_summary_line", "shootout_summary_line"]) }),
  Object.freeze({ key: "period_label", label: "Drittelbezeichnung", optional: false, contexts: Object.freeze(["period_summary"]) }),
  Object.freeze({ key: "score_line", label: "Spielstandzeile", optional: false, contexts: Object.freeze(["period_summary", "final_summary"]) }),
  Object.freeze({ key: "own_goals", label: "Tore Mighty Dogs", optional: false, contexts: Object.freeze(["period_summary", "final_summary"]) }),
  Object.freeze({ key: "opponent_goals", label: "Tore Gegner", optional: false, contexts: Object.freeze(["period_summary", "final_summary"]) }),
  Object.freeze({ key: "own_penalties", label: "Strafen Mighty Dogs", optional: false, contexts: Object.freeze(["final_summary"]) }),
  Object.freeze({ key: "opponent_penalties", label: "Strafen Gegner", optional: false, contexts: Object.freeze(["final_summary"]) }),
  Object.freeze({ key: "shootout_summary", label: "Penaltyschießen-Zusammenfassung", optional: true, contexts: Object.freeze(["final_summary"]) }),
  Object.freeze({ key: "shootout_attempts", label: "Penaltyschießen-Versuche", optional: false, contexts: Object.freeze(["shootout_summary"]) })
]);

export const LIVETICKER_TEMPLATE_CONTEXTS = Object.freeze({
  own: Object.freeze({
    field: "ownGoalTemplate",
    titleField: "ownGoalTitle",
    label: "Tor – Wir",
    required: Object.freeze(["minute"]),
    scoreRequired: true
  }),
  ownPenalty: Object.freeze({
    field: "ownPenaltyTemplate",
    titleField: "ownPenaltyTitle",
    label: "Strafen – Wir",
    required: Object.freeze(["minute", "penalties"])
  }),
  opponentPenalty: Object.freeze({
    field: "opponentPenaltyTemplate",
    titleField: "opponentPenaltyTitle",
    label: "Strafen – Die anderen",
    required: Object.freeze(["minute", "penalties"])
  }),
  opponent: Object.freeze({
    field: "opponentGoalTemplate",
    titleField: "opponentGoalTitle",
    label: "Tor – Die anderen",
    required: Object.freeze(["minute", "opponent_name"]),
    scoreRequired: true
  }),
  goal_mighty: Object.freeze({ label: "Tor Mighty Dogs", required: Object.freeze(["minute"]) }),
  goal_opponent: Object.freeze({ label: "Tor Gegner", required: Object.freeze(["minute", "opponent_name"]) }),
  penalty: Object.freeze({ label: "Strafe", required: Object.freeze(["minute", "penalties"]) }),
  penalty_shot: Object.freeze({ label: "Straf-Penalty", required: Object.freeze(["minute", "team_name", "shooter", "goalie", "result"]) }),
  shootout_attempt: Object.freeze({ label: "Penaltyschießen", required: Object.freeze(["team_name", "shooter", "result"]) }),
  period_summary: Object.freeze({ label: "Drittelende", required: Object.freeze(["period_label", "score_line", "own_goals", "opponent_goals", "opponent_name"]) }),
  final_summary: Object.freeze({ label: "Endstand", required: Object.freeze(["score_line", "own_goals", "opponent_goals", "own_penalties", "opponent_penalties", "opponent_name"]) }),
  goal_summary_line: Object.freeze({ label: "Torzeile", required: Object.freeze(["minute", "scorer"]) }),
  penalty_summary_line: Object.freeze({ label: "Strafzeile", required: Object.freeze(["minute", "player", "penalty_duration", "penalty_reason"]) }),
  penalty_shot_summary_line: Object.freeze({ label: "Straf-Penalty-Zeile", required: Object.freeze(["minute", "shooter", "goalie", "result"]) }),
  shootout_summary_line: Object.freeze({ label: "Penaltyversuch-Zeile", required: Object.freeze(["team_name", "shooter", "result"]) }),
  shootout_summary: Object.freeze({ label: "Penaltyschießen-Zusammenfassung", required: Object.freeze(["mighty_score", "opponent_score", "opponent_name", "shootout_attempts"]) }),
  no_goals: Object.freeze({ label: "Keine Tore", required: Object.freeze([]) }),
  no_penalties: Object.freeze({ label: "Keine Strafen", required: Object.freeze([]) }),
  missing_goal_scorer: Object.freeze({ label: "Torschütze fehlt", required: Object.freeze([]) }),
  missing_shooter: Object.freeze({ label: "Schütze fehlt", required: Object.freeze([]) }),
  missing_goalie: Object.freeze({ label: "Goalie fehlt", required: Object.freeze([]) })
});

const VARIABLE_KEYS = Object.freeze(LIVETICKER_TEMPLATE_VARIABLES.map(variable => variable.key));
const OPTIONAL_KEYS = Object.freeze(LIVETICKER_TEMPLATE_VARIABLES.filter(variable => variable.optional).map(variable => variable.key));
const TOKEN_PATTERN = /\{\{([^{}]+)\}\}/g;
const EXACT_TOKEN_PATTERN = /\{\{[a-z_]+\}\}/g;

function normalizedSelection(template, selectionStart, selectionEnd) {
  const length = String(template ?? "").length;
  const start = Math.max(0, Math.min(length, Number(selectionStart) || 0));
  const end = Math.max(start, Math.min(length, Number(selectionEnd) || start));
  return { start, end };
}

export function livetickerTemplateTokenRanges(template) {
  const body = String(template ?? "");
  return Object.freeze([...body.matchAll(EXACT_TOKEN_PATTERN)]
    .map(match => Object.freeze({
      key: match[0].slice(2, -2),
      start: match.index,
      end: match.index + match[0].length
    }))
    .filter(token => VARIABLE_KEYS.includes(token.key)));
}

export function planLivetickerProtectedEdit(template, selectionStart, selectionEnd, inputType = "") {
  const selection = normalizedSelection(template, selectionStart, selectionEnd);
  const type = String(inputType || "");
  if (type.startsWith("history")) return Object.freeze({ action: "allow", ...selection });

  const tokens = livetickerTemplateTokenRanges(template);
  const collapsed = selection.start === selection.end;
  const containing = collapsed
    ? tokens.find(token => selection.start > token.start && selection.start < token.end)
    : null;
  const backwardDelete = type.startsWith("delete") && /backward/i.test(type);
  const forwardDelete = type.startsWith("delete") && /forward/i.test(type);
  const adjacent = collapsed
    ? tokens.find(token => (backwardDelete && token.end === selection.start)
      || (forwardDelete && token.start === selection.start))
    : null;
  const intersecting = collapsed
    ? (containing ? [containing] : [])
    : tokens.filter(token => selection.start < token.end && selection.end > token.start);

  if (type.startsWith("delete") && (adjacent || intersecting.length)) {
    const affected = adjacent ? [adjacent] : intersecting;
    return Object.freeze({
      action: "delete",
      start: Math.min(selection.start, ...affected.map(token => token.start)),
      end: Math.max(selection.end, ...affected.map(token => token.end))
    });
  }

  if (containing || intersecting.length) {
    const affected = containing ? [containing] : intersecting;
    const caret = affected[affected.length - 1].end;
    return Object.freeze({ action: "block", start: caret, end: caret });
  }

  return Object.freeze({ action: "allow", ...selection });
}

export function livetickerSafeTokenInsertionRange(template, selectionStart, selectionEnd) {
  const plan = planLivetickerProtectedEdit(template, selectionStart, selectionEnd, "insertText");
  return Object.freeze({ start: plan.start, end: plan.end });
}

export function templateToken(key) {
  return `{{${key}}}`;
}

export function validateLivetickerTemplate(template, contextKey) {
  const context = LIVETICKER_TEMPLATE_CONTEXTS[contextKey];
  if (!context) throw new Error("Unbekannter Liveticker-Template-Kontext.");

  const body = String(template ?? "");
  const allowedVariables = LIVETICKER_TEMPLATE_VARIABLES
    .filter(variable => variable.contexts.includes(contextKey))
    .map(variable => variable.key);
  const variables = [...body.matchAll(TOKEN_PATTERN)].map(match => match[1].trim());
  const unknownVariables = [...new Set(variables.filter(variable => !allowedVariables.includes(variable)))];
  const missingVariables = context.required.filter(variable => !variables.includes(variable));
  const hasScoreVariables = !context.scoreRequired
    || variables.includes("score")
    || (variables.includes("home_score") && variables.includes("away_score"))
    || (variables.includes("mighty_score") && variables.includes("opponent_score"));
  const withoutValidTokens = body.replace(EXACT_TOKEN_PATTERN, "");
  const malformed = /\{\{|\}\}/.test(withoutValidTokens);
  const errors = [];

  if (!body.trim()) errors.push("Der Ausgabetext darf nicht leer sein.");
  if (body.length > 4000) errors.push("Der Ausgabetext darf maximal 4.000 Zeichen haben.");
  if (malformed) errors.push("Mindestens ein Platzhalter ist technisch ungültig.");
  if (unknownVariables.length) errors.push(`Unbekannte Platzhalter: ${unknownVariables.map(templateToken).join(", ")}.`);
  if (missingVariables.length) errors.push(`Pflichtplatzhalter fehlen: ${missingVariables.map(templateToken).join(", ")}.`);
  if (!hasScoreVariables) errors.push("Spielstand-Platzhalter fehlt: verwende {{score}}, {{home_score}} + {{away_score}} oder die bisherigen Team-Platzhalter.");

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    variables: Object.freeze([...new Set(variables)]),
    unknownVariables: Object.freeze(unknownVariables),
    missingVariables: Object.freeze(missingVariables)
  });
}

export function assertLivetickerTemplate(template, contextKey) {
  const result = validateLivetickerTemplate(template, contextKey);
  if (!result.valid) throw new Error(result.errors.join(" "));
  return result;
}

export function renderLivetickerTemplate(template, values) {
  const body = String(template ?? "");
  const supplied = Object.fromEntries(VARIABLE_KEYS.map(key => [key, String(values?.[key] ?? "")]));
  const unknown = [...body.matchAll(TOKEN_PATTERN)]
    .map(match => match[1].trim())
    .filter(variable => !VARIABLE_KEYS.includes(variable));
  if (unknown.length || /\{\{|\}\}/.test(body.replace(EXACT_TOKEN_PATTERN, ""))) {
    throw new Error("Der gespeicherte Liveticker-Ausgabetext enthält einen ungültigen Platzhalter.");
  }

  return body
    .split("\n")
    .filter(line => !OPTIONAL_KEYS.some(key => line.includes(templateToken(key)) && !supplied[key]))
    .map(line => line.replace(EXACT_TOKEN_PATTERN, token => supplied[token.slice(2, -2)]))
    .join("\n");
}

function normalizeLegacyTemplates(raw) {
  const templates = Array.isArray(raw?.templates) ? raw.templates : [];
  return templates.map(template => {
    const key = String(template?.key || "").trim();
    const title = String(template?.title || "").trim();
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(key) || !title) {
      throw new Error("Eine Liveticker-Ausgabevariante ist unvollständig.");
    }
    assertLivetickerTemplate(template.ownGoalTemplate, "own");
    const legacyPenaltyTemplate = template.penaltyTemplate;
    const ownPenaltyTemplate = template.ownPenaltyTemplate ?? legacyPenaltyTemplate;
    const opponentPenaltyTemplate = template.opponentPenaltyTemplate ?? legacyPenaltyTemplate;
    assertLivetickerTemplate(ownPenaltyTemplate, "ownPenalty");
    assertLivetickerTemplate(opponentPenaltyTemplate, "opponentPenalty");
    assertLivetickerTemplate(template.opponentGoalTemplate, "opponent");
    return Object.freeze({
      key,
      title,
      ownGoalTitle: String(template.ownGoalTitle || title).trim(),
      ownPenaltyTitle: String(template.ownPenaltyTitle || title).trim(),
      opponentGoalTitle: String(template.opponentGoalTitle || title).trim(),
      opponentPenaltyTitle: String(template.opponentPenaltyTitle || title).trim(),
      ownGoalTemplate: String(template.ownGoalTemplate),
      ownPenaltyTemplate: String(ownPenaltyTemplate),
      opponentPenaltyTemplate: String(opponentPenaltyTemplate),
      opponentGoalTemplate: String(template.opponentGoalTemplate),
      revision: Number(template.revision || 0)
    });
  });
}

const DEFAULT_OUTPUT_TYPES = Object.freeze([
  ["goal_mighty", "Tor Mighty Dogs", "ACTION", 10],
  ["goal_opponent", "Tor Gegner", "ACTION", 20],
  ["penalty", "Strafe", "ACTION", 30],
  ["penalty_shot", "Straf-Penalty", "ACTION", 40],
  ["shootout_attempt", "Penaltyschießen", "ACTION", 50],
  ["period_summary", "Drittelende", "SUMMARY", 60],
  ["final_summary", "Endstand", "SUMMARY", 70],
  ["goal_summary_line", "Textbaustein · Torzeile", "FRAGMENT", 80],
  ["penalty_summary_line", "Textbaustein · Strafzeile", "FRAGMENT", 90],
  ["penalty_shot_summary_line", "Textbaustein · Straf-Penalty", "FRAGMENT", 100],
  ["shootout_summary_line", "Textbaustein · Penaltyversuch", "FRAGMENT", 110],
  ["shootout_summary", "Textbaustein · Penaltyschießen", "FRAGMENT", 120],
  ["no_goals", "Textbaustein · Keine Tore", "FRAGMENT", 130],
  ["no_penalties", "Textbaustein · Keine Strafen", "FRAGMENT", 140],
  ["missing_goal_scorer", "Textbaustein · Torschütze fehlt", "FRAGMENT", 150],
  ["missing_shooter", "Textbaustein · Schütze fehlt", "FRAGMENT", 160],
  ["missing_goalie", "Textbaustein · Goalie fehlt", "FRAGMENT", 170]
].map(([key, label, category, sortOrder]) => Object.freeze({
  key,
  label,
  description: "",
  category,
  sortOrder,
  allowedVariables: Object.freeze(LIVETICKER_TEMPLATE_VARIABLES.filter(variable => variable.contexts.includes(key)).map(variable => variable.key)),
  requiredVariables: LIVETICKER_TEMPLATE_CONTEXTS[key].required
})));

const DEFAULT_NON_LEGACY_VARIANTS = Object.freeze([
  ["40000000-0000-4000-8000-000000000001", "penalty_shot", "normal", "Normal", "🏒 *Straf-Penalty*\n{{minute}} Spielminute\n{{team_name}} · Schütze: {{shooter}}\n{{opponent_name}} · Goalie: {{goalie}}\n{{result}}"],
  ["50000000-0000-4000-8000-000000000001", "shootout_attempt", "normal", "Normal", "*Penaltyschießen*\n{{team_name}} · {{shooter}}\n{{result}}"],
  ["60000000-0000-4000-8000-000000000001", "period_summary", "normal", "Normal", "*Ende {{period_label}} – {{score_line}}*\n\n🥅 *Mighty Dogs*\n{{own_goals}}\n\n🥅 *{{opponent_name}}*\n{{opponent_goals}}"],
  ["70000000-0000-4000-8000-000000000001", "final_summary", "normal", "Normal", "*ENDSTAND*\n{{score_line}}\n\n🥅 *Tore Mighty Dogs*\n{{own_goals}}\n\n🥅 *Tore {{opponent_name}}*\n{{opponent_goals}}\n\n🚨 *Strafen Mighty Dogs*\n{{own_penalties}}\n\n🚨 *Strafen {{opponent_name}}*\n{{opponent_penalties}}\n{{shootout_summary}}"],
  ["80000000-0000-4000-8000-000000000001", "goal_summary_line", "normal", "Normal", "{{minute}} Spielminute – {{scorer}}"],
  ["81000000-0000-4000-8000-000000000001", "penalty_summary_line", "normal", "Normal", "{{minute}} Spielminute – {{player}} – {{penalty_duration}} {{penalty_reason}}"],
  ["82000000-0000-4000-8000-000000000001", "penalty_shot_summary_line", "normal", "Normal", "{{minute}} Spielminute – Straf-Penalty · {{shooter}} gegen {{goalie}} · {{result}}"],
  ["83000000-0000-4000-8000-000000000001", "shootout_summary_line", "normal", "Normal", "{{team_name}} · {{shooter}} · {{result}}"],
  ["84000000-0000-4000-8000-000000000001", "shootout_summary", "normal", "Normal", "\n🏒 *Penaltyschießen*\nTreffer: Mighty Dogs {{mighty_score}}:{{opponent_score}} {{opponent_name}}\n{{shootout_attempts}}"],
  ["85000000-0000-4000-8000-000000000001", "no_goals", "normal", "Normal", "Keine Tore"],
  ["86000000-0000-4000-8000-000000000001", "no_penalties", "normal", "Normal", "Keine Strafen"],
  ["87000000-0000-4000-8000-000000000001", "missing_goal_scorer", "normal", "Normal", "Torschütze offen"],
  ["88000000-0000-4000-8000-000000000001", "missing_shooter", "normal", "Normal", "Schütze offen"],
  ["89000000-0000-4000-8000-000000000001", "missing_goalie", "normal", "Normal", "Goalie offen"]
].map(([id, outputType, semanticKey, name, template]) => Object.freeze({
  id, outputType, semanticKey, name, template, sortOrder: 10, active: true, default: true, revision: 1
})));

function legacyV2Variants(templates) {
  const ids = {
    goal_mighty: ["10000000-0000-4000-8000-000000000001", "10000000-0000-4000-8000-000000000002", "10000000-0000-4000-8000-000000000003"],
    goal_opponent: ["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002", "20000000-0000-4000-8000-000000000003"],
    penalty: ["30000000-0000-4000-8000-000000000001", "30000000-0000-4000-8000-000000000003", "30000000-0000-4000-8000-000000000002"]
  };
  const semantics = {
    goal_mighty: ["normal", "emotional", "hattrick"],
    goal_opponent: ["normal", "with_scorer", "hattrick"],
    penalty: ["normal", "both", "major"]
  };
  const fields = {
    goal_mighty: ["ownGoalTitle", "ownGoalTemplate"],
    goal_opponent: ["opponentGoalTitle", "opponentGoalTemplate"],
    penalty: ["ownPenaltyTitle", "ownPenaltyTemplate"]
  };
  return Object.entries(fields).flatMap(([outputType, [titleField, templateField]]) => templates.map((template, index) => Object.freeze({
    id: ids[outputType][index] || `legacy:${outputType}:${template.key}`,
    outputType,
    semanticKey: semantics[outputType][index] || null,
    name: template[titleField] || template.title,
    template: template[templateField],
    sortOrder: (index + 1) * 10,
    active: true,
    default: index === 0,
    revision: template.revision,
    legacyStyle: template.key
  })));
}

function normalizeOutputTypes(raw) {
  const types = Array.isArray(raw?.outputTypes) && raw.outputTypes.length ? raw.outputTypes : DEFAULT_OUTPUT_TYPES;
  return types.map(type => {
    const key = String(type?.key || "").trim();
    if (!LIVETICKER_TEMPLATE_CONTEXTS[key]) throw new Error("Ein Liveticker-Ausgabetyp ist unbekannt.");
    return Object.freeze({
      key,
      label: String(type.label || LIVETICKER_TEMPLATE_CONTEXTS[key].label).trim(),
      description: String(type.description || "").trim(),
      category: String(type.category || "ACTION").toUpperCase(),
      sortOrder: Number(type.sortOrder || 0),
      allowedVariables: Object.freeze(Array.isArray(type.allowedVariables) ? type.allowedVariables.map(String) : []),
      requiredVariables: Object.freeze(Array.isArray(type.requiredVariables) ? type.requiredVariables.map(String) : [])
    });
  });
}

function normalizeVariants(raw, legacyTemplates) {
  const source = Array.isArray(raw?.variants) && raw.variants.length
    ? raw.variants
    : [...legacyV2Variants(legacyTemplates), ...DEFAULT_NON_LEGACY_VARIANTS];
  return source.map(variant => {
    const id = String(variant?.id || "").trim();
    const outputType = String(variant?.outputType || "").trim();
    const name = String(variant?.name || "").trim();
    const template = String(variant?.template ?? "");
    if (!id || !name || !LIVETICKER_TEMPLATE_CONTEXTS[outputType]) throw new Error("Eine Liveticker-Ausgabevariante ist unvollständig.");
    assertLivetickerTemplate(template, outputType);
    return Object.freeze({
      id,
      outputType,
      semanticKey: variant.semanticKey ? String(variant.semanticKey) : null,
      name,
      template,
      sortOrder: Number(variant.sortOrder || 0),
      active: variant.active !== false,
      default: variant.default === true,
      revision: Number(variant.revision || 0),
      createdAt: variant.createdAt || null,
      updatedAt: variant.updatedAt || null,
      legacyStyle: variant.legacyStyle ? String(variant.legacyStyle) : null
    });
  });
}

export function normalizeLivetickerTemplateSnapshot(raw) {
  const templates = normalizeLegacyTemplates(raw);
  if (!templates.length && !(Array.isArray(raw?.variants) && raw.variants.length)) {
    throw new Error("Keine Liveticker-Ausgabevarianten verfügbar.");
  }
  const outputTypes = normalizeOutputTypes(raw);
  const variants = normalizeVariants(raw, templates);

  return Object.freeze({
    templates: Object.freeze(templates),
    outputTypes: Object.freeze(outputTypes),
    variants: Object.freeze(variants)
  });
}

export function livetickerVariantsForType(snapshot, outputType, { includeInactive = false } = {}) {
  return Object.freeze((snapshot?.variants || [])
    .filter(variant => variant.outputType === outputType && (includeInactive || variant.active))
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "de")));
}

export function livetickerVariantById(snapshot, outputType, id) {
  const target = String(id || "");
  return (snapshot?.variants || []).find(variant => variant.outputType === outputType && variant.id === target) || null;
}

export function defaultLivetickerVariant(snapshot, outputType) {
  const variants = livetickerVariantsForType(snapshot, outputType);
  return variants.find(variant => variant.default) || variants[0] || DEFAULT_NON_LEGACY_VARIANTS.find(variant => variant.outputType === outputType) || null;
}

export function semanticLivetickerVariant(snapshot, outputType, semanticKey) {
  return livetickerVariantsForType(snapshot, outputType).find(variant => variant.semanticKey === semanticKey) || null;
}

export const LIVETICKER_DEFAULT_TEXTSYSTEM = Object.freeze({
  outputTypes: DEFAULT_OUTPUT_TYPES,
  variants: DEFAULT_NON_LEGACY_VARIANTS,
  templates: Object.freeze([])
});

globalThis.PD_LIVETICKER_TEMPLATE_RENDERER = Object.freeze({
  render: renderLivetickerTemplate
});
globalThis.PD_LIVETICKER_TEXTSYSTEM = Object.freeze({
  LIVETICKER_DEFAULT_TEXTSYSTEM,
  LIVETICKER_OUTPUT_TYPE_KEYS,
  defaultLivetickerVariant,
  livetickerVariantById,
  livetickerVariantsForType,
  renderLivetickerTemplate,
  semanticLivetickerVariant
});
