\set ON_ERROR_STOP on

begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_function('app_private','api_fanbus_my_bookings_list',array['jsonb'],'M327 read API exists');
select has_function('app_private','api_fanbus_selfservice_participant_update',array['jsonb'],'M327 update API exists');
select has_function('app_private','api_fanbus_selfservice_participant_cancel',array['jsonb'],'M327 cancel API exists');
select has_function('app_private','api_fanbus_selfservice_booking_append',array['jsonb'],'M327 append API exists');
select has_function('public','pd_public_fanbus_contact',array[]::text[],'sanitized public contact RPC exists');
select is(app_private.platform_action_classification('fanbus_my_bookings_list'),'READ','My Bookings is READ');
select is(app_private.platform_action_classification('fanbus_selfservice_booking_append'),'USER_MUTATION','append is USER_MUTATION');
select ok(not has_table_privilege('authenticated','app_modules.fanbus_bookings','SELECT'),'browser cannot select bookings directly');
select ok(not has_table_privilege('authenticated','app_modules.fanbus_registrations','UPDATE'),'browser cannot update registrations directly');
select ok(not has_table_privilege('anon','app_portal.settings','SELECT'),'public contact does not expose settings');

insert into auth.users(id,email) values
  ('00000000-0000-4327-8000-000000000001','m327-creator@example.invalid'),
  ('00000000-0000-4327-8000-000000000002','m327-member@example.invalid'),
  ('00000000-0000-4327-8000-000000000003','m327-manual@example.invalid'),
  ('00000000-0000-4327-8000-000000000004','m327-other@example.invalid'),
  ('00000000-0000-4327-8000-000000000005','m327-inactive@example.invalid');
insert into app_portal.users(id,user_code,email,first_name,last_name,status,role_id) values
  ('00000000-0000-4327-8000-000000000001','U-M327-C','m327-creator@example.invalid','Clara','Creator','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4327-8000-000000000002','U-M327-M','m327-member@example.invalid','Max','Member','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4327-8000-000000000003','U-M327-L','m327-manual@example.invalid','Lina','Linked','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4327-8000-000000000004','U-M327-O','m327-other@example.invalid','Otto','Other','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4327-8000-000000000005','U-M327-I','m327-inactive@example.invalid','Ina','Inactive','INACTIVE','00000000-0000-4000-8000-000000000003');

insert into app_modules.events(id,event_type,title,event_date,event_time,visibility) values
  ('00000000-0000-4327-8100-000000000001','OTHER','M327 Hauptfahrt',current_date+10,time '18:00','PUBLIC'),
  ('00000000-0000-4327-8100-000000000002','OTHER','M327 Warteliste',current_date+11,time '18:00','PUBLIC'),
  ('00000000-0000-4327-8100-000000000003','OTHER','M327 Cutoff',current_date+3,time '18:00','PUBLIC'),
  ('00000000-0000-4327-8100-000000000004','OTHER','M327 Abgesagt',current_date+10,time '18:00','PUBLIC');
insert into app_modules.fanbus_trips(
  id,event_id,departure_at,departure_info,registration_opens_at,registration_closes_at,
  price_cents,capacity,privacy_reference,terms_reference,status,bus_preference_enabled,
  cancellation_reason,cancelled_at
) values
  ('00000000-0000-4327-8200-000000000001','00000000-0000-4327-8100-000000000001',clock_timestamp()+interval '10 days','Testabfahrt',clock_timestamp()-interval '10 days',clock_timestamp()-interval '1 day',2500,20,'privacy','terms','PUBLISHED',true,null,null),
  ('00000000-0000-4327-8200-000000000002','00000000-0000-4327-8100-000000000002',clock_timestamp()+interval '11 days','Testabfahrt',clock_timestamp()-interval '10 days',clock_timestamp()+interval '2 days',2500,1,'privacy','terms','PUBLISHED',false,null,null),
  ('00000000-0000-4327-8200-000000000003','00000000-0000-4327-8100-000000000003',clock_timestamp()+interval '72 hours','Testabfahrt',clock_timestamp()-interval '10 days',clock_timestamp()+interval '1 day',2500,20,'privacy','terms','PUBLISHED',false,null,null),
  ('00000000-0000-4327-8200-000000000004','00000000-0000-4327-8100-000000000004',clock_timestamp()+interval '10 days','Testabfahrt',clock_timestamp()-interval '10 days',clock_timestamp()+interval '2 days',2500,20,'privacy','terms','CANCELLED',false,'Testabsage',clock_timestamp());

