-- Plaerrdeifl Digitalplattform V4
-- P300 / M320-R1: Teilnehmer, Buchungen, Warteliste und Buszuordnung

create table app_modules.fanbus_bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references app_modules.fanbus_trips(id) on delete restrict,
  source text not null check (source in ('PORTAL', 'GUEST', 'MANUAL')),
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_bookings_id_trip_key unique (id, trip_id)
);

alter table app_modules.fanbus_registrations
  add column booking_id uuid,
  add column booking_role text,
  add column participant_sequence integer,
  add column waitlisted_at timestamptz,
  add column promoted_at timestamptz;

-- Each M310 registration becomes one deterministic one-person booking. The
-- registration row and its UUID remain unchanged.
insert into app_modules.fanbus_bookings (id, trip_id, source, created_at, created_by)
select id, trip_id, source, registered_at, created_by
from app_modules.fanbus_registrations;

alter table app_modules.fanbus_registrations
  disable trigger fanbus_registrations_set_updated_at;
update app_modules.fanbus_registrations
set booking_id = id, booking_role = 'PRIMARY', participant_sequence = 1;
alter table app_modules.fanbus_registrations
  enable trigger fanbus_registrations_set_updated_at;

alter table app_modules.fanbus_registrations
  alter column booking_id set not null,
  alter column booking_role set not null,
  alter column participant_sequence set not null,
  add constraint fanbus_registrations_booking_role_check
    check (booking_role in ('PRIMARY', 'COMPANION')),
  add constraint fanbus_registrations_participant_sequence_check
    check (participant_sequence > 0),
  add constraint fanbus_registrations_waitlist_history_check
    check (
      (status <> 'WAITLISTED' or waitlisted_at is not null)
      and (promoted_at is null or waitlisted_at is not null)
    ),
  add constraint fanbus_registrations_id_trip_key unique (id, trip_id),
  add constraint fanbus_registrations_booking_trip_fk
    foreign key (booking_id, trip_id)
    references app_modules.fanbus_bookings(id, trip_id) on delete restrict;

alter table app_modules.fanbus_registrations
  drop constraint fanbus_registrations_status_check,
  add constraint fanbus_registrations_status_check
    check (status in ('ACTIVE', 'WAITLISTED', 'CANCELLED'));

create unique index fanbus_registrations_booking_sequence_uidx
  on app_modules.fanbus_registrations(booking_id, participant_sequence);
create unique index fanbus_registrations_booking_primary_uidx
  on app_modules.fanbus_registrations(booking_id)
  where booking_role = 'PRIMARY';
create index fanbus_registrations_waitlist_fifo_idx
  on app_modules.fanbus_registrations(
    trip_id, waitlisted_at, participant_sequence, id
  )
  where status = 'WAITLISTED';

drop index app_modules.fanbus_registrations_active_email_uidx;
drop index app_modules.fanbus_registrations_active_portal_user_uidx;
drop index app_modules.fanbus_registrations_active_member_uidx;
drop index app_modules.fanbus_registrations_active_manual_name_uidx;

create unique index fanbus_registrations_live_email_uidx
  on app_modules.fanbus_registrations(trip_id, lower(btrim(email)))
  where status in ('ACTIVE', 'WAITLISTED') and email is not null;
create unique index fanbus_registrations_live_portal_user_uidx
  on app_modules.fanbus_registrations(trip_id, portal_user_id)
  where status in ('ACTIVE', 'WAITLISTED') and portal_user_id is not null;
create unique index fanbus_registrations_live_member_uidx
  on app_modules.fanbus_registrations(trip_id, member_id)
  where status in ('ACTIVE', 'WAITLISTED') and member_id is not null;
create unique index fanbus_registrations_live_manual_name_uidx
  on app_modules.fanbus_registrations(
    trip_id, lower(btrim(first_name)), lower(btrim(last_name))
  )
  where status in ('ACTIVE', 'WAITLISTED')
    and source = 'MANUAL'
    and member_id is null and portal_user_id is null and email is null;

alter table app_modules.fanbus_registrations
  drop constraint fanbus_registrations_email_check,
  add constraint fanbus_registrations_email_check check (
    (
      email is null
      or (
        length(btrim(email)) between 3 and 320
        and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    )
    and (
      booking_role = 'COMPANION'
      or source = 'MANUAL'
      or (source in ('PORTAL', 'GUEST') and email is not null)
    )
  );

alter table app_private.fanbus_registration_idempotency
  add column booking_id uuid
    references app_modules.fanbus_bookings(id) on delete set null,
  add column response_payload jsonb;

update app_private.fanbus_registration_idempotency as idempotency
set booking_id = registration.booking_id
from app_modules.fanbus_registrations as registration
where registration.id = idempotency.registration_id
  and idempotency.booking_id is null;

alter table app_private.fanbus_registration_idempotency
  drop constraint fanbus_registration_idempotency_outcome_check,
  add constraint fanbus_registration_idempotency_outcome_check check (
    outcome in (
      'CREATED', 'WAITLISTED', 'ALREADY_ACTIVE', 'FULL',
      'NOT_STARTED', 'CLOSED', 'UNAVAILABLE'
    )
  );

create table app_modules.fanbus_buses (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references app_modules.fanbus_trips(id) on delete restrict,
  label text not null check (length(btrim(label)) between 1 and 160),
  category text not null default 'NORMAL'
    check (category in ('NORMAL', 'RUHIG', 'PARTY')),
  capacity integer not null check (capacity > 0),
  is_active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_buses_id_trip_key unique (id, trip_id)
);
create unique index fanbus_buses_trip_label_uidx
  on app_modules.fanbus_buses(trip_id, lower(btrim(label)));
create trigger fanbus_buses_set_updated_at
before update on app_modules.fanbus_buses
for each row execute function app_private.set_updated_at();

create table app_modules.fanbus_bus_assignments (
  participant_id uuid primary key,
  trip_id uuid not null,
  bus_id uuid not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_bus_assignments_participant_trip_fk
    foreign key (participant_id, trip_id)
    references app_modules.fanbus_registrations(id, trip_id) on delete restrict,
  constraint fanbus_bus_assignments_bus_trip_fk
    foreign key (bus_id, trip_id)
    references app_modules.fanbus_buses(id, trip_id) on delete restrict
);
create index fanbus_bus_assignments_bus_idx
  on app_modules.fanbus_bus_assignments(bus_id);
create trigger fanbus_bus_assignments_set_updated_at
before update on app_modules.fanbus_bus_assignments
for each row execute function app_private.set_updated_at();

alter table app_modules.fanbus_bookings enable row level security;
alter table app_modules.fanbus_buses enable row level security;
alter table app_modules.fanbus_bus_assignments enable row level security;
revoke all on table
  app_modules.fanbus_bookings,
  app_modules.fanbus_buses,
  app_modules.fanbus_bus_assignments
from public, anon, authenticated;

-- Reproduces the exact M310 canonical request hash for legacy idempotency rows.
create function app_private.fanbus_legacy_request_hash(
  p_trip_id uuid, p_source text, p_actor uuid, p_member_id uuid,
  p_portal_user_id uuid, p_first_name text, p_last_name text, p_email text,
  p_bus_preference text, p_privacy_confirmed boolean, p_terms_confirmed boolean
)
returns text
language plpgsql immutable security definer set search_path = ''
as $$
declare
  v_source text := upper(btrim(coalesce(p_source, '')));
  v_first_name text := app_private.clean_name(p_first_name);
  v_last_name text := app_private.clean_name(p_last_name);
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_preference text := upper(btrim(coalesce(p_bus_preference, '')));
  v_canonical jsonb;
begin
  if v_source = 'MANUAL' then
    v_canonical := jsonb_build_object(
      'tripId', p_trip_id, 'source', v_source, 'actor', p_actor,
      'memberId', p_member_id, 'portalUserId', p_portal_user_id,
      'firstName', case when p_member_id is null and p_portal_user_id is null then v_first_name end,
      'lastName', case when p_member_id is null and p_portal_user_id is null then v_last_name end,
      'email', case when p_member_id is null and p_portal_user_id is null then v_email end,
      'busPreference', v_preference,
      'privacyConfirmed', p_privacy_confirmed,
      'termsConfirmed', p_terms_confirmed
    );
  else
    v_canonical := jsonb_build_object(
      'tripId', p_trip_id, 'portalUserId', p_portal_user_id,
      'guestFirstName', case when p_portal_user_id is null then v_first_name end,
      'guestLastName', case when p_portal_user_id is null then v_last_name end,
      'guestEmail', case when p_portal_user_id is null then v_email end,
      'busPreference', v_preference,
      'privacyConfirmed', p_privacy_confirmed,
      'termsConfirmed', p_terms_confirmed
    );
  end if;
  return encode(extensions.digest(v_canonical::text, 'sha256'), 'hex');
end;
$$;

create or replace function public.pd_public_fanbus_trip(p_trip_id uuid)
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
        when 'HOME' then 'Mighty Dogs Schweinfurt – ' || game.opponent_name
        when 'AWAY' then game.opponent_name || ' – Mighty Dogs Schweinfurt'
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
    'waitlistedRegistrationCount', registration.waitlisted_count,
    'remainingCapacity', greatest(trip.capacity - registration.active_count, 0),
    'registrationStatus', case
      when v_now < trip.registration_opens_at then 'NOT_STARTED'
      when v_now >= trip.registration_closes_at
        or v_now >= trip.departure_at then 'CLOSED'
      when registration.waitlisted_count > 0
        or registration.active_count >= trip.capacity then 'WAITLIST'
      else 'OPEN'
    end,
    'privacyReference', trip.privacy_reference,
    'termsReference', trip.terms_reference
  ) into v_result
  from app_modules.fanbus_trips as trip
  join app_modules.events as event on event.id = trip.event_id
  left join app_modules.event_games as game on game.event_id = event.id
  cross join lateral (
    select
      count(*) filter (where status = 'ACTIVE')::integer as active_count,
      count(*) filter (where status = 'WAITLISTED')::integer as waitlisted_count
    from app_modules.fanbus_registrations
    where trip_id = trip.id
  ) as registration
  where trip.id = p_trip_id
    and trip.status = 'PUBLISHED'
    and event.visibility = 'PUBLIC'
    and event.event_date >= v_today
    and trip.departure_at is not null
    and nullif(btrim(trip.departure_info), '') is not null
    and trip.registration_opens_at is not null
    and trip.registration_closes_at is not null
    and trip.registration_closes_at > trip.registration_opens_at
    and trip.registration_closes_at <= trip.departure_at
    and trip.price_cents is not null and trip.price_cents >= 0
    and trip.capacity is not null and trip.capacity > 0
    and nullif(btrim(trip.privacy_reference), '') is not null
    and nullif(btrim(trip.terms_reference), '') is not null
    and (trip.departure_at at time zone 'Europe/Berlin')::date <= event.event_date
    and (
      event.event_time is null
      or (trip.departure_at at time zone 'Europe/Berlin')
        <= event.event_date + event.event_time
    );
  return coalesce(v_result, jsonb_build_object('available', false));
