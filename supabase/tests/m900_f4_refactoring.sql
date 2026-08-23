\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is(
  pg_catalog.array_length(app_private.pd_api_current_actions(), 1),
  119,
  'Current dispatcher inventory contains 119 normalized actions'
);
select is(
  (
    select pg_catalog.count(distinct action)::integer
    from pg_catalog.unnest(app_private.pd_api_current_actions()) as item(action)
  ),
  119,
  'Every normalized action is unique'
);
select is(
  (
    select pg_catalog.count(*)::integer
    from pg_catalog.unnest(app_private.pd_api_current_actions()) as item(action)
    where app_private.platform_action_classification(item.action) = 'READ'
  ),
  29,
  'Exactly 29 current actions are READ'
);
select is(
  (
    select pg_catalog.count(*)::integer
    from pg_catalog.unnest(app_private.pd_api_current_actions()) as item(action)
    where app_private.platform_action_classification(item.action) = 'USER_MUTATION'
  ),
  90,
  'Exactly 90 current actions are USER_MUTATION'
);
select ok(
  not exists (
    select 1
    from pg_catalog.unnest(app_private.pd_api_current_actions()) as item(action)
    where pg_catalog.strpos(
      pg_catalog.pg_get_functiondef(
        'app_private.pd_api_dispatch_current(text,jsonb)'::regprocedure
      ),
      pg_catalog.quote_literal(item.action)
    ) = 0
  ),
  'Every normalized action has a current dispatch branch'
);
select ok(
  pg_catalog.pg_get_functiondef('public.pd_api(text,jsonb)'::regprocedure)
    !~ 'pd_api_(before|core_before)_',
  'public.pd_api no longer traverses a historical router'
);
select ok(
  pg_catalog.pg_get_functiondef(
    'app_private.pd_api_dispatch_current(text,jsonb)'::regprocedure
  ) !~ 'pd_api_(before|core_before)_',
  'Current internal dispatcher contains no historical router call'
);
select ok(
  pg_catalog.strpos(
    pg_catalog.pg_get_functiondef('public.pd_api(text,jsonb)'::regprocedure),
    'require_platform_user_write_allowed'
  ) < pg_catalog.strpos(
    pg_catalog.pg_get_functiondef('public.pd_api(text,jsonb)'::regprocedure),
    'pd_api_dispatch_current'
  ),
  'Platform Mode guard executes before current dispatch'
);
select ok(
  pg_catalog.pg_get_functiondef('public.pd_api(text,jsonb)'::regprocedure)
    ~ 'require_platform_user_write_allowed\([[:space:]]*v_action,[[:space:]]*auth.uid\(\)',
  'Current API preserves action and actor-bound release bypass validation'
);
select throws_ok(
  $$select app_private.pd_api_dispatch_current('unknown_f4_action', '{}'::jsonb)$$,
  '22023',
  'Unbekannte Portalaktion: unknown_f4_action',
  'Unknown actions remain fail-closed'
);
select ok(
  has_function_privilege('authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.pd_api(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.pd_api(text,jsonb)', 'EXECUTE'),
  'Only authenticated can execute public.pd_api'
);
select ok(
  not has_function_privilege(
    'anon',
    'app_private.pd_api_dispatch_current(text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'app_private.pd_api_dispatch_current(text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'app_private.pd_api_dispatch_current(text,jsonb)',
    'EXECUTE'
  ),
  'Current dispatcher is internal only'
);
select is(
  (
    select pg_catalog.count(*)::integer
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname like 'pd_api_before_%'
      and pg_catalog.oidvectortypes(proc.proargtypes) = 'text, jsonb'
  ),
  26,
  'Historical before routers remain available for forensic comparison'
);
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and (
        proc.proname like 'pd_api_before_%'
        or proc.proname = 'pd_api_core_before_dashboard_widgets_r1'
      )
      and pg_catalog.oidvectortypes(proc.proargtypes) = 'text, jsonb'
      and (
        has_function_privilege('anon', proc.oid, 'EXECUTE')
        or has_function_privilege('authenticated', proc.oid, 'EXECUTE')
        or has_function_privilege('service_role', proc.oid, 'EXECUTE')
      )
  ),
  'No historical router has a client or service_role grant'
);
select ok(
  (
    select not proc.prosecdef
      and 'search_path=""' = any(proc.proconfig)
    from pg_catalog.pg_proc as proc
    where proc.oid =
      'app_private.pd_api_dispatch_current(text,jsonb)'::regprocedure
  ),
  'Internal dispatcher is SECURITY INVOKER with empty search_path'
);
select ok(
  (
    select proc.prosecdef
      and 'search_path=""' = any(proc.proconfig)
    from pg_catalog.pg_proc as proc
    where proc.oid = 'public.pd_api(text,jsonb)'::regprocedure
  ),
  'Public API remains SECURITY DEFINER with empty search_path'
);
select is(
  (
    select pg_catalog.array_agg(attribute.attname order by key.ordinality)
    from pg_catalog.pg_constraint as constraint_row
    cross join lateral pg_catalog.unnest(constraint_row.conkey)
      with ordinality as key(attnum, ordinality)
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = constraint_row.conrelid
     and attribute.attnum = key.attnum
    where constraint_row.conrelid =
      'app_modules.event_external_refs'::regclass
      and constraint_row.contype = 'p'
  ),
  array['source_type', 'source_key', 'external_uid']::name[],
  'ICS external references use their established identity as primary key'
);
select ok(
  to_regclass('app_modules.fanbus_bookings_trip_id_idx') is not null,
  'Trip-scoped booking index exists'
);
select ok(
  (
    select index_row.indisvalid and index_row.indisready
    from pg_catalog.pg_index as index_row
    where index_row.indexrelid =
      'app_modules.fanbus_bookings_trip_id_idx'::regclass
  ),
  'Trip-scoped booking index is valid and ready'
);

select * from finish();
rollback;
