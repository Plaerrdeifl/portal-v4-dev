-- Plaerrdeifl Portal V4
-- Reset bridge for the duplicated M328-R1 regular-rider reactivation contract.
--
-- 20260829090000 contains the same contract that was already released as the
-- standalone 20260829162000 migration. Existing databases that applied the
-- standalone migration already have the correct final state and remain
-- untouched. On a fresh migration chain, unwrap only the folded duplicate so
-- the following standalone migration can establish that final state once.

begin;

do $m328_rider_reactivation_reset_bridge$
declare
  v_standalone_applied boolean;
  v_activate regprocedure := pg_catalog.to_regprocedure(
    'app_private.api_fanbus_regular_rider_activate(jsonb)'
  );
  v_actions_current regprocedure := pg_catalog.to_regprocedure(
    'app_private.pd_api_current_actions()'
  );
  v_actions_previous regprocedure := pg_catalog.to_regprocedure(
    'app_private.pd_api_current_actions_before_m328_r1_rider_reactivate()'
  );
  v_dispatch_current regprocedure := pg_catalog.to_regprocedure(
    'app_private.pd_api_dispatch_current(text,jsonb)'
  );
  v_dispatch_previous regprocedure := pg_catalog.to_regprocedure(
    'app_private.pd_api_dispatch_current_before_m328_r1_rider_reactivate(text,jsonb)'
  );
begin
  select exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260829162000'
  )
  into v_standalone_applied;

  -- The standalone migration has already established the accepted state.
  if v_standalone_applied then
    return;
  end if;

  -- The older migration may have been applied before the duplicate was folded
  -- into its repository file. In that state the standalone migration can run
  -- normally and no bridge work is necessary.
  if v_activate is null
     and v_actions_previous is null
     and v_dispatch_previous is null then
    if v_actions_current is null or v_dispatch_current is null then
      raise exception 'M328_R1_RIDER_REACTIVATION_RESET_BRIDGE_UNEXPECTED_STATE'
        using errcode = '55000';
    end if;
    return;
  end if;

  -- Fail closed instead of partially rewriting an unexpected function chain.
  if v_activate is null
     or v_actions_current is null
     or v_actions_previous is null
     or v_dispatch_current is null
     or v_dispatch_previous is null then
    raise exception 'M328_R1_RIDER_REACTIVATION_RESET_BRIDGE_UNEXPECTED_STATE'
      using errcode = '55000';
  end if;

  execute 'drop function app_private.pd_api_dispatch_current(text,jsonb)';
  execute 'drop function app_private.pd_api_current_actions()';
  execute 'drop function app_private.api_fanbus_regular_rider_activate(jsonb)';

  execute 'alter function app_private.pd_api_current_actions_before_m328_r1_rider_reactivate() rename to pd_api_current_actions';
  execute 'alter function app_private.pd_api_dispatch_current_before_m328_r1_rider_reactivate(text,jsonb) rename to pd_api_dispatch_current';
end;
$m328_rider_reactivation_reset_bridge$;

commit;
