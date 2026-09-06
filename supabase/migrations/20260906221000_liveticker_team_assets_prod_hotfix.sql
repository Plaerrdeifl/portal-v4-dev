-- Plärrdeifl Portal V4 - PROD-only Liveticker team asset hotfix
-- Portal-owned display codes and local logo assets. No external runtime dependency.
begin;

alter table app_modules.liveticker_teams
  add column team_code text,
  add column logo_asset_path text;

alter table app_modules.liveticker_teams
  add constraint liveticker_teams_team_code_check
    check (team_code is null or team_code ~ '^[A-Z0-9/-]{2,12}$'),
  add constraint liveticker_teams_logo_asset_path_check
    check (logo_asset_path is null or logo_asset_path ~ '^/assets/liveticker/teams/[a-z0-9-]+\.(png|svg)$');

-- Display codes are labels only, never identifiers. Duplicate display codes are allowed.
update app_modules.liveticker_teams set team_code='ERVS', logo_asset_path='/assets/liveticker/teams/mighty-dogs-schweinfurt.png' where short_name='Mighty Dogs';
update app_modules.liveticker_teams set team_code='EAS', logo_asset_path='/assets/liveticker/teams/ea-schongau.png' where short_name='Schongau';
update app_modules.liveticker_teams set team_code='EHCKL', logo_asset_path='/assets/liveticker/teams/ehc-klostersee.png' where short_name='Klostersee';
update app_modules.liveticker_teams set team_code='EHCKB', logo_asset_path='/assets/liveticker/teams/ehc-koenigsbrunn.png' where short_name='Königsbrunn';
update app_modules.liveticker_teams set team_code='EHCW', logo_asset_path='/assets/liveticker/teams/ehc-waldkraiburg.png' where short_name='Waldkraiburg';
update app_modules.liveticker_teams set team_code='ERSC', logo_asset_path='/assets/liveticker/teams/ersc-amberg.png' where short_name='Amberg';
update app_modules.liveticker_teams set team_code='ESCD', logo_asset_path='/assets/liveticker/teams/esc-dorfen.png' where short_name='Dorfen';
update app_modules.liveticker_teams set team_code='ESCK', logo_asset_path='/assets/liveticker/teams/esc-kempten.png' where short_name='Kempten';
update app_modules.liveticker_teams set team_code='ESCG', logo_asset_path='/assets/liveticker/teams/esc-geretsried.png' where short_name='Geretsried';
update app_modules.liveticker_teams set team_code='ESVB', logo_asset_path='/assets/liveticker/teams/esv-buchloe.png' where short_name='Buchloe';
update app_modules.liveticker_teams set team_code='ESVB', logo_asset_path='/assets/liveticker/teams/esv-burgau-2000.png' where short_name='Burgau';
update app_modules.liveticker_teams set team_code='EVD', logo_asset_path='/assets/liveticker/teams/ev-dingolfing.png' where short_name='Dingolfing';
update app_modules.liveticker_teams set team_code='HCL', logo_asset_path='/assets/liveticker/teams/hc-landsberg.png' where short_name='Landsberg';
update app_modules.liveticker_teams set team_code='TSVP', logo_asset_path='/assets/liveticker/teams/peissenberg-miners.png' where short_name='Peißenberg';
update app_modules.liveticker_teams set team_code='TEVM', logo_asset_path='/assets/liveticker/teams/tev-miesbach.png' where short_name='Miesbach';
update app_modules.liveticker_teams set team_code='VFEU', logo_asset_path='/assets/liveticker/teams/vfe-ulm-neu-ulm.png' where short_name='Ulm/Neu-Ulm';
update app_modules.liveticker_teams set team_code='TBD', logo_asset_path='/assets/liveticker/teams/black-dragons-erfurt.svg' where short_name='Erfurt';

create or replace function app_private.liveticker_team_json(p_team_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object(
   'id',t.id,
   'name',t.name,
   'shortName',t.short_name,
   'teamCode',t.team_code,
   'logoAssetPath',t.logo_asset_path,
   -- Compatibility for already-open PROD clients; value is still a local portal asset.
   'logoUrl',t.logo_asset_path,
   'homeClub',t.is_home_club,
   'players',coalesce((
     select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'number',p.jersey_number,'position',case p.position when 'GOALIE' then 'Tor' when 'DEFENSE' then 'Verteidigung' else 'Sturm' end)
       order by case p.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end, case when p.jersey_number ~ '^[0-9]+$' then p.jersey_number::integer else 9999 end,p.full_name)
     from app_modules.liveticker_players p where p.team_id=t.id and p.is_active
   ),'[]'::jsonb)
 ) from app_modules.liveticker_teams t where t.id=p_team_id and t.is_active;
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
  'homeClub',t.is_home_club,
  'active',t.is_active,
  'revision',t.revision,
  'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'teamId',p.team_id,'name',p.full_name,'number',p.jersey_number,'position',p.position,'active',p.is_active,'revision',p.revision)
    order by case p.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end,case when p.jersey_number ~ '^[0-9]+$' then p.jersey_number::integer else 9999 end,p.full_name) from app_modules.liveticker_players p where p.team_id=t.id),'[]'::jsonb)) order by t.is_home_club desc,t.name) from app_modules.liveticker_teams t),'[]'::jsonb));
