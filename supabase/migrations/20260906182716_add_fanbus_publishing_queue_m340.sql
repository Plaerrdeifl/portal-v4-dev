-- Plaerrdeifl Digitalplattform V4
-- M340 / F4 DEV / Slice 3: Publishing-Queue und abgesicherter Worker-Vertrag

begin;

-- ============================================================
-- 1. Serverseitige Publishing-Queue
-- ============================================================

create table app_modules.fanbus_publishing_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  environment text not null,
  trip_id uuid not null
    references app_modules.fanbus_trips(id) on delete restrict,
  event_id uuid not null
    references app_modules.events(id) on delete restrict,
  place_id uuid not null
    references app_modules.fanbus_publishing_places(id) on delete restrict,
  job_type text not null default 'ASSET_BUNDLE',
  status text not null default 'QUEUED',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  last_completed_claim_token uuid,
  last_completion_success boolean,
  completed_at timestamptz,
  last_error_code text,
  request_snapshot jsonb not null,
  result_manifest jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  revision integer not null default 1,
  constraint fanbus_publishing_jobs_environment_check
    check (
      char_length(environment) between 2 and 32
      and environment ~ '^[A-Z][A-Z0-9_-]{1,31}$'
    ),
  constraint fanbus_publishing_jobs_job_type_check
    check (job_type = 'ASSET_BUNDLE'),
  constraint fanbus_publishing_jobs_status_check
    check (status in ('QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED')),
  constraint fanbus_publishing_jobs_attempt_count_check
    check (attempt_count between 0 and 5),
  constraint fanbus_publishing_jobs_revision_check
    check (revision > 0),
  constraint fanbus_publishing_jobs_claim_state_check
    check (
      (
        status = 'PROCESSING'
        and claim_token is not null
        and claimed_at is not null
        and claim_expires_at is not null
        and completed_at is null
      )
      or
      (
        status <> 'PROCESSING'
        and claim_token is null
        and claimed_at is null
        and claim_expires_at is null
      )
    ),
  constraint fanbus_publishing_jobs_terminal_state_check
    check (
      (
        status = 'SUCCESS'
        and completed_at is not null
        and result_manifest is not null
        and last_error_code is null
      )
      or
      (
        status = 'FAILED'
        and completed_at is not null
        and result_manifest is null
        and last_error_code is not null
      )
      or
      (
        status in ('QUEUED', 'PROCESSING')
        and completed_at is null
        and result_manifest is null
      )
    ),
  constraint fanbus_publishing_jobs_completion_record_check
    check (
      (last_completed_claim_token is null and last_completion_success is null)
      or
      (last_completed_claim_token is not null and last_completion_success is not null)
    )
);

create unique index fanbus_publishing_jobs_one_processing_environment_uidx
  on app_modules.fanbus_publishing_jobs(environment)
  where status = 'PROCESSING';

create unique index fanbus_publishing_jobs_active_trip_uidx
  on app_modules.fanbus_publishing_jobs(environment, trip_id)
  where status in ('QUEUED', 'PROCESSING');

create index fanbus_publishing_jobs_claim_order_idx
  on app_modules.fanbus_publishing_jobs(
    environment,
    status,
    available_at,
    created_at,
    id
  );

alter table app_modules.fanbus_publishing_jobs enable row level security;

revoke all on table app_modules.fanbus_publishing_jobs
from public, anon, authenticated, service_role;

create trigger fanbus_publishing_jobs_set_updated_at
before update on app_modules.fanbus_publishing_jobs
for each row execute function app_private.set_updated_at();

-- ============================================================
-- 2. Unveraenderlicher Request-Snapshot und feste Retry-Abstaende
-- ============================================================

create function app_private.m340_fanbus_publishing_job_guard_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.request_snapshot is distinct from old.request_snapshot then
    raise exception 'M340_PUBLISHING_REQUEST_SNAPSHOT_IMMUTABLE'
      using errcode = '55000';
  end if;
  return new;
end;
$function$;

create trigger fanbus_publishing_jobs_guard_snapshot
before update of request_snapshot
on app_modules.fanbus_publishing_jobs
for each row execute function app_private.m340_fanbus_publishing_job_guard_snapshot();

create function app_private.m340_fanbus_publishing_retry_delay(
  p_attempt_count integer
)
returns interval
language sql
immutable
set search_path = ''
as $function$
  select case p_attempt_count
    when 1 then interval '1 minute'
    when 2 then interval '5 minutes'
    when 3 then interval '15 minutes'
    when 4 then interval '60 minutes'
    else null
  end;
