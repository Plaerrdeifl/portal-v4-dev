begin;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'liveticker-team-logos',
  'liveticker-team-logos',
  true,
  1048576,
  array['image/png','image/jpeg','image/webp']::text[]
)
on conflict (id) do update
set public=excluded.public,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

alter table app_modules.liveticker_teams
  add column if not exists logo_storage_bucket text,
  add column if not exists logo_storage_path text;

alter table app_modules.liveticker_teams
  drop constraint if exists liveticker_teams_logo_storage_check;

alter table app_modules.liveticker_teams
  add constraint liveticker_teams_logo_storage_check check (
    (logo_storage_bucket is null and logo_storage_path is null)
    or (
      logo_storage_bucket='liveticker-team-logos'
      and logo_storage_path ~ '^teams/[0-9a-f-]{36}/[a-f0-9]{64}\.(png|jpg|webp)$'
      and logo_mime in ('image/png','image/jpeg','image/webp')
      and logo_sha256 ~ '^[a-f0-9]{64}$'
    )
  );

create or replace function app_private.api_liveticker_team_logo_upload_authorize(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_team_id uuid := nullif(btrim(coalesce(p_payload->>'teamId','')),'')::uuid;
  v_expected integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_revision integer;
begin
  if v_team_id is null or v_expected is null then
    raise exception 'Team und Revision sind erforderlich.' using errcode='22023';
  end if;

  select revision into v_revision
  from app_modules.liveticker_teams
  where id=v_team_id;

  if not found then
    raise exception 'Team wurde nicht gefunden.' using errcode='P0002';
  end if;
  if v_revision<>v_expected then
    raise exception 'Das Team wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001';
  end if;

  return jsonb_build_object(
    'actorId',v_actor,
    'teamId',v_team_id,
    'expectedRevision',v_revision,
    'storageBucket','liveticker-team-logos',
    'maxBytes',1048576
  );
end;
$$;

create or replace function public.pd_liveticker_team_logo_storage_activate(
  p_team_id uuid,
  p_actor uuid,
  p_expected_revision integer,
  p_storage_path text,
  p_mime_type text,
  p_sha256 text,
  p_logo_data_base64 text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_row app_modules.liveticker_teams%rowtype;
  v_data bytea;
  v_hash text;
  v_ext text;
begin
  if p_team_id is null
     or p_storage_path is null
     or p_mime_type not in ('image/png','image/jpeg','image/webp')
     or p_sha256 !~ '^[a-f0-9]{64}$'
     or p_storage_path !~ '^teams/[0-9a-f-]{36}/[a-f0-9]{64}\.(png|jpg|webp)$'
     or p_storage_path not like 'teams/'||p_team_id::text||'/%'
     or position('/'||p_sha256||'.' in p_storage_path)=0 then
    raise exception 'TEAM_LOGO_STORAGE_PAYLOAD_INVALID' using errcode='22023';
  end if;

  v_ext := regexp_replace(p_storage_path,'^.*\.','','g');
  if (p_mime_type='image/png' and v_ext<>'png')
     or (p_mime_type='image/jpeg' and v_ext<>'jpg')
     or (p_mime_type='image/webp' and v_ext<>'webp') then
    raise exception 'TEAM_LOGO_STORAGE_MIME_INVALID' using errcode='22023';
  end if;

  begin
    v_data := decode(coalesce(p_logo_data_base64,''),'base64');
  exception when others then
    raise exception 'TEAM_LOGO_STORAGE_DATA_INVALID' using errcode='22023';
  end;

  if octet_length(v_data)<1 or octet_length(v_data)>1048576 then
    raise exception 'TEAM_LOGO_STORAGE_SIZE_INVALID' using errcode='22023';
  end if;

  if p_mime_type='image/png' and substring(v_data from 1 for 8)<>decode('89504e470d0a1a0a','hex') then
    raise exception 'TEAM_LOGO_STORAGE_DATA_INVALID' using errcode='22023';
  elsif p_mime_type='image/jpeg' and substring(v_data from 1 for 3)<>decode('ffd8ff','hex') then
    raise exception 'TEAM_LOGO_STORAGE_DATA_INVALID' using errcode='22023';
  elsif p_mime_type='image/webp' and not (
    substring(v_data from 1 for 4)=decode('52494646','hex')
    and substring(v_data from 9 for 4)=decode('57454250','hex')
  ) then
    raise exception 'TEAM_LOGO_STORAGE_DATA_INVALID' using errcode='22023';
  end if;

  v_hash := encode(extensions.digest(v_data,'sha256'),'hex');
  if v_hash<>p_sha256 then
    raise exception 'TEAM_LOGO_STORAGE_HASH_INVALID' using errcode='22023';
  end if;

  select * into v_row
  from app_modules.liveticker_teams
  where id=p_team_id
  for update;

  if not found then
    raise exception 'Team wurde nicht gefunden.' using errcode='P0002';
  end if;
  if p_expected_revision is not null and v_row.revision<>p_expected_revision then
    raise exception 'Das Team wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001';
  end if;

  update app_modules.liveticker_teams
  set logo_storage_bucket='liveticker-team-logos',
      logo_storage_path=p_storage_path,
      logo_data=v_data,
      logo_mime=p_mime_type,
      logo_sha256=p_sha256,
      revision=revision+1,
      updated_at=now(),
      updated_by=coalesce(p_actor,updated_by)
  where id=p_team_id
  returning * into v_row;

  return jsonb_build_object(
    'teamId',v_row.id,
    'revision',v_row.revision,
    'storageBucket',v_row.logo_storage_bucket,
    'storagePath',v_row.logo_storage_path,
    'mime',v_row.logo_mime,
    'sha256',v_row.logo_sha256
  );
end;
$$;

create or replace function app_private.api_liveticker_team_logo_get(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_id uuid := nullif(btrim(coalesce(p_payload->>'teamId','')),'')::uuid;
  v_row record;
begin
  perform app_private.liveticker_require_operator();
  select id,logo_data,logo_mime,logo_sha256,logo_storage_bucket,logo_storage_path
  into v_row
  from app_modules.liveticker_teams
  where id=v_id;

  if not found then
    raise exception 'Team wurde nicht gefunden.' using errcode='P0002';
  end if;

  if v_row.logo_storage_path is not null then
    return jsonb_build_object(
      'teamId',v_id,
      'uploaded',true,
      'storageBucket',v_row.logo_storage_bucket,
      'storagePath',v_row.logo_storage_path,
      'mime',v_row.logo_mime,
      'sha256',v_row.logo_sha256
    );
  end if;

  if v_row.logo_data is null then
    return jsonb_build_object('teamId',v_id,'uploaded',false);
  end if;

  return jsonb_build_object(
    'teamId',v_id,
    'uploaded',true,
    'mime',v_row.logo_mime,
    'sha256',v_row.logo_sha256,
    'dataBase64',encode(v_row.logo_data,'base64')
  );
end;
$$;

create or replace function app_private.api_liveticker_teams_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin
 perform app_private.liveticker_require_operator();
 return jsonb_build_object('canManage',true,'teams',coalesce((select jsonb_agg(jsonb_build_object(
  'id',t.id,
  'name',t.name,
  'shortName',t.short_name,
  'teamCode',t.team_code,
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
end; $$;

create or replace function app_private.liveticker_team_json(p_team_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
   'id',t.id,
   'name',t.name,
   'shortName',t.short_name,
   'teamCode',t.team_code,
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
$$;

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
  v_home boolean := coalesce((p_payload->>'homeClub')::boolean,false);
  v_active boolean := coalesce((p_payload->>'active')::boolean,true);
  v_expected integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_old app_modules.liveticker_teams%rowtype;
begin
  if nullif(btrim(coalesce(p_payload->>'logoDataBase64','')),'') is not null
     or nullif(btrim(coalesce(p_payload->>'logoMime','')),'') is not null then
    raise exception 'Teamlogos werden über den zentralen Logo-Upload gespeichert.' using errcode='22023';
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

  return app_private.api_liveticker_teams_list();
end;
$$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_lt_team_logo_storage_r1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path=''
as $$
  select app_private.pd_api_current_actions_before_lt_team_logo_storage_r1()
    || array['liveticker_team_logo_upload_authorize']::text[];
$$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_lt_team_logo_storage_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path=''
as $$
  select case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_team_logo_upload_authorize' then 'READ'
    else app_private.platform_action_classification_before_lt_team_logo_storage_r1(p_action)
  end;
$$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_lt_team_logo_storage_r1;

create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action,'')));
begin
  case v_action
    when 'liveticker_team_logo_upload_authorize' then
      return app_private.api_liveticker_team_logo_upload_authorize(coalesce(p_payload,'{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_lt_team_logo_storage_r1(p_action,p_payload);
  end case;
end;
$$;

revoke all on function app_private.api_liveticker_team_logo_upload_authorize(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.pd_liveticker_team_logo_storage_activate(uuid,uuid,integer,text,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.pd_liveticker_team_logo_storage_activate(uuid,uuid,integer,text,text,text,text) to service_role;

revoke all on function app_private.pd_api_current_actions_before_lt_team_logo_storage_r1() from public,anon,authenticated,service_role;
revoke all on function app_private.pd_api_current_actions() from public,anon,authenticated,service_role;
revoke all on function app_private.platform_action_classification_before_lt_team_logo_storage_r1(text) from public,anon,authenticated,service_role;
revoke all on function app_private.platform_action_classification(text) from public,anon,authenticated,service_role;
revoke all on function app_private.pd_api_dispatch_current_before_lt_team_logo_storage_r1(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function app_private.pd_api_dispatch_current(text,jsonb) from public,anon,authenticated,service_role;

grant execute on function app_private.api_liveticker_team_logo_upload_authorize(jsonb) to postgres;
grant execute on function app_private.pd_api_current_actions_before_lt_team_logo_storage_r1() to postgres;
grant execute on function app_private.pd_api_current_actions() to postgres;
grant execute on function app_private.platform_action_classification_before_lt_team_logo_storage_r1(text) to postgres;
grant execute on function app_private.platform_action_classification(text) to postgres;
grant execute on function app_private.pd_api_dispatch_current_before_lt_team_logo_storage_r1(text,jsonb) to postgres;
grant execute on function app_private.pd_api_dispatch_current(text,jsonb) to postgres;

commit;
