-- DEV only: portal runtime controls for the Liveticker WhatsApp worker and local WPP session.
-- WPP remains private on the Acer host; the browser only sees authenticated portal RPC state.

begin;

alter table app_private.worker_runtime_controls
  drop constraint worker_runtime_controls_code_check,
  add constraint worker_runtime_controls_code_check
    check (worker_code in ('LIVETICKER_GRAPHICS', 'FANBUS_PUBLISHING', 'LIVETICKER_WHATSAPP'));

insert into app_private.worker_runtime_controls(worker_code, enabled, last_state)
values ('LIVETICKER_WHATSAPP', true, 'STARTING')
on conflict (worker_code) do nothing;

create or replace function app_private.worker_runtime_capability(p_worker_code text)
returns text
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_code text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_worker_code, '')));
begin
  case v_code
    when 'LIVETICKER_GRAPHICS' then return 'liveticker.manage';
    when 'LIVETICKER_WHATSAPP' then return 'liveticker.manage';
    when 'FANBUS_PUBLISHING' then return 'fanbus.publishing.manage';
    else raise exception 'WORKER_CODE_INVALID' using errcode = '22023';
  end case;
end;
$function$;

create table app_private.liveticker_wpp_runtime_control (
  singleton boolean primary key default true check (singleton),
  desired_connected boolean not null default true,
  last_state text not null default 'UNKNOWN',
  last_seen_at timestamptz,
  last_error text,
  updated_at timestamptz not null default statement_timestamp(),
  updated_by uuid,
  revision bigint not null default 1,
  constraint liveticker_wpp_runtime_state_check
    check (last_state in ('UNKNOWN', 'CONNECTING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED', 'ERROR')),
  constraint liveticker_wpp_runtime_revision_check check (revision >= 1),
  constraint liveticker_wpp_runtime_error_check check (last_error is null or char_length(last_error) <= 500)
);

revoke all on table app_private.liveticker_wpp_runtime_control
  from public, anon, authenticated, service_role;

insert into app_private.liveticker_wpp_runtime_control(singleton, desired_connected, last_state)
values (true, true, 'UNKNOWN');

create function app_private.liveticker_whatsapp_fail_pending(p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer := 0;
  v_reason text := pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_reason), ''), 'WHATSAPP_RUNTIME_UNAVAILABLE'), 1000);
begin
  if app_private.platform_release_environment() is distinct from 'DEV' then
    return 0;
  end if;

  update app_modules.liveticker_whatsapp_jobs
  set status = 'FAILED',
      next_attempt_at = pg_catalog.now(),
      claimed_at = null,
      worker_received_at = null,
      completed_at = pg_catalog.now(),
      last_error = v_reason,
      sticker_status = case when sticker_status = 'PENDING' then 'FAILED' else sticker_status end,
      text_status = case when text_status = 'PENDING' then 'FAILED' else text_status end,
      updated_at = pg_catalog.now()
  where status = 'PENDING';

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create function app_private.liveticker_wpp_runtime_status_internal()
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
    and v_row.last_seen_at >= statement_timestamp() - interval '20 seconds';

  if v_row.last_seen_at is null then
    v_state := case when v_row.updated_at >= statement_timestamp() - interval '30 seconds'
      then v_row.last_state else 'UNREACHABLE' end;
  elsif v_row.last_seen_at < v_row.updated_at and v_row.updated_at >= statement_timestamp() - interval '30 seconds' then
    v_state := v_row.last_state;
  elsif v_row.last_seen_at < statement_timestamp() - interval '20 seconds' then
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

