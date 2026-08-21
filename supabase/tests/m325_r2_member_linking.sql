\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column(
  'app_modules', 'fanbus_companion_list_members', 'linked_portal_user_id',
  'D-055 Portaluser-Anker ist vorhanden'
);
select hasnt_column(
  'app_modules', 'fanbus_companion_list_members', 'linked_member_id',
  'D-054 Mitgliedsanker ist nicht vorhanden'
);
select fk_ok(
  'app_modules', 'fanbus_companion_list_members', 'linked_portal_user_id',
  'app_portal', 'users', 'id',
  'linked_portal_user_id verweist auf app_portal.users'
);
select is(
  (select count(*)::integer
   from pg_constraint
   where conrelid = 'app_modules.fanbus_companion_list_members'::regclass
     and contype = 'u'
     and pg_get_constraintdef(oid) ilike '%linked_portal_user_id%'),
  0,
  'Kein UNIQUE verhindert mehrere Companion-Referenzen auf denselben Portaluser'
);
select ok(
  (select relrowsecurity from pg_class
   where oid = 'app_modules.fanbus_companion_list_members'::regclass),
  'Companion-Zeilen behalten RLS'
);
select ok(
  not has_table_privilege(
    'authenticated', 'app_modules.fanbus_companion_list_members', 'SELECT'
  ),
  'Browser kann Companion-Zeilen nicht direkt lesen'
);
select ok(
  not has_table_privilege('authenticated', 'app_portal.users', 'SELECT'),
  'Browser kann Portaluser nicht direkt lesen'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.api_fanbus_companion_person_search(jsonb)',
    'EXECUTE'
  ),
  'Private Portalusersuche ist nicht direkt browser-aufrufbar'
);
select ok(
  has_function_privilege('authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE'),
  'D-055 Actions werden ueber pd_api geroutet'
);
select ok(
  exists (
    select 1 from app_portal.capabilities
    where code = 'fanbus.participant_identity.manage' and is_active
  ),
  'Neue M010 Identity-Capability ist aktiv angelegt'
);
select is(
  (select count(*)::integer
   from app_portal.role_capabilities
   where capability_code = 'fanbus.participant_identity.manage'),
  0,
  'Neue Capability wird keiner Rolle automatisch zugeordnet'
);
select is(
  (select count(*)::integer
   from app_portal.team_function_capabilities
   where capability_code = 'fanbus.participant_identity.manage'
     and function_code = 'BUS_PARTICIPANT_IDENTITY'
     and team_id = (select id from app_portal.teams where code = 'BUS_ORGA')
     and is_active),
  1,
  'BUS_PARTICIPANT_IDENTITY ist fuer BUS_ORGA gemappt'
);
select ok(
  exists (
    select 1
    from app_portal.team_functions
    where code = 'BUS_PARTICIPANT_IDENTITY'
      and name = 'Teilnehmeridentitäten verknüpfen'
      and is_active
  ),
  'BUS_PARTICIPANT_IDENTITY existiert als eigene aktive Teamfunktion'
);
select is(
  (select count(*)::integer
   from app_portal.team_function_capabilities
   where capability_code = 'fanbus.participant_identity.manage'
     and function_code in (
       'BUS_PARTICIPANTS_MANAGE', 'BUS_OPERATIONS',
       'BUS_TRIPS_MANAGE', 'BUS_PAYMENT_MARKER'
     )),
  0,
  'Bestehende Bus-Orga-Funktionen erhalten die Identity-Capability nicht'
);
select is(
  (select count(*)::integer
   from app_portal.team_function_assignments
   where function_code = 'BUS_PARTICIPANT_IDENTITY'),
  0,
  'BUS_PARTICIPANT_IDENTITY erzeugt keine automatische User-Zuordnung'
);

insert into auth.users(id, email) values
  ('00000000-0000-4325-9000-000000000001', 'd055-owner@example.invalid'),
  ('00000000-0000-4325-9000-000000000002', 'd055-other@example.invalid'),
  ('00000000-0000-4325-9000-000000000003', 'd055-target@example.invalid'),
  ('00000000-0000-4325-9000-000000000004', 'd055-inactive@example.invalid'),
  ('00000000-0000-4325-9000-000000000005', 'd055-blocked@example.invalid'),
  ('00000000-0000-4325-9000-000000000006', 'd055-same-1@example.invalid'),
  ('00000000-0000-4325-9000-000000000007', 'd055-same-2@example.invalid'),
  ('00000000-0000-4325-9000-000000000008', 'd055-admin@example.invalid'),
  ('00000000-0000-4325-9000-000000000009', 'd055-max@example.invalid');
insert into app_portal.users(
  id, user_code, email, first_name, last_name, status, role_id
) values
  ('00000000-0000-4325-9000-000000000001', 'U-D055-1',
   'd055-owner@example.invalid', 'Rita', 'Owner', 'ACTIVE',
   '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4325-9000-000000000002', 'U-D055-2',
   'd055-other@example.invalid', 'Otto', 'Other', 'ACTIVE',
   '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4325-9000-000000000003', 'U-D055-3',
   'd055-target@example.invalid', 'Target', 'Person', 'ACTIVE',
   '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4325-9000-000000000004', 'U-D055-4',
   'd055-inactive@example.invalid', 'Ina', 'Inaktiv', 'INACTIVE',
   '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4325-9000-000000000005', 'U-D055-5',
   'd055-blocked@example.invalid', 'Berta', 'Blocked', 'BLOCKED',
   '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4325-9000-000000000006', 'U-D055-6',
   'd055-same-1@example.invalid', 'Doppel', 'Name', 'ACTIVE',
   '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4325-9000-000000000007', 'U-D055-7',
   'd055-same-2@example.invalid', 'Doppel', 'Name', 'ACTIVE',
   '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4325-9000-000000000008', 'U-D055-8',
   'd055-admin@example.invalid', 'Ada', 'Admin', 'ACTIVE',
   '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4325-9000-000000000009', 'U-D055-9',
   'd055-max@example.invalid', 'Max', 'Mustermann', 'ACTIVE',
   '00000000-0000-4000-8000-000000000003');

insert into app_portal.team_memberships(
  team_id, user_id, team_role, is_active
)
select team.id, assignment.user_id, 'MEMBER', true
from app_portal.teams as team
cross join (
  values
    ('00000000-0000-4325-9000-000000000002'::uuid),
    ('00000000-0000-4325-9000-000000000006'::uuid),
    ('00000000-0000-4325-9000-000000000007'::uuid)
) as assignment(user_id)
where team.code = 'BUS_ORGA';

insert into app_portal.team_function_assignments(
  team_id, user_id, function_code, created_by
)
select
  team.id,
  assignment.user_id,
  assignment.function_code,
  '00000000-0000-4325-9000-000000000008'::uuid
