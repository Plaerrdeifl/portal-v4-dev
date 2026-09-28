begin;

create table app_social_media.liveticker_render_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null
    references app_portal.users(id) on delete restrict,
  event_id uuid not null
    references app_modules.events(id) on delete cascade,
  graphic_kind text not null,
  source_revision integer not null,
  source_snapshot jsonb not null,
  status text not null default 'QUEUED',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default pg_catalog.now(),
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  last_completed_claim_token uuid,
  result_manifest jsonb,
  last_error_code text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint social_media_liveticker_render_kind_check
    check (graphic_kind in ('PERIOD_1', 'PERIOD_2', 'FINAL')),
  constraint social_media_liveticker_render_revision_check
    check (source_revision >= 0),
  constraint social_media_liveticker_render_snapshot_check
    check (pg_catalog.jsonb_typeof(source_snapshot) = 'object'),
  constraint social_media_liveticker_render_status_check
    check (status in ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  constraint social_media_liveticker_render_attempt_check
    check (attempt_count >= 0 and max_attempts between 1 and 20),
  constraint social_media_liveticker_render_claim_check
    check (
      (
        status = 'PROCESSING'
        and claim_token is not null
        and claimed_at is not null
        and claim_expires_at is not null
      )
      or status <> 'PROCESSING'
    ),
  constraint social_media_liveticker_render_result_check
    check (
      result_manifest is null
      or pg_catalog.jsonb_typeof(result_manifest) = 'object'
    )
);

create index social_media_liveticker_render_event_idx
  on app_social_media.liveticker_render_requests(
    event_id, graphic_kind, created_at desc, id
  );

create index social_media_liveticker_render_claim_idx
  on app_social_media.liveticker_render_requests(
    status, available_at, claim_expires_at, created_at, id
  );

create unique index social_media_liveticker_render_active_uq
  on app_social_media.liveticker_render_requests(event_id, graphic_kind)
  where status in ('QUEUED', 'PROCESSING');

alter table app_social_media.liveticker_render_requests enable row level security;

revoke all on table app_social_media.liveticker_render_requests
  from public, anon, authenticated, service_role;

