-- Plaerrdeifl Portal V4
-- P800 / M010-R1: zentrales additives Berechtigungsmodell.
-- Ausschliesslich fuer Supabase DEV vorgesehen.

create table app_portal.user_capabilities (
  user_id uuid not null
    references app_portal.users(id) on delete cascade,
  capability_code text not null
    references app_portal.capabilities(code) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid
    references app_portal.users(id) on delete set null,
  primary key (user_id, capability_code),
  constraint user_capabilities_portal_admin_check
    check (capability_code <> 'portal.admin')
);

create index user_capabilities_capability_idx
  on app_portal.user_capabilities(capability_code, user_id);

alter table app_portal.user_capabilities enable row level security;

revoke all on table app_portal.user_capabilities
  from public, anon, authenticated;

-- Die beiden frueheren globalen Task-Flags werden verlustfrei uebernommen.
insert into app_portal.user_capabilities (
  user_id,
  capability_code,
  created_at,
  created_by
)
select
  access_override.user_id,
  migrated.capability_code,
  access_override.updated_at,
  access_override.updated_by
from app_portal.user_task_access_overrides as access_override
cross join lateral (
  values
    ('tasks.create', access_override.can_create_tasks),
    ('tasks.manage', access_override.can_manage_tasks)
) as migrated(capability_code, enabled)
where migrated.enabled
on conflict (user_id, capability_code) do nothing;

insert into app_portal.audit_events (
  actor_user_id,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data,
  metadata
)
select
  access_override.updated_by,
  'USER_CAPABILITIES_MIGRATED',
  'user_capabilities',
  access_override.user_id::text,
  jsonb_build_object(
    'legacyTaskFlags', jsonb_build_object(
      'canCreateTasks', access_override.can_create_tasks,
      'canManageTasks', access_override.can_manage_tasks
    )
  ),
  jsonb_build_object(
    'personalCapabilities', coalesce((
      select jsonb_agg(
        personal.capability_code order by personal.capability_code
      )
      from app_portal.user_capabilities as personal
      where personal.user_id = access_override.user_id
    ), '[]'::jsonb)
  ),
  jsonb_build_object(
    'migration', 'M010-R1',
    'addedCapabilities', (
      select jsonb_agg(migrated.capability_code order by migrated.capability_code)
      from (
        values
          ('tasks.create', access_override.can_create_tasks),
          ('tasks.manage', access_override.can_manage_tasks)
      ) as migrated(capability_code, enabled)
      where migrated.enabled
    )
  )
from app_portal.user_task_access_overrides as access_override
where access_override.can_create_tasks
   or access_override.can_manage_tasks;

update app_portal.user_task_access_overrides
set can_create_tasks = false,
    can_manage_tasks = false
where can_create_tasks
   or can_manage_tasks;

alter table app_portal.user_task_access_overrides
  add constraint user_task_access_global_capabilities_centralized_check
  check (not can_create_tasks and not can_manage_tasks);

-- M210 bleibt bei events.manage; M010 ergaenzt nur die fuenf Office-Quellen.
insert into app_fanclub.office_capabilities (
  office_code,
  capability_code
)
select office.code, 'events.manage'
from app_fanclub.office_slots as office
where office.code in (
  'VORSTAND_1',
  'VORSTAND_2',
  'VORSTAND_3',
  'KASSIER',
  'SCHRIFTFUEHRER'
)
on conflict (office_code, capability_code) do nothing;

