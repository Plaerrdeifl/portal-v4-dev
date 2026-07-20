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
        'canRestore',
          task.status = 'ARCHIVED'
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

create or replace function app_private.api_restore_task(p_payload jsonb)
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

  if v_task.status <> 'ARCHIVED' then
    raise exception 'Nur archivierte Aufgaben können wiederhergestellt werden.'
      using errcode = '23514';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_task.revision then
    raise exception
      'Die Aufgabe wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if not app_private.task_can_reopen_or_archive(v_actor, v_id) then
    raise exception
      'Nur zuständige Leitung, Amtsinhaber oder Administration dürfen Aufgaben wiederherstellen.'
      using errcode = '42501';
  end if;

  update app_modules.tasks
  set status = 'OPEN',
      archived_at = null,
      archived_by = null,
      completed_at = null,
      completed_by = null,
      revision = revision + 1
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'TASK_RESTORED',
    'task',
    v_id::text,
    jsonb_build_object(
      'status', v_task.status,
      'archivedAt', v_task.archived_at,
      'archivedBy', v_task.archived_by,
      'revision', v_task.revision
    ),
    jsonb_build_object(
      'status', 'OPEN',
      'archivedAt', null,
      'archivedBy', null,
      'revision', v_task.revision + 1
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
    when 'restore_task' then
      v_data := app_private.api_restore_task(coalesce(p_payload, '{}'::jsonb));
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

revoke all on function app_private.api_tasks_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_restore_task(jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;
