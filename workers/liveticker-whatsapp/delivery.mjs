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
  STICKER_ONLY: "STICKER_ONLY",
  IMAGE_WITH_CAPTION: "IMAGE_WITH_CAPTION"
});

export const WHATSAPP_DELIVERY_WINDOW_MS = 5000;
export const WHATSAPP_SEND_BUDGET_MS = 4000;
export const NEWSLETTER_RECOVERY_DELAYS_MS = Object.freeze([600, 900]);

export function isNewsletterChatStoreError(error) {
  return /chat not found in chatstore for\s+[^\s]+@newsletter/i.test(
    String(error?.message || error || "")
  );
}

export async function sendWithNewsletterRecovery({
  send,
  resolveNewsletter,
  markRetrying,
  remainingMs,
  sleep = delay => new Promise(resolve => setTimeout(resolve, delay))
}) {
  if (typeof send !== "function" || typeof remainingMs !== "function") {
    throw new TypeError("Invalid WhatsApp recovery configuration");
  }

  let lastError = null;
  for (let attempt = 0; attempt <= NEWSLETTER_RECOVERY_DELAYS_MS.length; attempt += 1) {
    const available = Math.floor(remainingMs());
    if (available <= 0) {
      throw lastError || new Error("WhatsApp delivery window exceeded");
    }
    try {
      return await send(available);
    } catch (error) {
      lastError = error;
      const delay = NEWSLETTER_RECOVERY_DELAYS_MS[attempt];
      if (!isNewsletterChatStoreError(error) || delay == null) throw error;

      const beforeRecovery = Math.floor(remainingMs());
      if (beforeRecovery <= delay) throw error;
      if (typeof markRetrying === "function") await markRetrying(error, attempt + 2);
      if (attempt === 0 && typeof resolveNewsletter === "function") {
        try {
          await resolveNewsletter(Math.max(1, Math.min(750, Math.floor(remainingMs()) - delay)));
        } catch {
          // A failed resolve must not open a second retry policy. The same
          // bounded WPP send path below remains the authoritative result.
        }
      }
      const afterRecovery = Math.floor(remainingMs());
      if (afterRecovery <= delay) throw error;
      await sleep(delay);
    }
  }
  throw lastError || new Error("WhatsApp delivery failed");
}

export function normalizeSentRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  if (value.text && typeof value.text === "object") return { ...value };
  if (!value.media && !value.image && (value.messageId || value.sentAt)) {
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

function imageReference(job) {
  const url = String(job?.imageUrl || "").trim();
  const filename = String(job?.imageFilename || "").trim();
  return {
    url,
    filename,
    valid: /^https:\/\/cloud[.]plaerrdeifl[.]de\/s\/[A-Za-z0-9]{8,128}\/download$/.test(url)
      && /^[A-Za-z0-9._-]{1,96}[.]png$/.test(filename)
  };
}

export function deliveryModeForJob(job) {
  const stickerId = stickerReference(job);
  const hasSticker = Boolean(stickerId);
  const hasText = nonEmptyMessage(job);
  const image = imageReference(job);
  const hasImage = image.valid;
  const explicit = String(job?.deliveryMode || "").trim().toUpperCase();
  const mode = explicit || (hasSticker && hasText
    ? WHATSAPP_DELIVERY_MODES.STICKER_THEN_TEXT
    : hasSticker
    ? WHATSAPP_DELIVERY_MODES.STICKER_ONLY
    : hasText
    ? WHATSAPP_DELIVERY_MODES.TEXT_ONLY
    : hasImage
    ? WHATSAPP_DELIVERY_MODES.IMAGE_WITH_CAPTION
    : "");

  const valid = mode === WHATSAPP_DELIVERY_MODES.TEXT_ONLY
    ? hasText && !hasSticker && !hasImage
    : mode === WHATSAPP_DELIVERY_MODES.STICKER_THEN_TEXT
    ? hasText && hasSticker && !hasImage
    : mode === WHATSAPP_DELIVERY_MODES.STICKER_ONLY
    ? hasSticker && !hasText && !hasImage
    : mode === WHATSAPP_DELIVERY_MODES.IMAGE_WITH_CAPTION
    ? hasImage && !hasSticker && hasText
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
  if (job?.imageStatus === "SENT" && job?.imageSentAt) {
    record.image = {
      messageId: String(job.imageMessageId || ""),
      sentAt: String(job.imageSentAt)
    };
  }
  const finalRecord = record.text || record.image || record.media;
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
  const image = first.image || second.image;
  const finalRecord = text || image || media;
  return {
    ...second,
    ...first,
    ...(media ? { media } : {}),
    ...(text ? { text } : {}),
    ...(image ? { image } : {}),
    ...(finalRecord ? { messageId: finalRecord.messageId || "", sentAt: finalRecord.sentAt } : {})
  };
}

export function failedComponentForJob(job, sentRecord) {
  const mode = deliveryModeForJob(job);
  const normalized = normalizeSentRecord(sentRecord);
  if (mode === WHATSAPP_DELIVERY_MODES.IMAGE_WITH_CAPTION) return normalized.image ? null : "IMAGE";
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
  sendImage,
  remember,
  waitAfterSticker
}) {
  const deliveryMode = deliveryModeForJob(job);
  const wantsImage = deliveryMode === WHATSAPP_DELIVERY_MODES.IMAGE_WITH_CAPTION;
  const wantsSticker = !wantsImage && deliveryMode !== WHATSAPP_DELIVERY_MODES.TEXT_ONLY;
  const wantsText = !wantsImage && deliveryMode !== WHATSAPP_DELIVERY_MODES.STICKER_ONLY;
  let sentRecord = normalizeSentRecord(initialSentRecord);
  let stickerSentThisRun = false;
  let imageSentThisRun = false;
  const stickerId = stickerReference(job);

  if (wantsImage && !sentRecord.image) {
    if (typeof sendImage !== "function") throw new InvalidWhatsappJobError();
    const imageRecord = await sendImage(job);
    sentRecord = {
      ...sentRecord,
      image: imageRecord,
      messageId: imageRecord.messageId || "",
      sentAt: imageRecord.sentAt
    };
    await remember(sentRecord);
    imageSentThisRun = true;
  }

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

  return { sentRecord, stickerSentThisRun, imageSentThisRun, deliveryMode };
}
