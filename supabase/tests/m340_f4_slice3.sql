\set ON_ERROR_STOP on

begin;

do $m340_slice3_schema$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_constraintdef(constraint_row.oid)
    into v_definition
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conname = 'fanbus_publishing_jobs_status_check';
  if v_definition is null
     or v_definition !~ 'QUEUED'
     or v_definition !~ 'PROCESSING'
     or v_definition !~ 'SUCCESS'
     or v_definition !~ 'FAILED' then
    raise exception 'M340 Slice 3 status constraint missing';
  end if;

  select pg_catalog.pg_get_constraintdef(constraint_row.oid)
    into v_definition
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conname = 'fanbus_publishing_jobs_attempt_count_check';
  if v_definition is null or v_definition !~ 'attempt_count.*0.*5' then
    raise exception 'M340 Slice 3 attempt constraint missing';
  end if;

  select pg_catalog.pg_get_constraintdef(constraint_row.oid)
    into v_definition
  from pg_catalog.pg_constraint as constraint_row
  where constraint_row.conname = 'fanbus_publishing_jobs_job_type_check';
  if v_definition is null or v_definition !~ 'ASSET_BUNDLE' then
    raise exception 'M340 Slice 3 job type constraint missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'app_modules'
      and indexname = 'fanbus_publishing_jobs_one_processing_environment_uidx'
      and indexdef ~* 'unique'
      and indexdef ~* 'where.*status.*PROCESSING'
  ) or not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'app_modules'
      and indexname = 'fanbus_publishing_jobs_active_trip_uidx'
      and indexdef ~* 'unique'
      and indexdef ~* 'environment.*trip_id'
      and indexdef ~* 'QUEUED.*PROCESSING'
  ) then
    raise exception 'M340 Slice 3 queue uniqueness indexes missing';
  end if;

  if app_private.m340_fanbus_publishing_retry_delay(1) <> interval '1 minute'
     or app_private.m340_fanbus_publishing_retry_delay(2) <> interval '5 minutes'
     or app_private.m340_fanbus_publishing_retry_delay(3) <> interval '15 minutes'
     or app_private.m340_fanbus_publishing_retry_delay(4) <> interval '60 minutes'
     or app_private.m340_fanbus_publishing_retry_delay(5) is not null then
    raise exception 'M340 Slice 3 retry schedule differs from 1/5/15/60';
  end if;

  if app_private.platform_action_classification(
    'fanbus_publishing_job_enqueue'
  ) <> 'USER_MUTATION' then
    raise exception 'M340 Slice 3 action is not USER_MUTATION';
  end if;
  if pg_catalog.pg_get_functiondef(
    'app_private.pd_api_dispatch_current(text,jsonb)'::pg_catalog.regprocedure
  ) !~ 'fanbus_publishing_job_enqueue' then
    raise exception 'M340 Slice 3 pd_api route missing';
  end if;

  raise notice 'M340_SLICE3_SCHEMA_OK';
end
$m340_slice3_schema$;

update app_portal.settings
set
  value = jsonb_build_object('mode', 'NORMAL', 'environment', 'LOCAL'),
  revision = revision + 1,
  updated_at = now(),
  updated_by = null
where key = 'platform.mode';

do $m340_slice3_environment$
begin
  if app_private.platform_release_environment() <> 'LOCAL' then
    raise exception 'M340 Slice 3 environment fixture is not LOCAL';
  end if;
  raise notice 'M340_SLICE3_ENVIRONMENT_OK';
end
$m340_slice3_environment$;

insert into auth.users(id, email)
values
  ('00000000-0000-4340-a000-000000000001', 'm340-slice3-publisher@example.invalid'),
  ('00000000-0000-4340-a000-000000000002', 'm340-slice3-denied@example.invalid');

insert into app_portal.users(
  id,
  user_code,
  email,
  first_name,
  last_name,
  status,
  role_id
)
select
  fixture.id,
  fixture.user_code,
  fixture.email,
  'M340',
  fixture.last_name,
  'ACTIVE',
  role.id
