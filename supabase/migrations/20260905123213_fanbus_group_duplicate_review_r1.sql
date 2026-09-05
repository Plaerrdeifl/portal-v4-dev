-- Plärrdeifl Digitalplattform V4
-- R6-PROD-FANBUS-GROUP-001 / R6-PROD-FANBUS-DUPLICATE-001
-- DEV-only migration: current operational group counts + manual duplicate review.

begin;

create table app_private.fanbus_duplicate_reviews (
  trip_id uuid not null references app_modules.fanbus_trips(id) on delete cascade,
  registration_a_id uuid not null references app_modules.fanbus_registrations(id) on delete cascade,
  registration_b_id uuid not null references app_modules.fanbus_registrations(id) on delete cascade,
  decision text not null,
  decided_by uuid references app_portal.users(id) on delete set null,
  decided_at timestamptz not null default clock_timestamp(),
  constraint fanbus_duplicate_reviews_pkey primary key (registration_a_id, registration_b_id),
  constraint fanbus_duplicate_reviews_distinct_pair check (registration_a_id < registration_b_id),
  constraint fanbus_duplicate_reviews_decision check (decision = 'NOT_DUPLICATE')
);

create index fanbus_duplicate_reviews_trip_idx
  on app_private.fanbus_duplicate_reviews(trip_id);

alter table app_private.fanbus_duplicate_reviews enable row level security;
revoke all on table app_private.fanbus_duplicate_reviews from public, anon, authenticated, service_role;

alter function app_private.api_fanbus_registrations_list(jsonb)
  rename to api_fanbus_registrations_list_before_group_duplicate_r1;

create function app_private.api_fanbus_registrations_list(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_base jsonb := app_private.api_fanbus_registrations_list_before_group_duplicate_r1(p_payload);
  v_trip_id uuid := nullif(v_base ->> 'tripId', '')::uuid;
  v_registrations jsonb := '[]'::jsonb;
  v_duplicates jsonb := '[]'::jsonb;
begin
  with items as (
    select
      item.value,
      item.ordinality,
      coalesce(nullif(item.value ->> 'bookingId', ''), item.value ->> 'id') as booking_key
    from jsonb_array_elements(coalesce(v_base -> 'registrations', '[]'::jsonb))
      with ordinality as item(value, ordinality)
  ), counts as (
    select
      booking_key,
      count(*)::integer as historical_count,
      count(*) filter (
        where value ->> 'status' in ('ACTIVE', 'WAITLISTED')
      )::integer as current_count
    from items
    group by booking_key
  )
  select coalesce(jsonb_agg(
    item.value || jsonb_build_object(
      'bookingParticipantCount', counts.current_count,
      'bookingHistoricalParticipantCount', counts.historical_count
    )
    order by item.ordinality
  ), '[]'::jsonb)
  into v_registrations
  from items as item
  join counts using (booking_key);

  if exists (
    select 1
    from app_modules.fanbus_trips as trip
    where trip.id = v_trip_id and trip.status <> 'CANCELLED'
  ) then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'registrationAId', first_registration.id,
        'registrationBId', second_registration.id,
        'matchType', 'NAME'
      )
      order by lower(btrim(first_registration.last_name)),
        lower(btrim(first_registration.first_name)),
        first_registration.id,
        second_registration.id
    ), '[]'::jsonb)
    into v_duplicates
    from app_modules.fanbus_registrations as first_registration
    join app_modules.fanbus_registrations as second_registration
      on second_registration.trip_id = first_registration.trip_id
     and first_registration.id < second_registration.id
     and first_registration.booking_id is distinct from second_registration.booking_id
     and lower(btrim(first_registration.first_name)) = lower(btrim(second_registration.first_name))
     and lower(btrim(first_registration.last_name)) = lower(btrim(second_registration.last_name))
    where first_registration.trip_id = v_trip_id
      and first_registration.status in ('ACTIVE', 'WAITLISTED')
      and second_registration.status in ('ACTIVE', 'WAITLISTED')
      and not exists (
        select 1
        from app_private.fanbus_duplicate_reviews as review
        where review.trip_id = v_trip_id
          and review.registration_a_id = first_registration.id
          and review.registration_b_id = second_registration.id
          and review.decision = 'NOT_DUPLICATE'
      );
  end if;

  return jsonb_set(
    jsonb_set(v_base, '{registrations}', v_registrations, true),
    '{duplicateCandidates}',
    v_duplicates,
    true
  );
