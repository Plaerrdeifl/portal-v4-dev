export const WHATSAPP_STICKER_SIZE = 512;
export const WHATSAPP_STICKER_MAX_BYTES = 100 * 1024;
export const WHATSAPP_STICKER_SOURCE_MAX_BYTES = 5 * 1024 * 1024;
export const WHATSAPP_STICKER_SOURCE_TYPES = Object.freeze(["image/png", "image/webp"]);

export function activeWhatsappStickers(stickers) {
  return Array.isArray(stickers) ? stickers.filter(sticker => sticker?.active === true) : [];
}