from (
  values
    (
      '00000000-0000-4340-a000-000000000001'::uuid,
      'U-M340-SLICE3-PUBLISHER',
      'm340-slice3-publisher@example.invalid',
      'Publisher'
    ),
    (
      '00000000-0000-4340-a000-000000000002'::uuid,
      'U-M340-SLICE3-DENIED',
      'm340-slice3-denied@example.invalid',
      'Denied'
    )
) as fixture(id, user_code, email, last_name)
join app_portal.portal_roles as role
  on role.code = 'PORTAL_USER'
 and role.is_active;

insert into app_portal.team_memberships(team_id, user_id, team_role, is_active)
select
  team.id,
  fixture.user_id,
  'MEMBER',
  true
from app_portal.teams as team
cross join (
  values
    ('00000000-0000-4340-a000-000000000001'::uuid),
    ('00000000-0000-4340-a000-000000000002'::uuid)
) as fixture(user_id)
where team.code = 'BUS_ORGA'
  and team.is_active;

insert into app_portal.team_function_assignments(
  team_id,
  user_id,
  function_code,
  created_by
)
select
  team.id,
  '00000000-0000-4340-a000-000000000001',
  'BUS_PUBLISHING',
  null
from app_portal.teams as team
where team.code = 'BUS_ORGA'
  and team.is_active;

insert into app_modules.fanbus_publishing_places(
  id,
  slug,
  display_name
)
values (
  '00000000-0000-4340-a100-000000000001',
  'slice3-place',
  'Slice 3 Place'
);

insert into app_modules.fanbus_publishing_place_keys(
  place_id,
  place_key,
  source_label
)
values (
  '00000000-0000-4340-a100-000000000001',
  'v1:slice-3-place',
  'Slice 3 Place'
);

insert into app_modules.events(
  id,
  event_type,
  title,
  event_date,
  event_time,
  venue,
  visibility
)
select
  fixture.id,
  'OTHER',
  fixture.title,
  (now() at time zone 'Europe/Berlin')::date + fixture.day_offset,
  time '18:00',
  'Slice 3 Place',
  'PUBLIC'
from (
  values
    ('00000000-0000-4340-a200-000000000001'::uuid, 'Slice 3 Main', 30),
    ('00000000-0000-4340-a200-000000000002'::uuid, 'Slice 3 Expiry', 31)
) as fixture(id, title, day_offset);

insert into app_modules.fanbus_publishing_event_places(
  event_id,
  place_id,
  bound_place_key
)
select
  event.id,
  '00000000-0000-4340-a100-000000000001',
  'v1:slice-3-place'
from app_modules.events as event
where event.id in (
  '00000000-0000-4340-a200-000000000001',
  '00000000-0000-4340-a200-000000000002'
);

insert into app_modules.fanbus_trips(
  id,
  event_id,
  departure_at,
  departure_info,
  registration_opens_at,
  registration_closes_at,
  price_cents,
  capacity,
  privacy_reference,
  terms_reference,
  status
)
select
  fixture.trip_id,
  fixture.event_id,
  (event.event_date - 1 + time '12:00') at time zone 'Europe/Berlin',
  'M340 Slice 3 Testabfahrt',
  now() - interval '1 day',
  (event.event_date - 2 + time '20:00') at time zone 'Europe/Berlin',
  2500,
  20,
  'privacy-v1',
  'terms-v1',
  'PUBLISHED'
from (
  values
    (
      '00000000-0000-4340-a300-000000000001'::uuid,
      '00000000-0000-4340-a200-000000000001'::uuid
    ),
    (
      '00000000-0000-4340-a300-000000000002'::uuid,
      '00000000-0000-4340-a200-000000000002'::uuid
    )
) as fixture(trip_id, event_id)
join app_modules.events as event on event.id = fixture.event_id;

insert into app_modules.fanbus_buses(
  id,
  trip_id,
  label,
  category,
  capacity,
  is_active
)
values
  (
    '00000000-0000-4340-a400-000000000001',
    '00000000-0000-4340-a300-000000000001',
    'Slice 3 Bus 1',
    'NORMAL',
    20,
    true
  ),
  (
    '00000000-0000-4340-a400-000000000002',
    '00000000-0000-4340-a300-000000000002',
    'Slice 3 Bus 2',
    'NORMAL',
    20,
    true
  );

