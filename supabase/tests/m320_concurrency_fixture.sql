\set ON_ERROR_STOP on

delete from app_modules.fanbus_bus_assignments
where trip_id::text like '00000000-0000-4320-9200-%';
delete from app_private.fanbus_registration_idempotency
where trip_id::text like '00000000-0000-4320-9200-%';
delete from app_modules.fanbus_registrations
where trip_id::text like '00000000-0000-4320-9200-%';
delete from app_modules.fanbus_buses
where trip_id::text like '00000000-0000-4320-9200-%';
delete from app_modules.fanbus_bookings
where trip_id::text like '00000000-0000-4320-9200-%';
delete from app_modules.fanbus_trips
where id::text like '00000000-0000-4320-9200-%';
delete from app_modules.events
where id::text like '00000000-0000-4320-9100-%';
delete from app_portal.users
where id = '00000000-0000-4320-9000-000000000001';
delete from auth.users
where id = '00000000-0000-4320-9000-000000000001';

insert into auth.users (id, email) values
  ('00000000-0000-4320-9000-000000000001', 'm320-concurrency@example.invalid');
insert into app_portal.users (
  id, user_code, email, first_name, last_name, status, role_id
) values (
  '00000000-0000-4320-9000-000000000001', 'U-M320-CONCURRENCY',
  'm320-concurrency@example.invalid', 'M320', 'Concurrency', 'ACTIVE',
  '00000000-0000-4000-8000-000000000001'
);

insert into app_modules.events (
  id, event_type, title, event_date, event_time, visibility
) select
  ('00000000-0000-4320-9100-' || lpad(value::text, 12, '0'))::uuid,
  'OTHER', 'M320 Concurrency ' || value, current_date + 20 + value,
  time '18:00', 'PUBLIC'
from generate_series(1, 7) as value;

insert into app_modules.fanbus_trips (
  id, event_id, departure_at, departure_info,
  registration_opens_at, registration_closes_at,
  price_cents, capacity, privacy_reference, terms_reference, status
) select
  ('00000000-0000-4320-9200-' || lpad(value::text, 12, '0'))::uuid,
  ('00000000-0000-4320-9100-' || lpad(value::text, 12, '0'))::uuid,
  now() + interval '15 days' + value * interval '1 day',
  'Concurrency-Abfahrt ' || value,
  now() - interval '1 day', now() + interval '14 days',
  1000,
  case value when 2 then 2 when 4 then 1 else 10 end,
  'privacy-v1', 'terms-v1', 'PUBLISHED'
from generate_series(1, 7) as value;

update app_modules.fanbus_trips set capacity = 1
where id in (
  '00000000-0000-4320-9200-000000000001',
  '00000000-0000-4320-9200-000000000003',
  '00000000-0000-4320-9200-000000000005'
);

create or replace function app_private.m320_concurrency_single(
  p_trip uuid, p_email text, p_key uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.fanbus_submit_booking_core(
    p_trip, 'GUEST', null,
    jsonb_build_object(
      'firstName', 'Concurrent', 'lastName', split_part(p_email, '@', 1),
      'email', p_email, 'busPreference', 'EGAL'
    ),
    '[]', true, true, p_key
  );
$$;

create or replace function app_private.m320_concurrency_batch(
  p_trip uuid, p_email text, p_key uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.fanbus_submit_booking_core(
    p_trip, 'GUEST', null,
    jsonb_build_object(
      'firstName', 'Batch', 'lastName', split_part(p_email, '@', 1),
      'email', p_email, 'busPreference', 'EGAL'
    ),
    jsonb_build_array(jsonb_build_object(
      'firstName', 'Companion', 'lastName', split_part(p_email, '@', 1),
      'email', 'companion-' || p_email, 'busPreference', 'EGAL'
    )),
    true, true, p_key
  );
$$;

create or replace function app_private.m320_concurrency_as_admin(
  p_action text, p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config(
    'request.jwt.claim.sub', '00000000-0000-4320-9000-000000000001', true
  );
  case p_action
    when 'PROMOTE' then
      return app_private.api_fanbus_waitlist_promote(p_payload);
    when 'ASSIGN' then
      return app_private.api_fanbus_bus_assignment_set(p_payload);
    when 'CANCEL' then
      return app_private.api_fanbus_registration_cancel(p_payload);
    else
      raise exception 'M320_CONCURRENCY_ACTION_INVALID';
  end case;
end;
$$;

do $m320_concurrency_seed$
begin
  -- Two waitlisted participants for concurrent promotion.
  perform app_private.m320_concurrency_batch(
    '00000000-0000-4320-9200-000000000003',
    'promotion@example.invalid',
    '00000000-0000-4320-9300-000000000001'
  );

  -- One active participant for cancel versus submit.
  perform app_private.m320_concurrency_single(
    '00000000-0000-4320-9200-000000000004',
    'cancel@example.invalid',
    '00000000-0000-4320-9300-000000000002'
  );

  -- Two waitlisted participants for assignment races after explicit activation.
  perform app_private.m320_concurrency_batch(
    '00000000-0000-4320-9200-000000000005',
    'assignment@example.invalid',
    '00000000-0000-4320-9300-000000000003'
  );
end
$m320_concurrency_seed$;
insert into app_modules.fanbus_buses (
  id, trip_id, label, category, capacity, is_active
) values
  ('00000000-0000-4320-9400-000000000001', '00000000-0000-4320-9200-000000000005', 'Concurrency A', 'NORMAL', 1, true),
  ('00000000-0000-4320-9400-000000000002', '00000000-0000-4320-9200-000000000005', 'Concurrency B', 'NORMAL', 1, true);
