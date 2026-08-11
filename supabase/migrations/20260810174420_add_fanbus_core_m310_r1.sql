-- Plaerrdeifl Digitalplattform V4
-- P300 / M310-R1 / F1.1: Fanbus-Datenmodell und Registrierungs-Core

create table app_modules.fanbus_trips (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null unique
    references app_modules.events(id) on delete restrict,
  departure_at timestamptz,
  departure_info text,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  price_cents integer,
  capacity integer,
  privacy_reference text,
  terms_reference text,
  status text not null default 'DRAFT',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid
    references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid
    references app_portal.users(id) on delete set null,
  constraint fanbus_trips_status_check
    check (status in ('DRAFT', 'PUBLISHED', 'CLOSED')),
  constraint fanbus_trips_price_cents_check
    check (price_cents is null or price_cents >= 0),
  constraint fanbus_trips_capacity_check
    check (capacity is null or capacity > 0),
  constraint fanbus_trips_registration_window_check
    check (
      registration_opens_at is null
      or registration_closes_at is null
      or registration_closes_at > registration_opens_at
    ),
  constraint fanbus_trips_departure_info_check
    check (departure_info is null or length(btrim(departure_info)) > 0),
  constraint fanbus_trips_privacy_reference_check
    check (privacy_reference is null or length(btrim(privacy_reference)) > 0),
  constraint fanbus_trips_terms_reference_check
    check (terms_reference is null or length(btrim(terms_reference)) > 0)
);

create table app_modules.fanbus_registrations (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null
    references app_modules.fanbus_trips(id) on delete restrict,
  portal_user_id uuid
    references app_portal.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  bus_preference text not null,
  status text not null default 'ACTIVE',
  privacy_reference text not null,
  terms_reference text not null,
  privacy_accepted_at timestamptz not null,
  terms_accepted_at timestamptz not null,
  revision integer not null default 1,
  registered_at timestamptz not null default now(),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid
    references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid
    references app_portal.users(id) on delete set null,
  constraint fanbus_registrations_first_name_check
    check (length(btrim(first_name)) between 1 and 160),
  constraint fanbus_registrations_last_name_check
    check (length(btrim(last_name)) between 1 and 160),
  constraint fanbus_registrations_email_check
    check (length(btrim(email)) between 3 and 320),
  constraint fanbus_registrations_bus_preference_check
    check (bus_preference in ('RUHIG', 'PARTY', 'EGAL')),
  constraint fanbus_registrations_status_check
    check (status in ('ACTIVE', 'CANCELLED')),
  constraint fanbus_registrations_privacy_reference_check
    check (length(btrim(privacy_reference)) > 0),
  constraint fanbus_registrations_terms_reference_check
    check (length(btrim(terms_reference)) > 0)
);

create table app_private.fanbus_registration_idempotency (
  idempotency_key uuid primary key,
  request_hash text not null,
  trip_id uuid not null
    references app_modules.fanbus_trips(id) on delete cascade,
  registration_id uuid
    references app_modules.fanbus_registrations(id) on delete set null,
  outcome text not null,
  created_at timestamptz not null default now(),
  constraint fanbus_registration_idempotency_request_hash_check
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint fanbus_registration_idempotency_outcome_check
    check (
      outcome in (
        'CREATED',
        'ALREADY_ACTIVE',
        'FULL',
        'NOT_STARTED',
        'CLOSED',
        'UNAVAILABLE'
      )
    )
);

create index fanbus_trips_status_idx
  on app_modules.fanbus_trips(status);

create index fanbus_registrations_trip_status_idx
  on app_modules.fanbus_registrations(trip_id, status);

create index fanbus_registrations_portal_user_idx
  on app_modules.fanbus_registrations(portal_user_id)
  where portal_user_id is not null;

create unique index fanbus_registrations_active_email_uidx
  on app_modules.fanbus_registrations(trip_id, lower(btrim(email)))
  where status = 'ACTIVE';

create unique index fanbus_registrations_active_portal_user_uidx
  on app_modules.fanbus_registrations(trip_id, portal_user_id)
  where status = 'ACTIVE'
    and portal_user_id is not null;

create index fanbus_registration_idempotency_trip_created_idx
  on app_private.fanbus_registration_idempotency(trip_id, created_at desc);

create trigger fanbus_trips_set_updated_at
before update on app_modules.fanbus_trips
for each row execute function app_private.set_updated_at();

create trigger fanbus_registrations_set_updated_at
before update on app_modules.fanbus_registrations
for each row execute function app_private.set_updated_at();

alter table app_modules.fanbus_trips enable row level security;
alter table app_modules.fanbus_registrations enable row level security;
alter table app_private.fanbus_registration_idempotency enable row level security;

revoke all on table
  app_modules.fanbus_trips,
  app_modules.fanbus_registrations,
  app_private.fanbus_registration_idempotency
from public, anon, authenticated;