end; $$;

create or replace function app_private.api_liveticker_team_save(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare
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
 if v_name is null or char_length(v_name)>160 or v_short is null or char_length(v_short)>60 then
   raise exception 'Teamname und Kurzname sind erforderlich.' using errcode='22023';
 end if;
 if v_code is null or v_code !~ '^[A-Z0-9/-]{2,12}$' then
   raise exception 'Teamkürzel ist erforderlich und darf nur A-Z, 0-9, / und - enthalten.' using errcode='22023';
 end if;

 if v_id is null then
   if v_home then
     update app_modules.liveticker_teams set is_home_club=false,revision=revision+1,updated_at=now(),updated_by=v_actor where is_home_club;
   end if;
   insert into app_modules.liveticker_teams(name,short_name,team_code,is_home_club,is_active,created_by,updated_by)
   values(v_name,v_short,v_code,v_home,v_active,v_actor,v_actor);
 else
   select * into v_old from app_modules.liveticker_teams where id=v_id for update;
   if not found then raise exception 'Team wurde nicht gefunden.' using errcode='P0002'; end if;
   if v_expected is null or v_expected<>v_old.revision then
     raise exception 'Das Team wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001';
   end if;
   if v_home and not v_old.is_home_club then
     update app_modules.liveticker_teams set is_home_club=false,revision=revision+1,updated_at=now(),updated_by=v_actor where is_home_club and id<>v_id;
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
end; $$;

create or replace function public.pd_public_liveticker_games()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_result jsonb; begin
 perform app_private.liveticker_require_operator();
 select jsonb_build_object('games',coalesce(jsonb_agg(jsonb_build_object(
  'eventId',e.id,'eventDate',e.event_date,'eventTime',e.event_time,'venue',e.venue,'homeAway',g.home_away,
  'displayTitle',case g.home_away when 'HOME' then own.short_name||' – '||coalesce(opp.short_name,g.opponent_name) else coalesce(opp.short_name,g.opponent_name)||' – '||own.short_name end,
  'ownTeam',app_private.liveticker_team_json(own.id),
  'opponentTeam',coalesce(app_private.liveticker_team_json(opp.id),jsonb_build_object('id',null,'name',g.opponent_name,'shortName',g.opponent_name,'teamCode',null,'logoAssetPath',null,'logoUrl',null,'homeClub',false,'players','[]'::jsonb))
 ) order by e.event_date,e.event_time nulls first,e.id),'[]'::jsonb)) into v_result
 from app_modules.events e join app_modules.event_games g on g.event_id=e.id
 join app_modules.liveticker_teams own on own.is_home_club and own.is_active
 left join lateral(select t.id,t.short_name from app_modules.liveticker_teams t where t.is_active and not t.is_home_club and (lower(btrim(t.name))=lower(btrim(g.opponent_name)) or lower(btrim(t.short_name))=lower(btrim(g.opponent_name)) or lower(g.opponent_name) like '%'||lower(btrim(t.short_name))||'%') order by case when lower(btrim(t.name))=lower(btrim(g.opponent_name)) then 0 else 1 end,t.name limit 1) opp on true
 left join app_modules.liveticker_game_states s on s.event_id=e.id
 where e.event_type='GAME' and e.visibility='PUBLIC' and s.completed_at is null and e.event_date between ((now() at time zone 'Europe/Berlin')::date-14) and ((now() at time zone 'Europe/Berlin')::date+220);
 return v_result;
end; $$;

revoke all on function app_private.liveticker_team_json(uuid) from public,anon,authenticated;
revoke all on function app_private.api_liveticker_teams_list() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_team_save(jsonb) from public,anon,authenticated;
revoke all on function public.pd_public_liveticker_games() from public,anon,authenticated;
grant execute on function public.pd_public_liveticker_games() to authenticated;

commit;
