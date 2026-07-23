-- Plärrdeifl Portal V4
-- Chronologischer Aufgabenverlauf R1
-- Bearbeitungsfenster für eigene manuelle Updates: 30 Minuten
-- Ausschließlich für Supabase DEV vorgesehen.
-- FIX2: task_notes besitzt keine ID- oder Zeitstempelspalten.

do $$
begin
  if to_regclass('app_modules.task_updates') is not null then
    raise exception 'Task History R1 ist bereits installiert.'
      using errcode = '42P07';
  end if;

  if to_regprocedure(
    'app_private.api_save_task_history_r1_base(jsonb)'
  ) is not null then
    raise exception 'Task History R1 Basisfunktionen existieren bereits.'
      using errcode = '42710';
  end if;
end;
$$;

create table app_modules.task_updates (
  id uuid primary key default extensions.gen_random_uuid(),
  task_id uuid
    references app_modules.tasks(id)
    on delete set null,
  task_id_snapshot uuid not null,
  task_title_snapshot text not null default '',
  entry_type text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  visibility text not null default 'TASK',
  is_system boolean not null default false,
  author_user_id uuid
    references app_portal.users(id)
    on delete set null,
  author_name_snapshot text not null default '',
  created_at timestamptz not null default now(),
  editable_until timestamptz,
  edited_at timestamptz,
  edited_by uuid
    references app_portal.users(id)
    on delete set null,
  edit_count integer not null default 0,
  hidden_at timestamptz,
  hidden_by uuid
    references app_portal.users(id)
    on delete set null,
  hidden_reason text not null default '',
  revision integer not null default 1,
  source_note_id uuid unique,
  constraint task_updates_entry_type_check
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
        'TASK_DELETED'
      )
    ),
  constraint task_updates_visibility_check
    check (visibility in ('TASK', 'PRIVATE')),
  constraint task_updates_content_check
    check (
      length(btrim(content)) between 1 and 4000
    ),
  constraint task_updates_hidden_reason_check
    check (length(hidden_reason) <= 1000),
  constraint task_updates_edit_count_check
    check (edit_count >= 0)
);

create index task_updates_task_created_idx
  on app_modules.task_updates(task_id_snapshot, created_at desc, id desc);

create index task_updates_visible_task_idx
  on app_modules.task_updates(task_id, created_at desc)
  where hidden_at is null;

alter table app_modules.task_updates enable row level security;

revoke all on table app_modules.task_updates
  from public, anon, authenticated;

comment on table app_modules.task_updates is
  'Chronologischer, revisionssicherer Aufgabenverlauf. '
  'Manuelle Updates sind für den Autor 30 Minuten bearbeitbar.';

insert into app_modules.task_updates (
  task_id,
  task_id_snapshot,
  task_title_snapshot,
  entry_type,
  content,
  metadata,
  visibility,
  is_system,
  author_user_id,
  author_name_snapshot,
  created_at,
  editable_until,
  edited_at,
  source_note_id
)
select
  note.task_id,
  note.task_id,
  task.title,
  'LEGACY_NOTE',
  left(btrim(note.content), 4000),
  jsonb_build_object(
    'legacyRevision', note.revision,
    'legacyTimestampAvailable', false
  ),
  'PRIVATE',
  false,
  note.user_id,
  coalesce(
    nullif(
      btrim(concat_ws(' ', author.first_name, author.last_name)),
      ''
    ),
    'Unbekannter Benutzer'
  ),
  now(),
  now(),
  null,
  md5(note.task_id::text || ':' || note.user_id::text)::uuid
from app_modules.task_notes as note
join app_modules.tasks as task
  on task.id = note.task_id
left join app_portal.users as author
  on author.id = note.user_id
where length(btrim(coalesce(note.content, ''))) > 0
on conflict (source_note_id) do nothing;

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
    when 'DONE' then 'Erledigt'
    when 'ARCHIVED' then 'Archiviert'
    else coalesce(p_status, 'Unbekannt')
  end;
$$;

