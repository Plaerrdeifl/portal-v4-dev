begin;

create function app_private.api_social_media_generator_media_teams_list()
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
            'logoUploaded', team.logo_data is not null,
            'logoMime', team.logo_mime,
            'logoSha256', team.logo_sha256,
            'logoAssetPath', team.logo_asset_path
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

create function app_private.api_social_media_generator_media_team_logo_get(
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
    team.logo_data,
    team.logo_mime,
    team.logo_sha256,
    team.logo_asset_path
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
      'logoUploaded', v_team.logo_data is not null,
      'logoMime', v_team.logo_mime,
      'logoSha256', v_team.logo_sha256,
      'logoAssetPath', v_team.logo_asset_path,
      'dataBase64',
        case
          when v_team.logo_data is null then null
          else pg_catalog.encode(v_team.logo_data, 'base64')
        end
    )
  );
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_sm_team_media_p2;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select (
    app_private.pd_api_current_actions_before_sm_team_media_p2()
    || array[
      'social_media_generator_media_teams_list',
      'social_media_generator_media_team_logo_get'
    ]::text[]
  );
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_team_media_p2;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_media_teams_list' then 'READ'
    when 'social_media_generator_media_team_logo_get' then 'READ'
    else app_private.platform_action_classification_before_sm_team_media_p2(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_team_media_p2;

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
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  case v_action
    when 'social_media_generator_media_teams_list' then
      return app_private.api_social_media_generator_media_teams_list();
    when 'social_media_generator_media_team_logo_get' then
      return app_private.api_social_media_generator_media_team_logo_get(v_payload);
    else
      return app_private.pd_api_dispatch_current_before_sm_team_media_p2(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.api_social_media_generator_media_teams_list(),
  app_private.api_social_media_generator_media_team_logo_get(jsonb),
  app_private.pd_api_current_actions_before_sm_team_media_p2(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_team_media_p2(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_team_media_p2(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_social_media_generator_media_teams_list(),
  app_private.api_social_media_generator_media_team_logo_get(jsonb),
  app_private.pd_api_current_actions_before_sm_team_media_p2(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_team_media_p2(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_team_media_p2(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
