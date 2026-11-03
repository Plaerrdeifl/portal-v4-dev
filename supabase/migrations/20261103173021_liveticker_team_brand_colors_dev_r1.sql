-- Logo-derived team colors. Verify the source against each team's stored logo SHA-256.
-- Default suggestions only; user adjustments are retained through source=MANUAL.
-- No new team/identity store: app_modules.liveticker_teams is the sole source of truth.
alter table app_modules.liveticker_teams
  add column if not exists primary_color text,
  add column if not exists secondary_color text,
  add column if not exists team_color_source text not null default 'UNSET',
  add column if not exists team_color_logo_sha256 text;

alter table app_modules.liveticker_teams
  add constraint liveticker_team_primary_color_format
    check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint liveticker_team_secondary_color_format
    check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add constraint liveticker_team_colors_complete
    check ((primary_color is null) = (secondary_color is null)),
  add constraint liveticker_team_color_source_allowed
    check (team_color_source in ('UNSET','LOGO','MANUAL'));

with palette(logo_sha256, primary_color, secondary_color) as (
  values
    ('cb7723bcde12cb5b1968272f6c3c9e43cae6641324c01a45af2feb0dfcda6f4e', '#0951AB', '#181D24'),
    ('69c04902ca94a7a7f14ff5bacc66b76d12d2b965127a262f1b5525d0cbef15d1', '#BD1B1B', '#1B2D51'),
    ('b72bfcd0d10d749a0fb621ba360ba643e5d2c3f1bb37bf8f7c3126e556490753', '#633F3F', '#181D24'),
    ('84bd8643af0fe301d4bf4566b20c57936c9498439b0203d77dbf8a61b8451a3d', '#FFCF09', '#181D24'),
    ('b555281cb2058037d958c0a4fe206307458ca48d30be2c49ec656d310d26a6c9', '#CF3F3F', '#181D24'),
    ('ec4967db5cb1148b7bee3cf399dc0f6ebd2453e8080f88ac7f99bbad63989866', '#AB3F3F', '#181D24'),
    ('ccac189f0ecb54103703a6a5888cb1a5baf2543bbe91161947424009dedb234d', '#1B2D51', '#FFCF09'),
    ('1b82c76a1b6ad49a22fb3e7ebd3dfc1ed12cda3f82dbc303497a13629c858b61', '#F3CF09', '#181D24'),
    ('08bbd33749d64a332e703201e7c1eed2f8cde31f3764fff978bd5d5c8db9d58a', '#1B2DE1', '#BD751B'),
    ('d409576a41f4d881e44ea69839d1adf7f48319fa446e4a9c934e2ea7243f8e2a', '#092D51', '#CF092D'),
    ('5bced507f58eddd775b9bb052e52840091f6fdedfffd324072fe9a79faa69980', '#2D2D51', '#87632D'),
    ('c7b29bf2cc283c4da266266e567706adc7a0e4d8f464575b2a3ce63f036c5def', '#F3CF51', '#AB3F3F'),
    ('d049d712a8f2f0424ce53371667a17fc8e00edfa1fa4f13478971fd73b22d168', '#091B3F', '#E1091B'),
    ('2a4526acbf13dd343b8cba7f0ee2f3226ab0162e0a1a69dc4023877573fb5d0a', '#F31B2D', '#181D24'),
    ('f27c8f1b740c9dea362c52941391e10e6deaae81709588b5296f26354b77d22d', '#0963AB', '#181D24'),
    ('3265e6339df8b290d84e8cbab3c1a8fd7a6cc50b63220b5e4de14883aac156b9', '#3246FA', '#1E1E5A'),
    ('3da15d3e53ea2676b65d649b43b550b2bf2cbcb534e07608b949ad9161e55976', '#E13F3F', '#181D24'),
    ('c2dd51a349e87d7c688603edfea3675e0d1c0e2a3f9e280a5b4fbf599bf4967f', '#BD1B2D', '#181D24'),
    ('600af558a450f30016f0e89065f627cd63060d466e44e8f35643ae48d3c8028b', '#CFBD75', '#181D24'),
    ('54d8e3d0baca967b8a28577563ff2c57b6d313d3a88a34a3700d6a265db9f1ba', '#992D3F', '#181D24'),
    ('30c7f34614cdb27eacfb4e4992d2fadecea083c80d2cd4e1fea2549bae0c006', '#091B3F', '#F31B09'),
    ('c08892244622f8d56d32e9cbf58e8e9066e26d0579a541c5e764b5ba9b22bd3a', '#F31B3F', '#181D24'),
    ('0f2a832e67659d2c0feb70ad3fb031e4fa5f0fd6c45bb0efd81edf40b894363c', '#991B1B', '#181D24'),
    ('e24360e7cc7d8f72bfc24db4f1cc96d0f95c8743347aca471bcbcc74bb102563', '#1B2D51', '#FFCF09'),
    ('fc9e4fbd94739583c9dd9b85406333eee8c6cf4251bb609d64c0171b7a6a7c7c', '#FFCF1B', '#181D24'),
    ('6ccf6aff387acfd06d36d77fa2a4b0c33813ef92cce245dcbcfe7fe253e276a6', '#091B3F', '#BD1B1B'),
    ('eded1958dd8199b275f386e65ef9f47f2744f6925220aa84be10a1186d640499', '#1B2D51', '#87631B'),
    ('aefba13d41049859fce0877e7b515286c3e8bc59621e3d05562e0b93ef085dd5', '#F3CF09', '#E11B3F'),
    ('4923ec1a4b9ec5f27b7f4c1ca10e5b25cd498cfdc7c874934194213d340c5311', '#0963CF', '#181D24'),
    ('fc801382f95a3db63ade9c74522d0e852cde6fc3312a9ba03a3ae102697493e6', '#BD1B2D', '#181D24'),
    ('400a2250fb13cc9947ba2f59a4139dd4e9cebdf3337978b0691b8426c0e57c42', '#BD2D2D', '#181D24'),
    ('2bf45f27ae7d0bafa08e3ca3cddc751a13b4d55f311dcff621c57f8515fb2705', '#091B3F', '#F31B09')
)
update app_modules.liveticker_teams as t
  set primary_color=palette.primary_color,
      secondary_color=palette.secondary_color,
      team_color_source='LOGO',
      team_color_logo_sha256=t.logo_sha256
  from palette
 where t.logo_sha256=palette.logo_sha256
   and t.primary_color is null
   and t.secondary_color is null;

