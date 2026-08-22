\set ON_ERROR_STOP on

\if :{?M330_OUTER_TRANSACTION}
\else
begin;
\endif

create extension if not exists pgtap with schema extensions;
select plan(35);

select has_column('app_modules', 'fanbus_trips', 'cancellation_reason', 'Cancellation Reason exists');
select has_column('app_modules', 'fanbus_trips', 'cancelled_at', 'Cancellation timestamp exists');
select has_column('app_modules', 'fanbus_trips', 'cancelled_by', 'Cancellation actor exists');
select has_column('app_portal', 'notification_preferences', 'push_fanbus_trip_cancellations', 'Trip-cancellation push preference exists');
select ok(not has_function_privilege('anon', 'app_private.api_fanbus_trip_cancel(jsonb)', 'EXECUTE'), 'anon cannot execute cancellation directly');
select ok(not has_function_privilege('authenticated', 'app_private.api_fanbus_trip_cancel(jsonb)', 'EXECUTE'), 'authenticated cannot execute cancellation directly');

insert into auth.users (id, email) values
  ('00000000-0000-4330-8000-000000000001', 'm330-admin@example.invalid');
insert into app_portal.users (
  id, user_code, email, first_name, last_name, status, role_id
) values (
  '00000000-0000-4330-8000-000000000001', 'U-M330-ADMIN',
  'm330-admin@example.invalid', 'M330', 'Admin', 'ACTIVE',
  '00000000-0000-4000-8000-000000000001'
);
select set_config('request.jwt.claim.sub', '00000000-0000-4330-8000-000000000001', true);

insert into app_modules.events (
  id, event_type, title, event_date, event_time, visibility
) select
  ('00000000-0000-4330-8100-' || lpad(value::text, 12, '0'))::uuid,
  'OTHER', 'M330 Fahrt ' || value, current_date + 20 + value, time '18:00', 'PUBLIC'
from generate_series(1, 6) as value;

insert into app_modules.fanbus_trips (
  id, event_id, departure_at, registration_opens_at, registration_closes_at,
  price_cents, capacity, privacy_reference, terms_reference, status
) values
  ('00000000-0000-4330-8200-000000000001', '00000000-0000-4330-8100-000000000001', now()+interval '20 days', now()-interval '1 day', now()+interval '19 days', 2500, 2, 'privacy-v1', 'terms-v1', 'PUBLISHED'),
  ('00000000-0000-4330-8200-000000000002', '00000000-0000-4330-8100-000000000002', now()+interval '21 days', now()-interval '1 day', now()+interval '20 days', 2500, 2, 'privacy-v1', 'terms-v1', 'CLOSED'),
  ('00000000-0000-4330-8200-000000000003', '00000000-0000-4330-8100-000000000003', now()+interval '22 days', now()-interval '1 day', now()+interval '21 days', 2500, 2, 'privacy-v1', 'terms-v1', 'CLOSED'),
  ('00000000-0000-4330-8200-000000000004', '00000000-0000-4330-8100-000000000004', null, null, null, null, null, null, null, 'DRAFT'),
  ('00000000-0000-4330-8200-000000000005', '00000000-0000-4330-8100-000000000005', now()+interval '24 days', now()-interval '1 day', now()+interval '23 days', 2500, 2, 'privacy-v1', 'terms-v1', 'PUBLISHED'),
  ('00000000-0000-4330-8200-000000000006', '00000000-0000-4330-8100-000000000006', now()+interval '25 days', now()-interval '1 day', now()+interval '24 days', 2500, 2, 'privacy-v1', 'terms-v1', 'PUBLISHED');

insert into app_modules.fanbus_buses (trip_id, label, category, capacity, is_active)
values ('00000000-0000-4330-8200-000000000001', 'M330 Bus', 'NORMAL', 1, true);

