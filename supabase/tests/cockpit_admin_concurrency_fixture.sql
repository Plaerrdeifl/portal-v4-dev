\set ON_ERROR_STOP on

create table app_private.cockpit_admin_concurrency_results (
  actor_id uuid primary key,
  response jsonb not null,
  completed_at timestamptz not null default pg_catalog.now()
);

create table app_private.cockpit_admin_global_concurrency_results (
  operation text primary key,
  response jsonb not null,
  completed_at timestamptz not null default pg_catalog.now()
);

insert into auth.users (id, email)
values
  (
    '00000000-0000-4321-8000-000000000001',
    'cockpit-r2-concurrency-1@example.invalid'
  ),
  (
    '00000000-0000-4321-8000-000000000002',
    'cockpit-r2-concurrency-2@example.invalid'
  ),
  (
    '00000000-0000-4321-8000-000000000003',
    'cockpit-r2-concurrency-portal-admin@example.invalid'
  );

insert into app_portal.users (
  id, user_code, email, first_name, last_name, status, role_id
)
values
  (
    '00000000-0000-4321-8000-000000000001',
    'U-CKR2-CONC-1',
    'cockpit-r2-concurrency-1@example.invalid',
    'Cockpit',
    'Concurrency One',
    'ACTIVE',
    '00000000-0000-4000-8000-000000000003'
  ),
  (
    '00000000-0000-4321-8000-000000000002',
    'U-CKR2-CONC-2',
    'cockpit-r2-concurrency-2@example.invalid',
    'Cockpit',
    'Concurrency Two',
    'ACTIVE',
    '00000000-0000-4000-8000-000000000003'
  ),
  (
    '00000000-0000-4321-8000-000000000003',
    'U-CKR2-CONC-PORTAL-ADMIN',
    'cockpit-r2-concurrency-portal-admin@example.invalid',
    'Portal',
    'Concurrency Admin',
    'ACTIVE',
    '00000000-0000-4000-8000-000000000001'
  );

select app_private.cockpit_bootstrap_first_system_admin(
  '00000000-0000-4321-8000-000000000001',
  'AP-03-R2-CONCURRENCY',
  'Controlled isolated concurrency fixture bootstrap.'
);

do $fixture_second_system_admin$
declare
  v_response jsonb;
begin
  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4321-8000-000000000001',
    true
  );
  perform set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', '00000000-0000-4321-8000-000000000001',
      'role', 'authenticated'
    )::text,
    true
  );
  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', '00000000-0000-4321-8000-000000000002',
      'role', 'SYSTEM_ADMIN',
      'isEnabled', true,
      'expectedRevision', null
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Concurrency fixture setup failed: %', v_response;
  end if;
end
$fixture_second_system_admin$;

create function app_private.cockpit_admin_concurrent_self_demote(p_actor uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_revision integer;
  v_response jsonb;
begin
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  perform set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', p_actor,
      'role', 'authenticated'
    )::text,
    true
  );

  select cockpit_access.revision
  into v_revision
  from app_portal.cockpit_access as cockpit_access
  where cockpit_access.user_id = p_actor;

  v_response := public.pd_api(
    'cockpit_admin_access_set',
    pg_catalog.jsonb_build_object(
      'targetUserId', p_actor,
      'role', 'ADMIN',
      'isEnabled', true,
      'expectedRevision', v_revision
    )
  );

  insert into app_private.cockpit_admin_concurrency_results (
    actor_id,
    response
  ) values (p_actor, v_response);

  return v_response;
end;
$function$;

revoke all on function
  app_private.cockpit_admin_concurrent_self_demote(uuid)
from public, anon, authenticated, service_role;
grant execute on function
  app_private.cockpit_admin_concurrent_self_demote(uuid)
to postgres;

create function app_private.cockpit_admin_concurrent_global_deactivate(
  p_actor uuid,
  p_target uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_role_id uuid;
  v_revision integer;
  v_response jsonb;
begin
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  perform set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'sub', p_actor,
      'role', 'authenticated'
    )::text,
    true
  );

  select portal_user.role_id, portal_user.revision
  into v_role_id, v_revision
  from app_portal.users as portal_user
  where portal_user.id = p_target;

  v_response := public.pd_api(
    'save_user',
    pg_catalog.jsonb_build_object(
      'id', p_target,
      'roleId', v_role_id,
      'status', 'BLOCKED',
      'expectedRevision', v_revision
    )
  );

  insert into app_private.cockpit_admin_global_concurrency_results (
    operation,
    response
  ) values ('GLOBAL_USER_DEACTIVATE', v_response);

  return v_response;
end;
$function$;

revoke all on function
  app_private.cockpit_admin_concurrent_global_deactivate(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function
  app_private.cockpit_admin_concurrent_global_deactivate(uuid, uuid)
to postgres;
