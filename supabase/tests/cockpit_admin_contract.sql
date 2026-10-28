\set ON_ERROR_STOP on

begin;

do $cockpit_admin_contract$
declare
  v_sys_1 uuid := '00000000-0000-4320-8000-000000000001';
  v_sys_2 uuid := '00000000-0000-4320-8000-000000000002';
  v_admin uuid := '00000000-0000-4320-8000-000000000003';
  v_blocked_admin uuid := '00000000-0000-4320-8000-000000000004';
  v_user_1 uuid := '00000000-0000-4320-8000-000000000005';
  v_user_2 uuid := '00000000-0000-4320-8000-000000000006';
  v_portal_admin uuid := '00000000-0000-4320-8000-000000000007';
  v_inactive uuid := '00000000-0000-4320-8000-000000000008';
  v_social_media_team_id uuid;
  v_response jsonb;
  v_revision integer;
begin
  if app_private.platform_action_classification(
       'cockpit_admin_users_list'
     ) <> 'READ'
     or app_private.platform_action_classification(
       'cockpit_admin_user_get'
     ) <> 'READ'
     or app_private.platform_action_classification(
       'cockpit_admin_access_set'
     ) <> 'USER_MUTATION'
     or app_private.platform_action_classification(
       'cockpit_admin_personal_capabilities_set'
     ) <> 'USER_MUTATION'
     or not (
       'cockpit_admin_access_set' = any(
         app_private.pd_api_current_actions()
       )
     ) then
    raise exception 'Cockpit-R2-Actions fehlen oder sind falsch klassifiziert.';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(array['anon', 'authenticated', 'service_role'])
      as browser_role(role_name)
    cross join pg_catalog.unnest(array[
      'app_private.cockpit_assert_payload(jsonb,text[],text[])',
      'app_private.cockpit_require_admin_actor()',
      'app_private.cockpit_lock_admin_actor()',
      'app_private.cockpit_active_system_admin_count()',
      'app_private.cockpit_admin_user_projection(uuid)',
      'app_private.api_cockpit_admin_users_list(jsonb)',
      'app_private.api_cockpit_admin_user_get(jsonb)',
      'app_private.api_cockpit_admin_access_set(jsonb)',
      'app_private.api_cockpit_admin_personal_capabilities_set(jsonb)',
      'app_private.cockpit_bootstrap_first_system_admin(uuid,text,text)'
    ]) as internal_function(signature)
    where pg_catalog.has_function_privilege(
      browser_role.role_name,
      internal_function.signature,
      'EXECUTE'
    )
  ) then
    raise exception 'Interne Cockpit-R2-Funktion ist direkt erreichbar.';
  end if;

  insert into auth.users (id, email)
  values
    (v_sys_1, 'cockpit-r2-sys-1@example.invalid'),
    (v_sys_2, 'cockpit-r2-sys-2@example.invalid'),
    (v_admin, 'cockpit-r2-admin@example.invalid'),
    (v_blocked_admin, 'cockpit-r2-blocked-admin@example.invalid'),
    (v_user_1, 'cockpit-r2-user-1@example.invalid'),
    (v_user_2, 'cockpit-r2-user-2@example.invalid'),
    (v_portal_admin, 'cockpit-r2-portal-admin@example.invalid'),
    (v_inactive, 'cockpit-r2-inactive@example.invalid');

  insert into app_portal.users (
    id, user_code, email, first_name, last_name, status, role_id
  )
  values
    (
      v_sys_1, 'U-CKR2-001', 'cockpit-r2-sys-1@example.invalid',
      'Cockpit', 'System One', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_sys_2, 'U-CKR2-002', 'cockpit-r2-sys-2@example.invalid',
      'Cockpit', 'System Two', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_admin, 'U-CKR2-003', 'cockpit-r2-admin@example.invalid',
      'Cockpit', 'Admin', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_blocked_admin, 'U-CKR2-004',
      'cockpit-r2-blocked-admin@example.invalid',
      'Cockpit', 'Blocked Admin', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_user_1, 'U-CKR2-005', 'cockpit-r2-user-1@example.invalid',
      'Cockpit', 'User One', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_user_2, 'U-CKR2-006', 'cockpit-r2-user-2@example.invalid',
      'Cockpit', 'User Two', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_portal_admin, 'U-CKR2-007',
      'cockpit-r2-portal-admin@example.invalid',
      'Cockpit', 'Portal Admin', 'ACTIVE',
      '00000000-0000-4000-8000-000000000001'
    ),
    (
      v_inactive, 'U-CKR2-008', 'cockpit-r2-inactive@example.invalid',
      'Cockpit', 'Inactive', 'INACTIVE',
      '00000000-0000-4000-8000-000000000003'
    );

  -- Bootstrap is a separate, explicit, postgres-only, one-time operation.
  v_response := app_private.cockpit_bootstrap_first_system_admin(
    v_sys_1,
    'AP-03-R2-SQL-TEST',
    'Controlled isolated local contract test bootstrap.'
  );
  if v_response #>> '{cockpit,role}' <> 'SYSTEM_ADMIN'
     or not coalesce(
       (v_response #>> '{cockpit,enabled}')::boolean,
       false
     )
     or app_private.cockpit_active_system_admin_count() <> 1
     or not exists (
       select 1
       from app_portal.audit_events as audit_event
       where audit_event.action =
         'COCKPIT_FIRST_SYSTEM_ADMIN_BOOTSTRAPPED'
         and audit_event.actor_user_id is null
         and audit_event.entity_id = v_sys_1::text
     ) then
    raise exception 'Kontrollierter Erstbootstrap ist unvollstaendig: %',
      v_response;
  end if;

  begin
    perform app_private.cockpit_bootstrap_first_system_admin(
      v_sys_2,
      'AP-03-R2-SQL-TEST-SECOND',
      'A second bootstrap must never be accepted.'
    );
    raise exception 'Zweiter Cockpit-Bootstrap wurde akzeptiert.';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'COCKPIT_BOOTSTRAP_ALREADY_COMPLETED' then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_sys_1::text, true);
  perform set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_sys_1,
      'role', 'authenticated'
    )::text,
    true
  );
  v_response := public.pd_api('cockpit_admin_users_list', '{}'::jsonb);
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,actorRole}' <> 'SYSTEM_ADMIN'
     or not exists (
       select 1
       from pg_catalog.jsonb_array_elements(
         v_response #> '{data,users}'
       ) as managed_user(item)
       where managed_user.item ->> 'userId' = v_sys_1::text
     ) then
    raise exception 'SYSTEM_ADMIN-Verwaltungsliste ist unvollstaendig: %',
      v_response;
  end if;

  v_response := public.pd_api(
    'cockpit_admin_user_get',
    pg_catalog.jsonb_build_object('targetUserId', v_sys_1)
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,userId}' <> v_sys_1::text
     or v_response #>> '{data,cockpit,role}' <> 'SYSTEM_ADMIN' then
    raise exception 'SYSTEM_ADMIN-Einzelprojektion ist fehlerhaft: %',
      v_response;
  end if;

  -- portal.admin, missing assignment and blocked Cockpit admins are denied.
  perform set_config('request.jwt.claim.sub', v_portal_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_portal_admin,
      'role', 'authenticated'
    )::text,
    true
  );
  v_response := public.pd_api('cockpit_admin_users_list', '{}'::jsonb);
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or v_response #>> '{error,message}' <> 'COCKPIT_ADMIN_REQUIRED' then
    raise exception 'portal.admin wurde als Cockpit-Admin akzeptiert: %',
      v_response;
  end if;

  insert into app_portal.cockpit_access (
    user_id, role, is_enabled, revision
  ) values (v_blocked_admin, 'ADMIN', false, 1);
  perform set_config('request.jwt.claim.sub', v_blocked_admin::text, true);
  v_response := public.pd_api('cockpit_admin_users_list', '{}'::jsonb);
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'COCKPIT_ADMIN_REQUIRED' then
    raise exception 'Gesperrter Cockpit-Admin wurde akzeptiert: %', v_response;
  end if;

  -- SYSTEM_ADMIN creates the second SYSTEM_ADMIN and an ADMIN.
  perform set_config('request.jwt.claim.sub', v_sys_1::text, true);
  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_sys_2,
      'role', 'SYSTEM_ADMIN',
      'isEnabled', true,
      'expectedRevision', null
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,cockpit,role}' <> 'SYSTEM_ADMIN'
     or (v_response #>> '{data,cockpit,revision}')::integer <> 1 then
    raise exception 'Zweiter SYSTEM_ADMIN konnte nicht angelegt werden: %',
      v_response;
  end if;

  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_admin,
      'role', 'ADMIN',
      'isEnabled', true,
      'expectedRevision', null
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,cockpit,role}' <> 'ADMIN' then
    raise exception 'ADMIN konnte nicht angelegt werden: %', v_response;
  end if;

  -- ADMIN may enroll and manage only normal users.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_response := public.pd_api('cockpit_admin_users_list', '{}'::jsonb);
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(
         v_response #> '{data,users}'
       ) as managed_user(item)
       where managed_user.item #>> '{cockpit,role}' in (
         'ADMIN',
         'SYSTEM_ADMIN'
       )
     ) then
    raise exception 'ADMIN-Liste enthaelt privilegierte Cockpit-Ziele: %',
      v_response;
  end if;

  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_user_1,
      'role', 'USER',
      'isEnabled', true,
      'expectedRevision', null
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,cockpit,role}' <> 'USER'
     or (v_response #>> '{data,cockpit,revision}')::integer <> 1 then
    raise exception 'ADMIN konnte normalen Benutzer nicht anlegen: %',
      v_response;
  end if;

  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_user_2,
      'role', 'ADMIN',
      'isEnabled', true,
      'expectedRevision', null
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or v_response #>> '{error,message}' <>
       'COCKPIT_TARGET_NOT_MANAGEABLE' then
    raise exception 'ADMIN konnte Rollen eskalieren: %', v_response;
  end if;

  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_sys_2,
      'role', 'USER',
      'isEnabled', true,
      'expectedRevision', 1
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <>
       'COCKPIT_TARGET_NOT_MANAGEABLE' then
    raise exception 'ADMIN konnte SYSTEM_ADMIN verwalten: %', v_response;
  end if;

  -- Payload keys and capability values are strict allowlists.
  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_user_1,
      'role', 'USER',
      'isEnabled', false,
      'expectedRevision', 1,
      'portalStatus', 'BLOCKED'
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'COCKPIT_INVALID_PAYLOAD' then
    raise exception 'Nicht erlaubtes Zugriffsattribut wurde akzeptiert: %',
      v_response;
  end if;

  v_response := public.pd_api(
    'cockpit_admin_personal_capabilities_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_user_1,
      'capabilities', pg_catalog.jsonb_build_array('events.manage'),
      'expectedRevision', 1
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <>
       'COCKPIT_INVALID_CAPABILITY_ALLOWLIST' then
    raise exception 'Fremdes Fachrecht wurde akzeptiert: %', v_response;
  end if;

  -- The narrow personal-right write preserves unrelated personal rights.
  insert into app_portal.user_capabilities (
    user_id, capability_code, created_by
  ) values (v_user_1, 'events.manage', v_sys_1);

  v_response := public.pd_api(
    'cockpit_admin_personal_capabilities_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_user_1,
      'capabilities', pg_catalog.jsonb_build_array(
        'liveticker.manage',
        'social_media_generator.use'
      ),
      'expectedRevision', 1
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not coalesce(
       (
         v_response #>>
           '{data,permissions,liveticker,personallyAssigned}'
       )::boolean,
       false
     )
     or not coalesce(
       (
         v_response #>>
           '{data,permissions,generator,personallyAssigned}'
       )::boolean,
       false
     )
     or (v_response #>> '{data,cockpit,revision}')::integer <> 2
     or not exists (
       select 1
       from app_portal.user_capabilities as personal
       where personal.user_id = v_user_1
         and personal.capability_code = 'events.manage'
     ) then
    raise exception 'Enger Fachrechtevertrag ist fehlerhaft: %', v_response;
  end if;

  -- Stale revisions fail before any write.
  v_response := public.pd_api(
    'cockpit_admin_personal_capabilities_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_user_1,
      'capabilities', '[]'::jsonb,
      'expectedRevision', 1
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '40001'
     or v_response #>> '{error,message}' <> 'STALE_REVISION' then
    raise exception 'Veraltete Revision wurde nicht abgewiesen: %', v_response;
  end if;

  -- Removing PERSONAL preserves an independent SOCIAL_MEDIA source.
  insert into app_portal.teams (code, name, description, is_active)
  values (
    'SOCIAL_MEDIA',
    'Social Media',
    'AP-03/R2 contract fixture.',
    true
  )
  on conflict (code) do update
  set is_active = true
  returning id into v_social_media_team_id;

  insert into app_portal.team_memberships (
    team_id, user_id, team_role, is_active
  ) values (v_social_media_team_id, v_user_1, 'MEMBER', true);

  v_response := public.pd_api(
    'cockpit_admin_personal_capabilities_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_user_1,
      'capabilities', '[]'::jsonb,
      'expectedRevision', 2
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or coalesce(
       (
         v_response #>>
           '{data,permissions,generator,personallyAssigned}'
       )::boolean,
       true
     )
     or not coalesce(
       (
         v_response #>>
           '{data,permissions,generator,effectiveFromAllSources}'
       )::boolean,
       false
     )
     or not exists (
       select 1
       from app_portal.user_capabilities as personal
       where personal.user_id = v_user_1
         and personal.capability_code = 'events.manage'
     ) then
    raise exception 'Effektive Generatorquelle wurde beim Entzug verloren: %',
      v_response;
  end if;

  -- Cockpit blocking changes neither Portal status nor independent rights.
  v_revision := (v_response #>> '{data,cockpit,revision}')::integer;
  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_user_1,
      'role', 'USER',
      'isEnabled', false,
      'expectedRevision', v_revision
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or coalesce((v_response #>> '{data,cockpit,allowed}')::boolean, true)
     or (select status from app_portal.users where id = v_user_1) <> 'ACTIVE'
     or not app_private.has_capability(
       v_user_1,
       'social_media_generator.use'
     ) then
    raise exception 'Cockpit-Sperre hat globale Zustaende veraendert: %',
      v_response;
  end if;

  -- Enabling/creating an inactive target is default-denied.
  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_inactive,
      'role', 'USER',
      'isEnabled', true,
      'expectedRevision', null
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'COCKPIT_TARGET_INACTIVE' then
    raise exception 'Inaktives Ziel wurde freigegeben: %', v_response;
  end if;

  -- The first demotion leaves one active SYSTEM_ADMIN; the second is blocked.
  perform set_config('request.jwt.claim.sub', v_sys_1::text, true);
  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_sys_2,
      'role', 'ADMIN',
      'isEnabled', true,
      'expectedRevision', 1
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or app_private.cockpit_active_system_admin_count() <> 1 then
    raise exception 'Zulaessige SYSTEM_ADMIN-Aenderung schlug fehl: %',
      v_response;
  end if;

  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', v_sys_1,
      'role', 'ADMIN',
      'isEnabled', true,
      'expectedRevision', 1
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or v_response #>> '{error,message}' <>
       'COCKPIT_LAST_SYSTEM_ADMIN_REQUIRED'
     or app_private.cockpit_active_system_admin_count() <> 1 then
    raise exception 'Letzter SYSTEM_ADMIN wurde nicht geschuetzt: %',
      v_response;
  end if;

  if not exists (
       select 1
       from app_portal.audit_events as audit_event
       where audit_event.action = 'COCKPIT_ACCESS_SET'
         and audit_event.actor_user_id = v_admin
         and audit_event.entity_id = v_user_1::text
     )
     or not exists (
       select 1
       from app_portal.audit_events as audit_event
       where audit_event.action = 'COCKPIT_PERSONAL_CAPABILITIES_SET'
         and audit_event.actor_user_id = v_admin
         and audit_event.entity_id = v_user_1::text
     ) then
    raise exception 'Auditnachweis fuer Cockpit-Schreibaktionen fehlt.';
  end if;
end
$cockpit_admin_contract$;

rollback;
