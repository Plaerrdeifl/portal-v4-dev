\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap with schema extensions;
select plan(89);

select has_table('app_modules', 'fanbus_bookings', 'Booking-Tabelle existiert');
select has_table('app_modules', 'fanbus_buses', 'Bus-Tabelle existiert');
select has_table('app_modules', 'fanbus_bus_assignments', 'Assignment-Tabelle existiert');
select ok((select relrowsecurity from pg_class where oid = 'app_modules.fanbus_bookings'::regclass), 'Bookings haben RLS');
select ok((select relrowsecurity from pg_class where oid = 'app_modules.fanbus_buses'::regclass), 'Busse haben RLS');
select ok((select relrowsecurity from pg_class where oid = 'app_modules.fanbus_bus_assignments'::regclass), 'Assignments haben RLS');
select ok(not has_table_privilege('anon', 'app_modules.fanbus_bookings', 'SELECT'), 'Anon hat keine Booking-Rechte');
select ok(not has_table_privilege('authenticated', 'app_modules.fanbus_buses', 'SELECT'), 'Authenticated hat keine Bus-Rechte');
select ok(exists (
  select 1 from pg_constraint
  where conname = 'fanbus_registrations_booking_trip_fk'
), 'Booking und Teilnehmer sind per Fahrt verbunden');
select ok(not exists (
  select 1 from app_portal.capabilities
  where code in ('fanbus.bus_preference.manage', 'fanbus.assignment.auto')
), 'M320 führt keine neue Capability ein');

insert into auth.users (id, email) values
  ('00000000-0000-4320-8000-000000000001', 'm320-admin@example.invalid'),
  ('00000000-0000-4320-8000-000000000002', 'm320-portal@example.invalid'),
  ('00000000-0000-4320-8000-000000000003', 'm320-manage@example.invalid'),
  ('00000000-0000-4320-8000-000000000004', 'm320-registrations@example.invalid');
insert into app_portal.users (
  id, user_code, email, first_name, last_name, status, role_id
) values
  (
    '00000000-0000-4320-8000-000000000001', 'U-M320-ADMIN',
    'm320-admin@example.invalid', 'M320', 'Admin', 'ACTIVE',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-4320-8000-000000000002', 'U-M320-PORTAL',
    'm320-portal@example.invalid', 'Portal', 'Original', 'ACTIVE',
    '00000000-0000-4000-8000-000000000003'
  ),
  (
    '00000000-0000-4320-8000-000000000003', 'U-M320-MANAGE',
    'm320-manage@example.invalid', 'Bus', 'Manager', 'ACTIVE',
    '00000000-0000-4000-8000-000000000003'
  ),
  (
    '00000000-0000-4320-8000-000000000004', 'U-M320-REG',
    'm320-registrations@example.invalid', 'Teilnehmer', 'Manager', 'ACTIVE',
    '00000000-0000-4000-8000-000000000003'
  );
insert into app_portal.user_capabilities (user_id, capability_code) values
  ('00000000-0000-4320-8000-000000000003', 'fanbus.manage'),
  ('00000000-0000-4320-8000-000000000004', 'fanbus.registrations.manage');
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4320-8000-000000000001', true
);

insert into app_modules.events (
  id, event_type, title, event_date, event_time, visibility
) values
  ('00000000-0000-4320-8100-000000000001', 'OTHER', 'M320 Fahrt 1', current_date + 10, time '18:00', 'PUBLIC'),
  ('00000000-0000-4320-8100-000000000002', 'OTHER', 'M320 Fahrt 2', current_date + 11, time '18:00', 'PUBLIC'),
  ('00000000-0000-4320-8100-000000000003', 'OTHER', 'M320 Fahrt 3', current_date + 12, time '18:00', 'PUBLIC'),
  ('00000000-0000-4320-8100-000000000004', 'OTHER', 'M320 Fahrt 4', current_date + 13, time '18:00', 'PUBLIC');

insert into app_modules.fanbus_trips (
  id, event_id, departure_at, departure_info,
  registration_opens_at, registration_closes_at,
  price_cents, capacity, privacy_reference, terms_reference, status
) values
  (
    '00000000-0000-4320-8200-000000000001',
    '00000000-0000-4320-8100-000000000001', now() + interval '8 days',
    'Testabfahrt 1', now() - interval '1 day', now() + interval '7 days',
    2500, 4, 'privacy-v1', 'terms-v1', 'PUBLISHED'
  ),
  (
    '00000000-0000-4320-8200-000000000002',
    '00000000-0000-4320-8100-000000000002', now() + interval '9 days',
    'Testabfahrt 2', now() - interval '1 day', now() + interval '8 days',
    2500, 3, 'privacy-v1', 'terms-v1', 'PUBLISHED'
  ),
  (
    '00000000-0000-4320-8200-000000000003',
    '00000000-0000-4320-8100-000000000003', now() + interval '10 days',
    'Testabfahrt 3', now() - interval '1 day', now() + interval '9 days',
    2500, 20, 'privacy-v1', 'terms-v1', 'PUBLISHED'
  ),
  (
    '00000000-0000-4320-8200-000000000004',
    '00000000-0000-4320-8100-000000000004', now() + interval '11 days',
    'Testabfahrt 4', now() - interval '1 day', now() + interval '10 days',
    2500, 20, 'privacy-v1', 'terms-v1', 'PUBLISHED'
  );

