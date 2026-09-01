-- Plärrdeifl Digitalplattform V4
-- P300 / M327 acceptance: expose the centrally maintained boarding-stop
-- address and default note wherever a concrete trip stop is read.
-- No write contract or trip-specific business rule changes.

create or replace function app_private.api_fanbus_trip_boarding_stops_list(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_trip uuid := app_private.m325_parse_uuid(
    p_payload ->> 'tripId',
    'FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD'
  );
begin
  if not app_private.has_capability(v_actor, 'fanbus.manage')
     and not app_private.has_capability(v_actor, 'fanbus.registrations.manage') then
    raise exception 'Berechtigung fehlt: fanbus.manage oder fanbus.registrations.manage'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'tripId', v_trip,
    'stops', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', trip_stop.id,
          'tripBoardingStopId', trip_stop.id,
          'boardingStopId', trip_stop.boarding_stop_id,
          'label', stop.label,
          'address', stop.address,
          'defaultNote', stop.default_note,
          'departureAt', trip_stop.departure_at,
          'position', trip_stop.position,
          'tripNote', trip_stop.trip_note,
          'isActive', trip_stop.is_active,
          'revision', trip_stop.revision
        ) order by trip_stop.position, trip_stop.id
      )
      from app_modules.fanbus_trip_boarding_stops as trip_stop
      join app_modules.fanbus_boarding_stops as stop
        on stop.id = trip_stop.boarding_stop_id
      where trip_stop.trip_id = v_trip
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.pd_public_fanbus_trip_boarding_stops(p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
          'defaultNote', stop.default_note,
          'departureAt', trip_stop.departure_at,
          'tripNote', trip_stop.trip_note,
          'position', trip_stop.position
        ) order by trip_stop.position, trip_stop.id
      )
      from app_modules.fanbus_trip_boarding_stops as trip_stop
      join app_modules.fanbus_boarding_stops as stop
        on stop.id = trip_stop.boarding_stop_id
      join app_modules.fanbus_trips as trip
        on trip.id = trip_stop.trip_id
      join app_modules.events as event
        on event.id = trip.event_id
      where trip_stop.trip_id = p_trip_id
        and trip_stop.is_active
        and trip.status = 'PUBLISHED'
        and event.visibility = 'PUBLIC'
    ), '[]'::jsonb)
  );
$$;

revoke all on function app_private.api_fanbus_trip_boarding_stops_list(jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.pd_public_fanbus_trip_boarding_stops(uuid)
from public, anon, authenticated;
grant execute on function public.pd_public_fanbus_trip_boarding_stops(uuid)
to anon, authenticated;
