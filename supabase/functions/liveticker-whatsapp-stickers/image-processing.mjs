import {
  AlphaAction,
  CompositeOperator,
  Gravity,
  ImageMagick,
  Magick,
  MagickColors,
  MagickFormat,
  ResourceLimits,
  initializeImageMagick
} from "@imagemagick/magick-wasm";

export const STICKER_WIDTH = 512;
export const STICKER_HEIGHT = 512;
export const STICKER_MAX_BYTES = 100 * 1024;
export const STICKER_SOURCE_MAX_BYTES = 5 * 1024 * 1024;
export const STICKER_SOURCE_MAX_DIMENSION = 8192;
export const STICKER_SOURCE_MAX_PIXELS = 16_000_000;
export const STICKER_WEBP_MAX_QUALITY = 90;
export const STICKER_WEBP_MIN_QUALITY = 20;

const SUPPORTED_MIME_TYPES = Object.freeze(["image/png", "image/jpeg", "image/webp"]);
let magickInitialization;

export class StickerProcessingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "StickerProcessingError";
    this.code = code;
  }
}

function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function pngInfo(bytes) {
  if (bytes.byteLength < 33
      || !bytes.subarray(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])
      || ascii(bytes, 12, 4) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  let offset = 8;
  while (offset + 12 <= bytes.byteLength) {
    const length = view.getUint32(offset, false);
    const kind = ascii(bytes, offset + 4, 4);
    const next = offset + 12 + length;
    if (next > bytes.byteLength) return null;
    if (kind === "acTL") return { mimeType: "image/png", width, height, animated: true };
    if (kind === "IEND") break;
    offset = next;
  }
  return { mimeType: "image/png", width, height, animated: false };
}

function jpegInfo(bytes) {
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.byteLength) {
    while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.byteLength) return null;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.byteLength) return null;
    const length = view.getUint16(offset, false);
    if (length < 2 || offset + length > bytes.byteLength) return null;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xcf
      && ![0xc4, 0xc8, 0xcc].includes(marker);
    if (isStartOfFrame) {
      if (length < 7) return null;
      return {
        mimeType: "image/jpeg",
        width: view.getUint16(offset + 5, false),
        height: view.getUint16(offset + 3, false),
        animated: false
      };
    }
    offset += length;
  }
  return null;
}

function uint24(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function webpInfo(bytes) {
  if (bytes.byteLength < 20 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) !== bytes.byteLength - 8) return null;
  let offset = 12;
  let dimensions = null;
  let animated = false;
  while (offset + 8 <= bytes.byteLength) {
    const kind = ascii(bytes, offset, 4);
    const length = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    const next = dataOffset + length + (length % 2);
    if (next > bytes.byteLength) return null;
    if (kind === "ANIM" || kind === "ANMF") animated = true;
    if (kind === "VP8X" && length >= 10) {
      animated ||= (bytes[dataOffset] & 0x02) !== 0;
      dimensions = {
        width: uint24(bytes, dataOffset + 4) + 1,
        height: uint24(bytes, dataOffset + 7) + 1
      };
    } else if (kind === "VP8 " && length >= 10) {
      if (bytes[dataOffset + 3] !== 0x9d || bytes[dataOffset + 4] !== 0x01 || bytes[dataOffset + 5] !== 0x2a) return null;
      dimensions = {
        width: view.getUint16(dataOffset + 6, true) & 0x3fff,
        height: view.getUint16(dataOffset + 8, true) & 0x3fff
      };
    } else if (kind === "VP8L" && length >= 5) {
      if (bytes[dataOffset] !== 0x2f) return null;
      dimensions = {
        width: 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8),
        height: 1 + (bytes[dataOffset + 2] >> 6) + (bytes[dataOffset + 3] << 2) + ((bytes[dataOffset + 4] & 0x0f) << 10)
      };
    }
    offset = next;
  }
  return dimensions ? { mimeType: "image/webp", ...dimensions, animated } : null;
}

function invalidImage(message = "Die Datei ist kein unterstütztes, lesbares Bild.") {
  return new StickerProcessingError("INVALID_IMAGE", message);
}

export function inspectStickerSource(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1) throw invalidImage();
  if (bytes.byteLength > STICKER_SOURCE_MAX_BYTES) {
    throw new StickerProcessingError("SOURCE_TOO_LARGE", "Die Quelldatei darf höchstens 5 MiB groß sein.");
  }
  const info = pngInfo(bytes) || jpegInfo(bytes) || webpInfo(bytes);
  if (!info || !SUPPORTED_MIME_TYPES.includes(info.mimeType)) throw invalidImage();
  if (info.animated) {
    throw new StickerProcessingError("ANIMATED_IMAGE_UNSUPPORTED", "Animierte Sticker werden nicht unterstützt.");
  }
  if (!Number.isSafeInteger(info.width) || !Number.isSafeInteger(info.height)
      || info.width < 1 || info.height < 1) throw invalidImage("Die Bildabmessungen sind ungültig.");
  if (info.width > STICKER_SOURCE_MAX_DIMENSION || info.height > STICKER_SOURCE_MAX_DIMENSION
      || info.width * info.height > STICKER_SOURCE_MAX_PIXELS) {
    throw new StickerProcessingError(
      "SOURCE_DIMENSIONS_TOO_LARGE",
      "Das Bild ist für die Sticker-Aufbereitung zu groß. Maximal sind 16 Megapixel erlaubt."
    );
  }
  return Object.freeze(info);
}

