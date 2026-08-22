-- P300 / M330-R1 – Fahrtänderungen und vollständige Fahrtstornierung
-- Forward-only. Bestehende Buchungs-, Teilnehmer- und Betriebsdaten bleiben erhalten.

alter table app_modules.fanbus_trips
  drop constraint fanbus_trips_status_check,
  add column cancellation_reason text,
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references app_portal.users(id) on delete set null,
  add constraint fanbus_trips_status_check
    check (status in ('DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED')),
  add constraint fanbus_trips_cancellation_reason_check
    check (
      cancellation_reason is null
      or (
        cancellation_reason = btrim(cancellation_reason)
        and length(cancellation_reason) between 1 and 240
      )
    ),
  add constraint fanbus_trips_cancelled_fields_check
    check (
      status <> 'CANCELLED'
      or (cancellation_reason is not null and cancelled_at is not null)
    );

alter table app_private.fanbus_registration_idempotency
  drop constraint fanbus_registration_idempotency_outcome_check,
  add constraint fanbus_registration_idempotency_outcome_check check (
    outcome in (
      'CREATED', 'WAITLISTED', 'ALREADY_ACTIVE', 'FULL',
      'NOT_STARTED', 'CLOSED', 'CANCELLED', 'UNAVAILABLE'
    )
  );

create function app_private.m330_lock_mutable_fanbus_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
begin
  select trip.status
  into v_status
  from app_modules.fanbus_trips as trip
  where trip.id = p_trip_id
  for update;

  if not found then
    raise exception 'FANBUS_TRIP_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_status = 'CANCELLED' then
    raise exception 'FANBUS_TRIP_CANCELLED' using errcode = 'P3302';
  end if;
end;
$function$;

create function app_private.m330_payload_trip_id(
  p_payload jsonb,
  p_mode text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_reference uuid;
  v_trip_id uuid;
begin
  begin
    if p_mode = 'TRIP_ID' then
      return nullif(btrim(coalesce(p_payload ->> 'tripId', '')), '')::uuid;
    elsif p_mode = 'TRIP_ACTION_ID' then
      return nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    elsif p_mode = 'REGISTRATION_ID' then
      v_reference := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    elsif p_mode = 'PARTICIPANT_ID' then
      v_reference := nullif(btrim(coalesce(p_payload ->> 'participantId', '')), '')::uuid;
    else
      return null;
    end if;
  exception when others then
    return null;
  end;

  select registration.trip_id
  into v_trip_id
  from app_modules.fanbus_registrations as registration
  where registration.id = v_reference;

  return v_trip_id;
end;
$function$;

-- Öffentliche Einzelprojektion: CANCELLED bleibt im bestehenden Public-Horizont
-- sichtbar, ohne cancelled_by oder andere interne Daten auszugeben.
create or replace function public.pd_public_fanbus_trip(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
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
    'tripStatus', trip.status,
    'cancellationReason', trip.cancellation_reason,
    'cancelledAt', trip.cancelled_at,
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
      when trip.status = 'CANCELLED' then 'CANCELLED'
      when v_now < trip.registration_opens_at then 'NOT_STARTED'
      when v_now >= trip.registration_closes_at or v_now >= trip.departure_at then 'CLOSED'
      when registration.waitlisted_count > 0
        or registration.active_count >= capacity.effective_capacity then 'WAITLIST'
      else 'OPEN'
    end,
    'privacyReference', trip.privacy_reference,
    'termsReference', trip.terms_reference
  )
  into v_result
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
    and trip.status in ('PUBLISHED', 'CANCELLED')
    and event.visibility = 'PUBLIC'
    and event.event_date >= v_today
    and (
      trip.status = 'CANCELLED'
      or (
        trip.departure_at is not null
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
        )
      )
    );

  return coalesce(v_result, jsonb_build_object('available', false));
end;
$function$;

create or replace function public.pd_public_fanbus_trips()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := statement_timestamp();
  v_today date := (v_now at time zone 'Europe/Berlin')::date;
