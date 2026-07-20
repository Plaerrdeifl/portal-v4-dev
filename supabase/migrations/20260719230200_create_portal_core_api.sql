create or replace function app_private.clean_name(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      regexp_replace(coalesce(p_value, ''), '[[:cntrl:]]', ' ', 'g'),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function app_private.require_valid_name(
  p_value text,
  p_field text
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_value text := app_private.clean_name(p_value);
begin
  if length(v_value) < 1 or length(v_value) > 160 then
    raise exception '% ist erforderlich.', p_field
      using errcode = '22023';
  end if;

  if lower(v_value) in ('unbekannt', 'user', 'n/a', 'na', '-') then
    raise exception '% enthält einen unzulässigen Platzhalter.', p_field
      using errcode = '22023';
  end if;

  if left(v_value, 1) in ('=', '+', '-', '@') then
    raise exception '% beginnt mit einem unzulässigen Zeichen.', p_field
      using errcode = '22023';
  end if;

  return v_value;
end;
$$;

create or replace function app_private.current_auth_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select auth.uid();
$$;

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
  select exists (
    select 1
    from app_portal.users as portal_user
    join app_portal.portal_roles as role
      on role.id = portal_user.role_id
     and role.is_active
    join app_portal.role_capabilities as role_capability
      on role_capability.role_id = role.id
    join app_portal.capabilities as capability
      on capability.code = role_capability.capability_code
     and capability.is_active
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
      and role_capability.capability_code in (
        p_capability,
        'portal.admin'
      )
  ) or exists (
    select 1
    from app_portal.users as portal_user
    join app_portal.user_member_links as link
      on link.user_id = portal_user.id
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
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
      and office_capability.capability_code = p_capability
  );
$$;

create or replace function app_private.is_office_holder(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_portal.users as portal_user
    join app_portal.user_member_links as link
      on link.user_id = portal_user.id
    join app_fanclub.members as member
      on member.id = link.member_id
     and member.status = 'ACTIVE'
    join app_fanclub.office_slots as office
      on office.member_id = member.id
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
  );
$$;

create or replace function app_private.is_team_member(
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
    from app_portal.team_memberships as membership
    join app_portal.teams as team
      on team.id = membership.team_id
     and team.is_active
    where membership.team_id = p_team_id
      and membership.user_id = p_user_id
      and membership.is_active
  );
$$;

create or replace function app_private.can_manage_team(
  p_user_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_capability(p_user_id, 'teams.manage')
    or exists (
      select 1
      from app_portal.team_memberships as membership
      join app_portal.teams as team
        on team.id = membership.team_id
       and team.is_active
      where membership.team_id = p_team_id
        and membership.user_id = p_user_id
        and membership.is_active
        and membership.team_role in ('LEAD', 'CO_LEAD')
    );
$$;

create or replace function app_private.require_active_user()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_auth_id uuid := auth.uid();
begin
  if v_auth_id is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from app_portal.users as portal_user
    join app_portal.portal_roles as role
      on role.id = portal_user.role_id
     and role.is_active
    where portal_user.id = v_auth_id
      and portal_user.status = 'ACTIVE'
  ) then
    raise exception 'Aktiver Portalzugang erforderlich.' using errcode = '42501';
  end if;

  return v_auth_id;
end;
$$;

create or replace function app_private.require_capability(p_capability text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_active_user();
begin
  if not app_private.has_capability(v_user_id, p_capability) then
    raise exception 'Berechtigung fehlt: %', p_capability
      using errcode = '42501';
  end if;
  return v_user_id;
end;
$$;

create or replace function app_private.user_capabilities(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(capability.code order by capability.sort_order, capability.code), '[]'::jsonb)
  from app_portal.capabilities as capability
  where capability.is_active
    and app_private.has_capability(p_user_id, capability.code);
$$;

create or replace function app_private.log_audit(
  p_actor uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into app_portal.audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  )
  values (
    p_actor,
    p_action,
    p_entity_type,
    coalesce(p_entity_id, ''),
    p_before,
    p_after,
    coalesce(p_metadata, '{}'::jsonb)
  );
$$;

create or replace function app_private.active_admin_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from app_portal.users as portal_user
  join app_portal.portal_roles as role
    on role.id = portal_user.role_id
   and role.is_active
  join app_portal.role_capabilities as role_capability
    on role_capability.role_id = role.id
   and role_capability.capability_code = 'portal.admin'
  where portal_user.status = 'ACTIVE';
$$;

create or replace function app_private.assert_admin_survives()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('plaerrdeifl.portal.admin-survival', 0)
  );

  if app_private.active_admin_count() < 1 then
    raise exception 'Der letzte vollständige administrative Zugriff darf nicht entfernt werden.'
      using errcode = '23514';
  end if;
end;
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
        app_private.has_capability(p_user_id, 'tasks.manage')
        or task.created_by = p_user_id
        or task.assigned_user_id = p_user_id
        or (
          task.context_type = 'TEAM'
          and app_private.is_team_member(p_user_id, task.team_id)
        )
        or (
          task.context_type = 'BOARD'
          and app_private.is_office_holder(p_user_id)
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
      and (
        app_private.has_capability(p_user_id, 'tasks.manage')
        or task.created_by = p_user_id
        or (
          task.context_type = 'TEAM'
          and app_private.can_manage_team(p_user_id, task.team_id)
        )
        or (
          task.context_type = 'BOARD'
          and app_private.is_office_holder(p_user_id)
        )
      )
  );
$$;

create or replace function app_private.api_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_id uuid := auth.uid();
  v_auth auth.users%rowtype;
  v_user app_portal.users%rowtype;
  v_request app_portal.access_requests%rowtype;
  v_state text;
  v_permissions jsonb := '[]'::jsonb;
  v_navigation jsonb := '{}'::jsonb;
  v_member jsonb := null;
  v_role jsonb := null;
begin
  if v_auth_id is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  select * into v_auth
  from auth.users
  where id = v_auth_id;

  select * into v_user
  from app_portal.users
  where id = v_auth_id;

  select * into v_request
  from app_portal.access_requests
  where auth_user_id = v_auth_id;

  if app_private.active_admin_count() = 0 then
    v_state := 'INITIALIZATION_REQUIRED';
  elsif v_user.id is not null then
    v_state := v_user.status;
  elsif v_request.id is not null and v_request.status = 'PENDING' then
    v_state := 'PENDING';
  elsif v_request.id is not null and v_request.status = 'REJECTED' then
    v_state := 'REJECTED';
  else
    v_state := 'UNREGISTERED';
  end if;

  if v_user.id is not null then
    v_permissions := app_private.user_capabilities(v_user.id);

    select jsonb_build_object(
      'id', role.id,
      'code', role.code,
      'name', role.name,
      'description', role.description
    )
    into v_role
    from app_portal.portal_roles as role
    where role.id = v_user.role_id;

    select jsonb_build_object(
      'id', member.id,
      'memberCode', member.member_code,
      'firstName', member.first_name,
      'lastName', member.last_name,
      'status', member.status
    )
    into v_member
    from app_portal.user_member_links as link
    join app_fanclub.members as member
      on member.id = link.member_id
    where link.user_id = v_user.id;
  end if;

  if v_state = 'ACTIVE' then
    v_navigation := jsonb_build_object(
      'dashboard', true,
      'fanclub',
        app_private.has_capability(v_auth_id, 'members.read')
        or v_member is not null,
      'tasks',
        app_private.has_capability(v_auth_id, 'tasks.read')
        or app_private.is_office_holder(v_auth_id)
        or exists (
          select 1
          from app_portal.team_memberships
          where user_id = v_auth_id
            and is_active
        ),
      'teams',
        app_private.has_capability(v_auth_id, 'teams.read')
        or exists (
          select 1
          from app_portal.team_memberships
          where user_id = v_auth_id
            and is_active
        ),
      'fanbuses', true,
      'admin',
        app_private.has_capability(v_auth_id, 'roles.manage')
        or app_private.has_capability(v_auth_id, 'users.manage')
        or app_private.has_capability(v_auth_id, 'audit.read')
    );
  end if;

  return jsonb_build_object(
    'state', v_state,
    'authenticated', true,
    'email', coalesce(v_auth.email, ''),
    'suggestions', jsonb_build_object(
      'firstName', coalesce(v_auth.raw_user_meta_data ->> 'given_name', ''),
      'lastName', coalesce(v_auth.raw_user_meta_data ->> 'family_name', '')
    ),
    'request', case
      when v_request.id is null then null
      else jsonb_build_object(
        'id', v_request.id,
        'status', v_request.status,
        'firstName', v_request.first_name,
        'lastName', v_request.last_name,
        'requestedAt', v_request.requested_at,
        'decisionReason', v_request.decision_reason
      )
    end,
    'user', case
      when v_user.id is null then null
      else jsonb_build_object(
        'id', v_user.id,
        'userCode', v_user.user_code,
        'email', v_user.email,
        'firstName', v_user.first_name,
        'lastName', v_user.last_name,
        'status', v_user.status,
        'role', v_role,
        'member', v_member
      )
    end,
    'permissions', v_permissions,
    'navigation', v_navigation,
    'system', jsonb_build_object(
      'initializationRequired', app_private.active_admin_count() = 0,
      'activeAdminCount', app_private.active_admin_count(),
      'version', '4.0.0-core'
    ),
    'serverTime', now()
  );
end;
$$;

create or replace function app_private.api_submit_access_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_id uuid := auth.uid();
  v_email text;
  v_first_name text;
  v_last_name text;
  v_request app_portal.access_requests%rowtype;
begin
  if v_auth_id is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  if exists (select 1 from app_portal.users where id = v_auth_id) then
    raise exception 'Für dieses Konto existiert bereits ein Portalbenutzer.'
      using errcode = '23505';
  end if;

  select email into v_email
  from auth.users
  where id = v_auth_id;

  v_first_name := app_private.require_valid_name(p_payload ->> 'firstName', 'Vorname');
  v_last_name := app_private.require_valid_name(p_payload ->> 'lastName', 'Nachname');

  insert into app_portal.access_requests (
    auth_user_id,
    email,
    first_name,
    last_name,
    status,
    requested_at,
    reviewed_at,
    reviewed_by,
    decision_reason,
    revision
  )
  values (
    v_auth_id,
    coalesce(v_email, ''),
    v_first_name,
    v_last_name,
    'PENDING',
    now(),
    null,
    null,
    '',
    1
  )
  on conflict (auth_user_id) do update
  set email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      status = 'PENDING',
      requested_at = now(),
      reviewed_at = null,
      reviewed_by = null,
      decision_reason = '',
      revision = app_portal.access_requests.revision + 1
  returning * into v_request;

  perform app_private.log_audit(
    null,
    'ACCESS_REQUEST_SUBMITTED',
    'access_request',
    v_request.id::text,
    null,
    jsonb_build_object(
      'authUserId', v_auth_id,
      'status', v_request.status
    )
  );

  return app_private.api_bootstrap();
end;
$$;

create or replace function app_private.api_claim_initial_admin(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_id uuid := auth.uid();
  v_email text;
  v_first_name text;
  v_last_name text;
  v_token text := coalesce(p_payload ->> 'token', '');
  v_token_id uuid;
  v_role_id uuid;
begin
  if v_auth_id is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  if app_private.active_admin_count() > 0 then
    raise exception 'Die Erstinitialisierung ist bereits abgeschlossen.'
      using errcode = '23514';
  end if;

  v_first_name := app_private.require_valid_name(p_payload ->> 'firstName', 'Vorname');
  v_last_name := app_private.require_valid_name(p_payload ->> 'lastName', 'Nachname');

  select id into v_token_id
  from app_private.bootstrap_tokens
  where token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
    and used_at is null
    and expires_at > now()
  for update;

  if v_token_id is null then
    raise exception 'Der Initialisierungscode ist ungültig oder abgelaufen.'
      using errcode = '42501';
  end if;

  select id into v_role_id
  from app_portal.portal_roles
  where code = 'ADMIN'
    and is_active;

  if v_role_id is null then
    raise exception 'Die initiale Adminrolle fehlt.' using errcode = '23514';
  end if;

  select email into v_email
  from auth.users
  where id = v_auth_id;

  insert into app_portal.users (
    id,
    email,
    first_name,
    last_name,
    status,
    role_id
  )
  values (
    v_auth_id,
    coalesce(v_email, ''),
    v_first_name,
    v_last_name,
    'ACTIVE',
    v_role_id
  )
  on conflict (id) do update
  set email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      status = 'ACTIVE',
      role_id = excluded.role_id,
      revision = app_portal.users.revision + 1;

  update app_private.bootstrap_tokens
  set used_at = now(),
      used_by = v_auth_id
  where id = v_token_id;

  insert into app_portal.access_requests (
    auth_user_id,
    email,
    first_name,
    last_name,
    status,
    reviewed_at,
    reviewed_by
  )
  values (
    v_auth_id,
    coalesce(v_email, ''),
    v_first_name,
    v_last_name,
    'APPROVED',
    now(),
    v_auth_id
  )
  on conflict (auth_user_id) do update
  set email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      status = 'APPROVED',
      reviewed_at = now(),
      reviewed_by = v_auth_id,
      decision_reason = '',
      revision = app_portal.access_requests.revision + 1;

  perform app_private.log_audit(
    v_auth_id,
    'INITIAL_ADMIN_CLAIMED',
    'portal_user',
    v_auth_id::text,
    null,
    jsonb_build_object('roleId', v_role_id)
  );

  return app_private.api_bootstrap();
end;
$$;

create or replace function app_private.api_update_profile(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_id uuid := auth.uid();
  v_before jsonb;
  v_first_name text;
  v_last_name text;
begin
  if v_auth_id is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  select to_jsonb(portal_user) into v_before
  from app_portal.users as portal_user
  where portal_user.id = v_auth_id;

  if v_before is null then
    raise exception 'Portalbenutzer wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  v_first_name := app_private.require_valid_name(p_payload ->> 'firstName', 'Vorname');
  v_last_name := app_private.require_valid_name(p_payload ->> 'lastName', 'Nachname');

  update app_portal.users
  set first_name = v_first_name,
      last_name = v_last_name,
      revision = revision + 1
  where id = v_auth_id;

  perform app_private.log_audit(
    v_auth_id,
    'PROFILE_UPDATED',
    'portal_user',
    v_auth_id::text,
    jsonb_build_object('changedFields', jsonb_build_array('first_name', 'last_name')),
    jsonb_build_object('changedFields', jsonb_build_array('first_name', 'last_name'))
  );

  return app_private.api_bootstrap();
end;
$$;

create or replace function app_private.api_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_active_user();
begin
  return jsonb_build_object(
    'memberCount', case
      when app_private.has_capability(v_user_id, 'members.read') then
        (select count(*) from app_fanclub.members where status = 'ACTIVE')
      else null
    end,
    'teamCount', (
      select count(*)
      from app_portal.team_memberships
      where user_id = v_user_id
        and is_active
    ),
    'openTaskCount', (
      select count(*)
      from app_modules.tasks as task
      where task.status not in ('DONE', 'ARCHIVED')
        and app_private.task_is_visible(v_user_id, task.id)
    ),
    'pendingRequestCount', case
      when app_private.has_capability(v_user_id, 'users.manage') then
        (select count(*) from app_portal.access_requests where status = 'PENDING')
      else null
    end,
    'office', (
      select jsonb_build_object('code', office.code, 'label', office.label)
      from app_portal.user_member_links as link
      join app_fanclub.office_slots as office
        on office.member_id = link.member_id
      where link.user_id = v_user_id
    ),
    'serverTime', now()
  );
end;
$$;

create or replace function app_private.api_admin_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_active_user();
  v_can_manage_roles boolean := app_private.has_capability(v_user_id, 'roles.manage');
  v_can_manage_users boolean := app_private.has_capability(v_user_id, 'users.manage');
  v_can_read_audit boolean := app_private.has_capability(v_user_id, 'audit.read');
begin
  if not (v_can_manage_roles or v_can_manage_users or v_can_read_audit) then
    raise exception 'Administrationsberechtigung fehlt.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'roles', case when v_can_manage_roles or v_can_manage_users then (
      select coalesce(jsonb_agg(row_data order by (row_data ->> 'sortOrder')::integer, row_data ->> 'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'id', role.id,
          'code', role.code,
          'name', role.name,
          'description', role.description,
          'active', role.is_active,
          'sortOrder', role.sort_order,
          'revision', role.revision,
          'assignedUsers', (
            select count(*)
            from app_portal.users
            where role_id = role.id
          ),
          'capabilities', coalesce((
            select jsonb_agg(role_capability.capability_code order by role_capability.capability_code)
            from app_portal.role_capabilities as role_capability
            where role_capability.role_id = role.id
          ), '[]'::jsonb)
        ) as row_data
        from app_portal.portal_roles as role
      ) as role_rows
    ) else '[]'::jsonb end,
    'capabilities', case when v_can_manage_roles then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', capability.code,
        'name', capability.name,
        'category', capability.category,
        'description', capability.description,
        'active', capability.is_active,
        'sortOrder', capability.sort_order
      ) order by capability.sort_order, capability.code), '[]'::jsonb)
      from app_portal.capabilities as capability
    ) else '[]'::jsonb end,
    'users', case when v_can_manage_users then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', portal_user.id,
        'userCode', portal_user.user_code,
        'email', portal_user.email,
        'firstName', portal_user.first_name,
        'lastName', portal_user.last_name,
        'status', portal_user.status,
        'roleId', portal_user.role_id,
        'roleName', role.name,
        'memberId', member.id,
        'memberCode', member.member_code,
        'revision', portal_user.revision
      ) order by portal_user.last_name, portal_user.first_name), '[]'::jsonb)
      from app_portal.users as portal_user
      join app_portal.portal_roles as role
        on role.id = portal_user.role_id
      left join app_portal.user_member_links as link
        on link.user_id = portal_user.id
      left join app_fanclub.members as member
        on member.id = link.member_id
    ) else '[]'::jsonb end,
    'members', case when v_can_manage_users then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', member.id,
        'memberCode', member.member_code,
        'firstName', member.first_name,
        'lastName', member.last_name,
        'status', member.status
      ) order by member.last_name, member.first_name), '[]'::jsonb)
      from app_fanclub.members as member
    ) else '[]'::jsonb end,
    'requests', case when v_can_manage_users then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', request.id,
        'authUserId', request.auth_user_id,
        'email', request.email,
        'firstName', request.first_name,
        'lastName', request.last_name,
        'status', request.status,
        'requestedAt', request.requested_at,
        'decisionReason', request.decision_reason,
        'revision', request.revision
      ) order by request.requested_at desc), '[]'::jsonb)
      from app_portal.access_requests as request
    ) else '[]'::jsonb end,
    'audit', case when v_can_read_audit then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', event.id,
        'actorUserId', event.actor_user_id,
        'action', event.action,
        'entityType', event.entity_type,
        'entityId', event.entity_id,
        'metadata', event.metadata,
        'occurredAt', event.occurred_at
      ) order by event.occurred_at desc), '[]'::jsonb)
      from (
        select *
        from app_portal.audit_events
        order by occurred_at desc
        limit 100
      ) as event
    ) else '[]'::jsonb end,
    'activeAdminCount', app_private.active_admin_count(),
    'canManageRoles', v_can_manage_roles,
    'canManageUsers', v_can_manage_users,
    'canReadAudit', v_can_read_audit,
    'requestedBy', v_user_id
  );
