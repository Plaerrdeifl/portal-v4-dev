begin;

create or replace function app_private.api_fanbus_bookings_merge(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_target app_modules.fanbus_bookings%rowtype;
  v_source_id uuid;
  v_source_ids uuid[];
  v_all_ids uuid[];
  v_preference text:=upper(btrim(coalesce(p_payload->>'busPreference','')));
  v_bus_id uuid;
  v_override_mode text:=upper(btrim(coalesce(p_payload->>'overrideMode','KEEP')));
  v_before jsonb;
  v_source_numbers jsonb;
  v_primary uuid;
  v_temp_base integer;
begin
  if jsonb_typeof(p_payload)<>'object' or not p_payload?&array[
      'targetBookingId','sourceBookingIds','busPreference','busId','overrideMode']
    or exists(select 1 from jsonb_object_keys(p_payload) key(name) where key.name<>all(array[
      'targetBookingId','sourceBookingIds','busPreference','busId','overrideMode']))
    or jsonb_typeof(p_payload->'sourceBookingIds')<>'array'
    or jsonb_array_length(p_payload->'sourceBookingIds')<1
    or v_preference not in ('EGAL','RUHIG','PARTY')
    or v_override_mode not in ('KEEP','ALIGN') then
    raise exception 'FANBUS_BOOKING_MERGE_INVALID_PAYLOAD' using errcode='22023';
  end if;

  begin
    select * into v_target
    from app_modules.fanbus_bookings
    where id=(p_payload->>'targetBookingId')::uuid
    for update;

    v_bus_id:=nullif(btrim(coalesce(p_payload->>'busId','')),'')::uuid;

    select array_agg((item.value#>>'{}')::uuid order by item.ordinality)
    into v_source_ids
    from jsonb_array_elements(p_payload->'sourceBookingIds')
      with ordinality item(value,ordinality);
  exception when others then
    raise exception 'FANBUS_BOOKING_MERGE_INVALID_PAYLOAD' using errcode='22023';
  end;

  if not found
    or v_target.merged_into_booking_id is not null
    or v_target.id=any(v_source_ids)
    or cardinality(v_source_ids)<>cardinality(array(select distinct unnest(v_source_ids))) then
    raise exception 'FANBUS_BOOKING_MERGE_INVALID_PAYLOAD' using errcode='22023';
  end if;

  v_all_ids:=array_prepend(v_target.id,v_source_ids);

  perform app_private.m330_lock_mutable_fanbus_trip(v_target.trip_id);

  if (
    select count(*)
    from app_modules.fanbus_bookings booking
    where booking.id=any(v_all_ids)
      and booking.trip_id=v_target.trip_id
      and booking.merged_into_booking_id is null
  )<>cardinality(v_all_ids) then
    raise exception 'FANBUS_BOOKING_MERGE_TRIP_CONFLICT' using errcode='22023';
  end if;

  perform 1
  from app_modules.fanbus_bookings
  where id=any(v_all_ids)
  order by id
  for update;

  select
    jsonb_agg(
      jsonb_build_object(
        'bookingId',booking.id,
        'bookingNumber',booking.booking_number,
        'participantIds',app_private.fanbus_booking_current_participant_ids(booking.id)
      )
      order by booking.booking_number
    ),
    jsonb_agg(booking.booking_number order by booking.booking_number)
  into v_before,v_source_numbers
  from app_modules.fanbus_bookings booking
  where booking.id=any(v_all_ids);

  update app_modules.fanbus_registrations
  set booking_role='COMPANION'
  where booking_id=any(v_source_ids)
    and booking_role='PRIMARY';

  /*
   * The old implementation added the same fixed offset to every source row.
   * Two different source bookings can both contain sequence 1, which becomes
   * 1000001 twice and violates (booking_id, participant_sequence) as soon as
   * both rows are moved into the target booking.
   *
   * Move every participant of all involved bookings to one globally unique,
   * collision-free temporary range first. The range starts above every
   * existing sequence in the involved bookings, so the non-deferrable unique
   * index stays valid during every row update.
   */
  select coalesce(max(registration.participant_sequence),0)+1000000
  into v_temp_base
  from app_modules.fanbus_registrations registration
  where registration.booking_id=any(v_all_ids);

  with ranked as (
    select
      registration.id,
      row_number() over (
        order by
          case when registration.booking_id=v_target.id then 0 else 1 end,
          registration.booking_id,
          registration.participant_sequence,
          registration.id
      )::integer as temporary_rank
    from app_modules.fanbus_registrations registration
    where registration.booking_id=any(v_all_ids)
  )
  update app_modules.fanbus_registrations registration
  set participant_sequence=v_temp_base+ranked.temporary_rank
  from ranked
  where registration.id=ranked.id;

  update app_modules.fanbus_registrations
  set booking_id=v_target.id
  where booking_id=any(v_source_ids);

  select id into v_primary
  from app_modules.fanbus_registrations
  where booking_id=v_target.id
    and booking_role='PRIMARY'
  order by participant_sequence,id
  limit 1;

  if v_primary is null then
    select id into v_primary
    from app_modules.fanbus_registrations
    where booking_id=v_target.id
    order by
      case when status in ('ACTIVE','WAITLISTED') then 0 else 1 end,
      participant_sequence,
      id
    limit 1;

    update app_modules.fanbus_registrations
    set booking_role='PRIMARY'
    where id=v_primary;
  end if;

  /*
   * Final numbering is also set-based. Because every current sequence is in
   * the high temporary range, assigning 1..N cannot collide with an unupdated
   * row while the unique index is checked row by row.
   */
  with ranked as (
    select
      registration.id,
      row_number() over (
        order by
          case when registration.id=v_primary then 0 else 1 end,
          registration.participant_sequence,
          registration.id
      )::integer as final_sequence
    from app_modules.fanbus_registrations registration
    where registration.booking_id=v_target.id
  )
  update app_modules.fanbus_registrations registration
  set
    participant_sequence=ranked.final_sequence,
    booking_role=case
      when registration.id=v_primary then 'PRIMARY'
      else 'COMPANION'
    end
  from ranked
  where registration.id=ranked.id;

  update app_modules.fanbus_bookings
  set
    merged_into_booking_id=v_target.id,
    merged_at=clock_timestamp(),
    merged_by=v_actor,
    revision=revision+1,
    updated_by=v_actor
  where id=any(v_source_ids);

  update app_modules.fanbus_bookings
  set
    group_bus_preference=v_preference,
    revision=revision+1,
    updated_by=v_actor
  where id=v_target.id;

  update app_modules.fanbus_registrations
  set
    bus_preference=v_preference,
    bus_preference_override=case
      when v_override_mode='ALIGN' then false
      else bus_preference_override
    end
  where booking_id=v_target.id
    and status in ('ACTIVE','WAITLISTED')
    and (v_override_mode='ALIGN' or not bus_preference_override);

  perform app_private.fanbus_booking_apply_group_bus(
    v_target.id,
    v_bus_id,
    v_actor,
    v_override_mode='ALIGN'
  );

  perform app_private.log_audit(
    v_actor,
    'FANBUS_BOOKINGS_MERGED',
    'fanbus_booking',
    v_target.id::text,
    v_before,
    jsonb_build_object(
      'targetBookingId',v_target.id,
      'participantIds',app_private.fanbus_booking_current_participant_ids(v_target.id)
    ),
    jsonb_build_object(
      'tripId',v_target.trip_id,
      'bookingId',v_target.id,
      'sourceBookingIds',to_jsonb(v_source_ids),
      'sourceBookingNumbers',v_source_numbers,
      'targetBookingId',v_target.id,
      'targetBookingNumber',v_target.booking_number,
      'participantIds',app_private.fanbus_booking_current_participant_ids(v_target.id),
      'scope','BOOKING_MERGE',
      'overrideMode',v_override_mode
    )
  );

  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId',v_target.trip_id)
  );
end;
$function$;

revoke all on function app_private.api_fanbus_bookings_merge(jsonb)
from public,anon,authenticated,service_role;

grant execute on function app_private.api_fanbus_bookings_merge(jsonb)
to postgres;

commit;
