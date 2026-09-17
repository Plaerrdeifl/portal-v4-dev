export const WHATSAPP_STICKER_SIZE = 512;
export const WHATSAPP_STICKER_MAX_BYTES = 100 * 1024;
export const WHATSAPP_STICKER_SOURCE_MAX_BYTES = 5 * 1024 * 1024;
export const WHATSAPP_STICKER_SOURCE_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp"]);
export const WHATSAPP_STICKER_CATEGORIES = Object.freeze([
  "GOAL",
  "AGAINST",
  "PENALTY",
  "GAME_SITUATION",
  "VIDEO_REVIEW",
  "GENERAL"
]);

function upper(value, fallback = "") {
  return String(value || fallback).trim().toUpperCase();
}

export function activeWhatsappStickers(stickers) {
  return Array.isArray(stickers) ? stickers.filter(sticker => sticker?.active === true) : [];
}

function stickersFor(stickers, { audience, category, opponentTeamId = "" }) {
  const expectedAudience = upper(audience);
  const expectedCategory = upper(category);
  const expectedOpponent = String(opponentTeamId || "").trim();
  return activeWhatsappStickers(stickers).filter(sticker => {
    if (upper(sticker.audience, "GENERAL") !== expectedAudience) return false;
    if (upper(sticker.category, "GENERAL") !== expectedCategory) return false;
    return expectedAudience !== "OPPONENT"
      || String(sticker.opponentTeamId || "") === expectedOpponent;
  });
}

export function classicActionWhatsappStickers(stickers, {
  action,
  opponentTeamId = "",
  penaltyTeams = []
} = {}) {
  const selectedAction = upper(action);
  if (selectedAction === "GOAL_MIGHTY") {
    return stickersFor(stickers, { audience: "OUR_TEAM", category: "GOAL" });
  }
  if (selectedAction === "GOAL_OPPONENT") {
    return stickersFor(stickers, {
      audience: "OPPONENT",
      category: "AGAINST",
      opponentTeamId
    });
  }
  if (selectedAction !== "PENALTY") return [];
  const teams = [...new Set((Array.isArray(penaltyTeams) ? penaltyTeams : []).map(upper).filter(Boolean))];
  if (teams.length !== 1) return [];
  return teams[0] === "OPPONENT"
    ? stickersFor(stickers, { audience: "OPPONENT", category: "PENALTY", opponentTeamId })
    : teams[0] === "MIGHTY"
      ? stickersFor(stickers, { audience: "OUR_TEAM", category: "PENALTY" })
      : [];
}

export function gameSituationWhatsappStickers(stickers, { opponentTeamId = "" } = {}) {
  const expectedOpponent = String(opponentTeamId || "").trim();
  return activeWhatsappStickers(stickers).filter(sticker => {
    if (upper(sticker.category, "GENERAL") !== "GAME_SITUATION") return false;
    return upper(sticker.audience, "GENERAL") !== "OPPONENT"
      || String(sticker.opponentTeamId || "") === expectedOpponent;
  });
}

export function generalWhatsappStickers(stickers) {
  return stickersFor(stickers, { audience: "GENERAL", category: "GENERAL" });
}

export function whatsappStickerDeliveryStatus(delivery) {
  const status = upper(delivery?.stickerStatus, "NOT_REQUESTED");
  if (status === "SENT") return Object.freeze({ label: "GESENDET ✓", tone: "success", retryable: false });
  if (status === "FAILED") {
    return Object.freeze({ label: "FEHLGESCHLAGEN – MANUELL EINGREIFEN", tone: "error", retryable: true });
  }
  if (status === "PENDING" && Number(delivery?.attemptCount || 0) > 1) {
    return Object.freeze({ label: "WIRD ERNEUT VERSUCHT …", tone: "pending", retryable: false });
  }
  if (status === "PENDING") return Object.freeze({ label: "WIRD GESENDET …", tone: "pending", retryable: false });
  return Object.freeze({ label: "NOCH NICHT GESENDET", tone: "muted", retryable: false });
}