-- M325 F5: Die fachliche Fahrtkapazität kommt ab jetzt ausschließlich aus
-- aktiven Bussen. Die Basiskapazitäten halten die bestehenden M320-Szenarien
-- unverändert, während Legacy fanbus_trips.capacity bewusst ohne Wirkung bleibt.
insert into app_modules.fanbus_buses (
  id, trip_id, label, category, capacity, is_active
) values
  ('00000000-0000-4320-8500-000000000001', '00000000-0000-4320-8200-000000000001', 'M320 Basis 1', 'NORMAL', 4, true),
  ('00000000-0000-4320-8500-000000000002', '00000000-0000-4320-8200-000000000002', 'M320 Basis 2', 'NORMAL', 3, true),
  ('00000000-0000-4320-8500-000000000003', '00000000-0000-4320-8200-000000000003', 'M320 Basis 3', 'NORMAL', 20, true),
  ('00000000-0000-4320-8500-000000000004', '00000000-0000-4320-8200-000000000004', 'M320 Basis 4', 'NORMAL', 20, true);

create temporary table m320_results (
  name text primary key,
  result jsonb
) on commit drop;

insert into m320_results values (
  'legacy_guest_payload',
  public.m310_submit_guest_fanbus_registration(
    jsonb_build_object(
      'tripId', '00000000-0000-4320-8200-000000000003',
      'firstName', 'Legacy', 'lastName', 'Guest',
      'email', 'legacy-guest@example.invalid', 'busPreference', 'EGAL',
      'privacyConfirmed', true, 'termsConfirmed', true
    ),
    '00000000-0000-4320-8300-000000000021', repeat('a', 64)
  )
);
select is(
  (select result ->> 'outcome' from m320_results where name = 'legacy_guest_payload'),
  'CREATED', 'Alter Guest-Payload ohne companions bleibt gültig'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4320-8000-000000000002', true
);
insert into m320_results values (
  'legacy_portal_payload',
  app_private.api_fanbus_self_register(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000003',
    'busPreference', 'PARTY', 'privacyConfirmed', true,
    'termsConfirmed', true,
    'idempotencyKey', '00000000-0000-4320-8300-000000000022'
  ))
);
select is(
  (select result ->> 'outcome' from m320_results where name = 'legacy_portal_payload'),
  'CREATED', 'Alter Portal-Payload ohne companions bleibt gültig'
);

insert into m320_results values (
  'portal_stable_first',
  app_private.api_fanbus_self_register(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000004',
    'busPreference', 'RUHIG', 'privacyConfirmed', true,
    'termsConfirmed', true,
    'idempotencyKey', '00000000-0000-4320-8300-000000000023',
    'companions', jsonb_build_array(jsonb_build_object(
      'firstName', 'Portal', 'lastName', 'Begleitung',
      'email', 'portal-companion@example.invalid', 'busPreference', 'EGAL'
    ))
  ))
);
update app_portal.users
set first_name = 'Profil', last_name = 'Geändert',
    email = 'm320-portal-changed@example.invalid'
where id = '00000000-0000-4320-8000-000000000002';
insert into m320_results values (
  'portal_stable_replay',
  app_private.api_fanbus_self_register(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000004',
    'busPreference', 'RUHIG', 'privacyConfirmed', true,
    'termsConfirmed', true,
    'idempotencyKey', '00000000-0000-4320-8300-000000000023',
    'companions', jsonb_build_array(jsonb_build_object(
      'firstName', 'Portal', 'lastName', 'Begleitung',
      'email', 'portal-companion@example.invalid', 'busPreference', 'EGAL'
    ))
  ))
);
select is(
  (select result from m320_results where name = 'portal_stable_replay'),
  (select result from m320_results where name = 'portal_stable_first'),
  'PORTAL-Replay bleibt nach Profiländerung identisch'
);
select is(
  (select count(*)::integer from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4320-8200-000000000004'),
  2, 'PORTAL-Replay erzeugt keine zweite Registration'
);
select is(
  (select first_name from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4320-8200-000000000004'
     and booking_role = 'PRIMARY'),
  'Portal', 'PORTAL-Replay verändert den gespeicherten Snapshot nicht'
);
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4320-8000-000000000001', true
);

insert into m320_results values (
  'active_batch',
  app_private.fanbus_submit_booking_core(
    '00000000-0000-4320-8200-000000000001', 'GUEST', null,
    '{"firstName":"Active","lastName":"One","email":"active1@example.invalid","busPreference":"PARTY"}'::jsonb,
    '[
      {"firstName":"Active","lastName":"Two","email":"active2@example.invalid","busPreference":"RUHIG"},
      {"firstName":"Active","lastName":"Three","email":"active3@example.invalid","busPreference":"EGAL"},
      {"firstName":"Active","lastName":"Four","email":"active4@example.invalid","busPreference":"EGAL"}
    ]'::jsonb,
    true, true, '00000000-0000-4320-8300-000000000001'
  )
);

