-- Plärrdeifl Portal V4
-- M210-R1 / F1.4: D-011 öffentliche Read-only-Terminschnittstelle

create function public.pd_public_events()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'events',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
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
          'endDate', event.end_date,
          'endTime', event.end_time,
          'venue', event.venue,
          'description', event.description,
          'homeAway', case
            when event.event_type = 'GAME' then game.home_away
            else null
          end
        )
        order by
          event.event_date asc,
          event.event_time asc nulls first,
          event.id asc
      ),
      '[]'::jsonb
    )
  )
  from app_modules.events as event
  left join app_modules.event_games as game
    on game.event_id = event.id
  where event.visibility = 'PUBLIC'
    and event.event_date >=
      (now() at time zone 'Europe/Berlin')::date;
$$;

revoke all on function public.pd_public_events()
from public, anon, authenticated;

grant execute on function public.pd_public_events()
to anon;
