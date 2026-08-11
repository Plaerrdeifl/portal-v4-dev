-- Plaerrdeifl Digitalplattform V4
-- P300 / M310-R1: Manuelle Fanbus-Mitfahrer

alter table app_modules.fanbus_registrations
  add column source text;

update app_modules.fanbus_registrations
set source = case
  when portal_user_id is not null then 'PORTAL'
  else 'GUEST'
end;

alter table app_modules.fanbus_registrations
  alter column source set not null,
  add constraint fanbus_registrations_source_check
    check (source in ('PORTAL', 'GUEST', 'MANUAL')),
  add column member_id uuid
    references app_fanclub.members(id) on delete set null;

update app_modules.fanbus_registrations as registration
set member_id = link.member_id
from app_portal.user_member_links as link
where link.user_id = registration.portal_user_id
  and registration.member_id is null;

alter table app_modules.fanbus_registrations
  drop constraint fanbus_registrations_email_check,
  alter column email drop not null,
  add constraint fanbus_registrations_email_check
    check (
      (
        source in ('PORTAL', 'GUEST')
        and email is not null
        and length(btrim(email)) between 3 and 320
        and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
      or (
        source = 'MANUAL'
        and (
          email is null
          or (
            length(btrim(email)) between 3 and 320
            and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
          )
        )
      )
    ) not valid;

alter table app_modules.fanbus_registrations
  validate constraint fanbus_registrations_email_check;

create index fanbus_registrations_member_idx
  on app_modules.fanbus_registrations(member_id)
  where member_id is not null;

create unique index fanbus_registrations_active_member_uidx
  on app_modules.fanbus_registrations(trip_id, member_id)
  where status = 'ACTIVE'
    and member_id is not null;

create unique index fanbus_registrations_active_manual_name_uidx
  on app_modules.fanbus_registrations(
    trip_id,
    lower(btrim(first_name)),
    lower(btrim(last_name))
  )
  where status = 'ACTIVE'
    and source = 'MANUAL'
    and member_id is null
    and portal_user_id is null
    and email is null;

create function app_private.fanbus_submit_registration_core(
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
declare
  v_source text := upper(btrim(coalesce(p_source, '')));
  v_input_first_name text := app_private.clean_name(p_first_name);
  v_input_last_name text := app_private.clean_name(p_last_name);
  v_input_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
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
  v_member_id uuid;
  v_portal_user_id uuid;
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

  if v_source not in ('PORTAL', 'GUEST', 'MANUAL') then
    raise exception 'FANBUS_SOURCE_INVALID'
      using errcode = '22023';
  end if;

  if v_source = 'MANUAL'
     and (
       p_actor is null
       or not app_private.has_capability(
         p_actor,
         'fanbus.registrations.manage'
       )
     ) then
    raise exception 'Die Berechtigung fanbus.registrations.manage ist erforderlich.'
      using errcode = '42501';
  end if;

  if v_source = 'MANUAL' then
    v_canonical_request := jsonb_build_object(
      'tripId', p_trip_id,
      'source', v_source,
      'actor', p_actor,
      'memberId', p_member_id,
      'portalUserId', p_portal_user_id,
      'firstName', case
        when p_member_id is null and p_portal_user_id is null
          then v_input_first_name
        else null
      end,
      'lastName', case
        when p_member_id is null and p_portal_user_id is null
          then v_input_last_name
        else null
      end,
      'email', case
        when p_member_id is null and p_portal_user_id is null
          then v_input_email
        else null
      end,
      'busPreference', v_bus_preference,
      'privacyConfirmed', p_privacy_confirmed,
      'termsConfirmed', p_terms_confirmed
    );
  else
    v_canonical_request := jsonb_build_object(
      'tripId', p_trip_id,
      'portalUserId', p_portal_user_id,
      'guestFirstName', case
        when p_portal_user_id is null then v_input_first_name
        else null
      end,
      'guestLastName', case
        when p_portal_user_id is null then v_input_last_name
        else null
      end,
      'guestEmail', case
        when p_portal_user_id is null then v_input_email
        else null
      end,
      'busPreference', v_bus_preference,
      'privacyConfirmed', p_privacy_confirmed,
      'termsConfirmed', p_terms_confirmed
    );
  end if;

  v_request_hash := encode(
    extensions.digest(v_canonical_request::text, 'sha256'),
    'hex'
  );

  v_lock_key := (
    'x' || substr(
      encode(
        extensions.digest(
          'app_private.fanbus_submit_registration:'
            || p_idempotency_key::text,
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

  if v_source = 'PORTAL' then
    if p_portal_user_id is null
       or p_member_id is not null
       or p_first_name is not null
       or p_last_name is not null
       or p_email is not null then
      raise exception 'FANBUS_PORTAL_SUBJECT_INVALID'
        using errcode = '22023';
    end if;

    select
      portal_user.id,
      link.member_id,
      portal_user.first_name,
      portal_user.last_name,
      lower(btrim(portal_user.email))
    into
      v_portal_user_id,
      v_member_id,
      v_first_name,
      v_last_name,
      v_email
    from app_portal.users as portal_user
    left join app_portal.user_member_links as link
      on link.user_id = portal_user.id
    where portal_user.id = p_portal_user_id
      and portal_user.status = 'ACTIVE';

    if not found then
      raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE'
        using errcode = '22023';
    end if;
  elsif v_source = 'GUEST' then
    if p_actor is not null
       or p_member_id is not null
       or p_portal_user_id is not null then
      raise exception 'FANBUS_GUEST_SUBJECT_INVALID'
        using errcode = '22023';
    end if;

    v_first_name := app_private.require_valid_name(
      v_input_first_name,
      'Vorname'
    );
    v_last_name := app_private.require_valid_name(
      v_input_last_name,
      'Nachname'
    );
    v_email := v_input_email;
  elsif p_member_id is not null then
    if p_portal_user_id is not null
       or p_first_name is not null
       or p_last_name is not null
       or p_email is not null then
      raise exception 'FANBUS_MANUAL_MEMBER_SUBJECT_INVALID'
        using errcode = '22023';
    end if;

    select
      member.id,
      portal_user.id,
      member.first_name,
      member.last_name,
      case
        when nullif(lower(btrim(member.email)), '')
          ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
          then nullif(lower(btrim(member.email)), '')
        when nullif(lower(btrim(portal_user.email)), '')
          ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
          then nullif(lower(btrim(portal_user.email)), '')
        else null
      end
    into
      v_member_id,
      v_portal_user_id,
      v_first_name,
      v_last_name,
      v_email
    from app_fanclub.members as member
    left join app_portal.user_member_links as link
      on link.member_id = member.id
    left join app_portal.users as portal_user
      on portal_user.id = link.user_id
     and portal_user.status = 'ACTIVE'
    where member.id = p_member_id
      and member.status = 'ACTIVE';

    if not found then
      raise exception 'FANBUS_MEMBER_UNAVAILABLE'
        using errcode = '22023';
    end if;
  elsif p_portal_user_id is not null then
    if p_first_name is not null
       or p_last_name is not null
       or p_email is not null then
      raise exception 'FANBUS_MANUAL_PORTAL_SUBJECT_INVALID'
        using errcode = '22023';
    end if;

    select
      member.id,
      portal_user.id,
      portal_user.first_name,
      portal_user.last_name,
      case
        when lower(btrim(portal_user.email))
          ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
          then lower(btrim(portal_user.email))
        else null
      end
    into
      v_member_id,
      v_portal_user_id,
      v_first_name,
      v_last_name,
      v_email
    from app_portal.users as portal_user
    left join app_portal.user_member_links as link
      on link.user_id = portal_user.id
    left join app_fanclub.members as member
      on member.id = link.member_id
     and member.status = 'ACTIVE'
    where portal_user.id = p_portal_user_id
      and portal_user.status = 'ACTIVE';

    if not found then
      raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE'
        using errcode = '22023';
    end if;
  else
    v_first_name := app_private.require_valid_name(
      v_input_first_name,
      'Vorname'
    );
    v_last_name := app_private.require_valid_name(
      v_input_last_name,
      'Nachname'
    );
    v_email := v_input_email;
  end if;

  if v_source in ('PORTAL', 'GUEST')
     and (
       v_email is null
       or length(v_email) not between 3 and 320
       or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     ) then
    raise exception 'FANBUS_EMAIL_INVALID'
      using errcode = '22023';
  end if;

  if v_source = 'MANUAL'
     and v_email is not null
     and (
       length(v_email) not between 3 and 320
       or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     ) then
    raise exception 'FANBUS_EMAIL_INVALID'
      using errcode = '22023';
  end if;

  select registration.id
  into v_registration_id
  from app_modules.fanbus_registrations as registration
  where registration.trip_id = p_trip_id
    and registration.status = 'ACTIVE'
    and (
      (
        v_member_id is not null
        and registration.member_id = v_member_id
      )
      or (
        v_portal_user_id is not null
        and registration.portal_user_id = v_portal_user_id
      )
      or (
        v_email is not null
        and lower(btrim(registration.email)) = v_email
      )
      or (
        v_source = 'MANUAL'
        and v_member_id is null
        and v_portal_user_id is null
        and v_email is null
        and registration.member_id is null
        and registration.portal_user_id is null
        and registration.email is null
        and lower(btrim(registration.first_name))
          = lower(btrim(v_first_name))
        and lower(btrim(registration.last_name))
          = lower(btrim(v_last_name))
      )
    )
  order by
    case
      when v_member_id is not null
       and registration.member_id = v_member_id then 0
      when v_portal_user_id is not null
       and registration.portal_user_id = v_portal_user_id then 1
      when v_email is not null
       and lower(btrim(registration.email)) = v_email then 2
      else 3
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
    source,
    member_id,
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
    v_source,
    v_member_id,
    v_portal_user_id,
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
    p_actor,
    p_actor
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
    p_actor,
    'FANBUS_REGISTRATION_CREATED',
    'fanbus_registration',
    v_registration_id::text,
    null,
    null,
    jsonb_build_object(
      'tripId', p_trip_id,
      'status', 'ACTIVE',
      'busPreference', v_bus_preference,
      'source', v_source
    )
  );

  return jsonb_build_object(
    'outcome', 'CREATED',
    'registrationId', v_registration_id
  );
end;
$$;

create or replace function app_private.fanbus_submit_registration(
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
language sql
security definer
set search_path = ''
as $$
  select app_private.fanbus_submit_registration_core(
    p_trip_id,
    case when p_portal_user_id is null then 'GUEST' else 'PORTAL' end,
    p_portal_user_id,
    null,
    p_portal_user_id,
    p_guest_first_name,
    p_guest_last_name,
    p_guest_email,
    p_bus_preference,
    p_privacy_confirmed,
    p_terms_confirmed,
    p_idempotency_key
  );
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
  v_actor uuid := app_private.require_capability(
    'fanbus.registrations.manage'
  );
  v_trip_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Teilnehmerabfrage ist ungültig.'
      using errcode = '22023';
  end if;

  if not (p_payload ?& array['tripId'])
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'tripId'
     ) then
    raise exception 'Für die Teilnehmerliste ist ausschließlich tripId zulässig.'
      using errcode = '22023';
  end if;

  begin
    v_trip_id := nullif(btrim(coalesce(p_payload ->> 'tripId', '')), '')::uuid;
  exception
    when others then
      raise exception 'Die Fanbusfahrt-ID ist ungültig.'
        using errcode = '22023';
  end;

  if v_trip_id is null then
    raise exception 'Die Fanbusfahrt-ID ist erforderlich.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from app_modules.fanbus_trips as trip
    where trip.id = v_trip_id
  ) then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'tripId', v_trip_id,
    'registrations',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', registration.id,
          'tripId', registration.trip_id,
          'memberId', registration.member_id,
          'portalUserId', registration.portal_user_id,
          'firstName', registration.first_name,
          'lastName', registration.last_name,
          'email', registration.email,
          'busPreference', registration.bus_preference,
          'status', registration.status,
          'registeredAt', registration.registered_at,
          'cancelledAt', registration.cancelled_at,
          'revision', registration.revision,
          'source', registration.source
        )
        order by
          case registration.status when 'ACTIVE' then 0 else 1 end,
          registration.registered_at,
          registration.id
      )
      from app_modules.fanbus_registrations as registration
      where registration.trip_id = v_trip_id
    ), '[]'::jsonb)
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
  v_actor uuid := app_private.require_capability(
    'fanbus.registrations.manage'
  );
  v_id uuid;
  v_expected_revision integer;
  v_existing app_modules.fanbus_registrations%rowtype;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Stornierungsdaten sind ungültig.'
      using errcode = '22023';
  end if;

  if not (p_payload ?& array['id', 'expectedRevision'])
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['id', 'expectedRevision'])
     ) then
    raise exception 'Für die Stornierung sind ausschließlich id und expectedRevision zulässig.'
      using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision :=
      nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  exception
    when others then
      raise exception 'Die Stornierungsdaten haben ein ungültiges Format.'
        using errcode = '22023';
  end;

  if v_id is null or v_expected_revision is null then
    raise exception 'Anmeldungs-ID und erwartete Revision sind erforderlich.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_modules.fanbus_registrations
  where id = v_id
  for update;

  if not found then
    raise exception 'Die Fanbus-Anmeldung wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision <> v_existing.revision then
    raise exception
      'Die Fanbus-Anmeldung wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if v_existing.status <> 'ACTIVE' then
    raise exception 'Nur eine aktive Fanbus-Anmeldung kann storniert werden.'
      using errcode = '22023';
  end if;

  update app_modules.fanbus_registrations
  set status = 'CANCELLED',
      cancelled_at = clock_timestamp(),
      revision = revision + 1,
      updated_by = v_actor
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_REGISTRATION_CANCELLED',
    'fanbus_registration',
    v_id::text,
    jsonb_build_object('status', 'ACTIVE'),
    jsonb_build_object('status', 'CANCELLED'),
    jsonb_build_object(
      'tripId', v_existing.trip_id,
      'busPreference', v_existing.bus_preference,
      'source', v_existing.source
    )
  );

  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId', v_existing.trip_id)
  );