create or replace function app_private.task_history_priority_label(
  p_priority text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case upper(coalesce(p_priority, ''))
    when 'URGENT' then 'Dringend'
    when 'HIGH' then 'Hoch'
    when 'NORMAL' then 'Normal'
    when 'LOW' then 'Niedrig'
    else coalesce(p_priority, 'Unbekannt')
  end;
$$;

create or replace function app_private.task_history_user_name(
  p_user_id uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select btrim(concat_ws(' ', portal_user.first_name, portal_user.last_name))
      from app_portal.users as portal_user
      where portal_user.id = p_user_id
    ),
    'Unbekannter Benutzer'
  );
$$;

create or replace function app_private.task_history_add_entry(
  p_task_id uuid,
  p_actor uuid,
  p_entry_type text,
  p_content text,
  p_metadata jsonb default '{}'::jsonb,
  p_is_system boolean default true,
  p_visibility text default 'TASK',
  p_editable_until timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task app_modules.tasks%rowtype;
  v_entry_id uuid;
begin
  select *
  into v_task
  from app_modules.tasks
  where id = p_task_id;

  if v_task.id is null then
    raise exception 'Aufgabe für Verlaufseintrag wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  insert into app_modules.task_updates (
    task_id,
    task_id_snapshot,
    task_title_snapshot,
    entry_type,
    content,
    metadata,
    visibility,
    is_system,
    author_user_id,
    author_name_snapshot,
    editable_until
  )
  values (
    v_task.id,
    v_task.id,
    v_task.title,
    p_entry_type,
    left(btrim(p_content), 4000),
    coalesce(p_metadata, '{}'::jsonb),
    p_visibility,
    p_is_system,
    p_actor,
    app_private.task_history_user_name(p_actor),
    p_editable_until
  )
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

create or replace function app_private.task_history_can_moderate(
  p_user_id uuid,
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    app_private.has_capability(p_user_id, 'tasks.manage')
    or app_private.task_can_reopen_or_archive(p_user_id, p_task_id);
$$;

create or replace function app_private.api_task_history_snapshot(
  p_task_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_active_user();
  v_can_moderate boolean;
begin
  if not exists (
    select 1
    from app_modules.tasks as task
    where task.id = p_task_id
      and app_private.task_is_visible(v_user_id, task.id)
  ) then
    raise exception 'Aufgabe wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  v_can_moderate :=
    app_private.task_history_can_moderate(v_user_id, p_task_id);

  return jsonb_build_object(
    'taskId', p_task_id,
    'editWindowMinutes', 30,
    'canAddUpdate', exists (
      select 1
      from app_modules.tasks as task
      where task.id = p_task_id
        and task.status <> 'ARCHIVED'
        and app_private.task_is_visible(v_user_id, task.id)
    ),
    'canModerate', v_can_moderate,
    'entries', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', entry.id,
            'entryType', entry.entry_type,
            'content', case
              when entry.hidden_at is not null
                then 'Dieser Eintrag wurde ausgeblendet.'
              else entry.content
            end,
            'metadata', entry.metadata,
            'visibility', entry.visibility,
            'system', entry.is_system,
            'authorUserId', entry.author_user_id,
            'authorName', entry.author_name_snapshot,
            'createdAt', entry.created_at,
            'editableUntil', entry.editable_until,
            'editedAt', entry.edited_at,
            'editCount', entry.edit_count,
            'hidden', entry.hidden_at is not null,
            'hiddenAt', entry.hidden_at,
            'hiddenReason', case
              when v_can_moderate then entry.hidden_reason
              else ''
            end,
            'revision', entry.revision,
            'canEdit',
              not entry.is_system
              and entry.hidden_at is null
              and entry.author_user_id = v_user_id
              and entry.editable_until is not null
              and now() <= entry.editable_until,
            'canHide',
              v_can_moderate
              and entry.hidden_at is null
          )
          order by entry.created_at desc, entry.id desc
        ),
        '[]'::jsonb
      )
      from app_modules.task_updates as entry
      where entry.task_id_snapshot = p_task_id
        and (
          entry.visibility = 'TASK'
          or entry.author_user_id = v_user_id
        )
    )
  );
