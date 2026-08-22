-- Plaerrdeifl Portal V4
-- P800 / M010-R2
-- F1-B1: granularer Fanbus-Fahrtbetrieb.
--
-- fanbus.registrations.manage
--   = Teilnehmer-/Buchungsverwaltung
--
-- fanbus.operations.manage
--   = Check-in / operativer Fahrtbetrieb
--
-- fanbus.payment_marker.manage
--   = ausschließlich manueller Bezahlt-Marker
--
-- Die M330-Stornierungssperre bleibt für beide Mutationen erhalten.

-- ============================================================
-- 1. Operations-Snapshot
-- ============================================================
--
-- Der Snapshot ist bewusst ein schmales operatives Read-Model.
-- Zugriff:
--   Teilnehmerverwaltung ODER Fahrtbetrieb ODER Bezahlt-Marker.
--
-- Keine zusätzliche Read-Capability erforderlich.

create or replace function app_private.api_fanbus_operations_snapshot(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_trip uuid := app_private.m325_parse_uuid(
    p_payload ->> 'tripId',
    'FANBUS_OPERATIONS_INVALID_PAYLOAD'
  );
begin
  if not (
    app_private.has_capability(
      v_actor,
      'fanbus.registrations.manage'
    )
    or app_private.has_capability(
      v_actor,
      'fanbus.operations.manage'
    )
    or app_private.has_capability(
      v_actor,
      'fanbus.payment_marker.manage'
    )
  ) then
    raise exception
      'Berechtigung fehlt: Fanbus-Teilnehmer, Fahrtbetrieb oder Bezahlt-Marker.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from app_modules.fanbus_trips
    where id = v_trip
  ) then
    raise exception 'FANBUS_TRIP_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  return (
    with active as (
      select
        r.id,
        r.first_name,
        r.last_name,
        r.trip_boarding_stop_id,
        a.bus_id,
        b.label as bus_label,
        s.label as stop_label,
        t.departure_at,
        coalesce(c.status, 'OPEN') as checkin_status,
        coalesce(c.revision, 1) as checkin_revision,
        coalesce(c.is_paid, false) as is_paid
      from app_modules.fanbus_registrations as r
      left join app_modules.fanbus_bus_assignments as a
        on a.participant_id = r.id
      left join app_modules.fanbus_buses as b
        on b.id = a.bus_id
      left join app_modules.fanbus_trip_boarding_stops as t
        on t.id = r.trip_boarding_stop_id
      left join app_modules.fanbus_boarding_stops as s
        on s.id = t.boarding_stop_id
      left join app_modules.fanbus_participant_checkins as c
        on c.participant_id = r.id
       and c.checkin_kind = 'OUTBOUND'
      where r.trip_id = v_trip
        and r.status = 'ACTIVE'
    ),
    bus_counts as (
      select
        bus_id,
        bus_label,
        count(*)::integer as expected,
        count(*) filter (
          where checkin_status = 'PRESENT'
        )::integer as present,
        count(*) filter (
          where checkin_status = 'OPEN'
        )::integer as open,
        count(*) filter (
          where checkin_status = 'NO_SHOW'
        )::integer as no_show
      from active
      where bus_id is not null
      group by bus_id, bus_label
    ),
    stop_counts as (
      select
        trip_boarding_stop_id,
        stop_label,
        count(*)::integer as expected,
        count(*) filter (
          where checkin_status = 'PRESENT'
        )::integer as present,
        count(*) filter (
          where checkin_status = 'OPEN'
        )::integer as open,
        count(*) filter (
          where checkin_status = 'NO_SHOW'
        )::integer as no_show
      from active
      where trip_boarding_stop_id is not null
      group by trip_boarding_stop_id, stop_label
    ),
    summary as (
      select
        count(*)::integer as expected,
        count(*) filter (
          where checkin_status = 'PRESENT'
        )::integer as present,
        count(*) filter (
          where checkin_status = 'OPEN'
        )::integer as open,
        count(*) filter (
          where checkin_status = 'NO_SHOW'
        )::integer as no_show,
        count(*) filter (
          where bus_id is null
        )::integer as unassigned_bus_count,
        count(*) filter (
          where trip_boarding_stop_id is null
        )::integer as missing_stop_count
      from active
    )
    select jsonb_build_object(
      'tripId',
      v_trip,

      'summary',
      jsonb_build_object(
        'expected',
        summary.expected,
        'present',
        summary.present,
        'open',
        summary.open,
        'noShow',
        summary.no_show,
        'unassignedBusCount',
        summary.unassigned_bus_count,
        'missingBoardingStopCount',
        summary.missing_stop_count
      ),

      'buses',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'busId',
              bus_id,
              'label',
              bus_label,
              'expected',
              expected,
              'present',
              present,
              'open',
              open,
              'noShow',
              no_show
            )
            order by lower(bus_label), bus_id
          )
          from bus_counts
        ),
        '[]'::jsonb
      ),

      'stops',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'tripBoardingStopId',
              trip_boarding_stop_id,
              'label',
              stop_label,
              'expected',
              expected,
              'present',
              present,
              'open',
              open,
              'noShow',
              no_show
            )
            order by lower(stop_label), trip_boarding_stop_id
          )
          from stop_counts
        ),
        '[]'::jsonb
      ),

      'participants',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id',
              id,
              'firstName',
              first_name,
              'lastName',
              last_name,
              'busId',
              bus_id,
              'busLabel',
              bus_label,
              'tripBoardingStopId',
              trip_boarding_stop_id,
              'boardingStopLabel',
              stop_label,
              'departureAt',
              departure_at,
              'checkinStatus',
              checkin_status,
              'checkinRevision',
              checkin_revision,
              'isPaid',
              is_paid
            )
            order by lower(last_name), lower(first_name), id
          )
          from active
        ),
        '[]'::jsonb
      )
    )
    from summary
  );
