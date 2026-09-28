begin;

create function app_private.api_social_media_generator_fanbus_trips_list(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  perform app_private.social_media_generator_require_access();

  return pg_catalog.jsonb_build_object(
    'trips',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'tripId', trip.id,
            'eventId', trip.event_id,
            'eventDate', event.event_date,
            'eventTime', event.event_time,
            'destination', event.venue,
            'opponentName', game.opponent_name,
            'homeAway', game.home_away,
            'departureAt', trip.departure_at,
            'priceCents', trip.price_cents,
            'status', trip.status,
            'registrationClosesAt', trip.registration_closes_at,
            'boardingStops', coalesce(stops.items, '[]'::jsonb)
          )
          order by event.event_date, event.event_time, trip.id
        )
        from app_modules.fanbus_trips as trip
        join app_modules.events as event
          on event.id = trip.event_id
        left join app_modules.event_games as game
          on game.event_id = trip.event_id
        left join lateral (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'tripBoardingStopId', trip_stop.id,
              'boardingStopId', stop.id,
              'label', stop.label,
              'address', stop.address,
              'departureAt', trip_stop.departure_at,
              'note', coalesce(trip_stop.trip_note, stop.default_note),
              'isDefault', stop.id = trip.default_boarding_stop_id
            )
            order by trip_stop.position, trip_stop.departure_at, stop.label
          ) as items
          from app_modules.fanbus_trip_boarding_stops as trip_stop
          join app_modules.fanbus_boarding_stops as stop
            on stop.id = trip_stop.boarding_stop_id
           and stop.is_active
          where trip_stop.trip_id = trip.id
            and trip_stop.is_active
        ) as stops on true
        where trip.status <> 'CANCELLED'
          and event.event_date >= current_date
      ),
      '[]'::jsonb
    )
  );
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
    else app_private.platform_action_classification_before_sm_fanbus_v1(
      p_action
    )
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
      return app_private.api_social_media_generator_fanbus_trips_list(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return app_private.pd_api_dispatch_current_before_sm_fanbus_v1(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.api_social_media_generator_fanbus_trips_list(jsonb),
  app_private.pd_api_current_actions_before_sm_fanbus_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_fanbus_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_fanbus_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_social_media_generator_fanbus_trips_list(jsonb),
  app_private.pd_api_current_actions_before_sm_fanbus_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_fanbus_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_fanbus_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
