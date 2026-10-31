import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(join(root,
  'supabase/migrations/20261031014500_liveticker_spieltage_owner_r1.sql'), 'utf8')

test('Spieltage stay Liveticker-authorized and keep referenced UUIDs', () => {
  for (const action of [
    'liveticker_spieltage_list', 'liveticker_spieltage_save',
    'liveticker_spieltage_status'
  ]) assert.ok(source.includes(action), action)
  assert.match(source, /require_capability\('liveticker\.manage'\)/)
  assert.doesNotMatch(source, /drop table\s+app_modules\.events/i)
  assert.doesNotMatch(source, /delete from\s+app_modules\.events/i)
  assert.match(source, /from app_modules\.fanbus_trips/)
  assert.match(source, /g\.game_status='SCHEDULED'/)
  assert.match(source, /platform_action_classification/)
  assert.match(source, /require_platform_user_write_allowed/)
})
