\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.oauth_clients (
  id,
  client_id,
  registration_type,
  redirect_uris,
  grant_types,
  client_name
)
values
  (
    '00000000-0000-4c10-8000-000000000001',
    '00000000-0000-4c10-8000-000000000001',
    'manual',
    '["https://nextcloud.test.invalid/callback"]',
    '["authorization_code","refresh_token"]',
    'Nextcloud'
  ),
  (
    '00000000-0000-4c10-8000-000000000002',
    '00000000-0000-4c10-8000-000000000002',
    'manual',
    '["https://wordpress.test.invalid/callback"]',
    '["authorization_code","refresh_token"]',
    'WordPress'
  );

insert into auth.users (id, email)
values
  ('00000000-0000-4c10-9000-000000000001', 'oauth-allowed@example.invalid'),
  ('00000000-0000-4c10-9000-000000000002', 'oauth-denied@example.invalid'),
  ('00000000-0000-4c10-9000-000000000003', 'oauth-inactive@example.invalid');

insert into app_portal.users (
  id,
  user_code,
  email,
  first_name,
  last_name,
  status,
  role_id
)
select
  fixture.id,
  fixture.user_code,
  fixture.email,
  fixture.first_name,
  fixture.last_name,
  fixture.status,
  portal_role.id
from (
  values
    (
      '00000000-0000-4c10-9000-000000000001'::uuid,
      'U-OAUTH-ALLOWED',
      'oauth-allowed@example.invalid',
      'OAuth',
      'Allowed',
      'ACTIVE'
    ),
    (
      '00000000-0000-4c10-9000-000000000002'::uuid,
      'U-OAUTH-DENIED',
      'oauth-denied@example.invalid',
      'OAuth',
      'Denied',
      'ACTIVE'
    ),
    (
      '00000000-0000-4c10-9000-000000000003'::uuid,
      'U-OAUTH-INACTIVE',
      'oauth-inactive@example.invalid',
      'OAuth',
      'Inactive',
      'INACTIVE'
    )
) as fixture(id, user_code, email, first_name, last_name, status)
cross join lateral (
  select id
  from app_portal.portal_roles
  where code = 'PORTAL_USER'
    and is_active
  limit 1
) as portal_role;

insert into app_portal.team_memberships (
  team_id,
  user_id,
  team_role,
  is_active
)
select
  team.id,
  fixture.user_id,
  'MEMBER',
  true
from app_portal.teams as team
cross join (
  values
    ('00000000-0000-4c10-9000-000000000001'::uuid),
    ('00000000-0000-4c10-9000-000000000003'::uuid)
) as fixture(user_id)
where team.code = 'SOCIAL_MEDIA';

select ok(
  not (
    select proc.prosecdef
    from pg_proc as proc
    where proc.oid = 'app_private.custom_access_token_hook(jsonb)'::regprocedure
  ),
  'custom access token hook is SECURITY INVOKER'
);

select ok(
  has_schema_privilege('supabase_auth_admin', 'app_private', 'USAGE')
  and has_function_privilege(
    'supabase_auth_admin',
    'app_private.custom_access_token_hook(jsonb)',
    'EXECUTE'
  )
  and has_function_privilege(
    'supabase_auth_admin',
    'app_private.identity_oauth_client_access_for_user(uuid,uuid)',
    'EXECUTE'
  ),
  'supabase_auth_admin has only the function path needed by the hook'
);

select ok(
  not has_table_privilege('supabase_auth_admin', 'app_portal.users', 'SELECT')
  and not has_table_privilege(
    'supabase_auth_admin',
    'app_portal.team_memberships',
    'SELECT'
  ),
  'supabase_auth_admin receives no direct Portal authorization-table reads'
);

select ok(
  not has_function_privilege(
    'anon',
    'app_private.custom_access_token_hook(jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'app_private.custom_access_token_hook(jsonb)',
    'EXECUTE'
  ),
  'browser roles cannot inherit PUBLIC execution of the hook'
);

select ok(
  not has_function_privilege(
    'anon',
    'app_private.identity_oauth_client_access_for_user(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'app_private.identity_oauth_client_access_for_user(uuid,uuid)',
    'EXECUTE'
  ),
  'browser roles cannot inherit PUBLIC execution of the private helper'
);

select ok(
  pg_get_functiondef(
    'app_private.custom_access_token_hook(jsonb)'::regprocedure
  ) not like '%oauth_authorizations%',
  'stored OAuth consent is not part of the token decision'
);

set local role supabase_auth_admin;

select is(
  app_private.custom_access_token_hook(
    '{"user_id":"00000000-0000-4c10-9000-000000000002","claims":{"sub":"00000000-0000-4c10-9000-000000000002"},"authentication_method":"token_refresh"}'::jsonb
  ),
  '{"user_id":"00000000-0000-4c10-9000-000000000002","claims":{"sub":"00000000-0000-4c10-9000-000000000002"},"authentication_method":"token_refresh"}'::jsonb,
  'ordinary Portal token without OAuth client remains unchanged'
);

