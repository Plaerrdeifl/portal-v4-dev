-- Plärrdeifl Portal V4 - PROD Liveticker team editor hotfix
-- Allow authorized operators to change the display code and choose an existing local logo asset.

create or replace function app_private.api_liveticker_team_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_id uuid := nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid;
  v_name text := nullif(btrim(coalesce(p_payload->>'name','')),'');
  v_short text := nullif(btrim(coalesce(p_payload->>'shortName','')),'');
  v_code text := upper(nullif(btrim(coalesce(p_payload->>'teamCode','')),''));
  v_logo text := nullif(btrim(coalesce(p_payload->>'logoAssetPath','')),'');
  v_home boolean := coalesce((p_payload->>'homeClub')::boolean,false);
  v_active boolean := coalesce((p_payload->>'active')::boolean,true);
  v_expected integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_old app_modules.liveticker_teams%rowtype;
begin
  if v_name is null or char_length(v_name)>160 or v_short is null or char_length(v_short)>60 then
    raise exception 'Teamname und Kurzname sind erforderlich.' using errcode='22023';
  end if;
  if v_code is null or v_code !~ '^[A-Z0-9/-]{2,12}$' then
    raise exception 'Teamkürzel ist erforderlich und darf nur A-Z, 0-9, / und - enthalten.' using errcode='22023';
  end if;
  if v_logo is null or v_logo !~ '^/assets/liveticker/teams/[a-z0-9-]+\.(png|svg)$' then
    raise exception 'Bitte ein gültiges lokales Teamlogo auswählen.' using errcode='22023';
  end if;

  if v_id is null then
    if v_home then
      update app_modules.liveticker_teams
      set is_home_club=false,revision=revision+1,updated_at=now(),updated_by=v_actor
      where is_home_club;
    end if;
    insert into app_modules.liveticker_teams(
      name,short_name,team_code,logo_asset_path,is_home_club,is_active,created_by,updated_by
    ) values (
      v_name,v_short,v_code,v_logo,v_home,v_active,v_actor,v_actor
    );
  else
    select * into v_old
    from app_modules.liveticker_teams
    where id=v_id
    for update;
    if not found then
      raise exception 'Team wurde nicht gefunden.' using errcode='P0002';
    end if;
    if v_expected is null or v_expected<>v_old.revision then
      raise exception 'Das Team wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001';
    end if;
    if v_home and not v_old.is_home_club then
      update app_modules.liveticker_teams
      set is_home_club=false,revision=revision+1,updated_at=now(),updated_by=v_actor
      where is_home_club and id<>v_id;
    end if;
    update app_modules.liveticker_teams
    set name=v_name,
        short_name=v_short,
        team_code=v_code,
        logo_asset_path=v_logo,
        is_home_club=v_home,
        is_active=v_active,
        revision=revision+1,
        updated_at=now(),
        updated_by=v_actor
    where id=v_id;
  end if;

  return app_private.api_liveticker_teams_list();
end;
$$;
