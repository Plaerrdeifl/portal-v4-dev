-- Fanbus Tippspiel: granular entries, immutable trip snapshots and optimistic locking.

begin;

create table app_modules.fanbus_prediction_games (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null unique
    references app_modules.events(id) on delete restrict,
  trip_id uuid
    references app_modules.fanbus_trips(id) on delete restrict,
  mode text not null,
  status text not null default 'OPEN',
  dogs_goals integer,
  opponent_goals integer,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_prediction_games_mode_check
    check (mode in ('TRIP', 'MANUAL')),
  constraint fanbus_prediction_games_trip_mode_check
    check ((mode = 'TRIP' and trip_id is not null) or (mode = 'MANUAL' and trip_id is null)),
  constraint fanbus_prediction_games_status_check
    check (status in ('OPEN', 'CLOSED', 'EVALUATED')),
  constraint fanbus_prediction_games_result_check
    check (
      (dogs_goals is null and opponent_goals is null)
      or (dogs_goals between 0 and 99 and opponent_goals between 0 and 99)
    ),
  constraint fanbus_prediction_games_evaluated_check
    check (status <> 'EVALUATED' or (dogs_goals is not null and opponent_goals is not null)),
  constraint fanbus_prediction_games_revision_check check (revision > 0)
);

create index fanbus_prediction_games_trip_idx
  on app_modules.fanbus_prediction_games(trip_id)
  where trip_id is not null;
create index fanbus_prediction_games_status_idx
  on app_modules.fanbus_prediction_games(status, created_at desc);

create table app_modules.fanbus_prediction_participants (
  id uuid primary key default extensions.gen_random_uuid(),
  prediction_game_id uuid not null
    references app_modules.fanbus_prediction_games(id) on delete cascade,
  fanbus_registration_id uuid
    references app_modules.fanbus_registrations(id) on delete restrict,
  manual_name text,
  name_snapshot text not null,
  bus_id_snapshot uuid,
  bus_label_snapshot text,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_prediction_participants_source_check
    check (
      (fanbus_registration_id is not null and manual_name is null)
      or (fanbus_registration_id is null and manual_name is not null)
    ),
  constraint fanbus_prediction_participants_manual_name_check
    check (manual_name is null or char_length(btrim(manual_name)) between 1 and 160),
  constraint fanbus_prediction_participants_snapshot_check
    check (char_length(btrim(name_snapshot)) between 1 and 160),
  constraint fanbus_prediction_participants_bus_label_check
    check (bus_label_snapshot is null or char_length(btrim(bus_label_snapshot)) between 1 and 120),
  constraint fanbus_prediction_participants_revision_check check (revision > 0)
);

create unique index fanbus_prediction_participants_registration_idx
  on app_modules.fanbus_prediction_participants(prediction_game_id, fanbus_registration_id)
  where fanbus_registration_id is not null;
create index fanbus_prediction_participants_game_idx
  on app_modules.fanbus_prediction_participants(prediction_game_id, created_at, id);

create table app_modules.fanbus_prediction_tips (
  participant_id uuid not null
    references app_modules.fanbus_prediction_participants(id) on delete cascade,
  tip_number smallint not null,
  dogs_goals integer not null,
  opponent_goals integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (participant_id, tip_number),
  unique (participant_id, dogs_goals, opponent_goals),
  constraint fanbus_prediction_tips_number_check check (tip_number between 1 and 3),
  constraint fanbus_prediction_tips_dogs_goals_check check (dogs_goals between 0 and 99),
  constraint fanbus_prediction_tips_opponent_goals_check check (opponent_goals between 0 and 99)
);

alter table app_modules.fanbus_prediction_games enable row level security;
alter table app_modules.fanbus_prediction_participants enable row level security;
alter table app_modules.fanbus_prediction_tips enable row level security;

revoke all on table
  app_modules.fanbus_prediction_games,
  app_modules.fanbus_prediction_participants,
  app_modules.fanbus_prediction_tips
from public, anon, authenticated, service_role;

create function app_private.fanbus_prediction_require_operator()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null or not exists (
    select 1
    from app_portal.users as portal_user
    where portal_user.id = v_actor
      and portal_user.status = 'ACTIVE'
  ) then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  if not (
    app_private.has_capability(v_actor, 'fanbus.manage')
    or app_private.has_capability(v_actor, 'fanbus.registrations.manage')
    or app_private.has_capability(v_actor, 'fanbus.operations.manage')
    or app_private.has_capability(v_actor, 'fanbus.payment_marker.manage')
    or app_private.has_capability(v_actor, 'fanbus.publishing.manage')
  ) then
    raise exception 'Für das Tippspiel fehlt die Bus-Orga-Berechtigung.'
      using errcode = '42501';
  end if;

  return v_actor;