-- Eine einzige globale Engine: ROLE OR OFFICE OR PERSONAL,
-- zusaetzlich der bestehende ROLE-basierte portal.admin-Wildcard.
create or replace function app_private.has_capability(
  p_user_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_user as (
    select
      portal_user.id,
      portal_user.role_id
    from app_portal.users as portal_user
    join app_portal.portal_roles as role
      on role.id = portal_user.role_id
     and role.is_active
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
  ), requested_capability as (
    select capability.code
    from app_portal.capabilities as capability
    where capability.code = p_capability
      and capability.is_active
  )
  select exists (
    select 1
    from eligible_user
    cross join requested_capability
    where exists (
      select 1
      from app_portal.role_capabilities as role_capability
      join app_portal.capabilities as granted_capability
        on granted_capability.code = role_capability.capability_code
       and granted_capability.is_active
      where role_capability.role_id = eligible_user.role_id
        and role_capability.capability_code in (
          p_capability,
          'portal.admin'
        )
    )
    or exists (
      select 1
      from app_portal.user_member_links as link
      join app_fanclub.members as member
        on member.id = link.member_id
       and member.status = 'ACTIVE'
      join app_fanclub.office_slots as office
        on office.member_id = member.id
      join app_fanclub.office_capabilities as office_capability
        on office_capability.office_code = office.code
       and office_capability.capability_code = p_capability
      where link.user_id = eligible_user.id
    )
    or exists (
      select 1
      from app_portal.user_capabilities as personal
      where personal.user_id = eligible_user.id
        and personal.capability_code = p_capability
    )
  );
$$;

create or replace function app_private.user_capability_provenance(
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_user as (
    select
      portal_user.id,
      role.id as role_id,
      role.code as role_code,
      role.name as role_name
    from app_portal.users as portal_user
    join app_portal.portal_roles as role
      on role.id = portal_user.role_id
     and role.is_active
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
  ), sources as (
    select
      capability.code as capability_code,
      'ROLE'::text as source,
      jsonb_build_object(
        'roleId', eligible_user.role_id,
        'roleCode', eligible_user.role_code,
        'roleName', eligible_user.role_name
      ) as detail
    from eligible_user
    join app_portal.role_capabilities as role_capability
      on role_capability.role_id = eligible_user.role_id
    join app_portal.capabilities as capability
      on capability.code = role_capability.capability_code
     and capability.is_active

    union all

    select
      capability.code,
      'OFFICE'::text,
      jsonb_build_object(
        'officeCode', office.code,
        'officeLabel', office.label
      )
    from eligible_user
    join app_portal.user_member_links as link
      on link.user_id = eligible_user.id
    join app_fanclub.members as member
      on member.id = link.member_id
     and member.status = 'ACTIVE'
    join app_fanclub.office_slots as office
      on office.member_id = member.id
    join app_fanclub.office_capabilities as office_capability
      on office_capability.office_code = office.code
    join app_portal.capabilities as capability
      on capability.code = office_capability.capability_code
     and capability.is_active

    union all

    select
      capability.code,
      'PERSONAL'::text,
      jsonb_build_object(
        'createdAt', personal.created_at,
        'createdBy', personal.created_by
      )
    from eligible_user
    join app_portal.user_capabilities as personal
      on personal.user_id = eligible_user.id
    join app_portal.capabilities as capability
      on capability.code = personal.capability_code
     and capability.is_active

    union all

    select
      capability.code,
      'ADMIN_OVERRIDE'::text,
      jsonb_build_object(
        'roleId', eligible_user.role_id,
        'roleCode', eligible_user.role_code,
        'roleName', eligible_user.role_name,
        'wildcardCapability', 'portal.admin'
      )
    from eligible_user
    join app_portal.role_capabilities as admin_capability
      on admin_capability.role_id = eligible_user.role_id
     and admin_capability.capability_code = 'portal.admin'
    join app_portal.capabilities as admin_catalog
      on admin_catalog.code = admin_capability.capability_code
     and admin_catalog.is_active
    cross join app_portal.capabilities as capability
    where capability.is_active
      and capability.code <> 'portal.admin'
  ), source_rows as (
    select
      source.capability_code,
      jsonb_agg(
        jsonb_build_object(
          'source', source.source,
          'detail', source.detail
        )
        order by case source.source
          when 'ROLE' then 1
          when 'OFFICE' then 2
          when 'PERSONAL' then 3
          when 'ADMIN_OVERRIDE' then 4
          else 9
        end
      ) as source_list
    from sources as source
    group by source.capability_code
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', capability.code,
        'name', capability.name,
        'category', capability.category,
        'description', capability.description,
        'sortOrder', capability.sort_order,
        'effective', true,
        'sources', source_rows.source_list
      )
      order by capability.sort_order, capability.code
    ),
    '[]'::jsonb
  )
  from source_rows
  join app_portal.capabilities as capability
    on capability.code = source_rows.capability_code;
