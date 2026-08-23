\set ON_ERROR_STOP on

begin;

do $m900_platform_mode_full_integration$
declare
  v_privileged uuid := '00000000-0000-4900-8000-000000000011';
  v_unprivileged uuid := '00000000-0000-4900-8000-000000000012';
  v_role uuid;
  v_created jsonb;
  v_unprivileged_created jsonb;
  v_revoked_created jsonb;
  v_token text;
  v_response jsonb;
  v_sqlstate text;
  v_read_action text;
  v_read_actions text[] := array[
    'admin_snapshot','bootstrap','dashboard','events_list','fanbus_available_events',
    'fanbus_boarding_stops_list','fanbus_bus_boarding_stops_list','fanbus_buses_list',
    'fanbus_companion_duplicate_preview','fanbus_companion_lists_list',
    'fanbus_companion_person_search','fanbus_operations_snapshot',
    'fanbus_registration_identity_search','fanbus_registration_identity_suggestion',
    'fanbus_registration_operational_detail','fanbus_registration_people_list',
    'fanbus_registrations_list','fanbus_trip_boarding_stops_list',
    'fanbus_trip_boarding_stops_public','fanbus_trips_list','fanbus_user_preference_get',
    'fanclub_snapshot','member_detail','member_match','membership_application_detail',
    'membership_applications_list','push_snapshot','tasks_snapshot','teams_snapshot'
  ]::text[];
