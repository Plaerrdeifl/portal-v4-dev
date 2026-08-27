-- Plärrdeifl Digitalplattform V4
-- P300 / M320-R3 R1: deterministic automatic bus assignment
-- D-072: assignment_source is origin only; existing MANUAL/AUTO assignments are stable in R1.

alter table app_modules.fanbus_bus_assignments
  add column assignment_source text not null default 'MANUAL';

alter table app_modules.fanbus_bus_assignments
  add constraint fanbus_bus_assignments_source_check
  check (assignment_source in ('MANUAL','AUTO'));

comment on column app_modules.fanbus_bus_assignments.assignment_source is
  'M320-R3 origin marker only: MANUAL or AUTO. Existing AUTO rows remain stable in R1.';

create or replace function app_private.api_fanbus_bus_assignment_set_before_m330_r1(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_participant_id uuid;
  v_bus_id uuid;
  v_participant app_modules.fanbus_registrations%rowtype;
  v_bus app_modules.fanbus_buses%rowtype;
  v_existing app_modules.fanbus_bus_assignments%rowtype;
  v_occupancy integer;
  v_event text;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['participantId','busId']
     or exists (
       select 1 from pg_catalog.jsonb_object_keys(p_payload) payload_key(key)
       where payload_key.key <> all(array['participantId','busId'])
     ) then
    raise exception 'FANBUS_ASSIGNMENT_INVALID_PAYLOAD' using errcode='22023';
  end if;

  begin
    v_participant_id := (p_payload->>'participantId')::uuid;
    v_bus_id := nullif(pg_catalog.btrim(coalesce(p_payload->>'busId','')),'')::uuid;
  exception when others then
    raise exception 'FANBUS_ASSIGNMENT_INVALID_PAYLOAD' using errcode='22023';
  end;

  select * into v_participant
  from app_modules.fanbus_registrations
  where id=v_participant_id
  for update;
  if not found then
    raise exception 'Der Teilnehmer wurde nicht gefunden.' using errcode='P0002';
  end if;

  select * into v_existing
  from app_modules.fanbus_bus_assignments
  where participant_id=v_participant_id;

  if v_bus_id is null then
    if v_existing.participant_id is not null then
      delete from app_modules.fanbus_bus_assignments where participant_id=v_participant_id;
      perform app_private.log_audit(
        v_actor,'FANBUS_BUS_UNASSIGNED','fanbus_registration',v_participant_id::text,
        pg_catalog.jsonb_build_object('busId',v_existing.bus_id,'assignmentSource',v_existing.assignment_source),
        null,
        pg_catalog.jsonb_build_object(
          'tripId',v_participant.trip_id,'bookingId',v_participant.booking_id,
          'participantId',v_participant_id,'busId',v_existing.bus_id,
          'assignmentSource',v_existing.assignment_source
        )
      );
    end if;
    return app_private.api_fanbus_registrations_list(pg_catalog.jsonb_build_object('tripId',v_participant.trip_id));
  end if;

  if v_participant.status <> 'ACTIVE' then
    raise exception 'FANBUS_ASSIGNMENT_REQUIRES_ACTIVE_PARTICIPANT' using errcode='22023';
  end if;

  select * into v_bus
  from app_modules.fanbus_buses
  where id=v_bus_id
  for update;
  if not found then
    raise exception 'Der Bus wurde nicht gefunden.' using errcode='P0002';
  end if;
  if not v_bus.is_active or v_bus.trip_id <> v_participant.trip_id then
    raise exception 'FANBUS_ASSIGNMENT_BUS_UNAVAILABLE' using errcode='22023';
  end if;

  if v_existing.bus_id is not distinct from v_bus_id then
    return app_private.api_fanbus_registrations_list(pg_catalog.jsonb_build_object('tripId',v_participant.trip_id));
  end if;

  select pg_catalog.count(*)::integer into v_occupancy
  from app_modules.fanbus_bus_assignments assignment
  join app_modules.fanbus_registrations participant on participant.id=assignment.participant_id
  where assignment.bus_id=v_bus_id and participant.status='ACTIVE';
  if v_occupancy >= v_bus.capacity then
    raise exception 'FANBUS_BUS_CAPACITY_EXHAUSTED' using errcode='P3204';
  end if;

  if v_existing.participant_id is null then
    insert into app_modules.fanbus_bus_assignments(
      participant_id,trip_id,bus_id,assignment_source,created_by,updated_by
    ) values (
      v_participant_id,v_participant.trip_id,v_bus_id,'MANUAL',v_actor,v_actor
    );
    v_event := 'FANBUS_BUS_ASSIGNED';
  else
    update app_modules.fanbus_bus_assignments
    set bus_id=v_bus_id,
        assignment_source='MANUAL',
        revision=revision+1,
        updated_by=v_actor
    where participant_id=v_participant_id;
    v_event := 'FANBUS_BUS_CHANGED';
  end if;

  perform app_private.log_audit(
    v_actor,v_event,'fanbus_registration',v_participant_id::text,
    case when v_existing.participant_id is null then null
      else pg_catalog.jsonb_build_object('busId',v_existing.bus_id,'assignmentSource',v_existing.assignment_source) end,
    pg_catalog.jsonb_build_object('busId',v_bus_id,'assignmentSource','MANUAL'),
    pg_catalog.jsonb_build_object(
      'tripId',v_participant.trip_id,'bookingId',v_participant.booking_id,
      'participantId',v_participant_id,'busId',v_bus_id,'assignmentSource','MANUAL'
    )
  );

  return app_private.api_fanbus_registrations_list(pg_catalog.jsonb_build_object('tripId',v_participant.trip_id));
end;
$function$;

create function app_private.m320_r3_assignment_algorithm_version()
returns text
language sql
immutable
set search_path=''
as $function$
  select 'M320_R3_R1'::text
$function$;

create function app_private.m320_r3_preference_penalty(p_preference text,p_category text)
returns integer
language sql
immutable
set search_path=''
as $function$
  select case pg_catalog.upper(coalesce(p_preference,'EGAL'))
    when 'PARTY' then case pg_catalog.upper(coalesce(p_category,'NORMAL')) when 'PARTY' then 0 when 'NORMAL' then 1 else 2 end
    when 'RUHIG' then case pg_catalog.upper(coalesce(p_category,'NORMAL')) when 'RUHIG' then 0 when 'NORMAL' then 1 else 2 end
    else case when pg_catalog.upper(coalesce(p_category,'NORMAL'))='NORMAL' then 0 else 1 end
  end
$function$;

create function app_private.m320_r3_preference_outcome(p_preference text,p_category text)
returns text
language sql
immutable
set search_path=''
as $function$
  select case
    when pg_catalog.upper(coalesce(p_preference,'EGAL'))='EGAL' then 'FLEXIBLE'
    when pg_catalog.upper(p_preference)=pg_catalog.upper(coalesce(p_category,'')) then 'MATCHED'
    else 'MISMATCHED'
  end
$function$;

create function app_private.m320_r3_assignment_snapshot(p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
select pg_catalog.jsonb_build_object(
  'algorithmVersion',app_private.m320_r3_assignment_algorithm_version(),
  'trip',(select pg_catalog.jsonb_build_object(
    'id',trip.id,'status',trip.status,'revision',trip.revision,
    'busPreferenceEnabled',trip.bus_preference_enabled
  ) from app_modules.fanbus_trips trip where trip.id=p_trip_id),
  'buses',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',bus.id,'label',bus.label,'category',bus.category,'capacity',bus.capacity,
    'isActive',bus.is_active,'revision',bus.revision
  ) order by bus.id) from app_modules.fanbus_buses bus where bus.trip_id=p_trip_id),'[]'::jsonb),
  'bookings',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',booking.id,'source',booking.source,'createdAt',booking.created_at
  ) order by booking.id) from app_modules.fanbus_bookings booking where booking.trip_id=p_trip_id),'[]'::jsonb),
  'participants',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',participant.id,'bookingId',participant.booking_id,'participantSequence',participant.participant_sequence,
    'status',participant.status,'revision',participant.revision,'busPreference',participant.bus_preference,
    'tripBoardingStopId',participant.trip_boarding_stop_id,'registeredAt',participant.registered_at,
    'createdAt',participant.created_at
  ) order by participant.id) from app_modules.fanbus_registrations participant where participant.trip_id=p_trip_id),'[]'::jsonb),
  'assignments',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'participantId',assignment.participant_id,'tripId',assignment.trip_id,'busId',assignment.bus_id,
    'revision',assignment.revision,'assignmentSource',assignment.assignment_source
  ) order by assignment.participant_id) from app_modules.fanbus_bus_assignments assignment where assignment.trip_id=p_trip_id),'[]'::jsonb),
  'tripStops',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',stop.id,'boardingStopId',stop.boarding_stop_id,'departureAt',stop.departure_at,
    'position',stop.position,'isActive',stop.is_active,'revision',stop.revision
  ) order by stop.id) from app_modules.fanbus_trip_boarding_stops stop where stop.trip_id=p_trip_id),'[]'::jsonb),
  'busStopMappings',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',mapping.id,'busId',mapping.bus_id,'tripBoardingStopId',mapping.trip_boarding_stop_id,
    'revision',mapping.revision
  ) order by mapping.id) from app_modules.fanbus_bus_boarding_stops mapping where mapping.trip_id=p_trip_id),'[]'::jsonb)
)
$function$;

