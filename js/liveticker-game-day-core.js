const COMPONENT_STATUSES = Object.freeze({
  NOT_REQUESTED: Object.freeze({ label: "nicht angefordert", tone: "muted" }),
  PENDING: Object.freeze({ label: "wird gesendet …", tone: "pending" }),
  SENT: Object.freeze({ label: "gesendet", tone: "success" }),
  FAILED: Object.freeze({ label: "fehlgeschlagen", tone: "error" })
});

function upper(value, fallback = "") {
  return String(value || fallback).trim().toUpperCase();
}

export function activeGameDayStickers(stickers, {
  audience,
  category = "",
  opponentTeamId = "",
  strictCategory = false
} = {}) {
  const expectedAudience = upper(audience);
  const expectedCategory = upper(category);
  const expectedOpponent = String(opponentTeamId || "").trim();
  const active = (Array.isArray(stickers) ? stickers : []).filter(sticker => {
    if (!sticker?.active) return false;
    if (upper(sticker.audience, "GENERAL") !== expectedAudience) return false;
    if (expectedAudience === "OPPONENT"
      && String(sticker.opponentTeamId || "") !== expectedOpponent) return false;
    return true;
  });
  if (!expectedCategory) return active;
  const contextual = active.filter(sticker => upper(sticker.category, "GENERAL") === expectedCategory);
  return strictCategory || contextual.length ? contextual : active;
}

export function scoreFromHistory(history) {
  return (Array.isArray(history) ? history : []).reduce((score, action) => {
    if (action?.type !== "goal") return score;
    if (action.team === "mighty") score.own += 1;
    if (action.team === "opponent") score.opponent += 1;
    return score;
  }, { own: 0, opponent: 0 });
}

export function periodFromMinute(minute) {
  const value = Math.max(1, Number.parseInt(minute, 10) || 1);
  if (value <= 20) return { code: "PERIOD_1", label: "1. Drittel" };
  if (value <= 40) return { code: "PERIOD_2", label: "2. Drittel" };
  if (value <= 60) return { code: "PERIOD_3", label: "3. Drittel" };
  return { code: "OVERTIME", label: "Verlängerung / Penaltyschießen" };
}

export function gameDayHeaderModel({ state, game }) {
  const score = scoreFromHistory(state?.history);
  const homeAway = upper(game?.homeAway, "HOME");
  const ownName = game?.ownTeam?.shortName || game?.ownTeam?.name || "Mighty Dogs";
  const opponentName = game?.opponentTeam?.shortName || game?.opponentTeam?.name || "Gegner";
  return {
    homeName: homeAway === "AWAY" ? opponentName : ownName,
    awayName: homeAway === "AWAY" ? ownName : opponentName,
    homeScore: homeAway === "AWAY" ? score.opponent : score.own,
    awayScore: homeAway === "AWAY" ? score.own : score.opponent,
    minute: Math.max(1, Number.parseInt(state?.minute, 10) || 1),
    period: periodFromMinute(state?.minute),
    completed: Boolean(state?.completedAt)
  };
}

export function deliveryComponentStatus(status) {
  const key = upper(status, "NOT_REQUESTED");
  return COMPONENT_STATUSES[key] || COMPONENT_STATUSES.NOT_REQUESTED;
}

function actionLabel(action) {
  if (action?.type === "goal") {
    const prefix = action.team === "opponent" ? "GEGENTOR" : "TOR";
    const number = action.player?.number ? ` #${action.player.number}` : "";
    const name = action.player?.name ? ` ${action.player.name}` : "";
    return `${prefix}${number}${name}`;
  }
  if (action?.type === "penalty") return "STRAFE";
  if (action?.type === "shootout") return "PENALTYSCHIESSEN";
  return "LIVETICKER-AKTION";
}

export function gameDayTimeline(history, deliveries) {
  const actions = (Array.isArray(history) ? history : []).map(action => ({
    kind: "action",
    id: `action:${action.id}`,
    actionId: action.id,
    minute: action.minute || null,
    timestamp: Number(action.createdAt || action.updatedAt || 0),
    label: actionLabel(action),
    action
  }));
  const deliveryItems = (Array.isArray(deliveries) ? deliveries : []).map(delivery => ({
    kind: "delivery",
    id: `delivery:${delivery.id}`,
    actionId: delivery.linkedActionId || null,
    minute: null,
    timestamp: Date.parse(delivery.createdAt || "") || 0,
    label: delivery.deliveryMode === "STICKER_ONLY" ? "Sticker" : "WhatsApp",
    delivery
  }));
  return [...actions, ...deliveryItems].sort((left, right) => right.timestamp - left.timestamp);
}

export function newActionId(beforeHistory, afterHistory) {
  const previous = new Set((Array.isArray(beforeHistory) ? beforeHistory : []).map(item => item?.id));
  const added = (Array.isArray(afterHistory) ? afterHistory : []).filter(item => item?.id && !previous.has(item.id));
  return added.length === 1 ? added[0].id : null;
}