$$;

create or replace function app_private.user_capabilities(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(item.value ->> 'code' order by item.position),
    '[]'::jsonb
  )
  from jsonb_array_elements(
    app_private.user_capability_provenance(p_user_id)
  ) with ordinality as item(value, position);
$$;

-- Das Task-Profil verwendet fuer tasks.create/tasks.manage nur noch M010.
create or replace function app_private.task_access_profile(
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_baseline_manage boolean :=
    app_private.has_capability(p_user_id, 'tasks.manage');
  v_baseline_create boolean :=
    app_private.has_capability(p_user_id, 'tasks.create');
  v_office boolean := app_private.is_office_holder(p_user_id);
  v_has_team_membership boolean := false;
  v_has_team_leadership boolean := false;
  v_led_team_ids jsonb := '[]'::jsonb;
  v_override_team_ids jsonb := '[]'::jsonb;
  v_effective_team_ids jsonb := '[]'::jsonb;
  v_override app_portal.user_task_access_overrides%rowtype;
  v_override_exists boolean := false;
  v_archive_full boolean := false;
  v_archive_all_teams boolean := false;
  v_archive_own boolean := false;
  v_can_view_team boolean := false;
  v_can_view_board boolean := false;
  v_can_view_archive boolean := false;
  v_can_create boolean := false;
  v_can_manage boolean := false;
  v_can_transfer boolean := false;
begin
  select exists (
    select 1
    from app_portal.team_memberships as membership
    join app_portal.teams as team
      on team.id = membership.team_id
     and team.is_active
    where membership.user_id = p_user_id
      and membership.is_active
  ) into v_has_team_membership;

  select exists (
    select 1
    from app_portal.team_memberships as membership
    join app_portal.teams as team
      on team.id = membership.team_id
     and team.is_active
    where membership.user_id = p_user_id
      and membership.is_active
      and membership.team_role in ('LEAD', 'CO_LEAD')
  ) into v_has_team_leadership;

  select coalesce(
    jsonb_agg(membership.team_id order by membership.team_id),
    '[]'::jsonb
  )
  into v_led_team_ids
  from app_portal.team_memberships as membership
  join app_portal.teams as team
    on team.id = membership.team_id
   and team.is_active
  where membership.user_id = p_user_id
    and membership.is_active
    and membership.team_role in ('LEAD', 'CO_LEAD');

  select *
  into v_override
  from app_portal.user_task_access_overrides
  where user_id = p_user_id;

  v_override_exists := v_override.user_id is not null;

  select coalesce(
    jsonb_agg(selected_team.team_id order by selected_team.team_id),
    '[]'::jsonb
  )
  into v_override_team_ids
  from app_portal.user_task_archive_teams as selected_team
  join app_portal.teams as team
    on team.id = selected_team.team_id
   and team.is_active
  where selected_team.user_id = p_user_id;

  select coalesce(jsonb_agg(team_id order by team_id), '[]'::jsonb)
  into v_effective_team_ids
  from (
    select value::text::uuid as team_id
    from jsonb_array_elements_text(v_led_team_ids)
    union
    select value::text::uuid as team_id
    from jsonb_array_elements_text(
      case
        when v_override_exists
         and v_override.archive_scope = 'SELECTED_TEAMS'
          then v_override_team_ids
        else '[]'::jsonb
      end
    )
  ) as combined_teams;

  v_can_manage := v_baseline_manage;

  v_archive_full :=
    v_can_manage
    or v_office
    or (
      v_override_exists
      and v_override.archive_scope = 'FULL'
    );

  v_archive_all_teams :=
    not v_archive_full
    and v_override_exists
    and v_override.archive_scope = 'ALL_TEAMS';

  v_archive_own :=
    not v_archive_full
    and v_override_exists
    and v_override.archive_scope = 'OWN';

  v_can_view_team :=
    v_can_manage
    or v_office
    or v_has_team_membership
    or (
      v_override_exists
      and v_override.view_all_team_tasks
    );

  v_can_view_board :=
    v_can_manage
    or v_office
    or (
      v_override_exists
      and v_override.view_board_tasks
    );

  v_can_view_archive :=
    v_archive_full
    or v_archive_all_teams
    or v_archive_own
    or jsonb_array_length(v_effective_team_ids) > 0;

  v_can_create :=
    v_can_manage
    or v_office
    or v_has_team_leadership
    or (
      v_baseline_create
      and (
        v_has_team_membership
        or v_can_view_board
      )
    );

  v_can_transfer :=
    v_can_manage
    or v_office
    or v_has_team_leadership
    or (
      v_override_exists
      and v_override.can_direct_transfer
    );

  return jsonb_build_object(
    'baseline', jsonb_build_object(
      'canViewTeamSection',
        v_baseline_manage or v_office or v_has_team_membership,
      'canViewBoardSection', v_baseline_manage or v_office,
      'canViewArchiveSection',
        v_baseline_manage or v_office or v_has_team_leadership,
      'archiveFull', v_baseline_manage or v_office,
      'archiveTeamIds', v_led_team_ids,
      'canCreateTasks',
        v_baseline_manage
        or v_baseline_create
        or v_office
        or v_has_team_leadership,
      'canManageTasks', v_baseline_manage,
      'canDirectTransfer',
        v_baseline_manage or v_office or v_has_team_leadership
    ),
    'override', jsonb_build_object(
      'exists', v_override_exists,
      'viewAllTeamTasks', case
        when v_override_exists then v_override.view_all_team_tasks
        else false
      end,
      'viewBoardTasks', case
        when v_override_exists then v_override.view_board_tasks
        else false
      end,
      'archiveScope', case
        when v_override_exists then v_override.archive_scope
        else 'NONE'
      end,
      'archiveTeamIds', v_override_team_ids,
      'canCreateTasks', false,
      'canManageTasks', false,
      'canDirectTransfer', case
        when v_override_exists then v_override.can_direct_transfer
        else false
      end,
      'revision', case
        when v_override_exists then v_override.revision
        else 0
      end
    ),
    'effective', jsonb_build_object(
      'canViewMineSection', true,
      'canViewTeamSection', v_can_view_team,
      'canViewBoardSection', v_can_view_board,
      'canViewArchiveSection', v_can_view_archive,
      'archiveFull', v_archive_full,
      'archiveAllTeams', v_archive_all_teams,
      'archiveOwn', v_archive_own,
      'archiveTeamIds', v_effective_team_ids,
      'canCreateTasks', v_can_create,
      'canManageTasks', v_can_manage,
      'canDirectTransfer', v_can_transfer,
      'hasTeamMembership', v_has_team_membership,
      'hasTeamLeadership', v_has_team_leadership,
      'isOfficeHolder', v_office
    )
  );
end;
$$;

create or replace function app_private.task_override_enabled(
  p_user_id uuid,
  p_flag text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case p_flag
      when 'VIEW_ALL_TEAM_TASKS' then access_override.view_all_team_tasks
      when 'VIEW_BOARD_TASKS' then access_override.view_board_tasks
      when 'CAN_DIRECT_TRANSFER' then access_override.can_direct_transfer
      else false
    end
    from app_portal.user_task_access_overrides as access_override
    join app_portal.users as portal_user
      on portal_user.id = access_override.user_id
     and portal_user.status = 'ACTIVE'
    join app_portal.portal_roles as role
      on role.id = portal_user.role_id
     and role.is_active
    where access_override.user_id = p_user_id
  ), false);