insert into app_modules.fanbus_boarding_stops(id,label,position,is_active) values
  ('00000000-0000-4327-8300-000000000001','Nord',1,true),
  ('00000000-0000-4327-8300-000000000002','Süd',2,true),
  ('00000000-0000-4327-8300-000000000003','Inaktiv',3,false);
update app_modules.fanbus_trips set default_boarding_stop_id='00000000-0000-4327-8300-000000000001'
where id in ('00000000-0000-4327-8200-000000000001','00000000-0000-4327-8200-000000000002');
insert into app_modules.fanbus_trip_boarding_stops(id,trip_id,boarding_stop_id,departure_at,position,is_active) values
  ('00000000-0000-4327-8350-000000000001','00000000-0000-4327-8200-000000000001','00000000-0000-4327-8300-000000000001',clock_timestamp()+interval '10 days',1,true),
  ('00000000-0000-4327-8350-000000000002','00000000-0000-4327-8200-000000000001','00000000-0000-4327-8300-000000000002',clock_timestamp()+interval '10 days',2,true),
  ('00000000-0000-4327-8350-000000000003','00000000-0000-4327-8200-000000000001','00000000-0000-4327-8300-000000000003',clock_timestamp()+interval '10 days',3,false),
  ('00000000-0000-4327-8350-000000000004','00000000-0000-4327-8200-000000000002','00000000-0000-4327-8300-000000000001',clock_timestamp()+interval '11 days',1,true);
insert into app_modules.fanbus_buses(id,trip_id,label,category,capacity,is_active) values
  ('00000000-0000-4327-8400-000000000001','00000000-0000-4327-8200-000000000001','Bus Nord','RUHIG',20,true),
  ('00000000-0000-4327-8400-000000000002','00000000-0000-4327-8200-000000000001','Bus Süd','PARTY',20,true),
  ('00000000-0000-4327-8400-000000000003','00000000-0000-4327-8200-000000000002','Bus Klein','NORMAL',1,true),
  ('00000000-0000-4327-8400-000000000004','00000000-0000-4327-8200-000000000003','Bus Cutoff','NORMAL',20,true),
  ('00000000-0000-4327-8400-000000000005','00000000-0000-4327-8200-000000000004','Bus Cancel','NORMAL',20,true);
insert into app_modules.fanbus_bus_boarding_stops(trip_id,bus_id,trip_boarding_stop_id) values
  ('00000000-0000-4327-8200-000000000001','00000000-0000-4327-8400-000000000001','00000000-0000-4327-8350-000000000001'),
  ('00000000-0000-4327-8200-000000000001','00000000-0000-4327-8400-000000000002','00000000-0000-4327-8350-000000000002');

insert into app_modules.fanbus_bookings(id,trip_id,source,created_by) values
  ('00000000-0000-4327-8500-000000000001','00000000-0000-4327-8200-000000000001','PORTAL','00000000-0000-4327-8000-000000000001'),
  ('00000000-0000-4327-8500-000000000002','00000000-0000-4327-8200-000000000001','MANUAL','00000000-0000-4327-8000-000000000004'),
  ('00000000-0000-4327-8500-000000000003','00000000-0000-4327-8200-000000000002','PORTAL','00000000-0000-4327-8000-000000000001'),
  ('00000000-0000-4327-8500-000000000004','00000000-0000-4327-8200-000000000003','PORTAL','00000000-0000-4327-8000-000000000001'),
  ('00000000-0000-4327-8500-000000000005','00000000-0000-4327-8200-000000000004','PORTAL','00000000-0000-4327-8000-000000000001'),
  ('00000000-0000-4327-8500-000000000006','00000000-0000-4327-8200-000000000001','PORTAL','00000000-0000-4327-8000-000000000005');