select is((select result ->> 'outcome' from m320_results where name = 'active_batch'), 'CREATED', '4 aus 4 werden bestätigt');
select is((select count(*)::integer from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001'), 4, 'Batch legt vier Teilnehmer an');
select is((select count(distinct status)::integer from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001'), 1, 'Batch hat einen einheitlichen Status');
select is((select count(distinct booking_id)::integer from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001'), 1, 'Batch teilt eine booking_id');
select is((select string_agg(booking_role || ':' || participant_sequence, ',' order by participant_sequence) from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001'), 'PRIMARY:1,COMPANION:2,COMPANION:3,COMPANION:4', 'Rollen und Sequenzen sind korrekt');
select is(
  (select result ->> 'registrationId' from m320_results where name = 'active_batch'),
  (select id::text from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 1),
  'registrationId zeigt auf PRIMARY'
);

insert into m320_results
select 'participant_update', app_private.api_fanbus_registration_update(
  jsonb_build_object(
    'id', id, 'expectedRevision', revision,
    'firstName', first_name, 'lastName', last_name, 'email', email,
    'busPreference', 'PARTY'
  )
)
from app_modules.fanbus_registrations
where trip_id = '00000000-0000-4320-8200-000000000001'
  and participant_sequence = 2;
select is(
  (select bus_preference from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4320-8200-000000000001'
     and participant_sequence = 2),
  'PARTY', 'Participant Update ändert busPreference'
);
select is(
  (select revision from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4320-8200-000000000001'
     and participant_sequence = 2),
  2, 'Participant Update erhöht die Revision'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_registration_update(%L::jsonb)',
    (select jsonb_build_object(
      'id', id, 'expectedRevision', null,
      'firstName', first_name, 'lastName', last_name, 'email', email,
      'busPreference', bus_preference
    )::text
    from app_modules.fanbus_registrations
    where trip_id = '00000000-0000-4320-8200-000000000001'
      and participant_sequence = 2)
  ),
  '22023', 'FANBUS_PARTICIPANT_UPDATE_INVALID_PAYLOAD',
  'Participant Update lehnt expectedRevision null ab'
);
select is(
  (select revision from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4320-8200-000000000001'
     and participant_sequence = 2),
  2, 'NULL-Revision mutiert den Teilnehmer nicht'
);

insert into m320_results values (
  'active_replay',
  app_private.fanbus_submit_booking_core(
    '00000000-0000-4320-8200-000000000001', 'GUEST', null,
    '{"firstName":"Active","lastName":"One","email":"active1@example.invalid","busPreference":"PARTY"}'::jsonb,
    '[
      {"firstName":"Active","lastName":"Two","email":"active2@example.invalid","busPreference":"RUHIG"},
      {"firstName":"Active","lastName":"Three","email":"active3@example.invalid","busPreference":"EGAL"},
      {"firstName":"Active","lastName":"Four","email":"active4@example.invalid","busPreference":"EGAL"}
    ]'::jsonb,
    true, true, '00000000-0000-4320-8300-000000000001'
  )
);
select is((select result from m320_results where name = 'active_replay'), (select result from m320_results where name = 'active_batch'), 'Batch-Replay liefert identische Response');
select throws_ok(
  $$select app_private.fanbus_submit_booking_core(
    '00000000-0000-4320-8200-000000000001', 'GUEST', null,
    '{"firstName":"Changed","lastName":"Payload","email":"changed@example.invalid","busPreference":"EGAL"}',
    '[]', true, true, '00000000-0000-4320-8300-000000000001'
  )$$,
  '22023', 'FANBUS_IDEMPOTENCY_KEY_REUSED', 'Gleicher Key mit anderem Payload wird abgewiesen'
);

insert into m320_results values (
  'wait_batch',
  app_private.fanbus_submit_booking_core(
    '00000000-0000-4320-8200-000000000002', 'GUEST', null,
    '{"firstName":"Wait","lastName":"One","email":"wait1@example.invalid","busPreference":"EGAL"}'::jsonb,
    '[
      {"firstName":"Wait","lastName":"Two","email":"wait2@example.invalid","busPreference":"EGAL"},
      {"firstName":"Wait","lastName":"Three","email":"wait3@example.invalid","busPreference":"EGAL"},
      {"firstName":"Wait","lastName":"Four","email":"wait4@example.invalid","busPreference":"EGAL"}
    ]'::jsonb,
    true, true, '00000000-0000-4320-8300-000000000002'
  )
);
select is((select result ->> 'outcome' from m320_results where name = 'wait_batch'), 'WAITLISTED', '4 aus 3 werden vollständig wartend');
select is((select count(*)::integer from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000002' and status = 'WAITLISTED'), 4, 'Alle vier Teilnehmer sind WAITLISTED');
select is((select count(*)::integer from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000002' and status = 'ACTIVE'), 0, 'Kein Teilsplit ist entstanden');

insert into m320_results values (
  'waitlisted_duplicate', app_private.fanbus_submit_registration(
    '00000000-0000-4320-8200-000000000002', null,
    'Wait', 'One', ' WAIT1@EXAMPLE.INVALID ', 'EGAL', true, true,
    '00000000-0000-4320-8300-000000000024'
  )
);
select is(
  (select result ->> 'outcome' from m320_results where name = 'waitlisted_duplicate'),
  'WAITLISTED', 'Bestehendes WAITLISTED-Duplikat bleibt WAITLISTED'
);
select is(
  (select result ->> 'registrationId' from m320_results
   where name = 'waitlisted_duplicate'),
  (select id::text from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4320-8200-000000000002'
     and participant_sequence = 1),
  'WAITLISTED-Duplikat liefert die bestehende registrationId'
);
select is(
  (select result ->> 'bookingId' from m320_results
   where name = 'waitlisted_duplicate'),
  (select booking_id::text from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4320-8200-000000000002'
     and participant_sequence = 1),
  'WAITLISTED-Duplikat liefert die bestehende bookingId'
);
select is(
  (select count(*)::integer from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4320-8200-000000000002'
     and status in ('ACTIVE', 'WAITLISTED')),
  4, 'WAITLISTED-Duplikat erzeugt keine zweite Live-Teilnahme'
);
select is(
  (select count(*)::integer from app_modules.fanbus_bookings
   where trip_id = '00000000-0000-4320-8200-000000000002'),
  1, 'WAITLISTED-Duplikat erzeugt kein zweites Booking'
);

update app_modules.fanbus_trips set capacity = 10 where id = '00000000-0000-4320-8200-000000000002';
update app_modules.fanbus_buses
set capacity = 10
where id = '00000000-0000-4320-8500-000000000002';
insert into m320_results values (
  'fairness', app_private.fanbus_submit_registration(
    '00000000-0000-4320-8200-000000000002', null,
    'Fair', 'Later', 'fair@example.invalid', 'EGAL', true, true,
    '00000000-0000-4320-8300-000000000003'
  )
);
select is((select result ->> 'outcome' from m320_results where name = 'fairness'), 'WAITLISTED', 'Bestehende Warteliste wird nicht übersprungen');
select is((public.pd_public_fanbus_trip('00000000-0000-4320-8200-000000000002') ->> 'registrationStatus'), 'WAITLIST', 'Freie Plätze plus Wartende ergeben WAITLIST');
select is(
  (select string_agg(value ->> 'waitlistPosition', ',' order by (value ->> 'waitlistPosition')::integer)
   from jsonb_array_elements(app_private.api_fanbus_registrations_list('{"tripId":"00000000-0000-4320-8200-000000000002"}') -> 'registrations') as item(value)
   where value ->> 'status' = 'WAITLISTED'),
  '1,2,3,4,5', 'FIFO-Positionen werden lückenlos berechnet'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_waitlist_promote(%L::jsonb)',
    jsonb_build_object(
      'id', (select id from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000002' and status = 'WAITLISTED' order by waitlisted_at, participant_sequence, id offset 1 limit 1),
      'expectedRevision', 1
    )::text
  ),
  'P3202', 'FANBUS_WAITLIST_FIFO_CONFLICT', 'Nur FIFO-Platz 1 ist promotierbar'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_waitlist_promote(%L::jsonb)',
    jsonb_build_object(
      'id', (select id from app_modules.fanbus_registrations
        where trip_id = '00000000-0000-4320-8200-000000000002'
          and status = 'WAITLISTED'
        order by waitlisted_at, participant_sequence, id limit 1),
      'expectedRevision', null
    )::text
  ),
  '22023', 'FANBUS_PROMOTION_INVALID_PAYLOAD',
  'Promotion lehnt expectedRevision null ab'
);
select is(
  (select status from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4320-8200-000000000002'
     and status = 'WAITLISTED'
   order by waitlisted_at, participant_sequence, id limit 1),
  'WAITLISTED', 'NULL-Revision promotet keinen Teilnehmer'
);

insert into m320_results
select 'promotion', app_private.api_fanbus_waitlist_promote(jsonb_build_object(
  'id', id, 'expectedRevision', revision
))
from app_modules.fanbus_registrations
where trip_id = '00000000-0000-4320-8200-000000000002' and status = 'WAITLISTED'
order by waitlisted_at, participant_sequence, id limit 1;
select is((select count(*)::integer from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000002' and status = 'ACTIVE'), 1, 'FIFO-Platz 1 wird aktiv');
select ok((select promoted_at is not null from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000002' and status = 'ACTIVE'), 'Promotion setzt promoted_at');

insert into m320_results values (
  'bus_normal', app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000001',
    'label', 'Bus Normal', 'category', 'NORMAL', 'capacity', 4, 'isActive', true
  ))
), (
  'bus_party', app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000001',
    'label', 'Bus Party', 'category', 'PARTY', 'capacity', 4, 'isActive', true
  ))
), (
  'bus_full', app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000001',
    'label', 'Bus Voll', 'category', 'RUHIG', 'capacity', 2, 'isActive', true
  ))
), (
  'bus_inactive', app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000001',
    'label', 'Bus Inaktiv', 'category', 'NORMAL', 'capacity', 2, 'isActive', false
  ))
), (
  'bus_other_trip', app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000002',
    'label', 'Andere Fahrt', 'category', 'NORMAL', 'capacity', 10, 'isActive', true
  ))
);
select is((select category from app_modules.fanbus_buses where id = ((select result ->> 'id' from m320_results where name = 'bus_normal')::uuid)), 'NORMAL', 'Buskategorie wird gespeichert');
select is(
  jsonb_typeof(app_private.api_fanbus_buses_list(
    '{"tripId":"00000000-0000-4320-8200-000000000001"}'
  ) -> 'buses'),
  'array', 'fanbus.manage kann die Busdefinitionen laden'
);

insert into m320_results
select 'assign', app_private.api_fanbus_bus_assignment_set(jsonb_build_object(
  'participantId', id,
  'busId', (select result ->> 'id' from m320_results where name = 'bus_normal')
)) from app_modules.fanbus_registrations
where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 2;
select is((select count(*)::integer from app_modules.fanbus_bus_assignments where bus_id = ((select result ->> 'id' from m320_results where name = 'bus_normal')::uuid)), 1, 'ACTIVE kann zugeordnet werden');
select ok(exists (
  select 1 from app_modules.fanbus_bus_assignments as assignment
  join app_modules.fanbus_registrations as participant on participant.id = assignment.participant_id
  join app_modules.fanbus_buses as bus on bus.id = assignment.bus_id
  where participant.bus_preference = 'PARTY' and bus.category = 'NORMAL'
), 'Präferenzabweichung bleibt technisch erlaubt');

insert into m320_results
select 'move', app_private.api_fanbus_bus_assignment_set(jsonb_build_object(
  'participantId', id,
  'busId', (select result ->> 'id' from m320_results where name = 'bus_party')
)) from app_modules.fanbus_registrations
where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 2;
select is((select count(*)::integer from app_modules.fanbus_bus_assignments where bus_id = ((select result ->> 'id' from m320_results where name = 'bus_party')::uuid)), 1, 'Move ersetzt die aktuelle Zuordnung');
do $m320_unassign$
begin
  perform app_private.api_fanbus_bus_assignment_set(jsonb_build_object(
    'participantId', (select id from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 2),
    'busId', null
  ));
end
$m320_unassign$;
select is((select count(*)::integer from app_modules.fanbus_bus_assignments where trip_id = '00000000-0000-4320-8200-000000000001'), 0, 'Unassign entfernt die Zuordnung');

insert into app_modules.fanbus_bookings (
  id, trip_id, source, created_by
) values (
  '00000000-0000-4320-8400-000000000001',
  '00000000-0000-4320-8200-000000000003',
  'MANUAL',
  '00000000-0000-4320-8000-000000000001'
);
insert into app_modules.fanbus_registrations (
  id, trip_id, booking_id, booking_role, participant_sequence,
  first_name, last_name, email, bus_preference, source, status,
  privacy_reference, terms_reference,
  privacy_accepted_at, terms_accepted_at, created_by, updated_by
) values (
  '00000000-0000-4320-8400-000000000002',
  '00000000-0000-4320-8200-000000000003',
  '00000000-0000-4320-8400-000000000001',
  'PRIMARY', 1,
  'Assignment', 'Audit', 'assignment-audit@example.invalid',
  'EGAL', 'MANUAL', 'ACTIVE',
  'privacy-v1', 'terms-v1', now(), now(),
  '00000000-0000-4320-8000-000000000001',
  '00000000-0000-4320-8000-000000000001'
);
insert into m320_results values (
  'audit_bus_a', app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000003',
    'label', 'Assignment Audit A', 'category', 'NORMAL',
    'capacity', 2, 'isActive', true
  ))
), (
  'audit_bus_b', app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000003',
    'label', 'Assignment Audit B', 'category', 'NORMAL',
    'capacity', 2, 'isActive', true
  ))
);