select app_private.log_audit(
  '00000000-0000-4330-8000-000000000001', 'FANBUS_TRIP_PUBLISHED',
  'fanbus_trip', '00000000-0000-4330-8200-000000000002',
  '{"status":"DRAFT"}', '{"status":"PUBLISHED"}', '{}'
);

select is(
  app_private.fanbus_submit_booking_core(
    '00000000-0000-4330-8200-000000000001', 'GUEST', null,
    '{"firstName":"Primär","lastName":"Kontakt","email":"primary-m330@example.invalid","busPreference":"EGAL"}',
    '[{"firstName":"Aktiv","lastName":"Begleitung","email":"active-companion-m330@example.invalid","busPreference":"EGAL"}]',
    true, true, '00000000-0000-4330-8300-000000000001'
  ) ->> 'outcome',
  'WAITLISTED', 'booking core creates a stable booking before cancellation'
);

create temporary table m330_before as
select
  (select count(*) from app_modules.fanbus_bookings where trip_id='00000000-0000-4330-8200-000000000001') as bookings,
  (select count(*) from app_modules.fanbus_registrations where trip_id='00000000-0000-4330-8200-000000000001') as registrations;

select lives_ok(
  $$select app_private.api_fanbus_trip_cancel('{"id":"00000000-0000-4330-8200-000000000001","expectedRevision":1,"cancellationReason":"  Spiel wurde abgesagt.  "}')$$,
  'PUBLISHED can be cancelled'
);
select is((select status from app_modules.fanbus_trips where id='00000000-0000-4330-8200-000000000001'), 'CANCELLED', 'status is CANCELLED');
select is((select cancellation_reason from app_modules.fanbus_trips where id='00000000-0000-4330-8200-000000000001'), 'Spiel wurde abgesagt.', 'reason is trimmed');
select ok((select cancelled_at is not null from app_modules.fanbus_trips where id='00000000-0000-4330-8200-000000000001'), 'cancelledAt is stored');
select is((select cancelled_by::text from app_modules.fanbus_trips where id='00000000-0000-4330-8200-000000000001'), '00000000-0000-4330-8000-000000000001', 'actor is server-derived');
select is((select revision from app_modules.fanbus_trips where id='00000000-0000-4330-8200-000000000001'), 2, 'revision increments exactly once');
select is((select count(*)::integer from app_portal.audit_events where action='FANBUS_TRIP_CANCELLED' and entity_id='00000000-0000-4330-8200-000000000001'), 1, 'exactly one cancellation audit exists');
select is((select count(*)::integer from app_private.notification_events where event_key='fanbus-trip:00000000-0000-4330-8200-000000000001:cancelled'), 1, 'exactly one cancellation event exists');

select lives_ok(
  $$select app_private.api_fanbus_trip_cancel('{"id":"00000000-0000-4330-8200-000000000001","expectedRevision":1,"cancellationReason":"Spiel wurde abgesagt."}')$$,
  'same normalized reason is idempotent even with old expectedRevision'
);
select is((select revision from app_modules.fanbus_trips where id='00000000-0000-4330-8200-000000000001'), 2, 'idempotent replay does not bump revision');
select is((select count(*)::integer from app_portal.audit_events where action='FANBUS_TRIP_CANCELLED' and entity_id='00000000-0000-4330-8200-000000000001'), 1, 'idempotent replay does not add audit');
select is((select count(*)::integer from app_private.notification_events where event_key='fanbus-trip:00000000-0000-4330-8200-000000000001:cancelled'), 1, 'idempotent replay does not add event');
select throws_ok(
  $$select app_private.api_fanbus_trip_cancel('{"id":"00000000-0000-4330-8200-000000000001","expectedRevision":2,"cancellationReason":"Anderer Grund"}')$$,
  'P3301', 'FANBUS_TRIP_ALREADY_CANCELLED', 'different retry is rejected'
);

