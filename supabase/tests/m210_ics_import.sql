\set ON_ERROR_STOP on

begin;

do $m210_security$
declare
  v_table text;
  v_privilege text;
begin
  foreach v_table in array array[
    'app_modules.event_external_refs',
    'app_modules.event_import_runs'
  ] loop
    if to_regclass(v_table) is null then raise exception 'M210-R2 Tabelle fehlt: %', v_table; end if;
    if not (select relrowsecurity from pg_class where oid = to_regclass(v_table)) then
      raise exception 'RLS fehlt auf %', v_table;
    end if;
    foreach v_privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      if has_table_privilege('anon', v_table, v_privilege)
         or has_table_privilege('authenticated', v_table, v_privilege) then
        raise exception 'Browserrolle besitzt % auf %', v_privilege, v_table;
      end if;
    end loop;
  end loop;

  if has_function_privilege('anon', 'public.m210_ics_import_preview(uuid,text,text,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.m210_ics_import_preview(uuid,text,text,jsonb)', 'EXECUTE')
     or has_function_privilege('anon', 'public.m210_ics_import_confirm(uuid,text,text,text,text,integer,jsonb,jsonb,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.m210_ics_import_confirm(uuid,text,text,text,text,integer,jsonb,jsonb,text)', 'EXECUTE') then
    raise exception 'Browserrollen dürfen Import-RPCs nicht direkt ausführen.';
  end if;
  if not has_function_privilege('service_role', 'public.m210_ics_import_preview(uuid,text,text,jsonb)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.m210_ics_import_confirm(uuid,text,text,text,text,integer,jsonb,jsonb,text)', 'EXECUTE') then
    raise exception 'Service-Role-Rechte für den Import fehlen.';
  end if;
end
$m210_security$;

do $m210_import$
declare
  v_actor uuid := '00000000-0000-4210-8000-000000000001';
  v_denied uuid := '00000000-0000-4210-8000-000000000002';
  v_records jsonb := jsonb_build_array(jsonb_build_object(
    'uid', 'm210-game-1@example.invalid',
    'eventDate', '2026-09-20', 'eventTime', '18:00:00',
    'endDate', '2026-09-20', 'endTime', '20:30:00',
    'venue', 'Icedome', 'homeAway', 'HOME', 'opponentName', 'Testgegner'
  ));
  v_second jsonb := jsonb_build_array(jsonb_build_object(
    'uid', 'm210-game-2@example.invalid',
    'eventDate', '2026-09-27', 'eventTime', '18:00:00',
    'endDate', '2026-09-27', 'endTime', '20:30:00',
    'venue', 'Icedome', 'homeAway', 'HOME', 'opponentName', 'Zweiter Gegner'
  ));
  v_concurrent jsonb := jsonb_build_array(jsonb_build_object(
    'uid', 'm210-concurrent@example.invalid',
    'eventDate', '2026-10-04', 'eventTime', '18:00:00',
    'endDate', '2026-10-04', 'endTime', '20:30:00',
    'venue', 'Icedome', 'homeAway', 'HOME', 'opponentName', 'Parallelgegner'
  ));
  v_preview jsonb;
  v_competing_preview jsonb;
  v_result jsonb;
  v_event_id uuid;
  v_second_id uuid;
  v_manual_id uuid;
  v_trip_id uuid;
  v_revision integer;