from app_portal.teams as team
cross join (
  values
    ('00000000-0000-4325-9000-000000000002'::uuid, 'BUS_PARTICIPANT_IDENTITY'),
    ('00000000-0000-4325-9000-000000000006'::uuid, 'BUS_OPERATIONS'),
    ('00000000-0000-4325-9000-000000000007'::uuid, 'BUS_PARTICIPANTS_MANAGE')
) as assignment(user_id, function_code)
where team.code = 'BUS_ORGA';

select ok(
  app_private.has_capability(
    '00000000-0000-4325-9000-000000000002',
    'fanbus.participant_identity.manage'
  ),
  'Ausgewaehlter Testuser erhaelt die Identity-Capability ueber die neue Teamfunktion'
);
select ok(
  not app_private.has_capability(
    '00000000-0000-4325-9000-000000000006',
    'fanbus.participant_identity.manage'
  ),
  'BUS_OPERATIONS allein verleiht keine Identity-Capability'
);
select ok(
  not app_private.has_capability(
    '00000000-0000-4325-9000-000000000007',
    'fanbus.participant_identity.manage'
  ),
  'BUS_PARTICIPANTS_MANAGE allein verleiht keine Identity-Capability'
);
select ok(
  app_private.has_capability(
    '00000000-0000-4325-9000-000000000008',
    'fanbus.participant_identity.manage'
  ),
  'ADMIN-Wildcard verleiht die Identity-Capability'
);

insert into app_fanclub.members(
  id, member_code, first_name, last_name, email, status
) values
  ('00000000-0000-4325-9100-000000000001', 'PD-D055-A',
   'Target', 'Member', 'target-member@example.invalid', 'ACTIVE'),
  ('00000000-0000-4325-9100-000000000002', 'PD-D055-I',
   'Old', 'Member', 'old-member@example.invalid', 'INACTIVE');
insert into app_portal.user_member_links(user_id, member_id, linked_by) values (
  '00000000-0000-4325-9000-000000000003',
  '00000000-0000-4325-9100-000000000001',
  '00000000-0000-4325-9000-000000000001'
);

create temporary table d055_limit_people(
  id uuid primary key,
  email text not null,
  first_name text not null,
  last_name text not null,
  user_code text not null
) on commit drop;
insert into d055_limit_people
select
  extensions.gen_random_uuid(),
  'd055-limit-' || value::text || '@example.invalid',
  'Limit',
  lpad(value::text, 2, '0'),
  'U-D055-L-' || value::text
from generate_series(1, 10) as series(value);
insert into auth.users(id, email)
select id, email from d055_limit_people;
insert into app_portal.users(
  id, user_code, email, first_name, last_name, status, role_id
)
select id, user_code, email, first_name, last_name, 'ACTIVE',
  '00000000-0000-4000-8000-000000000003'
from d055_limit_people;

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4325-9000-000000000001', true
);

select is(
  jsonb_array_length(
    app_private.api_fanbus_companion_person_search('{"query":"Limit"}'::jsonb)
      -> 'people'
  ),
  8,
  'Portalusersuche hat ein hartes Limit von 8'
);
select throws_ok(
  $$select app_private.api_fanbus_companion_person_search('{"query":""}'::jsonb)$$,
  '22023', 'FANBUS_PERSON_SEARCH_INVALID_QUERY',
  'Leere Suche wird abgewiesen'
);
select throws_ok(
  $$select app_private.api_fanbus_companion_person_search('{"query":"Ta"}'::jsonb)$$,
  '22023', 'FANBUS_PERSON_SEARCH_INVALID_QUERY',
  'Suche unter drei Zeichen wird abgewiesen'
);
select is(
  jsonb_array_length(
    app_private.api_fanbus_companion_person_search('{"query":"Ina Inaktiv"}'::jsonb)
      -> 'people'
  ),
  0,
  'INACTIVE Portaluser ist nicht auffindbar'
);
select is(
  jsonb_array_length(
    app_private.api_fanbus_companion_person_search('{"query":"Berta Blocked"}'::jsonb)
      -> 'people'
  ),
  0,
  'BLOCKED Portaluser ist nicht auffindbar'
);
select ok(
  not (
    app_private.api_fanbus_companion_person_search('{"query":"Target"}'::jsonb)
      -> 'people' -> 0
  ) ?| array['email', 'phone', 'address', 'birthDate', 'notes', 'role', 'capabilities'],
  'Portalusersuche liefert keine zusaetzliche PII'
);
select is(
  (app_private.api_fanbus_companion_person_search('{"query":"Target"}'::jsonb)
    -> 'people' -> 0 ->> 'isMember')::boolean,
  true,
  'Optionales Mitglied-Badge wird aus aktueller ACTIVE-Mitgliedschaft abgeleitet'
);

create temporary table d055_result(name text primary key, result jsonb)
on commit drop;
insert into d055_result values (
  'owner_list', app_private.api_fanbus_companion_list_upsert('{"name":"D055 Liste"}'::jsonb)
);
insert into d055_result values (
  'guest', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list'),
    'firstName', 'Gabi', 'lastName', 'Gast', 'defaultBusPreference', 'EGAL'
  ))
);
insert into d055_result values (
  'guest_two', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list'),
    'firstName', 'Gustav', 'lastName', 'Zwei', 'defaultBusPreference', 'EGAL'
  ))
);