select is((select count(*) from app_modules.fanbus_bookings where trip_id='00000000-0000-4330-8200-000000000001'), (select bookings from m330_before), 'bookings are preserved');
select is((select count(*) from app_modules.fanbus_registrations where trip_id='00000000-0000-4330-8200-000000000001'), (select registrations from m330_before), 'registrations are preserved');
select ok(not exists(select 1 from app_modules.fanbus_registrations where trip_id='00000000-0000-4330-8200-000000000001' and status='CANCELLED'), 'participant statuses are not rewritten');

select lives_ok(
  $$select app_private.api_fanbus_trip_cancel('{"id":"00000000-0000-4330-8200-000000000002","expectedRevision":1,"cancellationReason":"Veranstaltung entfällt"}')$$,
  'CLOSED with published audit can be cancelled'
);
select throws_ok(
  $$select app_private.api_fanbus_trip_cancel('{"id":"00000000-0000-4330-8200-000000000003","expectedRevision":1,"cancellationReason":"Veranstaltung entfällt"}')$$,
  '22023', 'FANBUS_TRIP_WAS_NEVER_PUBLISHED', 'CLOSED without published audit cannot be cancelled'
);
select throws_ok(
  $$select app_private.api_fanbus_trip_cancel('{"id":"00000000-0000-4330-8200-000000000004","expectedRevision":1,"cancellationReason":"Veranstaltung entfällt"}')$$,
  '22023', 'FANBUS_TRIP_CANCELLATION_TRANSITION_INVALID', 'DRAFT cannot be cancelled'
);
select throws_ok(
  $$select app_private.api_fanbus_trip_cancel('{"id":"00000000-0000-4330-8200-000000000004","expectedRevision":2,"cancellationReason":""}')$$,
  '40001', 'STALE_REVISION', 'revision is checked before reason on a mutable trip'
);
select throws_ok(
  $$select app_private.api_fanbus_trip_cancel('{"id":"00000000-0000-4330-8200-000000000005","expectedRevision":1,"cancellationReason":"   "}')$$,
  '22023', 'FANBUS_TRIP_CANCELLATION_REASON_INVALID', 'empty normalized reason is rejected'
);
select throws_ok(
  $$select app_private.api_fanbus_trip_cancel(jsonb_build_object('id','00000000-0000-4330-8200-000000000005','expectedRevision',1,'cancellationReason',repeat('x',241)))$$,
  '22023', 'FANBUS_TRIP_CANCELLATION_REASON_INVALID', 'reason longer than 240 is rejected'
);
select throws_ok(
  $$select app_private.api_fanbus_trip_cancel('{"id":"00000000-0000-4330-8200-000000000006","expectedRevision":2,"cancellationReason":"Ausfall"}')$$,
  '40001', 'STALE_REVISION', 'stale cancellation revision is rejected'
);
select throws_ok(
  $$select app_private.api_fanbus_trip_cancel(jsonb_build_object('id','00000000-0000-4330-8200-000000000002','expectedRevision',2,'cancellationReason',repeat('x',241)))$$,
  'P3301', 'FANBUS_TRIP_ALREADY_CANCELLED', 'terminal conflict wins over a changed overlong reason'
);

select is(public.pd_public_fanbus_trip('00000000-0000-4330-8200-000000000001') ->> 'tripStatus', 'CANCELLED', 'public direct read exposes cancelled trip');
select is(public.pd_public_fanbus_trip('00000000-0000-4330-8200-000000000001') ->> 'registrationStatus', 'CANCELLED', 'public registration status is CANCELLED');
select ok((public.pd_public_fanbus_trips() -> 'trips') @> '[{"tripId":"00000000-0000-4330-8200-000000000001","tripStatus":"CANCELLED"}]', 'public list exposes cancelled trip');
select ok(not (public.pd_public_fanbus_trip('00000000-0000-4330-8200-000000000001') ?| array['cancelledBy','email','bookingId','isPaid']), 'public projection has no forbidden data');

select * from finish();
\if :{?M330_OUTER_TRANSACTION}
\else
rollback;
\endif
