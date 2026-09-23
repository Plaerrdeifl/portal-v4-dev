\set ON_ERROR_STOP on

begin;

insert into auth.users (id, email)
values ('00000000-0000-4555-9600-000000000001', 'prediction-remote-smoke@example.invalid');

insert into app_portal.users (
  id, user_code, email, first_name, last_name, status, role_id
)
select
  '00000000-0000-4555-9600-000000000001', 'U-PREDICTION-SMOKE',
  'prediction-remote-smoke@example.invalid', 'Remote', 'Smoke', 'ACTIVE', role.id
from app_portal.portal_roles as role
where role.code = 'ADMIN';

select set_config('request.jwt.claim.sub', '00000000-0000-4555-9600-000000000001', true);
update app_portal.settings
set value = jsonb_build_object('mode', 'NORMAL', 'environment', 'DEV'),
    revision = revision + 1
where key = 'platform.mode';

insert into app_modules.events (
  id, event_type, title, event_date, event_time, venue, visibility, created_by, updated_by
) values
  ('00000000-0000-4555-9610-000000000001', 'GAME', 'Remote Fahrt-Test', '2036-09-23', '18:00', 'Kassel', 'PUBLIC', auth.uid(), auth.uid()),
  ('00000000-0000-4555-9610-000000000002', 'GAME', 'Remote Manuell-Test', '2036-09-24', '19:30', 'Selb', 'PUBLIC', auth.uid(), auth.uid());
insert into app_modules.event_games (event_id, home_away, opponent_name) values
  ('00000000-0000-4555-9610-000000000001', 'AWAY', 'Kassel'),
  ('00000000-0000-4555-9610-000000000002', 'HOME', 'Hannover');

insert into app_modules.fanbus_trips (
  id, event_id, status, bus_preference_enabled, created_by, updated_by
) values (
  '00000000-0000-4555-9620-000000000001',
  '00000000-0000-4555-9610-000000000001',
  'PUBLISHED', true, auth.uid(), auth.uid()
);
insert into app_modules.fanbus_buses (
  id, trip_id, label, category, capacity, is_active, created_by, updated_by
) values
  ('00000000-0000-4555-9630-000000000001', '00000000-0000-4555-9620-000000000001', 'Bus 1', 'NORMAL', 50, true, auth.uid(), auth.uid()),
  ('00000000-0000-4555-9630-000000000002', '00000000-0000-4555-9620-000000000001', 'Bus 2', 'PARTY', 50, true, auth.uid(), auth.uid());
insert into app_modules.fanbus_bookings (
  id, trip_id, source, created_by, updated_by
) values
  ('00000000-0000-4555-9640-000000000001', '00000000-0000-4555-9620-000000000001', 'MANUAL', auth.uid(), auth.uid()),
  ('00000000-0000-4555-9640-000000000002', '00000000-0000-4555-9620-000000000001', 'MANUAL', auth.uid(), auth.uid()),
  ('00000000-0000-4555-9640-000000000003', '00000000-0000-4555-9620-000000000001', 'MANUAL', auth.uid(), auth.uid());
insert into app_modules.fanbus_registrations (
  id, trip_id, first_name, last_name, email, bus_preference, status,
  privacy_reference, terms_reference, privacy_accepted_at, terms_accepted_at,
  source, booking_id, booking_role, participant_sequence, created_by, updated_by
) values
  ('00000000-0000-4555-9650-000000000001', '00000000-0000-4555-9620-000000000001', 'Max', 'Remote', 'max-remote@example.invalid', 'EGAL', 'ACTIVE', 'smoke', 'smoke', now(), now(), 'MANUAL', '00000000-0000-4555-9640-000000000001', 'PRIMARY', 1, auth.uid(), auth.uid()),
  ('00000000-0000-4555-9650-000000000002', '00000000-0000-4555-9620-000000000001', 'Anna', 'Remote', 'anna-remote@example.invalid', 'PARTY', 'ACTIVE', 'smoke', 'smoke', now(), now(), 'MANUAL', '00000000-0000-4555-9640-000000000002', 'PRIMARY', 1, auth.uid(), auth.uid()),
  ('00000000-0000-4555-9650-000000000003', '00000000-0000-4555-9620-000000000001', 'Chris', 'Remote', 'chris-remote@example.invalid', 'RUHIG', 'ACTIVE', 'smoke', 'smoke', now(), now(), 'MANUAL', '00000000-0000-4555-9640-000000000003', 'PRIMARY', 1, auth.uid(), auth.uid());