create function app_private.m320_r3_assignment_fingerprint(p_trip_id uuid)
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(app_private.m320_r3_assignment_snapshot(p_trip_id)::text,'UTF8'),
      'sha256'
    ),
    'hex'
  )
$function$;

create function app_private.m320_r3_assignment_plan(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_trip app_modules.fanbus_trips%rowtype;
  v_occupancy jsonb:='{}'::jsonb;
  v_new jsonb:='[]'::jsonb;
  v_existing_proposals jsonb:='[]'::jsonb;
  v_all_proposals jsonb:='[]'::jsonb;
  v_bus_summaries jsonb:='[]'::jsonb;
  v_conflicts jsonb:='[]'::jsonb;
  v_unit record;
  v_member record;
  v_existing record;
  v_bus record;
  v_chosen_bus uuid;
  v_bus_category text;
  v_warning text;
  v_explanations text[];
  v_warnings text[];
  v_outcome text;
  v_existing_count integer:=0;
  v_manual_count integer:=0;
  v_to_assign integer:=0;
  v_assigned_auto integer:=0;
  v_matched integer:=0;
  v_mismatched integer:=0;
  v_flexible integer:=0;
  v_unassigned integer:=0;
  v_blocking integer:=0;
begin
  select * into v_trip from app_modules.fanbus_trips where id=p_trip_id;
  if not found then raise exception 'FANBUS_TRIP_NOT_FOUND' using errcode='P0002'; end if;
  if v_trip.status='CANCELLED' then raise exception 'FANBUS_TRIP_CANCELLED' using errcode='55000'; end if;

  select coalesce(pg_catalog.jsonb_object_agg(bus.id::text,coalesce(occupancy.active_count,0)),'{}'::jsonb)
  into v_occupancy
  from app_modules.fanbus_buses bus
  left join lateral (
    select pg_catalog.count(*)::integer active_count
    from app_modules.fanbus_bus_assignments assignment
    join app_modules.fanbus_registrations participant on participant.id=assignment.participant_id
    where assignment.bus_id=bus.id and participant.status='ACTIVE'
  ) occupancy on true
  where bus.trip_id=p_trip_id and bus.is_active;

  for v_existing in
    select assignment.participant_id,assignment.trip_id assignment_trip_id,assignment.bus_id,assignment.assignment_source,
      participant.booking_id,participant.participant_sequence,participant.bus_preference,participant.trip_boarding_stop_id,
      bus.id existing_bus_id,bus.trip_id bus_trip_id,bus.is_active,bus.category,bus.capacity
    from app_modules.fanbus_bus_assignments assignment
    join app_modules.fanbus_registrations participant on participant.id=assignment.participant_id
    left join app_modules.fanbus_buses bus on bus.id=assignment.bus_id
    where participant.trip_id=p_trip_id and participant.status='ACTIVE'
    order by participant.id
  loop
    if v_existing.assignment_trip_id<>p_trip_id
       or v_existing.existing_bus_id is null
       or v_existing.bus_trip_id<>p_trip_id
       or not coalesce(v_existing.is_active,false) then
      v_conflicts:=v_conflicts||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'severity','BLOCKING','code','EXISTING_ASSIGNMENT_INVALID_BUS',
        'participantId',v_existing.participant_id,'busId',v_existing.bus_id
      ));
    elsif v_existing.trip_boarding_stop_id is not null and not exists(
      select 1 from app_modules.fanbus_bus_boarding_stops mapping
      where mapping.trip_id=p_trip_id
        and mapping.bus_id=v_existing.bus_id
        and mapping.trip_boarding_stop_id=v_existing.trip_boarding_stop_id
    ) then
      v_conflicts:=v_conflicts||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'severity','BLOCKING','code','EXISTING_ASSIGNMENT_STOP_INVALID',
        'participantId',v_existing.participant_id,'busId',v_existing.bus_id,
        'tripBoardingStopId',v_existing.trip_boarding_stop_id
      ));
    end if;
  end loop;

  for v_bus in
    select bus.id,bus.capacity,coalesce((v_occupancy->>bus.id::text)::integer,0) occupancy
    from app_modules.fanbus_buses bus
    where bus.trip_id=p_trip_id and bus.is_active
    order by bus.id
  loop
    if v_bus.occupancy>v_bus.capacity then
      v_conflicts:=v_conflicts||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'severity','BLOCKING','code','FIXED_CAPACITY_OVERFLOW',
        'busId',v_bus.id,'capacity',v_bus.capacity,'occupancy',v_bus.occupancy
      ));
    end if;
  end loop;

  for v_unit in
    with open_participants as (
      select participant.*,participant.booking_id::text unit_key
      from app_modules.fanbus_registrations participant
      left join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=participant.id
      where participant.trip_id=p_trip_id
        and participant.status='ACTIVE'
        and assignment.participant_id is null
    ), units as (
      select op.unit_key,
        pg_catalog.min(op.booking_id::text)::uuid booking_id,
        pg_catalog.count(*)::integer member_count,
        pg_catalog.count(*) filter(where op.bus_preference in('PARTY','RUHIG'))::integer specific_count,
        pg_catalog.min(coalesce(booking.created_at,op.registered_at,op.created_at)) order_at
      from open_participants op
      left join app_modules.fanbus_bookings booking on booking.id=op.booking_id
      group by op.unit_key
    )
    select units.*,
      coalesce(existing.assigned_bus_count,0)::integer existing_bus_count,
      existing.assigned_bus_id,
      (
        select pg_catalog.count(*)::integer
        from app_modules.fanbus_buses bus
        where bus.trip_id=p_trip_id and bus.is_active
          and bus.capacity-coalesce((v_occupancy->>bus.id::text)::integer,0)>=units.member_count
          and not exists(
            select 1 from open_participants member
            where member.unit_key=units.unit_key
              and member.trip_boarding_stop_id is not null
              and not exists(
                select 1 from app_modules.fanbus_bus_boarding_stops mapping
                where mapping.trip_id=p_trip_id
                  and mapping.bus_id=bus.id
                  and mapping.trip_boarding_stop_id=member.trip_boarding_stop_id
              )
          )
      ) feasible_whole_count
    from units
    left join lateral (
      select pg_catalog.count(distinct assignment.bus_id)::integer assigned_bus_count,
        case when pg_catalog.count(distinct assignment.bus_id)=1
          then pg_catalog.min(assignment.bus_id::text)::uuid end assigned_bus_id
      from app_modules.fanbus_registrations member
      join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=member.id
      where member.booking_id=units.booking_id and member.status='ACTIVE'
    ) existing on true
    order by case when coalesce(existing.assigned_bus_count,0)=1 then 0 else 1 end,
      feasible_whole_count,units.specific_count desc,units.member_count desc,units.order_at,units.unit_key
  loop
    v_chosen_bus:=null;
    v_bus_category:=null;

    select bus.id,bus.category
    into v_chosen_bus,v_bus_category
    from app_modules.fanbus_buses bus
    where bus.trip_id=p_trip_id and bus.is_active
      and bus.capacity-coalesce((v_occupancy->>bus.id::text)::integer,0)>=v_unit.member_count
      and not exists(
        select 1 from app_modules.fanbus_registrations member
        left join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=member.id
        where member.trip_id=p_trip_id
          and member.status='ACTIVE'
          and assignment.participant_id is null
          and member.booking_id=v_unit.booking_id
          and member.trip_boarding_stop_id is not null
          and not exists(
            select 1 from app_modules.fanbus_bus_boarding_stops mapping
            where mapping.trip_id=p_trip_id
              and mapping.bus_id=bus.id
              and mapping.trip_boarding_stop_id=member.trip_boarding_stop_id
          )
      )
    order by
      case when v_unit.existing_bus_count=1 and bus.id=v_unit.assigned_bus_id then 0 else 1 end,
      (
        select pg_catalog.count(*) filter(where member.bus_preference in('PARTY','RUHIG') and member.bus_preference=bus.category)
        from app_modules.fanbus_registrations member
        left join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=member.id
        where member.trip_id=p_trip_id and member.status='ACTIVE'
          and assignment.participant_id is null and member.booking_id=v_unit.booking_id
      ) desc,
      (
        select coalesce(pg_catalog.sum(app_private.m320_r3_preference_penalty(member.bus_preference,bus.category)),0)
        from app_modules.fanbus_registrations member
        left join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=member.id
        where member.trip_id=p_trip_id and member.status='ACTIVE'
          and assignment.participant_id is null and member.booking_id=v_unit.booking_id
      ),
      (
        select pg_catalog.count(*) filter(where member.bus_preference='EGAL' and bus.category<>'NORMAL')
        from app_modules.fanbus_registrations member
        left join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=member.id
        where member.trip_id=p_trip_id and member.status='ACTIVE'
          and assignment.participant_id is null and member.booking_id=v_unit.booking_id
      ),
      (coalesce((v_occupancy->>bus.id::text)::integer,0)+v_unit.member_count)::numeric/bus.capacity::numeric,
      pg_catalog.lower(bus.label),bus.id
    limit 1;

    if v_chosen_bus is not null then
      for v_member in
        select member.*
        from app_modules.fanbus_registrations member
        left join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=member.id
        where member.trip_id=p_trip_id and member.status='ACTIVE'
          and assignment.participant_id is null and member.booking_id=v_unit.booking_id
        order by member.participant_sequence,member.id
      loop
        v_outcome:=app_private.m320_r3_preference_outcome(v_member.bus_preference,v_bus_category);
        v_warnings:=array[]::text[];
        if v_unit.existing_bus_count>1 then
          v_warnings:=pg_catalog.array_append(v_warnings,'BOOKING_ALREADY_SPLIT_FIXED');
        elsif v_unit.existing_bus_count=1 and v_chosen_bus<>v_unit.assigned_bus_id then
          v_warnings:=pg_catalog.array_append(v_warnings,'BOOKING_SPLIT_REQUIRED');
        end if;
        if v_outcome='MISMATCHED' then
          v_warnings:=pg_catalog.array_append(v_warnings,'PREFERENCE_MISMATCH');
        end if;
        v_explanations:=array[]::text[];
        if v_unit.member_count>1 then
          v_explanations:=pg_catalog.array_append(v_explanations,'BOOKING_KEPT_TOGETHER');
        end if;
        if v_unit.existing_bus_count=1 and v_chosen_bus=v_unit.assigned_bus_id then
          v_explanations:=pg_catalog.array_append(v_explanations,'EXISTING_BOOKING_BUS_PREFERRED');
        end if;
        v_explanations:=pg_catalog.array_append(v_explanations,
          case v_outcome when 'MATCHED' then 'PREFERENCE_MATCHED'
            when 'FLEXIBLE' then 'EGAL_FLEXIBLE' else 'VALID_FALLBACK_BUS' end
        );
        v_new:=v_new||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'participantId',v_member.id,'bookingId',v_member.booking_id,
          'participantSequence',v_member.participant_sequence,'currentBusId',null,
          'proposedBusId',v_chosen_bus,'assignmentState','PROPOSED_AUTO',
          'busPreference',v_member.bus_preference,'preferenceOutcome',v_outcome,
          'tripBoardingStopId',v_member.trip_boarding_stop_id,
          'bookingCohesion',case when v_unit.member_count=1 then 'SINGLE'
            when v_unit.existing_bus_count=1 and v_chosen_bus<>v_unit.assigned_bus_id then 'SPLIT_REQUIRED'
            else 'TOGETHER' end,
          'warnings',pg_catalog.to_jsonb(v_warnings),
          'explanations',pg_catalog.to_jsonb(v_explanations)
        ));
      end loop;
      v_occupancy:=pg_catalog.jsonb_set(
        v_occupancy,array[v_chosen_bus::text],
        pg_catalog.to_jsonb(coalesce((v_occupancy->>v_chosen_bus::text)::integer,0)+v_unit.member_count),true
      );
    else
      for v_member in
        select member.*
        from app_modules.fanbus_registrations member
        left join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=member.id
        where member.trip_id=p_trip_id and member.status='ACTIVE'
          and assignment.participant_id is null and member.booking_id=v_unit.booking_id
        order by (
          select pg_catalog.count(*) from app_modules.fanbus_buses candidate
          where candidate.trip_id=p_trip_id and candidate.is_active
            and candidate.capacity>coalesce((v_occupancy->>candidate.id::text)::integer,0)
            and (member.trip_boarding_stop_id is null or exists(
              select 1 from app_modules.fanbus_bus_boarding_stops mapping
              where mapping.trip_id=p_trip_id and mapping.bus_id=candidate.id
                and mapping.trip_boarding_stop_id=member.trip_boarding_stop_id
            ))
        ), case when member.bus_preference in('PARTY','RUHIG') then 0 else 1 end,
        member.participant_sequence,member.id
      loop
        v_chosen_bus:=null;
        v_bus_category:=null;
        select bus.id,bus.category into v_chosen_bus,v_bus_category
        from app_modules.fanbus_buses bus
        where bus.trip_id=p_trip_id and bus.is_active
          and bus.capacity>coalesce((v_occupancy->>bus.id::text)::integer,0)
          and (v_member.trip_boarding_stop_id is null or exists(
            select 1 from app_modules.fanbus_bus_boarding_stops mapping
            where mapping.trip_id=p_trip_id and mapping.bus_id=bus.id
              and mapping.trip_boarding_stop_id=v_member.trip_boarding_stop_id
          ))
        order by case when v_unit.existing_bus_count=1 and bus.id=v_unit.assigned_bus_id then 0 else 1 end,
          app_private.m320_r3_preference_penalty(v_member.bus_preference,bus.category),
          (coalesce((v_occupancy->>bus.id::text)::integer,0)+1)::numeric/bus.capacity::numeric,
          pg_catalog.lower(bus.label),bus.id
        limit 1;

        v_warnings:=array[]::text[];
        v_explanations:=array[]::text[];
        if v_unit.member_count>1 or v_unit.existing_bus_count>0 then
          v_warnings:=pg_catalog.array_append(v_warnings,'BOOKING_SPLIT_REQUIRED');
          v_explanations:=pg_catalog.array_append(v_explanations,'BOOKING_SPLIT_ONLY_AFTER_NO_WHOLE_BUS');
        end if;
        if v_unit.existing_bus_count>1 then
          v_warnings:=pg_catalog.array_append(v_warnings,'BOOKING_ALREADY_SPLIT_FIXED');
        end if;

        if v_chosen_bus is null then
          if exists(
            select 1 from app_modules.fanbus_buses bus
            where bus.trip_id=p_trip_id and bus.is_active
              and (v_member.trip_boarding_stop_id is null or exists(
                select 1 from app_modules.fanbus_bus_boarding_stops mapping
                where mapping.trip_id=p_trip_id and mapping.bus_id=bus.id
                  and mapping.trip_boarding_stop_id=v_member.trip_boarding_stop_id
              ))
          ) then v_warning:='NO_CAPACITY'; else v_warning:='STOP_NO_COMPATIBLE_BUS'; end if;
          v_warnings:=pg_catalog.array_append(v_warnings,v_warning);
          v_conflicts:=v_conflicts||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'severity','NON_BLOCKING','code',v_warning,
            'participantId',v_member.id,'bookingId',v_member.booking_id
          ));
          v_outcome:=null;
          v_explanations:=pg_catalog.array_append(v_explanations,'NO_VALID_BUS_AVAILABLE');
        else
          v_outcome:=app_private.m320_r3_preference_outcome(v_member.bus_preference,v_bus_category);
          if v_outcome='MISMATCHED' then
            v_warnings:=pg_catalog.array_append(v_warnings,'PREFERENCE_MISMATCH');
          end if;
          v_explanations:=pg_catalog.array_append(v_explanations,
            case v_outcome when 'MATCHED' then 'PREFERENCE_MATCHED'
              when 'FLEXIBLE' then 'EGAL_FLEXIBLE' else 'VALID_FALLBACK_BUS' end
          );
          v_occupancy:=pg_catalog.jsonb_set(
            v_occupancy,array[v_chosen_bus::text],
            pg_catalog.to_jsonb(coalesce((v_occupancy->>v_chosen_bus::text)::integer,0)+1),true
          );
        end if;

        v_new:=v_new||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'participantId',v_member.id,'bookingId',v_member.booking_id,
          'participantSequence',v_member.participant_sequence,'currentBusId',null,
          'proposedBusId',v_chosen_bus,'assignmentState','PROPOSED_AUTO',
          'busPreference',v_member.bus_preference,'preferenceOutcome',v_outcome,
          'tripBoardingStopId',v_member.trip_boarding_stop_id,
          'bookingCohesion',case when v_unit.member_count>1 or v_unit.existing_bus_count>0
            then 'SPLIT_REQUIRED' else 'SINGLE' end,
          'warnings',pg_catalog.to_jsonb(v_warnings),
          'explanations',pg_catalog.to_jsonb(v_explanations)
        ));
      end loop;
    end if;
  end loop;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'participantId',participant.id,'bookingId',participant.booking_id,
    'participantSequence',participant.participant_sequence,
    'currentBusId',assignment.bus_id,'proposedBusId',assignment.bus_id,
    'assignmentState',case when assignment.assignment_source='MANUAL' then 'FIXED_MANUAL' else 'EXISTING_AUTO' end,
    'assignmentSource',assignment.assignment_source,'busPreference',participant.bus_preference,
    'preferenceOutcome',app_private.m320_r3_preference_outcome(participant.bus_preference,bus.category),
    'tripBoardingStopId',participant.trip_boarding_stop_id,
    'bookingCohesion',case when (
      select pg_catalog.count(distinct sibling_assignment.bus_id)
      from app_modules.fanbus_registrations sibling
      join app_modules.fanbus_bus_assignments sibling_assignment on sibling_assignment.participant_id=sibling.id
      where sibling.booking_id=participant.booking_id and sibling.status='ACTIVE'
    )>1 then 'ALREADY_SPLIT_FIXED' else 'EXISTING' end,
    'warnings',pg_catalog.to_jsonb(pg_catalog.array_remove(array[
      case when app_private.m320_r3_preference_outcome(participant.bus_preference,bus.category)='MISMATCHED'
        then 'PREFERENCE_MISMATCH' end,
      case when (
        select pg_catalog.count(distinct sibling_assignment.bus_id)
        from app_modules.fanbus_registrations sibling
        join app_modules.fanbus_bus_assignments sibling_assignment on sibling_assignment.participant_id=sibling.id
        where sibling.booking_id=participant.booking_id and sibling.status='ACTIVE'
      )>1 then 'BOOKING_ALREADY_SPLIT_FIXED' end
    ]::text[],null)),
    'explanations',pg_catalog.jsonb_build_array('EXISTING_ASSIGNMENT_PROTECTED')
  ) order by participant.booking_id,participant.participant_sequence,participant.id),'[]'::jsonb)
  into v_existing_proposals
  from app_modules.fanbus_registrations participant
  join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=participant.id
  left join app_modules.fanbus_buses bus on bus.id=assignment.bus_id
  where participant.trip_id=p_trip_id and participant.status='ACTIVE';

  select coalesce(pg_catalog.jsonb_agg(item.value order by
    item.value->>'bookingId',coalesce((item.value->>'participantSequence')::integer,0),item.value->>'participantId'
  ),'[]'::jsonb)
  into v_all_proposals
  from pg_catalog.jsonb_array_elements(v_existing_proposals||v_new) item(value);

  select pg_catalog.count(*)::integer into v_existing_count
  from app_modules.fanbus_bus_assignments assignment
  join app_modules.fanbus_registrations participant on participant.id=assignment.participant_id
  where participant.trip_id=p_trip_id and participant.status='ACTIVE';

  select pg_catalog.count(*)::integer into v_manual_count
  from app_modules.fanbus_bus_assignments assignment
  join app_modules.fanbus_registrations participant on participant.id=assignment.participant_id
  where participant.trip_id=p_trip_id and participant.status='ACTIVE'
    and assignment.assignment_source='MANUAL';

  select pg_catalog.count(*)::integer into v_to_assign
  from app_modules.fanbus_registrations participant
  left join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=participant.id
  where participant.trip_id=p_trip_id and participant.status='ACTIVE'
    and assignment.participant_id is null;

  select pg_catalog.count(*) filter(where item.value->>'proposedBusId' is not null)::integer,
    pg_catalog.count(*) filter(where item.value->>'preferenceOutcome'='MATCHED')::integer,
    pg_catalog.count(*) filter(where item.value->>'preferenceOutcome'='MISMATCHED')::integer,
    pg_catalog.count(*) filter(where item.value->>'preferenceOutcome'='FLEXIBLE')::integer,
    pg_catalog.count(*) filter(where item.value->>'proposedBusId' is null)::integer
  into v_assigned_auto,v_matched,v_mismatched,v_flexible,v_unassigned
  from pg_catalog.jsonb_array_elements(v_new) item(value);

  select pg_catalog.count(*)::integer into v_blocking
  from pg_catalog.jsonb_array_elements(v_conflicts) conflict(value)
  where conflict.value->>'severity'='BLOCKING';

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'busId',bus.id,'label',bus.label,'category',bus.category,'capacity',bus.capacity,
    'existingOccupancy',existing.occupancy,'fixedManualOccupancy',existing.manual_occupancy,
    'proposedNew',proposed.proposed_count,'afterApply',existing.occupancy+proposed.proposed_count,
    'freeAfter',pg_catalog.greatest(bus.capacity-existing.occupancy-proposed.proposed_count,0),
    'matchedSpecific',proposed.matched_count,'mismatchedSpecific',proposed.mismatched_count
  ) order by pg_catalog.lower(bus.label),bus.id),'[]'::jsonb)
  into v_bus_summaries
  from app_modules.fanbus_buses bus
  left join lateral (
    select pg_catalog.count(*)::integer occupancy,
      pg_catalog.count(*) filter(where assignment.assignment_source='MANUAL')::integer manual_occupancy
    from app_modules.fanbus_bus_assignments assignment
    join app_modules.fanbus_registrations participant on participant.id=assignment.participant_id
    where assignment.bus_id=bus.id and participant.status='ACTIVE'
  ) existing on true
  left join lateral (
    select pg_catalog.count(*)::integer proposed_count,
      pg_catalog.count(*) filter(where item.value->>'preferenceOutcome'='MATCHED')::integer matched_count,
      pg_catalog.count(*) filter(where item.value->>'preferenceOutcome'='MISMATCHED')::integer mismatched_count
    from pg_catalog.jsonb_array_elements(v_new) item(value)
    where item.value->>'proposedBusId'=bus.id::text
  ) proposed on true
  where bus.trip_id=p_trip_id and bus.is_active;

  return pg_catalog.jsonb_build_object(
    'tripId',p_trip_id,'algorithmVersion',app_private.m320_r3_assignment_algorithm_version(),
    'trip',pg_catalog.jsonb_build_object('status',v_trip.status,'revision',v_trip.revision,'busPreferenceEnabled',v_trip.bus_preference_enabled),
    'summary',pg_catalog.jsonb_build_object(
      'participantsToAssign',v_to_assign,'assignedAutomatically',coalesce(v_assigned_auto,0),
      'existingAssigned',v_existing_count,'fixedManual',v_manual_count,
      'preferenceMatched',coalesce(v_matched,0),'preferenceMismatched',coalesce(v_mismatched,0),
      'flexibleEgal',coalesce(v_flexible,0),'unassigned',coalesce(v_unassigned,0),
      'blockingConflicts',v_blocking
    ),
    'buses',v_bus_summaries,'participantProposals',v_all_proposals,
    'conflicts',v_conflicts,'canApply',v_blocking=0 and coalesce(v_assigned_auto,0)>0
  );
