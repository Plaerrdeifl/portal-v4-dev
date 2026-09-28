begin;

create or replace function app_private.api_social_media_generator_media_teams_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform app_private.social_media_generator_require_access();

  return coalesce(
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_strip_nulls(
          pg_catalog.jsonb_build_object(
            'id', team.id,
            'name', team.name,
            'shortName', team.short_name,
            'teamCode', team.team_code,
            'homeClub', team.is_home_club,
            'active', team.is_active,
            'logoUploaded',
              team.logo_storage_bucket is not null
              and team.logo_storage_path is not null,
            'logoSha256', team.logo_sha256,
            'logoStorageBucket', team.logo_storage_bucket,
            'logoStoragePath', team.logo_storage_path
          )
        )
        order by team.is_home_club desc, team.name, team.id
      )
      from app_modules.liveticker_teams as team
      where team.is_active
    ),
    '[]'::jsonb
  );
end;
$function$;

create or replace function app_private.api_social_media_generator_media_team_logo_get(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_team_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'teamId', '')),
    ''
  )::uuid;
  v_team record;
begin
  perform app_private.social_media_generator_require_access();

  if v_team_id is null then
    raise exception 'SOCIAL_MEDIA_TEAM_ID_REQUIRED'
      using errcode = '22023';
  end if;

  select
    team.id,
    team.name,
    team.short_name,
    team.team_code,
    team.is_home_club,
    team.is_active,
    team.logo_sha256,
    team.logo_storage_bucket,
    team.logo_storage_path
  into v_team
  from app_modules.liveticker_teams as team
  where team.id = v_team_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_TEAM_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if not v_team.is_active then
    raise exception 'SOCIAL_MEDIA_TEAM_INACTIVE'
      using errcode = '22023';
  end if;

  return pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'teamId', v_team.id,
      'name', v_team.name,
      'shortName', v_team.short_name,
      'teamCode', v_team.team_code,
      'homeClub', v_team.is_home_club,
      'logoUploaded',
        v_team.logo_storage_bucket is not null
        and v_team.logo_storage_path is not null,
      'logoSha256', v_team.logo_sha256,
      'logoStorageBucket', v_team.logo_storage_bucket,
      'logoStoragePath', v_team.logo_storage_path
    )
  );
end;
$function$;

create or replace function app_private.api_social_media_generator_matchday_games_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_today date := (pg_catalog.now() at time zone 'Europe/Berlin')::date;
begin
  perform app_private.social_media_generator_require_access();

  return pg_catalog.jsonb_build_object(
    'games',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          game.item
          order by
            (game.event_date < v_today) asc,
            case when game.event_date >= v_today then game.event_date end asc,
            case when game.event_date >= v_today then game.event_time end asc nulls last,
            case when game.event_date < v_today then game.event_date end desc,
            case when game.event_date < v_today then game.event_time end desc nulls last,
            game.event_id
        )
        from (
          select
            event.id as event_id,
            event.event_date,
            event.event_time,
            pg_catalog.jsonb_build_object(
              'eventId', event.id,
              'eventDate', event.event_date,
              'eventTime', event.event_time,
              'venue', event.venue,
              'homeAway', event_game.home_away,
              'opponentName', event_game.opponent_name,
              'displayTitle',
                case event_game.home_away
                  when 'HOME' then own.short_name || ' – ' || coalesce(opponent.short_name, event_game.opponent_name)
                  else coalesce(opponent.short_name, event_game.opponent_name) || ' – ' || own.short_name
                end,
              'homeTeam',
                case event_game.home_away
                  when 'HOME' then pg_catalog.jsonb_build_object(
                    'id', own.id,
                    'name', own.name,
                    'shortName', own.short_name,
                    'teamCode', own.team_code,
                    'homeClub', own.is_home_club,
                    'active', own.is_active,
                    'logoUploaded',
                      own.logo_storage_bucket is not null
                      and own.logo_storage_path is not null,
                    'logoSha256', own.logo_sha256,
                    'logoStorageBucket', own.logo_storage_bucket,
                    'logoStoragePath', own.logo_storage_path
                  )
                  else pg_catalog.jsonb_build_object(
                    'id', opponent.id,
                    'name', coalesce(opponent.name, event_game.opponent_name),
                    'shortName', coalesce(opponent.short_name, event_game.opponent_name),
                    'teamCode', opponent.team_code,
                    'homeClub', false,
                    'active', coalesce(opponent.is_active, true),
                    'logoUploaded',
                      opponent.logo_storage_bucket is not null
                      and opponent.logo_storage_path is not null,
                    'logoSha256', opponent.logo_sha256,
                    'logoStorageBucket', opponent.logo_storage_bucket,
                    'logoStoragePath', opponent.logo_storage_path
                  )
                end,
              'awayTeam',
                case event_game.home_away
                  when 'HOME' then pg_catalog.jsonb_build_object(
                    'id', opponent.id,
                    'name', coalesce(opponent.name, event_game.opponent_name),
                    'shortName', coalesce(opponent.short_name, event_game.opponent_name),
                    'teamCode', opponent.team_code,
                    'homeClub', false,
                    'active', coalesce(opponent.is_active, true),
                    'logoUploaded',
                      opponent.logo_storage_bucket is not null
                      and opponent.logo_storage_path is not null,
                    'logoSha256', opponent.logo_sha256,
                    'logoStorageBucket', opponent.logo_storage_bucket,
                    'logoStoragePath', opponent.logo_storage_path
                  )
                  else pg_catalog.jsonb_build_object(
                    'id', own.id,
                    'name', own.name,
                    'shortName', own.short_name,
                    'teamCode', own.team_code,
                    'homeClub', own.is_home_club,
                    'active', own.is_active,
                    'logoUploaded',
                      own.logo_storage_bucket is not null
                      and own.logo_storage_path is not null,
                    'logoSha256', own.logo_sha256,
                    'logoStorageBucket', own.logo_storage_bucket,
                    'logoStoragePath', own.logo_storage_path
                  )
                end
            ) as item
          from app_modules.events as event
          join app_modules.event_games as event_game
            on event_game.event_id = event.id
          join lateral (
            select team.*
            from app_modules.liveticker_teams as team
            where team.is_home_club
              and team.is_active
            order by team.name, team.id
            limit 1
          ) as own on true
          left join lateral (
            select team.*
            from app_modules.liveticker_teams as team
            where team.is_active
              and not team.is_home_club
              and (
                pg_catalog.lower(pg_catalog.btrim(team.name)) =
                  pg_catalog.lower(pg_catalog.btrim(event_game.opponent_name))
                or pg_catalog.lower(pg_catalog.btrim(team.short_name)) =
                  pg_catalog.lower(pg_catalog.btrim(event_game.opponent_name))
                or pg_catalog.lower(event_game.opponent_name) like
                  '%' || pg_catalog.lower(pg_catalog.btrim(team.short_name)) || '%'
              )
            order by
              case
                when pg_catalog.lower(pg_catalog.btrim(team.name)) =
                  pg_catalog.lower(pg_catalog.btrim(event_game.opponent_name))
                then 0
                else 1
              end,
              team.name,
              team.id
            limit 1
          ) as opponent on true
          where event.event_type = 'GAME'
            and event.visibility = 'PUBLIC'
            and event.event_date between (v_today - 30) and (v_today + 220)
        ) as game
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

commit;
