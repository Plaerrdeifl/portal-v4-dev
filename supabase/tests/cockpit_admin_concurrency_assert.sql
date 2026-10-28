\set ON_ERROR_STOP on

do $cockpit_admin_concurrency_assert$
begin
  if (
    select pg_catalog.count(*)
    from app_private.cockpit_admin_concurrency_results
  ) <> 2 then
    raise exception 'Both concurrent Cockpit results were not recorded.';
  end if;

  if (
    select pg_catalog.count(*)
    from app_private.cockpit_admin_concurrency_results as result
    where coalesce((result.response ->> 'ok')::boolean, false)
  ) <> 1 then
    raise exception 'Exactly one concurrent SYSTEM_ADMIN demotion must succeed.';
  end if;

  if (
    select pg_catalog.count(*)
    from app_private.cockpit_admin_concurrency_results as result
    where not coalesce((result.response ->> 'ok')::boolean, false)
      and result.response #>> '{error,code}' = '42501'
      and result.response #>> '{error,message}' =
        'COCKPIT_LAST_SYSTEM_ADMIN_REQUIRED'
  ) <> 1 then
    raise exception 'The losing concurrent demotion was not fail-closed.';
  end if;

  if app_private.cockpit_active_system_admin_count() <> 1 then
    raise exception 'Concurrent changes removed the last active SYSTEM_ADMIN.';
  end if;

  if (
    select pg_catalog.count(*)
    from app_portal.audit_events as audit_event
    where audit_event.action = 'COCKPIT_ACCESS_SET'
      and audit_event.entity_id like
        '00000000-0000-4321-8000-00000000000_'
  ) <> 2 then
    -- One setup write plus exactly one committed demotion. The rejected
    -- demotion rolls its attempted mutation and audit back together.
    raise exception 'Concurrent audit count is not transactionally exact.';
  end if;
end
$cockpit_admin_concurrency_assert$;

select 'COCKPIT_ADMIN_CONCURRENCY_OK' as result;

-- Restore the two-admin baseline for the cross-contract race that follows.
update app_portal.cockpit_access as cockpit_access
set role = 'SYSTEM_ADMIN',
    is_enabled = true,
    revision = cockpit_access.revision + 1
where cockpit_access.user_id in (
  '00000000-0000-4321-8000-000000000001',
  '00000000-0000-4321-8000-000000000002'
);

truncate table app_private.cockpit_admin_concurrency_results;
