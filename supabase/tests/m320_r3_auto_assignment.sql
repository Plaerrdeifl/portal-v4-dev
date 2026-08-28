\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- M320-R3 R1 runtime contract. Everything is rolled back.
insert into auth.users (id, email) values
  ('32a00000-0000-4000-8000-000000009001', 'm320-r3@example.invalid');
insert into app_portal.users (
  id, user_code, email, first_name, last_name, status, role_id
) values (
  '32a00000-0000-4000-8000-000000009001', 'U-M320-R3',
  'm320-r3@example.invalid', 'M320', 'R3', 'ACTIVE',
  '00000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claim.sub',
  (
    select portal_user.id::text
    from app_portal.users portal_user
    where portal_user.status = 'ACTIVE'
      and app_private.has_capability(portal_user.id, 'fanbus.registrations.manage')
    order by portal_user.id
    limit 1
  ),
  true
);

select ok(
  auth.uid() is not null
    and app_private.has_capability(auth.uid(), 'fanbus.registrations.manage'),
  'Fixture actor has fanbus.registrations.manage'
);

select is(
  app_private.platform_action_classification('fanbus_assignment_preview'),
  'READ',
  'Preview is classified READ'
);
select is(
  app_private.platform_action_classification('fanbus_assignment_apply'),
  'USER_MUTATION',
  'Apply is classified USER_MUTATION'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.api_fanbus_assignment_preview(jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'app_private.api_fanbus_assignment_apply(jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.pd_api(text,jsonb)',
    'EXECUTE'
  ),
  'R3 remains reachable only through public.pd_api for authenticated clients'
);
select is(
  (
    select coalesce(
      array_agg(distinct assignment_source order by assignment_source),
      array[]::text[]
    )
    from app_modules.fanbus_bus_assignments
  ) <@ array['AUTO','MANUAL']::text[],
  true,
  'Stored assignment_source values are limited to AUTO and MANUAL'
);

create temporary table m320_r3_fixture_actor as
select auth.uid() id;

insert into app_modules.events(
  id, event_type, title, event_date, visibility, created_by, updated_by
) values (
  '32a00000-0000-4000-8000-000000000001',
  'OTHER',
  'M320-R3 pgTAP fixture',
  date '2030-12-31',
  'INTERNAL',
  auth.uid(),
  auth.uid()
);

insert into app_modules.fanbus_trips(
  id, event_id, status, bus_preference_enabled, created_by, updated_by
) values (
  '32a00000-0000-4000-8000-000000001001',
  '32a00000-0000-4000-8000-000000000001',
  'CLOSED',
  false,
  auth.uid(),
  auth.uid()
);

insert into app_modules.fanbus_buses(
  id, trip_id, label, category, capacity, is_active, created_by, updated_by
) values
  ('32a00000-0000-4000-8000-000000002001','32a00000-0000-4000-8000-000000001001','Party R3','PARTY',4,true,auth.uid(),auth.uid()),
  ('32a00000-0000-4000-8000-000000002002','32a00000-0000-4000-8000-000000001001','Ruhig R3','RUHIG',3,true,auth.uid(),auth.uid()),
  ('32a00000-0000-4000-8000-000000002003','32a00000-0000-4000-8000-000000001001','Normal R3','NORMAL',5,true,auth.uid(),auth.uid());

-- R2 effective preference topology must exist before participant insertion.
update app_modules.fanbus_trips
set bus_preference_enabled = true
where id = '32a00000-0000-4000-8000-000000001001';

insert into app_modules.fanbus_boarding_stops(
  id, label, position, is_active, created_by, updated_by
)
select
  '32a00000-0000-4000-8000-000000006001',
  'R3 Spezialzustieg',
  coalesce(max(position), 0) + 100,
  true,
  auth.uid(),
  auth.uid()
from app_modules.fanbus_boarding_stops;

