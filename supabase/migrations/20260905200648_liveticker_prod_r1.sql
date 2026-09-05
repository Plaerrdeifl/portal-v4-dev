-- Plärrdeifl Portal V4 - Liveticker PROD R1
-- Login-only: every Liveticker read/write path requires liveticker.manage.

insert into app_portal.capabilities (code, name, category, description, is_active, sort_order)
values ('liveticker.manage','Liveticker verwalten','Liveticker','Liveticker-Teams, Kader und die Liveticker-Bedienung verwalten.',true,230)
on conflict (code) do update set name=excluded.name, category=excluded.category, description=excluded.description, is_active=true, sort_order=excluded.sort_order;

create table app_modules.liveticker_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  logo_url text,
  is_home_club boolean not null default false,
  is_active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint liveticker_teams_name_check check (char_length(btrim(name)) between 1 and 160),
  constraint liveticker_teams_short_name_check check (char_length(btrim(short_name)) between 1 and 60),
  constraint liveticker_teams_revision_check check (revision > 0),
  constraint liveticker_teams_logo_url_check check (logo_url is null or logo_url ~ '^https://')
);
create unique index liveticker_teams_name_unique_idx on app_modules.liveticker_teams (lower(btrim(name)));
create unique index liveticker_teams_single_home_club_idx on app_modules.liveticker_teams (is_home_club) where is_home_club;

create table app_modules.liveticker_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references app_modules.liveticker_teams(id) on delete cascade,
  full_name text not null,
  jersey_number text,
  position text not null,
  is_active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint liveticker_players_name_check check (char_length(btrim(full_name)) between 1 and 160),
  constraint liveticker_players_number_check check (jersey_number is null or char_length(btrim(jersey_number)) between 1 and 8),
  constraint liveticker_players_position_check check (position in ('GOALIE','DEFENSE','FORWARD')),
  constraint liveticker_players_revision_check check (revision > 0)
);
create index liveticker_players_team_idx on app_modules.liveticker_players (team_id,is_active,position,full_name);

create table app_modules.liveticker_game_states (
  event_id uuid primary key references app_modules.events(id) on delete cascade,
  revision integer not null default 0,
  minute integer not null default 1,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint liveticker_game_states_revision_check check (revision >= 0),
  constraint liveticker_game_states_minute_check check (minute between 1 and 200)
);
create index liveticker_game_states_completed_idx on app_modules.liveticker_game_states (completed_at desc) where completed_at is not null;

create table app_modules.liveticker_actions (
  event_id uuid not null references app_modules.events(id) on delete cascade,
  client_action_id text not null,
  ordinal bigint generated always as identity,
  action_type text not null,
  payload jsonb not null,
  is_active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(event_id,client_action_id),
  constraint liveticker_actions_client_id_check check (client_action_id ~ '^[A-Za-z0-9._:-]{1,100}$'),
  constraint liveticker_actions_type_check check (action_type in ('goal','penalty','shootout')),
  constraint liveticker_actions_payload_check check (jsonb_typeof(payload)='object'),
  constraint liveticker_actions_revision_check check (revision > 0)
);
create index liveticker_actions_live_order_idx on app_modules.liveticker_actions(event_id,ordinal) where is_active;

create table app_modules.liveticker_journal (
  id bigint generated always as identity primary key,
  event_id uuid not null references app_modules.events(id) on delete cascade,
  game_revision integer not null,
  mutation_type text not null,
  client_action_id text,
  payload jsonb,
  client_id text,
  created_at timestamptz not null default now(),
  constraint liveticker_journal_revision_check check (game_revision > 0),
  constraint liveticker_journal_type_check check (mutation_type in ('ACTION_UPSERT','ACTION_REMOVE','MINUTE_SET','GAME_COMPLETED','GAME_RESET')),
  constraint liveticker_journal_client_id_check check (client_id is null or char_length(client_id) between 1 and 100)
);
create index liveticker_journal_event_idx on app_modules.liveticker_journal(event_id,id desc);

