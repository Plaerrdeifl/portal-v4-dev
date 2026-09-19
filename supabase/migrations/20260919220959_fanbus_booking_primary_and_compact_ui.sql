begin;

create function app_private.api_fanbus_booking_primary_set(p_payload jsonb)
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
begin
  if jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['bookingId','participantId']
     or exists (
       select 1 from jsonb_object_keys(p_payload) key(name)
       where key.name <> all(array['bookingId','participantId'])
     ) then
    raise exception 'FANBUS_BOOKING_PRIMARY_INVALID_PAYLOAD' using errcode='22023';
  end if;

  begin
    v_booking_id := (p_payload->>'bookingId')::uuid;
    v_participant_id := (p_payload->>'participantId')::uuid;
  exception when others then
    raise exception 'FANBUS_BOOKING_PRIMARY_INVALID_PAYLOAD' using errcode='22023';
  end;

  select booking.trip_id into v_trip_id
  from app_modules.fanbus_bookings booking
  where booking.id=v_booking_id
  for update;
  if not found then
    raise exception 'FANBUS_BOOKING_NOT_FOUND' using errcode='P0002';
  end if;

  perform app_private.m330_lock_mutable_fanbus_trip(v_trip_id);

  select * into v_target
  from app_modules.fanbus_registrations registration
  where registration.id=v_participant_id
    and registration.booking_id=v_booking_id
    and registration.trip_id=v_trip_id
    and registration.status in ('ACTIVE','WAITLISTED')
  for update;
  if not found then
    raise exception 'FANBUS_BOOKING_PRIMARY_PARTICIPANT_UNAVAILABLE' using errcode='22023';
  end if;

  select registration.id into v_old_primary
  from app_modules.fanbus_registrations registration
  where registration.booking_id=v_booking_id
    and registration.booking_role='PRIMARY'
  for update;

  if v_old_primary is not distinct from v_participant_id then
    return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_trip_id));
  end if;

  update app_modules.fanbus_registrations
  set booking_role='COMPANION'
  where booking_id=v_booking_id
    and booking_role='PRIMARY';

  update app_modules.fanbus_registrations
  set booking_role='PRIMARY'
  where id=v_participant_id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_BOOKING_PRIMARY_CHANGED',
    'fanbus_booking',
    v_booking_id::text,
    jsonb_build_object('primaryParticipantId',v_old_primary),
    jsonb_build_object('primaryParticipantId',v_participant_id),
    jsonb_build_object(
      'tripId',v_trip_id,
      'bookingId',v_booking_id,
      'oldPrimaryParticipantId',v_old_primary,
      'newPrimaryParticipantId',v_participant_id
    )
  );

  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_trip_id));
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_booking_primary_r2;
create function app_private.pd_api_current_actions()
returns text[] language sql stable set search_path=''
as $function$
  select app_private.pd_api_current_actions_before_booking_primary_r2()
    || array['fanbus_booking_primary_set']::text[]
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_booking_primary_r2;
create function app_private.platform_action_classification(p_action text)
returns text language sql stable set search_path=''
as $function$
  select case lower(btrim(coalesce(p_action,'')))
    when 'fanbus_booking_primary_set' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_booking_primary_r2(p_action)
  end
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_booking_primary_r2;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $function$
begin
  if lower(btrim(coalesce(p_action,'')))='fanbus_booking_primary_set' then
    return app_private.api_fanbus_booking_primary_set(coalesce(p_payload,'{}'::jsonb));
  end if;
  return app_private.pd_api_dispatch_current_before_booking_primary_r2(p_action,p_payload);
end;
$function$;

revoke all on function
  app_private.api_fanbus_booking_primary_set(jsonb),
  app_private.pd_api_current_actions_before_booking_primary_r2(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_booking_primary_r2(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_booking_primary_r2(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
from public,anon,authenticated,service_role;

grant execute on function
  app_private.api_fanbus_booking_primary_set(jsonb),
  app_private.pd_api_current_actions_before_booking_primary_r2(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_booking_primary_r2(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_booking_primary_r2(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;

commit;