$function$;

-- ============================================================
-- 3. Exakter Result-Manifest-Vertrag
-- ============================================================

create function app_private.m340_fanbus_publishing_manifest_is_valid(
  p_manifest jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select
    p_manifest is not null
    and pg_catalog.jsonb_typeof(p_manifest) = 'object'
    and (
      select pg_catalog.array_agg(entry.key order by entry.key)
      from pg_catalog.jsonb_object_keys(p_manifest) as entry(key)
    ) = array['artifacts', 'schemaVersion']::text[]
    and p_manifest -> 'schemaVersion' = '1'::jsonb
    and pg_catalog.jsonb_typeof(p_manifest -> 'artifacts') = 'array'
    and pg_catalog.jsonb_array_length(p_manifest -> 'artifacts') = 4
    and (
      select pg_catalog.count(*) = 4
        and pg_catalog.count(distinct artifact.value ->> 'kind') = 4
        and pg_catalog.bool_and(
          pg_catalog.jsonb_typeof(artifact.value) = 'object'
          and (
            select pg_catalog.array_agg(field.key order by field.key)
            from pg_catalog.jsonb_object_keys(artifact.value) as field(key)
          ) = array[
            'bytes', 'filename', 'kind', 'nextcloudPath', 'sha256'
          ]::text[]
          and pg_catalog.jsonb_typeof(artifact.value -> 'kind') = 'string'
          and artifact.value ->> 'kind' in ('QR', 'POST', 'STORY', 'LED')
          and pg_catalog.jsonb_typeof(artifact.value -> 'filename') = 'string'
          and pg_catalog.char_length(artifact.value ->> 'filename') between 1 and 160
          and artifact.value ->> 'filename' ~ '^[A-Za-z0-9._-]+[.]png$'
          and pg_catalog.jsonb_typeof(artifact.value -> 'nextcloudPath') = 'string'
          and pg_catalog.char_length(artifact.value ->> 'nextcloudPath') between 1 and 500
          and artifact.value ->> 'nextcloudPath' like '/Fanbus/%'
          and pg_catalog.strpos(artifact.value ->> 'nextcloudPath', '..') = 0
          and pg_catalog.strpos(artifact.value ->> 'nextcloudPath', E'\\') = 0
          and pg_catalog.strpos(artifact.value ->> 'nextcloudPath', '?') = 0
          and pg_catalog.strpos(artifact.value ->> 'nextcloudPath', '#') = 0
          and pg_catalog.lower(artifact.value ->> 'nextcloudPath') not like 'http://%'
          and pg_catalog.lower(artifact.value ->> 'nextcloudPath') not like 'https://%'
          and pg_catalog.jsonb_typeof(artifact.value -> 'sha256') = 'string'
          and artifact.value ->> 'sha256' ~ '^[0-9a-f]{64}$'
          and pg_catalog.jsonb_typeof(artifact.value -> 'bytes') = 'number'
          and artifact.value ->> 'bytes' ~ '^[0-9]+$'
          and (artifact.value ->> 'bytes')::numeric between 1 and 104857600
        )
        and pg_catalog.count(*) filter (
          where artifact.value ->> 'kind' = 'QR'
        ) = 1
        and pg_catalog.count(*) filter (
          where artifact.value ->> 'kind' = 'POST'
        ) = 1
        and pg_catalog.count(*) filter (
          where artifact.value ->> 'kind' = 'STORY'
        ) = 1
        and pg_catalog.count(*) filter (
          where artifact.value ->> 'kind' = 'LED'
        ) = 1
      from pg_catalog.jsonb_array_elements(
        p_manifest -> 'artifacts'
      ) as artifact(value)
    );
$function$;

-- ============================================================
-- 4. Admin-Enqueue ueber bestehenden pd_api-Vertrag
-- ============================================================

create function app_private.api_fanbus_publishing_job_enqueue(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_environment text := app_private.platform_release_environment();
  v_trip_id uuid;
  v_event_id uuid;
  v_place_id uuid;
  v_place_slug text;
  v_place_display_name text;
  v_trip_projection jsonb;
  v_boarding_stops jsonb;
  v_snapshot jsonb;
  v_job app_modules.fanbus_publishing_jobs%rowtype;
  v_inserted boolean := false;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or not p_payload ? 'tripId'
     or p_payload - array['tripId']::text[] <> '{}'::jsonb
     or pg_catalog.jsonb_typeof(p_payload -> 'tripId') <> 'string' then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  begin
    v_trip_id := nullif(pg_catalog.btrim(p_payload ->> 'tripId'), '')::uuid;
  exception when others then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD'
      using errcode = '22023';
  end;

  if v_trip_id is null
     or v_environment is null then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select
    trip.event_id,
    binding.place_id,
    place.slug,
    place.display_name
  into
    v_event_id,
    v_place_id,
    v_place_slug,
    v_place_display_name
  from app_modules.fanbus_trips as trip
  join app_modules.fanbus_publishing_event_places as binding
    on binding.event_id = trip.event_id
  join app_modules.fanbus_publishing_places as place
    on place.id = binding.place_id
   and place.is_active
  where trip.id = v_trip_id
    and trip.status = 'PUBLISHED';

  if not found then
    raise exception 'M340_PUBLISHING_TRIP_NOT_ELIGIBLE'
      using errcode = 'P0002';
  end if;

  select item.value
    into v_trip_projection
  from pg_catalog.jsonb_array_elements(
    coalesce(public.pd_public_fanbus_trips() -> 'trips', '[]'::jsonb)
  ) as item(value)
  where item.value ->> 'tripId' = v_trip_id::text
    and item.value ->> 'tripStatus' = 'PUBLISHED'
  limit 1;

  if v_trip_projection is null then
    raise exception 'M340_PUBLISHING_TRIP_NOT_PUBLIC'
      using errcode = 'P0002';
  end if;

  v_boarding_stops := coalesce(
    public.pd_public_fanbus_trip_boarding_stops(v_trip_id) -> 'stops',
    '[]'::jsonb
  );
  if pg_catalog.jsonb_typeof(v_boarding_stops) <> 'array' then
    raise exception 'M340_PUBLISHING_STOPS_INVALID'
      using errcode = '22023';
  end if;

  v_snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'shortlinkPath', '/ontour/' || v_place_slug,
    'place', jsonb_build_object(
      'id', v_place_id,
      'slug', v_place_slug,
      'displayName', v_place_display_name
    ),
    'trip', v_trip_projection,
    'boardingStops', v_boarding_stops
  );

  insert into app_modules.fanbus_publishing_jobs (
    environment,
    trip_id,
    event_id,
    place_id,
    request_snapshot,
    created_by,
    updated_by
  )
  values (
    v_environment,
    v_trip_id,
    v_event_id,
    v_place_id,
    v_snapshot,
    v_actor,
    v_actor
  )
  on conflict (environment, trip_id)
    where status in ('QUEUED', 'PROCESSING')
  do nothing
  returning * into v_job;

  if found then
    v_inserted := true;
  else
    select job.*
      into v_job
    from app_modules.fanbus_publishing_jobs as job
    where job.environment = v_environment
      and job.trip_id = v_trip_id
      and job.status in ('QUEUED', 'PROCESSING')
    order by job.created_at, job.id
    limit 1;
  end if;

  if v_job.id is null then
    raise exception 'M340_PUBLISHING_ENQUEUE_CONFLICT'
      using errcode = '40001';
  end if;

  if v_inserted then
    perform app_private.log_audit(
      v_actor,
      'FANBUS_PUBLISHING_JOB_ENQUEUED',
      'fanbus_publishing_job',
      v_job.id::text,
      null,
      jsonb_build_object(
        'id', v_job.id,
        'environment', v_job.environment,
        'tripId', v_job.trip_id,
        'eventId', v_job.event_id,
        'placeId', v_job.place_id,
        'jobType', v_job.job_type,
        'status', v_job.status
      )
    );
  end if;

  return jsonb_build_object(
    'job', jsonb_build_object(
      'id', v_job.id,
      'environment', v_job.environment,
      'tripId', v_job.trip_id,
      'eventId', v_job.event_id,
      'placeId', v_job.place_id,
      'jobType', v_job.job_type,
      'status', v_job.status,
      'attemptCount', v_job.attempt_count,
      'createdAt', v_job.created_at
    ),
    'idempotent', not v_inserted
  );
end;
$function$;

-- ============================================================
-- 5. Serialisierter Claim mit 15-Minuten-Lease
-- ============================================================

create function app_private.m340_fanbus_publishing_job_claim()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_now timestamptz := now();
  v_job app_modules.fanbus_publishing_jobs%rowtype;
begin
  if v_environment is null then
    raise exception 'M340_PUBLISHING_ENVIRONMENT_INVALID'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('m340-publishing:' || v_environment, 0)
  );

  update app_modules.fanbus_publishing_jobs as job
  set
    status = case
      when job.attempt_count >= 5 then 'FAILED'
      else 'QUEUED'
    end,
    available_at = case
      when job.attempt_count < 5 then
        v_now + app_private.m340_fanbus_publishing_retry_delay(job.attempt_count)
      else job.available_at
    end,
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null,
    completed_at = case
      when job.attempt_count >= 5 then v_now
      else null
    end,
    result_manifest = null,
    last_error_code = 'CLAIM_EXPIRED',
    updated_by = null,
    revision = job.revision + 1
  where job.environment = v_environment
    and job.status = 'PROCESSING'
    and job.claim_expires_at <= v_now;

  if exists (
    select 1
    from app_modules.fanbus_publishing_jobs as job
    where job.environment = v_environment
      and job.status = 'PROCESSING'
  ) then
    return jsonb_build_object('claimed', false);
  end if;

  with candidate as materialized (
    select job.id
    from app_modules.fanbus_publishing_jobs as job
    where job.environment = v_environment
      and job.status = 'QUEUED'
      and job.attempt_count < 5
      and job.available_at <= v_now
    order by job.available_at, job.created_at, job.id
    limit 1
    for update skip locked
  )
  update app_modules.fanbus_publishing_jobs as job
  set
    status = 'PROCESSING',
    attempt_count = job.attempt_count + 1,
    claim_token = extensions.gen_random_uuid(),
    claimed_at = v_now,
    claim_expires_at = v_now + interval '15 minutes',
    completed_at = null,
    result_manifest = null,
    updated_by = null,
    revision = job.revision + 1
  from candidate
  where job.id = candidate.id
  returning job.* into v_job;

  if v_job.id is null then
    return jsonb_build_object('claimed', false);
  end if;

  return jsonb_build_object(
    'claimed', true,
    'job', jsonb_build_object(
      'jobId', v_job.id,
      'claimToken', v_job.claim_token,
      'environment', v_job.environment,
      'attemptCount', v_job.attempt_count,
      'claimExpiresAt', v_job.claim_expires_at,
      'request', v_job.request_snapshot
    )
  );
