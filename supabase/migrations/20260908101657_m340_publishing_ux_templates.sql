-- M340 DEV: compact publishing UX, per-trip stats and managed SVG templates.

-- ============================================================
-- 1. Per-link / per-trip anonymous statistics projection
-- ============================================================

create or replace function app_private.m340_fanbus_publishing_trip_stats(
  p_trip_id uuid,
  p_place_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with bounds as (
    select
      app_private.fanbus_publishing_berlin_day(statement_timestamp()) - 29 as first_day,
      app_private.fanbus_publishing_berlin_day(statement_timestamp()) as last_day
  ),
  days as (
    select generate_series(bounds.first_day, bounds.last_day, interval '1 day')::date as day
    from bounds
  ),
  landings as (
    select daily.day, daily.landing_count::bigint as count
    from app_modules.fanbus_publishing_place_landing_daily as daily, bounds
    where daily.place_id = p_place_id
      and daily.day between bounds.first_day and bounds.last_day
  ),
  referrals as (
    select daily.day, daily.referral_count::bigint as count
    from app_modules.fanbus_publishing_trip_referral_daily as daily, bounds
    where daily.place_id = p_place_id
      and daily.trip_id = p_trip_id
      and daily.day between bounds.first_day and bounds.last_day
  ),
  totals as (
    select
      coalesce((
        select sum(daily.landing_count)::bigint
        from app_modules.fanbus_publishing_place_landing_daily as daily
        where daily.place_id = p_place_id
      ), 0) as landing_count,
      coalesce((
        select sum(daily.referral_count)::bigint
        from app_modules.fanbus_publishing_trip_referral_daily as daily
        where daily.place_id = p_place_id
          and daily.trip_id = p_trip_id
      ), 0) as referral_count
  )
  select jsonb_build_object(
    'landingCount', totals.landing_count,
    'referralCount', totals.referral_count,
    'daily', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', days.day,
          'landingCount', coalesce(landings.count, 0),
          'referralCount', coalesce(referrals.count, 0)
        ) order by days.day
      )
      from days
      left join landings on landings.day = days.day
      left join referrals on referrals.day = days.day
    ), '[]'::jsonb)
  )
  from totals;
$function$;

revoke all on function app_private.m340_fanbus_publishing_trip_stats(uuid, uuid)
  from public, anon, authenticated, service_role;

-- ============================================================
-- 2. Private template storage metadata
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'm340-publishing-templates',
  'm340-publishing-templates',
  false,
  5242880,
  array['image/svg+xml']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table app_modules.fanbus_publishing_template_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  environment text not null,
  kind text not null,
  object_name text not null unique,
  original_filename text not null,
  sha256 text not null,
  bytes bigint not null,
  supersedes_id uuid references app_modules.fanbus_publishing_template_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_publishing_template_versions_environment_check
    check (environment ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
  constraint fanbus_publishing_template_versions_kind_check
    check (kind in ('POST', 'STORY', 'LED')),
  constraint fanbus_publishing_template_versions_object_check
    check (
      char_length(object_name) between 20 and 500
      and object_name !~ '[?#\\]'
      and object_name !~ '[.][.]'
    ),
  constraint fanbus_publishing_template_versions_filename_check
    check (
      char_length(original_filename) between 5 and 160
      and original_filename ~ '^[A-Za-z0-9ÄÖÜäöüß._ -]+[.]svg$'
    ),
  constraint fanbus_publishing_template_versions_sha_check
    check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint fanbus_publishing_template_versions_bytes_check
    check (bytes between 1000 and 5242880)
);

