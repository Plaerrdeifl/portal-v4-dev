-- DEV only: additive component-aware WhatsApp delivery contract for Liveticker.
-- Existing jobs retain their TEXT_ONLY / STICKER_THEN_TEXT behavior. New
-- STICKER_ONLY jobs reuse the same durable outbox, gateway and worker.

begin;

alter table app_modules.liveticker_whatsapp_jobs
  alter column message drop not null,
  drop constraint liveticker_whatsapp_jobs_message_check;

alter table app_modules.liveticker_whatsapp_jobs
  add column delivery_mode text,
  add column sticker_status text,
  add column text_status text,
  add column sticker_waha_message_id text,
  add column sticker_sent_at timestamptz,
  add column text_waha_message_id text,
  add column text_sent_at timestamptz,
  add column linked_action_id text;

update app_modules.liveticker_whatsapp_jobs
set delivery_mode = case
      when sticker_id is null then 'TEXT_ONLY'
      else 'STICKER_THEN_TEXT'
    end,
    sticker_status = case
      when sticker_id is null then 'NOT_REQUESTED'
      when status = 'SUCCEEDED' then 'SENT'
      when status = 'FAILED' then 'FAILED'
      else 'PENDING'
    end,
    text_status = case
      when status = 'SUCCEEDED' then 'SENT'
      when status = 'FAILED' then 'FAILED'
      else 'PENDING'
    end,
    sticker_sent_at = case
      when sticker_id is not null and status = 'SUCCEEDED'
        then coalesce(waha_sent_at, completed_at, updated_at)
      else null
    end,
    text_waha_message_id = case when status = 'SUCCEEDED' then waha_message_id else null end,
    text_sent_at = case
      when status = 'SUCCEEDED' then coalesce(waha_sent_at, completed_at, updated_at)
      else null
    end,
    linked_action_id = client_action_id;

alter table app_modules.liveticker_whatsapp_jobs
  alter column delivery_mode set default 'TEXT_ONLY',
  alter column delivery_mode set not null,
  alter column sticker_status set default 'NOT_REQUESTED',
  alter column sticker_status set not null,
  alter column text_status set default 'PENDING',
  alter column text_status set not null,
  add constraint liveticker_whatsapp_jobs_delivery_mode_check
    check (delivery_mode in ('TEXT_ONLY', 'STICKER_THEN_TEXT', 'STICKER_ONLY')),
  add constraint liveticker_whatsapp_jobs_component_status_check
    check (
      sticker_status in ('NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED')
      and text_status in ('NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED')
    ),
  add constraint liveticker_whatsapp_jobs_components_check
    check (
      (delivery_mode = 'TEXT_ONLY'
        and sticker_id is null
        and message is not null
        and char_length(btrim(message)) between 1 and 4000
        and sticker_status = 'NOT_REQUESTED'
        and text_status <> 'NOT_REQUESTED')
      or
      (delivery_mode = 'STICKER_THEN_TEXT'
        and sticker_id is not null
        and message is not null
        and char_length(btrim(message)) between 1 and 4000
        and sticker_status <> 'NOT_REQUESTED'
        and text_status <> 'NOT_REQUESTED')
      or
      (delivery_mode = 'STICKER_ONLY'
        and sticker_id is not null
        and message is null
        and sticker_status <> 'NOT_REQUESTED'
        and text_status = 'NOT_REQUESTED')
    ),
  add constraint liveticker_whatsapp_jobs_sticker_result_check
    check (
      (sticker_status = 'SENT' and sticker_sent_at is not null)
      or
      (sticker_status <> 'SENT' and sticker_sent_at is null and sticker_waha_message_id is null)
    ),
  add constraint liveticker_whatsapp_jobs_text_result_check
    check (
      (text_status = 'SENT' and text_sent_at is not null)
      or
      (text_status <> 'SENT' and text_sent_at is null and text_waha_message_id is null)
    ),
  add constraint liveticker_whatsapp_jobs_delivery_success_check
    check (
      status <> 'SUCCEEDED'
      or (
        sticker_status in ('NOT_REQUESTED', 'SENT')
        and text_status in ('NOT_REQUESTED', 'SENT')
      )
    ),
  add constraint liveticker_whatsapp_jobs_sticker_message_id_check
    check (sticker_waha_message_id is null or char_length(sticker_waha_message_id) <= 512),
  add constraint liveticker_whatsapp_jobs_text_message_id_check
    check (text_waha_message_id is null or char_length(text_waha_message_id) <= 512),
  add constraint liveticker_whatsapp_jobs_linked_action_check
    check (linked_action_id is null or linked_action_id ~ '^[A-Za-z0-9._:-]{1,100}$');