end;
$$;

create or replace function public.pd_public_fanbus_trips()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_today date := (v_now at time zone 'Europe/Berlin')::date;
begin
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tripId', trip.id,
          'eventType', event.event_type,
          'displayTitle', case event.event_type
            when 'GAME' then case game.home_away
              when 'HOME' then 'Mighty Dogs Schweinfurt – ' || game.opponent_name
              when 'AWAY' then game.opponent_name || ' – Mighty Dogs Schweinfurt'
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
          'waitlistedRegistrationCount', registration.waitlisted_count,
          'remainingCapacity', greatest(
            trip.capacity - registration.active_count, 0
          ),
          'registrationStatus', case
            when v_now < trip.registration_opens_at then 'NOT_STARTED'
            when v_now >= trip.registration_closes_at
              or v_now >= trip.departure_at then 'CLOSED'
            when registration.waitlisted_count > 0
              or registration.active_count >= trip.capacity then 'WAITLIST'
            else 'OPEN'
          end
        )
        order by event.event_date, event.event_time asc nulls last,
          trip.departure_at
      )
      from app_modules.fanbus_trips as trip
      join app_modules.events as event on event.id = trip.event_id
      left join app_modules.event_games as game on game.event_id = event.id
      cross join lateral (
        select
          count(*) filter (where status = 'ACTIVE')::integer as active_count,
          count(*) filter (where status = 'WAITLISTED')::integer
            as waitlisted_count
        from app_modules.fanbus_registrations
        where trip_id = trip.id
      ) as registration
      where trip.status = 'PUBLISHED'
        and event.visibility = 'PUBLIC'
        and event.event_date >= v_today
        and trip.departure_at is not null
        and nullif(btrim(trip.departure_info), '') is not null
        and trip.registration_opens_at is not null
        and trip.registration_closes_at is not null
        and trip.registration_closes_at > trip.registration_opens_at
        and trip.registration_closes_at <= trip.departure_at
        and trip.price_cents is not null and trip.price_cents >= 0
        and trip.capacity is not null and trip.capacity > 0
        and nullif(btrim(trip.privacy_reference), '') is not null
        and nullif(btrim(trip.terms_reference), '') is not null
        and (trip.departure_at at time zone 'Europe/Berlin')::date
          <= event.event_date
        and (
          event.event_time is null
          or (trip.departure_at at time zone 'Europe/Berlin')
            <= event.event_date + event.event_time
        )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.m310_submit_guest_fanbus_registration(
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
  v_companions jsonb := coalesce(p_payload -> 'companions', '[]'::jsonb);
  v_source_hash text := btrim(coalesce(p_source_hash, ''));
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
       'tripId', 'firstName', 'lastName', 'email', 'busPreference',
       'privacyConfirmed', 'termsConfirmed'
     ]
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array[
         'tripId', 'firstName', 'lastName', 'email', 'busPreference',
         'privacyConfirmed', 'termsConfirmed', 'companions'
       ])
     )
     or jsonb_typeof(p_payload -> 'tripId') <> 'string'
     or jsonb_typeof(p_payload -> 'firstName') <> 'string'
     or jsonb_typeof(p_payload -> 'lastName') <> 'string'
     or jsonb_typeof(p_payload -> 'email') <> 'string'
     or jsonb_typeof(p_payload -> 'busPreference') <> 'string'
     or jsonb_typeof(p_payload -> 'privacyConfirmed') <> 'boolean'
     or jsonb_typeof(p_payload -> 'termsConfirmed') <> 'boolean'
     or jsonb_typeof(v_companions) <> 'array'
     or (p_payload ->> 'tripId')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'FANBUS_GUEST_REGISTRATION_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;
  if p_idempotency_key is null then
    raise exception 'FANBUS_IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;
  if v_source_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'FANBUS_SOURCE_HASH_INVALID' using errcode = '22023';
  end if;
  v_trip_id := (p_payload ->> 'tripId')::uuid;

  select exists (
    select 1 from app_private.fanbus_registration_idempotency
    where idempotency_key = p_idempotency_key
  ) into v_has_idempotency;
  if v_has_idempotency then
    begin
      if jsonb_array_length(v_companions) = 0 then
        v_result := app_private.fanbus_submit_registration(
          v_trip_id, null,
          p_payload ->> 'firstName', p_payload ->> 'lastName',
          p_payload ->> 'email', p_payload ->> 'busPreference',
          (p_payload ->> 'privacyConfirmed')::boolean,
          (p_payload ->> 'termsConfirmed')::boolean,
          p_idempotency_key
        );
      else
        v_result := app_private.fanbus_submit_booking_core(
          v_trip_id, 'GUEST', null,
          jsonb_build_object(
            'firstName', p_payload ->> 'firstName',
            'lastName', p_payload ->> 'lastName',
            'email', p_payload ->> 'email',
            'busPreference', p_payload ->> 'busPreference'
          ),
          v_companions,
          (p_payload ->> 'privacyConfirmed')::boolean,
          (p_payload ->> 'termsConfirmed')::boolean,
          p_idempotency_key
        );
      end if;
      return v_result;
    exception
      when sqlstate '22023' then v_deferred_outcome := 'INVALID_REQUEST';
      when others then v_deferred_outcome := 'INTERNAL_ERROR';
    end;
  end if;

  v_source_lock_key := (
    'x' || substr(encode(extensions.digest(
      'app_private.fanbus_public_rate_limits:' || v_source_hash, 'sha256'
    ), 'hex'), 1, 16)
  )::bit(64)::bigint;
  perform pg_catalog.pg_advisory_xact_lock(v_source_lock_key);
  select * into v_rate_limit
  from app_private.fanbus_public_rate_limits
  where source_hash = v_source_hash
  for update;
  if not found then
    insert into app_private.fanbus_public_rate_limits (
      source_hash, window_started_at, request_count, updated_at
    ) values (v_source_hash, v_now, 1, v_now);
  elsif v_rate_limit.window_started_at <= v_now - interval '15 minutes' then
    update app_private.fanbus_public_rate_limits
    set window_started_at = v_now, request_count = 1, updated_at = v_now
    where source_hash = v_source_hash;
  elsif v_rate_limit.request_count >= 6 then
    raise exception 'M310_FANBUS_RATE_LIMITED' using errcode = 'P3101';
  else
    update app_private.fanbus_public_rate_limits
    set request_count = request_count + 1, updated_at = v_now
    where source_hash = v_source_hash;
  end if;
  if v_deferred_outcome is not null then
    return jsonb_build_object(
      'outcome', v_deferred_outcome, 'registrationId', null
    );
  end if;

  begin
    if jsonb_array_length(v_companions) = 0 then
      v_result := app_private.fanbus_submit_registration(
        v_trip_id, null,
        p_payload ->> 'firstName', p_payload ->> 'lastName',
        p_payload ->> 'email', p_payload ->> 'busPreference',
        (p_payload ->> 'privacyConfirmed')::boolean,
        (p_payload ->> 'termsConfirmed')::boolean,
        p_idempotency_key
      );
    else
      v_result := app_private.fanbus_submit_booking_core(
        v_trip_id, 'GUEST', null,
        jsonb_build_object(
          'firstName', p_payload ->> 'firstName',
          'lastName', p_payload ->> 'lastName',
          'email', p_payload ->> 'email',
          'busPreference', p_payload ->> 'busPreference'
        ),
        v_companions,
        (p_payload ->> 'privacyConfirmed')::boolean,
        (p_payload ->> 'termsConfirmed')::boolean,
        p_idempotency_key
      );
    end if;
  exception
    when sqlstate 'P0002' then
      v_result := jsonb_build_object('outcome', 'UNAVAILABLE', 'registrationId', null);
    when sqlstate 'P3201' then
      v_result := jsonb_build_object('outcome', 'DUPLICATE', 'registrationId', null);
    when sqlstate '22023' then
      v_result := jsonb_build_object('outcome', 'INVALID_REQUEST', 'registrationId', null);
    when others then
      v_result := jsonb_build_object('outcome', 'INTERNAL_ERROR', 'registrationId', null);
  end;
  return v_result;
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_fanbus_participants_m320_r1;

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
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;
  case v_action
    when 'fanbus_self_register' then
      v_data := app_private.api_fanbus_self_register(coalesce(p_payload, '{}'::jsonb));
    when 'fanbus_registration_update' then
      v_data := app_private.api_fanbus_registration_update(coalesce(p_payload, '{}'::jsonb));
    when 'fanbus_waitlist_promote' then
      v_data := app_private.api_fanbus_waitlist_promote(coalesce(p_payload, '{}'::jsonb));
    when 'fanbus_bus_upsert' then
      v_data := app_private.api_fanbus_bus_upsert(coalesce(p_payload, '{}'::jsonb));
    when 'fanbus_buses_list' then
      v_data := app_private.api_fanbus_buses_list(coalesce(p_payload, '{}'::jsonb));
    when 'fanbus_bus_assignment_set' then
      v_data := app_private.api_fanbus_bus_assignment_set(coalesce(p_payload, '{}'::jsonb));
    else
      return public.pd_api_before_fanbus_participants_m320_r1(p_action, p_payload);
  end case;
  return jsonb_build_object('ok', true, 'data', v_data);
