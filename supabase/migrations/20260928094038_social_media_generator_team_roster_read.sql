begin;

create function app_private.api_social_media_generator_team_roster_get(
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
  v_team_active boolean;
begin
  perform app_private.social_media_generator_require_access();

  if v_team_id is null then
    raise exception 'SOCIAL_MEDIA_TEAM_ID_REQUIRED'
      using errcode = '22023';
  end if;

  select team.is_active
  into v_team_active
  from app_modules.liveticker_teams as team
  where team.id = v_team_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_TEAM_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if not v_team_active then
    raise exception 'SOCIAL_MEDIA_TEAM_INACTIVE'
      using errcode = '22023';
  end if;

  return pg_catalog.jsonb_build_object(
    'teamId', v_team_id,
    'players',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', player.id,
            'name', player.full_name,
            'jerseyNumber', player.jersey_number,
            'position', player.position,
            'teamId', player.team_id,
            'active', player.is_active
          )
          order by
            player.is_active desc,
            case player.position
              when 'GOALIE' then 1
              when 'DEFENSE' then 2
              when 'FORWARD' then 3
              else 4
            end,
            nullif(pg_catalog.regexp_replace(coalesce(player.jersey_number, ''), '[^0-9]', '', 'g'), '')::integer nulls last,
            player.full_name,
            player.id
        )
        from app_modules.liveticker_players as player
        where player.team_id = v_team_id
      ),
      '[]'::jsonb
    )
  );
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_sm_team_roster_v1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_sm_team_roster_v1()
    || array['social_media_generator_team_roster_get']::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_team_roster_v1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_team_roster_get' then 'READ'
    else app_private.platform_action_classification_before_sm_team_roster_v1(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_team_roster_v1;

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
  v_action text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_action, ''))
  );
begin
  case v_action
    when 'social_media_generator_team_roster_get' then
      return app_private.api_social_media_generator_team_roster_get(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return app_private.pd_api_dispatch_current_before_sm_team_roster_v1(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.api_social_media_generator_team_roster_get(jsonb),
  app_private.pd_api_current_actions_before_sm_team_roster_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_team_roster_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_team_roster_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_social_media_generator_team_roster_get(jsonb),
  app_private.pd_api_current_actions_before_sm_team_roster_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_team_roster_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_team_roster_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
