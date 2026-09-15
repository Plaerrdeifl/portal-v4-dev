import {
  ImageMagick,
  MagickColors,
  MagickFormat,
  Quantum
} from "@imagemagick/magick-wasm";
import {
  STICKER_HEIGHT,
  STICKER_MAX_BYTES,
  STICKER_WEBP_MAX_QUALITY,
  STICKER_WIDTH,
  StickerProcessingError,
  inspectStickerSource,
  normalizeStickerImage,
  validateStaticStickerWebp
} from "./image-processing.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: ${actual} !== ${expected}`);
}

function opaqueArea(width, height, red, green, blue, alpha = Quantum.max) {
  const values = new Array(width * height * 4);
  for (let offset = 0; offset < values.length; offset += 4) {
    values[offset] = red;
    values[offset + 1] = green;
    values[offset + 2] = blue;
    values[offset + 3] = alpha;
  }
  return values;
}

function transparentMotif(width, height, format) {
  return ImageMagick.read(MagickColors.Transparent, width, height, image => {
    const insetX = Math.max(1, Math.floor(width / 8));
    const insetY = Math.max(1, Math.floor(height / 8));
    const motifWidth = width - (2 * insetX);
    const motifHeight = height - (2 * insetY);
    image.getPixels(pixels => pixels.setArea(
      insetX,
      insetY,
      motifWidth,
      motifHeight,
      opaqueArea(motifWidth, motifHeight, Quantum.max, 0, 0)
    ));
    image.quality = 90;
    return image.write(format, data => Uint8Array.from(data));
  });
}

function opaqueJpeg(width, height) {
  return ImageMagick.read(MagickColors.Blue, width, height, image => {
    image.quality = 90;
    return image.write(MagickFormat.Jpeg, data => Uint8Array.from(data));
  });
}

function randomPng(randomAlpha) {
  let state = randomAlpha ? 987654321 : 123456789;
  const randomQuantum = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state >>> 16;
  };
  const values = new Array(STICKER_WIDTH * STICKER_HEIGHT * 4);
  for (let offset = 0; offset < values.length; offset += 4) {
    values[offset] = randomQuantum();
    values[offset + 1] = randomQuantum();
    values[offset + 2] = randomQuantum();
    values[offset + 3] = randomAlpha ? randomQuantum() : Quantum.max;
  }
  return ImageMagick.read(MagickColors.Transparent, STICKER_WIDTH, STICKER_HEIGHT, image => {
    image.getPixels(pixels => pixels.setArea(0, 0, STICKER_WIDTH, STICKER_HEIGHT, values));
    return image.write(MagickFormat.Png, data => Uint8Array.from(data));
  });
}

function inspectOutput(bytes) {
  return ImageMagick.read(bytes, image => image.getPixels(pixels => ({
    width: image.width,
    height: image.height,
    format: image.format,
    hasAlpha: image.hasAlpha,
    isOpaque: image.isOpaque,
    cornerAlpha: pixels.getColor(0, 0)?.a,
    centerAlpha: pixels.getColor(Math.floor(image.width / 2), Math.floor(image.height / 2))?.a
  })));
}

Deno.test("server-side WhatsApp sticker normalization", async test => {
  const existingTransparentPng = new Uint8Array(await Deno.readFile(new URL(
    "../../../workers/liveticker-whatsapp/assets/toooor.png",
    import.meta.url
  )));

  await test.step("A: transparent PNG stays transparent and becomes a valid 512px WebP", async () => {
    const result = await normalizeStickerImage(existingTransparentPng);
    const output = inspectOutput(result.bytes);
    assertEquals(output.width, STICKER_WIDTH, "output width");
    assertEquals(output.height, STICKER_HEIGHT, "output height");
    assertEquals(output.format, MagickFormat.WebP, "output format");
    assert(output.hasAlpha && !output.isOpaque && output.cornerAlpha === 0, "transparent pixels must survive");
    assert(result.bytes.byteLength <= STICKER_MAX_BYTES, "output must stay within 100 KiB");
    assert(validateStaticStickerWebp(result.bytes), "output contract must validate");
  });

  await test.step("B: portrait transparent PNG is contained, centered and not stretched", async () => {
    const result = await normalizeStickerImage(transparentMotif(120, 240, MagickFormat.Png));
    const output = inspectOutput(result.bytes);
    assertEquals(result.contentWidth, 256, "portrait content width");
    assertEquals(result.contentHeight, 512, "portrait content height");
    assertEquals(output.cornerAlpha, 0, "portrait canvas edge must be transparent");
    assert(output.centerAlpha > 0, "portrait motif must stay centered");
  });

  await test.step("C: landscape transparent PNG is contained, centered and not stretched", async () => {
    const result = await normalizeStickerImage(transparentMotif(240, 120, MagickFormat.Png));
    const output = inspectOutput(result.bytes);
    assertEquals(result.contentWidth, 512, "landscape content width");
    assertEquals(result.contentHeight, 256, "landscape content height");
    assertEquals(output.cornerAlpha, 0, "landscape canvas edge must be transparent");
    assert(output.centerAlpha > 0, "landscape motif must stay centered");
  });

  await test.step("D: opaque JPEG gets transparent free canvas space", async () => {
    const source = opaqueJpeg(240, 120);
    assertEquals(inspectStickerSource(source).mimeType, "image/jpeg", "detected JPEG MIME");
    const result = await normalizeStickerImage(source);
    const output = inspectOutput(result.bytes);
    assertEquals(result.contentWidth, 512, "JPEG content width");
    assertEquals(result.contentHeight, 256, "JPEG content height");
    assertEquals(output.cornerAlpha, 0, "JPEG free canvas area must be transparent");
    assert(output.centerAlpha > 0, "JPEG content must remain visible");
  });

  await test.step("E: existing static WebP is decoded and normalized again", async () => {
    const source = transparentMotif(160, 240, MagickFormat.WebP);
    assertEquals(inspectStickerSource(source).mimeType, "image/webp", "detected WebP MIME");
    const result = await normalizeStickerImage(source);
    assert(validateStaticStickerWebp(result.bytes), "normalized WebP must meet the final contract");
    assertEquals(result.sourceMimeType, "image/webp", "reported source MIME");
  });

  await test.step("F: text disguised as PNG is rejected before decoding", () => {
    try {
      inspectStickerSource(new TextEncoder().encode("not really a png"));
      throw new Error("invalid input was accepted");
    } catch (error) {
      assert(error instanceof StickerProcessingError && error.code === "INVALID_IMAGE", "invalid image error expected");
    }
  });

  await test.step("G: quality search reduces a large first WebP result below 100 KiB", async () => {
    const result = await normalizeStickerImage(randomPng(false));
    assert(result.quality < STICKER_WEBP_MAX_QUALITY, "quality must be reduced for noisy input");
    assert(result.bytes.byteLength <= STICKER_MAX_BYTES, "reduced output must stay within 100 KiB");
  });

  await test.step("H: incompressible alpha data fails without returning an invalid sticker", async () => {
    try {
      await normalizeStickerImage(randomPng(true));
      throw new Error("incompressible input was accepted");
    } catch (error) {
      assert(
        error instanceof StickerProcessingError && error.code === "STICKER_TOO_COMPLEX",
        "controlled compression error expected"
      );
    }
  });
});