end;
$$;

create or replace function app_private.api_save_role(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('roles.manage');
  v_id uuid;
  v_code text := upper(btrim(coalesce(p_payload ->> 'code', '')));
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_description text := btrim(coalesce(p_payload ->> 'description', ''));
  v_active boolean := coalesce((p_payload ->> 'active')::boolean, true);
  v_sort_order integer := coalesce((p_payload ->> 'sortOrder')::integer, 100);
  v_before jsonb;
begin
  if v_code !~ '^[A-Z][A-Z0-9_]{1,63}$' then
    raise exception 'Der technische Rollencode ist ungültig.' using errcode = '22023';
  end if;
  if length(v_name) < 1 or length(v_name) > 120 then
    raise exception 'Der Rollenname ist erforderlich.' using errcode = '22023';
  end if;

  if nullif(p_payload ->> 'id', '') is null then
    insert into app_portal.portal_roles (
      code,
      name,
      description,
      is_active,
      sort_order
    )
    values (
      v_code,
      v_name,
      v_description,
      v_active,
      v_sort_order
    )
    returning id into v_id;

    perform app_private.log_audit(
      v_actor,
      'ROLE_CREATED',
      'portal_role',
      v_id::text,
      null,
      jsonb_build_object('code', v_code, 'name', v_name, 'active', v_active)
    );
  else
    v_id := (p_payload ->> 'id')::uuid;
    select to_jsonb(role) into v_before
    from app_portal.portal_roles as role
    where role.id = v_id
    for update;

    if v_before is null then
      raise exception 'Rolle wurde nicht gefunden.' using errcode = 'P0002';
    end if;

    update app_portal.portal_roles
    set code = v_code,
        name = v_name,
        description = v_description,
        is_active = v_active,
        sort_order = v_sort_order,
        revision = revision + 1
    where id = v_id;

    perform app_private.assert_admin_survives();
    perform app_private.log_audit(
      v_actor,
      'ROLE_UPDATED',
      'portal_role',
      v_id::text,
      v_before,
      jsonb_build_object('code', v_code, 'name', v_name, 'active', v_active)
    );
  end if;

  return app_private.api_admin_snapshot();
end;
$$;

create or replace function app_private.api_delete_role(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('roles.manage');
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_before jsonb;
begin
  select to_jsonb(role) into v_before
  from app_portal.portal_roles as role
  where role.id = v_id
  for update;

  if v_before is null then
    raise exception 'Rolle wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if exists (select 1 from app_portal.users where role_id = v_id) then
    raise exception 'Die Rolle ist noch Benutzern zugeordnet.' using errcode = '23503';
  end if;

  delete from app_portal.portal_roles where id = v_id;
  perform app_private.assert_admin_survives();
  perform app_private.log_audit(
    v_actor,
    'ROLE_DELETED',
    'portal_role',
    v_id::text,
    v_before,
    null
  );

  return app_private.api_admin_snapshot();
end;
$$;

create or replace function app_private.api_set_role_capabilities(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('roles.manage');
  v_role_id uuid := (p_payload ->> 'roleId')::uuid;
  v_capabilities jsonb := coalesce(p_payload -> 'capabilities', '[]'::jsonb);
  v_before jsonb;
begin
  if not exists (select 1 from app_portal.portal_roles where id = v_role_id) then
    raise exception 'Rolle wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(capability_code order by capability_code), '[]'::jsonb)
  into v_before
  from app_portal.role_capabilities
  where role_id = v_role_id;

  delete from app_portal.role_capabilities
  where role_id = v_role_id;

  insert into app_portal.role_capabilities (
    role_id,
    capability_code,
    created_by
  )
  select
    v_role_id,
    capability.code,
    v_actor
  from jsonb_array_elements_text(v_capabilities) as requested(code)
  join app_portal.capabilities as capability
    on capability.code = requested.code
   and capability.is_active
  on conflict do nothing;

  perform app_private.assert_admin_survives();
  perform app_private.log_audit(
    v_actor,
    'ROLE_CAPABILITIES_UPDATED',
    'portal_role',
    v_role_id::text,
    jsonb_build_object('capabilities', v_before),
    jsonb_build_object('capabilities', v_capabilities)
  );

  return app_private.api_admin_snapshot();
end;
$$;

create or replace function app_private.api_save_user(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('users.manage');
  v_user_id uuid := (p_payload ->> 'id')::uuid;
  v_role_id uuid := (p_payload ->> 'roleId')::uuid;
  v_status text := upper(coalesce(p_payload ->> 'status', 'ACTIVE'));
  v_member_id uuid := nullif(p_payload ->> 'memberId', '')::uuid;
  v_before jsonb;
begin
  if v_status not in ('ACTIVE', 'INACTIVE', 'BLOCKED') then
    raise exception 'Unzulässiger Benutzerstatus.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from app_portal.portal_roles
    where id = v_role_id and is_active
  ) then
    raise exception 'Aktive Rolle wurde nicht gefunden.' using errcode = '23503';
  end if;

  select to_jsonb(portal_user) into v_before
  from app_portal.users as portal_user
  where portal_user.id = v_user_id
  for update;

  if v_before is null then
    raise exception 'Benutzer wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  update app_portal.users
  set role_id = v_role_id,
      status = v_status,
      revision = revision + 1
  where id = v_user_id;

  delete from app_portal.user_member_links
  where user_id = v_user_id;

  if v_member_id is not null then
    if not exists (
      select 1 from app_fanclub.members
      where id = v_member_id and status = 'ACTIVE'
    ) then
      raise exception 'Aktives Mitglied wurde nicht gefunden.' using errcode = '23503';
    end if;

    insert into app_portal.user_member_links (
      user_id,
      member_id,
      linked_by
    )
    values (
      v_user_id,
      v_member_id,
      v_actor
    );
  end if;

  perform app_private.assert_admin_survives();
  perform app_private.log_audit(
    v_actor,
    'USER_UPDATED',
    'portal_user',
    v_user_id::text,
    v_before,
    jsonb_build_object(
      'roleId', v_role_id,
      'status', v_status,
      'memberId', v_member_id
    )
  );

  return app_private.api_admin_snapshot();
end;
$$;

create or replace function app_private.api_approve_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('users.manage');
  v_request_id uuid := (p_payload ->> 'id')::uuid;
  v_role_id uuid := nullif(p_payload ->> 'roleId', '')::uuid;
  v_member_id uuid := nullif(p_payload ->> 'memberId', '')::uuid;
  v_request app_portal.access_requests%rowtype;
begin
  select * into v_request
  from app_portal.access_requests
  where id = v_request_id
  for update;

  if v_request.id is null then
    raise exception 'Freischaltungsantrag wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_request.status <> 'PENDING' then
    raise exception 'Nur offene Anträge können freigegeben werden.' using errcode = '23514';
  end if;

  if v_role_id is null then
    select id into v_role_id
    from app_portal.portal_roles
    where code = 'PORTAL_USER' and is_active;
  end if;

  if not exists (
    select 1 from app_portal.portal_roles
    where id = v_role_id and is_active
  ) then
    raise exception 'Aktive Zielrolle wurde nicht gefunden.' using errcode = '23503';
  end if;

  insert into app_portal.users (
    id,
    email,
    first_name,
    last_name,
    status,
    role_id
  )
  values (
    v_request.auth_user_id,
    v_request.email,
    app_private.require_valid_name(v_request.first_name, 'Vorname'),
    app_private.require_valid_name(v_request.last_name, 'Nachname'),
    'ACTIVE',
    v_role_id
  );

  if v_member_id is not null then
    if not exists (
      select 1 from app_fanclub.members
      where id = v_member_id and status = 'ACTIVE'
    ) then
      raise exception 'Aktives Mitglied wurde nicht gefunden.' using errcode = '23503';
    end if;

    insert into app_portal.user_member_links (
      user_id,
      member_id,
      linked_by
    )
    values (
      v_request.auth_user_id,
      v_member_id,
      v_actor
    );
  end if;

  update app_portal.access_requests
  set status = 'APPROVED',
      reviewed_at = now(),
      reviewed_by = v_actor,
      decision_reason = '',
      revision = revision + 1
  where id = v_request_id;

  perform app_private.log_audit(
    v_actor,
    'ACCESS_REQUEST_APPROVED',
    'access_request',
    v_request_id::text,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object(
      'status', 'APPROVED',
      'userId', v_request.auth_user_id,
      'roleId', v_role_id,
      'memberId', v_member_id
    )
  );

  return app_private.api_admin_snapshot();
end;
$$;

create or replace function app_private.api_reject_request(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('users.manage');
  v_request_id uuid := (p_payload ->> 'id')::uuid;
  v_reason text := left(btrim(coalesce(p_payload ->> 'reason', '')), 1000);
begin
  if not exists (
    select 1
    from app_portal.access_requests
    where id = v_request_id and status = 'PENDING'
  ) then
    raise exception 'Offener Antrag wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  update app_portal.access_requests
  set status = 'REJECTED',
      reviewed_at = now(),
      reviewed_by = v_actor,
      decision_reason = v_reason,
      revision = revision + 1
  where id = v_request_id;

  perform app_private.log_audit(
    v_actor,
    'ACCESS_REQUEST_REJECTED',
    'access_request',
    v_request_id::text,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object('status', 'REJECTED', 'reason', v_reason)
  );

  return app_private.api_admin_snapshot();
end;
$$;

create or replace function app_private.api_fanclub_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_capability('members.read');
begin
  return jsonb_build_object(
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', member.id,
        'memberCode', member.member_code,
        'firstName', member.first_name,
        'lastName', member.last_name,
        'email', member.email,
        'phone', member.phone,
        'street', member.street,
        'houseNumber', member.house_number,
        'postalCode', member.postal_code,
        'city', member.city,
        'joinedOn', member.joined_on,
        'leftOn', member.left_on,
        'status', member.status,
        'notes', member.notes,
        'revision', member.revision
      ) order by member.last_name, member.first_name), '[]'::jsonb)
      from app_fanclub.members as member
    ),
    'offices', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', office.code,
        'label', office.label,
        'sortOrder', office.sort_order,
        'memberId', office.member_id,
        'memberCode', member.member_code,
        'memberName', case
          when member.id is null then ''
          else member.first_name || ' ' || member.last_name
        end,
        'revision', office.revision
      ) order by office.sort_order), '[]'::jsonb)
      from app_fanclub.office_slots as office
      left join app_fanclub.members as member
        on member.id = office.member_id
    ),
    'canManageMembers', app_private.has_capability(v_user_id, 'members.manage'),
    'canManageOffices', app_private.has_capability(v_user_id, 'offices.manage')
  );