$$;

drop function app_private.has_capability_before_user_task_access_r1(uuid, text);

alter function app_private.api_admin_snapshot()
  rename to api_admin_snapshot_before_m010_r1;

create or replace function app_private.api_admin_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_base jsonb := app_private.api_admin_snapshot_before_m010_r1();
  v_can_manage_personal boolean :=
    app_private.has_capability(v_actor, 'portal.admin');
  v_users jsonb := '[]'::jsonb;
  v_catalog jsonb := '[]'::jsonb;
begin
  if v_can_manage_personal then
    select coalesce(
      jsonb_agg(
        user_item.item
        || jsonb_build_object(
          'personalCapabilities', coalesce((
            select jsonb_agg(
              personal.capability_code
              order by personal.capability_code
            )
            from app_portal.user_capabilities as personal
            where personal.user_id = (user_item.item ->> 'id')::uuid
          ), '[]'::jsonb),
          'effectiveCapabilities',
            app_private.user_capability_provenance(
              (user_item.item ->> 'id')::uuid
            )
        )
        order by user_item.position
      ),
      '[]'::jsonb
    )
    into v_users
    from jsonb_array_elements(
      coalesce(v_base -> 'users', '[]'::jsonb)
    ) with ordinality as user_item(item, position);

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'code', capability.code,
          'name', capability.name,
          'category', capability.category,
          'description', capability.description,
          'sortOrder', capability.sort_order
        )
        order by capability.category,
                 capability.sort_order,
                 capability.code
      ),
      '[]'::jsonb
    )
    into v_catalog
    from app_portal.capabilities as capability
    where capability.is_active
      and capability.code <> 'portal.admin';

    v_base := jsonb_set(v_base, '{users}', v_users, true);
  end if;

  return v_base || jsonb_build_object(
    'canManagePersonalCapabilities', v_can_manage_personal,
    'personalCapabilityCatalog', case
      when v_can_manage_personal then v_catalog
      else '[]'::jsonb
    end
  );
