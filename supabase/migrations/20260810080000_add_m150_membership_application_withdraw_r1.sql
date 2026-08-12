create or replace function app_private.api_membership_application_withdraw(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_id uuid;
  v_expected_revision integer;
  v_application app_fanclub.membership_applications%rowtype;
  v_withdrawn_at timestamptz := now();
begin
  v_actor := app_private.m150_require_current_board_member();

  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not (p_payload ? 'id')
     or not (p_payload ? 'expectedRevision')
     or jsonb_typeof(p_payload -> 'id') <> 'string'
     or jsonb_typeof(p_payload -> 'expectedRevision') <> 'number'
     or (p_payload ->> 'expectedRevision') !~ '^[1-9][0-9]*$'
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key not in ('id', 'expectedRevision')
     ) then
    raise exception 'M150_INVALID_WITHDRAW_PAYLOAD' using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(p_payload ->> 'id'), '')::uuid;
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'M150_INVALID_WITHDRAW_PAYLOAD' using errcode = '22023';
  end;

  if v_id is null or v_expected_revision is null or v_expected_revision < 1 then
    raise exception 'M150_INVALID_WITHDRAW_PAYLOAD' using errcode = '22023';
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

  if v_application.status = 'WITHDRAWN' then
    raise exception 'M150_APPLICATION_ALREADY_WITHDRAWN' using errcode = 'P1508';
  end if;

  if v_application.status <> 'PENDING' then
    raise exception 'M150_WITHDRAW_REQUIRES_PENDING' using errcode = 'P1509';
  end if;

  update app_fanclub.membership_applications as application
  set status = 'WITHDRAWN',
      revision = application.revision + 1,
      updated_at = v_withdrawn_at
  where application.id = v_id;

  perform app_private.log_audit(
    v_actor,
    'MEMBERSHIP_APPLICATION_WITHDRAWN',
    'membership_application',
    v_id::text,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object('status', 'WITHDRAWN'),
    jsonb_build_object('withdrawnAt', v_withdrawn_at)
  );

  return app_private.api_membership_application_detail(jsonb_build_object('id', v_id));
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_membership_application_withdraw_r1;

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
    when 'membership_application_withdraw' then
      v_data := app_private.api_membership_application_withdraw(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return public.pd_api_before_membership_application_withdraw_r1(
        p_action,
        p_payload
      );
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

revoke all on function app_private.api_membership_application_withdraw(jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.pd_api_before_membership_application_withdraw_r1(text, jsonb)
from public, anon, authenticated, service_role;
revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.pd_api(text, jsonb)
to authenticated;