create table app_modules.fanbus_publishing_template_state (
  environment text not null,
  kind text not null,
  active_version_id uuid references app_modules.fanbus_publishing_template_versions(id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  primary key (environment, kind),
  constraint fanbus_publishing_template_state_environment_check
    check (environment ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
  constraint fanbus_publishing_template_state_kind_check
    check (kind in ('POST', 'STORY', 'LED'))
);

alter table app_modules.fanbus_publishing_template_versions enable row level security;
alter table app_modules.fanbus_publishing_template_state enable row level security;

revoke all on table
  app_modules.fanbus_publishing_template_versions,
  app_modules.fanbus_publishing_template_state
from public, anon, authenticated, service_role;

-- ============================================================
-- 3. Authenticated portal authorization and rollback
-- ============================================================

create function app_private.api_fanbus_publishing_template_upload_authorize(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_environment text := app_private.platform_release_environment();
  v_kind text := upper(pg_catalog.btrim(coalesce(p_payload ->> 'kind', '')));
  v_filename text := pg_catalog.btrim(coalesce(p_payload ->> 'filename', ''));
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['kind', 'filename']::text[] <> '{}'::jsonb
     or v_kind not in ('POST', 'STORY', 'LED')
     or char_length(v_filename) not between 5 and 160
     or v_filename !~ '^[A-Za-z0-9ÄÖÜäöüß._ -]+[.]svg$'
     or v_environment is null then
    raise exception 'M340_TEMPLATE_UPLOAD_INVALID'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'actorId', v_actor,
    'environment', v_environment,
    'kind', v_kind,
    'filename', v_filename
  );
end;
$function$;

create function app_private.api_fanbus_publishing_template_preview_authorize(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_environment text := app_private.platform_release_environment();
  v_kind text := upper(pg_catalog.btrim(coalesce(p_payload ->> 'kind', '')));
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['kind']::text[] <> '{}'::jsonb
     or v_kind not in ('POST', 'STORY', 'LED')
     or v_environment is null then
    raise exception 'M340_TEMPLATE_PREVIEW_INVALID'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'actorId', v_actor,
    'environment', v_environment,
    'kind', v_kind
  );
end;
$function$;

create function app_private.api_fanbus_publishing_template_rollback(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_environment text := app_private.platform_release_environment();
  v_kind text := upper(pg_catalog.btrim(coalesce(p_payload ->> 'kind', '')));
  v_state app_modules.fanbus_publishing_template_state%rowtype;
  v_current app_modules.fanbus_publishing_template_versions%rowtype;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['kind']::text[] <> '{}'::jsonb
     or v_kind not in ('POST', 'STORY', 'LED')
     or v_environment is null then
    raise exception 'M340_TEMPLATE_ROLLBACK_INVALID'
      using errcode = '22023';
  end if;

  insert into app_modules.fanbus_publishing_template_state(
    environment, kind, active_version_id, updated_by
  ) values (v_environment, v_kind, null, v_actor)
  on conflict (environment, kind) do nothing;

  select state.* into v_state
  from app_modules.fanbus_publishing_template_state as state
  where state.environment = v_environment
    and state.kind = v_kind
  for update;

  if v_state.active_version_id is null then
    raise exception 'M340_TEMPLATE_DEFAULT_ACTIVE'
      using errcode = '22023';
  end if;

  select version.* into strict v_current
  from app_modules.fanbus_publishing_template_versions as version
  where version.id = v_state.active_version_id
    and version.environment = v_environment
    and version.kind = v_kind;

  update app_modules.fanbus_publishing_template_state
  set active_version_id = v_current.supersedes_id,
      updated_at = now(),
      updated_by = v_actor
  where environment = v_environment
    and kind = v_kind;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PUBLISHING_TEMPLATE_ROLLBACK',
    'fanbus_publishing_template',
    v_kind,
    jsonb_build_object('versionId', v_current.id),
    jsonb_build_object('versionId', v_current.supersedes_id)
  );

  return jsonb_build_object(
    'kind', v_kind,
    'source', case when v_current.supersedes_id is null then 'SERVER_DEFAULT' else 'CUSTOM' end
  );
end;
$function$;

-- ============================================================
-- 4. Service-only activation and current-template projection
-- ============================================================

create function public.pd_m340_fanbus_publishing_template_activate(
  p_actor uuid,
  p_kind text,
  p_object_name text,
  p_original_filename text,
  p_sha256 text,
  p_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_kind text := upper(pg_catalog.btrim(coalesce(p_kind, '')));
  v_state app_modules.fanbus_publishing_template_state%rowtype;
  v_version app_modules.fanbus_publishing_template_versions%rowtype;
  v_expected_prefix text;
begin
  if p_actor is null
     or not app_private.has_capability(p_actor, 'fanbus.publishing.manage')
     or v_environment is null
     or v_kind not in ('POST', 'STORY', 'LED') then
    raise exception 'M340_TEMPLATE_ACTIVATE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  v_expected_prefix := 'versions/' || lower(v_environment) || '/' || p_actor::text || '/';
  if p_object_name is null
     or p_object_name not like v_expected_prefix || '%'
     or p_object_name !~ '[0-9a-f-]{36}[.]svg$'
     or p_object_name ~ '[?#\\]'
     or p_object_name ~ '[.][.]'
     or p_original_filename is null
     or char_length(p_original_filename) not between 5 and 160
     or p_original_filename !~ '^[A-Za-z0-9ÄÖÜäöüß._ -]+[.]svg$'
     or p_sha256 !~ '^[0-9a-f]{64}$'
     or p_bytes not between 1000 and 5242880 then
    raise exception 'M340_TEMPLATE_ACTIVATE_INVALID'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'm340-publishing-templates'
      and object.name = p_object_name
  ) then
    raise exception 'M340_TEMPLATE_OBJECT_MISSING'
      using errcode = 'P0002';
  end if;

  insert into app_modules.fanbus_publishing_template_state(
    environment, kind, active_version_id, updated_by
  ) values (v_environment, v_kind, null, p_actor)
  on conflict (environment, kind) do nothing;

  select state.* into v_state
  from app_modules.fanbus_publishing_template_state as state
  where state.environment = v_environment
    and state.kind = v_kind
  for update;

  insert into app_modules.fanbus_publishing_template_versions(
    environment,
    kind,
    object_name,
    original_filename,
    sha256,
    bytes,
    supersedes_id,
    created_by
  ) values (
    v_environment,
    v_kind,
    p_object_name,
    p_original_filename,
    p_sha256,
    p_bytes,
    v_state.active_version_id,
    p_actor
  )
  returning * into v_version;

  update app_modules.fanbus_publishing_template_state
  set active_version_id = v_version.id,
      updated_at = now(),
      updated_by = p_actor
  where environment = v_environment
    and kind = v_kind;

  perform app_private.log_audit(
    p_actor,
    'FANBUS_PUBLISHING_TEMPLATE_ACTIVATED',
    'fanbus_publishing_template',
    v_kind,
    jsonb_build_object('versionId', v_state.active_version_id),
    jsonb_build_object(
      'versionId', v_version.id,
      'sha256', v_version.sha256,
      'bytes', v_version.bytes
    )
  );

  return jsonb_build_object(
    'kind', v_kind,
    'versionId', v_version.id,
    'filename', v_version.original_filename,
    'sha256', v_version.sha256,
    'bytes', v_version.bytes,
    'createdAt', v_version.created_at
  );
end;
$function$;

create function public.pd_m340_fanbus_publishing_template_current(p_kind text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_kind text := nullif(upper(pg_catalog.btrim(coalesce(p_kind, ''))), '');
begin
  if v_environment is null
     or (v_kind is not null and v_kind not in ('POST', 'STORY', 'LED')) then
    raise exception 'M340_TEMPLATE_CURRENT_INVALID'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'environment', v_environment,
    'templates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'kind', kinds.kind,
          'source', case when version.id is null then 'SERVER_DEFAULT' else 'CUSTOM' end,
          'versionId', version.id,
          'objectName', version.object_name,
          'filename', version.original_filename,
          'sha256', version.sha256,
          'bytes', version.bytes,
          'createdAt', version.created_at
        ) order by kinds.ordinal
      )
      from (values ('POST', 1), ('STORY', 2), ('LED', 3)) as kinds(kind, ordinal)
      left join app_modules.fanbus_publishing_template_state as state
        on state.environment = v_environment
       and state.kind = kinds.kind
      left join app_modules.fanbus_publishing_template_versions as version
        on version.id = state.active_version_id
      where v_kind is null or kinds.kind = v_kind
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.pd_m340_fanbus_publishing_template_activate(uuid, text, text, text, text, bigint)
  from public, anon, authenticated;
revoke all on function public.pd_m340_fanbus_publishing_template_current(text)
  from public, anon, authenticated;
grant execute on function public.pd_m340_fanbus_publishing_template_activate(uuid, text, text, text, text, bigint)
  to service_role;
grant execute on function public.pd_m340_fanbus_publishing_template_current(text)
  to service_role;

-- ============================================================
-- 5. Overview: compact trips + per-trip stats + template status
-- ============================================================

create or replace function app_private.api_fanbus_publishing_overview(p_payload jsonb)
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
  v_templates jsonb := '[]'::jsonb;
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
        'eventDate', projection.value ->> 'eventDate',
        'eventTime', projection.value ->> 'eventTime',
        'venue', projection.value ->> 'venue',
        'resolutionStatus', resolution.value ->> 'status',
        'resolutionCandidates', resolution.value -> 'candidates',
        'stats', case
          when binding.place_id is null then jsonb_build_object(
            'landingCount', 0,
            'referralCount', 0,
            'daily', '[]'::jsonb
          )
          else app_private.m340_fanbus_publishing_trip_stats(trip.id, binding.place_id)
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
  cross join lateral (
    select app_private.fanbus_publishing_event_place_status(trip.event_id) as value
  ) as resolution
  left join app_modules.fanbus_publishing_event_places as binding
    on binding.event_id = trip.event_id
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
        'venue', history.venue,
        'eventDate', history.event_date,
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
      coalesce(
        nullif(job.request_snapshot #>> '{trip,venue}', ''),
        job.request_snapshot #>> '{place,displayName}'
      ) as venue,
      job.request_snapshot #>> '{trip,eventDate}' as event_date,
      job.status,
      job.attempt_count,
      job.created_at,
      job.completed_at,
      job.last_error_code,
      job.result_manifest
    from app_modules.fanbus_publishing_jobs as job
    where job.environment = v_environment
    order by job.created_at desc, job.id desc
    limit 100
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
      ) order by days.day
    ), '[]'::jsonb
  )
  into v_daily
  from days
  left join landings on landings.day = days.day
  left join referrals on referrals.day = days.day;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'kind', kinds.kind,
      'label', kinds.label,
      'source', case when version.id is null then 'SERVER_DEFAULT' else 'CUSTOM' end,
      'filename', version.original_filename,
      'updatedAt', version.created_at,
      'canRollback', version.id is not null
    ) order by kinds.ordinal
  ), '[]'::jsonb)
  into v_templates
  from (values
    ('POST', 'Instagram Post', 1),
    ('STORY', 'Instagram Story', 2),
    ('LED', 'LED 16:9', 3)
  ) as kinds(kind, label, ordinal)
  left join app_modules.fanbus_publishing_template_state as state
    on state.environment = v_environment
   and state.kind = kinds.kind
  left join app_modules.fanbus_publishing_template_versions as version
    on version.id = state.active_version_id;

  return jsonb_build_object(
    'environment', v_environment,
    'trips', v_trips,
    'jobs', v_jobs,
    'templates', v_templates,
    'stats', jsonb_build_object(
      'landingCount', v_landing_count,
      'referralCount', v_referral_count,
      'daily', v_daily
    )
  );