create index liveticker_whatsapp_jobs_linked_action_idx
  on app_modules.liveticker_whatsapp_jobs(event_id, linked_action_id, created_at)
  where linked_action_id is not null;

alter table app_modules.liveticker_whatsapp_stickers
  add column audience text not null default 'GENERAL',
  add column opponent_team_id uuid references app_modules.liveticker_teams(id) on delete restrict,
  add column category text not null default 'GENERAL',
  add constraint liveticker_whatsapp_stickers_audience_check
    check (audience in ('OUR_TEAM', 'OPPONENT', 'GENERAL')),
  add constraint liveticker_whatsapp_stickers_category_check
    check (category in ('GOAL', 'AGAINST', 'PENALTY', 'VIDEO_REVIEW', 'GENERAL')),
  add constraint liveticker_whatsapp_stickers_opponent_check
    check (
      (audience = 'OPPONENT' and opponent_team_id is not null)
      or
      (audience in ('OUR_TEAM', 'GENERAL') and opponent_team_id is null)
    );

create index liveticker_whatsapp_stickers_game_picker_idx
  on app_modules.liveticker_whatsapp_stickers(audience, opponent_team_id, category, sort_order, name, id)
  where active;

create or replace function app_private.api_liveticker_whatsapp_stickers_list(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_include_inactive boolean := coalesce((p_payload ->> 'includeInactive')::boolean, false);
begin
  perform app_private.liveticker_require_operator();
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['includeInactive']::text[] <> '{}'::jsonb
     or (p_payload ? 'includeInactive' and pg_catalog.jsonb_typeof(p_payload -> 'includeInactive') <> 'boolean') then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_LIST_INVALID' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'stickers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sticker.id,
        'name', sticker.name,
        'slug', sticker.slug,
        'mimeType', sticker.mime_type,
        'active', sticker.active,
        'sortOrder', sticker.sort_order,
        'width', sticker.width,
        'height', sticker.height,
        'fileSize', sticker.file_size,
        'audience', sticker.audience,
        'opponentTeamId', sticker.opponent_team_id,
        'category', sticker.category,
        'createdAt', sticker.created_at,
        'updatedAt', sticker.updated_at
      ) order by sticker.sort_order, sticker.name, sticker.id)
      from app_modules.liveticker_whatsapp_stickers as sticker
      where v_include_inactive or sticker.active
    ), '[]'::jsonb)
  );
end;
$function$;

create function app_private.liveticker_whatsapp_delivery_json(
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
    'status', p_job.status,
    'attemptCount', p_job.attempt_count,
    'createdAt', p_job.created_at,
    'updatedAt', p_job.updated_at
  );
$function$;

