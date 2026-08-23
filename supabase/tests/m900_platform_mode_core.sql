\set ON_ERROR_STOP on

begin;

do $m900_platform_mode_core$
declare
  v_user_id uuid := '00000000-0000-4900-8000-000000000001';
  v_role_id uuid;
  v_state record;
  v_response jsonb;
  v_status jsonb;
  v_read_actions text[] := array[
    'admin_snapshot',
    'bootstrap',
    'dashboard',
    'events_list',
    'fanbus_available_events',
    'fanbus_boarding_stops_list',
    'fanbus_bus_boarding_stops_list',
    'fanbus_buses_list',
    'fanbus_companion_duplicate_preview',
    'fanbus_companion_lists_list',
    'fanbus_companion_person_search',
    'fanbus_operations_snapshot',
    'fanbus_registration_identity_search',
    'fanbus_registration_identity_suggestion',
    'fanbus_registration_operational_detail',
    'fanbus_registration_people_list',
    'fanbus_registrations_list',
    'fanbus_trip_boarding_stops_list',
    'fanbus_trip_boarding_stops_public',
    'fanbus_trips_list',
    'fanbus_user_preference_get',
    'fanclub_snapshot',
    'member_detail',
    'member_match',
    'membership_application_detail',
    'membership_applications_list',
    'push_snapshot',
    'tasks_snapshot',
    'teams_snapshot'
  ]::text[];
  v_action text;
