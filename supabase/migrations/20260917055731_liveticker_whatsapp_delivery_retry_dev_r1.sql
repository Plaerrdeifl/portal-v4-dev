begin;

create function app_private.api_liveticker_whatsapp_delivery_retry(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
  v_job_id uuid;
  v_job app_modules.liveticker_whatsapp_jobs%rowtype;
begin
  perform app_private.liveticker_require_operator();

  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['eventId', 'jobId']::text[] <> '{}'::jsonb
     or not (p_payload ?& array['eventId', 'jobId']::text[])
     or pg_catalog.jsonb_typeof(p_payload -> 'eventId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'jobId') <> 'string'
     or (p_payload ->> 'eventId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (p_payload ->> 'jobId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_RETRY_INVALID' using errcode = '22023';
  end if;

  v_event_id := (p_payload ->> 'eventId')::uuid;
  v_job_id := (p_payload ->> 'jobId')::uuid;
  perform app_private.liveticker_assert_supported_game(v_event_id);

  select *
  into v_job
  from app_modules.liveticker_whatsapp_jobs as job
  where job.id = v_job_id
    and job.event_id = v_event_id
  for update;

  if not found then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_UNKNOWN' using errcode = 'P0002';
  end if;
  if v_job.status <> 'FAILED'
     or (v_job.sticker_status <> 'FAILED' and v_job.text_status <> 'FAILED') then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_NOT_FAILED' using errcode = '55000';
  end if;

  update app_modules.liveticker_whatsapp_jobs
  set status = 'PENDING',
      attempt_count = 0,
      next_attempt_at = pg_catalog.now(),
      claimed_at = null,
      worker_received_at = null,
      completed_at = null,
      last_error = null,
      sticker_status = case when sticker_status = 'FAILED' then 'PENDING' else sticker_status end,
      text_status = case when text_status = 'FAILED' then 'PENDING' else text_status end,
      updated_at = pg_catalog.now()
  where id = v_job.id
    and status = 'FAILED'
  returning * into v_job;

  if not found then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_RETRY_CONFLICT' using errcode = '40001';
  end if;

  return jsonb_build_object('delivery', app_private.liveticker_whatsapp_delivery_json(v_job));
end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_wa_delivery_retry_r1;

create function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
begin
  if v_action = 'liveticker_whatsapp_delivery_retry' then
    return app_private.api_liveticker_whatsapp_delivery_retry(coalesce(p_payload, '{}'::jsonb));
  end if;
  return app_private.pd_api_dispatch_current_before_wa_delivery_retry_r1(p_action, p_payload);
end;
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_wa_delivery_retry_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'liveticker_whatsapp_delivery_retry' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_wa_delivery_retry_r1(p_action)
  end;
$function$;

revoke all on function
  app_private.api_liveticker_whatsapp_delivery_retry(jsonb),
  app_private.pd_api_dispatch_current_before_wa_delivery_retry_r1(text, jsonb),
  app_private.platform_action_classification_before_wa_delivery_retry_r1(text)
from public, anon, authenticated, service_role;

commit;
