-- DEV only. Port the existing Portal-1.0 multichannel contract, including
-- immutable per-target snapshots. No old jobs are backfilled or sent.
-- Existing TEST/MAIN IDs are server-side configuration, never browser payloads.
begin;
do $dev_only$ begin
 if app_private.platform_release_environment()='PROD' then
  raise exception 'DEV_ONLY_MIGRATION' using errcode='55000';
 end if;
end $dev_only$;


create table app_private.liveticker_whatsapp_channels (
  code text primary key,
  label text not null,
  waha_channel_id text,
  enabled boolean not null default true,
  sort_order integer not null default 100,
  send_approved boolean not null default false,
  updated_at timestamptz not null default statement_timestamp(),
  updated_by uuid,
  revision bigint not null default 1,
  constraint liveticker_whatsapp_channels_code_check
    check (code ~ '^[A-Z0-9_]{2,32}$'),
  constraint liveticker_whatsapp_channels_label_check
    check (char_length(btrim(label)) between 1 and 80),
  constraint liveticker_whatsapp_channels_id_check
    check (waha_channel_id is null or (
      char_length(waha_channel_id) between 12 and 160
      and waha_channel_id ~ '^[0-9]+@newsletter$'
    )),
  constraint liveticker_whatsapp_channels_sort_check
    check (sort_order between 0 and 9999),
  constraint liveticker_whatsapp_channels_revision_check
    check (revision >= 1)
);

revoke all on table app_private.liveticker_whatsapp_channels
  from public, anon, authenticated, service_role;

-- Existing Portal-1.0 configuration copied read-only; no DEV send approval.
insert into app_private.liveticker_whatsapp_channels(code,label,waha_channel_id,enabled,sort_order)
values
 ('TEST','Testkanal','120363407159499081@newsletter',true,10),
 ('MAIN','Hauptkanal','120363419694534195@newsletter',true,20);

create table app_private.liveticker_whatsapp_routing_control (
  singleton boolean primary key default true check (singleton),
  mode text not null default 'TEST',
  updated_at timestamptz not null default statement_timestamp(),
  updated_by uuid,
  revision bigint not null default 1,
  constraint liveticker_whatsapp_routing_mode_check
    check (mode in ('TEST', 'MAIN', 'BOTH')),
  constraint liveticker_whatsapp_routing_revision_check
    check (revision >= 1)
);

revoke all on table app_private.liveticker_whatsapp_routing_control
  from public, anon, authenticated, service_role;

insert into app_private.liveticker_whatsapp_routing_control(singleton, mode)
values (true, 'TEST');

