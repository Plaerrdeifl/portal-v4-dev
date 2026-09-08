-- M340: fahrtspezifische, anonyme Kurzlink-Statistik im Publishing-Readmodell
-- Keine neue Trackinglogik, keine Request-/Visitor-Daten, nur bestehende Aggregate.

create or replace function app_private.api_fanbus_publishing_overview(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
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
        'tripId', trip.id,
        'eventId', trip.event_id,
        'displayTitle', projection.value ->> 'displayTitle',
        'eventDate', projection.value ->> 'eventDate',
        'eventTime', projection.value ->> 'eventTime',
        'venue', projection.value ->> 'venue',
        'registrationStatus', projection.value ->> 'registrationStatus',
        'resolutionStatus', resolution.value ->> 'status',
        'shortlinkPath', resolution.value -> 'shortlinkPath',
        'resolutionCandidates', resolution.value -> 'candidates',
        'landingCount', coalesce((
          select sum(daily.landing_count)
          from app_modules.fanbus_publishing_event_places as binding
          join app_modules.fanbus_publishing_place_landing_daily as daily
            on daily.place_id = binding.place_id
          where binding.event_id = trip.event_id
        ), 0),
        'referralCount', coalesce((
          select sum(daily.referral_count)
          from app_modules.fanbus_publishing_trip_referral_daily as daily
          where daily.trip_id = trip.id
        ), 0),
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
  cross join lateral (
    select app_private.fanbus_publishing_event_place_status(trip.event_id) as value
  ) as resolution
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
        'displayTitle', history.display_title,
        'eventDate', history.event_date,
        'shortlinkPath', history.shortlink_path,
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
      job.request_snapshot #>> '{trip,displayTitle}' as display_title,
      job.request_snapshot #>> '{trip,eventDate}' as event_date,
      job.request_snapshot ->> 'shortlinkPath' as shortlink_path,
      job.job_type,
      job.status,
      job.attempt_count,
      job.created_at,
      job.completed_at,
      job.last_error_code,
      job.result_manifest
    from app_modules.fanbus_publishing_jobs as job
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
