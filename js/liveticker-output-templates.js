export const LIVETICKER_TEMPLATE_VARIABLES = Object.freeze([
  Object.freeze({ key: "minute", label: "Spielminute", optional: false, contexts: Object.freeze(["own", "opponent"]) }),
  Object.freeze({ key: "scorer", label: "Torschütze (mit Trikotnummer)", optional: true, contexts: Object.freeze(["own", "opponent"]) }),
  Object.freeze({ key: "assists", label: "Assists (mit Trikotnummern)", optional: true, contexts: Object.freeze(["own", "opponent"]) }),
  Object.freeze({ key: "mighty_score", label: "Tore Mighty Dogs", optional: false, contexts: Object.freeze(["own", "opponent"]) }),
  Object.freeze({ key: "opponent_score", label: "Tore Gegner", optional: false, contexts: Object.freeze(["own", "opponent"]) }),
  Object.freeze({ key: "opponent_name", label: "Kurzname Gegner", optional: false, contexts: Object.freeze(["opponent"]) })
]);

export const LIVETICKER_TEMPLATE_CONTEXTS = Object.freeze({
  own: Object.freeze({
    field: "ownGoalTemplate",
    label: "Eigenes Tor",
    required: Object.freeze(["minute", "mighty_score", "opponent_score"])
  }),
  opponent: Object.freeze({
    field: "opponentGoalTemplate",
    label: "Gegnertor",
    required: Object.freeze(["minute", "mighty_score", "opponent_score", "opponent_name"])
  })
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
  const variables = [...body.matchAll(TOKEN_PATTERN)].map(match => match[1].trim());
  const unknownVariables = [...new Set(variables.filter(variable => !VARIABLE_KEYS.includes(variable)))];
  const missingVariables = context.required.filter(variable => !variables.includes(variable));
  const withoutValidTokens = body.replace(EXACT_TOKEN_PATTERN, "");
  const malformed = /\{\{|\}\}/.test(withoutValidTokens);
  const errors = [];

  if (!body.trim()) errors.push("Der Ausgabetext darf nicht leer sein.");
  if (body.length > 4000) errors.push("Der Ausgabetext darf maximal 4.000 Zeichen haben.");
  if (malformed) errors.push("Mindestens ein Platzhalter ist technisch ungültig.");
  if (unknownVariables.length) errors.push(`Unbekannte Platzhalter: ${unknownVariables.map(templateToken).join(", ")}.`);
  if (missingVariables.length) errors.push(`Pflichtplatzhalter fehlen: ${missingVariables.map(templateToken).join(", ")}.`);

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

export function normalizeLivetickerTemplateSnapshot(raw) {
  const templates = Array.isArray(raw?.templates) ? raw.templates : [];
  if (!templates.length) throw new Error("Keine Liveticker-Ausgabevarianten verfügbar.");

  const normalized = templates.map(template => {
    const key = String(template?.key || "").trim();
    const title = String(template?.title || "").trim();
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(key) || !title) {
      throw new Error("Eine Liveticker-Ausgabevariante ist unvollständig.");
    }
    assertLivetickerTemplate(template.ownGoalTemplate, "own");
    assertLivetickerTemplate(template.opponentGoalTemplate, "opponent");
    return Object.freeze({
      key,
      title,
      ownGoalTemplate: String(template.ownGoalTemplate),
      opponentGoalTemplate: String(template.opponentGoalTemplate),
      revision: Number(template.revision || 0)
    });
  });

  return Object.freeze({ templates: Object.freeze(normalized) });
}

globalThis.PD_LIVETICKER_TEMPLATE_RENDERER = Object.freeze({
  render: renderLivetickerTemplate
});