exception when others then
  return jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object('code', sqlstate, 'message', sqlerrm)
  );
end;
$$;

-- Keep the M310 single-registration contract and its canonical hash intact.
create or replace function app_private.fanbus_submit_registration_core(
  p_trip_id uuid,
  p_source text,
  p_actor uuid,
  p_member_id uuid,
  p_portal_user_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_bus_preference text,
  p_privacy_confirmed boolean,
  p_terms_confirmed boolean,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return app_private.fanbus_submit_booking_core(
    p_trip_id,
    p_source,
    p_actor,
    jsonb_strip_nulls(jsonb_build_object(
      'memberId', p_member_id,
      'portalUserId', p_portal_user_id,
      'firstName', p_first_name,
      'lastName', p_last_name,
      'email', p_email,
      'busPreference', p_bus_preference
    )),
    '[]'::jsonb,
    p_privacy_confirmed,
    p_terms_confirmed,
    p_idempotency_key,
    app_private.fanbus_legacy_request_hash(
      p_trip_id, p_source, p_actor, p_member_id, p_portal_user_id,
      p_first_name, p_last_name, p_email, p_bus_preference,
      p_privacy_confirmed, p_terms_confirmed
    )
  );
end;
$$;

create or replace function app_private.api_fanbus_self_register(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_trip_id uuid;
  v_idempotency_key uuid;
  v_companions jsonb := coalesce(p_payload -> 'companions', '[]'::jsonb);
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array[
       'tripId', 'busPreference', 'privacyConfirmed',
       'termsConfirmed', 'idempotencyKey'
     ]
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array[
         'tripId', 'busPreference', 'privacyConfirmed',
         'termsConfirmed', 'idempotencyKey', 'companions'
       ])
     )
     or jsonb_typeof(p_payload -> 'tripId') <> 'string'
     or jsonb_typeof(p_payload -> 'busPreference') <> 'string'
     or jsonb_typeof(p_payload -> 'privacyConfirmed') <> 'boolean'
     or jsonb_typeof(p_payload -> 'termsConfirmed') <> 'boolean'
     or jsonb_typeof(p_payload -> 'idempotencyKey') <> 'string'
     or jsonb_typeof(v_companions) <> 'array'
     or (p_payload ->> 'tripId')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (p_payload ->> 'idempotencyKey')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'FANBUS_SELF_REGISTRATION_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  v_trip_id := (p_payload ->> 'tripId')::uuid;
  v_idempotency_key := (p_payload ->> 'idempotencyKey')::uuid;
  if jsonb_array_length(v_companions) = 0 then
    return app_private.fanbus_submit_registration(
      v_trip_id, v_actor, null, null, null,
      p_payload ->> 'busPreference',
      (p_payload ->> 'privacyConfirmed')::boolean,
      (p_payload ->> 'termsConfirmed')::boolean,
      v_idempotency_key
    );
  end if;
  return app_private.fanbus_submit_booking_core(
    v_trip_id, 'PORTAL', v_actor,
    jsonb_build_object('busPreference', p_payload ->> 'busPreference'),
    v_companions,
    (p_payload ->> 'privacyConfirmed')::boolean,
    (p_payload ->> 'termsConfirmed')::boolean,
    v_idempotency_key
  );
end;
$$;

create or replace function app_private.api_fanbus_trips_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_can_manage boolean := app_private.has_capability(v_actor, 'fanbus.manage');
  v_can_manage_registrations boolean :=
    app_private.has_capability(v_actor, 'fanbus.registrations.manage');
  v_now timestamptz := clock_timestamp();
  v_today date := (v_now at time zone 'Europe/Berlin')::date;
