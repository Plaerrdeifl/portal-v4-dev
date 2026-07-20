do $$
begin
  if exists (
    select 1
    from app_modules.tasks
    where status = 'WAITING'
  ) then
    raise exception
      'Migration abgebrochen: Es existieren Aufgaben mit Status WAITING. Diese müssen vor der Umstellung fachlich geprüft werden.'
      using errcode = '23514';
  end if;
end;
$$;

alter table app_modules.tasks
  add column if not exists archived_by uuid
  references app_portal.users(id) on delete set null;

alter table app_modules.tasks
  drop constraint if exists tasks_status_check;

alter table app_modules.tasks
  add constraint tasks_status_check
  check (status in ('OPEN', 'IN_PROGRESS', 'DONE', 'ARCHIVED'));

create or replace function app_private.task_can_reopen_or_archive(
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
        or (
          task.context_type = 'TEAM'
          and app_private.can_manage_team(p_user_id, task.team_id)
        )
        or (
          task.context_type = 'BOARD'
          and app_private.is_office_holder(p_user_id)
        )
      )
  );
$$;

create or replace function app_private.task_is_manageable(
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
      and task.status <> 'ARCHIVED'
      and (
        app_private.has_capability(p_user_id, 'tasks.manage')
        or task.created_by = p_user_id
        or (
          task.context_type = 'TEAM'
          and app_private.can_manage_team(p_user_id, task.team_id)
        )
        or (
          task.context_type = 'BOARD'
          and app_private.is_office_holder(p_user_id)
        )
      )
  );
$$;

create or replace function app_private.api_tasks_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_active_user();
begin
  return jsonb_build_object(
    'tasks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', task.id,
        'context', task.context_type,
        'teamId', task.team_id,
        'teamName', team.name,
        'title', task.title,
        'description', task.description,
        'priority', task.priority,
        'status', task.status,
        'assignedUserId', task.assigned_user_id,
        'assignedName', assigned.first_name || ' ' || assigned.last_name,
        'assignmentReason', task.assignment_reason,
        'createdBy', task.created_by,
        'createdByName', creator.first_name || ' ' || creator.last_name,
        'createdAt', task.created_at,
        'updatedAt', task.updated_at,
        'completedAt', task.completed_at,
        'completedBy', task.completed_by,
        'archivedAt', task.archived_at,
        'archivedBy', task.archived_by,
        'archivedByName', archived_by.first_name || ' ' || archived_by.last_name,
        'revision', task.revision,
        'canManage', app_private.task_is_manageable(v_user_id, task.id),
        'canChangeStatus',
          task.status in ('OPEN', 'IN_PROGRESS')
          and (
            task.assigned_user_id = v_user_id
            or app_private.task_is_manageable(v_user_id, task.id)
          ),
        'canReopen',
          task.status = 'DONE'
          and app_private.task_can_reopen_or_archive(v_user_id, task.id),
        'canArchive',
          task.status <> 'ARCHIVED'
          and app_private.task_can_reopen_or_archive(v_user_id, task.id),
        'ownNote', note.content,
        'ownNoteRevision', coalesce(note.revision, 0)
      ) order by
        case task.priority
          when 'URGENT' then 1
          when 'HIGH' then 2
          when 'NORMAL' then 3
          else 4
        end,
        task.updated_at desc), '[]'::jsonb)
      from app_modules.tasks as task
      left join app_portal.teams as team
        on team.id = task.team_id
      left join app_portal.users as assigned
        on assigned.id = task.assigned_user_id
      join app_portal.users as creator
        on creator.id = task.created_by
      left join app_portal.users as archived_by
        on archived_by.id = task.archived_by
      left join app_modules.task_notes as note
        on note.task_id = task.id
       and note.user_id = v_user_id
      where app_private.task_is_visible(v_user_id, task.id)
    ),
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', team.id,
        'name', team.name,
        'canManage', app_private.can_manage_team(v_user_id, team.id),
        'memberIds', coalesce((
          select jsonb_agg(membership.user_id order by membership.user_id)
          from app_portal.team_memberships as membership
          where membership.team_id = team.id
            and membership.is_active
        ), '[]'::jsonb)
      ) order by team.name), '[]'::jsonb)
      from app_portal.teams as team
      where team.is_active
        and (
          app_private.has_capability(v_user_id, 'tasks.manage')
          or app_private.is_team_member(v_user_id, team.id)
        )
    ),
    'users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', portal_user.id,
        'name', portal_user.first_name || ' ' || portal_user.last_name,
        'isOfficeHolder', app_private.is_office_holder(portal_user.id),
        'officeLabel', coalesce((
          select office.label
          from app_portal.user_member_links as link
          join app_fanclub.office_slots as office
            on office.member_id = link.member_id
          where link.user_id = portal_user.id
          limit 1
        ), '')
      ) order by portal_user.last_name, portal_user.first_name), '[]'::jsonb)
      from app_portal.users as portal_user
      where portal_user.status = 'ACTIVE'
        and (
          app_private.has_capability(v_user_id, 'tasks.manage')
          or portal_user.id = v_user_id
          or exists (
            select 1
            from app_portal.team_memberships as own_membership
            join app_portal.team_memberships as target_membership
              on target_membership.team_id = own_membership.team_id
             and target_membership.user_id = portal_user.id
             and target_membership.is_active
            where own_membership.user_id = v_user_id
              and own_membership.is_active
              and own_membership.team_role in ('LEAD', 'CO_LEAD')
          )
          or app_private.is_office_holder(v_user_id)
        )
    ),
    'canCreateBoard',
      app_private.has_capability(v_user_id, 'tasks.manage')
      or app_private.is_office_holder(v_user_id),
    'canManageAll', app_private.has_capability(v_user_id, 'tasks.manage')
  );