end;
$$;

create or replace function app_private.api_set_user_capabilities(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('portal.admin');
  v_user_id uuid;
  v_requested jsonb := coalesce(p_payload -> 'capabilities', '[]'::jsonb);
  v_expected jsonb := coalesce(p_payload -> 'expectedCapabilities', '[]'::jsonb);
  v_before jsonb := '[]'::jsonb;
  v_after jsonb := '[]'::jsonb;
  v_added jsonb := '[]'::jsonb;
  v_removed jsonb := '[]'::jsonb;
begin
  begin
    v_user_id := nullif(p_payload ->> 'userId', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Portalbenutzer wurde nicht gefunden.'
      using errcode = 'P0002';
  end;

  if jsonb_typeof(v_requested) <> 'array'
     or jsonb_typeof(v_expected) <> 'array' then
    raise exception 'Capabilities muessen als Liste uebergeben werden.'
      using errcode = '22023';
  end if;

  perform 1
  from app_portal.users as target
  where target.id = v_user_id
  for update;

  if not found then
    raise exception 'Portalbenutzer wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  select coalesce(
    jsonb_agg(personal.capability_code order by personal.capability_code),
    '[]'::jsonb
  )
  into v_before
  from app_portal.user_capabilities as personal
  where personal.user_id = v_user_id;

  if jsonb_array_length(v_requested) <> (
    select count(distinct requested.code)
    from jsonb_array_elements_text(v_requested) as requested(code)
  ) or jsonb_array_length(v_expected) <> (
    select count(distinct expected.code)
    from jsonb_array_elements_text(v_expected) as expected(code)
  ) then
    raise exception 'Capability-Listen duerfen keine Duplikate enthalten.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_requested) as requested(code)
    where requested.code = 'portal.admin'
  ) then
    raise exception 'portal.admin kann nicht persoenlich vergeben werden.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_requested) as requested(code)
    left join app_portal.capabilities as capability
      on capability.code = requested.code
     and capability.is_active
    where capability.code is null
  ) then
    raise exception 'Mindestens eine Capability ist ungueltig oder inaktiv.'
      using errcode = '23503';
  end if;

  if v_before <> coalesce((
    select jsonb_agg(expected.code order by expected.code)
    from jsonb_array_elements_text(v_expected) as expected(code)
  ), '[]'::jsonb) then
    raise exception 'Die Zusatzrechte wurden zwischenzeitlich geaendert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  select coalesce(jsonb_agg(code order by code), '[]'::jsonb)
  into v_added
  from (
    select requested.code
    from jsonb_array_elements_text(v_requested) as requested(code)
    except
    select existing.code
    from jsonb_array_elements_text(v_before) as existing(code)
  ) as added;

  select coalesce(jsonb_agg(code order by code), '[]'::jsonb)
  into v_removed
  from (
    select existing.code
    from jsonb_array_elements_text(v_before) as existing(code)
    except
    select requested.code
    from jsonb_array_elements_text(v_requested) as requested(code)
  ) as removed;

  if jsonb_array_length(v_added) = 0
     and jsonb_array_length(v_removed) = 0 then
    return app_private.api_admin_snapshot();
  end if;

  delete from app_portal.user_capabilities as personal
  where personal.user_id = v_user_id
    and not exists (
      select 1
      from jsonb_array_elements_text(v_requested) as requested(code)
      where requested.code = personal.capability_code
    );

  insert into app_portal.user_capabilities (
    user_id,
    capability_code,
    created_by
  )
  select v_user_id, requested.code, v_actor
  from jsonb_array_elements_text(v_requested) as requested(code)
  on conflict (user_id, capability_code) do nothing;

  select coalesce(
    jsonb_agg(personal.capability_code order by personal.capability_code),
    '[]'::jsonb
  )
  into v_after
  from app_portal.user_capabilities as personal
  where personal.user_id = v_user_id;

  perform app_private.log_audit(
    v_actor,
    'USER_CAPABILITIES_UPDATED',
    'user_capabilities',
    v_user_id::text,
    jsonb_build_object('personalCapabilities', v_before),
    jsonb_build_object('personalCapabilities', v_after),
    jsonb_build_object(
      'targetUserId', v_user_id,
      'addedCapabilities', v_added,
      'removedCapabilities', v_removed
    )
  );

  return app_private.api_admin_snapshot();
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_m010_r1;