alter table app_modules.liveticker_teams enable row level security;
alter table app_modules.liveticker_players enable row level security;
alter table app_modules.liveticker_game_states enable row level security;
alter table app_modules.liveticker_actions enable row level security;
alter table app_modules.liveticker_journal enable row level security;
revoke all on table app_modules.liveticker_teams,app_modules.liveticker_players,app_modules.liveticker_game_states,app_modules.liveticker_actions,app_modules.liveticker_journal from public,anon,authenticated;

create or replace function app_private.liveticker_require_operator()
returns uuid language plpgsql stable security definer set search_path=''
as $$ declare v_actor uuid; begin v_actor := app_private.require_capability('liveticker.manage'); return v_actor; end; $$;

create or replace function app_private.liveticker_assert_supported_game(p_event_id uuid)
returns void language plpgsql stable security definer set search_path=''
as $$ begin
  if not exists(select 1 from app_modules.events e join app_modules.event_games g on g.event_id=e.id where e.id=p_event_id and e.event_type='GAME' and e.visibility='PUBLIC') then
    raise exception 'LIVETICKER_GAME_NOT_AVAILABLE' using errcode='P0002';
  end if;
end; $$;

create or replace function app_private.liveticker_team_json(p_team_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $$
 select jsonb_build_object('id',t.id,'name',t.name,'shortName',t.short_name,'logoUrl',t.logo_url,'homeClub',t.is_home_club,'players',coalesce((
   select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'number',p.jersey_number,'position',case p.position when 'GOALIE' then 'Tor' when 'DEFENSE' then 'Verteidigung' else 'Sturm' end)
     order by case p.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end, case when p.jersey_number ~ '^[0-9]+$' then p.jersey_number::integer else 9999 end,p.full_name)
   from app_modules.liveticker_players p where p.team_id=t.id and p.is_active
 ),'[]'::jsonb)) from app_modules.liveticker_teams t where t.id=p_team_id and t.is_active;
$$;

create or replace function app_private.api_liveticker_teams_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ begin
 perform app_private.liveticker_require_operator();
 return jsonb_build_object('canManage',true,'teams',coalesce((select jsonb_agg(jsonb_build_object(
  'id',t.id,'name',t.name,'shortName',t.short_name,'logoUrl',t.logo_url,'homeClub',t.is_home_club,'active',t.is_active,'revision',t.revision,
  'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'teamId',p.team_id,'name',p.full_name,'number',p.jersey_number,'position',p.position,'active',p.is_active,'revision',p.revision)
    order by case p.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end,case when p.jersey_number ~ '^[0-9]+$' then p.jersey_number::integer else 9999 end,p.full_name) from app_modules.liveticker_players p where p.team_id=t.id),'[]'::jsonb)) order by t.is_home_club desc,t.name) from app_modules.liveticker_teams t),'[]'::jsonb));
end; $$;

