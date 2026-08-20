-- Plaerrdeifl Portal V4
-- P800 / M010-R2
-- F1-B2: Fanbus-Lesezugriffe passend zum granularen Rechtemodell.

-- ============================================================
-- 1. Fahrtenliste
-- ============================================================
--
-- Fachlich internen Fahrtenzugriff erhalten Benutzer mit mindestens
-- einer der vier granularen Fanbus-Capabilities.
--
-- Mutationsrechte bleiben davon vollständig getrennt.

create or replace function app_private.api_fanbus_trips_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();

  v_can_manage boolean :=
    app_private.has_capability(
      v_actor,
      'fanbus.manage'
    );

  v_can_manage_registrations boolean :=
    app_private.has_capability(
      v_actor,
      'fanbus.registrations.manage'
    );

  v_can_manage_operations boolean :=
    app_private.has_capability(
      v_actor,
      'fanbus.operations.manage'
    );

  v_can_manage_payment_marker boolean :=
    app_private.has_capability(
      v_actor,
      'fanbus.payment_marker.manage'
    );

  v_has_internal_fanbus_access boolean;

  v_now timestamptz := clock_timestamp();

  v_today date :=
    (v_now at time zone 'Europe/Berlin')::date;
begin
  v_has_internal_fanbus_access :=
    v_can_manage
    or v_can_manage_registrations
    or v_can_manage_operations
    or v_can_manage_payment_marker;

  return jsonb_build_object(
    'trips',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            trip.id,

            'eventId',
            event.id,

            'eventType',
            event.event_type,

            'displayTitle',
            case event.event_type
              when 'GAME' then
                case game.home_away
                  when 'HOME' then
                    'Mighty Dogs Schweinfurt – '
                    || game.opponent_name
                  when 'AWAY' then
                    game.opponent_name
                    || ' – Mighty Dogs Schweinfurt'
                  else null
                end
              else event.title
            end,

            'eventDate',
            event.event_date,

            'eventTime',
            event.event_time,

            'venue',
            event.venue,

            'visibility',
            event.visibility,

            'departureAt',
            trip.departure_at,

            'departureInfo',
            trip.departure_info,

            'registrationOpensAt',
            trip.registration_opens_at,

            'registrationClosesAt',
            trip.registration_closes_at,

            'priceCents',
            trip.price_cents,

            'capacity',
            capacity.effective_capacity,

            'privacyReference',
            trip.privacy_reference,

            'termsReference',
            trip.terms_reference,

            'status',
            trip.status,

            'cancellationReason',
            trip.cancellation_reason,

            'cancelledAt',
            trip.cancelled_at,

            'revision',
            trip.revision,

            'activeRegistrationCount',
            registration.active_count,

            'waitlistedRegistrationCount',
            registration.waitlisted_count,

            'affectedBookingCount',
            registration.booking_count,

            'cancellationNotificationNotice',
            'Buchungskontakte erhalten eine Pflicht-E-Mail; Portalnutzer optional Push.',

            'canCancel',
            v_can_manage
            and (
              trip.status = 'PUBLISHED'
              or (
                trip.status = 'CLOSED'
                and exists (
                  select 1
                  from app_portal.audit_events as audit
                  where audit.action =
                        'FANBUS_TRIP_PUBLISHED'
                    and audit.entity_type =
                        'fanbus_trip'
                    and audit.entity_id =
                        trip.id::text
                )
              )
            ),

            'remainingCapacity',
            greatest(
              coalesce(
                capacity.effective_capacity,
                0
              )
              - registration.active_count,
              0
            ),

            'registrationStatus',
            case
              when trip.status = 'CANCELLED'
                then 'CANCELLED'

              when trip.status = 'CLOSED'
                then 'CLOSED'

              when trip.status <> 'PUBLISHED'
                or trip.departure_at is null
                or trip.registration_opens_at is null
                or trip.registration_closes_at is null
                or trip.price_cents is null
                or capacity.effective_capacity <= 0
                or nullif(
                  btrim(trip.privacy_reference),
                  ''
                ) is null
                or nullif(
                  btrim(trip.terms_reference),
                  ''
                ) is null
                or event.visibility <> 'PUBLIC'
                then 'UNAVAILABLE'

              when v_now < trip.registration_opens_at
                then 'NOT_STARTED'

              when v_now >= trip.registration_closes_at
                or v_now >= trip.departure_at
                then 'CLOSED'

              when registration.waitlisted_count > 0
                or registration.active_count >=
                   capacity.effective_capacity
                then 'WAITLIST'

              else 'OPEN'
            end,

            'canManage',
            v_can_manage,

            'canManageRegistrations',
            v_can_manage_registrations,

            'canManageOperations',
            v_can_manage_operations,

            'canManagePaymentMarker',
            v_can_manage_payment_marker
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
          select
            app_private.fanbus_effective_capacity(
              trip.id
            ) as effective_capacity
        ) as capacity

        cross join lateral (
          select
            count(*) filter (
              where status = 'ACTIVE'
            )::integer as active_count,

            count(*) filter (
              where status = 'WAITLISTED'
            )::integer as waitlisted_count,

            count(distinct booking_id) filter (
              where status in (
                'ACTIVE',
                'WAITLISTED'
              )
              and booking_id is not null
            )::integer as booking_count

          from app_modules.fanbus_registrations
          where trip_id = trip.id
        ) as registration

        where (
          v_has_internal_fanbus_access
          and (
            event.event_date >= v_today
            or trip.status in (
              'DRAFT',
              'PUBLISHED',
              'CANCELLED'
            )
          )
        )
        or (
          not v_has_internal_fanbus_access
          and event.event_date >= v_today
          and trip.status in (
            'PUBLISHED',
            'CLOSED',
            'CANCELLED'
          )
        )
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ============================================================
-- 2. Busliste
-- ============================================================
--
-- Buskonfiguration:
--   fanbus.manage
--
-- Busse lesen, um Teilnehmer zuzuordnen:
--   fanbus.registrations.manage
--
-- Operations- und Payment-only benötigen keine separate Busliste,
-- da der Operations-Snapshot die notwendigen Businformationen enthält.