select is(
  (select count(*)::integer
   from app_modules.fanbus_bus_assignments
   where participant_id = '00000000-0000-4320-8400-000000000002'),
  0, 'Assignment-Audit-Lifecycle startet ohne Zuordnung'
);

insert into m320_results values (
  'audit_assign_a', app_private.api_fanbus_bus_assignment_set(
    jsonb_build_object(
      'participantId', '00000000-0000-4320-8400-000000000002',
      'busId', (select result ->> 'id' from m320_results
        where name = 'audit_bus_a')
    )
  )
);
select is(
  (select bus_id::text
   from app_modules.fanbus_bus_assignments
   where participant_id = '00000000-0000-4320-8400-000000000002'),
  (select result ->> 'id' from m320_results where name = 'audit_bus_a'),
  'Erste Zuordnung zeigt auf Assignment Audit Bus A'
);
select ok(
  (select count(*) = 1
      and bool_and(before_data is null)
      and bool_and(after_data ->> 'busId' = (
        select result ->> 'id' from m320_results where name = 'audit_bus_a'
      ))
   from app_portal.audit_events
   where entity_type = 'fanbus_registration'
     and entity_id = '00000000-0000-4320-8400-000000000002'
     and action = 'FANBUS_BUS_ASSIGNED'),
  'Erste Zuordnung erzeugt genau ein passendes ASSIGNED-Audit'
);