begin
  if to_regclass('app_private.platform_release_bypass_tokens') is null
     or to_regprocedure('app_private.create_platform_release_bypass(text,text,timestamptz,uuid)') is null
     or to_regprocedure('app_private.require_platform_user_write_allowed(text,uuid)') is null then
    raise exception 'M900-R1 Vollintegration oder Release-Bypass fehlt.';
  end if;

  if has_table_privilege('anon', 'app_private.platform_release_bypass_tokens', 'SELECT')
     or has_table_privilege('authenticated', 'app_private.platform_release_bypass_tokens', 'SELECT')
     or has_table_privilege('service_role', 'app_private.platform_release_bypass_tokens', 'SELECT')
     or has_function_privilege(
       'service_role',
       'app_private.create_platform_release_bypass(text,text,timestamptz,uuid)',
       'EXECUTE'
     ) then
    raise exception 'Release-Bypass ist ausserhalb des Ops-Kontexts erreichbar.';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.m150_submit_membership_application(jsonb,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.m150_submit_membership_application(jsonb,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.m310_submit_guest_fanbus_registration(jsonb,uuid,text)',
       'EXECUTE'
     ) then
    raise exception 'Public-Mutationsgrenzen besitzen unzulaessige Grants.';
  end if;

  select role.id into v_role
  from app_portal.portal_roles as role
  where role.code = 'PORTAL_USER' and role.is_active;

  insert into auth.users (id, email)
  values
    (v_privileged, 'm900-full-privileged@example.invalid'),
    (v_unprivileged, 'm900-full-unprivileged@example.invalid');

  insert into app_portal.users (
    id, user_code, email, first_name, last_name, status, role_id
  ) values
    (v_privileged, 'U-M900-FULL-PRIV', 'm900-full-privileged@example.invalid', 'M900', 'Privileged', 'ACTIVE', v_role),
    (v_unprivileged, 'U-M900-FULL-UNPRIV', 'm900-full-unprivileged@example.invalid', 'M900', 'Unprivileged', 'ACTIVE', v_role);

  insert into app_portal.user_capabilities (user_id, capability_code, created_by)
  values (v_privileged, 'events.manage', v_privileged);

  perform set_config('request.jwt.claim.sub', v_privileged::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_privileged, 'role', 'authenticated')::text,
    true
  );
  perform set_config('request.headers', '{}'::jsonb::text, true);

  update app_portal.settings
  set value = jsonb_build_object('mode', 'NORMAL', 'environment', 'DEV'),
      revision = revision + 1
  where key = 'platform.mode';

  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> '22023' then
    raise exception 'NORMAL pd_api erreicht bestehende Fachvalidierung nicht: %', v_response;
  end if;

  v_sqlstate := null;
  begin
    perform public.m150_submit_membership_application('{}'::jsonb, 'invalid');
  exception when others then v_sqlstate := sqlstate;
  end;
  if v_sqlstate in ('P0901', 'P0902', 'P0903') then
    raise exception 'NORMAL blockiert M150 auf Plattformebene.';
  end if;

  v_sqlstate := null;
  begin
    perform public.m210_ics_import_preview(v_privileged, 'BAD', 'BAD', '[]'::jsonb);
  exception when others then v_sqlstate := sqlstate;
  end;
  if v_sqlstate in ('P0901', 'P0902', 'P0903') then
    raise exception 'NORMAL blockiert M210 Preview auf Plattformebene.';
  end if;

  v_sqlstate := null;
  begin
    perform public.m210_ics_import_confirm(
      v_privileged, 'ICS', 'TEST', 'test.ics', repeat('a', 64), 1,
      '[]'::jsonb, '{}'::jsonb, repeat('b', 64)
    );
  exception when others then v_sqlstate := sqlstate;
  end;
  if v_sqlstate in ('P0901', 'P0902', 'P0903') then
    raise exception 'NORMAL blockiert M210 Confirm auf Plattformebene.';
  end if;

  v_sqlstate := null;
  begin
    perform public.m310_submit_guest_fanbus_registration(
      '{}'::jsonb, '00000000-0000-4000-8000-000000000001', repeat('c', 64)
    );
  exception when others then v_sqlstate := sqlstate;
  end;
  if v_sqlstate in ('P0901', 'P0902', 'P0903') then
    raise exception 'NORMAL blockiert M310 auf Plattformebene.';
  end if;

  update app_portal.settings
  set value = jsonb_build_object('mode', 'READ_ONLY', 'environment', 'DEV'),
      revision = revision + 1
  where key = 'platform.mode';

  if cardinality(v_read_actions) <> 29 then
    raise exception 'READ-Allowlist hat nicht exakt 29 Eintraege.';
  end if;
  foreach v_read_action in array v_read_actions loop
    if app_private.platform_action_classification(v_read_action) <> 'READ' then
      raise exception 'READ_ONLY klassifiziert Leseaktion falsch: %', v_read_action;
    end if;
  end loop;
  v_response := public.pd_api('events_list', '{}'::jsonb);
  if v_response #>> '{error,code}' like 'PLATFORM_%' then
    raise exception 'READ_ONLY blockiert Leseweg: %', v_response;
  end if;

  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_READ_ONLY' then
    raise exception 'pd_api Mutation ist in READ_ONLY offen: %', v_response;
  end if;

  begin
    perform public.m150_submit_membership_application('{}'::jsonb, 'invalid');
    raise exception 'M150 wurde in READ_ONLY nicht blockiert.';
  exception when sqlstate 'P0902' then null;
  end;
  begin
    perform public.m210_ics_import_confirm(
      v_privileged, 'ICS', 'TEST', 'test.ics', repeat('a', 64), 1,
      '[]'::jsonb, '{}'::jsonb, repeat('b', 64)
    );
    raise exception 'M210 Confirm wurde in READ_ONLY nicht blockiert.';
  exception when sqlstate 'P0902' then null;
  end;
  begin
    perform public.m310_submit_guest_fanbus_registration(
      '{}'::jsonb, '00000000-0000-4000-8000-000000000001', repeat('c', 64)
    );
    raise exception 'M310 wurde in READ_ONLY nicht blockiert.';
  exception when sqlstate 'P0902' then null;
  end;

  v_sqlstate := null;
  begin
    perform public.m210_ics_import_preview(v_privileged, 'BAD', 'BAD', '[]'::jsonb);
  exception when others then
    v_sqlstate := sqlstate;
  end;
  if v_sqlstate in ('P0901', 'P0902', 'P0903') then
    raise exception 'M210 Preview wurde als Schreibweg blockiert.';
  end if;

  v_sqlstate := null;
  begin
    perform public.pd_notification_claim_batch(1);
  exception when others then
    v_sqlstate := sqlstate;
  end;
  if v_sqlstate in ('P0901', 'P0902', 'P0903') then
    raise exception 'Hintergrundworker wurde vom User-Guard blockiert.';
  end if;

  v_created := app_private.create_platform_release_bypass(
    'DEV', 'release-run-valid', now() + interval '15 minutes', v_privileged
  );
  v_token := v_created ->> 'token';
  if v_token !~ '^[0-9a-f]{64}$'
     or exists (
       select 1 from app_private.platform_release_bypass_tokens as bypass
       where bypass.id = (v_created ->> 'id')::uuid and bypass.token_digest = v_token
     )
     or not exists (
       select 1 from app_private.platform_release_bypass_tokens as bypass
       where bypass.id = (v_created ->> 'id')::uuid
         and bypass.token_digest = encode(
           extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'
         )
     ) then
    raise exception 'Roh-Token oder Digest-Speicherung ist unsicher.';
  end if;

  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', v_token,
      'x-pd-release-run', 'release-run-valid',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
  v_response := public.pd_api(
    'event_create',
    jsonb_build_object(
      'eventType', 'OTHER', 'title', 'M900 Release-Test',
      'eventDate', '2026-09-01', 'visibility', 'INTERNAL'
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false) is distinct from true then
    raise exception 'Gueltiger Release-Bypass erreicht Fachfunktion nicht: %', v_response;
  end if;
  if not exists (
    select 1 from app_portal.audit_events as audit
    where audit.action = 'PLATFORM_RELEASE_BYPASS_USED'
      and audit.entity_id = v_created ->> 'id'
      and audit.actor_user_id = v_privileged
      and audit.metadata ->> 'action' = 'event_create'
      and audit.metadata ->> 'environment' = 'DEV'
      and audit.metadata ->> 'runId' = 'release-run-valid'
      and audit.metadata ->> 'actorType' = 'PORTAL_USER'
      and (audit.metadata ->> 'bypassUsed')::boolean
  ) then
    raise exception 'Erfolgreiche Bypass-Verwendung wurde nicht auditiert.';
  end if;
  if exists (
    select 1 from app_portal.audit_events as audit
    where audit.action = 'PLATFORM_RELEASE_BYPASS_USED'
      and (audit.metadata::text like '%' || v_token || '%'
        or audit.before_data::text like '%' || v_token || '%'
        or audit.after_data::text like '%' || v_token || '%')
  ) then
    raise exception 'Audit enthaelt Roh-Token.';
  end if;

  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', v_token,
      'x-pd-release-run', 'wrong-run',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_READ_ONLY' then
    raise exception 'Falscher Lauf ist nicht fail-closed.';
  end if;

  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', v_token,
      'x-pd-release-run', 'release-run-valid',
      'x-pd-environment', 'PROD'
    )::text,
    true
  );
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_READ_ONLY' then
    raise exception 'Falsche Umgebung ist nicht fail-closed.';
  end if;

  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', 'malformed',
      'x-pd-release-run', 'release-run-valid',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_READ_ONLY' then
    raise exception 'Malformed Token ist nicht fail-closed.';
  end if;

  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', repeat('f', 64),
      'x-pd-release-run', 'release-run-valid',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_READ_ONLY' then
    raise exception 'Unbekanntes Token ist nicht fail-closed.';
  end if;

  insert into app_private.platform_release_bypass_tokens (
    token_digest, environment, run_id, expires_at, created_at
  ) values (
    encode(extensions.digest(convert_to(repeat('e', 64), 'UTF8'), 'sha256'), 'hex'),
    'DEV', 'expired-run', now() - interval '1 minute', now() - interval '30 minutes'
  );
  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', repeat('e', 64),
      'x-pd-release-run', 'expired-run',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_READ_ONLY' then
    raise exception 'Abgelaufenes Token ist nicht fail-closed.';
  end if;

  v_revoked_created := app_private.create_platform_release_bypass(
    'DEV', 'revoked-run', now() + interval '10 minutes', null
  );
  if not app_private.revoke_platform_release_bypass((v_revoked_created ->> 'id')::uuid) then
    raise exception 'Bypass konnte nicht widerrufen werden.';
  end if;
  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', v_revoked_created ->> 'token',
      'x-pd-release-run', 'revoked-run',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_READ_ONLY' then
    raise exception 'Widerrufenes Token ist nicht fail-closed.';
  end if;

  perform set_config('request.jwt.claim.sub', v_unprivileged::text, true);
  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', v_token,
      'x-pd-release-run', 'release-run-valid',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_READ_ONLY' then
    raise exception 'Falscher gebundener User ist nicht fail-closed.';
  end if;

  v_unprivileged_created := app_private.create_platform_release_bypass(
    'DEV', 'unprivileged-run', now() + interval '10 minutes', v_unprivileged
  );
  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', v_unprivileged_created ->> 'token',
      'x-pd-release-run', 'unprivileged-run',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> '42501' then
    raise exception 'Bypass hat Fachberechtigung umgangen: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_privileged::text, true);
  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', v_token,
      'x-pd-release-run', 'release-run-valid',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> '22023' then
    raise exception 'Bypass hat Fachvalidierung umgangen: %', v_response;
  end if;

  update app_portal.settings
  set value = jsonb_build_object('mode', 'MAINTENANCE', 'environment', 'DEV'),
      revision = revision + 1
  where key = 'platform.mode';
  perform set_config('request.headers', '{}'::jsonb::text, true);
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_MAINTENANCE' then
    raise exception 'MAINTENANCE blockiert User-Mutation nicht.';
  end if;

  update app_portal.settings
  set value = jsonb_build_object('environment', 'DEV'), revision = revision + 1
  where key = 'platform.mode';
  perform set_config(
    'request.headers',
    jsonb_build_object(
      'x-pd-release-bypass', v_token,
      'x-pd-release-run', 'release-run-valid',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
  v_response := public.pd_api('event_create', '{}'::jsonb);
  if v_response #>> '{error,code}' <> 'PLATFORM_WRITE_UNAVAILABLE' then
    raise exception 'Ungueltige Plattformkonfiguration wurde per Bypass geoeffnet: %', v_response;
  end if;
end;
$m900_platform_mode_full_integration$;

rollback;