end;
$function$;

create function app_private.fanbus_prediction_dogs_name()
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    (
      select nullif(btrim(team.short_name), '')
      from app_modules.liveticker_teams as team
      where team.is_home_club
        and team.is_active
      order by team.name
      limit 1
    ),
    'Dogs'
  );
$function$;

create function app_private.fanbus_prediction_liveticker_result(p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when state.completed_at is null then null
    else jsonb_build_object(
      'dogsGoals', score.dogs_goals
        + case when score.shootout_count > 0 and score.shootout_dogs > score.shootout_opponent then 1 else 0 end,
      'opponentGoals', score.opponent_goals
        + case when score.shootout_count > 0 and score.shootout_opponent > score.shootout_dogs then 1 else 0 end,
      'completedAt', state.completed_at,
      'source', 'LIVETICKER'
    )
  end
  from app_modules.liveticker_game_states as state
  cross join lateral (
    select
      count(*) filter (
        where action.action_type = 'goal'
          and action.payload ->> 'team' = 'mighty'
      )::integer as dogs_goals,
      count(*) filter (
        where action.action_type = 'goal'
          and action.payload ->> 'team' = 'opponent'
      )::integer as opponent_goals,
      count(*) filter (where action.action_type = 'shootout')::integer as shootout_count,
      count(*) filter (
        where action.action_type = 'shootout'
          and action.payload ->> 'team' = 'mighty'
          and action.payload ->> 'result' = 'scored'
      )::integer as shootout_dogs,
      count(*) filter (
        where action.action_type = 'shootout'
          and action.payload ->> 'team' = 'opponent'
          and action.payload ->> 'result' = 'scored'
      )::integer as shootout_opponent
    from app_modules.liveticker_actions as action
    where action.event_id = p_event_id
      and action.is_active
  ) as score
  where state.event_id = p_event_id;
$function$;

create function app_private.fanbus_prediction_tip_json(p_participant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'number', tip.tip_number,
        'dogsGoals', tip.dogs_goals,
        'opponentGoals', tip.opponent_goals
      )
      order by tip.tip_number
    ),
    '[]'::jsonb
  )
  from app_modules.fanbus_prediction_tips as tip
  where tip.participant_id = p_participant_id;
$function$;

create function app_private.fanbus_prediction_entry_json(p_participant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', participant.id,
    'registrationId', participant.fanbus_registration_id,
    'manualName', participant.manual_name,
    'name', participant.name_snapshot,
    'busId', participant.bus_id_snapshot,
    'busLabel', participant.bus_label_snapshot,
    'revision', participant.revision,
    'tipCount', (
      select count(*)::integer
      from app_modules.fanbus_prediction_tips as tip
      where tip.participant_id = participant.id
    ),
    'tips', app_private.fanbus_prediction_tip_json(participant.id),
    'updatedAt', participant.updated_at
  )
  from app_modules.fanbus_prediction_participants as participant
  where participant.id = p_participant_id;
$function$;

create function app_private.fanbus_prediction_game_json(p_game_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', game.id,
    'eventId', game.event_id,
    'tripId', game.trip_id,
    'mode', game.mode,
    'status', game.status,
    'dogsName', app_private.fanbus_prediction_dogs_name(),
    'opponentName', event_game.opponent_name,
    'eventDate', event.event_date,
    'eventTime', event.event_time,
    'venue', event.venue,
    'officialHomeAway', event_game.home_away,
    'displayTitle', app_private.fanbus_prediction_dogs_name() || ' – ' || event_game.opponent_name,
    'tripLabel', case
      when trip.id is null then null
      else coalesce(nullif(btrim(event.venue), ''), event_game.opponent_name)
    end,
    'dogsGoals', game.dogs_goals,
    'opponentGoals', game.opponent_goals,
    'revision', game.revision,
    'createdAt', game.created_at,
    'updatedAt', game.updated_at,
    'participantCount', (
      select count(*)::integer
      from app_modules.fanbus_prediction_participants as participant
      where participant.prediction_game_id = game.id
    ),
    'tipCount', (
      select count(*)::integer
      from app_modules.fanbus_prediction_participants as participant
      join app_modules.fanbus_prediction_tips as tip
        on tip.participant_id = participant.id
      where participant.prediction_game_id = game.id
    ),
    'winnerCount', (
      select count(distinct participant.id)::integer
      from app_modules.fanbus_prediction_participants as participant
      join app_modules.fanbus_prediction_tips as tip
        on tip.participant_id = participant.id
      where participant.prediction_game_id = game.id
        and game.dogs_goals is not null
        and tip.dogs_goals = game.dogs_goals
        and tip.opponent_goals = game.opponent_goals
    ),
    'suggestedResult', app_private.fanbus_prediction_liveticker_result(game.event_id)
  )
  from app_modules.fanbus_prediction_games as game
  join app_modules.events as event on event.id = game.event_id
  join app_modules.event_games as event_game on event_game.event_id = event.id
  left join app_modules.fanbus_trips as trip on trip.id = game.trip_id
  where game.id = p_game_id;