end;
$$;

create or replace function app_private.api_save_member(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('members.manage');
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_first_name text := app_private.require_valid_name(p_payload ->> 'firstName', 'Vorname');
  v_last_name text := app_private.require_valid_name(p_payload ->> 'lastName', 'Nachname');
  v_status text := upper(coalesce(p_payload ->> 'status', 'ACTIVE'));
  v_before jsonb;
begin
  if v_status not in ('ACTIVE', 'INACTIVE') then
    raise exception 'Unzulässiger Mitgliedsstatus.' using errcode = '22023';
  end if;

  if v_id is null then
    insert into app_fanclub.members (
      first_name,
      last_name,
      email,
      phone,
      street,
      house_number,
      postal_code,
      city,
      joined_on,
      status,
      notes
    )
    values (
      v_first_name,
      v_last_name,
      left(btrim(coalesce(p_payload ->> 'email', '')), 320),
      left(btrim(coalesce(p_payload ->> 'phone', '')), 80),
      left(btrim(coalesce(p_payload ->> 'street', '')), 160),
      left(btrim(coalesce(p_payload ->> 'houseNumber', '')), 40),
      left(btrim(coalesce(p_payload ->> 'postalCode', '')), 20),
      left(btrim(coalesce(p_payload ->> 'city', '')), 160),
      nullif(p_payload ->> 'joinedOn', '')::date,
      v_status,
      left(coalesce(p_payload ->> 'notes', ''), 4000)
    )
    returning id into v_id;

    perform app_private.log_audit(
      v_actor,
      'MEMBER_CREATED',
      'member',
      v_id::text,
      null,
      jsonb_build_object('firstName', v_first_name, 'lastName', v_last_name)
    );
  else
    select to_jsonb(member) into v_before
    from app_fanclub.members as member
    where member.id = v_id
    for update;

    if v_before is null then
      raise exception 'Mitglied wurde nicht gefunden.' using errcode = 'P0002';
    end if;

    update app_fanclub.members
    set first_name = v_first_name,
        last_name = v_last_name,
        email = left(btrim(coalesce(p_payload ->> 'email', '')), 320),
        phone = left(btrim(coalesce(p_payload ->> 'phone', '')), 80),
        street = left(btrim(coalesce(p_payload ->> 'street', '')), 160),
        house_number = left(btrim(coalesce(p_payload ->> 'houseNumber', '')), 40),
        postal_code = left(btrim(coalesce(p_payload ->> 'postalCode', '')), 20),
        city = left(btrim(coalesce(p_payload ->> 'city', '')), 160),
        joined_on = nullif(p_payload ->> 'joinedOn', '')::date,
        left_on = nullif(p_payload ->> 'leftOn', '')::date,
        status = v_status,
        notes = left(coalesce(p_payload ->> 'notes', ''), 4000),
        revision = revision + 1
    where id = v_id;

    perform app_private.log_audit(
      v_actor,
      'MEMBER_UPDATED',
      'member',
      v_id::text,
      jsonb_build_object('revision', v_before ->> 'revision'),
      jsonb_build_object('status', v_status)
    );
  end if;

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_save_offices(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('offices.manage');
  v_slots jsonb := coalesce(p_payload -> 'slots', '[]'::jsonb);
  v_before jsonb;
  v_item jsonb;
  v_code text;
  v_member_id uuid;
begin
  if jsonb_typeof(v_slots) <> 'array' or jsonb_array_length(v_slots) <> 5 then
    raise exception 'Alle fünf Amtsplätze müssen gemeinsam übertragen werden.'
      using errcode = '22023';
  end if;

  if (
    select count(distinct item ->> 'code')
    from jsonb_array_elements(v_slots) as item
  ) <> 5 then
    raise exception 'Jeder Amtsplatz darf nur einmal übertragen werden.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_slots) as item
    where item ->> 'code' not in (
      'VORSTAND_1',
      'VORSTAND_2',
      'VORSTAND_3',
      'KASSIER',
      'SCHRIFTFUEHRER'
    )
  ) then
    raise exception 'Unbekannter Amtsplatz.' using errcode = '22023';
  end if;

  select jsonb_agg(to_jsonb(office) order by office.sort_order)
  into v_before
  from app_fanclub.office_slots as office;

  update app_fanclub.office_slots
  set member_id = null,
      revision = revision + 1,
      updated_by = v_actor
  where code in (
    'VORSTAND_1',
    'VORSTAND_2',
    'VORSTAND_3',
    'KASSIER',
    'SCHRIFTFUEHRER'
  );

  for v_item in select value from jsonb_array_elements(v_slots)
  loop
    v_code := v_item ->> 'code';
    v_member_id := nullif(v_item ->> 'memberId', '')::uuid;

    if v_member_id is not null and not exists (
      select 1
      from app_fanclub.members
      where id = v_member_id and status = 'ACTIVE'
    ) then
      raise exception 'Amtsinhaber muss ein aktives Mitglied sein.' using errcode = '23503';
    end if;

    update app_fanclub.office_slots
    set member_id = v_member_id,
        updated_by = v_actor
    where code = v_code;
  end loop;

  perform app_private.log_audit(
    v_actor,
    'OFFICE_SLOTS_UPDATED',
    'office_slots',
    'ALL',
    v_before,
    v_slots
  );

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_teams_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_active_user();
  v_see_all boolean := app_private.has_capability(v_user_id, 'teams.read');
begin
  return jsonb_build_object(
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', team.id,
        'code', team.code,
        'name', team.name,
        'description', team.description,
        'active', team.is_active,
        'revision', team.revision,
        'canManage', app_private.can_manage_team(v_user_id, team.id),
        'members', coalesce((
          select jsonb_agg(jsonb_build_object(
            'userId', membership.user_id,
            'userCode', portal_user.user_code,
            'name', portal_user.first_name || ' ' || portal_user.last_name,
            'role', membership.team_role,
            'active', membership.is_active,
            'revision', membership.revision
          ) order by
            case membership.team_role
              when 'LEAD' then 1
              when 'CO_LEAD' then 2
              else 3
            end,
            portal_user.last_name,
            portal_user.first_name)
          from app_portal.team_memberships as membership
          join app_portal.users as portal_user
            on portal_user.id = membership.user_id
          where membership.team_id = team.id
        ), '[]'::jsonb)
      ) order by team.name), '[]'::jsonb)
      from app_portal.teams as team
      where v_see_all
         or app_private.is_team_member(v_user_id, team.id)
    ),
    'users', case
      when app_private.has_capability(v_user_id, 'teams.manage')
        or exists (
          select 1
          from app_portal.team_memberships as own_membership
          where own_membership.user_id = v_user_id
            and own_membership.is_active
            and own_membership.team_role in ('LEAD', 'CO_LEAD')
        ) then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', portal_user.id,
          'userCode', portal_user.user_code,
          'name', portal_user.first_name || ' ' || portal_user.last_name
        ) order by portal_user.last_name, portal_user.first_name), '[]'::jsonb)
        from app_portal.users as portal_user
        where portal_user.status = 'ACTIVE'
      )
      else (
        select coalesce(jsonb_agg(distinct jsonb_build_object(
          'id', portal_user.id,
          'userCode', portal_user.user_code,
          'name', portal_user.first_name || ' ' || portal_user.last_name
        )), '[]'::jsonb)
        from app_portal.team_memberships as own_membership
        join app_portal.team_memberships as membership
          on membership.team_id = own_membership.team_id
         and membership.is_active
        join app_portal.users as portal_user
          on portal_user.id = membership.user_id
         and portal_user.status = 'ACTIVE'
        where own_membership.user_id = v_user_id
          and own_membership.is_active
          and own_membership.team_role in ('LEAD', 'CO_LEAD')
      )
    end,
    'canCreateTeam', app_private.has_capability(v_user_id, 'teams.manage')
  );
