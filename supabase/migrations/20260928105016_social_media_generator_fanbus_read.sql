begin;

create function app_private.api_social_media_generator_fanbus_trips_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_trips jsonb;
begin
  perform app_private.social_media_generator_require_access();

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'tripId', trip.id,
        'eventId', trip.event_id,
        'status', trip.status,
        'eventDate', event.event_date,
        'eventTime', event.event_time,
        'venue', event.venue,
        'homeAway', game.home_away,
        'opponentName', game.opponent_name,
        'displayTitle', coalesce(
          nullif(pg_catalog.btrim(game.opponent_name), ''),
          nullif(pg_catalog.btrim(event.title), ''),
          'Fanbus'
        ),
        'destination', coalesce(
          nullif(pg_catalog.btrim(event.venue), ''),
          nullif(pg_catalog.btrim(game.opponent_name), ''),
          nullif(pg_catalog.btrim(event.title), '')
        ),
        'priceCents', trip.price_cents,
        'departureAt', trip.departure_at,
        'departureInfo', trip.departure_info,
        'boardingStops', coalesce(
          (
            select pg_catalog.jsonb_agg(
              pg_catalog.jsonb_build_object(
                'id', trip_stop.id,
                'boardingStopId', stop.id,
                'label', stop.label,
                'address', stop.address,
                'departureAt', trip_stop.departure_at,
                'position', trip_stop.position,
                'note', trip_stop.trip_note
              )
              order by trip_stop.position, trip_stop.departure_at, stop.label
            )
            from app_modules.fanbus_trip_boarding_stops as trip_stop
            join app_modules.fanbus_boarding_stops as stop
              on stop.id = trip_stop.boarding_stop_id
            where trip_stop.trip_id = trip.id
              and trip_stop.is_active
              and stop.is_active
          ),
          '[]'::jsonb
        )
      )
      order by event.event_date, event.event_time, trip.departure_at, trip.id
    ),
    '[]'::jsonb
  )
  into v_trips
  from app_modules.fanbus_trips as trip
  join app_modules.events as event
    on event.id = trip.event_id
  left join app_modules.event_games as game
    on game.event_id = trip.event_id
  where trip.status <> 'CANCELLED';

  return pg_catalog.jsonb_build_object('trips', v_trips);
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_sm_fanbus_v1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_sm_fanbus_v1()
    || array['social_media_generator_fanbus_trips_list']::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_fanbus_v1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_fanbus_trips_list' then 'READ'
    else app_private.platform_action_classification_before_sm_fanbus_v1(p_action)
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_fanbus_v1;

create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_action, ''))
  );
begin
  case v_action
    when 'social_media_generator_fanbus_trips_list' then
      return app_private.api_social_media_generator_fanbus_trips_list();
    else
      return app_private.pd_api_dispatch_current_before_sm_fanbus_v1(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.api_social_media_generator_fanbus_trips_list(),
  app_private.pd_api_current_actions_before_sm_fanbus_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_fanbus_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_fanbus_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_social_media_generator_fanbus_trips_list(),
  app_private.pd_api_current_actions_before_sm_fanbus_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_fanbus_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_fanbus_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
