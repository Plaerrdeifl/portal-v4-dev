\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(
  (
    select attribute.attnotnull
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid =
      'app_private.platform_release_bypass_tokens'::regclass
      and attribute.attname = 'bound_user_id'
      and not attribute.attisdropped
  ),
  'bound_user_id is schema-level NOT NULL'
);
select is(
  (
    select proc.pronargdefaults
    from pg_catalog.pg_proc as proc
    where proc.oid =
      'app_private.create_platform_release_bypass(text,text,timestamptz,uuid)'::regprocedure
  ),
  0::smallint,
  'Create has no default argument for bound_user_id'
);
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid =
      'app_private.platform_release_bypass_tokens'::regclass
      and constraint_row.contype = 'f'
      and constraint_row.confrelid = 'app_portal.users'::regclass
  ),
  'Portal-user foreign key remains in place'
);
select ok(
  (
    select class.relrowsecurity
    from pg_catalog.pg_class as class
    where class.oid = 'app_private.platform_release_bypass_tokens'::regclass
  ),
  'Token table keeps RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'app_private.platform_release_bypass_tokens', 'SELECT')
  and not has_table_privilege('authenticated', 'app_private.platform_release_bypass_tokens', 'SELECT')
  and not has_table_privilege('service_role', 'app_private.platform_release_bypass_tokens', 'SELECT'),
  'Token table has no anon, authenticated or service_role access'
);
select ok(
  not has_function_privilege(
    'anon',
    'app_private.create_platform_release_bypass(text,text,timestamptz,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'app_private.create_platform_release_bypass(text,text,timestamptz,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'app_private.create_platform_release_bypass(text,text,timestamptz,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'postgres',
    'app_private.create_platform_release_bypass(text,text,timestamptz,uuid)',
    'EXECUTE'
  ),
  'Bypass creation remains postgres-only'
);
select is(
  (
    select pg_catalog.count(*)::integer
    from pg_catalog.pg_proc as proc
    where proc.oid = any(array[
      'app_private.create_platform_release_bypass(text,text,timestamptz,uuid)'::regprocedure,
      'app_private.try_platform_release_bypass(text,uuid)'::regprocedure,
      'app_private.require_platform_user_write_allowed(text,uuid)'::regprocedure,
      'app_private.revoke_platform_release_bypass(uuid)'::regprocedure
    ])
      and proc.prosecdef
      and 'search_path=""' = any(proc.proconfig)
  ),
  4,
  'All strict-user-bound SECURITY DEFINER functions use an empty search_path'
);

insert into auth.users(id, email)
values
  ('00000000-0000-4910-8000-000000000001', 'm900-strict-a@example.invalid'),
  ('00000000-0000-4910-8000-000000000002', 'm900-strict-b@example.invalid'),
  ('00000000-0000-4910-8000-000000000003', 'm900-strict-inactive@example.invalid');

insert into app_portal.users(
  id, user_code, email, first_name, last_name, status, role_id
)
select fixture.id, fixture.user_code, fixture.email, 'M900', fixture.last_name,
       fixture.status, role.id
from (values
  ('00000000-0000-4910-8000-000000000001'::uuid, 'U-M900-STRICT-A', 'm900-strict-a@example.invalid', 'Strict A', 'ACTIVE'),
  ('00000000-0000-4910-8000-000000000002'::uuid, 'U-M900-STRICT-B', 'm900-strict-b@example.invalid', 'Strict B', 'ACTIVE'),
  ('00000000-0000-4910-8000-000000000003'::uuid, 'U-M900-STRICT-I', 'm900-strict-inactive@example.invalid', 'Strict Inactive', 'INACTIVE')
) as fixture(id, user_code, email, last_name, status)
cross join lateral (
  select portal_role.id
  from app_portal.portal_roles as portal_role
  where portal_role.code = 'PORTAL_USER'
    and portal_role.is_active
) as role;

insert into app_portal.user_capabilities(user_id, capability_code, created_by)
values (
  '00000000-0000-4910-8000-000000000001',
  'events.manage',
  '00000000-0000-4910-8000-000000000001'
);

update app_portal.settings
set value = pg_catalog.jsonb_build_object('mode', 'READ_ONLY', 'environment', 'LOCAL'),
    revision = revision + 1
where key = 'platform.mode';

select throws_ok(
  $$select app_private.create_platform_release_bypass(
    'LOCAL', 'strict-null-user', now() + interval '10 minutes', null
  )$$,
  '22023',
  'PLATFORM_RELEASE_BYPASS_INVALID',
  'Create blocks NULL user binding'
);
select throws_ok(
  $$select app_private.create_platform_release_bypass(
    'LOCAL', 'strict-inactive-user', now() + interval '10 minutes',
    '00000000-0000-4910-8000-000000000003'
  )$$,
  '22023',
  'PLATFORM_RELEASE_BYPASS_INVALID',
  'Create blocks inactive portal users'
);

create temporary table m900_strict_tokens(
  label text primary key,
  result jsonb not null
) on commit drop;
insert into m900_strict_tokens(label, result)
values
  (
    'valid-a',
    app_private.create_platform_release_bypass(
      'LOCAL', 'strict-valid-a', now() + interval '15 minutes',
      '00000000-0000-4910-8000-000000000001'
    )
  ),
  (
    'valid-b',
    app_private.create_platform_release_bypass(
      'LOCAL', 'strict-valid-b', now() + interval '15 minutes',
      '00000000-0000-4910-8000-000000000002'
    )
  ),
  (
    'revoked',
    app_private.create_platform_release_bypass(
      'LOCAL', 'strict-revoked', now() + interval '15 minutes',
      '00000000-0000-4910-8000-000000000001'
    )
  );

select ok(
  (select result ->> 'token' from m900_strict_tokens where label = 'valid-a')
    ~ '^[0-9a-f]{64}$'
  and exists (
    select 1
    from app_private.platform_release_bypass_tokens as bypass
    where bypass.id = (
      select (result ->> 'id')::uuid
      from m900_strict_tokens where label = 'valid-a'
    )
      and bypass.bound_user_id = '00000000-0000-4910-8000-000000000001'
      and bypass.token_digest = pg_catalog.encode(
        extensions.digest(
          pg_catalog.convert_to(
            (select result ->> 'token' from m900_strict_tokens where label = 'valid-a'),
            'UTF8'
          ),
          'sha256'
        ),
        'hex'
      )
      and bypass.token_digest <>
        (select result ->> 'token' from m900_strict_tokens where label = 'valid-a')
  ),
  'Active user creation returns a one-time raw token and persists only its digest'
);

do $headers$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-pd-release-bypass',
        (select result ->> 'token' from m900_strict_tokens where label = 'valid-a'),
      'x-pd-release-run', 'strict-valid-a',
      'x-pd-environment', 'LOCAL'
    )::text,
    true
  );
