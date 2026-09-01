\set ON_ERROR_STOP on

begin;

select plan(1);

do $m020_push_navigation_badge_acknowledgement$
declare
  v_user uuid := '00000000-0000-4020-8000-000000000301';
  v_event uuid;
  v_task_notification uuid;
  v_date_notification uuid;
  v_result jsonb;
begin
  insert into auth.users(id, email)
  values (v_user, 'm020-push-ack@example.invalid');

  insert into app_portal.users(
    id, user_code, email, first_name, last_name, status, role_id
  )
  values (
    v_user,
    'U-M020-PUSH-ACK',
    'm020-push-ack@example.invalid',
    'M020',
    'Push Ack',
    'ACTIVE',
    '00000000-0000-4000-8000-000000000003'
  );

  insert into app_portal.notification_preferences(user_id)
  values (v_user);

  insert into app_modules.events(
    event_type, title, event_date, event_time, venue, visibility,
    created_by, updated_by
  )
  values (
    'OTHER', 'M020 Push-Ack Test', date '2026-12-21', time '18:00',
    'Test', 'PUBLIC',
    v_user, v_user
  )
  returning id into v_event;

  insert into app_portal.notifications(
    user_id, event_key, event_type, title, body, route,
    entity_type, entity_id
  )
  values (
    v_user,
    'm020:push-ack:task',
    'TASK_CREATED',
    'Aufgabe',
    'Scope-Isolation',
    '#/tasks?taskId=00000000-0000-4020-8000-000000000399',
    'task',
    '00000000-0000-4020-8000-000000000399'
  )
  returning id into v_task_notification;

  insert into app_portal.notifications(
    user_id, event_key, event_type, title, body, route,
    entity_type, entity_id
  )
  values (
    v_user,
    'm020:push-ack:date',
    'DATE_EVENT_CREATED',
    'Termin',
    'Backend-Badge',
    '#/dates',
    'event',
    v_event::text
  )
  returning id into v_date_notification;

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_user, 'role', 'authenticated')::text,
    true
  );

  v_result := app_private.api_mark_notification_read(
    jsonb_build_object('scope', 'tasks')
  );

  if not exists (
       select 1
       from app_portal.notifications
       where id = v_task_notification
         and read_at is not null
     ) then
    raise exception 'M020 Push-Ack: Tasks-Scope wurde nicht bestätigt.';
  end if;

  if exists (
       select 1
       from app_portal.notifications
       where id = v_date_notification
         and read_at is not null
     ) then
    raise exception 'M020 Push-Ack: Tasks-Scope hat Termin-Meldung mitgelesen.';
  end if;

  if (v_result ->> 'markedCount')::integer <> 1
     or (v_result ->> 'unreadNotificationCount')::integer <> 1 then
    raise exception
      'M020 Push-Ack: Backend-Snapshot nach Tasks-Ack ist nicht autoritativ: %',
      v_result;
  end if;

  v_result := app_private.api_mark_notification_read(
    jsonb_build_object('scope', 'dates')
  );

  if not exists (
       select 1
       from app_portal.notifications
       where id = v_date_notification
         and read_at is not null
     )
     or (v_result ->> 'markedCount')::integer <> 1
     or (v_result ->> 'unreadNotificationCount')::integer <> 0 then
    raise exception
      'M020 Push-Ack: Termin-Ack oder Backend-Badge ist falsch: %',
      v_result;
  end if;
end;
$m020_push_navigation_badge_acknowledgement$;

select pass(
  'M020 Push-Navigation: Scope-Isolation und autoritativer Badge-Snapshot PASS.'
);

select * from finish();

rollback;