create function app_private.api_liveticker_wpp_runtime_status(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_capability('liveticker.manage');
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload <> '{}'::jsonb then
    raise exception 'LIVETICKER_WPP_RUNTIME_STATUS_INVALID' using errcode = '22023';
  end if;
  return app_private.liveticker_wpp_runtime_status_internal();
end;
$function$;

create function app_private.api_liveticker_wpp_runtime_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_connected boolean;
  v_before app_private.liveticker_wpp_runtime_control%rowtype;
  v_after app_private.liveticker_wpp_runtime_control%rowtype;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['connected']::text[] <> '{}'::jsonb
     or not (p_payload ? 'connected')
     or pg_catalog.jsonb_typeof(p_payload -> 'connected') <> 'boolean' then
    raise exception 'LIVETICKER_WPP_RUNTIME_SET_INVALID' using errcode = '22023';
  end if;

  v_actor := app_private.require_capability('liveticker.manage');
  v_connected := (p_payload ->> 'connected')::boolean;

  select * into v_before
  from app_private.liveticker_wpp_runtime_control
  where singleton = true
  for update;

  if v_before.desired_connected is distinct from v_connected then
    update app_private.liveticker_wpp_runtime_control
    set desired_connected = v_connected,
        last_state = case when v_connected then 'CONNECTING' else 'DISCONNECTING' end,
        last_error = null,
        updated_at = statement_timestamp(),
        updated_by = v_actor,
        revision = revision + 1
    where singleton = true
    returning * into v_after;

    perform app_private.log_audit(
      v_actor,
      case when v_connected then 'LIVETICKER_WPP_CONNECTED_REQUESTED' else 'LIVETICKER_WPP_DISCONNECTED_REQUESTED' end,
      'liveticker_wpp_runtime_control',
      'WPP',
      pg_catalog.jsonb_build_object('connected', v_before.desired_connected, 'revision', v_before.revision),
      pg_catalog.jsonb_build_object('connected', v_after.desired_connected, 'revision', v_after.revision),
      pg_catalog.jsonb_build_object('source', 'portal')
    );

    if not v_connected then
      perform app_private.liveticker_whatsapp_fail_pending('WPP_DISABLED_FROM_PORTAL');
    end if;
  end if;

  return app_private.liveticker_wpp_runtime_status_internal();
end;
$function$;

create or replace function app_private.api_worker_runtime_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_code text;
  v_enabled boolean;
  v_capability text;
  v_actor uuid;
  v_before app_private.worker_runtime_controls%rowtype;
  v_after app_private.worker_runtime_controls%rowtype;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or not p_payload ? 'workerCode'
     or not p_payload ? 'enabled'
     or pg_catalog.jsonb_typeof(p_payload -> 'workerCode') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'enabled') <> 'boolean'
     or p_payload - array['workerCode', 'enabled']::text[] <> '{}'::jsonb then
    raise exception 'WORKER_RUNTIME_SET_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  v_code := pg_catalog.upper(pg_catalog.btrim(p_payload ->> 'workerCode'));
  v_enabled := (p_payload ->> 'enabled')::boolean;
  v_capability := app_private.worker_runtime_capability(v_code);
  v_actor := app_private.require_capability(v_capability);

  select * into v_before
  from app_private.worker_runtime_controls as control
  where control.worker_code = v_code
  for update;
  if not found then
    raise exception 'WORKER_CODE_INVALID' using errcode = '22023';
  end if;

  if v_before.enabled is distinct from v_enabled then
    update app_private.worker_runtime_controls as control
    set enabled = v_enabled,
        last_seen_at = null,
        last_state = case when v_enabled then 'STARTING' else 'DISABLED' end,
        updated_at = statement_timestamp(),
        updated_by = v_actor,
        revision = control.revision + 1
    where control.worker_code = v_code
    returning * into v_after;

    perform app_private.log_audit(
      v_actor,
      case
        when v_code = 'LIVETICKER_GRAPHICS' and v_enabled then 'LIVETICKER_GRAPHICS_WORKER_ENABLED'
        when v_code = 'LIVETICKER_GRAPHICS' then 'LIVETICKER_GRAPHICS_WORKER_DISABLED'
        when v_code = 'LIVETICKER_WHATSAPP' and v_enabled then 'LIVETICKER_WHATSAPP_WORKER_ENABLED'
        when v_code = 'LIVETICKER_WHATSAPP' then 'LIVETICKER_WHATSAPP_WORKER_DISABLED'
        when v_enabled then 'FANBUS_PUBLISHING_WORKER_ENABLED'
        else 'FANBUS_PUBLISHING_WORKER_DISABLED'
      end,
      'worker_runtime_control',
      v_code,
      pg_catalog.jsonb_build_object('enabled', v_before.enabled, 'revision', v_before.revision),
      pg_catalog.jsonb_build_object('enabled', v_after.enabled, 'revision', v_after.revision),
      pg_catalog.jsonb_build_object('source', 'portal')
    );

    if v_code = 'LIVETICKER_WHATSAPP' and not v_enabled then
      perform app_private.liveticker_whatsapp_fail_pending('WHATSAPP_WORKER_DISABLED_FROM_PORTAL');
    end if;
  end if;

  return app_private.worker_runtime_status_internal(v_code);
end;
$function$;

create function public.pd_liveticker_wpp_runtime_control(p_state text, p_error text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_state text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_state, '')));
  v_error text := nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_error, '')), 500), '');
  v_row app_private.liveticker_wpp_runtime_control%rowtype;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or v_state not in ('CONNECTING', 'CONNECTED', 'DISCONNECTING', 'DISCONNECTED', 'ERROR') then
    raise exception 'LIVETICKER_WPP_WORKER_CONTROL_INVALID' using errcode = '22023';
  end if;

  update app_private.liveticker_wpp_runtime_control
  set last_state = v_state,
      last_seen_at = statement_timestamp(),
      last_error = case when v_state = 'ERROR' then coalesce(v_error, 'WPP_ERROR') else null end
  where singleton = true
  returning * into v_row;

  if v_state in ('DISCONNECTED', 'ERROR') then
    perform app_private.liveticker_whatsapp_fail_pending('WPP_' || v_state);
  end if;

  return pg_catalog.jsonb_build_object(
    'desiredConnected', v_row.desired_connected,
    'state', v_row.last_state,
    'pollSeconds', 5
  );