select set_config('app.m325_registration_context','[]',true);
insert into app_modules.fanbus_registrations(
  id,trip_id,portal_user_id,first_name,last_name,email,bus_preference,status,
  privacy_reference,terms_reference,privacy_accepted_at,terms_accepted_at,
  source,created_by,booking_id,booking_role,participant_sequence,trip_boarding_stop_id,waitlisted_at
) values
  ('00000000-0000-4327-8600-000000000001','00000000-0000-4327-8200-000000000001','00000000-0000-4327-8000-000000000001','Clara','Creator','m327-creator@example.invalid','EGAL','ACTIVE','privacy','terms',now(),now(),'PORTAL','00000000-0000-4327-8000-000000000001','00000000-0000-4327-8500-000000000001','PRIMARY',1,'00000000-0000-4327-8350-000000000001',null),
  ('00000000-0000-4327-8600-000000000002','00000000-0000-4327-8200-000000000001','00000000-0000-4327-8000-000000000002','Max','Member',null,'EGAL','ACTIVE','privacy','terms',now(),now(),'PORTAL','00000000-0000-4327-8000-000000000001','00000000-0000-4327-8500-000000000001','COMPANION',2,'00000000-0000-4327-8350-000000000001',null),
  ('00000000-0000-4327-8600-000000000003','00000000-0000-4327-8200-000000000001',null,'Gina','Guest',null,'EGAL','ACTIVE','privacy','terms',now(),now(),'PORTAL','00000000-0000-4327-8000-000000000001','00000000-0000-4327-8500-000000000001','COMPANION',3,'00000000-0000-4327-8350-000000000001',null),
  ('00000000-0000-4327-8600-000000000004','00000000-0000-4327-8200-000000000001','00000000-0000-4327-8000-000000000003','Lina','Linked',null,'EGAL','ACTIVE','privacy','terms',now(),now(),'MANUAL','00000000-0000-4327-8000-000000000004','00000000-0000-4327-8500-000000000002','PRIMARY',1,'00000000-0000-4327-8350-000000000001',null),
  ('00000000-0000-4327-8600-000000000005','00000000-0000-4327-8200-000000000002','00000000-0000-4327-8000-000000000001','Clara','Creator','m327-wait@example.invalid','EGAL','ACTIVE','privacy','terms',now(),now(),'PORTAL','00000000-0000-4327-8000-000000000001','00000000-0000-4327-8500-000000000003','PRIMARY',1,'00000000-0000-4327-8350-000000000004',null),
  ('00000000-0000-4327-8600-000000000006','00000000-0000-4327-8200-000000000003','00000000-0000-4327-8000-000000000001','Clara','Creator','m327-cutoff@example.invalid','EGAL','ACTIVE','privacy','terms',now(),now(),'PORTAL','00000000-0000-4327-8000-000000000001','00000000-0000-4327-8500-000000000004','PRIMARY',1,null,null),
  ('00000000-0000-4327-8600-000000000007','00000000-0000-4327-8200-000000000004','00000000-0000-4327-8000-000000000001','Clara','Creator','m327-cancel@example.invalid','EGAL','ACTIVE','privacy','terms',now(),now(),'PORTAL','00000000-0000-4327-8000-000000000001','00000000-0000-4327-8500-000000000005','PRIMARY',1,null,null),
  ('00000000-0000-4327-8600-000000000008','00000000-0000-4327-8200-000000000001','00000000-0000-4327-8000-000000000005','Ina','Inactive','m327-inactive@example.invalid','EGAL','ACTIVE','privacy','terms',now(),now(),'PORTAL','00000000-0000-4327-8000-000000000005','00000000-0000-4327-8500-000000000006','PRIMARY',1,'00000000-0000-4327-8350-000000000001',null);

insert into app_modules.fanbus_bus_assignments(participant_id,trip_id,bus_id) values
  ('00000000-0000-4327-8600-000000000002','00000000-0000-4327-8200-000000000001','00000000-0000-4327-8400-000000000001');

