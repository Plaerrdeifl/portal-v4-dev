-- Fanclub-Abschlussrunde: geschützte Mitgliederdetails und interne Beitragscodes.

create or replace function app_private.can_manage_member_details(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_capability(p_user_id, 'portal.admin')
    or app_private.is_office_holder(p_user_id);
$$;

alter function app_private.api_fanclub_snapshot()
rename to api_fanclub_snapshot_before_member_privacy;

create or replace function app_private.api_fanclub_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('members.read');
  v_base jsonb := app_private.api_fanclub_snapshot_before_member_privacy();
  v_members jsonb;
  v_offices jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', member.id,
    'firstName', member.first_name,
    'lastName', member.last_name,
    'joinedOn', member.joined_on,
    'status', member.status
  ) order by member.last_name, member.first_name), '[]'::jsonb)
  into v_members
  from app_fanclub.members as member;

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', office.code,
    'label', office.label,
    'sortOrder', office.sort_order,
    'memberId', office.member_id,
    'memberName', case
      when member.id is null then ''
      else member.first_name || ' ' || member.last_name
    end,
    'memberPhone', coalesce(member.phone, ''),
    'revision', office.revision
  ) order by office.sort_order), '[]'::jsonb)
  into v_offices
  from app_fanclub.office_slots as office
  left join app_fanclub.members as member
    on member.id = office.member_id;

  return (v_base - 'members' - 'offices') || jsonb_build_object(
    'members', v_members,
    'offices', v_offices,
    'canViewMemberDetails', app_private.can_manage_member_details(v_actor)
  );
end;
$$;

create or replace function app_private.api_member_detail(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_member_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_result jsonb;
begin
  if not app_private.can_manage_member_details(v_actor) then
    raise exception 'Mitgliederdetails dürfen nur Administration oder aktuelle Amtsinhaber einsehen.'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', member.id,
    'memberCode', member.member_code,
    'firstName', member.first_name,
    'lastName', member.last_name,
    'email', member.email,
    'phone', member.phone,
    'street', member.street,
    'houseNumber', member.house_number,
    'postalCode', member.postal_code,
    'city', member.city,
    'joinedOn', member.joined_on,
    'leftOn', member.left_on,
    'status', member.status,
    'notes', member.notes,
    'revision', member.revision
  )
  into v_result
  from app_fanclub.members as member
  where member.id = v_member_id;

  if v_result is null then
    raise exception 'Mitglied wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

alter function app_private.api_save_member(jsonb)
rename to api_save_member_before_office_edit;

create or replace function app_private.api_save_member(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_first_name text;
  v_last_name text;
  v_status text := upper(coalesce(p_payload ->> 'status', 'ACTIVE'));
  v_existing app_fanclub.members%rowtype;
begin
  if v_id is null then
    return app_private.api_save_member_before_office_edit(p_payload);
  end if;

  v_actor := app_private.require_active_user();

  if not app_private.can_manage_member_details(v_actor) then
    raise exception 'Mitgliedsdaten dürfen nur Administration oder aktuelle Amtsinhaber bearbeiten.'
      using errcode = '42501';
  end if;

  v_first_name := app_private.require_valid_name(
    p_payload ->> 'firstName',
    'Vorname'
  );
  v_last_name := app_private.require_valid_name(
    p_payload ->> 'lastName',
    'Nachname'
  );

  if v_status not in ('ACTIVE', 'INACTIVE') then
    raise exception 'Unzulässiger Mitgliedsstatus.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_fanclub.members as member
  where member.id = v_id
  for update;

  if v_existing.id is null then
    raise exception 'Mitglied wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_existing.revision then
    raise exception
      'Das Mitglied wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  update app_fanclub.members
  set first_name = v_first_name,
      last_name = v_last_name,
      email = left(btrim(coalesce(p_payload ->> 'email', '')), 320),
      phone = left(btrim(coalesce(p_payload ->> 'phone', '')), 80),
      street = left(btrim(coalesce(p_payload ->> 'street', '')), 160),
      house_number = left(btrim(coalesce(p_payload ->> 'houseNumber', '')), 40),
      postal_code = left(btrim(coalesce(p_payload ->> 'postalCode', '')), 20),
      city = left(btrim(coalesce(p_payload ->> 'city', '')), 160),
      joined_on = nullif(p_payload ->> 'joinedOn', '')::date,
      left_on = nullif(p_payload ->> 'leftOn', '')::date,
      status = v_status,
      notes = left(coalesce(p_payload ->> 'notes', ''), 4000),
      revision = revision + 1
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'MEMBER_UPDATED',
    'member',
    v_id::text,
    jsonb_build_object(
      'revision', v_existing.revision,
      'status', v_existing.status
    ),
    jsonb_build_object(
      'revision', v_existing.revision + 1,
      'status', v_status
    )
  );

  return app_private.api_fanclub_snapshot();
