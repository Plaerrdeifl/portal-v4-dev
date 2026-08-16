-- Plärrdeifl Digitalplattform V4
-- P800 U5.1: structured boarding stops supersede legacy departure_info.
-- The legacy column/output remains for compatibility, but it is no longer
-- required for publishing, availability or registration.

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
    'capacity', capacity.effective_capacity,
    'activeRegistrationCount', registration.active_count,
    'waitlistedRegistrationCount', registration.waitlisted_count,
    'remainingCapacity', greatest(capacity.effective_capacity - registration.active_count, 0),
    'registrationStatus', case
      when v_now < trip.registration_opens_at then 'NOT_STARTED'
      when v_now >= trip.registration_closes_at
        or v_now >= trip.departure_at then 'CLOSED'
      when registration.waitlisted_count > 0
        or registration.active_count >= capacity.effective_capacity then 'WAITLIST'
      else 'OPEN'
    end,
    'privacyReference', trip.privacy_reference,
    'termsReference', trip.terms_reference
  ) into v_result
  from app_modules.fanbus_trips as trip
  join app_modules.events as event on event.id = trip.event_id
  left join app_modules.event_games as game on game.event_id = event.id
  cross join lateral (
    select app_private.fanbus_effective_capacity(trip.id) as effective_capacity
  ) as capacity
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
    and trip.registration_opens_at is not null
    and trip.registration_closes_at is not null
    and trip.registration_closes_at > trip.registration_opens_at
    and trip.registration_closes_at <= trip.departure_at
    and trip.price_cents is not null and trip.price_cents >= 0
    and capacity.effective_capacity > 0
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
          'capacity', capacity.effective_capacity,
          'activeRegistrationCount', registration.active_count,
          'waitlistedRegistrationCount', registration.waitlisted_count,
          'remainingCapacity', greatest(
            capacity.effective_capacity - registration.active_count, 0
          ),
          'registrationStatus', case
            when v_now < trip.registration_opens_at then 'NOT_STARTED'
            when v_now >= trip.registration_closes_at
              or v_now >= trip.departure_at then 'CLOSED'
            when registration.waitlisted_count > 0
              or registration.active_count >= capacity.effective_capacity then 'WAITLIST'
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
        select app_private.fanbus_effective_capacity(trip.id) as effective_capacity
      ) as capacity
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
        and trip.registration_opens_at is not null
        and trip.registration_closes_at is not null
        and trip.registration_closes_at > trip.registration_opens_at
        and trip.registration_closes_at <= trip.departure_at
        and trip.price_cents is not null and trip.price_cents >= 0
        and capacity.effective_capacity > 0
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
          'capacity', capacity.effective_capacity,
          'privacyReference', trip.privacy_reference,
          'termsReference', trip.terms_reference,
          'status', trip.status,
          'revision', trip.revision,
          'activeRegistrationCount', registration.active_count,
          'waitlistedRegistrationCount', registration.waitlisted_count,
          'remainingCapacity', greatest(
            coalesce(capacity.effective_capacity, 0) - registration.active_count, 0
          ),
          'registrationStatus', case
            when trip.status = 'CLOSED' then 'CLOSED'
            when trip.status <> 'PUBLISHED'
              or trip.departure_at is null
              or trip.registration_opens_at is null
              or trip.registration_closes_at is null
              or trip.price_cents is null
              or capacity.effective_capacity <= 0
              or nullif(btrim(trip.privacy_reference), '') is null
              or nullif(btrim(trip.terms_reference), '') is null
              or event.visibility <> 'PUBLIC'
              then 'UNAVAILABLE'
            when v_now < trip.registration_opens_at then 'NOT_STARTED'
            when v_now >= trip.registration_closes_at
              or v_now >= trip.departure_at then 'CLOSED'
            when registration.waitlisted_count > 0
              or registration.active_count >= capacity.effective_capacity then 'WAITLIST'
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
        select app_private.fanbus_effective_capacity(trip.id) as effective_capacity
      ) as capacity
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