$function$;

create function app_private.api_fanbus_prediction_options()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform app_private.fanbus_prediction_require_operator();

  return jsonb_build_object(
    'dogsName', app_private.fanbus_prediction_dogs_name(),
    'games', coalesce((
      select jsonb_agg(item.payload order by item.event_date desc, item.event_time desc nulls last)
      from (
        select
          event.event_date,
          event.event_time,
          jsonb_build_object(
            'id', event.id,
            'eventDate', event.event_date,
            'eventTime', event.event_time,
            'venue', event.venue,
            'homeAway', event_game.home_away,
            'opponentName', event_game.opponent_name,
            'displayTitle', app_private.fanbus_prediction_dogs_name() || ' – ' || event_game.opponent_name,
            'hasPredictionGame', prediction.id is not null,
            'trips', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', trip.id,
                  'status', trip.status,
                  'departureAt', trip.departure_at,
                  'label', coalesce(nullif(btrim(event.venue), ''), event_game.opponent_name)
                )
                order by trip.created_at
              )
              from app_modules.fanbus_trips as trip
              where trip.event_id = event.id
                and trip.status <> 'CANCELLED'
            ), '[]'::jsonb)
          ) as payload
        from app_modules.events as event
        join app_modules.event_games as event_game on event_game.event_id = event.id
        left join app_modules.fanbus_prediction_games as prediction on prediction.event_id = event.id
        where event.event_type = 'GAME'
      ) as item
    ), '[]'::jsonb)
  );
end;
$function$;

create function app_private.api_fanbus_prediction_games_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform app_private.fanbus_prediction_require_operator();
  return jsonb_build_object(
    'games', coalesce((
      select jsonb_agg(app_private.fanbus_prediction_game_json(game.id)
        order by event.event_date desc, event.event_time desc nulls last, game.created_at desc)
      from app_modules.fanbus_prediction_games as game
      join app_modules.events as event on event.id = game.event_id
    ), '[]'::jsonb)
  );
end;
$function$;

create function app_private.api_fanbus_prediction_game_create(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.fanbus_prediction_require_operator();
  v_event_id uuid := nullif(btrim(coalesce(p_payload ->> 'eventId', '')), '')::uuid;
  v_trip_id uuid := nullif(btrim(coalesce(p_payload ->> 'tripId', '')), '')::uuid;
  v_mode text := upper(btrim(coalesce(p_payload ->> 'mode', '')));
  v_game_id uuid;
begin
  if v_event_id is null or v_mode not in ('TRIP', 'MANUAL') then
    raise exception 'Spiel und Modus sind erforderlich.' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from app_modules.events as event
    join app_modules.event_games as event_game on event_game.event_id = event.id
    where event.id = v_event_id
      and event.event_type = 'GAME'
  ) then
    raise exception 'Das Kalenderspiel wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_mode = 'TRIP' then
    if v_trip_id is null or not exists (
      select 1
      from app_modules.fanbus_trips as trip
      where trip.id = v_trip_id
        and trip.event_id = v_event_id
        and trip.status <> 'CANCELLED'
    ) then
      raise exception 'Die gewählte Fanbusfahrt passt nicht zum Spiel.' using errcode = '23503';
    end if;
  else
    v_trip_id := null;
  end if;

  begin
    insert into app_modules.fanbus_prediction_games (
      event_id, trip_id, mode, created_by, updated_by
    ) values (
      v_event_id, v_trip_id, v_mode, v_actor, v_actor
    ) returning id into v_game_id;
  exception when unique_violation then
    raise exception 'Für dieses Spiel existiert bereits ein Tippspiel.' using errcode = '23505';
  end;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PREDICTION_GAME_CREATED',
    'fanbus_prediction_game',
    v_game_id::text,
    null,
    jsonb_build_object('eventId', v_event_id, 'tripId', v_trip_id, 'mode', v_mode)
  );

  return app_private.fanbus_prediction_game_json(v_game_id);
