-- Plaerrdeifl Digitalplattform V4
-- P300 / M310-R1 / F1.2: Interne Fanbus-API und Portalverwaltung

create function app_private.api_fanbus_trips_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_can_manage boolean :=
    app_private.has_capability(v_actor, 'fanbus.manage');
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
          'registrationStatus', case
            when trip.status = 'CLOSED' then 'CLOSED'
            when trip.status <> 'PUBLISHED'
              or trip.departure_at is null
              or trip.departure_info is null
              or length(btrim(trip.departure_info)) = 0
              or trip.registration_opens_at is null
              or trip.registration_closes_at is null
              or trip.price_cents is null
              or trip.capacity is null
              or trip.privacy_reference is null
              or length(btrim(trip.privacy_reference)) = 0
              or trip.terms_reference is null
              or length(btrim(trip.terms_reference)) = 0
              or event.visibility <> 'PUBLIC'
              then 'UNAVAILABLE'
            when v_now < trip.registration_opens_at then 'NOT_STARTED'
            when v_now >= trip.registration_closes_at then 'CLOSED'
            when registration.active_count >= trip.capacity then 'FULL'
            else 'OPEN'
          end,
          'canManage', v_can_manage,
          'canManageRegistrations', v_can_manage_registrations
        )
        order by
          event.event_date,
          event.event_time asc nulls first,
          trip.id
      )
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
      where (
        (v_can_manage or v_can_manage_registrations)
        and (
          event.event_date >= v_today
          or trip.status in ('DRAFT', 'PUBLISHED')
        )
      )
      or (
        not v_can_manage
        and not v_can_manage_registrations
        and event.event_date >= v_today
        and trip.status in ('PUBLISHED', 'CLOSED')
      )
    ), '[]'::jsonb)
  );
end;
$$;

create function app_private.api_fanbus_available_events()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
begin
  return jsonb_build_object(
    'events',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event.id,
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
          'visibility', event.visibility
        )
        order by
          event.event_date,
          event.event_time asc nulls first,
          event.id
      )
      from app_modules.events as event
      left join app_modules.event_games as game
        on game.event_id = event.id
      where event.event_date >=
        (now() at time zone 'Europe/Berlin')::date
        and not exists (
          select 1
          from app_modules.fanbus_trips as trip
          where trip.event_id = event.id
        )
    ), '[]'::jsonb)
  );
end;
$$;

create function app_private.api_fanbus_trip_create(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_event_id uuid;
  v_event_date date;
  v_trip_id uuid;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Fanbusfahrt-Daten sind ungültig.'
      using errcode = '22023';
  end if;

  if not (p_payload ?& array['eventId'])
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'eventId'
     ) then
    raise exception 'Für eine neue Fanbusfahrt ist ausschließlich eventId zulässig.'
      using errcode = '22023';
  end if;

  begin
    v_event_id := nullif(btrim(coalesce(p_payload ->> 'eventId', '')), '')::uuid;
  exception
    when others then
      raise exception 'Die Termin-ID ist ungültig.'
        using errcode = '22023';
  end;

  if v_event_id is null then
    raise exception 'Die Termin-ID ist erforderlich.'
      using errcode = '22023';
  end if;

  select event.event_date
  into v_event_date
  from app_modules.events as event
  where event.id = v_event_id;

  if not found then
    raise exception 'Der Termin wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_event_date < (now() at time zone 'Europe/Berlin')::date then
    raise exception 'Für vergangene Termine kann keine Fanbusfahrt angelegt werden.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from app_modules.fanbus_trips as trip
    where trip.event_id = v_event_id
  ) then
    raise exception 'Für diesen Termin besteht bereits eine Fanbusfahrt.'
      using errcode = '23505';
  end if;

  begin
    insert into app_modules.fanbus_trips (
      event_id,
      status,
      created_by,
      updated_by
    ) values (
      v_event_id,
      'DRAFT',
      v_actor,
      v_actor
    )
    returning id into v_trip_id;
  exception
    when unique_violation then
      raise exception 'Für diesen Termin besteht bereits eine Fanbusfahrt.'
        using errcode = '23505';
  end;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_TRIP_CREATED',
    'fanbus_trip',
    v_trip_id::text,
    null,
    null,
    jsonb_build_object(
      'eventId', v_event_id,
      'status', 'DRAFT'
    )
  );

  return app_private.api_fanbus_trips_list();
