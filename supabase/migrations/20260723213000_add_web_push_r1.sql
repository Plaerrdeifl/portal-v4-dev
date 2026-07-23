-- Plärrdeifl Portal V4
-- Web Push R1
-- Browser-/PWA-Push für Android, iPhone/iPad Home-Screen-Web-Apps und Desktop.
-- Ausschließlich für Supabase DEV vorgesehen.

do $$
begin
  if to_regclass('app_portal.push_subscriptions') is not null then
    raise exception 'Web Push R1 ist bereits installiert.'
      using errcode = '42P07';
  end if;
end;
$$;

create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

do $$
begin
  if exists (
    select 1
    from pg_available_extensions
    where name = 'pg_cron'
  ) then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
  end if;
end;
$$;

create table app_portal.push_subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null
    references app_portal.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  device_label text not null default '',
  user_agent text not null default '',
  is_active boolean not null default true,
  failure_count integer not null default 0,
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_check
    check (
      length(endpoint) between 20 and 4000
      and endpoint like 'https://%'
    ),
  constraint push_subscriptions_p256dh_check
    check (length(p256dh) between 20 and 500),
  constraint push_subscriptions_auth_check
    check (length(auth_key) between 8 and 500),
  constraint push_subscriptions_device_label_check
    check (length(device_label) <= 160),
  constraint push_subscriptions_user_agent_check
    check (length(user_agent) <= 1000),
  constraint push_subscriptions_failure_count_check
    check (failure_count >= 0)
);

create index push_subscriptions_user_active_idx
  on app_portal.push_subscriptions(user_id, is_active, updated_at desc);

alter table app_portal.push_subscriptions enable row level security;
revoke all on table app_portal.push_subscriptions
  from public, anon, authenticated;

create table app_portal.notification_preferences (
  user_id uuid primary key
    references app_portal.users(id) on delete cascade,
  push_enabled boolean not null default false,
  task_updates boolean not null default true,
  task_status boolean not null default true,
  task_transfers boolean not null default true,
  waiting_deadlines boolean not null default true,
  badge_enabled boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_start time not null default time '22:00',
  quiet_end time not null default time '07:00',
  time_zone text not null default 'Europe/Berlin',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_time_zone_check
    check (length(time_zone) between 1 and 100),
  constraint notification_preferences_revision_check
    check (revision >= 1)
);

alter table app_portal.notification_preferences enable row level security;
revoke all on table app_portal.notification_preferences
  from public, anon, authenticated;

alter table app_portal.notifications
  add column delivery_attempts integer not null default 0;

alter table app_portal.notifications
  drop constraint notifications_push_state_check;

alter table app_portal.notifications
  add constraint notifications_push_state_check
  check (
    push_state in (
      'PENDING',
      'PROCESSING',
      'SENT',
      'FAILED',
      'SKIPPED'
    )
  );

alter table app_portal.notifications
  add constraint notifications_delivery_attempts_check
  check (delivery_attempts >= 0);

insert into app_portal.settings (
  key,
  value,
  description
)
values (
  'web_push',
  jsonb_build_object(
    'publicKey', 'BPDhQ9xrQPMpw339mNOwbJFnRn3maHRxWGvbiBnCCZrBUFrkwugcWKegh5N5zYo2P6bJwS4qrHPTAMjQYw2GqFY',
    'subject', 'https://plaerrdeifl.github.io',
    'version', 'R1'
  ),
  'Öffentliche Web-Push-Konfiguration. Der private VAPID-Schlüssel liegt ausschließlich in den Edge-Function-Secrets.'
)
on conflict (key)
do update set
  value = excluded.value,
  description = excluded.description,
  revision = app_portal.settings.revision + 1,
  updated_at = now();

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'pd_push_dispatch_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'pd_push_dispatch_secret',
      'Interner Schlüssel zwischen Notification-Trigger und Web-Push-Edge-Function.'
    );
  end if;
end;
$$;