select lives_ok(
  format(
    'select app_private.api_fanbus_companion_person_link(%L::jsonb)',
    jsonb_build_object(
      'id', (select result ->> 'id' from d055_result where name = 'guest'),
      'expectedRevision', 1,
      'linkedPortalUserId', '00000000-0000-4325-9000-000000000003'
    )::text
  ),
  'Owner darf eigenen Companion mit ACTIVE Portaluser verknuepfen'
);
select is(
  (select first_name || ' ' || last_name
   from app_modules.fanbus_companion_list_members
   where id = (select (result ->> 'id')::uuid from d055_result where name = 'guest')),
  'Target Person',
  'Private Verknuepfung aktualisiert den kanonischen Fallback-Namen'
);
select is(
  (app_private.api_fanbus_companion_person_link(jsonb_build_object(
    'id', (select result ->> 'id' from d055_result where name = 'guest'),
    'expectedRevision', 2,
    'linkedPortalUserId', '00000000-0000-4325-9000-000000000003'
  )) ->> 'noOp'),
  'true',
  'Same-Link ist ein echter NO-OP'
);
select is(
  (select revision from app_modules.fanbus_companion_list_members
   where id = (select (result ->> 'id')::uuid from d055_result where name = 'guest')),
  2,
  'Same-Link NO-OP erhoeht die Revision nicht'
);
select lives_ok(
  format(
    'select app_private.api_fanbus_companion_person_link(%L::jsonb)',
    jsonb_build_object(
      'id', (select result ->> 'id' from d055_result where name = 'guest_two'),
      'expectedRevision', 1,
      'linkedPortalUserId', '00000000-0000-4325-9000-000000000003'
    )::text
  ),
  'Mehrere Companion-Zeilen duerfen denselben Portaluser referenzieren'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4325-9000-000000000002', true
);
insert into d055_result values (
  'other_list', app_private.api_fanbus_companion_list_upsert('{"name":"Andere Liste"}'::jsonb)
);
insert into d055_result values (
  'other_guest', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'other_list'),
    'firstName', 'Target', 'lastName', 'Person', 'defaultBusPreference', 'EGAL'
  ))
);
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4325-9000-000000000001', true
);
select throws_ok(
  format(
    'select app_private.api_fanbus_companion_person_link(%L::jsonb)',
    jsonb_build_object(
      'id', (select result ->> 'id' from d055_result where name = 'other_guest'),
      'expectedRevision', 1,
      'linkedPortalUserId', '00000000-0000-4325-9000-000000000006'
    )::text
  ),
  '40001', 'STALE_REVISION_OR_NOT_FOUND',
  'Fremder Companion wird per IDOR-Owner-Pruefung blockiert'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_companion_person_link(%L::jsonb)',
    jsonb_build_object(
      'id', (select result ->> 'id' from d055_result where name = 'guest'),
      'expectedRevision', 1,
      'linkedPortalUserId', '00000000-0000-4325-9000-000000000006'
    )::text
  ),
  '40001', 'STALE_REVISION_OR_NOT_FOUND',
  'Stale private Link-CAS wird abgewiesen'
);
select lives_ok(
  format(
    'select app_private.api_fanbus_companion_person_unlink(%L::jsonb)',
    jsonb_build_object(
      'id', (select result ->> 'id' from d055_result where name = 'guest_two'),
      'expectedRevision', 2
    )::text
  ),
  'Private Portaluser-Verknuepfung kann geloest werden'
);
select is(
  (app_private.api_fanbus_companion_person_unlink(jsonb_build_object(
    'id', (select result ->> 'id' from d055_result where name = 'guest_two'),
    'expectedRevision', 3
  )) ->> 'noOp'),
  'true',
  'Already-unlinked ist ein echter NO-OP'
);

insert into app_modules.events(
  id, event_type, title, event_date, event_time, visibility
) values
  ('00000000-0000-4325-9200-000000000001', 'OTHER', 'D055 Fahrt 1', current_date + 10, time '18:00', 'PUBLIC'),
  ('00000000-0000-4325-9200-000000000002', 'OTHER', 'D055 Fahrt 2', current_date + 11, time '18:00', 'PUBLIC'),
  ('00000000-0000-4325-9200-000000000003', 'OTHER', 'D055 Fahrt 3', current_date + 12, time '18:00', 'PUBLIC'),
  ('00000000-0000-4325-9200-000000000004', 'OTHER', 'D055 Closed', current_date + 13, time '18:00', 'PUBLIC'),
  ('00000000-0000-4325-9200-000000000005', 'OTHER', 'D055 Cancelled', current_date + 14, time '18:00', 'PUBLIC'),
  ('00000000-0000-4325-9200-000000000006', 'OTHER', 'D055 Batch Duplicate', current_date + 15, time '18:00', 'PUBLIC'),
  ('00000000-0000-4325-9200-000000000007', 'OTHER', 'D055 Primary Duplicate', current_date + 16, time '18:00', 'PUBLIC'),
  ('00000000-0000-4325-9200-000000000008', 'OTHER', 'D055 Same Name', current_date + 17, time '18:00', 'PUBLIC'),
  ('00000000-0000-4325-9200-000000000009', 'OTHER', 'D055 Guest Fallback', current_date + 18, time '18:00', 'PUBLIC');
insert into app_modules.fanbus_trips(
  id, event_id, departure_at, departure_info, registration_opens_at,
  registration_closes_at, price_cents, capacity, privacy_reference,
  terms_reference, status, cancellation_reason, cancelled_at, cancelled_by
) values
  ('00000000-0000-4325-9300-000000000001', '00000000-0000-4325-9200-000000000001', now() + interval '9 days', 'D055-1', now() - interval '1 day', now() + interval '8 days', 2500, 30, 'privacy-v1', 'terms-v1', 'PUBLISHED', null, null, null),
  ('00000000-0000-4325-9300-000000000002', '00000000-0000-4325-9200-000000000002', now() + interval '10 days', 'D055-2', now() - interval '1 day', now() + interval '9 days', 2500, 30, 'privacy-v1', 'terms-v1', 'PUBLISHED', null, null, null),
  ('00000000-0000-4325-9300-000000000003', '00000000-0000-4325-9200-000000000003', now() + interval '11 days', 'D055-3', now() - interval '1 day', now() + interval '10 days', 2500, 30, 'privacy-v1', 'terms-v1', 'PUBLISHED', null, null, null),
  ('00000000-0000-4325-9300-000000000004', '00000000-0000-4325-9200-000000000004', now() + interval '12 days', 'D055-4', now() - interval '1 day', now() + interval '11 days', 2500, 30, 'privacy-v1', 'terms-v1', 'CLOSED', null, null, null),
  ('00000000-0000-4325-9300-000000000005', '00000000-0000-4325-9200-000000000005', now() + interval '13 days', 'D055-5', now() - interval '1 day', now() + interval '12 days', 2500, 30, 'privacy-v1', 'terms-v1', 'CANCELLED', 'K2 Testabsage', now(), '00000000-0000-4325-9000-000000000008'),
  ('00000000-0000-4325-9300-000000000006', '00000000-0000-4325-9200-000000000006', now() + interval '14 days', 'D055-6', now() - interval '1 day', now() + interval '13 days', 2500, 30, 'privacy-v1', 'terms-v1', 'PUBLISHED', null, null, null),
  ('00000000-0000-4325-9300-000000000007', '00000000-0000-4325-9200-000000000007', now() + interval '15 days', 'D055-7', now() - interval '1 day', now() + interval '14 days', 2500, 30, 'privacy-v1', 'terms-v1', 'PUBLISHED', null, null, null),
  ('00000000-0000-4325-9300-000000000008', '00000000-0000-4325-9200-000000000008', now() + interval '16 days', 'D055-8', now() - interval '1 day', now() + interval '15 days', 2500, 30, 'privacy-v1', 'terms-v1', 'PUBLISHED', null, null, null),
  ('00000000-0000-4325-9300-000000000009', '00000000-0000-4325-9200-000000000009', now() + interval '17 days', 'D055-9', now() - interval '1 day', now() + interval '16 days', 2500, 30, 'privacy-v1', 'terms-v1', 'PUBLISHED', null, null, null);

insert into app_modules.fanbus_buses(
  trip_id,
  label,
  category,
  capacity,
  is_active
)
select
  fixture.trip_id,
  'D055 Testbus',
  'NORMAL',
  30,
  true
