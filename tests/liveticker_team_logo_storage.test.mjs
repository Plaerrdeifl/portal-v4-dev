import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const root = path.resolve(import.meta.dirname, '..')
const migrationName = fs.readdirSync(path.join(root,'supabase','migrations'))
  .find(name => name.endsWith('_liveticker_team_logo_storage_r1.sql'))
assert.ok(migrationName)
const sql = fs.readFileSync(path.join(root,'supabase','migrations',migrationName),'utf8')
const edge = fs.readFileSync(path.join(root,'supabase','functions','liveticker-team-logos','index.ts'),'utf8')

test('team logos use a dedicated public storage bucket with no browser storage write policy', () => {
  assert.match(sql, /'liveticker-team-logos'/)
  assert.match(sql, /logo_storage_bucket/)
  assert.match(sql, /logo_storage_path/)
  assert.doesNotMatch(sql, /create\s+policy/i)
})

test('browser upload is operator-authorized and activation is service-role only', () => {
  assert.match(sql, /api_liveticker_team_logo_upload_authorize/)
  assert.match(sql, /grant execute on function public\.pd_liveticker_team_logo_storage_activate[\s\S]*to service_role/i)
  assert.match(edge, /liveticker_team_logo_upload_authorize/)
  assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEYS/)
})

test('new team save path cannot write logo bytea directly', () => {
  assert.match(sql, /Teamlogos werden über den zentralen Logo-Upload gespeichert/)
  assert.match(edge, /teams\/.*sha/)
})