end;
$function$;

create function app_private.api_fanbus_assignment_preview(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_trip_id uuid;
  v_plan jsonb;
begin
  perform app_private.require_capability('fanbus.registrations.manage');
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload)<>'object'
     or not p_payload?'tripId'
     or exists(select 1 from pg_catalog.jsonb_object_keys(p_payload) key(name) where key.name<>all(array['tripId'])) then
    raise exception 'FANBUS_ASSIGNMENT_PREVIEW_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin
    v_trip_id:=(p_payload->>'tripId')::uuid;
  exception when others then
    raise exception 'FANBUS_ASSIGNMENT_PREVIEW_INVALID_PAYLOAD' using errcode='22023';
  end;
  if v_trip_id is null then
    raise exception 'FANBUS_ASSIGNMENT_PREVIEW_INVALID_PAYLOAD' using errcode='22023';
  end if;
  v_plan:=app_private.m320_r3_assignment_plan(v_trip_id);
  return v_plan||pg_catalog.jsonb_build_object(
    'inputFingerprint',app_private.m320_r3_assignment_fingerprint(v_trip_id)
  );
end;
$function$;

create function app_private.api_fanbus_assignment_apply(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_trip_id uuid;
  v_algorithm text;
  v_fingerprint text;
  v_current_fingerprint text;
  v_final jsonb;
  v_plan jsonb;
  v_item jsonb;
  v_proposal jsonb;
  v_participant app_modules.fanbus_registrations%rowtype;
  v_bus app_modules.fanbus_buses%rowtype;
  v_participant_id uuid;
  v_bus_id uuid;
  v_proposed_bus_id uuid;
  v_source text;
  v_final_occupancy jsonb:='{}'::jsonb;
  v_changes jsonb:='[]'::jsonb;
  v_change jsonb;
  v_expected_count integer;
  v_distinct_count integer;
  v_projected integer;
  v_applied integer:=0;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload)<>'object'
    or not p_payload?&array['tripId','algorithmVersion','inputFingerprint','finalAssignments']
    or exists(select 1 from pg_catalog.jsonb_object_keys(p_payload) key(name)
      where key.name<>all(array['tripId','algorithmVersion','inputFingerprint','finalAssignments']))
    or pg_catalog.jsonb_typeof(p_payload->'finalAssignments')<>'array' then
    raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
  end if;

  begin
    v_trip_id:=(p_payload->>'tripId')::uuid;
  exception when others then
    raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
  end;
  v_algorithm:=pg_catalog.btrim(coalesce(p_payload->>'algorithmVersion',''));
  v_fingerprint:=pg_catalog.btrim(coalesce(p_payload->>'inputFingerprint',''));
  v_final:=p_payload->'finalAssignments';
  if v_trip_id is null or v_algorithm='' or v_fingerprint='' then
    raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
  end if;

  perform app_private.m330_lock_mutable_fanbus_trip(v_trip_id);

  if v_algorithm<>app_private.m320_r3_assignment_algorithm_version() then
    raise exception 'FANBUS_ASSIGNMENT_PREVIEW_STALE' using errcode='40001';
  end if;
  v_current_fingerprint:=app_private.m320_r3_assignment_fingerprint(v_trip_id);
  if v_current_fingerprint is distinct from v_fingerprint then
    raise exception 'FANBUS_ASSIGNMENT_PREVIEW_STALE' using errcode='40001';
  end if;

  v_plan:=app_private.m320_r3_assignment_plan(v_trip_id);
  if coalesce((v_plan#>>'{summary,blockingConflicts}')::integer,0)>0 then
    raise exception 'FANBUS_ASSIGNMENT_BLOCKED' using errcode='55000';
  end if;

  select pg_catalog.count(*)::integer into v_expected_count
  from pg_catalog.jsonb_array_elements(v_plan->'participantProposals') proposal(value)
  where proposal.value->>'assignmentState'='PROPOSED_AUTO';
  if pg_catalog.jsonb_array_length(v_final)<>v_expected_count then
    raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
  end if;

  begin
    select pg_catalog.count(distinct (item.value->>'participantId')::uuid)::integer
    into v_distinct_count
    from pg_catalog.jsonb_array_elements(v_final) item(value)
    where pg_catalog.jsonb_typeof(item.value)='object'
      and item.value?&array['participantId','busId']
      and not exists(select 1 from pg_catalog.jsonb_object_keys(item.value) key(name)
        where key.name<>all(array['participantId','busId']));
  exception when others then
    raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
  end;
  if v_distinct_count<>v_expected_count then
    raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
  end if;

  select coalesce(pg_catalog.jsonb_object_agg(bus.id::text,coalesce(occupancy.active_count,0)),'{}'::jsonb)
  into v_final_occupancy
  from app_modules.fanbus_buses bus
  left join lateral (
    select pg_catalog.count(*)::integer active_count
    from app_modules.fanbus_bus_assignments assignment
    join app_modules.fanbus_registrations participant on participant.id=assignment.participant_id
    where assignment.bus_id=bus.id and participant.status='ACTIVE'
  ) occupancy on true
  where bus.trip_id=v_trip_id and bus.is_active;

  for v_item in
    select item.value from pg_catalog.jsonb_array_elements(v_final) item(value)
    order by item.value->>'participantId'
  loop
    if pg_catalog.jsonb_typeof(v_item)<>'object'
      or not v_item?&array['participantId','busId']
      or exists(select 1 from pg_catalog.jsonb_object_keys(v_item) key(name)
        where key.name<>all(array['participantId','busId'])) then
      raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
    end if;

    begin
      v_participant_id:=(v_item->>'participantId')::uuid;
      v_bus_id:=nullif(pg_catalog.btrim(coalesce(v_item->>'busId','')),'')::uuid;
    exception when others then
      raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
    end;

    select proposal.value into v_proposal
    from pg_catalog.jsonb_array_elements(v_plan->'participantProposals') proposal(value)
    where proposal.value->>'assignmentState'='PROPOSED_AUTO'
      and proposal.value->>'participantId'=v_participant_id::text
    limit 1;
    if v_proposal is null then
      raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
    end if;

    select * into v_participant
    from app_modules.fanbus_registrations
    where id=v_participant_id and trip_id=v_trip_id
    for update;
    if not found or v_participant.status<>'ACTIVE'
       or exists(select 1 from app_modules.fanbus_bus_assignments assignment where assignment.participant_id=v_participant_id) then
      raise exception 'FANBUS_ASSIGNMENT_PREVIEW_STALE' using errcode='40001';
    end if;

    v_proposed_bus_id:=nullif(v_proposal->>'proposedBusId','')::uuid;
    if v_bus_id is not null then
      select * into v_bus from app_modules.fanbus_buses where id=v_bus_id for update;
      if not found or not v_bus.is_active or v_bus.trip_id<>v_trip_id then
        raise exception 'FANBUS_ASSIGNMENT_BUS_UNAVAILABLE' using errcode='22023';
      end if;
      if v_participant.trip_boarding_stop_id is not null and not exists(
        select 1 from app_modules.fanbus_bus_boarding_stops mapping
        where mapping.trip_id=v_trip_id and mapping.bus_id=v_bus_id
          and mapping.trip_boarding_stop_id=v_participant.trip_boarding_stop_id
      ) then
        raise exception 'FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP' using errcode='22023';
      end if;

      v_projected:=coalesce((v_final_occupancy->>v_bus_id::text)::integer,0)+1;
      if v_projected>v_bus.capacity then
        raise exception 'FANBUS_BUS_CAPACITY_EXHAUSTED' using errcode='P3204';
      end if;
      v_final_occupancy:=pg_catalog.jsonb_set(
        v_final_occupancy,array[v_bus_id::text],pg_catalog.to_jsonb(v_projected),true
      );
      v_source:=case when v_bus_id is not distinct from v_proposed_bus_id then 'AUTO' else 'MANUAL' end;
      v_changes:=v_changes||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'participantId',v_participant_id,'fromBusId',null,'toBusId',v_bus_id,
        'assignmentSource',v_source
      ));
    end if;
  end loop;

  for v_change in
    select item.value from pg_catalog.jsonb_array_elements(v_changes) item(value)
  loop
    insert into app_modules.fanbus_bus_assignments(
      participant_id,trip_id,bus_id,assignment_source,created_by,updated_by
    ) values (
      (v_change->>'participantId')::uuid,v_trip_id,(v_change->>'toBusId')::uuid,
      v_change->>'assignmentSource',v_actor,v_actor
    );
    v_applied:=v_applied+1;
  end loop;

  perform app_private.log_audit(
    v_actor,'FANBUS_AUTO_ASSIGNMENT_APPLIED','fanbus_trip',v_trip_id::text,
    null,pg_catalog.jsonb_build_object('assignmentCount',v_applied),
    pg_catalog.jsonb_build_object(
      'tripId',v_trip_id,'algorithmVersion',v_algorithm,'inputFingerprint',v_fingerprint,
      'assignmentCount',v_applied,'changes',v_changes
    )
  );

  return pg_catalog.jsonb_build_object(
    'tripId',v_trip_id,'algorithmVersion',v_algorithm,'inputFingerprint',v_fingerprint,
    'applied',v_applied,'changes',v_changes
  );
