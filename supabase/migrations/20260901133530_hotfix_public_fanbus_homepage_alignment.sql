-- PROD hotfix: keep the public Fanbus homepage aligned with the portal app.
-- Public consumers must only see active/published trips, and per-trip
-- boarding-stop notes remain internal Bus-Orga data.

create or replace function public.pd_public_fanbus_trips()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_base jsonb := public.pd_public_fanbus_trips_before_joint_f1();
  v_contact jsonb := app_private.fanbus_public_organization_contact();
begin
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(
        item.value || jsonb_build_object(
          'defaultTripBoardingStopId', resolved.trip_boarding_stop_id,
          'busPreferenceSelectionEnabled', app_private.fanbus_bus_preference_selection_enabled(trip.id),
          'allowedBusPreferences', app_private.fanbus_allowed_bus_preferences(trip.id),
          'organizationContact', v_contact
        ) order by item.ordinality
      )
      from jsonb_array_elements(coalesce(v_base -> 'trips', '[]'::jsonb))
        with ordinality as item(value, ordinality)
      join app_modules.fanbus_trips as trip
        on trip.id = (item.value ->> 'tripId')::uuid
      cross join lateral app_private.fanbus_resolve_trip_boarding_stop(
        trip.id, null, null, 'NONE'
      ) as resolved
      where trip.status = 'PUBLISHED'
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.pd_public_fanbus_trip_boarding_stops(p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
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
          'defaultNote', stop.default_note,
          'departureAt', trip_stop.departure_at,
          'tripNote', null,
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
$function$;