insert into app_modules.fanbus_bookings(id, trip_id, source, created_by) values
  ('32a00000-0000-4000-8000-000000003001','32a00000-0000-4000-8000-000000001001','MANUAL',auth.uid()),
  ('32a00000-0000-4000-8000-000000003002','32a00000-0000-4000-8000-000000001001','MANUAL',auth.uid()),
  ('32a00000-0000-4000-8000-000000003003','32a00000-0000-4000-8000-000000001001','MANUAL',auth.uid()),
  ('32a00000-0000-4000-8000-000000003004','32a00000-0000-4000-8000-000000001001','MANUAL',auth.uid()),
  ('32a00000-0000-4000-8000-000000003005','32a00000-0000-4000-8000-000000001001','MANUAL',auth.uid()),
  ('32a00000-0000-4000-8000-000000003006','32a00000-0000-4000-8000-000000001001','MANUAL',auth.uid());

insert into app_modules.fanbus_registrations(
  id, trip_id, first_name, last_name, bus_preference, status,
  privacy_reference, terms_reference, privacy_accepted_at, terms_accepted_at,
  source, booking_id, booking_role, participant_sequence,
  trip_boarding_stop_id, waitlisted_at, created_by, updated_by
) values
  ('32a00000-0000-4000-8000-000000004001','32a00000-0000-4000-8000-000000001001','Booking','Party A','PARTY','ACTIVE','test','test',now(),now(),'MANUAL','32a00000-0000-4000-8000-000000003001','PRIMARY',1,null,null,auth.uid(),auth.uid()),
  ('32a00000-0000-4000-8000-000000004002','32a00000-0000-4000-8000-000000001001','Booking','Party B','PARTY','ACTIVE','test','test',now(),now(),'MANUAL','32a00000-0000-4000-8000-000000003001','COMPANION',2,null,null,auth.uid(),auth.uid()),
  ('32a00000-0000-4000-8000-000000004003','32a00000-0000-4000-8000-000000001001','Stop','Ruhig','RUHIG','ACTIVE','test','test',now(),now(),'MANUAL','32a00000-0000-4000-8000-000000003002','PRIMARY',1,null,null,auth.uid(),auth.uid()),
  ('32a00000-0000-4000-8000-000000004004','32a00000-0000-4000-8000-000000001001','Egal','Flex','EGAL','ACTIVE','test','test',now(),now(),'MANUAL','32a00000-0000-4000-8000-000000003003','PRIMARY',1,null,null,auth.uid(),auth.uid()),
  ('32a00000-0000-4000-8000-000000004005','32a00000-0000-4000-8000-000000001001','Fixed','Manual','EGAL','ACTIVE','test','test',now(),now(),'MANUAL','32a00000-0000-4000-8000-000000003004','PRIMARY',1,null,null,auth.uid(),auth.uid()),
  ('32a00000-0000-4000-8000-000000004006','32a00000-0000-4000-8000-000000001001','Fixed','Auto','PARTY','ACTIVE','test','test',now(),now(),'MANUAL','32a00000-0000-4000-8000-000000003005','PRIMARY',1,null,null,auth.uid(),auth.uid()),
  ('32a00000-0000-4000-8000-000000004007','32a00000-0000-4000-8000-000000001001','Wait','List','PARTY','WAITLISTED','test','test',now(),now(),'MANUAL','32a00000-0000-4000-8000-000000003006','PRIMARY',1,null,now(),auth.uid(),auth.uid());

insert into app_modules.fanbus_trip_boarding_stops(
  id, trip_id, boarding_stop_id, departure_at, position, is_active,
  created_by, updated_by
) values (
  '32a00000-0000-4000-8000-000000007001',
  '32a00000-0000-4000-8000-000000001001',
  '32a00000-0000-4000-8000-000000006001',
  timestamptz '2030-12-31 12:00:00+01', 1, true, auth.uid(), auth.uid()
);
update app_modules.fanbus_registrations
set trip_boarding_stop_id = '32a00000-0000-4000-8000-000000007001'
where id = '32a00000-0000-4000-8000-000000004003';

