\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into app_modules.events (
  id, event_type, title, event_date, event_time, venue, visibility
) values (
  '00000000-0000-4555-9700-000000000001',
  'GAME',
  'Generator Torschützen Fixture',
  '2036-01-01',
  '18:00',
  'Eisstadion',
  'PUBLIC'
);

insert into app_modules.liveticker_actions (
  event_id, client_action_id, action_type, payload, is_active
) values
  (
    '00000000-0000-4555-9700-000000000001', 'goal-p1', 'goal',
    '{"id":"goal-p1","type":"goal","team":"mighty","minute":5,"player":{"id":"00000000-0000-4555-9701-000000000001","name":"Erstes Tor","number":"10","position":"Sturm"}}'::jsonb,
    true
  ),
  (
    '00000000-0000-4555-9700-000000000001', 'goal-opponent', 'goal',
    '{"id":"goal-opponent","type":"goal","team":"opponent","minute":7,"player":{"name":"Gegner"}}'::jsonb,
    true
  ),
  (
    '00000000-0000-4555-9700-000000000001', 'goal-corrected', 'goal',
    '{"id":"goal-corrected","type":"goal","team":"mighty","minute":9,"player":{"name":"Vor Korrektur","number":"11"}}'::jsonb,
    true
  ),
  (
    '00000000-0000-4555-9700-000000000001', 'goal-p2', 'goal',
    '{"id":"goal-p2","type":"goal","team":"mighty","minute":25,"player":{"name":"Zweites Drittel","number":"12"}}'::jsonb,
    true
  ),
  (
    '00000000-0000-4555-9700-000000000001', 'penalty-scored', 'penalty',
    '{"id":"penalty-scored","type":"penalty","subtype":"penalty_shot","team":"mighty","minute":35,"result":"scored","player":{"name":"Penalty Tor","number":"13"}}'::jsonb,
    true
  ),
  (
    '00000000-0000-4555-9700-000000000001', 'penalty-missed', 'penalty',
    '{"id":"penalty-missed","type":"penalty","subtype":"penalty_shot","team":"mighty","minute":10,"result":"missed","player":{"name":"Penalty Vergeben"}}'::jsonb,
    true
  ),
  (
    '00000000-0000-4555-9700-000000000001', 'shootout-scored', 'shootout',
    '{"id":"shootout-scored","type":"shootout","team":"mighty","result":"scored","player":{"name":"Shootout"}}'::jsonb,
    true
  ),
  (
    '00000000-0000-4555-9700-000000000001', 'goal-ot', 'goal',
    '{"id":"goal-ot","type":"goal","team":"mighty","minute":64,"player":{"name":"Overtime Tor","number":"14"}}'::jsonb,
    true
  ),
  (
    '00000000-0000-4555-9700-000000000001', 'goal-deleted', 'goal',
    '{"id":"goal-deleted","type":"goal","team":"mighty","minute":2,"player":{"name":"Gelöscht"}}'::jsonb,
    false
  );

update app_modules.liveticker_actions
set payload = '{"id":"goal-corrected","type":"goal","team":"mighty","minute":11,"player":{"name":"Nach Korrektur","number":"11"}}'::jsonb,
    revision = revision + 1
where event_id = '00000000-0000-4555-9700-000000000001'
  and client_action_id = 'goal-corrected';

select is(
  pg_catalog.jsonb_array_length(
    app_private.social_media_liveticker_goal_scorers_snapshot(
      '00000000-0000-4555-9700-000000000001', 'PERIOD_1'
    )
  ),
  2,
  'Period 1 contains only active current Dogs goals through minute 20'
);

select is(
  app_private.social_media_liveticker_goal_scorers_snapshot(
    '00000000-0000-4555-9700-000000000001', 'PERIOD_1'
  ) #>> '{1,player,name}',
  'Nach Korrektur',
  'Corrected scorer data replaces the previous action payload'
);

select is(
  pg_catalog.jsonb_array_length(
    app_private.social_media_liveticker_goal_scorers_snapshot(
      '00000000-0000-4555-9700-000000000001', 'PERIOD_2'
    )
  ),
  4,
  'Period 2 contains cumulative Dogs goals from periods 1 and 2'
);

select is(
  app_private.social_media_liveticker_goal_scorers_snapshot(
    '00000000-0000-4555-9700-000000000001', 'PERIOD_2'
  ) #>> '{3,kind}',
  'PENALTY_SHOT',
  'A converted penalty shot is included with explicit semantics'
);

select is(
  pg_catalog.jsonb_array_length(
    app_private.social_media_liveticker_goal_scorers_snapshot(
      '00000000-0000-4555-9700-000000000001', 'FINAL'
    )
  ),
  5,
  'Final contains all active current Dogs goals including overtime'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.social_media_liveticker_goal_scorers_snapshot(uuid,text)',
    'EXECUTE'
  ),
  'Browser roles cannot call the private scorer snapshot helper directly'
);

select * from finish();
rollback;