begin
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tripId', trip.id,
          'tripStatus', trip.status,
          'cancellationReason', trip.cancellation_reason,
          'cancelledAt', trip.cancelled_at,
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
            when trip.status = 'CANCELLED' then 'CANCELLED'
            when v_now < trip.registration_opens_at then 'NOT_STARTED'
            when v_now >= trip.registration_closes_at or v_now >= trip.departure_at then 'CLOSED'
            when registration.waitlisted_count > 0
              or registration.active_count >= capacity.effective_capacity then 'WAITLIST'
            else 'OPEN'
          end
        )
        order by event.event_date, event.event_time asc nulls last, trip.departure_at
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
          count(*) filter (where status = 'WAITLISTED')::integer as waitlisted_count
        from app_modules.fanbus_registrations
        where trip_id = trip.id
      ) as registration
      where trip.status in ('PUBLISHED', 'CANCELLED')
        and event.visibility = 'PUBLIC'
        and event.event_date >= v_today
        and (
          trip.status = 'CANCELLED'
          or (
            trip.departure_at is not null
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
            )
          )
        )
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.pd_public_fanbus_trip_boarding_stops(p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'stops',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', trip_stop.id,
          'tripBoardingStopId', trip_stop.id,
          'boardingStopId', trip_stop.boarding_stop_id,
          'label', stop.label,
          'address', stop.address,
          'departureAt', trip_stop.departure_at,
          'tripNote', trip_stop.trip_note,
          'position', trip_stop.position
        )
        order by trip_stop.position, trip_stop.id
      )
      from app_modules.fanbus_trip_boarding_stops as trip_stop
      join app_modules.fanbus_boarding_stops as stop
        on stop.id = trip_stop.boarding_stop_id
      join app_modules.fanbus_trips as trip on trip.id = trip_stop.trip_id
      join app_modules.events as event on event.id = trip.event_id
      where trip_stop.trip_id = p_trip_id
        and trip_stop.is_active
        and trip.status in ('PUBLISHED', 'CANCELLED')
        and event.visibility = 'PUBLIC'
        and event.event_date >= (statement_timestamp() at time zone 'Europe/Berlin')::date
    ), '[]'::jsonb)
  );
$function$;

-- Interner Snapshot mit PII-freier Auswirkungsübersicht.
create or replace function app_private.api_fanbus_trips_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_can_manage boolean := app_private.has_capability(v_actor, 'fanbus.manage');
  v_can_manage_registrations boolean :=
    app_private.has_capability(v_actor, 'fanbus.registrations.manage');
  v_now timestamptz := clock_timestamp();
  v_today date := (v_now at time zone 'Europe/Berlin')::date;
begin
  return jsonb_build_object(
    'trips', coalesce((
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
          'cancellationReason', trip.cancellation_reason,
          'cancelledAt', trip.cancelled_at,
          'revision', trip.revision,
          'activeRegistrationCount', registration.active_count,
          'waitlistedRegistrationCount', registration.waitlisted_count,
          'affectedBookingCount', registration.booking_count,
          'cancellationNotificationNotice',
            'Buchungskontakte erhalten eine Pflicht-E-Mail; Portalnutzer optional Push.',
          'canCancel', v_can_manage and (
            trip.status = 'PUBLISHED'
            or (
              trip.status = 'CLOSED'
              and exists (
                select 1
                from app_portal.audit_events as audit
                where audit.action = 'FANBUS_TRIP_PUBLISHED'
                  and audit.entity_type = 'fanbus_trip'
                  and audit.entity_id = trip.id::text
              )
            )
          ),
          'remainingCapacity', greatest(
            coalesce(capacity.effective_capacity, 0) - registration.active_count, 0
          ),
          'registrationStatus', case
            when trip.status = 'CANCELLED' then 'CANCELLED'
            when trip.status = 'CLOSED' then 'CLOSED'
            when trip.status <> 'PUBLISHED'
              or trip.departure_at is null
              or trip.registration_opens_at is null
              or trip.registration_closes_at is null
              or trip.price_cents is null
              or capacity.effective_capacity <= 0
              or nullif(btrim(trip.privacy_reference), '') is null
              or nullif(btrim(trip.terms_reference), '') is null
              or event.visibility <> 'PUBLIC' then 'UNAVAILABLE'
            when v_now < trip.registration_opens_at then 'NOT_STARTED'
            when v_now >= trip.registration_closes_at or v_now >= trip.departure_at then 'CLOSED'
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
          count(*) filter (where status = 'WAITLISTED')::integer as waitlisted_count,
          count(distinct booking_id) filter (
            where status in ('ACTIVE', 'WAITLISTED') and booking_id is not null
          )::integer as booking_count
        from app_modules.fanbus_registrations
        where trip_id = trip.id
      ) as registration
      where (
        (v_can_manage or v_can_manage_registrations)
        and (event.event_date >= v_today or trip.status in ('DRAFT', 'PUBLISHED', 'CANCELLED'))
      ) or (
        not v_can_manage and not v_can_manage_registrations
        and event.event_date >= v_today
        and trip.status in ('PUBLISHED', 'CLOSED', 'CANCELLED')
      )
    ), '[]'::jsonb)
  );