end;
$$;

create or replace function app_private.api_save_task(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_expected_revision integer := nullif(p_payload ->> 'revision', '')::integer;
  v_context text := upper(coalesce(p_payload ->> 'context', 'TEAM'));
  v_team_id uuid := nullif(p_payload ->> 'teamId', '')::uuid;
  v_title text := btrim(coalesce(p_payload ->> 'title', ''));
  v_description text := left(coalesce(p_payload ->> 'description', ''), 4000);
  v_priority text := upper(coalesce(p_payload ->> 'priority', 'NORMAL'));
  v_assigned_user_id uuid := nullif(p_payload ->> 'assignedUserId', '')::uuid;
  v_assignment_reason text := left(
    btrim(coalesce(p_payload ->> 'assignmentReason', '')),
    1000
  );
  v_existing app_modules.tasks%rowtype;
  v_before jsonb;
begin
  if v_context not in ('TEAM', 'BOARD') then
    raise exception 'Unzulässiger Aufgabenkontext.' using errcode = '22023';
  end if;

  if length(v_title) < 1 or length(v_title) > 300 then
    raise exception 'Der Aufgabentitel ist erforderlich.' using errcode = '22023';
  end if;

  if v_priority not in ('URGENT', 'HIGH', 'NORMAL', 'LOW') then
    raise exception 'Unzulässige Priorität.' using errcode = '22023';
  end if;

  if v_id is not null then
    select *
    into v_existing
    from app_modules.tasks
    where id = v_id
    for update;

    if v_existing.id is null then
      raise exception 'Aufgabe wurde nicht gefunden.' using errcode = 'P0002';
    end if;

    if v_existing.status = 'ARCHIVED' then
      raise exception 'Archivierte Aufgaben können nicht mehr bearbeitet werden.'
        using errcode = '42501';
    end if;

    if not app_private.task_is_manageable(v_actor, v_id) then
      raise exception 'Aufgabe darf nicht bearbeitet werden.' using errcode = '42501';
    end if;

    if v_expected_revision is null
       or v_expected_revision <> v_existing.revision then
      raise exception
        'Die Aufgabe wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
        using errcode = '40001';
    end if;

    v_before := to_jsonb(v_existing);
  end if;

  if v_assigned_user_id is not null and not exists (
    select 1
    from app_portal.users
    where id = v_assigned_user_id
      and status = 'ACTIVE'
  ) then
    raise exception 'Aktiver Zielbenutzer wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  if v_context = 'TEAM' then
    if v_team_id is null then
      raise exception 'Für eine Teamaufgabe ist ein Team erforderlich.'
        using errcode = '22023';
    end if;

    if not exists (
      select 1
      from app_portal.teams
      where id = v_team_id
        and is_active
    ) then
      raise exception 'Aktives Team wurde nicht gefunden.'
        using errcode = '23503';
    end if;

    if not app_private.can_manage_team(v_actor, v_team_id)
       and not app_private.has_capability(v_actor, 'tasks.manage') then
      raise exception
        'Teamaufgaben dürfen nur durch die Teamleitung oder Administration erstellt und bearbeitet werden.'
        using errcode = '42501';
    end if;

    if v_assigned_user_id is not null
       and not app_private.is_team_member(v_assigned_user_id, v_team_id) then
      raise exception
        'Teamaufgaben dürfen nur aktiven Teammitgliedern zugewiesen werden.'
        using errcode = '23514';
    end if;

    v_assignment_reason := '';
  else
    v_team_id := null;

    if not app_private.is_office_holder(v_actor)
       and not app_private.has_capability(v_actor, 'tasks.manage') then
      raise exception
        'Vorstandsaufgaben dürfen nur durch Amtsinhaber oder Administration erstellt und bearbeitet werden.'
        using errcode = '42501';
    end if;

    if v_assigned_user_id is null
       or app_private.is_office_holder(v_assigned_user_id) then
      v_assignment_reason := '';
    elsif length(v_assignment_reason) < 1 then
      raise exception
        'Bei Zuweisung an einen Nicht-Amtsinhaber ist eine Begründung erforderlich.'
        using errcode = '23514';
    end if;
  end if;

  if v_id is null then
    insert into app_modules.tasks (
      context_type,
      team_id,
      title,
      description,
      priority,
      assigned_user_id,
      assignment_reason,
      created_by
    )
    values (
      v_context,
      v_team_id,
      v_title,
      v_description,
      v_priority,
      v_assigned_user_id,
      v_assignment_reason,
      v_actor
    )
    returning id into v_id;

    perform app_private.log_audit(
      v_actor,
      'TASK_CREATED',
      'task',
      v_id::text,
      null,
      jsonb_build_object(
        'context', v_context,
        'teamId', v_team_id,
        'assignedUserId', v_assigned_user_id
      )
    );
  else
    update app_modules.tasks
    set context_type = v_context,
        team_id = v_team_id,
        title = v_title,
        description = v_description,
        priority = v_priority,
        assigned_user_id = v_assigned_user_id,
        assignment_reason = v_assignment_reason,
        revision = revision + 1
    where id = v_id;

    perform app_private.log_audit(
      v_actor,
      'TASK_UPDATED',
      'task',
      v_id::text,
      v_before,
      jsonb_build_object(
        'context', v_context,
        'teamId', v_team_id,
        'assignedUserId', v_assigned_user_id,
        'revision', v_expected_revision + 1
      )
    );
  end if;

  return app_private.api_tasks_snapshot();
end;
$$;

create or replace function app_private.api_set_task_status(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_expected_revision integer := nullif(p_payload ->> 'revision', '')::integer;
  v_status text := upper(coalesce(p_payload ->> 'status', 'OPEN'));
  v_task app_modules.tasks%rowtype;
  v_can_work boolean;
  v_action text := 'TASK_STATUS_UPDATED';
begin
  if v_status not in ('OPEN', 'IN_PROGRESS', 'DONE') then
    raise exception 'Unzulässiger Aufgabenstatus.' using errcode = '22023';
  end if;

  select *
  into v_task
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

  if v_task.status = 'OPEN' and v_status = 'IN_PROGRESS' then
    if not v_can_work then
      raise exception 'Aufgabe darf nicht in Bearbeitung gesetzt werden.'
        using errcode = '42501';
    end if;
  elsif v_task.status = 'IN_PROGRESS' and v_status = 'DONE' then
    if not v_can_work then
      raise exception 'Aufgabe darf nicht erledigt werden.'
        using errcode = '42501';
    end if;
  elsif v_task.status = 'DONE' and v_status = 'OPEN' then
    if not app_private.task_can_reopen_or_archive(v_actor, v_id) then
      raise exception
        'Nur zuständige Leitung, Amtsinhaber oder Administration dürfen Aufgaben wieder öffnen.'
        using errcode = '42501';
    end if;
    v_action := 'TASK_REOPENED';
  else
    raise exception
      'Dieser Statuswechsel ist nicht erlaubt. Zulässig sind Offen → In Bearbeitung → Erledigt sowie die berechtigte Wiederöffnung.'
      using errcode = '23514';
  end if;

  update app_modules.tasks
  set status = v_status,
      completed_at = case
        when v_status = 'DONE' then now()
        else null
      end,
      completed_by = case
        when v_status = 'DONE' then v_actor
        else null
      end,
      revision = revision + 1
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    v_action,
    'task',
    v_id::text,
    jsonb_build_object(
      'status', v_task.status,
      'revision', v_task.revision
    ),
    jsonb_build_object(
      'status', v_status,
      'revision', v_task.revision + 1
    )
  );

  return app_private.api_tasks_snapshot();
end;
$$;

create or replace function app_private.api_archive_task(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_expected_revision integer := nullif(p_payload ->> 'revision', '')::integer;
  v_task app_modules.tasks%rowtype;
begin
  select *
  into v_task
  from app_modules.tasks
  where id = v_id
  for update;

  if v_task.id is null or not app_private.task_is_visible(v_actor, v_id) then
    raise exception 'Aufgabe wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_task.status = 'ARCHIVED' then
    raise exception 'Aufgabe ist bereits archiviert.' using errcode = '23514';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_task.revision then
    raise exception
      'Die Aufgabe wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if not app_private.task_can_reopen_or_archive(v_actor, v_id) then
    raise exception
      'Nur zuständige Leitung, Amtsinhaber oder Administration dürfen Aufgaben archivieren.'
      using errcode = '42501';
  end if;

  update app_modules.tasks
  set status = 'ARCHIVED',
      archived_at = now(),
      archived_by = v_actor,
      revision = revision + 1
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'TASK_ARCHIVED',
    'task',
    v_id::text,
    jsonb_build_object(
      'status', v_task.status,
      'revision', v_task.revision
    ),
    jsonb_build_object(
      'status', 'ARCHIVED',
      'revision', v_task.revision + 1
    )
  );

  return app_private.api_tasks_snapshot();
end;
$$;

create or replace function app_private.api_save_task_note(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_task_id uuid := (p_payload ->> 'taskId')::uuid;
  v_expected_revision integer := coalesce(
    nullif(p_payload ->> 'revision', '')::integer,
    0
  );
  v_content text := left(coalesce(p_payload ->> 'content', ''), 4000);
  v_task_status text;
  v_current_revision integer;
  v_note_exists boolean;
begin
  select status
  into v_task_status
  from app_modules.tasks
  where id = v_task_id
  for update;

  if v_task_status is null
     or not app_private.task_is_visible(v_actor, v_task_id) then
    raise exception 'Aufgabe wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_task_status = 'ARCHIVED' then
    raise exception
      'Notizen archivierter Aufgaben können nicht mehr geändert werden.'
      using errcode = '42501';
  end if;

  select revision
  into v_current_revision
  from app_modules.task_notes
  where task_id = v_task_id
    and user_id = v_actor
  for update;

  v_note_exists := found;

  if not v_note_exists then
    if v_expected_revision <> 0 then
      raise exception
        'Die persönliche Notiz wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
        using errcode = '40001';
    end if;

    insert into app_modules.task_notes (
      task_id,
      user_id,
      content
    )
    values (
      v_task_id,
      v_actor,
      v_content
    );
  else
    if v_expected_revision <> v_current_revision then
      raise exception
        'Die persönliche Notiz wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
        using errcode = '40001';
    end if;

    update app_modules.task_notes
    set content = v_content,
        revision = revision + 1
    where task_id = v_task_id
      and user_id = v_actor;
  end if;

  perform app_private.log_audit(
    v_actor,
    'TASK_NOTE_UPDATED',
    'task_note',
    v_task_id::text || ':' || v_actor::text,
    jsonb_build_object('revision', v_expected_revision),
    jsonb_build_object(
      'revision', case
        when v_note_exists then v_expected_revision + 1
        else 1
      end,
      'contentLength', length(v_content)
    )
  );

  return app_private.api_tasks_snapshot();
end;
$$;

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

  case v_action
    when 'bootstrap' then
      v_data := app_private.api_bootstrap();
    when 'submit_access_request' then
      v_data := app_private.api_submit_access_request(coalesce(p_payload, '{}'::jsonb));
    when 'claim_initial_admin' then
      v_data := app_private.api_claim_initial_admin(coalesce(p_payload, '{}'::jsonb));
    when 'update_profile' then
      v_data := app_private.api_update_profile(coalesce(p_payload, '{}'::jsonb));
    when 'dashboard' then
      v_data := app_private.api_dashboard();
    when 'admin_snapshot' then
      v_data := app_private.api_admin_snapshot();
    when 'member_match' then
      v_data := app_private.api_member_match(coalesce(p_payload, '{}'::jsonb));
    when 'save_role' then
      v_data := app_private.api_save_role(coalesce(p_payload, '{}'::jsonb));
    when 'delete_role' then
      v_data := app_private.api_delete_role(coalesce(p_payload, '{}'::jsonb));
    when 'set_role_capabilities' then
      v_data := app_private.api_set_role_capabilities(coalesce(p_payload, '{}'::jsonb));
    when 'save_user' then
      v_data := app_private.api_save_user(coalesce(p_payload, '{}'::jsonb));
    when 'approve_request' then
      v_data := app_private.api_approve_request(coalesce(p_payload, '{}'::jsonb));
    when 'reject_request' then
      v_data := app_private.api_reject_request(coalesce(p_payload, '{}'::jsonb));
    when 'fanclub_snapshot' then
      v_data := app_private.api_fanclub_snapshot();
    when 'save_member' then
      v_data := app_private.api_save_member(coalesce(p_payload, '{}'::jsonb));
    when 'save_offices' then
      v_data := app_private.api_save_offices(coalesce(p_payload, '{}'::jsonb));
    when 'teams_snapshot' then
      v_data := app_private.api_teams_snapshot();
    when 'save_team' then
      v_data := app_private.api_save_team(coalesce(p_payload, '{}'::jsonb));
    when 'delete_team' then
      v_data := app_private.api_delete_team(coalesce(p_payload, '{}'::jsonb));
    when 'save_team_member' then
      v_data := app_private.api_save_team_member(coalesce(p_payload, '{}'::jsonb));
    when 'remove_team_member' then
      v_data := app_private.api_remove_team_member(coalesce(p_payload, '{}'::jsonb));
    when 'tasks_snapshot' then
      v_data := app_private.api_tasks_snapshot();
    when 'save_task' then
      v_data := app_private.api_save_task(coalesce(p_payload, '{}'::jsonb));
    when 'set_task_status' then
      v_data := app_private.api_set_task_status(coalesce(p_payload, '{}'::jsonb));
    when 'archive_task' then
      v_data := app_private.api_archive_task(coalesce(p_payload, '{}'::jsonb));
    when 'save_task_note' then
      v_data := app_private.api_save_task_note(coalesce(p_payload, '{}'::jsonb));
    else
      raise exception 'Unbekannte Portalaktion: %', v_action using errcode = '22023';
  end case;

  return jsonb_build_object(
    'ok', true,
    'data', v_data
  );
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

revoke all on function app_private.task_can_reopen_or_archive(uuid, uuid)
from public, anon, authenticated;
revoke all on function app_private.task_is_manageable(uuid, uuid)
from public, anon, authenticated;
revoke all on function app_private.api_tasks_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_save_task(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_set_task_status(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_archive_task(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_task_note(jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;