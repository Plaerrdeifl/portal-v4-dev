begin;

create function app_private.api_social_media_generator_matchday_games_list()
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
                    'logoUploaded', own.logo_data is not null,
                    'logoMime', own.logo_mime,
                    'logoSha256', own.logo_sha256,
                    'logoAssetPath', own.logo_asset_path
                  )
                  else pg_catalog.jsonb_build_object(
                    'id', opponent.id,
                    'name', coalesce(opponent.name, event_game.opponent_name),
                    'shortName', coalesce(opponent.short_name, event_game.opponent_name),
                    'teamCode', opponent.team_code,
                    'homeClub', false,
                    'active', coalesce(opponent.is_active, true),
                    'logoUploaded', opponent.logo_data is not null,
                    'logoMime', opponent.logo_mime,
                    'logoSha256', opponent.logo_sha256,
                    'logoAssetPath', opponent.logo_asset_path
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
                    'logoUploaded', opponent.logo_data is not null,
                    'logoMime', opponent.logo_mime,
                    'logoSha256', opponent.logo_sha256,
                    'logoAssetPath', opponent.logo_asset_path
                  )
                  else pg_catalog.jsonb_build_object(
                    'id', own.id,
                    'name', own.name,
                    'shortName', own.short_name,
                    'teamCode', own.team_code,
                    'homeClub', own.is_home_club,
                    'active', own.is_active,
                    'logoUploaded', own.logo_data is not null,
                    'logoMime', own.logo_mime,
                    'logoSha256', own.logo_sha256,
                    'logoAssetPath', own.logo_asset_path
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

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_sm_matchday_v1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_sm_matchday_v1()
    || array['social_media_generator_matchday_games_list']::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_matchday_v1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_matchday_games_list' then 'READ'
    else app_private.platform_action_classification_before_sm_matchday_v1(p_action)
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_matchday_v1;

create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
begin
  case v_action
    when 'social_media_generator_matchday_games_list' then
      return app_private.api_social_media_generator_matchday_games_list();
    else
      return app_private.pd_api_dispatch_current_before_sm_matchday_v1(
        p_action, p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.api_social_media_generator_matchday_games_list(),
  app_private.pd_api_current_actions_before_sm_matchday_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_matchday_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_matchday_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_social_media_generator_matchday_games_list(),
  app_private.pd_api_current_actions_before_sm_matchday_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_matchday_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_matchday_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