create or replace function app_private.social_media_generator_matchday_score_snapshot(
  p_event_id uuid,
  p_assume_final boolean default false
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_state app_modules.liveticker_game_states%rowtype;
  v_home_away text;
  v_score record;
  v_shootout_bonus_mighty integer := 0;
  v_shootout_bonus_opponent integer := 0;
  v_result_suffix text;
begin
  select state.*
  into v_state
  from app_modules.liveticker_game_states as state
  where state.event_id = p_event_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_STATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select game.home_away
  into v_home_away
  from app_modules.event_games as game
  where game.event_id = p_event_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_GAME_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  with facts as (
    select
      action.action_type,
      action.payload ->> 'team' as team,
      case
        when coalesce(action.payload ->> 'minute', '') ~ '^[0-9]+$'
        then (action.payload ->> 'minute')::integer
        else null
      end as minute,
      (
        action.action_type = 'goal'
        or (
          action.action_type = 'penalty'
          and action.payload ->> 'subtype' = 'penalty_shot'
          and action.payload ->> 'result' = 'scored'
        )
      ) as scores_goal,
      (
        action.action_type = 'shootout'
        and action.payload ->> 'result' = 'scored'
      ) as scores_shootout
    from app_modules.liveticker_actions as action
    where action.event_id = p_event_id
      and action.is_active
  )
  select
    count(*) filter (
      where scores_goal and team = 'mighty'
    )::integer as own_total,
    count(*) filter (
      where scores_goal and team = 'opponent'
    )::integer as opponent_total,
    count(*) filter (
      where scores_goal and team = 'mighty' and minute between 1 and 20
    )::integer as own_period_1,
    count(*) filter (
      where scores_goal and team = 'opponent' and minute between 1 and 20
    )::integer as opponent_period_1,
    count(*) filter (
      where scores_goal and team = 'mighty' and minute between 21 and 40
    )::integer as own_period_2,
    count(*) filter (
      where scores_goal and team = 'opponent' and minute between 21 and 40
    )::integer as opponent_period_2,
    count(*) filter (
      where scores_goal and team = 'mighty' and minute between 41 and 60
    )::integer as own_period_3,
    count(*) filter (
      where scores_goal and team = 'opponent' and minute between 41 and 60
    )::integer as opponent_period_3,
    count(*) filter (
      where scores_goal and minute > 60
    )::integer as overtime_goal_count,
    count(*) filter (
      where action_type = 'shootout'
    )::integer as shootout_count,
    count(*) filter (
      where scores_shootout and team = 'mighty'
    )::integer as shootout_own,
    count(*) filter (
      where scores_shootout and team = 'opponent'
    )::integer as shootout_opponent
  into v_score
  from facts;

  if v_state.completed_at is not null or p_assume_final then
    if v_score.shootout_count > 0 then
      if v_score.shootout_own > v_score.shootout_opponent then
        v_shootout_bonus_mighty := 1;
      elsif v_score.shootout_opponent > v_score.shootout_own then
        v_shootout_bonus_opponent := 1;
      end if;
      v_result_suffix := 'n. P.';
    elsif v_state.minute > 60 or v_score.overtime_goal_count > 0 then
      v_result_suffix := 'n. V.';
    end if;
  end if;

  return pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'eventId', p_event_id,
      'revision', v_state.revision,
      'minute', v_state.minute,
      'status', case
        when v_state.completed_at is not null then 'FINAL'
        else 'LIVE'
      end,
      'completedAt', v_state.completed_at,
      'resultSuffix', v_result_suffix,
      'homeScore',
        case v_home_away
          when 'HOME' then v_score.own_total + v_shootout_bonus_mighty
          else v_score.opponent_total + v_shootout_bonus_opponent
        end,
      'awayScore',
        case v_home_away
          when 'HOME' then v_score.opponent_total + v_shootout_bonus_opponent
          else v_score.own_total + v_shootout_bonus_mighty
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
          end,
          'cumulativeHomeScore', case v_home_away
            when 'HOME' then v_score.own_period_1
            else v_score.opponent_period_1
          end,
          'cumulativeAwayScore', case v_home_away
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
          end,
          'cumulativeHomeScore', case v_home_away
            when 'HOME' then v_score.own_period_1 + v_score.own_period_2
            else v_score.opponent_period_1 + v_score.opponent_period_2
          end,
          'cumulativeAwayScore', case v_home_away
            when 'HOME' then v_score.opponent_period_1 + v_score.opponent_period_2
            else v_score.own_period_1 + v_score.own_period_2
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
          end,
          'cumulativeHomeScore', case v_home_away
            when 'HOME' then v_score.own_period_1 + v_score.own_period_2 + v_score.own_period_3
            else v_score.opponent_period_1 + v_score.opponent_period_2 + v_score.opponent_period_3
          end,
          'cumulativeAwayScore', case v_home_away
            when 'HOME' then v_score.opponent_period_1 + v_score.opponent_period_2 + v_score.opponent_period_3
            else v_score.own_period_1 + v_score.own_period_2 + v_score.own_period_3
          end
        )
      )
    )
  );
end;
$function$;

create or replace function app_private.api_social_media_generator_matchday_score_get(
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
begin
  perform app_private.social_media_generator_require_access();

  if v_event_id is null then
    raise exception 'SOCIAL_MEDIA_EVENT_ID_REQUIRED'
      using errcode = '22023';
  end if;

  return app_private.social_media_generator_matchday_score_snapshot(v_event_id, false);
end;
$function$;

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
  v_kind text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_kind, '')));
  v_state app_modules.liveticker_game_states%rowtype;
  v_event record;
  v_own app_modules.liveticker_teams%rowtype;
  v_opponent app_modules.liveticker_teams%rowtype;
  v_score jsonb;
  v_period jsonb;
  v_home_team jsonb;
  v_away_team jsonb;
