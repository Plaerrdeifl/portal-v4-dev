\set ON_ERROR_STOP on

begin;

do $m010_r2_authorization$
declare
  v_manager uuid := '00000000-0000-4012-8000-000000000001';
  v_lead uuid := '00000000-0000-4012-8000-000000000002';
  v_target uuid := '00000000-0000-4012-8000-000000000003';
  v_outsider uuid := '00000000-0000-4012-8000-000000000004';
  v_member uuid := '00000000-0000-4012-8000-000000000101';
  v_role uuid;
  v_bus_team uuid;
  v_created_team uuid;
  v_created_team_code text;
  v_response jsonb;
  v_snapshot jsonb;
  v_revision integer;
begin
  if to_regclass(
    'app_portal.team_function_capabilities'
  ) is null then
    raise exception
      'M010-R2 team_function_capabilities fehlt.';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid =
      'app_portal.team_function_capabilities'::regclass
  ) then
    raise exception
      'M010-R2 RLS fehlt auf team_function_capabilities.';
  end if;

  if has_table_privilege(
    'authenticated',
    'app_portal.team_function_capabilities',
    'SELECT'
  ) then
    raise exception
      'authenticated darf Teamfunktions-Mappings direkt lesen.';
  end if;

  if exists (
    select 1
    from app_portal.team_function_capabilities
    where capability_code = 'portal.admin'
  ) then
    raise exception
      'portal.admin wurde über TEAM_FUNCTION mapbar.';
  end if;

  if exists (
    select 1
    from app_portal.team_function_capabilities
    where function_code = 'BUS_KASSE'
  ) then
    raise exception
      'BUS_KASSE wurde in M010-R2 autorisierend verwendet.';
  end if;

  select id
  into v_role
  from app_portal.portal_roles
  where code = 'PORTAL_USER'
    and is_active;

  select id
  into v_bus_team
  from app_portal.teams
  where code = 'BUS_ORGA'
    and is_active;

  if v_role is null or v_bus_team is null then
    raise exception
      'M010-R2 Testvoraussetzung PORTAL_USER/BUS_ORGA fehlt.';
  end if;

  insert into auth.users (id, email)
  values
    (v_manager, 'm010-r2-manager@example.invalid'),
    (v_lead, 'm010-r2-lead@example.invalid'),
    (v_target, 'm010-r2-target@example.invalid'),
    (v_outsider, 'm010-r2-outsider@example.invalid');

  insert into app_portal.users (
    id,
    user_code,
    email,
    first_name,
    last_name,
    status,
    role_id
  )
  values
    (
      v_manager,
      'U-M010-R2-MANAGER',
      'm010-r2-manager@example.invalid',
      'M010',
      'Manager',
      'ACTIVE',
      v_role
    ),
    (
      v_lead,
      'U-M010-R2-LEAD',
      'm010-r2-lead@example.invalid',
      'M010',
      'Lead',
      'ACTIVE',
      v_role
    ),
    (
      v_target,
      'U-M010-R2-TARGET',
      'm010-r2-target@example.invalid',
      'M010',
      'Target',
      'ACTIVE',
      v_role
    ),
    (
      v_outsider,
      'U-M010-R2-OUTSIDER',
      'm010-r2-outsider@example.invalid',
      'M010',
      'Outsider',
      'ACTIVE',
      v_role
    );

  insert into app_portal.user_capabilities (
    user_id,
    capability_code,
    created_by
  )
  values
    (v_manager, 'teams.manage', v_manager),
    (
      v_outsider,
      'fanbus.registrations.manage',
      v_manager
    );

  insert into app_portal.team_memberships (
    team_id,
    user_id,
    team_role,
    is_active
  )
  values
    (v_bus_team, v_lead, 'CO_LEAD', true),
    (v_bus_team, v_target, 'MEMBER', true);

  if app_private.has_capability(
    v_target,
    'fanbus.registrations.manage'
  ) then
    raise exception
      'Teammitgliedschaft allein erzeugt ein Fachrecht.';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_manager::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub',
      v_manager,
      'role',
      'authenticated'
    )::text,
    true
  );

  v_response := public.pd_api(
    'set_team_functions',
    jsonb_build_object(
      'teamId',
      v_bus_team,
      'userId',
      v_target,
      'expectedRevision',
      1,
      'functionCodes',
      jsonb_build_array(
        'BUS_PARTICIPANTS_MANAGE'
      )
    )
  );

  if not coalesce(
    (v_response ->> 'ok')::boolean,
    false
  ) then
    raise exception
      'teams.manage konnte Fachfunktion nicht setzen: %',
      v_response;
  end if;

  if not app_private.has_capability(
    v_target,
    'fanbus.registrations.manage'
  ) then
    raise exception
      'TEAM_FUNCTION erzeugt das gemappte Fachrecht nicht.';
  end if;

  if app_private.has_capability(
    v_target,
    'fanbus.operations.manage'
  ) then
    raise exception
      'Teilnehmerfunktion erzeugt fremdes Operationsrecht.';
  end if;

  select revision
  into v_revision
  from app_portal.team_memberships
  where team_id = v_bus_team
    and user_id = v_target;

  if v_revision <> 2 then
    raise exception
      'Funktionsänderung erhöht Membership-Revision nicht: %',
      v_revision;
  end if;

  if not exists (
    select 1
    from app_private.notification_config_user_ids(
      array[
        'fanbusOrganization',
        'userIds'
      ]::text[]
    ) as recipient(user_id)
    where recipient.user_id = v_target
  ) then
    raise exception
      'BUS_ORGA Teilnehmermanager fehlt als M020-Empfänger.';
  end if;

  if exists (
    select 1
    from app_private.notification_config_user_ids(
      array[
        'fanbusOrganization',
        'userIds'
      ]::text[]
    ) as recipient(user_id)
    where recipient.user_id = v_outsider
  ) then
    raise exception
      'Registrierungsmanager außerhalb BUS_ORGA ist M020-Empfänger.';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_lead::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub',
      v_lead,
      'role',
      'authenticated'
    )::text,
    true
  );

  v_response := public.pd_api(
    'set_team_functions',
    jsonb_build_object(
      'teamId',
      v_bus_team,
      'userId',
      v_target,
      'expectedRevision',
      v_revision,
      'functionCodes',
      jsonb_build_array(
        'BUS_OPERATIONS'
      )
    )
  );

  if coalesce(
    (v_response ->> 'ok')::boolean,
    false
  )
  or v_response #>> '{error,code}' <> '42501' then
    raise exception
      'LEAD/CO_LEAD durfte Fachrechte vergeben: %',
      v_response;
  end if;

  if not app_private.has_capability(
    v_outsider,
    'fanbus.registrations.manage'
  ) then
    raise exception
      'PERSONAL-Ausnahmequelle wurde ungültig.';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_manager::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub',
      v_manager,
      'role',
      'authenticated'
    )::text,
    true
  );

  v_response := public.pd_api(
    'save_team',
    jsonb_build_object(
      'name',
      'M010 R2 CAS Test',
      'description',
      'Interner Teamcode',
      'active',
      true
    )
  );

  if not coalesce(
    (v_response ->> 'ok')::boolean,
    false
  ) then
    raise exception
      'Team ohne Browser-Teamcode konnte nicht erstellt werden: %',
      v_response;
  end if;

  select id, code
  into v_created_team, v_created_team_code
  from app_portal.teams
  where name = 'M010 R2 CAS Test';

  v_response := public.pd_api(
    'save_team',
    jsonb_build_object(
      'id',
      v_created_team,
      'expectedRevision',
      1,
      'name',
      'M010 R2 CAS Test aktualisiert',
      'description',
      'Interner Teamcode bleibt stabil',
      'active',
      true
    )
  );

  if not coalesce(
    (v_response ->> 'ok')::boolean,
    false
  )
  or (
    select code
    from app_portal.teams
    where id = v_created_team
  ) <> v_created_team_code then
    raise exception
      'Team-CAS oder interner Teamcode ist defekt: %',
      v_response;
  end if;

  v_response := public.pd_api(
    'save_team',
    jsonb_build_object(
      'id',
      v_created_team,
      'expectedRevision',
      1,
      'name',
      'M010 R2 stale',
      'active',
      true
    )
  );

  if coalesce(
    (v_response ->> 'ok')::boolean,
    false
  )
  or v_response #>> '{error,code}' <> '40001' then
    raise exception
      'Veraltete Teamrevision wurde akzeptiert: %',
      v_response;
  end if;

  insert into app_fanclub.members (
    id,
    member_code,
    first_name,
    last_name,
    status
  )
  values (
    v_member,
    'PD-M010-R2-SELF',
    'M010',
    'Self',
    'ACTIVE'
  );

  insert into app_portal.user_member_links (
    user_id,
    member_id,
    linked_by
  )
  values (
    v_target,
    v_member,
    v_manager
  );

  perform set_config(
    'request.jwt.claim.sub',
    v_target::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub',
      v_target,
      'role',
      'authenticated'
    )::text,
    true
  );

  v_snapshot :=
    app_private.api_fanclub_member_snapshot();

  if v_snapshot ->> 'scope' <> 'SELF'
     or jsonb_array_length(
       v_snapshot -> 'members'
     ) <> 1
     or jsonb_array_length(
       v_snapshot -> 'financeEntries'
     ) <> 0
     or coalesce(
       (v_snapshot ->> 'canViewMemberDetails')::boolean,
       true
     ) then
    raise exception
      'Self-Fanclub-Snapshot ist nicht sicher begrenzt: %',
      v_snapshot;
  end if;

  if exists (
    select 1
    from app_portal.users as portal_user
    join app_portal.portal_roles as role
      on role.id = portal_user.role_id
    where role.code = 'MEMBER'
  )
  or exists (
    select 1
    from app_portal.portal_roles
    where code = 'MEMBER'
      and is_active
  ) then
    raise exception
      'MEMBER-Rolle wurde nicht vollständig stillgelegt.';
  end if;
end;
$m010_r2_authorization$;

rollback;
