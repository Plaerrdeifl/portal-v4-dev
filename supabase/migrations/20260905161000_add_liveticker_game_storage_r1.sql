-- Plärrdeifl Portal V4
-- Liveticker R2: spielbezogene DEV-Speicherung für den öffentlichen Prototyp.
-- PROD bleibt fail-closed: anonyme Schreibzugriffe funktionieren ausschließlich,
-- wenn platform.mode.environment = DEV und mode = NORMAL ist.

create table app_modules.liveticker_game_states (
  event_id uuid primary key references app_modules.events(id) on delete cascade,
  revision integer not null default 0,
  minute integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint liveticker_game_states_revision_check check (revision >= 0),
  constraint liveticker_game_states_minute_check check (minute between 1 and 200)
);

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
  primary key (event_id, client_action_id),
  constraint liveticker_actions_client_id_check check (client_action_id ~ '^[A-Za-z0-9._:-]{1,100}$'),
  constraint liveticker_actions_type_check check (action_type in ('goal','penalty','shootout')),
  constraint liveticker_actions_payload_check check (jsonb_typeof(payload) = 'object'),
  constraint liveticker_actions_revision_check check (revision > 0)
);

create index liveticker_actions_live_order_idx
  on app_modules.liveticker_actions (event_id, ordinal)
  where is_active;

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
  constraint liveticker_journal_type_check check (mutation_type in ('ACTION_UPSERT','ACTION_REMOVE','MINUTE_SET')),
  constraint liveticker_journal_client_id_check check (client_id is null or char_length(client_id) between 1 and 100)
);

create index liveticker_journal_event_idx
  on app_modules.liveticker_journal (event_id, id desc);

alter table app_modules.liveticker_game_states enable row level security;
alter table app_modules.liveticker_actions enable row level security;
alter table app_modules.liveticker_journal enable row level security;

revoke all on table
  app_modules.liveticker_game_states,
  app_modules.liveticker_actions,
  app_modules.liveticker_journal
from public, anon, authenticated;

create function app_private.liveticker_require_public_dev()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_value jsonb;
begin
  select setting.value into v_value
  from app_portal.settings as setting
  where setting.key = 'platform.mode';

  if jsonb_typeof(v_value) <> 'object'
     or v_value ->> 'environment' <> 'DEV'
     or v_value ->> 'mode' <> 'NORMAL' then
    raise exception 'LIVETICKER_PUBLIC_DEV_ONLY' using errcode = '42501';
  end if;
end;
$$;

create function app_private.liveticker_assert_supported_game(p_event_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from app_modules.events as event
    join app_modules.event_games as game on game.event_id = event.id
    join app_modules.liveticker_teams as own_team
      on own_team.is_home_club and own_team.is_active
    join app_modules.liveticker_teams as opponent_team
      on opponent_team.is_active
     and not opponent_team.is_home_club
     and (
       lower(btrim(opponent_team.name)) = lower(btrim(game.opponent_name))
       or lower(btrim(opponent_team.short_name)) = lower(btrim(game.opponent_name))
     )
    where event.id = p_event_id
      and event.event_type = 'GAME'
      and event.visibility = 'PUBLIC'
  ) then
    raise exception 'LIVETICKER_GAME_NOT_AVAILABLE' using errcode = 'P0002';
  end if;
end;
$$;

create function app_private.liveticker_team_json(p_team_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', team.id,
    'name', team.name,
    'shortName', team.short_name,
    'logoUrl', team.logo_url,
    'homeClub', team.is_home_club,
    'players', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', player.id,
          'name', player.full_name,
          'number', player.jersey_number,
          'position', case player.position
            when 'GOALIE' then 'Tor'
            when 'DEFENSE' then 'Verteidigung'
            else 'Sturm'
          end
        )
        order by
          case player.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end,
          case when player.jersey_number ~ '^[0-9]+$' then player.jersey_number::integer else 9999 end,
          player.full_name
      )
      from app_modules.liveticker_players as player
      where player.team_id = team.id
        and player.is_active
    ), '[]'::jsonb)
  )
  from app_modules.liveticker_teams as team
  where team.id = p_team_id
    and team.is_active;