create table app_modules.liveticker_whatsapp_job_targets (
  id uuid primary key default extensions.gen_random_uuid(),
  job_id uuid not null references app_modules.liveticker_whatsapp_jobs(id) on delete cascade,
  channel_code text not null,
  channel_label text not null,
  waha_channel_id text not null,
  status text not null default 'PENDING',
  attempt_count integer not null default 0,
  claimed_at timestamptz,
  worker_received_at timestamptz,
  completed_at timestamptz,
  last_error text,
  sticker_status text not null,
  text_status text not null,
  sticker_waha_message_id text,
  sticker_sent_at timestamptz,
  text_waha_message_id text,
  text_sent_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint liveticker_whatsapp_job_targets_unique unique(job_id, channel_code),
  constraint liveticker_whatsapp_job_targets_code_check
    check (channel_code ~ '^[A-Z0-9_]{2,32}$'),
  constraint liveticker_whatsapp_job_targets_label_check
    check (char_length(btrim(channel_label)) between 1 and 80),
  constraint liveticker_whatsapp_job_targets_channel_id_check
    check (
      char_length(waha_channel_id) between 12 and 160
      and waha_channel_id ~ '^[0-9]+@newsletter$'
    ),
  constraint liveticker_whatsapp_job_targets_status_check
    check (status in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  constraint liveticker_whatsapp_job_targets_attempt_check
    check (attempt_count between 0 and 5),
  constraint liveticker_whatsapp_job_targets_component_status_check
    check (
      sticker_status in ('NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED')
      and text_status in ('NOT_REQUESTED', 'PENDING', 'SENT', 'FAILED')
    ),
  constraint liveticker_whatsapp_job_targets_sticker_result_check
    check (
      (sticker_status = 'SENT' and sticker_sent_at is not null)
      or
      (sticker_status <> 'SENT' and sticker_sent_at is null and sticker_waha_message_id is null)
    ),
  constraint liveticker_whatsapp_job_targets_text_result_check
    check (
      (text_status = 'SENT' and text_sent_at is not null)
      or
      (text_status <> 'SENT' and text_sent_at is null and text_waha_message_id is null)
    ),
  constraint liveticker_whatsapp_job_targets_success_check
    check (
      status <> 'SUCCEEDED'
      or (
        sticker_status in ('NOT_REQUESTED', 'SENT')
        and text_status in ('NOT_REQUESTED', 'SENT')
      )
    ),
  constraint liveticker_whatsapp_job_targets_error_check
    check (last_error is null or char_length(last_error) <= 1000)
);

create index liveticker_whatsapp_job_targets_claim_idx
  on app_modules.liveticker_whatsapp_job_targets(status, created_at, id)
  where status = 'PENDING';

create index liveticker_whatsapp_job_targets_job_idx
  on app_modules.liveticker_whatsapp_job_targets(job_id, created_at, id);

alter table app_modules.liveticker_whatsapp_job_targets enable row level security;
revoke all on table app_modules.liveticker_whatsapp_job_targets
  from public, anon, authenticated, service_role;
grant select, update on table app_modules.liveticker_whatsapp_job_targets to service_role;

create view public.pd_liveticker_whatsapp_job_targets_worker
with (security_invoker = true)
as
select
  id,
  job_id,
  channel_code,
  channel_label,
  waha_channel_id,
  status,
  attempt_count,
  claimed_at,
  worker_received_at,
  completed_at,
  last_error,
  sticker_status,
  text_status,
  sticker_waha_message_id,
  sticker_sent_at,
  text_waha_message_id,
  text_sent_at,
  created_at,
  updated_at
from app_modules.liveticker_whatsapp_job_targets;

revoke all on table public.pd_liveticker_whatsapp_job_targets_worker
  from public, anon, authenticated, service_role;
grant select, update on table public.pd_liveticker_whatsapp_job_targets_worker to service_role;



alter table app_modules.liveticker_whatsapp_job_targets
  add column if not exists image_status text not null default 'NOT_REQUESTED',
  add column if not exists image_waha_message_id text,
  add column if not exists image_sent_at timestamptz;

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



create or replace view public.pd_liveticker_whatsapp_job_targets_worker
with (security_invoker=true) as
select id,job_id,channel_code,channel_label,waha_channel_id,status,attempt_count,
claimed_at,worker_received_at,completed_at,last_error,sticker_status,text_status,
sticker_waha_message_id,sticker_sent_at,text_waha_message_id,text_sent_at,created_at,updated_at,
image_status,image_waha_message_id,image_sent_at
from app_modules.liveticker_whatsapp_job_targets;
alter table app_private.liveticker_whatsapp_channels enable row level security;
alter table app_private.liveticker_whatsapp_routing_control enable row level security;


create function app_private.liveticker_whatsapp_mode_codes(p_mode text)
returns text[]
language sql
immutable
set search_path = ''
as $function$
  select case pg_catalog.upper(pg_catalog.btrim(coalesce(p_mode, '')))
    when 'TEST' then array['TEST']::text[]
    when 'MAIN' then array['MAIN']::text[]
    when 'BOTH' then array['TEST', 'MAIN']::text[]
    else array[]::text[]
  end;
$function$;

create function app_private.liveticker_whatsapp_routing_status_internal()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'mode', routing.mode,
    'ready', not exists (
      select 1
      from pg_catalog.unnest(app_private.liveticker_whatsapp_mode_codes(routing.mode)) as selected(code)
      left join app_private.liveticker_whatsapp_channels as channel on channel.code = selected.code
      where channel.code is null
         or not channel.enabled
         or channel.waha_channel_id is null
    ),
    'deliveryApproved', not exists (select 1 from pg_catalog.unnest(app_private.liveticker_whatsapp_mode_codes(routing.mode)) selected(code) left join app_private.liveticker_whatsapp_channels channel on channel.code=selected.code where channel.code is null or not channel.send_approved),
    'channels', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'code', channel.code,
          'label', channel.label,
          'configured', channel.waha_channel_id is not null,
          'enabled', channel.enabled,
          'deliveryApproved',channel.send_approved
        )
        order by channel.sort_order, channel.code
      )
      from app_private.liveticker_whatsapp_channels as channel
    ), '[]'::jsonb),
    'updatedAt', routing.updated_at,
    'revision', routing.revision
  )
  from app_private.liveticker_whatsapp_routing_control as routing
  where routing.singleton = true;