create or replace function app_private.api_liveticker_team_save(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare
 v_actor uuid := app_private.liveticker_require_operator(); v_id uuid := nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid;
 v_name text := nullif(btrim(coalesce(p_payload->>'name','')),''); v_short text := nullif(btrim(coalesce(p_payload->>'shortName','')),'');
 v_logo text := nullif(btrim(coalesce(p_payload->>'logoUrl','')),''); v_home boolean := coalesce((p_payload->>'homeClub')::boolean,false); v_active boolean := coalesce((p_payload->>'active')::boolean,true);
 v_expected integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer; v_old app_modules.liveticker_teams%rowtype;
begin
 if v_name is null or char_length(v_name)>160 or v_short is null or char_length(v_short)>60 then raise exception 'Teamname und Kurzname sind erforderlich.' using errcode='22023'; end if;
 if v_logo is not null and v_logo !~ '^https://' then raise exception 'Logo-URL muss mit https:// beginnen.' using errcode='22023'; end if;
 if v_id is null then
   if v_home then update app_modules.liveticker_teams set is_home_club=false,revision=revision+1,updated_at=now(),updated_by=v_actor where is_home_club; end if;
   insert into app_modules.liveticker_teams(name,short_name,logo_url,is_home_club,is_active,created_by,updated_by) values(v_name,v_short,v_logo,v_home,v_active,v_actor,v_actor);
 else
   select * into v_old from app_modules.liveticker_teams where id=v_id for update;
   if not found then raise exception 'Team wurde nicht gefunden.' using errcode='P0002'; end if;
   if v_expected is null or v_expected<>v_old.revision then raise exception 'Das Team wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
   if v_home and not v_old.is_home_club then update app_modules.liveticker_teams set is_home_club=false,revision=revision+1,updated_at=now(),updated_by=v_actor where is_home_club and id<>v_id; end if;
   update app_modules.liveticker_teams set name=v_name,short_name=v_short,logo_url=v_logo,is_home_club=v_home,is_active=v_active,revision=revision+1,updated_at=now(),updated_by=v_actor where id=v_id;
 end if;
 return app_private.api_liveticker_teams_list();
end; $$;

create or replace function app_private.api_liveticker_player_save(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare
 v_actor uuid := app_private.liveticker_require_operator(); v_id uuid := nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid; v_team uuid := nullif(btrim(coalesce(p_payload->>'teamId','')),'')::uuid;
 v_name text := nullif(btrim(coalesce(p_payload->>'name','')),''); v_num text := nullif(regexp_replace(btrim(coalesce(p_payload->>'number','')),'^#',''),''); v_pos text := upper(btrim(coalesce(p_payload->>'position','')));
 v_active boolean := coalesce((p_payload->>'active')::boolean,true); v_expected integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer; v_old app_modules.liveticker_players%rowtype;
begin
 if v_team is null or not exists(select 1 from app_modules.liveticker_teams where id=v_team) then raise exception 'Gültiges Team ist erforderlich.' using errcode='22023'; end if;
 if v_name is null or char_length(v_name)>160 or v_pos not in ('GOALIE','DEFENSE','FORWARD') then raise exception 'Spielerdaten sind ungültig.' using errcode='22023'; end if;
 if v_num is not null and char_length(v_num)>8 then raise exception 'Trikotnummer darf maximal 8 Zeichen haben.' using errcode='22023'; end if;
 if v_id is null then insert into app_modules.liveticker_players(team_id,full_name,jersey_number,position,is_active,created_by,updated_by) values(v_team,v_name,v_num,v_pos,v_active,v_actor,v_actor);
 else
  select * into v_old from app_modules.liveticker_players where id=v_id for update;
  if not found then raise exception 'Spieler wurde nicht gefunden.' using errcode='P0002'; end if;
  if v_expected is null or v_expected<>v_old.revision then raise exception 'Der Spieler wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
  update app_modules.liveticker_players set team_id=v_team,full_name=v_name,jersey_number=v_num,position=v_pos,is_active=v_active,revision=revision+1,updated_at=now(),updated_by=v_actor where id=v_id;
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
  'opponentTeam',coalesce(app_private.liveticker_team_json(opp.id),jsonb_build_object('id',null,'name',g.opponent_name,'shortName',g.opponent_name,'logoUrl',null,'homeClub',false,'players','[]'::jsonb))
 ) order by e.event_date,e.event_time nulls first,e.id),'[]'::jsonb)) into v_result
 from app_modules.events e join app_modules.event_games g on g.event_id=e.id
 join app_modules.liveticker_teams own on own.is_home_club and own.is_active
 left join lateral(select t.id,t.short_name from app_modules.liveticker_teams t where t.is_active and not t.is_home_club and (lower(btrim(t.name))=lower(btrim(g.opponent_name)) or lower(btrim(t.short_name))=lower(btrim(g.opponent_name)) or lower(g.opponent_name) like '%'||lower(btrim(t.short_name))||'%') order by case when lower(btrim(t.name))=lower(btrim(g.opponent_name)) then 0 else 1 end,t.name limit 1) opp on true
 left join app_modules.liveticker_game_states s on s.event_id=e.id
 where e.event_type='GAME' and e.visibility='PUBLIC' and s.completed_at is null and e.event_date between ((now() at time zone 'Europe/Berlin')::date-14) and ((now() at time zone 'Europe/Berlin')::date+220);
 return v_result;
end; $$;