end;
$$;

alter function app_private.api_save_task(jsonb)
  rename to api_save_task_history_r1_base;

alter function app_private.api_set_task_status(jsonb)
  rename to api_set_task_status_history_r1_base;

alter function app_private.api_archive_task(jsonb)
  rename to api_archive_task_history_r1_base;

alter function app_private.api_restore_task(jsonb)
  rename to api_restore_task_history_r1_base;

alter function app_private.api_delete_archived_task(jsonb)
  rename to api_delete_archived_task_history_r1_base;

alter function app_private.api_save_task_note(jsonb)
  rename to api_save_task_note_history_r1_base;

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
  v_before app_modules.tasks%rowtype;
  v_after app_modules.tasks%rowtype;
  v_result jsonb;
  v_old_assignee text;
  v_new_assignee text;
begin
  if v_id is not null then
    select *
    into v_before
    from app_modules.tasks
    where id = v_id;
  end if;

  v_result :=
    app_private.api_save_task_history_r1_base(p_payload);

  if v_id is null then
    select *
    into v_after
    from app_modules.tasks
    where created_by = v_actor
      and title = btrim(coalesce(p_payload ->> 'title', ''))
    order by created_at desc
    limit 1;

    if v_after.id is not null then
      perform app_private.task_history_add_entry(
        v_after.id,
        v_actor,
        'TASK_CREATED',
        'Aufgabe wurde erstellt.',
        jsonb_build_object(
          'title', v_after.title,
          'context', v_after.context_type,
          'teamId', v_after.team_id
        )
      );
    end if;

    return v_result;
  end if;

  select *
  into v_after
  from app_modules.tasks
  where id = v_id;

  if v_after.id is null then
    return v_result;
  end if;

  if v_before.priority is distinct from v_after.priority then
    perform app_private.task_history_add_entry(
      v_id,
      v_actor,
      'PRIORITY_CHANGED',
      format(
        'Priorität wurde von %s auf %s geändert.',
        app_private.task_history_priority_label(v_before.priority),
        app_private.task_history_priority_label(v_after.priority)
      ),
      jsonb_build_object(
        'before', v_before.priority,
        'after', v_after.priority
      )
    );
  end if;

  if v_before.assigned_user_id is distinct from v_after.assigned_user_id then
    v_old_assignee := case
      when v_before.assigned_user_id is null then 'Noch offen'
      else app_private.task_history_user_name(v_before.assigned_user_id)
    end;

    v_new_assignee := case
      when v_after.assigned_user_id is null then 'Noch offen'
      else app_private.task_history_user_name(v_after.assigned_user_id)
    end;

    perform app_private.task_history_add_entry(
      v_id,
      v_actor,
      'ASSIGNEE_CHANGED',
      format(
        'Zuständigkeit wurde von %s auf %s geändert.',
        v_old_assignee,
        v_new_assignee
      ),
      jsonb_build_object(
        'beforeUserId', v_before.assigned_user_id,
        'afterUserId', v_after.assigned_user_id,
        'beforeName', v_old_assignee,
        'afterName', v_new_assignee
      )
    );
  end if;

  if v_before.title is distinct from v_after.title
     or v_before.description is distinct from v_after.description
     or v_before.context_type is distinct from v_after.context_type
     or v_before.team_id is distinct from v_after.team_id
     or v_before.assignment_reason is distinct from v_after.assignment_reason then
    perform app_private.task_history_add_entry(
      v_id,
      v_actor,
      'TASK_CHANGED',
      'Aufgabendaten wurden aktualisiert.',
      jsonb_build_object(
        'titleChanged', v_before.title is distinct from v_after.title,
        'descriptionChanged',
          v_before.description is distinct from v_after.description,
        'contextChanged',
          v_before.context_type is distinct from v_after.context_type,
        'teamChanged', v_before.team_id is distinct from v_after.team_id,
        'assignmentReasonChanged',
          v_before.assignment_reason
            is distinct from v_after.assignment_reason
      )
    );
  end if;

  return v_result;