begin
  if p_event_id is null or v_kind not in ('PERIOD_1', 'PERIOD_2', 'FINAL') then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_INPUT_INVALID'
      using errcode = '22023';
  end if;

  perform app_private.liveticker_assert_supported_game(p_event_id);

  select state.*
  into v_state
  from app_modules.liveticker_game_states as state
  where state.event_id = p_event_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_STATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_state.completed_at is null and (
    (v_kind = 'PERIOD_1' and v_state.minute < 20)
    or (v_kind = 'PERIOD_2' and v_state.minute < 40)
    or (v_kind = 'FINAL' and v_state.minute < 60)
  ) then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_NOT_READY'
      using errcode = '22023';
  end if;

  select
    event.event_date,
    event.event_time,
    event.venue,
    event_game.home_away,
    event_game.opponent_name
  into v_event
  from app_modules.events as event
  join app_modules.event_games as event_game
    on event_game.event_id = event.id
  where event.id = p_event_id;

  select team.*
  into v_own
  from app_modules.liveticker_teams as team
  where team.is_active
    and team.is_home_club
  order by team.name, team.id
  limit 1;

  if v_own.id is null then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_HOME_TEAM_MISSING'
      using errcode = 'P0002';
  end if;

  select team.*
  into v_opponent
  from app_modules.liveticker_teams as team
  where team.is_active
    and not team.is_home_club
    and (
      pg_catalog.lower(pg_catalog.btrim(team.name)) =
        pg_catalog.lower(pg_catalog.btrim(v_event.opponent_name))
      or pg_catalog.lower(pg_catalog.btrim(team.short_name)) =
        pg_catalog.lower(pg_catalog.btrim(v_event.opponent_name))
      or pg_catalog.lower(v_event.opponent_name) like
        '%' || pg_catalog.lower(pg_catalog.btrim(team.short_name)) || '%'
    )
  order by
    case
      when pg_catalog.lower(pg_catalog.btrim(team.name)) =
        pg_catalog.lower(pg_catalog.btrim(v_event.opponent_name))
      then 0 else 1
    end,
    team.name,
    team.id
  limit 1;

  if v_opponent.id is null then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_OPPONENT_TEAM_MISSING'
      using errcode = 'P0002';
  end if;

  if v_own.logo_storage_bucket is distinct from 'liveticker-team-logos'
     or v_own.logo_storage_path is null
     or v_own.logo_sha256 is null
     or v_opponent.logo_storage_bucket is distinct from 'liveticker-team-logos'
     or v_opponent.logo_storage_path is null
     or v_opponent.logo_sha256 is null then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_TEAM_LOGO_MISSING'
      using errcode = '22023';
  end if;

  v_score := app_private.social_media_generator_matchday_score_snapshot(
    p_event_id,
    v_kind = 'FINAL'
  );

  if v_kind = 'PERIOD_1' then
    v_period := v_score #> '{periods,0}';
  elsif v_kind = 'PERIOD_2' then
    v_period := v_score #> '{periods,1}';
  end if;

  v_home_team := case v_event.home_away
    when 'HOME' then pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'id', v_own.id,
      'name', v_own.name,
      'shortName', v_own.short_name,
      'logoSha256', v_own.logo_sha256,
      'logoStorageBucket', v_own.logo_storage_bucket,
      'logoStoragePath', v_own.logo_storage_path
    ))
    else pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'id', v_opponent.id,
      'name', coalesce(v_opponent.name, v_event.opponent_name),
      'shortName', coalesce(v_opponent.short_name, v_event.opponent_name),
      'logoSha256', v_opponent.logo_sha256,
      'logoStorageBucket', v_opponent.logo_storage_bucket,
      'logoStoragePath', v_opponent.logo_storage_path
    ))
  end;

  v_away_team := case v_event.home_away
    when 'HOME' then pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'id', v_opponent.id,
      'name', coalesce(v_opponent.name, v_event.opponent_name),
      'shortName', coalesce(v_opponent.short_name, v_event.opponent_name),
      'logoSha256', v_opponent.logo_sha256,
      'logoStorageBucket', v_opponent.logo_storage_bucket,
      'logoStoragePath', v_opponent.logo_storage_path
    ))
    else pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'id', v_own.id,
      'name', v_own.name,
      'shortName', v_own.short_name,
      'logoSha256', v_own.logo_sha256,
      'logoStorageBucket', v_own.logo_storage_bucket,
      'logoStoragePath', v_own.logo_storage_path
    ))
  end;

  return pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'eventId', p_event_id,
    'eventDate', v_event.event_date,
    'eventTime', v_event.event_time,
    'venue', v_event.venue,
    'homeAway', v_event.home_away,
    'displayTitle', case v_event.home_away
      when 'HOME' then v_own.short_name || ' – ' ||
        coalesce(v_opponent.short_name, v_event.opponent_name)
      else coalesce(v_opponent.short_name, v_event.opponent_name) ||
        ' – ' || v_own.short_name
    end,
    'graphicKind', v_kind,
    'sourceRevision', v_state.revision,
    'homeTeam', v_home_team,
    'awayTeam', v_away_team,
    'homeScore', case
      when v_kind = 'FINAL' then (v_score ->> 'homeScore')::integer
      else (v_period ->> 'cumulativeHomeScore')::integer
    end,
    'awayScore', case
      when v_kind = 'FINAL' then (v_score ->> 'awayScore')::integer
      else (v_period ->> 'cumulativeAwayScore')::integer
    end,
    'period', case
      when v_kind = 'PERIOD_1' then 1
      when v_kind = 'PERIOD_2' then 2
      else null
    end,
    'periodHomeScore', case
      when v_period is null then null
      else (v_period ->> 'homeScore')::integer
    end,
    'periodAwayScore', case
      when v_period is null then null
      else (v_period ->> 'awayScore')::integer
    end,
    'resultSuffix', case
      when v_kind = 'FINAL' then v_score ->> 'resultSuffix'
      else null
    end
  ));