end;
$$;

-- ============================================================
-- 2. Check-in
-- ============================================================
--
-- Nur fanbus.operations.manage.
-- M330-Lock wird vor jeder fachlichen Mutation ausgeführt.

create or replace function app_private.api_fanbus_checkin_set(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid :=
    app_private.require_capability(
      'fanbus.operations.manage'
    );

  v_trip uuid :=
    app_private.m330_payload_trip_id(
      p_payload,
      'PARTICIPANT_ID'
    );

  v_participant uuid :=
    app_private.m325_parse_uuid(
      p_payload ->> 'participantId',
      'FANBUS_CHECKIN_INVALID_PAYLOAD'
    );

  v_expected integer :=
    (p_payload ->> 'expectedRevision')::integer;

  v_status text :=
    upper(
      btrim(
        coalesce(
          p_payload ->> 'status',
          ''
        )
      )
    );

  v_checkin
    app_modules.fanbus_participant_checkins%rowtype;

  v_registration
    app_modules.fanbus_registrations%rowtype;
begin
  if v_trip is not null then
    perform app_private.m330_lock_mutable_fanbus_trip(
      v_trip
    );
  end if;

  if v_status not in (
    'OPEN',
    'PRESENT',
    'NO_SHOW'
  )
  or v_expected is null then
    raise exception 'FANBUS_CHECKIN_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select r.*
  into v_registration
  from app_modules.fanbus_registrations as r
  where r.id = v_participant
  for update;

  if not found
     or v_registration.status <> 'ACTIVE' then
    raise exception
      'FANBUS_CHECKIN_REQUIRES_ACTIVE_PARTICIPANT'
      using errcode = '22023';
  end if;

  select *
  into v_checkin
  from app_modules.fanbus_participant_checkins
  where participant_id = v_participant
    and checkin_kind = 'OUTBOUND'
  for update;

  if not found then
    insert into app_modules.fanbus_participant_checkins (
      participant_id,
      trip_id,
      checkin_kind,
      status,
      updated_by
    )
    values (
      v_participant,
      v_registration.trip_id,
      'OUTBOUND',
      'OPEN',
      v_actor
    )
    returning *
    into v_checkin;
  end if;

  if v_checkin.revision <> v_expected then
    raise exception 'STALE_REVISION_OR_NOT_FOUND'
      using errcode = '40001';
  end if;

  update app_modules.fanbus_participant_checkins
  set
    status = v_status,
    status_changed_at = clock_timestamp(),
    revision = revision + 1,
    updated_by = v_actor
  where id = v_checkin.id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_CHECKIN_CHANGED',
    'fanbus_participant_checkin',
    v_checkin.id::text,
    jsonb_build_object(
      'status',
      v_checkin.status
    ),
    jsonb_build_object(
      'status',
      v_status
    ),
    jsonb_build_object(
      'tripId',
      v_registration.trip_id,
      'participantId',
      v_participant,
      'oldStatus',
      v_checkin.status,
      'newStatus',
      v_status
    )
  );

  return app_private.api_fanbus_operations_snapshot(
    jsonb_build_object(
      'tripId',
      v_registration.trip_id
    )
  );