end;
$$;

create function app_private.api_fanbus_trip_update(p_payload jsonb)
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
  v_registration_opens_at timestamptz;
  v_registration_closes_at timestamptz;
  v_price_cents integer;
  v_capacity integer;
  v_privacy_reference text;
  v_terms_reference text;
  v_existing app_modules.fanbus_trips%rowtype;
  v_event_visibility text;
  v_event_date date;
  v_event_time time without time zone;
  v_active_registration_count integer;
  v_before jsonb;
  v_after jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Fanbusfahrt-Daten sind ungültig.'
      using errcode = '22023';
  end if;

  if not (p_payload ?& array[
       'id',
       'expectedRevision',
       'departureAt',
       'departureInfo',
       'registrationOpensAt',
       'registrationClosesAt',
       'priceCents',
       'capacity',
       'privacyReference',
       'termsReference'
     ])
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array[
         'id',
         'expectedRevision',
         'departureAt',
         'departureInfo',
         'registrationOpensAt',
         'registrationClosesAt',
         'priceCents',
         'capacity',
         'privacyReference',
         'termsReference'
       ])
     ) then
    raise exception 'Die Fanbusfahrt-Daten enthalten unzulässige Felder.'
      using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision :=
      nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
    v_departure_at :=
      nullif(btrim(coalesce(p_payload ->> 'departureAt', '')), '')::timestamptz;
    v_departure_info :=
      nullif(btrim(coalesce(p_payload ->> 'departureInfo', '')), '');
    v_registration_opens_at :=
      nullif(btrim(coalesce(p_payload ->> 'registrationOpensAt', '')), '')::timestamptz;
    v_registration_closes_at :=
      nullif(btrim(coalesce(p_payload ->> 'registrationClosesAt', '')), '')::timestamptz;
    v_price_cents :=
      nullif(btrim(coalesce(p_payload ->> 'priceCents', '')), '')::integer;
    v_capacity :=
      nullif(btrim(coalesce(p_payload ->> 'capacity', '')), '')::integer;
    v_privacy_reference :=
      nullif(btrim(coalesce(p_payload ->> 'privacyReference', '')), '');
    v_terms_reference :=
      nullif(btrim(coalesce(p_payload ->> 'termsReference', '')), '');
  exception
    when others then
      raise exception 'Die Fanbusfahrt-Daten haben ein ungültiges Format.'
        using errcode = '22023';
  end;

  if v_id is null then
    raise exception 'Die Fanbusfahrt-ID ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_expected_revision is null then
    raise exception 'Die erwartete Revision ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_price_cents is not null and v_price_cents < 0 then
    raise exception 'Der Fahrtpreis darf nicht negativ sein.'
      using errcode = '22023';
  end if;

  if v_capacity is not null and v_capacity <= 0 then
    raise exception 'Die Kapazität muss größer als null sein.'
      using errcode = '22023';
  end if;

  if v_registration_opens_at is not null
     and v_registration_closes_at is not null
     and v_registration_closes_at <= v_registration_opens_at then
    raise exception 'Das Anmeldeende muss nach dem Anmeldestart liegen.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_modules.fanbus_trips
  where id = v_id
  for update;

  if not found then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision <> v_existing.revision then
    raise exception
      'Die Fanbusfahrt wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if v_existing.status = 'CLOSED' then
    raise exception 'Eine geschlossene Fanbusfahrt kann nicht mehr bearbeitet werden.'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_active_registration_count
  from app_modules.fanbus_registrations as registration
  where registration.trip_id = v_id
    and registration.status = 'ACTIVE';

  if v_capacity is not null
     and v_capacity < v_active_registration_count then
    raise exception 'Die Kapazität darf nicht unter der Zahl aktiver Anmeldungen liegen.'
      using errcode = '22023';
  end if;

  select event.visibility, event.event_date, event.event_time
  into v_event_visibility, v_event_date, v_event_time
  from app_modules.events as event
  where event.id = v_existing.event_id;

  if not found then
    raise exception 'Der zugehörige Termin wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_existing.status = 'PUBLISHED' then
    if v_event_visibility <> 'PUBLIC'
       or v_departure_at is null
       or v_departure_info is null
       or v_registration_opens_at is null
       or v_registration_closes_at is null
       or v_price_cents is null
       or v_capacity is null
       or v_privacy_reference is null
       or v_terms_reference is null then
      raise exception 'Eine veröffentlichte Fanbusfahrt muss vollständig und öffentlich verfügbar bleiben.'
        using errcode = '22023';
    end if;

    if v_registration_closes_at > v_departure_at
       or (v_departure_at at time zone 'Europe/Berlin')::date > v_event_date
       or (
         v_event_time is not null
         and (v_departure_at at time zone 'Europe/Berlin')
           > (v_event_date + v_event_time)
       ) then
      raise exception 'Abfahrt und Anmeldezeitraum sind zeitlich nicht plausibel.'
        using errcode = '22023';
    end if;
  end if;

  v_before := jsonb_build_object(
    'eventId', v_existing.event_id,
    'departureAt', v_existing.departure_at,
    'departureInfo', v_existing.departure_info,
    'registrationOpensAt', v_existing.registration_opens_at,
    'registrationClosesAt', v_existing.registration_closes_at,
    'priceCents', v_existing.price_cents,
    'capacity', v_existing.capacity,
    'privacyReference', v_existing.privacy_reference,
    'termsReference', v_existing.terms_reference,
    'status', v_existing.status,
    'revision', v_existing.revision
  );

  update app_modules.fanbus_trips
  set departure_at = v_departure_at,
      departure_info = v_departure_info,
      registration_opens_at = v_registration_opens_at,
      registration_closes_at = v_registration_closes_at,
      price_cents = v_price_cents,
      capacity = v_capacity,
      privacy_reference = v_privacy_reference,
      terms_reference = v_terms_reference,
      revision = revision + 1,
      updated_by = v_actor
  where id = v_id
  returning jsonb_build_object(
    'eventId', event_id,
    'departureAt', departure_at,
    'departureInfo', departure_info,
    'registrationOpensAt', registration_opens_at,
    'registrationClosesAt', registration_closes_at,
    'priceCents', price_cents,
    'capacity', capacity,
    'privacyReference', privacy_reference,
    'termsReference', terms_reference,
    'status', status,
    'revision', revision
  ) into v_after;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_TRIP_UPDATED',
    'fanbus_trip',
    v_id::text,
    v_before,
    v_after,
    jsonb_build_object('eventId', v_existing.event_id)
  );

  return app_private.api_fanbus_trips_list();
