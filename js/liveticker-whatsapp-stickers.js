import { api } from "./api.js";
import {
  WHATSAPP_STICKER_CATEGORIES,
  WHATSAPP_STICKER_SOURCE_MAX_BYTES,
  WHATSAPP_STICKER_SOURCE_TYPES
} from "./liveticker-whatsapp-sticker-core.js?v=20260917-classic-situation-status-r1";

export {
  activeWhatsappStickers,
  classicActionWhatsappStickers,
  situationWhatsappStickers,
  whatsappDeliveryComponentStatus,
  whatsappStickerDeliveryStatus,
  whatsappTextDeliveryForAction,
  whatsappTextDeliveryStatus,
  WHATSAPP_STICKER_CATEGORIES,
  WHATSAPP_STICKER_MAX_BYTES,
  WHATSAPP_STICKER_SIZE,
  WHATSAPP_STICKER_SOURCE_MAX_BYTES,
  WHATSAPP_STICKER_SOURCE_TYPES
} from "./liveticker-whatsapp-sticker-core.js?v=20260917-classic-situation-status-r1";

const previewCache = new Map();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;
const STICKER_AUDIENCES = new Set(["OUR_TEAM", "OPPONENT", "GENERAL"]);
const STICKER_CATEGORIES = new Set(WHATSAPP_STICKER_CATEGORIES);
const DELIVERY_MODES = new Set(["TEXT_ONLY", "STICKER_THEN_TEXT", "STICKER_ONLY"]);
const MAX_MESSAGE_LENGTH = 4000;

export const WHATSAPP_DELIVERY_MODES = Object.freeze({
  TEXT_ONLY: "TEXT_ONLY",
  STICKER_THEN_TEXT: "STICKER_THEN_TEXT",
  STICKER_ONLY: "STICKER_ONLY"
});

function requireUuid(value, label) {
  const normalized = String(value || "").trim();
  if (!UUID_PATTERN.test(normalized)) throw new Error(`${label} ist ungültig.`);
  return normalized;
}

function optionalActionId(value) {
  if (value == null || value === "") return null;
  const normalized = String(value).trim();
  if (!ACTION_ID_PATTERN.test(normalized)) throw new Error("Die Liveticker-Aktionsreferenz ist ungültig.");
  return normalized;
}

function generatedIdempotencyKey(value) {
  if (value != null && value !== "") return requireUuid(value, "Der Versandvorgang");
  if (typeof globalThis.crypto?.randomUUID !== "function") {
    throw new Error("Der Browser kann keinen sicheren Versandvorgang erzeugen.");
  }
  return globalThis.crypto.randomUUID();
}

function normalizedMessage(value) {
  if (value == null) return null;
  const message = String(value).trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    throw new Error("Der WhatsApp-Text muss zwischen 1 und 4.000 Zeichen lang sein.");
  }
  return message;
}

function deliveryPayload({
  eventId,
  deliveryMode,
  stickerId = null,
  message = null,
  linkedActionId = null,
  idempotencyKey = null
}) {
  const mode = String(deliveryMode || "").trim().toUpperCase();
  if (!DELIVERY_MODES.has(mode)) throw new Error("Der WhatsApp-Versandmodus ist ungültig.");
  const normalizedStickerId = stickerId == null || stickerId === ""
    ? null
    : requireUuid(stickerId, "Der Sticker");
  const normalizedText = normalizedMessage(message);
  if (mode === "TEXT_ONLY" && (normalizedStickerId || !normalizedText)) {
    throw new Error("Nur-Text-Versand benötigt Text und darf keinen Sticker enthalten.");
  }
  if (mode === "STICKER_THEN_TEXT" && (!normalizedStickerId || !normalizedText)) {
    throw new Error("Sticker-und-Text-Versand benötigt beide Komponenten.");
  }
  if (mode === "STICKER_ONLY" && (!normalizedStickerId || normalizedText)) {
    throw new Error("Nur-Sticker-Versand benötigt einen Sticker und darf keinen Text enthalten.");
  }

  const payload = {
    eventId: requireUuid(eventId, "Das Spiel"),
    deliveryMode: mode,
    idempotencyKey: generatedIdempotencyKey(idempotencyKey)
  };
  if (normalizedStickerId) payload.stickerId = normalizedStickerId;
  if (normalizedText) payload.message = normalizedText;
  const actionId = optionalActionId(linkedActionId);
  if (actionId) payload.linkedActionId = actionId;
  return Object.freeze(payload);
}

export function createWhatsappDeliveryRequest(options) {
  const payload = deliveryPayload(options || {});
  return Object.freeze({
    idempotencyKey: payload.idempotencyKey,
    payload,
    send: () => api.call("liveticker_whatsapp_delivery_enqueue", payload)
  });
}

