create or replace function app_private.api_fanbus_available_events()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
begin
  return jsonb_build_object(
    'events',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event.id,
          'eventType', event.event_type,
          'displayTitle', case event.event_type
            when 'GAME' then case game.home_away
              when 'HOME' then
                'Mighty Dogs Schweinfurt – ' || game.opponent_name
              when 'AWAY' then
                game.opponent_name || ' – Mighty Dogs Schweinfurt'
              else null
            end
            else event.title
          end,
          'eventDate', event.event_date,
          'eventTime', event.event_time,
          'venue', event.venue,
          'visibility', event.visibility
        )
        order by
          event.event_date,
          event.event_time asc nulls first,
          event.id
      )
      from app_modules.events as event
      join app_modules.event_games as game
        on game.event_id = event.id
      where event.event_type = 'GAME'
        and game.home_away = 'AWAY'
        and event.event_date >=
          (now() at time zone 'Europe/Berlin')::date
        and not exists (
          select 1
          from app_modules.fanbus_trips as trip
          where trip.event_id = event.id
        )
    ), '[]'::jsonb)
  );
end;
$$;
