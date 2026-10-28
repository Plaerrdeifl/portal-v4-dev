\set ON_ERROR_STOP on

do $cockpit_admin_global_concurrency_assert$
begin
  if (
    select pg_catalog.count(*)
    from app_private.cockpit_admin_concurrency_results as result
    where coalesce((result.response ->> 'ok')::boolean, false)
  ) <> 1 then
    raise exception 'Concurrent Cockpit demotion did not commit exactly once.';
  end if;

  if (
    select pg_catalog.count(*)
    from app_private.cockpit_admin_global_concurrency_results as result
    where not coalesce((result.response ->> 'ok')::boolean, false)
      and result.response #>> '{error,code}' = '42501'
      and result.response #>> '{error,message}' =
        'COCKPIT_LAST_SYSTEM_ADMIN_REQUIRED'
  ) <> 1 then
    raise exception 'Concurrent global deactivation was not fail-closed.';
  end if;

  if (
    select portal_user.status
    from app_portal.users as portal_user
    where portal_user.id = '00000000-0000-4321-8000-000000000002'
  ) <> 'ACTIVE' then
    raise exception 'Rejected global deactivation changed Portal user status.';
  end if;

  if app_private.cockpit_active_system_admin_count() <> 1 then
    raise exception 'Cross-contract race removed the last active SYSTEM_ADMIN.';
  end if;

  if exists (
    select 1
    from app_portal.audit_events as audit_event
    where audit_event.action = 'USER_UPDATED'
      and audit_event.entity_id =
        '00000000-0000-4321-8000-000000000002'
  ) then
    raise exception 'Rejected global deactivation left an audit side effect.';
  end if;
end
$cockpit_admin_global_concurrency_assert$;

select 'COCKPIT_ADMIN_GLOBAL_CONCURRENCY_OK' as result;