export function createWhatsappStickerOnlyRequest({
  eventId,
  stickerId,
  linkedActionId = null,
  idempotencyKey = null
}) {
  const payload = {
    eventId: requireUuid(eventId, "Das Spiel"),
    stickerId: requireUuid(stickerId, "Der Sticker"),
    idempotencyKey: generatedIdempotencyKey(idempotencyKey)
  };
  const actionId = optionalActionId(linkedActionId);
  if (actionId) payload.linkedActionId = actionId;
  const stablePayload = Object.freeze(payload);
  return Object.freeze({
    idempotencyKey: stablePayload.idempotencyKey,
    payload: stablePayload,
    send: () => api.call("liveticker_whatsapp_sticker_enqueue", stablePayload)
  });
}

export function validateWhatsappStickerSourceFile(file) {
  if (!(file instanceof File)) throw new Error("Bitte eine Sticker-Datei auswählen.");
  if (!WHATSAPP_STICKER_SOURCE_TYPES.includes(file.type)) {
    throw new Error("Sticker können als PNG, JPG/JPEG oder WebP hochgeladen werden.");
  }
  if (file.size < 1 || file.size > WHATSAPP_STICKER_SOURCE_MAX_BYTES) {
    throw new Error("Die Quelldatei darf höchstens 5 MiB groß sein.");
  }
  return file;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Sticker-Vorschau konnte nicht gelesen werden."));
    reader.readAsDataURL(blob);
  });
}

export async function whatsappStickerPreviewDataUrl(stickerId) {
  const id = String(stickerId || "");
  if (previewCache.has(id)) return previewCache.get(id);
  const promise = api.fetchLivetickerWhatsappSticker(id).then(blobToDataUrl).catch(error => {
    previewCache.delete(id);
    throw error;
  });
  previewCache.set(id, promise);
  return promise;
}

export function clearWhatsappStickerPreview(stickerId) {
  previewCache.delete(String(stickerId || ""));
}

export async function loadWhatsappStickerLibrary({ includeInactive = false, previews = true } = {}) {
  const result = await api.call("liveticker_whatsapp_stickers_list", { includeInactive: Boolean(includeInactive) });
  const stickers = Array.isArray(result?.stickers) ? result.stickers : [];
  if (!previews) return stickers;
  return Promise.all(stickers.map(async sticker => {
    try {
      return { ...sticker, previewDataUrl: await whatsappStickerPreviewDataUrl(sticker.id) };
    } catch {
      return { ...sticker, previewDataUrl: "" };
    }
  }));
}

export async function enqueueWhatsappStickerOnly({
  eventId,
  stickerId,
  linkedActionId = null,
  idempotencyKey = null
}) {
  return createWhatsappStickerOnlyRequest({
    eventId,
    stickerId,
    linkedActionId,
    idempotencyKey
  }).send();
}

export async function enqueueWhatsappDelivery(options) {
  return createWhatsappDeliveryRequest(options).send();
}

export async function linkWhatsappStickerDelivery({ jobId, actionId }) {
  const normalizedActionId = optionalActionId(actionId);
  if (!normalizedActionId) throw new Error("Die Liveticker-Aktionsreferenz fehlt.");
  return api.call("liveticker_whatsapp_delivery_link", {
    jobId: requireUuid(jobId, "Der Versandauftrag"),
    actionId: normalizedActionId
  });
}

export async function loadWhatsappDeliveries(eventId) {
  return api.call("liveticker_whatsapp_deliveries_list", {
    eventId: requireUuid(eventId, "Das Spiel")
  });
}

export async function retryWhatsappDelivery({ eventId, jobId }) {
  return api.call("liveticker_whatsapp_delivery_retry", {
    eventId: requireUuid(eventId, "Das Spiel"),
    jobId: requireUuid(jobId, "Der Versandauftrag")
  });
}

export async function setWhatsappStickerMetadata({
  stickerId,
  audience,
  category,
  opponentTeamId = null
}) {
  const normalizedAudience = String(audience || "").trim().toUpperCase();
  const normalizedCategory = String(category || "").trim().toUpperCase();
  if (!STICKER_AUDIENCES.has(normalizedAudience)) throw new Error("Die Sticker-Zielgruppe ist ungültig.");
  if (!STICKER_CATEGORIES.has(normalizedCategory)) throw new Error("Die Sticker-Kategorie ist ungültig.");
  const teamId = opponentTeamId == null || opponentTeamId === ""
    ? null
    : requireUuid(opponentTeamId, "Das Gegnerteam");
  if ((normalizedAudience === "OPPONENT") !== Boolean(teamId)) {
    throw new Error("Gegner-Sticker benötigen genau ein Gegnerteam.");
  }
  return api.call("liveticker_whatsapp_sticker_metadata_set", {
    stickerId: requireUuid(stickerId, "Der Sticker"),
    audience: normalizedAudience,
    opponentTeamId: teamId,
    category: normalizedCategory
  });
}