end;
$function$;

create function app_private.social_media_liveticker_render_request_json(
  p_request_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'requestId', request.id,
    'eventId', request.event_id,
    'kind', request.graphic_kind,
    'sourceRevision', request.source_revision,
    'status', request.status,
    'attemptCount', request.attempt_count,
    'maxAttempts', request.max_attempts,
    'resultManifest', request.result_manifest,
    'errorCode', request.last_error_code,
    'createdAt', request.created_at,
    'updatedAt', request.updated_at
  ))
  from app_social_media.liveticker_render_requests as request
  where request.id = p_request_id;
$function$;

create function app_private.api_social_media_generator_liveticker_render_start(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_event_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'eventId', '')),
    ''
  )::uuid;
  v_kind text := pg_catalog.upper(
    pg_catalog.btrim(coalesce(p_payload ->> 'kind', ''))
  );
  v_snapshot jsonb;
  v_revision integer;
  v_request_id uuid;
begin
  if v_event_id is null or v_kind not in ('PERIOD_1', 'PERIOD_2', 'FINAL') then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_INPUT_INVALID'
      using errcode = '22023';
  end if;

  select request.id
  into v_request_id
  from app_social_media.liveticker_render_requests as request
  where request.event_id = v_event_id
    and request.graphic_kind = v_kind
    and request.status in ('QUEUED', 'PROCESSING')
  order by request.created_at desc, request.id
  limit 1;

  if found then
    return app_private.social_media_liveticker_render_request_json(v_request_id);
  end if;

  v_snapshot := app_private.social_media_liveticker_render_snapshot(
    v_event_id,
    v_kind
  );
  v_revision := (v_snapshot ->> 'sourceRevision')::integer;

  insert into app_social_media.liveticker_render_requests(
    owner_user_id,
    event_id,
    graphic_kind,
    source_revision,
    source_snapshot
  )
  values (
    v_actor,
    v_event_id,
    v_kind,
    v_revision,
    v_snapshot
  )
  on conflict do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select request.id
    into v_request_id
    from app_social_media.liveticker_render_requests as request
    where request.event_id = v_event_id
      and request.graphic_kind = v_kind
      and request.status in ('QUEUED', 'PROCESSING')
    order by request.created_at desc, request.id
    limit 1;

    if v_request_id is null then
      raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_QUEUE_CONFLICT'
        using errcode = 'PT409';
    end if;

    return app_private.social_media_liveticker_render_request_json(v_request_id);
  end if;

  perform app_private.log_audit(
    v_actor,
    'SOCIAL_MEDIA_LIVETICKER_RENDER_STARTED',
    'social_media_liveticker_render_request',
    v_request_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'eventId', v_event_id,
      'kind', v_kind,
      'sourceRevision', v_revision
    )
  );

  return app_private.social_media_liveticker_render_request_json(v_request_id);
