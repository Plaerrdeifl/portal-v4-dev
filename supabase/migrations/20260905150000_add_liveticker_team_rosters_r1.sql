-- Plärrdeifl Portal V4
-- Liveticker R1: zentrale Teams und Kader für DEV.

insert into app_portal.capabilities (code, name, category, description, is_active, sort_order)
values (
  'liveticker.manage',
  'Liveticker verwalten',
  'Liveticker',
  'Liveticker-Teams, Kader und die Liveticker-Bedienung verwalten.',
  true,
  230
)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

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

create unique index liveticker_teams_name_unique_idx
  on app_modules.liveticker_teams (lower(btrim(name)));
create unique index liveticker_teams_single_home_club_idx
  on app_modules.liveticker_teams (is_home_club)
  where is_home_club;

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

create index liveticker_players_team_idx
  on app_modules.liveticker_players (team_id, is_active, position, full_name);

alter table app_modules.liveticker_teams enable row level security;
alter table app_modules.liveticker_players enable row level security;
revoke all on table app_modules.liveticker_teams from public, anon, authenticated;
revoke all on table app_modules.liveticker_players from public, anon, authenticated;

create or replace function app_private.api_liveticker_teams_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
begin
  return jsonb_build_object(
    'canManage', true,
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', team.id,
          'name', team.name,
          'shortName', team.short_name,
          'logoUrl', team.logo_url,
          'homeClub', team.is_home_club,
          'active', team.is_active,
          'revision', team.revision,
          'players', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', player.id,
                'teamId', player.team_id,
                'name', player.full_name,
                'number', player.jersey_number,
                'position', player.position,
                'active', player.is_active,
                'revision', player.revision
              )
              order by
                case player.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end,
                case when player.jersey_number ~ '^[0-9]+$' then player.jersey_number::integer else 9999 end,
                player.full_name
            )
            from app_modules.liveticker_players as player
            where player.team_id = team.id
          ), '[]'::jsonb)
        )
        order by team.is_home_club desc, team.name
      )
      from app_modules.liveticker_teams as team
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function app_private.api_liveticker_team_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
  v_id uuid := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
  v_name text := nullif(btrim(coalesce(p_payload ->> 'name', '')), '');
  v_short_name text := nullif(btrim(coalesce(p_payload ->> 'shortName', '')), '');
  v_logo_url text := nullif(btrim(coalesce(p_payload ->> 'logoUrl', '')), '');
  v_home_club boolean := coalesce((p_payload ->> 'homeClub')::boolean, false);
  v_active boolean := coalesce((p_payload ->> 'active')::boolean, true);
  v_expected_revision integer := nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_existing app_modules.liveticker_teams%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if v_name is null or char_length(v_name) > 160 then
    raise exception 'Teamname ist erforderlich und darf maximal 160 Zeichen haben.' using errcode = '22023';
  end if;
  if v_short_name is null or char_length(v_short_name) > 60 then
    raise exception 'Kurzname ist erforderlich und darf maximal 60 Zeichen haben.' using errcode = '22023';
  end if;
  if v_logo_url is not null and v_logo_url !~ '^https://' then
    raise exception 'Logo-URL muss mit https:// beginnen.' using errcode = '22023';
  end if;

  if v_id is null then
    if v_home_club then
      update app_modules.liveticker_teams
      set is_home_club = false,
          revision = revision + 1,
          updated_at = now(),
          updated_by = v_actor
      where is_home_club;
    end if;

    insert into app_modules.liveticker_teams (
      name, short_name, logo_url, is_home_club, is_active, created_by, updated_by
    ) values (
      v_name, v_short_name, v_logo_url, v_home_club, v_active, v_actor, v_actor
    ) returning id into v_id;

    select to_jsonb(team) into v_after
    from app_modules.liveticker_teams as team where team.id = v_id;
    perform app_private.log_audit(v_actor, 'LIVETICKER_TEAM_CREATED', 'liveticker_team', v_id::text, null, v_after, '{}'::jsonb);
  else
    select * into v_existing
    from app_modules.liveticker_teams
    where id = v_id
    for update;

    if v_existing.id is null then
      raise exception 'Team wurde nicht gefunden.' using errcode = 'P0002';
    end if;
    if v_expected_revision is null or v_expected_revision <> v_existing.revision then
      raise exception 'Das Team wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode = '40001';
    end if;

    v_before := to_jsonb(v_existing);

    if v_home_club and not v_existing.is_home_club then
      update app_modules.liveticker_teams
      set is_home_club = false,
          revision = revision + 1,
          updated_at = now(),
          updated_by = v_actor
      where is_home_club and id <> v_id;
    end if;

    update app_modules.liveticker_teams
    set name = v_name,
        short_name = v_short_name,
        logo_url = v_logo_url,
        is_home_club = v_home_club,
        is_active = v_active,
        revision = revision + 1,
        updated_at = now(),
        updated_by = v_actor
    where id = v_id;

    select to_jsonb(team) into v_after
    from app_modules.liveticker_teams as team where team.id = v_id;
    perform app_private.log_audit(v_actor, 'LIVETICKER_TEAM_UPDATED', 'liveticker_team', v_id::text, v_before, v_after, '{}'::jsonb);
  end if;

  return app_private.api_liveticker_teams_list();