select set_config('request.jwt.claim.sub','00000000-0000-4327-8000-000000000001',true);
select is(jsonb_array_length(app_private.api_fanbus_my_bookings_list('{}')->'bookings'),4,'A/B/C/H creator sees all creator bookings');
select ok((app_private.api_fanbus_my_bookings_list('{}')->'bookings'->0) ? 'participants','creator sees participant collection');

select set_config('request.jwt.claim.sub','00000000-0000-4327-8000-000000000002',true);
select is(jsonb_array_length(app_private.api_fanbus_my_bookings_list('{}')->'bookings'),1,'D co-booked portal user sees booking');
select is((app_private.api_fanbus_my_bookings_list('{}')->'bookings'->0->>'isCreator')::boolean,false,'D co-booked portal user is not creator');
select ok((app_private.api_fanbus_my_bookings_list('{}')->'bookings'->0->'participants'->2->>'redacted')::boolean,'D foreign guest is redacted');
select ok(not (app_private.api_fanbus_my_bookings_list('{}')->'bookings'->0->'participants'->2) ? 'email','D redaction excludes email');
select throws_ok($$select app_private.api_fanbus_selfservice_booking_append('{"bookingId":"00000000-0000-4327-8500-000000000001","idempotencyKey":"00000000-0000-4327-8700-000000000001","participants":[{"firstName":"No","lastName":"Rights","tripBoardingStopId":"00000000-0000-4327-8350-000000000001"}]}'::jsonb)$$,'P0002','NOT_FOUND','F non-creator append is safe NOT_FOUND');
select throws_ok($$select app_private.api_fanbus_selfservice_participant_cancel('{"participantId":"00000000-0000-4327-8600-000000000003","expectedRevision":1}'::jsonb)$$,'P0002','NOT_FOUND','G non-creator foreign cancel is safe NOT_FOUND');

select set_config('request.jwt.claim.sub','00000000-0000-4327-8000-000000000003',true);
select is(jsonb_array_length(app_private.api_fanbus_my_bookings_list('{}')->'bookings'),1,'E MANUAL linked portal participant sees own booking');
select is((app_private.api_fanbus_my_bookings_list('{}')->'bookings'->0->>'isCreator')::boolean,false,'E MANUAL source grants no creator rights');

select set_config('request.jwt.claim.sub','00000000-0000-4327-8000-000000000005',true);
select throws_ok($$select app_private.api_fanbus_my_bookings_list('{}')$$,'42501','Aktiver Portalzugang erforderlich.','I inactive creator has no selfservice');

select set_config('request.jwt.claim.sub','00000000-0000-4327-8000-000000000001',true);
select lives_ok($$select app_private.api_fanbus_selfservice_booking_append('{"bookingId":"00000000-0000-4327-8500-000000000001","idempotencyKey":"00000000-0000-4327-8700-000000000002","participants":[{"firstName":"Append","lastName":"Active","tripBoardingStopId":"00000000-0000-4327-8350-000000000001","busPreference":"EGAL"}]}'::jsonb)$$,'A registration close passed but pre-cutoff append remains allowed');
select is((select count(*)::integer from app_modules.fanbus_registrations where booking_id='00000000-0000-4327-8500-000000000001'),4,'append uses same booking_id');
select is((select max(participant_sequence) from app_modules.fanbus_registrations where booking_id='00000000-0000-4327-8500-000000000001'),4,'append sequence is max plus one');
select is((select booking_role from app_modules.fanbus_registrations where id='00000000-0000-4327-8600-000000000001'),'PRIMARY','existing PRIMARY remains unchanged');
select is((select status from app_modules.fanbus_registrations where id='00000000-0000-4327-8600-000000000001'),'ACTIVE','existing status remains unchanged');
select is((select trip_boarding_stop_id::text from app_modules.fanbus_registrations where id='00000000-0000-4327-8600-000000000001'),'00000000-0000-4327-8350-000000000001','existing stop remains unchanged');
select is((select count(*)::integer from app_private.notification_events where notification_type='FANBUS_BOOKING_EXTENDED'),1,'append emits one extended event');
select is((select count(*)::integer from app_private.notification_events where notification_type='FANBUS_BOOKING_CREATED' and event_key like '%8700-000000000002%'),0,'append does not emit booking created');

