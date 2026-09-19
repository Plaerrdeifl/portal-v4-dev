-- Plaerrdeifl Digitalplattform V4
-- M328 Abschluss-Batch: oeffentliche Fahrten fail-closed und DEV-Buchungsnummern.
-- Bestehende Buchungsnummern bleiben unveraendert; die Sequenz und der Unique-Index
-- bleiben die race-sichere Quelle fuer neue Nummern.

begin;

alter function public.pd_public_fanbus_trip(uuid)
  rename to pd_public_fanbus_trip_before_m328_completion;

create function public.pd_public_fanbus_trip(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_base jsonb := public.pd_public_fanbus_trip_before_m328_completion(p_trip_id);
begin
  if coalesce((v_base ->> 'available')::boolean, false) is not true
     or coalesce(v_base ->> 'tripStatus', '') <> 'PUBLISHED' then
    return jsonb_build_object('available', false);
  end if;

  return v_base;
end;
$function$;

alter function public.pd_public_fanbus_trips()
  rename to pd_public_fanbus_trips_before_m328_completion;

create function public.pd_public_fanbus_trips()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_base jsonb := public.pd_public_fanbus_trips_before_m328_completion();
begin
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(item.value order by item.ordinality)
      from jsonb_array_elements(coalesce(v_base -> 'trips', '[]'::jsonb))
        with ordinality as item(value, ordinality)
      where item.value ->> 'tripStatus' = 'PUBLISHED'
    ), '[]'::jsonb)
  );
end;
$function$;

alter function public.pd_public_fanbus_trip_boarding_stops(uuid)
  rename to pd_public_fanbus_trip_boarding_stops_before_m328_completion;

create function public.pd_public_fanbus_trip_boarding_stops(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_public_trip jsonb := public.pd_public_fanbus_trip(p_trip_id);
begin
  if coalesce((v_public_trip ->> 'available')::boolean, false) is not true then
    return jsonb_build_object('stops', '[]'::jsonb);
  end if;

  return public.pd_public_fanbus_trip_boarding_stops_before_m328_completion(p_trip_id);
end;
$function$;

revoke all on function
  public.pd_public_fanbus_trip_before_m328_completion(uuid),
  public.pd_public_fanbus_trips_before_m328_completion(),
  public.pd_public_fanbus_trip_boarding_stops_before_m328_completion(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_public_fanbus_trip_before_m328_completion(uuid),
  public.pd_public_fanbus_trips_before_m328_completion(),
  public.pd_public_fanbus_trip_boarding_stops_before_m328_completion(uuid)
to postgres;

revoke all on function
  public.pd_public_fanbus_trip(uuid),
  public.pd_public_fanbus_trips(),
  public.pd_public_fanbus_trip_boarding_stops(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_public_fanbus_trip(uuid),
  public.pd_public_fanbus_trips(),
  public.pd_public_fanbus_trip_boarding_stops(uuid)
to anon, authenticated;

create or replace function app_private.fanbus_next_booking_number()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_prefix text;
begin
  v_prefix := case
    when v_environment in ('DEV', 'LOCAL') then 'DEV-'
    when v_environment = 'PROD' then 'FB-'
    else null
  end;

  if v_prefix is null then
    raise exception using
      errcode = 'P0001',
      message = 'FANBUS_BOOKING_ENVIRONMENT_INVALID';
  end if;

  return v_prefix
    || pg_catalog.to_char(
      pg_catalog.clock_timestamp() at time zone 'Europe/Berlin',
      'YY'
    )
    || '-'
    || pg_catalog.lpad(
      pg_catalog.nextval('app_private.fanbus_booking_number_seq'::pg_catalog.regclass)::text,
      6,
      '0'
    );
end;
$function$;

revoke all on function app_private.fanbus_next_booking_number()
from public, anon, authenticated, service_role;
grant execute on function app_private.fanbus_next_booking_number() to postgres;

alter table app_modules.fanbus_bookings
  drop constraint if exists fanbus_bookings_booking_number_check;

alter table app_modules.fanbus_bookings
  add constraint fanbus_bookings_booking_number_check
  check (booking_number ~ '^(FB|DEV)-[0-9]{2}-[0-9]{6,}$');

comment on function app_private.fanbus_next_booking_number() is
  'M328: DEV/LOCAL erzeugt DEV-YY-NNNNNN, PROD unveraendert FB-YY-NNNNNN; zentrale Sequenz und Unique-Index bleiben race-safe.';

commit;