begin
  return jsonb_build_object(
    'trips',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', trip.id,
          'eventId', event.id,
          'eventType', event.event_type,
          'displayTitle', case event.event_type
            when 'GAME' then case game.home_away
              when 'HOME' then 'Mighty Dogs Schweinfurt – ' || game.opponent_name
              when 'AWAY' then game.opponent_name || ' – Mighty Dogs Schweinfurt'
              else null
            end
            else event.title
          end,
          'eventDate', event.event_date,
          'eventTime', event.event_time,
          'venue', event.venue,
          'visibility', event.visibility,
          'departureAt', trip.departure_at,
          'departureInfo', trip.departure_info,
          'registrationOpensAt', trip.registration_opens_at,
          'registrationClosesAt', trip.registration_closes_at,
          'priceCents', trip.price_cents,
          'capacity', trip.capacity,
          'privacyReference', trip.privacy_reference,
          'termsReference', trip.terms_reference,
          'status', trip.status,
          'revision', trip.revision,
          'activeRegistrationCount', registration.active_count,
          'waitlistedRegistrationCount', registration.waitlisted_count,
          'remainingCapacity', greatest(
            coalesce(trip.capacity, 0) - registration.active_count, 0
          ),
          'registrationStatus', case
            when trip.status = 'CLOSED' then 'CLOSED'
            when trip.status <> 'PUBLISHED'
              or trip.departure_at is null
              or nullif(btrim(trip.departure_info), '') is null
              or trip.registration_opens_at is null
              or trip.registration_closes_at is null
              or trip.price_cents is null
              or trip.capacity is null
              or nullif(btrim(trip.privacy_reference), '') is null
              or nullif(btrim(trip.terms_reference), '') is null
              or event.visibility <> 'PUBLIC'
              then 'UNAVAILABLE'
            when v_now < trip.registration_opens_at then 'NOT_STARTED'
            when v_now >= trip.registration_closes_at
              or v_now >= trip.departure_at then 'CLOSED'
            when registration.waitlisted_count > 0
              or registration.active_count >= trip.capacity then 'WAITLIST'
            else 'OPEN'
          end,
          'canManage', v_can_manage,
          'canManageRegistrations', v_can_manage_registrations
        )
        order by event.event_date, event.event_time asc nulls first, trip.id
      )
      from app_modules.fanbus_trips as trip
      join app_modules.events as event on event.id = trip.event_id
      left join app_modules.event_games as game on game.event_id = event.id
      cross join lateral (
        select
          count(*) filter (where status = 'ACTIVE')::integer as active_count,
          count(*) filter (where status = 'WAITLISTED')::integer
            as waitlisted_count
        from app_modules.fanbus_registrations
        where trip_id = trip.id
      ) as registration
      where (
        (v_can_manage or v_can_manage_registrations)
        and (event.event_date >= v_today or trip.status in ('DRAFT', 'PUBLISHED'))
      ) or (
        not v_can_manage and not v_can_manage_registrations
        and event.event_date >= v_today
        and trip.status in ('PUBLISHED', 'CLOSED')
      )
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function app_private.api_fanbus_registrations_list(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_trip_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['tripId']
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'tripId'
     ) then
    raise exception 'FANBUS_REGISTRATION_LIST_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;
  begin
    v_trip_id := nullif(btrim(p_payload ->> 'tripId'), '')::uuid;
  exception when others then
    raise exception 'FANBUS_TRIP_ID_INVALID' using errcode = '22023';
  end;
  if not exists (select 1 from app_modules.fanbus_trips where id = v_trip_id) then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'tripId', v_trip_id,
    'registrations', coalesce((
      with prepared as (
        select
          registration.*,
          assignment.bus_id,
          bus.label as bus_label,
          bus.category as bus_category,
          count(*) over (partition by registration.booking_id) as booking_count,
          case when registration.status = 'WAITLISTED' then
            row_number() over (
              partition by registration.status
              order by registration.waitlisted_at asc,
                registration.participant_sequence asc,
                registration.id asc
            )
          end as waitlist_position
        from app_modules.fanbus_registrations as registration
        left join app_modules.fanbus_bus_assignments as assignment
          on assignment.participant_id = registration.id
        left join app_modules.fanbus_buses as bus on bus.id = assignment.bus_id
        where registration.trip_id = v_trip_id
      )
      select jsonb_agg(
        jsonb_build_object(
          'id', prepared.id,
          'tripId', prepared.trip_id,
          'bookingId', prepared.booking_id,
          'bookingRole', prepared.booking_role,
          'participantSequence', prepared.participant_sequence,
          'bookingParticipantCount', prepared.booking_count,
          'memberId', prepared.member_id,
          'portalUserId', prepared.portal_user_id,
          'firstName', prepared.first_name,
          'lastName', prepared.last_name,
          'email', prepared.email,
          'busPreference', prepared.bus_preference,
          'status', prepared.status,
          'waitlistedAt', prepared.waitlisted_at,
          'waitlistPosition', prepared.waitlist_position,
          'promotedAt', prepared.promoted_at,
          'registeredAt', prepared.registered_at,
          'cancelledAt', prepared.cancelled_at,
          'revision', prepared.revision,
          'source', prepared.source,
          'busId', prepared.bus_id,
          'busLabel', prepared.bus_label,
          'busCategory', prepared.bus_category
        )
        order by
          case prepared.status when 'ACTIVE' then 0 when 'WAITLISTED' then 1 else 2 end,
          coalesce(prepared.waitlisted_at, prepared.registered_at),
          prepared.participant_sequence,
          prepared.id
      ) from prepared
    ), '[]'::jsonb),
    'buses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', bus.id, 'tripId', bus.trip_id, 'label', bus.label,
          'category', bus.category, 'capacity', bus.capacity,
          'isActive', bus.is_active, 'revision', bus.revision,
          'occupied', coalesce(occupancy.value, 0),
          'occupancy', coalesce(occupancy.value, 0),
          'remainingCapacity', greatest(
            bus.capacity - coalesce(occupancy.value, 0), 0
          )
        ) order by bus.is_active desc, lower(btrim(bus.label)), bus.id
      )
      from app_modules.fanbus_buses as bus
      left join lateral (
        select count(*)::integer as value
        from app_modules.fanbus_bus_assignments as assignment
        join app_modules.fanbus_registrations as participant
          on participant.id = assignment.participant_id
        where assignment.bus_id = bus.id and participant.status = 'ACTIVE'
      ) as occupancy on true
      where bus.trip_id = v_trip_id
    ), '[]'::jsonb),
    'summary', (
      select jsonb_build_object(
        'activeCount', count(*) filter (where status = 'ACTIVE'),
        'waitlistedCount', count(*) filter (where status = 'WAITLISTED'),
        'unassignedActiveCount', count(*) filter (
          where status = 'ACTIVE' and not exists (
            select 1 from app_modules.fanbus_bus_assignments as assignment
            where assignment.participant_id = registration.id
          )
        ),
        'activeBusCapacity', coalesce((
          select sum(capacity) from app_modules.fanbus_buses
          where trip_id = v_trip_id and is_active
        ), 0)
      )
      from app_modules.fanbus_registrations as registration
      where registration.trip_id = v_trip_id
    )
  );
end;
$$;