create function app_private.api_liveticker_whatsapp_sticker_enqueue(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_event_id uuid;
  v_sticker_id uuid;
  v_idempotency_key uuid;
  v_request_key text;
  v_linked_action_id text := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'linkedActionId', '')), '');
  v_job app_modules.liveticker_whatsapp_jobs%rowtype;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['eventId', 'stickerId', 'idempotencyKey', 'linkedActionId']::text[] <> '{}'::jsonb
     or not (p_payload ?& array['eventId', 'stickerId', 'idempotencyKey']::text[])
     or pg_catalog.jsonb_typeof(p_payload -> 'eventId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'stickerId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'idempotencyKey') <> 'string'
     or (p_payload ? 'linkedActionId'
       and p_payload -> 'linkedActionId' <> 'null'::jsonb
       and pg_catalog.jsonb_typeof(p_payload -> 'linkedActionId') <> 'string')
     or (p_payload ->> 'eventId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (p_payload ->> 'stickerId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (p_payload ->> 'idempotencyKey') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (v_linked_action_id is not null and v_linked_action_id !~ '^[A-Za-z0-9._:-]{1,100}$') then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_ENQUEUE_INVALID' using errcode = '22023';
  end if;

  v_event_id := (p_payload ->> 'eventId')::uuid;
  v_sticker_id := (p_payload ->> 'stickerId')::uuid;
  v_idempotency_key := (p_payload ->> 'idempotencyKey')::uuid;
  v_request_key := 'sticker:' || v_idempotency_key::text;

  perform app_private.liveticker_assert_supported_game(v_event_id);
  if not exists (
    select 1
    from app_modules.liveticker_whatsapp_stickers as sticker
    where sticker.id = v_sticker_id and sticker.active
  ) then
    raise exception 'LIVETICKER_UNKNOWN_WHATSAPP_STICKER' using errcode = '22023';
  end if;
  if v_linked_action_id is not null and not exists (
    select 1
    from app_modules.liveticker_actions as action
    where action.event_id = v_event_id
      and action.client_action_id = v_linked_action_id
      and action.is_active
  ) then
    raise exception 'LIVETICKER_WHATSAPP_ACTION_UNKNOWN' using errcode = 'P0002';
  end if;

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
    linked_action_id
  ) values (
    v_event_id,
    v_request_key,
    1,
    v_actor,
    null,
    v_sticker_id,
    'STICKER_ONLY',
    'PENDING',
    'NOT_REQUESTED',
    v_linked_action_id
  )
  on conflict (event_id, client_action_id, publication_version) do nothing;

  select *
  into v_job
  from app_modules.liveticker_whatsapp_jobs as job
  where job.event_id = v_event_id
    and job.client_action_id = v_request_key
    and job.publication_version = 1;

  if not found
     or v_job.requested_by <> v_actor
     or v_job.delivery_mode <> 'STICKER_ONLY'
     or v_job.sticker_id <> v_sticker_id
     or v_job.message is not null
     or v_job.linked_action_id is distinct from v_linked_action_id then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_ENQUEUE_CONFLICT' using errcode = '23505';
  end if;

  return jsonb_build_object('delivery', app_private.liveticker_whatsapp_delivery_json(v_job));
end;
$function$;

