-- Plärrdeifl Portal V4
-- Administrierbare Aufgabenrechte R1
-- Rollenstandard plus additive benutzerspezifische Zusatzrechte.
-- Ausschließlich für Supabase DEV vorgesehen.

create table app_portal.user_task_access_overrides (
  user_id uuid primary key
    references app_portal.users(id) on delete cascade,
  view_all_team_tasks boolean not null default false,
  view_board_tasks boolean not null default false,
  archive_scope text not null default 'NONE',
  can_create_tasks boolean not null default false,
  can_manage_tasks boolean not null default false,
  can_direct_transfer boolean not null default false,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
    references app_portal.users(id) on delete set null,
  constraint user_task_access_archive_scope_check
    check (
      archive_scope in (
        'NONE',
        'OWN',
        'SELECTED_TEAMS',
        'ALL_TEAMS',
        'FULL'
      )
    ),
  constraint user_task_access_revision_check
    check (revision >= 1)
);

create table app_portal.user_task_archive_teams (
  user_id uuid not null
    references app_portal.user_task_access_overrides(user_id)
    on delete cascade,
  team_id uuid not null
    references app_portal.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid
    references app_portal.users(id) on delete set null,
  primary key (user_id, team_id)
);

create index user_task_archive_teams_team_idx
  on app_portal.user_task_archive_teams(team_id, user_id);

alter table app_portal.user_task_access_overrides
  enable row level security;

alter table app_portal.user_task_archive_teams
  enable row level security;

revoke all on table app_portal.user_task_access_overrides
  from public, anon, authenticated;

revoke all on table app_portal.user_task_archive_teams
  from public, anon, authenticated;

alter function app_private.has_capability(uuid, text)
  rename to has_capability_before_user_task_access_r1;

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
  select
    app_private.has_capability_before_user_task_access_r1(
      p_user_id,
      p_capability
    )
    or exists (
      select 1
      from app_portal.users as portal_user
      join app_portal.user_task_access_overrides as access_override
        on access_override.user_id = portal_user.id
      where portal_user.id = p_user_id
        and portal_user.status = 'ACTIVE'
        and (
          (
            p_capability = 'tasks.create'
            and access_override.can_create_tasks
          )
          or (
            p_capability = 'tasks.manage'
            and access_override.can_manage_tasks
          )
        )
    );
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
      when 'CAN_CREATE_TASKS' then access_override.can_create_tasks
      when 'CAN_MANAGE_TASKS' then access_override.can_manage_tasks
      when 'CAN_DIRECT_TRANSFER' then access_override.can_direct_transfer
      else false
    end
    from app_portal.user_task_access_overrides as access_override
    join app_portal.users as portal_user
      on portal_user.id = access_override.user_id
     and portal_user.status = 'ACTIVE'
    where access_override.user_id = p_user_id
  ), false);
$$;