create or replace function app_private.api_fanbus_trip_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_id uuid;
  v_expected_revision integer;
  v_departure_at timestamptz;
  v_departure_info text;
  v_requested_registration_opens_at timestamptz;
  v_registration_opens_at timestamptz;
  v_registration_closes_at timestamptz;
  v_price_cents integer;
  v_effective_capacity integer;
  v_privacy_reference text;
  v_terms_reference text;
  v_existing app_modules.fanbus_trips%rowtype;
  v_event_visibility text;
  v_event_date date;
  v_event_time time without time zone;
  v_before jsonb;
  v_after jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Fanbusfahrt-Daten sind ungültig.'
      using errcode = '22023';
  end if;

  if not (p_payload ?& array[
       'id', 'expectedRevision', 'departureAt', 'departureInfo',
       'registrationClosesAt', 'priceCents',
       'privacyReference', 'termsReference'
     ])
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array[
         'id', 'expectedRevision', 'departureAt', 'departureInfo',
         'registrationOpensAt', 'registrationClosesAt', 'priceCents',
         'capacity', 'privacyReference', 'termsReference'
       ])
     ) then
    raise exception 'Die Fanbusfahrt-Daten enthalten unzulässige Felder.'
      using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision := nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
    v_departure_at := nullif(btrim(coalesce(p_payload ->> 'departureAt', '')), '')::timestamptz;
    v_departure_info := nullif(btrim(coalesce(p_payload ->> 'departureInfo', '')), '');
    v_requested_registration_opens_at := case
      when p_payload ? 'registrationOpensAt' then
        nullif(btrim(coalesce(p_payload ->> 'registrationOpensAt', '')), '')::timestamptz
      else null
    end;
    v_registration_closes_at := nullif(btrim(coalesce(p_payload ->> 'registrationClosesAt', '')), '')::timestamptz;
    v_price_cents := nullif(btrim(coalesce(p_payload ->> 'priceCents', '')), '')::integer;
    v_privacy_reference := nullif(btrim(coalesce(p_payload ->> 'privacyReference', '')), '');
    v_terms_reference := nullif(btrim(coalesce(p_payload ->> 'termsReference', '')), '');
  exception
    when others then
      raise exception 'Die Fanbusfahrt-Daten haben ein ungültiges Format.'
        using errcode = '22023';
  end;

  if v_id is null or v_expected_revision is null then
    raise exception 'Fanbusfahrt-ID und erwartete Revision sind erforderlich.'
      using errcode = '22023';
  end if;

  if v_price_cents is not null and v_price_cents < 0 then
    raise exception 'Der Fahrtpreis darf nicht negativ sein.' using errcode = '22023';
  end if;
  select * into v_existing
  from app_modules.fanbus_trips
  where id = v_id
  for update;

  if not found then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_expected_revision <> v_existing.revision then
    raise exception 'Die Fanbusfahrt wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;
  if v_existing.status = 'CLOSED' then
    raise exception 'Eine geschlossene Fanbusfahrt kann nicht mehr bearbeitet werden.'
      using errcode = '22023';
  end if;

  -- Veröffentlichte Fahrten behalten ihren vom Server gesetzten Öffnungszeitpunkt.
  v_registration_opens_at := case
    when v_existing.status = 'PUBLISHED' then v_existing.registration_opens_at
    when p_payload ? 'registrationOpensAt' then v_requested_registration_opens_at
    else v_existing.registration_opens_at
  end;

  if v_registration_opens_at is not null
     and v_registration_closes_at is not null
     and v_registration_closes_at <= v_registration_opens_at then
    raise exception 'Das Anmeldeende muss nach dem Anmeldestart liegen.'
      using errcode = '22023';
  end if;

  v_effective_capacity := app_private.fanbus_effective_capacity(v_id);

  select event.visibility, event.event_date, event.event_time
  into v_event_visibility, v_event_date, v_event_time
  from app_modules.events as event
  where event.id = v_existing.event_id;
  if not found then
    raise exception 'Der zugehörige Termin wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_existing.status = 'PUBLISHED' then
    if v_event_visibility <> 'PUBLIC' or v_departure_at is null
       or v_registration_opens_at is null or v_registration_closes_at is null
       or v_price_cents is null or v_effective_capacity <= 0 or v_privacy_reference is null
       or v_terms_reference is null then
      raise exception 'Eine veröffentlichte Fanbusfahrt muss vollständig und öffentlich verfügbar bleiben.'
        using errcode = '22023';
    end if;
    if v_registration_closes_at > v_departure_at
       or (v_departure_at at time zone 'Europe/Berlin')::date > v_event_date
       or (v_event_time is not null and (v_departure_at at time zone 'Europe/Berlin') > (v_event_date + v_event_time)) then
      raise exception 'Abfahrt und Anmeldezeitraum sind zeitlich nicht plausibel.'
        using errcode = '22023';
    end if;
  end if;

  v_before := jsonb_build_object(
    'eventId', v_existing.event_id, 'departureAt', v_existing.departure_at,
    'departureInfo', v_existing.departure_info, 'registrationOpensAt', v_existing.registration_opens_at,
    'registrationClosesAt', v_existing.registration_closes_at, 'priceCents', v_existing.price_cents,
    'effectiveCapacity', v_effective_capacity, 'privacyReference', v_existing.privacy_reference,
    'termsReference', v_existing.terms_reference, 'status', v_existing.status, 'revision', v_existing.revision
  );

  update app_modules.fanbus_trips
  set departure_at = v_departure_at, departure_info = v_departure_info,
      registration_opens_at = v_registration_opens_at,
      registration_closes_at = v_registration_closes_at, price_cents = v_price_cents,
      privacy_reference = v_privacy_reference,
      terms_reference = v_terms_reference, revision = revision + 1, updated_by = v_actor
  where id = v_id
  returning jsonb_build_object(
    'eventId', event_id, 'departureAt', departure_at, 'departureInfo', departure_info,
    'registrationOpensAt', registration_opens_at, 'registrationClosesAt', registration_closes_at,
    'priceCents', price_cents, 'effectiveCapacity', v_effective_capacity,
    'privacyReference', privacy_reference,
    'termsReference', terms_reference, 'status', status, 'revision', revision
  ) into v_after;

  perform app_private.log_audit(v_actor, 'FANBUS_TRIP_UPDATED', 'fanbus_trip', v_id::text,
    v_before, v_after, jsonb_build_object('eventId', v_existing.event_id));
  return app_private.api_fanbus_trips_list();