select is(app_private.api_fanbus_selfservice_booking_append('{"bookingId":"00000000-0000-4327-8500-000000000001","idempotencyKey":"00000000-0000-4327-8700-000000000002","participants":[{"firstName":"Append","lastName":"Active","tripBoardingStopId":"00000000-0000-4327-8350-000000000001","busPreference":"EGAL"}]}'::jsonb)->>'participantCount','1','same idempotency request returns stored response');
select is((select count(*)::integer from app_modules.fanbus_registrations where first_name='Append' and last_name='Active'),1,'idempotency prevents double insert');
select throws_ok($$select app_private.api_fanbus_selfservice_booking_append('{"bookingId":"00000000-0000-4327-8500-000000000001","idempotencyKey":"00000000-0000-4327-8700-000000000002","participants":[{"firstName":"Different","lastName":"Payload","tripBoardingStopId":"00000000-0000-4327-8350-000000000001"}]}'::jsonb)$$,'22023','FANBUS_IDEMPOTENCY_KEY_REUSED','idempotency key reuse with different request fails');

select is(app_private.api_fanbus_selfservice_booking_append('{"bookingId":"00000000-0000-4327-8500-000000000003","idempotencyKey":"00000000-0000-4327-8700-000000000003","participants":[{"firstName":"Whole","lastName":"Waitlist","tripBoardingStopId":"00000000-0000-4327-8350-000000000004"}]}'::jsonb)->>'status','WAITLISTED','B/C insufficient capacity waitlists entire append batch');
select is((select status from app_modules.fanbus_registrations where first_name='Whole'),'WAITLISTED','new participant is waitlisted while existing stays active');
select is((select status from app_modules.fanbus_registrations where id='00000000-0000-4327-8600-000000000005'),'ACTIVE','existing active participant remains active');

select throws_ok($$select app_private.api_fanbus_selfservice_booking_append('{"bookingId":"00000000-0000-4327-8500-000000000001","idempotencyKey":"00000000-0000-4327-8700-000000000004","participants":[{"firstName":"Batch","lastName":"Duplicate","tripBoardingStopId":"00000000-0000-4327-8350-000000000001"},{"firstName":"Batch","lastName":"Duplicate","tripBoardingStopId":"00000000-0000-4327-8350-000000000001"}]}'::jsonb)$$,'P3251','FANBUS_COMPANION_CONFLICT','D duplicate inside batch fails atomically');
select is((select count(*)::integer from app_modules.fanbus_registrations where first_name='Batch'),0,'D duplicate batch leaves no partial inserts');
select throws_ok($$select app_private.api_fanbus_selfservice_booking_append('{"bookingId":"00000000-0000-4327-8500-000000000001","idempotencyKey":"00000000-0000-4327-8700-000000000005","participants":[{"firstName":"Max","lastName":"Member","tripBoardingStopId":"00000000-0000-4327-8350-000000000001"}]}'::jsonb)$$,'P3251','FANBUS_COMPANION_CONFLICT','E existing person on trip blocks append');

