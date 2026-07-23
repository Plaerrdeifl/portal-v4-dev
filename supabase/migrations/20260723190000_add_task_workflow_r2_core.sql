-- Plärrdeifl Portal V4
-- Aufgabenworkflow R2 Core
-- Wartestatus, Statuszeitpunkte, nachvollziehbare Übertragung,
-- Neu-/Gelesen-Markierung und Benachrichtigungs-Warteschlange.
-- Ausschließlich für Supabase DEV vorgesehen.

do $$
begin
  if to_regclass('app_modules.task_transfers') is not null then
    raise exception 'Task Workflow R2 ist bereits installiert.'
      using errcode = '42P07';
  end if;

  if to_regprocedure('app_private.api_task_transfer(jsonb)') is not null then
    raise exception 'Task Workflow R2 API existiert bereits.'
      using errcode = '42710';
  end if;
end;
$$;

alter table app_modules.tasks
  add column status_changed_at timestamptz;

alter table app_modules.tasks
  add column status_changed_by uuid
  references app_portal.users(id) on delete set null;

alter table app_modules.tasks
  add column waiting_reason text not null default '';

alter table app_modules.tasks
  add column waiting_deadline timestamptz;

alter table app_modules.tasks
  add column waiting_started_at timestamptz;

alter table app_modules.tasks
  add column waiting_started_by uuid
  references app_portal.users(id) on delete set null;

update app_modules.tasks
set status_changed_at = coalesce(updated_at, created_at, now()),
    status_changed_by = created_by;

alter table app_modules.tasks
  alter column status_changed_at set not null;

alter table app_modules.tasks
  alter column status_changed_at set default now();

alter table app_modules.tasks
  drop constraint if exists tasks_status_check;

alter table app_modules.tasks
  add constraint tasks_status_check
  check (status in ('OPEN', 'IN_PROGRESS', 'WAITING', 'DONE', 'ARCHIVED'));

alter table app_modules.tasks
  add constraint tasks_waiting_reason_length_check
  check (length(waiting_reason) <= 1000);

alter table app_modules.tasks
  add constraint tasks_waiting_state_check
  check (
    status <> 'WAITING'
    or (
      length(btrim(waiting_reason)) between 1 and 1000
      and waiting_started_at is not null
    )
  );

create or replace function app_private.task_initial_status_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status_changed_at := coalesce(new.status_changed_at, now());
  new.status_changed_by := coalesce(new.status_changed_by, new.created_by);
  return new;
end;
$$;

create trigger tasks_initial_status_metadata
before insert on app_modules.tasks
for each row execute function app_private.task_initial_status_metadata();

