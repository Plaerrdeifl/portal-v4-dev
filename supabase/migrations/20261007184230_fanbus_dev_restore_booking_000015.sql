begin;

-- Deliberately fail closed: this restores one verified DEV acceptance fixture.
-- No replacement booking, identity edits, historical timestamp cleanup or auto assignment.
do $repair$
declare
  v_booking_id constant uuid := 'cfad5b80-2921-4790-839d-703d9bdf8fe6';
  v_participant_id constant uuid := 'ba837b6e-8d48-4c9b-8c05-04f573fd2e5d';
  v_trip_id constant uuid := 'f1a464d2-5068-478c-80b5-58b6ce6feca6';
  v_bus_id constant uuid := 'f2c9b33f-9d78-479b-9c66-30e702b04ffd';
  v_stop_id constant uuid := '000c602d-3e32-4622-ab87-e6b539ca55f2';
  v_booking app_modules.fanbus_bookings%rowtype;
  v_person app_modules.fanbus_registrations%rowtype;
  v_bus app_modules.fanbus_buses%rowtype;
  v_cancel app_portal.audit_events%rowtype;
  v_unassign app_portal.audit_events%rowtype;
  v_booking_cancel app_portal.audit_events%rowtype;
begin
  -- A clean, unconfigured schema rebuild has no DEV fixture to restore. This
  -- exception is limited to an entirely empty Fanbus baseline, never live DEV.
  if app_private.platform_release_environment() is null
     and not exists(select 1 from app_modules.fanbus_trips)
     and not exists(select 1 from app_modules.fanbus_bookings)
     and not exists(select 1 from app_modules.fanbus_registrations) then
    raise notice 'FANBUS_DEV_REPAIR_EMPTY_SCHEMA_REBUILD: no data mutation';
    return;
  end if;
  if app_private.platform_release_environment() is distinct from 'DEV' then
    raise exception 'FANBUS_DEV_REPAIR_ENVIRONMENT_MISMATCH';
  end if;

  -- Serialize with trip mutations and prevent an unrelated concurrent assignment
  -- from invalidating capacity/identity checks during this one-off migration.
  perform 1 from app_modules.fanbus_trips where id=v_trip_id for update;
  if not found then raise exception 'FANBUS_DEV_REPAIR_TRIP_MISSING'; end if;
  lock table app_modules.fanbus_registrations in share row exclusive mode;
  lock table app_modules.fanbus_bus_assignments in share row exclusive mode;

  select * into v_booking from app_modules.fanbus_bookings where id=v_booking_id for update;
  if not found or v_booking.booking_number is distinct from 'FB-26-000015'
     or v_booking.trip_id is distinct from v_trip_id
     or v_booking.merged_into_booking_id is not null then
    raise exception 'FANBUS_DEV_REPAIR_BOOKING_MISMATCH';
  end if;

  select * into v_person from app_modules.fanbus_registrations where id=v_participant_id for update;
  if not found or v_person.booking_id is distinct from v_booking_id
     or v_person.trip_id is distinct from v_trip_id
     or v_person.booking_role is distinct from 'PRIMARY'
     or v_person.status is distinct from 'CANCELLED'
     or v_person.revision is distinct from 2
     or v_person.cancelled_at is null
     or v_person.trip_boarding_stop_id is distinct from v_stop_id then
    raise exception 'FANBUS_DEV_REPAIR_PARTICIPANT_MISMATCH';
  end if;

  select * into v_cancel from app_portal.audit_events
  where id=1321 and action='FANBUS_PARTICIPANT_CANCELLED'
    and entity_type='fanbus_registration' and entity_id=v_participant_id::text
    and before_data @> '{"status":"ACTIVE","revision":1}'::jsonb
    and after_data @> '{"status":"CANCELLED","revision":2}'::jsonb
    and metadata @> jsonb_build_object('tripId',v_trip_id,'bookingId',v_booking_id,'participantId',v_participant_id);
  if not found then raise exception 'FANBUS_DEV_REPAIR_CANCELLATION_AUDIT_MISMATCH'; end if;

  select * into v_unassign from app_portal.audit_events
  where id=1320 and action='FANBUS_BUS_UNASSIGNED'
    and entity_type='fanbus_registration' and entity_id=v_participant_id::text
    and occurred_at=v_cancel.occurred_at
    and before_data->>'busId'=v_bus_id::text
    and metadata @> jsonb_build_object('busId',v_bus_id,'tripId',v_trip_id,'bookingId',v_booking_id,'participantId',v_participant_id);
  if not found then raise exception 'FANBUS_DEV_REPAIR_UNASSIGN_AUDIT_MISMATCH'; end if;

  select * into v_booking_cancel from app_portal.audit_events
  where id=1322 and action='FANBUS_BOOKING_OPERATOR_CANCELLED'
    and entity_type='fanbus_booking' and entity_id=v_booking_id::text
    and occurred_at=v_cancel.occurred_at
    and metadata @> jsonb_build_object('tripId',v_trip_id,'bookingId',v_booking_id,'participantCount',1);
  if not found then raise exception 'FANBUS_DEV_REPAIR_BOOKING_AUDIT_MISMATCH'; end if;

  select * into v_bus from app_modules.fanbus_buses where id=v_bus_id for update;
  if not found or v_bus.trip_id is distinct from v_trip_id or not v_bus.is_active then
    raise exception 'FANBUS_DEV_REPAIR_BUS_MISMATCH';
  end if;
  if (select count(*) from app_modules.fanbus_bus_assignments a
      join app_modules.fanbus_registrations r on r.id=a.participant_id
      where a.bus_id=v_bus_id and r.status='ACTIVE') >= v_bus.capacity then
    raise exception 'FANBUS_DEV_REPAIR_BUS_FULL';
  end if;
  if not exists (select 1 from app_modules.fanbus_bus_boarding_stops s
      join app_modules.fanbus_trip_boarding_stops stop on stop.id=s.trip_boarding_stop_id
      where s.bus_id=v_bus_id and s.trip_id=v_trip_id and s.trip_boarding_stop_id=v_stop_id
        and stop.trip_id=v_trip_id and stop.is_active) then
    raise exception 'FANBUS_DEV_REPAIR_STOP_MISMATCH';
  end if;
  if exists(select 1 from app_modules.fanbus_bus_assignments where participant_id=v_participant_id) then
    raise exception 'FANBUS_DEV_REPAIR_ALREADY_ASSIGNED';
  end if;
  if exists(select 1 from app_modules.fanbus_registrations r
      where r.trip_id=v_trip_id and r.id<>v_participant_id and r.status in ('ACTIVE','WAITLISTED')
        and ((v_person.email is not null and lower(btrim(r.email))=lower(btrim(v_person.email)))
          or (v_person.portal_user_id is not null and r.portal_user_id=v_person.portal_user_id)
          or (v_person.member_id is not null and r.member_id=v_person.member_id)
          or (v_person.regular_rider_id is not null and r.regular_rider_id=v_person.regular_rider_id)
          or (v_person.source='MANUAL' and v_person.email is null and v_person.portal_user_id is null
              and v_person.member_id is null and v_person.regular_rider_id is null
              and r.source='MANUAL' and r.email is null and r.portal_user_id is null
              and r.member_id is null and r.regular_rider_id is null
              and lower(btrim(r.first_name))=lower(btrim(v_person.first_name))
              and lower(btrim(r.last_name))=lower(btrim(v_person.last_name))))) then
    raise exception 'FANBUS_DEV_REPAIR_LIVE_IDENTITY_CONFLICT';
  end if;

  -- Re-check trip-level admission immediately before both mutations. The
  -- historical bus can still have a free seat while the effective trip
  -- capacity (the sum of all active buses) is already exhausted.
  if (select count(*) from app_modules.fanbus_registrations r
      where r.trip_id=v_trip_id and r.status='ACTIVE')
      >= app_private.fanbus_effective_capacity(v_trip_id) then
    raise exception 'FANBUS_DEV_REPAIR_EFFECTIVE_CAPACITY_EXHAUSTED';
  end if;
  if exists(select 1 from app_modules.fanbus_registrations r
      where r.trip_id=v_trip_id and r.status='WAITLISTED') then
    raise exception 'FANBUS_DEV_REPAIR_WAITLIST_PRESENT';
  end if;

  -- All assertions precede both mutations under the existing locks. Existing
  -- history stays intact.
  update app_modules.fanbus_registrations
  set status='ACTIVE',cancelled_at=null,revision=revision+1,updated_by=null
  where id=v_participant_id;
  insert into app_modules.fanbus_bus_assignments
    (participant_id,trip_id,bus_id,assignment_source,created_by,updated_by)
  values(v_participant_id,v_trip_id,v_bus_id,'MANUAL',null,null);

  perform app_private.log_audit(null,'FANBUS_DEV_ACCEPTANCE_BOOKING_RESTORED','fanbus_booking',v_booking_id::text,
    jsonb_build_object('status',v_person.status,'revision',v_person.revision),
    jsonb_build_object('status','ACTIVE','revision',v_person.revision+1),
    jsonb_build_object('environment','DEV','devRepair',true,'bookingId',v_booking_id,
      'bookingNumber',v_booking.booking_number,'participantId',v_participant_id,'tripId',v_trip_id,
      'restoredBusId',v_bus_id,'assignmentSource','MANUAL',
      'previousCancellationAuditId',v_cancel.id,'previousBusUnassignmentAuditId',v_unassign.id,
      'previousBookingCancellationAuditId',v_booking_cancel.id,
      'reason','Restore test booking cancelled during Slice 6 DEV acceptance'));
end;
$repair$;

commit;
