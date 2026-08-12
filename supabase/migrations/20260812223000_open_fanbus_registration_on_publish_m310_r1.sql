-- Plaerrdeifl Digitalplattform V4
-- P300 / M310-R1: Die Fanbus-Anmeldung wird beim Veröffentlichen serverseitig geöffnet.

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
       'id', 'expectedRevision', 'departureAt', 'departureInfo',
       'registrationClosesAt', 'priceCents', 'capacity',
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
    v_capacity := nullif(btrim(coalesce(p_payload ->> 'capacity', '')), '')::integer;
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
  if v_capacity is not null and v_capacity <= 0 then
    raise exception 'Die Kapazität muss größer als null sein.' using errcode = '22023';
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

  select count(*)::integer into v_active_registration_count
  from app_modules.fanbus_registrations as registration
  where registration.trip_id = v_id and registration.status = 'ACTIVE';
  if v_capacity is not null and v_capacity < v_active_registration_count then
    raise exception 'Die Kapazität darf nicht unter der Zahl aktiver Anmeldungen liegen.'
      using errcode = '22023';
  end if;

  select event.visibility, event.event_date, event.event_time
  into v_event_visibility, v_event_date, v_event_time
  from app_modules.events as event
  where event.id = v_existing.event_id;
  if not found then
    raise exception 'Der zugehörige Termin wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_existing.status = 'PUBLISHED' then
    if v_event_visibility <> 'PUBLIC' or v_departure_at is null or v_departure_info is null
       or v_registration_opens_at is null or v_registration_closes_at is null
       or v_price_cents is null or v_capacity is null or v_privacy_reference is null
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
    'capacity', v_existing.capacity, 'privacyReference', v_existing.privacy_reference,
    'termsReference', v_existing.terms_reference, 'status', v_existing.status, 'revision', v_existing.revision
  );

  update app_modules.fanbus_trips
  set departure_at = v_departure_at, departure_info = v_departure_info,
      registration_opens_at = v_registration_opens_at,
      registration_closes_at = v_registration_closes_at, price_cents = v_price_cents,
      capacity = v_capacity, privacy_reference = v_privacy_reference,
      terms_reference = v_terms_reference, revision = revision + 1, updated_by = v_actor
  where id = v_id
  returning jsonb_build_object(
    'eventId', event_id, 'departureAt', departure_at, 'departureInfo', departure_info,
    'registrationOpensAt', registration_opens_at, 'registrationClosesAt', registration_closes_at,
    'priceCents', price_cents, 'capacity', capacity, 'privacyReference', privacy_reference,
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
  if v_existing.departure_at is null or v_existing.departure_info is null
     or length(btrim(v_existing.departure_info)) = 0 or v_existing.registration_closes_at is null
     or v_existing.price_cents is null or v_existing.price_cents < 0
     or v_existing.capacity is null or v_existing.capacity <= 0
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

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_fanbus_open_on_publish_m310_r1;

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
    when 'fanbus_trip_update' then
      v_data := app_private.api_fanbus_trip_update(coalesce(p_payload, '{}'::jsonb));
    when 'fanbus_trip_publish' then
      v_data := app_private.api_fanbus_trip_publish(coalesce(p_payload, '{}'::jsonb));
    else
      return public.pd_api_before_fanbus_open_on_publish_m310_r1(p_action, p_payload);
  end case;
  return jsonb_build_object('ok', true, 'data', v_data);
exception when others then
  return jsonb_build_object('ok', false,
    'error', jsonb_build_object('code', sqlstate, 'message', sqlerrm));
end;
$$;

revoke all on function app_private.api_fanbus_trip_update(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_fanbus_trip_publish(jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.pd_api_before_fanbus_open_on_publish_m310_r1(text, jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.pd_api(text, jsonb) to authenticated;
