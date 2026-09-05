-- Plärrdeifl Portal V4
-- Liveticker R2: öffentliche Prototype-RPCs bleiben strikt DEV-only.
-- PROD erhält später eine eigene authentifizierte/capability-basierte Boundary.

create or replace function public.pd_public_liveticker_games()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform app_private.liveticker_require_public_dev();

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
  into v_result
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

  return v_result;
end;
$$;

create or replace function public.pd_public_liveticker_state(p_event_id uuid)
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
  perform app_private.liveticker_require_public_dev();
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

revoke all on function public.pd_public_liveticker_games() from public, anon, authenticated;
revoke all on function public.pd_public_liveticker_state(uuid) from public, anon, authenticated;
grant execute on function public.pd_public_liveticker_games() to anon, authenticated;
grant execute on function public.pd_public_liveticker_state(uuid) to anon, authenticated;
