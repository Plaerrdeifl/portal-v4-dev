import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const migrationPath = new URL(
  '../supabase/migrations/20260927211856_social_media_generator_matchday_v1.sql',
  import.meta.url
)

const migration = await readFile(migrationPath, 'utf8')

test('matchday game list consumes central games and requires generator access', () => {
  assert.match(
    migration,
    /create function app_private\.api_social_media_generator_matchday_games_list\(\)/i
  )
  assert.match(
    migration,
    /perform app_private\.social_media_generator_require_access\(\)/i
  )
  assert.match(migration, /from app_modules\.events as event/i)
  assert.match(migration, /join app_modules\.event_games as event_game/i)
  assert.match(migration, /app_modules\.liveticker_teams/i)
  assert.match(migration, /event\.event_type = 'GAME'/i)
  assert.match(migration, /event\.visibility = 'PUBLIC'/i)
})

test('matchday remains a read action behind pd_api', () => {
  assert.match(migration, /'social_media_generator_matchday_games_list'/i)
  assert.match(
    migration,
    /when 'social_media_generator_matchday_games_list' then 'READ'/i
  )
  assert.match(
    migration,
    /return app_private\.api_social_media_generator_matchday_games_list\(\)/i
  )
  assert.match(
    migration,
    /revoke all on function[\s\S]*api_social_media_generator_matchday_games_list\(\)[\s\S]*from public, anon, authenticated, service_role/i
  )
  assert.doesNotMatch(
    migration,
    /grant execute on function[\s\S]*api_social_media_generator_matchday_games_list\(\)[\s\S]*to authenticated/i
  )
})

test('matchday response keeps canonical teams and logo metadata', () => {
  assert.match(migration, /'eventId'/)
  assert.match(migration, /'eventDate'/)
  assert.match(migration, /'eventTime'/)
  assert.match(migration, /'venue'/)
  assert.match(migration, /'homeAway'/)
  assert.match(migration, /'displayTitle'/)
  assert.match(migration, /'homeTeam'/)
  assert.match(migration, /'awayTeam'/)
  assert.match(migration, /'logoUploaded'/)
  assert.match(migration, /'logoAssetPath'/)
  assert.match(migration, /'logoSha256'/)
})