create table app_modules.task_transfers (
  id uuid primary key default extensions.gen_random_uuid(),
  task_id uuid references app_modules.tasks(id) on delete set null,
  task_id_snapshot uuid not null,
  task_title_snapshot text not null,
  from_user_id uuid references app_portal.users(id) on delete set null,
  from_name_snapshot text not null default '',
  to_user_id uuid not null references app_portal.users(id) on delete restrict,
  to_name_snapshot text not null,
  requested_by uuid references app_portal.users(id) on delete set null,
  requested_by_name_snapshot text not null,
  transfer_mode text not null default 'REQUEST',
  status text not null default 'PENDING',
  reason text not null,
  handover_note text not null default '',
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  responded_at timestamptz,
  responded_by uuid references app_portal.users(id) on delete set null,
  response_reason text not null default '',
  revision integer not null default 1,
  constraint task_transfers_mode_check
    check (transfer_mode in ('REQUEST', 'IMMEDIATE')),
  constraint task_transfers_status_check
    check (status in ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
  constraint task_transfers_reason_check
    check (length(btrim(reason)) between 1 and 1000),
  constraint task_transfers_handover_check
    check (length(handover_note) <= 4000),
  constraint task_transfers_response_reason_check
    check (length(response_reason) <= 1000),
  constraint task_transfers_revision_check
    check (revision >= 1)
);

create unique index task_transfers_one_pending_idx
  on app_modules.task_transfers(task_id)
  where status = 'PENDING' and task_id is not null;

create index task_transfers_target_pending_idx
  on app_modules.task_transfers(to_user_id, status, requested_at desc);

create index task_transfers_task_history_idx
  on app_modules.task_transfers(task_id_snapshot, requested_at desc);

alter table app_modules.task_transfers enable row level security;
revoke all on table app_modules.task_transfers
  from public, anon, authenticated;

create table app_modules.task_history_reads (
  task_id uuid not null references app_modules.tasks(id) on delete cascade,
  user_id uuid not null references app_portal.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create index task_history_reads_user_idx
  on app_modules.task_history_reads(user_id, last_read_at desc);

alter table app_modules.task_history_reads enable row level security;
revoke all on table app_modules.task_history_reads
  from public, anon, authenticated;

create table app_portal.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references app_portal.users(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  title text not null,
  body text not null,
  route text not null default '#/dashboard',
  entity_type text not null default '',
  entity_id text not null default '',
  actor_user_id uuid references app_portal.users(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_state text not null default 'PENDING',
  push_attempted_at timestamptz,
  push_error text not null default '',
  constraint notifications_event_key_check
    check (length(event_key) between 1 and 240),
  constraint notifications_event_type_check
    check (length(event_type) between 1 and 100),
  constraint notifications_title_check
    check (length(title) between 1 and 240),
  constraint notifications_body_check
    check (length(body) between 1 and 1000),
  constraint notifications_push_state_check
    check (push_state in ('PENDING', 'SENT', 'FAILED', 'SKIPPED')),
  unique (user_id, event_key)
);

create index notifications_user_created_idx
  on app_portal.notifications(user_id, created_at desc);

create index notifications_push_pending_idx
  on app_portal.notifications(push_state, created_at)
  where push_state = 'PENDING';

alter table app_portal.notifications enable row level security;
revoke all on table app_portal.notifications
  from public, anon, authenticated;

insert into app_modules.task_history_reads (task_id, user_id, last_read_at)
select task.id, portal_user.id, now()
from app_modules.tasks as task
join app_portal.users as portal_user
  on portal_user.status = 'ACTIVE'
where app_private.task_is_visible(portal_user.id, task.id)
on conflict (task_id, user_id) do nothing;

alter table app_modules.task_updates
  drop constraint task_updates_entry_type_check;

alter table app_modules.task_updates
  add constraint task_updates_entry_type_check
  check (
    entry_type in (
      'UPDATE',
      'LEGACY_NOTE',
      'TASK_CREATED',
      'TASK_CHANGED',
      'STATUS_CHANGED',
      'ASSIGNEE_CHANGED',
      'PRIORITY_CHANGED',
      'TASK_COMPLETED',
      'TASK_REOPENED',
      'TASK_ARCHIVED',
      'TASK_RESTORED',
      'TASK_DELETED',
      'WAITING_STARTED',
      'WAITING_UPDATED',
      'WAITING_ENDED',
      'TRANSFER_REQUESTED',
      'TRANSFER_ACCEPTED',
      'TRANSFER_REJECTED',
      'TRANSFER_CANCELLED',
      'TRANSFER_IMMEDIATE',
      'TRANSFER_EXPIRED'
    )
  );

create or replace function app_private.task_history_status_label(
  p_status text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case upper(coalesce(p_status, ''))
    when 'OPEN' then 'Offen'
    when 'IN_PROGRESS' then 'In Bearbeitung'
    when 'WAITING' then 'Wartet'
    when 'DONE' then 'Erledigt'
    when 'ARCHIVED' then 'Archiviert'
    else coalesce(p_status, 'Unbekannt')
  end;
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
        and (
          recipient.id = v_task.assigned_user_id
          or recipient.id = v_task.created_by
          or app_private.has_capability(recipient.id, 'tasks.manage')
          or (
            v_task.context_type = 'TEAM'
            and exists (
              select 1
              from app_portal.team_memberships as membership
              where membership.team_id = v_task.team_id
                and membership.user_id = recipient.id
                and membership.is_active
                and membership.team_role in ('LEAD', 'CO_LEAD')
            )
          )
          or (
            v_task.context_type = 'BOARD'
            and app_private.is_office_holder(recipient.id)
          )
        )
      )
    )
  on conflict (user_id, event_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function app_private.task_transfer_target_allowed(
  p_actor uuid,
  p_task_id uuid,
  p_target uuid
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
    join app_portal.users as target
      on target.id = p_target
     and target.status = 'ACTIVE'
    where task.id = p_task_id
      and target.id is distinct from task.assigned_user_id
      and (
        (
          task.context_type = 'TEAM'
          and app_private.is_team_member(target.id, task.team_id)
        )
        or (
          task.context_type = 'BOARD'
          and (
            app_private.task_is_manageable(p_actor, task.id)
            or app_private.is_office_holder(target.id)
          )
        )
      )
  );
$$;

create or replace function app_private.task_expire_pending_transfers()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transfer app_modules.task_transfers%rowtype;
  v_count integer := 0;
begin
  for v_transfer in
    select *
    from app_modules.task_transfers
    where status = 'PENDING'
      and expires_at is not null
      and expires_at <= now()
    for update skip locked
  loop
    update app_modules.task_transfers
    set status = 'EXPIRED',
        responded_at = now(),
        response_reason = 'Annahmefrist abgelaufen.',
        revision = revision + 1
    where id = v_transfer.id;

    perform app_private.task_history_add_entry(
      v_transfer.task_id_snapshot,
      v_transfer.requested_by,
      'TRANSFER_EXPIRED',
      format(
        'Übertragungsanfrage an %s ist abgelaufen.',
        v_transfer.to_name_snapshot
      ),
      jsonb_build_object('transferId', v_transfer.id)
    );

    perform app_private.task_notification_queue(
      v_transfer.task_id_snapshot,
      v_transfer.requested_by,
      'TASK_TRANSFER_EXPIRED',
      'Aufgabenübertragung abgelaufen',
      v_transfer.task_title_snapshot,
      'task-transfer-expired:' || v_transfer.id::text,
      coalesce(v_transfer.from_user_id, v_transfer.requested_by)
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

alter function app_private.api_tasks_snapshot()
  rename to api_tasks_snapshot_before_workflow_r2;

create or replace function app_private.api_tasks_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_base jsonb;
  v_tasks jsonb := '[]'::jsonb;
  v_transfer_users jsonb := '[]'::jsonb;
begin
  perform app_private.task_expire_pending_transfers();
  v_base := app_private.api_tasks_snapshot_before_workflow_r2();

  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'statusChangedAt', task.status_changed_at,
      'statusChangedBy', task.status_changed_by,
      'statusChangedByName', case
        when status_actor.id is null then ''
        else status_actor.first_name || ' ' || status_actor.last_name
      end,
      'waitingReason', task.waiting_reason,
      'waitingDeadline', task.waiting_deadline,
      'waitingStartedAt', task.waiting_started_at,
      'waitingStartedBy', task.waiting_started_by,
      'waitingStartedByName', case
        when waiting_actor.id is null then ''
        else waiting_actor.first_name || ' ' || waiting_actor.last_name
      end,
      'latestUpdateAt', latest_entry.created_at,
      'latestUpdateByName', latest_entry.author_name_snapshot,
      'unreadUpdateCount', coalesce((
        select count(*)
        from app_modules.task_updates as unread
        left join app_modules.task_history_reads as read_state
          on read_state.task_id = task.id
         and read_state.user_id = v_actor
        where unread.task_id_snapshot = task.id
          and unread.visibility = 'TASK'
          and unread.hidden_at is null
          and unread.author_user_id is distinct from v_actor
          and unread.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
      ), 0),
      'canChangeStatus',
        task.status in ('OPEN', 'IN_PROGRESS', 'WAITING')
        and (
          task.assigned_user_id = v_actor
          or app_private.task_is_manageable(v_actor, task.id)
        ),
      'canTransfer',
        task.status in ('OPEN', 'IN_PROGRESS', 'WAITING')
        and pending_transfer.id is null
        and (
          task.assigned_user_id = v_actor
          or app_private.task_is_manageable(v_actor, task.id)
        ),
      'canImmediateTransfer',
        task.status in ('OPEN', 'IN_PROGRESS', 'WAITING')
        and app_private.task_can_reopen_or_archive(v_actor, task.id),
      'canRespondTransfer',
        pending_transfer.id is not null
        and pending_transfer.to_user_id = v_actor,
      'canCancelTransfer',
        pending_transfer.id is not null
        and (
          pending_transfer.requested_by = v_actor
          or task.assigned_user_id = v_actor
          or app_private.task_is_manageable(v_actor, task.id)
        ),
      'pendingTransfer', case
        when pending_transfer.id is null then null
        else jsonb_build_object(
          'id', pending_transfer.id,
          'fromUserId', pending_transfer.from_user_id,
          'fromName', pending_transfer.from_name_snapshot,
          'toUserId', pending_transfer.to_user_id,
          'toName', pending_transfer.to_name_snapshot,
          'requestedBy', pending_transfer.requested_by,
          'requestedByName', pending_transfer.requested_by_name_snapshot,
          'reason', pending_transfer.reason,
          'handoverNote', pending_transfer.handover_note,
          'requestedAt', pending_transfer.requested_at,
          'expiresAt', pending_transfer.expires_at,
          'revision', pending_transfer.revision
        )
      end
    )
    order by item_order.position
  ), '[]'::jsonb)
  into v_tasks
  from jsonb_array_elements(coalesce(v_base -> 'tasks', '[]'::jsonb))
    with ordinality as item_order(item, position)
  join app_modules.tasks as task
    on task.id = (item ->> 'id')::uuid
  left join app_portal.users as status_actor
    on status_actor.id = task.status_changed_by
  left join app_portal.users as waiting_actor
    on waiting_actor.id = task.waiting_started_by
  left join lateral (
    select entry.created_at, entry.author_name_snapshot
    from app_modules.task_updates as entry
    where entry.task_id_snapshot = task.id
      and entry.visibility = 'TASK'
      and entry.hidden_at is null
    order by entry.created_at desc, entry.id desc
    limit 1
  ) as latest_entry on true
  left join lateral (
    select transfer.*
    from app_modules.task_transfers as transfer
    where transfer.task_id = task.id
      and transfer.status = 'PENDING'
    order by transfer.requested_at desc
    limit 1
  ) as pending_transfer on true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', portal_user.id,
    'name', portal_user.first_name || ' ' || portal_user.last_name,
    'isOfficeHolder', app_private.is_office_holder(portal_user.id),
    'teamIds', coalesce((
      select jsonb_agg(membership.team_id order by membership.team_id)
      from app_portal.team_memberships as membership
      where membership.user_id = portal_user.id
        and membership.is_active
    ), '[]'::jsonb)
  ) order by portal_user.last_name, portal_user.first_name), '[]'::jsonb)
  into v_transfer_users
  from app_portal.users as portal_user
  where portal_user.status = 'ACTIVE'
    and (
      app_private.has_capability(v_actor, 'tasks.manage')
      or app_private.is_office_holder(v_actor)
      or app_private.is_office_holder(portal_user.id)
      or exists (
        select 1
        from app_portal.team_memberships as own_membership
        join app_portal.team_memberships as target_membership
          on target_membership.team_id = own_membership.team_id
         and target_membership.user_id = portal_user.id
         and target_membership.is_active
        where own_membership.user_id = v_actor
          and own_membership.is_active
      )
    );

  return jsonb_set(
    jsonb_set(v_base, '{tasks}', v_tasks, true),
    '{transferUsers}',
    v_transfer_users,
    true
  );