from (
  values
    ('00000000-0000-4325-9300-000000000001'::uuid),
    ('00000000-0000-4325-9300-000000000002'::uuid),
    ('00000000-0000-4325-9300-000000000003'::uuid),
    ('00000000-0000-4325-9300-000000000004'::uuid),
    ('00000000-0000-4325-9300-000000000005'::uuid),
    ('00000000-0000-4325-9300-000000000006'::uuid),
    ('00000000-0000-4325-9300-000000000007'::uuid),
    ('00000000-0000-4325-9300-000000000008'::uuid),
    ('00000000-0000-4325-9300-000000000009'::uuid)
) as fixture(trip_id);

insert into d055_result values (
  'booking', app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list'),
    'tripId', '00000000-0000-4325-9300-000000000001',
    'busPreference', 'EGAL',
    'participants', jsonb_build_array(jsonb_build_object(
      'templateMemberId', (select result ->> 'id' from d055_result where name = 'guest'),
      'firstName', 'Client', 'lastName', 'Manipulation',
      'email', 'foreign@example.invalid', 'busPreference', 'PARTY'
    )),
    'privacyConfirmed', true, 'termsConfirmed', true,
    'idempotencyKey', '00000000-0000-4325-9500-000000000001'
  ))
);
select is(
  (select result ->> 'outcome' from d055_result where name = 'booking'),
  'CREATED',
  'D055 Linked-Booking-Fixture wird erfolgreich erzeugt'
);
select ok(
  (select result ->> 'bookingId' from d055_result where name = 'booking') is not null,
  'D055 Linked-Booking-Fixture liefert eine bookingId'
);
select is(
  (select portal_user_id::text from app_modules.fanbus_registrations
   where booking_id = (select (result ->> 'bookingId')::uuid from d055_result where name = 'booking')
     and booking_role = 'COMPANION'),
  '00000000-0000-4325-9000-000000000003',
  'Linked Portaluser Booking schreibt portal_user_id serverseitig'
);
select is(
  (select member_id::text from app_modules.fanbus_registrations
   where booking_id = (select (result ->> 'bookingId')::uuid from d055_result where name = 'booking')
     and booking_role = 'COMPANION'),
  '00000000-0000-4325-9100-000000000001',
  'Aktuelle M150-Mitgliedschaft schreibt optional member_id'
);
select is(
  (select email from app_modules.fanbus_registrations
   where booking_id = (select (result ->> 'bookingId')::uuid from d055_result where name = 'booking')
     and booking_role = 'COMPANION'),
  null,
  'Linked Booking uebernimmt keine fremde E-Mail'
);
select ok(
  (select companion_list_member_id is not null
   from app_modules.fanbus_registrations
   where booking_id = (select (result ->> 'bookingId')::uuid from d055_result where name = 'booking')
     and booking_role = 'COMPANION'),
  'companion_list_member_id bleibt Provenienz'
);

insert into d055_result values (
  'no_member_companion', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list'),
    'linkedPortalUserId', '00000000-0000-4325-9000-000000000006',
    'defaultBusPreference', 'EGAL'
  ))
);
insert into d055_result values (
  'no_member_booking', app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list'),
    'tripId', '00000000-0000-4325-9300-000000000003',
    'busPreference', 'EGAL',
    'participants', jsonb_build_array(jsonb_build_object(
      'templateMemberId', (select result ->> 'id' from d055_result where name = 'no_member_companion'),
      'busPreference', 'EGAL'
    )),
    'privacyConfirmed', true, 'termsConfirmed', true,
    'idempotencyKey', '00000000-0000-4325-9500-000000000002'
  ))
);
select is(
  (select result ->> 'outcome' from d055_result where name = 'no_member_booking'),
  'CREATED',
  'D055 No-Member-Booking-Fixture wird erfolgreich erzeugt'
);
select ok(
  (select result ->> 'bookingId' from d055_result where name = 'no_member_booking') is not null,
  'D055 No-Member-Booking-Fixture liefert eine bookingId'
);
select is(
  (select member_id from app_modules.fanbus_registrations
   where booking_id = (select (result ->> 'bookingId')::uuid from d055_result where name = 'no_member_booking')
     and booking_role = 'COMPANION'),
  null,
  'Portaluser ohne aktuelle Mitgliedschaft schreibt member_id NULL'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4325-9000-000000000002', true
);
insert into d055_result values (
  'admin_booking', app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'other_list'),
    'tripId', '00000000-0000-4325-9300-000000000002',
    'busPreference', 'EGAL',
    'participants', jsonb_build_array(jsonb_build_object(
      'templateMemberId', (select result ->> 'id' from d055_result where name = 'other_guest'),
      'firstName', 'Target', 'lastName', 'Person', 'busPreference', 'EGAL'
    )),
    'privacyConfirmed', true, 'termsConfirmed', true,
    'idempotencyKey', '00000000-0000-4325-9500-000000000003'
  ))
);
select is(
  (select result ->> 'outcome' from d055_result where name = 'admin_booking'),
  'CREATED',
  'D055 Admin-Booking-Fixture wird erfolgreich erzeugt'
);
select ok(
  (select result ->> 'bookingId' from d055_result where name = 'admin_booking') is not null,
  'D055 Admin-Booking-Fixture liefert eine bookingId'
);
insert into d055_result values (
  'admin_registration', jsonb_build_object('id', (
    select id from app_modules.fanbus_registrations
    where booking_id = (select (result ->> 'bookingId')::uuid from d055_result where name = 'admin_booking')
      and booking_role = 'COMPANION'
  ))
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4325-9000-000000000001', true
);
insert into app_portal.user_capabilities(user_id, capability_code, created_by)
values (
  '00000000-0000-4325-9000-000000000001',
  'fanbus.operations.manage',
  '00000000-0000-4325-9000-000000000001'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_registration_identity_link(%L::jsonb)',
    jsonb_build_object(
      'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration'),
      'expectedRevision', 1,
      'portalUserId', '00000000-0000-4325-9000-000000000003'
    )::text
  ),
  '42501', 'Berechtigung fehlt: fanbus.participant_identity.manage',
  'Operations-Capability allein erlaubt keinen Identity-Link'
);
delete from app_portal.user_capabilities
where user_id = '00000000-0000-4325-9000-000000000001'
  and capability_code = 'fanbus.operations.manage';
insert into app_portal.user_capabilities(user_id, capability_code, created_by)
values (
  '00000000-0000-4325-9000-000000000001',
  'fanbus.registrations.manage',
  '00000000-0000-4325-9000-000000000001'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_registration_identity_link(%L::jsonb)',
    jsonb_build_object(
      'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration'),
      'expectedRevision', 1,
      'portalUserId', '00000000-0000-4325-9000-000000000003'
    )::text
  ),
  '42501', 'Berechtigung fehlt: fanbus.participant_identity.manage',
  'Registrations-Capability allein erlaubt keinen Identity-Link'
);
delete from app_portal.user_capabilities
where user_id = '00000000-0000-4325-9000-000000000001'
  and capability_code = 'fanbus.registrations.manage';