insert into m320_results values (
  'audit_move_b', app_private.api_fanbus_bus_assignment_set(
    jsonb_build_object(
      'participantId', '00000000-0000-4320-8400-000000000002',
      'busId', (select result ->> 'id' from m320_results
        where name = 'audit_bus_b')
    )
  )
);
select is(
  (select bus_id::text
   from app_modules.fanbus_bus_assignments
   where participant_id = '00000000-0000-4320-8400-000000000002'),
  (select result ->> 'id' from m320_results where name = 'audit_bus_b'),
  'Wechsel ersetzt Bus A durch Assignment Audit Bus B'
);
select ok(
  (select count(*) = 1
      and bool_and(before_data ->> 'busId' = (
        select result ->> 'id' from m320_results where name = 'audit_bus_a'
      ))
      and bool_and(after_data ->> 'busId' = (
        select result ->> 'id' from m320_results where name = 'audit_bus_b'
      ))
   from app_portal.audit_events
   where entity_type = 'fanbus_registration'
     and entity_id = '00000000-0000-4320-8400-000000000002'
     and action = 'FANBUS_BUS_CHANGED'),
  'Wechsel auditiert Bus A als before und Bus B als after'
);

insert into m320_results values (
  'audit_unassign_b', app_private.api_fanbus_bus_assignment_set(
    jsonb_build_object(
      'participantId', '00000000-0000-4320-8400-000000000002',
      'busId', null
    )
  )
);
select is(
  (select count(*)::integer
   from app_modules.fanbus_bus_assignments
   where participant_id = '00000000-0000-4320-8400-000000000002'),
  0, 'Explizites Unassign entfernt die Assignment-Zeile'
);
select ok(
  (select count(*) = 1
      and bool_and(before_data ->> 'busId' = (
        select result ->> 'id' from m320_results where name = 'audit_bus_b'
      ))
      and bool_and(after_data is null)
   from app_portal.audit_events
   where entity_type = 'fanbus_registration'
     and entity_id = '00000000-0000-4320-8400-000000000002'
     and action = 'FANBUS_BUS_UNASSIGNED'),
  'Explizites Unassign auditiert Bus B als before und null als after'
);