end;
$function$;

create function app_private.api_social_media_generator_liveticker_render_get(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_request_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'requestId', '')),
    ''
  )::uuid;
  v_result jsonb;
begin
  if v_request_id is null then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_REQUEST_ID_REQUIRED'
      using errcode = '22023';
  end if;

  select app_private.social_media_liveticker_render_request_json(request.id)
  into v_result
  from app_social_media.liveticker_render_requests as request
  where request.id = v_request_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_REQUEST_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  perform v_actor;
  return v_result;
end;
$function$;

create function public.pd_social_media_liveticker_render_worker_claim()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request app_social_media.liveticker_render_requests%rowtype;
  v_claim_token uuid := extensions.gen_random_uuid();
begin
  update app_social_media.liveticker_render_requests as request
  set status = case
        when request.attempt_count >= request.max_attempts then 'FAILED'
        else 'QUEUED'
      end,
      available_at = case
        when request.attempt_count >= request.max_attempts
        then request.available_at
        else pg_catalog.now()
      end,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      last_error_code = coalesce(
        request.last_error_code,
        'LEASE_EXPIRED'
      ),
      updated_at = pg_catalog.now()
  where request.status = 'PROCESSING'
    and request.claim_expires_at < pg_catalog.now();

  select request.*
  into v_request
  from app_social_media.liveticker_render_requests as request
  where request.status = 'QUEUED'
    and request.attempt_count < request.max_attempts
    and request.available_at <= pg_catalog.now()
  order by request.created_at, request.id
  for update skip locked
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('claimed', false);
  end if;

  update app_social_media.liveticker_render_requests as request
  set status = 'PROCESSING',
      attempt_count = request.attempt_count + 1,
      claim_token = v_claim_token,
      claimed_at = pg_catalog.now(),
      claim_expires_at = pg_catalog.now() + interval '5 minutes',
      updated_at = pg_catalog.now()
  where request.id = v_request.id
  returning * into v_request;

  return pg_catalog.jsonb_build_object(
    'claimed', true,
    'request', pg_catalog.jsonb_build_object(
      'requestId', v_request.id,
      'claimToken', v_claim_token,
      'eventId', v_request.event_id,
      'graphicKind', v_request.graphic_kind,
      'sourceRevision', v_request.source_revision,
      'snapshot', v_request.source_snapshot,
      'attemptCount', v_request.attempt_count,
      'maxAttempts', v_request.max_attempts
    )
  );
end;
$function$;

