begin;

-- AP-03/R1: first read-only Cockpit access contract.
-- No user is enrolled by this migration. Cockpit access remains explicit and
-- independent from global Portal roles and capabilities.

create table app_portal.cockpit_access (
  user_id uuid primary key
    references app_portal.users(id) on delete cascade,
  role text not null,
  is_enabled boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  created_by uuid
    references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default pg_catalog.now(),
  updated_by uuid
    references app_portal.users(id) on delete set null,
  constraint cockpit_access_role_check
    check (role in ('SYSTEM_ADMIN', 'ADMIN', 'USER')),
  constraint cockpit_access_revision_check
    check (revision > 0)
);

alter table app_portal.cockpit_access enable row level security;

revoke all on table app_portal.cockpit_access
  from public, anon, authenticated, service_role;

create trigger cockpit_access_set_updated_at
before update on app_portal.cockpit_access
for each row execute function app_private.set_updated_at();

comment on table app_portal.cockpit_access is
  'Explicit Cockpit-only enrollment, role, block state and optimistic revision. No row means no Cockpit access.';

create function app_private.cockpit_user_has_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from app_portal.users as portal_user
    join app_portal.portal_roles as portal_role
      on portal_role.id = portal_user.role_id
     and portal_role.is_active
    join app_portal.cockpit_access as cockpit_access
      on cockpit_access.user_id = portal_user.id
     and cockpit_access.is_enabled
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
  );
$function$;

-- Keep the established central capability engine authoritative. Cockpit
-- SYSTEM_ADMIN is an additional source for exactly the two Cockpit modules;
-- it never grants portal.admin or any unrelated capability.
create or replace function app_private.has_capability(
  p_user_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
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
  ),
  requested_capability as (
    select capability.code
    from app_portal.capabilities as capability
    where capability.code = p_capability
      and capability.is_active
  )
  select exists (
    select 1
    from eligible_user
    cross join requested_capability
    where
      exists (
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
        from app_portal.team_memberships as membership
        join app_portal.teams as team
          on team.id = membership.team_id
         and team.is_active
        join app_portal.team_function_assignments as assignment
          on assignment.team_id = membership.team_id
         and assignment.user_id = membership.user_id
        join app_portal.team_functions as team_function
          on team_function.code = assignment.function_code
         and team_function.is_active
        join app_portal.team_function_capabilities as function_capability
          on function_capability.team_id = assignment.team_id
         and function_capability.function_code = assignment.function_code
         and function_capability.capability_code = p_capability
         and function_capability.is_active
        where membership.user_id = eligible_user.id
          and membership.is_active
      )
      or exists (
        select 1
        from app_portal.user_capabilities as personal
        where personal.user_id = eligible_user.id
          and personal.capability_code = p_capability
      )
      or (
        p_capability in (
          'liveticker.manage',
          'social_media_generator.use'
        )
        and exists (
          select 1
          from app_portal.cockpit_access as cockpit_access
          where cockpit_access.user_id = eligible_user.id
            and cockpit_access.is_enabled
            and cockpit_access.role = 'SYSTEM_ADMIN'
        )
      )
  );
$function$;