create or replace function app_private.push_event_enabled(
  p_user_id uuid,
  p_event_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select
      preference.push_enabled
      and case
        when p_event_type = 'TASK_UPDATE_CREATED'
          then preference.task_updates
        when p_event_type like 'TASK_TRANSFER_%'
          then preference.task_transfers
        when p_event_type like 'TASK_WAITING_DEADLINE_%'
          then preference.waiting_deadlines
        when p_event_type in ('TASK_WAITING', 'TASK_STATUS_CHANGED')
          then preference.task_status
        when p_event_type = 'PUSH_TEST'
          then true
        else true
      end
    from app_portal.notification_preferences as preference
    where preference.user_id = p_user_id
  ), false);
$$;

create or replace function app_private.push_quiet_hours_active(
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
  v_start time;
  v_end time;
  v_zone text;
  v_local_time time;
begin
  select
    preference.quiet_hours_enabled,
    preference.quiet_start,
    preference.quiet_end,
    preference.time_zone
  into
    v_enabled,
    v_start,
    v_end,
    v_zone
  from app_portal.notification_preferences as preference
  where preference.user_id = p_user_id;

  if not coalesce(v_enabled, false) then
    return false;
  end if;

  begin
    v_local_time := (now() at time zone v_zone)::time;
  exception
    when invalid_parameter_value then
      v_local_time := (now() at time zone 'Europe/Berlin')::time;
  end;

  if v_start = v_end then
    return true;
  end if;

  if v_start < v_end then
    return v_local_time >= v_start and v_local_time < v_end;
  end if;

  return v_local_time >= v_start or v_local_time < v_end;
end;
$$;

create or replace function app_private.api_push_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_public_key text;
begin
  insert into app_portal.notification_preferences (user_id)
  values (v_actor)
  on conflict (user_id) do nothing;

  select setting.value ->> 'publicKey'
  into v_public_key
  from app_portal.settings as setting
  where setting.key = 'web_push';

  return jsonb_build_object(
    'supported', true,
    'publicKey', coalesce(v_public_key, ''),
    'activeDeviceCount', (
      select count(*)
      from app_portal.push_subscriptions as subscription
      where subscription.user_id = v_actor
        and subscription.is_active
    ),
    'unreadNotificationCount', (
      select count(*)
      from app_portal.notifications as notification
      where notification.user_id = v_actor
        and notification.read_at is null
    ),
    'preferences', (
      select jsonb_build_object(
        'pushEnabled', preference.push_enabled,
        'taskUpdates', preference.task_updates,
        'taskStatus', preference.task_status,
        'taskTransfers', preference.task_transfers,
        'waitingDeadlines', preference.waiting_deadlines,
        'badgeEnabled', preference.badge_enabled,
        'quietHoursEnabled', preference.quiet_hours_enabled,
        'quietStart', to_char(preference.quiet_start, 'HH24:MI'),
        'quietEnd', to_char(preference.quiet_end, 'HH24:MI'),
        'timeZone', preference.time_zone,
        'revision', preference.revision
      )
      from app_portal.notification_preferences as preference
      where preference.user_id = v_actor
    )
  );
end;
$$;

create or replace function app_private.api_save_push_subscription(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_endpoint text := left(btrim(coalesce(p_payload ->> 'endpoint', '')), 4000);
  v_p256dh text := left(btrim(coalesce(p_payload ->> 'p256dh', '')), 500);
  v_auth text := left(btrim(coalesce(p_payload ->> 'auth', '')), 500);
  v_device_label text := left(btrim(coalesce(p_payload ->> 'deviceLabel', '')), 160);
  v_user_agent text := left(btrim(coalesce(p_payload ->> 'userAgent', '')), 1000);
begin
  if v_endpoint not like 'https://%' then
    raise exception 'Ungültiger Push-Endpunkt.'
      using errcode = '22023';
  end if;

  if length(v_p256dh) < 20 or length(v_auth) < 8 then
    raise exception 'Ungültige Push-Verschlüsselungsschlüssel.'
      using errcode = '22023';
  end if;

  insert into app_portal.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth_key,
    device_label,
    user_agent,
    is_active,
    failure_count,
    last_seen_at,
    disabled_at
  )
  values (
    v_actor,
    v_endpoint,
    v_p256dh,
    v_auth,
    v_device_label,
    v_user_agent,
    true,
    0,
    now(),
    null
  )
  on conflict (endpoint)
  do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth_key = excluded.auth_key,
    device_label = excluded.device_label,
    user_agent = excluded.user_agent,
    is_active = true,
    failure_count = 0,
    last_seen_at = now(),
    disabled_at = null,
    updated_at = now();

  insert into app_portal.notification_preferences (
    user_id,
    push_enabled
  )
  values (v_actor, true)
  on conflict (user_id)
  do update set
    push_enabled = true,
    revision = app_portal.notification_preferences.revision + 1,
    updated_at = now();

  perform app_private.log_audit(
    v_actor,
    'PUSH_SUBSCRIPTION_SAVED',
    'push_subscription',
    md5(v_endpoint),
    null,
    jsonb_build_object(
      'deviceLabel', v_device_label,
      'endpointHash', md5(v_endpoint)
    )
  );

  return app_private.api_push_snapshot();
end;
$$;

create or replace function app_private.api_remove_push_subscription(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_endpoint text := left(btrim(coalesce(p_payload ->> 'endpoint', '')), 4000);
begin
  update app_portal.push_subscriptions
  set is_active = false,
      disabled_at = now(),
      updated_at = now()
  where user_id = v_actor
    and endpoint = v_endpoint;

  if not exists (
    select 1
    from app_portal.push_subscriptions
    where user_id = v_actor
      and is_active
  ) then
    update app_portal.notification_preferences
    set push_enabled = false,
        revision = revision + 1,
        updated_at = now()
    where user_id = v_actor;
  end if;

  perform app_private.log_audit(
    v_actor,
    'PUSH_SUBSCRIPTION_REMOVED',
    'push_subscription',
    md5(v_endpoint),
    null,
    jsonb_build_object('endpointHash', md5(v_endpoint))
  );

  return app_private.api_push_snapshot();
end;
$$;

create or replace function app_private.api_save_notification_preferences(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_existing app_portal.notification_preferences%rowtype;
  v_quiet_start time :=
    coalesce(nullif(p_payload ->> 'quietStart', '')::time, time '22:00');
  v_quiet_end time :=
    coalesce(nullif(p_payload ->> 'quietEnd', '')::time, time '07:00');
  v_time_zone text :=
    left(btrim(coalesce(p_payload ->> 'timeZone', 'Europe/Berlin')), 100);
begin
  insert into app_portal.notification_preferences (user_id)
  values (v_actor)
  on conflict (user_id) do nothing;

  select *
  into v_existing
  from app_portal.notification_preferences
  where user_id = v_actor
  for update;

  if v_expected_revision is null
     or v_expected_revision <> v_existing.revision then
    raise exception
      'Die Benachrichtigungseinstellungen wurden zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  begin
    perform now() at time zone v_time_zone;
  exception
    when invalid_parameter_value then
      raise exception 'Unbekannte Zeitzone.'
        using errcode = '22023';
  end;

  update app_portal.notification_preferences
  set push_enabled =
        coalesce((p_payload ->> 'pushEnabled')::boolean, push_enabled),
      task_updates =
        coalesce((p_payload ->> 'taskUpdates')::boolean, task_updates),
      task_status =
        coalesce((p_payload ->> 'taskStatus')::boolean, task_status),
      task_transfers =
        coalesce((p_payload ->> 'taskTransfers')::boolean, task_transfers),
      waiting_deadlines =
        coalesce((p_payload ->> 'waitingDeadlines')::boolean, waiting_deadlines),
      badge_enabled =
        coalesce((p_payload ->> 'badgeEnabled')::boolean, badge_enabled),
      quiet_hours_enabled =
        coalesce((p_payload ->> 'quietHoursEnabled')::boolean, quiet_hours_enabled),
      quiet_start = v_quiet_start,
      quiet_end = v_quiet_end,
      time_zone = v_time_zone,
      revision = revision + 1,
      updated_at = now()
  where user_id = v_actor;

  perform app_private.log_audit(
    v_actor,
    'NOTIFICATION_PREFERENCES_UPDATED',
    'notification_preferences',
    v_actor::text,
    to_jsonb(v_existing),
    jsonb_build_object(
      'revision', v_existing.revision + 1
    )
  );

  return app_private.api_push_snapshot();
end;
$$;

create or replace function app_private.api_create_push_test()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := extensions.gen_random_uuid();
begin
  if not exists (
    select 1
    from app_portal.push_subscriptions
    where user_id = v_actor
      and is_active
  ) then
    raise exception 'Auf diesem Konto ist noch kein aktives Push-Gerät registriert.'
      using errcode = '23514';
  end if;

  insert into app_portal.notifications (
    user_id,
    event_key,
    event_type,
    title,
    body,
    route,
    entity_type,
    entity_id,
    actor_user_id
  )
  values (
    v_actor,
    'push-test:' || v_id::text,
    'PUSH_TEST',
    'Plärrdeifl Push funktioniert',
    'Diese Testmeldung bestätigt die erfolgreiche Push-Einrichtung.',
    '#/dashboard',
    'push_test',
    v_id::text,
    v_actor
  );

  return jsonb_build_object('queued', true);
end;
$$;

alter function app_private.api_task_history_snapshot(uuid)
  rename to api_task_history_snapshot_before_web_push_r1;

create or replace function app_private.api_task_history_snapshot(
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_result jsonb;
begin
  v_result :=
    app_private.api_task_history_snapshot_before_web_push_r1(p_task_id);

  update app_portal.notifications
  set read_at = coalesce(read_at, now())
  where user_id = v_actor
    and entity_type = 'task'
    and entity_id = p_task_id::text
    and read_at is null;

  return v_result;
end;
$$;

create or replace function app_private.queue_waiting_deadline_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task app_modules.tasks%rowtype;
  v_count integer := 0;
  v_key text;
begin
  for v_task in
    select *
    from app_modules.tasks
    where status = 'WAITING'
      and waiting_deadline is not null
      and waiting_deadline <= now() + interval '24 hours'
  loop
    if v_task.waiting_deadline <= now() then
      v_key :=
        'task-waiting-overdue:'
        || v_task.id::text
        || ':'
        || extract(epoch from v_task.waiting_deadline)::bigint::text;

      v_count := v_count + app_private.task_notification_queue(
        v_task.id,
        null,
        'TASK_WAITING_DEADLINE_OVERDUE',
        'Wartefrist überschritten',
        v_task.title || ': Die Wartefrist ist überschritten.',
        v_key
      );
    else
      v_key :=
        'task-waiting-soon:'
        || v_task.id::text
        || ':'
        || extract(epoch from v_task.waiting_deadline)::bigint::text;

      v_count := v_count + app_private.task_notification_queue(
        v_task.id,
        null,
        'TASK_WAITING_DEADLINE_SOON',
        'Wartefrist läuft bald ab',
        v_task.title || ': Die Wartefrist endet innerhalb der nächsten 24 Stunden.',
        v_key
      );
    end if;
  end loop;

  return v_count;
end;
$$;

create or replace function public.pd_push_validate_dispatch_secret(
  p_candidate text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    encode(
      extensions.digest(coalesce(p_candidate, ''), 'sha256'),
      'hex'
    ) = encode(
      extensions.digest(secret.decrypted_secret, 'sha256'),
      'hex'
    ),
    false
  )
  from vault.decrypted_secrets as secret
  where secret.name = 'pd_push_dispatch_secret'
  limit 1;
$$;

create or replace function public.pd_push_claim_batch(
  p_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification app_portal.notifications%rowtype;
  v_subscriptions jsonb;
  v_items jsonb := '[]'::jsonb;
  v_badge_count integer;
begin
  update app_portal.notifications as notification
  set push_state = 'SKIPPED',
      push_attempted_at = now(),
      push_error = 'Push ist deaktiviert oder diese Meldungsart wurde abgewählt.'
  where notification.push_state = 'PENDING'
    and not app_private.push_event_enabled(
      notification.user_id,
      notification.event_type
    );

  for v_notification in
    select notification.*
    from app_portal.notifications as notification
    where (
      notification.push_state = 'PENDING'
      or (
        notification.push_state = 'PROCESSING'
        and notification.push_attempted_at < now() - interval '5 minutes'
      )
    )
      and app_private.push_event_enabled(
        notification.user_id,
        notification.event_type
      )
      and not app_private.push_quiet_hours_active(notification.user_id)
    order by notification.created_at, notification.id
    limit greatest(1, least(coalesce(p_limit, 25), 100))
    for update skip locked
  loop
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', subscription.id,
      'endpoint', subscription.endpoint,
      'keys', jsonb_build_object(
        'p256dh', subscription.p256dh,
        'auth', subscription.auth_key
      )
    ) order by subscription.created_at), '[]'::jsonb)
    into v_subscriptions
    from app_portal.push_subscriptions as subscription
    where subscription.user_id = v_notification.user_id
      and subscription.is_active;

    if jsonb_array_length(v_subscriptions) = 0 then
      update app_portal.notifications
      set push_state = 'SKIPPED',
          push_attempted_at = now(),
          push_error = 'Kein aktives Push-Gerät vorhanden.'
      where id = v_notification.id;

      continue;
    end if;

    update app_portal.notifications
    set push_state = 'PROCESSING',
        push_attempted_at = now(),
        push_error = '',
        delivery_attempts = delivery_attempts + 1
    where id = v_notification.id;

    select count(*)
    into v_badge_count
    from app_portal.notifications as unread
    where unread.user_id = v_notification.user_id
      and unread.read_at is null;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'notificationId', v_notification.id,
      'title', v_notification.title,
      'body', v_notification.body,
      'route', v_notification.route,
      'eventType', v_notification.event_type,
      'badgeCount', v_badge_count,
      'deliveryAttempts', v_notification.delivery_attempts + 1,
      'subscriptions', v_subscriptions
    ));
  end loop;

  return v_items;
