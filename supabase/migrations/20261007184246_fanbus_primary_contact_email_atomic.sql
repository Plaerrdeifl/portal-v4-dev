begin;

-- Optional contactEmail only fills a missing PORTAL/GUEST contact during promotion.
-- Retains the existing capability, trip lock, private API and authoritative projection.
create or replace function app_private.api_fanbus_booking_primary_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_booking_id uuid;
  v_participant_id uuid;
  v_trip_id uuid;
  v_old_primary uuid;
  v_target app_modules.fanbus_registrations%rowtype;
  v_contact_email text;
  v_email_added boolean := false;
  v_constraint text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object'
     or not p_payload ?& array['bookingId','participantId']
     or exists (select 1 from jsonb_object_keys(p_payload) key(name)
       where key.name <> all(array['bookingId','participantId','contactEmail']))
     or (p_payload ? 'contactEmail' and jsonb_typeof(p_payload->'contactEmail') not in ('string','null')) then
    raise exception 'FANBUS_BOOKING_PRIMARY_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin
    v_booking_id := (p_payload->>'bookingId')::uuid;
    v_participant_id := (p_payload->>'participantId')::uuid;
  exception when others then
    raise exception 'FANBUS_BOOKING_PRIMARY_INVALID_PAYLOAD' using errcode='22023';
  end;

  select booking.trip_id into v_trip_id from app_modules.fanbus_bookings booking
  where booking.id=v_booking_id for update;
  if not found then raise exception 'FANBUS_BOOKING_NOT_FOUND' using errcode='P0002'; end if;
  perform app_private.m330_lock_mutable_fanbus_trip(v_trip_id);

  select * into v_target from app_modules.fanbus_registrations registration
  where registration.id=v_participant_id and registration.booking_id=v_booking_id
    and registration.trip_id=v_trip_id and registration.status in ('ACTIVE','WAITLISTED') for update;
  if not found then
    raise exception 'FANBUS_BOOKING_PRIMARY_PARTICIPANT_UNAVAILABLE' using errcode='22023';
  end if;

  if v_target.source in ('PORTAL','GUEST') and nullif(btrim(v_target.email),'') is null then
    v_contact_email := nullif(lower(btrim(p_payload->>'contactEmail')),'');
    if v_contact_email is null then
      raise exception 'FANBUS_BOOKING_PRIMARY_EMAIL_REQUIRED' using errcode='22023';
    end if;
    if not app_private.notification_email_is_valid(v_contact_email) then
      raise exception 'FANBUS_EMAIL_INVALID' using errcode='22023';
    end if;
    -- Same predicate as fanbus_registrations_live_email_uidx, including WAITLISTED.
    if exists(select 1 from app_modules.fanbus_registrations registration
        where registration.trip_id=v_trip_id and registration.id<>v_participant_id
          and registration.status in ('ACTIVE','WAITLISTED') and registration.email is not null
          and lower(btrim(registration.email))=v_contact_email) then
      raise exception 'FANBUS_PARTICIPANT_DUPLICATE' using errcode='22023';
    end if;
    v_email_added := true;
  end if;

  select registration.id into v_old_primary from app_modules.fanbus_registrations registration
  where registration.booking_id=v_booking_id and registration.booking_role='PRIMARY' for update;
  if v_old_primary is not distinct from v_participant_id then
    return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_trip_id));
  end if;

  -- One subtransaction: constraint races also roll back the demotion and email.
  begin
    update app_modules.fanbus_registrations set booking_role='COMPANION'
    where booking_id=v_booking_id and booking_role='PRIMARY';
    update app_modules.fanbus_registrations
    set booking_role='PRIMARY',email=case when v_email_added then v_contact_email else email end
    where id=v_participant_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint='fanbus_registrations_live_email_uidx' then
        raise exception 'FANBUS_PARTICIPANT_DUPLICATE' using errcode='22023';
      end if;
      raise;
    when check_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint='fanbus_registrations_email_check' then
        raise exception 'FANBUS_EMAIL_INVALID' using errcode='22023';
      end if;
      raise;
  end;

  perform app_private.log_audit(v_actor,'FANBUS_BOOKING_PRIMARY_CHANGED','fanbus_booking',v_booking_id::text,
    jsonb_build_object('primaryParticipantId',v_old_primary),
    jsonb_build_object('primaryParticipantId',v_participant_id),
    jsonb_build_object('tripId',v_trip_id,'bookingId',v_booking_id,
      'oldPrimaryParticipantId',v_old_primary,'newPrimaryParticipantId',v_participant_id,
      'contactEmailAdded',v_email_added));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_trip_id));
end;
$function$;

-- CREATE OR REPLACE preserves ACLs; reassert the established private boundary.
revoke all on function app_private.api_fanbus_booking_primary_set(jsonb) from public,anon,authenticated,service_role;
grant execute on function app_private.api_fanbus_booking_primary_set(jsonb) to postgres;

commit;