end;
$function$;

revoke all on function app_private.api_fanbus_registrations_list(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function app_private.api_fanbus_registrations_list(jsonb) to postgres;

create function app_private.api_fanbus_duplicate_review_resolve(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_registration_a_id uuid;
  v_registration_b_id uuid;
  v_first_id uuid;
  v_second_id uuid;
  v_first app_modules.fanbus_registrations%rowtype;
  v_second app_modules.fanbus_registrations%rowtype;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['registrationAId', 'registrationBId', 'decision']
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['registrationAId', 'registrationBId', 'decision'])
     )
     or upper(btrim(coalesce(p_payload ->> 'decision', ''))) <> 'NOT_DUPLICATE' then
    raise exception 'FANBUS_DUPLICATE_REVIEW_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  begin
    v_registration_a_id := (p_payload ->> 'registrationAId')::uuid;
    v_registration_b_id := (p_payload ->> 'registrationBId')::uuid;
  exception when others then
    raise exception 'FANBUS_DUPLICATE_REVIEW_INVALID_PAYLOAD' using errcode = '22023';
  end;

  if v_registration_a_id = v_registration_b_id then
    raise exception 'FANBUS_DUPLICATE_REVIEW_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  v_first_id := least(v_registration_a_id, v_registration_b_id);
  v_second_id := greatest(v_registration_a_id, v_registration_b_id);

  select registration.* into v_first
  from app_modules.fanbus_registrations as registration
  where registration.id = v_first_id
  for update;
  if not found then
    raise exception 'FANBUS_DUPLICATE_REVIEW_NOT_FOUND' using errcode = 'P0002';
  end if;

  select registration.* into v_second
  from app_modules.fanbus_registrations as registration
  where registration.id = v_second_id
  for update;
  if not found then
    raise exception 'FANBUS_DUPLICATE_REVIEW_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_first.trip_id <> v_second.trip_id
     or v_first.booking_id is not distinct from v_second.booking_id
     or v_first.status not in ('ACTIVE', 'WAITLISTED')
     or v_second.status not in ('ACTIVE', 'WAITLISTED')
     or lower(btrim(v_first.first_name)) <> lower(btrim(v_second.first_name))
     or lower(btrim(v_first.last_name)) <> lower(btrim(v_second.last_name)) then
    raise exception 'FANBUS_DUPLICATE_REVIEW_NOT_APPLICABLE' using errcode = '22023';
  end if;

  insert into app_private.fanbus_duplicate_reviews(
    trip_id,
    registration_a_id,
    registration_b_id,
    decision,
    decided_by,
    decided_at
  ) values (
    v_first.trip_id,
    v_first.id,
    v_second.id,
    'NOT_DUPLICATE',
    v_actor,
    clock_timestamp()
  )
  on conflict (registration_a_id, registration_b_id) do update
  set decision = excluded.decision,
      decided_by = excluded.decided_by,
      decided_at = excluded.decided_at,
      trip_id = excluded.trip_id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_DUPLICATE_REVIEW_RESOLVED',
    'fanbus_duplicate_review',
    v_first.id::text || ':' || v_second.id::text,
    null,
    jsonb_build_object('decision', 'NOT_DUPLICATE'),
    jsonb_build_object(
      'tripId', v_first.trip_id,
      'registrationAId', v_first.id,
      'registrationBId', v_second.id,
      'decision', 'NOT_DUPLICATE'
    )
  );

  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId', v_first.trip_id)
  );
end;
$function$;

revoke all on function app_private.api_fanbus_duplicate_review_resolve(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function app_private.api_fanbus_duplicate_review_resolve(jsonb) to postgres;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_fanbus_duplicate_review_r1;
create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_fanbus_duplicate_review_r1()
    || array['fanbus_duplicate_review_resolve']::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_fanbus_duplicate_review_r1;
create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case lower(btrim(coalesce(p_action, '')))
    when 'fanbus_duplicate_review_resolve' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_fanbus_duplicate_review_r1(p_action)
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_fanbus_duplicate_review_r1;
create function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
begin
  if v_action = 'fanbus_duplicate_review_resolve' then
    return app_private.api_fanbus_duplicate_review_resolve(coalesce(p_payload, '{}'::jsonb));
  end if;
  return app_private.pd_api_dispatch_current_before_fanbus_duplicate_review_r1(p_action, p_payload);
end;
$function$;

commit;
