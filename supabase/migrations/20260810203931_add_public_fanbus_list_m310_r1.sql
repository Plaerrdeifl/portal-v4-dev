-- Plaerrdeifl Digitalplattform V4
-- P300 / M310-R1 / F1.4: Oeffentliche Fanbus-Liste fuer WordPress

create function public.pd_public_fanbus_trips()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_today date := (v_now at time zone 'Europe/Berlin')::date;
begin
  return jsonb_build_object(
    'trips',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'tripId', trip.id,
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
          'departureAt', trip.departure_at,
          'departureInfo', trip.departure_info,
          'registrationOpensAt', trip.registration_opens_at,
          'registrationClosesAt', trip.registration_closes_at,
          'priceCents', trip.price_cents,
          'capacity', trip.capacity,
          'activeRegistrationCount', registration.active_count,
          'remainingCapacity', greatest(
            trip.capacity - registration.active_count,
            0
          ),
          'registrationStatus', case
            when v_now < trip.registration_opens_at then 'NOT_STARTED'
            when v_now >= trip.registration_closes_at
              or v_now >= trip.departure_at then 'CLOSED'
            when registration.active_count >= trip.capacity then 'FULL'
            when v_now >= trip.registration_opens_at
              and v_now < trip.registration_closes_at then 'OPEN'
            else 'UNAVAILABLE'
          end
        )
        order by
          event.event_date asc,
          event.event_time asc nulls last,
          trip.departure_at asc
      )
      from app_modules.fanbus_trips as trip
      join app_modules.events as event
        on event.id = trip.event_id
      left join app_modules.event_games as game
        on game.event_id = event.id
      cross join lateral (
        select count(*)::integer as active_count
        from app_modules.fanbus_registrations as fanbus_registration
        where fanbus_registration.trip_id = trip.id
          and fanbus_registration.status = 'ACTIVE'
      ) as registration
      where trip.status = 'PUBLISHED'
        and event.visibility = 'PUBLIC'
        and event.event_date >= v_today
        and trip.departure_at is not null
        and trip.departure_info is not null
        and length(btrim(trip.departure_info)) > 0
        and trip.registration_opens_at is not null
        and trip.registration_closes_at is not null
        and trip.registration_closes_at > trip.registration_opens_at
        and trip.registration_closes_at <= trip.departure_at
        and trip.price_cents is not null
        and trip.price_cents >= 0
        and trip.capacity is not null
        and trip.capacity > 0
        and trip.privacy_reference is not null
        and length(btrim(trip.privacy_reference)) > 0
        and trip.terms_reference is not null
        and length(btrim(trip.terms_reference)) > 0
        and (trip.departure_at at time zone 'Europe/Berlin')::date
          <= event.event_date
        and (
          event.event_time is null
          or (trip.departure_at at time zone 'Europe/Berlin')
            <= event.event_date + event.event_time
        )
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.pd_public_fanbus_trips()
from public, anon, authenticated;

grant execute on function public.pd_public_fanbus_trips()
to anon, authenticated;