end;
$function$;

create function app_private.api_fanbus_trip_cancel(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_id uuid;
  v_expected_revision integer;
  v_reason text;
  v_existing app_modules.fanbus_trips%rowtype;
  v_cancelled_at timestamptz;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['id', 'expectedRevision', 'cancellationReason']
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['id', 'expectedRevision', 'cancellationReason'])
     ) then
    raise exception 'FANBUS_TRIP_CANCELLATION_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision :=
      nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
    v_reason := btrim(coalesce(p_payload ->> 'cancellationReason', ''));
  exception when others then
    raise exception 'FANBUS_TRIP_CANCELLATION_INVALID_PAYLOAD' using errcode = '22023';
  end;

  if v_id is null or v_expected_revision is null or v_expected_revision <= 0 then
    raise exception 'FANBUS_TRIP_CANCELLATION_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  select trip.*
  into v_existing
  from app_modules.fanbus_trips as trip
  where trip.id = v_id
  for update;

  if not found then
    raise exception 'FANBUS_TRIP_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Idempotenz wird absichtlich vor expectedRevision ausgewertet.
  if v_existing.status = 'CANCELLED' then
    if v_existing.cancellation_reason = v_reason then
      return app_private.api_fanbus_trips_list();
    end if;
    raise exception 'FANBUS_TRIP_ALREADY_CANCELLED' using errcode = 'P3301';
  end if;

  if v_existing.revision <> v_expected_revision then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;

  if v_existing.status = 'DRAFT'
     or v_existing.status not in ('PUBLISHED', 'CLOSED') then
    raise exception 'FANBUS_TRIP_CANCELLATION_TRANSITION_INVALID' using errcode = '22023';
  end if;

  if v_existing.status = 'CLOSED'
     and not exists (
       select 1
       from app_portal.audit_events as audit
       where audit.action = 'FANBUS_TRIP_PUBLISHED'
         and audit.entity_type = 'fanbus_trip'
         and audit.entity_id = v_id::text
     ) then
    raise exception 'FANBUS_TRIP_WAS_NEVER_PUBLISHED' using errcode = '22023';
  end if;

  if length(v_reason) not between 1 and 240 then
    raise exception 'FANBUS_TRIP_CANCELLATION_REASON_INVALID' using errcode = '22023';
  end if;

  v_cancelled_at := clock_timestamp();

  update app_modules.fanbus_trips
  set status = 'CANCELLED',
      cancellation_reason = v_reason,
      cancelled_at = v_cancelled_at,
      cancelled_by = v_actor,
      revision = revision + 1,
      updated_by = v_actor
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_TRIP_CANCELLED',
    'fanbus_trip',
    v_id::text,
    jsonb_build_object(
      'eventId', v_existing.event_id,
      'status', v_existing.status,
      'revision', v_existing.revision
    ),
    jsonb_build_object(
      'eventId', v_existing.event_id,
      'status', 'CANCELLED',
      'revision', v_existing.revision + 1,
      'cancelledAt', v_cancelled_at,
      'cancellationReason', v_reason
    ),
    jsonb_build_object(
      'tripId', v_id,
      'oldStatus', v_existing.status,
      'newStatus', 'CANCELLED',
      'oldRevision', v_existing.revision,
      'newRevision', v_existing.revision + 1,
      'cancelledAt', v_cancelled_at,
      'cancellationReason', v_reason
    )
  );

  perform app_private.notification_event_enqueue(
    'FANBUS_TRIP_CANCELLED',
    'FANBUS',
    'fanbus-trip:' || v_id::text || ':cancelled',
    'M330_R1',
    'fanbus_trip',
    v_id::text,
    v_actor,
    jsonb_build_object('tripId', v_id),
    v_cancelled_at
  );

  return app_private.api_fanbus_trips_list();
end;
$function$;

-- Booking-Core: gleicher Idempotenzvertrag, aber CANCELLED wird nach dem
-- Trip-Lock vor der generischen Verfügbarkeitsauswertung als eigenes Outcome geführt.
alter function app_private.fanbus_submit_booking_core(
  uuid, text, uuid, jsonb, jsonb, boolean, boolean, uuid, text
) rename to fanbus_submit_booking_core_before_m330_r1;

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
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_status text;
  v_was_replay boolean := false;
  v_result jsonb;
