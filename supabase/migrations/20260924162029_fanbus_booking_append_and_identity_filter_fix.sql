-- Keep the operator booking UI and protected registration projection on the same identity contract.
-- Existing ACTIVE/WAITLISTED regular riders must be identifiable by the browser so they can be filtered out.

create or replace function app_private.api_fanbus_registrations_list(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_base jsonb:=app_private.api_fanbus_registrations_list_before_travel_groups_r1(p_payload);
  v_items jsonb;
begin
  select coalesce(jsonb_agg(
    item.value||jsonb_strip_nulls(jsonb_build_object(
      'regularRiderId',registration.regular_rider_id,
      'travelGroupId',travel_group.id,
      'travelGroupName',travel_group.name,
      'travelGroupBusPreference',travel_group.bus_preference,
      'travelGroupBusId',travel_group.bus_id,
      'travelGroupRevision',travel_group.revision,
      'travelGroupBookingCount',case when travel_group.id is null then null else (
        select count(*)::integer
        from app_modules.fanbus_bookings sibling_booking
        where sibling_booking.travel_group_id=travel_group.id
          and sibling_booking.merged_into_booking_id is null
          and exists (
            select 1 from app_modules.fanbus_registrations sibling_registration
            where sibling_registration.booking_id=sibling_booking.id
              and sibling_registration.status in ('ACTIVE','WAITLISTED')
          )
      ) end
    ))
    order by item.ordinality
  ),'[]'::jsonb)
  into v_items
  from jsonb_array_elements(coalesce(v_base->'registrations','[]'::jsonb))
    with ordinality item(value,ordinality)
  join app_modules.fanbus_registrations registration
    on registration.id=(item.value->>'id')::uuid
  join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
  left join app_modules.fanbus_travel_groups travel_group on travel_group.id=booking.travel_group_id;

  return jsonb_set(v_base,'{registrations}',v_items,true);
end;
$function$;
