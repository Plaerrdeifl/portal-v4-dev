import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const migrationPath = path.join(
  root,
  'supabase',
  'migrations',
  '20260927201228_liveticker_dev_full_run_reset.sql'
)
const sql = fs.readFileSync(migrationPath, 'utf8')

test('DEV full-run reset is environment-guarded and supports active test games', () => {
  assert.match(sql, /platform_release_environment\(\) is distinct from 'DEV'/)
  assert.match(sql, /Spiel wurde nicht gefunden/)
  assert.doesNotMatch(sql, /completed_at is null then raise exception 'Abgeschlossenes Spiel wurde nicht gefunden/)
  assert.match(sql, /minute = 1/)
  assert.match(sql, /completed_at = null/)
})

test('DEV full-run reset refuses while transport or graphics are still active', () => {
  assert.match(sql, /status in \('PENDING', 'PROCESSING'\)/)
  assert.match(sql, /status in \('QUEUED', 'PROCESSING'\)/)
  assert.match(sql, /laufende WhatsApp- und Grafikjobs beendet/)
})

test('current-run status hides historical jobs behind the latest GAME_RESET marker', () => {
  assert.match(sql, /mutation_type = 'GAME_RESET'/)
  assert.match(sql, /created_at >= v_reset_at/)
  assert.match(sql, /api_liveticker_whatsapp_deliveries_list/)
  assert.match(sql, /pd_public_liveticker_graphic_jobs/)
})