end;
$$;

create or replace function public.pd_push_complete(
  p_payload jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_notification_id uuid :=
    nullif(p_payload ->> 'notificationId', '')::uuid;
  v_success_count integer :=
    greatest(coalesce((p_payload ->> 'successCount')::integer, 0), 0);
  v_failure_count integer :=
    greatest(coalesce((p_payload ->> 'failureCount')::integer, 0), 0);
  v_retryable boolean :=
    coalesce((p_payload ->> 'retryable')::boolean, false);
  v_error text :=
    left(btrim(coalesce(p_payload ->> 'error', '')), 2000);
  v_success_ids uuid[] := array(
    select value::uuid
    from jsonb_array_elements_text(
      coalesce(p_payload -> 'successSubscriptionIds', '[]'::jsonb)
    )
  );
  v_disabled_ids uuid[] := array(
    select value::uuid
    from jsonb_array_elements_text(
      coalesce(p_payload -> 'disabledSubscriptionIds', '[]'::jsonb)
    )
  );
  v_attempts integer;
begin
  select notification.delivery_attempts
  into v_attempts
  from app_portal.notifications as notification
  where notification.id = v_notification_id
  for update;

  if not found then
    return false;
  end if;

  if cardinality(v_success_ids) > 0 then
    update app_portal.push_subscriptions
    set last_success_at = now(),
        last_seen_at = now(),
        failure_count = 0,
        updated_at = now()
    where id = any(v_success_ids);
  end if;

  if cardinality(v_disabled_ids) > 0 then
    update app_portal.push_subscriptions
    set is_active = false,
        disabled_at = now(),
        failure_count = failure_count + 1,
        updated_at = now()
    where id = any(v_disabled_ids);
  end if;

  update app_portal.notifications
  set push_state = case
        when v_success_count > 0 then 'SENT'
        when v_retryable and v_attempts < 3 then 'PENDING'
        else 'FAILED'
      end,
      push_attempted_at = now(),
      push_error = case
        when v_success_count > 0 and v_failure_count = 0 then ''
        else v_error
      end
  where id = v_notification_id;

  return true;
end;
$$;

create or replace function app_private.invoke_push_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select secret.decrypted_secret
  into v_secret
  from vault.decrypted_secrets as secret
  where secret.name = 'pd_push_dispatch_secret'
  limit 1;

  if coalesce(v_secret, '') = '' then
    return null;
  end if;

  select net.http_post(
    url := 'https://tpieykhhawszlzsoflnl.supabase.co/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-dispatch-secret', v_secret
    ),
    body := jsonb_build_object(
      'source', 'database',
      'requestedAt', now()
    ),
    timeout_milliseconds := 5000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

create or replace function app_private.trigger_push_dispatch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.invoke_push_dispatch();
  return new;
end;
$$;

create trigger notifications_web_push_dispatch
after insert on app_portal.notifications
for each statement
execute function app_private.trigger_push_dispatch();

do $$
declare
  v_job_id bigint;
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron ist nicht verfügbar. Wartefristprüfung muss extern geplant werden.';
    return;
  end if;

  select jobid
  into v_job_id
  from cron.job
  where jobname = 'pd-web-push-waiting-deadlines'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'pd-web-push-waiting-deadlines',
    '*/15 * * * *',
    $cron$
      select app_private.queue_waiting_deadline_notifications();
      select app_private.invoke_push_dispatch();
    $cron$
  );
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_web_push_r1;

