begin;

create function app_private.api_social_media_generator_matchday_score_get(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'eventId', '')),
    ''
  )::uuid;
  v_state app_modules.liveticker_game_states%rowtype;
  v_home_away text;
  v_score record;
begin
  perform app_private.social_media_generator_require_access();

  if v_event_id is null then
    raise exception 'SOCIAL_MEDIA_EVENT_ID_REQUIRED'
      using errcode = '22023';
  end if;

  select state.*
  into v_state
  from app_modules.liveticker_game_states as state
  where state.event_id = v_event_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_STATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select game.home_away
  into v_home_away
  from app_modules.event_games as game
  where game.event_id = v_event_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_GAME_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select
    count(*) filter (
      where action.action_type = 'goal'
        and action.payload ->> 'team' = 'mighty'
    )::integer as own_total,
    count(*) filter (
      where action.action_type = 'goal'
        and action.payload ->> 'team' = 'opponent'
    )::integer as opponent_total,
    count(*) filter (
      where action.action_type = 'goal'
        and action.payload ->> 'team' = 'mighty'
        and (action.payload ->> 'minute')::integer between 1 and 20
    )::integer as own_period_1,
    count(*) filter (
      where action.action_type = 'goal'
        and action.payload ->> 'team' = 'opponent'
        and (action.payload ->> 'minute')::integer between 1 and 20
    )::integer as opponent_period_1,
    count(*) filter (
      where action.action_type = 'goal'
        and action.payload ->> 'team' = 'mighty'
        and (action.payload ->> 'minute')::integer between 21 and 40
    )::integer as own_period_2,
    count(*) filter (
      where action.action_type = 'goal'
        and action.payload ->> 'team' = 'opponent'
        and (action.payload ->> 'minute')::integer between 21 and 40
    )::integer as opponent_period_2,
    count(*) filter (
      where action.action_type = 'goal'
        and action.payload ->> 'team' = 'mighty'
        and (action.payload ->> 'minute')::integer between 41 and 60
    )::integer as own_period_3,
    count(*) filter (
      where action.action_type = 'goal'
        and action.payload ->> 'team' = 'opponent'
        and (action.payload ->> 'minute')::integer between 41 and 60
    )::integer as opponent_period_3,
    count(*) filter (
      where action.action_type = 'shootout'
    )::integer as shootout_count,
    count(*) filter (
      where action.action_type = 'shootout'
        and action.payload ->> 'team' = 'mighty'
        and action.payload ->> 'result' = 'scored'
    )::integer as shootout_own,
    count(*) filter (
      where action.action_type = 'shootout'
        and action.payload ->> 'team' = 'opponent'
        and action.payload ->> 'result' = 'scored'
    )::integer as shootout_opponent
  into v_score
  from app_modules.liveticker_actions as action
  where action.event_id = v_event_id
    and action.is_active;

  return pg_catalog.jsonb_build_object(
    'eventId', v_event_id,
    'revision', v_state.revision,
    'minute', v_state.minute,
    'status', case
      when v_state.completed_at is not null then 'FINAL'
      else 'LIVE'
    end,
    'completedAt', v_state.completed_at,
    'homeScore',
      case v_home_away
        when 'HOME' then
          v_score.own_total
          + case
              when v_state.completed_at is not null
                and v_score.shootout_count > 0
                and v_score.shootout_own > v_score.shootout_opponent
              then 1 else 0
            end
        else
          v_score.opponent_total
          + case
              when v_state.completed_at is not null
                and v_score.shootout_count > 0
                and v_score.shootout_opponent > v_score.shootout_own
              then 1 else 0
            end
      end,
    'awayScore',
      case v_home_away
        when 'HOME' then
          v_score.opponent_total
          + case
              when v_state.completed_at is not null
                and v_score.shootout_count > 0
                and v_score.shootout_opponent > v_score.shootout_own
              then 1 else 0
            end
        else
          v_score.own_total
          + case
              when v_state.completed_at is not null
                and v_score.shootout_count > 0
                and v_score.shootout_own > v_score.shootout_opponent
              then 1 else 0
            end
      end,
    'periods', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'period', 1,
        'available', v_state.minute >= 20 or v_state.completed_at is not null,
        'homeScore', case v_home_away
          when 'HOME' then v_score.own_period_1
          else v_score.opponent_period_1
        end,
        'awayScore', case v_home_away
          when 'HOME' then v_score.opponent_period_1
          else v_score.own_period_1
        end
      ),
      pg_catalog.jsonb_build_object(
        'period', 2,
        'available', v_state.minute >= 40 or v_state.completed_at is not null,
        'homeScore', case v_home_away
          when 'HOME' then v_score.own_period_2
          else v_score.opponent_period_2
        end,
        'awayScore', case v_home_away
          when 'HOME' then v_score.opponent_period_2
          else v_score.own_period_2
        end
      ),
      pg_catalog.jsonb_build_object(
        'period', 3,
        'available', v_state.minute >= 60 or v_state.completed_at is not null,
        'homeScore', case v_home_away
          when 'HOME' then v_score.own_period_3
          else v_score.opponent_period_3
        end,
        'awayScore', case v_home_away
          when 'HOME' then v_score.opponent_period_3
          else v_score.own_period_3
        end
      )
    )
  );
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_sm_matchday_score_v1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_sm_matchday_score_v1()
    || array['social_media_generator_matchday_score_get']::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_matchday_score_v1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_matchday_score_get' then 'READ'
    else app_private.platform_action_classification_before_sm_matchday_score_v1(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_matchday_score_v1;

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
    when 'social_media_generator_matchday_score_get' then
      return app_private.api_social_media_generator_matchday_score_get(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return app_private.pd_api_dispatch_current_before_sm_matchday_score_v1(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.api_social_media_generator_matchday_score_get(jsonb),
  app_private.pd_api_current_actions_before_sm_matchday_score_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_matchday_score_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_matchday_score_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_social_media_generator_matchday_score_get(jsonb),
  app_private.pd_api_current_actions_before_sm_matchday_score_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_matchday_score_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_matchday_score_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
