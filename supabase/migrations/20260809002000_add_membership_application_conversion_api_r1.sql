alter function app_private.api_membership_application_detail(jsonb)
  rename to api_membership_application_detail_before_conversion_r1;

create or replace function app_private.api_membership_application_detail(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_id uuid;
begin
  v_result := app_private.api_membership_application_detail_before_conversion_r1(p_payload);
  v_id := (v_result ->> 'id')::uuid;

  select v_result || jsonb_build_object(
    'convertedAt', application.converted_at,
    'convertedBy', application.converted_by,
    'convertedMemberId', application.converted_member_id,
    'conversionMode', application.conversion_mode
  )
  into v_result
  from app_fanclub.membership_applications as application
  where application.id = v_id;

  return v_result;
end;
$$;

create or replace function app_private.api_membership_application_convert(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_id uuid;
  v_expected_revision integer;
  v_mode text := upper(btrim(coalesce(p_payload ->> 'mode', '')));
  v_target_member_provided boolean := p_payload ? 'targetMemberId';
  v_target_member_text text := nullif(btrim(coalesce(p_payload ->> 'targetMemberId', '')), '');
  v_target_member_id uuid;
  v_application app_fanclub.membership_applications%rowtype;
  v_member app_fanclub.members%rowtype;
  v_member_id uuid;
  v_converted_at timestamptz := now();
  v_audit_metadata jsonb;
begin
  v_actor := app_private.m150_require_current_board_member();

  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception when invalid_text_representation then
    raise exception 'M150_INVALID_CONVERSION_PAYLOAD' using errcode = '22023';
  end;

  if v_id is null
     or v_expected_revision is null
     or v_mode not in (
       'NEW_MEMBER',
       'REACTIVATE_EXISTING',
       'RESOLVE_EXISTING_ACTIVE'
     ) then
    raise exception 'M150_INVALID_CONVERSION_PAYLOAD' using errcode = '22023';
  end if;

  if v_mode = 'NEW_MEMBER' and v_target_member_provided then
    raise exception 'M150_NEW_MEMBER_TARGET_FORBIDDEN' using errcode = '22023';
  end if;

  if v_mode in ('REACTIVATE_EXISTING', 'RESOLVE_EXISTING_ACTIVE')
     and v_target_member_text is null then
    raise exception 'M150_TARGET_MEMBER_REQUIRED' using errcode = '22023';
  end if;

  if v_target_member_text is not null then
    begin
      v_target_member_id := v_target_member_text::uuid;
    exception when invalid_text_representation then
      raise exception 'M150_INVALID_TARGET_MEMBER_ID' using errcode = '22023';
    end;
  end if;

  select application.*
  into v_application
  from app_fanclub.membership_applications as application
  where application.id = v_id
  for update;

  if not found then
    raise exception 'M150_APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_application.revision <> v_expected_revision then
    raise exception 'M150_REVISION_CONFLICT' using errcode = '40001';
  end if;

  if v_application.status <> 'APPROVED' then
    raise exception 'M150_CONVERSION_REQUIRES_APPROVED' using errcode = 'P1506';
  end if;

  if v_application.converted_at is not null then
    raise exception 'M150_APPLICATION_ALREADY_CONVERTED' using errcode = 'P1507';
  end if;

  if v_mode = 'NEW_MEMBER' then
    insert into app_fanclub.members (
      first_name,
      last_name,
      birth_date,
      email,
      phone,
      street,
      house_number,
      postal_code,
      city,
      joined_on,
      left_on,
      status
    ) values (
      v_application.first_name,
      v_application.last_name,
      v_application.birth_date,
      v_application.email,
      v_application.phone,
      v_application.street,
      v_application.house_number,
      v_application.postal_code,
      v_application.city,
      (v_application.submitted_at at time zone 'Europe/Berlin')::date,
      null,
      'ACTIVE'
    )
    returning id into v_member_id;
  else
    select member.*
    into v_member
    from app_fanclub.members as member
    where member.id = v_target_member_id
    for update;

    if not found then
      raise exception 'M150_TARGET_MEMBER_NOT_FOUND' using errcode = 'P0002';
    end if;

    v_member_id := v_member.id;

    if v_mode = 'REACTIVATE_EXISTING' then
      if v_member.status = 'ACTIVE' then
        raise exception 'M150_REACTIVATION_REQUIRES_INACTIVE_MEMBER' using errcode = '22023';
      end if;

      if exists (
        select 1
        from app_fanclub.office_slots as office
        where office.member_id = v_member_id
      ) then
        raise exception 'M150_REACTIVATION_OFFICE_ASSIGNMENT_REQUIRES_REVIEW'
          using errcode = '23514';
      end if;

      update app_fanclub.members as member
      set status = 'ACTIVE',
          left_on = null,
          joined_on = (v_application.submitted_at at time zone 'Europe/Berlin')::date,
          revision = member.revision + 1,
          updated_at = now()
      where member.id = v_member_id;
    elsif v_member.status <> 'ACTIVE' then
      raise exception 'M150_RESOLUTION_REQUIRES_ACTIVE_MEMBER' using errcode = '22023';
    end if;
  end if;

  update app_fanclub.membership_applications as application
  set converted_at = v_converted_at,
      converted_by = v_actor,
      converted_member_id = v_member_id,
      conversion_mode = v_mode,
      revision = application.revision + 1,
      updated_at = v_converted_at
  where application.id = v_id;

  v_audit_metadata := jsonb_build_object(
    'conversionMode', v_mode,
    'memberId', v_member_id,
    'convertedBy', v_actor,
    'convertedAt', v_converted_at,
    'newMemberCreated', v_mode = 'NEW_MEMBER',
    'memberMutationPerformed', v_mode in ('NEW_MEMBER', 'REACTIVATE_EXISTING')
  );

  if v_mode = 'REACTIVATE_EXISTING' then
    v_audit_metadata := v_audit_metadata || jsonb_build_object(
      'previousStatus', v_member.status,
      'previousJoinedOn', v_member.joined_on,
      'previousLeftOn', v_member.left_on
    );
  end if;

  perform app_private.log_audit(
    v_actor,
    'MEMBERSHIP_APPLICATION_CONVERTED',
    'membership_application',
    v_id::text,
    null,
    null,
    v_audit_metadata
  );

  return app_private.api_membership_application_detail(jsonb_build_object('id', v_id));
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_membership_application_conversion_r1;

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

  case v_action
    when 'membership_application_detail' then
      v_data := app_private.api_membership_application_detail(coalesce(p_payload, '{}'::jsonb));
    when 'membership_application_convert' then
      v_data := app_private.api_membership_application_convert(coalesce(p_payload, '{}'::jsonb));
    else
      return public.pd_api_before_membership_application_conversion_r1(p_action, p_payload);
  end case;

  return jsonb_build_object('ok', true, 'data', v_data);
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', sqlstate, 'message', sqlerrm)
    );
end;
$$;

revoke all on function app_private.api_membership_application_detail_before_conversion_r1(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_membership_application_detail(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_membership_application_convert(jsonb)
from public, anon, authenticated;
revoke all on function public.pd_api_before_membership_application_conversion_r1(text, jsonb)
from public, anon, authenticated;
revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated;

grant execute on function public.pd_api(text, jsonb)
to authenticated;
