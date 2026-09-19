-- Plaerrdeifl Digitalplattform V4
-- Forward fix: M328 completion wrapped the public Fanbus projection after M330
-- and accidentally narrowed it back to PUBLISHED only. Keep CANCELLED readable
-- for cancellation communication while the normal portal UI remains PUBLISHED-only.

begin;

create or replace function public.pd_public_fanbus_trip(p_trip_id uuid)
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
     or coalesce(v_base ->> 'tripStatus', '') not in ('PUBLISHED', 'CANCELLED') then
    return jsonb_build_object('available', false);
  end if;

  return v_base;
end;
$function$;

create or replace function public.pd_public_fanbus_trips()
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
      where item.value ->> 'tripStatus' in ('PUBLISHED', 'CANCELLED')
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function
  public.pd_public_fanbus_trip(uuid),
  public.pd_public_fanbus_trips()
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_public_fanbus_trip(uuid),
  public.pd_public_fanbus_trips()
to anon, authenticated;

comment on function public.pd_public_fanbus_trip(uuid) is
  'M330 forward fix: public Fanbus detail remains readable for PUBLISHED and CANCELLED trips.';
comment on function public.pd_public_fanbus_trips() is
  'M330 forward fix: public Fanbus list contains PUBLISHED and CANCELLED trips; UI filters remain stricter.';

commit;