end;
$$;

create function app_private.api_fanbus_trip_publish(p_payload jsonb)
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
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Publikationsdaten sind ungültig.'
      using errcode = '22023';
  end if;

  if not (p_payload ?& array['id', 'expectedRevision'])
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['id', 'expectedRevision'])
     ) then
    raise exception 'Für die Veröffentlichung sind ausschließlich id und expectedRevision zulässig.'
      using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision :=
      nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  exception
    when others then
      raise exception 'Die Publikationsdaten haben ein ungültiges Format.'
        using errcode = '22023';
  end;

  if v_id is null or v_expected_revision is null then
    raise exception 'Fanbusfahrt-ID und erwartete Revision sind erforderlich.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_modules.fanbus_trips
  where id = v_id
  for update;

  if not found then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision <> v_existing.revision then
    raise exception
      'Die Fanbusfahrt wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if v_existing.status <> 'DRAFT' then
    raise exception 'Nur ein Entwurf kann veröffentlicht werden.'
      using errcode = '22023';
  end if;

  select event.visibility, event.event_date, event.event_time
  into v_event_visibility, v_event_date, v_event_time
  from app_modules.events as event
  where event.id = v_existing.event_id;

  if not found then
    raise exception 'Der zugehörige Termin wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_event_visibility <> 'PUBLIC' then
    raise exception 'Der zugehörige Termin muss öffentlich sichtbar sein.'
      using errcode = '22023';
  end if;

  if v_existing.departure_at is null
     or v_existing.departure_info is null
     or length(btrim(v_existing.departure_info)) = 0
     or v_existing.registration_opens_at is null
     or v_existing.registration_closes_at is null
     or v_existing.price_cents is null
     or v_existing.price_cents < 0
     or v_existing.capacity is null
     or v_existing.capacity <= 0
     or v_existing.privacy_reference is null
     or length(btrim(v_existing.privacy_reference)) = 0
     or v_existing.terms_reference is null
     or length(btrim(v_existing.terms_reference)) = 0 then
    raise exception 'Die Fanbusfahrt ist für die Veröffentlichung unvollständig.'
      using errcode = '22023';
  end if;

  if v_existing.registration_closes_at <= v_existing.registration_opens_at then
    raise exception 'Das Anmeldeende muss nach dem Anmeldestart liegen.'
      using errcode = '22023';
  end if;

  if v_existing.departure_at <= clock_timestamp()
     or v_existing.registration_closes_at <= clock_timestamp()
     or v_existing.registration_closes_at > v_existing.departure_at
     or (v_existing.departure_at at time zone 'Europe/Berlin')::date > v_event_date
     or (
       v_event_time is not null
       and (v_existing.departure_at at time zone 'Europe/Berlin')
         > (v_event_date + v_event_time)
     ) then
    raise exception 'Abfahrt und Anmeldezeitraum sind zeitlich nicht plausibel.'
      using errcode = '22023';
  end if;

  update app_modules.fanbus_trips
  set status = 'PUBLISHED',
      revision = revision + 1,
      updated_by = v_actor
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_TRIP_PUBLISHED',
    'fanbus_trip',
    v_id::text,
    jsonb_build_object(
      'eventId', v_existing.event_id,
      'status', v_existing.status,
      'revision', v_existing.revision
    ),
    jsonb_build_object(
      'eventId', v_existing.event_id,
      'status', 'PUBLISHED',
      'revision', v_existing.revision + 1
    )
  );

  return app_private.api_fanbus_trips_list();
