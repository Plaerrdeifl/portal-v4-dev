-- Plaerrdeifl Digitalplattform V4
-- Remote-compatible public Fanbus projection.
-- DEV history does not have the local M328 completion predecessor names,
-- so rebuild the public projection from the stable joint-preferences predecessor.

begin;

create or replace function public.pd_public_fanbus_trip(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_base jsonb := public.pd_public_fanbus_trip_before_joint_f1(p_trip_id);
  v_default_trip_stop uuid;
begin
  if coalesce((v_base ->> 'available')::boolean, false) is not true then
    return v_base;
  end if;

  select resolved.trip_boarding_stop_id into v_default_trip_stop
  from app_private.fanbus_resolve_trip_boarding_stop(
    p_trip_id, null, null, 'NONE'
  ) as resolved;

  return v_base || jsonb_build_object(
    'defaultTripBoardingStopId', v_default_trip_stop,
    'busPreferenceSelectionEnabled',
      app_private.fanbus_bus_preference_selection_enabled(p_trip_id),
    'allowedBusPreferences',
      app_private.fanbus_allowed_bus_preferences(p_trip_id)
  );
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
  v_base jsonb := public.pd_public_fanbus_trips_before_joint_f1();
begin
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(
        item.value || jsonb_build_object(
          'defaultTripBoardingStopId', resolved.trip_boarding_stop_id,
          'busPreferenceSelectionEnabled',
            app_private.fanbus_bus_preference_selection_enabled(trip.id),
          'allowedBusPreferences',
            app_private.fanbus_allowed_bus_preferences(trip.id)
        ) order by item.ordinality
      )
      from jsonb_array_elements(coalesce(v_base -> 'trips', '[]'::jsonb))
        with ordinality as item(value, ordinality)
      join app_modules.fanbus_trips as trip
        on trip.id = (item.value ->> 'tripId')::uuid
      cross join lateral app_private.fanbus_resolve_trip_boarding_stop(
        trip.id, null, null, 'NONE'
      ) as resolved
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function
  public.pd_public_fanbus_trip(uuid),
  public.pd_public_fanbus_trips()
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_public_fanbus_trip(uuid),
  public.pd_public_fanbus_trips()
to anon, authenticated;

comment on function public.pd_public_fanbus_trip(uuid) is
  'Remote-compatible public Fanbus projection based on the stable joint-preferences predecessor.';
comment on function public.pd_public_fanbus_trips() is
  'Remote-compatible public Fanbus list based on the stable joint-preferences predecessor.';

commit;
