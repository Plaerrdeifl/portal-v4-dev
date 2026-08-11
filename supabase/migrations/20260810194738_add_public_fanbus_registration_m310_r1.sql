-- Plaerrdeifl Digitalplattform V4
-- P300 / M310-R1 / F1.3: Zentrale Fanbus-Anmeldung

create table app_private.fanbus_public_rate_limits (
  source_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint fanbus_public_rate_limits_source_hash_check
    check (source_hash ~ '^[0-9a-f]{64}$'),
  constraint fanbus_public_rate_limits_request_count_check
    check (request_count >= 0)
);

alter table app_private.fanbus_public_rate_limits enable row level security;

revoke all on table app_private.fanbus_public_rate_limits
from public, anon, authenticated, service_role;

create function public.pd_public_fanbus_trip(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_today date := (v_now at time zone 'Europe/Berlin')::date;
  v_result jsonb;
begin
  if p_trip_id is null then
    return jsonb_build_object('available', false);
  end if;

  select jsonb_build_object(
    'available', true,
    'tripId', trip.id,
    'eventType', event.event_type,
    'displayTitle', case event.event_type
      when 'GAME' then case game.home_away
        when 'HOME' then
          'Mighty Dogs Schweinfurt – ' || game.opponent_name
        when 'AWAY' then
          game.opponent_name || ' – Mighty Dogs Schweinfurt'
        else null
      end
      else event.title
    end,
    'eventDate', event.event_date,
    'eventTime', event.event_time,
    'venue', event.venue,
    'departureAt', trip.departure_at,
    'departureInfo', trip.departure_info,
    'registrationOpensAt', trip.registration_opens_at,
    'registrationClosesAt', trip.registration_closes_at,
    'priceCents', trip.price_cents,
    'capacity', trip.capacity,
    'activeRegistrationCount', registration.active_count,
    'remainingCapacity', greatest(
      trip.capacity - registration.active_count,
      0
    ),
    'registrationStatus', case
      when v_now < trip.registration_opens_at then 'NOT_STARTED'
      when v_now >= trip.registration_closes_at
        or v_now >= trip.departure_at then 'CLOSED'
      when registration.active_count >= trip.capacity then 'FULL'
      else 'OPEN'
    end,
    'privacyReference', trip.privacy_reference,
    'termsReference', trip.terms_reference
  )
  into v_result
  from app_modules.fanbus_trips as trip
  join app_modules.events as event
    on event.id = trip.event_id
  left join app_modules.event_games as game
    on game.event_id = event.id
  cross join lateral (
    select count(*)::integer as active_count
    from app_modules.fanbus_registrations as fanbus_registration
    where fanbus_registration.trip_id = trip.id
      and fanbus_registration.status = 'ACTIVE'
  ) as registration
  where trip.id = p_trip_id
    and trip.status = 'PUBLISHED'
    and event.visibility = 'PUBLIC'
    and event.event_date >= v_today
    and trip.departure_at is not null
    and trip.departure_info is not null
    and length(btrim(trip.departure_info)) > 0
    and trip.registration_opens_at is not null
    and trip.registration_closes_at is not null
    and trip.registration_closes_at > trip.registration_opens_at
    and trip.registration_closes_at <= trip.departure_at
    and trip.price_cents is not null
    and trip.price_cents >= 0
    and trip.capacity is not null
    and trip.capacity > 0
    and trip.privacy_reference is not null
    and length(btrim(trip.privacy_reference)) > 0
    and trip.terms_reference is not null
    and length(btrim(trip.terms_reference)) > 0
    and (trip.departure_at at time zone 'Europe/Berlin')::date
      <= event.event_date
    and (
      event.event_time is null
      or (trip.departure_at at time zone 'Europe/Berlin')
        <= event.event_date + event.event_time
    );

  return coalesce(v_result, jsonb_build_object('available', false));
end;
$$;

revoke all on function public.pd_public_fanbus_trip(uuid)
from public, anon, authenticated;

grant execute on function public.pd_public_fanbus_trip(uuid)
to anon, authenticated;

create function app_private.api_fanbus_self_register(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_trip_id uuid;
  v_idempotency_key uuid;
  v_bus_preference text;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array[
       'tripId',
       'busPreference',
       'privacyConfirmed',
       'termsConfirmed',
       'idempotencyKey'
     ]
     or (select count(*) from jsonb_object_keys(p_payload)) <> 5
     or jsonb_typeof(p_payload -> 'tripId') <> 'string'
     or jsonb_typeof(p_payload -> 'busPreference') <> 'string'
     or jsonb_typeof(p_payload -> 'privacyConfirmed') <> 'boolean'
     or jsonb_typeof(p_payload -> 'termsConfirmed') <> 'boolean'
     or jsonb_typeof(p_payload -> 'idempotencyKey') <> 'string'
     or (p_payload ->> 'tripId')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (p_payload ->> 'idempotencyKey')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'FANBUS_SELF_REGISTRATION_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  v_trip_id := (p_payload ->> 'tripId')::uuid;
  v_idempotency_key := (p_payload ->> 'idempotencyKey')::uuid;
  v_bus_preference := p_payload ->> 'busPreference';

  return app_private.fanbus_submit_registration(
    v_trip_id,
    v_actor,
    null,
    null,
    null,
    v_bus_preference,
    (p_payload ->> 'privacyConfirmed')::boolean,
    (p_payload ->> 'termsConfirmed')::boolean,
    v_idempotency_key
  );
end;
$$;

revoke all on function app_private.api_fanbus_self_register(jsonb)
from public, anon, authenticated;

create function public.m310_submit_guest_fanbus_registration(
  p_payload jsonb,
  p_idempotency_key uuid,
  p_source_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip_id uuid;
  v_bus_preference text;
  v_source_hash text := btrim(coalesce(p_source_hash, ''));
  v_idempotency_lock_key bigint;
  v_source_lock_key bigint;
  v_has_idempotency boolean;
  v_deferred_outcome text;
  v_rate_limit app_private.fanbus_public_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
  v_result jsonb;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array[
       'tripId',
       'firstName',
       'lastName',
       'email',
       'busPreference',
       'privacyConfirmed',
       'termsConfirmed'
     ]
     or (select count(*) from jsonb_object_keys(p_payload)) <> 7
     or jsonb_typeof(p_payload -> 'tripId') <> 'string'
     or jsonb_typeof(p_payload -> 'firstName') <> 'string'
     or jsonb_typeof(p_payload -> 'lastName') <> 'string'
     or jsonb_typeof(p_payload -> 'email') <> 'string'
     or jsonb_typeof(p_payload -> 'busPreference') <> 'string'
     or jsonb_typeof(p_payload -> 'privacyConfirmed') <> 'boolean'
     or jsonb_typeof(p_payload -> 'termsConfirmed') <> 'boolean'
     or (p_payload ->> 'tripId')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'FANBUS_GUEST_REGISTRATION_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null then
    raise exception 'FANBUS_IDEMPOTENCY_KEY_REQUIRED'
      using errcode = '22023';
  end if;

  if v_source_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'FANBUS_SOURCE_HASH_INVALID'
      using errcode = '22023';
  end if;

  v_trip_id := (p_payload ->> 'tripId')::uuid;
  v_bus_preference := p_payload ->> 'busPreference';

  v_idempotency_lock_key := (
    'x' || substr(
      encode(
        extensions.digest(
          'app_private.fanbus_submit_registration:' || p_idempotency_key::text,
          'sha256'
        ),
        'hex'
      ),
      1,
      16
    )
  )::bit(64)::bigint;

  perform pg_catalog.pg_advisory_xact_lock(v_idempotency_lock_key);

  select exists (
    select 1
    from app_private.fanbus_registration_idempotency as idempotency
    where idempotency.idempotency_key = p_idempotency_key
  )
  into v_has_idempotency;

  if v_has_idempotency then
    begin
      v_result := app_private.fanbus_submit_registration(
        v_trip_id,
        null,
        p_payload ->> 'firstName',
        p_payload ->> 'lastName',
        p_payload ->> 'email',
        v_bus_preference,
        (p_payload ->> 'privacyConfirmed')::boolean,
        (p_payload ->> 'termsConfirmed')::boolean,
        p_idempotency_key
      );

      return v_result;
    exception
      when sqlstate '22023' then
        v_deferred_outcome := 'INVALID_REQUEST';
      when others then
        v_deferred_outcome := 'INTERNAL_ERROR';
    end;
  end if;

  v_source_lock_key := (
    'x' || substr(
      encode(
        extensions.digest(
          'app_private.fanbus_public_rate_limits:' || v_source_hash,
          'sha256'
        ),
        'hex'
      ),
      1,
      16
    )
  )::bit(64)::bigint;

  perform pg_catalog.pg_advisory_xact_lock(v_source_lock_key);

  select rate_limit.*
  into v_rate_limit
  from app_private.fanbus_public_rate_limits as rate_limit
  where rate_limit.source_hash = v_source_hash
  for update;

  if not found then
    insert into app_private.fanbus_public_rate_limits (
      source_hash,
      window_started_at,
      request_count,
      updated_at
    ) values (
      v_source_hash,
      v_now,
      1,
      v_now
    );
  elsif v_rate_limit.window_started_at <= v_now - interval '15 minutes' then
    update app_private.fanbus_public_rate_limits
    set
      window_started_at = v_now,
      request_count = 1,
      updated_at = v_now
    where source_hash = v_source_hash;
  elsif v_rate_limit.request_count >= 6 then
    raise exception 'M310_FANBUS_RATE_LIMITED'
      using errcode = 'P3101';
  else
    update app_private.fanbus_public_rate_limits
    set
      request_count = request_count + 1,
      updated_at = v_now
    where source_hash = v_source_hash;
  end if;

  if v_deferred_outcome is not null then
    return jsonb_build_object(
      'outcome', v_deferred_outcome,
      'registrationId', null
    );
  end if;

  begin
    v_result := app_private.fanbus_submit_registration(
      v_trip_id,
      null,
      p_payload ->> 'firstName',
      p_payload ->> 'lastName',
      p_payload ->> 'email',
      v_bus_preference,
      (p_payload ->> 'privacyConfirmed')::boolean,
      (p_payload ->> 'termsConfirmed')::boolean,
      p_idempotency_key
    );
  exception
    when sqlstate 'P0002' then
      v_result := jsonb_build_object(
        'outcome', 'UNAVAILABLE',
        'registrationId', null
      );
    when sqlstate '22023' then
      v_result := jsonb_build_object(
        'outcome', 'INVALID_REQUEST',
        'registrationId', null
      );
    when others then
      v_result := jsonb_build_object(
        'outcome', 'INTERNAL_ERROR',
        'registrationId', null
      );
  end;

  return v_result;
end;
$$;

revoke all on function public.m310_submit_guest_fanbus_registration(
  jsonb,
  uuid,
  text
)
from public, anon, authenticated, service_role;

grant execute on function public.m310_submit_guest_fanbus_registration(
  jsonb,
  uuid,
  text
)
to service_role;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_fanbus_registration_m310_r1;

create or replace function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.'
      using errcode = '42501';
  end if;

  case v_action
    when 'fanbus_self_register' then
      v_data := app_private.api_fanbus_self_register(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return public.pd_api_before_fanbus_registration_m310_r1(
        p_action,
        p_payload
      );
  end case;

  return jsonb_build_object(
    'ok', true,
    'data', v_data
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', sqlstate,
        'message', sqlerrm
      )
    );
end;
$$;

revoke all on function public.pd_api_before_fanbus_registration_m310_r1(
  text,
  jsonb
)
from public, anon, authenticated;

revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated;

grant execute on function public.pd_api(text, jsonb)
to authenticated;