-- Keep provenance and app_private.user_capabilities() consistent with the
-- central decision above. All pre-existing sources remain unchanged.
create or replace function app_private.user_capability_provenance(
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
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
  ),
  sources as (
    select
      capability.code as capability_code,
      'ROLE'::text as source,
      pg_catalog.jsonb_build_object(
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
      pg_catalog.jsonb_build_object(
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
      'TEAM_FUNCTION'::text,
      pg_catalog.jsonb_build_object(
        'teamCode', team.code,
        'teamName', team.name,
        'functionCode', team_function.code,
        'functionName', team_function.name
      )
    from eligible_user
    join app_portal.team_memberships as membership
      on membership.user_id = eligible_user.id
     and membership.is_active
    join app_portal.teams as team
      on team.id = membership.team_id
     and team.is_active
    join app_portal.team_function_assignments as assignment
      on assignment.team_id = membership.team_id
     and assignment.user_id = membership.user_id
    join app_portal.team_functions as team_function
      on team_function.code = assignment.function_code
     and team_function.is_active
    join app_portal.team_function_capabilities as function_capability
      on function_capability.team_id = assignment.team_id
     and function_capability.function_code = assignment.function_code
     and function_capability.is_active
    join app_portal.capabilities as capability
      on capability.code = function_capability.capability_code
     and capability.is_active

    union all

    select
      capability.code,
      'PERSONAL'::text,
      pg_catalog.jsonb_build_object(
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
      pg_catalog.jsonb_build_object(
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

    union all

    select
      capability.code,
      'COCKPIT_SYSTEM_ADMIN'::text,
      pg_catalog.jsonb_build_object(
        'cockpitRole', cockpit_access.role,
        'cockpitRevision', cockpit_access.revision
      )
    from eligible_user
    join app_portal.cockpit_access as cockpit_access
      on cockpit_access.user_id = eligible_user.id
     and cockpit_access.is_enabled
     and cockpit_access.role = 'SYSTEM_ADMIN'
    join app_portal.capabilities as capability
      on capability.code in (
        'liveticker.manage',
        'social_media_generator.use'
      )
     and capability.is_active
  ),
  source_rows as (
    select
      capability_source.capability_code,
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'source', capability_source.source,
          'detail', capability_source.detail
        )
        order by
          case capability_source.source
            when 'ROLE' then 1
            when 'OFFICE' then 2
            when 'TEAM_FUNCTION' then 3
            when 'PERSONAL' then 4
            when 'ADMIN_OVERRIDE' then 5
            when 'COCKPIT_SYSTEM_ADMIN' then 6
            else 9
          end,
          capability_source.detail::text
      ) as source_list
    from sources as capability_source
    group by capability_source.capability_code
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
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
$function$;

create function app_private.api_cockpit_access_get(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_portal_status text := 'MISSING';
  v_portal_active boolean := false;
  v_assignment app_portal.cockpit_access%rowtype;
  v_assigned boolean := false;
  v_access_allowed boolean := false;
  v_reason text;
  v_liveticker_personal boolean := false;
  v_generator_personal boolean := false;
  v_social_media_team boolean := false;
  v_liveticker_effective boolean := false;
  v_generator_effective boolean := false;
begin
  if v_user_id is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  select
    portal_user.status,
    portal_user.status = 'ACTIVE' and portal_role.is_active
  into
    v_portal_status,
    v_portal_active
  from app_portal.users as portal_user
  join app_portal.portal_roles as portal_role
    on portal_role.id = portal_user.role_id
  where portal_user.id = v_user_id;

  if not found then
    v_portal_status := 'MISSING';
    v_portal_active := false;
  end if;

  select cockpit_access.*
  into v_assignment
  from app_portal.cockpit_access as cockpit_access
  where cockpit_access.user_id = v_user_id;
  v_assigned := found;

  v_access_allowed := app_private.cockpit_user_has_access(v_user_id);

  select exists (
    select 1
    from app_portal.user_capabilities as personal
    where personal.user_id = v_user_id
      and personal.capability_code = 'liveticker.manage'
  ) into v_liveticker_personal;

  select exists (
    select 1
    from app_portal.user_capabilities as personal
    where personal.user_id = v_user_id
      and personal.capability_code = 'social_media_generator.use'
  ) into v_generator_personal;

  select exists (
    select 1
    from app_portal.team_memberships as membership
    join app_portal.teams as team
      on team.id = membership.team_id
     and team.is_active
    where membership.user_id = v_user_id
      and membership.is_active
      and team.code = 'SOCIAL_MEDIA'
  ) into v_social_media_team;

  v_liveticker_effective := v_access_allowed and app_private.has_capability(
    v_user_id,
    'liveticker.manage'
  );
  v_generator_effective := v_access_allowed and
    app_private.social_media_generator_user_has_access(v_user_id);

  v_reason := case
    when v_portal_status = 'MISSING' then 'PORTAL_USER_NOT_FOUND'
    when not v_portal_active then 'PORTAL_USER_INACTIVE'
    when not v_assigned then 'COCKPIT_ACCESS_NOT_ASSIGNED'
    when not v_assignment.is_enabled then 'COCKPIT_ACCESS_BLOCKED'
    else 'ALLOWED'
  end;

  return pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'userId', v_user_id,
    'portal', pg_catalog.jsonb_build_object(
      'status', v_portal_status,
      'active', v_portal_active
    ),
    'cockpit', pg_catalog.jsonb_build_object(
      'assigned', v_assigned,
      'enabled', case when v_assigned then v_assignment.is_enabled else false end,
      'allowed', v_access_allowed,
      'role', case when v_assigned then v_assignment.role else null end,
      'revision', case when v_assigned then v_assignment.revision else null end,
      'reason', v_reason
    ),
    'permissions', pg_catalog.jsonb_build_object(
      'liveticker', pg_catalog.jsonb_build_object(
        'capability', 'liveticker.manage',
        'personallyAssigned', v_liveticker_personal,
        'effectiveAllowed', v_liveticker_effective
      ),
      'generator', pg_catalog.jsonb_build_object(
        'capability', 'social_media_generator.use',
        'personallyAssigned', v_generator_personal,
        'activeSocialMediaTeam', v_social_media_team,
        'effectiveAllowed', v_generator_effective
      )
    )
  );
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_cockpit_access_r1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_cockpit_access_r1()
    || array['cockpit_access_get']::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_cockpit_access_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'cockpit_access_get' then 'READ'
    else app_private.platform_action_classification_before_cockpit_access_r1(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_cockpit_access_r1;

create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_action, ''))
  );
begin
  case v_action
    when 'cockpit_access_get' then
      return app_private.api_cockpit_access_get(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return app_private.pd_api_dispatch_current_before_cockpit_access_r1(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.cockpit_user_has_access(uuid),
  app_private.api_cockpit_access_get(jsonb),
  app_private.has_capability(uuid, text),
  app_private.user_capability_provenance(uuid),
  app_private.pd_api_current_actions_before_cockpit_access_r1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_cockpit_access_r1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_cockpit_access_r1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.cockpit_user_has_access(uuid),
  app_private.api_cockpit_access_get(jsonb),
  app_private.has_capability(uuid, text),
  app_private.user_capability_provenance(uuid),
  app_private.pd_api_current_actions_before_cockpit_access_r1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_cockpit_access_r1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_cockpit_access_r1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

comment on function app_private.cockpit_user_has_access(uuid) is
  'Private Cockpit admission check: active Portal user plus explicit enabled Cockpit assignment; portal.admin is not a source.';
comment on function app_private.api_cockpit_access_get(jsonb) is
  'Read-only actor-bound Cockpit access projection. Actor identity comes only from auth.uid().';

commit;
