\set ON_ERROR_STOP on
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,email) values
  ('00000000-0000-4606-8000-000000000001','draft-delete-admin@example.invalid'),
  ('00000000-0000-4606-8000-000000000002','draft-delete-member@example.invalid');
insert into app_portal.users(id,user_code,email,first_name,last_name,status,role_id) values
  ('00000000-0000-4606-8000-000000000001','U-DD-A','draft-delete-admin@example.invalid','Draft','Admin','ACTIVE','00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4606-8000-000000000002','U-DD-M','draft-delete-member@example.invalid','Draft','Member','ACTIVE','00000000-0000-4000-8000-000000000003');
insert into app_modules.fanbus_boarding_stops(label,position,is_active)
select label,position,true from (values ('Icedome',2),('Pendlerparkplatz',1)) defaults(label,position)
where not exists (select 1 from app_modules.fanbus_boarding_stops s where lower(btrim(s.label))=lower(defaults.label) and s.is_active);
select set_config('request.jwt.claim.sub','00000000-0000-4606-8000-000000000001',true);

-- Each fixture goes through the actual browser create contract, not a hand-built trip.
create function pg_temp.new_draft() returns uuid language plpgsql as $$
declare v_event_id uuid; v_trip_id uuid; v_result jsonb;
begin
  insert into app_modules.events(event_type,title,event_date,event_time,visibility)
  values ('OTHER','Draft-delete regression',current_date+30,time '18:00','PUBLIC') returning id into v_event_id;
  v_result := public.pd_api('fanbus_trip_create',jsonb_build_object('eventId',v_event_id));
  if v_result->>'ok' <> 'true' then raise exception 'Create failed: %',v_result; end if;
  select id into strict v_trip_id from app_modules.fanbus_trips where event_id=v_event_id;
  return v_trip_id;
end;
$$;
create function pg_temp.delete_result(trip_id uuid, revision integer default 1) returns jsonb
language sql as $$ select public.pd_api('fanbus_trip_delete',jsonb_build_object('id',trip_id,'expectedRevision',revision)) $$;
create temporary table fixture(name text primary key, trip_id uuid not null);
grant select on fixture to authenticated;
insert into fixture values ('empty',pg_temp.new_draft()),('protected',pg_temp.new_draft());

select is((select count(*)::integer from app_modules.fanbus_trip_boarding_stops where trip_id=(select trip_id from fixture where name='empty')),2,'new draft creates both default stops');
set local role authenticated;
-- Test the same public RPC and role used by the browser.
select public.pd_api('fanbus_trip_delete',jsonb_build_object('id',(select trip_id from fixture where name='empty'),'expectedRevision',1)) as browser_result \gset
set local role postgres;
select is(:'browser_result'::jsonb->>'ok','true','authenticated browser deletes empty defaulted draft');
select is((select count(*)::integer from app_modules.fanbus_trips where id=(select trip_id from fixture where name='empty')),0,'deleted trip is absent');
select is((select count(*)::integer from app_modules.fanbus_trip_boarding_stops where trip_id=(select trip_id from fixture where name='empty')),0,'default children are removed without orphans');
select is((select count(*)::integer from app_portal.audit_events where action='FANBUS_TRIP_DELETED' and entity_id=(select trip_id::text from fixture where name='empty')),1,'existing delete audit emitted exactly once');
select is((select before_data->>'status' from app_portal.audit_events where action='FANBUS_TRIP_DELETED' and entity_id=(select trip_id::text from fixture where name='empty')),'DRAFT','audit retains previous trip status');
select is((select count(*)::integer from app_modules.fanbus_trip_boarding_stops where trip_id=(select trip_id from fixture where name='protected')),2,'another draft is untouched');
select ok(exists(select 1 from app_modules.fanbus_boarding_stops where lower(btrim(label))='icedome'),'shared master stop survives');

select is(pg_temp.delete_result((select trip_id from fixture where name='protected'),99)->'error'->>'code','40001','stale revision still fails');
select is((select count(*)::integer from app_modules.fanbus_trip_boarding_stops where trip_id=(select trip_id from fixture where name='protected')),2,'stale delete leaves default children intact');
update app_modules.fanbus_trips set status='PUBLISHED' where id=(select trip_id from fixture where name='protected');
select is(pg_temp.delete_result((select trip_id from fixture where name='protected'))->'error'->>'code','22023','PUBLISHED cannot be deleted');
update app_modules.fanbus_trips set status='CLOSED' where id=(select trip_id from fixture where name='protected');
select is(pg_temp.delete_result((select trip_id from fixture where name='protected'))->'error'->>'code','22023','CLOSED cannot be deleted');
update app_modules.fanbus_trips set status='DRAFT' where id=(select trip_id from fixture where name='protected');
select set_config('request.jwt.claim.sub','00000000-0000-4606-8000-000000000002',true);
select is(pg_temp.delete_result((select trip_id from fixture where name='protected'))->'error'->>'code','42501','member without fanbus.manage cannot delete');
select set_config('request.jwt.claim.sub','00000000-0000-4606-8000-000000000001',true);