end;
$function$;

create function app_private.api_fanbus_prediction_game_detail(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_game_id uuid := nullif(btrim(coalesce(p_payload ->> 'gameId', '')), '')::uuid;
  v_game app_modules.fanbus_prediction_games%rowtype;
begin
  perform app_private.fanbus_prediction_require_operator();
  select * into v_game
  from app_modules.fanbus_prediction_games
  where id = v_game_id;
  if not found then
    raise exception 'Tippspiel wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'game', app_private.fanbus_prediction_game_json(v_game.id),
    'entries', coalesce((
      select jsonb_agg(app_private.fanbus_prediction_entry_json(participant.id)
        order by lower(participant.name_snapshot), participant.created_at, participant.id)
      from app_modules.fanbus_prediction_participants as participant
      where participant.prediction_game_id = v_game.id
    ), '[]'::jsonb)
  );
end;
$function$;

create function app_private.api_fanbus_prediction_participants_search(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_game_id uuid := nullif(btrim(coalesce(p_payload ->> 'gameId', '')), '')::uuid;
  v_query text := lower(btrim(coalesce(p_payload ->> 'query', '')));
  v_game app_modules.fanbus_prediction_games%rowtype;
begin
  perform app_private.fanbus_prediction_require_operator();
  select * into v_game
  from app_modules.fanbus_prediction_games
  where id = v_game_id;
  if not found or v_game.mode <> 'TRIP' then
    raise exception 'Fahrt-Tippspiel wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'participants', coalesce((
      select jsonb_agg(item.payload order by item.sort_name)
      from (
        select
          lower(registration.last_name || ' ' || registration.first_name) as sort_name,
          jsonb_build_object(
            'registrationId', registration.id,
            'entryId', participant.id,
            'name', coalesce(participant.name_snapshot, btrim(registration.first_name || ' ' || registration.last_name)),
            'busId', coalesce(participant.bus_id_snapshot, assignment.bus_id),
            'busLabel', coalesce(participant.bus_label_snapshot, bus.label),
            'revision', participant.revision,
            'tipCount', coalesce((
              select count(*)::integer
              from app_modules.fanbus_prediction_tips as tip
              where tip.participant_id = participant.id
            ), 0),
            'tips', coalesce(app_private.fanbus_prediction_tip_json(participant.id), '[]'::jsonb),
            'updatedAt', participant.updated_at
          ) as payload
        from app_modules.fanbus_registrations as registration
        left join app_modules.fanbus_bus_assignments as assignment
          on assignment.participant_id = registration.id
         and assignment.trip_id = registration.trip_id
        left join app_modules.fanbus_buses as bus on bus.id = assignment.bus_id
        left join app_modules.fanbus_prediction_participants as participant
          on participant.prediction_game_id = v_game.id
         and participant.fanbus_registration_id = registration.id
        where registration.trip_id = v_game.trip_id
          and registration.status = 'ACTIVE'
          and (
            v_query = ''
            or lower(registration.first_name || ' ' || registration.last_name) like '%' || v_query || '%'
            or lower(registration.last_name || ' ' || registration.first_name) like '%' || v_query || '%'
          )
        order by lower(registration.last_name), lower(registration.first_name), registration.id
        limit 50
      ) as item
    ), '[]'::jsonb)
  );
end;
$function$;

