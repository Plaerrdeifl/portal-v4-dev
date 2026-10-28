\set ON_ERROR_STOP on

begin;

do $cockpit_access_contract$
declare
  v_inactive uuid := '00000000-0000-4310-8000-000000000001';
  v_unassigned uuid := '00000000-0000-4310-8000-000000000002';
  v_blocked uuid := '00000000-0000-4310-8000-000000000003';
  v_portal_admin uuid := '00000000-0000-4310-8000-000000000004';
  v_no_rights uuid := '00000000-0000-4310-8000-000000000005';
  v_liveticker uuid := '00000000-0000-4310-8000-000000000006';
  v_generator uuid := '00000000-0000-4310-8000-000000000007';
  v_team uuid := '00000000-0000-4310-8000-000000000008';
  v_inactive_team uuid := '00000000-0000-4310-8000-000000000009';
  v_system_admin uuid := '00000000-0000-4310-8000-000000000010';
  v_outside_cockpit uuid := '00000000-0000-4310-8000-000000000011';
  v_other_capability uuid := '00000000-0000-4310-8000-000000000012';
  v_social_media_team_id uuid;
  v_response jsonb;
begin
  -- Public envelope remains authenticated-only.
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role', 'anon')::text,
    true
  );
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501' then
    raise exception 'Nicht angemeldeter Cockpit-Aufruf wurde nicht abgewiesen: %',
      v_response;
  end if;

  if app_private.platform_action_classification('cockpit_access_get') <> 'READ'
     or not ('cockpit_access_get' = any(app_private.pd_api_current_actions())) then
    raise exception 'Cockpit-Action ist nicht als READ registriert.';
  end if;

  if not exists (
       select 1
       from pg_catalog.pg_class as relation
       join pg_catalog.pg_namespace as namespace
         on namespace.oid = relation.relnamespace
       where namespace.nspname = 'app_portal'
         and relation.relname = 'cockpit_access'
         and relation.relrowsecurity
     )
     or exists (
       select 1
       from pg_catalog.pg_policies as policy
       where policy.schemaname = 'app_portal'
         and policy.tablename = 'cockpit_access'
     )
     or exists (
       select 1
       from unnest(array['anon', 'authenticated', 'service_role'])
         as browser_role(role_name)
       cross join unnest(array[
         'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE',
         'REFERENCES', 'TRIGGER'
       ]) as table_privilege(privilege_name)
       where has_table_privilege(
         browser_role.role_name,
         'app_portal.cockpit_access',
         table_privilege.privilege_name
       )
     ) then
    raise exception 'Neue Cockpit-Tabelle ist direkt erreichbar.';
  end if;

  if exists (
       select 1
       from unnest(array['anon', 'authenticated', 'service_role'])
         as browser_role(role_name)
       cross join unnest(array[
         'app_private.cockpit_user_has_access(uuid)',
         'app_private.api_cockpit_access_get(jsonb)'
       ]) as internal_function(signature)
       where has_function_privilege(
         browser_role.role_name,
         internal_function.signature,
         'EXECUTE'
       )
     ) then
    raise exception 'Neue interne Cockpit-Funktion ist direkt erreichbar.';
  end if;

  if has_function_privilege(
       'anon', 'public.pd_api(text,jsonb)', 'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE'
     ) then
    raise exception 'Bestehende pd_api-Browsergrenze wurde verändert.';
  end if;

  insert into auth.users (id, email)
  values
    (v_inactive, 'cockpit-inactive@example.invalid'),
    (v_unassigned, 'cockpit-unassigned@example.invalid'),
    (v_blocked, 'cockpit-blocked@example.invalid'),
    (v_portal_admin, 'cockpit-portal-admin@example.invalid'),
    (v_no_rights, 'cockpit-no-rights@example.invalid'),
    (v_liveticker, 'cockpit-liveticker@example.invalid'),
    (v_generator, 'cockpit-generator@example.invalid'),
    (v_team, 'cockpit-team@example.invalid'),
    (v_inactive_team, 'cockpit-inactive-team@example.invalid'),
    (v_system_admin, 'cockpit-system-admin@example.invalid'),
    (v_outside_cockpit, 'cockpit-outside@example.invalid'),
    (v_other_capability, 'cockpit-other-capability@example.invalid');

  insert into app_portal.users (
    id, user_code, email, first_name, last_name, status, role_id
  )
  values
    (
      v_inactive, 'U-CKP-001', 'cockpit-inactive@example.invalid',
      'Cockpit', 'Inactive', 'INACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_unassigned, 'U-CKP-002', 'cockpit-unassigned@example.invalid',
      'Cockpit', 'Unassigned', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_blocked, 'U-CKP-003', 'cockpit-blocked@example.invalid',
      'Cockpit', 'Blocked', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_portal_admin, 'U-CKP-004', 'cockpit-portal-admin@example.invalid',
      'Cockpit', 'Portal Admin', 'ACTIVE',
      '00000000-0000-4000-8000-000000000001'
    ),
    (
      v_no_rights, 'U-CKP-005', 'cockpit-no-rights@example.invalid',
      'Cockpit', 'No Rights', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_liveticker, 'U-CKP-006', 'cockpit-liveticker@example.invalid',
      'Cockpit', 'Liveticker', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_generator, 'U-CKP-007', 'cockpit-generator@example.invalid',
      'Cockpit', 'Generator', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_team, 'U-CKP-008', 'cockpit-team@example.invalid',
      'Cockpit', 'Team', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_inactive_team, 'U-CKP-009', 'cockpit-inactive-team@example.invalid',
      'Cockpit', 'Inactive Team', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_system_admin, 'U-CKP-010', 'cockpit-system-admin@example.invalid',
      'Cockpit', 'System Admin', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_outside_cockpit, 'U-CKP-011', 'cockpit-outside@example.invalid',
      'Cockpit', 'Outside', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_other_capability, 'U-CKP-012',
      'cockpit-other-capability@example.invalid',
      'Cockpit', 'Other Capability', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    );

  insert into app_portal.cockpit_access (
    user_id, role, is_enabled, revision
  )
  values
    (v_inactive, 'USER', true, 3),
    (v_blocked, 'USER', false, 4),
    (v_no_rights, 'USER', true, 5),
    (v_liveticker, 'USER', true, 6),
    (v_generator, 'USER', true, 7),
    (v_team, 'USER', true, 8),
    (v_inactive_team, 'USER', true, 9),
    (v_system_admin, 'SYSTEM_ADMIN', true, 10),
    (v_other_capability, 'USER', true, 11);

  insert into app_portal.user_capabilities (
    user_id, capability_code, created_by
  )
  values
    (v_liveticker, 'liveticker.manage', v_portal_admin),
    (v_generator, 'social_media_generator.use', v_portal_admin),
    (v_other_capability, 'events.manage', v_portal_admin);

  insert into app_portal.teams (
    code, name, description, is_active
  )
  values (
    'SOCIAL_MEDIA', 'Social Media', 'Cockpit contract fixture.', true
  )
  on conflict (code) do update
  set is_active = true
  returning id into v_social_media_team_id;

  insert into app_portal.team_memberships (
    team_id, user_id, team_role, is_active
  )
  values
    (v_social_media_team_id, v_team, 'MEMBER', true),
    (v_social_media_team_id, v_inactive_team, 'MEMBER', false),
    (v_social_media_team_id, v_outside_cockpit, 'MEMBER', true);

  -- Inactive Portal user stays denied even with an enabled Cockpit row.
  perform set_config('request.jwt.claim.sub', v_inactive::text, true);
  perform set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', v_inactive,
      'role', 'authenticated'
    )::text,
    true
  );
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or coalesce((v_response #>> '{data,cockpit,allowed}')::boolean, true)
     or v_response #>> '{data,cockpit,reason}' <> 'PORTAL_USER_INACTIVE'
     or coalesce((v_response #>> '{data,portal,active}')::boolean, true) then
    raise exception 'Inaktiver Portaluser wurde falsch entschieden: %',
      v_response;
  end if;

  -- No assignment and a blocked assignment are distinct fail-closed results.
  perform set_config('request.jwt.claim.sub', v_unassigned::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if coalesce((v_response #>> '{data,cockpit,assigned}')::boolean, true)
     or v_response #>> '{data,cockpit,reason}' <>
       'COCKPIT_ACCESS_NOT_ASSIGNED' then
    raise exception 'Fehlende Cockpit-Zuordnung wurde falsch entschieden: %',
      v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_blocked::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if not coalesce((v_response #>> '{data,cockpit,assigned}')::boolean, false)
     or coalesce((v_response #>> '{data,cockpit,enabled}')::boolean, true)
     or v_response #>> '{data,cockpit,reason}' <> 'COCKPIT_ACCESS_BLOCKED'
     or (v_response #>> '{data,cockpit,revision}')::bigint <> 4 then
    raise exception 'Cockpit-Sperre oder Revision wurde falsch entschieden: %',
      v_response;
  end if;

  -- portal.admin is still a Fachrechte source, but never Cockpit enrollment.
  perform set_config('request.jwt.claim.sub', v_portal_admin::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if not app_private.has_capability(v_portal_admin, 'portal.admin')
     or coalesce((v_response #>> '{data,cockpit,allowed}')::boolean, true)
     or coalesce(
       (v_response #>> '{data,permissions,liveticker,effectiveAllowed}')::boolean,
       true
     )
     or coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       true
     ) then
    raise exception 'Portaladmin wurde ohne Cockpit-Zuordnung freigegeben: %',
      v_response;
  end if;

  -- Enabled Cockpit without module rights still gets only the safe shell.
  perform set_config('request.jwt.claim.sub', v_no_rights::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if not coalesce((v_response #>> '{data,cockpit,allowed}')::boolean, false)
     or v_response #>> '{data,cockpit,role}' <> 'USER'
     or coalesce(
       (v_response #>> '{data,permissions,liveticker,effectiveAllowed}')::boolean,
       true
     )
     or coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       true
     ) then
    raise exception 'Cockpit-Benutzer ohne Fachrechte wurde falsch entschieden: %',
      v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_liveticker::text, true);
  v_response := public.pd_api(
    'cockpit_access_get',
    pg_catalog.jsonb_build_object(
      'actorUserId', v_system_admin,
      'targetUserId', v_system_admin,
      'userId', v_system_admin
    )
  );
  if v_response #>> '{data,userId}' <> v_liveticker::text
     or not coalesce(
       (v_response #>> '{data,permissions,liveticker,personallyAssigned}')::boolean,
       false
     )
     or not coalesce(
       (v_response #>> '{data,permissions,liveticker,effectiveAllowed}')::boolean,
       false
     )
     or coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       true
     ) then
    raise exception 'Livetickerrecht oder manipulierte Ziel-ID ist falsch: %',
      v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_generator::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if not coalesce(
       (v_response #>> '{data,permissions,generator,personallyAssigned}')::boolean,
       false
     )
     or not coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       false
     )
     or coalesce(
       (v_response #>> '{data,permissions,liveticker,effectiveAllowed}')::boolean,
       true
     ) then
    raise exception 'Persoenliches Generatorrecht wurde falsch entschieden: %',
      v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_team::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if coalesce(
       (v_response #>> '{data,permissions,generator,personallyAssigned}')::boolean,
       true
     )
     or not coalesce(
       (v_response #>> '{data,permissions,generator,activeSocialMediaTeam}')::boolean,
       false
     )
     or not coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       false
     ) then
    raise exception 'Aktive SOCIAL_MEDIA-Mitgliedschaft ist falsch: %',
      v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_inactive_team::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if coalesce(
       (v_response #>> '{data,permissions,generator,activeSocialMediaTeam}')::boolean,
       true
     )
     or coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       true
     ) then
    raise exception 'Inaktive SOCIAL_MEDIA-Mitgliedschaft wurde wirksam: %',
      v_response;
  end if;

  -- Once explicitly enrolled, portal.admin remains the established module
  -- wildcard, without becoming a Cockpit role source.
  insert into app_portal.cockpit_access (
    user_id, role, is_enabled, revision
  ) values (v_portal_admin, 'USER', true, 1);
  perform set_config('request.jwt.claim.sub', v_portal_admin::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if not coalesce((v_response #>> '{data,cockpit,allowed}')::boolean, false)
     or v_response #>> '{data,cockpit,role}' <> 'USER'
     or not coalesce(
       (v_response #>> '{data,permissions,liveticker,effectiveAllowed}')::boolean,
       false
     )
     or not coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       false
     ) then
    raise exception 'Portaladmin mit Cockpit-Freigabe ist falsch: %', v_response;
  end if;

  -- Cockpit SYSTEM_ADMIN gains exactly the two module rights and existing
  -- module APIs accept the same central decision, without portal.admin.
  perform set_config('request.jwt.claim.sub', v_system_admin::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if not coalesce((v_response #>> '{data,cockpit,allowed}')::boolean, false)
     or v_response #>> '{data,cockpit,role}' <> 'SYSTEM_ADMIN'
     or not coalesce(
       (v_response #>> '{data,permissions,liveticker,effectiveAllowed}')::boolean,
       false
     )
     or not coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       false
     )
     or app_private.has_capability(v_system_admin, 'portal.admin')
     or app_private.has_capability(v_system_admin, 'events.manage') then
    raise exception 'Cockpit-Systemadministrator ist zu weit oder zu eng: %',
      v_response;
  end if;

  if not coalesce(
       (public.pd_api('liveticker_teams_list', '{}'::jsonb) ->> 'ok')::boolean,
       false
     )
     or not coalesce(
       (
         public.pd_api(
           'social_media_generator_bootstrap', '{}'::jsonb
         ) ->> 'ok'
       )::boolean,
       false
     ) then
    raise exception 'Bestehende Fach-APIs verwenden nicht dieselbe Entscheidung.';
  end if;

  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      app_private.user_capability_provenance(v_system_admin)
    ) as capability(item)
    where capability.item ->> 'code' = 'liveticker.manage'
      and capability.item #>> '{sources,0,source}' =
        'COCKPIT_SYSTEM_ADMIN'
  ) then
    raise exception 'Cockpit-Systemadmin-Quelle fehlt in der Provenienz.';
  end if;

  -- Blocking the Cockpit assignment removes both narrowly scoped
  -- SYSTEM_ADMIN sources immediately, without changing another user's rights.
  update app_portal.cockpit_access
  set is_enabled = false,
      revision = revision + 1
  where user_id = v_system_admin;
  perform set_config('request.jwt.claim.sub', v_system_admin::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if v_response #>> '{data,cockpit,reason}' <> 'COCKPIT_ACCESS_BLOCKED'
     or coalesce(
       (v_response #>> '{data,permissions,liveticker,effectiveAllowed}')::boolean,
       true
     )
     or coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       true
     )
     or app_private.has_capability(v_system_admin, 'liveticker.manage')
     or app_private.has_capability(
       v_system_admin,
       'social_media_generator.use'
     )
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(
         app_private.user_capability_provenance(v_system_admin)
       ) as capability(item)
       cross join pg_catalog.jsonb_array_elements(
         capability.item -> 'sources'
       ) as source(item)
       where source.item ->> 'source' = 'COCKPIT_SYSTEM_ADMIN'
     )
     or not app_private.has_capability(v_liveticker, 'liveticker.manage') then
    raise exception
      'Cockpit-Sperre entzieht Systemadministrator-Sonderrechte nicht sauber: %',
      v_response;
  end if;

  -- Removing a personal source must be reflected immediately.
  delete from app_portal.user_capabilities
  where user_id = v_generator
    and capability_code = 'social_media_generator.use';
  perform set_config('request.jwt.claim.sub', v_generator::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if coalesce(
       (v_response #>> '{data,permissions,generator,personallyAssigned}')::boolean,
       true
     )
     or coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       true
     ) then
    raise exception 'Entzogenes Generatorrecht ist stale: %', v_response;
  end if;

  -- Removing PERSONAL must preserve the independent active team source.
  insert into app_portal.user_capabilities (
    user_id, capability_code, created_by
  ) values (
    v_team, 'social_media_generator.use', v_portal_admin
  );
  delete from app_portal.user_capabilities
  where user_id = v_team
    and capability_code = 'social_media_generator.use';
  perform set_config('request.jwt.claim.sub', v_team::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if coalesce(
       (v_response #>> '{data,permissions,generator,personallyAssigned}')::boolean,
       true
     )
     or not coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       false
     ) then
    raise exception 'Andere Generatorquelle wurde beim Entzug verloren: %',
      v_response;
  end if;

  -- Existing effective rights outside Cockpit stay intact, while the Cockpit
  -- projection itself remains fail-closed without enrollment.
  if not app_private.social_media_generator_user_has_access(v_outside_cockpit)
     or not app_private.has_capability(v_other_capability, 'events.manage') then
    raise exception 'Bestehende Fachrechte ausserhalb Cockpit wurden verändert.';
  end if;
  perform set_config('request.jwt.claim.sub', v_outside_cockpit::text, true);
  v_response := public.pd_api('cockpit_access_get', '{}'::jsonb);
  if coalesce((v_response #>> '{data,cockpit,allowed}')::boolean, true)
     or coalesce(
       (v_response #>> '{data,permissions,generator,effectiveAllowed}')::boolean,
       true
     ) then
    raise exception 'Externer Generatorzugriff wurde zu Cockpit-Zugriff: %',
      v_response;
  end if;
end
$cockpit_access_contract$;

rollback;