insert into app_portal.user_capabilities(user_id, capability_code, created_by)
values (
  '00000000-0000-4325-9000-000000000001',
  'fanbus.participant_identity.manage',
  '00000000-0000-4325-9000-000000000001'
);

create temporary table d055_k2_portal_primary_before as
select
  to_jsonb(registration) as snapshot,
  (select count(*)::integer from app_portal.audit_events) as audit_count,
  (
    select coalesce(
      jsonb_agg(to_jsonb(companion) order by companion.id),
      '[]'::jsonb
    )
    from app_modules.fanbus_companion_list_members as companion
  ) as companion_snapshot
from app_modules.fanbus_registrations as registration
where registration.booking_id = (
  select (result ->> 'bookingId')::uuid
  from d055_result
  where name = 'booking'
)
and registration.booking_role = 'PRIMARY';

select throws_ok(
  format(
    'select app_private.api_fanbus_registration_identity_relink(%L::jsonb)',
    jsonb_build_object(
      'registrationId', (
        select id
        from app_modules.fanbus_registrations
        where booking_id = (
          select (result ->> 'bookingId')::uuid
          from d055_result
          where name = 'booking'
        )
        and booking_role = 'PRIMARY'
      ),
      'expectedRevision', 1,
      'portalUserId', '00000000-0000-4325-9000-000000000006'
    )::text
  ),
  '22023', 'FANBUS_PRIMARY_PORTAL_IDENTITY_IMMUTABLE',
  'PORTAL-PRIMARY RELINK ist unveraenderlich'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_registration_identity_unlink(%L::jsonb)',
    jsonb_build_object(
      'registrationId', (
        select id
        from app_modules.fanbus_registrations
        where booking_id = (
          select (result ->> 'bookingId')::uuid
          from d055_result
          where name = 'booking'
        )
        and booking_role = 'PRIMARY'
      ),
      'expectedRevision', 1
    )::text
  ),
  '22023', 'FANBUS_PRIMARY_PORTAL_IDENTITY_IMMUTABLE',
  'PORTAL-PRIMARY UNLINK ist unveraenderlich'
);
select is(
  (select to_jsonb(registration)
   from app_modules.fanbus_registrations as registration
   where registration.booking_id = (
     select (result ->> 'bookingId')::uuid
     from d055_result
     where name = 'booking'
   )
   and registration.booking_role = 'PRIMARY'),
  (select snapshot from d055_k2_portal_primary_before),
  'PORTAL-PRIMARY bleibt nach RELINK und UNLINK vollstaendig unveraendert'
);
select is(
  (select count(*)::integer from app_portal.audit_events),
  (select audit_count from d055_k2_portal_primary_before),
  'PORTAL-PRIMARY-Ablehnungen erzeugen kein Mutations-Audit'
);
select is(
  (select coalesce(
     jsonb_agg(to_jsonb(companion) order by companion.id),
     '[]'::jsonb
   )
   from app_modules.fanbus_companion_list_members as companion),
  (select companion_snapshot from d055_k2_portal_primary_before),
  'PORTAL-PRIMARY-Ablehnungen mutieren keinen Companion'
);

select set_config('app.m325_registration_context', '[]', true);
insert into app_modules.fanbus_bookings(
  id, trip_id, source, created_by
) values
  (
    '00000000-0000-4325-9600-000000000002',
    '00000000-0000-4325-9300-000000000004',
    'MANUAL', '00000000-0000-4325-9000-000000000001'
  ),
  (
    '00000000-0000-4325-9600-000000000003',
    '00000000-0000-4325-9300-000000000005',
    'MANUAL', '00000000-0000-4325-9000-000000000001'
  );
insert into app_modules.fanbus_registrations(
  id, trip_id, booking_id, booking_role, participant_sequence,
  first_name, last_name, email, bus_preference, source, status,
  privacy_reference, terms_reference, privacy_accepted_at,
  terms_accepted_at, created_by, updated_by
) values
  (
    '00000000-0000-4325-9700-000000000002',
    '00000000-0000-4325-9300-000000000004',
    '00000000-0000-4325-9600-000000000002',
    'PRIMARY', 1, 'Closed', 'Gast', null, 'EGAL', 'MANUAL', 'ACTIVE',
    'privacy-v1', 'terms-v1', now(), now(),
    '00000000-0000-4325-9000-000000000001',
    '00000000-0000-4325-9000-000000000001'
  ),
  (
    '00000000-0000-4325-9700-000000000003',
    '00000000-0000-4325-9300-000000000005',
    '00000000-0000-4325-9600-000000000003',
    'PRIMARY', 1, 'Cancelled', 'Gast', null, 'EGAL', 'MANUAL', 'ACTIVE',
    'privacy-v1', 'terms-v1', now(), now(),
    '00000000-0000-4325-9000-000000000001',
    '00000000-0000-4325-9000-000000000001'
  );
select lives_ok(
  $$select app_private.api_fanbus_registration_identity_link(
    '{"registrationId":"00000000-0000-4325-9700-000000000002","expectedRevision":1,"portalUserId":"00000000-0000-4325-9000-000000000007"}'::jsonb
  )$$,
  'CLOSED Fahrt erlaubt administrativen Identity-Link'
);
select throws_ok(
  $$select app_private.api_fanbus_registration_identity_link(
    '{"registrationId":"00000000-0000-4325-9700-000000000003","expectedRevision":1,"portalUserId":"00000000-0000-4325-9000-000000000007"}'::jsonb
  )$$,
  'P3302', 'FANBUS_TRIP_CANCELLED',
  'CANCELLED Fahrt verbietet administrativen Identity-Link'
);

select is(
  (app_private.api_fanbus_registration_identity_suggestion(jsonb_build_object(
    'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration')
  )) ->> 'status'),
  'SINGLE',
  'Exakt ein Namensmatch liefert einen Vorschlag'
);
select is(
  (select portal_user_id from app_modules.fanbus_registrations
   where id = (select (result ->> 'id')::uuid from d055_result where name = 'admin_registration')),
  null,
  'Vorschlag mutiert die Registration nicht automatisch'
);
update app_portal.users
set first_name = 'Target', last_name = 'Person'
where id = '00000000-0000-4325-9000-000000000006';
select is(
  (app_private.api_fanbus_registration_identity_suggestion(jsonb_build_object(
    'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration')
  )) ->> 'status'),
  'MULTIPLE',
  'Mehrere Namensmatches liefern keine Vorauswahl'
);
select is(
  app_private.api_fanbus_registration_identity_suggestion(jsonb_build_object(
    'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration')
  )) ->> 'suggestion',
  null,
  'MULTIPLE enthaelt keinen vorausgewaehlten Portaluser'
);
update app_portal.users
set first_name = 'Doppel', last_name = 'Name'
where id = '00000000-0000-4325-9000-000000000006';
update app_portal.users
set first_name = 'Andere', last_name = 'Person'
where id = '00000000-0000-4325-9000-000000000003';
select is(
  (app_private.api_fanbus_registration_identity_suggestion(jsonb_build_object(
    'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration')
  )) ->> 'status'),
  'NONE',
  'Kein exaktes Namensmatch liefert keinen Vorschlag'
);
update app_portal.users
set first_name = 'Target', last_name = 'Person'
where id = '00000000-0000-4325-9000-000000000003';