end;
$$;

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
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_before app_modules.tasks%rowtype;
  v_after app_modules.tasks%rowtype;
  v_result jsonb;
  v_type text := 'STATUS_CHANGED';
begin
  select *
  into v_before
  from app_modules.tasks
  where id = v_id;

  v_result :=
    app_private.api_set_task_status_history_r1_base(p_payload);

  select *
  into v_after
  from app_modules.tasks
  where id = v_id;

  if v_after.status = 'DONE' then
    v_type := 'TASK_COMPLETED';
  elsif v_before.status = 'DONE' and v_after.status = 'OPEN' then
    v_type := 'TASK_REOPENED';
  end if;

  perform app_private.task_history_add_entry(
    v_id,
    v_actor,
    v_type,
    format(
      'Status wurde von %s auf %s geändert.',
      app_private.task_history_status_label(v_before.status),
      app_private.task_history_status_label(v_after.status)
    ),
    jsonb_build_object(
      'before', v_before.status,
      'after', v_after.status
    )
  );

  return v_result;
end;
$$;

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
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_result jsonb;
begin
  v_result :=
    app_private.api_archive_task_history_r1_base(p_payload);

  perform app_private.task_history_add_entry(
    v_id,
    v_actor,
    'TASK_ARCHIVED',
    'Aufgabe wurde archiviert.'
  );

  return v_result;
end;
$$;

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
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_result jsonb;
begin
  v_result :=
    app_private.api_restore_task_history_r1_base(p_payload);

  perform app_private.task_history_add_entry(
    v_id,
    v_actor,
    'TASK_RESTORED',
    'Aufgabe wurde wiederhergestellt.'
  );

  return v_result;
end;
$$;

