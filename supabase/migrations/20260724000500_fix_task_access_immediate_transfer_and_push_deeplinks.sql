-- Plärrdeifl Portal V4
-- Aufgaben-/Push-Korrektur R3
-- Rollenbasierte Aufgabensichtbarkeit, ausschließlich direkte Übertragung,
-- zuverlässige Push-Deep-Links und lesbare Badge-Zustände.

update app_modules.task_transfers
set status = 'CANCELLED',
    responded_at = coalesce(responded_at, now()),
    responded_by = coalesce(responded_by, requested_by),
    response_reason = case
      when length(btrim(response_reason)) > 0 then response_reason
      else 'Übertragungsanfragen wurden deaktiviert. Es bleibt ausschließlich die direkte Übertragung verfügbar.'
    end,
    revision = revision + 1
where status = 'PENDING';

update app_portal.notifications
set read_at = coalesce(read_at, now()),
    push_state = case when push_state = 'PENDING' then 'SKIPPED' else push_state end,
    push_error = case
      when push_state = 'PENDING' then 'Übertragungsanfragen wurden deaktiviert.'
      else push_error
    end
where event_type in (
  'TASK_TRANSFER_REQUESTED',
  'TASK_TRANSFER_ACCEPTED',
  'TASK_TRANSFER_REJECTED',
  'TASK_TRANSFER_CANCELLED',
  'TASK_TRANSFER_EXPIRED'
)
  and read_at is null;

create or replace function app_private.task_is_visible(
  p_user_id uuid,
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from app_modules.tasks as task
    where task.id = p_task_id
      and (
        app_private.has_capability(p_user_id, 'tasks.manage')
        or task.assigned_user_id = p_user_id
        or app_private.is_office_holder(p_user_id)
        or (
          task.context_type = 'TEAM'
          and app_private.is_team_member(p_user_id, task.team_id)
        )
      )
  );
$$;