begin
  if to_regprocedure('app_private.platform_runtime_state()') is null
     or to_regprocedure(
       'app_private.platform_action_classification(text)'
     ) is null
     or to_regprocedure(
       'app_private.require_platform_user_write_allowed()'
     ) is null
     or to_regprocedure('public.pd_public_platform_status()') is null then
    raise exception 'M900-R1 Kernfunktion fehlt.';
  end if;

  if has_function_privilege(
       'anon',
       'app_private.platform_runtime_state()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'app_private.platform_runtime_state()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'app_private.require_platform_user_write_allowed()',
       'EXECUTE'
     ) then
    raise exception 'Private M900-R1 Funktionen sind direkt erreichbar.';
  end if;

  if not has_function_privilege(
       'anon',
       'public.pd_public_platform_status()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.pd_public_platform_status()',
       'EXECUTE'
     )
     or has_function_privilege(
       'service_role',
       'public.pd_public_platform_status()',
       'EXECUTE'
     ) then
    raise exception 'Public-Status-Berechtigungen sind nicht minimal.';
  end if;

  if cardinality(v_read_actions) <> 29 then
    raise exception 'READ-Allowlist besitzt nicht exakt 29 Actions.';
  end if;

  foreach v_action in array v_read_actions loop
    if app_private.platform_action_classification(v_action) <> 'READ' then
      raise exception 'READ-Action falsch klassifiziert: %', v_action;
    end if;
  end loop;

  if app_private.platform_action_classification('event_create') <>
       'USER_MUTATION'
     or app_private.platform_action_classification('unknown_action') <>
       'USER_MUTATION'
     or app_private.platform_action_classification(null) <>
       'USER_MUTATION' then
    raise exception 'Mutation-/Unknown-Klassifikation ist nicht fail-closed.';
  end if;

  select role.id
  into v_role_id
  from app_portal.portal_roles as role
  where role.code = 'PORTAL_USER'
    and role.is_active;

  if v_role_id is null then
    raise exception 'Testvoraussetzung PORTAL_USER fehlt.';
  end if;

  insert into auth.users (id, email)
  values (v_user_id, 'm900-r1-user@example.invalid');

  insert into app_portal.users (
    id,
    user_code,
    email,
    first_name,
    last_name,
    status,
    role_id
  )
  values (
    v_user_id,
    'U-M900-R1-USER',
    'm900-r1-user@example.invalid',
    'M900',
    'User',
    'ACTIVE',
    v_role_id
  );

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_user_id,
      'role', 'authenticated'
    )::text,
    true
  );

  update app_portal.settings
  set value = jsonb_build_object(
        'mode', 'NORMAL',
        'message', 'Normalbetrieb',
        'expectedEnd', '2026-08-24T18:00:00+02:00'
      ),
      revision = revision + 1
  where key = 'platform.mode';

  select runtime.*
  into v_state
  from app_private.platform_runtime_state() as runtime;
  if v_state.mode <> 'NORMAL'
     or not v_state.is_valid
     or v_state.message <> 'Normalbetrieb'
     or v_state.expected_end is null
     or v_state.error_code is not null then
    raise exception 'NORMAL wurde nicht korrekt aufgeloest.';
  end if;

  v_response := public.pd_api('event_create', '{}'::jsonb);
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' like 'PLATFORM_%' then
    raise exception
      'NORMAL umgeht bestehende Berechtigungen oder blockiert auf Plattformebene: %',
      v_response;
  end if;

  v_status := public.pd_public_platform_status();
  if (select count(*) from jsonb_object_keys(v_status)) <> 4
     or not v_status ?& array['mode', 'message', 'expectedEnd', 'revision']
     or v_status ->> 'mode' <> 'NORMAL'
     or v_status ->> 'message' <> 'Normalbetrieb'
     or v_status ? 'updated_by'
     or v_status ? 'updatedBy'
     or v_status ? 'isValid'
     or v_status ? 'errorCode' then
    raise exception 'Public-Status-Vertrag ist unzulaessig: %', v_status;
  end if;

  update app_portal.settings
  set value = jsonb_build_object('mode', 'READ_ONLY'),
      revision = revision + 1
  where key = 'platform.mode';

  select runtime.*
  into v_state
  from app_private.platform_runtime_state() as runtime;
  if v_state.mode <> 'READ_ONLY' or not v_state.is_valid then
    raise exception 'READ_ONLY wurde nicht korrekt aufgeloest.';
  end if;

  v_response := public.pd_api('events_list', '{}'::jsonb);
  if v_response #>> '{error,code}' like 'PLATFORM_%' then
    raise exception 'READ-Action wurde in READ_ONLY blockiert: %', v_response;
  end if;

  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_READ_ONLY' then
    raise exception 'Mutation wurde in READ_ONLY nicht blockiert: %', v_response;
  end if;

  update app_portal.settings
  set value = jsonb_build_object('mode', 'MAINTENANCE'),
      revision = revision + 1
  where key = 'platform.mode';

  select runtime.*
  into v_state
  from app_private.platform_runtime_state() as runtime;
  if v_state.mode <> 'MAINTENANCE' or not v_state.is_valid then
    raise exception 'MAINTENANCE wurde nicht korrekt aufgeloest.';
  end if;

  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_MAINTENANCE' then
    raise exception 'Mutation wurde in MAINTENANCE nicht blockiert: %', v_response;
  end if;

  delete from app_portal.settings where key = 'platform.mode';
  select runtime.*
  into v_state
  from app_private.platform_runtime_state() as runtime;
  if v_state.mode <> 'MAINTENANCE'
     or v_state.is_valid
     or v_state.revision is not null
     or v_state.error_code <> 'PLATFORM_WRITE_UNAVAILABLE' then
    raise exception 'Fehlendes Setting ist nicht fail-closed.';
  end if;
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_WRITE_UNAVAILABLE' then
    raise exception 'Fehlendes Setting blockiert Mutation nicht: %', v_response;
  end if;

  insert into app_portal.settings (key, value, description)
  values ('platform.mode', '{}'::jsonb, 'M900-R1 Test');
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_WRITE_UNAVAILABLE' then
    raise exception 'Fehlender mode blockiert Mutation nicht: %', v_response;
  end if;

  update app_portal.settings
  set value = jsonb_build_object('mode', 'UNKNOWN')
  where key = 'platform.mode';
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_WRITE_UNAVAILABLE' then
    raise exception 'Unbekannter mode blockiert Mutation nicht: %', v_response;
  end if;

  update app_portal.settings
  set value = '[]'::jsonb
  where key = 'platform.mode';
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_WRITE_UNAVAILABLE' then
    raise exception 'Ungueltige Struktur blockiert Mutation nicht: %', v_response;
  end if;

  v_status := public.pd_public_platform_status();
  if (select count(*) from jsonb_object_keys(v_status)) <> 4
     or v_status ->> 'mode' <> 'MAINTENANCE'
     or v_status -> 'revision' is null then
    raise exception 'Public-Status ist bei invalidem State nicht sicher: %', v_status;
  end if;
end;
$m900_platform_mode_core$;

rollback;
