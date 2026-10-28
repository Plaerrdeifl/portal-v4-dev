\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create schema app_portal;
create schema app_private;

create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $function$
  select nullif(
    pg_catalog.current_setting('request.jwt.claim.sub', true),
    ''
  )::uuid;
$function$;

create table auth.users (
  id uuid primary key,
  email text not null
);

create table app_portal.portal_roles (
  id uuid primary key,
  code text not null unique,
  name text not null,
  description text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  revision integer not null default 1
);

create table app_portal.users (
  id uuid primary key references auth.users(id),
  user_code text not null unique,
  email text not null,
  first_name text not null,
  last_name text not null,
  status text not null,
  role_id uuid not null references app_portal.portal_roles(id),
  revision integer not null default 1,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

create table app_portal.capabilities (
  code text primary key,
  name text not null,
  category text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table app_portal.user_capabilities (
  user_id uuid not null references app_portal.users(id) on delete cascade,
  capability_code text not null
    references app_portal.capabilities(code) on delete cascade,
  created_at timestamptz not null default pg_catalog.now(),
  created_by uuid references app_portal.users(id) on delete set null,
  primary key (user_id, capability_code)
);

create table app_portal.teams (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null default '',
  is_active boolean not null default true
);

create table app_portal.team_memberships (
  team_id uuid not null references app_portal.teams(id) on delete cascade,
  user_id uuid not null references app_portal.users(id) on delete cascade,
  team_role text not null,
  is_active boolean not null default true,
  primary key (team_id, user_id)
);

create table app_portal.cockpit_access (
  user_id uuid primary key references app_portal.users(id) on delete cascade,
  role text not null check (role in ('SYSTEM_ADMIN', 'ADMIN', 'USER')),
  is_enabled boolean not null default false,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default pg_catalog.now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default pg_catalog.now(),
  updated_by uuid references app_portal.users(id) on delete set null
);

alter table app_portal.cockpit_access enable row level security;
revoke all on table app_portal.cockpit_access
from public, anon, authenticated, service_role;

create table app_portal.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references app_portal.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null default '',
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default pg_catalog.now()
);

insert into app_portal.portal_roles (id, code, name)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'PORTAL_ADMIN',
    'Portal Admin'
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'PORTAL_USER',
    'Portal User'
  );

insert into app_portal.capabilities (
  code, name, category, sort_order
)
values
  ('portal.admin', 'Portal Admin', 'Portal', 1),
  ('users.manage', 'Users', 'Portal', 2),
  ('roles.manage', 'Roles', 'Portal', 3),
  ('events.manage', 'Events', 'Module', 4),
  ('liveticker.manage', 'Liveticker', 'Module', 5),
  ('social_media_generator.use', 'Generator', 'Module', 6);

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

create function app_private.has_capability(
  p_user_id uuid,
  p_capability text
)
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
    join app_portal.capabilities as capability
      on capability.code = p_capability
     and capability.is_active
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
      and (
        portal_role.code = 'PORTAL_ADMIN'
        or exists (
          select 1
          from app_portal.user_capabilities as personal
          where personal.user_id = portal_user.id
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
            where cockpit_access.user_id = portal_user.id
              and cockpit_access.role = 'SYSTEM_ADMIN'
              and cockpit_access.is_enabled
          )
        )
      )
  );
$function$;

-- Mirror the real generator fachvertrag: plain has_capability intentionally
-- does not treat SOCIAL_MEDIA membership as the generator capability.
create function app_private.social_media_generator_user_has_access(
  p_user_id uuid
)
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
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
      and (
        app_private.has_capability(
          portal_user.id,
          'social_media_generator.use'
        )
        or app_private.has_capability(portal_user.id, 'portal.admin')
        or exists (
          select 1
          from app_portal.team_memberships as membership
          join app_portal.teams as team
            on team.id = membership.team_id
           and team.is_active
          where membership.user_id = portal_user.id
            and membership.is_active
            and team.code = 'SOCIAL_MEDIA'
        )
      )
  );