end;
$$;

create function app_private.api_fanbus_trip_close(p_payload jsonb)
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
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Abschlussdaten sind ungültig.'
      using errcode = '22023';
  end if;

  if not (p_payload ?& array['id', 'expectedRevision'])
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['id', 'expectedRevision'])
     ) then
    raise exception 'Für das Schließen sind ausschließlich id und expectedRevision zulässig.'
      using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision :=
      nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  exception
    when others then
      raise exception 'Die Abschlussdaten haben ein ungültiges Format.'
        using errcode = '22023';
  end;

  if v_id is null or v_expected_revision is null then
    raise exception 'Fanbusfahrt-ID und erwartete Revision sind erforderlich.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_modules.fanbus_trips
  where id = v_id
  for update;

  if not found then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision <> v_existing.revision then
    raise exception
      'Die Fanbusfahrt wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if v_existing.status not in ('DRAFT', 'PUBLISHED') then
    raise exception 'Die Fanbusfahrt ist bereits geschlossen.'
      using errcode = '22023';
  end if;

  update app_modules.fanbus_trips
  set status = 'CLOSED',
      revision = revision + 1,
      updated_by = v_actor
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_TRIP_CLOSED',
    'fanbus_trip',
    v_id::text,
    jsonb_build_object(
      'eventId', v_existing.event_id,
      'status', v_existing.status,
      'revision', v_existing.revision
    ),
    jsonb_build_object(
      'eventId', v_existing.event_id,
      'status', 'CLOSED',
      'revision', v_existing.revision + 1
    )
  );

  return app_private.api_fanbus_trips_list();
