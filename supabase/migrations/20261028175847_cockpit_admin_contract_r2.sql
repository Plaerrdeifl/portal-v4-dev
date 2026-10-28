begin;

-- AP-03/R2: narrow Cockpit administration contracts over the existing
-- Portal identity, capability, audit and pd_api boundaries.

create function app_private.cockpit_assert_payload(
  p_payload jsonb,
  p_allowed_keys text[],
  p_required_keys text[] default '{}'::text[]
)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
begin
  if pg_catalog.jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'COCKPIT_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_payload) as payload_key(key)
    where not payload_key.key = any(p_allowed_keys)
  ) or exists (
    select 1
    from pg_catalog.unnest(p_required_keys) as required_key(key)
    where not p_payload ? required_key.key
  ) then
    raise exception 'COCKPIT_INVALID_PAYLOAD' using errcode = '22023';
  end if;
end;
$function$;

create function app_private.cockpit_require_admin_actor()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if v_actor is null then
    raise exception 'COCKPIT_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select cockpit_access.role
  into v_role
  from app_portal.users as portal_user
  join app_portal.portal_roles as portal_role
    on portal_role.id = portal_user.role_id
   and portal_role.is_active
  join app_portal.cockpit_access as cockpit_access
    on cockpit_access.user_id = portal_user.id
   and cockpit_access.is_enabled
   and cockpit_access.role in ('SYSTEM_ADMIN', 'ADMIN')
  where portal_user.id = v_actor
    and portal_user.status = 'ACTIVE';

  if not found then
    raise exception 'COCKPIT_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  return v_role;
end;
$function$;

create function app_private.cockpit_lock_admin_actor()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'COCKPIT_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  perform 1
  from app_portal.users as portal_user
  join app_portal.cockpit_access as cockpit_access
    on cockpit_access.user_id = portal_user.id
  where portal_user.id = v_actor
  for update of portal_user, cockpit_access;

  return app_private.cockpit_require_admin_actor();
end;
$function$;

create function app_private.cockpit_active_system_admin_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.count(*)::integer
  from app_portal.cockpit_access as cockpit_access
  join app_portal.users as portal_user
    on portal_user.id = cockpit_access.user_id
   and portal_user.status = 'ACTIVE'
  join app_portal.portal_roles as portal_role
    on portal_role.id = portal_user.role_id
   and portal_role.is_active
  where cockpit_access.role = 'SYSTEM_ADMIN'
    and cockpit_access.is_enabled;
$function$;