-- The special stop is intentionally not served by RUHIG.
insert into app_modules.fanbus_bus_boarding_stops(
  id, trip_id, bus_id, trip_boarding_stop_id, created_by, updated_by
) values
  ('32a00000-0000-4000-8000-000000008001','32a00000-0000-4000-8000-000000001001','32a00000-0000-4000-8000-000000002001','32a00000-0000-4000-8000-000000007001',auth.uid(),auth.uid()),
  ('32a00000-0000-4000-8000-000000008002','32a00000-0000-4000-8000-000000001001','32a00000-0000-4000-8000-000000002003','32a00000-0000-4000-8000-000000007001',auth.uid(),auth.uid());

insert into app_modules.fanbus_bus_assignments(
  participant_id, trip_id, bus_id, assignment_source, created_by, updated_by
) values
  ('32a00000-0000-4000-8000-000000004005','32a00000-0000-4000-8000-000000001001','32a00000-0000-4000-8000-000000002003','MANUAL',auth.uid(),auth.uid()),
  ('32a00000-0000-4000-8000-000000004006','32a00000-0000-4000-8000-000000001001','32a00000-0000-4000-8000-000000002001','AUTO',auth.uid(),auth.uid());

create temporary table m320_r3_before as
select
  (select count(*) from app_modules.fanbus_bus_assignments where trip_id='32a00000-0000-4000-8000-000000001001') assignment_count,
  (select count(*) from app_portal.audit_events) audit_count;

create temporary table m320_r3_preview as
select app_private.api_fanbus_assignment_preview(
  jsonb_build_object('tripId','32a00000-0000-4000-8000-000000001001')
) preview;

