-- Plaerrdeifl Digitalplattform V4
-- M340 / F4 DEV / Slice 5: Portal-Readmodell fuer Publishing, History und Statistik

begin;

create function app_private.api_fanbus_publishing_overview(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_places jsonb := '[]'::jsonb;
  v_trips jsonb := '[]'::jsonb;
  v_jobs jsonb := '[]'::jsonb;
  v_daily jsonb := '[]'::jsonb;
  v_landing_count bigint := 0;
  v_referral_count bigint := 0;
begin
  perform app_private.require_capability('fanbus.publishing.manage');

  if coalesce(p_payload, '{}'::jsonb) <> '{}'::jsonb then
    raise exception 'M340_PUBLISHING_OVERVIEW_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  if v_environment is null then
    raise exception 'M340_PUBLISHING_ENVIRONMENT_UNAVAILABLE'
      using errcode = '55000';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', place.id,
        'slug', place.slug,
        'displayName', place.display_name,
        'active', place.is_active,
        'slugLocked', place.slug_locked,
        'revision', place.revision,
        'keys', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'placeKey', place_key.place_key,
              'sourceLabel', place_key.source_label
            )
            order by place_key.place_key
          )
          from app_modules.fanbus_publishing_place_keys as place_key
          where place_key.place_id = place.id
        ), '[]'::jsonb),
        'landingCount', coalesce((
          select sum(daily.landing_count)
          from app_modules.fanbus_publishing_place_landing_daily as daily
          where daily.place_id = place.id
        ), 0),
        'referralCount', coalesce((
          select sum(daily.referral_count)
          from app_modules.fanbus_publishing_trip_referral_daily as daily
          where daily.place_id = place.id
        ), 0)
      )
      order by place.display_name, place.id
    ),
    '[]'::jsonb
  )
  into v_places
  from app_modules.fanbus_publishing_places as place;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tripId', trip.id,
        'eventId', trip.event_id,
        'displayTitle', projection.value ->> 'displayTitle',
        'eventDate', projection.value ->> 'eventDate',
        'eventTime', projection.value ->> 'eventTime',
        'venue', projection.value ->> 'venue',
        'registrationStatus', projection.value ->> 'registrationStatus',
        'place', case
          when place.id is null then null
          else jsonb_build_object(
            'id', place.id,
            'slug', place.slug,
            'displayName', place.display_name,
            'boundPlaceKey', binding.bound_place_key,
            'shortlinkPath', '/ontour/' || place.slug
          )
        end,
        'lastJob', case
          when latest_job.id is null then null
          else jsonb_build_object(
            'id', latest_job.id,
            'status', latest_job.status,
            'attemptCount', latest_job.attempt_count,
            'createdAt', latest_job.created_at,
            'completedAt', latest_job.completed_at,
            'lastErrorCode', latest_job.last_error_code
          )
        end
      )
      order by
        (projection.value ->> 'eventDate')::date,
        nullif(projection.value ->> 'eventTime', '')::time asc nulls last,
        trip.id
    ),
    '[]'::jsonb
  )
  into v_trips
  from jsonb_array_elements(
    coalesce(public.pd_public_fanbus_trips() -> 'trips', '[]'::jsonb)
  ) as projection(value)
  join app_modules.fanbus_trips as trip
    on trip.id = (projection.value ->> 'tripId')::uuid
  left join app_modules.fanbus_publishing_event_places as binding
    on binding.event_id = trip.event_id
  left join app_modules.fanbus_publishing_places as place
    on place.id = binding.place_id
  left join lateral (
    select job.*
    from app_modules.fanbus_publishing_jobs as job
    where job.environment = v_environment
      and job.trip_id = trip.id
    order by job.created_at desc, job.id desc
    limit 1
  ) as latest_job on true
  where projection.value ->> 'tripStatus' = 'PUBLISHED';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', history.id,
        'tripId', history.trip_id,
        'eventId', history.event_id,
        'placeId', history.place_id,
        'placeSlug', history.place_slug,
        'placeDisplayName', history.place_display_name,
        'jobType', history.job_type,
        'status', history.status,
        'attemptCount', history.attempt_count,
        'createdAt', history.created_at,
        'completedAt', history.completed_at,
        'lastErrorCode', history.last_error_code,
        'resultManifest', history.result_manifest
      )
      order by history.created_at desc, history.id desc
    ),
    '[]'::jsonb
  )
  into v_jobs
  from (
    select
      job.id,
      job.trip_id,
      job.event_id,
      job.place_id,
      place.slug as place_slug,
      place.display_name as place_display_name,
      job.job_type,
      job.status,
      job.attempt_count,
      job.created_at,
      job.completed_at,
      job.last_error_code,
      job.result_manifest
    from app_modules.fanbus_publishing_jobs as job
    join app_modules.fanbus_publishing_places as place
      on place.id = job.place_id
    where job.environment = v_environment
    order by job.created_at desc, job.id desc
    limit 50
  ) as history;

  select coalesce(sum(daily.landing_count), 0)
  into v_landing_count
  from app_modules.fanbus_publishing_place_landing_daily as daily;

  select coalesce(sum(daily.referral_count), 0)
  into v_referral_count
  from app_modules.fanbus_publishing_trip_referral_daily as daily;

  with days as (
    select generate_series(
      app_private.fanbus_publishing_berlin_day(statement_timestamp()) - 29,
      app_private.fanbus_publishing_berlin_day(statement_timestamp()),
      interval '1 day'
    )::date as day
  ),
  landings as (
    select daily.day, sum(daily.landing_count)::bigint as count
    from app_modules.fanbus_publishing_place_landing_daily as daily
    where daily.day >= app_private.fanbus_publishing_berlin_day(statement_timestamp()) - 29
    group by daily.day
  ),
  referrals as (
    select daily.day, sum(daily.referral_count)::bigint as count
    from app_modules.fanbus_publishing_trip_referral_daily as daily
    where daily.day >= app_private.fanbus_publishing_berlin_day(statement_timestamp()) - 29
    group by daily.day
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'day', days.day,
        'landingCount', coalesce(landings.count, 0),
        'referralCount', coalesce(referrals.count, 0)
      )
      order by days.day
    ),
    '[]'::jsonb
  )
  into v_daily
  from days
  left join landings on landings.day = days.day
  left join referrals on referrals.day = days.day;

  return jsonb_build_object(
    'environment', v_environment,
    'places', v_places,
    'trips', v_trips,
    'jobs', v_jobs,
    'stats', jsonb_build_object(
      'landingCount', v_landing_count,
      'referralCount', v_referral_count,
      'daily', v_daily
    )
  );
end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_m340_publishing_slice5;

create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
begin
  if v_action = 'fanbus_publishing_overview' then
    return app_private.api_fanbus_publishing_overview(
      coalesce(p_payload, '{}'::jsonb)
    );
  end if;

  return app_private.pd_api_dispatch_current_before_m340_publishing_slice5(
    p_action,
    p_payload
  );
end;
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_m340_publishing_slice5;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'fanbus_publishing_overview' then 'READ'
    else app_private.platform_action_classification_before_m340_publishing_slice5(
      p_action
    )
  end;
$function$;

revoke all on function
  app_private.api_fanbus_publishing_overview(jsonb),
  app_private.pd_api_dispatch_current_before_m340_publishing_slice5(text, jsonb),
  app_private.platform_action_classification_before_m340_publishing_slice5(text)
from public, anon, authenticated, service_role;

revoke all on function app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

revoke all on function app_private.platform_action_classification(text)
from public, anon, authenticated, service_role;

comment on function app_private.api_fanbus_publishing_overview(jsonb) is
  'M340 capability-geschuetztes Portal-Readmodell fuer Places, oeffentliche Fahrten, Publishing-History und anonyme Tagesstatistik.';

commit;
