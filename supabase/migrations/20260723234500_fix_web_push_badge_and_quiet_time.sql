update app_portal.notifications
set read_at = coalesce(read_at, created_at, now())
where event_type = 'PUSH_TEST'
  and read_at is null;

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
    actor_user_id,
    read_at
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
    v_actor,
    now()
  );

  return jsonb_build_object('queued', true);
end;
$$;
