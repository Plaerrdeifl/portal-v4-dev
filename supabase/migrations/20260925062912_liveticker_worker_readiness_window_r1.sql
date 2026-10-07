create or replace function app_private.worker_runtime_is_ready(p_worker_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select
      c.enabled
      and c.last_state = 'ACTIVE'
      and c.last_seen_at is not null
      and c.last_seen_at >= c.updated_at
      and c.last_seen_at >= statement_timestamp() - case
        when c.worker_code in ('LIVETICKER_GRAPHICS', 'LIVETICKER_WHATSAPP')
          then interval '5 minutes'
        else interval '90 seconds'
      end
    from app_private.worker_runtime_controls c
    where c.worker_code = upper(btrim(coalesce(p_worker_code, '')))
  ), false);
$function$;

create or replace function app_private.worker_runtime_status_internal(p_worker_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_code text := upper(btrim(coalesce(p_worker_code, '')));
  v_row app_private.worker_runtime_controls%rowtype;
  v_ready boolean := false;
  v_state text;
begin
  perform app_private.worker_runtime_capability(v_code);

  select *
  into v_row
  from app_private.worker_runtime_controls c
  where c.worker_code = v_code;

  if not found then
    raise exception 'WORKER_CODE_INVALID' using errcode = '22023';
  end if;

  v_ready :=
    v_row.enabled
    and v_row.last_state = 'ACTIVE'
    and v_row.last_seen_at is not null
    and v_row.last_seen_at >= v_row.updated_at
    and v_row.last_seen_at >= statement_timestamp() - case
      when v_row.worker_code in ('LIVETICKER_GRAPHICS', 'LIVETICKER_WHATSAPP')
        then interval '5 minutes'
      else interval '90 seconds'
    end;

  if not v_row.enabled then
    v_state := 'DISABLED';
  elsif v_ready then
    v_state := 'ACTIVE';
  elsif v_row.updated_at >= statement_timestamp() - interval '75 seconds' then
    v_state := 'STARTING';
  else
    v_state := 'UNREACHABLE';
  end if;

  return jsonb_build_object(
    'workerCode', v_code,
    'enabled', v_row.enabled,
    'ready', v_ready,
    'state', v_state,
    'lastSeenAt', v_row.last_seen_at,
    'updatedAt', v_row.updated_at,
    'revision', v_row.revision,
    'activePollSeconds', 5,
    'disabledPollSeconds', 60
  );
end;
$function$;

revoke all on function app_private.worker_runtime_is_ready(text)
from public, anon, authenticated, service_role;

revoke all on function app_private.worker_runtime_status_internal(text)
from public, anon, authenticated, service_role;
