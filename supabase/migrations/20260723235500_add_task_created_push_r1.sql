alter table app_portal.notification_preferences
  add column new_tasks boolean not null default true;

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
        when p_event_type = 'TASK_CREATED'
          then preference.new_tasks
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
        and notification.event_type <> 'PUSH_TEST'
    ),
    'preferences', (
      select jsonb_build_object(
        'pushEnabled', preference.push_enabled,
        'newTasks', preference.new_tasks,
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
      new_tasks =
        coalesce((p_payload ->> 'newTasks')::boolean, new_tasks),
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

create or replace function app_private.queue_task_created_push_r1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
  select
    recipient.id,
    'task-created:' || new.id::text,
    'TASK_CREATED',
    'Neue Aufgabe',
    left(
      case new.context_type
        when 'TEAM' then 'Neue Teamaufgabe: ' || new.title
        when 'BOARD' then 'Neue Vorstandsaufgabe: ' || new.title
        else 'Neue Aufgabe: ' || new.title
      end,
      1000
    ),
    '#/tasks?taskId=' || new.id::text,
    'task',
    new.id::text,
    new.created_by
  from app_portal.users as recipient
  where recipient.status = 'ACTIVE'
    and recipient.id is distinct from new.created_by
    and app_private.task_is_visible(recipient.id, new.id)
  on conflict (user_id, event_key) do nothing;

  return new;
end;
$$;

drop trigger if exists task_created_push_r1
  on app_modules.tasks;

create trigger task_created_push_r1
after insert on app_modules.tasks
for each row
execute function app_private.queue_task_created_push_r1();

revoke all on function app_private.queue_task_created_push_r1()
  from public, anon, authenticated;
