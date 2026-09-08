-- Plärrdeifl Portal V4 - Liveticker team logo upload R1
-- A team may replace only its own managed logo. Existing static assets remain fallback-only.

begin;

alter table app_modules.liveticker_teams
  add column if not exists logo_data bytea,
  add column if not exists logo_mime text,
  add column if not exists logo_sha256 text;

alter table app_modules.liveticker_teams
  drop constraint if exists liveticker_teams_logo_upload_check;

alter table app_modules.liveticker_teams
  add constraint liveticker_teams_logo_upload_check check (
    (logo_data is null and logo_mime is null and logo_sha256 is null)
    or (
      logo_data is not null
      and octet_length(logo_data) between 1 and 1048576
      and logo_mime in ('image/png','image/jpeg','image/webp')
      and logo_sha256 ~ '^[a-f0-9]{64}$'
    )
  );

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
  select id,logo_data,logo_mime,logo_sha256 into v_row
  from app_modules.liveticker_teams
  where id=v_id;
  if not found then
    raise exception 'Team wurde nicht gefunden.' using errcode='P0002';
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
  'logoUploaded',t.logo_data is not null,
  'logoMime',t.logo_mime,
  'logoSha256',t.logo_sha256,
  'homeClub',t.is_home_club,
  'active',t.is_active,
  'revision',t.revision,
  'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'teamId',p.team_id,'name',p.full_name,'number',p.jersey_number,'position',p.position,'active',p.is_active,'revision',p.revision)
    order by case p.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end,case when p.jersey_number ~ '^[0-9]+$' then p.jersey_number::integer else 9999 end,p.full_name) from app_modules.liveticker_players p where p.team_id=t.id),'[]'::jsonb)) order by t.is_home_club desc,t.name) from app_modules.liveticker_teams t),'[]'::jsonb));
end; $$;

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
  v_logo_b64 text := nullif(btrim(coalesce(p_payload->>'logoDataBase64','')),'');
  v_logo_mime text := lower(nullif(btrim(coalesce(p_payload->>'logoMime','')),''));
  v_logo_data bytea;
  v_logo_hash text;
  v_old app_modules.liveticker_teams%rowtype;