insert into m320_results values (
  'audit_reassign_a', app_private.api_fanbus_bus_assignment_set(
    jsonb_build_object(
      'participantId', '00000000-0000-4320-8400-000000000002',
      'busId', (select result ->> 'id' from m320_results
        where name = 'audit_bus_a')
    )
  )
);
select is(
  (select bus_id::text
   from app_modules.fanbus_bus_assignments
   where participant_id = '00000000-0000-4320-8400-000000000002'),
  (select result ->> 'id' from m320_results where name = 'audit_bus_a'),
  'Erneute Zuordnung zeigt wieder auf Assignment Audit Bus A'
);
select is(
  (select count(*)::integer
   from app_portal.audit_events
   where entity_type = 'fanbus_registration'
     and entity_id = '00000000-0000-4320-8400-000000000002'
     and action = 'FANBUS_BUS_ASSIGNED'),
  2, 'Erneute Zuordnung erzeugt ein zweites ASSIGNED-Audit'
);
select is(
  (select after_data ->> 'busId'
   from app_portal.audit_events
   where entity_type = 'fanbus_registration'
     and entity_id = '00000000-0000-4320-8400-000000000002'
     and action = 'FANBUS_BUS_ASSIGNED'
   order by id desc
   limit 1),
  (select result ->> 'id' from m320_results where name = 'audit_bus_a'),
  'Das zweite ASSIGNED-Audit verweist auf Bus A'
);
select is(
  (select string_agg(action, ' -> ' order by id)
   from app_portal.audit_events
   where entity_type = 'fanbus_registration'
     and entity_id = '00000000-0000-4320-8400-000000000002'
     and action in (
       'FANBUS_BUS_ASSIGNED',
       'FANBUS_BUS_CHANGED',
       'FANBUS_BUS_UNASSIGNED'
     )),
  'FANBUS_BUS_ASSIGNED -> FANBUS_BUS_CHANGED -> FANBUS_BUS_UNASSIGNED -> FANBUS_BUS_ASSIGNED',
  'Assignment-Auditsequenz ist exakt und vollständig'
);
select ok(not exists (
  select 1
  from app_portal.audit_events as audit
  cross join lateral jsonb_object_keys(audit.metadata) as metadata_key(key)
  where audit.entity_type = 'fanbus_registration'
    and audit.entity_id = '00000000-0000-4320-8400-000000000002'
    and audit.action in (
      'FANBUS_BUS_ASSIGNED',
      'FANBUS_BUS_CHANGED',
      'FANBUS_BUS_UNASSIGNED'
    )
    and metadata_key.key not in (
      'tripId', 'bookingId', 'participantId', 'busId', 'assignmentSource'
    )
), 'Assignment-Auditmetadaten enthalten ausschließlich technische IDs');
select ok(not exists (
  select 1
  from app_portal.audit_events as audit
  cross join lateral (
    select before_keys.key
    from jsonb_object_keys(
      coalesce(audit.before_data, '{}'::jsonb)
    ) as before_keys(key)
    union all
    select after_keys.key
    from jsonb_object_keys(
      coalesce(audit.after_data, '{}'::jsonb)
    ) as after_keys(key)
    union all
    select metadata_keys.key
    from jsonb_object_keys(
      coalesce(audit.metadata, '{}'::jsonb)
    ) as metadata_keys(key)
  ) as payload_key
  where audit.entity_type = 'fanbus_registration'
    and audit.entity_id = '00000000-0000-4320-8400-000000000002'
    and audit.action in (
      'FANBUS_BUS_ASSIGNED',
      'FANBUS_BUS_CHANGED',
      'FANBUS_BUS_UNASSIGNED'
    )
    and lower(payload_key.key) in ('firstname', 'lastname', 'email')
), 'Assignment-Auditpayloads enthalten keine Namen oder E-Mail');

select throws_ok(
  format(
    'select app_private.api_fanbus_bus_assignment_set(%L::jsonb)',
    jsonb_build_object(
      'participantId', (select id from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000002' and status = 'WAITLISTED' limit 1),
      'busId', (select result ->> 'id' from m320_results where name = 'bus_other_trip')
    )::text
  ),
  '22023', 'FANBUS_ASSIGNMENT_REQUIRES_ACTIVE_PARTICIPANT', 'WAITLISTED kann nicht zugeordnet werden'
);

do $m320_assign_full$
begin
  perform app_private.api_fanbus_bus_assignment_set(jsonb_build_object(
    'participantId', (select id from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 1),
    'busId', (select result ->> 'id' from m320_results where name = 'bus_full')
  ));
  perform app_private.api_fanbus_bus_assignment_set(jsonb_build_object(
    'participantId', (select id from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 2),
    'busId', (select result ->> 'id' from m320_results where name = 'bus_full')
  ));
end
$m320_assign_full$;
select throws_ok(
  format(
    'select app_private.api_fanbus_bus_assignment_set(%L::jsonb)',
    jsonb_build_object(
      'participantId', (select id from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 3),
      'busId', (select result ->> 'id' from m320_results where name = 'bus_full')
    )::text
  ),
  'P3204', 'FANBUS_BUS_CAPACITY_EXHAUSTED', 'Voller Bus wird nicht überbucht'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_bus_upsert(%L::jsonb)',
    jsonb_build_object(
      'id', (select result ->> 'id' from m320_results where name = 'bus_full'),
      'tripId', '00000000-0000-4320-8200-000000000001',
      'expectedRevision', 1, 'label', 'Bus Voll', 'category', 'RUHIG',
      'capacity', 1, 'isActive', true
    )::text
  ),
  '22023', 'FANBUS_BUS_CAPACITY_BELOW_OCCUPANCY',
  'Kapazität 2 mit zwei Belegungen kann nicht auf 1 sinken'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_bus_upsert(%L::jsonb)',
    jsonb_build_object(
      'id', (select result ->> 'id' from m320_results where name = 'bus_full'),
      'tripId', '00000000-0000-4320-8200-000000000001',
      'expectedRevision', 1, 'label', 'Bus Voll', 'category', 'RUHIG',
      'capacity', 2, 'isActive', false
    )::text
  ),
  '22023', 'FANBUS_OCCUPIED_BUS_CANNOT_DEACTIVATE', 'Belegter Bus kann nicht deaktiviert werden'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_bus_assignment_set(%L::jsonb)',
    jsonb_build_object(
      'participantId', (select id from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 2),
      'busId', (select result ->> 'id' from m320_results where name = 'bus_other_trip')
    )::text
  ),
  '22023', 'FANBUS_ASSIGNMENT_BUS_UNAVAILABLE', 'Cross-Trip-Assignment wird abgewiesen'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_bus_assignment_set(%L::jsonb)',
    jsonb_build_object(
      'participantId', (select id from app_modules.fanbus_registrations
        where trip_id = '00000000-0000-4320-8200-000000000001'
          and participant_sequence = 4),
      'busId', (select result ->> 'id' from m320_results
        where name = 'bus_inactive')
    )::text
  ),
  '22023', 'FANBUS_ASSIGNMENT_BUS_UNAVAILABLE',
  'Zuweisung zu inaktivem Bus wird abgewiesen'
);
do $m320_unassign_second$
begin
  perform app_private.api_fanbus_bus_assignment_set(jsonb_build_object(
    'participantId', (select id from app_modules.fanbus_registrations
      where trip_id = '00000000-0000-4320-8200-000000000001'
        and participant_sequence = 2),
    'busId', null
  ));