create function app_private.cockpit_admin_user_projection(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user record;
  v_access app_portal.cockpit_access%rowtype;
  v_assigned boolean := false;
  v_cockpit_allowed boolean := false;
  v_liveticker_personal boolean := false;
  v_generator_personal boolean := false;
  v_liveticker_effective boolean := false;
  v_generator_effective boolean := false;
begin
  select
    portal_user.id,
    portal_user.user_code,
    portal_user.email,
    portal_user.first_name,
    portal_user.last_name,
    portal_user.status,
    portal_role.is_active as portal_role_active
  into v_user
  from app_portal.users as portal_user
  join app_portal.portal_roles as portal_role
    on portal_role.id = portal_user.role_id
  where portal_user.id = p_user_id;

  if not found then
    raise exception 'COCKPIT_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  select cockpit_access.*
  into v_access
  from app_portal.cockpit_access as cockpit_access
  where cockpit_access.user_id = p_user_id;
  v_assigned := found;

  select
    pg_catalog.bool_or(personal.capability_code = 'liveticker.manage'),
    pg_catalog.bool_or(
      personal.capability_code = 'social_media_generator.use'
    )
  into v_liveticker_personal, v_generator_personal
  from app_portal.user_capabilities as personal
  where personal.user_id = p_user_id
    and personal.capability_code in (
      'liveticker.manage',
      'social_media_generator.use'
    );

  v_liveticker_personal := coalesce(v_liveticker_personal, false);
  v_generator_personal := coalesce(v_generator_personal, false);
  v_cockpit_allowed := app_private.cockpit_user_has_access(p_user_id);
  v_liveticker_effective := app_private.has_capability(
    p_user_id,
    'liveticker.manage'
  );
  -- The generator has an established fachvertrag that additionally includes
  -- an active SOCIAL_MEDIA team membership. Keep that source authoritative
  -- instead of duplicating (or narrowing) its access decision here.
  v_generator_effective :=
    app_private.social_media_generator_user_has_access(p_user_id);

  return pg_catalog.jsonb_build_object(
    'schemaVersion', 2,
    'userId', v_user.id,
    'userCode', v_user.user_code,
    'email', v_user.email,
    'firstName', v_user.first_name,
    'lastName', v_user.last_name,
    'portal', pg_catalog.jsonb_build_object(
      'status', v_user.status,
      'roleActive', v_user.portal_role_active,
      'active', v_user.status = 'ACTIVE' and v_user.portal_role_active
    ),
    'cockpit', pg_catalog.jsonb_build_object(
      'assigned', v_assigned,
      'role', case when v_assigned then v_access.role else null end,
      'enabled', case when v_assigned then v_access.is_enabled else false end,
      'allowed', v_cockpit_allowed,
      'revision', case when v_assigned then v_access.revision else null end
    ),
    'permissions', pg_catalog.jsonb_build_object(
      'liveticker', pg_catalog.jsonb_build_object(
        'capability', 'liveticker.manage',
        'personallyAssigned', v_liveticker_personal,
        'effectiveFromAllSources', v_liveticker_effective,
        'effectiveInCockpit', v_cockpit_allowed and v_liveticker_effective
      ),
      'generator', pg_catalog.jsonb_build_object(
        'capability', 'social_media_generator.use',
        'personallyAssigned', v_generator_personal,
        'effectiveFromAllSources', v_generator_effective,
        'effectiveInCockpit', v_cockpit_allowed and v_generator_effective
      )
    )
  );
end;
$function$;

-- Global Portal administration remains authoritative for Portal users and
-- roles. These narrow wrappers only serialize the two existing mutations that
-- can make a Cockpit SYSTEM_ADMIN globally inactive, then enforce the same
-- last-SYSTEM_ADMIN invariant used by Cockpit administration. No Portal
-- permission is added or accepted as a Cockpit role.
alter function app_private.api_save_user(jsonb)
  rename to api_save_user_before_cockpit_admin_r2;

create function app_private.api_save_user(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(70303, 2);

  v_result := app_private.api_save_user_before_cockpit_admin_r2(
    p_payload
  );

  if exists (
       select 1
       from app_portal.audit_events as audit_event
       where audit_event.action = 'COCKPIT_FIRST_SYSTEM_ADMIN_BOOTSTRAPPED'
     )
     and app_private.cockpit_active_system_admin_count() < 1 then
    raise exception 'COCKPIT_LAST_SYSTEM_ADMIN_REQUIRED'
      using errcode = '42501';
  end if;

  return v_result;
end;
$function$;

alter function app_private.api_save_role(jsonb)
  rename to api_save_role_before_cockpit_admin_r2;

create function app_private.api_save_role(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(70303, 2);

  v_result := app_private.api_save_role_before_cockpit_admin_r2(
    p_payload
  );

  if exists (
       select 1
       from app_portal.audit_events as audit_event
       where audit_event.action = 'COCKPIT_FIRST_SYSTEM_ADMIN_BOOTSTRAPPED'
     )
     and app_private.cockpit_active_system_admin_count() < 1 then
    raise exception 'COCKPIT_LAST_SYSTEM_ADMIN_REQUIRED'
      using errcode = '42501';
  end if;

  return v_result;
end;
$function$;

create function app_private.api_cockpit_admin_users_list(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor_role text;
  v_users jsonb;
begin
  -- Existing central identity/invitation functions are intentionally not
  -- exposed here. A later user-creation slice must wrap those contracts with
  -- the same Cockpit actor, target, allowlist, revision and audit boundary;
  -- generic Portal administration must never be delegated to Cockpit ADMIN.
  perform app_private.cockpit_assert_payload(
    coalesce(p_payload, '{}'::jsonb),
    '{}'::text[]
  );
  v_actor_role := app_private.cockpit_require_admin_actor();

  select coalesce(
    pg_catalog.jsonb_agg(
      app_private.cockpit_admin_user_projection(portal_user.id)
      order by portal_user.last_name, portal_user.first_name, portal_user.id
    ),
    '[]'::jsonb
  )
  into v_users
  from app_portal.users as portal_user
  join app_portal.portal_roles as portal_role
    on portal_role.id = portal_user.role_id
  left join app_portal.cockpit_access as cockpit_access
    on cockpit_access.user_id = portal_user.id
  where (
    v_actor_role = 'SYSTEM_ADMIN'
    and (
      cockpit_access.user_id is not null
      or (portal_user.status = 'ACTIVE' and portal_role.is_active)
    )
  ) or (
    v_actor_role = 'ADMIN'
    and (
      cockpit_access.role = 'USER'
      or (
        cockpit_access.user_id is null
        and portal_user.status = 'ACTIVE'
        and portal_role.is_active
      )
    )
  );

  return pg_catalog.jsonb_build_object(
    'schemaVersion', 2,
    'actorRole', v_actor_role,
    'users', v_users,
    'managedCapabilities', pg_catalog.jsonb_build_array(
      'liveticker.manage',
      'social_media_generator.use'
    ),
    'identityCreationAvailable', false
  );
end;
$function$;

create function app_private.api_cockpit_admin_user_get(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor_role text;
  v_target uuid;
  v_target_status text;
  v_target_portal_role_active boolean;
  v_target_cockpit_role text;
begin
  perform app_private.cockpit_assert_payload(
    coalesce(p_payload, '{}'::jsonb),
    array['targetUserId'],
    array['targetUserId']
  );
  v_actor_role := app_private.cockpit_require_admin_actor();

  begin
    v_target := nullif(
      pg_catalog.btrim(coalesce(p_payload ->> 'targetUserId', '')),
      ''
    )::uuid;
  exception when invalid_text_representation then
    raise exception 'COCKPIT_TARGET_NOT_FOUND' using errcode = 'P0002';
  end;

  select portal_user.status, portal_role.is_active, cockpit_access.role
  into v_target_status, v_target_portal_role_active, v_target_cockpit_role
  from app_portal.users as portal_user
  join app_portal.portal_roles as portal_role
    on portal_role.id = portal_user.role_id
  left join app_portal.cockpit_access as cockpit_access
    on cockpit_access.user_id = portal_user.id
  where portal_user.id = v_target;

  if not found or not (
    v_actor_role = 'SYSTEM_ADMIN'
    and (
      v_target_cockpit_role is not null
      or (v_target_status = 'ACTIVE' and v_target_portal_role_active)
    )
    or v_actor_role = 'ADMIN'
    and (
      v_target_cockpit_role = 'USER'
      or (
        v_target_cockpit_role is null
        and v_target_status = 'ACTIVE'
        and v_target_portal_role_active
      )
    )
  ) then
    raise exception 'COCKPIT_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  return app_private.cockpit_admin_user_projection(v_target);
end;
$function$;

create function app_private.api_cockpit_admin_access_set(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target uuid;
  v_role text;
  v_enabled boolean;
  v_expected_revision integer;
  v_expected_is_null boolean := false;
  v_target_status text;
  v_target_portal_role_active boolean;
  v_access app_portal.cockpit_access%rowtype;
  v_assigned boolean := false;
  v_before jsonb;
  v_after jsonb;
  v_changed boolean := false;
begin
  perform app_private.cockpit_assert_payload(
    coalesce(p_payload, '{}'::jsonb),
    array['targetUserId', 'role', 'isEnabled', 'expectedRevision'],
    array['targetUserId', 'role', 'isEnabled', 'expectedRevision']
  );

  if pg_catalog.jsonb_typeof(p_payload -> 'role') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'isEnabled') is distinct from 'boolean'
     or (
       p_payload -> 'expectedRevision' <> 'null'::jsonb
       and pg_catalog.jsonb_typeof(p_payload -> 'expectedRevision')
         is distinct from 'number'
     ) then
    raise exception 'COCKPIT_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  begin
    v_target := nullif(
      pg_catalog.btrim(coalesce(p_payload ->> 'targetUserId', '')),
      ''
    )::uuid;
    v_role := pg_catalog.upper(pg_catalog.btrim(p_payload ->> 'role'));
    v_enabled := (p_payload ->> 'isEnabled')::boolean;
    v_expected_is_null := p_payload -> 'expectedRevision' = 'null'::jsonb;
    if not v_expected_is_null then
      v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
    end if;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'COCKPIT_INVALID_PAYLOAD' using errcode = '22023';
  end;

  if v_target is null
     or v_role not in ('SYSTEM_ADMIN', 'ADMIN', 'USER')
     or (not v_expected_is_null and v_expected_revision < 1) then
    raise exception 'COCKPIT_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  -- Every Cockpit administration mutation takes the same transaction lock.
  -- This gives target checks, revisions and the final SYSTEM_ADMIN invariant a
  -- deterministic order, including cross-target concurrent changes.
  perform pg_catalog.pg_advisory_xact_lock(70303, 2);
  v_actor_role := app_private.cockpit_lock_admin_actor();

  select portal_user.status, portal_role.is_active
  into v_target_status, v_target_portal_role_active
  from app_portal.users as portal_user
  join app_portal.portal_roles as portal_role
    on portal_role.id = portal_user.role_id
  where portal_user.id = v_target
  for update of portal_user;

  if not found then
    raise exception 'COCKPIT_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  select cockpit_access.*
  into v_access
  from app_portal.cockpit_access as cockpit_access
  where cockpit_access.user_id = v_target
  for update;
  v_assigned := found;

  if v_actor_role = 'ADMIN'
     and (
       v_role <> 'USER'
       or (v_assigned and v_access.role <> 'USER')
     ) then
    raise exception 'COCKPIT_TARGET_NOT_MANAGEABLE' using errcode = '42501';
  end if;

  if (not v_assigned or v_enabled)
     and (
       v_target_status <> 'ACTIVE'
       or not v_target_portal_role_active
     ) then
    raise exception 'COCKPIT_TARGET_INACTIVE' using errcode = '22023';
  end if;

  if not v_assigned and not v_expected_is_null then
    raise exception 'STALE_REVISION' using errcode = '40001';
  elsif v_assigned and (
    v_expected_is_null
    or v_expected_revision is distinct from v_access.revision
  ) then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;

  v_before := app_private.cockpit_admin_user_projection(v_target);

  if not v_assigned then
    insert into app_portal.cockpit_access (
      user_id,
      role,
      is_enabled,
      revision,
      created_by,
      updated_by
    ) values (
      v_target,
      v_role,
      v_enabled,
      1,
      v_actor,
      v_actor
    );
    v_changed := true;
  elsif v_access.role is distinct from v_role
        or v_access.is_enabled is distinct from v_enabled then
    update app_portal.cockpit_access as cockpit_access
    set role = v_role,
        is_enabled = v_enabled,
        revision = cockpit_access.revision + 1,
        updated_by = v_actor
    where cockpit_access.user_id = v_target;
    v_changed := true;
  end if;

  if app_private.cockpit_active_system_admin_count() < 1 then
    raise exception 'COCKPIT_LAST_SYSTEM_ADMIN_REQUIRED'
      using errcode = '42501';
  end if;

  v_after := app_private.cockpit_admin_user_projection(v_target);

  perform app_private.log_audit(
    v_actor,
    'COCKPIT_ACCESS_SET',
    'cockpit_access',
    v_target::text,
    v_before,
    v_after,
    pg_catalog.jsonb_build_object(
      'targetUserId', v_target,
      'actorCockpitRole', v_actor_role,
      'changed', v_changed,
      'expectedRevision', v_expected_revision
    )
  );

  return v_after;
end;
$function$;

create function app_private.api_cockpit_admin_personal_capabilities_set(
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_target uuid;
  v_expected_revision integer;
  v_requested jsonb := p_payload -> 'capabilities';
  v_before_capabilities jsonb := '[]'::jsonb;
  v_after_capabilities jsonb := '[]'::jsonb;
  v_added jsonb := '[]'::jsonb;
  v_removed jsonb := '[]'::jsonb;
  v_target_status text;
  v_target_portal_role_active boolean;
  v_access app_portal.cockpit_access%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_changed boolean := false;
begin
  perform app_private.cockpit_assert_payload(
    coalesce(p_payload, '{}'::jsonb),
    array['targetUserId', 'capabilities', 'expectedRevision'],
    array['targetUserId', 'capabilities', 'expectedRevision']
  );

  if pg_catalog.jsonb_typeof(v_requested) is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_payload -> 'expectedRevision')
       is distinct from 'number'
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(v_requested) as item(value)
       where pg_catalog.jsonb_typeof(item.value) is distinct from 'string'
     ) then
    raise exception 'COCKPIT_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  begin
    v_target := nullif(
      pg_catalog.btrim(coalesce(p_payload ->> 'targetUserId', '')),
      ''
    )::uuid;
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'COCKPIT_INVALID_PAYLOAD' using errcode = '22023';
  end;

  if v_target is null or v_expected_revision < 1
     or pg_catalog.jsonb_array_length(v_requested) <> (
       select pg_catalog.count(distinct requested.code)
       from pg_catalog.jsonb_array_elements_text(v_requested)
         as requested(code)
     )
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements_text(v_requested)
         as requested(code)
       where requested.code not in (
         'liveticker.manage',
         'social_media_generator.use'
       )
     )
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements_text(v_requested)
         as requested(code)
       left join app_portal.capabilities as capability
         on capability.code = requested.code
        and capability.is_active
       where capability.code is null
     ) then
    raise exception 'COCKPIT_INVALID_CAPABILITY_ALLOWLIST'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(70303, 2);
  v_actor_role := app_private.cockpit_lock_admin_actor();

  select portal_user.status, portal_role.is_active
  into v_target_status, v_target_portal_role_active
  from app_portal.users as portal_user
  join app_portal.portal_roles as portal_role
    on portal_role.id = portal_user.role_id
  where portal_user.id = v_target
  for update of portal_user;

  if not found then
    raise exception 'COCKPIT_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  select cockpit_access.*
  into v_access
  from app_portal.cockpit_access as cockpit_access
  where cockpit_access.user_id = v_target
  for update;

  if not found then
    raise exception 'COCKPIT_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_actor_role = 'ADMIN' and v_access.role <> 'USER' then
    raise exception 'COCKPIT_TARGET_NOT_MANAGEABLE' using errcode = '42501';
  end if;

  if v_expected_revision is distinct from v_access.revision then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(personal.capability_code order by personal.capability_code),
    '[]'::jsonb
  )
  into v_before_capabilities
  from app_portal.user_capabilities as personal
  where personal.user_id = v_target
    and personal.capability_code in (
      'liveticker.manage',
      'social_media_generator.use'
    );

  select coalesce(pg_catalog.jsonb_agg(code order by code), '[]'::jsonb)
  into v_added
  from (
    select requested.code
    from pg_catalog.jsonb_array_elements_text(v_requested) as requested(code)
    except
    select existing.code
    from pg_catalog.jsonb_array_elements_text(v_before_capabilities)
      as existing(code)
  ) as added;

  select coalesce(pg_catalog.jsonb_agg(code order by code), '[]'::jsonb)
  into v_removed
  from (
    select existing.code
    from pg_catalog.jsonb_array_elements_text(v_before_capabilities)
      as existing(code)
    except
    select requested.code
    from pg_catalog.jsonb_array_elements_text(v_requested) as requested(code)
  ) as removed;

  if pg_catalog.jsonb_array_length(v_added) > 0
     and (
       v_target_status <> 'ACTIVE'
       or not v_target_portal_role_active
     ) then
    raise exception 'COCKPIT_TARGET_INACTIVE' using errcode = '22023';
  end if;

  v_before := app_private.cockpit_admin_user_projection(v_target);

  delete from app_portal.user_capabilities as personal
  where personal.user_id = v_target
    and personal.capability_code in (
      'liveticker.manage',
      'social_media_generator.use'
    )
    and not exists (
      select 1
      from pg_catalog.jsonb_array_elements_text(v_requested)
        as requested(code)
      where requested.code = personal.capability_code
    );

  insert into app_portal.user_capabilities (
    user_id,
    capability_code,
    created_by
  )
  select v_target, requested.code, v_actor
  from pg_catalog.jsonb_array_elements_text(v_requested) as requested(code)
  on conflict (user_id, capability_code) do nothing;

  v_changed := pg_catalog.jsonb_array_length(v_added) > 0
    or pg_catalog.jsonb_array_length(v_removed) > 0;

  if v_changed then
    update app_portal.cockpit_access as cockpit_access
    set revision = cockpit_access.revision + 1,
        updated_by = v_actor
    where cockpit_access.user_id = v_target;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(personal.capability_code order by personal.capability_code),
    '[]'::jsonb
  )
  into v_after_capabilities
  from app_portal.user_capabilities as personal
  where personal.user_id = v_target
    and personal.capability_code in (
      'liveticker.manage',
      'social_media_generator.use'
    );

  v_after := app_private.cockpit_admin_user_projection(v_target);

  perform app_private.log_audit(
    v_actor,
    'COCKPIT_PERSONAL_CAPABILITIES_SET',
    'user_capabilities',
    v_target::text,
    pg_catalog.jsonb_build_object(
      'projection', v_before,
      'personalCapabilities', v_before_capabilities
    ),
    pg_catalog.jsonb_build_object(
      'projection', v_after,
      'personalCapabilities', v_after_capabilities
    ),
    pg_catalog.jsonb_build_object(
      'targetUserId', v_target,
      'actorCockpitRole', v_actor_role,
      'changed', v_changed,
      'expectedRevision', v_expected_revision,
      'addedCapabilities', v_added,
      'removedCapabilities', v_removed
    )
  );

  return v_after;
