\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-4555-8555-000000000019', 'fanbus-groups@example.invalid');
insert into app_portal.users (
  id, user_code, email, first_name, last_name, status, role_id
) values (
  '00000000-0000-4555-8555-000000000019', 'U-FANBUS-GROUPS',
  'fanbus-groups@example.invalid', 'Fanbus', 'Groups', 'ACTIVE',
  '00000000-0000-4000-8000-000000000001'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4555-8555-000000000019',
  true
);
update app_portal.settings
set value = jsonb_build_object('mode', 'NORMAL', 'environment', 'LOCAL'),
    revision = revision + 1
where key = 'platform.mode';

select ok(
  app_private.has_capability(auth.uid(), 'fanbus.registrations.manage'),
  'Fixture actor may manage registrations'
);
select is(
  app_private.platform_action_classification('fanbus_booking_group_candidates'),
  'READ',
  'Group candidates are a read action'
);
select is(
  app_private.platform_action_classification('fanbus_bookings_merge'),
  'USER_MUTATION',
  'Booking merge is a user mutation'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.api_fanbus_bookings_merge(jsonb)',
    'EXECUTE'
  ),
  'Group APIs remain internal and are not executable directly by authenticated'
);

insert into app_modules.events (
  id, event_type, title, event_date, visibility, created_by, updated_by
) values (
  '00000000-0000-4555-8100-000000000001',
  'OTHER', 'Fanbus booking groups', date '2035-09-19', 'INTERNAL',
  auth.uid(), auth.uid()
);
insert into app_modules.fanbus_trips (
  id, event_id, status, bus_preference_enabled, created_by, updated_by
) values (
  '00000000-0000-4555-8200-000000000001',
  '00000000-0000-4555-8100-000000000001',
  'CLOSED', true, auth.uid(), auth.uid()
);
insert into app_modules.fanbus_buses (
  id, trip_id, label, category, capacity, is_active, created_by, updated_by
) values
  ('00000000-0000-4555-8300-000000000001','00000000-0000-4555-8200-000000000001','Gruppe A','NORMAL',5,true,auth.uid(),auth.uid()),
  ('00000000-0000-4555-8300-000000000002','00000000-0000-4555-8200-000000000001','Override','PARTY',5,true,auth.uid(),auth.uid()),
  ('00000000-0000-4555-8300-000000000003','00000000-0000-4555-8200-000000000001','Zu klein','RUHIG',1,true,auth.uid(),auth.uid());

insert into app_modules.fanbus_bookings (
  id, trip_id, source, created_by, updated_by
) values
  ('00000000-0000-4555-8400-000000000001','00000000-0000-4555-8200-000000000001','MANUAL',auth.uid(),auth.uid()),
  ('00000000-0000-4555-8400-000000000002','00000000-0000-4555-8200-000000000001','MANUAL',auth.uid(),auth.uid()),
  ('00000000-0000-4555-8400-000000000003','00000000-0000-4555-8200-000000000001','MANUAL',auth.uid(),auth.uid());

insert into app_modules.fanbus_registrations (
  id, trip_id, first_name, last_name, email, bus_preference, status,
  privacy_reference, terms_reference, privacy_accepted_at, terms_accepted_at,
  source, booking_id, booking_role, participant_sequence,
  created_by, updated_by
) values
  ('00000000-0000-4555-8500-000000000001','00000000-0000-4555-8200-000000000001','Anna','Alpha','anna.alpha@example.invalid','PARTY','ACTIVE','test','test',now(),now(),'MANUAL','00000000-0000-4555-8400-000000000001','PRIMARY',1,auth.uid(),auth.uid()),
  ('00000000-0000-4555-8500-000000000002','00000000-0000-4555-8200-000000000001','Berta','Beta','berta.beta@example.invalid','RUHIG','ACTIVE','test','test',now(),now(),'MANUAL','00000000-0000-4555-8400-000000000001','COMPANION',2,auth.uid(),auth.uid()),
  ('00000000-0000-4555-8500-000000000003','00000000-0000-4555-8200-000000000001','Clara','Gamma','clara.gamma@example.invalid','RUHIG','ACTIVE','test','test',now(),now(),'MANUAL','00000000-0000-4555-8400-000000000002','PRIMARY',1,auth.uid(),auth.uid()),
  ('00000000-0000-4555-8500-000000000004','00000000-0000-4555-8200-000000000001','Dora','Delta','dora.delta@example.invalid','EGAL','ACTIVE','test','test',now(),now(),'MANUAL','00000000-0000-4555-8400-000000000003','PRIMARY',1,auth.uid(),auth.uid()),
  ('00000000-0000-4555-8500-000000000005','00000000-0000-4555-8200-000000000001','Emil','Epsilon','emil.epsilon@example.invalid','PARTY','ACTIVE','test','test',now(),now(),'MANUAL','00000000-0000-4555-8400-000000000003','COMPANION',2,auth.uid(),auth.uid());

select is(
  (
    select group_bus_preference
    from app_modules.fanbus_bookings
    where id = '00000000-0000-4555-8400-000000000001'
  ),
  'PARTY',
  'First participant initializes the central booking preference'
);
select is(
  (
    select bus_preference
    from app_modules.fanbus_registrations
    where id = '00000000-0000-4555-8500-000000000002'
  ),
  'PARTY',
  'Later participant inherits the central booking preference'
);