create function app_private.fanbus_submit_booking_core(
  p_trip_id uuid,
  p_source text,
  p_actor uuid,
  p_primary jsonb,
  p_companions jsonb,
  p_privacy_confirmed boolean,
  p_terms_confirmed boolean,
  p_idempotency_key uuid,
  p_legacy_request_hash text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_source text := upper(btrim(coalesce(p_source, '')));
  v_primary jsonb := coalesce(p_primary, '{}'::jsonb);
  v_companions jsonb := coalesce(p_companions, '[]'::jsonb);
  v_request_primary jsonb;
  v_request_companions jsonb := '[]'::jsonb;
  v_participants jsonb := '[]'::jsonb;
  v_participant jsonb;
  v_trip app_modules.fanbus_trips%rowtype;
  v_event_visibility text;
  v_member_id uuid;
  v_portal_user_id uuid;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_preference text;
  v_identity_keys text[];
  v_seen_identity_keys text[] := array[]::text[];
  v_existing_id uuid;
  v_existing_booking_id uuid;
  v_existing_status text;
  v_count integer;
  v_active_count integer;
  v_initial_status text;
  v_outcome text;
  v_now timestamptz;
  v_booking_id uuid;
  v_registration_id uuid;
  v_primary_registration_id uuid;
  v_sequence integer := 0;
  v_canonical jsonb;
  v_request_hash text;
  v_lock_key bigint;
  v_idempotency app_private.fanbus_registration_idempotency%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null then
    raise exception 'FANBUS_IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;
  if p_trip_id is null
     or v_source not in ('PORTAL', 'GUEST', 'MANUAL')
     or jsonb_typeof(v_primary) <> 'object'
     or jsonb_typeof(v_companions) <> 'array'
     or jsonb_array_length(v_companions) > 19
     or p_privacy_confirmed is distinct from true
     or p_terms_confirmed is distinct from true then
    raise exception 'FANBUS_BOOKING_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  if v_source = 'MANUAL'
     and (p_actor is null or not app_private.has_capability(
       p_actor, 'fanbus.registrations.manage'
     )) then
    raise exception 'Die Berechtigung fanbus.registrations.manage ist erforderlich.'
      using errcode = '42501';
  end if;
  if v_source = 'GUEST'
     and (v_primary ? 'memberId' or v_primary ? 'portalUserId') then
    raise exception 'FANBUS_GUEST_SUBJECT_INVALID' using errcode = '22023';
  end if;

  -- Normalize stable request data before resolving mutable profile snapshots.
  v_preference := upper(btrim(coalesce(v_primary ->> 'busPreference', '')));
  if v_preference not in ('RUHIG', 'PARTY', 'EGAL') then
    raise exception 'FANBUS_BUS_PREFERENCE_INVALID' using errcode = '22023';
  end if;
  if v_source = 'PORTAL' then
    if p_actor is null then
      raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode = '22023';
    end if;
    v_request_primary := jsonb_build_object(
      'portalSubject', p_actor,
      'busPreference', v_preference
    );
  elsif v_source = 'MANUAL'
        and nullif(v_primary ->> 'memberId', '') is not null then
    if nullif(v_primary ->> 'portalUserId', '') is not null then
      raise exception 'FANBUS_BOOKING_INVALID_PAYLOAD' using errcode = '22023';
    end if;
    begin
      v_member_id := (v_primary ->> 'memberId')::uuid;
    exception when others then
      raise exception 'FANBUS_MEMBER_UNAVAILABLE' using errcode = '22023';
    end;
    v_request_primary := jsonb_build_object(
      'actor', p_actor,
      'memberId', v_member_id,
      'busPreference', v_preference
    );
  elsif v_source = 'MANUAL'
        and nullif(v_primary ->> 'portalUserId', '') is not null then
    begin
      v_portal_user_id := (v_primary ->> 'portalUserId')::uuid;
    exception when others then
      raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode = '22023';
    end;
    v_request_primary := jsonb_build_object(
      'actor', p_actor,
      'portalUserId', v_portal_user_id,
      'busPreference', v_preference
    );
  else
    v_first_name := app_private.require_valid_name(
      app_private.clean_name(v_primary ->> 'firstName'), 'Vorname'
    );
    v_last_name := app_private.require_valid_name(
      app_private.clean_name(v_primary ->> 'lastName'), 'Nachname'
    );
    v_email := nullif(lower(btrim(coalesce(v_primary ->> 'email', ''))), '');
    if v_source = 'GUEST'
       and (v_email is null or length(v_email) not between 3 and 320
         or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
      raise exception 'FANBUS_EMAIL_INVALID' using errcode = '22023';
    end if;
    if v_source = 'MANUAL' and v_email is not null
       and (length(v_email) not between 3 and 320
         or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
      raise exception 'FANBUS_EMAIL_INVALID' using errcode = '22023';
    end if;
    v_request_primary := jsonb_strip_nulls(jsonb_build_object(
      'actor', case when v_source = 'MANUAL' then p_actor end,
      'firstName', v_first_name,
      'lastName', v_last_name,
      'email', v_email,
      'busPreference', v_preference
    ));
  end if;

  for v_participant in
    select value from jsonb_array_elements(v_companions) with ordinality
      as companion(value, position) order by position
  loop
    if jsonb_typeof(v_participant) <> 'object'
       or not v_participant ?& array['firstName', 'lastName', 'busPreference']
       or exists (
         select 1 from jsonb_object_keys(v_participant) as key(name)
         where key.name <> all(array[
           'firstName', 'lastName', 'email', 'busPreference'
         ])
       ) then
      raise exception 'FANBUS_COMPANION_INVALID' using errcode = '22023';
    end if;
    v_first_name := app_private.require_valid_name(
      app_private.clean_name(v_participant ->> 'firstName'), 'Vorname'
    );
    v_last_name := app_private.require_valid_name(
      app_private.clean_name(v_participant ->> 'lastName'), 'Nachname'
    );
    v_email := nullif(lower(btrim(coalesce(v_participant ->> 'email', ''))), '');
    v_preference := upper(btrim(coalesce(v_participant ->> 'busPreference', '')));
    if v_preference not in ('RUHIG', 'PARTY', 'EGAL')
       or (v_email is not null and (length(v_email) not between 3 and 320
         or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) then
      raise exception 'FANBUS_COMPANION_INVALID' using errcode = '22023';
    end if;
    v_request_companions := v_request_companions || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'firstName', v_first_name, 'lastName', v_last_name, 'email', v_email,
        'busPreference', v_preference
      ))
    );
  end loop;

  v_count := jsonb_array_length(v_request_companions) + 1;
  v_canonical := jsonb_build_object(
    'tripId', p_trip_id, 'source', v_source,
    'primary', v_request_primary,
    'companions', v_request_companions,
    'privacyConfirmed', p_privacy_confirmed,
    'termsConfirmed', p_terms_confirmed
  );
  v_request_hash := encode(extensions.digest(v_canonical::text, 'sha256'), 'hex');
  v_lock_key := (
    'x' || substr(encode(extensions.digest(
      'app_private.fanbus_submit_registration:' || p_idempotency_key::text,
      'sha256'
    ), 'hex'), 1, 16)
  )::bit(64)::bigint;
  perform pg_catalog.pg_advisory_xact_lock(v_lock_key);

  select * into v_idempotency
  from app_private.fanbus_registration_idempotency
  where idempotency_key = p_idempotency_key;
  if found then
    if v_idempotency.request_hash <> v_request_hash
       and (p_legacy_request_hash is null
         or v_idempotency.request_hash <> p_legacy_request_hash) then
      raise exception 'FANBUS_IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return coalesce(v_idempotency.response_payload, jsonb_build_object(
      'outcome', v_idempotency.outcome,
      'bookingId', v_idempotency.booking_id,
      'registrationId', v_idempotency.registration_id,
      'participantCount', 1
    ));
  end if;

  -- Capacity-changing operations lock the trip row first.
  select trip.* into v_trip
  from app_modules.fanbus_trips as trip
  where trip.id = p_trip_id
  for update;
  if not found then
    raise exception 'FANBUS_TRIP_UNAVAILABLE' using errcode = 'P0002';
  end if;
  select visibility into v_event_visibility
  from app_modules.events where id = v_trip.event_id;
  v_now := clock_timestamp();

  if v_trip.status = 'CLOSED' then
    v_outcome := 'CLOSED';
  elsif v_trip.status <> 'PUBLISHED'
     or v_event_visibility is distinct from 'PUBLIC'
     or v_trip.departure_at is null
     or v_trip.departure_info is null
     or length(btrim(v_trip.departure_info)) = 0
     or v_trip.registration_opens_at is null
     or v_trip.registration_closes_at is null
     or v_trip.price_cents is null
     or v_trip.capacity is null
     or v_trip.privacy_reference is null
     or length(btrim(v_trip.privacy_reference)) = 0
     or v_trip.terms_reference is null
     or length(btrim(v_trip.terms_reference)) = 0 then
    v_outcome := 'UNAVAILABLE';
  elsif v_now < v_trip.registration_opens_at then
    v_outcome := 'NOT_STARTED';
  elsif v_now >= v_trip.registration_closes_at then
    v_outcome := 'CLOSED';
  end if;

  if v_outcome is not null then
    v_response := jsonb_build_object(
      'outcome', v_outcome, 'bookingId', null, 'registrationId', null,
      'participantCount', v_count
    );
    insert into app_private.fanbus_registration_idempotency (
      idempotency_key, request_hash, trip_id, outcome, response_payload
    ) values (
      p_idempotency_key, v_request_hash, p_trip_id, v_outcome, v_response
    );
    return v_response;
  end if;

  -- Resolve the primary only after an idempotency replay has been ruled out.
  if v_source = 'PORTAL' then
    select u.id, m.id, u.first_name, u.last_name,
      nullif(lower(btrim(u.email)), '')
    into v_portal_user_id, v_member_id, v_first_name, v_last_name, v_email
    from app_portal.users as u
    left join app_portal.user_member_links as l on l.user_id = u.id
    left join app_fanclub.members as m
      on m.id = l.member_id and m.status = 'ACTIVE'
    where u.id = p_actor and u.status = 'ACTIVE';
    if not found then
      raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode = '22023';
    end if;
  elsif v_source = 'MANUAL' and v_member_id is not null then
    select m.id, u.id, m.first_name, m.last_name,
      case
        when nullif(lower(btrim(m.email)), '')
          ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
          then nullif(lower(btrim(m.email)), '')
        when nullif(lower(btrim(u.email)), '')
          ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
          then nullif(lower(btrim(u.email)), '')
      end
    into v_member_id, v_portal_user_id, v_first_name, v_last_name, v_email
    from app_fanclub.members as m
    left join app_portal.user_member_links as l on l.member_id = m.id
    left join app_portal.users as u
      on u.id = l.user_id and u.status = 'ACTIVE'
    where m.id = v_member_id and m.status = 'ACTIVE';
    if not found then
      raise exception 'FANBUS_MEMBER_UNAVAILABLE' using errcode = '22023';
    end if;
  elsif v_source = 'MANUAL' and v_portal_user_id is not null then
    select m.id, u.id, u.first_name, u.last_name,
      case when nullif(lower(btrim(u.email)), '')
        ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        then nullif(lower(btrim(u.email)), '') end
    into v_member_id, v_portal_user_id, v_first_name, v_last_name, v_email
    from app_portal.users as u
    left join app_portal.user_member_links as l on l.user_id = u.id
    left join app_fanclub.members as m
      on m.id = l.member_id and m.status = 'ACTIVE'
    where u.id = v_portal_user_id and u.status = 'ACTIVE';
    if not found then
      raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode = '22023';
    end if;
  else
    v_first_name := v_request_primary ->> 'firstName';
    v_last_name := v_request_primary ->> 'lastName';
    v_email := v_request_primary ->> 'email';
  end if;

  v_first_name := app_private.require_valid_name(
    app_private.clean_name(v_first_name), 'Vorname'
  );
  v_last_name := app_private.require_valid_name(
    app_private.clean_name(v_last_name), 'Nachname'
  );
  if v_source = 'PORTAL'
     and (v_email is null or length(v_email) not between 3 and 320
       or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'FANBUS_EMAIL_INVALID' using errcode = '22023';
  end if;

  v_participants := jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'memberId', v_member_id, 'portalUserId', v_portal_user_id,
    'firstName', v_first_name, 'lastName', v_last_name, 'email', v_email,
    'busPreference', v_request_primary ->> 'busPreference',
    'bookingRole', 'PRIMARY', 'participantSequence', 1
  )));
  for v_participant in
    select value from jsonb_array_elements(v_request_companions) with ordinality
      as companion(value, position) order by position
  loop
    v_participants := v_participants || jsonb_build_array(
      v_participant || jsonb_build_object(
        'bookingRole', 'COMPANION',
        'participantSequence', jsonb_array_length(v_participants) + 1
      )
    );
  end loop;

  -- Validate all stable identities before the first insert.
  for v_participant in
    select value from jsonb_array_elements(v_participants) with ordinality
      as participant(value, position) order by position
  loop
    v_identity_keys := array[]::text[];
    if v_participant ? 'memberId' then
      v_identity_keys := array_append(v_identity_keys,
        'MEMBER:' || (v_participant ->> 'memberId'));
    end if;
    if v_participant ? 'portalUserId' then
      v_identity_keys := array_append(v_identity_keys,
        'PORTAL:' || (v_participant ->> 'portalUserId'));
    end if;
    if v_participant ? 'email' then
      v_identity_keys := array_append(v_identity_keys,
        'EMAIL:' || (v_participant ->> 'email'));
    end if;
    if cardinality(v_identity_keys) = 0 and v_source = 'MANUAL' then
      v_identity_keys := array_append(v_identity_keys,
        'MANUAL_NAME:' || lower(btrim(v_participant ->> 'firstName'))
          || ':' || lower(btrim(v_participant ->> 'lastName')));
    end if;
    if v_identity_keys && v_seen_identity_keys then
      raise exception 'FANBUS_BATCH_DUPLICATE' using errcode = 'P3201';
    end if;
    v_seen_identity_keys := v_seen_identity_keys || v_identity_keys;

    v_existing_id := null;
    v_existing_booking_id := null;
    v_existing_status := null;
    select registration.id, registration.booking_id, registration.status
    into v_existing_id, v_existing_booking_id, v_existing_status
    from app_modules.fanbus_registrations as registration
    where registration.trip_id = p_trip_id
      and registration.status in ('ACTIVE', 'WAITLISTED')
      and (
        (v_participant ? 'memberId'
          and registration.member_id = (v_participant ->> 'memberId')::uuid)
        or (v_participant ? 'portalUserId'
          and registration.portal_user_id = (v_participant ->> 'portalUserId')::uuid)
        or (v_participant ? 'email'
          and lower(btrim(registration.email)) = v_participant ->> 'email')
        or (cardinality(v_identity_keys) = 1
          and v_identity_keys[1] like 'MANUAL_NAME:%'
          and registration.source = 'MANUAL'
          and registration.member_id is null
          and registration.portal_user_id is null
          and registration.email is null
          and lower(btrim(registration.first_name)) =
            lower(btrim(v_participant ->> 'firstName'))
          and lower(btrim(registration.last_name)) =
            lower(btrim(v_participant ->> 'lastName')))
      )
    order by
      case
        when v_participant ? 'memberId'
          and registration.member_id = (v_participant ->> 'memberId')::uuid
          then 0
        when v_participant ? 'portalUserId'
          and registration.portal_user_id =
            (v_participant ->> 'portalUserId')::uuid
          then 1
        when v_participant ? 'email'
          and lower(btrim(registration.email)) = v_participant ->> 'email'
          then 2
        else 3
      end,
      registration.registered_at, registration.id
    limit 1;

    if v_existing_id is not null then
      if v_count = 1 then
        v_outcome := case when v_existing_status = 'WAITLISTED'
          then 'WAITLISTED' else 'ALREADY_ACTIVE' end;
        v_response := jsonb_build_object(
          'outcome', v_outcome, 'bookingId', v_existing_booking_id,
          'registrationId', v_existing_id, 'participantCount', 1
        );
        insert into app_private.fanbus_registration_idempotency (
          idempotency_key, request_hash, trip_id, registration_id,
          booking_id, outcome, response_payload
        ) values (
          p_idempotency_key, v_request_hash, p_trip_id, v_existing_id,
          v_existing_booking_id, v_outcome, v_response
        );
        return v_response;
      end if;
      raise exception 'FANBUS_BATCH_DUPLICATE' using errcode = 'P3201';
    end if;
  end loop;

  select count(*)::integer into v_active_count
  from app_modules.fanbus_registrations
  where trip_id = p_trip_id and status = 'ACTIVE';
  if exists (
    select 1 from app_modules.fanbus_registrations
    where trip_id = p_trip_id and status = 'WAITLISTED'
  ) or v_active_count + v_count > v_trip.capacity then
    v_initial_status := 'WAITLISTED';
  else
    v_initial_status := 'ACTIVE';
  end if;

  insert into app_modules.fanbus_bookings (trip_id, source, created_at, created_by)
  values (p_trip_id, v_source, v_now, p_actor)
  returning id into v_booking_id;

  for v_participant in
    select value from jsonb_array_elements(v_participants) with ordinality
      as participant(value, position) order by position
  loop
    v_sequence := v_sequence + 1;
    insert into app_modules.fanbus_registrations (
      trip_id, booking_id, booking_role, participant_sequence,
      portal_user_id, member_id, first_name, last_name, email,
      bus_preference, source, status, waitlisted_at,
      privacy_reference, terms_reference, privacy_accepted_at,
      terms_accepted_at, registered_at, created_by, updated_by
    ) values (
      p_trip_id, v_booking_id, v_participant ->> 'bookingRole',
      (v_participant ->> 'participantSequence')::integer,
      nullif(v_participant ->> 'portalUserId', '')::uuid,
      nullif(v_participant ->> 'memberId', '')::uuid,
      v_participant ->> 'firstName', v_participant ->> 'lastName',
      nullif(v_participant ->> 'email', ''),
      v_participant ->> 'busPreference', v_source, v_initial_status,
      case when v_initial_status = 'WAITLISTED' then v_now end,
      v_trip.privacy_reference, v_trip.terms_reference, v_now, v_now, v_now,
      p_actor, p_actor
    ) returning id into v_registration_id;
    if v_sequence = 1 then
      v_primary_registration_id := v_registration_id;
    end if;

    perform app_private.log_audit(
      p_actor,
      case when v_source = 'MANUAL' then 'FANBUS_PARTICIPANT_INTERNAL_ADDED'
        else 'FANBUS_PARTICIPANT_CREATED' end,
      'fanbus_registration', v_registration_id::text, null, null,
      jsonb_build_object(
        'tripId', p_trip_id, 'bookingId', v_booking_id,
        'participantId', v_registration_id, 'status', v_initial_status,
        'source', v_source
      )
    );
    if v_initial_status = 'WAITLISTED' then
      perform app_private.log_audit(
        p_actor, 'FANBUS_WAITLIST_ENTERED', 'fanbus_registration',
        v_registration_id::text, null,
        jsonb_build_object('status', 'WAITLISTED'),
        jsonb_build_object(
          'tripId', p_trip_id, 'bookingId', v_booking_id,
          'participantId', v_registration_id, 'status', 'WAITLISTED',
          'source', v_source
        )
      );
    end if;
  end loop;

  v_outcome := case when v_initial_status = 'WAITLISTED'
    then 'WAITLISTED' else 'CREATED' end;
  v_response := jsonb_build_object(
    'outcome', v_outcome, 'bookingId', v_booking_id,
    'registrationId', v_primary_registration_id, 'participantCount', v_count
  );
  insert into app_private.fanbus_registration_idempotency (
    idempotency_key, request_hash, trip_id, registration_id,
    booking_id, outcome, response_payload
  ) values (
    p_idempotency_key, v_request_hash, p_trip_id, v_primary_registration_id,
    v_booking_id, v_outcome, v_response
  );
  return v_response;
