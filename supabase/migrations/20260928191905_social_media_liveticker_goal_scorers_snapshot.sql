begin;

create function app_private.social_media_liveticker_goal_scorers_snapshot(
  p_event_id uuid,
  p_kind text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_kind text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_kind, '')));
  v_max_minute integer;
  v_result jsonb;
begin
  if p_event_id is null or v_kind not in ('PERIOD_1', 'PERIOD_2', 'FINAL') then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_INPUT_INVALID'
      using errcode = '22023';
  end if;

  v_max_minute := case v_kind
    when 'PERIOD_1' then 20
    when 'PERIOD_2' then 40
    else null
  end;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'id', coalesce(
          nullif(action.payload ->> 'id', ''),
          action.client_action_id
        ),
        'minute', (action.payload ->> 'minute')::integer,
        'kind', case
          when action.action_type = 'penalty' then 'PENALTY_SHOT'
          else 'GOAL'
        end,
        'player', case
          when pg_catalog.jsonb_typeof(action.payload -> 'player') = 'object'
          then action.payload -> 'player'
          else null
        end
      ))
      order by
        (action.payload ->> 'minute')::integer,
        action.ordinal,
        action.client_action_id
    ),
    '[]'::jsonb
  )
  into v_result
  from app_modules.liveticker_actions as action
  where action.event_id = p_event_id
    and action.is_active
    and action.payload ->> 'team' = 'mighty'
    and coalesce(action.payload ->> 'minute', '') ~ '^[0-9]+$'
    and (
      action.action_type = 'goal'
      or (
        action.action_type = 'penalty'
        and action.payload ->> 'subtype' = 'penalty_shot'
        and action.payload ->> 'result' = 'scored'
      )
    )
    and (
      v_max_minute is null
      or (action.payload ->> 'minute')::integer <= v_max_minute
    );

  return v_result;
end;
$function$;

alter function app_private.social_media_liveticker_render_snapshot(uuid, text)
  rename to social_media_liveticker_render_snapshot_before_goal_scorers_v1;

create function app_private.social_media_liveticker_render_snapshot(
  p_event_id uuid,
  p_kind text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_snapshot jsonb;
begin
  v_snapshot := app_private.social_media_liveticker_render_snapshot_before_goal_scorers_v1(
    p_event_id,
    p_kind
  );

  return v_snapshot || pg_catalog.jsonb_build_object(
    'goalScorers',
    app_private.social_media_liveticker_goal_scorers_snapshot(
      p_event_id,
      p_kind
    )
  );
end;
$function$;

-- Requests created with the old contract must never render a silently empty
-- scorer list. Mark only still-active legacy requests as failed so operators
-- can start a fresh request with a complete frozen snapshot.
update app_social_media.liveticker_render_requests as request
set status = 'FAILED',
    last_error_code = 'SNAPSHOT_VERSION_UNSUPPORTED',
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null,
    updated_at = pg_catalog.now()
where request.status in ('QUEUED', 'PROCESSING')
  and not (request.source_snapshot ? 'goalScorers');

revoke all on function
  app_private.social_media_liveticker_goal_scorers_snapshot(uuid, text),
  app_private.social_media_liveticker_render_snapshot_before_goal_scorers_v1(uuid, text),
  app_private.social_media_liveticker_render_snapshot(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.social_media_liveticker_goal_scorers_snapshot(uuid, text),
  app_private.social_media_liveticker_render_snapshot_before_goal_scorers_v1(uuid, text),
  app_private.social_media_liveticker_render_snapshot(uuid, text)
to postgres;

commit;