create function app_private.api_fanbus_prediction_entry_save(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.fanbus_prediction_require_operator();
  v_game_id uuid := nullif(btrim(coalesce(p_payload ->> 'gameId', '')), '')::uuid;
  v_participant_id uuid := nullif(btrim(coalesce(p_payload ->> 'participantId', '')), '')::uuid;
  v_registration_id uuid := nullif(btrim(coalesce(p_payload ->> 'registrationId', '')), '')::uuid;
  v_manual_name text := nullif(btrim(coalesce(p_payload ->> 'manualName', '')), '');
  v_expected_revision integer := nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_tips jsonb := p_payload -> 'tips';
  v_game app_modules.fanbus_prediction_games%rowtype;
  v_participant app_modules.fanbus_prediction_participants%rowtype;
  v_registration app_modules.fanbus_registrations%rowtype;
  v_tip jsonb;
  v_tip_number integer := 0;
  v_dogs integer;
  v_opponent integer;
  v_name text;
  v_bus_id uuid;
  v_bus_label text;
  v_before jsonb;
begin
  if v_game_id is null or v_tips is null or jsonb_typeof(v_tips) <> 'array'
     or jsonb_array_length(v_tips) not between 1 and 3 then
    raise exception 'Mindestens ein und höchstens drei Tipps sind erforderlich.' using errcode = '22023';
  end if;

  if (
    select count(*) <> count(distinct (tip ->> 'dogsGoals', tip ->> 'opponentGoals'))
    from jsonb_array_elements(v_tips) as tips(tip)
  ) then
    raise exception 'Identische Tipps sind für eine Person nicht zulässig.' using errcode = '23505';
  end if;

  for v_tip in select value from jsonb_array_elements(v_tips)
  loop
    begin
      v_dogs := (v_tip ->> 'dogsGoals')::integer;
      v_opponent := (v_tip ->> 'opponentGoals')::integer;
    exception when others then
      raise exception 'Tore müssen nichtnegative ganze Zahlen sein.' using errcode = '22023';
    end;
    if v_dogs not between 0 and 99 or v_opponent not between 0 and 99 then
      raise exception 'Tore müssen zwischen 0 und 99 liegen.' using errcode = '22023';
    end if;
  end loop;

  select * into v_game
  from app_modules.fanbus_prediction_games
  where id = v_game_id
  for share;
  if not found then
    raise exception 'Tippspiel wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_game.status <> 'OPEN' then
    raise exception 'Das Tippspiel ist geschlossen. Bitte zuerst wieder öffnen.' using errcode = '55000';
  end if;

  if v_participant_id is not null then
    select * into v_participant
    from app_modules.fanbus_prediction_participants
    where id = v_participant_id
      and prediction_game_id = v_game.id
    for update;
    if not found then
      raise exception 'Tippspiel-Teilnehmer wurde nicht gefunden.' using errcode = 'P0002';
    end if;
    if v_expected_revision is null or v_expected_revision <> v_participant.revision then
      raise exception 'Die Tipps wurden zwischenzeitlich geändert. Bitte Person neu öffnen.' using errcode = 'PT409';
    end if;
    if v_game.mode = 'TRIP' and v_participant.fanbus_registration_id is distinct from v_registration_id then
      raise exception 'Fahrtteilnehmer passt nicht zum gespeicherten Eintrag.' using errcode = '23503';
    end if;
    v_before := app_private.fanbus_prediction_entry_json(v_participant.id);
    if v_game.mode = 'MANUAL' then
      if v_manual_name is null or char_length(v_manual_name) > 160 then
        raise exception 'Name ist erforderlich und darf höchstens 160 Zeichen enthalten.' using errcode = '22023';
      end if;
      update app_modules.fanbus_prediction_participants
      set manual_name = v_manual_name,
          name_snapshot = v_manual_name,
          revision = revision + 1,
          updated_at = now(),
          updated_by = v_actor
      where id = v_participant.id
      returning * into v_participant;
    else
      update app_modules.fanbus_prediction_participants
      set revision = revision + 1,
          updated_at = now(),
          updated_by = v_actor
      where id = v_participant.id
      returning * into v_participant;
    end if;
  elsif v_game.mode = 'TRIP' then
    if v_registration_id is null then
      raise exception 'Fahrtteilnehmer ist erforderlich.' using errcode = '22023';
    end if;
    select * into v_registration
    from app_modules.fanbus_registrations
    where id = v_registration_id
      and trip_id = v_game.trip_id
      and status = 'ACTIVE';
    if not found then
      raise exception 'Aktiver Fahrtteilnehmer wurde nicht gefunden.' using errcode = 'P0002';
    end if;
    v_name := btrim(v_registration.first_name || ' ' || v_registration.last_name);
    select assignment.bus_id, bus.label
    into v_bus_id, v_bus_label
    from app_modules.fanbus_bus_assignments as assignment
    join app_modules.fanbus_buses as bus on bus.id = assignment.bus_id
    where assignment.participant_id = v_registration.id
      and assignment.trip_id = v_game.trip_id;
    begin
      insert into app_modules.fanbus_prediction_participants (
        prediction_game_id, fanbus_registration_id, name_snapshot,
        bus_id_snapshot, bus_label_snapshot, created_by, updated_by
      ) values (
        v_game.id, v_registration.id, v_name,
        v_bus_id, v_bus_label, v_actor, v_actor
      ) returning * into v_participant;
    exception when unique_violation then
      raise exception 'Für diese Person wurden inzwischen Tipps gespeichert. Bitte Person neu öffnen.' using errcode = 'PT409';
    end;
  else
    if v_manual_name is null or char_length(v_manual_name) > 160 then
      raise exception 'Name ist erforderlich und darf höchstens 160 Zeichen enthalten.' using errcode = '22023';
    end if;
    insert into app_modules.fanbus_prediction_participants (
      prediction_game_id, manual_name, name_snapshot, created_by, updated_by
    ) values (
      v_game.id, v_manual_name, v_manual_name, v_actor, v_actor
    ) returning * into v_participant;
  end if;

  delete from app_modules.fanbus_prediction_tips
  where participant_id = v_participant.id;

  v_tip_number := 0;
  for v_tip in select value from jsonb_array_elements(v_tips)
  loop
    v_tip_number := v_tip_number + 1;
    insert into app_modules.fanbus_prediction_tips (
      participant_id, tip_number, dogs_goals, opponent_goals
    ) values (
      v_participant.id,
      v_tip_number,
      (v_tip ->> 'dogsGoals')::integer,
      (v_tip ->> 'opponentGoals')::integer
    );
  end loop;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PREDICTION_ENTRY_SAVED',
    'fanbus_prediction_participant',
    v_participant.id::text,
    v_before,
    app_private.fanbus_prediction_entry_json(v_participant.id)
  );

  return jsonb_build_object(
    'entry', app_private.fanbus_prediction_entry_json(v_participant.id),
    'game', app_private.fanbus_prediction_game_json(v_game.id)
  );
