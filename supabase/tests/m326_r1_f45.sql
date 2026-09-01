\set ON_ERROR_STOP on

begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, pg_catalog;

select plan(18);

select ok(not has_table_privilege('service_role','app_modules.fanbus_regular_riders','SELECT'),'service_role has no direct regular-rider access');
select ok(not has_table_privilege('service_role','app_modules.fanbus_person_groups','SELECT'),'service_role has no direct group access');
select ok(not has_table_privilege('service_role','app_modules.fanbus_person_group_members','SELECT'),'service_role has no direct group-member access');
select matches(
  pg_get_indexdef('app_modules.fanbus_registrations_live_manual_name_uidx'::regclass),
  '.*regular_rider_id IS NULL.*',
  'manual-name index excludes regular-rider provenance'
);
select matches(
  pg_get_functiondef('app_private.fanbus_submit_booking_core_before_m330_r1(uuid,text,uuid,jsonb,jsonb,boolean,boolean,uuid,text)'::regprocedure),
  '.*registration[.]regular_rider_id is null.*',
  'M320 manual-name lookup excludes regular-rider provenance'
);

insert into auth.users(id,email) values
  ('00000000-0000-4326-9000-000000000001','m326-f45-manager@example.invalid'),
  ('00000000-0000-4326-9000-000000000002','m326-f45-portal-a@example.invalid'),
  ('00000000-0000-4326-9000-000000000003','m326-f45-portal-b@example.invalid'),
  ('00000000-0000-4326-9000-000000000004','m326-f45-group-portal@example.invalid');
insert into app_portal.users(id,user_code,email,first_name,last_name,status,role_id) values
  ('00000000-0000-4326-9000-000000000001','U-M326-F45-MANAGER','m326-f45-manager@example.invalid','M326','Manager','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4326-9000-000000000002','U-M326-F45-A','m326-f45-portal-a@example.invalid','Portal','Alpha','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4326-9000-000000000003','U-M326-F45-B','m326-f45-portal-b@example.invalid','Portal','Beta','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4326-9000-000000000004','U-M326-F45-GROUP','m326-f45-group-portal@example.invalid','Portal','Gruppe','ACTIVE','00000000-0000-4000-8000-000000000003');
insert into app_portal.user_capabilities(user_id,capability_code)
values('00000000-0000-4326-9000-000000000001','fanbus.registrations.manage');
select set_config('request.jwt.claim.sub','00000000-0000-4326-9000-000000000001',true);

insert into app_fanclub.members(id,member_code,first_name,last_name,email,status) values
  ('00000000-0000-4326-9100-000000000001','PD-M326-F45','Aktives','Mitglied','m326-f45-member@example.invalid','ACTIVE');
insert into app_modules.events(id,event_type,title,event_date,event_time,visibility) values
  ('00000000-0000-4326-8100-000000000101','OTHER','M326 F4.5 Testfahrt',current_date+40,time '18:00','PUBLIC'),
  ('00000000-0000-4326-8100-000000000102','OTHER','M326 F4.5 Companion-Testfahrt',current_date+41,time '18:00','PUBLIC');
insert into app_modules.fanbus_trips(
  id,event_id,departure_at,registration_opens_at,registration_closes_at,
  price_cents,capacity,privacy_reference,terms_reference,status
) values (
  '00000000-0000-4326-8200-000000000101','00000000-0000-4326-8100-000000000101',
  now()+interval '40 days',now()-interval '1 day',now()+interval '39 days',
  2500,20,'privacy-v1','terms-v1','PUBLISHED'
) ,(
  '00000000-0000-4326-8200-000000000102','00000000-0000-4326-8100-000000000102',
  now()+interval '41 days',now()-interval '1 day',now()+interval '40 days',
  2500,20,'privacy-v1','terms-v1','PUBLISHED'
);
insert into app_modules.fanbus_buses(trip_id,label,category,capacity,is_active)
values
  ('00000000-0000-4326-8200-000000000101','M326 F4.5 Bus','NORMAL',20,true),
  ('00000000-0000-4326-8200-000000000102','M326 F4.5 Companion-Bus','NORMAL',20,true);

create temporary table m326_f45_values(key text primary key,value jsonb) on commit drop;
insert into m326_f45_values values
  ('rider1',app_private.api_fanbus_regular_rider_create('{"firstName":"Gleicher","lastName":"Name"}'::jsonb)),
  ('rider2',app_private.api_fanbus_regular_rider_create('{"firstName":"Gleicher","lastName":"Name"}'::jsonb)),
  ('rider3',app_private.api_fanbus_regular_rider_create('{"firstName":"Gruppen","lastName":"Anker"}'::jsonb)),
  ('rider4',app_private.api_fanbus_regular_rider_create('{"firstName":"Neuer","lastName":"Inaktiver"}'::jsonb));