end;
$function$;

-- ============================================================
-- 6. Central pd_api routing
-- ============================================================

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_m340_publishing_ux_templates;

create function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
begin
  case v_action
    when 'fanbus_publishing_template_upload_authorize' then
      return app_private.api_fanbus_publishing_template_upload_authorize(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_publishing_template_preview_authorize' then
      return app_private.api_fanbus_publishing_template_preview_authorize(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_publishing_template_rollback' then
      return app_private.api_fanbus_publishing_template_rollback(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return app_private.pd_api_dispatch_current_before_m340_publishing_ux_templates(
        p_action, p_payload
      );
  end case;
end;
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_m340_publishing_ux_templates;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'fanbus_publishing_template_upload_authorize' then 'READ'
    when 'fanbus_publishing_template_preview_authorize' then 'READ'
    when 'fanbus_publishing_template_rollback' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m340_publishing_ux_templates(p_action)
  end;
$function$;

revoke all on function
  app_private.api_fanbus_publishing_template_upload_authorize(jsonb),
  app_private.api_fanbus_publishing_template_preview_authorize(jsonb),
  app_private.api_fanbus_publishing_template_rollback(jsonb),
  app_private.pd_api_dispatch_current_before_m340_publishing_ux_templates(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb),
  app_private.platform_action_classification_before_m340_publishing_ux_templates(text),
  app_private.platform_action_classification(text)
from public, anon, authenticated, service_role;