end;
$headers$;
select is(
  app_private.try_platform_release_bypass(
    'event_create', '00000000-0000-4910-8000-000000000001'
  ),
  true,
  'Token A with actor A passes only the platform bypass'
);
select is(
  app_private.try_platform_release_bypass(
    'event_create', '00000000-0000-4910-8000-000000000002'
  ),
  false,
  'Token A cannot be used by actor B'
);
select is(
  app_private.try_platform_release_bypass('event_create', null),
  false,
  'A valid token without actor never bypasses'
);
select is(
  app_private.try_platform_release_bypass(
    'm150_submit_membership_application',
    '00000000-0000-4910-8000-000000000001'
  ),
  false,
  'M150 public action is denylisted even with an actor'
);
select is(
  app_private.try_platform_release_bypass(
    'm310_submit_guest_fanbus_registration',
    '00000000-0000-4910-8000-000000000001'
  ),
  false,
  'M310 public action is denylisted even with an actor'
);
select throws_ok(
  $$select app_private.require_platform_user_write_allowed(
    'event_create', '00000000-0000-4910-8000-000000000002'
  )$$,
  'P0902',
  'PLATFORM_READ_ONLY',
  'Wrong actor remains READ_ONLY blocked'
);
select throws_ok(
  $$select app_private.require_platform_user_write_allowed('event_create', null)$$,
  'P0902',
  'PLATFORM_READ_ONLY',
  'No actor remains READ_ONLY blocked'
);

