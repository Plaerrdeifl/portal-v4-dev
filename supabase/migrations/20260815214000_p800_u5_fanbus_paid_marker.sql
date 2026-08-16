-- Plärrdeifl Digitalplattform V4
-- P800 U5: visual Fanbus stabilization + manual paid marker.
-- Forward-only; no finance coupling.

alter table app_modules.fanbus_participant_checkins
  add column if not exists is_paid boolean not null default false;

create or replace function app_private.api_fanbus_operations_snapshot(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_trip uuid:=app_private.m325_parse_uuid(p_payload->>'tripId','FANBUS_OPERATIONS_INVALID_PAYLOAD');
begin
  if not exists(select 1 from app_modules.fanbus_trips where id=v_trip) then
    raise exception 'FANBUS_TRIP_NOT_FOUND' using errcode='P0002';
  end if;
  return (
    with active as (
      select r.id,r.first_name,r.last_name,r.trip_boarding_stop_id,
        a.bus_id,b.label bus_label,s.label stop_label,t.departure_at,
        coalesce(c.status,'OPEN') checkin_status,
        coalesce(c.revision,1) checkin_revision,
        coalesce(c.is_paid,false) is_paid
      from app_modules.fanbus_registrations r
      left join app_modules.fanbus_bus_assignments a on a.participant_id=r.id
      left join app_modules.fanbus_buses b on b.id=a.bus_id
      left join app_modules.fanbus_trip_boarding_stops t on t.id=r.trip_boarding_stop_id
      left join app_modules.fanbus_boarding_stops s on s.id=t.boarding_stop_id
      left join app_modules.fanbus_participant_checkins c
        on c.participant_id=r.id and c.checkin_kind='OUTBOUND'
      where r.trip_id=v_trip and r.status='ACTIVE'
    ),
    bus_counts as (
      select bus_id,bus_label,count(*)::integer expected,
        count(*) filter(where checkin_status='PRESENT')::integer present,
        count(*) filter(where checkin_status='OPEN')::integer open,
        count(*) filter(where checkin_status='NO_SHOW')::integer no_show
      from active where bus_id is not null group by bus_id,bus_label
    ),
    stop_counts as (
      select trip_boarding_stop_id,stop_label,count(*)::integer expected,
        count(*) filter(where checkin_status='PRESENT')::integer present,
        count(*) filter(where checkin_status='OPEN')::integer open,
        count(*) filter(where checkin_status='NO_SHOW')::integer no_show
      from active where trip_boarding_stop_id is not null
      group by trip_boarding_stop_id,stop_label
    ),
    summary as (
      select count(*)::integer expected,
        count(*) filter(where checkin_status='PRESENT')::integer present,
        count(*) filter(where checkin_status='OPEN')::integer open,
        count(*) filter(where checkin_status='NO_SHOW')::integer no_show,
        count(*) filter(where bus_id is null)::integer unassigned_bus_count,
        count(*) filter(where trip_boarding_stop_id is null)::integer missing_stop_count
      from active
    )
    select jsonb_build_object(
      'tripId',v_trip,
      'summary',jsonb_build_object(
        'expected',summary.expected,'present',summary.present,'open',summary.open,
        'noShow',summary.no_show,'unassignedBusCount',summary.unassigned_bus_count,
        'missingBoardingStopCount',summary.missing_stop_count
      ),
      'buses',coalesce((select jsonb_agg(jsonb_build_object(
        'busId',bus_id,'label',bus_label,'expected',expected,'present',present,
        'open',open,'noShow',no_show
      ) order by lower(bus_label),bus_id) from bus_counts),'[]'::jsonb),
      'stops',coalesce((select jsonb_agg(jsonb_build_object(
        'tripBoardingStopId',trip_boarding_stop_id,'label',stop_label,
        'expected',expected,'present',present,'open',open,'noShow',no_show
      ) order by lower(stop_label),trip_boarding_stop_id) from stop_counts),'[]'::jsonb),
      'participants',coalesce((select jsonb_agg(jsonb_build_object(
        'id',id,'firstName',first_name,'lastName',last_name,'busId',bus_id,
        'busLabel',bus_label,'tripBoardingStopId',trip_boarding_stop_id,
        'boardingStopLabel',stop_label,'departureAt',departure_at,
        'checkinStatus',checkin_status,'checkinRevision',checkin_revision,
        'isPaid',is_paid
      ) order by lower(last_name),lower(first_name),id) from active),'[]'::jsonb)
    ) from summary
  );
end;
$$;

create function app_private.api_fanbus_paid_set(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_participant uuid:=app_private.m325_parse_uuid(
    p_payload->>'participantId','FANBUS_PAID_INVALID_PAYLOAD'
  );
  v_expected integer;
  v_paid boolean;
  v_checkin app_modules.fanbus_participant_checkins%rowtype;
  v_registration app_modules.fanbus_registrations%rowtype;
begin
  begin
    v_expected := (p_payload->>'expectedRevision')::integer;
    if lower(coalesce(p_payload->>'isPaid',''))='true' then
      v_paid:=true;
    elsif lower(coalesce(p_payload->>'isPaid',''))='false' then
      v_paid:=false;
    else
      raise exception 'invalid paid flag';
    end if;
  exception when others then
    raise exception 'FANBUS_PAID_INVALID_PAYLOAD' using errcode='22023';
  end;

  if v_expected is null or v_expected <= 0 then
    raise exception 'FANBUS_PAID_INVALID_PAYLOAD' using errcode='22023';
  end if;

  select r.* into v_registration
  from app_modules.fanbus_registrations r
  where r.id=v_participant
  for update;
  if not found or v_registration.status<>'ACTIVE' then
    raise exception 'FANBUS_PAID_REQUIRES_ACTIVE_PARTICIPANT' using errcode='22023';
  end if;

  select * into v_checkin
  from app_modules.fanbus_participant_checkins
  where participant_id=v_participant and checkin_kind='OUTBOUND'
  for update;

  if not found then
    insert into app_modules.fanbus_participant_checkins(
      participant_id,trip_id,checkin_kind,status,is_paid,updated_by
    ) values(v_participant,v_registration.trip_id,'OUTBOUND','OPEN',false,v_actor)
    returning * into v_checkin;
  end if;

  if v_checkin.revision<>v_expected then
    raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode='40001';
  end if;

  update app_modules.fanbus_participant_checkins
  set is_paid=v_paid,revision=revision+1,updated_by=v_actor
  where id=v_checkin.id;

  perform app_private.log_audit(
    v_actor,'FANBUS_PAID_MARKER_CHANGED','fanbus_participant_checkin',
    v_checkin.id::text,
    jsonb_build_object('isPaid',v_checkin.is_paid),
    jsonb_build_object('isPaid',v_paid),
    jsonb_build_object('tripId',v_registration.trip_id,'participantId',v_participant)
  );

  return app_private.api_fanbus_operations_snapshot(
    jsonb_build_object('tripId',v_registration.trip_id)
  );
end;
$$;

alter function public.pd_api(text,jsonb)
  rename to pd_api_before_p800_u5_r1;

revoke all on function public.pd_api_before_p800_u5_r1(text,jsonb)
from public,anon,authenticated,service_role;

create function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_data jsonb;
  v_trip uuid;
begin
  case p_action
    when 'fanbus_paid_set' then
      v_data:=app_private.api_fanbus_paid_set(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_trip_boarding_stops_public' then
      perform app_private.require_active_user();
      begin
        v_trip:=nullif(btrim(coalesce(p_payload->>'tripId','')),'')::uuid;
      exception when others then
        raise exception 'FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD' using errcode='22023';
      end;
      if v_trip is null then
        raise exception 'FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD' using errcode='22023';
      end if;
      v_data:=public.pd_public_fanbus_trip_boarding_stops(v_trip);
    else
      return public.pd_api_before_p800_u5_r1(p_action,p_payload);
  end case;
  return jsonb_build_object('ok',true,'data',v_data);
exception when others then
  return jsonb_build_object(
    'ok',false,'error',jsonb_build_object('code',sqlstate,'message',sqlerrm)
  );
end;
$$;

revoke all on function public.pd_api(text,jsonb)
from public,anon,authenticated,service_role;
grant execute on function public.pd_api(text,jsonb) to authenticated;

revoke all on function app_private.api_fanbus_paid_set(jsonb)
from public,anon,authenticated,service_role;
revoke all on function app_private.api_fanbus_operations_snapshot(jsonb)
from public,anon,authenticated,service_role;