$function$;

create function app_private.api_liveticker_whatsapp_routing_status(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform app_private.liveticker_require_operator();
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload <> '{}'::jsonb then
    raise exception 'LIVETICKER_WHATSAPP_ROUTING_STATUS_INVALID' using errcode = '22023';
  end if;
  return app_private.liveticker_whatsapp_routing_status_internal();
end;
$function$;

create function app_private.api_liveticker_whatsapp_routing_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_mode text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_payload ->> 'mode', '')));
  v_codes text[];
  v_before app_private.liveticker_whatsapp_routing_control%rowtype;
  v_after app_private.liveticker_whatsapp_routing_control%rowtype;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['mode']::text[] <> '{}'::jsonb
     or pg_catalog.jsonb_typeof(p_payload -> 'mode') <> 'string'
     or v_mode not in ('TEST', 'MAIN', 'BOTH') then
    raise exception 'LIVETICKER_WHATSAPP_ROUTING_SET_INVALID' using errcode = '22023';
  end if;

  v_actor := app_private.liveticker_require_operator();
  v_codes := app_private.liveticker_whatsapp_mode_codes(v_mode);

  if exists (
    select 1
    from pg_catalog.unnest(v_codes) as selected(code)
    left join app_private.liveticker_whatsapp_channels as channel on channel.code = selected.code
    where channel.code is null
       or not channel.enabled
       or channel.waha_channel_id is null
  ) then
    raise exception 'LIVETICKER_WHATSAPP_CHANNEL_NOT_CONFIGURED' using errcode = '55000';
  end if;

  select * into v_before
  from app_private.liveticker_whatsapp_routing_control
  where singleton = true
  for update;

  if v_before.mode is distinct from v_mode then
    update app_private.liveticker_whatsapp_routing_control
    set mode = v_mode,
        updated_at = statement_timestamp(),
        updated_by = v_actor,
        revision = revision + 1
    where singleton = true
    returning * into v_after;

    perform app_private.log_audit(
      v_actor,
      'LIVETICKER_WHATSAPP_ROUTING_CHANGED',
      'liveticker_whatsapp_routing_control',
      'ROUTING',
      pg_catalog.jsonb_build_object('mode', v_before.mode, 'revision', v_before.revision),
      pg_catalog.jsonb_build_object('mode', v_after.mode, 'revision', v_after.revision),
      pg_catalog.jsonb_build_object('source', 'portal')
    );
  end if;

  return app_private.liveticker_whatsapp_routing_status_internal();
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

create function app_private.liveticker_whatsapp_job_target_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.liveticker_whatsapp_recompute_job(new.job_id);
  return new;
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
      and waha_channel_id is not null
      and send_approved;

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

create trigger liveticker_whatsapp_job_target_changed
after insert or update on app_modules.liveticker_whatsapp_job_targets
for each row execute function app_private.liveticker_whatsapp_job_target_changed();
create trigger liveticker_whatsapp_job_snapshot_targets
after insert on app_modules.liveticker_whatsapp_jobs
for each row execute function app_private.liveticker_whatsapp_job_snapshot_targets();

