-- DEV only: add the GAME_SITUATION category to the existing managed
-- Liveticker WhatsApp sticker library. No sticker data is rewritten.

begin;

alter table app_modules.liveticker_whatsapp_stickers
  drop constraint liveticker_whatsapp_stickers_category_check,
  add constraint liveticker_whatsapp_stickers_category_check
    check (category in (
      'GOAL',
      'AGAINST',
      'PENALTY',
      'GAME_SITUATION',
      'VIDEO_REVIEW',
      'GENERAL'
    ));

create or replace function app_private.api_liveticker_whatsapp_sticker_metadata_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_sticker_id uuid;
  v_audience text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_payload ->> 'audience', '')));
  v_category text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_payload ->> 'category', '')));
  v_opponent_team_id_raw text := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'opponentTeamId', '')), '');
  v_opponent_team_id uuid;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['stickerId', 'audience', 'opponentTeamId', 'category']::text[] <> '{}'::jsonb
     or not (p_payload ?& array['stickerId', 'audience', 'category']::text[])
     or pg_catalog.jsonb_typeof(p_payload -> 'stickerId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'audience') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'category') <> 'string'
     or (p_payload ? 'opponentTeamId'
       and p_payload -> 'opponentTeamId' <> 'null'::jsonb
       and pg_catalog.jsonb_typeof(p_payload -> 'opponentTeamId') <> 'string')
     or (p_payload ->> 'stickerId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (v_opponent_team_id_raw is not null
       and v_opponent_team_id_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
     or v_audience not in ('OUR_TEAM', 'OPPONENT', 'GENERAL')
     or v_category not in ('GOAL', 'AGAINST', 'PENALTY', 'GAME_SITUATION', 'VIDEO_REVIEW', 'GENERAL')
     or (v_audience = 'OPPONENT' and v_opponent_team_id_raw is null)
     or (v_audience <> 'OPPONENT' and v_opponent_team_id_raw is not null) then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_METADATA_INVALID' using errcode = '22023';
  end if;
  v_sticker_id := (p_payload ->> 'stickerId')::uuid;
  v_opponent_team_id := v_opponent_team_id_raw::uuid;

  if v_opponent_team_id is not null and not exists (
    select 1
    from app_modules.liveticker_teams as team
    where team.id = v_opponent_team_id
      and team.is_active
      and not team.is_home_club
  ) then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_OPPONENT_INVALID' using errcode = '22023';
  end if;

  update app_modules.liveticker_whatsapp_stickers
  set audience = v_audience,
      opponent_team_id = v_opponent_team_id,
      category = v_category,
      updated_at = pg_catalog.now(),
      updated_by = v_actor
  where id = v_sticker_id;
  if not found then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UNKNOWN' using errcode = 'P0002';
  end if;

  return app_private.api_liveticker_whatsapp_stickers_list(
    pg_catalog.jsonb_build_object('includeInactive', true)
  );
end;
$function$;

revoke all on function app_private.api_liveticker_whatsapp_sticker_metadata_set(jsonb)
  from public, anon, authenticated, service_role;

commit;
