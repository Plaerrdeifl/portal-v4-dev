create or replace function app_private.liveticker_whatsapp_transport_assert_ready()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_wpp app_private.liveticker_wpp_runtime_control%rowtype;
begin
  if app_private.platform_release_environment() is distinct from 'DEV' then
    raise exception 'LIVETICKER_WHATSAPP_DEV_ONLY' using errcode = '55000';
  end if;

  perform app_private.worker_runtime_assert_ready('LIVETICKER_WHATSAPP');

  select * into v_wpp
  from app_private.liveticker_wpp_runtime_control
  where singleton = true;

  if not v_wpp.desired_connected then
    raise exception 'LIVETICKER_WPP_DISABLED' using errcode = '55000';
  end if;

  if v_wpp.last_state <> 'CONNECTED'
     or v_wpp.last_seen_at is null
     or v_wpp.last_seen_at < v_wpp.updated_at
     or v_wpp.last_seen_at < statement_timestamp() - interval '5 minutes' then
    raise exception 'LIVETICKER_WPP_NOT_READY' using errcode = '55000';
  end if;
end;
$function$;
