-- Plaerrdeifl Portal V4
-- P800 / M010-R2
-- F1-D1: sichere Verwaltung fachlicher Teamfunktionen.
--
-- WICHTIG:
-- LEAD / CO_LEAD bleiben organisatorische Teamrollen.
-- Nur teams.manage darf TEAM_FUNCTION-Fachrechte vergeben.
-- Mutationen verwenden optimistic concurrency über membership.revision.

-- ============================================================
-- 1. Teams-Snapshot um Fachfunktionen ergänzen
-- ============================================================

create or replace function app_private.api_teams_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_active_user();
  v_see_all boolean :=
    app_private.has_capability(v_user_id, 'teams.read');
  v_can_manage_all boolean :=
    app_private.has_capability(v_user_id, 'teams.manage');
begin
  return jsonb_build_object(
    'teams',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', team.id,
            'code', team.code,
            'name', team.name,
            'description', team.description,
            'active', team.is_active,
            'revision', team.revision,

            'canManage',
            app_private.can_manage_team(
              v_user_id,
              team.id
            ),

            'canManageFunctions',
            v_can_manage_all,

            'taskCount',
            (
              select count(*)
              from app_modules.tasks as task
              where task.team_id = team.id
            ),

            'activeTaskCount',
            (
              select count(*)
              from app_modules.tasks as task
              where task.team_id = team.id
                and task.status <> 'ARCHIVED'
            ),

            'archivedTaskCount',
            (
              select count(*)
              from app_modules.tasks as task
              where task.team_id = team.id
                and task.status = 'ARCHIVED'
            ),

            'canDelete',
            v_can_manage_all
            and not exists (
              select 1
              from app_modules.tasks as task
              where task.team_id = team.id
            ),

            'availableFunctions',
            case
              when v_can_manage_all then
                coalesce(
                  (
                    select jsonb_agg(
                      jsonb_build_object(
                        'code',
                        function_row.code,

                        'name',
                        function_row.name,

                        'description',
                        function_row.description,

                        'capabilities',
                        function_row.capabilities
                      )
                      order by function_row.name,
                               function_row.code
                    )
                    from (
                      select
                        team_function.code,
                        team_function.name,
                        team_function.description,

                        jsonb_agg(
                          distinct mapping.capability_code
                          order by mapping.capability_code
                        ) as capabilities

                      from app_portal.team_functions
                        as team_function

                      join app_portal.team_function_capabilities
                        as mapping
                        on mapping.function_code =
                           team_function.code
                       and mapping.team_id = team.id
                       and mapping.is_active

                      join app_portal.capabilities
                        as capability
                        on capability.code =
                           mapping.capability_code
                       and capability.is_active

                      where team_function.is_active

                      group by
                        team_function.code,
                        team_function.name,
                        team_function.description
                    ) as function_row
                  ),
                  '[]'::jsonb
                )
              else
                '[]'::jsonb
            end,

            'members',
            coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'userId',
                    membership.user_id,

                    'userCode',
                    portal_user.user_code,

                    'name',
                    portal_user.first_name
                    || ' '
                    || portal_user.last_name,

                    'role',
                    membership.team_role,

                    'active',
                    membership.is_active,

                    'revision',
                    membership.revision,

                    'functions',
                    case
                      when v_can_manage_all then
                        coalesce(
                          (
                            select jsonb_agg(
                              jsonb_build_object(
                                'code',
                                team_function.code,

                                'name',
                                team_function.name,

                                'description',
                                team_function.description
                              )
                              order by
                                team_function.name,
                                team_function.code
                            )
                            from app_portal.team_function_assignments
                              as assignment

                            join app_portal.team_functions
                              as team_function
                              on team_function.code =
                                 assignment.function_code
                             and team_function.is_active

                            where assignment.team_id =
                                  membership.team_id
                              and assignment.user_id =
                                  membership.user_id
                              and exists (
                                select 1
                                from app_portal.team_function_capabilities
                                  as assigned_mapping
                                join app_portal.capabilities
                                  as assigned_capability
                                  on assigned_capability.code =
                                     assigned_mapping.capability_code
                                 and assigned_capability.is_active
                                where assigned_mapping.team_id =
                                      assignment.team_id
                                  and assigned_mapping.function_code =
                                      assignment.function_code
                                  and assigned_mapping.is_active
                              )
                          ),
                          '[]'::jsonb
                        )
                      else
                        '[]'::jsonb
                    end
                  )
                  order by
                    case membership.team_role
                      when 'LEAD' then 1
                      when 'CO_LEAD' then 2
                      else 3
                    end,
                    portal_user.last_name,
                    portal_user.first_name
                )

                from app_portal.team_memberships
                  as membership

                join app_portal.users
                  as portal_user
                  on portal_user.id =
                     membership.user_id

                where membership.team_id =
                      team.id
              ),
              '[]'::jsonb
            )
          )
          order by team.name
        ),
        '[]'::jsonb
      )

      from app_portal.teams as team

      where v_see_all
         or app_private.is_team_member(
              v_user_id,
              team.id
            )
    ),

    'users',
    case
      when v_can_manage_all
        or exists (
          select 1
          from app_portal.team_memberships
            as own_membership
          where own_membership.user_id =
                v_user_id
            and own_membership.is_active
            and own_membership.team_role
                in ('LEAD', 'CO_LEAD')
        )
      then (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id',
              portal_user.id,

              'userCode',
              portal_user.user_code,

              'name',
              portal_user.first_name
              || ' '
              || portal_user.last_name
            )
            order by
              portal_user.last_name,
              portal_user.first_name
          ),
          '[]'::jsonb
        )

        from app_portal.users
          as portal_user

        where portal_user.status = 'ACTIVE'
      )

      else (
        select coalesce(
          jsonb_agg(
            distinct jsonb_build_object(
              'id',
              portal_user.id,

              'userCode',
              portal_user.user_code,

              'name',
              portal_user.first_name
              || ' '
              || portal_user.last_name
            )
          ),
          '[]'::jsonb
        )

        from app_portal.team_memberships
          as own_membership

        join app_portal.team_memberships
          as membership
          on membership.team_id =
             own_membership.team_id
         and membership.is_active

        join app_portal.users
          as portal_user
          on portal_user.id =
             membership.user_id
         and portal_user.status = 'ACTIVE'

        where own_membership.user_id =
              v_user_id
          and own_membership.is_active
          and own_membership.team_role
              in ('LEAD', 'CO_LEAD')
      )
    end,

    'canCreateTeam',
    v_can_manage_all,

    'canManageTeamFunctions',
    v_can_manage_all
  );