insert into app_portal.capabilities (
  code,
  name,
  category,
  description,
  sort_order
)
values
  (
    'fanbus.manage',
    'Fanbusfahrten verwalten',
    'Fanbus',
    'Fanbusfahrten anlegen, bearbeiten, veroeffentlichen und schliessen.',
    180
  ),
  (
    'fanbus.registrations.manage',
    'Fanbus-Anmeldungen verwalten',
    'Fanbus',
    'Personenbezogene Fanbus-Anmeldungen einsehen und verwalten.',
    190
  );

create function app_private.fanbus_submit_registration(
  p_trip_id uuid,
  p_portal_user_id uuid,
  p_guest_first_name text,
  p_guest_last_name text,
  p_guest_email text,
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
declare
  v_guest_first_name text := app_private.clean_name(p_guest_first_name);
  v_guest_last_name text := app_private.clean_name(p_guest_last_name);
  v_guest_email text := btrim(coalesce(p_guest_email, ''));
  v_bus_preference text := upper(btrim(coalesce(p_bus_preference, '')));
  v_canonical_request jsonb;
  v_request_hash text;
  v_lock_key bigint;
  v_idempotency app_private.fanbus_registration_idempotency%rowtype;
  v_event_visibility text;
  v_trip_status text;
  v_departure_at timestamptz;
  v_departure_info text;
  v_registration_opens_at timestamptz;
  v_registration_closes_at timestamptz;
  v_price_cents integer;
  v_capacity integer;
  v_privacy_reference text;
  v_terms_reference text;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_registration_id uuid;
  v_active_count integer;
  v_now timestamptz;
  v_outcome text;
begin
  if p_idempotency_key is null then
    raise exception 'FANBUS_IDEMPOTENCY_KEY_REQUIRED'
      using errcode = '22023';
  end if;

  v_canonical_request := jsonb_build_object(
    'tripId', p_trip_id,
    'portalUserId', p_portal_user_id,
    'guestFirstName', case
      when p_portal_user_id is null then v_guest_first_name
      else null
    end,
    'guestLastName', case
      when p_portal_user_id is null then v_guest_last_name
      else null
    end,
    'guestEmail', case
      when p_portal_user_id is null then lower(v_guest_email)
      else null
    end,
    'busPreference', v_bus_preference,
    'privacyConfirmed', p_privacy_confirmed,
    'termsConfirmed', p_terms_confirmed
  );

  v_request_hash := encode(
    extensions.digest(v_canonical_request::text, 'sha256'),
    'hex'
  );

  v_lock_key := (
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

  perform pg_catalog.pg_advisory_xact_lock(v_lock_key);

  select idempotency.*
  into v_idempotency
  from app_private.fanbus_registration_idempotency as idempotency
  where idempotency.idempotency_key = p_idempotency_key;

  if found then
    if v_idempotency.request_hash <> v_request_hash then
      raise exception 'FANBUS_IDEMPOTENCY_KEY_REUSED'
        using errcode = '22023';
    end if;

    return jsonb_build_object(
      'outcome', v_idempotency.outcome,
      'registrationId', v_idempotency.registration_id
    );
  end if;

  if p_trip_id is null then
    raise exception 'FANBUS_TRIP_ID_REQUIRED'
      using errcode = '22023';
  end if;

  if v_bus_preference not in ('RUHIG', 'PARTY', 'EGAL') then
    raise exception 'FANBUS_BUS_PREFERENCE_INVALID'
      using errcode = '22023';
  end if;

  if p_privacy_confirmed is distinct from true
     or p_terms_confirmed is distinct from true then
    raise exception 'FANBUS_CONSENT_REQUIRED'
      using errcode = '22023';
  end if;

  select
    trip.status,
    trip.departure_at,
    trip.departure_info,
    trip.registration_opens_at,
    trip.registration_closes_at,
    trip.price_cents,
    trip.capacity,
    trip.privacy_reference,
    trip.terms_reference,
    event.visibility
  into
    v_trip_status,
    v_departure_at,
    v_departure_info,
    v_registration_opens_at,
    v_registration_closes_at,
    v_price_cents,
    v_capacity,
    v_privacy_reference,
    v_terms_reference,
    v_event_visibility
  from app_modules.fanbus_trips as trip
  left join app_modules.events as event
    on event.id = trip.event_id
  where trip.id = p_trip_id
  for update of trip;

  if not found then
    raise exception 'FANBUS_TRIP_UNAVAILABLE'
      using errcode = 'P0002';
  end if;

  v_now := clock_timestamp();

  if v_trip_status = 'CLOSED' then
    v_outcome := 'CLOSED';
  elsif v_trip_status <> 'PUBLISHED'
     or v_departure_at is null
     or v_departure_info is null
     or length(btrim(v_departure_info)) = 0
     or v_registration_opens_at is null
     or v_registration_closes_at is null
     or v_price_cents is null
     or v_capacity is null
     or v_privacy_reference is null
     or length(btrim(v_privacy_reference)) = 0
     or v_terms_reference is null
     or length(btrim(v_terms_reference)) = 0
     or v_event_visibility is distinct from 'PUBLIC' then
    v_outcome := 'UNAVAILABLE';
  elsif v_now < v_registration_opens_at then
    v_outcome := 'NOT_STARTED';
  elsif v_now >= v_registration_closes_at then
    v_outcome := 'CLOSED';
  end if;

  if v_outcome is not null then
    insert into app_private.fanbus_registration_idempotency (
      idempotency_key,
      request_hash,
      trip_id,
      registration_id,
      outcome
    ) values (
      p_idempotency_key,
      v_request_hash,
      p_trip_id,
      null,
      v_outcome
    );

    return jsonb_build_object(
      'outcome', v_outcome,
      'registrationId', null
    );
  end if;

  if p_portal_user_id is not null then
    select
      portal_user.first_name,
      portal_user.last_name,
      btrim(portal_user.email)
    into
      v_first_name,
      v_last_name,
      v_email
    from app_portal.users as portal_user
    where portal_user.id = p_portal_user_id
      and portal_user.status = 'ACTIVE';

    if not found then
      raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE'
        using errcode = '22023';
    end if;
  else
    v_first_name := app_private.require_valid_name(
      v_guest_first_name,
      'Vorname'
    );
    v_last_name := app_private.require_valid_name(
      v_guest_last_name,
      'Nachname'
    );
    v_email := v_guest_email;

    if length(v_email) not between 3 and 320
       or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'FANBUS_EMAIL_INVALID'
        using errcode = '22023';
    end if;
  end if;

  select registration.id
  into v_registration_id
  from app_modules.fanbus_registrations as registration
  where registration.trip_id = p_trip_id
    and registration.status = 'ACTIVE'
    and (
      (
        p_portal_user_id is not null
        and registration.portal_user_id = p_portal_user_id
      )
      or lower(btrim(registration.email)) = lower(btrim(v_email))
    )
  order by
    case
      when p_portal_user_id is not null
       and registration.portal_user_id = p_portal_user_id then 0
      else 1
    end,
    registration.registered_at,
    registration.id
  limit 1;

  if v_registration_id is not null then
    insert into app_private.fanbus_registration_idempotency (
      idempotency_key,
      request_hash,
      trip_id,
      registration_id,
      outcome
    ) values (
      p_idempotency_key,
      v_request_hash,
      p_trip_id,
      v_registration_id,
      'ALREADY_ACTIVE'
    );

    return jsonb_build_object(
      'outcome', 'ALREADY_ACTIVE',
      'registrationId', v_registration_id
    );
  end if;

  select count(*)::integer
  into v_active_count
  from app_modules.fanbus_registrations as registration
  where registration.trip_id = p_trip_id
    and registration.status = 'ACTIVE';

  if v_active_count >= v_capacity then
    insert into app_private.fanbus_registration_idempotency (
      idempotency_key,
      request_hash,
      trip_id,
      registration_id,
      outcome
    ) values (
      p_idempotency_key,
      v_request_hash,
      p_trip_id,
      null,
      'FULL'
    );

    return jsonb_build_object(
      'outcome', 'FULL',
      'registrationId', null
    );
  end if;

  insert into app_modules.fanbus_registrations (
    trip_id,
    portal_user_id,
    first_name,
    last_name,
    email,
    bus_preference,
    status,
    privacy_reference,
    terms_reference,
    privacy_accepted_at,
    terms_accepted_at,
    registered_at,
    created_by,
    updated_by
  ) values (
    p_trip_id,
    p_portal_user_id,
    v_first_name,
    v_last_name,
    v_email,
    v_bus_preference,
    'ACTIVE',
    v_privacy_reference,
    v_terms_reference,
    v_now,
    v_now,
    v_now,
    p_portal_user_id,
    p_portal_user_id
  )
  returning id into v_registration_id;

  insert into app_private.fanbus_registration_idempotency (
    idempotency_key,
    request_hash,
    trip_id,
    registration_id,
    outcome
  ) values (
    p_idempotency_key,
    v_request_hash,
    p_trip_id,
    v_registration_id,
    'CREATED'
  );

  perform app_private.log_audit(
    p_portal_user_id,
    'FANBUS_REGISTRATION_CREATED',
    'fanbus_registration',
    v_registration_id::text,
    null,
    null,
    jsonb_build_object(
      'tripId', p_trip_id,
      'status', 'ACTIVE',
      'busPreference', v_bus_preference,
      'source', case
        when p_portal_user_id is null then 'GUEST'
        else 'PORTAL'
      end
    )
  );

  return jsonb_build_object(
    'outcome', 'CREATED',
    'registrationId', v_registration_id
  );
end;
$$;

revoke all on function app_private.fanbus_submit_registration(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  uuid
)
from public, anon, authenticated;