export function validateStaticStickerWebp(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > STICKER_MAX_BYTES) return null;
  const info = webpInfo(bytes);
  return info && !info.animated && info.width === STICKER_WIDTH && info.height === STICKER_HEIGHT
    ? Object.freeze(info)
    : null;
}

async function readMagickWasm() {
  const wasmUrl = new URL(import.meta.resolve("@imagemagick/magick-wasm/magick.wasm"));
  if (globalThis.Deno?.readFile) return globalThis.Deno.readFile(wasmUrl);
  const { readFile } = await import("node:fs/promises");
  return new Uint8Array(await readFile(wasmUrl));
}

async function ensureImageMagick() {
  magickInitialization ||= (async () => {
    await initializeImageMagick(await readMagickWasm());
    ResourceLimits.width = BigInt(STICKER_SOURCE_MAX_DIMENSION);
    ResourceLimits.height = BigInt(STICKER_SOURCE_MAX_DIMENSION);
    ResourceLimits.area = BigInt(STICKER_SOURCE_MAX_PIXELS);
    // ImageMagick needs room for the decoded image plus the transparent canvas.
    // Animated PNG/WebP is rejected from the container bytes before decoding.
    ResourceLimits.listLength = 2n;
    ResourceLimits.memory = 128n * 1024n * 1024n;
    ResourceLimits.maxMemoryRequest = 64n * 1024n * 1024n;
    ResourceLimits.maxProfileSize = 4n * 1024n * 1024n;
    ResourceLimits.disk = 0n;
    Magick.setRandomSeed(0);
  })();
  return magickInitialization;
}

function encodeWebp(image, quality) {
  image.quality = quality;
  image.setArtifact("webp:method", "4");
  return image.write(MagickFormat.WebP, data => Uint8Array.from(data));
}

function encodeWithinLimit(image) {
  const highQuality = encodeWebp(image, STICKER_WEBP_MAX_QUALITY);
  if (highQuality.byteLength <= STICKER_MAX_BYTES) {
    return { bytes: highQuality, quality: STICKER_WEBP_MAX_QUALITY };
  }

  const minimumQuality = encodeWebp(image, STICKER_WEBP_MIN_QUALITY);
  if (minimumQuality.byteLength > STICKER_MAX_BYTES) {
    throw new StickerProcessingError(
      "STICKER_TOO_COMPLEX",
      "Der Sticker lässt sich auch bei der zulässigen Mindestqualität nicht auf 100 KiB komprimieren."
    );
  }

  let best = { bytes: minimumQuality, quality: STICKER_WEBP_MIN_QUALITY };
  let lower = STICKER_WEBP_MIN_QUALITY + 1;
  let upper = STICKER_WEBP_MAX_QUALITY - 1;
  while (lower <= upper) {
    const quality = Math.floor((lower + upper) / 2);
    const bytes = encodeWebp(image, quality);
    if (bytes.byteLength <= STICKER_MAX_BYTES) {
      best = { bytes, quality };
      lower = quality + 1;
    } else {
      upper = quality - 1;
    }
  }
  return best;
}

export async function normalizeStickerImage(bytes) {
  const sourceInfo = inspectStickerSource(bytes);
  await ensureImageMagick();
  try {
    return ImageMagick.readCollection(bytes, images => {
      if (images.length !== 1) {
        throw new StickerProcessingError("ANIMATED_IMAGE_UNSUPPORTED", "Animierte Sticker werden nicht unterstützt.");
      }
      const source = images[0];
      if (source.width !== sourceInfo.width || source.height !== sourceInfo.height) throw invalidImage();
      source.autoOrient();
      source.resetPage();
      source.strip();
      source.alpha(AlphaAction.On);
      source.resize(STICKER_WIDTH, STICKER_HEIGHT);
      const contentWidth = source.width;
      const contentHeight = source.height;
      if (contentWidth < 1 || contentHeight < 1
          || contentWidth > STICKER_WIDTH || contentHeight > STICKER_HEIGHT) throw invalidImage();

      return ImageMagick.read(MagickColors.Transparent, STICKER_WIDTH, STICKER_HEIGHT, canvas => {
        canvas.compositeGravity(source, Gravity.Center, CompositeOperator.Over);
        canvas.strip();
        const encoded = encodeWithinLimit(canvas);
        if (!validateStaticStickerWebp(encoded.bytes)) {
          throw new StickerProcessingError("STICKER_ENCODING_FAILED", "Der Sticker konnte nicht sicher als WebP erzeugt werden.");
        }
        return Object.freeze({
          ...encoded,
          width: STICKER_WIDTH,
          height: STICKER_HEIGHT,
          contentWidth,
          contentHeight,
          mimeType: "image/webp",
          sourceMimeType: sourceInfo.mimeType,
          sourceWidth: sourceInfo.width,
          sourceHeight: sourceInfo.height
        });
      });
    });
  } catch (error) {
    if (error instanceof StickerProcessingError) throw error;
    throw invalidImage();
  }
}