end;
$$;

-- ============================================================
-- 2. Team selbst: expectedRevision
-- ============================================================

create or replace function app_private.api_save_team(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid :=
    app_private.require_capability(
      'teams.manage'
    );

  v_id uuid :=
    nullif(
      p_payload ->> 'id',
      ''
    )::uuid;

  v_expected_revision integer :=
    nullif(
      p_payload ->> 'expectedRevision',
      ''
    )::integer;

  v_code text;

  v_name text :=
    app_private.require_valid_name(
      p_payload ->> 'name',
      'Teamname'
    );

  v_description text :=
    left(
      btrim(
        coalesce(
          p_payload ->> 'description',
          ''
        )
      ),
      2000
    );

  v_active boolean :=
    coalesce(
      (p_payload ->> 'active')::boolean,
      true
    );

  v_existing app_portal.teams%rowtype;
begin
  if v_id is null then
    v_code := app_private.next_team_code(v_name);

    insert into app_portal.teams (
      code,
      name,
      description,
      is_active
    )
    values (
      v_code,
      v_name,
      v_description,
      v_active
    )
    returning *
    into v_existing;

    perform app_private.log_audit(
      v_actor,
      'TEAM_CREATED',
      'team',
      v_existing.id::text,
      null,
      jsonb_build_object(
        'code',
        v_existing.code,

        'name',
        v_existing.name,

        'revision',
        v_existing.revision
      )
    );

  else
    select *
    into v_existing
    from app_portal.teams
    where id = v_id
    for update;

    if not found then
      raise exception
        'Team wurde nicht gefunden.'
        using errcode = 'P0002';
    end if;

    if v_expected_revision is null
       or v_expected_revision <>
          v_existing.revision then
      raise exception
        'STALE_TEAM_REVISION'
        using errcode = '40001';
    end if;

    v_code := v_existing.code;

    update app_portal.teams
    set
      name = v_name,
      description = v_description,
      is_active = v_active,
      revision = revision + 1
    where id = v_id;

    perform app_private.log_audit(
      v_actor,
      'TEAM_UPDATED',
      'team',
      v_id::text,

      jsonb_build_object(
        'code',
        v_existing.code,

        'name',
        v_existing.name,

        'active',
        v_existing.is_active,

        'revision',
        v_existing.revision
      ),

      jsonb_build_object(
        'code',
        v_code,

        'name',
        v_name,

        'active',
        v_active,

        'revision',
        v_existing.revision + 1
      )
    );
  end if;

  return app_private.api_teams_snapshot();
end;
$$;

-- ============================================================
-- 3. Teammitglied speichern: CAS
-- ============================================================

create or replace function app_private.api_save_team_member(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid :=
    app_private.require_active_user();

  v_team_id uuid :=
    (p_payload ->> 'teamId')::uuid;

  v_target_user_id uuid :=
    (p_payload ->> 'userId')::uuid;

  v_role text :=
    upper(
      coalesce(
        p_payload ->> 'role',
        'MEMBER'
      )
    );

  v_expected_revision integer :=
    nullif(
      p_payload ->> 'expectedRevision',
      ''
    )::integer;

  v_global_manager boolean :=
    app_private.has_capability(
      v_actor,
      'teams.manage'
    );

  v_existing
    app_portal.team_memberships%rowtype;
begin
  if not app_private.can_manage_team(
    v_actor,
    v_team_id
  ) then
    raise exception
      'Teamverwaltung ist nicht erlaubt.'
      using errcode = '42501';
  end if;

  if v_role not in (
    'LEAD',
    'CO_LEAD',
    'MEMBER'
  ) then
    raise exception
      'Unzulässige Teamrolle.'
      using errcode = '22023';
  end if;

  if v_role = 'LEAD'
     and not v_global_manager then
    raise exception
      'Nur Portaladministratoren dürfen die Teamleitung ändern.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from app_portal.users
    where id = v_target_user_id
      and status = 'ACTIVE'
  ) then
    raise exception
      'Aktiver Portalbenutzer wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  select *
  into v_existing
  from app_portal.team_memberships
  where team_id = v_team_id
    and user_id = v_target_user_id
  for update;

  if found then
    if v_expected_revision is null
       or v_expected_revision <>
          v_existing.revision then
      raise exception
        'STALE_TEAM_MEMBERSHIP_REVISION'
        using errcode = '40001';
    end if;

    if v_target_user_id = v_actor
       and v_existing.team_role = 'LEAD'
       and v_role <> 'LEAD'
       and not v_global_manager then
      raise exception
        'Die Teamleitung darf sich nicht selbst herabstufen.'
        using errcode = '42501';
    end if;
  end if;

  if v_role = 'LEAD'
     and v_global_manager then
    update app_portal.team_memberships
    set
      team_role = 'MEMBER',
      revision = revision + 1
    where team_id = v_team_id
      and user_id <> v_target_user_id
      and is_active
      and team_role = 'LEAD';
  end if;

  if v_existing.team_id is null then
    insert into app_portal.team_memberships (
      team_id,
      user_id,
      team_role,
      is_active
    )
    values (
      v_team_id,
      v_target_user_id,
      v_role,
      true
    );

  else
    update app_portal.team_memberships
    set
      team_role = v_role,
      is_active = true,
      revision = revision + 1
    where team_id = v_team_id
      and user_id = v_target_user_id;
  end if;

  if (
    select count(*)
    from app_portal.team_memberships
    where team_id = v_team_id
      and is_active
      and team_role = 'CO_LEAD'
  ) > 2 then
    raise exception
      'Ein Team darf höchstens zwei aktive Co-Teamleiter besitzen.'
      using errcode = '23514';
  end if;

  perform app_private.log_audit(
    v_actor,
    'TEAM_MEMBER_SAVED',
    'team_membership',
    v_team_id::text
    || ':'
    || v_target_user_id::text,

    case
      when v_existing.team_id is null
        then null
      else
        jsonb_build_object(
          'role',
          v_existing.team_role,

          'active',
          v_existing.is_active,

          'revision',
          v_existing.revision
        )
    end,

    jsonb_build_object(
      'role',
      v_role,

      'active',
      true
    )
  );

  return app_private.api_teams_snapshot();
end;
$$;

-- ============================================================
-- 4. Teammitglied entfernen: CAS + Rechte löschen
-- ============================================================

create or replace function app_private.api_remove_team_member(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid :=
    app_private.require_active_user();

  v_team_id uuid :=
    (p_payload ->> 'teamId')::uuid;

  v_target_user_id uuid :=
    (p_payload ->> 'userId')::uuid;

  v_expected_revision integer :=
    nullif(
      p_payload ->> 'expectedRevision',
      ''
    )::integer;

  v_global_manager boolean :=
    app_private.has_capability(
      v_actor,
      'teams.manage'
    );

  v_membership
    app_portal.team_memberships%rowtype;

  v_assignment record;
begin
  if not app_private.can_manage_team(
    v_actor,
    v_team_id
  ) then
    raise exception
      'Teamverwaltung ist nicht erlaubt.'
      using errcode = '42501';
  end if;

  select *
  into v_membership
  from app_portal.team_memberships
  where team_id = v_team_id
    and user_id = v_target_user_id
    and is_active
  for update;

  if not found then
    raise exception
      'Aktive Teammitgliedschaft wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision is null
     or v_expected_revision <>
        v_membership.revision then
    raise exception
      'STALE_TEAM_MEMBERSHIP_REVISION'
      using errcode = '40001';
  end if;

  if v_membership.team_role = 'LEAD'
     and not v_global_manager then
    raise exception
      'Nur Portaladministratoren dürfen die Teamleitung entfernen.'
      using errcode = '42501';
  end if;

  if v_target_user_id = v_actor
     and v_membership.team_role = 'LEAD'
     and not v_global_manager then
    raise exception
      'Die Teamleitung darf sich nicht selbst entfernen.'
      using errcode = '42501';
  end if;

  for v_assignment in
    delete from app_portal.team_function_assignments
    where team_id = v_team_id
      and user_id = v_target_user_id
    returning function_code
  loop
    perform app_private.log_audit(
      v_actor,
      'TEAM_FUNCTION_REMOVED',
      'team_function_assignment',
      v_team_id::text
      || ':'
      || v_target_user_id::text
      || ':'
      || v_assignment.function_code,

      jsonb_build_object(
        'teamId',
        v_team_id,

        'userId',
        v_target_user_id,

        'functionCode',
        v_assignment.function_code
      ),

      null,

      jsonb_build_object(
        'reason',
        'TEAM_MEMBERSHIP_REMOVED'
      )
    );
  end loop;

  update app_portal.team_memberships
  set
    is_active = false,
    revision = revision + 1
  where team_id = v_team_id
    and user_id = v_target_user_id;

  perform app_private.log_audit(
    v_actor,
    'TEAM_MEMBER_REMOVED',
    'team_membership',
    v_team_id::text
    || ':'
    || v_target_user_id::text,

    jsonb_build_object(
      'role',
      v_membership.team_role,

      'active',
      true,

      'revision',
      v_membership.revision
    ),

    jsonb_build_object(
      'role',
      v_membership.team_role,

      'active',
      false,

      'revision',
      v_membership.revision + 1
    )
  );

  return app_private.api_teams_snapshot();
end;
$$;

-- ============================================================
-- 5. Fachfunktionen atomar setzen
-- ============================================================
--
-- Ausschließlich teams.manage.
-- can_manage_team reicht ausdrücklich NICHT.

create function app_private.api_set_team_functions(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid :=
    app_private.require_capability(
      'teams.manage'
    );

  v_team_id uuid;
  v_target_user_id uuid;
  v_expected_revision integer;
  v_function_codes jsonb;

  v_membership
    app_portal.team_memberships%rowtype;

  v_function_code text;
  v_changed boolean := false;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array[
       'teamId',
       'userId',
       'expectedRevision',
       'functionCodes'
     ] then
    raise exception
      'TEAM_FUNCTIONS_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  begin
    v_team_id :=
      (p_payload ->> 'teamId')::uuid;

    v_target_user_id :=
      (p_payload ->> 'userId')::uuid;

    v_expected_revision :=
      (p_payload ->> 'expectedRevision')::integer;

  exception
    when others then
      raise exception
        'TEAM_FUNCTIONS_INVALID_PAYLOAD'
        using errcode = '22023';
  end;

  v_function_codes :=
    p_payload -> 'functionCodes';

  if jsonb_typeof(v_function_codes) <> 'array'
     or v_expected_revision <= 0 then
    raise exception
      'TEAM_FUNCTIONS_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(
      v_function_codes
    ) as item(value)
    where jsonb_typeof(item.value) <> 'string'
  ) > 0 then
    raise exception
      'TEAM_FUNCTIONS_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements_text(
      v_function_codes
    ) as item(code)
  ) <> (
    select count(
      distinct item.code
    )
    from jsonb_array_elements_text(
      v_function_codes
    ) as item(code)
  ) then
    raise exception
      'TEAM_FUNCTIONS_DUPLICATE_CODE'
      using errcode = '22023';
  end if;

  select *
  into v_membership
  from app_portal.team_memberships
  where team_id = v_team_id
    and user_id = v_target_user_id
    and is_active
  for update;

  if not found then
    raise exception
      'ACTIVE_TEAM_MEMBERSHIP_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_membership.revision <>
     v_expected_revision then
    raise exception
      'STALE_TEAM_MEMBERSHIP_REVISION'
      using errcode = '40001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(
      v_function_codes
    ) as requested(code)

    where not exists (
      select 1
      from app_portal.team_functions
        as team_function

      join app_portal.team_function_capabilities
        as mapping
        on mapping.function_code =
           team_function.code
       and mapping.team_id =
           v_team_id
       and mapping.is_active

      join app_portal.capabilities
        as capability
        on capability.code =
           mapping.capability_code
       and capability.is_active

      where team_function.code =
            requested.code
        and team_function.is_active
    )
  ) then
    raise exception
      'TEAM_FUNCTION_NOT_AVAILABLE_FOR_TEAM'
      using errcode = '22023';
  end if;

  for v_function_code in
    select assignment.function_code
    from app_portal.team_function_assignments
      as assignment

    where assignment.team_id =
          v_team_id

      and assignment.user_id =
          v_target_user_id

      and not exists (
        select 1
        from jsonb_array_elements_text(
          v_function_codes
        ) as desired(code)

        where desired.code =
              assignment.function_code
      )
      and exists (
        select 1
        from app_portal.team_functions
          as assigned_function
        join app_portal.team_function_capabilities
          as assigned_mapping
          on assigned_mapping.function_code =
             assigned_function.code
         and assigned_mapping.team_id =
             assignment.team_id
         and assigned_mapping.is_active
        join app_portal.capabilities
          as assigned_capability
          on assigned_capability.code =
             assigned_mapping.capability_code
         and assigned_capability.is_active
        where assigned_function.code =
              assignment.function_code
          and assigned_function.is_active
      )
  loop
    delete from app_portal.team_function_assignments
    where team_id = v_team_id
      and user_id = v_target_user_id
      and function_code = v_function_code;

    v_changed := true;

    perform app_private.log_audit(
      v_actor,
      'TEAM_FUNCTION_REMOVED',
      'team_function_assignment',
      v_team_id::text
      || ':'
      || v_target_user_id::text
      || ':'
      || v_function_code,

      jsonb_build_object(
        'teamId',
        v_team_id,

        'userId',
        v_target_user_id,

        'functionCode',
        v_function_code
      ),

      null
    );
  end loop;

  for v_function_code in
    select desired.code
    from jsonb_array_elements_text(
      v_function_codes
    ) as desired(code)

    where not exists (
      select 1
      from app_portal.team_function_assignments
        as assignment
      where assignment.team_id =
            v_team_id
        and assignment.user_id =
            v_target_user_id
        and assignment.function_code =
            desired.code
    )
  loop
    insert into app_portal.team_function_assignments (
      team_id,
      user_id,
      function_code,
      created_by
    )
    values (
      v_team_id,
      v_target_user_id,
      v_function_code,
      v_actor
    );

    v_changed := true;

    perform app_private.log_audit(
      v_actor,
      'TEAM_FUNCTION_ASSIGNED',
      'team_function_assignment',
      v_team_id::text
      || ':'
      || v_target_user_id::text
      || ':'
      || v_function_code,

      null,

      jsonb_build_object(
        'teamId',
        v_team_id,

        'userId',
        v_target_user_id,

        'functionCode',
        v_function_code
      )
    );
  end loop;

  if v_changed then
    update app_portal.team_memberships
    set revision = revision + 1
    where team_id = v_team_id
      and user_id = v_target_user_id;
  end if;

  return app_private.api_teams_snapshot();