create or replace function public.pd_public_liveticker_state(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_rev integer:=0; v_min integer:=1; v_done timestamptz; v_hist jsonb:='[]'::jsonb; v_g record; begin
 perform app_private.liveticker_require_operator(); perform app_private.liveticker_assert_supported_game(p_event_id);
 select e.event_date,e.event_time,e.venue,g.home_away,g.opponent_name,opp.id opponent_team_id into v_g
 from app_modules.events e join app_modules.event_games g on g.event_id=e.id
 left join lateral(select t.id from app_modules.liveticker_teams t where t.is_active and not t.is_home_club and (lower(btrim(t.name))=lower(btrim(g.opponent_name)) or lower(btrim(t.short_name))=lower(btrim(g.opponent_name)) or lower(g.opponent_name) like '%'||lower(btrim(t.short_name))||'%') order by case when lower(btrim(t.name))=lower(btrim(g.opponent_name)) then 0 else 1 end,t.name limit 1) opp on true where e.id=p_event_id;
 select revision,minute,completed_at into v_rev,v_min,v_done from app_modules.liveticker_game_states where event_id=p_event_id;
 if not found then v_rev:=0;v_min:=1;v_done:=null; end if;
 select coalesce(jsonb_agg(a.payload order by a.ordinal),'[]'::jsonb) into v_hist from app_modules.liveticker_actions a where a.event_id=p_event_id and a.is_active;
 return jsonb_build_object('eventId',p_event_id,'revision',v_rev,'minute',v_min,'completedAt',v_done,'opponentId',v_g.opponent_team_id,'opponentName',v_g.opponent_name,'history',v_hist,'homeAway',v_g.home_away,'eventDate',v_g.event_date,'eventTime',v_g.event_time,'venue',v_g.venue);
end; $$;

create or replace function public.pd_public_liveticker_sync(p_event_id uuid,p_expected_revision integer,p_changes jsonb,p_client_id text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_state app_modules.liveticker_game_states%rowtype; v_item jsonb; v_id text; v_type text; v_min integer; v_new integer; v_changed boolean:=false; v_rows integer; begin
 perform app_private.liveticker_require_operator(); perform app_private.liveticker_assert_supported_game(p_event_id);
 if p_expected_revision is null or p_expected_revision<0 or p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes-array['upserts','deletes','minute']<>'{}'::jsonb or (p_client_id is not null and char_length(btrim(p_client_id)) not between 1 and 100) then raise exception 'LIVETICKER_INVALID_SYNC' using errcode='22023'; end if;
 select * into v_state from app_modules.liveticker_game_states where event_id=p_event_id for update;
 if not found then if p_expected_revision<>0 then raise exception 'LIVETICKER_STALE_REVISION' using errcode='40001'; end if; insert into app_modules.liveticker_game_states(event_id,revision,minute) values(p_event_id,0,1) returning * into v_state;
 elsif v_state.revision<>p_expected_revision then raise exception 'LIVETICKER_STALE_REVISION' using errcode='40001'; end if;
 if v_state.completed_at is not null then raise exception 'LIVETICKER_GAME_COMPLETED' using errcode='55000'; end if;
 v_new:=v_state.revision+1;
 if p_changes?'minute' then begin v_min:=(p_changes->>'minute')::integer; exception when others then raise exception 'LIVETICKER_INVALID_MINUTE' using errcode='22023'; end; if v_min not between 1 and 200 then raise exception 'LIVETICKER_INVALID_MINUTE' using errcode='22023'; end if; if v_min<>v_state.minute then update app_modules.liveticker_game_states set minute=v_min where event_id=p_event_id; insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,payload,client_id) values(p_event_id,v_new,'MINUTE_SET',jsonb_build_object('minute',v_min),nullif(btrim(p_client_id),'')); v_changed:=true; end if; end if;
 if p_changes?'upserts' then
  if jsonb_typeof(p_changes->'upserts')<>'array' or jsonb_array_length(p_changes->'upserts')>20 then raise exception 'LIVETICKER_INVALID_UPSERTS' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_changes->'upserts') loop
   if jsonb_typeof(v_item)<>'object' or jsonb_typeof(v_item->'id')<>'string' or jsonb_typeof(v_item->'type')<>'string' or octet_length(v_item::text)>20000 then raise exception 'LIVETICKER_INVALID_ACTION' using errcode='22023'; end if;
   v_id:=v_item->>'id';v_type:=v_item->>'type'; if v_id!~'^[A-Za-z0-9._:-]{1,100}$' or v_type not in ('goal','penalty','shootout') then raise exception 'LIVETICKER_INVALID_ACTION' using errcode='22023'; end if;
   if v_type in ('goal','penalty') then begin v_min:=(v_item->>'minute')::integer; exception when others then raise exception 'LIVETICKER_INVALID_ACTION_MINUTE' using errcode='22023'; end; if v_min not between 1 and 200 then raise exception 'LIVETICKER_INVALID_ACTION_MINUTE' using errcode='22023'; end if; end if;
   if v_type='goal' and coalesce(v_item->>'team','') not in ('mighty','opponent') then raise exception 'LIVETICKER_INVALID_GOAL' using errcode='22023'; end if;
   if v_type='shootout' and (coalesce(v_item->>'team','') not in ('mighty','opponent') or coalesce(v_item->>'result','') not in ('scored','missed')) then raise exception 'LIVETICKER_INVALID_SHOOTOUT' using errcode='22023'; end if;
   if v_type='penalty' and (jsonb_typeof(v_item->'penalties')<>'array' or jsonb_array_length(v_item->'penalties') not between 1 and 8) then raise exception 'LIVETICKER_INVALID_PENALTY' using errcode='22023'; end if;
   insert into app_modules.liveticker_actions(event_id,client_action_id,action_type,payload,is_active) values(p_event_id,v_id,v_type,v_item,true) on conflict(event_id,client_action_id) do update set action_type=excluded.action_type,payload=excluded.payload,is_active=true,revision=app_modules.liveticker_actions.revision+1,updated_at=now();
   insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,client_action_id,payload,client_id) values(p_event_id,v_new,'ACTION_UPSERT',v_id,v_item,nullif(btrim(p_client_id),'')); v_changed:=true;
  end loop;
 end if;
 if p_changes?'deletes' then
  if jsonb_typeof(p_changes->'deletes')<>'array' or jsonb_array_length(p_changes->'deletes')>50 then raise exception 'LIVETICKER_INVALID_DELETES' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_changes->'deletes') loop
   if jsonb_typeof(v_item)<>'string' then raise exception 'LIVETICKER_INVALID_DELETE' using errcode='22023'; end if; v_id:=trim(both '"' from v_item::text); if v_id!~'^[A-Za-z0-9._:-]{1,100}$' then raise exception 'LIVETICKER_INVALID_DELETE' using errcode='22023'; end if;
   update app_modules.liveticker_actions set is_active=false,revision=revision+1,updated_at=now() where event_id=p_event_id and client_action_id=v_id and is_active; get diagnostics v_rows=row_count;
   if v_rows>0 then insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,client_action_id,client_id) values(p_event_id,v_new,'ACTION_REMOVE',v_id,nullif(btrim(p_client_id),'')); v_changed:=true; end if;
  end loop;
 end if;
 if v_changed then update app_modules.liveticker_game_states set revision=v_new,updated_at=now() where event_id=p_event_id; end if;
 return public.pd_public_liveticker_state(p_event_id);