insert into app_modules.fanbus_bus_assignments (
  participant_id, trip_id, bus_id, created_by, updated_by
) values
  ('00000000-0000-4555-9650-000000000001', '00000000-0000-4555-9620-000000000001', '00000000-0000-4555-9630-000000000001', auth.uid(), auth.uid()),
  ('00000000-0000-4555-9650-000000000002', '00000000-0000-4555-9620-000000000001', '00000000-0000-4555-9630-000000000002', auth.uid(), auth.uid()),
  ('00000000-0000-4555-9650-000000000003', '00000000-0000-4555-9620-000000000001', '00000000-0000-4555-9630-000000000002', auth.uid(), auth.uid());

do $test$
declare
  v_response jsonb;
  v_trip_game uuid;
  v_manual_game uuid;
  v_max_entry uuid;
begin
  v_response := public.pd_api('fanbus_prediction_game_create', jsonb_build_object(
    'eventId', '00000000-0000-4555-9610-000000000001',
    'tripId', '00000000-0000-4555-9620-000000000001',
    'mode', 'TRIP'
  ));
  if v_response ->> 'ok' <> 'true' then raise exception 'Trip game create failed: %', v_response; end if;
  v_trip_game := (v_response #>> '{data,id}')::uuid;

  v_response := public.pd_api('fanbus_prediction_participants_search', jsonb_build_object('gameId', v_trip_game, 'query', 'Max'));
  if v_response #>> '{data,participants,0,busLabel}' <> 'Bus 1' then raise exception 'Trip search/bus failed: %', v_response; end if;

  v_response := public.pd_api('fanbus_prediction_entry_save', jsonb_build_object(
    'gameId', v_trip_game, 'registrationId', '00000000-0000-4555-9650-000000000001',
    'tips', jsonb_build_array(jsonb_build_object('dogsGoals', 4, 'opponentGoals', 2))
  ));
  if v_response ->> 'ok' <> 'true' then raise exception 'First trip save failed: %', v_response; end if;
  v_max_entry := (v_response #>> '{data,entry,id}')::uuid;

  v_response := public.pd_api('fanbus_prediction_entry_save', jsonb_build_object(
    'gameId', v_trip_game, 'participantId', v_max_entry,
    'registrationId', '00000000-0000-4555-9650-000000000001', 'expectedRevision', 1,
    'tips', jsonb_build_array(
      jsonb_build_object('dogsGoals', 4, 'opponentGoals', 2),
      jsonb_build_object('dogsGoals', 5, 'opponentGoals', 3),
      jsonb_build_object('dogsGoals', 3, 'opponentGoals', 2)
    )
  ));
  if v_response #>> '{data,entry,tipCount}' <> '3' then raise exception 'Trip edit/three tips failed: %', v_response; end if;

  v_response := public.pd_api('fanbus_prediction_entry_save', jsonb_build_object(
    'gameId', v_trip_game, 'participantId', v_max_entry,
    'registrationId', '00000000-0000-4555-9650-000000000001', 'expectedRevision', 1,
    'tips', jsonb_build_array(jsonb_build_object('dogsGoals', 0, 'opponentGoals', 0))
  ));
  if v_response #>> '{error,code}' <> 'PT409' then raise exception 'Stale conflict was not rejected: %', v_response; end if;

  v_response := public.pd_api('fanbus_prediction_entry_save', jsonb_build_object(
    'gameId', v_trip_game, 'registrationId', '00000000-0000-4555-9650-000000000002',
    'tips', jsonb_build_array(jsonb_build_object('dogsGoals', 5, 'opponentGoals', 3))
  ));
  if v_response ->> 'ok' <> 'true' then raise exception 'Second participant save failed: %', v_response; end if;

  update app_modules.fanbus_bus_assignments
  set bus_id = '00000000-0000-4555-9630-000000000002', revision = revision + 1
  where participant_id = '00000000-0000-4555-9650-000000000001';
  if (select bus_label_snapshot from app_modules.fanbus_prediction_participants where id = v_max_entry) <> 'Bus 1' then
    raise exception 'Bus snapshot changed retroactively';
  end if;

  v_response := public.pd_api('fanbus_prediction_status_set', jsonb_build_object('gameId', v_trip_game, 'expectedRevision', 1, 'status', 'CLOSED'));
  if v_response #>> '{data,status}' <> 'CLOSED' then raise exception 'Close failed: %', v_response; end if;
  v_response := public.pd_api('fanbus_prediction_entry_save', jsonb_build_object(
    'gameId', v_trip_game, 'registrationId', '00000000-0000-4555-9650-000000000003',
    'tips', jsonb_build_array(jsonb_build_object('dogsGoals', 1, 'opponentGoals', 1))
  ));
  if v_response #>> '{error,code}' <> '55000' then raise exception 'Closed game accepted entry: %', v_response; end if;
  v_response := public.pd_api('fanbus_prediction_result_set', jsonb_build_object(
    'gameId', v_trip_game, 'expectedRevision', 2, 'dogsGoals', 5, 'opponentGoals', 3
  ));
  if v_response #>> '{data,status}' <> 'EVALUATED' then raise exception 'Trip result failed: %', v_response; end if;
  v_response := public.pd_api('fanbus_prediction_evaluation', jsonb_build_object('gameId', v_trip_game));
  if (v_response #>> '{data,overall,winnerCount}')::integer <> 2
     or jsonb_array_length(v_response #> '{data,buses}') <> 2 then
    raise exception 'Trip evaluation failed: %', v_response;
  end if;

  v_response := public.pd_api('fanbus_prediction_game_create', jsonb_build_object(
    'eventId', '00000000-0000-4555-9610-000000000002', 'mode', 'MANUAL'
  ));
  if v_response ->> 'ok' <> 'true' then raise exception 'Manual game create failed: %', v_response; end if;
  v_manual_game := (v_response #>> '{data,id}')::uuid;
  v_response := public.pd_api('fanbus_prediction_entry_save', jsonb_build_object(
    'gameId', v_manual_game, 'manualName', 'Manuela Remote',
    'tips', jsonb_build_array(
      jsonb_build_object('dogsGoals', 2, 'opponentGoals', 0),
      jsonb_build_object('dogsGoals', 3, 'opponentGoals', 1)
    )
  ));
  if v_response #>> '{data,entry,busLabel}' is not null then raise exception 'Manual entry received a bus: %', v_response; end if;
  v_response := public.pd_api('fanbus_prediction_status_set', jsonb_build_object('gameId', v_manual_game, 'expectedRevision', 1, 'status', 'CLOSED'));
  v_response := public.pd_api('fanbus_prediction_result_set', jsonb_build_object('gameId', v_manual_game, 'expectedRevision', 2, 'dogsGoals', 3, 'opponentGoals', 1));
  v_response := public.pd_api('fanbus_prediction_evaluation', jsonb_build_object('gameId', v_manual_game));
  if (v_response #>> '{data,overall,winnerCount}')::integer <> 1
     or jsonb_array_length(v_response #> '{data,buses}') <> 0 then
    raise exception 'Manual evaluation failed: %', v_response;
  end if;
end;
$test$;

select 'FANBUS_PREDICTION_REMOTE_SMOKE_OK' as result;

rollback;
