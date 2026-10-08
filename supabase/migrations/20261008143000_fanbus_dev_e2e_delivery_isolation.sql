-- Fanbus Phase 4 / Slice 6: server-side DEV E2E delivery isolation.
-- Operational activation is deliberately separate from this migration and is
-- postgres-only. Applying the schema does not open an E2E run.

begin;

create table app_private.dev_e2e_delivery_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid not null,
  environment text not null,
  project_ref text not null,
  reason text not null,
  starts_at timestamptz not null default pg_catalog.clock_timestamp(),
  expires_at timestamptz not null,
  closed_at timestamptz null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  created_by text not null default session_user,
  constraint dev_e2e_delivery_runs_actor_check check (
    actor_user_id = '00000000-0000-4555-8555-000000000042'::uuid
  ),
  constraint dev_e2e_delivery_runs_environment_check check (environment = 'DEV'),
  constraint dev_e2e_delivery_runs_project_check check (project_ref = 'tpieykhhawszlzsoflnl'),
  constraint dev_e2e_delivery_runs_reason_check check (
    pg_catalog.length(pg_catalog.btrim(reason)) between 8 and 500
  ),
  constraint dev_e2e_delivery_runs_window_check check (
    expires_at > starts_at
    and expires_at <= starts_at + interval '2 hours'
  ),
  constraint dev_e2e_delivery_runs_closed_check check (
    closed_at is null or closed_at >= starts_at
  )
);

create unique index dev_e2e_delivery_runs_one_open_actor_idx
  on app_private.dev_e2e_delivery_runs(actor_user_id)
  where closed_at is null;

alter table app_private.dev_e2e_delivery_runs enable row level security;
alter table app_private.dev_e2e_delivery_runs force row level security;
revoke all on app_private.dev_e2e_delivery_runs
  from public, anon, authenticated, service_role;

create function app_private.dev_e2e_delivery_run_open(
  p_actor_user_id uuid,
  p_duration interval,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_dispatch_url text;
  v_run_id uuid;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_actor_user_id is distinct from '00000000-0000-4555-8555-000000000042'::uuid then
    raise exception 'DEV_E2E_ACTOR_INVALID' using errcode = '22023';
  end if;

  if p_duration is null
     or p_duration < interval '1 minute'
     or p_duration > interval '2 hours' then
    raise exception 'DEV_E2E_DURATION_INVALID' using errcode = '22023';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason, ''))) not between 8 and 500 then
    raise exception 'DEV_E2E_REASON_INVALID' using errcode = '22023';
  end if;

  select secret.decrypted_secret
  into v_dispatch_url
  from vault.decrypted_secrets as secret
  where secret.name = 'pd_notification_dispatch_url'
  limit 1;

  if v_dispatch_url is distinct from
     'https://tpieykhhawszlzsoflnl.supabase.co/functions/v1/notification-dispatch' then
    raise exception 'DEV_E2E_ENVIRONMENT_INVALID' using errcode = '55000';
  end if;

  update app_private.dev_e2e_delivery_runs as run
  set closed_at = run.expires_at
  where run.closed_at is null
    and run.expires_at <= v_now;

  if exists (
    select 1
    from app_private.dev_e2e_delivery_runs as run
    where run.actor_user_id = p_actor_user_id
      and run.closed_at is null
  ) then
    raise exception 'DEV_E2E_RUN_ALREADY_OPEN' using errcode = '55000';
  end if;

  insert into app_private.dev_e2e_delivery_runs(
    actor_user_id, environment, project_ref, reason, starts_at, expires_at
  )
  values (
    p_actor_user_id,
    'DEV',
    'tpieykhhawszlzsoflnl',
    pg_catalog.btrim(p_reason),
    v_now,
    v_now + p_duration
  )
  returning id into v_run_id;

  return v_run_id;
end;
$function$;

revoke all on function app_private.dev_e2e_delivery_run_open(uuid, interval, text)
  from public, anon, authenticated, service_role;
grant execute on function app_private.dev_e2e_delivery_run_open(uuid, interval, text)
  to postgres;

