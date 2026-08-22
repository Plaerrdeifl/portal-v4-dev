\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-4330-9000-000000000001', 'm330-concurrency@example.invalid')
on conflict (id) do nothing;
insert into app_portal.users (id,user_code,email,first_name,last_name,status,role_id)
values ('00000000-0000-4330-9000-000000000001','U-M330-CONCURRENCY','m330-concurrency@example.invalid','M330','Concurrency','ACTIVE','00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into app_modules.events (id,event_type,title,event_date,event_time,visibility)
select ('00000000-0000-4330-9100-'||lpad(value::text,12,'0'))::uuid,
  'OTHER','M330 Concurrency '||value,current_date+30+value,time '18:00','PUBLIC'
from generate_series(1,5) value on conflict (id) do nothing;

insert into app_modules.fanbus_trips (
  id,event_id,departure_at,registration_opens_at,registration_closes_at,
  price_cents,capacity,privacy_reference,terms_reference,status
)
select ('00000000-0000-4330-9200-'||lpad(value::text,12,'0'))::uuid,
  ('00000000-0000-4330-9100-'||lpad(value::text,12,'0'))::uuid,
  now()+interval '29 days'+value*interval '1 day',now()-interval '1 day',
  now()+interval '28 days',1000,10,'privacy-v1','terms-v1','PUBLISHED'
from generate_series(1,5) value on conflict (id) do nothing;

insert into app_modules.fanbus_buses (id,trip_id,label,category,capacity,is_active)
select ('00000000-0000-4330-9400-'||lpad(value::text,12,'0'))::uuid,
  ('00000000-0000-4330-9200-'||lpad(value::text,12,'0'))::uuid,
  'M330 Bus '||value,'NORMAL',case when value=2 then 1 else 10 end,true
from generate_series(1,5) value on conflict (id) do nothing;

create or replace function app_private.m330_concurrency_actor()
returns void language plpgsql security definer set search_path='' as $$
begin
  perform set_config('request.jwt.claim.sub','00000000-0000-4330-9000-000000000001',true);
end; $$;

create or replace function app_private.m330_concurrency_book(p_trip uuid,p_key uuid,p_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform app_private.m330_concurrency_actor();
  return app_private.fanbus_submit_booking_core(
    p_trip,'GUEST',null,
    jsonb_build_object('firstName','Race','lastName',split_part(p_email,'@',1),'email',p_email,'busPreference','EGAL'),
    '[]',true,true,p_key
  );
end; $$;

create or replace function app_private.m330_concurrency_cancel(p_trip uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_revision integer;
begin
  perform app_private.m330_concurrency_actor();
  select revision into v_revision from app_modules.fanbus_trips where id=p_trip;
  return app_private.api_fanbus_trip_cancel(jsonb_build_object(
    'id',p_trip,'expectedRevision',v_revision,'cancellationReason','Concurrency-Testabsage'
  ));
end; $$;

create or replace function app_private.m330_concurrency_promote(p_participant uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_revision integer;
begin
  perform app_private.m330_concurrency_actor();
  select revision into v_revision from app_modules.fanbus_registrations where id=p_participant;
  return app_private.api_fanbus_waitlist_promote(jsonb_build_object('id',p_participant,'expectedRevision',v_revision));
end; $$;

create or replace function app_private.m330_concurrency_operate(p_participant uuid,p_bus uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_revision integer;
begin
  perform app_private.m330_concurrency_actor();
  perform app_private.api_fanbus_bus_assignment_set(jsonb_build_object('participantId',p_participant,'busId',p_bus));
  select coalesce(checkin.revision,1) into v_revision
  from app_modules.fanbus_registrations registration
  left join app_modules.fanbus_participant_checkins checkin on checkin.participant_id=registration.id and checkin.checkin_kind='OUTBOUND'
  where registration.id=p_participant;
  return app_private.api_fanbus_checkin_set(jsonb_build_object('participantId',p_participant,'expectedRevision',v_revision,'status','PRESENT'));
end; $$;

create or replace function app_private.m330_concurrency_assign(p_participant uuid,p_bus uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform app_private.m330_concurrency_actor();
  return app_private.api_fanbus_bus_assignment_set(jsonb_build_object('participantId',p_participant,'busId',p_bus));
end; $$;

create or replace function app_private.m330_concurrency_update(p_trip uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t app_modules.fanbus_trips%rowtype;
begin
  perform app_private.m330_concurrency_actor();
  select * into t from app_modules.fanbus_trips where id=p_trip;
  return app_private.api_fanbus_trip_update(jsonb_build_object(
    'id',t.id,'expectedRevision',t.revision,'departureAt',t.departure_at,
    'departureInfo',t.departure_info,'registrationClosesAt',t.registration_closes_at,
    'priceCents',t.price_cents,'capacity',t.capacity,
    'privacyReference',t.privacy_reference,'termsReference',t.terms_reference
  ));
end; $$;

select app_private.m330_concurrency_book('00000000-0000-4330-9200-000000000002','00000000-0000-4330-9300-000000000021','active-m330@example.invalid');
select app_private.m330_concurrency_book('00000000-0000-4330-9200-000000000002','00000000-0000-4330-9300-000000000022','waitlist-m330@example.invalid');
select app_private.m330_concurrency_book('00000000-0000-4330-9200-000000000003','00000000-0000-4330-9300-000000000031','operations-m330@example.invalid');