insert into app_modules.fanbus_boarding_stops(
  id,
  label,
  address,
  default_note,
  position,
  is_active
)
values (
  '00000000-0000-4340-a500-000000000001',
  'Slice 3 Zustieg',
  'Testweg 1',
  'Nur Testfixture',
  9340,
  true
);

insert into app_modules.fanbus_trip_boarding_stops(
  id,
  trip_id,
  boarding_stop_id,
  departure_at,
  position,
  trip_note,
  is_active
)
select
  fixture.id,
  fixture.trip_id,
  '00000000-0000-4340-a500-000000000001',
  trip.departure_at,
  1,
  null,
  true
from (
  values
    (
      '00000000-0000-4340-a600-000000000001'::uuid,
      '00000000-0000-4340-a300-000000000001'::uuid
    ),
    (
      '00000000-0000-4340-a600-000000000002'::uuid,
      '00000000-0000-4340-a300-000000000002'::uuid
    )
) as fixture(id, trip_id)
join app_modules.fanbus_trips as trip on trip.id = fixture.trip_id;

create temporary table m340_slice3_state (
  name text primary key,
  value jsonb not null
) on commit drop;

insert into m340_slice3_state(name, value)
values (
  'manifest',
  jsonb_build_object(
    'schemaVersion', 1,
    'artifacts', jsonb_build_array(
      jsonb_build_object(
        'kind', 'QR',
        'filename', 'slice3-qr.png',
        'nextcloudPath', '/Fanbus/_TEST/slice3-qr.png',
        'sha256', repeat('a', 64),
        'bytes', 101
      ),
      jsonb_build_object(
        'kind', 'POST',
        'filename', 'slice3-post.png',
        'nextcloudPath', '/Fanbus/_TEST/slice3-post.png',
        'sha256', repeat('b', 64),
        'bytes', 102
      ),
      jsonb_build_object(
        'kind', 'STORY',
        'filename', 'slice3-story.png',
        'nextcloudPath', '/Fanbus/_TEST/slice3-story.png',
        'sha256', repeat('c', 64),
        'bytes', 103
      ),
      jsonb_build_object(
        'kind', 'LED',
        'filename', 'slice3-led.png',
        'nextcloudPath', '/Fanbus/_TEST/slice3-led.png',
        'sha256', repeat('d', 64),
        'bytes', 104
      )
    )
  )
);

do $m340_slice3_auth_enqueue$
declare
  v_authorized uuid := '00000000-0000-4340-a000-000000000001';
  v_denied uuid := '00000000-0000-4340-a000-000000000002';
  v_response jsonb;
  v_duplicate jsonb;
  v_job_id uuid;
  v_snapshot jsonb;
  v_audit_count bigint;