insert into m326_f45_values values('booking-rider1',app_private.api_fanbus_registration_create_manual_bulk(jsonb_build_object(
  'tripId','00000000-0000-4326-8200-000000000101','termsConfirmed',true,'idempotencyKey','00000000-0000-4326-8300-000000000101',
  'participants',jsonb_build_array(jsonb_build_object('source','REGULAR_RIDER','regularRiderId',(select value->>'id' from m326_f45_values where key='rider1'),'busPreference','EGAL'))
)));
insert into m326_f45_values values('booking-rider2',app_private.api_fanbus_registration_create_manual_bulk(jsonb_build_object(
  'tripId','00000000-0000-4326-8200-000000000101','termsConfirmed',true,'idempotencyKey','00000000-0000-4326-8300-000000000102',
  'participants',jsonb_build_array(jsonb_build_object('source','REGULAR_RIDER','regularRiderId',(select value->>'id' from m326_f45_values where key='rider2'),'busPreference','EGAL'))
)));
insert into m326_f45_values values('booking-guest',app_private.api_fanbus_registration_create_manual_bulk(jsonb_build_object(
  'tripId','00000000-0000-4326-8200-000000000101','termsConfirmed',true,'idempotencyKey','00000000-0000-4326-8300-000000000103',
  'participants',jsonb_build_array(jsonb_build_object('source','GUEST','firstName','Gleicher','lastName','Name','busPreference','EGAL'))
)));
select is((select value->>'outcome' from m326_f45_values where key='booking-rider1'),'CREATED','first no-email regular rider is booked');
select is((select value->>'outcome' from m326_f45_values where key='booking-rider2'),'CREATED','same-name second regular rider is not blocked by name');
select is((select value->>'outcome' from m326_f45_values where key='booking-guest'),'CREATED','same-name free guest is not blocked by regular riders');
select throws_ok(
  $$select app_private.api_fanbus_registration_create_manual_bulk(jsonb_build_object(
    'tripId','00000000-0000-4326-8200-000000000101','termsConfirmed',true,'idempotencyKey','00000000-0000-4326-8300-000000000104',
    'participants',jsonb_build_array(jsonb_build_object('source','GUEST','firstName','Gleicher','lastName','Name','busPreference','EGAL'))
  ))$$,
  'P3201','FANBUS_BATCH_DUPLICATE','same-name free manual guests remain duplicates'
);
insert into m326_f45_values values('companion-trip-rider',app_private.api_fanbus_registration_create_manual_bulk(jsonb_build_object(
  'tripId','00000000-0000-4326-8200-000000000102','termsConfirmed',true,'idempotencyKey','00000000-0000-4326-8300-000000000105',
  'participants',jsonb_build_array(jsonb_build_object('source','REGULAR_RIDER','regularRiderId',(select value->>'id' from m326_f45_values where key='rider1'),'busPreference','EGAL'))
)));
insert into m326_f45_values values('companion-trip-guests',app_private.api_fanbus_registration_create_manual_bulk(jsonb_build_object(
  'tripId','00000000-0000-4326-8200-000000000102','termsConfirmed',true,'idempotencyKey','00000000-0000-4326-8300-000000000106',
  'participants',jsonb_build_array(
    jsonb_build_object('source','GUEST','firstName','Andere','lastName','Person','busPreference','EGAL'),
    jsonb_build_object('source','GUEST','firstName','Gleicher','lastName','Name','busPreference','EGAL')
  )
)));
select is((select value->>'outcome' from m326_f45_values where key='companion-trip-guests'),'CREATED','same-name guest companion is not blocked by a regular rider');

select app_private.api_fanbus_regular_rider_link(jsonb_build_object(
  'regularRiderId',(select value->>'id' from m326_f45_values where key='rider1'),
  'portalUserId','00000000-0000-4326-9000-000000000002','expectedRevision',1
));
select app_private.api_fanbus_regular_rider_relink(jsonb_build_object(
  'regularRiderId',(select value->>'id' from m326_f45_values where key='rider1'),
  'portalUserId','00000000-0000-4326-9000-000000000003','expectedRevision',2
));
select app_private.api_fanbus_regular_rider_unlink(jsonb_build_object(
  'regularRiderId',(select value->>'id' from m326_f45_values where key='rider1'),'expectedRevision',3
));
select ok(exists(select 1 from app_portal.audit_events where action='FANBUS_REGULAR_RIDER_LINK'
  and metadata->>'oldPortalUserId' is null and metadata->>'newPortalUserId'='00000000-0000-4326-9000-000000000002'),'LINK audit stores null to portal B');