create function app_private.api_liveticker_whatsapp_delivery_enqueue(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_event_id uuid;
  v_mode text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_payload ->> 'deliveryMode', '')));
  v_sticker_id_raw text := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'stickerId', '')), '');
  v_sticker_id uuid;
  v_message text := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'message', '')), '');
  v_idempotency_key uuid;
  v_request_key text;
  v_linked_action_id text := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'linkedActionId', '')), '');
  v_job app_modules.liveticker_whatsapp_jobs%rowtype;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['eventId', 'deliveryMode', 'stickerId', 'message', 'idempotencyKey', 'linkedActionId']::text[] <> '{}'::jsonb
     or not (p_payload ?& array['eventId', 'deliveryMode', 'idempotencyKey']::text[])
     or pg_catalog.jsonb_typeof(p_payload -> 'eventId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'deliveryMode') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'idempotencyKey') <> 'string'
     or (p_payload ? 'stickerId'
       and p_payload -> 'stickerId' <> 'null'::jsonb
       and pg_catalog.jsonb_typeof(p_payload -> 'stickerId') <> 'string')
     or (p_payload ? 'message'
       and p_payload -> 'message' <> 'null'::jsonb
       and pg_catalog.jsonb_typeof(p_payload -> 'message') <> 'string')
     or (p_payload ? 'linkedActionId'
       and p_payload -> 'linkedActionId' <> 'null'::jsonb
       and pg_catalog.jsonb_typeof(p_payload -> 'linkedActionId') <> 'string')
     or (p_payload ->> 'eventId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (p_payload ->> 'idempotencyKey') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (v_sticker_id_raw is not null
       and v_sticker_id_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
     or (v_linked_action_id is not null and v_linked_action_id !~ '^[A-Za-z0-9._:-]{1,100}$')
     or v_mode not in ('TEXT_ONLY', 'STICKER_THEN_TEXT', 'STICKER_ONLY')
     or (v_mode = 'TEXT_ONLY' and (v_sticker_id_raw is not null or v_message is null))
     or (v_mode = 'STICKER_THEN_TEXT' and (v_sticker_id_raw is null or v_message is null))
     or (v_mode = 'STICKER_ONLY' and (v_sticker_id_raw is null or v_message is not null))
     or (v_message is not null and pg_catalog.char_length(v_message) > 4000) then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_ENQUEUE_INVALID' using errcode = '22023';
  end if;

  v_event_id := (p_payload ->> 'eventId')::uuid;
  v_sticker_id := v_sticker_id_raw::uuid;
  v_idempotency_key := (p_payload ->> 'idempotencyKey')::uuid;
  v_request_key := 'delivery:' || v_idempotency_key::text;

  perform app_private.liveticker_assert_supported_game(v_event_id);
  if v_sticker_id is not null and not exists (
    select 1
    from app_modules.liveticker_whatsapp_stickers as sticker
    where sticker.id = v_sticker_id and sticker.active
  ) then
    raise exception 'LIVETICKER_UNKNOWN_WHATSAPP_STICKER' using errcode = '22023';
  end if;
  if v_linked_action_id is not null and not exists (
    select 1
    from app_modules.liveticker_actions as action
    where action.event_id = v_event_id
      and action.client_action_id = v_linked_action_id
      and action.is_active
  ) then
    raise exception 'LIVETICKER_WHATSAPP_ACTION_UNKNOWN' using errcode = 'P0002';
  end if;

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
    linked_action_id
  ) values (
    v_event_id,
    v_request_key,
    1,
    v_actor,
    v_message,
    v_sticker_id,
    v_mode,
    case when v_sticker_id is null then 'NOT_REQUESTED' else 'PENDING' end,
    case when v_message is null then 'NOT_REQUESTED' else 'PENDING' end,
    v_linked_action_id
  )
  on conflict (event_id, client_action_id, publication_version) do nothing;

  select *
  into v_job
  from app_modules.liveticker_whatsapp_jobs as job
  where job.event_id = v_event_id
    and job.client_action_id = v_request_key
    and job.publication_version = 1;

  if not found
     or v_job.requested_by <> v_actor
     or v_job.delivery_mode <> v_mode
     or v_job.sticker_id is distinct from v_sticker_id
     or v_job.message is distinct from v_message
     or v_job.linked_action_id is distinct from v_linked_action_id then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_ENQUEUE_CONFLICT' using errcode = '23505';
  end if;

  return jsonb_build_object('delivery', app_private.liveticker_whatsapp_delivery_json(v_job));
end;
$function$;

create function app_private.api_liveticker_whatsapp_delivery_link(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job_id uuid;
  v_action_id text := pg_catalog.btrim(coalesce(p_payload ->> 'actionId', ''));
  v_job app_modules.liveticker_whatsapp_jobs%rowtype;
begin
  perform app_private.liveticker_require_operator();
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['jobId', 'actionId']::text[] <> '{}'::jsonb
     or not (p_payload ?& array['jobId', 'actionId']::text[])
     or pg_catalog.jsonb_typeof(p_payload -> 'jobId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'actionId') <> 'string'
     or (p_payload ->> 'jobId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or v_action_id !~ '^[A-Za-z0-9._:-]{1,100}$' then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_LINK_INVALID' using errcode = '22023';
  end if;
  v_job_id := (p_payload ->> 'jobId')::uuid;

  select * into v_job
  from app_modules.liveticker_whatsapp_jobs as job
  where job.id = v_job_id
  for update;
  if not found or v_job.delivery_mode <> 'STICKER_ONLY' then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_UNKNOWN' using errcode = 'P0002';
  end if;
  if v_job.linked_action_id is not null and v_job.linked_action_id <> v_action_id then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_ALREADY_LINKED' using errcode = '55000';
  end if;
  if not exists (
    select 1
    from app_modules.liveticker_actions as action
    where action.event_id = v_job.event_id
      and action.client_action_id = v_action_id
      and action.is_active
  ) then
    raise exception 'LIVETICKER_WHATSAPP_ACTION_UNKNOWN' using errcode = 'P0002';
  end if;

  update app_modules.liveticker_whatsapp_jobs
  set linked_action_id = v_action_id,
      updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object('delivery', app_private.liveticker_whatsapp_delivery_json(v_job));
end;
$function$;

create function app_private.api_liveticker_whatsapp_deliveries_list(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
begin
  perform app_private.liveticker_require_operator();
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['eventId']::text[] <> '{}'::jsonb
     or not (p_payload ? 'eventId')
     or pg_catalog.jsonb_typeof(p_payload -> 'eventId') <> 'string'
     or (p_payload ->> 'eventId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERIES_LIST_INVALID' using errcode = '22023';
  end if;
  v_event_id := (p_payload ->> 'eventId')::uuid;
  perform app_private.liveticker_assert_supported_game(v_event_id);

  return jsonb_build_object('deliveries', coalesce((
    select jsonb_agg(job.payload order by job.created_at desc, job.id desc)
    from (
      select
        delivery.id,
        delivery.created_at,
        app_private.liveticker_whatsapp_delivery_json(delivery) as payload
      from app_modules.liveticker_whatsapp_jobs as delivery
      where delivery.event_id = v_event_id
      order by delivery.created_at desc, delivery.id desc
      limit 100
    ) as job
  ), '[]'::jsonb));
end;
$function$;

create function app_private.api_liveticker_whatsapp_sticker_metadata_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_sticker_id uuid;
  v_audience text := upper(pg_catalog.btrim(coalesce(p_payload ->> 'audience', '')));
  v_category text := upper(pg_catalog.btrim(coalesce(p_payload ->> 'category', '')));
  v_opponent_team_id_raw text := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'opponentTeamId', '')), '');
  v_opponent_team_id uuid;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['stickerId', 'audience', 'opponentTeamId', 'category']::text[] <> '{}'::jsonb
     or not (p_payload ?& array['stickerId', 'audience', 'category']::text[])
     or pg_catalog.jsonb_typeof(p_payload -> 'stickerId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'audience') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'category') <> 'string'
     or (p_payload ? 'opponentTeamId'
       and p_payload -> 'opponentTeamId' <> 'null'::jsonb
       and pg_catalog.jsonb_typeof(p_payload -> 'opponentTeamId') <> 'string')
     or (p_payload ->> 'stickerId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or (v_opponent_team_id_raw is not null
       and v_opponent_team_id_raw !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
     or v_audience not in ('OUR_TEAM', 'OPPONENT', 'GENERAL')
     or v_category not in ('GOAL', 'AGAINST', 'PENALTY', 'VIDEO_REVIEW', 'GENERAL')
     or (v_audience = 'OPPONENT' and v_opponent_team_id_raw is null)
     or (v_audience <> 'OPPONENT' and v_opponent_team_id_raw is not null) then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_METADATA_INVALID' using errcode = '22023';
  end if;
  v_sticker_id := (p_payload ->> 'stickerId')::uuid;
  v_opponent_team_id := v_opponent_team_id_raw::uuid;

  if v_opponent_team_id is not null and not exists (
    select 1
    from app_modules.liveticker_teams as team
    where team.id = v_opponent_team_id
      and team.is_active
      and not team.is_home_club
  ) then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_OPPONENT_INVALID' using errcode = '22023';
  end if;

  update app_modules.liveticker_whatsapp_stickers
  set audience = v_audience,
      opponent_team_id = v_opponent_team_id,
      category = v_category,
      updated_at = now(),
      updated_by = v_actor
  where id = v_sticker_id;
  if not found then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UNKNOWN' using errcode = 'P0002';
  end if;

  return app_private.api_liveticker_whatsapp_stickers_list(jsonb_build_object('includeInactive', true));
end;
$function$;

create or replace view public.pd_liveticker_whatsapp_jobs_worker
with (security_invoker = true)
as
select
  id,
  event_id,
  client_action_id,
  publication_version,
  requested_by,
  message,
  status,
  attempt_count,
  next_attempt_at,
  claimed_at,
  worker_received_at,
  waha_sent_at,
  completed_at,
  waha_message_id,
  last_error,
  created_at,
  updated_at,
  sticker_id,
  delivery_mode,
  sticker_status,
  text_status,
  sticker_waha_message_id,
  sticker_sent_at,
  text_waha_message_id,
  text_sent_at,
  linked_action_id
from app_modules.liveticker_whatsapp_jobs;

revoke all on table public.pd_liveticker_whatsapp_jobs_worker
  from public, anon, authenticated, service_role;
grant select, update on table public.pd_liveticker_whatsapp_jobs_worker to service_role;

create or replace function public.pd_public_liveticker_sync(
  p_event_id uuid,
  p_expected_revision integer,
  p_changes jsonb,
  p_client_id text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_changes jsonb := p_changes;
  v_clean_upserts jsonb := '[]'::jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_item jsonb;
  v_candidate jsonb;
  v_marker jsonb;
  v_action_id text;
  v_message text;
  v_sticker_id uuid;
  v_result jsonb;
  v_actor uuid;
  v_exists boolean;
begin
  if p_changes is not null
     and jsonb_typeof(p_changes) = 'object'
     and p_changes ? 'upserts'
     and jsonb_typeof(p_changes -> 'upserts') = 'array' then
    for v_item in select value from jsonb_array_elements(p_changes -> 'upserts')
    loop
      if jsonb_typeof(v_item) = 'object' and v_item ? '_whatsapp' then
        v_marker := v_item -> '_whatsapp';
        v_sticker_id := null;
        if jsonb_typeof(v_marker) <> 'object'
           or v_marker - array['publish', 'text', 'stickerId'] <> '{}'::jsonb
           or jsonb_typeof(v_marker -> 'publish') <> 'boolean' then
          raise exception 'LIVETICKER_INVALID_WHATSAPP_PUBLISH' using errcode = '22023';
        end if;
        if (v_marker ->> 'publish')::boolean then
          if jsonb_typeof(v_marker -> 'text') <> 'string' then
            raise exception 'LIVETICKER_INVALID_WHATSAPP_TEXT' using errcode = '22023';
          end if;
          v_message := v_marker ->> 'text';
          if char_length(btrim(v_message)) not between 1 and 4000 then
            raise exception 'LIVETICKER_INVALID_WHATSAPP_TEXT' using errcode = '22023';
          end if;
          if v_marker ? 'stickerId' then
            if jsonb_typeof(v_marker -> 'stickerId') <> 'string'
               or (v_marker ->> 'stickerId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
              raise exception 'LIVETICKER_INVALID_WHATSAPP_STICKER' using errcode = '22023';
            end if;
            v_sticker_id := (v_marker ->> 'stickerId')::uuid;
            if not exists (
              select 1 from app_modules.liveticker_whatsapp_stickers as sticker
              where sticker.id = v_sticker_id and sticker.active
            ) then
              raise exception 'LIVETICKER_UNKNOWN_WHATSAPP_STICKER' using errcode = '22023';
            end if;
          end if;
          if jsonb_typeof(v_item -> 'id') = 'string' then
            v_action_id := v_item ->> 'id';
            select exists (
              select 1 from app_modules.liveticker_actions as action
              where action.event_id = p_event_id and action.client_action_id = v_action_id
            ) into v_exists;
            if not v_exists then
              v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
                'actionId', v_action_id,
                'message', v_message,
                'stickerId', v_sticker_id
              ));
            end if;
          end if;
        end if;
      end if;
      if jsonb_typeof(v_item) = 'object' then
        v_clean_upserts := v_clean_upserts || jsonb_build_array(v_item - '_whatsapp');
      else
        v_clean_upserts := v_clean_upserts || jsonb_build_array(v_item);
      end if;
    end loop;
    v_changes := jsonb_set(p_changes, '{upserts}', v_clean_upserts, false);
  end if;
  if jsonb_array_length(v_candidates) > 0 then
    v_actor := app_private.liveticker_require_operator();
  end if;
  v_result := public.pd_public_liveticker_sync_before_whatsapp_channel_r1(
    p_event_id, p_expected_revision, v_changes, p_client_id
  );
  if jsonb_array_length(v_candidates) > 0 then
    for v_candidate in select value from jsonb_array_elements(v_candidates)
    loop
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
        linked_action_id
      ) values (
        p_event_id,
        v_candidate ->> 'actionId',
        1,
        v_actor,
        v_candidate ->> 'message',
        nullif(v_candidate ->> 'stickerId', '')::uuid,
        case when nullif(v_candidate ->> 'stickerId', '') is null then 'TEXT_ONLY' else 'STICKER_THEN_TEXT' end,
        case when nullif(v_candidate ->> 'stickerId', '') is null then 'NOT_REQUESTED' else 'PENDING' end,
        'PENDING',
        v_candidate ->> 'actionId'
      )
      on conflict (event_id, client_action_id, publication_version) do nothing;
    end loop;
  end if;
  return v_result;
end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_liveticker_whatsapp_delivery_components_r1;

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
    when 'liveticker_whatsapp_delivery_enqueue' then
      return app_private.api_liveticker_whatsapp_delivery_enqueue(coalesce(p_payload, '{}'::jsonb));
    when 'liveticker_whatsapp_sticker_enqueue' then
      return app_private.api_liveticker_whatsapp_sticker_enqueue(coalesce(p_payload, '{}'::jsonb));
    when 'liveticker_whatsapp_delivery_link' then
      return app_private.api_liveticker_whatsapp_delivery_link(coalesce(p_payload, '{}'::jsonb));
    when 'liveticker_whatsapp_deliveries_list' then
      return app_private.api_liveticker_whatsapp_deliveries_list(coalesce(p_payload, '{}'::jsonb));
    when 'liveticker_whatsapp_sticker_metadata_set' then
      return app_private.api_liveticker_whatsapp_sticker_metadata_set(coalesce(p_payload, '{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_liveticker_whatsapp_delivery_components_r1(p_action, p_payload);
  end case;
end;
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_liveticker_whatsapp_delivery_components_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'liveticker_whatsapp_delivery_enqueue' then 'USER_MUTATION'
    when 'liveticker_whatsapp_sticker_enqueue' then 'USER_MUTATION'
    when 'liveticker_whatsapp_delivery_link' then 'USER_MUTATION'
    when 'liveticker_whatsapp_deliveries_list' then 'READ'
    when 'liveticker_whatsapp_sticker_metadata_set' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_liveticker_whatsapp_delivery_components_r1(p_action)
  end;
$function$;

revoke all on function app_private.liveticker_whatsapp_delivery_json(app_modules.liveticker_whatsapp_jobs),
  app_private.api_liveticker_whatsapp_delivery_enqueue(jsonb),
  app_private.api_liveticker_whatsapp_sticker_enqueue(jsonb),
  app_private.api_liveticker_whatsapp_delivery_link(jsonb),
  app_private.api_liveticker_whatsapp_deliveries_list(jsonb),
  app_private.api_liveticker_whatsapp_sticker_metadata_set(jsonb),
  app_private.pd_api_dispatch_current_before_liveticker_whatsapp_delivery_components_r1(text, jsonb),
  app_private.platform_action_classification_before_liveticker_whatsapp_delivery_components_r1(text)
from public, anon, authenticated, service_role;

commit;