end;
$function$;

alter function app_private.pd_api_current_actions() rename to pd_api_current_actions_before_m320_r3;
create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
set search_path=''
as $function$
  select app_private.pd_api_current_actions_before_m320_r3()
    || array['fanbus_assignment_preview','fanbus_assignment_apply']::text[]
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_m320_r3;
create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path=''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action,'')))
    when 'fanbus_assignment_preview' then 'READ'
    when 'fanbus_assignment_apply' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m320_r3(p_action)
  end
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_m320_r3;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_action text:=pg_catalog.lower(pg_catalog.btrim(coalesce(p_action,'')));
  v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
  case v_action
    when 'fanbus_assignment_preview' then return app_private.api_fanbus_assignment_preview(v_payload);
    when 'fanbus_assignment_apply' then return app_private.api_fanbus_assignment_apply(v_payload);
    else return app_private.pd_api_dispatch_current_before_m320_r3(p_action,p_payload);
  end case;
end;
$function$;

revoke all on function
  app_private.m320_r3_assignment_algorithm_version(),
  app_private.m320_r3_preference_penalty(text,text),
  app_private.m320_r3_preference_outcome(text,text),
  app_private.m320_r3_assignment_snapshot(uuid),
  app_private.m320_r3_assignment_fingerprint(uuid),
  app_private.m320_r3_assignment_plan(uuid),
  app_private.api_fanbus_assignment_preview(jsonb),
  app_private.api_fanbus_assignment_apply(jsonb),
  app_private.pd_api_current_actions_before_m320_r3(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_m320_r3(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_m320_r3(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
from public,anon,authenticated,service_role;

grant execute on function
  app_private.m320_r3_assignment_algorithm_version(),
  app_private.m320_r3_preference_penalty(text,text),
  app_private.m320_r3_preference_outcome(text,text),
  app_private.m320_r3_assignment_snapshot(uuid),
  app_private.m320_r3_assignment_fingerprint(uuid),
  app_private.m320_r3_assignment_plan(uuid),
  app_private.api_fanbus_assignment_preview(jsonb),
  app_private.api_fanbus_assignment_apply(jsonb),
  app_private.pd_api_current_actions_before_m320_r3(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_m320_r3(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_m320_r3(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;
