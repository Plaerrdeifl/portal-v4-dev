-- Fanbus Slice 2 privacy fix: booking creators keep the complete booking,
-- while co-booked portal users receive only their own participant row.
create or replace function app_private.api_fanbus_my_bookings_list(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_payload <> '{}'::jsonb then
    raise exception 'FANBUS_MY_BOOKINGS_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'serverNow', clock_timestamp(),
    'organizationContact', app_private.fanbus_public_organization_contact(),
    'bookings', coalesce((
      with owned_bookings as (
        select booking.*,
          (booking.source = 'PORTAL' and booking.created_by = v_actor) as is_creator
        from app_modules.fanbus_bookings as booking
        where (booking.source = 'PORTAL' and booking.created_by = v_actor)
           or exists (
             select 1 from app_modules.fanbus_registrations as own
             where own.booking_id = booking.id and own.portal_user_id = v_actor
           )
      )
      select jsonb_agg(jsonb_build_object(
        'bookingId', booking.id,
        'tripId', trip.id,
        'isCreator', booking.is_creator,
        'source', booking.source,
        'trip', jsonb_build_object(
          'title', coalesce(
            nullif(btrim(game.opponent_name), ''),
            nullif(btrim(event.title), ''),
            'Fanbusfahrt'
          ),
          'eventDate', event.event_date,
          'eventTime', event.event_time,
          'departureAt', trip.departure_at,
          'departureInfo', trip.departure_info,
          'status', trip.status,
          'selfServiceUntil', app_private.fanbus_selfservice_until(trip.departure_at),
          'canMutate', trip.status = 'PUBLISHED'
            and trip.departure_at is not null
            and clock_timestamp() < app_private.fanbus_selfservice_until(trip.departure_at),
          'readOnlyReason', case
            when trip.status = 'DRAFT' then 'DRAFT'
            when trip.status = 'CLOSED' then 'CLOSED'
            when trip.status = 'CANCELLED' then 'CANCELLED'
            when trip.departure_at is null
              or clock_timestamp() >= app_private.fanbus_selfservice_until(trip.departure_at)
              then 'CUTOFF'
            else null end,
          'boardingStops', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', trip_stop.id,
              'label', stop.label,
              'departureAt', trip_stop.departure_at
            ) order by trip_stop.position, trip_stop.id)
            from app_modules.fanbus_trip_boarding_stops as trip_stop
            join app_modules.fanbus_boarding_stops as stop
              on stop.id = trip_stop.boarding_stop_id
            where trip_stop.trip_id = trip.id and trip_stop.is_active
          ), '[]'::jsonb),
          'allowedBusPreferences', app_private.fanbus_allowed_bus_preferences(trip.id)
        ),
        'participants', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', registration.id,
            'revision', registration.revision,
            'isSelf', registration.portal_user_id = v_actor,
            'firstName', registration.first_name,
            'lastName', registration.last_name,
            'status', registration.status,
            'bookingRole', registration.booking_role,
            'participantSequence', registration.participant_sequence,
            'tripBoardingStopId', registration.trip_boarding_stop_id,
            'boardingStopLabel', boarding_stop.label,
            'busPreference', registration.bus_preference,
            'assignedBusLabel', bus.label,
            'waitlistPosition', case when registration.status = 'WAITLISTED' then (
              select count(*)::integer
              from app_modules.fanbus_registrations as waiting
              where waiting.trip_id = registration.trip_id
                and waiting.status = 'WAITLISTED'
                and (waiting.waitlisted_at, waiting.participant_sequence, waiting.id)
                  <= (registration.waitlisted_at, registration.participant_sequence, registration.id)
            ) end
          ) order by registration.participant_sequence, registration.id)
          from app_modules.fanbus_registrations as registration
          left join app_modules.fanbus_trip_boarding_stops as trip_stop
            on trip_stop.id = registration.trip_boarding_stop_id
          left join app_modules.fanbus_boarding_stops as boarding_stop
            on boarding_stop.id = trip_stop.boarding_stop_id
          left join app_modules.fanbus_bus_assignments as assignment
            on assignment.participant_id = registration.id
          left join app_modules.fanbus_buses as bus on bus.id = assignment.bus_id
          where registration.booking_id = booking.id
            and (booking.is_creator or registration.portal_user_id = v_actor)
        ), '[]'::jsonb)
      ) order by trip.departure_at desc nulls last, booking.created_at desc)
      from owned_bookings as booking
      join app_modules.fanbus_trips as trip on trip.id = booking.trip_id
      join app_modules.events as event on event.id = trip.event_id
      left join app_modules.event_games as game on game.event_id = event.id
    ), '[]'::jsonb)
  );
end;
$function$;

comment on function app_private.api_fanbus_my_bookings_list(jsonb) is
  'Returns complete creator bookings, but only the actor participant row for non-creator bookings.';
