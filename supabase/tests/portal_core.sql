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
  if (select count(*)
      from app_fanclub.office_capabilities
      where capability_code = 'events.manage'
        and office_code in (
          'VORSTAND_1',
          'VORSTAND_2',
          'VORSTAND_3',
          'KASSIER',
          'SCHRIFTFUEHRER'
        )) <> 5 then
    raise exception 'events.manage fehlt bei mindestens einem der fuenf Aemter.';
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

do $event_api_verification$
declare
  v_reader_id uuid := '00000000-0000-4210-8000-000000000101';
  v_admin_id uuid := '00000000-0000-4210-8000-000000000102';
  v_list_fanclub_id uuid := '00000000-0000-4210-8000-000000000201';
  v_list_home_id uuid := '00000000-0000-4210-8000-000000000202';
  v_list_away_id uuid := '00000000-0000-4210-8000-000000000203';
  v_list_other_id uuid := '00000000-0000-4210-8000-000000000204';
  v_list_past_id uuid := '00000000-0000-4210-8000-000000000205';
  v_created_fanclub_id uuid;
  v_created_other_id uuid;
  v_created_game_id uuid;
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_response jsonb;
  v_events jsonb;
  v_event_count bigint;
  v_function text;
begin
  foreach v_function in array array[
    'app_private.api_events_list()',
    'app_private.api_event_create(jsonb)',
    'app_private.api_event_update(jsonb)',
    'app_private.api_event_delete(jsonb)'
  ]
  loop
    if to_regprocedure(v_function) is null then
      raise exception 'Interne M210-API-Funktion fehlt: %', v_function;
    end if;
    if has_function_privilege('anon', v_function, 'EXECUTE')
       or has_function_privilege('authenticated', v_function, 'EXECUTE') then
      raise exception 'Browserrolle darf interne M210-Funktion ausführen: %',
        v_function;
    end if;
  end loop;

  if has_function_privilege(
    'anon',
    'public.pd_api_before_events_r1(text,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.pd_api_before_events_r1(text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Browserrolle darf den internen Vorgänger-Dispatcher ausführen.';
  end if;

  delete from app_modules.events;

  insert into auth.users (id, email)
  values
    (v_reader_id, 'm210-reader@example.invalid'),
    (v_admin_id, 'm210-admin@example.invalid');

  insert into app_portal.users (
    id,
    user_code,
    email,
    first_name,
    last_name,
    role_id
  )
  values
    (
      v_reader_id,
      'U-M210-READER',
      'm210-reader@example.invalid',
      'M210',
      'Reader',
      '00000000-0000-4000-8000-000000000002'
    ),
    (
      v_admin_id,
      'U-M210-ADMIN',
      'm210-admin@example.invalid',
      'M210',
      'Admin',
      '00000000-0000-4000-8000-000000000001'
    );

  insert into app_modules.events (
    id,
    event_type,
    title,
    event_date,
    event_time,
    visibility,
    created_by,
    updated_by
  )
  values
    (
      v_list_fanclub_id,
      'FANCLUB',
      'Lesetest Fanclub',
      v_today,
      null,
      'INTERNAL',
      v_admin_id,
      v_admin_id
    ),
    (
      v_list_home_id,
      'GAME',
      null,
      v_today,
      time '18:00',
      'PUBLIC',
      v_admin_id,
      v_admin_id
    ),
    (
      v_list_away_id,
      'GAME',
      null,
      v_today,
      time '20:00',
      'INTERNAL',
      v_admin_id,
      v_admin_id
    ),
    (
      v_list_other_id,
      'OTHER',
      'Lesetest Sonstiges',
      v_today + 1,
      null,
      'PUBLIC',
      v_admin_id,
      v_admin_id
    ),
    (
      v_list_past_id,
      'OTHER',
      'Vergangener Termin',
      v_today - 1,
      null,
      'PUBLIC',
      v_admin_id,
      v_admin_id
    );

  insert into app_modules.event_games (
    event_id,
    home_away,
    opponent_name
  )
  values
    (v_list_home_id, 'HOME', 'Heimgegner'),
    (v_list_away_id, 'AWAY', 'Auswärtsgegner');

  perform set_config('request.jwt.claim.sub', v_reader_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_reader_id,
      'role', 'authenticated'
    )::text,
    true
  );

  v_response := public.pd_api('events_list', '{}'::jsonb);

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Aktiver Portalbenutzer kann die Terminliste nicht abrufen: %',
      v_response;
  end if;

  v_events := v_response #> '{data,events}';

  if jsonb_array_length(v_events) <> 4 then
    raise exception 'Terminliste enthält nicht exakt die erwarteten Termine: %',
      v_events;
  end if;

  if v_events -> 0 ->> 'id' <> v_list_fanclub_id::text
     or v_events -> 1 ->> 'id' <> v_list_home_id::text
     or v_events -> 2 ->> 'id' <> v_list_away_id::text
     or v_events -> 3 ->> 'id' <> v_list_other_id::text then
    raise exception 'Terminliste ist nicht chronologisch und deterministisch sortiert: %',
      v_events;
  end if;

  if v_events -> 0 ->> 'displayTitle' <> 'Lesetest Fanclub'
     or v_events -> 3 ->> 'displayTitle' <> 'Lesetest Sonstiges' then
    raise exception 'Nicht-Spieltermine verwenden nicht ihren gespeicherten Titel.';
  end if;

  if v_events -> 1 ->> 'displayTitle'
       <> 'Mighty Dogs Schweinfurt – Heimgegner' then
    raise exception 'HOME-displayTitle ist ungültig.';
  end if;

  if v_events -> 2 ->> 'displayTitle'
       <> 'Auswärtsgegner – Mighty Dogs Schweinfurt' then
    raise exception 'AWAY-displayTitle ist ungültig.';
  end if;

  if v_events -> 1 ->> 'visibility' <> 'PUBLIC'
     or v_events -> 2 ->> 'visibility' <> 'INTERNAL' then
    raise exception 'PUBLIC und INTERNAL sind nicht gemeinsam sichtbar.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_events) as item(value)
    where coalesce((item.value ->> 'canManage')::boolean, false)
  ) then
    raise exception 'Benutzer ohne events.manage erhält canManage=true.';
  end if;

  select count(*) into v_event_count
  from app_modules.events;

  v_response := public.pd_api(
    'event_create',
    jsonb_build_object(
      'eventType', 'OTHER',
      'title', 'Nicht erlaubt',
      'eventDate', v_today::text,
      'visibility', 'PUBLIC'
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or coalesce(v_response #>> '{error,code}', '') <> '42501'
     or (select count(*) from app_modules.events) <> v_event_count then
    raise exception 'Benutzer ohne events.manage durfte einen Termin erstellen.';
  end if;

  v_response := public.pd_api(
    'event_update',
    jsonb_build_object(
      'id', v_list_home_id,
      'expectedRevision', 1,
      'eventType', 'GAME',
      'eventDate', v_today::text,
      'eventTime', '18:30',
      'visibility', 'PUBLIC',
      'homeAway', 'HOME',
      'opponentName', 'Geänderter Gegner'
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or coalesce(v_response #>> '{error,code}', '') <> '42501'
     or exists (
       select 1
       from app_modules.events as event
       where event.id = v_list_home_id
         and event.revision <> 1
     ) then
    raise exception 'Benutzer ohne events.manage durfte einen Termin ändern.';
  end if;

  v_response := public.pd_api(
    'event_delete',
    jsonb_build_object(
      'id', v_list_home_id,
      'expectedRevision', 1
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or coalesce(v_response #>> '{error,code}', '') <> '42501'
     or not exists (
       select 1
       from app_modules.events
       where id = v_list_home_id
     ) then
    raise exception 'Benutzer ohne events.manage durfte einen Termin löschen.';
  end if;

  if not app_private.has_capability(v_admin_id, 'events.manage') then
    raise exception 'portal.admin-Override für events.manage ist nicht wirksam.';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_admin_id,
      'role', 'authenticated'
    )::text,
    true
  );

  v_response := public.pd_api('events_list', '{}'::jsonb);
  v_events := v_response #> '{data,events}';

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or exists (
       select 1
       from jsonb_array_elements(v_events) as item(value)
       where not coalesce((item.value ->> 'canManage')::boolean, false)
     ) then
    raise exception 'portal.admin erhält in der Terminliste nicht canManage=true.';
  end if;

  v_response := public.pd_api(
    'event_create',
    jsonb_build_object(
      'eventType', 'FANCLUB',
      'title', 'API Fanclub',
      'eventDate', (v_today + 2)::text,
      'eventTime', '19:00',
      'venue', 'Clubheim',
      'description', 'Fanclub-Testtermin',
      'visibility', 'INTERNAL'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'FANCLUB-Create ist fehlgeschlagen: %', v_response;
  end if;

  select event.id
  into v_created_fanclub_id
  from app_modules.events as event
  where event.title = 'API Fanclub'
    and event.created_by = v_admin_id;

  if v_created_fanclub_id is null
     or not exists (
       select 1
       from app_modules.events as event
       where event.id = v_created_fanclub_id
         and event.event_type = 'FANCLUB'
         and event.revision = 1
         and event.created_by = v_admin_id
         and event.updated_by = v_admin_id
     )
     or exists (
       select 1
       from app_modules.event_games
       where event_id = v_created_fanclub_id
     ) then
    raise exception 'FANCLUB wurde nicht korrekt erstellt.';
  end if;

  v_response := public.pd_api(
    'event_create',
    jsonb_build_object(
      'eventType', 'OTHER',
      'title', 'API Sonstiges',
      'eventDate', (v_today + 3)::text,
      'visibility', 'PUBLIC'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'OTHER-Create ist fehlgeschlagen: %', v_response;
  end if;

  select event.id
  into v_created_other_id
  from app_modules.events as event
  where event.title = 'API Sonstiges'
    and event.created_by = v_admin_id;

  if v_created_other_id is null
     or not exists (
       select 1
       from app_modules.events as event
       where event.id = v_created_other_id
         and event.event_type = 'OTHER'
         and event.revision = 1
     )
     or exists (
       select 1
       from app_modules.event_games
       where event_id = v_created_other_id
     ) then
    raise exception 'OTHER wurde nicht korrekt erstellt.';
  end if;

  v_response := public.pd_api(
    'event_create',
    jsonb_build_object(
      'eventType', 'GAME',
      'title', 'Darf nicht gespeichert werden',
      'eventDate', (v_today + 4)::text,
      'eventTime', '20:00',
      'venue', 'Stadion',
      'visibility', 'PUBLIC',
      'homeAway', 'HOME',
      'opponentName', 'API Gegner'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'GAME-Create ist fehlgeschlagen: %', v_response;
  end if;

  select game.event_id
  into v_created_game_id
  from app_modules.event_games as game
  where game.opponent_name = 'API Gegner';

  if v_created_game_id is null
     or not exists (
       select 1
       from app_modules.events as event
       where event.id = v_created_game_id
         and event.event_type = 'GAME'
         and event.title is null
         and event.revision = 1
         and event.created_by = v_admin_id
         and event.updated_by = v_admin_id
     )
     or (
       select count(*)
       from app_modules.event_games
       where event_id = v_created_game_id
     ) <> 1 then
    raise exception 'GAME wurde nicht atomar und korrekt erstellt.';
  end if;

  if not exists (
    select 1
    from app_portal.audit_events as audit
    where audit.action = 'EVENT_CREATED'
      and audit.entity_type = 'event'
      and audit.entity_id = v_created_game_id::text
      and audit.actor_user_id = v_admin_id
      and audit.after_data is not null
  ) then
    raise exception 'Create-Audit für GAME fehlt.';
  end if;

  v_response := public.pd_api(
    'event_update',
    jsonb_build_object(
      'id', v_created_other_id,
      'expectedRevision', 1,
      'eventType', 'OTHER',
      'title', 'API Sonstiges geändert',
      'eventDate', (v_today + 3)::text,
      'eventTime', '10:00',
      'visibility', 'INTERNAL'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not exists (
       select 1
       from app_modules.events as event
       where event.id = v_created_other_id
         and event.title = 'API Sonstiges geändert'
         and event.revision = 2
         and event.updated_by = v_admin_id
     ) then
    raise exception 'Gültiges Update erhöht die Revision nicht exakt um 1.';
  end if;

  v_response := public.pd_api(
    'event_update',
    jsonb_build_object(
      'id', v_created_other_id,
      'expectedRevision', 1,
      'eventType', 'OTHER',
      'title', 'Veraltete Änderung',
      'eventDate', (v_today + 3)::text,
      'visibility', 'PUBLIC'
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or coalesce(v_response #>> '{error,code}', '') <> '40001'
     or not exists (
       select 1
       from app_modules.events as event
       where event.id = v_created_other_id
         and event.title = 'API Sonstiges geändert'
         and event.revision = 2
     ) then
    raise exception 'Update mit falscher expectedRevision wurde nicht abgelehnt.';
  end if;

  v_response := public.pd_api(
    'event_update',
    jsonb_build_object(
      'id', v_created_game_id,
      'expectedRevision', 1,
      'eventType', 'FANCLUB',
      'title', 'Spiel wurde Fanclubtermin',
      'eventDate', (v_today + 4)::text,
      'visibility', 'INTERNAL'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not exists (
       select 1
       from app_modules.events as event
       where event.id = v_created_game_id
         and event.event_type = 'FANCLUB'
         and event.title = 'Spiel wurde Fanclubtermin'
         and event.revision = 2
     )
     or exists (
       select 1
       from app_modules.event_games
       where event_id = v_created_game_id
     ) then
    raise exception 'GAME zu FANCLUB wurde nicht atomar umgesetzt.';
  end if;

  v_response := public.pd_api(
    'event_update',
    jsonb_build_object(
      'id', v_created_fanclub_id,
      'expectedRevision', 1,
      'eventType', 'GAME',
      'title', 'Darf nicht gespeichert werden',
      'eventDate', (v_today + 2)::text,
      'eventTime', '19:30',
      'visibility', 'PUBLIC',
      'homeAway', 'AWAY',
      'opponentName', 'Wechselgegner'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not exists (
       select 1
       from app_modules.events as event
       join app_modules.event_games as game
         on game.event_id = event.id
       where event.id = v_created_fanclub_id
         and event.event_type = 'GAME'
         and event.title is null
         and event.revision = 2
         and game.home_away = 'AWAY'
         and game.opponent_name = 'Wechselgegner'
     ) then
    raise exception 'FANCLUB zu GAME wurde nicht atomar umgesetzt.';
  end if;

  if exists (
    select 1
    from app_modules.event_games as game
    join app_modules.events as event
      on event.id = game.event_id
    where event.event_type <> 'GAME'
  ) or exists (
    select 1
    from app_modules.events as event
    left join app_modules.event_games as game
      on game.event_id = event.id
    where event.event_type = 'GAME'
      and game.event_id is null
  ) then
    raise exception 'Typwechsel hinterließ widersprüchliche Game-Daten.';
  end if;

  if not exists (
    select 1
    from app_portal.audit_events as audit
    where audit.action = 'EVENT_UPDATED'
      and audit.entity_id = v_created_fanclub_id::text
      and audit.actor_user_id = v_admin_id
      and audit.before_data is not null
      and audit.after_data is not null
  ) then
    raise exception 'Update-Audit fehlt.';
  end if;

  v_response := public.pd_api(
    'event_delete',
    jsonb_build_object(
      'id', v_created_fanclub_id,
      'expectedRevision', 1
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or coalesce(v_response #>> '{error,code}', '') <> '40001'
     or not exists (
       select 1
       from app_modules.events
       where id = v_created_fanclub_id
     )
     or not exists (
       select 1
       from app_modules.event_games
       where event_id = v_created_fanclub_id
     ) then
    raise exception 'Delete mit falscher expectedRevision wurde nicht abgelehnt.';
  end if;

  v_response := public.pd_api(
    'event_delete',
    jsonb_build_object(
      'id', v_created_fanclub_id,
      'expectedRevision', 2
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or exists (
       select 1
       from app_modules.events
       where id = v_created_fanclub_id
     )
     or exists (
       select 1
       from app_modules.event_games
       where event_id = v_created_fanclub_id
     ) then
    raise exception 'Delete mit korrekter Revision oder Cascade ist fehlgeschlagen.';
  end if;

  if not exists (
    select 1
    from app_portal.audit_events as audit
    where audit.action = 'EVENT_DELETED'
      and audit.entity_type = 'event'
      and audit.entity_id = v_created_fanclub_id::text
      and audit.actor_user_id = v_admin_id
      and audit.before_data ->> 'event_type' = 'GAME'
      and audit.before_data ->> 'opponentName' = 'Wechselgegner'
      and audit.after_data is null
  ) then
    raise exception 'Delete-Audit mit gesichertem Vorzustand fehlt.';
  end if;
end
$event_api_verification$;

do $public_event_api_verification$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_result jsonb;
  v_events jsonb;
  v_event jsonb;
  v_keys text[];
  v_allowed_keys text[] := array[
    'description',
    'displayTitle',
    'endDate',
    'endTime',
    'eventDate',
    'eventTime',
    'eventType',
    'homeAway',
    'venue'
  ];
  v_table text;
  v_privilege text;
begin
  if to_regprocedure('public.pd_public_events()') is null then
    raise exception 'Öffentliche D-011-Terminfunktion fehlt.';
  end if;

  if not (
    select proc.prosecdef
    from pg_proc as proc
    where proc.oid = to_regprocedure('public.pd_public_events()')
  ) then
    raise exception 'pd_public_events ist nicht SECURITY DEFINER.';
  end if;

  if (
    select proc.provolatile
    from pg_proc as proc
    where proc.oid = to_regprocedure('public.pd_public_events()')
  ) <> 's' then
    raise exception 'pd_public_events ist nicht STABLE.';
  end if;

  if not exists (
    select 1
    from pg_proc as proc
    where proc.oid = to_regprocedure('public.pd_public_events()')
      and 'search_path=""' = any(proc.proconfig)
  ) then
    raise exception 'pd_public_events verwendet keinen leeren search_path.';
  end if;

  if not has_function_privilege(
    'anon',
    'public.pd_public_events()',
    'EXECUTE'
  ) then
    raise exception 'anon darf pd_public_events nicht ausführen.';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.pd_public_events()',
    'EXECUTE'
  ) then
    raise exception 'authenticated darf pd_public_events nicht ausführen.';
  end if;

  if exists (
    select 1
    from pg_proc as proc
    cross join lateral aclexplode(
      coalesce(
        proc.proacl,
        acldefault('f', proc.proowner)
      )
    ) as acl_item
    where proc.oid = to_regprocedure('public.pd_public_events()')
      and acl_item.grantee = 0
      and acl_item.privilege_type = 'EXECUTE'
  ) then
    raise exception 'PUBLIC darf pd_public_events nicht ausführen.';
  end if;

  if has_function_privilege(
    'anon',
    'public.pd_api(text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'anon darf pd_api nach D-011 weiterhin nicht ausführen.';
  end if;

  foreach v_table in array array[
    'app_modules.events',
    'app_modules.event_games'
  ]
  loop
    foreach v_privilege in array array[
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE'
    ]
    loop
      if has_table_privilege('anon', v_table, v_privilege) then
        raise exception 'anon besitzt unerlaubtes Recht % auf %',
          v_privilege,
          v_table;
      end if;
    end loop;
  end loop;

  delete from app_modules.events;

  insert into app_modules.events (
    id,
    event_type,
    title,
    event_date,
    event_time,
    visibility
  )
  values
    (
      '00000000-0000-4210-8000-000000000401',
      'FANCLUB',
      'Öffentlich heute',
      v_today,
      null,
      'PUBLIC'
    ),
    (
      '00000000-0000-4210-8000-000000000402',
      'OTHER',
      'Öffentlich künftig',
      v_today + 1,
      time '18:00',
      'PUBLIC'
    ),
    (
      '00000000-0000-4210-8000-000000000403',
      'FANCLUB',
      'Intern heute',
      v_today,
      null,
      'INTERNAL'
    ),
    (
      '00000000-0000-4210-8000-000000000404',
      'OTHER',
      'Intern künftig',
      v_today + 1,
      time '17:00',
      'INTERNAL'
    ),
    (
      '00000000-0000-4210-8000-000000000405',
      'OTHER',
      'Öffentlich vergangen',
      v_today - 1,
      null,
      'PUBLIC'
    );

  v_result := public.pd_public_events();
  v_events := v_result -> 'events';

  if jsonb_array_length(v_events) <> 2
     or v_events -> 0 ->> 'displayTitle' <> 'Öffentlich heute'
     or v_events -> 1 ->> 'displayTitle' <> 'Öffentlich künftig' then
    raise exception 'D-011 filtert PUBLIC/INTERNAL oder Vergangenheit falsch: %',
      v_events;
  end if;

  delete from app_modules.events;

  insert into app_modules.events (
    id,
    event_type,
    title,
    event_date,
    event_time,
    end_date,
    end_time,
    venue,
    description,
    visibility
  )
  values
    (
      '00000000-0000-4210-8000-000000000501',
      'FANCLUB',
      'Fanclub ohne Uhrzeit A',
      v_today,
      null,
      null,
      null,
      'Clubheim',
      'Fanclubbeschreibung',
      'PUBLIC'
    ),
    (
      '00000000-0000-4210-8000-000000000502',
      'OTHER',
      'Sonstiges ohne Uhrzeit B',
      v_today,
      null,
      v_today + 1,
      time '10:00',
      null,
      null,
      'PUBLIC'
    ),
    (
      '00000000-0000-4210-8000-000000000503',
      'GAME',
      null,
      v_today,
      time '18:00',
      null,
      null,
      'Stadion',
      null,
      'PUBLIC'
    ),
    (
      '00000000-0000-4210-8000-000000000504',
      'GAME',
      null,
      v_today + 1,
      time '19:00',
      null,
      null,
      null,
      'Auswärtsspiel',
      'PUBLIC'
    );

  insert into app_modules.event_games (
    event_id,
    home_away,
    opponent_name
  )
  values
    (
      '00000000-0000-4210-8000-000000000503',
      'HOME',
      'Heimgegner'
    ),
    (
      '00000000-0000-4210-8000-000000000504',
      'AWAY',
      'Auswärtsgegner'
    );

  v_result := public.pd_public_events();
  v_events := v_result -> 'events';

  if jsonb_array_length(v_events) <> 4
     or v_events -> 0 ->> 'displayTitle' <> 'Fanclub ohne Uhrzeit A'
     or v_events -> 1 ->> 'displayTitle' <> 'Sonstiges ohne Uhrzeit B'
     or v_events -> 2 ->> 'displayTitle'
       <> 'Mighty Dogs Schweinfurt – Heimgegner'
     or v_events -> 3 ->> 'displayTitle'
       <> 'Auswärtsgegner – Mighty Dogs Schweinfurt' then
    raise exception 'D-011-Titel oder Reihenfolge sind ungültig: %',
      v_events;
  end if;

  if v_events -> 0 -> 'homeAway' is distinct from 'null'::jsonb
     or v_events -> 1 -> 'homeAway' is distinct from 'null'::jsonb
     or v_events -> 2 ->> 'homeAway' <> 'HOME'
     or v_events -> 3 ->> 'homeAway' <> 'AWAY' then
    raise exception 'D-011 veröffentlicht homeAway nicht typgerecht.';
  end if;

  for v_event in
    select item.value
    from jsonb_array_elements(v_events) as item(value)
  loop
    select array_agg(key order by key)
    into v_keys
    from jsonb_object_keys(v_event) as keys(key);

    if v_keys is distinct from v_allowed_keys then
      raise exception 'D-011-Public-Schema besitzt unerlaubte Keys: %',
        v_keys;
    end if;
  end loop;
end
$public_event_api_verification$;

select 'PORTAL_CORE_STRUCTURE_OK' as result;
rollback;