end;
$function$;

create function public.pd_m340_fanbus_publishing_job_claim()
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $function$
  select app_private.m340_fanbus_publishing_job_claim();
$function$;

-- ============================================================
-- 6. Claim-gebundener, idempotenter Complete-Vertrag
-- ============================================================

create function app_private.m340_fanbus_publishing_job_complete(
  p_job_id uuid,
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
  v_environment text := app_private.platform_release_environment();
  v_now timestamptz := now();
  v_error_code text := nullif(pg_catalog.btrim(coalesce(p_error_code, '')), '');
  v_job app_modules.fanbus_publishing_jobs%rowtype;
  v_status text;
begin
  if p_job_id is null
     or p_claim_token is null
     or p_success is null
     or v_environment is null then
    raise exception 'M340_PUBLISHING_COMPLETE_INVALID'
      using errcode = '22023';
  end if;

  if p_success then
    if v_error_code is not null
       or not app_private.m340_fanbus_publishing_manifest_is_valid(
         p_result_manifest
       ) then
      raise exception 'M340_PUBLISHING_COMPLETE_INVALID'
        using errcode = '22023';
    end if;
  elsif p_result_manifest is not null
        or v_error_code is null
        or pg_catalog.char_length(v_error_code) not between 1 and 80
        or v_error_code !~ '^[A-Z0-9_:-]+$' then
    raise exception 'M340_PUBLISHING_COMPLETE_INVALID'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('m340-publishing:' || v_environment, 0)
  );

  select job.*
    into v_job
  from app_modules.fanbus_publishing_jobs as job
  where job.id = p_job_id
    and job.environment = v_environment
  for update;

  if not found then
    raise exception 'M340_PUBLISHING_CLAIM_INVALID'
      using errcode = '42501';
  end if;

  if v_job.last_completed_claim_token is not distinct from p_claim_token then
    if v_job.last_completion_success is not distinct from p_success
       and (
         (
           p_success
           and v_job.result_manifest is not distinct from p_result_manifest
           and v_error_code is null
         )
         or
         (
           not p_success
           and v_job.last_error_code is not distinct from v_error_code
           and p_result_manifest is null
         )
       ) then
      return jsonb_build_object(
        'completed', true,
        'idempotent', true,
        'status', v_job.status
      );
    end if;

    raise exception 'M340_PUBLISHING_COMPLETE_REPLAY_CONFLICT'
      using errcode = '23505';
  end if;

  if v_job.status <> 'PROCESSING'
     or v_job.claim_token is distinct from p_claim_token
     or v_job.claim_expires_at <= v_now then
    raise exception 'M340_PUBLISHING_CLAIM_INVALID'
      using errcode = '42501';
  end if;

  if p_success then
    v_status := 'SUCCESS';
    update app_modules.fanbus_publishing_jobs as job
    set
      status = v_status,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      completed_at = v_now,
      last_error_code = null,
      result_manifest = p_result_manifest,
      last_completed_claim_token = p_claim_token,
      last_completion_success = true,
      updated_by = null,
      revision = job.revision + 1
    where job.id = p_job_id;
  else
    v_status := case
      when v_job.attempt_count >= 5 then 'FAILED'
      else 'QUEUED'
    end;
    update app_modules.fanbus_publishing_jobs as job
    set
      status = v_status,
      available_at = case
        when v_status = 'QUEUED' then
          v_now + app_private.m340_fanbus_publishing_retry_delay(
            v_job.attempt_count
          )
        else job.available_at
      end,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      completed_at = case when v_status = 'FAILED' then v_now else null end,
      last_error_code = v_error_code,
      result_manifest = null,
      last_completed_claim_token = p_claim_token,
      last_completion_success = false,
      updated_by = null,
      revision = job.revision + 1
    where job.id = p_job_id;
  end if;

  return jsonb_build_object(
    'completed', true,
    'idempotent', false,
    'status', v_status
  );
