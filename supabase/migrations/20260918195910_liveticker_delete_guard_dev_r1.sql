-- DEV only: require optimistic delete guards so stale browser tabs cannot
-- deactivate actions that they never observed.

alter function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  rename to pd_public_liveticker_sync_before_delete_guard_dev_r1;

revoke all on function public.pd_public_liveticker_sync_before_delete_guard_dev_r1(
  uuid, integer, jsonb, text
) from public, anon, authenticated, service_role;

create function public.pd_public_liveticker_sync(
  p_event_id uuid,
  p_expected_revision integer,
  p_changes jsonb,
  p_client_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_changes jsonb := p_changes;
  v_delete jsonb;
  v_guard jsonb;
  v_id text;
  v_current jsonb;
begin
  if p_changes is not null
     and pg_catalog.jsonb_typeof(p_changes) = 'object'
     and p_changes ? 'deletes'
     and pg_catalog.jsonb_typeof(p_changes -> 'deletes') = 'array'
     and pg_catalog.jsonb_array_length(p_changes -> 'deletes') > 0 then

    if not (p_changes ? 'deleteGuards')
       or pg_catalog.jsonb_typeof(p_changes -> 'deleteGuards') <> 'array'
       or pg_catalog.jsonb_array_length(p_changes -> 'deleteGuards') > 50 then
      raise exception 'LIVETICKER_DELETE_GUARD_REQUIRED' using errcode = 'PT409';
    end if;

    for v_delete in
      select value from pg_catalog.jsonb_array_elements(p_changes -> 'deletes')
    loop
      if pg_catalog.jsonb_typeof(v_delete) <> 'string' then
        raise exception 'LIVETICKER_INVALID_DELETES' using errcode = '22023';
      end if;

      v_id := v_delete #>> '{}';
      v_guard := null;

      select guard.value
        into v_guard
      from pg_catalog.jsonb_array_elements(p_changes -> 'deleteGuards') as guard(value)
      where pg_catalog.jsonb_typeof(guard.value) = 'object'
        and guard.value ->> 'id' = v_id
      limit 1;

      if v_guard is null
         or not (v_guard ? 'expected')
         or pg_catalog.jsonb_typeof(v_guard -> 'expected') <> 'object' then
        raise exception 'LIVETICKER_DELETE_GUARD_REQUIRED' using errcode = 'PT409';
      end if;

      select action.payload
        into v_current
      from app_modules.liveticker_actions as action
      where action.event_id = p_event_id
        and action.client_action_id = v_id
        and action.is_active
      for share;

      if found and v_current is distinct from (v_guard -> 'expected') then
        raise exception 'LIVETICKER_DELETE_GUARD_MISMATCH' using errcode = 'PT409';
      end if;
    end loop;
  end if;

  if p_changes is not null and pg_catalog.jsonb_typeof(p_changes) = 'object' then
    v_changes := p_changes - 'deleteGuards';
  end if;

  return public.pd_public_liveticker_sync_before_delete_guard_dev_r1(
    p_event_id,
    p_expected_revision,
    v_changes,
    p_client_id
  );
end;
$function$;

revoke all on function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  from public, anon;
grant execute on function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  to authenticated;