-- Independent fixtures ensure each FK category blocks on its own. No publishing
-- or prediction API/runtime behavior is modified: these are DB protection fixtures.
create function pg_temp.protected_child(child_table text, insert_sql text) returns setof text language plpgsql as $$
declare v_trip_id uuid := pg_temp.new_draft(); v_event_id uuid; v_result jsonb; v_remaining integer;
begin
  select t.event_id into v_event_id from app_modules.fanbus_trips t where t.id=v_trip_id;
  execute insert_sql using v_trip_id,v_event_id;
  v_result := pg_temp.delete_result(v_trip_id);
  return next is(v_result->'error'->>'code','23503',child_table||' prevents deletion');
  return next ok(exists(select 1 from app_modules.fanbus_trips t where t.id=v_trip_id),child_table||': trip survives');
  return next is((select count(*)::integer from app_modules.fanbus_trip_boarding_stops s where s.trip_id=v_trip_id),2,child_table||': cleanup is atomic');
  execute format('select count(*)::integer from %s where trip_id=$1',child_table) into v_remaining using v_trip_id;
  return next is(v_remaining,1,child_table||': child survives unchanged');
end;
$$;
select * from pg_temp.protected_child('app_modules.fanbus_buses',$$insert into app_modules.fanbus_buses(trip_id,label,category,capacity) values($1,'Test','NORMAL',20)$$);
select * from pg_temp.protected_child('app_modules.fanbus_bookings',$$insert into app_modules.fanbus_bookings(trip_id,source) values($1,'GUEST')$$);
select * from pg_temp.protected_child('app_modules.fanbus_travel_groups',$$insert into app_modules.fanbus_travel_groups(trip_id,name) values($1,'Protected')$$);
select * from pg_temp.protected_child('app_modules.fanbus_prediction_games',$$insert into app_modules.fanbus_prediction_games(trip_id,event_id,mode) values($1,$2,'TRIP')$$);
insert into app_modules.fanbus_publishing_places(slug,display_name) values ('draft-delete-test','Draft delete test');
select * from pg_temp.protected_child('app_modules.fanbus_publishing_jobs',$$insert into app_modules.fanbus_publishing_jobs(environment,trip_id,event_id,place_id,request_snapshot) select 'DEV',$1,$2,id,'{}' from app_modules.fanbus_publishing_places where slug='draft-delete-test'$$);
select * from pg_temp.protected_child('app_modules.fanbus_publishing_trip_referral_daily',$$insert into app_modules.fanbus_publishing_trip_referral_daily(trip_id,place_id,day) select $1,id,current_date from app_modules.fanbus_publishing_places where slug='draft-delete-test'$$);
select * from pg_temp.protected_child('app_private.fanbus_registration_idempotency',$$insert into app_private.fanbus_registration_idempotency(idempotency_key,request_hash,trip_id,outcome) values(extensions.gen_random_uuid(),repeat('0',64),$1,'UNAVAILABLE')$$);
select * from pg_temp.protected_child('app_private.fanbus_m325_idempotency',$$insert into app_private.fanbus_m325_idempotency(idempotency_key,request_hash,trip_id) values(extensions.gen_random_uuid(),repeat('0',64),$1)$$);

insert into app_modules.fanbus_bookings(trip_id,source) select trip_id,'GUEST' from fixture where name='protected';
select set_config('app.m325_registration_context','[]',true);
insert into app_modules.fanbus_registrations(trip_id,booking_id,booking_role,participant_sequence,first_name,last_name,email,bus_preference,source,privacy_reference,terms_reference,privacy_accepted_at,terms_accepted_at)
select trip_id,id,'PRIMARY',1,'Protected','Participant','protected@example.invalid','EGAL','GUEST','privacy','terms',now(),now()
from app_modules.fanbus_bookings where trip_id=(select trip_id from fixture where name='protected');
select is(pg_temp.delete_result((select trip_id from fixture where name='protected'))->'error'->>'code','23503','DRAFT with registration cannot be deleted');
select is((select count(*)::integer from app_modules.fanbus_registrations where trip_id=(select trip_id from fixture where name='protected')),1,'participant remains');
select is((select count(*)::integer from app_modules.fanbus_trip_boarding_stops where trip_id=(select trip_id from fixture where name='protected')),2,'registration rejection preserves stops');

insert into fixture values ('edited',pg_temp.new_draft());
update app_modules.fanbus_trip_boarding_stops set trip_note='Operational note' where trip_id=(select trip_id from fixture where name='edited') and position=1;
select is(pg_temp.delete_result((select trip_id from fixture where name='edited'))->'error'->>'code','23503','edited stop is not disposable default data');
select is((select trip_note from app_modules.fanbus_trip_boarding_stops where trip_id=(select trip_id from fixture where name='edited') and position=1),'Operational note','edited stop remains unchanged');
select is((select count(*)::integer from app_portal.audit_events where action='FANBUS_TRIP_DELETED' and entity_id=(select trip_id::text from fixture where name='edited')),0,'failed deletion emits no success audit');
insert into fixture values ('revision',pg_temp.new_draft()),('custom',pg_temp.new_draft());
update app_modules.fanbus_trip_boarding_stops set revision=2 where trip_id=(select trip_id from fixture where name='revision') and position=1;
select is(pg_temp.delete_result((select trip_id from fixture where name='revision'))->'error'->>'code','23503','revised stop is protected even if values match defaults');
update app_modules.fanbus_trip_boarding_stops set created_at=created_at+interval '1 second' where trip_id=(select trip_id from fixture where name='custom') and position=1;
select is(pg_temp.delete_result((select trip_id from fixture where name='custom'))->'error'->>'code','23503','later custom stop is not inferred to be an automatic default');
select ok(not has_table_privilege('authenticated','app_modules.fanbus_trips','DELETE'),'no direct browser trip delete right');
select ok(not has_table_privilege('authenticated','app_modules.fanbus_trip_boarding_stops','DELETE'),'no direct browser child delete right');
select has_function('public','pd_api',array['text','jsonb'],'public.pd_api remains browser contract');
select * from finish();
rollback;