create temporary table d055_m150_before as
select * from app_portal.user_member_links;
select lives_ok(
  format(
    'select app_private.api_fanbus_registration_identity_link(%L::jsonb)',
    jsonb_build_object(
      'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration'),
      'expectedRevision', 1,
      'portalUserId', '00000000-0000-4325-9000-000000000003'
    )::text
  ),
  'Identity-Capability erlaubt den administrativen Link'
);
select is(
  (select portal_user_id::text from app_modules.fanbus_registrations
   where id = (select (result ->> 'id')::uuid from d055_result where name = 'admin_registration')),
  '00000000-0000-4325-9000-000000000003',
  'Administrative Verknuepfung setzt den Portaluser-Snapshot'
);
select is(
  (select member_id::text from app_modules.fanbus_registrations
   where id = (select (result ->> 'id')::uuid from d055_result where name = 'admin_registration')),
  '00000000-0000-4325-9100-000000000001',
  'Administrative Verknuepfung leitet ACTIVE member_id ab'
);
select is(
  (select linked_portal_user_id::text
   from app_modules.fanbus_companion_list_members
   where id = (select (result ->> 'id')::uuid from d055_result where name = 'other_guest')),
  '00000000-0000-4325-9000-000000000003',
  'Administrative Verknuepfung zieht genau den Provenienz-Companion mit'
);
select throws_ok(
  format(
    'select app_private.api_fanbus_registration_identity_relink(%L::jsonb)',
    jsonb_build_object(
      'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration'),
      'expectedRevision', 1,
      'portalUserId', '00000000-0000-4325-9000-000000000006'
    )::text
  ),
  '40001', 'STALE_REVISION',
  'Administrative Identity-Verknuepfung erzwingt CAS'
);
select set_config('app.m325_registration_context', '[]', true);
insert into app_modules.fanbus_bookings(
  id, trip_id, source, created_by
) values (
  '00000000-0000-4325-9600-000000000001',
  '00000000-0000-4325-9300-000000000002',
  'MANUAL',
  '00000000-0000-4325-9000-000000000001'
);
insert into app_modules.fanbus_registrations(
  id, trip_id, booking_id, booking_role, participant_sequence,
  first_name, last_name, email, bus_preference, source, status,
  privacy_reference, terms_reference, privacy_accepted_at,
  terms_accepted_at, created_by, updated_by
) values (
  '00000000-0000-4325-9700-000000000001',
  '00000000-0000-4325-9300-000000000002',
  '00000000-0000-4325-9600-000000000001',
  'PRIMARY', 1, 'Noch', 'Gast', null, 'EGAL', 'MANUAL', 'ACTIVE',
  'privacy-v1', 'terms-v1', now(), now(),
  '00000000-0000-4325-9000-000000000001',
  '00000000-0000-4325-9000-000000000001'
);
select throws_ok(
  $$select app_private.api_fanbus_registration_identity_link(
    '{"registrationId":"00000000-0000-4325-9700-000000000001","expectedRevision":1,"portalUserId":"00000000-0000-4325-9000-000000000003"}'::jsonb
  )$$,
  'P3251', 'FANBUS_REGISTRATION_IDENTITY_DUPLICATE',
  'Administrative Verknuepfung blockiert bestehende Stable-ID-Duplikate'
);
select is(
  (select count(*)::integer
   from (
     (select * from app_portal.user_member_links except select * from d055_m150_before)
     union all
     (select * from d055_m150_before except select * from app_portal.user_member_links)
   ) as difference),
  0,
  'M150 bleibt unveraendert'
);
select ok(
  exists (
    select 1 from app_portal.audit_events
    where action = 'FANBUS_REGISTRATION_IDENTITY_LINKED'
      and entity_id = (select result ->> 'id' from d055_result where name = 'admin_registration')
  ),
  'Administrative Identity-Verknuepfung wird auditert'
);

select lives_ok(
  format(
    'select app_private.api_fanbus_registration_identity_relink(%L::jsonb)',
    jsonb_build_object(
      'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration'),
      'expectedRevision', 2,
      'portalUserId', '00000000-0000-4325-9000-000000000006'
    )::text
  ),
  'Expliziter administrativer Relink ist moeglich'
);
select is(
  (select member_id from app_modules.fanbus_registrations
   where id = (select (result ->> 'id')::uuid from d055_result where name = 'admin_registration')),
  null,
  'Relink auf Portaluser ohne Mitglied setzt member_id NULL'
);
select lives_ok(
  format(
    'select app_private.api_fanbus_registration_identity_unlink(%L::jsonb)',
    jsonb_build_object(
      'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration'),
      'expectedRevision', 3
    )::text
  ),
  'Administrative Identity-Korrektur kann sicher geloest werden'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4325-9000-000000000002', true
);
select app_private.api_fanbus_companion_person_link(jsonb_build_object(
  'id', (select result ->> 'id' from d055_result where name = 'other_guest'),
  'expectedRevision', 4,
  'linkedPortalUserId', '00000000-0000-4325-9000-000000000007'
));
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4325-9000-000000000001', true
);
select throws_ok(
  format(
    'select app_private.api_fanbus_registration_identity_link(%L::jsonb)',
    jsonb_build_object(
      'registrationId', (select result ->> 'id' from d055_result where name = 'admin_registration'),
      'expectedRevision', 4,
      'portalUserId', '00000000-0000-4325-9000-000000000003'
    )::text
  ),
  'P3251', 'FANBUS_COMPANION_IDENTITY_CONFLICT',
  'Anderer Companion-Link wird nicht still ueberschrieben'
);
select is(
  (select portal_user_id from app_modules.fanbus_registrations
   where id = (select (result ->> 'id')::uuid from d055_result where name = 'admin_registration')),
  null,
  'Companion-Konflikt laesst die Registration atomar unveraendert'
);

select is(
  app_private.m325_companion_conflict_status(
    '00000000-0000-4325-9300-000000000001',
    null, null, null, 'Target', 'Person', null
  ),
  'CONFLICT',
  'Gastname kollidiert vorsichtig mit bekannter Registration'
);
select is(
  app_private.m325_companion_conflict_status(
    '00000000-0000-4325-9300-000000000001',
    null,
    '00000000-0000-4325-9000-000000000003',
    '00000000-0000-4325-9100-000000000001',
    'Anderer', 'Name', null
  ),
  'ALREADY_REGISTERED',
  'Stable Portal- und Member-Identity haben Vorrang vor dem Namen'
);