select ok(exists(select 1 from app_portal.audit_events where action='FANBUS_REGULAR_RIDER_RELINK'
  and metadata->>'oldPortalUserId'='00000000-0000-4326-9000-000000000002'
  and metadata->>'newPortalUserId'='00000000-0000-4326-9000-000000000003'),'RELINK audit stores portal A to B');
select ok(exists(select 1 from app_portal.audit_events where action='FANBUS_REGULAR_RIDER_UNLINK'
  and metadata->>'oldPortalUserId'='00000000-0000-4326-9000-000000000003' and metadata->>'newPortalUserId' is null),'UNLINK audit stores portal A to null');

insert into m326_f45_values values('audit-group',app_private.api_fanbus_person_group_create('{"name":"Auditgruppe"}'::jsonb));
update m326_f45_values set value=app_private.api_fanbus_person_group_members_replace(jsonb_build_object(
  'id',value->>'id','expectedRevision',1,'members',jsonb_build_array(
    jsonb_build_object('portalUserId','00000000-0000-4326-9000-000000000004'),
    jsonb_build_object('memberId','00000000-0000-4326-9100-000000000001'),
    jsonb_build_object('regularRiderId',(select value->>'id' from m326_f45_values where key='rider3'))
  ))) where key='audit-group';
update m326_f45_values set value=app_private.api_fanbus_person_group_members_replace(jsonb_build_object(
  'id',value->>'id','expectedRevision',2,'members','[]'::jsonb
)) where key='audit-group';
select is((select count(*)::integer from app_portal.audit_events where action in('FANBUS_PERSON_GROUP_MEMBER_ADDED','FANBUS_PERSON_GROUP_MEMBER_REMOVED') and metadata->>'anchorType'='PORTAL_USER' and metadata->>'anchorId'='00000000-0000-4326-9000-000000000004'),2,'portal anchor is retained in ADD and REMOVE audit');
select is((select count(*)::integer from app_portal.audit_events where action in('FANBUS_PERSON_GROUP_MEMBER_ADDED','FANBUS_PERSON_GROUP_MEMBER_REMOVED') and metadata->>'anchorType'='MEMBER' and metadata->>'anchorId'='00000000-0000-4326-9100-000000000001'),2,'member anchor is retained in ADD and REMOVE audit');
select is((select count(*)::integer from app_portal.audit_events where action in('FANBUS_PERSON_GROUP_MEMBER_ADDED','FANBUS_PERSON_GROUP_MEMBER_REMOVED') and metadata->>'anchorType'='REGULAR_RIDER' and metadata->>'anchorId'=(select value->>'id' from m326_f45_values where key='rider3')),2,'regular-rider anchor is retained in ADD and REMOVE audit');

insert into m326_f45_values values('inactive-group',app_private.api_fanbus_person_group_create('{"name":"Inaktiv bleibt"}'::jsonb));
update m326_f45_values set value=app_private.api_fanbus_person_group_members_replace(jsonb_build_object(
  'id',value->>'id','expectedRevision',1,'members',jsonb_build_array(jsonb_build_object('regularRiderId',(select value->>'id' from m326_f45_values where key='rider3')))
)) where key='inactive-group';
select app_private.api_fanbus_regular_rider_deactivate(jsonb_build_object(
  'id',(select value->>'id' from m326_f45_values where key='rider3'),'expectedRevision',1
));
select lives_ok($$update m326_f45_values set value=app_private.api_fanbus_person_group_members_replace(jsonb_build_object(
  'id',value->>'id','expectedRevision',2,'members',jsonb_build_array(
    jsonb_build_object('regularRiderId',(select value->>'id' from m326_f45_values where key='rider3')),
    jsonb_build_object('portalUserId','00000000-0000-4326-9000-000000000004')
  ))) where key='inactive-group'$$,'existing inactive anchor can be retained while group is edited');

select app_private.api_fanbus_regular_rider_deactivate(jsonb_build_object(
  'id',(select value->>'id' from m326_f45_values where key='rider4'),'expectedRevision',1
));
insert into m326_f45_values values('new-inactive-group',app_private.api_fanbus_person_group_create('{"name":"Neu inaktiv verboten"}'::jsonb));
select throws_ok($$select app_private.api_fanbus_person_group_members_replace(jsonb_build_object(
  'id',(select value->>'id' from m326_f45_values where key='new-inactive-group'),'expectedRevision',1,
  'members',jsonb_build_array(jsonb_build_object('regularRiderId',(select value->>'id' from m326_f45_values where key='rider4')))
))$$,'22023','FANBUS_PERSON_GROUP_MEMBER_UNAVAILABLE','new inactive anchor remains forbidden');

select * from finish();
rollback;