create or replace function app_private.api_fanbus_buses_list(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid :=
    app_private.require_active_user();

  v_trip_id uuid;
begin
  if not (
    app_private.has_capability(
      v_actor,
      'fanbus.manage'
    )
    or app_private.has_capability(
      v_actor,
      'fanbus.registrations.manage'
    )
  ) then
    raise exception
      'Berechtigung fehlt: fanbus.manage oder fanbus.registrations.manage'
      using errcode = '42501';
  end if;

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['tripId']
     or exists (
       select 1
       from jsonb_object_keys(
         p_payload
       ) as payload_key(key)
       where payload_key.key <> 'tripId'
     ) then
    raise exception
      'FANBUS_BUS_LIST_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  begin
    v_trip_id :=
      (p_payload ->> 'tripId')::uuid;
  exception
    when others then
      raise exception
        'FANBUS_BUS_LIST_INVALID_PAYLOAD'
        using errcode = '22023';
  end;

  if not exists (
    select 1
    from app_modules.fanbus_trips
    where id = v_trip_id
  ) then
    raise exception
      'Die Fanbusfahrt wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'tripId',
    v_trip_id,

    'buses',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id',
            bus.id,

            'tripId',
            bus.trip_id,

            'label',
            bus.label,

            'category',
            bus.category,

            'capacity',
            bus.capacity,

            'isActive',
            bus.is_active,

            'revision',
            bus.revision,

            'occupied',
            coalesce(
              occupancy.value,
              0
            ),

            'occupancy',
            coalesce(
              occupancy.value,
              0
            ),

            'remainingCapacity',
            greatest(
              bus.capacity
              - coalesce(
                  occupancy.value,
                  0
                ),
              0
            )
          )
          order by
            bus.is_active desc,
            lower(
              btrim(bus.label)
            ),
            bus.id
        )
        from app_modules.fanbus_buses as bus

        left join lateral (
          select
            count(*)::integer as value
          from app_modules.fanbus_bus_assignments
            as assignment
          join app_modules.fanbus_registrations
            as participant
            on participant.id =
               assignment.participant_id
          where assignment.bus_id = bus.id
            and participant.status = 'ACTIVE'
        ) as occupancy
          on true

        where bus.trip_id = v_trip_id
      ),
      '[]'::jsonb
    ),

    'summary',
    jsonb_build_object(
      'activeCount',
      (
        select count(*)
        from app_modules.fanbus_registrations
        where trip_id = v_trip_id
          and status = 'ACTIVE'
      ),

      'activeBusCapacity',
      coalesce(
        (
          select sum(capacity)
          from app_modules.fanbus_buses
          where trip_id = v_trip_id
            and is_active
        ),
        0
      )
    )
  );
end;
$$;

revoke all on function
  app_private.api_fanbus_trips_list(),
  app_private.api_fanbus_buses_list(jsonb)
from public, anon, authenticated, service_role;

comment on function
  app_private.api_fanbus_trips_list()
is
  'M010-R2: interne Fahrtenansicht für jede granulare Fanbus-Fachberechtigung; Mutationsrechte bleiben getrennt.';

comment on function
  app_private.api_fanbus_buses_list(jsonb)
is
  'M010-R2: Bus-Lesezugriff für Fahrtverwaltung oder Teilnehmerverwaltung.';