end;
$$;

create or replace function app_private.api_save_team(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('teams.manage');
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_code text := upper(btrim(coalesce(p_payload ->> 'code', '')));
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_description text := left(btrim(coalesce(p_payload ->> 'description', '')), 2000);
  v_active boolean := coalesce((p_payload ->> 'active')::boolean, true);
  v_before jsonb;
begin
  if v_code !~ '^[A-Z][A-Z0-9_]{1,63}$' then
    raise exception 'Der Teamcode ist ungültig.' using errcode = '22023';
  end if;
  if length(v_name) < 1 or length(v_name) > 160 then
    raise exception 'Der Teamname ist erforderlich.' using errcode = '22023';
  end if;

  if v_id is null then
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
    returning id into v_id;

    perform app_private.log_audit(
      v_actor,
      'TEAM_CREATED',
      'team',
      v_id::text,
      null,
      jsonb_build_object('code', v_code, 'name', v_name)
    );
  else
    select to_jsonb(team) into v_before
    from app_portal.teams as team
    where team.id = v_id
    for update;

    if v_before is null then
      raise exception 'Team wurde nicht gefunden.' using errcode = 'P0002';
    end if;

    update app_portal.teams
    set code = v_code,
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
      v_before,
      jsonb_build_object('code', v_code, 'name', v_name, 'active', v_active)
    );
  end if;

  return app_private.api_teams_snapshot();
