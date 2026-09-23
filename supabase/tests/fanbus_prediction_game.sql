\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-4555-9000-000000000001', 'prediction-admin@example.invalid'),
  ('00000000-0000-4555-9000-000000000002', 'prediction-denied@example.invalid');

insert into app_portal.users (
  id, user_code, email, first_name, last_name, status, role_id
)
select
  fixture.id, fixture.user_code, fixture.email, fixture.first_name,
  fixture.last_name, 'ACTIVE', role.id
from (values
  ('00000000-0000-4555-9000-000000000001'::uuid, 'U-PREDICTION-ADMIN', 'prediction-admin@example.invalid', 'Tipp', 'Admin', 'ADMIN'),
  ('00000000-0000-4555-9000-000000000002'::uuid, 'U-PREDICTION-DENIED', 'prediction-denied@example.invalid', 'Tipp', 'Denied', 'PORTAL_USER')
) as fixture(id, user_code, email, first_name, last_name, role_code)
join app_portal.portal_roles as role on role.code = fixture.role_code;

select set_config('request.jwt.claim.sub', '00000000-0000-4555-9000-000000000001', true);
update app_portal.settings
set value = jsonb_build_object('mode', 'NORMAL', 'environment', 'LOCAL'),
    revision = revision + 1
where key = 'platform.mode';

select ok(
  app_private.has_capability(auth.uid(), 'fanbus.manage'),
  'Fixture actor has Bus-Orga access'
);
select is(app_private.platform_action_classification('fanbus_prediction_games_list'), 'READ', 'List is classified as READ');
select is(app_private.platform_action_classification('fanbus_prediction_entry_save'), 'USER_MUTATION', 'Entry save is classified as mutation');
select ok(not has_table_privilege('authenticated', 'app_modules.fanbus_prediction_games', 'SELECT'), 'Prediction games are not directly readable');
select ok(not has_function_privilege('authenticated', 'app_private.api_fanbus_prediction_entry_save(jsonb)', 'EXECUTE'), 'Internal save RPC is not directly executable');
select ok(has_function_privilege('authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE'), 'Browser keeps the central pd_api boundary');

insert into app_modules.events (
  id, event_type, title, event_date, event_time, venue, visibility, created_by, updated_by
) values
  ('00000000-0000-4555-9100-000000000001', 'GAME', 'Auswärtsspiel', '2035-09-23', '18:00', 'Kassel', 'PUBLIC', auth.uid(), auth.uid()),
  ('00000000-0000-4555-9100-000000000002', 'GAME', 'Manuelles Spiel', '2035-09-24', '19:30', 'Selb', 'PUBLIC', auth.uid(), auth.uid());
insert into app_modules.event_games (event_id, home_away, opponent_name) values
  ('00000000-0000-4555-9100-000000000001', 'AWAY', 'Kassel'),
  ('00000000-0000-4555-9100-000000000002', 'HOME', 'Hannover');

insert into app_modules.fanbus_trips (
  id, event_id, status, bus_preference_enabled, created_by, updated_by
) values (
  '00000000-0000-4555-9200-000000000001',
  '00000000-0000-4555-9100-000000000001',
  'PUBLISHED', true, auth.uid(), auth.uid()
);
insert into app_modules.fanbus_buses (
  id, trip_id, label, category, capacity, is_active, created_by, updated_by
) values
  ('00000000-0000-4555-9300-000000000001', '00000000-0000-4555-9200-000000000001', 'Bus 1', 'NORMAL', 50, true, auth.uid(), auth.uid()),
  ('00000000-0000-4555-9300-000000000002', '00000000-0000-4555-9200-000000000001', 'Bus 2', 'PARTY', 50, true, auth.uid(), auth.uid());
insert into app_modules.fanbus_bookings (
  id, trip_id, source, created_by, updated_by
) values
  ('00000000-0000-4555-9400-000000000001', '00000000-0000-4555-9200-000000000001', 'MANUAL', auth.uid(), auth.uid()),
  ('00000000-0000-4555-9400-000000000002', '00000000-0000-4555-9200-000000000001', 'MANUAL', auth.uid(), auth.uid()),
  ('00000000-0000-4555-9400-000000000003', '00000000-0000-4555-9200-000000000001', 'MANUAL', auth.uid(), auth.uid());
