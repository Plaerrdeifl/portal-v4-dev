\set ON_ERROR_STOP on
begin;

do $guard$
declare v_count integer;
begin
  if to_regprocedure('app_private.api_liveticker_spieltage_list()') is null
    or to_regprocedure('app_private.api_liveticker_spieltage_save(jsonb)') is null
    or to_regprocedure('app_private.api_liveticker_spieltage_status(jsonb)') is null
  then
    raise exception 'Die Liveticker-Spieltage-API ist nicht migriert.';
  end if;
  if app_private.platform_action_classification('liveticker_spieltage_list') <> 'READ'
    or app_private.platform_action_classification('liveticker_spieltage_save') <> 'USER_MUTATION'
    or app_private.platform_action_classification('liveticker_spieltage_status') <> 'USER_MUTATION'
  then
    raise exception 'Spieltage-Operationen besitzen falsche Plattformklassifikation.';
  end if;
  if has_function_privilege('authenticated',
    'app_private.api_liveticker_spieltage_save(jsonb)', 'EXECUTE')
    or has_function_privilege('anon',
    'app_private.api_liveticker_spieltage_list()', 'EXECUTE')
  then
    raise exception 'Privataktionen direkt durch Browser ausführbar.';
  end if;
  if exists (select 1 from app_modules.event_games
             where game_status not in ('SCHEDULED','CANCELLED'))
  then
    raise exception 'Ungültiger Spielstatus.';
  end if;
  if exists (
    select 1 from app_modules.event_games g
    left join app_modules.events e on e.id=g.event_id
    where e.id is null
  ) then
    raise exception 'Spiel-UUID-Referenz verloren.';
  end if;
  if position('fanbus_trips' in pg_get_functiondef(
    'app_private.api_liveticker_spieltage_save(jsonb)'::regprocedure
  )) = 0 then
    raise exception 'Schutz für verknüpfte Fanbusfahrten fehlt.';
  end if;
end;
$guard$;

rollback;
