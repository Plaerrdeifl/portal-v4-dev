\set ON_ERROR_STOP on
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Real-schema coverage complements the isolated SQL regression suite. No mocks
-- here: capability checks, public pd_api, projection and platform mode are real.
insert into auth.users(id,email) values
 ('00000000-0000-4607-8000-000000000001','primary-admin@example.invalid'),
 ('00000000-0000-4607-8000-000000000002','primary-member@example.invalid');
insert into app_portal.users(id,user_code,email,first_name,last_name,status,role_id) values
 ('00000000-0000-4607-8000-000000000001','U-PRIMARY-A','primary-admin@example.invalid','Primary','Admin','ACTIVE','00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4607-8000-000000000002','U-PRIMARY-M','primary-member@example.invalid','Primary','Member','ACTIVE','00000000-0000-4000-8000-000000000003');
insert into app_modules.events(id,event_type,title,event_date,event_time,visibility) values
 ('00000000-0000-4607-8100-000000000001','OTHER','Atomic PRIMARY regression',current_date+30,time '18:00','PUBLIC');
insert into app_modules.fanbus_trips(id,event_id,status,capacity) values
 ('00000000-0000-4607-8200-000000000001','00000000-0000-4607-8100-000000000001','DRAFT',54);
insert into app_modules.fanbus_bookings(id,trip_id,source) values
 ('00000000-0000-4607-8500-000000000001','00000000-0000-4607-8200-000000000001','GUEST');
select set_config('app.m325_registration_context','[]',true);
insert into app_modules.fanbus_registrations(id,trip_id,booking_id,booking_role,participant_sequence,
 first_name,last_name,email,bus_preference,status,source,privacy_reference,terms_reference,privacy_accepted_at,terms_accepted_at,waitlisted_at) values
 ('00000000-0000-4607-8600-000000000001','00000000-0000-4607-8200-000000000001','00000000-0000-4607-8500-000000000001','PRIMARY',1,'Old','Primary','primary-old@example.invalid','EGAL','ACTIVE','GUEST','privacy','terms',now(),now(),null),
 ('00000000-0000-4607-8600-000000000002','00000000-0000-4607-8200-000000000001','00000000-0000-4607-8500-000000000001','COMPANION',2,'New','Primary',null,'EGAL','WAITLISTED','PORTAL','privacy','terms',now(),now(),now()),
 ('00000000-0000-4607-8600-000000000003','00000000-0000-4607-8200-000000000001','00000000-0000-4607-8500-000000000001','COMPANION',3,'Existing','Email','primary-existing@example.invalid','EGAL','ACTIVE','GUEST','privacy','terms',now(),now(),null);
select set_config('request.jwt.claim.sub','00000000-0000-4607-8000-000000000001',true);

create function pg_temp.primary_payload(extra jsonb default '{}') returns jsonb language sql as $$
 select jsonb_build_object('bookingId','00000000-0000-4607-8500-000000000001',
   'participantId','00000000-0000-4607-8600-000000000002')||extra
$$;
create function pg_temp.roles_unchanged() returns boolean language sql as $$
 select (select booking_role='PRIMARY' from app_modules.fanbus_registrations where id='00000000-0000-4607-8600-000000000001')
   and (select booking_role='COMPANION' and email is null from app_modules.fanbus_registrations where id='00000000-0000-4607-8600-000000000002')
$$;
select throws_ok('select app_private.api_fanbus_booking_primary_set(pg_temp.primary_payload())',
 '22023','FANBUS_BOOKING_PRIMARY_EMAIL_REQUIRED','missing email is a domain error');
select ok(pg_temp.roles_unchanged(),'missing email leaves roles and contact unchanged');
select throws_ok($$select app_private.api_fanbus_booking_primary_set(pg_temp.primary_payload('{"contactEmail":"invalid"}'))$$,
 '22023','FANBUS_EMAIL_INVALID','invalid email is a domain error');
select ok(pg_temp.roles_unchanged(),'invalid email leaves roles and contact unchanged');
select throws_ok($$select app_private.api_fanbus_booking_primary_set(pg_temp.primary_payload('{"contactEmail":" PRIMARY-OLD@Example.invalid "}'))$$,
 '22023','FANBUS_PARTICIPANT_DUPLICATE','duplicate ACTIVE email is a domain error');
update app_modules.fanbus_registrations set status='WAITLISTED',waitlisted_at=now() where id='00000000-0000-4607-8600-000000000001';
select throws_ok($$select app_private.api_fanbus_booking_primary_set(pg_temp.primary_payload('{"contactEmail":"primary-old@example.invalid"}'))$$,
 '22023','FANBUS_PARTICIPANT_DUPLICATE','duplicate WAITLISTED email is a domain error');