insert into app_modules.fanbus_registrations (
  id, trip_id, first_name, last_name, email, bus_preference, status,
  privacy_reference, terms_reference, privacy_accepted_at, terms_accepted_at,
  source, booking_id, booking_role, participant_sequence, created_by, updated_by
) values
  ('00000000-0000-4555-9500-000000000001', '00000000-0000-4555-9200-000000000001', 'Max', 'Mustermann', 'max@example.invalid', 'EGAL', 'ACTIVE', 'test', 'test', now(), now(), 'MANUAL', '00000000-0000-4555-9400-000000000001', 'PRIMARY', 1, auth.uid(), auth.uid()),
  ('00000000-0000-4555-9500-000000000002', '00000000-0000-4555-9200-000000000001', 'Anna', 'Beispiel', 'anna@example.invalid', 'PARTY', 'ACTIVE', 'test', 'test', now(), now(), 'MANUAL', '00000000-0000-4555-9400-000000000002', 'PRIMARY', 1, auth.uid(), auth.uid()),
  ('00000000-0000-4555-9500-000000000003', '00000000-0000-4555-9200-000000000001', 'Chris', 'Parallel', 'chris@example.invalid', 'RUHIG', 'ACTIVE', 'test', 'test', now(), now(), 'MANUAL', '00000000-0000-4555-9400-000000000003', 'PRIMARY', 1, auth.uid(), auth.uid());
insert into app_modules.fanbus_bus_assignments (
  participant_id, trip_id, bus_id, created_by, updated_by
) values
  ('00000000-0000-4555-9500-000000000001', '00000000-0000-4555-9200-000000000001', '00000000-0000-4555-9300-000000000001', auth.uid(), auth.uid()),
  ('00000000-0000-4555-9500-000000000002', '00000000-0000-4555-9200-000000000001', '00000000-0000-4555-9300-000000000002', auth.uid(), auth.uid()),
  ('00000000-0000-4555-9500-000000000003', '00000000-0000-4555-9200-000000000001', '00000000-0000-4555-9300-000000000002', auth.uid(), auth.uid());

select is(
  (app_private.api_fanbus_prediction_options() #>> '{games,0,displayTitle}')::text,
  'Mighty Dogs – Hannover',
  'Dogs are displayed first for calendar options'
);

select lives_ok(
  $$select app_private.api_fanbus_prediction_game_create('{"eventId":"00000000-0000-4555-9100-000000000001","tripId":"00000000-0000-4555-9200-000000000001","mode":"TRIP"}'::jsonb)$$,
  'Trip prediction game can be created from an existing calendar game and matching trip'
);
select lives_ok(
  $$select app_private.api_fanbus_prediction_game_create('{"eventId":"00000000-0000-4555-9100-000000000002","mode":"MANUAL"}'::jsonb)$$,
  'Manual prediction game can be created without a trip'
);

select is((select mode from app_modules.fanbus_prediction_games where event_id = '00000000-0000-4555-9100-000000000001'), 'TRIP', 'Trip mode is persisted');
select is((select mode from app_modules.fanbus_prediction_games where event_id = '00000000-0000-4555-9100-000000000002'), 'MANUAL', 'Manual mode is persisted');
select is(
  (app_private.api_fanbus_prediction_participants_search(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id = '00000000-0000-4555-9100-000000000001'),
    'query', 'Max'
  )) #>> '{participants,0,busLabel}')::text,
  'Bus 1',
  'Actual rider and current bus assignment are returned for search'
);

select lives_ok(
  $$select app_private.api_fanbus_prediction_entry_save(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'registrationId', '00000000-0000-4555-9500-000000000001',
    'tips', '[{"dogsGoals":4,"opponentGoals":2}]'::jsonb
  ))$$,
  'One tip can be saved'
);
select is(
  (select count(*)::integer from app_modules.fanbus_prediction_tips where participant_id = (
    select id from app_modules.fanbus_prediction_participants where fanbus_registration_id='00000000-0000-4555-9500-000000000001'
  )), 1, 'Exactly one tip is stored'
);
select is(
  (select bus_label_snapshot from app_modules.fanbus_prediction_participants where fanbus_registration_id='00000000-0000-4555-9500-000000000001'),
  'Bus 1', 'Bus assignment is snapshotted on first save'
);