end;
$function$;

create function app_private.api_fanbus_prediction_status_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.fanbus_prediction_require_operator();
  v_game_id uuid := nullif(btrim(coalesce(p_payload ->> 'gameId', '')), '')::uuid;
  v_expected_revision integer := nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_status text := upper(btrim(coalesce(p_payload ->> 'status', '')));
  v_game app_modules.fanbus_prediction_games%rowtype;
begin
  if v_status not in ('OPEN', 'CLOSED') or v_expected_revision is null then
    raise exception 'Status und Revision sind erforderlich.' using errcode = '22023';
  end if;
  select * into v_game
  from app_modules.fanbus_prediction_games
  where id = v_game_id
  for update;
  if not found then
    raise exception 'Tippspiel wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_game.revision <> v_expected_revision then
    raise exception 'Das Tippspiel wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode = 'PT409';
  end if;
  if v_game.status = 'EVALUATED' then
    raise exception 'Ein ausgewertetes Tippspiel kann nicht wieder geöffnet werden.' using errcode = '55000';
  end if;

  update app_modules.fanbus_prediction_games
  set status = v_status,
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_actor
  where id = v_game.id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PREDICTION_STATUS_CHANGED',
    'fanbus_prediction_game',
    v_game.id::text,
    jsonb_build_object('status', v_game.status, 'revision', v_game.revision),
    jsonb_build_object('status', v_status, 'revision', v_game.revision + 1)
  );

  return app_private.fanbus_prediction_game_json(v_game.id);
end;
$function$;

create function app_private.api_fanbus_prediction_result_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.fanbus_prediction_require_operator();
  v_game_id uuid := nullif(btrim(coalesce(p_payload ->> 'gameId', '')), '')::uuid;
  v_expected_revision integer := nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_dogs integer := nullif(btrim(coalesce(p_payload ->> 'dogsGoals', '')), '')::integer;
  v_opponent integer := nullif(btrim(coalesce(p_payload ->> 'opponentGoals', '')), '')::integer;
  v_game app_modules.fanbus_prediction_games%rowtype;
begin
  if v_expected_revision is null or v_dogs not between 0 and 99 or v_opponent not between 0 and 99 then
    raise exception 'Endergebnis und Revision sind erforderlich.' using errcode = '22023';
  end if;
  select * into v_game
  from app_modules.fanbus_prediction_games
  where id = v_game_id
  for update;
  if not found then
    raise exception 'Tippspiel wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_game.revision <> v_expected_revision then
    raise exception 'Das Tippspiel wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode = 'PT409';
  end if;
  if v_game.status = 'OPEN' then
    raise exception 'Tippspiel vor der Auswertung zuerst schließen.' using errcode = '55000';
  end if;

  update app_modules.fanbus_prediction_games
  set status = 'EVALUATED',
      dogs_goals = v_dogs,
      opponent_goals = v_opponent,
      revision = revision + 1,
      updated_at = now(),
      updated_by = v_actor
  where id = v_game.id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PREDICTION_RESULT_SET',
    'fanbus_prediction_game',
    v_game.id::text,
    jsonb_build_object('status', v_game.status, 'dogsGoals', v_game.dogs_goals, 'opponentGoals', v_game.opponent_goals, 'revision', v_game.revision),
    jsonb_build_object('status', 'EVALUATED', 'dogsGoals', v_dogs, 'opponentGoals', v_opponent, 'revision', v_game.revision + 1)
  );

  return app_private.fanbus_prediction_game_json(v_game.id);