end;
$$;

create function app_private.api_fanbus_registration_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_id uuid;
  v_expected_revision integer;
  v_existing app_modules.fanbus_registrations%rowtype;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_preference text;
  v_changed_fields jsonb := '[]'::jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array[
       'id', 'expectedRevision', 'firstName', 'lastName',
       'email', 'busPreference'
     ]
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array[
         'id', 'expectedRevision', 'firstName', 'lastName',
         'email', 'busPreference'
       ])
     ) then
    raise exception 'FANBUS_PARTICIPANT_UPDATE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;
  begin
    v_id := (p_payload ->> 'id')::uuid;
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception when others then
    raise exception 'FANBUS_PARTICIPANT_UPDATE_INVALID_PAYLOAD'
      using errcode = '22023';
  end;
  if v_expected_revision is null or v_expected_revision <= 0 then
    raise exception 'FANBUS_PARTICIPANT_UPDATE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;
  select * into v_existing
  from app_modules.fanbus_registrations
  where id = v_id
  for update;
  if not found then
    raise exception 'Der Teilnehmer wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_existing.revision <> v_expected_revision then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;

  v_first_name := app_private.require_valid_name(
    app_private.clean_name(p_payload ->> 'firstName'), 'Vorname'
  );
  v_last_name := app_private.require_valid_name(
    app_private.clean_name(p_payload ->> 'lastName'), 'Nachname'
  );
  v_email := nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '');
  v_preference := upper(btrim(coalesce(p_payload ->> 'busPreference', '')));
  if v_preference not in ('RUHIG', 'PARTY', 'EGAL')
     or (v_email is not null and (
       length(v_email) not between 3 and 320
       or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     )) then
    raise exception 'FANBUS_PARTICIPANT_UPDATE_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  -- Linked identities keep their server-sourced snapshots; preference remains editable.
  if (v_existing.member_id is not null or v_existing.portal_user_id is not null)
     and (
       v_first_name <> v_existing.first_name
       or v_last_name <> v_existing.last_name
       or v_email is distinct from v_existing.email
     ) then
    raise exception 'FANBUS_LINKED_IDENTITY_FIELDS_READ_ONLY'
      using errcode = '22023';
  end if;
  if v_existing.booking_role = 'PRIMARY'
     and v_existing.source in ('PORTAL', 'GUEST')
     and v_email is null then
    raise exception 'FANBUS_EMAIL_INVALID' using errcode = '22023';
  end if;
  if v_existing.status in ('ACTIVE', 'WAITLISTED') and v_email is not null
     and exists (
       select 1 from app_modules.fanbus_registrations as duplicate
       where duplicate.trip_id = v_existing.trip_id
         and duplicate.id <> v_existing.id
         and duplicate.status in ('ACTIVE', 'WAITLISTED')
         and lower(btrim(duplicate.email)) = v_email
     ) then
    raise exception 'FANBUS_PARTICIPANT_DUPLICATE' using errcode = 'P3201';
  end if;

  if v_first_name is distinct from v_existing.first_name then
    v_changed_fields := v_changed_fields || '"firstName"'::jsonb;
  end if;
  if v_last_name is distinct from v_existing.last_name then
    v_changed_fields := v_changed_fields || '"lastName"'::jsonb;
  end if;
  if v_email is distinct from v_existing.email then
    v_changed_fields := v_changed_fields || '"email"'::jsonb;
  end if;
  if v_preference is distinct from v_existing.bus_preference then
    v_changed_fields := v_changed_fields || '"busPreference"'::jsonb;
  end if;

  update app_modules.fanbus_registrations
  set first_name = v_first_name,
      last_name = v_last_name,
      email = v_email,
      bus_preference = v_preference,
      revision = revision + 1,
      updated_by = v_actor
  where id = v_id;

  perform app_private.log_audit(
    v_actor, 'FANBUS_PARTICIPANT_UPDATED', 'fanbus_registration',
    v_id::text, null, null,
    jsonb_build_object(
      'tripId', v_existing.trip_id,
      'bookingId', v_existing.booking_id,
      'participantId', v_existing.id,
      'changedFields', v_changed_fields,
      'busPreference', v_preference
    )
  );
  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId', v_existing.trip_id)
  );