end; $$;

create or replace function public.pd_public_liveticker_complete(p_event_id uuid,p_expected_revision integer,p_client_id text default null)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_state app_modules.liveticker_game_states%rowtype; v_new integer; begin
 perform app_private.liveticker_require_operator(); perform app_private.liveticker_assert_supported_game(p_event_id);
 select * into v_state from app_modules.liveticker_game_states where event_id=p_event_id for update;
 if not found then if coalesce(p_expected_revision,0)<>0 then raise exception 'LIVETICKER_STALE_REVISION' using errcode='40001'; end if; insert into app_modules.liveticker_game_states(event_id,revision,minute) values(p_event_id,0,1) returning * into v_state;
 elsif p_expected_revision is null or v_state.revision<>p_expected_revision then raise exception 'LIVETICKER_STALE_REVISION' using errcode='40001'; end if;
 if v_state.completed_at is null then v_new:=v_state.revision+1; update app_modules.liveticker_game_states set revision=v_new,completed_at=now(),updated_at=now() where event_id=p_event_id; insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,client_id) values(p_event_id,v_new,'GAME_COMPLETED',nullif(btrim(p_client_id),'')); end if;
 return public.pd_public_liveticker_state(p_event_id);
end; $$;

create or replace function app_private.api_liveticker_archive_list()
returns jsonb language plpgsql stable security definer set search_path=''
as $$ declare v_actor uuid:=app_private.liveticker_require_operator(); begin
 return jsonb_build_object('games',coalesce((
  select jsonb_agg(x.item order by x.completed_at desc) from (
   select s.completed_at,
    jsonb_build_object('eventId',e.id,'eventDate',e.event_date,'eventTime',e.event_time,'venue',e.venue,'homeAway',g.home_away,
      'displayTitle',case g.home_away when 'HOME' then own.short_name||' – '||coalesce(opp.short_name,g.opponent_name) else coalesce(opp.short_name,g.opponent_name)||' – '||own.short_name end,
      'revision',s.revision,'minute',s.minute,'completedAt',s.completed_at,
      'ownScore',sc.own_goals + case when sc.so_count>0 and sc.so_own>sc.so_opp then 1 else 0 end,
      'opponentScore',sc.opp_goals + case when sc.so_count>0 and sc.so_opp>sc.so_own then 1 else 0 end,
      'suffix',case when sc.so_count>0 and sc.so_own<>sc.so_opp then 'n. P.' when sc.ot_goal then 'n. V.' else '' end,
      'goalCount',sc.goal_count,'penaltyCount',sc.penalty_count,'shootoutCount',sc.so_count) item
   from app_modules.liveticker_game_states s join app_modules.events e on e.id=s.event_id join app_modules.event_games g on g.event_id=e.id
   join app_modules.liveticker_teams own on own.is_home_club and own.is_active
   left join lateral(select t.id,t.short_name from app_modules.liveticker_teams t where t.is_active and not t.is_home_club and (lower(btrim(t.name))=lower(btrim(g.opponent_name)) or lower(btrim(t.short_name))=lower(btrim(g.opponent_name)) or lower(g.opponent_name) like '%'||lower(btrim(t.short_name))||'%') order by case when lower(btrim(t.name))=lower(btrim(g.opponent_name)) then 0 else 1 end,t.name limit 1) opp on true
   left join lateral(select
     count(*) filter(where a.action_type='goal')::int goal_count,
     count(*) filter(where a.action_type='goal' and a.payload->>'team'='mighty')::int own_goals,
     count(*) filter(where a.action_type='goal' and a.payload->>'team'='opponent')::int opp_goals,
     coalesce(sum(case when a.action_type='penalty' and jsonb_typeof(a.payload->'penalties')='array' then jsonb_array_length(a.payload->'penalties') else 0 end),0)::int penalty_count,
     count(*) filter(where a.action_type='shootout')::int so_count,
     count(*) filter(where a.action_type='shootout' and a.payload->>'team'='mighty' and a.payload->>'result'='scored')::int so_own,
     count(*) filter(where a.action_type='shootout' and a.payload->>'team'='opponent' and a.payload->>'result'='scored')::int so_opp,
     coalesce(bool_or(a.action_type='goal' and (a.payload->>'minute')::int>60),false) ot_goal
    from app_modules.liveticker_actions a where a.event_id=e.id and a.is_active) sc on true
   where s.completed_at is not null
  ) x
 ),'[]'::jsonb));
