import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = await readFile(
  new URL('../supabase/functions/liveticker-whatsapp-worker/index.ts', import.meta.url),
  'utf8'
);
const stickerId = '11334428-001d-490d-acf4-a2c884569b3c';
const bytes = Uint8Array.from([
  82, 73, 70, 70, 12, 0, 0, 0, 87, 69, 66, 80,
  86, 80, 56, 80, 0, 0, 0, 0
]);
const sha256 = createHash('sha256').update(bytes).digest('hex');

function mockGateway(path, overrides = {}) {
  const requests = [];
  const row = {
    id: stickerId,
    storage_path: path,
    mime_type: 'image/webp',
    width: 512,
    height: 512,
    file_size: bytes.length,
    sha256,
    ...overrides
  };
  const fetch = async rawUrl => {
    const url = new URL(rawUrl);
    requests.push(url.pathname);
    if (url.pathname.endsWith('/pd_liveticker_whatsapp_stickers_worker')) {
      return Response.json([row]);
    }
    if (url.pathname.startsWith('/storage/v1/object/liveticker-whatsapp-stickers/')) {
      return new Response(bytes, { status: 200 });
    }
    throw new Error('Unexpected network access: ' + url.pathname);
  };
  const env = name => {
    if (name === 'SUPABASE_URL') return 'https://tpieykhhawszlzsoflnl.supabase.co';
    if (name === 'SUPABASE_SECRET_KEYS') return '{"default":"unit-test-only"}';
    return undefined;
  };
  const context = {
    fetch, URL, URLSearchParams, Request, Response, AbortSignal,
    TextEncoder, Uint8Array, btoa, crypto: webcrypto,
    Deno: { env: { get: env }, serve: () => {} }
  };
  runInNewContext(
    stripTypeScriptTypes(source) + '\nglobalThis.gateway = { stickerAsset };',
    context
  );
  return { stickerAsset: context.gateway.stickerAsset, requests };
}

test('DEV gateway resolves an authorized 512x512 WebP from DEV storage without changing metadata', async () => {
  const gateway = mockGateway('stickers/dev/' + stickerId + '.webp');
  const result = await gateway.stickerAsset(stickerId);
  assert.equal(result.found, true);
  assert.equal(result.id, stickerId);
  assert.equal(result.filename, stickerId + '.webp');
  assert.equal(result.mimetype, 'image/webp');
  assert.equal(result.data, Buffer.from(bytes).toString('base64'));
  assert.equal(gateway.requests.filter(x => x.includes('/storage/')).length, 1);
});

test('DEV gateway rejects PROD sticker paths and never fetches their bytes', async () => {
  const gateway = mockGateway('stickers/prod/' + stickerId + '.webp');
  await assert.rejects(gateway.stickerAsset(stickerId));
  assert.equal(gateway.requests.filter(x => x.includes('/storage/')).length, 0);
});

test('DEV gateway rejects modified sticker bytes by SHA-256', async () => {
  const gateway = mockGateway('stickers/dev/' + stickerId + '.webp', {
    sha256: '0'.repeat(64)
  });
  await assert.rejects(gateway.stickerAsset(stickerId));
});

test('DEV gateway rejects traversal and unknown sticker locations', async () => {
  for (const path of [
    'stickers/dev/../' + stickerId + '.webp',
    'stickers/other/' + stickerId + '.webp',
    'stickers/dev/' + stickerId + '.png'
  ]) {
    const gateway = mockGateway(path);
    await assert.rejects(gateway.stickerAsset(stickerId));
    assert.equal(gateway.requests.filter(x => x.includes('/storage/')).length, 0);
  }
});

test('DEV gateway rejects out-of-range sticker sizes', async () => {
  const gateway = mockGateway('stickers/dev/' + stickerId + '.webp', {
    file_size: 1048576
  });
  await assert.rejects(gateway.stickerAsset(stickerId));
  assert.equal(gateway.requests.filter(x => x.includes('/storage/')).length, 0);
});