begin
  if p_trip_id is null then
    return app_private.fanbus_submit_booking_core_before_m330_r1(
      p_trip_id, p_source, p_actor, p_primary, p_companions,
      p_privacy_confirmed, p_terms_confirmed, p_idempotency_key,
      p_legacy_request_hash
    );
  end if;

  select trip.status
  into v_status
  from app_modules.fanbus_trips as trip
  where trip.id = p_trip_id
  for update;

  if not found then
    return app_private.fanbus_submit_booking_core_before_m330_r1(
      p_trip_id, p_source, p_actor, p_primary, p_companions,
      p_privacy_confirmed, p_terms_confirmed, p_idempotency_key,
      p_legacy_request_hash
    );
  end if;

  if v_status = 'CANCELLED' then
    select exists (
      select 1
      from app_private.fanbus_registration_idempotency as idempotency
      where idempotency.idempotency_key = p_idempotency_key
    ) into v_was_replay;
  end if;

  v_result := app_private.fanbus_submit_booking_core_before_m330_r1(
    p_trip_id, p_source, p_actor, p_primary, p_companions,
    p_privacy_confirmed, p_terms_confirmed, p_idempotency_key,
    p_legacy_request_hash
  );

  if v_status <> 'CANCELLED' or v_was_replay then
    return v_result;
  end if;

  v_result := jsonb_set(v_result, '{outcome}', to_jsonb('CANCELLED'::text), true);
  update app_private.fanbus_registration_idempotency
  set outcome = 'CANCELLED', response_payload = v_result
  where idempotency_key = p_idempotency_key
    and trip_id = p_trip_id;

  return v_result;
end;
$function$;

-- Gleichsignaturige Wrapper setzen für alle tripbezogenen Mutationen die
-- Reihenfolge Trip -> CANCELLED-Guard -> fachliche Detail-Locks durch.
alter function app_private.api_fanbus_trip_update(jsonb)
  rename to api_fanbus_trip_update_before_m330_r1;
