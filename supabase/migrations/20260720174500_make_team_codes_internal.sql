create or replace function app_private.team_code_base(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_code text := app_private.clean_name(p_name);
begin
  v_code := replace(v_code, 'ä', 'ae');
  v_code := replace(v_code, 'ö', 'oe');
  v_code := replace(v_code, 'ü', 'ue');
  v_code := replace(v_code, 'Ä', 'Ae');
  v_code := replace(v_code, 'Ö', 'Oe');
  v_code := replace(v_code, 'Ü', 'Ue');
  v_code := replace(v_code, 'ß', 'ss');

  v_code := upper(v_code);
  v_code := regexp_replace(v_code, '[^A-Z0-9]+', '_', 'g');
  v_code := regexp_replace(v_code, '^_+|_+$', '', 'g');

  if v_code = '' then
    v_code := 'TEAM';
  end if;

  if v_code !~ '^[A-Z]' then
    v_code := 'TEAM_' || v_code;
  end if;

  return left(v_code, 56);
end;
$$;

revoke all on function app_private.team_code_base(text)
from public, anon, authenticated;

create or replace function app_private.next_team_code(p_name text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_base text := app_private.team_code_base(p_name);
  v_candidate text := v_base;
  v_counter integer := 1;
  v_suffix text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'plaerrdeifl.portal.team-code-generation',
      0
    )
  );

  while exists (
    select 1
    from app_portal.teams as team
    where team.code = v_candidate
  )
  loop
    v_counter := v_counter + 1;
    v_suffix := '_' || v_counter::text;
    v_candidate := left(v_base, 64 - length(v_suffix)) || v_suffix;
  end loop;

  return v_candidate;
end;
$$;

revoke all on function app_private.next_team_code(text)
from public, anon, authenticated;

create or replace function app_private.api_save_team(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('teams.manage');
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_code text;
  v_name text := app_private.require_valid_name(
    p_payload ->> 'name',
    'Teamname'
  );
  v_description text := left(
    btrim(coalesce(p_payload ->> 'description', '')),
    2000
  );
  v_active boolean := coalesce(
    (p_payload ->> 'active')::boolean,
    true
  );
  v_before jsonb;
begin
  if v_id is null then
    v_code := app_private.next_team_code(v_name);

    insert into app_portal.teams (
      code,
      name,
      description,
      is_active
    )
    values (
      v_code,
      v_name,
      v_description,
      v_active
    )
    returning id into v_id;

    perform app_private.log_audit(
      v_actor,
      'TEAM_CREATED',
      'team',
      v_id::text,
      null,
      jsonb_build_object(
        'code', v_code,
        'name', v_name
      )
    );
  else
    select
      to_jsonb(team),
      team.code
    into
      v_before,
      v_code
    from app_portal.teams as team
    where team.id = v_id
    for update;

    if v_before is null then
      raise exception 'Team wurde nicht gefunden.'
        using errcode = 'P0002';
    end if;

    update app_portal.teams
    set name = v_name,
        description = v_description,
        is_active = v_active,
        revision = revision + 1
    where id = v_id;

    perform app_private.log_audit(
      v_actor,
      'TEAM_UPDATED',
      'team',
      v_id::text,
      v_before,
      jsonb_build_object(
        'code', v_code,
        'name', v_name,
        'active', v_active
      )
    );
  end if;

  return app_private.api_teams_snapshot();
end;
$$;