$$;

create function public.pd_public_liveticker_games()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'games',
    coalesce(jsonb_agg(
      jsonb_build_object(
        'eventId', event.id,
        'eventDate', event.event_date,
        'eventTime', event.event_time,
        'venue', event.venue,
        'homeAway', game.home_away,
        'displayTitle', case game.home_away
          when 'HOME' then own_team.short_name || ' – ' || opponent_team.short_name
          else opponent_team.short_name || ' – ' || own_team.short_name
        end,
        'ownTeam', app_private.liveticker_team_json(own_team.id),
        'opponentTeam', app_private.liveticker_team_json(opponent_team.id)
      )
      order by event.event_date, event.event_time nulls first, event.id
    ), '[]'::jsonb)
  )
  from app_modules.events as event
  join app_modules.event_games as game on game.event_id = event.id
  join app_modules.liveticker_teams as own_team
    on own_team.is_home_club and own_team.is_active
  join app_modules.liveticker_teams as opponent_team
    on opponent_team.is_active
   and not opponent_team.is_home_club
   and (
     lower(btrim(opponent_team.name)) = lower(btrim(game.opponent_name))
     or lower(btrim(opponent_team.short_name)) = lower(btrim(game.opponent_name))
   )
  where event.event_type = 'GAME'
    and event.visibility = 'PUBLIC'
    and event.event_date between
      ((now() at time zone 'Europe/Berlin')::date - 14)
      and ((now() at time zone 'Europe/Berlin')::date + 220);
$$;