create function app_private.api_fanbus_trip_update(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ACTION_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_trip_update_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_trip_publish(jsonb)
  rename to api_fanbus_trip_publish_before_m330_r1;
create function app_private.api_fanbus_trip_publish(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ACTION_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_trip_publish_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_trip_close(jsonb)
  rename to api_fanbus_trip_close_before_m330_r1;
create function app_private.api_fanbus_trip_close(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ACTION_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_trip_close_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_trip_reopen(jsonb)
  rename to api_fanbus_trip_reopen_before_m330_r1;
create function app_private.api_fanbus_trip_reopen(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ACTION_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_trip_reopen_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_trip_delete(jsonb)
  rename to api_fanbus_trip_delete_before_m330_r1;
create function app_private.api_fanbus_trip_delete(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ACTION_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_trip_delete_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_registration_update(jsonb)
  rename to api_fanbus_registration_update_before_m330_r1;
create function app_private.api_fanbus_registration_update(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'REGISTRATION_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_registration_update_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_registration_cancel(jsonb)
  rename to api_fanbus_registration_cancel_before_m330_r1;
create function app_private.api_fanbus_registration_cancel(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'REGISTRATION_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_registration_cancel_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_waitlist_promote(jsonb)
  rename to api_fanbus_waitlist_promote_before_m330_r1;
create function app_private.api_fanbus_waitlist_promote(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'REGISTRATION_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_waitlist_promote_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_bus_upsert(jsonb)
  rename to api_fanbus_bus_upsert_before_m330_r1;
create function app_private.api_fanbus_bus_upsert(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_bus_upsert_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_bus_assignment_set(jsonb)
  rename to api_fanbus_bus_assignment_set_before_m330_r1;
create function app_private.api_fanbus_bus_assignment_set(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'PARTICIPANT_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_bus_assignment_set_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_trip_boarding_stop_upsert(jsonb)
  rename to api_fanbus_trip_boarding_stop_upsert_before_m330_r1;
create function app_private.api_fanbus_trip_boarding_stop_upsert(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_trip_boarding_stop_upsert_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_trip_boarding_stops_reorder(jsonb)
  rename to api_fanbus_trip_boarding_stops_reorder_before_m330_r1;
create function app_private.api_fanbus_trip_boarding_stops_reorder(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_trip_boarding_stops_reorder_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_bus_boarding_stops_set(jsonb)
  rename to api_fanbus_bus_boarding_stops_set_before_m330_r1;
create function app_private.api_fanbus_bus_boarding_stops_set(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_bus_boarding_stops_set_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_registration_operational_update(jsonb)
  rename to api_fanbus_registration_operational_update_before_m330_r1;
create function app_private.api_fanbus_registration_operational_update(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'PARTICIPANT_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_registration_operational_update_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_registration_update_m325(jsonb)
  rename to api_fanbus_registration_update_m325_before_m330_r1;
create function app_private.api_fanbus_registration_update_m325(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'REGISTRATION_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_registration_update_m325_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_checkin_set(jsonb)
  rename to api_fanbus_checkin_set_before_m330_r1;
create function app_private.api_fanbus_checkin_set(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'PARTICIPANT_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_checkin_set_before_m330_r1(p_payload);
end;
$function$;

alter function app_private.api_fanbus_paid_set(jsonb)
  rename to api_fanbus_paid_set_before_m330_r1;
create function app_private.api_fanbus_paid_set(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_trip uuid := app_private.m330_payload_trip_id(p_payload, 'PARTICIPANT_ID');
begin
  if v_trip is not null then perform app_private.m330_lock_mutable_fanbus_trip(v_trip); end if;
  return app_private.api_fanbus_paid_set_before_m330_r1(p_payload);
end;
$function$;

-- Additive Action im bestehenden pd_api-Wrappervertrag.
alter function public.pd_api(text, jsonb)
  rename to pd_api_before_fanbus_cancellation_m330_r1;

create function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_data jsonb;
begin
  if lower(btrim(coalesce(p_action, ''))) = 'fanbus_trip_cancel' then
    if auth.uid() is null then
      raise exception 'Anmeldung erforderlich.' using errcode = '42501';
    end if;
    v_data := app_private.api_fanbus_trip_cancel(coalesce(p_payload, '{}'::jsonb));
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  return public.pd_api_before_fanbus_cancellation_m330_r1(p_action, p_payload);
exception when others then
  return jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object('code', sqlstate, 'message', sqlerrm)
  );
end;
$function$;

revoke all on function public.pd_api_before_fanbus_cancellation_m330_r1(text, jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.pd_api(text, jsonb) to authenticated;

revoke all on function public.pd_public_fanbus_trip(uuid)
from public, anon, authenticated;
grant execute on function public.pd_public_fanbus_trip(uuid) to anon, authenticated;
revoke all on function public.pd_public_fanbus_trips()
from public, anon, authenticated;
grant execute on function public.pd_public_fanbus_trips() to anon, authenticated;
revoke all on function public.pd_public_fanbus_trip_boarding_stops(uuid)
from public, anon, authenticated;
grant execute on function public.pd_public_fanbus_trip_boarding_stops(uuid)
to anon, authenticated;

revoke all on function app_private.api_fanbus_trip_cancel(jsonb),
  app_private.m330_lock_mutable_fanbus_trip(uuid),
  app_private.m330_payload_trip_id(jsonb, text),
  app_private.fanbus_submit_booking_core_before_m330_r1(
    uuid, text, uuid, jsonb, jsonb, boolean, boolean, uuid, text
  ),
  app_private.fanbus_submit_booking_core(
    uuid, text, uuid, jsonb, jsonb, boolean, boolean, uuid, text
  ),
  app_private.api_fanbus_trip_update(jsonb),
  app_private.api_fanbus_trip_publish(jsonb),
  app_private.api_fanbus_trip_close(jsonb),
  app_private.api_fanbus_trip_reopen(jsonb),
  app_private.api_fanbus_trip_delete(jsonb),
  app_private.api_fanbus_registration_update(jsonb),
  app_private.api_fanbus_registration_cancel(jsonb),
  app_private.api_fanbus_waitlist_promote(jsonb),
  app_private.api_fanbus_bus_upsert(jsonb),
  app_private.api_fanbus_bus_assignment_set(jsonb),
  app_private.api_fanbus_trip_boarding_stop_upsert(jsonb),
  app_private.api_fanbus_trip_boarding_stops_reorder(jsonb),
  app_private.api_fanbus_bus_boarding_stops_set(jsonb),
  app_private.api_fanbus_registration_operational_update(jsonb),
  app_private.api_fanbus_registration_update_m325(jsonb),
  app_private.api_fanbus_checkin_set(jsonb),
  app_private.api_fanbus_paid_set(jsonb)
from public, anon, authenticated, service_role;