end; $$;

create or replace function app_private.api_liveticker_game_reset(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_actor uuid:=app_private.liveticker_require_operator(); v_event uuid:=nullif(btrim(coalesce(p_payload->>'eventId','')),'')::uuid; v_expected integer:=nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer; v_state app_modules.liveticker_game_states%rowtype; v_new integer; begin
 if v_event is null then raise exception 'Spiel ist erforderlich.' using errcode='22023'; end if;
 select * into v_state from app_modules.liveticker_game_states where event_id=v_event for update;
 if not found or v_state.completed_at is null then raise exception 'Abgeschlossenes Spiel wurde nicht gefunden.' using errcode='P0002'; end if;
 if v_expected is null or v_expected<>v_state.revision then raise exception 'Das Spiel wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
 v_new:=v_state.revision+1;
 update app_modules.liveticker_actions set is_active=false,revision=revision+1,updated_at=now() where event_id=v_event and is_active;
 update app_modules.liveticker_game_states set revision=v_new,minute=1,completed_at=null,updated_at=now() where event_id=v_event;
 insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,payload,client_id) values(v_event,v_new,'GAME_RESET',jsonb_build_object('actor',v_actor),null);
 perform app_private.log_audit(v_actor,'LIVETICKER_GAME_RESET','liveticker_game',v_event::text,to_jsonb(v_state),(select to_jsonb(s) from app_modules.liveticker_game_states s where s.event_id=v_event),'{}'::jsonb);
 return app_private.api_liveticker_archive_list();