end;
$$;

alter function app_private.api_task_history_snapshot(uuid)
  rename to api_task_history_snapshot_before_workflow_r2;

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
  v_read_at timestamptz := now();
begin
  v_result := app_private.api_task_history_snapshot_before_workflow_r2(p_task_id);

  insert into app_modules.task_history_reads (
    task_id,
    user_id,
    last_read_at,
    updated_at
  )
  values (p_task_id, v_actor, v_read_at, v_read_at)
  on conflict (task_id, user_id)
  do update set
    last_read_at = excluded.last_read_at,
    updated_at = excluded.updated_at;

  return v_result || jsonb_build_object('markedReadAt', v_read_at);
end;
$$;

alter function app_private.api_save_task(jsonb)
  rename to api_save_task_before_workflow_r2;

create or replace function app_private.api_save_task(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_existing app_modules.tasks%rowtype;
  v_requested_assignee uuid := nullif(p_payload ->> 'assignedUserId', '')::uuid;
  v_safe_payload jsonb := p_payload;
begin
  if v_id is not null then
    select * into v_existing
    from app_modules.tasks
    where id = v_id;

    if v_existing.id is null then
      raise exception 'Aufgabe wurde nicht gefunden.' using errcode = 'P0002';
    end if;

    if v_requested_assignee is distinct from v_existing.assigned_user_id then
      raise exception
        'Die Zuständigkeit kann nur über „Aufgabe übertragen“ geändert werden.'
        using errcode = '23514';
    end if;

    v_safe_payload := jsonb_set(
      v_safe_payload,
      '{assignmentReason}',
      to_jsonb(v_existing.assignment_reason),
      true
    );
  end if;

  return app_private.api_save_task_before_workflow_r2(v_safe_payload);
end;
$$;

alter function app_private.api_set_task_status(jsonb)
  rename to api_set_task_status_before_workflow_r2;

create or replace function app_private.api_set_task_status(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_expected_revision integer := nullif(p_payload ->> 'revision', '')::integer;
  v_status text := upper(btrim(coalesce(p_payload ->> 'status', '')));
  v_waiting_reason text := left(btrim(coalesce(p_payload ->> 'waitingReason', '')), 1000);
  v_waiting_deadline timestamptz := nullif(p_payload ->> 'waitingDeadline', '')::timestamptz;
  v_task app_modules.tasks%rowtype;
  v_can_work boolean;
  v_history_type text := 'STATUS_CHANGED';
  v_history_content text;
  v_now timestamptz := now();
begin
  if v_status not in ('OPEN', 'IN_PROGRESS', 'WAITING', 'DONE') then
    raise exception 'Unzulässiger Aufgabenstatus.' using errcode = '22023';
  end if;

  select * into v_task
  from app_modules.tasks
  where id = v_id
  for update;

  if v_task.id is null or not app_private.task_is_visible(v_actor, v_id) then
    raise exception 'Aufgabe wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_task.status = 'ARCHIVED' then
    raise exception 'Archivierte Aufgaben können nicht verändert werden.'
      using errcode = '42501';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_task.revision then
    raise exception
      'Die Aufgabe wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  v_can_work :=
    v_actor = v_task.assigned_user_id
    or app_private.task_is_manageable(v_actor, v_id);

  if not v_can_work then
    raise exception 'Aufgabenstatus darf nicht geändert werden.'
      using errcode = '42501';
  end if;

  if v_status = 'WAITING' then
    if length(v_waiting_reason) < 1 then
      raise exception 'Bitte gib an, worauf gewartet wird.'
        using errcode = '22023';
    end if;

    if v_waiting_deadline is not null and v_waiting_deadline <= v_now then
      raise exception 'Die Wartefrist muss in der Zukunft liegen.'
        using errcode = '22023';
    end if;
  end if;

  if v_task.status = v_status then
    if v_status <> 'WAITING' then
      raise exception 'Der Aufgabenstatus ist bereits gesetzt.'
        using errcode = '23514';
    end if;
    v_history_type := 'WAITING_UPDATED';
    v_history_content := 'Warteangaben wurden aktualisiert.';
  elsif v_task.status = 'OPEN' and v_status in ('IN_PROGRESS', 'WAITING') then
    null;
  elsif v_task.status = 'IN_PROGRESS' and v_status in ('WAITING', 'DONE') then
    null;
  elsif v_task.status = 'WAITING' and v_status in ('OPEN', 'IN_PROGRESS', 'DONE') then
    null;
  elsif v_task.status = 'DONE' and v_status = 'OPEN' then
    if not app_private.task_can_reopen_or_archive(v_actor, v_id) then
      raise exception
        'Nur zuständige Leitung, Amtsinhaber oder Administration dürfen Aufgaben wieder öffnen.'
        using errcode = '42501';
    end if;
  else
    raise exception 'Dieser Statuswechsel ist nicht erlaubt.'
      using errcode = '23514';
  end if;

  if v_task.status is distinct from v_status then
    if v_status = 'WAITING' then
      v_history_type := 'WAITING_STARTED';
      v_history_content := format('Aufgabe wartet auf: %s', v_waiting_reason);
    elsif v_task.status = 'WAITING' then
      v_history_type := 'WAITING_ENDED';
      v_history_content := format(
        'Wartephase wurde beendet. Neuer Status: %s.',
        app_private.task_history_status_label(v_status)
      );
    elsif v_status = 'DONE' then
      v_history_type := 'TASK_COMPLETED';
      v_history_content := 'Aufgabe wurde erledigt.';
    elsif v_task.status = 'DONE' and v_status = 'OPEN' then
      v_history_type := 'TASK_REOPENED';
      v_history_content := 'Aufgabe wurde wieder geöffnet.';
    else
      v_history_content := format(
        'Status wurde von %s auf %s geändert.',
        app_private.task_history_status_label(v_task.status),
        app_private.task_history_status_label(v_status)
      );
    end if;
  end if;

  update app_modules.tasks
  set status = v_status,
      status_changed_at = case
        when status is distinct from v_status then v_now
        else status_changed_at
      end,
      status_changed_by = case
        when status is distinct from v_status then v_actor
        else status_changed_by
      end,
      waiting_reason = case when v_status = 'WAITING' then v_waiting_reason else '' end,
      waiting_deadline = case when v_status = 'WAITING' then v_waiting_deadline else null end,
      waiting_started_at = case
        when v_status = 'WAITING' and status <> 'WAITING' then v_now
        when v_status = 'WAITING' then waiting_started_at
        else null
      end,
      waiting_started_by = case
        when v_status = 'WAITING' and status <> 'WAITING' then v_actor
        when v_status = 'WAITING' then waiting_started_by
        else null
      end,
      completed_at = case when v_status = 'DONE' then v_now else null end,
      completed_by = case when v_status = 'DONE' then v_actor else null end,
      revision = revision + 1
  where id = v_id;

  perform app_private.task_history_add_entry(
    v_id,
    v_actor,
    v_history_type,
    v_history_content,
    jsonb_build_object(
      'beforeStatus', v_task.status,
      'afterStatus', v_status,
      'waitingReason', case when v_status = 'WAITING' then v_waiting_reason else v_task.waiting_reason end,
      'waitingDeadline', case when v_status = 'WAITING' then v_waiting_deadline else v_task.waiting_deadline end,
      'statusChangedAt', v_now
    )
  );

  perform app_private.log_audit(
    v_actor,
    case when v_task.status = v_status then 'TASK_WAITING_UPDATED' else 'TASK_STATUS_UPDATED' end,
    'task',
    v_id::text,
    to_jsonb(v_task),
    jsonb_build_object(
      'status', v_status,
      'waitingReason', v_waiting_reason,
      'waitingDeadline', v_waiting_deadline,
      'revision', v_task.revision + 1
    )
  );

  perform app_private.task_notification_queue(
    v_id,
    v_actor,
    case when v_status = 'WAITING' then 'TASK_WAITING' else 'TASK_STATUS_CHANGED' end,
    case when v_status = 'WAITING' then 'Aufgabe wartet' else 'Aufgabenstatus geändert' end,
    v_task.title || ': ' || app_private.task_history_status_label(v_status),
    'task-status:' || v_id::text || ':' || (v_task.revision + 1)::text
  );

  return app_private.api_tasks_snapshot();
end;
$$;

alter function app_private.api_save_task_note(jsonb)
  rename to api_save_task_note_before_workflow_r2;

create or replace function app_private.api_save_task_note(
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
  v_task_id uuid := nullif(coalesce(p_payload ->> 'taskId', p_payload ->> 'id'), '')::uuid;
  v_result jsonb;
  v_entry_id uuid;
  v_title text;
begin
  v_result := app_private.api_save_task_note_before_workflow_r2(p_payload);

  if v_operation = 'ADD' then
    select entry.id, task.title
    into v_entry_id, v_title
    from app_modules.task_updates as entry
    join app_modules.tasks as task
      on task.id = entry.task_id_snapshot
    where entry.task_id_snapshot = v_task_id
      and entry.author_user_id = v_actor
      and entry.entry_type = 'UPDATE'
    order by entry.created_at desc, entry.id desc
    limit 1;

    if v_entry_id is not null then
      perform app_private.task_notification_queue(
        v_task_id,
        v_actor,
        'TASK_UPDATE_CREATED',
        'Neues Aufgaben-Update',
        v_title,
        'task-update:' || v_entry_id::text
      );
    end if;
  end if;

  return v_result;
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
  v_transfer_id uuid := nullif(p_payload ->> 'transferId', '')::uuid;
  v_transfer_revision integer := nullif(p_payload ->> 'transferRevision', '')::integer;
  v_target uuid := nullif(p_payload ->> 'targetUserId', '')::uuid;
  v_reason text := left(btrim(coalesce(p_payload ->> 'reason', '')), 1000);
  v_handover text := left(btrim(coalesce(p_payload ->> 'handoverNote', '')), 4000);
  v_expires_at timestamptz := nullif(p_payload ->> 'expiresAt', '')::timestamptz;
  v_response_reason text := left(btrim(coalesce(p_payload ->> 'responseReason', '')), 1000);
  v_task app_modules.tasks%rowtype;
  v_transfer app_modules.task_transfers%rowtype;
  v_target_name text;
  v_from_name text;
  v_actor_name text := app_private.task_history_user_name(v_actor);
begin
  perform app_private.task_expire_pending_transfers();

  if v_operation in ('REQUEST', 'IMMEDIATE') then
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

    if v_target is null
       or not app_private.task_transfer_target_allowed(v_actor, v_task_id, v_target) then
      raise exception 'Zielperson ist für diese Aufgabe nicht zulässig.'
        using errcode = '23514';
    end if;

    if length(v_reason) < 1 then
      raise exception 'Ein Grund für die Übertragung ist erforderlich.'
        using errcode = '22023';
    end if;

    if v_expires_at is not null and v_expires_at <= now() then
      raise exception 'Die Annahmefrist muss in der Zukunft liegen.'
        using errcode = '22023';
    end if;

    if exists (
      select 1 from app_modules.task_transfers
      where task_id = v_task_id and status = 'PENDING'
    ) then
      raise exception 'Für diese Aufgabe ist bereits eine Übertragung offen.'
        using errcode = '23505';
    end if;

    select first_name || ' ' || last_name
    into v_target_name
    from app_portal.users
    where id = v_target and status = 'ACTIVE';

    v_from_name := case
      when v_task.assigned_user_id is null then 'Noch nicht zugewiesen'
      else app_private.task_history_user_name(v_task.assigned_user_id)
    end;

    if v_operation = 'REQUEST' then
      if not (
        v_task.assigned_user_id = v_actor
        or app_private.task_is_manageable(v_actor, v_task_id)
      ) then
        raise exception 'Aufgabe darf nicht zur Übertragung vorgeschlagen werden.'
          using errcode = '42501';
      end if;

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
        expires_at
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
        'REQUEST',
        'PENDING',
        v_reason,
        v_handover,
        v_expires_at
      )
      returning id into v_transfer_id;

      perform app_private.task_history_add_entry(
        v_task_id,
        v_actor,
        'TRANSFER_REQUESTED',
        format('Übertragung an %s wurde angefragt.', v_target_name),
        jsonb_build_object(
          'transferId', v_transfer_id,
          'fromName', v_from_name,
          'toName', v_target_name,
          'reason', v_reason,
          'handoverNote', v_handover,
          'expiresAt', v_expires_at
        )
      );

      perform app_private.task_notification_queue(
        v_task_id,
        v_actor,
        'TASK_TRANSFER_REQUESTED',
        'Aufgabe zur Übernahme',
        v_task.title || ': ' || v_actor_name || ' möchte dir diese Aufgabe übertragen.',
        'task-transfer-request:' || v_transfer_id::text,
        v_target
      );
    else
      if not app_private.task_can_reopen_or_archive(v_actor, v_task_id) then
        raise exception
          'Sofortübertragungen sind nur für zuständige Leitung, Vorstand oder Administration zulässig.'
          using errcode = '42501';
      end if;

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
        format('Aufgabe wurde sofort von %s an %s übertragen.', v_from_name, v_target_name),
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
    end if;

    perform app_private.log_audit(
      v_actor,
      case when v_operation = 'REQUEST' then 'TASK_TRANSFER_REQUESTED' else 'TASK_TRANSFER_IMMEDIATE' end,
      'task_transfer',
      v_transfer_id::text,
      null,
      jsonb_build_object(
        'taskId', v_task_id,
        'fromUserId', v_task.assigned_user_id,
        'toUserId', v_target,
        'reason', v_reason,
        'expiresAt', v_expires_at
      )
    );

    return app_private.api_tasks_snapshot();
  end if;

  select * into v_transfer
  from app_modules.task_transfers
  where id = v_transfer_id
  for update;

  if v_transfer.id is null or v_transfer.status <> 'PENDING' then
    raise exception 'Offene Übertragung wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_transfer_revision is null
     or v_transfer_revision <> v_transfer.revision then
    raise exception
      'Die Übertragung wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  select * into v_task
  from app_modules.tasks
  where id = v_transfer.task_id
  for update;

  if v_task.id is null or v_task.status not in ('OPEN', 'IN_PROGRESS', 'WAITING') then
    raise exception 'Die Aufgabe kann nicht mehr übertragen werden.'
      using errcode = '23514';
  end if;

  if v_operation = 'ACCEPT' then
    if v_transfer.to_user_id <> v_actor then
      raise exception 'Nur die angefragte Person darf übernehmen.'
        using errcode = '42501';
    end if;

    if not app_private.task_transfer_target_allowed(
      v_actor,
      v_task.id,
      v_transfer.to_user_id
    ) then
      raise exception
        'Die Zielperson ist für die inzwischen geänderte Aufgabe nicht mehr zulässig.'
        using errcode = '23514';
    end if;

    update app_modules.task_transfers
    set status = 'ACCEPTED',
        responded_at = now(),
        responded_by = v_actor,
        revision = revision + 1
    where id = v_transfer.id;

    update app_modules.tasks
    set assigned_user_id = v_transfer.to_user_id,
        assignment_reason = case
          when context_type = 'BOARD'
           and not app_private.is_office_holder(v_transfer.to_user_id)
            then v_transfer.reason
          else ''
        end,
        revision = revision + 1
    where id = v_task.id;

    perform app_private.task_history_add_entry(
      v_task.id,
      v_actor,
      'TRANSFER_ACCEPTED',
      format('%s hat die Aufgabe von %s übernommen.', v_transfer.to_name_snapshot, v_transfer.from_name_snapshot),
      jsonb_build_object('transferId', v_transfer.id, 'reason', v_transfer.reason)
    );

    perform app_private.task_notification_queue(
      v_task.id,
      v_actor,
      'TASK_TRANSFER_ACCEPTED',
      'Aufgabe übernommen',
      v_transfer.to_name_snapshot || ' hat „' || v_task.title || '“ übernommen.',
      'task-transfer-accepted:' || v_transfer.id::text,
      coalesce(v_transfer.from_user_id, v_transfer.requested_by)
    );
  elsif v_operation = 'REJECT' then
    if v_transfer.to_user_id <> v_actor then
      raise exception 'Nur die angefragte Person darf ablehnen.'
        using errcode = '42501';
    end if;

    if length(v_response_reason) < 1 then
      raise exception 'Eine Begründung für die Ablehnung ist erforderlich.'
        using errcode = '22023';
    end if;

    update app_modules.task_transfers
    set status = 'REJECTED',
        responded_at = now(),
        responded_by = v_actor,
        response_reason = v_response_reason,
        revision = revision + 1
    where id = v_transfer.id;

    perform app_private.task_history_add_entry(
      v_task.id,
      v_actor,
      'TRANSFER_REJECTED',
      format('%s hat die Übertragung abgelehnt.', v_transfer.to_name_snapshot),
      jsonb_build_object(
        'transferId', v_transfer.id,
        'responseReason', v_response_reason
      )
    );

    perform app_private.task_notification_queue(
      v_task.id,
      v_actor,
      'TASK_TRANSFER_REJECTED',
      'Aufgabenübertragung abgelehnt',
      v_task.title || ': ' || v_response_reason,
      'task-transfer-rejected:' || v_transfer.id::text,
      coalesce(v_transfer.from_user_id, v_transfer.requested_by)
    );
  elsif v_operation = 'CANCEL' then
    if not (
      v_transfer.requested_by = v_actor
      or v_task.assigned_user_id = v_actor
      or app_private.task_is_manageable(v_actor, v_task.id)
    ) then
      raise exception 'Übertragung darf nicht zurückgezogen werden.'
        using errcode = '42501';
    end if;

    if length(v_response_reason) < 1 then
      raise exception 'Eine Begründung für das Zurückziehen ist erforderlich.'
        using errcode = '22023';
    end if;

    update app_modules.task_transfers
    set status = 'CANCELLED',
        responded_at = now(),
        responded_by = v_actor,
        response_reason = v_response_reason,
        revision = revision + 1
    where id = v_transfer.id;

    perform app_private.task_history_add_entry(
      v_task.id,
      v_actor,
      'TRANSFER_CANCELLED',
      'Übertragungsanfrage wurde zurückgezogen.',
      jsonb_build_object(
        'transferId', v_transfer.id,
        'responseReason', v_response_reason
      )
    );

    perform app_private.task_notification_queue(
      v_task.id,
      v_actor,
      'TASK_TRANSFER_CANCELLED',
      'Aufgabenübertragung zurückgezogen',
      v_task.title,
      'task-transfer-cancelled:' || v_transfer.id::text,
      v_transfer.to_user_id
    );
  else
    raise exception 'Unbekannte Übertragungsoperation.' using errcode = '22023';
  end if;

  perform app_private.log_audit(
    v_actor,
    'TASK_TRANSFER_' || v_operation,
    'task_transfer',
    v_transfer.id::text,
    to_jsonb(v_transfer),
    jsonb_build_object(
      'status', case v_operation
        when 'ACCEPT' then 'ACCEPTED'
        when 'REJECT' then 'REJECTED'
        else 'CANCELLED'
      end,
      'responseReason', v_response_reason
    )
  );

  return app_private.api_tasks_snapshot();
end;
$$;

alter function app_private.api_archive_task(jsonb)
  rename to api_archive_task_before_workflow_r2;

create or replace function app_private.api_archive_task(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_result jsonb;
  v_transfer app_modules.task_transfers%rowtype;
begin
  v_result := app_private.api_archive_task_before_workflow_r2(p_payload);

  update app_modules.tasks
  set status_changed_at = now(),
      status_changed_by = v_actor,
      waiting_reason = '',
      waiting_deadline = null,
      waiting_started_at = null,
      waiting_started_by = null
  where id = v_id;

  for v_transfer in
    select * from app_modules.task_transfers
    where task_id = v_id and status = 'PENDING'
    for update
  loop
    update app_modules.task_transfers
    set status = 'CANCELLED',
        responded_at = now(),
        responded_by = v_actor,
        response_reason = 'Aufgabe wurde archiviert.',
        revision = revision + 1
    where id = v_transfer.id;

    perform app_private.task_history_add_entry(
      v_id,
      v_actor,
      'TRANSFER_CANCELLED',
      'Offene Übertragung wurde durch die Archivierung beendet.',
      jsonb_build_object('transferId', v_transfer.id)
    );
  end loop;

  return app_private.api_tasks_snapshot();
end;
$$;

alter function app_private.api_restore_task(jsonb)
  rename to api_restore_task_before_workflow_r2;

create or replace function app_private.api_restore_task(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
begin
  perform app_private.api_restore_task_before_workflow_r2(p_payload);

  update app_modules.tasks
  set status_changed_at = now(),
      status_changed_by = v_actor
  where id = v_id;

  return app_private.api_tasks_snapshot();
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_task_workflow_r2;

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
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  if v_action = 'task_transfer' then
    v_data := app_private.api_task_transfer(coalesce(p_payload, '{}'::jsonb));
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  return public.pd_api_before_task_workflow_r2(p_action, p_payload);
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

revoke all on function app_private.task_initial_status_metadata()
  from public, anon, authenticated;
revoke all on function app_private.task_notification_queue(uuid, uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
revoke all on function app_private.task_transfer_target_allowed(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function app_private.task_expire_pending_transfers()
  from public, anon, authenticated;
revoke all on function app_private.api_tasks_snapshot_before_workflow_r2()
  from public, anon, authenticated;
revoke all on function app_private.api_tasks_snapshot()
  from public, anon, authenticated;
revoke all on function app_private.api_task_history_snapshot_before_workflow_r2(uuid)
  from public, anon, authenticated;
revoke all on function app_private.api_task_history_snapshot(uuid)
  from public, anon, authenticated;
revoke all on function app_private.api_save_task_before_workflow_r2(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_save_task(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_set_task_status_before_workflow_r2(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_set_task_status(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_save_task_note_before_workflow_r2(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_save_task_note(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_task_transfer(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_archive_task_before_workflow_r2(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_archive_task(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_restore_task_before_workflow_r2(jsonb)
  from public, anon, authenticated;
revoke all on function app_private.api_restore_task(jsonb)
  from public, anon, authenticated;
revoke all on function public.pd_api_before_task_workflow_r2(text, jsonb)
  from public, anon, authenticated;
revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;
