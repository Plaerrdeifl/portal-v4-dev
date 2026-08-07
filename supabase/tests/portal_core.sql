\set ON_ERROR_STOP on

begin;

do $verification$
declare
  v_schema text;
  v_table text;
  v_privilege text;
begin
  foreach v_schema in array array['app_private', 'app_portal', 'app_fanclub', 'app_modules']
  loop
    if to_regnamespace(v_schema) is null then
      raise exception 'Schema fehlt: %', v_schema;
    end if;
    if has_schema_privilege('anon', v_schema, 'USAGE')
       or has_schema_privilege('authenticated', v_schema, 'USAGE') then
      raise exception 'Data-API-Rolle besitzt unerlaubtes USAGE auf %', v_schema;
    end if;
  end loop;

  foreach v_table in array array[
    'app_portal.portal_roles',
    'app_portal.capabilities',
    'app_portal.role_capabilities',
    'app_portal.users',
    'app_portal.access_requests',
    'app_portal.user_member_links',
    'app_portal.teams',
    'app_portal.team_memberships',
    'app_fanclub.members',
    'app_fanclub.office_slots',
    'app_modules.tasks',
    'app_modules.task_notes',
    'app_modules.events',
    'app_modules.event_games'
  ]
  loop
    if to_regclass(v_table) is null then
      raise exception 'Tabelle fehlt: %', v_table;
    end if;
    if not (select relrowsecurity from pg_class where oid = to_regclass(v_table)) then
      raise exception 'RLS fehlt auf %', v_table;
    end if;
  end loop;

  foreach v_table in array array[
    'app_modules.events',
    'app_modules.event_games'
  ]
  loop
    foreach v_privilege in array array[
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    ]
    loop
      if has_table_privilege('anon', v_table, v_privilege) then
        raise exception 'anon besitzt unerlaubtes Recht % auf %',
          v_privilege,
          v_table;
      end if;
      if has_table_privilege('authenticated', v_table, v_privilege) then
        raise exception 'authenticated besitzt unerlaubtes Recht % auf %',
          v_privilege,
          v_table;
      end if;
    end loop;
  end loop;

  if (select count(*) from app_portal.portal_roles) <> 3 then
    raise exception 'Initiale Rollenanzahl ist nicht 3.';
  end if;
  if (select count(*) from app_fanclub.office_slots) <> 5 then
    raise exception 'Feste Amtsplatzanzahl ist nicht 5.';
  end if;
  if not exists (
    select 1 from app_portal.role_capabilities
    where role_id = '00000000-0000-4000-8000-000000000001'
      and capability_code = 'portal.admin'
  ) then
    raise exception 'Initiale Adminrolle besitzt portal.admin nicht.';
  end if;
  if not exists (
    select 1
    from app_portal.capabilities
    where code = 'events.manage'
  ) then
    raise exception 'Capability events.manage fehlt.';
  end if;
  if exists (
    select 1
    from app_portal.role_capabilities
    where capability_code = 'events.manage'
  ) then
    raise exception 'events.manage wurde einer Portalrolle automatisch zugewiesen.';
  end if;
  if exists (
    select 1
    from app_fanclub.office_capabilities
    where capability_code = 'events.manage'
  ) then
    raise exception 'events.manage wurde einem Amt automatisch zugewiesen.';
  end if;
  if to_regprocedure('public.pd_api(text,jsonb)') is null then
    raise exception 'Portal-RPC fehlt.';
  end if;
  if to_regprocedure('public.pd_create_bootstrap_token(text,timestamp with time zone)') is null then
    raise exception 'Bootstrap-Service-RPC fehlt.';
  end if;
  if has_function_privilege('anon', 'public.pd_api(text,jsonb)', 'EXECUTE') then
    raise exception 'anon darf pd_api nicht ausführen.';
  end if;
  if not has_function_privilege('authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE') then
    raise exception 'authenticated darf pd_api nicht ausführen.';
  end if;
  if has_function_privilege('authenticated', 'public.pd_create_bootstrap_token(text,timestamp with time zone)', 'EXECUTE') then
    raise exception 'authenticated darf Bootstrap-Service-RPC nicht ausführen.';
  end if;
  if not has_function_privilege('service_role', 'public.pd_create_bootstrap_token(text,timestamp with time zone)', 'EXECUTE') then
    raise exception 'service_role darf Bootstrap-Service-RPC nicht ausführen.';
  end if;
