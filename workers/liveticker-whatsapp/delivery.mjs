export class UnknownStickerError extends Error {
  constructor(stickerId) {
    super(`Unknown or invalid WhatsApp sticker: ${String(stickerId || "missing")}`);
    this.name = "UnknownStickerError";
    this.code = "UNKNOWN_STICKER";
  }
}

export class InvalidWhatsappJobError extends Error {
  constructor(message = "WhatsApp job has no valid delivery components") {
    super(message);
    this.name = "InvalidWhatsappJobError";
    this.code = "INVALID_WHATSAPP_JOB";
  }
}

export const WHATSAPP_DELIVERY_MODES = Object.freeze({
  TEXT_ONLY: "TEXT_ONLY",
  STICKER_THEN_TEXT: "STICKER_THEN_TEXT",
  STICKER_ONLY: "STICKER_ONLY"
});

export function normalizeSentRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  if (value.text && typeof value.text === "object") return { ...value };
  if (!value.media && (value.messageId || value.sentAt)) {
    return {
      ...value,
      text: { messageId: value.messageId || "", sentAt: value.sentAt || new Date().toISOString() }
    };
  }
  return { ...value };
}

function nonEmptyMessage(job) {
  return typeof job?.message === "string" && job.message.trim().length > 0;
}

function stickerReference(job) {
  return job?.stickerId == null ? "" : String(job.stickerId).trim();
}

export function deliveryModeForJob(job) {
  const stickerId = stickerReference(job);
  const hasSticker = Boolean(stickerId);
  const hasText = nonEmptyMessage(job);
  const explicit = String(job?.deliveryMode || "").trim().toUpperCase();
  const mode = explicit || (hasSticker && hasText
    ? WHATSAPP_DELIVERY_MODES.STICKER_THEN_TEXT
    : hasSticker
    ? WHATSAPP_DELIVERY_MODES.STICKER_ONLY
    : hasText
    ? WHATSAPP_DELIVERY_MODES.TEXT_ONLY
    : "");

  const valid = mode === WHATSAPP_DELIVERY_MODES.TEXT_ONLY
    ? hasText && !hasSticker
    : mode === WHATSAPP_DELIVERY_MODES.STICKER_THEN_TEXT
    ? hasText && hasSticker
    : mode === WHATSAPP_DELIVERY_MODES.STICKER_ONLY
    ? hasSticker && !hasText
    : false;
  if (!valid) throw new InvalidWhatsappJobError();
  return mode;
}

export function sentRecordFromJob(job) {
  const record = {};
  if (job?.stickerStatus === "SENT" && job?.stickerSentAt) {
    record.media = {
      messageId: String(job.stickerMessageId || ""),
      sentAt: String(job.stickerSentAt)
    };
  }
  if (job?.textStatus === "SENT" && job?.textSentAt) {
    record.text = {
      messageId: String(job.textMessageId || ""),
      sentAt: String(job.textSentAt)
    };
  }
  const finalRecord = record.text || record.media;
  if (finalRecord) {
    record.messageId = finalRecord.messageId;
    record.sentAt = finalRecord.sentAt;
  }
  return record;
}

export function mergeSentRecords(primary, fallback) {
  const first = normalizeSentRecord(primary);
  const second = normalizeSentRecord(fallback);
  const media = first.media || second.media;
  const text = first.text || second.text;
  const finalRecord = text || media;
  return {
    ...second,
    ...first,
    ...(media ? { media } : {}),
    ...(text ? { text } : {}),
    ...(finalRecord ? { messageId: finalRecord.messageId || "", sentAt: finalRecord.sentAt } : {})
  };
}

export function failedComponentForJob(job, sentRecord) {
  const mode = deliveryModeForJob(job);
  const normalized = normalizeSentRecord(sentRecord);
  if (mode !== WHATSAPP_DELIVERY_MODES.TEXT_ONLY && !normalized.media) return "STICKER";
  if (mode !== WHATSAPP_DELIVERY_MODES.STICKER_ONLY && !normalized.text) return "TEXT";
  return null;
}

function validStickerAsset(asset, stickerId) {
  return asset
    && typeof asset === "object"
    && asset.id === stickerId
    && asset.mimetype === "image/webp"
    && typeof asset.filename === "string"
    && asset.filename.endsWith(".webp")
    && typeof asset.data === "string"
    && asset.data.length > 0;
}

export async function deliverWhatsappJob({
  job,
  sentRecord: initialSentRecord,
  resolveSticker,
  sendSticker,
  sendText,
  remember,
  waitAfterSticker
}) {
  const deliveryMode = deliveryModeForJob(job);
  const wantsSticker = deliveryMode !== WHATSAPP_DELIVERY_MODES.TEXT_ONLY;
  const wantsText = deliveryMode !== WHATSAPP_DELIVERY_MODES.STICKER_ONLY;
  let sentRecord = normalizeSentRecord(initialSentRecord);
  let stickerSentThisRun = false;
  const stickerId = stickerReference(job);

  if (wantsSticker && !sentRecord.media) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stickerId)) {
      throw new UnknownStickerError(stickerId);
    }
    const asset = await resolveSticker(stickerId);
    if (!validStickerAsset(asset, stickerId)) throw new UnknownStickerError(stickerId);
    const mediaRecord = await sendSticker(asset);
    sentRecord = {
      ...sentRecord,
      media: mediaRecord,
      ...(!wantsText ? { messageId: mediaRecord.messageId || "", sentAt: mediaRecord.sentAt } : {})
    };
    await remember(sentRecord);
    stickerSentThisRun = true;
  }

  if (stickerSentThisRun && wantsText) await waitAfterSticker();

  if (wantsText && !sentRecord.text) {
    const textRecord = await sendText(job);
    sentRecord = {
      ...sentRecord,
      text: textRecord,
      messageId: textRecord.messageId,
      sentAt: textRecord.sentAt
    };
    await remember(sentRecord);
  } else if (wantsText && (!sentRecord.messageId || !sentRecord.sentAt)) {
    sentRecord = {
      ...sentRecord,
      messageId: sentRecord.text.messageId || "",
      sentAt: sentRecord.text.sentAt || new Date().toISOString()
    };
    await remember(sentRecord);
  } else if (!wantsText && sentRecord.media && (!sentRecord.messageId || !sentRecord.sentAt)) {
    sentRecord = {
      ...sentRecord,
      messageId: sentRecord.media.messageId || "",
      sentAt: sentRecord.media.sentAt || new Date().toISOString()
    };
    await remember(sentRecord);
  }

  return { sentRecord, stickerSentThisRun, deliveryMode };
}