select lives_ok(
  $$select app_private.api_fanbus_prediction_entry_save(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'participantId', (select id from app_modules.fanbus_prediction_participants where fanbus_registration_id='00000000-0000-4555-9500-000000000001'),
    'registrationId', '00000000-0000-4555-9500-000000000001',
    'expectedRevision', 1,
    'tips', '[{"dogsGoals":4,"opponentGoals":2},{"dogsGoals":5,"opponentGoals":3}]'::jsonb
  ))$$,
  'A second tip can be added and the first corrected transactionally'
);
select lives_ok(
  $$select app_private.api_fanbus_prediction_entry_save(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'participantId', (select id from app_modules.fanbus_prediction_participants where fanbus_registration_id='00000000-0000-4555-9500-000000000001'),
    'registrationId', '00000000-0000-4555-9500-000000000001',
    'expectedRevision', 2,
    'tips', '[{"dogsGoals":4,"opponentGoals":2},{"dogsGoals":5,"opponentGoals":3},{"dogsGoals":3,"opponentGoals":2}]'::jsonb
  ))$$,
  'A third tip can be added'
);
select is(
  (select count(*)::integer from app_modules.fanbus_prediction_tips where participant_id = (
    select id from app_modules.fanbus_prediction_participants where fanbus_registration_id='00000000-0000-4555-9500-000000000001'
  )), 3, 'Maximum of three tips is represented as three granular rows'
);

select throws_ok(
  $$select app_private.api_fanbus_prediction_entry_save(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'registrationId', '00000000-0000-4555-9500-000000000002',
    'tips', '[{"dogsGoals":1,"opponentGoals":0},{"dogsGoals":2,"opponentGoals":0},{"dogsGoals":3,"opponentGoals":0},{"dogsGoals":4,"opponentGoals":0}]'::jsonb
  ))$$,
  '22023',
  'Mindestens ein und höchstens drei Tipps sind erforderlich.',
  'More than three tips are rejected server-side'
);
select throws_ok(
  $$select app_private.api_fanbus_prediction_entry_save(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'registrationId', '00000000-0000-4555-9500-000000000002',
    'tips', '[{"dogsGoals":2,"opponentGoals":1},{"dogsGoals":2,"opponentGoals":1}]'::jsonb
  ))$$,
  '23505',
  'Identische Tipps sind für eine Person nicht zulässig.',
  'Duplicate tips for one person are rejected'
);
select throws_ok(
  $$select app_private.api_fanbus_prediction_entry_save(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'participantId', (select id from app_modules.fanbus_prediction_participants where fanbus_registration_id='00000000-0000-4555-9500-000000000001'),
    'registrationId', '00000000-0000-4555-9500-000000000001',
    'expectedRevision', 1,
    'tips', '[{"dogsGoals":0,"opponentGoals":0}]'::jsonb
  ))$$,
  'PT409',
  'Die Tipps wurden zwischenzeitlich geändert. Bitte Person neu öffnen.',
  'A stale same-person save is rejected instead of overwriting newer tips'
);

select lives_ok(
  $$select app_private.api_fanbus_prediction_entry_save(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'registrationId', '00000000-0000-4555-9500-000000000002',
    'tips', '[{"dogsGoals":5,"opponentGoals":3}]'::jsonb
  ))$$,
  'A different participant can be saved independently'
);
update app_modules.fanbus_bus_assignments
set bus_id='00000000-0000-4555-9300-000000000002', revision=revision+1
where participant_id='00000000-0000-4555-9500-000000000001';
select is(
  (select bus_label_snapshot from app_modules.fanbus_prediction_participants where fanbus_registration_id='00000000-0000-4555-9500-000000000001'),
  'Bus 1',
  'Later Fanbus reassignment does not rewrite the prediction snapshot'
);

select lives_ok(
  $$select app_private.api_fanbus_prediction_entry_save(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000002'),
    'manualName', 'Manuela Muster',
    'tips', '[{"dogsGoals":2,"opponentGoals":0},{"dogsGoals":3,"opponentGoals":1}]'::jsonb
  ))$$,
  'Manual participant and tips can be saved without bus data'
);
select ok(
  (select bus_label_snapshot is null from app_modules.fanbus_prediction_participants where manual_name='Manuela Muster'),
  'Manual entry has no artificial bus grouping'
);