select lives_ok(
  $$select app_private.api_fanbus_booking_group_rules_set(
    '{"bookingId":"00000000-0000-4555-8400-000000000001","busPreference":"RUHIG","busId":"00000000-0000-4555-8300-000000000001"}'::jsonb
  )$$,
  'Group rule can update preference and bus atomically'
);
select is(
  (
    select count(*)::integer
    from app_modules.fanbus_registrations registration
    join app_modules.fanbus_bus_assignments assignment
      on assignment.participant_id = registration.id
    where registration.booking_id = '00000000-0000-4555-8400-000000000001'
      and registration.bus_preference = 'RUHIG'
      and assignment.bus_id = '00000000-0000-4555-8300-000000000001'
  ),
  2,
  'Group rule is applied to every active non-overridden participant'
);

select lives_ok(
  $$select app_private.api_fanbus_booking_participant_override_set(
    '{"participantId":"00000000-0000-4555-8500-000000000002","busPreference":"PARTY","busId":"00000000-0000-4555-8300-000000000002"}'::jsonb
  )$$,
  'Explicit participant override is accepted'
);
select ok(
  (
    select registration.bus_preference_override
      and registration.bus_assignment_override
      and registration.bus_preference = 'PARTY'
      and assignment.bus_id = '00000000-0000-4555-8300-000000000002'
    from app_modules.fanbus_registrations registration
    join app_modules.fanbus_bus_assignments assignment
      on assignment.participant_id = registration.id
    where registration.id = '00000000-0000-4555-8500-000000000002'
  ),
  'Override is visible and keeps its individual values'
);

select lives_ok(
  $$select app_private.api_fanbus_booking_participant_override_clear(
    '{"participantId":"00000000-0000-4555-8500-000000000002","kind":"ALL"}'::jsonb
  )$$,
  'Participant override can be cleared explicitly'
);
select ok(
  (
    select not registration.bus_preference_override
      and not registration.bus_assignment_override
      and registration.bus_preference = 'RUHIG'
      and assignment.bus_id = '00000000-0000-4555-8300-000000000001'
    from app_modules.fanbus_registrations registration
    join app_modules.fanbus_bus_assignments assignment
      on assignment.participant_id = registration.id
    where registration.id = '00000000-0000-4555-8500-000000000002'
  ),
  'Clearing an override restores the central group rule'
);

select throws_ok(
  $$select app_private.api_fanbus_booking_group_rules_set(
    '{"bookingId":"00000000-0000-4555-8400-000000000003","busPreference":"RUHIG","busId":"00000000-0000-4555-8300-000000000003"}'::jsonb
  )$$,
  'P3204',
  'FANBUS_GROUP_BUS_CAPACITY_CONFLICT',
  'A booking is never silently split when one bus lacks capacity'
);

select lives_ok(
  $$select app_private.api_fanbus_bookings_merge(
    '{"targetBookingId":"00000000-0000-4555-8400-000000000001","sourceBookingIds":["00000000-0000-4555-8400-000000000002"],"busPreference":"EGAL","busId":null,"overrideMode":"ALIGN"}'::jsonb
  )$$,
  'Two bookings from one trip can be merged explicitly'
);
select ok(
  (
    select merged_into_booking_id = '00000000-0000-4555-8400-000000000001'
      and merged_at is not null
    from app_modules.fanbus_bookings
    where id = '00000000-0000-4555-8400-000000000002'
  )
  and (
    select count(*) = 3
    from app_modules.fanbus_registrations
    where booking_id = '00000000-0000-4555-8400-000000000001'
  )
  and (
    select count(*) = 1
    from app_modules.fanbus_registrations
    where booking_id = '00000000-0000-4555-8400-000000000001'
      and booking_role = 'PRIMARY'
  ),
  'Merge preserves participants and exactly one primary role'
);

select lives_ok(
  $$select app_private.api_fanbus_booking_split(
    '{"bookingId":"00000000-0000-4555-8400-000000000001","participantIds":["00000000-0000-4555-8500-000000000003"]}'::jsonb
  )$$,
  'Selected participants can be split into a new booking'
);
select ok(
  (
    select booking.split_from_booking_id = '00000000-0000-4555-8400-000000000001'
    from app_modules.fanbus_registrations registration
    join app_modules.fanbus_bookings booking on booking.id = registration.booking_id
    where registration.id = '00000000-0000-4555-8500-000000000003'
  )
  and (
    select count(*) = 1
    from app_modules.fanbus_registrations registration
    where registration.booking_id = (
      select booking_id
      from app_modules.fanbus_registrations
      where id = '00000000-0000-4555-8500-000000000003'
    )
      and registration.booking_role = 'PRIMARY'
  ),
  'Split keeps provenance and creates one primary in the new booking'
);

select is(
  (
    select count(distinct action)::integer
    from app_portal.audit_events
    where action in (
      'FANBUS_BOOKING_GROUP_PREFERENCE_CHANGED',
      'FANBUS_BOOKING_GROUP_BUS_CHANGED',
      'FANBUS_BOOKING_PARTICIPANT_OVERRIDE_SET',
      'FANBUS_BOOKING_PARTICIPANT_OVERRIDE_CLEARED',
      'FANBUS_BOOKINGS_MERGED',
      'FANBUS_BOOKING_SPLIT'
    )
  ),
  6,
  'All operative group changes are represented in the audit log'
);

select * from finish();
rollback;