begin
  insert into auth.users(id, email) values
    (v_actor, 'm210-actor@example.invalid'),
    (v_denied, 'm210-denied@example.invalid');
  insert into app_portal.users(id, user_code, email, first_name, last_name, status, role_id) values
    (v_actor, 'U-M210-ACTOR', 'm210-actor@example.invalid', 'M210', 'Actor', 'ACTIVE', '00000000-0000-4000-8000-000000000001'),
    (v_denied, 'U-M210-DENIED', 'm210-denied@example.invalid', 'M210', 'Denied', 'ACTIVE', '00000000-0000-4000-8000-000000000003');

  begin
    perform public.m210_ics_import_preview(v_denied, 'ICS', 'ERV_BAYERNLIGA_2026_27', v_records);
    raise exception 'Preview ohne events.manage wurde akzeptiert.';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.m210_ics_import_confirm(
      v_denied, 'ICS', 'ERV_BAYERNLIGA_2026_27', 'denied.ics', repeat('0',64), 700,
      v_records, '[]'::jsonb, repeat('9',64)
    );
    raise exception 'Confirm ohne events.manage wurde akzeptiert.';
  exception when insufficient_privilege then null;
  end;

  insert into app_modules.events(event_type, event_date, event_time, visibility, created_by, updated_by)
  values ('GAME', date '2026-09-20', time '18:00', 'INTERNAL', v_actor, v_actor)
  returning id into v_manual_id;
  insert into app_modules.event_games(event_id, home_away, opponent_name)
  values (v_manual_id, 'HOME', 'Testgegner');

  v_preview := public.m210_ics_import_preview(v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', v_records);
  if v_preview #>> '{items,0,status}' <> 'NEW' then raise exception 'NEW-Klassifikation fehlt.'; end if;

  v_result := public.m210_ics_import_confirm(
    v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', 'spielplan.ics', repeat('a',64), 1200,
    v_records, v_preview -> 'state', repeat('b',64)
  );
  v_event_id := (v_result #>> '{items,0,eventId}')::uuid;
  if v_event_id = v_manual_id then raise exception 'Manuelles Event wurde fuzzy zugeordnet.'; end if;
  if (select count(*) from app_modules.event_external_refs where external_uid = 'm210-game-1@example.invalid') <> 1 then
    raise exception 'External Reference fehlt oder ist doppelt.';
  end if;

  select revision into v_revision from app_modules.events where id = v_event_id;
  v_preview := public.m210_ics_import_preview(v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', v_records);
  if v_preview #>> '{items,0,status}' <> 'UNCHANGED' then raise exception 'UNCHANGED-Klassifikation fehlt.'; end if;
  perform public.m210_ics_import_confirm(
    v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', 'spielplan.ics', repeat('a',64), 1200,
    v_records, v_preview -> 'state', repeat('c',64)
  );
  if (select revision from app_modules.events where id = v_event_id) <> v_revision then
    raise exception 'UNCHANGED hat die Revision erhöht.';
  end if;
  if (select count(*) from app_modules.events where id = v_event_id) <> 1 then raise exception 'Idempotenter Import dupliziert Events.'; end if;

  update app_modules.events
  set visibility = 'INTERNAL', description = 'Manuell gepflegt', venue = 'Manuell verändert', revision = revision + 1
  where id = v_event_id;
  insert into app_modules.fanbus_trips(event_id, status, created_by, updated_by)
  values (v_event_id, 'DRAFT', v_actor, v_actor) returning id into v_trip_id;

  v_preview := public.m210_ics_import_preview(v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', v_records);
  if v_preview #>> '{items,0,status}' <> 'CHANGED' then raise exception 'CHANGED-Klassifikation fehlt.'; end if;
  perform public.m210_ics_import_confirm(
    v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', 'spielplan-neu.ics', repeat('d',64), 1210,
    v_records, v_preview -> 'state', repeat('e',64)
  );
  if (select visibility from app_modules.events where id = v_event_id) <> 'INTERNAL'
     or (select description from app_modules.events where id = v_event_id) <> 'Manuell gepflegt' then
    raise exception 'Manuelle Felder wurden überschrieben.';
  end if;
  if (select event_id from app_modules.fanbus_trips where id = v_trip_id) <> v_event_id then
    raise exception 'Fanbusreferenz oder event_id wurde verändert.';
  end if;

  v_preview := public.m210_ics_import_preview(v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', v_second);
  v_result := public.m210_ics_import_confirm(
    v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', 'zweites-spiel.ics', repeat('f',64), 800,
    v_second, v_preview -> 'state', repeat('1',64)
  );
  v_second_id := (v_result #>> '{items,0,eventId}')::uuid;
  v_preview := public.m210_ics_import_preview(v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', v_records);
  perform public.m210_ics_import_confirm(
    v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', 'ohne-zweites.ics', repeat('2',64), 700,
    v_records, v_preview -> 'state', repeat('3',64)
  );
  if not exists (select 1 from app_modules.events where id = v_second_id) then
    raise exception 'In einer späteren Datei fehlendes Event wurde gelöscht.';
  end if;

  v_preview := public.m210_ics_import_preview(v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', v_concurrent);
  v_competing_preview := public.m210_ics_import_preview(v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', v_concurrent);
  perform public.m210_ics_import_confirm(
    v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', 'concurrent-a.ics', repeat('8',64), 700,
    v_concurrent, v_preview -> 'state', repeat('a',64)
  );
  begin
    perform public.m210_ics_import_confirm(
      v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', 'concurrent-b.ics', repeat('8',64), 700,
      v_concurrent, v_competing_preview -> 'state', repeat('b',64)
    );
    raise exception 'Konkurrierender Confirm wurde nicht als PREVIEW_STALE abgewiesen.';
  exception when sqlstate 'P2101' then null;
  end;
  if (select count(*) from app_modules.event_external_refs where external_uid = 'm210-concurrent@example.invalid') <> 1 then
    raise exception 'Konkurrierender Confirm hat ein Duplikat erzeugt.';
  end if;

  v_preview := public.m210_ics_import_preview(v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', v_records);
  update app_modules.events set venue = 'Parallel geändert', revision = revision + 1 where id = v_event_id;
  begin
    perform public.m210_ics_import_confirm(
      v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', 'stale.ics', repeat('4',64), 700,
      v_records, v_preview -> 'state', repeat('5',64)
    );
    raise exception 'Veraltete Preview wurde bestätigt.';
  exception when sqlstate 'P2101' then null;
  end;

  if not exists (
    select 1 from app_portal.audit_events
    where action = 'EVENT_ICS_IMPORT_CONFIRMED' and entity_type = 'event_import_run'
  ) then raise exception 'Aggregiertes Import-Audit fehlt.'; end if;
  if exists (
    select 1 from app_portal.audit_events
    where action = 'EVENT_ICS_IMPORT_CONFIRMED'
      and (coalesce(before_data,'{}')::text || coalesce(after_data,'{}')::text || coalesce(metadata,'{}')::text) ilike '%Manuell gepflegt%'
  ) then raise exception 'Import-Audit enthält eine manuelle Beschreibung.'; end if;
end
$m210_import$;

create or replace function app_private.m210_test_fail_ref()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.external_uid = 'atomic-fail@example.invalid' then
    raise exception 'erwarteter Testfehler';
  end if;
  return new;
end;
$$;
create trigger m210_test_fail_ref
before insert on app_modules.event_external_refs
for each row execute function app_private.m210_test_fail_ref();

do $m210_atomic$
declare
  v_actor uuid := '00000000-0000-4210-8000-000000000001';
  v_records jsonb := jsonb_build_array(
    jsonb_build_object('uid','atomic-ok@example.invalid','eventDate','2026-10-01','eventTime','18:00:00','endDate','2026-10-01','endTime','20:00:00','venue','A','homeAway','HOME','opponentName','A'),
    jsonb_build_object('uid','atomic-fail@example.invalid','eventDate','2026-10-02','eventTime','18:00:00','endDate','2026-10-02','endTime','20:00:00','venue','B','homeAway','HOME','opponentName','B')
  );
  v_preview jsonb;
begin
  v_preview := public.m210_ics_import_preview(v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', v_records);
  begin
    perform public.m210_ics_import_confirm(
      v_actor, 'ICS', 'ERV_BAYERNLIGA_2026_27', 'atomic.ics', repeat('6',64), 900,
      v_records, v_preview -> 'state', repeat('7',64)
    );
    raise exception 'Erwarteter atomarer Fehler blieb aus.';
  exception when others then
    if sqlerrm = 'Erwarteter atomarer Fehler blieb aus.' then raise; end if;
  end;
  if exists (
    select 1 from app_modules.event_external_refs
    where external_uid in ('atomic-ok@example.invalid','atomic-fail@example.invalid')
  ) then raise exception 'Fehlerhafter Import wurde teilweise geschrieben.'; end if;
end
$m210_atomic$;

rollback;