end
$m320_unassign_second$;

select throws_ok(
  format(
    'select app_private.api_fanbus_registration_cancel(%L::jsonb)',
    jsonb_build_object(
      'id', (select id from app_modules.fanbus_registrations
        where trip_id = '00000000-0000-4320-8200-000000000001'
          and participant_sequence = 1),
      'expectedRevision', null
    )::text
  ),
  '22023', 'FANBUS_CANCELLATION_INVALID_PAYLOAD',
  'Cancellation lehnt expectedRevision null ab'
);
select is(
  (select status from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4320-8200-000000000001'
     and participant_sequence = 1),
  'ACTIVE', 'NULL-Revision storniert den Teilnehmer nicht'
);

insert into m320_results
select 'cancel_active', app_private.api_fanbus_registration_cancel(jsonb_build_object(
  'id', id, 'expectedRevision', revision
)) from app_modules.fanbus_registrations
where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 1;
select is((select status from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 1), 'CANCELLED', 'ACTIVE wird storniert');
select is((select count(*)::integer from app_modules.fanbus_bus_assignments where trip_id = '00000000-0000-4320-8200-000000000001'), 0, 'Storno entfernt Assignment');

insert into m320_results values (
  'manual_wait', app_private.fanbus_submit_booking_core(
    '00000000-0000-4320-8200-000000000002', 'MANUAL',
    '00000000-0000-4320-8000-000000000001',
    '{"firstName":"Manual","lastName":"Wait","busPreference":"EGAL"}',
    '[]', true, true, '00000000-0000-4320-8300-000000000004'
  )
);
select is((select result ->> 'outcome' from m320_results where name = 'manual_wait'), 'WAITLISTED', 'Manuelle Anlage kann erfolgreich WAITLISTED sein');

insert into m320_results
select 'cancel_waitlisted', app_private.api_fanbus_registration_cancel(
  jsonb_build_object('id', id, 'expectedRevision', revision)
)
from app_modules.fanbus_registrations
where trip_id = '00000000-0000-4320-8200-000000000002'
  and status = 'WAITLISTED'
