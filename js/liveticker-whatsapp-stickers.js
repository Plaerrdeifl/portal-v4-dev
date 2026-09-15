import { api } from "./api.js";
import {
  WHATSAPP_STICKER_MAX_BYTES,
  WHATSAPP_STICKER_SIZE,
  WHATSAPP_STICKER_SOURCE_MAX_BYTES,
  WHATSAPP_STICKER_SOURCE_TYPES
} from "./liveticker-whatsapp-sticker-core.js";

export {
  activeWhatsappStickers,
  WHATSAPP_STICKER_MAX_BYTES,
  WHATSAPP_STICKER_SIZE,
  WHATSAPP_STICKER_SOURCE_MAX_BYTES,
  WHATSAPP_STICKER_SOURCE_TYPES
} from "./liveticker-whatsapp-sticker-core.js";

const previewCache = new Map();

function canvasToBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, "image/webp", quality));
}

async function decodeStickerSource(file) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Sticker konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Sticker konnte nicht als Bild geöffnet werden."));
    image.src = dataUrl;
  });
}

export async function normalizeWhatsappStickerFile(file) {
  if (!(file instanceof File)) throw new Error("Bitte eine Sticker-Datei auswählen.");
  if (!WHATSAPP_STICKER_SOURCE_TYPES.includes(file.type)) {
    throw new Error("Sticker können als PNG oder WebP hochgeladen werden.");
  }
  if (file.size < 1 || file.size > WHATSAPP_STICKER_SOURCE_MAX_BYTES) {
    throw new Error("Die Quelldatei darf höchstens 5 MiB groß sein.");
  }

  const source = await decodeStickerSource(file);
  const width = Number(source.width || source.naturalWidth || 0);
  const height = Number(source.height || source.naturalHeight || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    source.close?.();
    throw new Error("Die Bildabmessungen sind ungültig.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = WHATSAPP_STICKER_SIZE;
  canvas.height = WHATSAPP_STICKER_SIZE;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) {
    source.close?.();
    throw new Error("Der Sticker konnte im Browser nicht vorbereitet werden.");
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  const scale = Math.min(canvas.width / width, canvas.height / height);
  const drawWidth = Math.max(1, Math.round(width * scale));
  const drawHeight = Math.max(1, Math.round(height * scale));
  const x = Math.round((canvas.width - drawWidth) / 2);
  const y = Math.round((canvas.height - drawHeight) / 2);
  context.drawImage(source, x, y, drawWidth, drawHeight);
  source.close?.();

  let output = null;
  for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
    output = await canvasToBlob(canvas, quality);
    if (output?.type === "image/webp" && output.size <= WHATSAPP_STICKER_MAX_BYTES) break;
  }
  if (!output || output.type !== "image/webp") {
    throw new Error("Dieser Browser kann den Sticker nicht zuverlässig als WebP vorbereiten.");
  }
  if (output.size > WHATSAPP_STICKER_MAX_BYTES) {
    throw new Error("Der normalisierte Sticker überschreitet 100 KiB. Bitte die Quelldatei vereinfachen.");
  }
  return new File([output], `sticker-${crypto.randomUUID()}.webp`, { type: "image/webp" });
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