delete from app_portal.user_member_links
where user_id = '00000000-0000-4325-9000-000000000003';
insert into app_portal.user_member_links(user_id, member_id, linked_by) values (
  '00000000-0000-4325-9000-000000000006',
  '00000000-0000-4325-9100-000000000001',
  '00000000-0000-4325-9000-000000000001'
);
select is(
  app_private.m325_companion_conflict_status(
    '00000000-0000-4325-9300-000000000001',
    null,
    '00000000-0000-4325-9000-000000000006',
    '00000000-0000-4325-9100-000000000001',
    'Doppel', 'Name', null
  ),
  'ALREADY_REGISTERED',
  'Gleiche aktuell abgeleitete member_id wird trotz anderer portal_user_id blockiert'
);
delete from app_portal.user_member_links
where user_id = '00000000-0000-4325-9000-000000000006';
insert into app_portal.user_member_links(user_id, member_id, linked_by) values (
  '00000000-0000-4325-9000-000000000003',
  '00000000-0000-4325-9100-000000000001',
  '00000000-0000-4325-9000-000000000001'
);

insert into d055_result values (
  'owner_list_two', app_private.api_fanbus_companion_list_upsert('{"name":"D055 Liste 2"}'::jsonb)
);
insert into d055_result values (
  'same_portal_other_list', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list_two'),
    'linkedPortalUserId', '00000000-0000-4325-9000-000000000003',
    'defaultBusPreference', 'EGAL'
  ))
);
select is(
  (app_private.api_fanbus_companion_duplicate_preview(jsonb_build_object(
    'tripId', '00000000-0000-4325-9300-000000000001',
    'participants', jsonb_build_array(jsonb_build_object(
      'templateMemberId', (select result ->> 'id' from d055_result where name = 'same_portal_other_list')
    ))
  )) -> 'members' -> 0 ->> 'status'),
  'ALREADY_REGISTERED',
  'Gleicher Portaluser ueber mehrere Listen wird auf derselben Fahrt blockiert'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4325-9000-000000000002', true
);
insert into d055_result values (
  'same_portal_other_owner', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'other_list'),
    'linkedPortalUserId', '00000000-0000-4325-9000-000000000003',
    'defaultBusPreference', 'EGAL'
  ))
);
select throws_ok(
  format(
    'select app_private.api_fanbus_companion_booking_submit(%L::jsonb)',
    jsonb_build_object(
      'listId', (select result ->> 'id' from d055_result where name = 'other_list'),
      'tripId', '00000000-0000-4325-9300-000000000001',
      'busPreference', 'EGAL',
      'participants', jsonb_build_array(jsonb_build_object(
        'templateMemberId', (select result ->> 'id' from d055_result where name = 'same_portal_other_owner'),
        'busPreference', 'EGAL'
      )),
      'privacyConfirmed', true, 'termsConfirmed', true,
      'idempotencyKey', '00000000-0000-4325-9500-000000000004'
    )::text
  ),
  'P3251', 'FANBUS_COMPANION_CONFLICT',
  'Direkter Submit blockiert denselben Portaluser atomar'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4325-9000-000000000001', true
);
insert into d055_result values (
  'primary_same', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list_two'),
    'linkedPortalUserId', '00000000-0000-4325-9000-000000000001',
    'defaultBusPreference', 'EGAL'
  ))
);
select is(
  (app_private.api_fanbus_companion_duplicate_preview(jsonb_build_object(
    'tripId', '00000000-0000-4325-9300-000000000003',
    'participants', jsonb_build_array(jsonb_build_object(
      'templateMemberId', (select result ->> 'id' from d055_result where name = 'primary_same')
    ))
  )) -> 'members' -> 0 ->> 'status'),
  'CONFLICT',
  'PRIMARY und Companion mit gleicher portal_user_id werden blockiert'
);

insert into d055_result values (
  'same_name_one', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list_two'),
    'linkedPortalUserId', '00000000-0000-4325-9000-000000000006',
    'defaultBusPreference', 'EGAL'
  ))
);
insert into d055_result values (
  'same_name_two', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list_two'),
    'linkedPortalUserId', '00000000-0000-4325-9000-000000000007',
    'defaultBusPreference', 'EGAL'
  ))
);
select is(
  (select count(*)::integer
   from jsonb_array_elements(
     app_private.api_fanbus_companion_duplicate_preview(jsonb_build_object(
       'tripId', '00000000-0000-4325-9300-000000000002',
       'participants', jsonb_build_array(
         jsonb_build_object('templateMemberId', (select result ->> 'id' from d055_result where name = 'same_name_one')),
         jsonb_build_object('templateMemberId', (select result ->> 'id' from d055_result where name = 'same_name_two'))
       )
     )) -> 'members'
   ) as preview(item)
   where preview.item ->> 'status' = 'READY'),
  2,
  'Verschiedene Portaluser mit gleichem Namen bleiben erlaubt'
);

insert into d055_result values (
  'k2_same_portal_two', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list_two'),
    'linkedPortalUserId', '00000000-0000-4325-9000-000000000006',
    'defaultBusPreference', 'EGAL'
  ))
);
create temporary table d055_k2_atomic_counts(
  name text primary key,
  booking_count integer not null,
  registration_count integer not null
) on commit drop;
insert into d055_k2_atomic_counts
select
  'same_portal_batch',
  (select count(*)::integer from app_modules.fanbus_bookings),
  (select count(*)::integer from app_modules.fanbus_registrations);
select throws_ok(
  format(
    'select app_private.api_fanbus_companion_booking_submit(%L::jsonb)',
    jsonb_build_object(
      'listId', (select result ->> 'id' from d055_result where name = 'owner_list_two'),
      'tripId', '00000000-0000-4325-9300-000000000006',
      'busPreference', 'EGAL',
      'participants', jsonb_build_array(
        jsonb_build_object(
          'templateMemberId', (select result ->> 'id' from d055_result where name = 'same_name_one'),
          'busPreference', 'EGAL'
        ),
        jsonb_build_object(
          'templateMemberId', (select result ->> 'id' from d055_result where name = 'k2_same_portal_two'),
          'busPreference', 'EGAL'
        )
      ),
      'privacyConfirmed', true,
      'termsConfirmed', true,
      'idempotencyKey', '00000000-0000-4325-9500-000000000006'
    )::text
  ),
  'P3251', 'FANBUS_COMPANION_CONFLICT',
  'Direkter Batch-Submit blockiert denselben Portaluser zweimal atomar'
);
select is(
  (select count(*)::integer from app_modules.fanbus_bookings),
  (select booking_count from d055_k2_atomic_counts where name = 'same_portal_batch'),
  'Doppelter Portaluser erzeugt keine neue Booking-Zeile'
);
select is(
  (select count(*)::integer from app_modules.fanbus_registrations),
  (select registration_count from d055_k2_atomic_counts where name = 'same_portal_batch'),
  'Doppelter Portaluser erzeugt keine Registration oder Teilgruppe'
);