end;
$$;

create or replace function app_private.api_save_team_member(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_team_id uuid := (p_payload ->> 'teamId')::uuid;
  v_target_user_id uuid := (p_payload ->> 'userId')::uuid;
  v_role text := upper(coalesce(p_payload ->> 'role', 'MEMBER'));
  v_global_manager boolean := app_private.has_capability(v_actor, 'teams.manage');
  v_existing_role text;
begin
  if not app_private.can_manage_team(v_actor, v_team_id) then
    raise exception 'Teamverwaltung ist nicht erlaubt.' using errcode = '42501';
  end if;
  if v_role not in ('LEAD', 'CO_LEAD', 'MEMBER') then
    raise exception 'Unzulässige Teamrolle.' using errcode = '22023';
  end if;
  if v_role = 'LEAD' and not v_global_manager then
    raise exception 'Nur Portaladministratoren dürfen die Teamleitung ändern.'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from app_portal.users
    where id = v_target_user_id and status = 'ACTIVE'
  ) then
    raise exception 'Aktiver Portalbenutzer wurde nicht gefunden.' using errcode = '23503';
  end if;

  select team_role into v_existing_role
  from app_portal.team_memberships
  where team_id = v_team_id and user_id = v_target_user_id;

  if v_target_user_id = v_actor
     and v_existing_role = 'LEAD'
     and v_role <> 'LEAD'
     and not v_global_manager then
    raise exception 'Die Teamleitung darf sich nicht selbst entfernen oder herabstufen.'
      using errcode = '42501';
  end if;

  if v_role = 'LEAD' and v_global_manager then
    update app_portal.team_memberships
    set team_role = 'MEMBER',
        revision = revision + 1
    where team_id = v_team_id
      and user_id <> v_target_user_id
      and is_active
      and team_role = 'LEAD';
  end if;

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
  )
  on conflict (team_id, user_id) do update
  set team_role = excluded.team_role,
      is_active = true,
      revision = app_portal.team_memberships.revision + 1;

  if (
    select count(*)
    from app_portal.team_memberships
    where team_id = v_team_id
      and is_active
      and team_role = 'CO_LEAD'
  ) > 2 then
    raise exception 'Ein Team darf höchstens zwei aktive Co-Teamleiter besitzen.'
      using errcode = '23514';
  end if;

  perform app_private.log_audit(
    v_actor,
    'TEAM_MEMBER_SAVED',
    'team_membership',
    v_team_id::text || ':' || v_target_user_id::text,
    jsonb_build_object('previousRole', v_existing_role),
    jsonb_build_object('role', v_role, 'active', true)
  );

  return app_private.api_teams_snapshot();