create or replace function app_private.task_notification_queue(
  p_task_id uuid,
  p_actor uuid,
  p_event_type text,
  p_title text,
  p_body text,
  p_event_key text,
  p_target_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task app_modules.tasks%rowtype;
  v_count integer := 0;
begin
  select * into v_task
  from app_modules.tasks
  where id = p_task_id;

  if v_task.id is null then
    return 0;
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
  select
    recipient.id,
    p_event_key,
    p_event_type,
    left(p_title, 240),
    left(p_body, 1000),
    '#/tasks?taskId=' || p_task_id::text,
    'task',
    p_task_id::text,
    p_actor
  from app_portal.users as recipient
  where recipient.status = 'ACTIVE'
    and recipient.id is distinct from p_actor
    and (
      (p_target_user_id is not null and recipient.id = p_target_user_id)
      or (
        p_target_user_id is null
        and app_private.task_is_visible(recipient.id, p_task_id)
      )
    )
  on conflict (user_id, event_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function app_private.api_task_transfer(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_operation text := upper(btrim(coalesce(p_payload ->> 'operation', '')));
  v_task_id uuid := nullif(p_payload ->> 'taskId', '')::uuid;
  v_task_revision integer := nullif(p_payload ->> 'taskRevision', '')::integer;
  v_target uuid := nullif(p_payload ->> 'targetUserId', '')::uuid;
  v_reason text := left(btrim(coalesce(p_payload ->> 'reason', '')), 1000);
  v_handover text := left(btrim(coalesce(p_payload ->> 'handoverNote', '')), 4000);
  v_task app_modules.tasks%rowtype;
  v_transfer_id uuid;
  v_target_name text;
  v_from_name text;
  v_actor_name text := app_private.task_history_user_name(v_actor);
begin
  if v_operation <> 'IMMEDIATE' then
    raise exception
      'Übertragungsanfragen sind deaktiviert. Verwende die direkte Aufgabenübertragung.'
      using errcode = '0A000';
  end if;

  select * into v_task
  from app_modules.tasks
  where id = v_task_id
  for update;

  if v_task.id is null or not app_private.task_is_visible(v_actor, v_task_id) then
    raise exception 'Aufgabe wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_task.status not in ('OPEN', 'IN_PROGRESS', 'WAITING') then
    raise exception 'Diese Aufgabe kann nicht übertragen werden.'
      using errcode = '23514';
  end if;

  if v_task_revision is null or v_task_revision <> v_task.revision then
    raise exception
      'Die Aufgabe wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if not app_private.task_can_reopen_or_archive(v_actor, v_task_id) then
    raise exception
      'Aufgaben dürfen nur durch zuständige Teamleitung, Vorstand oder Administration übertragen werden.'
      using errcode = '42501';
  end if;

  if v_target is null
     or not app_private.task_transfer_target_allowed(v_actor, v_task_id, v_target) then
    raise exception 'Zielperson ist für diese Aufgabe nicht zulässig.'
      using errcode = '23514';
  end if;

  if length(v_reason) < 1 then
    raise exception 'Ein Grund für die Übertragung ist erforderlich.'
      using errcode = '22023';
  end if;

  select first_name || ' ' || last_name
  into v_target_name
  from app_portal.users
  where id = v_target
    and status = 'ACTIVE';

  if v_target_name is null then
    raise exception 'Aktive Zielperson wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  v_from_name := case
    when v_task.assigned_user_id is null then 'Noch nicht zugewiesen'
    else app_private.task_history_user_name(v_task.assigned_user_id)
  end;

  insert into app_modules.task_transfers (
    task_id,
    task_id_snapshot,
    task_title_snapshot,
    from_user_id,
    from_name_snapshot,
    to_user_id,
    to_name_snapshot,
    requested_by,
    requested_by_name_snapshot,
    transfer_mode,
    status,
    reason,
    handover_note,
    requested_at,
    responded_at,
    responded_by
  )
  values (
    v_task.id,
    v_task.id,
    v_task.title,
    v_task.assigned_user_id,
    v_from_name,
    v_target,
    v_target_name,
    v_actor,
    v_actor_name,
    'IMMEDIATE',
    'ACCEPTED',
    v_reason,
    v_handover,
    now(),
    now(),
    v_actor
  )
  returning id into v_transfer_id;

  update app_modules.tasks
  set assigned_user_id = v_target,
      assignment_reason = case
        when context_type = 'BOARD'
         and not app_private.is_office_holder(v_target)
          then v_reason
        else ''
      end,
      revision = revision + 1
  where id = v_task_id;

  perform app_private.task_history_add_entry(
    v_task_id,
    v_actor,
    'TRANSFER_IMMEDIATE',
    format('Aufgabe wurde von %s an %s übertragen.', v_from_name, v_target_name),
    jsonb_build_object(
      'transferId', v_transfer_id,
      'reason', v_reason,
      'handoverNote', v_handover
    )
  );

  perform app_private.task_notification_queue(
    v_task_id,
    v_actor,
    'TASK_TRANSFER_IMMEDIATE',
    'Aufgabe wurde dir übertragen',
    v_task.title,
    'task-transfer-immediate:' || v_transfer_id::text,
    v_target
  );

  perform app_private.log_audit(
    v_actor,
    'TASK_TRANSFER_IMMEDIATE',
    'task_transfer',
    v_transfer_id::text,
    null,
    jsonb_build_object(
      'taskId', v_task_id,
      'fromUserId', v_task.assigned_user_id,
      'toUserId', v_target,
      'reason', v_reason,
      'handoverNote', v_handover
    )
  );

  return app_private.api_tasks_snapshot();
end;
$$;

alter function app_private.api_tasks_snapshot()
  rename to api_tasks_snapshot_before_task_access_push_r3;

create or replace function app_private.api_tasks_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base jsonb := app_private.api_tasks_snapshot_before_task_access_push_r3();
  v_tasks jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(
    (item - 'pendingTransfer' - 'canRespondTransfer' - 'canCancelTransfer')
      || jsonb_build_object('canTransfer', false)
    order by position
  ), '[]'::jsonb)
  into v_tasks
  from jsonb_array_elements(coalesce(v_base -> 'tasks', '[]'::jsonb))
    with ordinality as task_items(item, position);

  return jsonb_set(v_base, '{tasks}', v_tasks, true);
end;
$$;

alter function app_private.api_bootstrap()
  rename to api_bootstrap_before_task_access_push_r3;

create or replace function app_private.api_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base jsonb := app_private.api_bootstrap_before_task_access_push_r3();
  v_actor uuid := auth.uid();
  v_tasks_visible boolean := false;
begin
  if v_actor is not null and v_base ->> 'state' = 'ACTIVE' then
    v_tasks_visible :=
      app_private.has_capability(v_actor, 'tasks.manage')
      or app_private.is_office_holder(v_actor)
      or exists (
        select 1
        from app_portal.team_memberships as membership
        where membership.user_id = v_actor
          and membership.is_active
          and membership.team_role in ('LEAD', 'CO_LEAD')
      )
      or exists (
        select 1
        from app_modules.tasks as task
        where task.status <> 'ARCHIVED'
          and app_private.task_is_visible(v_actor, task.id)
      );

    v_base := jsonb_set(
      v_base,
      '{navigation,tasks}',
      to_jsonb(v_tasks_visible),
      true
    );
  end if;

  return v_base;
end;
$$;

create or replace function app_private.api_mark_notification_read(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_notification_id uuid := nullif(p_payload ->> 'notificationId', '')::uuid;
  v_entity_type text := left(btrim(coalesce(p_payload ->> 'entityType', '')), 100);
  v_entity_id text := left(btrim(coalesce(p_payload ->> 'entityId', '')), 240);
  v_marked integer := 0;
begin
  if v_notification_id is null
     and (v_entity_type = '' or v_entity_id = '') then
    raise exception 'Meldung oder Zielbereich fehlt.'
      using errcode = '22023';
  end if;

  update app_portal.notifications as notification
  set read_at = coalesce(notification.read_at, now())
  where notification.user_id = v_actor
    and notification.read_at is null
    and (
      (v_notification_id is not null and notification.id = v_notification_id)
      or (
        v_entity_type <> ''
        and v_entity_id <> ''
        and notification.entity_type = v_entity_type
        and notification.entity_id = v_entity_id
      )
    );

  get diagnostics v_marked = row_count;

  return app_private.api_push_snapshot()
    || jsonb_build_object('markedCount', v_marked);
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_task_access_push_r3;

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

  if v_action = 'mark_notification_read' then
    v_data := app_private.api_mark_notification_read(
      coalesce(p_payload, '{}'::jsonb)
    );
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  return public.pd_api_before_task_access_push_r3(p_action, p_payload);
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

revoke all on function app_private.task_is_visible(uuid, uuid)
  from public, anon, authenticated;
revoke all on function app_private.task_notification_queue(uuid, uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function app_private.api_task_transfer(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_tasks_snapshot_before_task_access_push_r3()
  from public, anon, authenticated;
revoke all on function app_private.api_tasks_snapshot()
  from public, anon, authenticated;
revoke all on function app_private.api_bootstrap_before_task_access_push_r3()
  from public, anon, authenticated;
revoke all on function app_private.api_bootstrap()
  from public, anon, authenticated;
revoke all on function app_private.api_mark_notification_read(jsonb)
  from public, anon, authenticated;

revoke all on function public.pd_api_before_task_access_push_r3(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.pd_api(text, jsonb)
  from public, anon;
grant execute on function public.pd_api(text, jsonb)
  to authenticated;