create function app_private.liveticker_whatsapp_target_send_allowed(p_target_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
 select app_private.platform_release_environment()='DEV' and exists(
  select 1 from app_modules.liveticker_whatsapp_job_targets t
  join app_private.liveticker_whatsapp_channels c on c.code=t.channel_code
   and c.waha_channel_id=t.waha_channel_id
  where t.id=p_target_id and c.enabled and c.send_approved
 );
$function$;
create function public.pd_liveticker_whatsapp_target_send_allowed(p_target_id uuid)
returns boolean language sql stable security definer set search_path='' as $function$
 select app_private.liveticker_whatsapp_target_send_allowed(p_target_id);
$function$;
revoke all on function public.pd_liveticker_whatsapp_target_send_allowed(uuid) from public,anon,authenticated,service_role;
grant execute on function public.pd_liveticker_whatsapp_target_send_allowed(uuid) to service_role;

create function app_private.liveticker_whatsapp_target_immutable()
returns trigger language plpgsql set search_path='' as $function$
begin
 if (new.id,new.job_id,new.channel_code,new.channel_label,new.waha_channel_id)
    is distinct from (old.id,old.job_id,old.channel_code,old.channel_label,old.waha_channel_id) then
  raise exception 'LIVETICKER_WHATSAPP_TARGET_IMMUTABLE' using errcode='22023';
 end if;
 return new;
end;
$function$;
create trigger liveticker_whatsapp_target_immutable before update on app_modules.liveticker_whatsapp_job_targets
for each row execute function app_private.liveticker_whatsapp_target_immutable();

alter function app_private.liveticker_whatsapp_transport_assert_ready()
rename to liveticker_whatsapp_transport_assert_ready_before_dev_channels;
create function app_private.liveticker_whatsapp_transport_assert_ready()
returns void language plpgsql stable security definer set search_path='' as $function$
declare v_routing jsonb;
begin
 perform app_private.liveticker_whatsapp_transport_assert_ready_before_dev_channels();
 v_routing:=app_private.liveticker_whatsapp_routing_status_internal();
 if (v_routing->>'ready')::boolean is distinct from true then
  raise exception 'LIVETICKER_WHATSAPP_CHANNEL_NOT_CONFIGURED' using errcode='55000';
 end if;
 if (v_routing->>'deliveryApproved')::boolean is distinct from true then
  raise exception 'LIVETICKER_WHATSAPP_DEV_SEND_NOT_APPROVED' using errcode='55000';
 end if;
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

  perform app_private.liveticker_whatsapp_transport_assert_ready_before_dev_channels();
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

  if exists(select 1 from app_modules.liveticker_whatsapp_job_targets t
    where t.job_id=v_job_id and t.status='FAILED' and t.last_error like 'DELIVERY_OUTCOME_UNKNOWN:%') then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERY_ACK_REQUIRED' using errcode='55000';
  end if;

  if exists(select 1 from app_modules.liveticker_whatsapp_job_targets t
    where t.job_id=v_job_id and t.status='FAILED'
      and not app_private.liveticker_whatsapp_target_send_allowed(t.id)) then
    raise exception 'LIVETICKER_WHATSAPP_DEV_SEND_NOT_APPROVED' using errcode='55000';
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

create function app_private.liveticker_whatsapp_public_error(p_error text)
returns text language sql immutable set search_path='' as $function$
 select case when p_error is null then null
  when p_error like 'DELIVERY_OUTCOME_UNKNOWN:%' then 'DELIVERY_OUTCOME_UNKNOWN'
  else 'WHATSAPP_SEND_FAILED' end;
$function$;
revoke all on function app_private.liveticker_whatsapp_public_error(text) from public,anon,authenticated,service_role;

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
    'updatedAt', p_job.updated_at,
    'error',app_private.liveticker_whatsapp_public_error(p_job.last_error),
    'targets',coalesce((select jsonb_agg(jsonb_build_object(
      'id',t.id,'code',t.channel_code,'label',t.channel_label,'status',t.status,
      'attemptCount',t.attempt_count,'stickerStatus',t.sticker_status,
      'textStatus',t.text_status,'imageStatus',t.image_status,'error',app_private.liveticker_whatsapp_public_error(t.last_error),
      'stickerMessageRecorded',t.sticker_waha_message_id is not null,'textMessageRecorded',t.text_waha_message_id is not null,
      'imageMessageRecorded',t.image_waha_message_id is not null,
      'stickerSentAt',t.sticker_sent_at,'textSentAt',t.text_sent_at,'imageSentAt',t.image_sent_at,
      'ackStatus','NOT_CONFIRMED'
    ) order by t.channel_code) from app_modules.liveticker_whatsapp_job_targets t
    where t.job_id=p_job.id),'[]'::jsonb)
  );
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb) rename to pd_api_dispatch_before_dev_channels;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $function$
begin
 case p_action
  when 'liveticker_whatsapp_routing_status' then return app_private.api_liveticker_whatsapp_routing_status(p_payload);
  when 'liveticker_whatsapp_routing_set' then return app_private.api_liveticker_whatsapp_routing_set(p_payload);
  else return app_private.pd_api_dispatch_before_dev_channels(p_action,p_payload);
 end case;