end;
$$;

create function app_private.api_fanbus_trip_delete(p_payload jsonb)
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
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Löschdaten sind ungültig.'
      using errcode = '22023';
  end if;

  if not (p_payload ?& array['id', 'expectedRevision'])
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['id', 'expectedRevision'])
     ) then
    raise exception 'Für das Löschen sind ausschließlich id und expectedRevision zulässig.'
      using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision :=
      nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  exception
    when others then
      raise exception 'Die Löschdaten haben ein ungültiges Format.'
        using errcode = '22023';
  end;

  if v_id is null or v_expected_revision is null then
    raise exception 'Fanbusfahrt-ID und erwartete Revision sind erforderlich.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_modules.fanbus_trips
  where id = v_id
  for update;

  if not found then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision <> v_existing.revision then
    raise exception
      'Die Fanbusfahrt wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if v_existing.status <> 'DRAFT' then
    raise exception 'Nur ein Entwurf darf gelöscht werden.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from app_modules.fanbus_registrations as registration
    where registration.trip_id = v_id
  ) then
    raise exception 'Eine Fanbusfahrt mit Anmeldungen darf nicht gelöscht werden.'
      using errcode = '23503';
  end if;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_TRIP_DELETED',
    'fanbus_trip',
    v_id::text,
    jsonb_build_object(
      'eventId', v_existing.event_id,
      'status', v_existing.status,
      'revision', v_existing.revision
    ),
    null
  );

  delete from app_modules.fanbus_trips
  where id = v_id;

  return app_private.api_fanbus_trips_list();
end;
$$;

create function app_private.api_fanbus_registrations_list(p_payload jsonb)
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
          'portalUserId', registration.portal_user_id,
          'firstName', registration.first_name,
          'lastName', registration.last_name,
          'email', registration.email,
          'busPreference', registration.bus_preference,
          'status', registration.status,
          'registeredAt', registration.registered_at,
          'cancelledAt', registration.cancelled_at,
          'revision', registration.revision,
          'source', case
            when registration.portal_user_id is null then 'GUEST'
            else 'PORTAL'
          end
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

create function app_private.api_fanbus_registration_cancel(p_payload jsonb)
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
      'source', case
        when v_existing.portal_user_id is null then 'GUEST'
        else 'PORTAL'
      end
    )
  );

  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId', v_existing.trip_id)
  );
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_fanbus_m310_r1;

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
    when 'fanbus_trips_list' then
      v_data := app_private.api_fanbus_trips_list();
    when 'fanbus_available_events' then
      v_data := app_private.api_fanbus_available_events();
    when 'fanbus_trip_create' then
      v_data := app_private.api_fanbus_trip_create(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_trip_update' then
      v_data := app_private.api_fanbus_trip_update(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_trip_publish' then
      v_data := app_private.api_fanbus_trip_publish(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_trip_close' then
      v_data := app_private.api_fanbus_trip_close(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_trip_delete' then
      v_data := app_private.api_fanbus_trip_delete(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_registrations_list' then
      v_data := app_private.api_fanbus_registrations_list(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_registration_cancel' then
      v_data := app_private.api_fanbus_registration_cancel(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return public.pd_api_before_fanbus_m310_r1(
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

revoke all on function app_private.api_fanbus_trips_list()
from public, anon, authenticated;

revoke all on function app_private.api_fanbus_available_events()
from public, anon, authenticated;

revoke all on function app_private.api_fanbus_trip_create(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_fanbus_trip_update(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_fanbus_trip_publish(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_fanbus_trip_close(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_fanbus_trip_delete(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_fanbus_registrations_list(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_fanbus_registration_cancel(jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api_before_fanbus_m310_r1(text, jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated;

grant execute on function public.pd_api(text, jsonb)
to authenticated;