begin
  if not app_private.has_capability(v_authorized, 'fanbus.publishing.manage')
     or app_private.has_capability(v_authorized, 'portal.admin')
     or app_private.has_capability(v_denied, 'fanbus.publishing.manage') then
    raise exception 'M340 Slice 3 BUS_PUBLISHING capability fixture invalid';
  end if;

  perform set_config('request.jwt.claim.sub', v_denied::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_denied, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'fanbus_publishing_job_enqueue',
    jsonb_build_object(
      'tripId', '00000000-0000-4340-a300-000000000001'
    )
  );
  if (v_response ->> 'ok')::boolean is distinct from false
     or v_response #>> '{error,code}' <> '42501' then
    raise exception 'M340 Slice 3 unauthorized enqueue succeeded: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_authorized::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_authorized, 'role', 'authenticated')::text,
    true
  );

  v_response := public.pd_api(
    'fanbus_publishing_job_enqueue',
    jsonb_build_object(
      'tripId', '00000000-0000-4340-a300-000000000001',
      'environment', 'PROD'
    )
  );
  if (v_response ->> 'ok')::boolean is distinct from false
     or v_response #>> '{error,code}' <> '22023' then
    raise exception 'M340 Slice 3 accepted a client environment: %', v_response;
  end if;

  v_response := public.pd_api(
    'fanbus_publishing_job_enqueue',
    jsonb_build_object(
      'tripId', '00000000-0000-4340-a300-000000000001'
    )
  );
  if (v_response ->> 'ok')::boolean is distinct from true then
    raise exception 'M340 Slice 3 authorized enqueue failed: %', v_response;
  end if;
  v_job_id := (v_response #>> '{data,job,id}')::uuid;

  select job.request_snapshot
    into v_snapshot
  from app_modules.fanbus_publishing_jobs as job
  where job.id = v_job_id;

  if v_job_id is null
     or (select environment from app_modules.fanbus_publishing_jobs where id = v_job_id)
       <> app_private.platform_release_environment()
     or v_snapshot -> 'schemaVersion' <> '1'::jsonb
     or v_snapshot ->> 'shortlinkPath' <> '/ontour/slice3-place'
     or v_snapshot #>> '{place,id}' <> '00000000-0000-4340-a100-000000000001'
     or v_snapshot #>> '{place,slug}' <> 'slice3-place'
     or v_snapshot #>> '{place,displayName}' <> 'Slice 3 Place'
     or v_snapshot #>> '{trip,tripId}' <> '00000000-0000-4340-a300-000000000001'
     or v_snapshot #>> '{trip,tripStatus}' <> 'PUBLISHED'
     or pg_catalog.jsonb_typeof(v_snapshot -> 'boardingStops') <> 'array'
     or pg_catalog.jsonb_array_length(v_snapshot -> 'boardingStops') <> 1
     or v_snapshot #>> '{boardingStops,0,label}' <> 'Slice 3 Zustieg' then
    raise exception 'M340 Slice 3 snapshot contract failed: %', v_snapshot;
  end if;

  if v_snapshot::text ~* '"(registrations|participants|firstName|lastName|userId|portalUserId|ip|userAgent|cookies|deviceId|fingerprint)"[[:space:]]*:' then
    raise exception 'M340 Slice 3 snapshot contains participant/request PII fields';
  end if;

  v_duplicate := public.pd_api(
    'fanbus_publishing_job_enqueue',
    jsonb_build_object(
      'tripId', '00000000-0000-4340-a300-000000000001'
    )
  );
  if (v_duplicate ->> 'ok')::boolean is distinct from true
     or (v_duplicate #>> '{data,job,id}')::uuid is distinct from v_job_id
     or (v_duplicate #>> '{data,idempotent}')::boolean is distinct from true then
    raise exception 'M340 Slice 3 duplicate enqueue was not idempotent: %', v_duplicate;
  end if;

  select count(*)
    into v_audit_count
  from app_portal.audit_events
  where action = 'FANBUS_PUBLISHING_JOB_ENQUEUED'
    and entity_type = 'fanbus_publishing_job'
    and entity_id = v_job_id::text;
  if v_audit_count <> 1 then
    raise exception 'M340 Slice 3 duplicate enqueue wrote % audits', v_audit_count;
  end if;

  update app_modules.events
  set title = 'Slice 3 Main nach Enqueue'
  where id = '00000000-0000-4340-a200-000000000001';
  if (select request_snapshot from app_modules.fanbus_publishing_jobs where id = v_job_id)
     is distinct from v_snapshot then
    raise exception 'M340 Slice 3 snapshot changed with event data';
  end if;

  begin
    update app_modules.fanbus_publishing_jobs
    set request_snapshot = jsonb_set(request_snapshot, '{schemaVersion}', '2')
    where id = v_job_id;
    raise exception 'M340 Slice 3 mutable request snapshot accepted';
  exception when sqlstate '55000' then null;
  end;

  insert into m340_slice3_state(name, value)
  values ('firstJobId', to_jsonb(v_job_id));
  raise notice 'M340_SLICE3_AUTH_ENQUEUE_OK';
end
$m340_slice3_auth_enqueue$;

do $m340_slice3_claim_success$
declare
  v_job_id uuid := (
    select (value #>> '{}')::uuid from m340_slice3_state where name = 'firstJobId'
  );
  v_claim jsonb;
  v_claim_token uuid;
  v_manifest jsonb := (
    select value from m340_slice3_state where name = 'manifest'
  );
  v_result jsonb;
begin
  v_claim := public.pd_m340_fanbus_publishing_job_claim();
  if (v_claim ->> 'claimed')::boolean is distinct from true
     or (v_claim #>> '{job,jobId}')::uuid is distinct from v_job_id
     or (v_claim #>> '{job,attemptCount}')::integer <> 1
     or v_claim #>> '{job,environment}' <> 'LOCAL'
     or v_claim #> '{job,request}' is null then
    raise exception 'M340 Slice 3 initial claim failed: %', v_claim;
  end if;
  v_claim_token := (v_claim #>> '{job,claimToken}')::uuid;

  if (
    select claim_expires_at - claimed_at
    from app_modules.fanbus_publishing_jobs
    where id = v_job_id
  ) <> interval '15 minutes' then
    raise exception 'M340 Slice 3 claim lease is not exactly 15 minutes';
  end if;

  if (public.pd_m340_fanbus_publishing_job_claim() ->> 'claimed')::boolean
     is distinct from false then
    raise exception 'M340 Slice 3 allowed a second processing claim';
  end if;

  begin
    perform public.pd_m340_fanbus_publishing_job_complete(
      v_job_id,
      extensions.gen_random_uuid(),
      true,
      null,
      v_manifest
    );
    raise exception 'M340 Slice 3 accepted a false claim token';
  exception when sqlstate '42501' then
    if sqlerrm <> 'M340_PUBLISHING_CLAIM_INVALID' then raise; end if;
  end;

  v_result := public.pd_m340_fanbus_publishing_job_complete(
    v_job_id,
    v_claim_token,
    true,
    null,
    v_manifest
  );
  if v_result ->> 'status' <> 'SUCCESS'
     or (v_result ->> 'idempotent')::boolean is distinct from false
     or (select result_manifest from app_modules.fanbus_publishing_jobs where id = v_job_id)
       is distinct from v_manifest then
    raise exception 'M340 Slice 3 SUCCESS completion failed: %', v_result;
  end if;

  v_result := public.pd_m340_fanbus_publishing_job_complete(
    v_job_id,
    v_claim_token,
    true,
    null,
    v_manifest
  );
  if (v_result ->> 'idempotent')::boolean is distinct from true then
    raise exception 'M340 Slice 3 SUCCESS replay is not idempotent: %', v_result;
  end if;

  begin
    perform public.pd_m340_fanbus_publishing_job_complete(
      v_job_id,
      v_claim_token,
      false,
      'REPLAY_CONFLICT',
      null
    );
    raise exception 'M340 Slice 3 accepted conflicting replay';
  exception when unique_violation then
    if sqlerrm <> 'M340_PUBLISHING_COMPLETE_REPLAY_CONFLICT' then raise; end if;
  end;

  raise notice 'M340_SLICE3_CLAIM_SUCCESS_OK';
end
$m340_slice3_claim_success$;

do $m340_slice3_manifest$
declare
  v_manifest jsonb := (select value from m340_slice3_state where name = 'manifest');
begin
  if not app_private.m340_fanbus_publishing_manifest_is_valid(v_manifest) then
    raise exception 'M340 Slice 3 valid manifest rejected';
  end if;
  if app_private.m340_fanbus_publishing_manifest_is_valid(
    jsonb_set(v_manifest, '{artifacts,3,kind}', '"QR"'::jsonb)
  ) then
    raise exception 'M340 Slice 3 duplicate artifact kind accepted';
  end if;
  if app_private.m340_fanbus_publishing_manifest_is_valid(
    jsonb_set(
      v_manifest,
      '{artifacts,0,nextcloudPath}',
      '"https://cloud.invalid/Fanbus/qr.png"'::jsonb
    )
  ) then
    raise exception 'M340 Slice 3 URL Nextcloud path accepted';
  end if;
  if app_private.m340_fanbus_publishing_manifest_is_valid(
    jsonb_set(v_manifest, '{artifacts,0,nextcloudPath}', '"/Fanbus/../qr.png"'::jsonb)
  ) then
    raise exception 'M340 Slice 3 traversal Nextcloud path accepted';
  end if;
  if app_private.m340_fanbus_publishing_manifest_is_valid(
    jsonb_set(v_manifest, '{artifacts,0,sha256}', '"ABC"'::jsonb)
  ) then
    raise exception 'M340 Slice 3 invalid SHA256 accepted';
  end if;
  if app_private.m340_fanbus_publishing_manifest_is_valid(
    v_manifest || jsonb_build_object('metadata', jsonb_build_object())
  ) then
    raise exception 'M340 Slice 3 additional manifest metadata accepted';
  end if;
  raise notice 'M340_SLICE3_MANIFEST_OK';
end
$m340_slice3_manifest$;

do $m340_slice3_retry$
declare
  v_user uuid := '00000000-0000-4340-a000-000000000001';
  v_response jsonb;
  v_job_id uuid;
  v_claim jsonb;
  v_claim_token uuid;
  v_result jsonb;
  v_attempt integer;
  v_expected interval;
  v_previous_claim_token uuid;
begin
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user, 'role', 'authenticated')::text,
    true
  );

  v_response := public.pd_api(
    'fanbus_publishing_job_enqueue',
    jsonb_build_object(
      'tripId', '00000000-0000-4340-a300-000000000001'
    )
  );
  v_job_id := (v_response #>> '{data,job,id}')::uuid;
  if (v_response ->> 'ok')::boolean is distinct from true
     or v_job_id is null
     or v_job_id = (
       select (value #>> '{}')::uuid
       from m340_slice3_state
       where name = 'firstJobId'
     ) then
    raise exception 'M340 Slice 3 did not allow a new job after SUCCESS: %', v_response;
  end if;

  for v_attempt in 1..5 loop
    update app_modules.fanbus_publishing_jobs
    set available_at = now()
    where id = v_job_id;

    v_claim := public.pd_m340_fanbus_publishing_job_claim();
    if (v_claim ->> 'claimed')::boolean is distinct from true
       or (v_claim #>> '{job,jobId}')::uuid is distinct from v_job_id
       or (v_claim #>> '{job,attemptCount}')::integer <> v_attempt then
      raise exception 'M340 Slice 3 retry claim % failed: %', v_attempt, v_claim;
    end if;
    v_claim_token := (v_claim #>> '{job,claimToken}')::uuid;
    if v_claim_token is null
       or v_claim_token is not distinct from v_previous_claim_token then
      raise exception 'M340 Slice 3 retry claim token was not regenerated';
    end if;
    v_previous_claim_token := v_claim_token;

    v_result := public.pd_m340_fanbus_publishing_job_complete(
      v_job_id,
      v_claim_token,
      false,
      'TEST_FAILURE_' || v_attempt,
      null
    );

    if v_attempt < 5 then
      v_expected := app_private.m340_fanbus_publishing_retry_delay(v_attempt);
      if v_result ->> 'status' <> 'QUEUED'
         or (
           select available_at - now()
           from app_modules.fanbus_publishing_jobs
           where id = v_job_id
         ) <> v_expected
         or (
           select result_manifest
           from app_modules.fanbus_publishing_jobs
           where id = v_job_id
         ) is not null then
        raise exception 'M340 Slice 3 retry/backoff % failed: %', v_attempt, v_result;
      end if;

      if v_attempt = 1 then
        v_result := public.pd_m340_fanbus_publishing_job_complete(
          v_job_id,
          v_claim_token,
          false,
          'TEST_FAILURE_1',
          null
        );
        if (v_result ->> 'idempotent')::boolean is distinct from true then
          raise exception 'M340 Slice 3 failure replay is not idempotent';
        end if;
        begin
          perform public.pd_m340_fanbus_publishing_job_complete(
            v_job_id,
            v_claim_token,
            false,
            'OTHER_FAILURE',
            null
          );
          raise exception 'M340 Slice 3 accepted conflicting failure replay';
        exception when unique_violation then
          if sqlerrm <> 'M340_PUBLISHING_COMPLETE_REPLAY_CONFLICT' then raise; end if;
        end;
      end if;
    elsif v_result ->> 'status' <> 'FAILED'
          or not exists (
            select 1
            from app_modules.fanbus_publishing_jobs
            where id = v_job_id
              and status = 'FAILED'
              and attempt_count = 5
              and completed_at is not null
              and result_manifest is null
              and last_error_code = 'TEST_FAILURE_5'
          ) then
      raise exception 'M340 Slice 3 fifth attempt did not fail terminally: %', v_result;
    end if;
  end loop;

  raise notice 'M340_SLICE3_RETRY_OK';
end
$m340_slice3_retry$;

do $m340_slice3_expiry$
declare
  v_user uuid := '00000000-0000-4340-a000-000000000001';
  v_response jsonb;
  v_job_id uuid;
  v_claim jsonb;
  v_claim_token uuid;
begin
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'fanbus_publishing_job_enqueue',
    jsonb_build_object(
      'tripId', '00000000-0000-4340-a300-000000000002'
    )
  );
  v_job_id := (v_response #>> '{data,job,id}')::uuid;
  v_claim := public.pd_m340_fanbus_publishing_job_claim();
  v_claim_token := (v_claim #>> '{job,claimToken}')::uuid;

  update app_modules.fanbus_publishing_jobs
  set claim_expires_at = now() - interval '1 second'
  where id = v_job_id;

  begin
    perform public.pd_m340_fanbus_publishing_job_complete(
      v_job_id,
      v_claim_token,
      true,
      null,
      (select value from m340_slice3_state where name = 'manifest')
    );
    raise exception 'M340 Slice 3 expired claim completed successfully';
  exception when sqlstate '42501' then
    if sqlerrm <> 'M340_PUBLISHING_CLAIM_INVALID' then raise; end if;
  end;

  if (public.pd_m340_fanbus_publishing_job_claim() ->> 'claimed')::boolean
     is distinct from false
     or not exists (
       select 1
       from app_modules.fanbus_publishing_jobs
       where id = v_job_id
         and status = 'QUEUED'
         and attempt_count = 1
         and last_error_code = 'CLAIM_EXPIRED'
         and available_at = now() + interval '1 minute'
         and claim_token is null
     ) then
    raise exception 'M340 Slice 3 expired claim was not requeued correctly';
  end if;

  update app_modules.fanbus_publishing_jobs
  set
    status = 'PROCESSING',
    attempt_count = 5,
    claim_token = extensions.gen_random_uuid(),
    claimed_at = now() - interval '16 minutes',
    claim_expires_at = now() - interval '1 minute',
    completed_at = null,
    result_manifest = null
  where id = v_job_id;

  perform public.pd_m340_fanbus_publishing_job_claim();
  if not exists (
    select 1
    from app_modules.fanbus_publishing_jobs
    where id = v_job_id
      and status = 'FAILED'
      and attempt_count = 5
      and completed_at is not null
      and last_error_code = 'CLAIM_EXPIRED'
      and claim_token is null
  ) then
    raise exception 'M340 Slice 3 fifth expired claim did not become FAILED';
  end if;

  raise notice 'M340_SLICE3_EXPIRY_OK';
end
$m340_slice3_expiry$;

do $m340_slice3_constraints$
declare
  v_snapshot jsonb := (
    select request_snapshot
    from app_modules.fanbus_publishing_jobs
    order by created_at, id
    limit 1
  );
begin
  begin
    insert into app_modules.fanbus_publishing_jobs(
      environment, trip_id, event_id, place_id, status, request_snapshot
    ) values (
      'LOCAL',
      '00000000-0000-4340-a300-000000000002',
      '00000000-0000-4340-a200-000000000002',
      '00000000-0000-4340-a100-000000000001',
      'UNKNOWN',
      v_snapshot
    );
    raise exception 'M340 Slice 3 invalid status accepted';
  exception when check_violation then null;
  end;

  begin
    insert into app_modules.fanbus_publishing_jobs(
      environment, trip_id, event_id, place_id, job_type, request_snapshot
    ) values (
      'LOCAL',
      '00000000-0000-4340-a300-000000000002',
      '00000000-0000-4340-a200-000000000002',
      '00000000-0000-4340-a100-000000000001',
      'QR_ONLY',
      v_snapshot
    );
    raise exception 'M340 Slice 3 invalid job type accepted';
  exception when check_violation then null;
  end;

  begin
    insert into app_modules.fanbus_publishing_jobs(
      environment, trip_id, event_id, place_id, attempt_count, request_snapshot
    ) values (
      'LOCAL',
      '00000000-0000-4340-a300-000000000002',
      '00000000-0000-4340-a200-000000000002',
      '00000000-0000-4340-a100-000000000001',
      6,
      v_snapshot
    );
    raise exception 'M340 Slice 3 attempt 6 accepted';
  exception when check_violation then null;
  end;

  begin
    insert into app_modules.fanbus_publishing_jobs(
      environment, trip_id, event_id, place_id, status, attempt_count,
      request_snapshot
    ) values (
      'LOCAL',
      '00000000-0000-4340-a300-000000000002',
      '00000000-0000-4340-a200-000000000002',
      '00000000-0000-4340-a100-000000000001',
      'PROCESSING',
      1,
      v_snapshot
    );
    raise exception 'M340 Slice 3 PROCESSING without claim accepted';
  exception when check_violation then null;
  end;

  begin
    insert into app_modules.fanbus_publishing_jobs(
      environment, trip_id, event_id, place_id, status, completed_at,
      request_snapshot
    ) values (
      'LOCAL',
      '00000000-0000-4340-a300-000000000002',
      '00000000-0000-4340-a200-000000000002',
      '00000000-0000-4340-a100-000000000001',
      'SUCCESS',
      now(),
      v_snapshot
    );
    raise exception 'M340 Slice 3 SUCCESS without manifest accepted';
  exception when check_violation then null;
  end;

  begin
    insert into app_modules.fanbus_publishing_jobs(
      environment, trip_id, event_id, place_id, status, attempt_count,
      completed_at, request_snapshot
    ) values (
      'LOCAL',
      '00000000-0000-4340-a300-000000000002',
      '00000000-0000-4340-a200-000000000002',
      '00000000-0000-4340-a100-000000000001',
      'FAILED',
      5,
      now(),
      v_snapshot
    );
    raise exception 'M340 Slice 3 FAILED without error code accepted';
  exception when check_violation then null;
  end;

  raise notice 'M340_SLICE3_CONSTRAINTS_OK';
end
$m340_slice3_constraints$;

do $m340_slice3_security$
begin
  if not (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'app_modules.fanbus_publishing_jobs'::pg_catalog.regclass
  ) then
    raise exception 'M340 Slice 3 queue RLS is disabled';
  end if;

  if has_table_privilege('anon', 'app_modules.fanbus_publishing_jobs', 'SELECT')
     or has_table_privilege('authenticated', 'app_modules.fanbus_publishing_jobs', 'SELECT')
     or has_table_privilege('service_role', 'app_modules.fanbus_publishing_jobs', 'SELECT')
     or has_table_privilege('anon', 'app_modules.fanbus_publishing_jobs', 'INSERT')
     or has_table_privilege('authenticated', 'app_modules.fanbus_publishing_jobs', 'UPDATE')
     or has_table_privilege('service_role', 'app_modules.fanbus_publishing_jobs', 'UPDATE') then
    raise exception 'M340 Slice 3 queue exposes direct table privileges';
  end if;

  if has_function_privilege(
       'anon',
       'public.pd_m340_fanbus_publishing_job_claim()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.pd_m340_fanbus_publishing_job_claim()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.pd_m340_fanbus_publishing_job_claim()',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.pd_m340_fanbus_publishing_job_complete(uuid,uuid,boolean,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.pd_m340_fanbus_publishing_job_complete(uuid,uuid,boolean,text,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.pd_m340_fanbus_publishing_job_complete(uuid,uuid,boolean,text,jsonb)',
       'EXECUTE'
     ) then
    raise exception 'M340 Slice 3 worker RPC privilege contract failed';
  end if;

  if pg_catalog.to_regclass('app_modules.fanbus_trips') is null
     or pg_catalog.to_regclass('app_modules.fanbus_registrations') is null
     or pg_catalog.to_regclass('app_modules.fanbus_buses') is null
     or pg_catalog.to_regprocedure('public.pd_public_fanbus_trips()') is null
     or pg_catalog.to_regprocedure(
       'public.pd_public_fanbus_trip_boarding_stops(uuid)'
     ) is null
     or not exists (
       select 1
       from pg_catalog.pg_constraint
       where conname = 'fanbus_trips_status_check'
         and pg_catalog.pg_get_constraintdef(oid) ~ 'CANCELLED'
     ) then
    raise exception 'M340 Slice 3 disturbed M310/M320/M330 contracts';
  end if;

  raise notice 'M340_SLICE3_SECURITY_COMPATIBILITY_OK';
end
$m340_slice3_security$;

rollback;