end;
$$;

create or replace function app_private.api_remove_team_member(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_team_id uuid := (p_payload ->> 'teamId')::uuid;
  v_target_user_id uuid := (p_payload ->> 'userId')::uuid;
  v_global_manager boolean := app_private.has_capability(v_actor, 'teams.manage');
  v_role text;
begin
  if not app_private.can_manage_team(v_actor, v_team_id) then
    raise exception 'Teamverwaltung ist nicht erlaubt.' using errcode = '42501';
  end if;

  select team_role into v_role
  from app_portal.team_memberships
  where team_id = v_team_id
    and user_id = v_target_user_id
    and is_active
  for update;

  if v_role is null then
    raise exception 'Aktive Teammitgliedschaft wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_role = 'LEAD' and not v_global_manager then
    raise exception 'Nur Portaladministratoren dürfen die Teamleitung entfernen.'
      using errcode = '42501';
  end if;
  if v_target_user_id = v_actor and v_role = 'LEAD' and not v_global_manager then
    raise exception 'Die Teamleitung darf sich nicht selbst entfernen.'
      using errcode = '42501';
  end if;

  update app_portal.team_memberships
  set is_active = false,
      revision = revision + 1
  where team_id = v_team_id
    and user_id = v_target_user_id;

  perform app_private.log_audit(
    v_actor,
    'TEAM_MEMBER_REMOVED',
    'team_membership',
    v_team_id::text || ':' || v_target_user_id::text,
    jsonb_build_object('role', v_role, 'active', true),
    jsonb_build_object('role', v_role, 'active', false)
  );

  return app_private.api_teams_snapshot();
end;
$$;

create or replace function app_private.api_tasks_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_active_user();
begin
  return jsonb_build_object(
    'tasks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', task.id,
        'context', task.context_type,
        'teamId', task.team_id,
        'teamName', team.name,
        'title', task.title,
        'description', task.description,
        'priority', task.priority,
        'status', task.status,
        'assignedUserId', task.assigned_user_id,
        'assignedName', assigned.first_name || ' ' || assigned.last_name,
        'assignmentReason', task.assignment_reason,
        'createdBy', task.created_by,
        'createdByName', creator.first_name || ' ' || creator.last_name,
        'createdAt', task.created_at,
        'updatedAt', task.updated_at,
        'revision', task.revision,
        'canManage', app_private.task_is_manageable(v_user_id, task.id),
        'ownNote', note.content,
        'ownNoteRevision', note.revision
      ) order by
        case task.priority
          when 'URGENT' then 1
          when 'HIGH' then 2
          when 'NORMAL' then 3
          else 4
        end,
        task.updated_at desc), '[]'::jsonb)
      from app_modules.tasks as task
      left join app_portal.teams as team
        on team.id = task.team_id
      left join app_portal.users as assigned
        on assigned.id = task.assigned_user_id
      join app_portal.users as creator
        on creator.id = task.created_by
      left join app_modules.task_notes as note
        on note.task_id = task.id
       and note.user_id = v_user_id
      where app_private.task_is_visible(v_user_id, task.id)
    ),
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', team.id,
        'name', team.name,
        'canManage', app_private.can_manage_team(v_user_id, team.id),
        'memberIds', coalesce((
          select jsonb_agg(membership.user_id order by membership.user_id)
          from app_portal.team_memberships as membership
          where membership.team_id = team.id
            and membership.is_active
        ), '[]'::jsonb)
      ) order by team.name), '[]'::jsonb)
      from app_portal.teams as team
      where team.is_active
        and (
          app_private.has_capability(v_user_id, 'tasks.manage')
          or app_private.is_team_member(v_user_id, team.id)
        )
    ),
    'users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', portal_user.id,
        'name', portal_user.first_name || ' ' || portal_user.last_name,
        'userCode', portal_user.user_code
      ) order by portal_user.last_name, portal_user.first_name), '[]'::jsonb)
      from app_portal.users as portal_user
      where portal_user.status = 'ACTIVE'
        and (
          app_private.has_capability(v_user_id, 'tasks.manage')
          or portal_user.id = v_user_id
          or exists (
            select 1
            from app_portal.team_memberships as own_membership
            join app_portal.team_memberships as target_membership
              on target_membership.team_id = own_membership.team_id
             and target_membership.user_id = portal_user.id
             and target_membership.is_active
            where own_membership.user_id = v_user_id
              and own_membership.is_active
              and own_membership.team_role in ('LEAD', 'CO_LEAD')
          )
          or app_private.is_office_holder(v_user_id)
        )
    ),
    'canCreateBoard',
      app_private.has_capability(v_user_id, 'tasks.manage')
      or app_private.is_office_holder(v_user_id),
    'canManageAll', app_private.has_capability(v_user_id, 'tasks.manage')
  );