insert into d055_k2_atomic_counts
select
  'primary_companion',
  (select count(*)::integer from app_modules.fanbus_bookings),
  (select count(*)::integer from app_modules.fanbus_registrations);
select throws_ok(
  format(
    'select app_private.api_fanbus_companion_booking_submit(%L::jsonb)',
    jsonb_build_object(
      'listId', (select result ->> 'id' from d055_result where name = 'owner_list_two'),
      'tripId', '00000000-0000-4325-9300-000000000007',
      'busPreference', 'EGAL',
      'participants', jsonb_build_array(jsonb_build_object(
        'templateMemberId', (select result ->> 'id' from d055_result where name = 'primary_same'),
        'busPreference', 'EGAL'
      )),
      'privacyConfirmed', true,
      'termsConfirmed', true,
      'idempotencyKey', '00000000-0000-4325-9500-000000000007'
    )::text
  ),
  'P3251', 'FANBUS_COMPANION_CONFLICT',
  'Direkter Submit blockiert PRIMARY gleich Companion atomar'
);
select is(
  (select count(*)::integer from app_modules.fanbus_bookings),
  (select booking_count from d055_k2_atomic_counts where name = 'primary_companion'),
  'PRIMARY gleich Companion erzeugt keine Booking-Zeile'
);
select is(
  (select count(*)::integer from app_modules.fanbus_registrations),
  (select registration_count from d055_k2_atomic_counts where name = 'primary_companion'),
  'PRIMARY gleich Companion erzeugt keine Registration oder Teilgruppe'
);

select lives_ok(
  format(
    'select app_private.api_fanbus_companion_booking_submit(%L::jsonb)',
    jsonb_build_object(
      'listId', (select result ->> 'id' from d055_result where name = 'owner_list_two'),
      'tripId', '00000000-0000-4325-9300-000000000008',
      'busPreference', 'EGAL',
      'participants', jsonb_build_array(
        jsonb_build_object(
          'templateMemberId', (select result ->> 'id' from d055_result where name = 'same_name_one'),
          'busPreference', 'EGAL'
        ),
        jsonb_build_object(
          'templateMemberId', (select result ->> 'id' from d055_result where name = 'same_name_two'),
          'busPreference', 'EGAL'
        )
      ),
      'privacyConfirmed', true,
      'termsConfirmed', true,
      'idempotencyKey', '00000000-0000-4325-9500-000000000008'
    )::text
  ),
  'Direkter Submit erlaubt gleichen Namen fuer verschiedene Portaluser'
);
select is(
  (select count(*)::integer
   from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4325-9300-000000000008'
     and booking_role = 'COMPANION'
     and portal_user_id in (
       '00000000-0000-4325-9000-000000000006',
       '00000000-0000-4325-9000-000000000007'
     )),
  2,
  'Beide gleichnamigen Portalidentitaeten werden getrennt gespeichert'
);

select set_config('app.m325_registration_context', '[]', true);
insert into app_modules.fanbus_bookings(
  id, trip_id, source, created_by
) values (
  '00000000-0000-4325-9600-000000000009',
  '00000000-0000-4325-9300-000000000009',
  'MANUAL',
  '00000000-0000-4325-9000-000000000008'
);
insert into app_modules.fanbus_registrations(
  id, trip_id, booking_id, booking_role, participant_sequence,
  portal_user_id, first_name, last_name, email, bus_preference,
  source, status, privacy_reference, terms_reference,
  privacy_accepted_at, terms_accepted_at, created_by, updated_by
) values (
  '00000000-0000-4325-9700-000000000009',
  '00000000-0000-4325-9300-000000000009',
  '00000000-0000-4325-9600-000000000009',
  'PRIMARY', 1,
  '00000000-0000-4325-9000-000000000009',
  'Max', 'Mustermann', null, 'EGAL', 'MANUAL', 'ACTIVE',
  'privacy-v1', 'terms-v1', now(), now(),
  '00000000-0000-4325-9000-000000000008',
  '00000000-0000-4325-9000-000000000008'
);
insert into d055_result values (
  'k2_guest_max', app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
    'listId', (select result ->> 'id' from d055_result where name = 'owner_list_two'),
    'firstName', 'Max',
    'lastName', 'Mustermann',
    'defaultBusPreference', 'EGAL'
  ))
);
insert into d055_k2_atomic_counts
select
  'guest_fallback',
  (select count(*)::integer from app_modules.fanbus_bookings),
  (select count(*)::integer from app_modules.fanbus_registrations);
select throws_ok(
  format(
    'select app_private.api_fanbus_companion_booking_submit(%L::jsonb)',
    jsonb_build_object(
      'listId', (select result ->> 'id' from d055_result where name = 'owner_list_two'),
      'tripId', '00000000-0000-4325-9300-000000000009',
      'busPreference', 'EGAL',
      'participants', jsonb_build_array(jsonb_build_object(
        'templateMemberId', (select result ->> 'id' from d055_result where name = 'k2_guest_max'),
        'firstName', 'Max',
        'lastName', 'Mustermann',
        'busPreference', 'EGAL'
      )),
      'privacyConfirmed', true,
      'termsConfirmed', true,
      'idempotencyKey', '00000000-0000-4325-9500-000000000009'
    )::text
  ),
  'P3251', 'FANBUS_COMPANION_CONFLICT',
  'Echter Gast-Submit kollidiert vorsichtig mit bekannter Portalperson'
);
select is(
  (select count(*)::integer from app_modules.fanbus_bookings),
  (select booking_count from d055_k2_atomic_counts where name = 'guest_fallback'),
  'Gast-Fallback-Konflikt erzeugt keine neue Booking-Zeile'
);
select is(
  (select count(*)::integer from app_modules.fanbus_registrations),
  (select registration_count from d055_k2_atomic_counts where name = 'guest_fallback'),
  'Gast-Fallback-Konflikt erzeugt keine Registration oder Teilgruppe'
);

delete from app_portal.user_member_links
where user_id = '00000000-0000-4325-9000-000000000003';
update app_portal.users
set first_name = 'Changed', last_name = 'Later', status = 'INACTIVE'
where id = '00000000-0000-4325-9000-000000000003';
select is(
  (select portal_user_id::text from app_modules.fanbus_registrations
   where booking_id = (select (result ->> 'bookingId')::uuid from d055_result where name = 'booking')
     and booking_role = 'COMPANION'),
  '00000000-0000-4325-9000-000000000003',
  'Historischer portal_user_id Snapshot bleibt unveraendert'
);
select is(
  (select member_id::text from app_modules.fanbus_registrations
   where booking_id = (select (result ->> 'bookingId')::uuid from d055_result where name = 'booking')
     and booking_role = 'COMPANION'),
  '00000000-0000-4325-9100-000000000001',
  'Historischer member_id Snapshot bleibt unveraendert'
);

select finish();
rollback;
