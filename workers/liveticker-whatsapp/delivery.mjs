export class UnknownStickerError extends Error {
  constructor(stickerId) {
    super(`Unknown or invalid WhatsApp sticker: ${String(stickerId || "missing")}`);
    this.name = "UnknownStickerError";
    this.code = "UNKNOWN_STICKER";
  }
}

export function normalizeSentRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  if (value.text && typeof value.text === "object") return { ...value };
  if (value.messageId || value.sentAt) {
    return {
      ...value,
      text: { messageId: value.messageId || "", sentAt: value.sentAt || new Date().toISOString() }
    };
  }
  return { ...value };
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
  let sentRecord = normalizeSentRecord(initialSentRecord);
  let stickerSentThisRun = false;
  const stickerId = job?.stickerId == null ? "" : String(job.stickerId);

  if (stickerId && !sentRecord.media) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stickerId)) {
      throw new UnknownStickerError(stickerId);
    }
    const asset = await resolveSticker(stickerId);
    if (!validStickerAsset(asset, stickerId)) throw new UnknownStickerError(stickerId);
    const mediaRecord = await sendSticker(asset);
    sentRecord = { ...sentRecord, media: mediaRecord };
    await remember(sentRecord);
    stickerSentThisRun = true;
  }

  if (stickerSentThisRun) await waitAfterSticker();

  if (!sentRecord.text) {
    const textRecord = await sendText(job);
    sentRecord = {
      ...sentRecord,
      text: textRecord,
      messageId: textRecord.messageId,
      sentAt: textRecord.sentAt
    };
    await remember(sentRecord);
  } else if (!sentRecord.messageId || !sentRecord.sentAt) {
    sentRecord = {
      ...sentRecord,
      messageId: sentRecord.text.messageId || "",
      sentAt: sentRecord.text.sentAt || new Date().toISOString()
    };
    await remember(sentRecord);
  }

  return { sentRecord, stickerSentThisRun };
}