create or replace function app_private.task_has_global_manage(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_capability(p_user_id, 'tasks.manage');
$$;

create or replace function app_private.task_can_view_all_teams(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_private.task_has_global_manage(p_user_id)
    or app_private.is_office_holder(p_user_id)
    or app_private.task_override_enabled(
      p_user_id,
      'VIEW_ALL_TEAM_TASKS'
    );
$$;

create or replace function app_private.task_can_view_board(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_private.task_has_global_manage(p_user_id)
    or app_private.is_office_holder(p_user_id)
    or app_private.task_override_enabled(
      p_user_id,
      'VIEW_BOARD_TASKS'
    );
$$;

create or replace function app_private.task_archive_is_visible(
  p_user_id uuid,
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_modules.tasks as task
    left join app_portal.user_task_access_overrides as access_override
      on access_override.user_id = p_user_id
    where task.id = p_task_id
      and task.status = 'ARCHIVED'
      and (
        app_private.task_has_global_manage(p_user_id)
        or app_private.is_office_holder(p_user_id)
        or (
          task.context_type = 'TEAM'
          and exists (
            select 1
            from app_portal.team_memberships as membership
            join app_portal.teams as team
              on team.id = membership.team_id
             and team.is_active
            where membership.user_id = p_user_id
              and membership.is_active
              and membership.team_role in ('LEAD', 'CO_LEAD')
              and membership.team_id = task.team_id
          )
        )
        or access_override.archive_scope = 'FULL'
        or (
          access_override.archive_scope = 'ALL_TEAMS'
          and task.context_type = 'TEAM'
        )
        or (
          access_override.archive_scope = 'OWN'
          and task.assigned_user_id = p_user_id
        )
        or (
          access_override.archive_scope = 'SELECTED_TEAMS'
          and task.context_type = 'TEAM'
          and exists (
            select 1
            from app_portal.user_task_archive_teams as selected_team
            join app_portal.teams as team
              on team.id = selected_team.team_id
             and team.is_active
            where selected_team.user_id = p_user_id
              and selected_team.team_id = task.team_id
          )
        )
      )
  );
$$;

create or replace function app_private.task_is_visible(
  p_user_id uuid,
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_modules.tasks as task
    where task.id = p_task_id
      and (
        (
          task.status = 'ARCHIVED'
          and app_private.task_archive_is_visible(
            p_user_id,
            task.id
          )
        )
        or (
          task.status <> 'ARCHIVED'
          and (
            app_private.task_has_global_manage(p_user_id)
            or task.assigned_user_id = p_user_id
            or (
              task.context_type = 'TEAM'
              and (
                app_private.is_team_member(
                  p_user_id,
                  task.team_id
                )
                or app_private.task_can_view_all_teams(p_user_id)
              )
            )
            or (
              task.context_type = 'BOARD'
              and app_private.task_can_view_board(p_user_id)
            )
          )
        )
      )
  );
$$;

create or replace function app_private.task_is_manageable(
  p_user_id uuid,
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_modules.tasks as task
    where task.id = p_task_id
      and task.status <> 'ARCHIVED'
      and (
        app_private.task_has_global_manage(p_user_id)
        or task.created_by = p_user_id
        or (
          task.context_type = 'TEAM'
          and app_private.can_manage_team(
            p_user_id,
            task.team_id
          )
        )
        or (
          task.context_type = 'BOARD'
          and app_private.is_office_holder(p_user_id)
        )
      )
  );
$$;

create or replace function app_private.task_can_reopen_or_archive(
  p_user_id uuid,
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_modules.tasks as task
    where task.id = p_task_id
      and (
        app_private.task_has_global_manage(p_user_id)
        or (
          task.context_type = 'TEAM'
          and app_private.can_manage_team(
            p_user_id,
            task.team_id
          )
        )
        or (
          task.context_type = 'BOARD'
          and app_private.is_office_holder(p_user_id)
        )
      )
  );
$$;

create or replace function app_private.task_can_create_team(
  p_user_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_portal.teams as team
    where team.id = p_team_id
      and team.is_active
      and (
        app_private.task_has_global_manage(p_user_id)
        or app_private.can_manage_team(p_user_id, team.id)
        or (
          app_private.has_capability(
            p_user_id,
            'tasks.create'
          )
          and app_private.is_team_member(
            p_user_id,
            team.id
          )
        )
      )
  );
$$;

create or replace function app_private.task_can_create_board(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_private.task_has_global_manage(p_user_id)
    or app_private.is_office_holder(p_user_id)
    or (
      app_private.has_capability(
        p_user_id,
        'tasks.create'
      )
      and app_private.task_can_view_board(p_user_id)
    );
$$;

create or replace function app_private.task_can_direct_transfer(
  p_user_id uuid,
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_modules.tasks as task
    where task.id = p_task_id
      and task.status in ('OPEN', 'IN_PROGRESS', 'WAITING')
      and app_private.task_is_visible(p_user_id, task.id)
      and (
        app_private.task_can_reopen_or_archive(
          p_user_id,
          task.id
        )
        or app_private.task_override_enabled(
          p_user_id,
          'CAN_DIRECT_TRANSFER'
        )
      )
  );
$$;

create or replace function app_private.task_transfer_target_allowed(
  p_actor uuid,
  p_task_id uuid,
  p_target uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_modules.tasks as task
    join app_portal.users as target
      on target.id = p_target
     and target.status = 'ACTIVE'
    where task.id = p_task_id
      and target.id is distinct from task.assigned_user_id
      and (
        (
          task.context_type = 'TEAM'
          and app_private.is_team_member(
            target.id,
            task.team_id
          )
        )
        or (
          task.context_type = 'BOARD'
          and app_private.task_can_direct_transfer(
            p_actor,
            task.id
          )
        )
      )
  );
$$;

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
    app_private.has_capability_before_user_task_access_r1(
      p_user_id,
      'tasks.manage'
    );
  v_baseline_create boolean :=
    app_private.has_capability_before_user_task_access_r1(
      p_user_id,
      'tasks.create'
    );
  v_office boolean :=
    app_private.is_office_holder(p_user_id);
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
  )
  into v_has_team_membership;

  select exists (
    select 1
    from app_portal.team_memberships as membership
    join app_portal.teams as team
      on team.id = membership.team_id
     and team.is_active
    where membership.user_id = p_user_id
      and membership.is_active
      and membership.team_role in ('LEAD', 'CO_LEAD')
  )
  into v_has_team_leadership;

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

  select coalesce(
    jsonb_agg(team_id order by team_id),
    '[]'::jsonb
  )
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

  v_can_manage :=
    app_private.task_has_global_manage(p_user_id);

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
      (
        v_baseline_create
        or (
          v_override_exists
          and v_override.can_create_tasks
        )
      )
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
    'baseline',
    jsonb_build_object(
      'canViewTeamSection',
        v_baseline_manage or v_office or v_has_team_membership,
      'canViewBoardSection',
        v_baseline_manage or v_office,
      'canViewArchiveSection',
        v_baseline_manage or v_office or v_has_team_leadership,
      'archiveFull',
        v_baseline_manage or v_office,
      'archiveTeamIds',
        v_led_team_ids,
      'canCreateTasks',
        v_baseline_manage
        or v_baseline_create
        or v_office
        or v_has_team_leadership,
      'canManageTasks',
        v_baseline_manage,
      'canDirectTransfer',
        v_baseline_manage
        or v_office
        or v_has_team_leadership
    ),
    'override',
    jsonb_build_object(
      'exists', v_override_exists,
      'viewAllTeamTasks',
        case
          when v_override_exists
            then v_override.view_all_team_tasks
          else false
        end,
      'viewBoardTasks',
        case
          when v_override_exists
            then v_override.view_board_tasks
          else false
        end,
      'archiveScope',
        case
          when v_override_exists
            then v_override.archive_scope
          else 'NONE'
        end,
      'archiveTeamIds',
        v_override_team_ids,
      'canCreateTasks',
        case
          when v_override_exists
            then v_override.can_create_tasks
          else false
        end,
      'canManageTasks',
        case
          when v_override_exists
            then v_override.can_manage_tasks
          else false
        end,
      'canDirectTransfer',
        case
          when v_override_exists
            then v_override.can_direct_transfer
          else false
        end,
      'revision',
        case
          when v_override_exists
            then v_override.revision
          else 0
        end
    ),
    'effective',
    jsonb_build_object(
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

alter function app_private.api_tasks_snapshot()
  rename to api_tasks_snapshot_before_user_task_access_r1;

create or replace function app_private.api_tasks_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_base jsonb :=
    app_private.api_tasks_snapshot_before_user_task_access_r1();
  v_profile jsonb :=
    app_private.task_access_profile(v_actor);
  v_tasks jsonb := '[]'::jsonb;
  v_teams jsonb := '[]'::jsonb;
  v_users jsonb := '[]'::jsonb;
  v_transfer_users jsonb := '[]'::jsonb;
  v_can_create boolean :=
    coalesce(
      (v_profile #>> '{effective,canCreateTasks}')::boolean,
      false
    );
  v_can_transfer boolean :=
    coalesce(
      (v_profile #>> '{effective,canDirectTransfer}')::boolean,
      false
    );
begin
  select coalesce(
    jsonb_agg(
      task_item.item
      || jsonb_build_object(
        'canImmediateTransfer',
        app_private.task_can_direct_transfer(
          v_actor,
          (task_item.item ->> 'id')::uuid
        )
      )
      order by task_item.position
    ),
    '[]'::jsonb
  )
  into v_tasks
  from jsonb_array_elements(
    coalesce(v_base -> 'tasks', '[]'::jsonb)
  ) with ordinality as task_item(item, position);

  select coalesce(
    jsonb_agg(
      team_item.item
      || jsonb_build_object(
        'canCreate',
        app_private.task_can_create_team(
          v_actor,
          (team_item.item ->> 'id')::uuid
        )
      )
      order by team_item.position
    ),
    '[]'::jsonb
  )
  into v_teams
  from jsonb_array_elements(
    coalesce(v_base -> 'teams', '[]'::jsonb)
  ) with ordinality as team_item(item, position);

  if v_can_create then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', portal_user.id,
          'name',
            portal_user.first_name || ' ' || portal_user.last_name,
          'isOfficeHolder',
            app_private.is_office_holder(portal_user.id),
          'officeLabel',
            coalesce((
              select office.label
              from app_portal.user_member_links as link
              join app_fanclub.office_slots as office
                on office.member_id = link.member_id
              where link.user_id = portal_user.id
              limit 1
            ), '')
        )
        order by portal_user.last_name, portal_user.first_name
      ),
      '[]'::jsonb
    )
    into v_users
    from app_portal.users as portal_user
    where portal_user.status = 'ACTIVE';
  else
    v_users := coalesce(v_base -> 'users', '[]'::jsonb);
  end if;

  if v_can_transfer then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', portal_user.id,
          'name',
            portal_user.first_name || ' ' || portal_user.last_name,
          'isOfficeHolder',
            app_private.is_office_holder(portal_user.id),
          'teamIds',
            coalesce((
              select jsonb_agg(
                membership.team_id
                order by membership.team_id
              )
              from app_portal.team_memberships as membership
              join app_portal.teams as team
                on team.id = membership.team_id
               and team.is_active
              where membership.user_id = portal_user.id
                and membership.is_active
            ), '[]'::jsonb)
        )
        order by portal_user.last_name, portal_user.first_name
      ),
      '[]'::jsonb
    )
    into v_transfer_users
    from app_portal.users as portal_user
    where portal_user.status = 'ACTIVE';
  else
    v_transfer_users :=
      coalesce(v_base -> 'transferUsers', '[]'::jsonb);
  end if;

  v_base := jsonb_set(v_base, '{tasks}', v_tasks, true);
  v_base := jsonb_set(v_base, '{teams}', v_teams, true);
  v_base := jsonb_set(v_base, '{users}', v_users, true);
  v_base := jsonb_set(
    v_base,
    '{transferUsers}',
    v_transfer_users,
    true
  );
  v_base := jsonb_set(
    v_base,
    '{canCreateBoard}',
    to_jsonb(app_private.task_can_create_board(v_actor)),
    true
  );
  v_base := jsonb_set(
    v_base,
    '{canManageAll}',
    to_jsonb(app_private.task_has_global_manage(v_actor)),
    true
  );

  return v_base || jsonb_build_object(
    'taskAccess',
    v_profile -> 'effective'
  );