select ok(pg_temp.roles_unchanged(),'duplicate email leaves roles and contact unchanged');
create temp table duplicate_result as select public.pd_api('fanbus_booking_primary_set',pg_temp.primary_payload('{"contactEmail":"primary-old@example.invalid"}')) result;
select is((select result->>'ok' from duplicate_result),'false','browser API rejects duplicate');
select ok((select result->'error'->>'code' not in ('23505','23514') from duplicate_result),'browser receives no constraint SQLSTATE');

create temp table promoted as select public.pd_api('fanbus_booking_primary_set',pg_temp.primary_payload('{"contactEmail":"  PRIMARY-NEW@Example.invalid  "}')) result;
select is((select result->>'ok' from promoted),'true','public API atomically promotes with contact');
select is((select email from app_modules.fanbus_registrations where id='00000000-0000-4607-8600-000000000002'),'primary-new@example.invalid','contact is normalized');
select is((select booking_role from app_modules.fanbus_registrations where id='00000000-0000-4607-8600-000000000001'),'COMPANION','old primary is companion');
select is((select count(*)::integer from app_modules.fanbus_registrations where booking_id='00000000-0000-4607-8500-000000000001' and booking_role='PRIMARY'),1,'exactly one primary remains');
select is((select result->'data' from promoted),app_private.api_fanbus_registrations_list('{"tripId":"00000000-0000-4607-8200-000000000001"}'),'response is the authoritative registrations projection');
select is((select count(*)::integer from app_portal.audit_events where action='FANBUS_BOOKING_PRIMARY_CHANGED' and entity_id='00000000-0000-4607-8500-000000000001'),1,'exactly one promotion audit');
select ok((select (metadata->>'contactEmailAdded')::boolean and not metadata ? 'contactEmail' from app_portal.audit_events where action='FANBUS_BOOKING_PRIMARY_CHANGED' and entity_id='00000000-0000-4607-8500-000000000001'),'audit records addition without duplicating email');

select lives_ok($$select app_private.api_fanbus_booking_primary_set(jsonb_build_object('bookingId','00000000-0000-4607-8500-000000000001','participantId','00000000-0000-4607-8600-000000000003'))$$,'legacy two-field payload promotes existing-email person');
select lives_ok($$select app_private.api_fanbus_booking_primary_set(pg_temp.primary_payload('{"contactEmail":"ignored@example.invalid"}'))$$,'existing email ignores supplemental contact');
select is((select email from app_modules.fanbus_registrations where id='00000000-0000-4607-8600-000000000002'),'primary-new@example.invalid','existing contact stays unchanged');

select set_config('request.jwt.claim.sub','00000000-0000-4607-8000-000000000002',true);
select throws_ok($$select app_private.api_fanbus_booking_primary_set(pg_temp.primary_payload())$$,'42501',null,'member cannot bypass capability');
select set_config('request.jwt.claim.sub','00000000-0000-4607-8000-000000000001',true);
update app_portal.settings set value=jsonb_set(value,'{mode}','"READ_ONLY"') where key='platform.mode';
select is(public.pd_api('fanbus_booking_primary_set',pg_temp.primary_payload())->'error'->>'code','PLATFORM_READ_ONLY','public boundary blocks READ_ONLY');
update app_portal.settings set value=jsonb_set(value,'{mode}','"MAINTENANCE"') where key='platform.mode';
select is(public.pd_api('fanbus_booking_primary_set',pg_temp.primary_payload())->'error'->>'code','PLATFORM_MAINTENANCE','public boundary blocks MAINTENANCE');
update app_portal.settings set value=jsonb_set(value,'{mode}','"NORMAL"') where key='platform.mode';
update app_modules.fanbus_trips set status='CANCELLED',cancelled_at=now(),cancellation_reason='Regression' where id='00000000-0000-4607-8200-000000000001';
select throws_ok($$select app_private.api_fanbus_booking_primary_set(pg_temp.primary_payload())$$,'P3302','FANBUS_TRIP_CANCELLED','cancelled trip remains immutable');
select ok(not has_table_privilege('authenticated','app_modules.fanbus_registrations','UPDATE'),'browser has no direct registration write');
select ok(not has_function_privilege('authenticated','app_private.api_fanbus_booking_primary_set(jsonb)','EXECUTE'),'private function stays private');
select * from finish();
rollback;