end;
$$;

create function app_private.api_fanbus_registration_people_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability(
    'fanbus.registrations.manage'
  );
begin
  return jsonb_build_object(
    'people',
    coalesce((
      with selectable_people as (
        select
          'MEMBER'::text as person_type,
          member.id as member_id,
          portal_user.id as portal_user_id,
          member.first_name,
          member.last_name,
          case
            when nullif(lower(btrim(member.email)), '')
              ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
              then nullif(lower(btrim(member.email)), '')
            when nullif(lower(btrim(portal_user.email)), '')
              ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
              then nullif(lower(btrim(portal_user.email)), '')
            else null
          end as email
        from app_fanclub.members as member
        left join app_portal.user_member_links as link
          on link.member_id = member.id
        left join app_portal.users as portal_user
          on portal_user.id = link.user_id
         and portal_user.status = 'ACTIVE'
        where member.status = 'ACTIVE'

        union all

        select
          'PORTAL_USER'::text as person_type,
          null::uuid as member_id,
          portal_user.id as portal_user_id,
          portal_user.first_name,
          portal_user.last_name,
          nullif(btrim(portal_user.email), '') as email
        from app_portal.users as portal_user
        where portal_user.status = 'ACTIVE'
          and not exists (
            select 1
            from app_portal.user_member_links as link
            join app_fanclub.members as member
              on member.id = link.member_id
             and member.status = 'ACTIVE'
            where link.user_id = portal_user.id
          )
      )
      select jsonb_agg(
        jsonb_build_object(
          'personType', person.person_type,
          'memberId', person.member_id,
          'portalUserId', person.portal_user_id,
          'firstName', person.first_name,
          'lastName', person.last_name,
          'email', person.email
        )
        order by
          lower(person.last_name),
          lower(person.first_name),
          person.member_id nulls last,
          person.portal_user_id
      )
      from selectable_people as person
    ), '[]'::jsonb)
  );