end;
$$;

create or replace function app_private.api_fanbus_registration_cancel(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_id uuid;
  v_expected_revision integer;
  v_trip_id uuid;
  v_existing app_modules.fanbus_registrations%rowtype;
  v_assignment app_modules.fanbus_bus_assignments%rowtype;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['id', 'expectedRevision']
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['id', 'expectedRevision'])
     ) then
    raise exception 'FANBUS_CANCELLATION_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_id := (p_payload ->> 'id')::uuid;
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception when others then
    raise exception 'FANBUS_CANCELLATION_INVALID_PAYLOAD' using errcode = '22023';
  end;
  if v_expected_revision is null or v_expected_revision <= 0 then
    raise exception 'FANBUS_CANCELLATION_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  select trip_id into v_trip_id
  from app_modules.fanbus_registrations where id = v_id;
  if not found then
    raise exception 'Der Teilnehmer wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  perform 1 from app_modules.fanbus_trips where id = v_trip_id for update;
  select * into v_existing
  from app_modules.fanbus_registrations where id = v_id for update;
  if v_existing.revision <> v_expected_revision then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;
  if v_existing.status not in ('ACTIVE', 'WAITLISTED') then
    raise exception 'FANBUS_PARTICIPANT_NOT_CANCELLABLE' using errcode = '22023';
  end if;

  delete from app_modules.fanbus_bus_assignments
  where participant_id = v_id
  returning * into v_assignment;
  update app_modules.fanbus_registrations
  set status = 'CANCELLED', cancelled_at = clock_timestamp(),
      revision = revision + 1, updated_by = v_actor
  where id = v_id;

  if v_assignment.participant_id is not null then
    perform app_private.log_audit(
      v_actor, 'FANBUS_BUS_UNASSIGNED', 'fanbus_registration', v_id::text,
      jsonb_build_object('busId', v_assignment.bus_id), null,
      jsonb_build_object(
        'tripId', v_trip_id, 'bookingId', v_existing.booking_id,
        'participantId', v_id, 'busId', v_assignment.bus_id
      )
    );
  end if;
  perform app_private.log_audit(
    v_actor, 'FANBUS_PARTICIPANT_CANCELLED', 'fanbus_registration',
    v_id::text, jsonb_build_object('status', v_existing.status),
    jsonb_build_object('status', 'CANCELLED'),
    jsonb_build_object(
      'tripId', v_trip_id, 'bookingId', v_existing.booking_id,
      'participantId', v_id, 'status', 'CANCELLED',
      'source', v_existing.source
    )
  );
  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId', v_trip_id)
  );
end;
$$;

create function app_private.api_fanbus_waitlist_promote(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_id uuid;
  v_expected_revision integer;
  v_trip_id uuid;
  v_existing app_modules.fanbus_registrations%rowtype;
  v_first_id uuid;
  v_capacity integer;
  v_active_count integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['id', 'expectedRevision']
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['id', 'expectedRevision'])
     ) then
    raise exception 'FANBUS_PROMOTION_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_id := (p_payload ->> 'id')::uuid;
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception when others then
    raise exception 'FANBUS_PROMOTION_INVALID_PAYLOAD' using errcode = '22023';
  end;
  if v_expected_revision is null or v_expected_revision <= 0 then
    raise exception 'FANBUS_PROMOTION_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  select trip_id into v_trip_id
  from app_modules.fanbus_registrations where id = v_id;
  if not found then
    raise exception 'Der Teilnehmer wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  select capacity into v_capacity
  from app_modules.fanbus_trips where id = v_trip_id for update;
  select * into v_existing
  from app_modules.fanbus_registrations where id = v_id for update;
  if v_existing.revision <> v_expected_revision then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;
  if v_existing.status <> 'WAITLISTED' then
    raise exception 'FANBUS_PARTICIPANT_NOT_WAITLISTED' using errcode = '22023';
  end if;
  select id into v_first_id
  from app_modules.fanbus_registrations
  where trip_id = v_trip_id and status = 'WAITLISTED'
  order by waitlisted_at asc, participant_sequence asc, id asc
  limit 1;
  if v_first_id is distinct from v_id then
    raise exception 'FANBUS_WAITLIST_FIFO_CONFLICT' using errcode = 'P3202';
  end if;
  select count(*)::integer into v_active_count
  from app_modules.fanbus_registrations
  where trip_id = v_trip_id and status = 'ACTIVE';
  if v_active_count >= v_capacity then
    raise exception 'FANBUS_TRIP_CAPACITY_EXHAUSTED' using errcode = 'P3203';
  end if;
  update app_modules.fanbus_registrations
  set status = 'ACTIVE', promoted_at = clock_timestamp(),
      revision = revision + 1, updated_by = v_actor
  where id = v_id;
  perform app_private.log_audit(
    v_actor, 'FANBUS_WAITLIST_PROMOTED', 'fanbus_registration', v_id::text,
    jsonb_build_object('status', 'WAITLISTED'),
    jsonb_build_object('status', 'ACTIVE'),
    jsonb_build_object(
      'tripId', v_trip_id, 'bookingId', v_existing.booking_id,
      'participantId', v_id, 'status', 'ACTIVE'
    )
  );
  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId', v_trip_id)
  );
end;
$$;

create function app_private.api_fanbus_bus_upsert(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_id uuid;
  v_trip_id uuid;
  v_expected_revision integer;
  v_label text;
  v_category text;
  v_capacity integer;
  v_is_active boolean;
  v_existing app_modules.fanbus_buses%rowtype;
  v_occupancy integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['tripId', 'label', 'category', 'capacity', 'isActive']
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array[
         'id', 'tripId', 'expectedRevision', 'label',
         'category', 'capacity', 'isActive'
       ])
     ) then
    raise exception 'FANBUS_BUS_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_trip_id := (p_payload ->> 'tripId')::uuid;
    v_expected_revision := nullif(
      btrim(coalesce(p_payload ->> 'expectedRevision', '')), ''
    )::integer;
    v_capacity := (p_payload ->> 'capacity')::integer;
    v_is_active := (p_payload ->> 'isActive')::boolean;
  exception when others then
    raise exception 'FANBUS_BUS_INVALID_PAYLOAD' using errcode = '22023';
  end;
  v_label := btrim(coalesce(p_payload ->> 'label', ''));
  v_category := upper(btrim(coalesce(p_payload ->> 'category', '')));
  if length(v_label) not between 1 and 160
     or v_category not in ('NORMAL', 'RUHIG', 'PARTY')
     or v_capacity <= 0 then
    raise exception 'FANBUS_BUS_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  if not exists (select 1 from app_modules.fanbus_trips where id = v_trip_id) then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_id is null then
    insert into app_modules.fanbus_buses (
      trip_id, label, category, capacity, is_active, created_by, updated_by
    ) values (
      v_trip_id, v_label, v_category, v_capacity, v_is_active, v_actor, v_actor
    ) returning id into v_id;
    perform app_private.log_audit(
      v_actor, 'FANBUS_BUS_CREATED', 'fanbus_bus', v_id::text, null, null,
      jsonb_build_object('tripId', v_trip_id, 'busId', v_id)
    );
  else
    if v_expected_revision is null or v_expected_revision <= 0 then
      raise exception 'FANBUS_BUS_EXPECTED_REVISION_REQUIRED' using errcode = '22023';
    end if;
    select * into v_existing
    from app_modules.fanbus_buses where id = v_id for update;
    if not found or v_existing.trip_id <> v_trip_id then
      raise exception 'Der Bus wurde nicht gefunden.' using errcode = 'P0002';
    end if;
    if v_existing.revision <> v_expected_revision then
      raise exception 'STALE_REVISION' using errcode = '40001';
    end if;
    select count(*)::integer into v_occupancy
    from app_modules.fanbus_bus_assignments as assignment
    join app_modules.fanbus_registrations as participant
      on participant.id = assignment.participant_id
    where assignment.bus_id = v_id and participant.status = 'ACTIVE';
    if v_capacity < v_occupancy then
      raise exception 'FANBUS_BUS_CAPACITY_BELOW_OCCUPANCY' using errcode = '22023';
    end if;
    if not v_is_active and v_occupancy > 0 then
      raise exception 'FANBUS_OCCUPIED_BUS_CANNOT_DEACTIVATE' using errcode = '22023';
    end if;
    update app_modules.fanbus_buses
    set label = v_label, category = v_category, capacity = v_capacity,
        is_active = v_is_active, revision = revision + 1, updated_by = v_actor
    where id = v_id;
    perform app_private.log_audit(
      v_actor, 'FANBUS_BUS_UPDATED', 'fanbus_bus', v_id::text, null, null,
      jsonb_build_object('tripId', v_trip_id, 'busId', v_id)
    );
  end if;
  return jsonb_build_object('id', v_id, 'tripId', v_trip_id);
