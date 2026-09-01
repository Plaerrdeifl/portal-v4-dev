import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../supabase/functions/notification-dispatch/index.ts', import.meta.url), 'utf8');

test('fanbus booking mail contact block stays compact and action oriented', () => {
  assert.match(source, /padding:8px 8px/);
  assert.match(source, /font-size:13px/);
  assert.match(source, /width=\"28%\"/);
  assert.match(source, /width=\"36%\"/);
  assert.match(source, /Kontakt zur Bus-Orga/);
  assert.match(source, /buttonHtml\(primaryWhatsappHref, \"WhatsApp\", \"#25D366\"/);
  assert.match(source, /buttonHtml\(primaryEmailHref, \"E-Mail\", \"transparent\"/);
  assert.match(source, /buttonHtml\(person\.phoneHref, \"Anrufen\", \"transparent\"/);
  assert.match(source, /padding-top:12px;border-top:1px solid #d8e2ee/);
  assert.doesNotMatch(source, /padding:16px;border:1px solid #d8e2ee;border-radius:14px;background:#f8fafc/);
});