end;
$function$;

-- Deliberately not routed through public.pd_api. This is a one-time operator
-- procedure for the first assignment only. It has no Portal-admin bypass,
-- accepts no implicit identity and is executable exclusively by postgres.
create function app_private.cockpit_bootstrap_first_system_admin(
  p_target_user_id uuid,
  p_operator_reference text,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_operator_reference text := pg_catalog.btrim(
    coalesce(p_operator_reference, '')
  );
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_target_status text;
  v_target_portal_role_active boolean;
  v_after jsonb;
begin
  if p_target_user_id is null
     or pg_catalog.length(v_operator_reference) not between 3 and 160
     or pg_catalog.length(v_reason) not between 12 and 500 then
    raise exception 'COCKPIT_BOOTSTRAP_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(70303, 2);

  if exists (
    select 1
    from app_portal.audit_events as audit_event
    where audit_event.action = 'COCKPIT_FIRST_SYSTEM_ADMIN_BOOTSTRAPPED'
  ) or exists (
    select 1
    from app_portal.cockpit_access as cockpit_access
    where cockpit_access.role = 'SYSTEM_ADMIN'
  ) then
    raise exception 'COCKPIT_BOOTSTRAP_ALREADY_COMPLETED'
      using errcode = '55000';
  end if;

  select portal_user.status, portal_role.is_active
  into v_target_status, v_target_portal_role_active
  from app_portal.users as portal_user
  join app_portal.portal_roles as portal_role
    on portal_role.id = portal_user.role_id
  where portal_user.id = p_target_user_id
  for update of portal_user;

  if not found
     or v_target_status <> 'ACTIVE'
     or not v_target_portal_role_active
     or exists (
       select 1
       from app_portal.cockpit_access as cockpit_access
       where cockpit_access.user_id = p_target_user_id
     ) then
    raise exception 'COCKPIT_BOOTSTRAP_TARGET_NOT_ELIGIBLE'
      using errcode = '22023';
  end if;

  insert into app_portal.cockpit_access (
    user_id,
    role,
    is_enabled,
    revision,
    created_by,
    updated_by
  ) values (
    p_target_user_id,
    'SYSTEM_ADMIN',
    true,
    1,
    null,
    null
  );

  v_after := app_private.cockpit_admin_user_projection(p_target_user_id);

  perform app_private.log_audit(
    null,
    'COCKPIT_FIRST_SYSTEM_ADMIN_BOOTSTRAPPED',
    'cockpit_access',
    p_target_user_id::text,
    null,
    v_after,
    pg_catalog.jsonb_build_object(
      'targetUserId', p_target_user_id,
      'operatorReference', v_operator_reference,
      'reason', v_reason,
      'databaseSessionUser', session_user,
      'bootstrapMode', 'POSTGRES_OPERATOR_ONLY'
    )
  );

  return v_after;
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_cockpit_admin_r2;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_cockpit_admin_r2()
    || array[
      'cockpit_admin_users_list',
      'cockpit_admin_user_get',
      'cockpit_admin_access_set',
      'cockpit_admin_personal_capabilities_set'
    ]::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_cockpit_admin_r2;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'cockpit_admin_users_list' then 'READ'
    when 'cockpit_admin_user_get' then 'READ'
    when 'cockpit_admin_access_set' then 'USER_MUTATION'
    when 'cockpit_admin_personal_capabilities_set' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_cockpit_admin_r2(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_cockpit_admin_r2;

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
    when 'cockpit_admin_users_list' then
      return app_private.api_cockpit_admin_users_list(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'cockpit_admin_user_get' then
      return app_private.api_cockpit_admin_user_get(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'cockpit_admin_access_set' then
      return app_private.api_cockpit_admin_access_set(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'cockpit_admin_personal_capabilities_set' then
      return app_private.api_cockpit_admin_personal_capabilities_set(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return app_private.pd_api_dispatch_current_before_cockpit_admin_r2(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.cockpit_assert_payload(jsonb, text[], text[]),
  app_private.cockpit_require_admin_actor(),
  app_private.cockpit_lock_admin_actor(),
  app_private.cockpit_active_system_admin_count(),
  app_private.cockpit_admin_user_projection(uuid),
  app_private.api_save_user_before_cockpit_admin_r2(jsonb),
  app_private.api_save_user(jsonb),
  app_private.api_save_role_before_cockpit_admin_r2(jsonb),
  app_private.api_save_role(jsonb),
  app_private.api_cockpit_admin_users_list(jsonb),
  app_private.api_cockpit_admin_user_get(jsonb),
  app_private.api_cockpit_admin_access_set(jsonb),
  app_private.api_cockpit_admin_personal_capabilities_set(jsonb),
  app_private.cockpit_bootstrap_first_system_admin(uuid, text, text),
  app_private.pd_api_current_actions_before_cockpit_admin_r2(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_cockpit_admin_r2(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_cockpit_admin_r2(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.cockpit_assert_payload(jsonb, text[], text[]),
  app_private.cockpit_require_admin_actor(),
  app_private.cockpit_lock_admin_actor(),
  app_private.cockpit_active_system_admin_count(),
  app_private.cockpit_admin_user_projection(uuid),
  app_private.api_save_user_before_cockpit_admin_r2(jsonb),
  app_private.api_save_user(jsonb),
  app_private.api_save_role_before_cockpit_admin_r2(jsonb),
  app_private.api_save_role(jsonb),
  app_private.api_cockpit_admin_users_list(jsonb),
  app_private.api_cockpit_admin_user_get(jsonb),
  app_private.api_cockpit_admin_access_set(jsonb),
  app_private.api_cockpit_admin_personal_capabilities_set(jsonb),
  app_private.cockpit_bootstrap_first_system_admin(uuid, text, text),
  app_private.pd_api_current_actions_before_cockpit_admin_r2(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_cockpit_admin_r2(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_cockpit_admin_r2(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

comment on function app_private.api_cockpit_admin_access_set(jsonb) is
  'AP-03/R2 Cockpit-only role/enabled mutation with actor/target checks, strict revision, audit and concurrent last-SYSTEM_ADMIN protection.';
comment on function app_private.api_cockpit_admin_personal_capabilities_set(jsonb) is
  'AP-03/R2 mutation for exactly the two personal Cockpit module capabilities; every other personal/effective source is preserved.';
comment on function app_private.api_save_user(jsonb) is
  'Existing Portal user mutation, serialized with AP-03/R2 and rejected if it would remove the last active Cockpit SYSTEM_ADMIN.';
comment on function app_private.api_save_role(jsonb) is
  'Existing Portal role mutation, serialized with AP-03/R2 and rejected if it would remove the last active Cockpit SYSTEM_ADMIN.';
comment on function app_private.cockpit_bootstrap_first_system_admin(uuid, text, text) is
  'One-time postgres-only first Cockpit SYSTEM_ADMIN assignment. Requires an explicit target, operator reference and reason; never exposed through pd_api.';

commit;
