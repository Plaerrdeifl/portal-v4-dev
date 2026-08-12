\set ON_ERROR_STOP on

begin;

do $m010_schema_security$
declare
  v_privilege text;
begin
  if to_regclass('app_portal.user_capabilities') is null then
    raise exception 'M010 user_capabilities fehlt.';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'app_portal.user_capabilities'::regclass
  ) then
    raise exception 'RLS fehlt auf user_capabilities.';
  end if;

  foreach v_privilege in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE',
    'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ] loop
    if has_table_privilege(
      'anon', 'app_portal.user_capabilities', v_privilege
    ) or has_table_privilege(
      'authenticated', 'app_portal.user_capabilities', v_privilege
    ) then
      raise exception 'Browserrolle besitzt % auf user_capabilities.',
        v_privilege;
    end if;
  end loop;

  if has_function_privilege(
    'authenticated',
    'app_private.api_set_user_capabilities(jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'app_private.user_capability_provenance(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Private M010-Funktionen sind direkt im Browser erreichbar.';
  end if;

  if has_function_privilege(
    'anon', 'public.pd_api(text,jsonb)', 'EXECUTE'
  ) or not has_function_privilege(
    'authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE'
  ) then
    raise exception 'pd_api Browsergrenze ist nach M010 falsch.';
  end if;
end
$m010_schema_security$;

do $m010_authorization$
declare
  v_admin uuid := '00000000-0000-4010-8000-000000000001';
  v_multi uuid := '00000000-0000-4010-8000-000000000002';
  v_personal uuid := '00000000-0000-4010-8000-000000000003';
  v_inactive uuid := '00000000-0000-4010-8000-000000000004';
  v_inactive_role_user uuid := '00000000-0000-4010-8000-000000000005';
  v_multi_role uuid := '00000000-0000-4010-8000-000000000101';
  v_inactive_role uuid := '00000000-0000-4010-8000-000000000102';
  v_multi_member uuid := '00000000-0000-4010-8000-000000000201';
  v_inactive_role_member uuid := '00000000-0000-4010-8000-000000000202';
  v_response jsonb;
  v_provenance jsonb;
  v_sources text[];
  v_admin_count integer;
  v_audit_count integer;
begin
  insert into auth.users (id, email)
  values
    (v_admin, 'm010-admin@example.invalid'),
    (v_multi, 'm010-multi@example.invalid'),
    (v_personal, 'm010-personal@example.invalid'),
    (v_inactive, 'm010-inactive@example.invalid'),
    (v_inactive_role_user, 'm010-inactive-role@example.invalid');

  insert into app_portal.portal_roles (
    id, code, name, is_active, sort_order
  ) values
    (v_multi_role, 'M010_MULTI', 'M010 Multi Source', true, 900),
    (v_inactive_role, 'M010_INACTIVE', 'M010 Inactive', false, 910);

  insert into app_portal.role_capabilities (role_id, capability_code)
  values
    (v_multi_role, 'portal.access'),
    (v_multi_role, 'events.manage'),
    (v_inactive_role, 'portal.access');

  insert into app_portal.users (
    id, user_code, email, first_name, last_name, status, role_id
  ) values
    (v_admin, 'U-M010-ADMIN', 'm010-admin@example.invalid',
      'M010', 'Admin', 'ACTIVE',
      '00000000-0000-4000-8000-000000000001'),
    (v_multi, 'U-M010-MULTI', 'm010-multi@example.invalid',
      'M010', 'Multi', 'ACTIVE', v_multi_role),
    (v_personal, 'U-M010-PERSONAL', 'm010-personal@example.invalid',
      'M010', 'Personal', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'),
    (v_inactive, 'U-M010-INACTIVE', 'm010-inactive@example.invalid',
      'M010', 'Inactive', 'INACTIVE',
      '00000000-0000-4000-8000-000000000003'),
    (v_inactive_role_user, 'U-M010-INACTIVE-ROLE',
      'm010-inactive-role@example.invalid', 'M010', 'Inactive Role',
      'ACTIVE', v_inactive_role);

  insert into app_fanclub.members (
    id, member_code, first_name, last_name, status
  ) values
    (v_multi_member, 'PD-M010-1', 'M010', 'Office Multi', 'ACTIVE'),
    (v_inactive_role_member, 'PD-M010-2', 'M010', 'Office Inactive', 'ACTIVE');

  insert into app_portal.user_member_links (user_id, member_id, linked_by)
  values
    (v_multi, v_multi_member, v_admin),
    (v_inactive_role_user, v_inactive_role_member, v_admin);

  update app_fanclub.office_slots
  set member_id = case code
      when 'KASSIER' then v_multi_member
      when 'VORSTAND_1' then v_inactive_role_member
      else member_id
    end,
    updated_by = v_admin
  where code in ('KASSIER', 'VORSTAND_1');

  insert into app_portal.user_capabilities (
    user_id, capability_code, created_by
  ) values
    (v_inactive, 'events.manage', v_admin),
    (v_inactive_role_user, 'events.manage', v_admin);

  if not app_private.has_capability(v_multi, 'portal.access') then
    raise exception 'ROLE-Quelle funktioniert nicht.';
  end if;

  if not app_private.has_capability(v_multi, 'events.manage') then
    raise exception 'ROLE/OFFICE events.manage funktioniert nicht.';
  end if;

  if app_private.has_capability(v_inactive, 'events.manage') then
    raise exception 'INACTIVE User erhaelt PERSONAL-Capability.';
  end if;

  if app_private.has_capability(v_inactive_role_user, 'events.manage') then
    raise exception 'Inaktive Rolle sperrt OFFICE/PERSONAL nicht.';
  end if;

  if not app_private.has_capability(v_admin, 'events.manage') then
    raise exception 'portal.admin Wildcard funktioniert nicht.';
  end if;

  v_provenance := app_private.user_capability_provenance(v_admin);
  if not exists (
    select 1
    from jsonb_array_elements(v_provenance) as capability(item)
    cross join jsonb_array_elements(capability.item -> 'sources') as source(item)
    where capability.item ->> 'code' = 'events.manage'
      and source.item ->> 'source' = 'ADMIN_OVERRIDE'
  ) then
    raise exception 'ADMIN_OVERRIDE fehlt in der Provenance.';
  end if;

  v_admin_count := app_private.active_admin_count();
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );

  v_response := public.pd_api(
    'set_user_capabilities',
    jsonb_build_object(
      'userId', v_multi,
      'capabilities', jsonb_build_array('events.manage'),
      'expectedCapabilities', '[]'::jsonb
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Persoenlicher Multi-Source-Grant fehlgeschlagen: %',
      v_response;
  end if;

  v_provenance := app_private.user_capability_provenance(v_multi);
  select array_agg(source.item ->> 'source' order by source.item ->> 'source')
  into v_sources
  from jsonb_array_elements(v_provenance) as capability(item)
  cross join jsonb_array_elements(capability.item -> 'sources') as source(item)
  where capability.item ->> 'code' = 'events.manage';

  if v_sources <> array['OFFICE', 'PERSONAL', 'ROLE']::text[] then
    raise exception 'Multi-Source-Provenance ist falsch: %', v_sources;
  end if;

  v_response := public.pd_api(
    'set_user_capabilities',
    jsonb_build_object(
      'userId', v_personal,
      'capabilities', jsonb_build_array('events.manage', 'tasks.manage'),
      'expectedCapabilities', '[]'::jsonb
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not app_private.has_capability(v_personal, 'events.manage')
     or not app_private.has_capability(v_personal, 'tasks.manage') then
    raise exception 'PERSONAL-Quelle funktioniert nicht: %', v_response;
  end if;

  -- Der M210-Dispatcher bleibt die Security Boundary und profitiert zentral.
  perform set_config('request.jwt.claim.sub', v_personal::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_personal, 'role', 'authenticated')::text,
    true
  );

  v_response := public.pd_api(
    'set_user_capabilities',
    jsonb_build_object(
      'userId', v_multi,
      'capabilities', '[]'::jsonb,
      'expectedCapabilities', jsonb_build_array('events.manage')
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or not exists (
       select 1
       from app_portal.user_capabilities as personal
       where personal.user_id = v_multi
         and personal.capability_code = 'events.manage'
     ) then
    raise exception 'Nicht-Admin durfte persoenliche Capabilities verwalten: %',
      v_response;
  end if;

  v_response := public.pd_api(
    'event_create',
    jsonb_build_object(
      'eventType', 'OTHER',
      'title', 'M010 Personal Event',
      'eventDate', date '2026-08-20',
      'visibility', 'INTERNAL'
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Persoenliches events.manage erreicht M210 nicht: %',
      v_response;
  end if;

  -- Starker persoenlicher Zugriff simuliert kein Amt und kein M150-Voting.
  if exists (
    select 1
    from app_private.m150_current_board() as board
    where board.user_id = v_personal
  ) or exists (
    select 1
    from app_fanclub.membership_application_board_roster as roster
    where roster.voter_user_id = v_personal
  ) then
    raise exception 'Persoenliche Capability erzeugt M150-Board-Mitgliedschaft.';
  end if;

  v_response := public.pd_api(
    'membership_application_vote',
    jsonb_build_object(
      'id', '00000000-0000-4010-8000-000000000999',
      'vote', 'YES',
      'expectedRevision', 1
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or v_response #>> '{error,message}' <> 'M150_CURRENT_BOARD_REQUIRED' then
    raise exception 'Persoenliche Capability erlaubt M150-Abstimmung: %',
      v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_manual_decide',
    jsonb_build_object(
      'id', '00000000-0000-4010-8000-000000000999',
      'decision', 'APPROVED',
      'reasonInternal', 'Nicht erlaubt',
      'expectedRevision', 1
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or v_response #>> '{error,message}' <> 'M150_CURRENT_BOARD_REQUIRED' then
    raise exception 'Persoenliche Capability erlaubt M150-7-Tage-Entscheidung: %',
      v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );

  -- Revoke nur PERSONAL: ROLE und OFFICE bleiben wirksam und sichtbar.
  v_response := public.pd_api(
    'set_user_capabilities',
    jsonb_build_object(
      'userId', v_multi,
      'capabilities', '[]'::jsonb,
      'expectedCapabilities', jsonb_build_array('events.manage')
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not app_private.has_capability(v_multi, 'events.manage') then
    raise exception 'Geerbtes Recht ging beim PERSONAL-Revoke verloren: %',
      v_response;
  end if;

  v_provenance := app_private.user_capability_provenance(v_multi);
  if exists (
    select 1
    from jsonb_array_elements(v_provenance) as capability(item)
    cross join jsonb_array_elements(capability.item -> 'sources') as source(item)
    where capability.item ->> 'code' = 'events.manage'
      and source.item ->> 'source' = 'PERSONAL'
  ) or not exists (
    select 1
    from jsonb_array_elements(v_provenance) as capability(item)
    cross join jsonb_array_elements(capability.item -> 'sources') as source(item)
    where capability.item ->> 'code' = 'events.manage'
      and source.item ->> 'source' in ('ROLE', 'OFFICE')
  ) then
    raise exception 'Provenance nach PERSONAL-Revoke ist falsch.';
  end if;

  -- Revoke ohne andere Quelle entfernt die effektive Capability.
  v_response := public.pd_api(
    'set_user_capabilities',
    jsonb_build_object(
      'userId', v_personal,
      'capabilities', jsonb_build_array('tasks.manage'),
      'expectedCapabilities', jsonb_build_array('events.manage', 'tasks.manage')
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or app_private.has_capability(v_personal, 'events.manage')
     or not app_private.has_capability(v_personal, 'tasks.manage') then
    raise exception 'PERSONAL-Revoke ohne Erbquelle ist falsch: %', v_response;
  end if;

  -- Ein veralteter Vorzustand darf keinen konkurrierenden Satz ueberschreiben.
  v_response := public.pd_api(
    'set_user_capabilities',
    jsonb_build_object(
      'userId', v_personal,
      'capabilities', '[]'::jsonb,
      'expectedCapabilities', '[]'::jsonb
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '40001' then
    raise exception 'Concurrency-Konflikt wurde nicht erkannt: %', v_response;
  end if;

  v_response := public.pd_api(
    'set_user_capabilities',
    jsonb_build_object(
      'userId', v_personal,
      'capabilities', jsonb_build_array('portal.admin'),
      'expectedCapabilities', jsonb_build_array('tasks.manage')
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '23514' then
    raise exception 'portal.admin wurde ueber API persoenlich akzeptiert: %',
      v_response;
  end if;

  begin
    insert into app_portal.user_capabilities (
      user_id, capability_code, created_by
    ) values (v_personal, 'portal.admin', v_admin);
    raise exception 'portal.admin wurde direkt in user_capabilities akzeptiert.';
  exception
    when check_violation then null;
  end;

  if app_private.active_admin_count() <> v_admin_count then
    raise exception 'Persoenliche Grants veraendern active_admin_count().';
  end if;

  select count(*)
  into v_audit_count
  from app_portal.audit_events as event
  where event.action = 'USER_CAPABILITIES_UPDATED'
    and event.actor_user_id = v_admin
    and event.entity_type = 'user_capabilities'
    and event.before_data ? 'personalCapabilities'
    and event.after_data ? 'personalCapabilities'
    and event.metadata ? 'targetUserId'
    and event.metadata ? 'addedCapabilities'
    and event.metadata ? 'removedCapabilities';

  if v_audit_count < 4 then
    raise exception 'Grant/Revoke-Audit ist unvollstaendig: %', v_audit_count;
  end if;

  if exists (
    select 1
    from app_portal.user_task_access_overrides
    where can_create_tasks or can_manage_tasks
  ) then
    raise exception 'Legacy Task-Capability-Flags sind noch autoritativ.';
  end if;

  begin
    insert into app_portal.user_task_access_overrides (
      user_id, can_create_tasks
    ) values (v_personal, true);
    raise exception 'Legacy can_create_tasks=true wurde akzeptiert.';
  exception
    when check_violation then null;
  end;
end
$m010_authorization$;

rollback;