create or replace function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  if v_action = 'set_user_capabilities' then
    v_data := app_private.api_set_user_capabilities(
      coalesce(p_payload, '{}'::jsonb)
    );

    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  return public.pd_api_before_m010_r1(p_action, p_payload);
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', sqlstate,
        'message', sqlerrm
      )
    );
end;
$$;

comment on table app_portal.user_capabilities is
  'Additive persoenliche globale Capabilities; portal.admin ist ausgeschlossen.';

comment on function app_private.has_capability(uuid, text) is
  'Zentrale M010-Engine: ROLE OR OFFICE OR PERSONAL plus ADMIN_OVERRIDE, nur fuer ACTIVE User mit aktiver Rolle.';

comment on function app_private.user_capability_provenance(uuid) is
  'Liefert alle gleichzeitigen effektiven Capability-Quellen ROLE, OFFICE, PERSONAL und ADMIN_OVERRIDE.';

revoke all on function app_private.has_capability(uuid, text)
  from public, anon, authenticated;
revoke all on function app_private.user_capability_provenance(uuid)
  from public, anon, authenticated;
revoke all on function app_private.user_capabilities(uuid)
  from public, anon, authenticated;
revoke all on function app_private.task_access_profile(uuid)
  from public, anon, authenticated;
revoke all on function app_private.task_override_enabled(uuid, text)
  from public, anon, authenticated;
revoke all on function app_private.api_admin_snapshot_before_m010_r1()
  from public, anon, authenticated;
revoke all on function app_private.api_admin_snapshot()
  from public, anon, authenticated;
revoke all on function app_private.api_set_user_capabilities(jsonb)
  from public, anon, authenticated;
revoke all on function public.pd_api_before_m010_r1(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.pd_api(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.pd_api(text, jsonb)
  to authenticated;