create function app_private.dev_e2e_delivery_run_close(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update app_private.dev_e2e_delivery_runs as run
  set closed_at = greatest(
    run.starts_at,
    least(pg_catalog.clock_timestamp(), run.expires_at)
  )
  where run.id = p_run_id
    and run.closed_at is null;

  if not found then
    raise exception 'DEV_E2E_RUN_NOT_OPEN' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function app_private.dev_e2e_delivery_run_close(uuid)
  from public, anon, authenticated, service_role;
grant execute on function app_private.dev_e2e_delivery_run_close(uuid)
  to postgres;

create function app_private.notification_dev_e2e_run_for_actor(
  p_category text,
  p_actor_user_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_claims jsonb := auth.jwt();
  v_run_id uuid;
begin
  if p_category is distinct from 'FANBUS'
     or p_actor_user_id is distinct from '00000000-0000-4555-8555-000000000042'::uuid
     or auth.uid() is distinct from p_actor_user_id
     or coalesce(v_claims ->> 'role', '') <> 'authenticated'
     or coalesce(v_claims ->> 'iss', '') <>
        'https://tpieykhhawszlzsoflnl.supabase.co/auth/v1' then
    return null;
  end if;

  select run.id
  into v_run_id
  from app_private.dev_e2e_delivery_runs as run
  where run.actor_user_id = p_actor_user_id
    and run.environment = 'DEV'
    and run.project_ref = 'tpieykhhawszlzsoflnl'
    and run.closed_at is null
    and run.starts_at <= pg_catalog.statement_timestamp()
    and run.expires_at > pg_catalog.statement_timestamp()
  order by run.starts_at desc
  limit 1;

  return v_run_id;
end;
$function$;

revoke all on function app_private.notification_dev_e2e_run_for_actor(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_dev_e2e_run_for_actor(text, uuid)
  to postgres;

alter table app_private.notification_events
  add column delivery_mode text not null default 'NORMAL',
  add column dev_e2e_run_id uuid null
    references app_private.dev_e2e_delivery_runs(id) on delete restrict,
  add constraint notification_events_delivery_mode_check check (
    (delivery_mode = 'NORMAL' and dev_e2e_run_id is null)
    or (delivery_mode = 'DEV_E2E_ISOLATED' and dev_e2e_run_id is not null)
  );

alter table app_private.notification_outbox
  add column delivery_mode text not null default 'NORMAL',
  add column dev_e2e_run_id uuid null
    references app_private.dev_e2e_delivery_runs(id) on delete restrict,
  add constraint notification_outbox_delivery_mode_check check (
    (delivery_mode = 'NORMAL' and dev_e2e_run_id is null)
    or (delivery_mode = 'DEV_E2E_ISOLATED' and dev_e2e_run_id is not null)
  );

create index notification_events_dev_e2e_run_idx
  on app_private.notification_events(dev_e2e_run_id, created_at)
  where dev_e2e_run_id is not null;

create index notification_outbox_dev_e2e_run_idx
  on app_private.notification_outbox(dev_e2e_run_id, status, created_at)
  where dev_e2e_run_id is not null;

create function app_private.notification_delivery_context_immutable()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.delivery_mode is distinct from old.delivery_mode
     or new.dev_e2e_run_id is distinct from old.dev_e2e_run_id then
    raise exception 'M020_DELIVERY_CONTEXT_IMMUTABLE' using errcode = '55000';
  end if;
  return new;
end;
$function$;

revoke all on function app_private.notification_delivery_context_immutable()
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_delivery_context_immutable()
  to postgres;

create trigger notification_events_delivery_context_immutable
before update of delivery_mode, dev_e2e_run_id
on app_private.notification_events
for each row execute function app_private.notification_delivery_context_immutable();

create trigger notification_outbox_delivery_context_immutable
before update of delivery_mode, dev_e2e_run_id
on app_private.notification_outbox
for each row execute function app_private.notification_delivery_context_immutable();

create function app_private.notification_outbox_inherit_delivery_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  select event.delivery_mode, event.dev_e2e_run_id
  into new.delivery_mode, new.dev_e2e_run_id
  from app_private.notification_events as event
  where event.id = new.event_id;

  if not found then
    raise exception 'M020_NOTIFICATION_EVENT_NOT_FOUND' using errcode = '23503';
  end if;

  return new;
end;
$function$;

revoke all on function app_private.notification_outbox_inherit_delivery_context()
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_outbox_inherit_delivery_context()
  to postgres;

create trigger notification_outbox_inherit_delivery_context
before insert on app_private.notification_outbox
for each row execute function app_private.notification_outbox_inherit_delivery_context();

create or replace function app_private.notification_event_enqueue(
  p_notification_type text,
  p_category text,
  p_event_key text,
  p_source_module text,
  p_entity_type text,
  p_entity_id text,
  p_actor_user_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_run_id uuid;
begin
  if coalesce(pg_catalog.btrim(p_notification_type), '') = ''
     or coalesce(pg_catalog.btrim(p_event_key), '') = ''
     or coalesce(pg_catalog.btrim(p_source_module), '') = ''
     or coalesce(pg_catalog.btrim(p_entity_type), '') = ''
     or coalesce(pg_catalog.btrim(p_entity_id), '') = '' then
    raise exception 'M020_NOTIFICATION_EVENT_INVALID' using errcode = '22023';
  end if;

  if p_category not in ('ACCOUNT_MEMBERSHIP','FANBUS','DATES','TASKS') then
    raise exception 'M020_NOTIFICATION_CATEGORY_INVALID' using errcode = '22023';
  end if;

  v_run_id := app_private.notification_dev_e2e_run_for_actor(
    p_category,
    p_actor_user_id
  );

  insert into app_private.notification_events(
    notification_type, category, event_key, source_module,
    entity_type, entity_id, actor_user_id, payload, occurred_at,
    delivery_mode, dev_e2e_run_id
  )
  values (
    pg_catalog.btrim(p_notification_type), p_category,
    pg_catalog.btrim(p_event_key), pg_catalog.btrim(p_source_module),
    pg_catalog.btrim(p_entity_type), pg_catalog.btrim(p_entity_id),
    p_actor_user_id, coalesce(p_payload, '{}'::jsonb),
    coalesce(p_occurred_at, pg_catalog.now()),
    case when v_run_id is null then 'NORMAL' else 'DEV_E2E_ISOLATED' end,
    v_run_id
  )
  on conflict (notification_type, event_key)
  do update set updated_at = app_private.notification_events.updated_at
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function app_private.notification_event_enqueue(
  text,text,text,text,text,text,uuid,jsonb,timestamptz
) from public, anon, authenticated, service_role;
grant execute on function app_private.notification_event_enqueue(
  text,text,text,text,text,text,uuid,jsonb,timestamptz
) to postgres;

create or replace function public.pd_notification_claim_batch(
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb;
  r record;
begin
  perform app_private.notification_expand_pending_events(50);

  -- Isolation is terminal and precedes lease recovery, expiry handling and the
  -- candidate query. The persistent marker remains valid after the run closes.
  update app_private.notification_outbox as outbox
  set status = 'SKIPPED',
      sent_at = null,
      provider_message_id = null,
      last_error_code = 'DEV_E2E_DELIVERY_ISOLATED',
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      updated_at = pg_catalog.now()
  where outbox.delivery_mode = 'DEV_E2E_ISOLATED'
    and outbox.status in ('PENDING', 'PROCESSING', 'RETRY');

  update app_private.notification_outbox o
  set status='RETRY', claim_token=null, claimed_at=null, claim_expires_at=null,
      next_attempt_at=now(), last_error_code='CLAIM_EXPIRED', updated_at=now()
  where o.status='PROCESSING'
    and o.claim_expires_at <= now()
    and o.attempt_count < o.max_attempts;

  update app_private.notification_outbox o
  set status='FAILED', claim_token=null, claimed_at=null, claim_expires_at=null,
      last_error_code='MAX_ATTEMPTS_REACHED', updated_at=now()
  where o.status='PROCESSING'
    and o.claim_expires_at <= now()
    and o.attempt_count >= o.max_attempts;

  update app_private.notification_outbox o
  set status='SKIPPED', last_error_code='DELIVERY_EXPIRED', updated_at=now()
  where o.status in ('PENDING','RETRY')
    and o.expires_at <= now();

  update app_private.notification_outbox o
  set status='SKIPPED',last_error_code='PUSH_SUBSCRIPTION_INACTIVE',updated_at=now()
  where o.channel='PUSH'
    and o.status in ('PENDING','RETRY')
    and not exists (
      select 1 from app_portal.push_subscriptions ps
      where ps.id=o.push_subscription_id and ps.is_active=true
    );

  for r in
    select ne.id
    from app_private.notification_events ne
    where ne.status='EXPANDED'
      and exists (
        select 1 from app_private.notification_outbox o where o.event_id=ne.id
      )
      and not exists (
        select 1 from app_private.notification_outbox o
        where o.event_id=ne.id and o.status in ('PENDING','PROCESSING','RETRY')
      )
  loop
    perform app_private.notification_refresh_event_status(r.id);
  end loop;

  with candidates as (
    select o.id
    from app_private.notification_outbox o
    where o.delivery_mode = 'NORMAL'
      and o.status in ('PENDING','RETRY')
      and o.next_attempt_at <= now()
      and o.expires_at > now()
    order by o.created_at,o.id
    for update skip locked
    limit least(greatest(coalesce(p_limit,20),1),50)
  ),
  claimed as (
    update app_private.notification_outbox o
    set status='PROCESSING',
        attempt_count=o.attempt_count+1,
        claim_token=extensions.gen_random_uuid(),
        claimed_at=now(),
        claim_expires_at=now()+interval '10 minutes',
        updated_at=now()
    from candidates c
    where o.id=c.id
    returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'outboxId',c.id,
    'claimToken',c.claim_token,
    'eventId',c.event_id,
    'notificationType',c.notification_type,
    'category',c.category,
    'channel',c.channel,
    'recipientAddress',case when c.channel='EMAIL' then c.recipient_address else null end,
    'push',case when c.channel='PUSH' then (
      select jsonb_build_object(
        'subscriptionId',ps.id,
        'endpoint',ps.endpoint,
        'p256dh',ps.p256dh,
        'auth',ps.auth_key
      )
      from app_portal.push_subscriptions ps
      where ps.id=c.push_subscription_id and ps.is_active=true
    ) else null end,
    'payload',c.payload,
    'deepLink',c.deep_link,
    'attemptCount',c.attempt_count,
    'maxAttempts',c.max_attempts,
    'badgeCount',case
      when c.recipient_user_id is null then 0
      when not coalesce((
        select np.badge_enabled from app_portal.notification_preferences np
        where np.user_id=c.recipient_user_id
      ),true) then 0
      else app_private.notification_unread_count(c.recipient_user_id)
    end,
    'deliveryMode', c.delivery_mode,
    'devE2eRunId', c.dev_e2e_run_id
  ) order by c.created_at,c.id),'[]'::jsonb)
  into v_rows
  from claimed c;

  return v_rows;
end;
$function$;

revoke all on function public.pd_notification_claim_batch(integer)
  from public, anon, authenticated;
grant execute on function public.pd_notification_claim_batch(integer) to service_role;

create or replace function public.pd_notification_complete(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_token uuid;
  v_success boolean;
  v_retryable boolean;
  v_disable_push boolean;
  v_error text;
  v_provider_id text;
  v_retry_after integer;
  v_terminal_status text;
  o app_private.notification_outbox%rowtype;
  v_next timestamptz;
begin
  begin
    v_id := nullif(p_payload->>'outboxId','')::uuid;
    v_token := nullif(p_payload->>'claimToken','')::uuid;
  exception when others then
    raise exception 'M020_COMPLETE_INVALID_ID' using errcode='22023';
  end;

  v_success := coalesce((p_payload->>'success')::boolean,false);
  v_retryable := coalesce((p_payload->>'retryable')::boolean,false);
  v_disable_push := coalesce((p_payload->>'disablePushSubscription')::boolean,false);
  v_error := left(coalesce(p_payload->>'errorCode',''),160);
  v_provider_id := left(coalesce(p_payload->>'providerMessageId',''),300);
  v_terminal_status := upper(left(coalesce(p_payload->>'terminalStatus',''),20));
  begin
    v_retry_after := nullif(p_payload->>'retryAfterSeconds','')::integer;
  exception when others then
    v_retry_after := null;
  end;
  if v_retry_after is not null then
    v_retry_after := least(greatest(v_retry_after,1),43200);
  end if;

  select * into o
  from app_private.notification_outbox x
  where x.id=v_id and x.claim_token=v_token and x.status='PROCESSING'
  for update;

  if not found then
    raise exception 'M020_COMPLETE_CLAIM_NOT_FOUND' using errcode='P0002';
  end if;

  if v_terminal_status <> '' and (
    v_terminal_status <> 'SKIPPED'
    or o.delivery_mode <> 'DEV_E2E_ISOLATED'
    or v_error <> 'DEV_E2E_DELIVERY_ISOLATED'
    or v_success
    or v_retryable
    or v_disable_push
  ) then
    raise exception 'M020_COMPLETE_TERMINAL_INVALID' using errcode='22023';
  end if;

  if v_terminal_status = 'SKIPPED' then
    update app_private.notification_outbox
    set status='SKIPPED',sent_at=null,provider_message_id=null,
        last_error_code='DEV_E2E_DELIVERY_ISOLATED',
        claim_token=null,claimed_at=null,claim_expires_at=null,updated_at=now()
    where id=o.id;
  else
    if v_disable_push and o.push_subscription_id is not null then
      update app_portal.push_subscriptions
      set is_active=false,disabled_at=coalesce(disabled_at,now()),
          failure_count=failure_count+1,updated_at=now()
      where id=o.push_subscription_id;
    end if;

    if v_success then
      update app_private.notification_outbox
      set status='SENT',sent_at=now(),provider_message_id=nullif(v_provider_id,''),
          last_error_code='',claim_token=null,claimed_at=null,claim_expires_at=null,
          updated_at=now()
      where id=o.id;

      if o.push_subscription_id is not null then
        update app_portal.push_subscriptions
        set last_success_at=now(),last_seen_at=now(),failure_count=0,updated_at=now()
        where id=o.push_subscription_id;
      end if;
    elsif v_retryable and o.attempt_count < o.max_attempts and o.expires_at > now() then
      v_next := now() + case
        when v_retry_after is not null then make_interval(secs=>v_retry_after)
        when o.attempt_count=1 then interval '1 minute'
        when o.attempt_count=2 then interval '5 minutes'
        when o.attempt_count=3 then interval '30 minutes'
        when o.attempt_count=4 then interval '2 hours'
        else interval '12 hours'
      end;
      update app_private.notification_outbox
      set status='RETRY',next_attempt_at=v_next,
          last_error_code=coalesce(nullif(v_error,''),'PROVIDER_TEMPORARY'),
          claim_token=null,claimed_at=null,claim_expires_at=null,updated_at=now()
      where id=o.id;

      if o.push_subscription_id is not null then
        update app_portal.push_subscriptions
        set failure_count=failure_count+1,updated_at=now()
        where id=o.push_subscription_id;
      end if;
    else
      update app_private.notification_outbox
      set status='FAILED',
          last_error_code=coalesce(nullif(v_error,''),
            case when o.attempt_count>=o.max_attempts then 'MAX_ATTEMPTS_REACHED' else 'PROVIDER_PERMANENT' end),
          claim_token=null,claimed_at=null,claim_expires_at=null,updated_at=now()
      where id=o.id;

      if o.push_subscription_id is not null then
        update app_portal.push_subscriptions
        set failure_count=failure_count+1,updated_at=now()
        where id=o.push_subscription_id;
      end if;
    end if;
  end if;

  perform app_private.notification_refresh_event_status(o.event_id);

  return jsonb_build_object('ok',true,'status',(
    select status from app_private.notification_outbox where id=o.id
  ));
end;
$function$;

revoke all on function public.pd_notification_complete(jsonb)
  from public, anon, authenticated;
grant execute on function public.pd_notification_complete(jsonb) to service_role;

comment on table app_private.dev_e2e_delivery_runs is
  'Audited, postgres-only DEV Fanbus E2E windows. Rows never redirect delivery; they allow server-authenticated events to be terminally isolated.';
comment on column app_private.notification_events.delivery_mode is
  'Immutable server-derived delivery classification. DEV_E2E_ISOLATED is never provider-deliverable.';
comment on column app_private.notification_outbox.delivery_mode is
  'Immutable copy of the parent event delivery classification.';

commit;