end; $$;

alter function app_private.pd_api_dispatch_current(text,jsonb) rename to pd_api_dispatch_current_before_liveticker_prod_r1;
create or replace function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_action text:=lower(btrim(coalesce(p_action,''))); begin
 case v_action
  when 'liveticker_teams_list' then return app_private.api_liveticker_teams_list();
  when 'liveticker_team_save' then return app_private.api_liveticker_team_save(coalesce(p_payload,'{}'::jsonb));
  when 'liveticker_player_save' then return app_private.api_liveticker_player_save(coalesce(p_payload,'{}'::jsonb));
  when 'liveticker_archive_list' then return app_private.api_liveticker_archive_list();
  when 'liveticker_game_reset' then return app_private.api_liveticker_game_reset(coalesce(p_payload,'{}'::jsonb));
  else return app_private.pd_api_dispatch_current_before_liveticker_prod_r1(p_action,p_payload);
 end case;
end; $$;

alter function app_private.platform_action_classification(text) rename to platform_action_classification_before_liveticker_prod_r1;
create or replace function app_private.platform_action_classification(p_action text)
returns text language sql stable set search_path=''
as $$ select case lower(btrim(coalesce(p_action,''))) when 'liveticker_teams_list' then 'READ' when 'liveticker_archive_list' then 'READ' when 'liveticker_team_save' then 'USER_MUTATION' when 'liveticker_player_save' then 'USER_MUTATION' when 'liveticker_game_reset' then 'USER_MUTATION' else app_private.platform_action_classification_before_liveticker_prod_r1(p_action) end; $$;

alter function app_private.api_bootstrap() rename to api_bootstrap_before_liveticker_prod_r1;
create or replace function app_private.api_bootstrap()
returns jsonb language plpgsql security definer set search_path=''
as $$ declare v_auth uuid:=auth.uid(); v_base jsonb:=app_private.api_bootstrap_before_liveticker_prod_r1(); v_can boolean:=false; begin
 if v_auth is not null and coalesce(v_base->>'state','')='ACTIVE' then v_can:=app_private.has_capability(v_auth,'liveticker.manage'); end if;
 return jsonb_set(v_base,'{navigation,liveticker}',to_jsonb(v_can),true);
end; $$;

insert into app_portal.team_functions(code,name,description,is_active) values('SOCIAL_LIVETICKER','Liveticker','Liveticker bedienen sowie Liveticker-Teams und Kader verwalten.',true)
on conflict(code) do update set name=excluded.name,description=excluded.description,is_active=true;
insert into app_portal.team_function_capabilities(team_id,function_code,capability_code,is_active,created_by)
select id,'SOCIAL_LIVETICKER','liveticker.manage',true,null from app_portal.teams where code='SOCIAL_MEDIA' and is_active
on conflict(team_id,function_code,capability_code) do update set is_active=true;

insert into app_modules.liveticker_teams(name,short_name,is_home_club,is_active) values
 ('Mighty Dogs Schweinfurt','Mighty Dogs',true,true),('TecArt Black Dragons Erfurt','Erfurt',false,true)
on conflict do nothing;