select is(
  app_private.custom_access_token_hook(
    '{"user_id":"00000000-0000-4c10-9000-000000000002","claims":{"client_id":"00000000-0000-4c10-8000-000000000002"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb
  ),
  '{"user_id":"00000000-0000-4c10-9000-000000000002","claims":{"client_id":"00000000-0000-4c10-8000-000000000002"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb,
  'WordPress OAuth authorization-code token remains unchanged'
);

select is(
  app_private.custom_access_token_hook(
    '{"user_id":"not-a-uuid","claims":{"client_id":"00000000-0000-4c10-8000-000000000002"},"authentication_method":"token_refresh"}'::jsonb
  ),
  '{"user_id":"not-a-uuid","claims":{"client_id":"00000000-0000-4c10-8000-000000000002"},"authentication_method":"token_refresh"}'::jsonb,
  'malformed event identity does not add a WordPress restriction'
);

select is(
  app_private.custom_access_token_hook(
    '{"user_id":"not-a-uuid","claims":{"client_id":"00000000-0000-4c10-8000-000000000001"},"authentication_method":"token_refresh"}'::jsonb
  ) -> 'error' ->> 'http_code',
  '403',
  'malformed event identity fails closed for a recognized Nextcloud client'
);

select is(
  app_private.custom_access_token_hook(
    '{"user_id":"00000000-0000-4c10-9000-000000000001","claims":{"client_id":"00000000-0000-4c10-8000-000000000001"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb
  ),
  '{"user_id":"00000000-0000-4c10-9000-000000000001","claims":{"client_id":"00000000-0000-4c10-8000-000000000001"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb,
  'authorized Nextcloud authorization-code token keeps original claims'
);

select is(
  app_private.custom_access_token_hook(
    '{"user_id":"00000000-0000-4c10-9000-000000000002","claims":{"client_id":"00000000-0000-4c10-8000-000000000001"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb
  ) -> 'error' ->> 'http_code',
  '403',
  'unauthorized Nextcloud authorization-code token is denied'
);

select is(
  app_private.custom_access_token_hook(
    '{"user_id":"00000000-0000-4c10-9000-000000000003","claims":{"client_id":"00000000-0000-4c10-8000-000000000001"},"authentication_method":"oauth_provider/authorization_code"}'::jsonb
  ) -> 'error' ->> 'http_code',
  '403',
  'inactive Portal user cannot receive a Nextcloud token'
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4c10-9000-000000000001',
  true
);

select is(
  (
    app_private.api_identity_oauth_client_access(
      '{"clientId":"00000000-0000-4c10-8000-000000000001"}'::jsonb
    ) ->> 'clientId'
  ),
  '00000000-0000-4c10-8000-000000000001',
  'pd_api helper keeps clientId response field'
);

select is(
  (
    app_private.api_identity_oauth_client_access(
      '{"clientId":"00000000-0000-4c10-8000-000000000001"}'::jsonb
    ) ->> 'clientName'
  ),
  'Nextcloud',
  'pd_api helper keeps clientName response field'
);

select is(
  (
    app_private.api_identity_oauth_client_access(
      '{"clientId":"00000000-0000-4c10-8000-000000000001"}'::jsonb
    ) ->> 'clientCode'
  ),
  'NEXTCLOUD',
  'pd_api helper keeps clientCode response field'
);

select is(
  (
    app_private.api_identity_oauth_client_access(
      '{"clientId":"00000000-0000-4c10-8000-000000000001"}'::jsonb
    ) ->> 'allowed'
  ),
  'true',
  'pd_api helper keeps allowed response field'
);

select ok(
  app_private.api_identity_oauth_client_access(
    '{"clientId":"00000000-0000-4c10-8000-000000000001"}'::jsonb
  ) ? 'reason',
  'pd_api helper keeps reason response field'
);

update app_portal.team_memberships
set is_active = false
where user_id = '00000000-0000-4c10-9000-000000000001';

set local role supabase_auth_admin;

select is(
  app_private.custom_access_token_hook(
    '{"user_id":"00000000-0000-4c10-9000-000000000001","claims":{"client_id":"00000000-0000-4c10-8000-000000000001"},"authentication_method":"token_refresh"}'::jsonb
  ) -> 'error' ->> 'http_code',
  '403',
  'token refresh is denied immediately after Nextcloud access is revoked'
);

select is(
  app_private.custom_access_token_hook(
    '{"user_id":"00000000-0000-4c10-9000-000000000001","claims":{"client_id":"00000000-0000-4c10-8000-000000000001"},"authentication_method":"token_refresh","stored_consent":true}'::jsonb
  ) -> 'error' ->> 'http_code',
  '403',
  'stored consent cannot bypass the refreshed central permission decision'
);

reset role;

create or replace function nextcloud_sync.user_has_access(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  raise exception 'synthetic central access failure';
end;
$function$;

set local role supabase_auth_admin;

select is(
  app_private.custom_access_token_hook(
    '{"user_id":"00000000-0000-4c10-9000-000000000002","claims":{"client_id":"00000000-0000-4c10-8000-000000000001"},"authentication_method":"token_refresh"}'::jsonb
  ) -> 'error' ->> 'http_code',
  '403',
  'a failing central Nextcloud permission check fails closed'
);

reset role;
select * from finish();
rollback;