end;
$$;

-- ============================================================
-- 6. pd_api um genau eine neue Action erweitern
-- ============================================================

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_m010_r2_team_functions;

create function public.pd_api(
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
    lower(
      btrim(
        coalesce(
          p_action,
          ''
        )
      )
    );
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception
      'Anmeldung erforderlich.'
      using errcode = '42501';
  end if;

  if v_action = 'set_team_functions' then
    v_data := app_private.api_set_team_functions(
      coalesce(
        p_payload,
        '{}'::jsonb
      )
    );

    return jsonb_build_object(
      'ok',
      true,
      'data',
      v_data
    );
  end if;

  return public.pd_api_before_m010_r2_team_functions(
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

-- ============================================================
-- 7. Privilege hardening
-- ============================================================

revoke all on function
  app_private.api_set_team_functions(jsonb),
  public.pd_api_before_m010_r2_team_functions(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_set_team_functions(jsonb),
  public.pd_api_before_m010_r2_team_functions(text, jsonb)
to postgres;

revoke all on function
  public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_api(text, jsonb)
to authenticated;

comment on function
  app_private.api_set_team_functions(jsonb)
is
  'M010-R2: atomische TEAM_FUNCTION-Zuweisung mit teams.manage und Membership-CAS.';

comment on function
  public.pd_api(text, jsonb)
is
  'M010-R2: authenticated API boundary; ergänzt set_team_functions und delegiert alle bestehenden Actions unverändert.';
