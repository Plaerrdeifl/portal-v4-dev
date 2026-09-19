-- DEV only: durable WhatsApp summary delivery as one POST image with caption.
-- Existing TEXT_ONLY / STICKER_* jobs keep their current behavior.

begin;

alter table app_modules.liveticker_whatsapp_jobs
  add column if not exists image_url text,
  add column if not exists image_filename text,
  add column if not exists image_status text not null default 'NOT_REQUESTED',
  add column if not exists image_waha_message_id text,
  add column if not exists image_sent_at timestamptz;

alter table app_modules.liveticker_whatsapp_jobs
  drop constraint if exists liveticker_whatsapp_jobs_delivery_mode_check,
  drop constraint if exists liveticker_whatsapp_jobs_component_status_check,
  drop constraint if exists liveticker_whatsapp_jobs_components_check,
  drop constraint if exists liveticker_whatsapp_jobs_delivery_success_check,
  drop constraint if exists liveticker_whatsapp_jobs_image_result_check,
  drop constraint if exists liveticker_whatsapp_jobs_image_message_id_check;

alter table app_modules.liveticker_whatsapp_jobs
  add constraint liveticker_whatsapp_jobs_delivery_mode_check
    check (delivery_mode in ('TEXT_ONLY','STICKER_THEN_TEXT','STICKER_ONLY','IMAGE_WITH_CAPTION')),
  add constraint liveticker_whatsapp_jobs_component_status_check
    check (
      sticker_status in ('NOT_REQUESTED','PENDING','SENT','FAILED')
      and text_status in ('NOT_REQUESTED','PENDING','SENT','FAILED')
      and image_status in ('NOT_REQUESTED','PENDING','SENT','FAILED')
    ),
  add constraint liveticker_whatsapp_jobs_components_check
    check (
      (
        delivery_mode = 'TEXT_ONLY'
        and sticker_id is null
        and message is not null
        and char_length(btrim(message)) between 1 and 4000
        and image_url is null
        and image_filename is null
        and sticker_status = 'NOT_REQUESTED'
        and text_status <> 'NOT_REQUESTED'
        and image_status = 'NOT_REQUESTED'
      )
      or
      (
        delivery_mode = 'STICKER_THEN_TEXT'
        and sticker_id is not null
        and message is not null
        and char_length(btrim(message)) between 1 and 4000
        and image_url is null
        and image_filename is null
        and sticker_status <> 'NOT_REQUESTED'
        and text_status <> 'NOT_REQUESTED'
        and image_status = 'NOT_REQUESTED'
      )
      or
      (
        delivery_mode = 'STICKER_ONLY'
        and sticker_id is not null
        and message is null
        and image_url is null
        and image_filename is null
        and sticker_status <> 'NOT_REQUESTED'
        and text_status = 'NOT_REQUESTED'
        and image_status = 'NOT_REQUESTED'
      )
      or
      (
        delivery_mode = 'IMAGE_WITH_CAPTION'
        and sticker_id is null
        and message is not null
        and char_length(btrim(message)) between 1 and 4000
        and image_url ~ '^https://cloud[.]plaerrdeifl[.]de/s/[A-Za-z0-9]{8,128}/download$'
        and image_filename ~ '^[A-Za-z0-9._-]{1,96}[.]png$'
        and sticker_status = 'NOT_REQUESTED'
        and text_status = 'NOT_REQUESTED'
        and image_status <> 'NOT_REQUESTED'
        and linked_action_id is null
      )
    ),
  add constraint liveticker_whatsapp_jobs_delivery_success_check
    check (
      status <> 'SUCCEEDED'
      or (
        sticker_status in ('NOT_REQUESTED','SENT')
        and text_status in ('NOT_REQUESTED','SENT')
        and image_status in ('NOT_REQUESTED','SENT')
      )
    ),
  add constraint liveticker_whatsapp_jobs_image_result_check
    check (
      (image_status = 'SENT' and image_sent_at is not null)
      or
      (image_status <> 'SENT' and image_sent_at is null and image_waha_message_id is null)
    ),
  add constraint liveticker_whatsapp_jobs_image_message_id_check
    check (image_waha_message_id is null or char_length(image_waha_message_id) <= 512);

create or replace function app_private.liveticker_whatsapp_delivery_json(
  p_job app_modules.liveticker_whatsapp_jobs
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', p_job.id,
    'eventId', p_job.event_id,
    'deliveryMode', p_job.delivery_mode,
    'stickerId', p_job.sticker_id,
    'linkedActionId', p_job.linked_action_id,
    'stickerStatus', p_job.sticker_status,
    'textStatus', p_job.text_status,
    'imageStatus', p_job.image_status,
    'status', p_job.status,
    'attemptCount', p_job.attempt_count,
    'createdAt', p_job.created_at,
    'updatedAt', p_job.updated_at
  );
$function$;

create or replace function app_private.api_liveticker_whatsapp_delivery_enqueue(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_event_id uuid;
  v_mode text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_payload ->> 'deliveryMode', '')));
  v_idempotency_key uuid;
  v_request_key text;
  v_image_url text := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'imageUrl', '')), '');
  v_image_filename text := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'imageFilename', '')), '');
  v_message text := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'message', '')), '');
  v_job app_modules.liveticker_whatsapp_jobs%rowtype;
