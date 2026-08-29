-- Plaerrdeifl Digitalplattform V4
-- P300 / M328-R1 – Buchungsbearbeitung und atomare Stornierung
-- DEV migration. PROD wird durch diesen Auftrag nicht beruehrt.

begin;

create function app_private.api_fanbus_booking_operator_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_booking_id uuid;
  v_trip_id uuid;
  v_items jsonb;
  v_item jsonb;
  v_id uuid;
  v_expected integer;
  v_row app_modules.fanbus_registrations%rowtype;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['bookingId','participants']
     or exists (select 1 from jsonb_object_keys(p_payload) k(key)
       where k.key <> all(array['bookingId','participants'])) then
    raise exception 'FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD' using errcode='22023';
  end if;
  v_booking_id := app_private.m325_parse_uuid(p_payload->>'bookingId','FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD');
  v_items := p_payload->'participants';
  if v_booking_id is null or jsonb_typeof(v_items) <> 'array'
     or jsonb_array_length(v_items) not between 1 and 20 then
    raise exception 'FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select trip_id into v_trip_id from app_modules.fanbus_bookings where id=v_booking_id for update;
  if not found then raise exception 'FANBUS_BOOKING_NOT_FOUND' using errcode='P0002'; end if;

  for v_item in select value from jsonb_array_elements(v_items) with ordinality x(value,n) order by n loop
    if jsonb_typeof(v_item) <> 'object'
       or not v_item ?& array['id','expectedRevision','firstName','lastName','email','busPreference','tripBoardingStopId','operationalNote']
       or exists (select 1 from jsonb_object_keys(v_item) k(key)
         where k.key <> all(array['id','expectedRevision','firstName','lastName','email','busPreference','tripBoardingStopId','operationalNote'])) then
      raise exception 'FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD' using errcode='22023';
    end if;
    v_id := app_private.m325_parse_uuid(v_item->>'id','FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD');
    begin v_expected := (v_item->>'expectedRevision')::integer;
    exception when others then raise exception 'FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD' using errcode='22023'; end;
    select * into v_row from app_modules.fanbus_registrations
      where id=v_id and booking_id=v_booking_id and trip_id=v_trip_id for update;
    if not found then raise exception 'FANBUS_BOOKING_PARTICIPANT_NOT_FOUND' using errcode='P0002'; end if;
    if v_row.revision<>v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
    if v_row.status not in ('ACTIVE','WAITLISTED') then
      raise exception 'FANBUS_BOOKING_PARTICIPANT_NOT_EDITABLE' using errcode='22023';
    end if;
    perform app_private.api_fanbus_registration_update_m325(jsonb_build_object(
      'id',v_id,'expectedRevision',v_expected,
      'firstName',v_item->'firstName','lastName',v_item->'lastName','email',v_item->'email',
      'busPreference',v_item->'busPreference','tripBoardingStopId',v_item->'tripBoardingStopId',
      'operationalNote',v_item->'operationalNote'
    ));
  end loop;

  perform app_private.log_audit(v_actor,'FANBUS_BOOKING_OPERATOR_UPDATED','fanbus_booking',v_booking_id::text,null,null,
    jsonb_build_object('tripId',v_trip_id,'bookingId',v_booking_id,'participantCount',jsonb_array_length(v_items)));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_trip_id));
end;
$function$;

create function app_private.api_fanbus_booking_operator_cancel(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_booking_id uuid;
  v_trip_id uuid;
  v_items jsonb;
  v_item jsonb;
  v_id uuid;
  v_expected integer;
  v_row app_modules.fanbus_registrations%rowtype;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['bookingId','participants']
     or exists (select 1 from jsonb_object_keys(p_payload) k(key)
       where k.key <> all(array['bookingId','participants'])) then
    raise exception 'FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD' using errcode='22023';
  end if;
  v_booking_id := app_private.m325_parse_uuid(p_payload->>'bookingId','FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD');
  v_items := p_payload->'participants';
  if v_booking_id is null or jsonb_typeof(v_items) <> 'array'
     or jsonb_array_length(v_items) not between 1 and 20 then
    raise exception 'FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select trip_id into v_trip_id from app_modules.fanbus_bookings where id=v_booking_id for update;
  if not found then raise exception 'FANBUS_BOOKING_NOT_FOUND' using errcode='P0002'; end if;

  for v_item in select value from jsonb_array_elements(v_items) with ordinality x(value,n) order by n loop
    if jsonb_typeof(v_item) <> 'object'
       or not v_item ?& array['id','expectedRevision']
       or exists (select 1 from jsonb_object_keys(v_item) k(key)
         where k.key <> all(array['id','expectedRevision'])) then
      raise exception 'FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD' using errcode='22023';
    end if;
    v_id := app_private.m325_parse_uuid(v_item->>'id','FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD');
    begin v_expected := (v_item->>'expectedRevision')::integer;
    exception when others then raise exception 'FANBUS_BOOKING_OPERATOR_CANCEL_INVALID_PAYLOAD' using errcode='22023'; end;
    select * into v_row from app_modules.fanbus_registrations
      where id=v_id and booking_id=v_booking_id and trip_id=v_trip_id for update;
    if not found then raise exception 'FANBUS_BOOKING_PARTICIPANT_NOT_FOUND' using errcode='P0002'; end if;
    if v_row.revision<>v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
    if v_row.status not in ('ACTIVE','WAITLISTED') then
      raise exception 'FANBUS_PARTICIPANT_NOT_CANCELLABLE' using errcode='22023';
    end if;
    perform app_private.fanbus_participant_cancel_kernel(v_id,v_expected,v_actor,'FANBUS_PARTICIPANT_CANCELLED');
  end loop;

  perform app_private.log_audit(v_actor,'FANBUS_BOOKING_OPERATOR_CANCELLED','fanbus_booking',v_booking_id::text,null,null,
    jsonb_build_object('tripId',v_trip_id,'bookingId',v_booking_id,'participantCount',jsonb_array_length(v_items)));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_trip_id));
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_m328_r1_booking_actions;
create function app_private.pd_api_current_actions()
returns text[] language sql stable set search_path = '' as $function$
  select app_private.pd_api_current_actions_before_m328_r1_booking_actions()
    || array['fanbus_booking_operator_update','fanbus_booking_operator_cancel']::text[];
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_m328_r1_booking_actions;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
begin
  case lower(btrim(coalesce(p_action,'')))
    when 'fanbus_booking_operator_update' then
      return app_private.api_fanbus_booking_operator_update(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_booking_operator_cancel' then
      return app_private.api_fanbus_booking_operator_cancel(coalesce(p_payload,'{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_m328_r1_booking_actions(p_action,p_payload);
  end case;
end;
$function$;

revoke all on function
  app_private.api_fanbus_booking_operator_update(jsonb),
  app_private.api_fanbus_booking_operator_cancel(jsonb),
  app_private.pd_api_current_actions_before_m328_r1_booking_actions(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m328_r1_booking_actions(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
from public,anon,authenticated,service_role;

grant execute on function
  app_private.api_fanbus_booking_operator_update(jsonb),
  app_private.api_fanbus_booking_operator_cancel(jsonb),
  app_private.pd_api_current_actions_before_m328_r1_booking_actions(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m328_r1_booking_actions(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;

commit;