select is(
  (select app_private.m320_r3_assignment_plan('32a00000-0000-4000-8000-000000001001')),
  (select app_private.m320_r3_assignment_plan('32a00000-0000-4000-8000-000000001001')),
  'Same input yields byte-equivalent deterministic plan'
);
select is(
  (select (preview #>> '{summary,participantsToAssign}')::integer from m320_r3_preview),
  4,
  'Only four unassigned ACTIVE participants are candidates; WAITLISTED is excluded'
);
select is(
  (
    select count(*)::integer
    from jsonb_array_elements((select preview->'participantProposals' from m320_r3_preview)) item(value)
    where item.value->>'participantId'='32a00000-0000-4000-8000-000000004007'
  ),
  0,
  'WAITLISTED participant is absent from assignment proposals'
);
select is(
  (
    select count(distinct item.value->>'proposedBusId')::integer
    from jsonb_array_elements((select preview->'participantProposals' from m320_r3_preview)) item(value)
    where item.value->>'participantId' in (
      '32a00000-0000-4000-8000-000000004001',
      '32a00000-0000-4000-8000-000000004002'
    )
  ),
  1,
  'Members of one booking stay together when a whole valid bus exists'
);
select isnt(
  (
    select item.value->>'proposedBusId'
    from jsonb_array_elements((select preview->'participantProposals' from m320_r3_preview)) item(value)
    where item.value->>'participantId'='32a00000-0000-4000-8000-000000004003'
  ),
  '32a00000-0000-4000-8000-000000002002',
  'RUHIG bus is rejected when it does not serve the participant stop'
);
select is(
  (
    select item.value->>'assignmentState'
    from jsonb_array_elements((select preview->'participantProposals' from m320_r3_preview)) item(value)
    where item.value->>'participantId'='32a00000-0000-4000-8000-000000004005'
  ),
  'FIXED_MANUAL',
  'Existing MANUAL assignment is protected'
);
select is(
  (
    select item.value->>'assignmentState'
    from jsonb_array_elements((select preview->'participantProposals' from m320_r3_preview)) item(value)
    where item.value->>'participantId'='32a00000-0000-4000-8000-000000004006'
  ),
  'EXISTING_AUTO',
  'Existing AUTO assignment is equally protected in R1'
);
select is(
  (select count(*) from app_modules.fanbus_bus_assignments where trip_id='32a00000-0000-4000-8000-000000001001'),
  (select assignment_count from m320_r3_before),
  'Preview creates no assignment rows'
);
select is(
  (select count(*) from app_portal.audit_events),
  (select audit_count from m320_r3_before),
  'Preview creates no audit rows'
);

create temporary table m320_r3_apply_payload as
select jsonb_build_object(
  'tripId','32a00000-0000-4000-8000-000000001001',
  'algorithmVersion',preview->>'algorithmVersion',
  'inputFingerprint',preview->>'inputFingerprint',
  'finalAssignments',(
    select jsonb_agg(
      jsonb_build_object(
        'participantId', proposal.value->>'participantId',
        'busId', case
          when proposal.value->>'participantId'='32a00000-0000-4000-8000-000000004003'
            then '32a00000-0000-4000-8000-000000002001'
          else proposal.value->>'proposedBusId'
        end
      )
      order by proposal.value->>'participantId'
    )
    from jsonb_array_elements(preview->'participantProposals') proposal(value)
    where proposal.value->>'assignmentState'='PROPOSED_AUTO'
  )
) payload
from m320_r3_preview;

select lives_ok(
  format(
    'select app_private.api_fanbus_assignment_apply(%L::jsonb)',
    (select payload::text from m320_r3_apply_payload)
  ),
  'Atomic apply accepts valid auto proposals plus one valid manual override'
);
select is(
  (
    select assignment_source
    from app_modules.fanbus_bus_assignments
    where participant_id='32a00000-0000-4000-8000-000000004003'
  ),
  'MANUAL',
  'Changed preview proposal is stored MANUAL'
);
select is(
  (
    select count(*)::integer
    from app_modules.fanbus_bus_assignments
    where participant_id in (
      '32a00000-0000-4000-8000-000000004001',
      '32a00000-0000-4000-8000-000000004002',
      '32a00000-0000-4000-8000-000000004004'
    )
      and assignment_source='AUTO'
  ),
  3,
  'Unchanged auto proposals are stored AUTO'
);
select is(
  (
    select (app_private.api_fanbus_assignment_preview(
      jsonb_build_object('tripId','32a00000-0000-4000-8000-000000001001')
    ) #>> '{summary,participantsToAssign}')::integer
  ),
  0,
  'A later R1 preview never reoptimizes existing AUTO assignments'
);

-- Explicit manual setter on the same bus turns an AUTO-origin row into MANUAL.
select lives_ok(
  $$select app_private.api_fanbus_bus_assignment_set(
    jsonb_build_object(
      'participantId','32a00000-0000-4000-8000-000000004006',
      'busId','32a00000-0000-4000-8000-000000002001'
    )
  )$$,
  'Existing manual assignment endpoint remains usable on AUTO-origin row'
);
select is(
  (
    select assignment_source
    from app_modules.fanbus_bus_assignments
    where participant_id='32a00000-0000-4000-8000-000000004006'
  ),
  'MANUAL',
  'Manual setter always leaves assignment_source MANUAL'
);

-- Fingerprint/CAS stale protection: change a relevant bus field after preview.
create temporary table m320_r3_stale_payload as
select jsonb_build_object(
  'tripId','32a00000-0000-4000-8000-000000001001',
  'algorithmVersion',preview->>'algorithmVersion',
  'inputFingerprint',preview->>'inputFingerprint',
  'finalAssignments','[]'::jsonb
) payload
from (
  select app_private.api_fanbus_assignment_preview(
    jsonb_build_object('tripId','32a00000-0000-4000-8000-000000001001')
  ) preview
) current_preview;

update app_modules.fanbus_buses
set capacity=capacity+1, revision=revision+1
where id='32a00000-0000-4000-8000-000000002003';

select throws_ok(
  format(
    'select app_private.api_fanbus_assignment_apply(%L::jsonb)',
    (select payload::text from m320_r3_stale_payload)
  ),
  '40001',
  'FANBUS_ASSIGNMENT_PREVIEW_STALE',
  'Relevant topology change makes Apply stale before any writes'
);

select * from finish();
rollback;
