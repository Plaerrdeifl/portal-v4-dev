-- PROD reconcile R1: preserve existing multichannel routing while adding
-- IMAGE_WITH_CAPTION support and disabling legacy graphic autoqueue.
-- Built against PROD state observed on 2026-09-19. Additive/idempotent where practical.

begin;

alter table app_modules.liveticker_whatsapp_jobs
  add column if not exists image_url text,
  add column if not exists image_filename text,
  add column if not exists image_status text not null default 'NOT_REQUESTED',
  add column if not exists image_waha_message_id text,
  add column if not exists image_sent_at timestamptz;

alter table app_modules.liveticker_whatsapp_job_targets
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

alter table app_modules.liveticker_whatsapp_job_targets
  drop constraint if exists liveticker_whatsapp_job_targets_component_status_check,
  drop constraint if exists liveticker_whatsapp_job_targets_success_check,
  drop constraint if exists liveticker_whatsapp_job_targets_image_result_check,
  drop constraint if exists liveticker_whatsapp_job_targets_image_message_id_check;

alter table app_modules.liveticker_whatsapp_job_targets
  add constraint liveticker_whatsapp_job_targets_component_status_check
    check (
      sticker_status in ('NOT_REQUESTED','PENDING','SENT','FAILED')
      and text_status in ('NOT_REQUESTED','PENDING','SENT','FAILED')
      and image_status in ('NOT_REQUESTED','PENDING','SENT','FAILED')
    ),
  add constraint liveticker_whatsapp_job_targets_success_check
    check (
      status <> 'SUCCEEDED'
      or (
        sticker_status in ('NOT_REQUESTED','SENT')
        and text_status in ('NOT_REQUESTED','SENT')
        and image_status in ('NOT_REQUESTED','SENT')
      )
    ),
  add constraint liveticker_whatsapp_job_targets_image_result_check
    check (
      (image_status = 'SENT' and image_sent_at is not null)
      or
      (image_status <> 'SENT' and image_sent_at is null and image_waha_message_id is null)
    ),
  add constraint liveticker_whatsapp_job_targets_image_message_id_check
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

  if app_private.platform_release_environment() is distinct from 'PROD'
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
    event_id, client_action_id, publication_version, requested_by, message, sticker_id,
    delivery_mode, sticker_status, text_status, image_url, image_filename, image_status, linked_action_id
  ) values (
    v_event_id, v_request_key, 1, v_actor, v_message, null,
    'IMAGE_WITH_CAPTION', 'NOT_REQUESTED', 'NOT_REQUESTED',
    v_image_url, v_image_filename, 'PENDING', null
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

create or replace function app_private.liveticker_whatsapp_job_snapshot_targets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_mode text;
  v_code text;
  v_channel app_private.liveticker_whatsapp_channels%rowtype;
begin
  select mode into v_mode
  from app_private.liveticker_whatsapp_routing_control
  where singleton = true;

  foreach v_code in array app_private.liveticker_whatsapp_mode_codes(v_mode)
  loop
    select * into v_channel
    from app_private.liveticker_whatsapp_channels
    where code = v_code
      and enabled
      and waha_channel_id is not null;

    if not found then
      raise exception 'LIVETICKER_WHATSAPP_CHANNEL_NOT_CONFIGURED' using errcode = '55000';
    end if;

    insert into app_modules.liveticker_whatsapp_job_targets(
      job_id, channel_code, channel_label, waha_channel_id,
      sticker_status, text_status, image_status
    ) values (
      new.id, v_channel.code, v_channel.label, v_channel.waha_channel_id,
      case
        when new.delivery_mode in ('TEXT_ONLY','IMAGE_WITH_CAPTION') then 'NOT_REQUESTED'
        else 'PENDING'
      end,
      case
        when new.delivery_mode in ('STICKER_ONLY','IMAGE_WITH_CAPTION') then 'NOT_REQUESTED'
        else 'PENDING'
      end,
      case when new.delivery_mode = 'IMAGE_WITH_CAPTION' then 'PENDING' else 'NOT_REQUESTED' end
    );
  end loop;

  return new;
end;
$function$;

create or replace function app_private.liveticker_whatsapp_recompute_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job app_modules.liveticker_whatsapp_jobs%rowtype;
  v_count integer;
  v_status text;
  v_attempt integer;
  v_sticker_status text;
  v_text_status text;
  v_image_status text;
  v_sticker_sent_at timestamptz;
  v_text_sent_at timestamptz;
  v_image_sent_at timestamptz;
  v_sticker_message_id text;
  v_text_message_id text;
  v_image_message_id text;
  v_error text;
begin
  select * into v_job
  from app_modules.liveticker_whatsapp_jobs
  where id = p_job_id
  for update;
  if not found then return; end if;

  select
    count(*)::integer,
    coalesce(max(target.attempt_count), 0),
    case
      when pg_catalog.bool_and(target.status = 'SUCCEEDED') then 'SUCCEEDED'
      when pg_catalog.bool_or(target.status = 'FAILED') then 'FAILED'
      when pg_catalog.bool_or(target.status = 'PROCESSING') then 'PROCESSING'
      else 'PENDING'
    end,
    case
      when v_job.delivery_mode in ('TEXT_ONLY','IMAGE_WITH_CAPTION') then 'NOT_REQUESTED'
      when pg_catalog.bool_and(target.sticker_status = 'SENT') then 'SENT'
      when pg_catalog.bool_or(target.sticker_status = 'FAILED') then 'FAILED'
      else 'PENDING'
    end,
    case
      when v_job.delivery_mode in ('STICKER_ONLY','IMAGE_WITH_CAPTION') then 'NOT_REQUESTED'
      when pg_catalog.bool_and(target.text_status = 'SENT') then 'SENT'
      when pg_catalog.bool_or(target.text_status = 'FAILED') then 'FAILED'
      else 'PENDING'
    end,
    case
      when v_job.delivery_mode <> 'IMAGE_WITH_CAPTION' then 'NOT_REQUESTED'
      when pg_catalog.bool_and(target.image_status = 'SENT') then 'SENT'
      when pg_catalog.bool_or(target.image_status = 'FAILED') then 'FAILED'
      else 'PENDING'
    end,
    max(target.sticker_sent_at),
    max(target.text_sent_at),
    max(target.image_sent_at),
    case when count(*) = 1 then max(target.sticker_waha_message_id) else null end,
    case when count(*) = 1 then max(target.text_waha_message_id) else null end,
    case when count(*) = 1 then max(target.image_waha_message_id) else null end,
    max(target.last_error) filter (where target.status = 'FAILED')
  into
    v_count, v_attempt, v_status,
    v_sticker_status, v_text_status, v_image_status,
    v_sticker_sent_at, v_text_sent_at, v_image_sent_at,
    v_sticker_message_id, v_text_message_id, v_image_message_id,
    v_error
  from app_modules.liveticker_whatsapp_job_targets as target
  where target.job_id = p_job_id;

  if v_count = 0 then return; end if;

  update app_modules.liveticker_whatsapp_jobs
  set status = v_status,
      attempt_count = least(v_attempt, 5),
      sticker_status = v_sticker_status,
      text_status = v_text_status,
      image_status = v_image_status,
      sticker_waha_message_id = case when v_sticker_status = 'SENT' then v_sticker_message_id else null end,
      sticker_sent_at = case when v_sticker_status = 'SENT' then v_sticker_sent_at else null end,
      text_waha_message_id = case when v_text_status = 'SENT' then v_text_message_id else null end,
      text_sent_at = case when v_text_status = 'SENT' then v_text_sent_at else null end,
      image_waha_message_id = case when v_image_status = 'SENT' then v_image_message_id else null end,
      image_sent_at = case when v_image_status = 'SENT' then v_image_sent_at else null end,
      waha_message_id = case
        when v_status = 'SUCCEEDED' and v_count = 1
          then coalesce(v_image_message_id, v_text_message_id, v_sticker_message_id)
        else null
      end,
      waha_sent_at = case
        when v_status = 'SUCCEEDED'
          then coalesce(v_image_sent_at, v_text_sent_at, v_sticker_sent_at)
        else null
      end,
      completed_at = case when v_status in ('SUCCEEDED','FAILED') then statement_timestamp() else null end,
      last_error = case when v_status = 'FAILED' then v_error else null end,
      updated_at = statement_timestamp()
  where id = p_job_id;
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
  v_rows integer;
begin
  perform app_private.liveticker_require_operator();

  if app_private.platform_release_environment() is distinct from 'PROD'
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

  perform app_private.liveticker_whatsapp_transport_assert_ready();
  v_event_id := (p_payload ->> 'eventId')::uuid;
  v_job_id := (p_payload ->> 'jobId')::uuid;
  perform app_private.liveticker_assert_supported_game(v_event_id);

  select * into v_job
  from app_modules.liveticker_whatsapp_jobs
  where id = v_job_id and event_id = v_event_id
  for update;

  if not found then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_UNKNOWN' using errcode = 'P0002';
  end if;
  if v_job.status <> 'FAILED' then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_NOT_FAILED' using errcode = '55000';
  end if;

  update app_modules.liveticker_whatsapp_job_targets
  set status = 'PENDING',
      attempt_count = 0,
      claimed_at = null,
      worker_received_at = null,
      completed_at = null,
      last_error = null,
      sticker_status = case when sticker_status = 'FAILED' then 'PENDING' else sticker_status end,
      text_status = case when text_status = 'FAILED' then 'PENDING' else text_status end,
      image_status = case when image_status = 'FAILED' then 'PENDING' else image_status end,
      updated_at = statement_timestamp()
  where job_id = v_job_id
    and status = 'FAILED';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_NOT_FAILED' using errcode = '55000';
  end if;

  perform app_private.liveticker_whatsapp_recompute_job(v_job_id);

  select * into v_job
  from app_modules.liveticker_whatsapp_jobs
  where id = v_job_id;

  return pg_catalog.jsonb_build_object('delivery', app_private.liveticker_whatsapp_delivery_json(v_job));
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

create or replace view public.pd_liveticker_whatsapp_job_targets_worker
with (security_invoker = true)
as
select
  id,job_id,channel_code,channel_label,waha_channel_id,status,attempt_count,
  claimed_at,worker_received_at,completed_at,last_error,
  sticker_status,text_status,
  sticker_waha_message_id,sticker_sent_at,
  text_waha_message_id,text_sent_at,
  created_at,updated_at,
  image_status,image_waha_message_id,image_sent_at
from app_modules.liveticker_whatsapp_job_targets;

revoke all on table public.pd_liveticker_whatsapp_job_targets_worker
  from public, anon, authenticated, service_role;
grant select, update on table public.pd_liveticker_whatsapp_job_targets_worker to service_role;

-- Current operator UX creates period/final graphics explicitly.
drop trigger if exists liveticker_graphic_autqueue_r1 on app_modules.liveticker_game_states;

revoke all on function app_private.liveticker_whatsapp_delivery_json(app_modules.liveticker_whatsapp_jobs)
  from public, anon, authenticated, service_role;
revoke all on function app_private.api_liveticker_whatsapp_delivery_retry(jsonb)
  from public, anon, authenticated, service_role;

commit;
