-- Plärrdeifl Portal V4
-- M210-R1 / F1.1: Zentrales Termin-Datenmodell

create table app_modules.events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_type text not null,
  title text,
  event_date date not null,
  event_time time without time zone,
  end_date date,
  end_time time without time zone,
  venue text,
  description text,
  visibility text not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid
    references app_portal.users(id)
    on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid
    references app_portal.users(id)
    on delete set null,
  constraint events_event_type_check
    check (event_type in ('GAME', 'FANCLUB', 'OTHER')),
  constraint events_title_check
    check (
      (
        event_type = 'GAME'
        and (title is null or length(btrim(title)) > 0)
      )
      or (
        event_type in ('FANCLUB', 'OTHER')
        and title is not null
        and length(btrim(title)) > 0
      )
    ),
  constraint events_visibility_check
    check (visibility in ('PUBLIC', 'INTERNAL')),
  constraint events_end_date_check
    check (end_date is null or end_date >= event_date),
  constraint events_end_time_check
    check (
      end_date is distinct from event_date
      or event_time is null
      or end_time is null
      or end_time >= event_time
    )
);

create table app_modules.event_games (
  event_id uuid primary key
    references app_modules.events(id)
    on delete cascade,
  home_away text not null,
  opponent_name text not null,
  constraint event_games_home_away_check
    check (home_away in ('HOME', 'AWAY')),
  constraint event_games_opponent_name_check
    check (length(btrim(opponent_name)) > 0)
);

create or replace function app_private.ensure_event_game_parent_is_game()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_event_type text;
begin
  select event.event_type
    into v_event_type
  from app_modules.events as event
  where event.id = new.event_id
  for update;

  if found and v_event_type <> 'GAME' then
    raise exception 'event_games ist ausschließlich für GAME-Termine zulässig.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger event_games_require_game_event
before insert or update of event_id on app_modules.event_games
for each row execute function app_private.ensure_event_game_parent_is_game();

create or replace function app_private.prevent_game_event_type_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.event_type = 'GAME'
     and new.event_type <> 'GAME'
     and exists (
       select 1
       from app_modules.event_games as game
       where game.event_id = old.id
     ) then
    raise exception 'Ein Event mit event_games-Datensatz muss vom Typ GAME bleiben.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger events_preserve_game_event_type
before update of event_type on app_modules.events
for each row execute function app_private.prevent_game_event_type_change();

create trigger events_set_updated_at
before update on app_modules.events
for each row execute function app_private.set_updated_at();

alter table app_modules.events enable row level security;
alter table app_modules.event_games enable row level security;

revoke all on table app_modules.events, app_modules.event_games
  from public, anon, authenticated;

revoke all on function app_private.ensure_event_game_parent_is_game()
  from public, anon, authenticated;

revoke all on function app_private.prevent_game_event_type_change()
  from public, anon, authenticated;

insert into app_portal.capabilities (
  code,
  name,
  category,
  description,
  sort_order
)
values (
  'events.manage',
  'Termine und Spieltage verwalten',
  'Termine',
  'Termine und Spieltage verwalten.',
  170
);