end;
$function$;

create function app_private.api_fanbus_prediction_evaluation(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_game_id uuid := nullif(btrim(coalesce(p_payload ->> 'gameId', '')), '')::uuid;
  v_game app_modules.fanbus_prediction_games%rowtype;
begin
  perform app_private.fanbus_prediction_require_operator();
  select * into v_game
  from app_modules.fanbus_prediction_games
  where id = v_game_id;
  if not found then
    raise exception 'Tippspiel wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'game', app_private.fanbus_prediction_game_json(v_game.id),
    'overall', jsonb_build_object(
      'participantCount', (
        select count(*)::integer
        from app_modules.fanbus_prediction_participants
        where prediction_game_id = v_game.id
      ),
      'tipCount', (
        select count(*)::integer
        from app_modules.fanbus_prediction_participants as participant
        join app_modules.fanbus_prediction_tips as tip on tip.participant_id = participant.id
        where participant.prediction_game_id = v_game.id
      ),
      'winnerCount', (
        select count(distinct participant.id)::integer
        from app_modules.fanbus_prediction_participants as participant
        join app_modules.fanbus_prediction_tips as tip on tip.participant_id = participant.id
        where participant.prediction_game_id = v_game.id
          and v_game.dogs_goals is not null
          and tip.dogs_goals = v_game.dogs_goals
          and tip.opponent_goals = v_game.opponent_goals
      ),
      'winners', coalesce((
        select jsonb_agg(item.payload order by item.name)
        from (
          select
            participant.name_snapshot as name,
            jsonb_build_object(
              'id', participant.id,
              'name', participant.name_snapshot,
              'busLabel', participant.bus_label_snapshot,
              'tip', jsonb_build_object('dogsGoals', v_game.dogs_goals, 'opponentGoals', v_game.opponent_goals)
            ) as payload
          from app_modules.fanbus_prediction_participants as participant
          where participant.prediction_game_id = v_game.id
            and exists (
              select 1
              from app_modules.fanbus_prediction_tips as tip
              where tip.participant_id = participant.id
                and tip.dogs_goals = v_game.dogs_goals
                and tip.opponent_goals = v_game.opponent_goals
            )
        ) as item
      ), '[]'::jsonb)
    ),
    'buses', case when v_game.mode = 'MANUAL' then '[]'::jsonb else coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'busLabel', bus_group.bus_label,
          'participantCount', bus_group.participant_count,
          'tipCount', bus_group.tip_count,
          'winnerCount', bus_group.winner_count,
          'winners', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', winner.id,
              'name', winner.name_snapshot,
              'busLabel', winner.bus_label_snapshot,
              'tip', jsonb_build_object('dogsGoals', v_game.dogs_goals, 'opponentGoals', v_game.opponent_goals)
            ) order by winner.name_snapshot)
            from app_modules.fanbus_prediction_participants as winner
            where winner.prediction_game_id = v_game.id
              and coalesce(winner.bus_label_snapshot, 'Ohne Bus') = bus_group.bus_label
              and exists (
                select 1
                from app_modules.fanbus_prediction_tips as winner_tip
                where winner_tip.participant_id = winner.id
                  and winner_tip.dogs_goals = v_game.dogs_goals
                  and winner_tip.opponent_goals = v_game.opponent_goals
              )
          ), '[]'::jsonb)
        )
        order by bus_group.bus_label
      )
      from (
        select
          coalesce(participant.bus_label_snapshot, 'Ohne Bus') as bus_label,
          count(distinct participant.id)::integer as participant_count,
          count(tip.tip_number)::integer as tip_count,
          count(distinct participant.id) filter (
            where v_game.dogs_goals is not null
              and tip.dogs_goals = v_game.dogs_goals
              and tip.opponent_goals = v_game.opponent_goals
          )::integer as winner_count
        from app_modules.fanbus_prediction_participants as participant
        left join app_modules.fanbus_prediction_tips as tip on tip.participant_id = participant.id
        where participant.prediction_game_id = v_game.id
        group by coalesce(participant.bus_label_snapshot, 'Ohne Bus')
      ) as bus_group
    ), '[]'::jsonb) end
  );
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_fanbus_prediction_game;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_fanbus_prediction_game()
    || array[
      'fanbus_prediction_options',
      'fanbus_prediction_games_list',
      'fanbus_prediction_game_create',
      'fanbus_prediction_game_detail',
      'fanbus_prediction_participants_search',
      'fanbus_prediction_entry_save',
      'fanbus_prediction_status_set',
      'fanbus_prediction_result_set',
      'fanbus_prediction_evaluation'
    ]::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_fanbus_prediction_game;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case lower(btrim(coalesce(p_action, '')))
    when 'fanbus_prediction_options' then 'READ'
    when 'fanbus_prediction_games_list' then 'READ'
    when 'fanbus_prediction_game_detail' then 'READ'
    when 'fanbus_prediction_participants_search' then 'READ'
    when 'fanbus_prediction_evaluation' then 'READ'
    when 'fanbus_prediction_game_create' then 'USER_MUTATION'
    when 'fanbus_prediction_entry_save' then 'USER_MUTATION'
    when 'fanbus_prediction_status_set' then 'USER_MUTATION'
    when 'fanbus_prediction_result_set' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_fanbus_prediction_game(p_action)
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_fanbus_prediction_game;