insert into app_modules.liveticker_game_states (event_id, revision, minute, completed_at)
values ('00000000-0000-4555-9100-000000000001', 2, 60, now());
insert into app_modules.liveticker_actions (event_id, client_action_id, action_type, payload)
values
  ('00000000-0000-4555-9100-000000000001', 'goal-1', 'goal', '{"team":"mighty","minute":5}'::jsonb),
  ('00000000-0000-4555-9100-000000000001', 'goal-2', 'goal', '{"team":"mighty","minute":10}'::jsonb),
  ('00000000-0000-4555-9100-000000000001', 'goal-3', 'goal', '{"team":"mighty","minute":20}'::jsonb),
  ('00000000-0000-4555-9100-000000000001', 'goal-4', 'goal', '{"team":"mighty","minute":30}'::jsonb),
  ('00000000-0000-4555-9100-000000000001', 'goal-5', 'goal', '{"team":"mighty","minute":40}'::jsonb),
  ('00000000-0000-4555-9100-000000000001', 'opp-1', 'goal', '{"team":"opponent","minute":8}'::jsonb),
  ('00000000-0000-4555-9100-000000000001', 'opp-2', 'goal', '{"team":"opponent","minute":18}'::jsonb),
  ('00000000-0000-4555-9100-000000000001', 'opp-3', 'goal', '{"team":"opponent","minute":28}'::jsonb);
select is(
  (app_private.fanbus_prediction_game_json((select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001')) #>> '{suggestedResult,dogsGoals}')::integer,
  5,
  'Completed Liveticker result is offered as reliable Dogs-first suggestion'
);

select lives_ok(
  $$select app_private.api_fanbus_prediction_status_set(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'expectedRevision', 1,
    'status', 'CLOSED'
  ))$$,
  'Open prediction game can be closed'
);
select throws_ok(
  $$select app_private.api_fanbus_prediction_entry_save(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'registrationId', '00000000-0000-4555-9500-000000000003',
    'tips', '[{"dogsGoals":1,"opponentGoals":1}]'::jsonb
  ))$$,
  '55000',
  'Das Tippspiel ist geschlossen. Bitte zuerst wieder öffnen.',
  'Closed game blocks normal tip entry server-side'
);
select lives_ok(
  $$select app_private.api_fanbus_prediction_status_set(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'expectedRevision', 2,
    'status', 'OPEN'
  ))$$,
  'Closed prediction game can be reopened by Bus-Orga'
);
select lives_ok(
  $$select app_private.api_fanbus_prediction_status_set(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'expectedRevision', 3,
    'status', 'CLOSED'
  ))$$,
  'Reopened game can be closed again'
);
select lives_ok(
  $$select app_private.api_fanbus_prediction_result_set(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'),
    'expectedRevision', 4,
    'dogsGoals', 5,
    'opponentGoals', 3
  ))$$,
  'End result can be set on a closed game'
);
select is(
  (app_private.api_fanbus_prediction_evaluation(jsonb_build_object('gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'))) #>> '{overall,winnerCount}')::integer,
  2,
  'Every participant with at least one exact tip wins and is counted once'
);
select is(
  jsonb_array_length(app_private.api_fanbus_prediction_evaluation(jsonb_build_object('gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000001'))) -> 'buses'),
  2,
  'Trip evaluation is grouped by snapshotted buses'
);

select lives_ok(
  $$select app_private.api_fanbus_prediction_status_set(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000002'),
    'expectedRevision', 1,
    'status', 'CLOSED'
  ))$$,
  'Manual game can be closed'
);
select lives_ok(
  $$select app_private.api_fanbus_prediction_result_set(jsonb_build_object(
    'gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000002'),
    'expectedRevision', 2,
    'dogsGoals', 3,
    'opponentGoals', 1
  ))$$,
  'Manual game can be evaluated'
);
select is(
  jsonb_array_length(app_private.api_fanbus_prediction_evaluation(jsonb_build_object('gameId', (select id from app_modules.fanbus_prediction_games where event_id='00000000-0000-4555-9100-000000000002'))) -> 'buses'),
  0,
  'Manual evaluation contains no bus evaluation'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4555-9000-000000000002', true);
select is(
  public.pd_api('fanbus_prediction_games_list', '{}'::jsonb) #>> '{error,code}',
  '42501',
  'User without Bus-Orga access is denied at the database API boundary'
);

select * from finish();
rollback;