end;
$function$;

create function public.pd_m340_fanbus_publishing_job_complete(
  p_job_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error_code text,
  p_result_manifest jsonb
)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $function$
  select app_private.m340_fanbus_publishing_job_complete(
    p_job_id,
    p_claim_token,
    p_success,
    p_error_code,
    p_result_manifest
  );
$function$;

-- ============================================================
-- 7. Einbindung in pd_api und Plattform-Mutation-Gate
-- ============================================================

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_m340_publishing_slice3;

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
  if v_action = 'fanbus_publishing_job_enqueue' then
    return app_private.api_fanbus_publishing_job_enqueue(
      coalesce(p_payload, '{}'::jsonb)
    );
  end if;

  return app_private.pd_api_dispatch_current_before_m340_publishing_slice3(
    p_action,
    p_payload
  );
end;
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_m340_publishing_slice3;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'fanbus_publishing_job_enqueue' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m340_publishing_slice3(
      p_action
    )
  end;
$function$;

-- ============================================================
-- 8. Default-Deny: nur Service Role darf Worker-RPCs aufrufen
-- ============================================================

revoke all on function
  app_private.m340_fanbus_publishing_job_guard_snapshot(),
  app_private.m340_fanbus_publishing_retry_delay(integer),
  app_private.m340_fanbus_publishing_manifest_is_valid(jsonb),
  app_private.api_fanbus_publishing_job_enqueue(jsonb),
  app_private.m340_fanbus_publishing_job_claim(),
  app_private.m340_fanbus_publishing_job_complete(uuid, uuid, boolean, text, jsonb),
  app_private.pd_api_dispatch_current_before_m340_publishing_slice3(text, jsonb),
  app_private.platform_action_classification_before_m340_publishing_slice3(text)
from public, anon, authenticated, service_role;

revoke all on function app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

revoke all on function app_private.platform_action_classification(text)
from public, anon, authenticated, service_role;

revoke all on function public.pd_m340_fanbus_publishing_job_claim()
from public, anon, authenticated, service_role;

revoke all on function public.pd_m340_fanbus_publishing_job_complete(
  uuid,
  uuid,
  boolean,
  text,
  jsonb
)
from public, anon, authenticated, service_role;

grant execute on function public.pd_m340_fanbus_publishing_job_claim()
to service_role;

grant execute on function public.pd_m340_fanbus_publishing_job_complete(
  uuid,
  uuid,
  boolean,
  text,
  jsonb
)
to service_role;

commit;