do $claims$
begin
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', '00000000-0000-4910-8000-000000000001', true
  );
end;
$claims$;
select is(
  public.pd_api('event_create', '{}'::jsonb) #>> '{error,code}',
  '22023',
  'Strict token passes the guard but domain validation remains active'
);

do $headers$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-pd-release-bypass',
        (select result ->> 'token' from m900_strict_tokens where label = 'valid-a'),
      'x-pd-release-run', 'wrong-run',
      'x-pd-environment', 'LOCAL'
    )::text,
    true
  );
end;
$headers$;
select is(
  app_private.try_platform_release_bypass(
    'event_create', '00000000-0000-4910-8000-000000000001'
  ), false, 'Wrong run is blocked'
);

do $headers$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-pd-release-bypass',
        (select result ->> 'token' from m900_strict_tokens where label = 'valid-a'),
      'x-pd-release-run', 'strict-valid-a',
      'x-pd-environment', 'DEV'
    )::text,
    true
  );
end;
$headers$;
select is(
  app_private.try_platform_release_bypass(
    'event_create', '00000000-0000-4910-8000-000000000001'
  ), false, 'Wrong environment is blocked'
);

do $headers$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-pd-release-bypass', 'malformed',
      'x-pd-release-run', 'strict-valid-a',
      'x-pd-environment', 'LOCAL'
    )::text,
    true
  );
end;
$headers$;
select is(
  app_private.try_platform_release_bypass(
    'event_create', '00000000-0000-4910-8000-000000000001'
  ), false, 'Malformed token is blocked'
);
do $headers$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-pd-release-bypass', pg_catalog.repeat('f', 64),
      'x-pd-release-run', 'strict-valid-a',
      'x-pd-environment', 'LOCAL'
    )::text,
    true
  );
end;
$headers$;
select is(
  app_private.try_platform_release_bypass(
    'event_create', '00000000-0000-4910-8000-000000000001'
  ), false, 'Unknown token is blocked'
);

insert into app_private.platform_release_bypass_tokens(
  token_digest, environment, run_id, bound_user_id, expires_at, created_at
)
values (
  pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(pg_catalog.repeat('e', 64), 'UTF8'), 'sha256'),
    'hex'
  ),
  'LOCAL',
  'strict-expired',
  '00000000-0000-4910-8000-000000000001',
  now() - interval '1 minute',
  now() - interval '30 minutes'
);
do $headers$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-pd-release-bypass', pg_catalog.repeat('e', 64),
      'x-pd-release-run', 'strict-expired',
      'x-pd-environment', 'LOCAL'
    )::text,
    true
  );
end;
$headers$;
select is(
  app_private.try_platform_release_bypass(
    'event_create', '00000000-0000-4910-8000-000000000001'
  ), false, 'Expired token is blocked'
);

select ok(
  app_private.revoke_platform_release_bypass(
    (select (result ->> 'id')::uuid from m900_strict_tokens where label = 'revoked')
  ),
  'Token can be revoked'
);
do $headers$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-pd-release-bypass',
        (select result ->> 'token' from m900_strict_tokens where label = 'revoked'),
      'x-pd-release-run', 'strict-revoked',
      'x-pd-environment', 'LOCAL'
    )::text,
    true
  );
end;
$headers$;
select is(
  app_private.try_platform_release_bypass(
    'event_create', '00000000-0000-4910-8000-000000000001'
  ), false, 'Revoked token is blocked'
);

do $headers$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-pd-release-bypass',
        (select result ->> 'token' from m900_strict_tokens where label = 'valid-a'),
      'x-pd-release-run', 'strict-valid-a',
      'x-pd-environment', 'LOCAL'
    )::text,
    true
  );