$function$;

create function app_private.api_save_user(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := (p_payload ->> 'id')::uuid;
  v_role_id uuid := (p_payload ->> 'roleId')::uuid;
  v_status text := pg_catalog.upper(p_payload ->> 'status');
  v_expected_revision integer := (p_payload ->> 'expectedRevision')::integer;
  v_user app_portal.users%rowtype;
begin
  if not app_private.has_capability(auth.uid(), 'users.manage') then
    raise exception 'CAPABILITY_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from app_portal.portal_roles as portal_role
    where portal_role.id = v_role_id
      and portal_role.is_active
  ) then
    raise exception 'ACTIVE_ROLE_REQUIRED' using errcode = '23503';
  end if;

  select portal_user.*
  into v_user
  from app_portal.users as portal_user
  where portal_user.id = v_user_id
  for update;

  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_user.revision <> v_expected_revision then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;

  if v_user.role_id = v_role_id and v_user.status = v_status then
    return pg_catalog.jsonb_build_object(
      'userId', v_user_id,
      'status', v_status
    );
  end if;

  update app_portal.users as portal_user
  set role_id = v_role_id,
      status = v_status,
      revision = portal_user.revision + 1
  where portal_user.id = v_user_id;

  return pg_catalog.jsonb_build_object(
    'userId', v_user_id,
    'status', v_status
  );
end;
$function$;

create function app_private.api_save_role(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role_id uuid := (p_payload ->> 'id')::uuid;
  v_active boolean := (p_payload ->> 'active')::boolean;
begin
  if not app_private.has_capability(auth.uid(), 'roles.manage') then
    raise exception 'CAPABILITY_REQUIRED' using errcode = '42501';
  end if;

  perform 1
  from app_portal.portal_roles as portal_role
  where portal_role.id = v_role_id
  for update;

  if not found then
    raise exception 'ROLE_NOT_FOUND' using errcode = 'P0002';
  end if;

  update app_portal.portal_roles as portal_role
  set code = p_payload ->> 'code',
      name = p_payload ->> 'name',
      description = coalesce(p_payload ->> 'description', ''),
      is_active = v_active,
      sort_order = (p_payload ->> 'sortOrder')::integer,
      revision = portal_role.revision + 1
  where portal_role.id = v_role_id;

  return pg_catalog.jsonb_build_object(
    'roleId', v_role_id,
    'active', v_active
  );
end;
$function$;

create function app_private.log_audit(
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
as $function$
  insert into app_portal.audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    p_actor,
    p_action,
    p_entity_type,
    coalesce(p_entity_id, ''),
    p_before,
    p_after,
    coalesce(p_metadata, '{}'::jsonb)
  );
$function$;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select array['cockpit_access_get', 'save_user', 'save_role']::text[];
$function$;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'cockpit_access_get' then 'READ'
    when 'save_user' then 'USER_MUTATION'
    when 'save_role' then 'ROLE_MUTATION'
    else null
  end;
$function$;

create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'save_user' then
      return app_private.api_save_user(coalesce(p_payload, '{}'::jsonb));
    when 'save_role' then
      return app_private.api_save_role(coalesce(p_payload, '{}'::jsonb));
    else
      raise exception 'UNKNOWN_ACTION' using errcode = '22023';
  end case;
end;
$function$;

create function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  return pg_catalog.jsonb_build_object(
    'ok',
    true,
    'data',
    app_private.pd_api_dispatch_current(p_action, p_payload)
  );
exception when others then
  return pg_catalog.jsonb_build_object(
    'ok',
    false,
    'error',
    pg_catalog.jsonb_build_object(
      'code', sqlstate,
      'message', sqlerrm
    )
  );
end;
$function$;

revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.pd_api(text, jsonb) to authenticated;