end;
$$;

create or replace function app_private.api_liveticker_player_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('liveticker.manage');
  v_id uuid := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
  v_team_id uuid := nullif(btrim(coalesce(p_payload ->> 'teamId', '')), '')::uuid;
  v_name text := nullif(btrim(coalesce(p_payload ->> 'name', '')), '');
  v_number text := nullif(regexp_replace(btrim(coalesce(p_payload ->> 'number', '')), '^#', ''), '');
  v_position text := upper(btrim(coalesce(p_payload ->> 'position', '')));
  v_active boolean := coalesce((p_payload ->> 'active')::boolean, true);
  v_expected_revision integer := nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_existing app_modules.liveticker_players%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if v_team_id is null or not exists (select 1 from app_modules.liveticker_teams where id = v_team_id) then
    raise exception 'Gültiges Team ist erforderlich.' using errcode = '22023';
  end if;
  if v_name is null or char_length(v_name) > 160 then
    raise exception 'Spielername ist erforderlich und darf maximal 160 Zeichen haben.' using errcode = '22023';
  end if;
  if v_number is not null and char_length(v_number) > 8 then
    raise exception 'Trikotnummer darf maximal 8 Zeichen haben.' using errcode = '22023';
  end if;
  if v_position not in ('GOALIE','DEFENSE','FORWARD') then
    raise exception 'Position ist ungültig.' using errcode = '22023';
  end if;

  if v_id is null then
    insert into app_modules.liveticker_players (
      team_id, full_name, jersey_number, position, is_active, created_by, updated_by
    ) values (
      v_team_id, v_name, v_number, v_position, v_active, v_actor, v_actor
    ) returning id into v_id;

    select to_jsonb(player) into v_after
    from app_modules.liveticker_players as player where player.id = v_id;
    perform app_private.log_audit(v_actor, 'LIVETICKER_PLAYER_CREATED', 'liveticker_player', v_id::text, null, v_after, jsonb_build_object('teamId', v_team_id));
  else
    select * into v_existing
    from app_modules.liveticker_players
    where id = v_id
    for update;

    if v_existing.id is null then
      raise exception 'Spieler wurde nicht gefunden.' using errcode = 'P0002';
    end if;
    if v_expected_revision is null or v_expected_revision <> v_existing.revision then
      raise exception 'Der Spieler wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode = '40001';
    end if;

    v_before := to_jsonb(v_existing);

    update app_modules.liveticker_players
    set team_id = v_team_id,
        full_name = v_name,
        jersey_number = v_number,
        position = v_position,
        is_active = v_active,
        revision = revision + 1,
        updated_at = now(),
        updated_by = v_actor
    where id = v_id;

    select to_jsonb(player) into v_after
    from app_modules.liveticker_players as player where player.id = v_id;
    perform app_private.log_audit(v_actor, 'LIVETICKER_PLAYER_UPDATED', 'liveticker_player', v_id::text, v_before, v_after, jsonb_build_object('teamId', v_team_id));
  end if;

  return app_private.api_liveticker_teams_list();
end;
$$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_liveticker_teams_r1;

create or replace function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
begin
  case v_action
    when 'liveticker_teams_list' then return app_private.api_liveticker_teams_list();
    when 'liveticker_team_save' then return app_private.api_liveticker_team_save(coalesce(p_payload, '{}'::jsonb));
    when 'liveticker_player_save' then return app_private.api_liveticker_player_save(coalesce(p_payload, '{}'::jsonb));
    else return app_private.pd_api_dispatch_current_before_liveticker_teams_r1(p_action, p_payload);
  end case;