CREATE OR REPLACE FUNCTION app_private.api_liveticker_teams_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 perform app_private.liveticker_require_operator();
 return jsonb_build_object('canManage',true,'teams',coalesce((select jsonb_agg(jsonb_build_object(
  'id',t.id,
  'name',t.name,
  'shortName',t.short_name,
  'teamCode',t.team_code,
  'primaryColor',t.primary_color,
  'secondaryColor',t.secondary_color,
  'teamColorSource',t.team_color_source,
  'logoAssetPath',t.logo_asset_path,
  'logoUrl',t.logo_asset_path,
  'logoStorageBucket',t.logo_storage_bucket,
  'logoStoragePath',t.logo_storage_path,
  'logoUploaded',(t.logo_storage_path is not null or t.logo_data is not null),
  'logoMime',t.logo_mime,
  'logoSha256',t.logo_sha256,
  'homeClub',t.is_home_club,
  'active',t.is_active,
  'revision',t.revision,
  'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'teamId',p.team_id,'name',p.full_name,'number',p.jersey_number,'position',p.position,'active',p.is_active,'revision',p.revision)
    order by case p.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end,case when p.jersey_number ~ '^[0-9]+$' then p.jersey_number::integer else 9999 end,p.full_name) from app_modules.liveticker_players p where p.team_id=t.id),'[]'::jsonb)) order by t.is_home_club desc,t.name) from app_modules.liveticker_teams t),'[]'::jsonb));
end; $function$;