end;
$$;

create or replace function app_private.api_fanbus_trip_publish(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_id uuid;
  v_expected_revision integer;
  v_existing app_modules.fanbus_trips%rowtype;
  v_event_visibility text;
  v_event_date date;
  v_event_time time without time zone;
  v_published_at timestamptz;
  v_effective_capacity integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Publikationsdaten sind ungültig.' using errcode = '22023';
  end if;
  if not (p_payload ?& array['id', 'expectedRevision']) or exists (
    select 1 from jsonb_object_keys(p_payload) as payload_key(key)
    where payload_key.key <> all(array['id', 'expectedRevision'])
  ) then
    raise exception 'Für die Veröffentlichung sind ausschließlich id und expectedRevision zulässig.'
      using errcode = '22023';
  end if;
  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision := nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  exception when others then
    raise exception 'Die Publikationsdaten haben ein ungültiges Format.' using errcode = '22023';
  end;
  if v_id is null or v_expected_revision is null then
    raise exception 'Fanbusfahrt-ID und erwartete Revision sind erforderlich.' using errcode = '22023';
  end if;

  select * into v_existing from app_modules.fanbus_trips where id = v_id for update;
  if not found then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  v_effective_capacity := app_private.fanbus_effective_capacity(v_id);
  if v_expected_revision <> v_existing.revision then
    raise exception 'Die Fanbusfahrt wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;
  if v_existing.status <> 'DRAFT' then
    raise exception 'Nur ein Entwurf kann veröffentlicht werden.' using errcode = '22023';
  end if;

  select event.visibility, event.event_date, event.event_time
  into v_event_visibility, v_event_date, v_event_time
  from app_modules.events as event where event.id = v_existing.event_id;
  if not found then
    raise exception 'Der zugehörige Termin wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_event_visibility <> 'PUBLIC' then
    raise exception 'Der zugehörige Termin muss öffentlich sichtbar sein.' using errcode = '22023';
  end if;
  if v_existing.departure_at is null or v_existing.registration_closes_at is null
     or v_existing.price_cents is null or v_existing.price_cents < 0
     or v_effective_capacity <= 0
     or v_existing.privacy_reference is null or length(btrim(v_existing.privacy_reference)) = 0
     or v_existing.terms_reference is null or length(btrim(v_existing.terms_reference)) = 0 then
    raise exception 'Die Fanbusfahrt ist für die Veröffentlichung unvollständig.' using errcode = '22023';
  end if;

  v_published_at := clock_timestamp();

  if v_existing.registration_closes_at <= v_published_at then
    raise exception 'Das Anmeldeende muss nach dem Anmeldestart liegen.' using errcode = '22023';
  end if;
  if v_existing.departure_at <= v_published_at or v_existing.registration_closes_at > v_existing.departure_at
     or (v_existing.departure_at at time zone 'Europe/Berlin')::date > v_event_date
     or (v_event_time is not null and (v_existing.departure_at at time zone 'Europe/Berlin') > (v_event_date + v_event_time)) then
    raise exception 'Abfahrt und Anmeldezeitraum sind zeitlich nicht plausibel.' using errcode = '22023';
  end if;

  update app_modules.fanbus_trips
  set status = 'PUBLISHED', registration_opens_at = v_published_at,
      revision = revision + 1, updated_by = v_actor
  where id = v_id;

  perform app_private.log_audit(
    v_actor, 'FANBUS_TRIP_PUBLISHED', 'fanbus_trip', v_id::text,
    jsonb_build_object('eventId', v_existing.event_id, 'status', v_existing.status, 'revision', v_existing.revision),
    jsonb_build_object('eventId', v_existing.event_id, 'status', 'PUBLISHED',
      'registrationOpensAt', v_published_at, 'revision', v_existing.revision + 1)
  );
  return app_private.api_fanbus_trips_list();
end;
$$;

create or replace function app_private.fanbus_submit_booking_core(
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
  v_effective_capacity integer;
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
  v_effective_capacity := app_private.fanbus_effective_capacity(p_trip_id);
  select visibility into v_event_visibility
  from app_modules.events where id = v_trip.event_id;
  v_now := clock_timestamp();

  if v_trip.status = 'CLOSED' then
    v_outcome := 'CLOSED';
  elsif v_trip.status <> 'PUBLISHED'
     or v_event_visibility is distinct from 'PUBLIC'
     or v_trip.departure_at is null
     or v_trip.registration_opens_at is null
     or v_trip.registration_closes_at is null
     or v_trip.price_cents is null
     or v_effective_capacity <= 0
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
  ) or v_active_count + v_count > v_effective_capacity then
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