end;
$$;

create or replace function app_private.api_save_task(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_context text := upper(coalesce(p_payload ->> 'context', 'TEAM'));
  v_team_id uuid := nullif(p_payload ->> 'teamId', '')::uuid;
  v_title text := btrim(coalesce(p_payload ->> 'title', ''));
  v_description text := left(coalesce(p_payload ->> 'description', ''), 4000);
  v_priority text := upper(coalesce(p_payload ->> 'priority', 'NORMAL'));
  v_assigned_user_id uuid := nullif(p_payload ->> 'assignedUserId', '')::uuid;
  v_assignment_reason text := left(btrim(coalesce(p_payload ->> 'assignmentReason', '')), 1000);
  v_before jsonb;
begin
  if v_context not in ('TEAM', 'BOARD') then
    raise exception 'Unzulässiger Aufgabenkontext.' using errcode = '22023';
  end if;
  if length(v_title) < 1 or length(v_title) > 300 then
    raise exception 'Der Aufgabentitel ist erforderlich.' using errcode = '22023';
  end if;
  if v_priority not in ('URGENT', 'HIGH', 'NORMAL', 'LOW') then
    raise exception 'Unzulässige Priorität.' using errcode = '22023';
  end if;

  if v_context = 'TEAM' then
    if v_team_id is null then
      raise exception 'Für eine Teamaufgabe ist ein Team erforderlich.' using errcode = '22023';
    end if;
    if not app_private.can_manage_team(v_actor, v_team_id)
       and not app_private.has_capability(v_actor, 'tasks.manage') then
      raise exception 'Teamaufgaben dürfen nur durch die Teamleitung oder Administration erstellt werden.'
        using errcode = '42501';
    end if;
    if v_assigned_user_id is not null
       and not app_private.is_team_member(v_assigned_user_id, v_team_id) then
      raise exception 'Teamaufgaben dürfen nur aktiven Teammitgliedern zugewiesen werden.'
        using errcode = '23514';
    end if;
  else
    v_team_id := null;
    if not app_private.is_office_holder(v_actor)
       and not app_private.has_capability(v_actor, 'tasks.manage') then
      raise exception 'Vorstandsaufgaben dürfen nur durch Amtsinhaber oder Administration erstellt werden.'
        using errcode = '42501';
    end if;
    if v_assigned_user_id is not null
       and not app_private.is_office_holder(v_assigned_user_id)
       and length(v_assignment_reason) < 1 then
      raise exception 'Bei Zuweisung an einen Nicht-Amtsinhaber ist eine Begründung erforderlich.'
        using errcode = '23514';
    end if;
  end if;

  if v_assigned_user_id is not null and not exists (
    select 1 from app_portal.users
    where id = v_assigned_user_id and status = 'ACTIVE'
  ) then
    raise exception 'Aktiver Zielbenutzer wurde nicht gefunden.' using errcode = '23503';
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
    if not app_private.task_is_manageable(v_actor, v_id) then
      raise exception 'Aufgabe darf nicht bearbeitet werden.' using errcode = '42501';
    end if;

    select to_jsonb(task) into v_before
    from app_modules.tasks as task
    where task.id = v_id
    for update;

    if v_before is null then
      raise exception 'Aufgabe wurde nicht gefunden.' using errcode = 'P0002';
    end if;

    update app_modules.tasks
    set context_type = v_context,
        team_id = v_team_id,
        title = v_title,
        description = v_description,
        priority = v_priority,
        assigned_user_id = v_assigned_user_id,
        assignment_reason = v_assignment_reason,
        revision = revision + 1
    where id = v_id;

    perform app_private.log_audit(
      v_actor,
      'TASK_UPDATED',
      'task',
      v_id::text,
      jsonb_build_object('revision', v_before ->> 'revision'),
      jsonb_build_object(
        'context', v_context,
        'teamId', v_team_id,
        'assignedUserId', v_assigned_user_id
      )
    );
  end if;

  return app_private.api_tasks_snapshot();
end;
$$;

create or replace function app_private.api_set_task_status(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_status text := upper(coalesce(p_payload ->> 'status', 'OPEN'));
  v_task app_modules.tasks%rowtype;
begin
  if v_status not in ('OPEN', 'IN_PROGRESS', 'WAITING', 'DONE', 'ARCHIVED') then
    raise exception 'Unzulässiger Aufgabenstatus.' using errcode = '22023';
  end if;

  select * into v_task
  from app_modules.tasks
  where id = v_id
  for update;

  if v_task.id is null or not app_private.task_is_visible(v_actor, v_id) then
    raise exception 'Aufgabe wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_actor <> v_task.assigned_user_id
     and not app_private.task_is_manageable(v_actor, v_id) then
    raise exception 'Aufgabenstatus darf nicht geändert werden.' using errcode = '42501';
  end if;

  if v_status = 'ARCHIVED'
     and not app_private.task_is_manageable(v_actor, v_id) then
    raise exception 'Nur Aufgabenverantwortliche dürfen archivieren.' using errcode = '42501';
  end if;

  update app_modules.tasks
  set status = v_status,
      completed_at = case when v_status = 'DONE' then now() else null end,
      completed_by = case when v_status = 'DONE' then v_actor else null end,
      archived_at = case when v_status = 'ARCHIVED' then now() else null end,
      revision = revision + 1
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'TASK_STATUS_UPDATED',
    'task',
    v_id::text,
    jsonb_build_object('status', v_task.status),
    jsonb_build_object('status', v_status)
  );

  return app_private.api_tasks_snapshot();
end;
$$;

create or replace function app_private.api_save_task_note(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_task_id uuid := (p_payload ->> 'taskId')::uuid;
  v_content text := left(coalesce(p_payload ->> 'content', ''), 4000);
begin
  if not app_private.task_is_visible(v_actor, v_task_id) then
    raise exception 'Aufgabe wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  insert into app_modules.task_notes (
    task_id,
    user_id,
    content
  )
  values (
    v_task_id,
    v_actor,
    v_content
  )
  on conflict (task_id, user_id) do update
  set content = excluded.content,
      revision = app_modules.task_notes.revision + 1;

  perform app_private.log_audit(
    v_actor,
    'TASK_NOTE_UPDATED',
    'task_note',
    v_task_id::text || ':' || v_actor::text,
    null,
    jsonb_build_object('contentLength', length(v_content))
  );

  return app_private.api_tasks_snapshot();
end;
$$;

create or replace function public.pd_create_bootstrap_token(
  p_token_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service-Zugriff erforderlich.' using errcode = '42501';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Ungültiger Token-Hash.' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then
    raise exception 'Ungültige Ablaufzeit.' using errcode = '22023';
  end if;

  delete from app_private.bootstrap_tokens
  where used_at is null or expires_at <= now();

  insert into app_private.bootstrap_tokens(token_hash, expires_at)
  values (p_token_hash, p_expires_at)
  returning id into v_id;

  return v_id;
end;
$$;

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

  case v_action
    when 'bootstrap' then
      v_data := app_private.api_bootstrap();
    when 'submit_access_request' then
      v_data := app_private.api_submit_access_request(coalesce(p_payload, '{}'::jsonb));
    when 'claim_initial_admin' then
      v_data := app_private.api_claim_initial_admin(coalesce(p_payload, '{}'::jsonb));
    when 'update_profile' then
      v_data := app_private.api_update_profile(coalesce(p_payload, '{}'::jsonb));
    when 'dashboard' then
      v_data := app_private.api_dashboard();
    when 'admin_snapshot' then
      v_data := app_private.api_admin_snapshot();
    when 'save_role' then
      v_data := app_private.api_save_role(coalesce(p_payload, '{}'::jsonb));
    when 'delete_role' then
      v_data := app_private.api_delete_role(coalesce(p_payload, '{}'::jsonb));
    when 'set_role_capabilities' then
      v_data := app_private.api_set_role_capabilities(coalesce(p_payload, '{}'::jsonb));
    when 'save_user' then
      v_data := app_private.api_save_user(coalesce(p_payload, '{}'::jsonb));
    when 'approve_request' then
      v_data := app_private.api_approve_request(coalesce(p_payload, '{}'::jsonb));
    when 'reject_request' then
      v_data := app_private.api_reject_request(coalesce(p_payload, '{}'::jsonb));
    when 'fanclub_snapshot' then
      v_data := app_private.api_fanclub_snapshot();
    when 'save_member' then
      v_data := app_private.api_save_member(coalesce(p_payload, '{}'::jsonb));
    when 'save_offices' then
      v_data := app_private.api_save_offices(coalesce(p_payload, '{}'::jsonb));
    when 'teams_snapshot' then
      v_data := app_private.api_teams_snapshot();
    when 'save_team' then
      v_data := app_private.api_save_team(coalesce(p_payload, '{}'::jsonb));
    when 'save_team_member' then
      v_data := app_private.api_save_team_member(coalesce(p_payload, '{}'::jsonb));
    when 'remove_team_member' then
      v_data := app_private.api_remove_team_member(coalesce(p_payload, '{}'::jsonb));
    when 'tasks_snapshot' then
      v_data := app_private.api_tasks_snapshot();
    when 'save_task' then
      v_data := app_private.api_save_task(coalesce(p_payload, '{}'::jsonb));
    when 'set_task_status' then
      v_data := app_private.api_set_task_status(coalesce(p_payload, '{}'::jsonb));
    when 'save_task_note' then
      v_data := app_private.api_save_task_note(coalesce(p_payload, '{}'::jsonb));
    else
      raise exception 'Unbekannte Portalaktion: %', v_action using errcode = '22023';
  end case;

  return jsonb_build_object(
    'ok', true,
    'data', v_data
  );
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

revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;

revoke all on function public.pd_create_bootstrap_token(text, timestamptz) from public;
revoke all on function public.pd_create_bootstrap_token(text, timestamptz) from anon;
revoke all on function public.pd_create_bootstrap_token(text, timestamptz) from authenticated;
grant execute on function public.pd_create_bootstrap_token(text, timestamptz) to service_role;

revoke all on all functions in schema app_private from public, anon, authenticated;