create function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  case v_action
    when 'fanbus_prediction_options' then return app_private.api_fanbus_prediction_options();
    when 'fanbus_prediction_games_list' then return app_private.api_fanbus_prediction_games_list();
    when 'fanbus_prediction_game_create' then return app_private.api_fanbus_prediction_game_create(v_payload);
    when 'fanbus_prediction_game_detail' then return app_private.api_fanbus_prediction_game_detail(v_payload);
    when 'fanbus_prediction_participants_search' then return app_private.api_fanbus_prediction_participants_search(v_payload);
    when 'fanbus_prediction_entry_save' then return app_private.api_fanbus_prediction_entry_save(v_payload);
    when 'fanbus_prediction_status_set' then return app_private.api_fanbus_prediction_status_set(v_payload);
    when 'fanbus_prediction_result_set' then return app_private.api_fanbus_prediction_result_set(v_payload);
    when 'fanbus_prediction_evaluation' then return app_private.api_fanbus_prediction_evaluation(v_payload);
    else return app_private.pd_api_dispatch_current_before_fanbus_prediction_game(p_action, p_payload);
  end case;
end;
$function$;

revoke all on function
  app_private.fanbus_prediction_require_operator(),
  app_private.fanbus_prediction_dogs_name(),
  app_private.fanbus_prediction_liveticker_result(uuid),
  app_private.fanbus_prediction_tip_json(uuid),
  app_private.fanbus_prediction_entry_json(uuid),
  app_private.fanbus_prediction_game_json(uuid),
  app_private.api_fanbus_prediction_options(),
  app_private.api_fanbus_prediction_games_list(),
  app_private.api_fanbus_prediction_game_create(jsonb),
  app_private.api_fanbus_prediction_game_detail(jsonb),
  app_private.api_fanbus_prediction_participants_search(jsonb),
  app_private.api_fanbus_prediction_entry_save(jsonb),
  app_private.api_fanbus_prediction_status_set(jsonb),
  app_private.api_fanbus_prediction_result_set(jsonb),
  app_private.api_fanbus_prediction_evaluation(jsonb),
  app_private.pd_api_current_actions_before_fanbus_prediction_game(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_fanbus_prediction_game(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_fanbus_prediction_game(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.fanbus_prediction_require_operator(),
  app_private.fanbus_prediction_dogs_name(),
  app_private.fanbus_prediction_liveticker_result(uuid),
  app_private.fanbus_prediction_tip_json(uuid),
  app_private.fanbus_prediction_entry_json(uuid),
  app_private.fanbus_prediction_game_json(uuid),
  app_private.api_fanbus_prediction_options(),
  app_private.api_fanbus_prediction_games_list(),
  app_private.api_fanbus_prediction_game_create(jsonb),
  app_private.api_fanbus_prediction_game_detail(jsonb),
  app_private.api_fanbus_prediction_participants_search(jsonb),
  app_private.api_fanbus_prediction_entry_save(jsonb),
  app_private.api_fanbus_prediction_status_set(jsonb),
  app_private.api_fanbus_prediction_result_set(jsonb),
  app_private.api_fanbus_prediction_evaluation(jsonb),
  app_private.pd_api_current_actions_before_fanbus_prediction_game(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_fanbus_prediction_game(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_fanbus_prediction_game(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