order by waitlisted_at desc, participant_sequence desc, id desc
limit 1;
select is((select count(*)::integer from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000002' and status = 'CANCELLED'), 1, 'WAITLISTED wird storniert');
select ok(not exists (
  select 1 from app_modules.fanbus_bus_assignments as assignment
  join app_modules.fanbus_registrations as participant
    on participant.id = assignment.participant_id
  where participant.status = 'CANCELLED'
), 'Stornierte Teilnehmer besitzen keine Buszuordnung');

insert into m320_results values (
  'legacy_duplicate', app_private.fanbus_submit_registration(
    '00000000-0000-4320-8200-000000000001', null,
    'Active', 'Two', ' ACTIVE2@EXAMPLE.INVALID ', 'RUHIG', true, true,
    '00000000-0000-4320-8300-000000000005'
  )
);
select is((select result ->> 'outcome' from m320_results where name = 'legacy_duplicate'), 'ALREADY_ACTIVE', 'Single-M310-Duplikat bleibt kontrolliert');

insert into app_private.fanbus_registration_idempotency (
  idempotency_key, request_hash, trip_id, registration_id, booking_id, outcome
)
select
  '00000000-0000-4320-8300-000000000008',
  app_private.fanbus_legacy_request_hash(
    '00000000-0000-4320-8200-000000000001', 'GUEST', null, null, null,
    'Active', 'Three', 'active3@example.invalid', 'EGAL', true, true
  ),
  trip_id, id, booking_id, 'ALREADY_ACTIVE'
from app_modules.fanbus_registrations
where trip_id = '00000000-0000-4320-8200-000000000001'
  and participant_sequence = 3;
insert into m320_results values (
  'legacy_hash_replay', app_private.fanbus_submit_registration(
    '00000000-0000-4320-8200-000000000001', null,
    'Active', 'Three', 'active3@example.invalid', 'EGAL', true, true,
    '00000000-0000-4320-8300-000000000008'
  )
);
select is(
  (select result ->> 'registrationId' from m320_results where name = 'legacy_hash_replay'),
  (select id::text from app_modules.fanbus_registrations where trip_id = '00000000-0000-4320-8200-000000000001' and participant_sequence = 3),
  'Vorhandener M310-Hash bleibt replaybar'
);
select throws_ok(
  $$select app_private.fanbus_submit_booking_core(
    '00000000-0000-4320-8200-000000000001', 'GUEST', null,
    '{"firstName":"Duplicate","lastName":"Existing","email":"active3@example.invalid","busPreference":"EGAL"}',
    '[{"firstName":"Fresh","lastName":"Person","email":"fresh@example.invalid","busPreference":"EGAL"}]',
    true, true, '00000000-0000-4320-8300-000000000006'
  )$$,
  'P3201', 'FANBUS_BATCH_DUPLICATE', 'Bestehendes Duplikat verwirft den ganzen Batch'
);
select throws_ok(
  $$select app_private.fanbus_submit_booking_core(
    '00000000-0000-4320-8200-000000000001', 'GUEST', null,
    '{"firstName":"Same","lastName":"One","email":"same@example.invalid","busPreference":"EGAL"}',
    '[{"firstName":"Same","lastName":"Two","email":"SAME@EXAMPLE.INVALID","busPreference":"EGAL"}]',
    true, true, '00000000-0000-4320-8300-000000000007'
  )$$,
  'P3201', 'FANBUS_BATCH_DUPLICATE', 'Batch-internes Duplikat verwirft den Batch'
);
select is((select count(*)::integer from app_modules.fanbus_bookings where trip_id = '00000000-0000-4320-8200-000000000001'), 1, 'Duplikatfehler hinterlassen kein Teil-Booking');
select ok(exists (
  select 1 from app_portal.audit_events where action = 'FANBUS_WAITLIST_ENTERED'
), 'WAITLIST_ENTERED wird auditiert');
select ok(exists (
  select 1 from app_portal.audit_events where action = 'FANBUS_WAITLIST_PROMOTED'
), 'WAITLIST_PROMOTED wird auditiert');

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4320-8000-000000000003', true
);
insert into m320_results values (
  'capability_bus_manage', app_private.api_fanbus_bus_upsert(
    jsonb_build_object(
      'tripId', '00000000-0000-4320-8200-000000000003',
      'label', 'Capability Bus', 'category', 'NORMAL',
      'capacity', 5, 'isActive', true
    )
  )
);
select ok(
  (select result ->> 'id' from m320_results
   where name = 'capability_bus_manage') is not null,
  'fanbus.manage darf Busdefinitionen verwalten'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_registration_update(%L::jsonb)',
    (select jsonb_build_object(
      'id', id, 'expectedRevision', revision,
      'firstName', first_name, 'lastName', last_name, 'email', email,
      'busPreference', bus_preference
    )::text
    from app_modules.fanbus_registrations
    where email = 'legacy-guest@example.invalid')
  ),
  '42501', 'Berechtigung fehlt: fanbus.registrations.manage',
  'fanbus.manage allein darf Teilnehmer nicht bearbeiten'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4320-8000-000000000004', true
);
select throws_ok(
  $$select app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'tripId', '00000000-0000-4320-8200-000000000003',
    'label', 'Nicht erlaubt', 'category', 'NORMAL',
    'capacity', 5, 'isActive', true
  ))$$,
  '42501', 'Berechtigung fehlt: fanbus.manage',
  'fanbus.registrations.manage allein darf Busdefinitionen nicht verwalten'
);
insert into m320_results
select 'capability_participant_update',
  app_private.api_fanbus_registration_update(jsonb_build_object(
    'id', id, 'expectedRevision', revision,
    'firstName', first_name, 'lastName', last_name, 'email', email,
    'busPreference', 'PARTY'
  ))
from app_modules.fanbus_registrations
where email = 'legacy-guest@example.invalid';
select ok(exists (
  select 1 from app_portal.audit_events
  where actor_user_id = '00000000-0000-4320-8000-000000000004'
    and action = 'FANBUS_PARTICIPANT_UPDATED'
), 'fanbus.registrations.manage darf Participant Update ausführen');

insert into m320_results
select 'capability_assignment',
  app_private.api_fanbus_bus_assignment_set(jsonb_build_object(
    'participantId', id,
    'busId', (select result ->> 'id' from m320_results
      where name = 'capability_bus_manage')
  ))
from app_modules.fanbus_registrations
where email = 'legacy-guest@example.invalid';
select ok(exists (
  select 1 from app_portal.audit_events
  where actor_user_id = '00000000-0000-4320-8000-000000000004'
    and action = 'FANBUS_BUS_ASSIGNED'
), 'fanbus.registrations.manage darf Assignments ausführen');

insert into m320_results
select 'capability_cancel',
  app_private.api_fanbus_registration_cancel(jsonb_build_object(
    'id', id, 'expectedRevision', revision
  ))
from app_modules.fanbus_registrations
where email = 'legacy-guest@example.invalid';
select ok(exists (
  select 1 from app_portal.audit_events
  where actor_user_id = '00000000-0000-4320-8000-000000000004'
    and action = 'FANBUS_PARTICIPANT_CANCELLED'
), 'fanbus.registrations.manage darf Cancellation ausführen');

insert into m320_results
select 'capability_promote',
  app_private.api_fanbus_waitlist_promote(jsonb_build_object(
    'id', id, 'expectedRevision', revision
  ))
from app_modules.fanbus_registrations
where trip_id = '00000000-0000-4320-8200-000000000002'
  and status = 'WAITLISTED'
order by waitlisted_at, participant_sequence, id
limit 1;
select ok(exists (
  select 1 from app_portal.audit_events
  where actor_user_id = '00000000-0000-4320-8000-000000000004'
    and action = 'FANBUS_WAITLIST_PROMOTED'
), 'fanbus.registrations.manage darf Promotion ausführen');

select * from finish();
rollback;