begin
  perform app_private.liveticker_whatsapp_transport_assert_ready();

  if v_mode <> 'IMAGE_WITH_CAPTION' then
    return app_private.api_liveticker_whatsapp_delivery_enqueue_before_runtime_control(p_payload);
  end if;

  v_actor := app_private.liveticker_require_operator();

  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['eventId','deliveryMode','idempotencyKey','imageUrl','imageFilename','message']::text[] <> '{}'::jsonb
     or not (p_payload ?& array['eventId','deliveryMode','idempotencyKey','imageUrl','imageFilename','message']::text[])
     or pg_catalog.jsonb_typeof(p_payload -> 'eventId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'deliveryMode') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'idempotencyKey') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'imageUrl') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'imageFilename') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'message') <> 'string'
     or (p_payload ->> 'eventId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (p_payload ->> 'idempotencyKey') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or v_image_url !~ '^https://cloud[.]plaerrdeifl[.]de/s/[A-Za-z0-9]{8,128}/download$'
     or v_image_filename !~ '^[A-Za-z0-9._-]{1,96}[.]png$'
     or v_message is null
     or pg_catalog.char_length(v_message) > 4000 then
    raise exception 'LIVETICKER_WHATSAPP_IMAGE_CAPTION_ENQUEUE_INVALID' using errcode = '22023';
  end if;

  v_event_id := (p_payload ->> 'eventId')::uuid;
  v_idempotency_key := (p_payload ->> 'idempotencyKey')::uuid;
  v_request_key := 'summary:' || v_idempotency_key::text;

  perform app_private.liveticker_assert_supported_game(v_event_id);

  insert into app_modules.liveticker_whatsapp_jobs(
    event_id,
    client_action_id,
    publication_version,
    requested_by,
    message,
    sticker_id,
    delivery_mode,
    sticker_status,
    text_status,
    image_url,
    image_filename,
    image_status,
    linked_action_id
  ) values (
    v_event_id,
    v_request_key,
    1,
    v_actor,
    v_message,
    null,
    'IMAGE_WITH_CAPTION',
    'NOT_REQUESTED',
    'NOT_REQUESTED',
    v_image_url,
    v_image_filename,
    'PENDING',
    null
  )
  on conflict (event_id, client_action_id, publication_version) do nothing;

  select * into v_job
  from app_modules.liveticker_whatsapp_jobs as job
  where job.event_id = v_event_id
    and job.client_action_id = v_request_key
    and job.publication_version = 1;

  if not found
     or v_job.requested_by <> v_actor
     or v_job.delivery_mode <> 'IMAGE_WITH_CAPTION'
     or v_job.image_url is distinct from v_image_url
     or v_job.image_filename is distinct from v_image_filename
     or v_job.message is distinct from v_message
     or v_job.sticker_id is not null
     or v_job.linked_action_id is not null then
    raise exception 'LIVETICKER_WHATSAPP_IMAGE_CAPTION_ENQUEUE_CONFLICT' using errcode = '23505';
  end if;

  return jsonb_build_object('delivery', app_private.liveticker_whatsapp_delivery_json(v_job));
end;
$function$;

create or replace function app_private.api_liveticker_whatsapp_delivery_retry(p_payload jsonb)
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
  perform app_private.liveticker_whatsapp_transport_assert_ready();
  perform app_private.liveticker_require_operator();

  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['eventId','jobId']::text[] <> '{}'::jsonb
     or not (p_payload ?& array['eventId','jobId']::text[])
     or pg_catalog.jsonb_typeof(p_payload -> 'eventId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'jobId') <> 'string'
     or (p_payload ->> 'eventId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (p_payload ->> 'jobId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_RETRY_INVALID' using errcode = '22023';
  end if;

  v_event_id := (p_payload ->> 'eventId')::uuid;
  v_job_id := (p_payload ->> 'jobId')::uuid;
  perform app_private.liveticker_assert_supported_game(v_event_id);

  select * into v_job
  from app_modules.liveticker_whatsapp_jobs as job
  where job.id = v_job_id
    and job.event_id = v_event_id
  for update;

  if not found then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_UNKNOWN' using errcode = 'P0002';
  end if;

  if v_job.status <> 'FAILED'
     or (
       v_job.sticker_status <> 'FAILED'
       and v_job.text_status <> 'FAILED'
       and v_job.image_status <> 'FAILED'
     ) then
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
      image_status = case when image_status = 'FAILED' then 'PENDING' else image_status end,
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

create or replace view public.pd_liveticker_whatsapp_jobs_worker
with (security_invoker = true)
as
select
  id,event_id,client_action_id,publication_version,requested_by,message,status,
  attempt_count,next_attempt_at,claimed_at,worker_received_at,waha_sent_at,
  completed_at,waha_message_id,last_error,created_at,updated_at,sticker_id,
  delivery_mode,sticker_status,text_status,sticker_waha_message_id,sticker_sent_at,
  text_waha_message_id,text_sent_at,linked_action_id,
  image_url,image_filename,image_status,image_waha_message_id,image_sent_at
from app_modules.liveticker_whatsapp_jobs;

revoke all on table public.pd_liveticker_whatsapp_jobs_worker
  from public, anon, authenticated, service_role;
grant select, update on table public.pd_liveticker_whatsapp_jobs_worker to service_role;

revoke all on function app_private.liveticker_whatsapp_delivery_json(app_modules.liveticker_whatsapp_jobs)
  from public, anon, authenticated, service_role;
revoke all on function app_private.api_liveticker_whatsapp_delivery_retry(jsonb)
  from public, anon, authenticated, service_role;

commit;