end;
$headers$;
select throws_ok(
  $$select public.m150_submit_membership_application('{}'::jsonb, 'invalid')$$,
  'P0902',
  'PLATFORM_READ_ONLY',
  'M150 public RPC is blocked despite valid bypass headers'
);
select throws_ok(
  $$select public.m310_submit_guest_fanbus_registration(
    '{}'::jsonb, '00000000-0000-4000-8000-000000000001', repeat('c', 64)
  )$$,
  'P0902',
  'PLATFORM_READ_ONLY',
  'M310 public RPC is blocked despite valid bypass headers'
);
select throws_ok(
  $$select public.m210_ics_import_preview(
    '00000000-0000-4910-8000-000000000001', 'BAD', 'BAD', '[]'::jsonb
  )$$,
  '22023',
  'Das Importprofil ist ungültig.',
  'M210 preview remains a read path and reaches domain validation'
);
select throws_ok(
  $$select public.m210_ics_import_confirm(
    '00000000-0000-4910-8000-000000000001',
    'ICS', 'TEST', 'test.ics', repeat('a', 64), 1,
    '[]'::jsonb, '[]'::jsonb, repeat('b', 64)
  )$$,
  '22023',
  'Die Importmetadaten sind ungültig.',
  'M210 confirm with actor A passes only the guard and reaches domain validation'
);

do $headers$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-pd-release-bypass',
        (select result ->> 'token' from m900_strict_tokens where label = 'valid-b'),
      'x-pd-release-run', 'strict-valid-b',
      'x-pd-environment', 'LOCAL'
    )::text,
    true
  );
end;
$headers$;
select throws_ok(
  $$select public.m210_ics_import_confirm(
    '00000000-0000-4910-8000-000000000002',
    'ICS', 'TEST', 'test.ics', repeat('a', 64), 1,
    '[]'::jsonb, '[]'::jsonb, repeat('b', 64)
  )$$,
  '42501',
  'Die Berechtigung events.manage ist erforderlich.',
  'A user-bound token never bypasses M210 capability checks'
);

insert into app_modules.fanbus_companion_lists(id, owner_user_id, name)
values (
  '00000000-0000-4920-8000-000000000001',
  '00000000-0000-4910-8000-000000000001',
  'Strict Ownership Fixture'
);
do $claims$
begin
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', '00000000-0000-4910-8000-000000000002', true
  );
end;
$claims$;
select is(
  public.pd_api(
    'fanbus_companion_list_upsert',
    pg_catalog.jsonb_build_object(
      'id', '00000000-0000-4920-8000-000000000001',
      'name', 'Ownership must hold',
      'expectedRevision', 1
    )
  ) #>> '{error,code}',
  '40001',
  'Strict bypass does not override companion ownership'
);
do $claims$
begin
  perform pg_catalog.set_config(
    'request.jwt.claim.sub', '00000000-0000-4910-8000-000000000001', true
  );
end;
$claims$;
do $headers$
begin
  perform pg_catalog.set_config(
    'request.headers',
    pg_catalog.jsonb_build_object(
      'x-pd-release-bypass',
        (select result ->> 'token' from m900_strict_tokens where label = 'valid-a'),
      'x-pd-release-run', 'strict-valid-a',
      'x-pd-environment', 'LOCAL'
    )::text,
    true
  );
end;
$headers$;
select is(
  public.pd_api(
    'fanbus_companion_list_upsert',
    pg_catalog.jsonb_build_object(
      'id', '00000000-0000-4920-8000-000000000001',
      'name', 'CAS must hold',
      'expectedRevision', 999
    )
  ) #>> '{error,code}',
  '40001',
  'Strict bypass does not override CAS revision checks'
);

select lives_ok(
  $test$do $worker$
  declare v_state text;
  begin
    begin perform public.pd_notification_claim_batch(1);
    exception when others then v_state := sqlstate; end;
    if v_state in ('P0901', 'P0902', 'P0903') then
      raise exception 'notification worker platform blocked';
    end if;
    v_state := null;
    begin perform public.pd_push_claim_batch(1);
    exception when others then v_state := sqlstate; end;
    if v_state in ('P0901', 'P0902', 'P0903') then
      raise exception 'push worker platform blocked';
    end if;
    v_state := null;
    begin perform public.m150_membership_email_claim();
    exception when others then v_state := sqlstate; end;
    if v_state in ('P0901', 'P0902', 'P0903') then
      raise exception 'email worker platform blocked';
    end if;
  end;
  $worker$;$test$,
  'Notification, push and email workers remain outside the user guard'
);