end;
$function$;
alter function app_private.platform_action_classification(text) rename to platform_action_classification_before_dev_channels;
create function app_private.platform_action_classification(p_action text)
returns text language plpgsql stable security definer set search_path='' as $function$
begin
 if p_action='liveticker_whatsapp_routing_status' then return 'READ'; end if;
 if p_action='liveticker_whatsapp_routing_set' then return 'USER_MUTATION'; end if;
 return app_private.platform_action_classification_before_dev_channels(p_action);
end;
$function$;

revoke all on function app_private.liveticker_whatsapp_mode_codes(text) from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_whatsapp_routing_status_internal() from public,anon,authenticated,service_role;
revoke all on function app_private.api_liveticker_whatsapp_routing_status(jsonb) from public,anon,authenticated,service_role;
revoke all on function app_private.api_liveticker_whatsapp_routing_set(jsonb) from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_whatsapp_recompute_job(uuid) from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_whatsapp_job_target_changed() from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_whatsapp_job_snapshot_targets() from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_whatsapp_target_send_allowed(uuid) from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_whatsapp_target_immutable() from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_whatsapp_transport_assert_ready() from public,anon,authenticated,service_role;
revoke all on function app_private.api_liveticker_whatsapp_delivery_retry(jsonb) from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_whatsapp_delivery_json(app_modules.liveticker_whatsapp_jobs) from public,anon,authenticated,service_role;
revoke all on function app_private.pd_api_dispatch_current(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function app_private.platform_action_classification(text) from public,anon,authenticated,service_role;

create or replace function app_private.liveticker_whatsapp_fail_pending(p_reason text)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_count integer;
begin
 if app_private.platform_release_environment() is distinct from 'DEV' then return 0; end if;
 update app_modules.liveticker_whatsapp_job_targets set
  status='FAILED',completed_at=statement_timestamp(),updated_at=statement_timestamp(),
  last_error=left(coalesce(nullif(btrim(p_reason),''),'WHATSAPP_RUNTIME_UNAVAILABLE'),1000),
  sticker_status=case when sticker_status='PENDING' then 'FAILED' else sticker_status end,
  text_status=case when text_status='PENDING' then 'FAILED' else text_status end,
  image_status=case when image_status='PENDING' then 'FAILED' else image_status end
 where status='PENDING';
 get diagnostics v_count=row_count;
 return v_count;
end;
$function$;
revoke all on function app_private.liveticker_whatsapp_fail_pending(text) from public,anon,authenticated,service_role;

commit;