create function public.pd_social_media_liveticker_render_worker_heartbeat(
  p_request_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update app_social_media.liveticker_render_requests as request
  set claim_expires_at = pg_catalog.now() + interval '5 minutes',
      updated_at = pg_catalog.now()
  where request.id = p_request_id
    and request.status = 'PROCESSING'
    and request.claim_token = p_claim_token
    and request.claim_expires_at >= pg_catalog.now();

  if not found then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_LEASE_INVALID'
      using errcode = 'PT409';
  end if;

  return pg_catalog.jsonb_build_object('ok', true);
end;
$function$;

create function public.pd_social_media_liveticker_render_worker_complete(
  p_request_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error_code text,
  p_result_manifest jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request app_social_media.liveticker_render_requests%rowtype;
  v_error text := nullif(
    pg_catalog.btrim(coalesce(p_error_code, '')),
    ''
  );
begin
  select request.*
  into v_request
  from app_social_media.liveticker_render_requests as request
  where request.id = p_request_id
    and request.status = 'PROCESSING'
    and request.claim_token = p_claim_token
  for update;

  if not found then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_LEASE_INVALID'
      using errcode = 'PT409';
  end if;

  if p_success then
    if pg_catalog.jsonb_typeof(p_result_manifest) is distinct from 'object'
       or pg_catalog.jsonb_typeof(p_result_manifest -> 'artifacts') is distinct from 'array'
       or pg_catalog.jsonb_array_length(p_result_manifest -> 'artifacts') <> 2 then
      raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_RESULT_INVALID'
        using errcode = '22023';
    end if;

    update app_social_media.liveticker_render_requests as request
    set status = 'SUCCEEDED',
        result_manifest = p_result_manifest,
        last_error_code = null,
        last_completed_claim_token = p_claim_token,
        claim_token = null,
        claimed_at = null,
        claim_expires_at = null,
        updated_at = pg_catalog.now()
    where request.id = p_request_id;
  else
    if v_error is null
       or v_error !~ '^[A-Z0-9_:-]{1,80}$'
       or p_result_manifest is not null then
      raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_FAILURE_INVALID'
        using errcode = '22023';
    end if;

    update app_social_media.liveticker_render_requests as request
    set status = case
          when request.attempt_count < request.max_attempts then 'QUEUED'
          else 'FAILED'
        end,
        available_at = case
          when request.attempt_count < request.max_attempts
          then pg_catalog.now() + interval '15 seconds'
          else request.available_at
        end,
        result_manifest = null,
        last_error_code = v_error,
        last_completed_claim_token = p_claim_token,
        claim_token = null,
        claimed_at = null,
        claim_expires_at = null,
        updated_at = pg_catalog.now()
    where request.id = p_request_id;
  end if;

  return app_private.social_media_liveticker_render_request_json(p_request_id);
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_sm_liveticker_headless_v1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_sm_liveticker_headless_v1()
    || array[
      'social_media_generator_liveticker_render_start',
      'social_media_generator_liveticker_render_get'
    ]::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_liveticker_headless_v1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_liveticker_render_start' then 'WRITE'
    when 'social_media_generator_liveticker_render_get' then 'READ'
    else app_private.platform_action_classification_before_sm_liveticker_headless_v1(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_liveticker_headless_v1;

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
    when 'social_media_generator_liveticker_render_start' then
      return app_private.api_social_media_generator_liveticker_render_start(
        v_payload
      );
    when 'social_media_generator_liveticker_render_get' then
      return app_private.api_social_media_generator_liveticker_render_get(
        v_payload
      );
    else
      return app_private.pd_api_dispatch_current_before_sm_liveticker_headless_v1(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.social_media_generator_matchday_score_snapshot(uuid, boolean),
  app_private.api_social_media_generator_matchday_score_get(jsonb),
  app_private.social_media_liveticker_render_snapshot(uuid, text),
  app_private.social_media_liveticker_render_request_json(uuid),
  app_private.api_social_media_generator_liveticker_render_start(jsonb),
  app_private.api_social_media_generator_liveticker_render_get(jsonb),
  app_private.pd_api_current_actions_before_sm_liveticker_headless_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_liveticker_headless_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_liveticker_headless_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.social_media_generator_matchday_score_snapshot(uuid, boolean),
  app_private.api_social_media_generator_matchday_score_get(jsonb),
  app_private.social_media_liveticker_render_snapshot(uuid, text),
  app_private.social_media_liveticker_render_request_json(uuid),
  app_private.api_social_media_generator_liveticker_render_start(jsonb),
  app_private.api_social_media_generator_liveticker_render_get(jsonb),
  app_private.pd_api_current_actions_before_sm_liveticker_headless_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_liveticker_headless_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_liveticker_headless_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

revoke all on function
  public.pd_social_media_liveticker_render_worker_claim(),
  public.pd_social_media_liveticker_render_worker_heartbeat(uuid, uuid),
  public.pd_social_media_liveticker_render_worker_complete(uuid, uuid, boolean, text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_social_media_liveticker_render_worker_claim(),
  public.pd_social_media_liveticker_render_worker_heartbeat(uuid, uuid),
  public.pd_social_media_liveticker_render_worker_complete(uuid, uuid, boolean, text, jsonb)
to postgres, service_role;

commit;
