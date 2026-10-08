create or replace function app_private.liveticker_wpp_runtime_status_internal()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_row app_private.liveticker_wpp_runtime_control%rowtype;
  v_state text;
  v_ready boolean := false;
begin
  select * into v_row
  from app_private.liveticker_wpp_runtime_control
  where singleton = true;

  if not found then
    raise exception 'LIVETICKER_WPP_RUNTIME_MISSING' using errcode = '55000';
  end if;

  v_ready := v_row.desired_connected
    and v_row.last_state = 'CONNECTED'
    and v_row.last_seen_at is not null
    and v_row.last_seen_at >= v_row.updated_at
    and v_row.last_seen_at >= statement_timestamp() - interval '5 minutes';

  if v_row.last_seen_at is null then
    v_state := case when v_row.updated_at >= statement_timestamp() - interval '30 seconds'
      then v_row.last_state else 'UNREACHABLE' end;
  elsif v_row.last_seen_at < v_row.updated_at
        and v_row.updated_at >= statement_timestamp() - interval '30 seconds' then
    v_state := v_row.last_state;
  elsif v_row.last_seen_at < statement_timestamp() - interval '5 minutes' then
    v_state := 'UNREACHABLE';
  else
    v_state := v_row.last_state;
  end if;

  return pg_catalog.jsonb_build_object(
    'desiredConnected', v_row.desired_connected,
    'ready', v_ready,
    'state', v_state,
    'lastSeenAt', v_row.last_seen_at,
    'updatedAt', v_row.updated_at,
    'revision', v_row.revision,
    'error', v_row.last_error
  );
end;
$function$;

create or replace function public.pd_liveticker_whatsapp_worker_can_claim()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_worker_enabled boolean := app_private.worker_runtime_is_enabled('LIVETICKER_WHATSAPP');
  v_worker_ready boolean := app_private.worker_runtime_is_ready('LIVETICKER_WHATSAPP');
  v_wpp app_private.liveticker_wpp_runtime_control%rowtype;
  v_wpp_ready boolean := false;
begin
  select * into v_wpp
  from app_private.liveticker_wpp_runtime_control
  where singleton = true;

  v_wpp_ready := v_wpp.desired_connected
    and v_wpp.last_state = 'CONNECTED'
    and v_wpp.last_seen_at is not null
    and v_wpp.last_seen_at >= v_wpp.updated_at
    and v_wpp.last_seen_at >= statement_timestamp() - interval '5 minutes';

  return pg_catalog.jsonb_build_object(
    'ready', v_worker_ready and v_wpp_ready,
    'workerEnabled', v_worker_enabled,
    'wppReady', v_wpp_ready
  );
end;
$function$;