end;
$$;

-- ============================================================
-- 3. Manueller Bezahlt-Marker
-- ============================================================
--
-- Nur fanbus.payment_marker.manage.
-- Keine Finance-Capability.
-- M330-Lock bleibt erhalten.

create or replace function app_private.api_fanbus_paid_set(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid :=
    app_private.require_capability(
      'fanbus.payment_marker.manage'
    );

  v_trip uuid :=
    app_private.m330_payload_trip_id(
      p_payload,
      'PARTICIPANT_ID'
    );

  v_participant uuid :=
    app_private.m325_parse_uuid(
      p_payload ->> 'participantId',
      'FANBUS_PAID_INVALID_PAYLOAD'
    );

  v_expected integer;
  v_paid boolean;

  v_checkin
    app_modules.fanbus_participant_checkins%rowtype;

  v_registration
    app_modules.fanbus_registrations%rowtype;
begin
  if v_trip is not null then
    perform app_private.m330_lock_mutable_fanbus_trip(
      v_trip
    );
  end if;

  begin
    v_expected :=
      (p_payload ->> 'expectedRevision')::integer;

    if lower(
      coalesce(
        p_payload ->> 'isPaid',
        ''
      )
    ) = 'true' then
      v_paid := true;

    elsif lower(
      coalesce(
        p_payload ->> 'isPaid',
        ''
      )
    ) = 'false' then
      v_paid := false;

    else
      raise exception 'invalid paid flag';
    end if;

  exception
    when others then
      raise exception 'FANBUS_PAID_INVALID_PAYLOAD'
        using errcode = '22023';
  end;

  if v_expected is null
     or v_expected <= 0 then
    raise exception 'FANBUS_PAID_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select r.*
  into v_registration
  from app_modules.fanbus_registrations as r
  where r.id = v_participant
  for update;

  if not found
     or v_registration.status <> 'ACTIVE' then
    raise exception
      'FANBUS_PAID_REQUIRES_ACTIVE_PARTICIPANT'
      using errcode = '22023';
  end if;

  select *
  into v_checkin
  from app_modules.fanbus_participant_checkins
  where participant_id = v_participant
    and checkin_kind = 'OUTBOUND'
  for update;

  if not found then
    insert into app_modules.fanbus_participant_checkins (
      participant_id,
      trip_id,
      checkin_kind,
      status,
      is_paid,
      updated_by
    )
    values (
      v_participant,
      v_registration.trip_id,
      'OUTBOUND',
      'OPEN',
      false,
      v_actor
    )
    returning *
    into v_checkin;
  end if;

  if v_checkin.revision <> v_expected then
    raise exception 'STALE_REVISION_OR_NOT_FOUND'
      using errcode = '40001';
  end if;

  update app_modules.fanbus_participant_checkins
  set
    is_paid = v_paid,
    revision = revision + 1,
    updated_by = v_actor
  where id = v_checkin.id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PAID_MARKER_CHANGED',
    'fanbus_participant_checkin',
    v_checkin.id::text,
    jsonb_build_object(
      'isPaid',
      v_checkin.is_paid
    ),
    jsonb_build_object(
      'isPaid',
      v_paid
    ),
    jsonb_build_object(
      'tripId',
      v_registration.trip_id,
      'participantId',
      v_participant
    )
  );

  return app_private.api_fanbus_operations_snapshot(
    jsonb_build_object(
      'tripId',
      v_registration.trip_id
    )
  );
end;
$$;

revoke all on function
  app_private.api_fanbus_operations_snapshot(jsonb),
  app_private.api_fanbus_checkin_set(jsonb),
  app_private.api_fanbus_paid_set(jsonb)
from public, anon, authenticated, service_role;

comment on function
  app_private.api_fanbus_operations_snapshot(jsonb)
is
  'M010-R2: schmales operatives Fanbus-Read-Model für Teilnehmerverwaltung, Fahrtbetrieb oder Bezahlt-Marker.';

comment on function
  app_private.api_fanbus_checkin_set(jsonb)
is
  'M010-R2: Check-in ausschließlich über fanbus.operations.manage; M330-Stornierungssperre bleibt aktiv.';

comment on function
  app_private.api_fanbus_paid_set(jsonb)
is
  'M010-R2: manueller Bezahlt-Marker ausschließlich über fanbus.payment_marker.manage; keine Finance-Kopplung.';