update app_modules.fanbus_trips set departure_at=clock_timestamp()+interval '72 hours 1 second' where id='00000000-0000-4327-8200-000000000003';
select lives_ok($$select app_private.api_fanbus_selfservice_participant_update('{"participantId":"00000000-0000-4327-8600-000000000006","expectedRevision":1,"busPreference":"EGAL"}'::jsonb)$$,'72h cutoff minus one second remains mutable');
update app_modules.fanbus_trips set departure_at=clock_timestamp()+interval '72 hours' where id='00000000-0000-4327-8200-000000000003';
select throws_ok($$select app_private.api_fanbus_selfservice_participant_update('{"participantId":"00000000-0000-4327-8600-000000000006","expectedRevision":2,"busPreference":"EGAL"}'::jsonb)$$,'55000','FANBUS_SELF_SERVICE_CUTOFF_REACHED','H exact/after cutoff blocks mutation');
select throws_ok($$select app_private.api_fanbus_selfservice_participant_update('{"participantId":"00000000-0000-4327-8600-000000000007","expectedRevision":1,"busPreference":"EGAL"}'::jsonb)$$,'55000','FANBUS_SELF_SERVICE_TRIP_READ_ONLY','I cancelled trip blocks mutation');
select throws_ok($$select app_private.api_fanbus_selfservice_participant_update('{"participantId":"00000000-0000-4327-8600-000000000002","expectedRevision":99,"busPreference":"EGAL"}'::jsonb)$$,'40001','STALE_REVISION','K stale participant revision blocks update');
select throws_ok($$select app_private.api_fanbus_selfservice_participant_update('{"participantId":"00000000-0000-4327-8600-000000000002","expectedRevision":1,"tripBoardingStopId":"00000000-0000-4327-8350-000000000003"}'::jsonb)$$,'22023','FANBUS_BOARDING_STOP_UNAVAILABLE','L inactive stop blocks update');
select throws_ok($$select app_private.api_fanbus_selfservice_participant_update('{"participantId":"00000000-0000-4327-8600-000000000002","expectedRevision":1,"tripBoardingStopId":"00000000-0000-4327-8350-000000000002"}'::jsonb)$$,'22023','FANBUS_SELF_SERVICE_STOP_INCOMPATIBLE_CONTACT_BUS_ORGA','M assigned bus incompatible stop blocks update');
select lives_ok($$select app_private.api_fanbus_selfservice_participant_update('{"participantId":"00000000-0000-4327-8600-000000000002","expectedRevision":1,"busPreference":"PARTY"}'::jsonb)$$,'N preference can change after assignment');
select is((select bus_id::text from app_modules.fanbus_bus_assignments where participant_id='00000000-0000-4327-8600-000000000002'),'00000000-0000-4327-8400-000000000001','N assignment remains unchanged');

select lives_ok($$select app_private.api_fanbus_selfservice_participant_cancel('{"participantId":"00000000-0000-4327-8600-000000000001","expectedRevision":1}'::jsonb)$$,'O creator can cancel own participation');
select is((select created_by::text from app_modules.fanbus_bookings where id='00000000-0000-4327-8500-000000000001'),'00000000-0000-4327-8000-000000000001','O creator identity remains on booking');
select lives_ok($$select app_private.api_fanbus_selfservice_booking_append('{"bookingId":"00000000-0000-4327-8500-000000000001","idempotencyKey":"00000000-0000-4327-8700-000000000006","participants":[{"firstName":"After","lastName":"SelfCancel","tripBoardingStopId":"00000000-0000-4327-8350-000000000001"}]}'::jsonb)$$,'H creator can manage remaining booking after self-cancel');

select lives_ok(format('select app_private.api_fanbus_selfservice_participant_cancel(%L::jsonb)',jsonb_build_object('participantId',(select id from app_modules.fanbus_registrations where first_name='Whole'),'expectedRevision',1)::text),'Q waitlisted participant can selfservice cancel');
select is((select status from app_modules.fanbus_registrations where id='00000000-0000-4327-8600-000000000005'),'ACTIVE','Q cancellation does not auto-promote or alter existing active row');

update app_portal.settings set value='{"emails":[{"label":"Büro","value":"bus@example.invalid"},{"label":"Invalid","value":"bad\nmail"}],"phones":[{"label":"Hotline","value":"+49 123 456"}],"secret":"hidden"}'::jsonb where key='fanbus.organization_contact';
select is(jsonb_array_length(public.pd_public_fanbus_contact()->'emails'),1,'public contact sanitizes emails');
select is(jsonb_array_length(public.pd_public_fanbus_contact()->'phones'),1,'public contact exposes public phones');
select ok(not public.pd_public_fanbus_contact() ? 'secret','public projection excludes arbitrary setting keys');
select ok(exists(select 1 from app_portal.audit_events where action='SELF_SERVICE_PARTICIPANT_UPDATED'),'update audit exists');
select ok(exists(select 1 from app_portal.audit_events where action='SELF_SERVICE_PARTICIPANT_CANCELLED'),'cancel audit exists');
select ok(exists(select 1 from app_portal.audit_events where action='SELF_SERVICE_PARTICIPANT_ADDED'),'append audit exists');

select * from finish();
rollback;