CREATE OR REPLACE FUNCTION app_private.api_liveticker_team_save(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_id uuid := nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid;
  v_name text := nullif(btrim(coalesce(p_payload->>'name','')),'');
  v_short text := nullif(btrim(coalesce(p_payload->>'shortName','')),'');
  v_code text := upper(nullif(btrim(coalesce(p_payload->>'teamCode','')),''));
  v_home boolean := coalesce((p_payload->>'homeClub')::boolean,false);
  v_active boolean := coalesce((p_payload->>'active')::boolean,true);
  v_expected integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_colors_supplied boolean := (p_payload ? 'primaryColor' or p_payload ? 'secondaryColor');
  v_primary_color text := upper(nullif(btrim(coalesce(p_payload->>'primaryColor','')),''));
  v_secondary_color text := upper(nullif(btrim(coalesce(p_payload->>'secondaryColor','')),''));
  v_old app_modules.liveticker_teams%rowtype;
begin
  if nullif(btrim(coalesce(p_payload->>'logoDataBase64','')),'') is not null
     or nullif(btrim(coalesce(p_payload->>'logoMime','')),'') is not null then
    raise exception 'Teamlogos werden über den zentralen Logo-Upload gespeichert.' using errcode='22023';
  end if;
  if v_colors_supplied then
    if v_id is null then
      raise exception 'Teamfarben können nach dem Anlegen des Teams gespeichert werden.' using errcode='22023';
    end if;
    if (v_primary_color is null) <> (v_secondary_color is null)
       or (v_primary_color is not null and v_primary_color !~ '^#[0-9A-F]{6}$')
       or (v_secondary_color is not null and v_secondary_color !~ '^#[0-9A-F]{6}$') then
      raise exception 'Teamfarben müssen zwei gültige HEX-Farben sein oder beide leer bleiben.' using errcode='22023';
    end if;
  end if;
  if v_name is null or char_length(v_name)>160 or v_short is null or char_length(v_short)>60 then
    raise exception 'Teamname und Kurzname sind erforderlich.' using errcode='22023';
  end if;
  if v_code is null or v_code !~ '^[A-Z0-9/-]{2,12}$' then
    raise exception 'Teamkürzel ist erforderlich und darf nur A-Z, 0-9, / und - enthalten.' using errcode='22023';
  end if;

  if v_id is null then
    if v_home then
      update app_modules.liveticker_teams
      set is_home_club=false,revision=revision+1,updated_at=now(),updated_by=v_actor
      where is_home_club;
    end if;
    insert into app_modules.liveticker_teams(
      name,short_name,team_code,is_home_club,is_active,created_by,updated_by
    ) values (
      v_name,v_short,v_code,v_home,v_active,v_actor,v_actor
    );
  else
    select * into v_old
    from app_modules.liveticker_teams
    where id=v_id
    for update;
    if not found then raise exception 'Team wurde nicht gefunden.' using errcode='P0002'; end if;
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
        is_home_club=v_home,
        is_active=v_active,
        revision=revision+1,
        updated_at=now(),
        updated_by=v_actor
    where id=v_id;
  end if;

  if v_colors_supplied then
    update app_modules.liveticker_teams
       set primary_color=v_primary_color,
           secondary_color=v_secondary_color,
           team_color_source=case when v_primary_color is null then 'UNSET' else 'MANUAL' end,
           team_color_logo_sha256=null
     where id=v_id;
  end if;

  return app_private.api_liveticker_teams_list();
end;
$function$;


CREATE OR REPLACE FUNCTION app_private.liveticker_team_json(p_team_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
   'id',t.id,
   'name',t.name,
   'shortName',t.short_name,
   'teamCode',t.team_code,
   'primaryColor',t.primary_color,
   'secondaryColor',t.secondary_color,
   'logoAssetPath',t.logo_asset_path,
   'logoUrl',t.logo_asset_path,
   'logoStorageBucket',t.logo_storage_bucket,
   'logoStoragePath',t.logo_storage_path,
   'homeClub',t.is_home_club,
   'players',coalesce((
     select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'number',p.jersey_number,'position',case p.position when 'GOALIE' then 'Tor' when 'DEFENSE' then 'Verteidigung' else 'Sturm' end)
       order by case p.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end, case when p.jersey_number ~ '^[0-9]+$' then p.jersey_number::integer else 9999 end,p.full_name)
     from app_modules.liveticker_players p where p.team_id=t.id and p.is_active
   ),'[]'::jsonb)
 ) from app_modules.liveticker_teams t where t.id=p_team_id and t.is_active;
$function$;


CREATE OR REPLACE FUNCTION app_private.api_social_media_generator_media_teams_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform app_private.social_media_generator_require_access();

  return coalesce(
    (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_strip_nulls(
          pg_catalog.jsonb_build_object(
            'id', team.id,
            'name', team.name,
            'shortName', team.short_name,
            'teamCode', team.team_code,
            'primaryColor', team.primary_color,
            'secondaryColor', team.secondary_color,
            'teamColorSource', team.team_color_source,
            'homeClub', team.is_home_club,
            'active', team.is_active,
            'logoUploaded',
              team.logo_storage_bucket is not null
              and team.logo_storage_path is not null,
            'logoSha256', team.logo_sha256,
            'logoStorageBucket', team.logo_storage_bucket,
            'logoStoragePath', team.logo_storage_path
          )
        )
        order by team.is_home_club desc, team.name, team.id
      )
      from app_modules.liveticker_teams as team
      where team.is_active
    ),
    '[]'::jsonb
  );
end;
$function$;