end;
$function$;

create function public.pd_liveticker_whatsapp_worker_can_claim()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_worker_enabled boolean := app_private.worker_runtime_is_enabled('LIVETICKER_WHATSAPP');
  v_wpp app_private.liveticker_wpp_runtime_control%rowtype;
  v_wpp_ready boolean := false;
begin
  select * into v_wpp
  from app_private.liveticker_wpp_runtime_control
  where singleton = true;

  v_wpp_ready := v_wpp.desired_connected
    and v_wpp.last_state = 'CONNECTED'
    and v_wpp.last_seen_at is not null
    and v_wpp.last_seen_at >= statement_timestamp() - interval '20 seconds';

  return pg_catalog.jsonb_build_object(
    'ready', v_worker_enabled and v_wpp_ready,
    'workerEnabled', v_worker_enabled,
    'wppReady', v_wpp_ready
  );
end;
$function$;

create function app_private.liveticker_whatsapp_transport_assert_ready()
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
     or v_wpp.last_seen_at < statement_timestamp() - interval '20 seconds' then
    raise exception 'LIVETICKER_WPP_NOT_READY' using errcode = '55000';
  end if;
end;
$function$;

alter function app_private.api_liveticker_whatsapp_sticker_enqueue(jsonb)
  rename to api_liveticker_whatsapp_sticker_enqueue_before_runtime_control_r1;
create function app_private.api_liveticker_whatsapp_sticker_enqueue(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.liveticker_whatsapp_transport_assert_ready();
  return app_private.api_liveticker_whatsapp_sticker_enqueue_before_runtime_control_r1(p_payload);
end;
$function$;

alter function app_private.api_liveticker_whatsapp_delivery_enqueue(jsonb)
  rename to api_liveticker_whatsapp_delivery_enqueue_before_runtime_control_r1;
create function app_private.api_liveticker_whatsapp_delivery_enqueue(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.liveticker_whatsapp_transport_assert_ready();
  return app_private.api_liveticker_whatsapp_delivery_enqueue_before_runtime_control_r1(p_payload);
end;
$function$;

alter function app_private.api_liveticker_whatsapp_delivery_retry(jsonb)
  rename to api_liveticker_whatsapp_delivery_retry_before_runtime_control_r1;
create function app_private.api_liveticker_whatsapp_delivery_retry(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.liveticker_whatsapp_transport_assert_ready();
  return app_private.api_liveticker_whatsapp_delivery_retry_before_runtime_control_r1(p_payload);
end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_whatsapp_runtime_control_r1;

create function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
begin
  case v_action
    when 'liveticker_wpp_runtime_status' then
      return app_private.api_liveticker_wpp_runtime_status(coalesce(p_payload, '{}'::jsonb));
    when 'liveticker_wpp_runtime_set' then
      return app_private.api_liveticker_wpp_runtime_set(coalesce(p_payload, '{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_whatsapp_runtime_control_r1(p_action, p_payload);
  end case;
end;
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_whatsapp_runtime_control_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'liveticker_wpp_runtime_status' then 'READ'
    when 'liveticker_wpp_runtime_set' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_whatsapp_runtime_control_r1(p_action)
  end;
$function$;

revoke all on function
  app_private.liveticker_whatsapp_fail_pending(text),
  app_private.liveticker_wpp_runtime_status_internal(),
  app_private.api_liveticker_wpp_runtime_status(jsonb),
  app_private.api_liveticker_wpp_runtime_set(jsonb),
  app_private.liveticker_whatsapp_transport_assert_ready(),
  app_private.api_liveticker_whatsapp_sticker_enqueue_before_runtime_control_r1(jsonb),
  app_private.api_liveticker_whatsapp_sticker_enqueue(jsonb),
  app_private.api_liveticker_whatsapp_delivery_enqueue_before_runtime_control_r1(jsonb),
  app_private.api_liveticker_whatsapp_delivery_enqueue(jsonb),
  app_private.api_liveticker_whatsapp_delivery_retry_before_runtime_control_r1(jsonb),
  app_private.api_liveticker_whatsapp_delivery_retry(jsonb),
  app_private.pd_api_dispatch_current_before_whatsapp_runtime_control_r1(text, jsonb),
  app_private.platform_action_classification_before_whatsapp_runtime_control_r1(text),
  public.pd_liveticker_wpp_runtime_control(text, text),
  public.pd_liveticker_whatsapp_worker_can_claim()
from public, anon, authenticated, service_role;

grant execute on function public.pd_liveticker_wpp_runtime_control(text, text) to service_role;
grant execute on function public.pd_liveticker_whatsapp_worker_can_claim() to service_role;

commit;