select is(
  (
    select pg_catalog.count(*)::integer
    from pg_catalog.unnest(app_private.pd_api_current_actions()) as item(action)
    where app_private.platform_action_classification(item.action) = 'READ'
  ), 29, 'Current action contract keeps 29 READ actions'
);
select is(
  (
    select pg_catalog.count(*)::integer
    from pg_catalog.unnest(app_private.pd_api_current_actions()) as item(action)
    where app_private.platform_action_classification(item.action) = 'USER_MUTATION'
  ), 90, 'Current action contract keeps 90 USER_MUTATION actions'
);

update app_portal.settings
set value = pg_catalog.jsonb_build_object('mode', 'MAINTENANCE', 'environment', 'LOCAL'),
    revision = revision + 1
where key = 'platform.mode';
select is(
  public.pd_api('event_create', '{}'::jsonb) #>> '{error,code}',
  '22023',
  'A strict user-bound direct test path also passes the MAINTENANCE guard only'
);

update app_portal.settings
set value = pg_catalog.jsonb_build_object('environment', 'LOCAL'),
    revision = revision + 1
where key = 'platform.mode';
select throws_ok(
  $$select app_private.require_platform_user_write_allowed(
    'event_create', '00000000-0000-4910-8000-000000000001'
  )$$,
  'P0901',
  'PLATFORM_WRITE_UNAVAILABLE',
  'Invalid platform configuration remains fail-closed without bypass'
);

update app_portal.settings
set value = pg_catalog.jsonb_build_object('mode', 'NORMAL', 'environment', 'LOCAL'),
    revision = revision + 1
where key = 'platform.mode';
select lives_ok(
  $$select app_private.require_platform_user_write_allowed(
    'event_create', '00000000-0000-4910-8000-000000000001'
  )$$,
  'NORMAL writes require no bypass'
);

select ok(
  exists (
    select 1
    from app_portal.audit_events as audit
    where audit.action = 'PLATFORM_RELEASE_BYPASS_CREATED'
      and audit.entity_id = (
        select result ->> 'id' from m900_strict_tokens where label = 'valid-a'
      )
      and audit.metadata ->> 'boundUserId' =
        '00000000-0000-4910-8000-000000000001'
      and audit.metadata ->> 'actorType' = 'PORTAL_USER'
  )
  and exists (
    select 1
    from app_portal.audit_events as audit
    where audit.action = 'PLATFORM_RELEASE_BYPASS_USED'
      and audit.entity_id = (
        select result ->> 'id' from m900_strict_tokens where label = 'valid-a'
      )
      and audit.actor_user_id = '00000000-0000-4910-8000-000000000001'
      and audit.metadata ->> 'actorType' = 'PORTAL_USER'
  )
  and exists (
    select 1
    from app_portal.audit_events as audit
    where audit.action = 'PLATFORM_RELEASE_BYPASS_REVOKED'
      and audit.entity_id = (
        select result ->> 'id' from m900_strict_tokens where label = 'revoked'
      )
      and audit.metadata ->> 'boundUserId' =
        '00000000-0000-4910-8000-000000000001'
  ),
  'Create, use and revoke audits retain bound user and PORTAL_USER actor metadata'
);
select ok(
  not exists (
    select 1
    from app_portal.audit_events as audit
    join m900_strict_tokens as fixture
      on audit.entity_id = fixture.result ->> 'id'
    join app_private.platform_release_bypass_tokens as bypass
      on bypass.id = (fixture.result ->> 'id')::uuid
    where coalesce(audit.before_data::text, '')
          || coalesce(audit.after_data::text, '')
          || coalesce(audit.metadata::text, '')
      like '%' || (fixture.result ->> 'token') || '%'
       or coalesce(audit.before_data::text, '')
          || coalesce(audit.after_data::text, '')
          || coalesce(audit.metadata::text, '')
      like '%' || bypass.token_digest || '%'
  ),
  'Audit contains neither raw tokens nor token digests'
);

select ok(
  app_private.revoke_platform_release_bypass(
    (select (result ->> 'id')::uuid from m900_strict_tokens where label = 'valid-a')
  )
  and app_private.revoke_platform_release_bypass(
    (select (result ->> 'id')::uuid from m900_strict_tokens where label = 'valid-b')
  ),
  'All remaining strict test tokens are revoked before rollback'
);

select * from finish();
rollback;
