import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(
  new URL('../supabase/migrations/20260901133530_hotfix_public_fanbus_homepage_alignment.sql', import.meta.url),
  'utf8',
);

test('public fanbus homepage only exposes published trips', () => {
  assert.match(migration, /where trip\.status = 'PUBLISHED'/);
});

test('public boarding stops do not expose per-trip Bus-Orga notes', () => {
  assert.match(migration, /'tripNote', null/);
  assert.doesNotMatch(migration, /'tripNote', trip_stop\.trip_note/);
});