create or replace function app_private.api_delete_archived_task(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_result jsonb;
begin
  perform app_private.task_history_add_entry(
    v_id,
    v_actor,
    'TASK_DELETED',
    'Archivierte Aufgabe wurde endgültig gelöscht.'
  );

  v_result :=
    app_private.api_delete_archived_task_history_r1_base(p_payload);

  return v_result;
end;
$$;

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
  v_operation text :=
    upper(btrim(coalesce(p_payload ->> 'operation', '')));
  v_task_id uuid :=
    nullif(
      coalesce(p_payload ->> 'taskId', p_payload ->> 'id'),
      ''
    )::uuid;
  v_entry_id uuid := nullif(p_payload ->> 'entryId', '')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_content text :=
    left(btrim(coalesce(p_payload ->> 'content', '')), 4000);
  v_reason text :=
    left(btrim(coalesce(p_payload ->> 'reason', '')), 1000);
  v_entry app_modules.task_updates%rowtype;
  v_before jsonb;
  v_result jsonb;
begin
  -- Rückwärtskompatibilität für eine kurzzeitig noch alte DEV-Oberfläche.
  if v_operation = '' then
    v_result :=
      app_private.api_save_task_note_history_r1_base(p_payload);

    if v_task_id is not null and length(v_content) > 0 then
      perform app_private.task_history_add_entry(
        v_task_id,
        v_actor,
        'UPDATE',
        v_content,
        jsonb_build_object('legacyClient', true),
        false,
        'PRIVATE',
        now() + interval '30 minutes'
      );
    end if;

    return v_result;
  end if;

  if v_operation = 'LIST' then
    return app_private.api_task_history_snapshot(v_task_id);
  end if;

  if v_operation = 'ADD' then
    if length(v_content) < 1 then
      raise exception 'Ein Update-Text ist erforderlich.'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from app_modules.tasks as task
      where task.id = v_task_id
        and task.status <> 'ARCHIVED'
        and app_private.task_is_visible(v_actor, task.id)
    ) then
      raise exception
        'Aufgabe wurde nicht gefunden oder kann nicht ergänzt werden.'
        using errcode = 'P0002';
    end if;

    v_entry_id := app_private.task_history_add_entry(
      v_task_id,
      v_actor,
      'UPDATE',
      v_content,
      '{}'::jsonb,
      false,
      'TASK',
      now() + interval '30 minutes'
    );

    perform app_private.log_audit(
      v_actor,
      'TASK_UPDATE_CREATED',
      'task_update',
      v_entry_id::text,
      null,
      jsonb_build_object(
        'taskId', v_task_id,
        'editableForMinutes', 30
      )
    );

    return app_private.api_task_history_snapshot(v_task_id);
  end if;

  select *
  into v_entry
  from app_modules.task_updates
  where id = v_entry_id
  for update;

  if v_entry.id is null then
    raise exception 'Verlaufseintrag wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  v_task_id := v_entry.task_id_snapshot;

  if v_operation = 'EDIT' then
    if v_entry.is_system
       or v_entry.hidden_at is not null
       or v_entry.author_user_id <> v_actor then
      raise exception 'Dieser Eintrag darf nicht bearbeitet werden.'
        using errcode = '42501';
    end if;

    if v_entry.editable_until is null
       or now() > v_entry.editable_until then
      raise exception
        'Das 30-Minuten-Bearbeitungsfenster ist abgelaufen. '
        'Bitte eine neue Korrektur als Update hinzufügen.'
        using errcode = '42501';
    end if;

    if v_expected_revision is null
       or v_expected_revision <> v_entry.revision then
      raise exception
        'Der Verlaufseintrag wurde zwischenzeitlich geändert. '
        'Bitte Verlauf aktualisieren.'
        using errcode = '40001';
    end if;

    if length(v_content) < 1 then
      raise exception 'Ein Update-Text ist erforderlich.'
        using errcode = '22023';
    end if;

    v_before := to_jsonb(v_entry);

    update app_modules.task_updates
    set content = v_content,
        edited_at = now(),
        edited_by = v_actor,
        edit_count = edit_count + 1,
        revision = revision + 1
    where id = v_entry_id;

    perform app_private.log_audit(
      v_actor,
      'TASK_UPDATE_EDITED',
      'task_update',
      v_entry_id::text,
      v_before,
      jsonb_build_object(
        'taskId', v_task_id,
        'content', v_content,
        'revision', v_entry.revision + 1
      )
    );

    return app_private.api_task_history_snapshot(v_task_id);
  end if;

  if v_operation = 'HIDE' then
    if not app_private.task_history_can_moderate(v_actor, v_task_id) then
      raise exception
        'Nur zuständige Leitung, Vorstand oder Administration '
        'dürfen Verlaufseinträge ausblenden.'
        using errcode = '42501';
    end if;

    if v_entry.hidden_at is not null then
      raise exception 'Der Eintrag wurde bereits ausgeblendet.'
        using errcode = '23514';
    end if;

    if length(v_reason) < 1 then
      raise exception 'Eine Begründung für das Ausblenden ist erforderlich.'
        using errcode = '22023';
    end if;

    v_before := to_jsonb(v_entry);

    update app_modules.task_updates
    set hidden_at = now(),
        hidden_by = v_actor,
        hidden_reason = v_reason,
        revision = revision + 1
    where id = v_entry_id;

    perform app_private.log_audit(
      v_actor,
      'TASK_UPDATE_HIDDEN',
      'task_update',
      v_entry_id::text,
      v_before,
      jsonb_build_object(
        'taskId', v_task_id,
        'reason', v_reason,
        'revision', v_entry.revision + 1
      )
    );

    return app_private.api_task_history_snapshot(v_task_id);
  end if;

  raise exception 'Unbekannte Aufgabenverlaufsoperation: %', v_operation
    using errcode = '22023';
end;
$$;

comment on function app_private.api_save_task_note(jsonb) is
  'Task History R1 Multiplexer: LIST, ADD, EDIT, HIDE. '
  'Eigene Updates sind serverseitig exakt 30 Minuten bearbeitbar.';