begin
  if v_name is null or char_length(v_name)>160 or v_short is null or char_length(v_short)>60 then
    raise exception 'Teamname und Kurzname sind erforderlich.' using errcode='22023';
  end if;
  if v_code is null or v_code !~ '^[A-Z0-9/-]{2,12}$' then
    raise exception 'Teamkürzel ist erforderlich und darf nur A-Z, 0-9, / und - enthalten.' using errcode='22023';
  end if;

  if v_logo_b64 is not null then
    if v_logo_mime not in ('image/png','image/jpeg','image/webp') then
      raise exception 'Teamlogo muss PNG, JPG oder WebP sein.' using errcode='22023';
    end if;
    if char_length(v_logo_b64)>1400000 then
      raise exception 'Teamlogo darf maximal 1 MB groß sein.' using errcode='22023';
    end if;
    begin
      v_logo_data := decode(v_logo_b64,'base64');
    exception when others then
      raise exception 'Teamlogo konnte nicht verarbeitet werden.' using errcode='22023';
    end;
    if octet_length(v_logo_data)<1 or octet_length(v_logo_data)>1048576 then
      raise exception 'Teamlogo darf maximal 1 MB groß sein.' using errcode='22023';
    end if;
    if v_logo_mime='image/png' and substring(v_logo_data from 1 for 8)<>decode('89504e470d0a1a0a','hex') then
      raise exception 'PNG-Teamlogo ist ungültig.' using errcode='22023';
    elsif v_logo_mime='image/jpeg' and substring(v_logo_data from 1 for 3)<>decode('ffd8ff','hex') then
      raise exception 'JPG-Teamlogo ist ungültig.' using errcode='22023';
    elsif v_logo_mime='image/webp' and not (
      substring(v_logo_data from 1 for 4)=decode('52494646','hex')
      and substring(v_logo_data from 9 for 4)=decode('57454250','hex')
    ) then
      raise exception 'WebP-Teamlogo ist ungültig.' using errcode='22023';
    end if;
    v_logo_hash := encode(extensions.digest(v_logo_data,'sha256'),'hex');
  elsif v_logo_mime is not null then
    raise exception 'Teamlogo-Daten fehlen.' using errcode='22023';
  end if;

  if v_id is null then
    if v_logo_data is null then
      raise exception 'Bitte ein Teamlogo hochladen.' using errcode='22023';
    end if;
    if v_home then
      update app_modules.liveticker_teams
      set is_home_club=false,revision=revision+1,updated_at=now(),updated_by=v_actor
      where is_home_club;
    end if;
    insert into app_modules.liveticker_teams(
      name,short_name,team_code,logo_data,logo_mime,logo_sha256,is_home_club,is_active,created_by,updated_by
    ) values (
      v_name,v_short,v_code,v_logo_data,v_logo_mime,v_logo_hash,v_home,v_active,v_actor,v_actor
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
        logo_data=case when v_logo_b64 is not null then v_logo_data else v_old.logo_data end,
        logo_mime=case when v_logo_b64 is not null then v_logo_mime else v_old.logo_mime end,
        logo_sha256=case when v_logo_b64 is not null then v_logo_hash else v_old.logo_sha256 end,
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

create or replace function app_private.liveticker_graphic_enqueue(p_event_id uuid, p_kind text, p_actor uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_kind text := upper(btrim(coalesce(p_kind,'')));
  v_state app_modules.liveticker_game_states%rowtype;
  v_event record;
  v_own record;
  v_opp record;
  v_history jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_job app_modules.liveticker_graphic_jobs%rowtype;
begin
  if v_kind not in ('PERIOD_1','PERIOD_2','FINAL') then
    raise exception 'LIVETICKER_GRAPHIC_KIND_INVALID' using errcode='22023';
  end if;
  perform app_private.liveticker_assert_supported_game(p_event_id);

  select * into v_state from app_modules.liveticker_game_states where event_id=p_event_id;
  if not found then raise exception 'LIVETICKER_GRAPHIC_STATE_MISSING' using errcode='22023'; end if;

  select e.event_date,e.title,g.opponent_name into v_event
  from app_modules.events e join app_modules.event_games g on g.event_id=e.id where e.id=p_event_id;

  select t.id,t.name,t.short_name,t.team_code,t.logo_asset_path,t.logo_data,t.logo_mime
    into v_own
  from app_modules.liveticker_teams t
  where t.is_active and t.is_home_club order by t.name limit 1;
  if v_own.id is null or (v_own.logo_data is null and nullif(btrim(coalesce(v_own.logo_asset_path,'')),'') is null) then
    raise exception 'LIVETICKER_GRAPHIC_OUR_ASSET_MISSING' using errcode='22023';
  end if;

  select t.id,t.name,t.short_name,t.team_code,t.logo_asset_path,t.logo_data,t.logo_mime
    into v_opp
  from app_modules.liveticker_teams t
  where t.is_active and not t.is_home_club and (
    lower(btrim(t.name))=lower(btrim(v_event.opponent_name))
    or lower(btrim(t.short_name))=lower(btrim(v_event.opponent_name))
    or lower(v_event.opponent_name) like '%'||lower(btrim(t.short_name))||'%'
  )
  order by case when lower(btrim(t.name))=lower(btrim(v_event.opponent_name)) then 0 else 1 end,t.name limit 1;
  if v_opp.id is null or (v_opp.logo_data is null and nullif(btrim(coalesce(v_opp.logo_asset_path,'')),'') is null) then
    raise exception 'LIVETICKER_GRAPHIC_OPPONENT_ASSET_MISSING' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(a.payload order by a.ordinal),'[]'::jsonb) into v_history
  from app_modules.liveticker_actions a where a.event_id=p_event_id and a.is_active;

  v_snapshot := jsonb_build_object(
    'schemaVersion',2,'kind',v_kind,'eventId',p_event_id,'eventDate',v_event.event_date,
    'eventTitle',coalesce(v_event.title,''),'revision',v_state.revision,'competitionLabel','','seriesInfo','',
    'ourTeam',jsonb_build_object(
      'id',v_own.id,'name',v_own.name,'shortName',v_own.short_name,'teamCode',v_own.team_code,
      'logoAssetPath',v_own.logo_asset_path,'logoMime',v_own.logo_mime,
      'logoDataBase64',case when v_own.logo_data is null then null else encode(v_own.logo_data,'base64') end
    ),
    'opponentTeam',jsonb_build_object(
      'id',v_opp.id,'name',v_opp.name,'shortName',v_opp.short_name,'teamCode',v_opp.team_code,
      'logoAssetPath',v_opp.logo_asset_path,'logoMime',v_opp.logo_mime,
      'logoDataBase64',case when v_opp.logo_data is null then null else encode(v_opp.logo_data,'base64') end
    ),
    'history',v_history
  );

  insert into app_modules.liveticker_graphic_jobs(event_id,graphic_kind,source_revision,request_snapshot,created_by,updated_by)
  values(p_event_id,v_kind,v_state.revision,v_snapshot,p_actor,p_actor)
  on conflict do nothing returning * into v_job;

  if v_job.id is null then
    select * into v_job from app_modules.liveticker_graphic_jobs
    where event_id=p_event_id and graphic_kind=v_kind and status in ('QUEUED','PROCESSING')
    order by created_at desc limit 1;
  end if;

  return jsonb_build_object('jobId',v_job.id,'eventId',v_job.event_id,'kind',v_job.graphic_kind,
    'status',v_job.status,'sourceRevision',v_job.source_revision,'createdAt',v_job.created_at);
end;
$$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_liveticker_team_logo_upload_r1;

create or replace function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_action text:=lower(btrim(coalesce(p_action,'')));
begin
  case v_action
    when 'liveticker_team_logo_get' then
      return app_private.api_liveticker_team_logo_get(coalesce(p_payload,'{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_liveticker_team_logo_upload_r1(p_action,p_payload);
  end case;
end;
$$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_liveticker_team_logo_upload_r1;

create or replace function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path=''
as $$
  select case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_team_logo_get' then 'READ'
    else app_private.platform_action_classification_before_liveticker_team_logo_upload_r1(p_action)
  end
$$;

revoke all on function app_private.api_liveticker_team_logo_get(jsonb) from public,anon,authenticated;
revoke all on function app_private.api_liveticker_teams_list() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_team_save(jsonb) from public,anon,authenticated;
revoke all on function app_private.liveticker_graphic_enqueue(uuid,text,uuid) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.platform_action_classification(text) from public,anon,authenticated;

commit;
