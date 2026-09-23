\set ON_ERROR_STOP on

do $assert$
begin
  if (select count(*) from app_modules.fanbus_prediction_participants where prediction_game_id='00000000-0000-4555-9650-000000000001') <> 2 then
    raise exception 'Different-participant parallel writes did not both persist.';
  end if;
  if (select count(*) from app_modules.fanbus_prediction_tips tip join app_modules.fanbus_prediction_participants participant on participant.id=tip.participant_id where participant.prediction_game_id='00000000-0000-4555-9650-000000000001') <> 2 then
    raise exception 'Parallel writes overwrote another participant tips.';
  end if;
  if (select revision from app_modules.fanbus_prediction_participants where fanbus_registration_id='00000000-0000-4555-9640-000000000001') <> 3 then
    raise exception 'Exactly one same-participant update should have won.';
  end if;
end
$assert$;
\echo FANBUS_PREDICTION_CONCURRENCY_ASSERT_OK