create or replace function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.'
      using errcode = '42501';
  end if;

  if v_action = 'push_snapshot' then
    v_data := app_private.api_push_snapshot();
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  if v_action = 'save_push_subscription' then
    v_data := app_private.api_save_push_subscription(
      coalesce(p_payload, '{}'::jsonb)
    );
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  if v_action = 'remove_push_subscription' then
    v_data := app_private.api_remove_push_subscription(
      coalesce(p_payload, '{}'::jsonb)
    );
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  if v_action = 'save_notification_preferences' then
    v_data := app_private.api_save_notification_preferences(
      coalesce(p_payload, '{}'::jsonb)
    );
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  if v_action = 'create_push_test' then
    v_data := app_private.api_create_push_test();
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  return public.pd_api_before_web_push_r1(p_action, p_payload);
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', sqlstate,
        'message', sqlerrm
      )
    );
end;
$$;

revoke all on function app_private.push_event_enabled(uuid, text)
  from public, anon, authenticated;
revoke all on function app_private.push_quiet_hours_active(uuid)
  from public, anon, authenticated;
revoke all on function app_private.api_push_snapshot()
  from public, anon, authenticated;
revoke all on function app_private.api_save_push_subscription(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_remove_push_subscription(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_save_notification_preferences(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_create_push_test()
  from public, anon, authenticated;
revoke all on function app_private.api_task_history_snapshot_before_web_push_r1(uuid)
  from public, anon, authenticated;
revoke all on function app_private.api_task_history_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function app_private.queue_waiting_deadline_notifications()
  from public, anon, authenticated;
revoke all on function app_private.invoke_push_dispatch()
  from public, anon, authenticated;
revoke all on function app_private.trigger_push_dispatch()
  from public, anon, authenticated;

revoke all on function public.pd_push_validate_dispatch_secret(text)
  from public, anon, authenticated;
revoke all on function public.pd_push_claim_batch(integer)
  from public, anon, authenticated;
revoke all on function public.pd_push_complete(jsonb)
  from public, anon, authenticated;

grant execute on function public.pd_push_validate_dispatch_secret(text)
  to service_role;
grant execute on function public.pd_push_claim_batch(integer)
  to service_role;
grant execute on function public.pd_push_complete(jsonb)
  to service_role;

revoke all on function public.pd_api_before_web_push_r1(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;
