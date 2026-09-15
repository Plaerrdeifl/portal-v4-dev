import { api } from "./api.js";
import {
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
