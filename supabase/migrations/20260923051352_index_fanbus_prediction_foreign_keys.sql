-- Cover prediction-game foreign keys used for referential checks and participant lookup.

begin;

create index fanbus_prediction_games_created_by_idx
  on app_modules.fanbus_prediction_games(created_by)
  where created_by is not null;
create index fanbus_prediction_games_updated_by_idx
  on app_modules.fanbus_prediction_games(updated_by)
  where updated_by is not null;

create index fanbus_prediction_participants_registration_lookup_idx
  on app_modules.fanbus_prediction_participants(fanbus_registration_id)
  where fanbus_registration_id is not null;
create index fanbus_prediction_participants_created_by_idx
  on app_modules.fanbus_prediction_participants(created_by)
  where created_by is not null;
create index fanbus_prediction_participants_updated_by_idx
  on app_modules.fanbus_prediction_participants(updated_by)
  where updated_by is not null;

commit;