create function public.pd_public_liveticker_state(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_game record;
  v_revision integer := 0;
  v_minute integer := 1;
  v_history jsonb := '[]'::jsonb;
begin
  perform app_private.liveticker_assert_supported_game(p_event_id);

  select
    event.id as event_id,
    event.event_date,
    event.event_time,
    event.venue,
    game.home_away,
    own_team.id as own_team_id,
    opponent_team.id as opponent_team_id
  into v_game
  from app_modules.events as event
  join app_modules.event_games as game on game.event_id = event.id
  join app_modules.liveticker_teams as own_team
    on own_team.is_home_club and own_team.is_active
  join app_modules.liveticker_teams as opponent_team
    on opponent_team.is_active
   and not opponent_team.is_home_club
   and (
     lower(btrim(opponent_team.name)) = lower(btrim(game.opponent_name))
     or lower(btrim(opponent_team.short_name)) = lower(btrim(game.opponent_name))
   )
  where event.id = p_event_id;

  select state.revision, state.minute
  into v_revision, v_minute
  from app_modules.liveticker_game_states as state
  where state.event_id = p_event_id;

  if not found then
    v_revision := 0;
    v_minute := 1;
  end if;

  select coalesce(jsonb_agg(action.payload order by action.ordinal), '[]'::jsonb)
  into v_history
  from app_modules.liveticker_actions as action
  where action.event_id = p_event_id
    and action.is_active;

  return jsonb_build_object(
    'eventId', p_event_id,
    'revision', v_revision,
    'minute', v_minute,
    'opponentId', v_game.opponent_team_id,
    'history', v_history,
    'homeAway', v_game.home_away,
    'eventDate', v_game.event_date,
    'eventTime', v_game.event_time,
    'venue', v_game.venue
  );
end;
$$;

create function public.pd_public_liveticker_sync(
  p_event_id uuid,
  p_expected_revision integer,
  p_changes jsonb,
  p_client_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state app_modules.liveticker_game_states%rowtype;
  v_item jsonb;
  v_action_id text;
  v_action_type text;
  v_minute integer;
  v_new_revision integer;
  v_changed boolean := false;
  v_rows integer;
begin
  perform app_private.liveticker_require_public_dev();
  perform app_private.liveticker_assert_supported_game(p_event_id);

  if p_expected_revision is null or p_expected_revision < 0
     or p_changes is null or jsonb_typeof(p_changes) <> 'object'
     or p_changes - array['upserts','deletes','minute'] <> '{}'::jsonb
     or (p_client_id is not null and char_length(btrim(p_client_id)) not between 1 and 100) then
    raise exception 'LIVETICKER_INVALID_SYNC' using errcode = '22023';
  end if;

  select * into v_state
  from app_modules.liveticker_game_states
  where event_id = p_event_id
  for update;

  if not found then
    if p_expected_revision <> 0 then
      raise exception 'LIVETICKER_STALE_REVISION' using errcode = '40001';
    end if;
    insert into app_modules.liveticker_game_states(event_id, revision, minute)
    values (p_event_id, 0, 1)
    returning * into v_state;
  elsif v_state.revision <> p_expected_revision then
    raise exception 'LIVETICKER_STALE_REVISION' using errcode = '40001';
  end if;

  v_new_revision := v_state.revision + 1;

  if p_changes ? 'minute' then
    begin
      v_minute := (p_changes ->> 'minute')::integer;
    exception when others then
      raise exception 'LIVETICKER_INVALID_MINUTE' using errcode = '22023';
    end;
    if v_minute not between 1 and 200 then
      raise exception 'LIVETICKER_INVALID_MINUTE' using errcode = '22023';
    end if;
    if v_minute <> v_state.minute then
      update app_modules.liveticker_game_states
      set minute = v_minute
      where event_id = p_event_id;
      insert into app_modules.liveticker_journal(event_id, game_revision, mutation_type, payload, client_id)
      values (p_event_id, v_new_revision, 'MINUTE_SET', jsonb_build_object('minute', v_minute), nullif(btrim(p_client_id), ''));
      v_changed := true;
    end if;
  end if;

  if p_changes ? 'upserts' then
    if jsonb_typeof(p_changes -> 'upserts') <> 'array'
       or jsonb_array_length(p_changes -> 'upserts') > 20 then
      raise exception 'LIVETICKER_INVALID_UPSERTS' using errcode = '22023';
    end if;

    for v_item in select value from jsonb_array_elements(p_changes -> 'upserts')
    loop
      if jsonb_typeof(v_item) <> 'object'
         or jsonb_typeof(v_item -> 'id') <> 'string'
         or jsonb_typeof(v_item -> 'type') <> 'string'
         or octet_length(v_item::text) > 20000 then
        raise exception 'LIVETICKER_INVALID_ACTION' using errcode = '22023';
      end if;

      v_action_id := v_item ->> 'id';
      v_action_type := v_item ->> 'type';
      if v_action_id !~ '^[A-Za-z0-9._:-]{1,100}$'
         or v_action_type not in ('goal','penalty','shootout') then
        raise exception 'LIVETICKER_INVALID_ACTION' using errcode = '22023';
      end if;

      if v_action_type in ('goal','penalty') then
        begin
          v_minute := (v_item ->> 'minute')::integer;
        exception when others then
          raise exception 'LIVETICKER_INVALID_ACTION_MINUTE' using errcode = '22023';
        end;
        if v_minute not between 1 and 200 then
          raise exception 'LIVETICKER_INVALID_ACTION_MINUTE' using errcode = '22023';
        end if;
      end if;

      if v_action_type = 'goal'
         and coalesce(v_item ->> 'team', '') not in ('mighty','opponent') then
        raise exception 'LIVETICKER_INVALID_GOAL' using errcode = '22023';
      end if;
      if v_action_type = 'shootout'
         and (coalesce(v_item ->> 'team', '') not in ('mighty','opponent')
              or coalesce(v_item ->> 'result', '') not in ('scored','missed')) then
        raise exception 'LIVETICKER_INVALID_SHOOTOUT' using errcode = '22023';
      end if;
      if v_action_type = 'penalty'
         and (jsonb_typeof(v_item -> 'penalties') <> 'array'
              or jsonb_array_length(v_item -> 'penalties') not between 1 and 8) then
        raise exception 'LIVETICKER_INVALID_PENALTY' using errcode = '22023';
      end if;

      insert into app_modules.liveticker_actions(
        event_id, client_action_id, action_type, payload, is_active
      ) values (
        p_event_id, v_action_id, v_action_type, v_item, true
      )
      on conflict (event_id, client_action_id) do update
      set action_type = excluded.action_type,
          payload = excluded.payload,
          is_active = true,
          revision = app_modules.liveticker_actions.revision + 1,
          updated_at = now();

      insert into app_modules.liveticker_journal(
        event_id, game_revision, mutation_type, client_action_id, payload, client_id
      ) values (
        p_event_id, v_new_revision, 'ACTION_UPSERT', v_action_id, v_item, nullif(btrim(p_client_id), '')
      );
      v_changed := true;
    end loop;
  end if;

  if p_changes ? 'deletes' then
    if jsonb_typeof(p_changes -> 'deletes') <> 'array'
       or jsonb_array_length(p_changes -> 'deletes') > 50 then
      raise exception 'LIVETICKER_INVALID_DELETES' using errcode = '22023';
    end if;

    for v_item in select value from jsonb_array_elements(p_changes -> 'deletes')
    loop
      if jsonb_typeof(v_item) <> 'string' then
        raise exception 'LIVETICKER_INVALID_DELETE' using errcode = '22023';
      end if;
      v_action_id := trim(both '"' from v_item::text);
      if v_action_id !~ '^[A-Za-z0-9._:-]{1,100}$' then
        raise exception 'LIVETICKER_INVALID_DELETE' using errcode = '22023';
      end if;

      update app_modules.liveticker_actions
      set is_active = false,
          revision = revision + 1,
          updated_at = now()
      where event_id = p_event_id
        and client_action_id = v_action_id
        and is_active;
      get diagnostics v_rows = row_count;

      if v_rows > 0 then
        insert into app_modules.liveticker_journal(
          event_id, game_revision, mutation_type, client_action_id, client_id
        ) values (
          p_event_id, v_new_revision, 'ACTION_REMOVE', v_action_id, nullif(btrim(p_client_id), '')
        );
        v_changed := true;
      end if;
    end loop;
  end if;

  if v_changed then
    update app_modules.liveticker_game_states
    set revision = v_new_revision,
        updated_at = now()
    where event_id = p_event_id;
  end if;

  return public.pd_public_liveticker_state(p_event_id);
end;
$$;

revoke all on function app_private.liveticker_require_public_dev() from public, anon, authenticated;
revoke all on function app_private.liveticker_assert_supported_game(uuid) from public, anon, authenticated;
revoke all on function app_private.liveticker_team_json(uuid) from public, anon, authenticated;
revoke all on function public.pd_public_liveticker_games() from public, anon, authenticated;
revoke all on function public.pd_public_liveticker_state(uuid) from public, anon, authenticated;
revoke all on function public.pd_public_liveticker_sync(uuid, integer, jsonb, text) from public, anon, authenticated;

grant execute on function public.pd_public_liveticker_games() to anon, authenticated;
grant execute on function public.pd_public_liveticker_state(uuid) to anon, authenticated;
grant execute on function public.pd_public_liveticker_sync(uuid, integer, jsonb, text) to anon, authenticated;

-- Das erste Vorbereitungsspiel fehlt im bisherigen zentralen Kalender.
-- Nur DEV erhält den Seed; PROD wird durch die environment-Prüfung nicht verändert.
do $$
declare
  v_environment text;
  v_event_id uuid;
begin
  select setting.value ->> 'environment' into v_environment
  from app_portal.settings as setting
  where setting.key = 'platform.mode';

  if v_environment = 'DEV'
     and not exists (
       select 1
       from app_modules.events as event
       join app_modules.event_games as game on game.event_id = event.id
       where event.event_date = date '2026-09-11'
         and event.event_time = time '20:00'
         and game.home_away = 'HOME'
         and lower(btrim(game.opponent_name)) = lower('TecArt Black Dragons Erfurt')
     ) then
    insert into app_modules.events(
      event_type, event_date, event_time, visibility, description
    ) values (
      'GAME', date '2026-09-11', time '20:00', 'PUBLIC', 'Vorbereitungsspiel'
    ) returning id into v_event_id;

    insert into app_modules.event_games(event_id, home_away, opponent_name)
    values (v_event_id, 'HOME', 'TecArt Black Dragons Erfurt');
  end if;
end;
$$;
