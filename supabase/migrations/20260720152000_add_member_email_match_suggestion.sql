create or replace function app_private.api_member_match(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_payload ->> 'email', '')));
  v_user_id uuid := nullif(p_payload ->> 'userId', '')::uuid;
  v_match_count integer := 0;
  v_member jsonb := null;
begin
  perform app_private.require_capability('users.manage');

  if v_email = '' then
    return jsonb_build_object(
      'status', 'NONE',
      'count', 0,
      'member', null
    );
  end if;

  select count(*)
  into v_match_count
  from app_fanclub.members as member
  where member.status = 'ACTIVE'
    and lower(btrim(coalesce(member.email, ''))) = v_email
    and not exists (
      select 1
      from app_portal.user_member_links as link
      where link.member_id = member.id
        and (
          v_user_id is null
          or link.user_id <> v_user_id
        )
    );

  if v_match_count = 1 then
    select jsonb_build_object(
      'id', member.id,
      'memberCode', member.member_code,
      'firstName', member.first_name,
      'lastName', member.last_name,
      'email', member.email
    )
    into v_member
    from app_fanclub.members as member
    where member.status = 'ACTIVE'
      and lower(btrim(coalesce(member.email, ''))) = v_email
      and not exists (
        select 1
        from app_portal.user_member_links as link
        where link.member_id = member.id
          and (
            v_user_id is null
            or link.user_id <> v_user_id
          )
      )
    limit 1;
  end if;

  return jsonb_build_object(
    'status', case
      when v_match_count = 1 then 'MATCH'
      when v_match_count > 1 then 'AMBIGUOUS'
      else 'NONE'
    end,
    'count', v_match_count,
    'member', v_member
  );
end;
$$;

revoke all on function app_private.api_member_match(jsonb)
from public, anon, authenticated;

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

revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;