end
$verification$;

do $event_model_verification$
declare
  v_game_event_id uuid;
  v_non_game_event_id uuid;
begin
  begin
    insert into app_modules.events (
      event_type,
      event_date,
      visibility
    )
    values ('INVALID', date '2026-08-07', 'PUBLIC');

    raise exception 'Ungültiger event_type wurde akzeptiert.';
  exception
    when check_violation then null;
  end;

  begin
    insert into app_modules.events (
      event_type,
      event_date,
      visibility
    )
    values ('GAME', date '2026-08-07', 'INVALID');

    raise exception 'Ungültige visibility wurde akzeptiert.';
  exception
    when check_violation then null;
  end;

  begin
    insert into app_modules.events (
      event_type,
      title,
      event_date,
      visibility
    )
    values ('FANCLUB', null, date '2026-08-07', 'INTERNAL');

    raise exception 'FANCLUB ohne Titel wurde akzeptiert.';
  exception
    when check_violation then null;
  end;

  begin
    insert into app_modules.events (
      event_type,
      title,
      event_date,
      visibility
    )
    values ('OTHER', '   ', date '2026-08-07', 'PUBLIC');

    raise exception 'OTHER ohne inhaltlichen Titel wurde akzeptiert.';
  exception
    when check_violation then null;
  end;

  insert into app_modules.events (
    event_type,
    event_date,
    visibility
  )
  values ('GAME', date '2026-08-07', 'PUBLIC')
  returning id into v_game_event_id;

  if (
    select event.revision
    from app_modules.events as event
    where event.id = v_game_event_id
  ) <> 1 then
    raise exception 'Neues Event besitzt nicht revision = 1.';
  end if;

  begin
    insert into app_modules.event_games (
      event_id,
      home_away,
      opponent_name
    )
    values (v_game_event_id, 'INVALID', 'Testgegner');

    raise exception 'Ungültiges home_away wurde akzeptiert.';
  exception
    when check_violation then null;
  end;

  begin
    insert into app_modules.event_games (
      event_id,
      home_away,
      opponent_name
    )
    values (v_game_event_id, 'HOME', '   ');

    raise exception 'Leerer Gegner wurde akzeptiert.';
  exception
    when check_violation then null;
  end;

  insert into app_modules.events (
    event_type,
    title,
    event_date,
    visibility
  )
  values (
    'FANCLUB',
    'Fanclub-Termin',
    date '2026-08-07',
    'INTERNAL'
  )
  returning id into v_non_game_event_id;

  begin
    insert into app_modules.event_games (
      event_id,
      home_away,
      opponent_name
    )
    values (v_non_game_event_id, 'AWAY', 'Testgegner');

    raise exception 'event_games für einen Nicht-GAME-Termin wurde akzeptiert.';
  exception
    when check_violation then null;
  end;

  insert into app_modules.event_games (
    event_id,
    home_away,
    opponent_name
  )
  values (v_game_event_id, 'HOME', 'Testgegner');

  begin
    update app_modules.events
    set
      event_type = 'FANCLUB',
      title = 'Fanclub-Termin'
    where id = v_game_event_id;

    raise exception 'GAME mit event_games wurde in FANCLUB geändert.';
  exception
    when check_violation then null;
  end;

  delete from app_modules.events
  where id = v_game_event_id;

  if exists (
    select 1
    from app_modules.event_games
    where event_id = v_game_event_id
  ) then
    raise exception 'event_games wurde beim Löschen des Events nicht entfernt.';
  end if;

  begin
    insert into app_modules.events (
      event_type,
      event_date,
      end_date,
      visibility
    )
    values (
      'GAME',
      date '2026-08-08',
      date '2026-08-07',
      'PUBLIC'
    );

    raise exception 'Enddatum vor Startdatum wurde akzeptiert.';
  exception
    when check_violation then null;
  end;

  begin
    insert into app_modules.events (
      event_type,
      event_date,
      event_time,
      end_date,
      end_time,
      visibility
    )
    values (
      'GAME',
      date '2026-08-07',
      time '20:00',
      date '2026-08-07',
      time '19:59',
      'PUBLIC'
    );

    raise exception 'Endzeit vor Startzeit am selben Datum wurde akzeptiert.';
  exception
    when check_violation then null;
  end;
end
$event_model_verification$;

select 'PORTAL_CORE_STRUCTURE_OK' as result;
rollback;
