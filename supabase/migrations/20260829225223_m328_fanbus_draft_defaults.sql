create or replace function app_private.api_fanbus_trip_create(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_event_id uuid;
  v_event_date date;
  v_event_time time without time zone;
  v_trip_id uuid;
  v_departure_local timestamp without time zone;
  v_departure_at timestamptz;
  v_registration_closes_at timestamptz;
  v_icedome_id uuid;
  v_pendler_id uuid;
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

  select event.event_date, event.event_time
  into v_event_date, v_event_time
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

  if v_event_time is null then
    raise exception 'Für die automatische Fanbus-Vorbelegung benötigt der Termin eine Spieluhrzeit.'
      using errcode = '22023';
  end if;

  select stop.id
  into v_icedome_id
  from app_modules.fanbus_boarding_stops as stop
  where stop.is_active
    and lower(btrim(stop.label)) = 'icedome'
  order by stop.created_at, stop.id
  limit 1;

  select stop.id
  into v_pendler_id
  from app_modules.fanbus_boarding_stops as stop
  where stop.is_active
    and lower(btrim(stop.label)) = 'pendlerparkplatz'
  order by stop.created_at, stop.id
  limit 1;

  if v_icedome_id is null or v_pendler_id is null then
    raise exception 'Die Standard-Zustiegsorte Icedome und Pendlerparkplatz müssen aktiv vorhanden sein.'
      using errcode = '22023';
  end if;

  v_departure_local := (v_event_date + v_event_time) - interval '4 hours';
  v_departure_at := v_departure_local at time zone 'Europe/Berlin';
  v_registration_closes_at := ((v_departure_local::date - 3) + time '20:00') at time zone 'Europe/Berlin';

  begin
    insert into app_modules.fanbus_trips (
      event_id,
      departure_at,
      registration_opens_at,
      registration_closes_at,
      status,
      default_boarding_stop_id,
      bus_preference_enabled,
      created_by,
      updated_by
    ) values (
      v_event_id,
      v_departure_at,
      null,
      v_registration_closes_at,
      'DRAFT',
      v_icedome_id,
      false,
      v_actor,
      v_actor
    )
    returning id into v_trip_id;
  exception
    when unique_violation then
      raise exception 'Für diesen Termin besteht bereits eine Fanbusfahrt.'
        using errcode = '23505';
  end;

  insert into app_modules.fanbus_trip_boarding_stops (
    trip_id, boarding_stop_id, departure_at, position, is_active,
    created_by, updated_by
  ) values
    (v_trip_id, v_pendler_id, v_departure_at - interval '30 minutes', 1, true, v_actor, v_actor),
    (v_trip_id, v_icedome_id, v_departure_at, 2, true, v_actor, v_actor);

  perform app_private.log_audit(
    v_actor,
    'FANBUS_TRIP_CREATED',
    'fanbus_trip',
    v_trip_id::text,
    null,
    null,
    jsonb_build_object(
      'eventId', v_event_id,
      'status', 'DRAFT',
      'departureAt', v_departure_at,
      'registrationClosesAt', v_registration_closes_at,
      'defaultBoardingStopId', v_icedome_id,
      'busPreferenceEnabled', false,
      'defaultsApplied', true
    )
  );

  return app_private.api_fanbus_trips_list();
end;
$function$;

do $backfill$
declare
  v_icedome_id uuid;
  v_pendler_id uuid;
  v_trip record;
  v_departure_local timestamp without time zone;
  v_departure_at timestamptz;
  v_registration_closes_at timestamptz;
begin
  select stop.id into v_icedome_id
  from app_modules.fanbus_boarding_stops stop
  where stop.is_active and lower(btrim(stop.label)) = 'icedome'
  order by stop.created_at, stop.id limit 1;

  select stop.id into v_pendler_id
  from app_modules.fanbus_boarding_stops stop
  where stop.is_active and lower(btrim(stop.label)) = 'pendlerparkplatz'
  order by stop.created_at, stop.id limit 1;

  if v_icedome_id is null or v_pendler_id is null then
    raise exception 'Die Standard-Zustiegsorte Icedome und Pendlerparkplatz müssen aktiv vorhanden sein.';
  end if;

  for v_trip in
    select t.id, t.created_by, t.updated_by, e.event_date, e.event_time
    from app_modules.fanbus_trips t
    join app_modules.events e on e.id = t.event_id
    where t.status = 'DRAFT'
      and e.event_time is not null
    order by e.event_date, t.id
  loop
    v_departure_local := (v_trip.event_date + v_trip.event_time) - interval '4 hours';
    v_departure_at := v_departure_local at time zone 'Europe/Berlin';
    v_registration_closes_at := ((v_departure_local::date - 3) + time '20:00') at time zone 'Europe/Berlin';

    update app_modules.fanbus_trips
    set departure_at = v_departure_at,
        registration_opens_at = null,
        registration_closes_at = v_registration_closes_at,
        default_boarding_stop_id = v_icedome_id,
        bus_preference_enabled = false,
        revision = revision + 1
    where id = v_trip.id;

    insert into app_modules.fanbus_trip_boarding_stops (
      trip_id, boarding_stop_id, departure_at, position, is_active,
      created_by, updated_by
    ) values (
      v_trip.id, v_pendler_id, v_departure_at - interval '30 minutes', 1, true,
      v_trip.created_by, coalesce(v_trip.updated_by, v_trip.created_by)
    )
    on conflict (trip_id, boarding_stop_id) do update
      set departure_at = excluded.departure_at,
          position = excluded.position,
          is_active = true,
          revision = app_modules.fanbus_trip_boarding_stops.revision + 1,
          updated_by = excluded.updated_by;

    insert into app_modules.fanbus_trip_boarding_stops (
      trip_id, boarding_stop_id, departure_at, position, is_active,
      created_by, updated_by
    ) values (
      v_trip.id, v_icedome_id, v_departure_at, 2, true,
      v_trip.created_by, coalesce(v_trip.updated_by, v_trip.created_by)
    )
    on conflict (trip_id, boarding_stop_id) do update
      set departure_at = excluded.departure_at,
          position = excluded.position,
          is_active = true,
          revision = app_modules.fanbus_trip_boarding_stops.revision + 1,
          updated_by = excluded.updated_by;
  end loop;
end;
$backfill$;