end;
$$;

create or replace function app_private.api_save_task(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_context text :=
    upper(coalesce(p_payload ->> 'context', 'TEAM'));
  v_team_id uuid :=
    nullif(p_payload ->> 'teamId', '')::uuid;
  v_title text :=
    btrim(coalesce(p_payload ->> 'title', ''));
  v_description text :=
    left(coalesce(p_payload ->> 'description', ''), 4000);
  v_priority text :=
    upper(coalesce(p_payload ->> 'priority', 'NORMAL'));
  v_assigned_user_id uuid :=
    nullif(p_payload ->> 'assignedUserId', '')::uuid;
  v_assignment_reason text :=
    left(
      btrim(coalesce(p_payload ->> 'assignmentReason', '')),
      1000
    );
  v_existing app_modules.tasks%rowtype;
  v_before jsonb;
begin
  if v_context not in ('TEAM', 'BOARD') then
    raise exception 'Unzulässiger Aufgabenkontext.'
      using errcode = '22023';
  end if;

  if length(v_title) < 1 or length(v_title) > 300 then
    raise exception 'Der Aufgabentitel ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_priority not in ('URGENT', 'HIGH', 'NORMAL', 'LOW') then
    raise exception 'Unzulässige Priorität.'
      using errcode = '22023';
  end if;

  if v_id is not null then
    select *
    into v_existing
    from app_modules.tasks
    where id = v_id
    for update;

    if v_existing.id is null then
      raise exception 'Aufgabe wurde nicht gefunden.'
        using errcode = 'P0002';
    end if;

    if v_existing.status = 'ARCHIVED' then
      raise exception
        'Archivierte Aufgaben können nicht mehr bearbeitet werden.'
        using errcode = '42501';
    end if;

    if not app_private.task_is_manageable(v_actor, v_id) then
      raise exception 'Aufgabe darf nicht bearbeitet werden.'
        using errcode = '42501';
    end if;

    if v_expected_revision is null
       or v_expected_revision <> v_existing.revision then
      raise exception
        'Die Aufgabe wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
        using errcode = '40001';
    end if;

    if v_assigned_user_id
       is distinct from v_existing.assigned_user_id then
      raise exception
        'Die Zuständigkeit kann nur über „Aufgabe übertragen“ geändert werden.'
        using errcode = '23514';
    end if;

    v_before := to_jsonb(v_existing);
  end if;

  if v_assigned_user_id is not null and not exists (
    select 1
    from app_portal.users
    where id = v_assigned_user_id
      and status = 'ACTIVE'
  ) then
    raise exception 'Aktiver Zielbenutzer wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  if v_context = 'TEAM' then
    if v_team_id is null then
      raise exception 'Für eine Teamaufgabe ist ein Team erforderlich.'
        using errcode = '22023';
    end if;

    if v_id is null then
      if not app_private.task_can_create_team(
        v_actor,
        v_team_id
      ) then
        raise exception
          'In diesem Team dürfen keine Aufgaben erstellt werden.'
          using errcode = '42501';
      end if;
    elsif not (
      app_private.task_has_global_manage(v_actor)
      or app_private.can_manage_team(v_actor, v_team_id)
      or (
        v_existing.created_by = v_actor
        and app_private.task_can_create_team(
          v_actor,
          v_team_id
        )
      )
    ) then
      raise exception
        'Teamaufgabe darf in diesem Team nicht bearbeitet werden.'
        using errcode = '42501';
    end if;

    if v_assigned_user_id is not null
       and not app_private.is_team_member(
         v_assigned_user_id,
         v_team_id
       ) then
      raise exception
        'Teamaufgaben dürfen nur aktiven Teammitgliedern zugewiesen werden.'
        using errcode = '23514';
    end if;

    v_assignment_reason := '';
  else
    v_team_id := null;

    if v_id is null then
      if not app_private.task_can_create_board(v_actor) then
        raise exception
          'Vorstandsaufgaben dürfen in diesem Zugriff nicht erstellt werden.'
          using errcode = '42501';
      end if;
    elsif not (
      app_private.task_has_global_manage(v_actor)
      or app_private.is_office_holder(v_actor)
      or (
        v_existing.created_by = v_actor
        and app_private.task_can_create_board(v_actor)
      )
    ) then
      raise exception
        'Vorstandsaufgabe darf nicht bearbeitet werden.'
        using errcode = '42501';
    end if;

    if v_assigned_user_id is null
       or app_private.is_office_holder(v_assigned_user_id) then
      v_assignment_reason := '';
    elsif length(v_assignment_reason) < 1 then
      raise exception
        'Bei Zuweisung an einen Nicht-Amtsinhaber ist eine Begründung erforderlich.'
        using errcode = '23514';
    end if;
  end if;

  if v_id is null then
    insert into app_modules.tasks (
      context_type,
      team_id,
      title,
      description,
      priority,
      assigned_user_id,
      assignment_reason,
      created_by
    )
    values (
      v_context,
      v_team_id,
      v_title,
      v_description,
      v_priority,
      v_assigned_user_id,
      v_assignment_reason,
      v_actor
    )
    returning id into v_id;

    perform app_private.task_history_add_entry(
      v_id,
      v_actor,
      'TASK_CREATED',
      'Aufgabe wurde erstellt.',
      jsonb_build_object(
        'context', v_context,
        'teamId', v_team_id,
        'assignedUserId', v_assigned_user_id
      )
    );

    perform app_private.log_audit(
      v_actor,
      'TASK_CREATED',
      'task',
      v_id::text,
      null,
      jsonb_build_object(
        'context', v_context,
        'teamId', v_team_id,
        'assignedUserId', v_assigned_user_id
      )
    );
  else
    update app_modules.tasks
    set context_type = v_context,
        team_id = v_team_id,
        title = v_title,
        description = v_description,
        priority = v_priority,
        assignment_reason = v_assignment_reason,
        revision = revision + 1
    where id = v_id;

    perform app_private.task_history_add_entry(
      v_id,
      v_actor,
      'TASK_CHANGED',
      'Aufgabe wurde bearbeitet.',
      jsonb_build_object(
        'context', v_context,
        'teamId', v_team_id,
        'priority', v_priority
      )
    );

    perform app_private.log_audit(
      v_actor,
      'TASK_UPDATED',
      'task',
      v_id::text,
      v_before,
      jsonb_build_object(
        'context', v_context,
        'teamId', v_team_id,
        'assignedUserId', v_assigned_user_id,
        'revision', v_expected_revision + 1
      )
    );
  end if;

  return app_private.api_tasks_snapshot();
end;
$$;

create or replace function app_private.api_task_transfer(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_operation text :=
    upper(btrim(coalesce(p_payload ->> 'operation', '')));
  v_task_id uuid :=
    nullif(p_payload ->> 'taskId', '')::uuid;
  v_task_revision integer :=
    nullif(p_payload ->> 'taskRevision', '')::integer;
  v_target uuid :=
    nullif(p_payload ->> 'targetUserId', '')::uuid;
  v_reason text :=
    left(btrim(coalesce(p_payload ->> 'reason', '')), 1000);
  v_handover text :=
    left(btrim(coalesce(p_payload ->> 'handoverNote', '')), 4000);
  v_task app_modules.tasks%rowtype;
  v_transfer_id uuid;
  v_target_name text;
  v_from_name text;
  v_actor_name text :=
    app_private.task_history_user_name(v_actor);
begin
  if v_operation <> 'IMMEDIATE' then
    raise exception
      'Übertragungsanfragen sind deaktiviert. Verwende die direkte Aufgabenübertragung.'
      using errcode = '0A000';
  end if;

  select *
  into v_task
  from app_modules.tasks
  where id = v_task_id
  for update;

  if v_task.id is null
     or not app_private.task_is_visible(
       v_actor,
       v_task_id
     ) then
    raise exception 'Aufgabe wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_task.status not in ('OPEN', 'IN_PROGRESS', 'WAITING') then
    raise exception 'Diese Aufgabe kann nicht übertragen werden.'
      using errcode = '23514';
  end if;

  if v_task_revision is null
     or v_task_revision <> v_task.revision then
    raise exception
      'Die Aufgabe wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if not app_private.task_can_direct_transfer(
    v_actor,
    v_task_id
  ) then
    raise exception
      'Direkte Aufgabenübertragung ist nicht erlaubt.'
      using errcode = '42501';
  end if;

  if v_target is null
     or not app_private.task_transfer_target_allowed(
       v_actor,
       v_task_id,
       v_target
     ) then
    raise exception
      'Zielperson ist für diese Aufgabe nicht zulässig.'
      using errcode = '23514';
  end if;

  if length(v_reason) < 1 then
    raise exception
      'Ein Grund für die Übertragung ist erforderlich.'
      using errcode = '22023';
  end if;

  select first_name || ' ' || last_name
  into v_target_name
  from app_portal.users
  where id = v_target
    and status = 'ACTIVE';

  if v_target_name is null then
    raise exception
      'Aktive Zielperson wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  v_from_name := case
    when v_task.assigned_user_id is null
      then 'Noch nicht zugewiesen'
    else app_private.task_history_user_name(
      v_task.assigned_user_id
    )
  end;

  insert into app_modules.task_transfers (
    task_id,
    task_id_snapshot,
    task_title_snapshot,
    from_user_id,
    from_name_snapshot,
    to_user_id,
    to_name_snapshot,
    requested_by,
    requested_by_name_snapshot,
    transfer_mode,
    status,
    reason,
    handover_note,
    requested_at,
    responded_at,
    responded_by
  )
  values (
    v_task.id,
    v_task.id,
    v_task.title,
    v_task.assigned_user_id,
    v_from_name,
    v_target,
    v_target_name,
    v_actor,
    v_actor_name,
    'IMMEDIATE',
    'ACCEPTED',
    v_reason,
    v_handover,
    now(),
    now(),
    v_actor
  )
  returning id into v_transfer_id;

  update app_modules.tasks
  set assigned_user_id = v_target,
      assignment_reason = case
        when context_type = 'BOARD'
         and not app_private.is_office_holder(v_target)
          then v_reason
        else ''
      end,
      revision = revision + 1
  where id = v_task_id;

  perform app_private.task_history_add_entry(
    v_task_id,
    v_actor,
    'TRANSFER_IMMEDIATE',
    format(
      'Aufgabe wurde von %s an %s übertragen.',
      v_from_name,
      v_target_name
    ),
    jsonb_build_object(
      'transferId', v_transfer_id,
      'reason', v_reason,
      'handoverNote', v_handover
    )
  );

  perform app_private.task_notification_queue(
    v_task_id,
    v_actor,
    'TASK_TRANSFER_IMMEDIATE',
    'Aufgabe wurde dir übertragen',
    v_task.title,
    'task-transfer-immediate:' || v_transfer_id::text,
    v_target
  );

  perform app_private.log_audit(
    v_actor,
    'TASK_TRANSFER_IMMEDIATE',
    'task_transfer',
    v_transfer_id::text,
    null,
    jsonb_build_object(
      'taskId', v_task_id,
      'fromUserId', v_task.assigned_user_id,
      'toUserId', v_target,
      'reason', v_reason,
      'handoverNote', v_handover
    )
  );

  return app_private.api_tasks_snapshot();
end;
$$;

alter function app_private.api_bootstrap()
  rename to api_bootstrap_before_user_task_access_r1;

create or replace function app_private.api_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base jsonb :=
    app_private.api_bootstrap_before_user_task_access_r1();
  v_actor uuid := auth.uid();
  v_profile jsonb;
  v_tasks_visible boolean := false;
begin
  if v_actor is not null
     and v_base ->> 'state' = 'ACTIVE' then
    v_profile :=
      app_private.task_access_profile(v_actor);

    v_tasks_visible :=
      coalesce(
        (v_profile #>> '{effective,canViewTeamSection}')::boolean,
        false
      )
      or coalesce(
        (v_profile #>> '{effective,canViewBoardSection}')::boolean,
        false
      )
      or coalesce(
        (v_profile #>> '{effective,canViewArchiveSection}')::boolean,
        false
      )
      or coalesce(
        (v_profile #>> '{effective,canCreateTasks}')::boolean,
        false
      )
      or exists (
        select 1
        from app_modules.tasks as task
        where task.status <> 'ARCHIVED'
          and task.assigned_user_id = v_actor
      );

    v_base := jsonb_set(
      v_base,
      '{navigation,tasks}',
      to_jsonb(v_tasks_visible),
      true
    );
  end if;

  return v_base;
end;
$$;

alter function app_private.api_admin_snapshot()
  rename to api_admin_snapshot_before_user_task_access_r1;

create or replace function app_private.api_admin_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_base jsonb :=
    app_private.api_admin_snapshot_before_user_task_access_r1();
  v_can_manage_task_access boolean :=
    app_private.has_capability(v_actor, 'portal.admin');
  v_users jsonb := '[]'::jsonb;
  v_teams jsonb := '[]'::jsonb;
begin
  if v_can_manage_task_access then
    select coalesce(
      jsonb_agg(
        user_item.item
        || jsonb_build_object(
          'taskAccess',
          app_private.task_access_profile(
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
          'id', team.id,
          'name', team.name
        )
        order by team.name
      ),
      '[]'::jsonb
    )
    into v_teams
    from app_portal.teams as team
    where team.is_active;

    v_base := jsonb_set(
      v_base,
      '{users}',
      v_users,
      true
    );
  end if;

  return v_base || jsonb_build_object(
    'canManageTaskAccess',
    v_can_manage_task_access,
    'taskAccessTeams',
    case
      when v_can_manage_task_access
        then v_teams
      else '[]'::jsonb
    end
  );
end;
$$;

create or replace function app_private.api_save_user_task_access(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid :=
    app_private.require_capability('portal.admin');
  v_user_id uuid :=
    nullif(p_payload ->> 'userId', '')::uuid;
  v_expected_revision integer :=
    coalesce(
      nullif(p_payload ->> 'revision', '')::integer,
      0
    );
  v_reset boolean :=
    coalesce((p_payload ->> 'reset')::boolean, false);
  v_view_all_team_tasks boolean :=
    coalesce(
      (p_payload ->> 'viewAllTeamTasks')::boolean,
      false
    );
  v_view_board_tasks boolean :=
    coalesce(
      (p_payload ->> 'viewBoardTasks')::boolean,
      false
    );
  v_archive_scope text :=
    upper(
      btrim(
        coalesce(p_payload ->> 'archiveScope', 'NONE')
      )
    );
  v_archive_team_ids jsonb :=
    coalesce(p_payload -> 'archiveTeamIds', '[]'::jsonb);
  v_can_create_tasks boolean :=
    coalesce(
      (p_payload ->> 'canCreateTasks')::boolean,
      false
    );
  v_can_manage_tasks boolean :=
    coalesce(
      (p_payload ->> 'canManageTasks')::boolean,
      false
    );
  v_can_direct_transfer boolean :=
    coalesce(
      (p_payload ->> 'canDirectTransfer')::boolean,
      false
    );
  v_existing app_portal.user_task_access_overrides%rowtype;
  v_before jsonb := null;
  v_after jsonb := null;
begin
  if v_user_id is null or not exists (
    select 1
    from app_portal.users
    where id = v_user_id
  ) then
    raise exception 'Portalbenutzer wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  select *
  into v_existing
  from app_portal.user_task_access_overrides
  where user_id = v_user_id
  for update;

  if v_existing.user_id is not null then
    v_before := app_private.task_access_profile(v_user_id);

    if v_expected_revision <> v_existing.revision then
      raise exception
        'Die Aufgabenrechte wurden zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
        using errcode = '40001';
    end if;
  elsif v_expected_revision <> 0 then
    raise exception
      'Die Aufgabenrechte wurden zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if v_reset then
    delete from app_portal.user_task_access_overrides
    where user_id = v_user_id;

    perform app_private.log_audit(
      v_actor,
      'USER_TASK_ACCESS_RESET',
      'user_task_access',
      v_user_id::text,
      v_before,
      app_private.task_access_profile(v_user_id)
    );

    return app_private.api_admin_snapshot();
  end if;

  if v_archive_scope not in (
    'NONE',
    'OWN',
    'SELECTED_TEAMS',
    'ALL_TEAMS',
    'FULL'
  ) then
    raise exception 'Unzulässiger Archivumfang.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(v_archive_team_ids) <> 'array' then
    raise exception
      'Die ausgewählten Archivteams sind ungültig.'
      using errcode = '22023';
  end if;

  if v_archive_scope = 'SELECTED_TEAMS'
     and jsonb_array_length(v_archive_team_ids) < 1 then
    raise exception
      'Für ausgewählte Teamarchive muss mindestens ein Team gewählt werden.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_archive_team_ids)
      as requested(team_id)
    left join app_portal.teams as team
      on team.id = requested.team_id::uuid
     and team.is_active
    where team.id is null
  ) then
    raise exception
      'Mindestens ein ausgewähltes Archivteam ist nicht aktiv.'
      using errcode = '23503';
  end if;

  if not (
    v_view_all_team_tasks
    or v_view_board_tasks
    or v_archive_scope <> 'NONE'
    or v_can_create_tasks
    or v_can_manage_tasks
    or v_can_direct_transfer
  ) then
    delete from app_portal.user_task_access_overrides
    where user_id = v_user_id;
  else
    insert into app_portal.user_task_access_overrides (
      user_id,
      view_all_team_tasks,
      view_board_tasks,
      archive_scope,
      can_create_tasks,
      can_manage_tasks,
      can_direct_transfer,
      revision,
      updated_at,
      updated_by
    )
    values (
      v_user_id,
      v_view_all_team_tasks,
      v_view_board_tasks,
      v_archive_scope,
      v_can_create_tasks,
      v_can_manage_tasks,
      v_can_direct_transfer,
      1,
      now(),
      v_actor
    )
    on conflict (user_id)
    do update set
      view_all_team_tasks = excluded.view_all_team_tasks,
      view_board_tasks = excluded.view_board_tasks,
      archive_scope = excluded.archive_scope,
      can_create_tasks = excluded.can_create_tasks,
      can_manage_tasks = excluded.can_manage_tasks,
      can_direct_transfer = excluded.can_direct_transfer,
      revision =
        app_portal.user_task_access_overrides.revision + 1,
      updated_at = now(),
      updated_by = v_actor;

    delete from app_portal.user_task_archive_teams
    where user_id = v_user_id;

    if v_archive_scope = 'SELECTED_TEAMS' then
      insert into app_portal.user_task_archive_teams (
        user_id,
        team_id,
        created_by
      )
      select distinct
        v_user_id,
        requested.team_id::uuid,
        v_actor
      from jsonb_array_elements_text(v_archive_team_ids)
        as requested(team_id);
    end if;
  end if;

  v_after := app_private.task_access_profile(v_user_id);

  perform app_private.log_audit(
    v_actor,
    'USER_TASK_ACCESS_UPDATED',
    'user_task_access',
    v_user_id::text,
    v_before,
    v_after
  );

  return app_private.api_admin_snapshot();
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_user_task_access_r1;

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
  v_action text :=
    lower(btrim(coalesce(p_action, '')));
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.'
      using errcode = '42501';
  end if;

  if v_action = 'save_user_task_access' then
    v_data :=
      app_private.api_save_user_task_access(
        coalesce(p_payload, '{}'::jsonb)
      );

    return jsonb_build_object(
      'ok',
      true,
      'data',
      v_data
    );
  end if;

  return public.pd_api_before_user_task_access_r1(
    p_action,
    p_payload
  );
exception
  when others then
    return jsonb_build_object(
      'ok',
      false,
      'error',
      jsonb_build_object(
        'code',
        sqlstate,
        'message',
        sqlerrm
      )
    );
end;
$$;

revoke all on function
  app_private.has_capability_before_user_task_access_r1(uuid, text)
from public, anon, authenticated;

revoke all on function app_private.has_capability(uuid, text)
from public, anon, authenticated;

revoke all on function
  app_private.task_override_enabled(uuid, text)
from public, anon, authenticated;

revoke all on function
  app_private.task_has_global_manage(uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_can_view_all_teams(uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_can_view_board(uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_archive_is_visible(uuid, uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_is_visible(uuid, uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_is_manageable(uuid, uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_can_reopen_or_archive(uuid, uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_can_create_team(uuid, uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_can_create_board(uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_can_direct_transfer(uuid, uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_transfer_target_allowed(uuid, uuid, uuid)
from public, anon, authenticated;

revoke all on function
  app_private.task_access_profile(uuid)
from public, anon, authenticated;

revoke all on function
  app_private.api_tasks_snapshot_before_user_task_access_r1()
from public, anon, authenticated;

revoke all on function app_private.api_tasks_snapshot()
from public, anon, authenticated;

revoke all on function app_private.api_save_task(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_task_transfer(jsonb)
from public, anon, authenticated;

revoke all on function
  app_private.api_bootstrap_before_user_task_access_r1()
from public, anon, authenticated;

revoke all on function app_private.api_bootstrap()
from public, anon, authenticated;

revoke all on function
  app_private.api_admin_snapshot_before_user_task_access_r1()
from public, anon, authenticated;

revoke all on function app_private.api_admin_snapshot()
from public, anon, authenticated;

revoke all on function
  app_private.api_save_user_task_access(jsonb)
from public, anon, authenticated;

revoke all on function
  public.pd_api_before_user_task_access_r1(text, jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api(text, jsonb)
from public, anon;

grant execute on function public.pd_api(text, jsonb)
to authenticated;