end;
$$;

alter function app_private.api_save_offices(jsonb)
rename to api_save_offices_before_admin_only;

create or replace function app_private.api_save_offices(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('portal.admin');
begin
  return app_private.api_save_offices_before_admin_only(p_payload);
end;
$$;

alter function app_private.api_save_contribution_season(jsonb)
rename to api_save_contribution_season_before_internal_code;

create or replace function app_private.api_save_contribution_season(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('finance.manage');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_id uuid := nullif(v_payload ->> 'id', '')::uuid;
  v_code text;
begin
  if v_id is null then
    loop
      v_code := 'SAISON_' || upper(substr(
        replace(extensions.gen_random_uuid()::text, '-', ''),
        1,
        16
      ));
      exit when not exists (
        select 1
        from app_fanclub.contribution_seasons as season
        where season.code = v_code
      );
    end loop;
  else
    select season.code
    into v_code
    from app_fanclub.contribution_seasons as season
    where season.id = v_id;

    if v_code is null then
      raise exception 'Beitragsjahr wurde nicht gefunden.'
        using errcode = 'P0002';
    end if;
  end if;

  v_payload := jsonb_set(v_payload, '{code}', to_jsonb(v_code), true);
  return app_private.api_save_contribution_season_before_internal_code(v_payload);
end;
$$;

alter function app_private.api_save_contribution_class(jsonb)
rename to api_save_contribution_class_before_internal_code;

create or replace function app_private.api_save_contribution_class(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('finance.manage');
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_id uuid := nullif(v_payload ->> 'id', '')::uuid;
  v_code text;
begin
  if v_id is null then
    loop
      v_code := 'BEITRAG_' || upper(substr(
        replace(extensions.gen_random_uuid()::text, '-', ''),
        1,
        16
      ));
      exit when not exists (
        select 1
        from app_fanclub.contribution_classes as contribution_class
        where contribution_class.code = v_code
      );
    end loop;
  else
    select contribution_class.code
    into v_code
    from app_fanclub.contribution_classes as contribution_class
    where contribution_class.id = v_id;

    if v_code is null then
      raise exception 'Beitragsklasse wurde nicht gefunden.'
        using errcode = 'P0002';
    end if;
  end if;

  v_payload := jsonb_set(v_payload, '{code}', to_jsonb(v_code), true);
  return app_private.api_save_contribution_class_before_internal_code(v_payload);
end;
$$;

alter function public.pd_api(text, jsonb)
rename to pd_api_before_member_detail;

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

  if v_action = 'member_detail' then
    v_data := app_private.api_member_detail(coalesce(p_payload, '{}'::jsonb));
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  return public.pd_api_before_member_detail(p_action, p_payload);
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

revoke all on function app_private.can_manage_member_details(uuid)
from public, anon, authenticated;
revoke all on function app_private.api_fanclub_snapshot_before_member_privacy()
from public, anon, authenticated;
revoke all on function app_private.api_fanclub_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_member_detail(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_member_before_office_edit(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_member(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_offices_before_admin_only(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_offices(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_contribution_season_before_internal_code(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_contribution_season(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_contribution_class_before_internal_code(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_contribution_class(jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api_before_member_detail(text, jsonb)
from public, anon, authenticated;
revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;