end;
$$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_liveticker_teams_r1;

create or replace function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $$
  select case lower(btrim(coalesce(p_action, '')))
    when 'liveticker_teams_list' then 'READ'
    when 'liveticker_team_save' then 'USER_MUTATION'
    when 'liveticker_player_save' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_liveticker_teams_r1(p_action)
  end;
$$;

revoke all on function app_private.api_liveticker_teams_list() from public, anon, authenticated;
revoke all on function app_private.api_liveticker_team_save(jsonb) from public, anon, authenticated;
revoke all on function app_private.api_liveticker_player_save(jsonb) from public, anon, authenticated;
revoke all on function app_private.pd_api_dispatch_current(text, jsonb) from public, anon, authenticated;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_teams_r1(text, jsonb) from public, anon, authenticated;

insert into app_modules.liveticker_teams (name, short_name, is_home_club, is_active)
values
  ('Mighty Dogs Schweinfurt', 'Mighty Dogs', true, true),
  ('TecArt Black Dragons Erfurt', 'Erfurt', false, true)
on conflict do nothing;

insert into app_modules.liveticker_players (team_id, full_name, jersey_number, position)
select team.id, seed.name, seed.number, seed.position
from app_modules.liveticker_teams as team
join (values
  ('Mighty Dogs','Leon Pöhlmann','40','GOALIE'),
  ('Mighty Dogs','Benedict Roßberg','42','GOALIE'),
  ('Mighty Dogs','Lucas Kleider','2','DEFENSE'),
  ('Mighty Dogs','Colin Freibert','5','DEFENSE'),
  ('Mighty Dogs','Kristers Donins','19','DEFENSE'),
  ('Mighty Dogs','Renars Dzerods Alksnis','28','DEFENSE'),
  ('Mighty Dogs','Thomáš Pribyl','33','DEFENSE'),
  ('Mighty Dogs','Lukas Krumpe','69','DEFENSE'),
  ('Mighty Dogs','Ondrej Nedved',null,'DEFENSE'),
  ('Mighty Dogs','Kevin Heckenberger','10','FORWARD'),
  ('Mighty Dogs','Alex Asmus','24','FORWARD'),
  ('Mighty Dogs','Tomas Cermak','41','FORWARD'),
  ('Mighty Dogs','Pavel Bares','46','FORWARD'),
  ('Mighty Dogs','Josef Dana','70','FORWARD'),
  ('Mighty Dogs','Nils Melchior','84','FORWARD'),
  ('Mighty Dogs','Dimitri Litesov','89','FORWARD'),
  ('Mighty Dogs','Georg Pinsack','91','FORWARD'),
  ('Mighty Dogs','Ricards Bernhards',null,'FORWARD'),
  ('Erfurt','Patrick Glatzel','37','GOALIE'),
  ('Erfurt','Justin Spiewok','77','GOALIE'),
  ('Erfurt','Dennis Bondarenko','2','DEFENSE'),
  ('Erfurt','Jonas Gerstung','6','DEFENSE'),
  ('Erfurt','René Kramer','25','DEFENSE'),
  ('Erfurt','Phil Bischoff','44','DEFENSE'),
  ('Erfurt','Eric Wunderlich','63','DEFENSE'),
  ('Erfurt','Jonas Fontana',null,'DEFENSE'),
  ('Erfurt','Philipp Hertel',null,'DEFENSE'),
  ('Erfurt','Petr Gulda','26','FORWARD'),
  ('Erfurt','Jesper Satzky','11','FORWARD'),
  ('Erfurt','Maurice Keil','12','FORWARD'),
  ('Erfurt','Enzo Herrschaft','22','FORWARD'),
  ('Erfurt','Frédéric Potvin','27','FORWARD'),
  ('Erfurt','Nils Herzog','43','FORWARD'),
  ('Erfurt','Harrison Reed','83','FORWARD'),
  ('Erfurt','Joe Kiss','92','FORWARD'),
  ('Erfurt','Fritz Denner','96','FORWARD'),
  ('Erfurt','Jacob Lagacé',null,'FORWARD')
) as seed(short_name, name, number, position)
  on seed.short_name = team.short_name
where not exists (
  select 1 from app_modules.liveticker_players as existing
  where existing.team_id = team.id and existing.full_name = seed.name
);
