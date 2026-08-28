\set ON_ERROR_STOP on

insert into auth.users(id,email) values
  ('00000000-0000-4328-8000-000000000001','m327-c1-creator@example.invalid'),
  ('00000000-0000-4328-8000-000000000002','m327-c2-operator@example.invalid');
insert into app_portal.users(id,user_code,email,first_name,last_name,status,role_id) values
  ('00000000-0000-4328-8000-000000000001','U-M327-C1','m327-c1-creator@example.invalid','Concurrent','Creator','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4328-8000-000000000002','U-M327-C2','m327-c2-operator@example.invalid','Bus','Orga','ACTIVE','00000000-0000-4000-8000-000000000003');
insert into app_portal.user_capabilities(user_id,capability_code) values
  ('00000000-0000-4328-8000-000000000002','fanbus.registrations.manage');
insert into app_modules.events(id,event_type,title,event_date,event_time,visibility)
values('00000000-0000-4328-8100-000000000001','OTHER','M327 Concurrency',current_date+10,time '18:00','PUBLIC');
insert into app_modules.fanbus_trips(
  id,event_id,departure_at,departure_info,registration_opens_at,registration_closes_at,
  price_cents,capacity,privacy_reference,terms_reference,status
) values(
  '00000000-0000-4328-8200-000000000001','00000000-0000-4328-8100-000000000001',
  clock_timestamp()+interval '10 days','Concurrency',clock_timestamp()-interval '1 day',
  clock_timestamp()+interval '5 days',2500,10,'privacy','terms','PUBLISHED'
);
insert into app_modules.fanbus_buses(id,trip_id,label,category,capacity,is_active)
values('00000000-0000-4328-8400-000000000001','00000000-0000-4328-8200-000000000001','Concurrency Bus','NORMAL',10,true);
insert into app_modules.fanbus_bookings(id,trip_id,source,created_by)
values('00000000-0000-4328-8500-000000000001','00000000-0000-4328-8200-000000000001','PORTAL','00000000-0000-4328-8000-000000000001');
insert into app_modules.fanbus_registrations(
  id,trip_id,portal_user_id,first_name,last_name,email,bus_preference,status,
  privacy_reference,terms_reference,privacy_accepted_at,terms_accepted_at,
  source,created_by,booking_id,booking_role,participant_sequence
) values(
  '00000000-0000-4328-8600-000000000001','00000000-0000-4328-8200-000000000001',
  '00000000-0000-4328-8000-000000000001','Concurrent','Creator','m327-c1-creator@example.invalid',
  'EGAL','ACTIVE','privacy','terms',now(),now(),'PORTAL','00000000-0000-4328-8000-000000000001',
  '00000000-0000-4328-8500-000000000001','PRIMARY',1
);

create function app_private.m327_concurrency_append(p_key uuid,p_name text)
returns jsonb language plpgsql security definer set search_path='' as $function$
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-4328-8000-000000000001',true);
  return app_private.api_fanbus_selfservice_booking_append(jsonb_build_object(
    'bookingId','00000000-0000-4328-8500-000000000001',
    'idempotencyKey',p_key,
    'participants',jsonb_build_array(jsonb_build_object(
      'firstName',p_name,'lastName','Append','busPreference','EGAL'
    ))
  ));
end;
$function$;
create function app_private.m327_concurrency_self_update()
returns jsonb language plpgsql security definer set search_path='' as $function$
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-4328-8000-000000000001',true);
  return app_private.api_fanbus_selfservice_participant_update(
    '{"participantId":"00000000-0000-4328-8600-000000000001","expectedRevision":1,"busPreference":"EGAL"}'::jsonb
  );
end;
$function$;

create function app_private.m327_concurrency_operator_update()
returns jsonb language plpgsql security definer set search_path='' as $function$
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-4328-8000-000000000002',true);
  return app_private.api_fanbus_registration_update(
    '{"id":"00000000-0000-4328-8600-000000000001","expectedRevision":1,"firstName":"Concurrent","lastName":"Creator","email":"m327-c1-creator@example.invalid","busPreference":"EGAL"}'::jsonb
  );
end;
$function$;