end;
$$;

create function app_private.api_fanbus_buses_list(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_trip_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['tripId']
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'tripId'
     ) then
    raise exception 'FANBUS_BUS_LIST_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_trip_id := (p_payload ->> 'tripId')::uuid;
  exception when others then
    raise exception 'FANBUS_BUS_LIST_INVALID_PAYLOAD' using errcode = '22023';
  end;
  if not exists (select 1 from app_modules.fanbus_trips where id = v_trip_id) then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'tripId', v_trip_id,
    'buses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', bus.id, 'tripId', bus.trip_id, 'label', bus.label,
          'category', bus.category, 'capacity', bus.capacity,
          'isActive', bus.is_active, 'revision', bus.revision,
          'occupied', coalesce(occupancy.value, 0),
          'occupancy', coalesce(occupancy.value, 0),
          'remainingCapacity', greatest(
            bus.capacity - coalesce(occupancy.value, 0), 0
          )
        ) order by bus.is_active desc, lower(btrim(bus.label)), bus.id
      )
      from app_modules.fanbus_buses as bus
      left join lateral (
        select count(*)::integer as value
        from app_modules.fanbus_bus_assignments as assignment
        join app_modules.fanbus_registrations as participant
          on participant.id = assignment.participant_id
        where assignment.bus_id = bus.id and participant.status = 'ACTIVE'
      ) as occupancy on true
      where bus.trip_id = v_trip_id
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'activeCount', (
        select count(*) from app_modules.fanbus_registrations
        where trip_id = v_trip_id and status = 'ACTIVE'
      ),
      'activeBusCapacity', coalesce((
        select sum(capacity) from app_modules.fanbus_buses
        where trip_id = v_trip_id and is_active
      ), 0)
    )
  );
end;
$$;

create function app_private.api_fanbus_bus_assignment_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_participant_id uuid;
  v_bus_id uuid;
  v_participant app_modules.fanbus_registrations%rowtype;
  v_bus app_modules.fanbus_buses%rowtype;
  v_existing app_modules.fanbus_bus_assignments%rowtype;
  v_occupancy integer;
  v_event text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['participantId', 'busId']
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['participantId', 'busId'])
     ) then
    raise exception 'FANBUS_ASSIGNMENT_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_participant_id := (p_payload ->> 'participantId')::uuid;
    v_bus_id := nullif(btrim(coalesce(p_payload ->> 'busId', '')), '')::uuid;
  exception when others then
    raise exception 'FANBUS_ASSIGNMENT_INVALID_PAYLOAD' using errcode = '22023';
  end;
  select * into v_participant
  from app_modules.fanbus_registrations
  where id = v_participant_id
  for update;
  if not found then
    raise exception 'Der Teilnehmer wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  select * into v_existing
  from app_modules.fanbus_bus_assignments
  where participant_id = v_participant_id;

  if v_bus_id is null then
    if v_existing.participant_id is not null then
      delete from app_modules.fanbus_bus_assignments
      where participant_id = v_participant_id;
      perform app_private.log_audit(
        v_actor, 'FANBUS_BUS_UNASSIGNED', 'fanbus_registration',
        v_participant_id::text, jsonb_build_object('busId', v_existing.bus_id),
        null, jsonb_build_object(
          'tripId', v_participant.trip_id,
          'bookingId', v_participant.booking_id,
          'participantId', v_participant_id,
          'busId', v_existing.bus_id
        )
      );
    end if;
    return app_private.api_fanbus_registrations_list(
      jsonb_build_object('tripId', v_participant.trip_id)
    );
  end if;
  if v_participant.status <> 'ACTIVE' then
    raise exception 'FANBUS_ASSIGNMENT_REQUIRES_ACTIVE_PARTICIPANT'
      using errcode = '22023';
  end if;
  select * into v_bus
  from app_modules.fanbus_buses where id = v_bus_id for update;
  if not found then
    raise exception 'Der Bus wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if not v_bus.is_active or v_bus.trip_id <> v_participant.trip_id then
    raise exception 'FANBUS_ASSIGNMENT_BUS_UNAVAILABLE' using errcode = '22023';
  end if;
  if v_existing.bus_id is not distinct from v_bus_id then
    return app_private.api_fanbus_registrations_list(
      jsonb_build_object('tripId', v_participant.trip_id)
    );
  end if;
  select count(*)::integer into v_occupancy
  from app_modules.fanbus_bus_assignments as assignment
  join app_modules.fanbus_registrations as participant
    on participant.id = assignment.participant_id
  where assignment.bus_id = v_bus_id and participant.status = 'ACTIVE';
  if v_occupancy >= v_bus.capacity then
    raise exception 'FANBUS_BUS_CAPACITY_EXHAUSTED' using errcode = 'P3204';
  end if;

  if v_existing.participant_id is null then
    insert into app_modules.fanbus_bus_assignments (
      participant_id, trip_id, bus_id, created_by, updated_by
    ) values (
      v_participant_id, v_participant.trip_id, v_bus_id, v_actor, v_actor
    );
    v_event := 'FANBUS_BUS_ASSIGNED';
  else
    update app_modules.fanbus_bus_assignments
    set bus_id = v_bus_id, revision = revision + 1, updated_by = v_actor
    where participant_id = v_participant_id;
    v_event := 'FANBUS_BUS_CHANGED';
  end if;
  perform app_private.log_audit(
    v_actor, v_event, 'fanbus_registration', v_participant_id::text,
    case when v_existing.participant_id is null then null
      else jsonb_build_object('busId', v_existing.bus_id) end,
    jsonb_build_object('busId', v_bus_id),
    jsonb_build_object(
      'tripId', v_participant.trip_id,
      'bookingId', v_participant.booking_id,
      'participantId', v_participant_id,
      'busId', v_bus_id
    )
  );
  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId', v_participant.trip_id)
  );
end;
$$;

revoke all on function app_private.fanbus_legacy_request_hash(
  uuid, text, uuid, uuid, uuid, text, text, text, text, boolean, boolean
) from public, anon, authenticated, service_role;
revoke all on function app_private.fanbus_submit_booking_core(
  uuid, text, uuid, jsonb, jsonb, boolean, boolean, uuid, text
) from public, anon, authenticated, service_role;
revoke all on function app_private.api_fanbus_self_register(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_fanbus_trips_list()
from public, anon, authenticated, service_role;
revoke all on function app_private.api_fanbus_registrations_list(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_fanbus_registration_update(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_fanbus_registration_cancel(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_fanbus_waitlist_promote(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_fanbus_bus_upsert(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_fanbus_buses_list(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_fanbus_bus_assignment_set(jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.pd_api_before_fanbus_participants_m320_r1(text, jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.pd_api(text, jsonb) to authenticated;
revoke all on function public.pd_public_fanbus_trip(uuid)
from public, anon, authenticated;
grant execute on function public.pd_public_fanbus_trip(uuid)
to anon, authenticated;
revoke all on function public.pd_public_fanbus_trips()
from public, anon, authenticated;
grant execute on function public.pd_public_fanbus_trips()
to anon, authenticated;
revoke all on function public.m310_submit_guest_fanbus_registration(
  jsonb, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.m310_submit_guest_fanbus_registration(
  jsonb, uuid, text
) to service_role;