end;
$$;

create function app_private.api_fanbus_registration_create_manual(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability(
    'fanbus.registrations.manage'
  );
  v_mode text;
  v_person_type text;
  v_trip_id uuid;
  v_member_id uuid;
  v_portal_user_id uuid;
  v_idempotency_key uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'FANBUS_MANUAL_REGISTRATION_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  v_mode := upper(btrim(coalesce(p_payload ->> 'mode', '')));
  v_person_type := upper(btrim(coalesce(p_payload ->> 'personType', '')));

  if v_mode = 'PERSON' then
    if not p_payload ?& array[
         'tripId',
         'mode',
         'personType',
         'busPreference',
         'privacyConfirmed',
         'termsConfirmed',
         'idempotencyKey'
       ]
       or (select count(*) from jsonb_object_keys(p_payload)) <> 8
       or (
         v_person_type = 'MEMBER'
         and not p_payload ? 'memberId'
       )
       or (
         v_person_type = 'PORTAL_USER'
         and not p_payload ? 'portalUserId'
       )
       or v_person_type not in ('MEMBER', 'PORTAL_USER') then
      raise exception 'FANBUS_MANUAL_REGISTRATION_INVALID_PAYLOAD'
        using errcode = '22023';
    end if;
  elsif v_mode = 'GUEST' then
    if not p_payload ?& array[
         'tripId',
         'mode',
         'firstName',
         'lastName',
         'email',
         'busPreference',
         'privacyConfirmed',
         'termsConfirmed',
         'idempotencyKey'
       ]
       or (select count(*) from jsonb_object_keys(p_payload)) <> 9
       or jsonb_typeof(p_payload -> 'firstName') <> 'string'
       or jsonb_typeof(p_payload -> 'lastName') <> 'string'
       or jsonb_typeof(p_payload -> 'email') not in ('string', 'null') then
      raise exception 'FANBUS_MANUAL_REGISTRATION_INVALID_PAYLOAD'
        using errcode = '22023';
    end if;
  else
    raise exception 'FANBUS_MANUAL_REGISTRATION_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_payload -> 'tripId') <> 'string'
     or jsonb_typeof(p_payload -> 'mode') <> 'string'
     or jsonb_typeof(p_payload -> 'busPreference') <> 'string'
     or jsonb_typeof(p_payload -> 'privacyConfirmed') <> 'boolean'
     or jsonb_typeof(p_payload -> 'termsConfirmed') <> 'boolean'
     or jsonb_typeof(p_payload -> 'idempotencyKey') <> 'string'
     or (p_payload ->> 'tripId')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (p_payload ->> 'idempotencyKey')
       !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'FANBUS_MANUAL_REGISTRATION_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  begin
    v_trip_id := (p_payload ->> 'tripId')::uuid;
    v_idempotency_key := (p_payload ->> 'idempotencyKey')::uuid;

    if v_person_type = 'MEMBER' then
      v_member_id := (p_payload ->> 'memberId')::uuid;
    elsif v_person_type = 'PORTAL_USER' then
      v_portal_user_id := (p_payload ->> 'portalUserId')::uuid;
    end if;
  exception
    when others then
      raise exception 'FANBUS_MANUAL_REGISTRATION_INVALID_PAYLOAD'
        using errcode = '22023';
  end;

  return app_private.fanbus_submit_registration_core(
    v_trip_id,
    'MANUAL',
    v_actor,
    v_member_id,
    v_portal_user_id,
    case when v_mode = 'GUEST' then p_payload ->> 'firstName' end,
    case when v_mode = 'GUEST' then p_payload ->> 'lastName' end,
    case when v_mode = 'GUEST' then p_payload ->> 'email' end,
    p_payload ->> 'busPreference',
    (p_payload ->> 'privacyConfirmed')::boolean,
    (p_payload ->> 'termsConfirmed')::boolean,
    v_idempotency_key
  );
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_fanbus_manual_m310_r1;

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
    when 'fanbus_registration_people_list' then
      v_data := app_private.api_fanbus_registration_people_list();
    when 'fanbus_registration_create_manual' then
      v_data := app_private.api_fanbus_registration_create_manual(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return public.pd_api_before_fanbus_manual_m310_r1(
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

revoke all on function app_private.fanbus_submit_registration_core(
  uuid,
  text,
  uuid,
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
from public, anon, authenticated, service_role;

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

revoke all on function app_private.api_fanbus_registrations_list(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_fanbus_registration_cancel(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_fanbus_registration_people_list()
from public, anon, authenticated, service_role;

revoke all on function app_private.api_fanbus_registration_create_manual(jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.pd_api_before_fanbus_manual_m310_r1(
  text,
  jsonb
)
from public, anon, authenticated;

revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated;

grant execute on function public.pd_api(text, jsonb)
to authenticated;