insert into app_modules.liveticker_players(team_id,full_name,jersey_number,position)
select t.id,v.name,v.number,v.position from app_modules.liveticker_teams t join (values
 ('Mighty Dogs','Leon Pöhlmann','40','GOALIE'),('Mighty Dogs','Benedict Roßberg','42','GOALIE'),('Mighty Dogs','Lucas Kleider','2','DEFENSE'),('Mighty Dogs','Colin Freibert','5','DEFENSE'),('Mighty Dogs','Kristers Donins','19','DEFENSE'),('Mighty Dogs','Renars Dzerods Alksnis','28','DEFENSE'),('Mighty Dogs','Thomáš Pribyl','33','DEFENSE'),('Mighty Dogs','Lukas Krumpe','69','DEFENSE'),('Mighty Dogs','Ondrej Nedved',null,'DEFENSE'),('Mighty Dogs','Kevin Heckenberger','10','FORWARD'),('Mighty Dogs','Alex Asmus','24','FORWARD'),('Mighty Dogs','Tomas Cermak','41','FORWARD'),('Mighty Dogs','Pavel Bares','46','FORWARD'),('Mighty Dogs','Josef Dana','70','FORWARD'),('Mighty Dogs','Nils Melchior','84','FORWARD'),('Mighty Dogs','Dimitri Litesov','89','FORWARD'),('Mighty Dogs','Georg Pinsack','91','FORWARD'),('Mighty Dogs','Ricards Bernhards',null,'FORWARD'),
 ('Erfurt','Patrick Glatzel','37','GOALIE'),('Erfurt','Justin Spiewok','77','GOALIE'),('Erfurt','Dennis Bondarenko','2','DEFENSE'),('Erfurt','Jonas Gerstung','6','DEFENSE'),('Erfurt','René Kramer','25','DEFENSE'),('Erfurt','Phil Bischoff','44','DEFENSE'),('Erfurt','Eric Wunderlich','63','DEFENSE'),('Erfurt','Jonas Fontana',null,'DEFENSE'),('Erfurt','Philipp Hertel',null,'DEFENSE'),('Erfurt','Petr Gulda','26','FORWARD'),('Erfurt','Jesper Satzky','11','FORWARD'),('Erfurt','Maurice Keil','12','FORWARD'),('Erfurt','Enzo Herrschaft','22','FORWARD'),('Erfurt','Frédéric Potvin','27','FORWARD'),('Erfurt','Nils Herzog','43','FORWARD'),('Erfurt','Harrison Reed','83','FORWARD'),('Erfurt','Joe Kiss','92','FORWARD'),('Erfurt','Fritz Denner','96','FORWARD'),('Erfurt','Jacob Lagacé',null,'FORWARD')
) as v(team_short,name,number,position) on v.team_short=t.short_name;

revoke all on function app_private.liveticker_require_operator() from public,anon,authenticated;
revoke all on function app_private.liveticker_assert_supported_game(uuid) from public,anon,authenticated;
revoke all on function app_private.liveticker_team_json(uuid) from public,anon,authenticated;
revoke all on function app_private.api_liveticker_teams_list() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_team_save(jsonb) from public,anon,authenticated;
revoke all on function app_private.api_liveticker_player_save(jsonb) from public,anon,authenticated;
revoke all on function app_private.api_liveticker_archive_list() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_game_reset(jsonb) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_prod_r1(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.api_bootstrap() from public,anon,authenticated;
revoke all on function app_private.api_bootstrap_before_liveticker_prod_r1() from public,anon,authenticated;
revoke all on function public.pd_public_liveticker_games() from public,anon,authenticated;
revoke all on function public.pd_public_liveticker_state(uuid) from public,anon,authenticated;
revoke all on function public.pd_public_liveticker_sync(uuid,integer,jsonb,text) from public,anon,authenticated;
revoke all on function public.pd_public_liveticker_complete(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.pd_public_liveticker_games() to authenticated;
grant execute on function public.pd_public_liveticker_state(uuid) to authenticated;
grant execute on function public.pd_public_liveticker_sync(uuid,integer,jsonb,text) to authenticated;
grant execute on function public.pd_public_liveticker_complete(uuid,integer,text) to authenticated;
