-- Plaerrdeifl Digitalplattform V4
-- Fanbus R1: trip-scoped travel groups connect separate bookings without merging booking numbers.

begin;

create table app_modules.fanbus_travel_groups (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references app_modules.fanbus_trips(id) on delete restrict,
  name text not null,
  bus_preference text not null default 'EGAL',
  bus_id uuid,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_travel_groups_name_check check (
    length(btrim(name)) between 1 and 120
  ),
  constraint fanbus_travel_groups_bus_preference_check check (
    bus_preference in ('EGAL','RUHIG','PARTY')
  ),
  constraint fanbus_travel_groups_id_trip_key unique (id,trip_id),
  constraint fanbus_travel_groups_bus_trip_fk
    foreign key (bus_id,trip_id)
    references app_modules.fanbus_buses(id,trip_id) on delete restrict
);

create index fanbus_travel_groups_trip_idx
  on app_modules.fanbus_travel_groups(trip_id,lower(name));

create trigger fanbus_travel_groups_set_updated_at
before update on app_modules.fanbus_travel_groups
for each row execute function app_private.set_updated_at();

alter table app_modules.fanbus_travel_groups enable row level security;
revoke all on table app_modules.fanbus_travel_groups from public,anon,authenticated,service_role;

alter table app_modules.fanbus_bookings
  add column travel_group_id uuid,
  add constraint fanbus_bookings_travel_group_trip_fk
    foreign key (travel_group_id,trip_id)
    references app_modules.fanbus_travel_groups(id,trip_id) on delete set null;

create index fanbus_bookings_travel_group_idx
  on app_modules.fanbus_bookings(travel_group_id)
  where travel_group_id is not null;

-- Add travel-group metadata to the established registrations projection.
alter function app_private.api_fanbus_registrations_list(jsonb)
  rename to api_fanbus_registrations_list_before_travel_groups_r1;

create function app_private.api_fanbus_registrations_list(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_base jsonb:=app_private.api_fanbus_registrations_list_before_travel_groups_r1(p_payload);
  v_items jsonb;
begin
  select coalesce(jsonb_agg(
    item.value||jsonb_strip_nulls(jsonb_build_object(
      'travelGroupId',travel_group.id,
      'travelGroupName',travel_group.name,
      'travelGroupBusPreference',travel_group.bus_preference,
      'travelGroupBusId',travel_group.bus_id,
      'travelGroupRevision',travel_group.revision,
      'travelGroupBookingCount',case when travel_group.id is null then null else (
        select count(*)::integer
        from app_modules.fanbus_bookings sibling_booking
        where sibling_booking.travel_group_id=travel_group.id
          and sibling_booking.merged_into_booking_id is null
          and exists (
            select 1 from app_modules.fanbus_registrations sibling_registration
            where sibling_registration.booking_id=sibling_booking.id
              and sibling_registration.status in ('ACTIVE','WAITLISTED')
          )
      ) end
    ))
    order by item.ordinality
  ),'[]'::jsonb)
  into v_items
  from jsonb_array_elements(coalesce(v_base->'registrations','[]'::jsonb))
    with ordinality item(value,ordinality)
  join app_modules.fanbus_registrations registration
    on registration.id=(item.value->>'id')::uuid
  join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
  left join app_modules.fanbus_travel_groups travel_group on travel_group.id=booking.travel_group_id;

  return jsonb_set(v_base,'{registrations}',v_items,true);
end;
$function$;

create function app_private.api_fanbus_travel_group_connect(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_booking_ids uuid[];
  v_booking_count integer;
  v_unique_count integer;
  v_found_count integer;
  v_trip_id uuid;
  v_trip_count integer;
  v_current_count integer;
  v_existing_group_count integer;
  v_group_id uuid;
  v_group app_modules.fanbus_travel_groups%rowtype;
  v_name text:=nullif(btrim(coalesce(p_payload->>'name','')),'');
  v_preference text:=upper(btrim(coalesce(p_payload->>'busPreference','')));
  v_bus_id uuid;
  v_booking record;
begin
  if jsonb_typeof(p_payload)<>'object'
    or jsonb_typeof(p_payload->'bookingIds')<>'array'
    or not p_payload?&array['bookingIds','name','busPreference','busId']
    or exists (
      select 1 from jsonb_object_keys(p_payload) key(name)
      where key.name<>all(array['bookingIds','name','busPreference','busId'])
    )
    or v_name is null or length(v_name)>120
    or v_preference not in ('EGAL','RUHIG','PARTY') then
    raise exception 'FANBUS_TRAVEL_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end if;

  begin
    select array_agg(value::uuid order by value),
      count(*)::integer,count(distinct value)::integer
    into v_booking_ids,v_booking_count,v_unique_count
    from jsonb_array_elements_text(p_payload->'bookingIds') entry(value);
    v_bus_id:=nullif(btrim(coalesce(p_payload->>'busId','')),'')::uuid;
  exception when others then
    raise exception 'FANBUS_TRAVEL_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end;

  if v_booking_count<2 or v_unique_count<>v_booking_count then
    raise exception 'FANBUS_TRAVEL_GROUP_NEEDS_MULTIPLE_BOOKINGS' using errcode='22023';
  end if;

  select count(*)::integer,count(distinct booking.trip_id)::integer,min(booking.trip_id::text)::uuid,
    count(*) filter(where exists (
      select 1 from app_modules.fanbus_registrations registration
      where registration.booking_id=booking.id
        and registration.status in ('ACTIVE','WAITLISTED')
    ))::integer
  into v_found_count,v_trip_count,v_trip_id,v_current_count
  from app_modules.fanbus_bookings booking
  where booking.id=any(v_booking_ids)
    and booking.merged_into_booking_id is null;

  if v_found_count<>v_booking_count or v_trip_count<>1 or v_current_count<>v_booking_count then
    raise exception 'FANBUS_TRAVEL_GROUP_BOOKINGS_INVALID' using errcode='22023';
  end if;

  perform app_private.m330_lock_mutable_fanbus_trip(v_trip_id);

  if v_bus_id is not null and not exists (
    select 1 from app_modules.fanbus_buses bus
    where bus.id=v_bus_id and bus.trip_id=v_trip_id and bus.is_active
  ) then
    raise exception 'FANBUS_ASSIGNMENT_BUS_UNAVAILABLE' using errcode='22023';
  end if;

  select count(distinct booking.travel_group_id)::integer,
    min(booking.travel_group_id::text)::uuid
  into v_existing_group_count,v_group_id
  from app_modules.fanbus_bookings booking
  where booking.id=any(v_booking_ids)
    and booking.travel_group_id is not null;

  if v_existing_group_count>1 then
    raise exception 'FANBUS_TRAVEL_GROUP_MULTIPLE_GROUPS_SELECTED' using errcode='22023';
  end if;

  if v_group_id is null then
    insert into app_modules.fanbus_travel_groups(
      trip_id,name,bus_preference,bus_id,created_by,updated_by
    ) values (
      v_trip_id,v_name,v_preference,v_bus_id,v_actor,v_actor
    )
    returning * into v_group;
    v_group_id:=v_group.id;
  else
    select * into v_group
    from app_modules.fanbus_travel_groups
    where id=v_group_id and trip_id=v_trip_id
    for update;
    if not found then
      raise exception 'FANBUS_TRAVEL_GROUP_NOT_FOUND' using errcode='P0002';
    end if;
    update app_modules.fanbus_travel_groups
    set name=v_name,bus_preference=v_preference,bus_id=v_bus_id,
      revision=revision+1,updated_by=v_actor
    where id=v_group_id
    returning * into v_group;
  end if;

  update app_modules.fanbus_bookings
  set travel_group_id=v_group_id
  where id=any(v_booking_ids);

  -- A travel group is the shared baseline for every booking linked to it.
  update app_modules.fanbus_bookings
  set group_bus_preference=v_preference,
      group_bus_id=v_bus_id,
      revision=revision+1,
      updated_by=v_actor
  where travel_group_id=v_group_id
    and merged_into_booking_id is null;

  update app_modules.fanbus_registrations registration
  set bus_preference=v_preference
  from app_modules.fanbus_bookings booking
  where booking.id=registration.booking_id
    and booking.travel_group_id=v_group_id
    and registration.status in ('ACTIVE','WAITLISTED')
    and not registration.bus_preference_override;

  -- Selecting a concrete travel-group bus is intentional and should move all
  -- non-overridden active members. "Automatic" keeps existing assignments.
  if v_bus_id is not null then
    for v_booking in
      select booking.id
      from app_modules.fanbus_bookings booking
      where booking.travel_group_id=v_group_id
        and booking.merged_into_booking_id is null
      order by booking.id
    loop
      perform app_private.fanbus_booking_apply_group_bus(
        v_booking.id,v_bus_id,v_actor,false
      );
    end loop;
  end if;

  perform app_private.log_audit(
    v_actor,'FANBUS_TRAVEL_GROUP_CONNECTED','fanbus_travel_group',v_group_id::text,
    null,
    jsonb_build_object(
      'name',v_name,'busPreference',v_preference,'busId',v_bus_id,
      'bookingIds',to_jsonb(v_booking_ids)
    ),
    jsonb_build_object(
      'tripId',v_trip_id,'travelGroupId',v_group_id,
      'bookingIds',to_jsonb(v_booking_ids),'scope','TRAVEL_GROUP'
    )
  );

  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId',v_trip_id)
  );
exception when invalid_text_representation then
  raise exception 'FANBUS_TRAVEL_GROUP_INVALID_PAYLOAD' using errcode='22023';
end;
$function$;

create function app_private.api_fanbus_travel_group_unlink(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_booking app_modules.fanbus_bookings%rowtype;
  v_group app_modules.fanbus_travel_groups%rowtype;
  v_booking_id uuid;
  v_remaining integer;
begin
  if jsonb_typeof(p_payload)<>'object'
    or not p_payload?'bookingId'
    or exists (
      select 1 from jsonb_object_keys(p_payload) key(name)
      where key.name<>'bookingId'
    ) then
    raise exception 'FANBUS_TRAVEL_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end if;

  begin
    v_booking_id:=(p_payload->>'bookingId')::uuid;
  exception when others then
    raise exception 'FANBUS_TRAVEL_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end;

  select * into v_booking
  from app_modules.fanbus_bookings
  where id=v_booking_id
  for update;

  if not found or v_booking.merged_into_booking_id is not null then
    raise exception 'FANBUS_BOOKING_NOT_ACTIVE' using errcode='22023';
  end if;
  if v_booking.travel_group_id is null then
    return app_private.api_fanbus_registrations_list(
      jsonb_build_object('tripId',v_booking.trip_id)
    );
  end if;

  perform app_private.m330_lock_mutable_fanbus_trip(v_booking.trip_id);

  select * into v_group
  from app_modules.fanbus_travel_groups
  where id=v_booking.travel_group_id
  for update;

  update app_modules.fanbus_bookings
  set travel_group_id=null,revision=revision+1,updated_by=v_actor
  where id=v_booking.id;

  select count(*)::integer into v_remaining
  from app_modules.fanbus_bookings booking
  where booking.travel_group_id=v_booking.travel_group_id
    and booking.merged_into_booking_id is null
    and exists (
      select 1 from app_modules.fanbus_registrations registration
      where registration.booking_id=booking.id
        and registration.status in ('ACTIVE','WAITLISTED')
    );

  -- A one-booking "travel group" has no operational meaning, dissolve it.
  if v_remaining<=1 then
    update app_modules.fanbus_bookings
    set travel_group_id=null,revision=revision+1,updated_by=v_actor
    where travel_group_id=v_booking.travel_group_id;
    delete from app_modules.fanbus_travel_groups
    where id=v_booking.travel_group_id;
  end if;

  perform app_private.log_audit(
    v_actor,'FANBUS_TRAVEL_GROUP_BOOKING_UNLINKED','fanbus_booking',v_booking.id::text,
    jsonb_build_object('travelGroupId',v_booking.travel_group_id),
    jsonb_build_object('travelGroupId',null),
    jsonb_build_object(
      'tripId',v_booking.trip_id,'bookingId',v_booking.id,
      'travelGroupId',v_booking.travel_group_id,'scope','TRAVEL_GROUP'
    )
  );

  return app_private.api_fanbus_registrations_list(
    jsonb_build_object('tripId',v_booking.trip_id)
  );
end;
$function$;

-- Include travel-group membership/rules in preview staleness detection.
alter function app_private.m320_r3_assignment_fingerprint(uuid)
  rename to m320_r3_assignment_fingerprint_before_travel_groups_r1;

create function app_private.m320_r3_assignment_fingerprint(p_trip_id uuid)
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        app_private.m320_r3_assignment_fingerprint_before_travel_groups_r1(p_trip_id)
        ||'|'||
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',travel_group.id,
            'name',travel_group.name,
            'busPreference',travel_group.bus_preference,
            'busId',travel_group.bus_id,
            'revision',travel_group.revision
          ) order by travel_group.id)::text
          from app_modules.fanbus_travel_groups travel_group
          where travel_group.trip_id=p_trip_id
        ),'[]')
        ||'|'||
        coalesce((
          select jsonb_agg(jsonb_build_object(
            'bookingId',booking.id,
            'travelGroupId',booking.travel_group_id,
            'revision',booking.revision
          ) order by booking.id)::text
          from app_modules.fanbus_bookings booking
          where booking.trip_id=p_trip_id
        ),'[]'),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$function$;

-- Keep separate bookings of one travel group together in automatic planning.
alter function app_private.m320_r3_assignment_plan(uuid)
  rename to m320_r3_assignment_plan_before_travel_groups_r1;

create function app_private.m320_r3_assignment_plan(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_plan jsonb:=app_private.m320_r3_assignment_plan_before_travel_groups_r1(p_trip_id);
  v_proposals jsonb:=coalesce(v_plan->'participantProposals','[]'::jsonb);
  v_conflicts jsonb:=coalesce(v_plan->'conflicts','[]'::jsonb);
  v_buses jsonb:=coalesce(v_plan->'buses','[]'::jsonb);
  v_group app_modules.fanbus_travel_groups%rowtype;
  v_open_count integer;
  v_existing_bus_count integer;
  v_existing_bus_id uuid;
  v_target_bus uuid;
  v_target_category text;
  v_failure_code text;
begin
  -- Enrich every proposal for UI grouping.
  select coalesce(jsonb_agg(
    proposal.value||jsonb_strip_nulls(jsonb_build_object(
      'travelGroupId',travel_group.id,
      'travelGroupName',travel_group.name
    ))
    order by proposal.ordinality
  ),'[]'::jsonb)
  into v_proposals
  from jsonb_array_elements(v_proposals) with ordinality proposal(value,ordinality)
  left join app_modules.fanbus_registrations registration
    on registration.id=(proposal.value->>'participantId')::uuid
  left join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
  left join app_modules.fanbus_travel_groups travel_group on travel_group.id=booking.travel_group_id;

  for v_group in
    select travel_group.*
    from app_modules.fanbus_travel_groups travel_group
    where travel_group.trip_id=p_trip_id
      and (
        select count(*)
        from app_modules.fanbus_bookings booking
        where booking.travel_group_id=travel_group.id
          and booking.merged_into_booking_id is null
      )>=2
    order by travel_group.id
  loop
    select count(*)::integer
    into v_open_count
    from app_modules.fanbus_registrations registration
    join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
    left join app_modules.fanbus_bus_assignments assignment
      on assignment.participant_id=registration.id
    where booking.travel_group_id=v_group.id
      and registration.status='ACTIVE'
      and not registration.bus_assignment_override
      and assignment.participant_id is null;

    if v_open_count=0 then
      continue;
    end if;

    select count(distinct assignment.bus_id)::integer,
      case when count(distinct assignment.bus_id)=1
        then min(assignment.bus_id::text)::uuid end
    into v_existing_bus_count,v_existing_bus_id
    from app_modules.fanbus_registrations registration
    join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
    join app_modules.fanbus_bus_assignments assignment
      on assignment.participant_id=registration.id
    where booking.travel_group_id=v_group.id
      and registration.status='ACTIVE'
      and not registration.bus_assignment_override;

    v_target_bus:=null;
    v_target_category:=null;
    v_failure_code:=null;

    if v_existing_bus_count>1 then
      v_failure_code:='TRAVEL_GROUP_ALREADY_SPLIT_FIXED';
    else
      if v_group.bus_id is not null then
        v_target_bus:=v_group.bus_id;
      elsif v_existing_bus_count=1 then
        v_target_bus:=v_existing_bus_id;
      else
        select bus.id,bus.category
        into v_target_bus,v_target_category
        from app_modules.fanbus_buses bus
        where bus.trip_id=p_trip_id
          and bus.is_active
          and coalesce((
            select (summary.value->>'freeAfter')::integer
            from jsonb_array_elements(v_buses) summary(value)
            where summary.value->>'busId'=bus.id::text
          ),0)+(
            select count(*)::integer
            from jsonb_array_elements(v_proposals) proposal(value)
            where proposal.value->>'assignmentState'='PROPOSED_AUTO'
              and proposal.value->>'travelGroupId'=v_group.id::text
              and proposal.value->>'proposedBusId'=bus.id::text
          )>=v_open_count
          and not exists (
            select 1
            from app_modules.fanbus_registrations member
            join app_modules.fanbus_bookings booking on booking.id=member.booking_id
            left join app_modules.fanbus_bus_assignments assignment
              on assignment.participant_id=member.id
            where booking.travel_group_id=v_group.id
              and member.status='ACTIVE'
              and not member.bus_assignment_override
              and assignment.participant_id is null
              and member.trip_boarding_stop_id is not null
              and not exists (
                select 1
                from app_modules.fanbus_bus_boarding_stops mapping
                where mapping.trip_id=p_trip_id
                  and mapping.bus_id=bus.id
                  and mapping.trip_boarding_stop_id=member.trip_boarding_stop_id
              )
          )
        order by
          app_private.m320_r3_preference_penalty(v_group.bus_preference,bus.category),
          (
            (
              select count(*)::integer
              from app_modules.fanbus_bus_assignments assignment
              join app_modules.fanbus_registrations participant
                on participant.id=assignment.participant_id
              where assignment.bus_id=bus.id and participant.status='ACTIVE'
            )+v_open_count
          )::numeric/nullif(bus.capacity,0)::numeric,
          lower(bus.label),bus.id
        limit 1;
      end if;

      if v_target_bus is not null then
        select bus.category into v_target_category
        from app_modules.fanbus_buses bus
        where bus.id=v_target_bus
          and bus.trip_id=p_trip_id
          and bus.is_active
          and coalesce((
            select (summary.value->>'freeAfter')::integer
            from jsonb_array_elements(v_buses) summary(value)
            where summary.value->>'busId'=bus.id::text
          ),0)+(
            select count(*)::integer
            from jsonb_array_elements(v_proposals) proposal(value)
            where proposal.value->>'assignmentState'='PROPOSED_AUTO'
              and proposal.value->>'travelGroupId'=v_group.id::text
              and proposal.value->>'proposedBusId'=bus.id::text
          )>=v_open_count
          and not exists (
            select 1
            from app_modules.fanbus_registrations member
            join app_modules.fanbus_bookings booking on booking.id=member.booking_id
            left join app_modules.fanbus_bus_assignments assignment
              on assignment.participant_id=member.id
            where booking.travel_group_id=v_group.id
              and member.status='ACTIVE'
              and not member.bus_assignment_override
              and assignment.participant_id is null
              and member.trip_boarding_stop_id is not null
              and not exists (
                select 1
                from app_modules.fanbus_bus_boarding_stops mapping
                where mapping.trip_id=p_trip_id
                  and mapping.bus_id=bus.id
                  and mapping.trip_boarding_stop_id=member.trip_boarding_stop_id
              )
          );
        if not found then
          v_target_bus:=null;
          v_target_category:=null;
        end if;
      end if;

      if v_target_bus is null then
        v_failure_code:='TRAVEL_GROUP_NO_COMMON_BUS';
      end if;
    end if;

    if v_failure_code is not null then
      select coalesce(jsonb_agg(
        case
          when proposal.value->>'assignmentState'='PROPOSED_AUTO'
            and exists (
              select 1
              from app_modules.fanbus_registrations registration
              join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
              where registration.id=(proposal.value->>'participantId')::uuid
                and booking.travel_group_id=v_group.id
                and not registration.bus_assignment_override
            )
          then jsonb_set(
            jsonb_set(
              jsonb_set(
                proposal.value,
                '{proposedBusId}','null'::jsonb,true
              ),
              '{bookingCohesion}',to_jsonb('TRAVEL_GROUP_CONFLICT'::text),true
            ),
            '{warnings}',
            coalesce(proposal.value->'warnings','[]'::jsonb)
              ||jsonb_build_array(v_failure_code),
            true
          )
          else proposal.value
        end
        order by proposal.ordinality
      ),'[]'::jsonb)
      into v_proposals
      from jsonb_array_elements(v_proposals) with ordinality proposal(value,ordinality);

      v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
        'severity','NON_BLOCKING',
        'code',v_failure_code,
        'travelGroupId',v_group.id,
        'travelGroupName',v_group.name
      ));
    else
      select coalesce(jsonb_agg(
        case
          when proposal.value->>'assignmentState'='PROPOSED_AUTO'
            and exists (
              select 1
              from app_modules.fanbus_registrations registration
              join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
              where registration.id=(proposal.value->>'participantId')::uuid
                and booking.travel_group_id=v_group.id
                and not registration.bus_assignment_override
            )
          then jsonb_set(
            jsonb_set(
              jsonb_set(
                proposal.value||jsonb_build_object(
                  'travelGroupId',v_group.id,
                  'travelGroupName',v_group.name
                ),
                '{proposedBusId}',to_jsonb(v_target_bus),true
              ),
              '{bookingCohesion}',to_jsonb('TRAVEL_GROUP_TOGETHER'::text),true
            ),
            '{explanations}',
            coalesce(proposal.value->'explanations','[]'::jsonb)
              ||jsonb_build_array('TRAVEL_GROUP_KEPT_TOGETHER'),
            true
          )
          else proposal.value
        end
        order by proposal.ordinality
      ),'[]'::jsonb)
      into v_proposals
      from jsonb_array_elements(v_proposals) with ordinality proposal(value,ordinality);
    end if;
  end loop;

  -- Recompute preview bus counters after travel-group harmonisation.
  select coalesce(jsonb_agg(
    bus.value||jsonb_build_object(
      'proposedNew',(
        select count(*)::integer
        from jsonb_array_elements(v_proposals) proposal(value)
        where proposal.value->>'assignmentState'='PROPOSED_AUTO'
          and nullif(proposal.value->>'proposedBusId','')=bus.value->>'busId'
      ),
      'afterApply',coalesce((bus.value->>'existingOccupancy')::integer,0)+(
        select count(*)::integer
        from jsonb_array_elements(v_proposals) proposal(value)
        where proposal.value->>'assignmentState'='PROPOSED_AUTO'
          and nullif(proposal.value->>'proposedBusId','')=bus.value->>'busId'
      ),
      'freeAfter',greatest(
        coalesce((bus.value->>'capacity')::integer,0)
        -coalesce((bus.value->>'existingOccupancy')::integer,0)
        -(
          select count(*)::integer
          from jsonb_array_elements(v_proposals) proposal(value)
          where proposal.value->>'assignmentState'='PROPOSED_AUTO'
            and nullif(proposal.value->>'proposedBusId','')=bus.value->>'busId'
        ),0
      )
    )
    order by bus.ordinality
  ),'[]'::jsonb)
  into v_buses
  from jsonb_array_elements(v_buses) with ordinality bus(value,ordinality);

  return jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(v_plan,'{participantProposals}',v_proposals,true),
        '{conflicts}',v_conflicts,true
      ),
      '{buses}',v_buses,true
    ),
    '{canApply}',
    to_jsonb(
      coalesce((v_plan->>'canApply')::boolean,false)
      and exists (
        select 1 from jsonb_array_elements(v_proposals) proposal(value)
        where proposal.value->>'assignmentState'='PROPOSED_AUTO'
          and nullif(proposal.value->>'proposedBusId','') is not null
      )
    ),
    true
  );
end;
$function$;

-- Applying a preview may not split non-overridden travel-group members.
alter function app_private.api_fanbus_assignment_apply(jsonb)
  rename to api_fanbus_assignment_apply_before_travel_groups_r1;

create function app_private.api_fanbus_assignment_apply(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_group record;
  v_distinct integer;
  v_fixed_bus uuid;
  v_final_count integer;
  v_nonnull_count integer;
begin
  for v_group in
    select distinct booking.travel_group_id
    from jsonb_array_elements(coalesce(p_payload->'finalAssignments','[]'::jsonb)) item(value)
    join app_modules.fanbus_registrations registration
      on registration.id=(item.value->>'participantId')::uuid
    join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
    where booking.travel_group_id is not null
      and not registration.bus_assignment_override
  loop
    select travel_group.bus_id into v_fixed_bus
    from app_modules.fanbus_travel_groups travel_group
    where travel_group.id=v_group.travel_group_id;

    select count(*)::integer,
      count(*) filter(where nullif(item.value->>'busId','') is not null)::integer
    into v_final_count,v_nonnull_count
    from jsonb_array_elements(coalesce(p_payload->'finalAssignments','[]'::jsonb)) item(value)
    join app_modules.fanbus_registrations registration
      on registration.id=(item.value->>'participantId')::uuid
    join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
    where booking.travel_group_id=v_group.travel_group_id
      and not registration.bus_assignment_override;

    if v_nonnull_count=0 then
      continue;
    end if;
    if v_nonnull_count<>v_final_count then
      raise exception 'FANBUS_TRAVEL_GROUP_SPLIT_REQUIRES_OVERRIDE' using errcode='22023';
    end if;

    select count(distinct candidate.bus_key)::integer
    into v_distinct
    from (
      select assignment.bus_id::text bus_key
      from app_modules.fanbus_registrations registration
      join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
      join app_modules.fanbus_bus_assignments assignment
        on assignment.participant_id=registration.id
      where booking.travel_group_id=v_group.travel_group_id
        and registration.status='ACTIVE'
        and not registration.bus_assignment_override
      union all
      select nullif(item.value->>'busId','') bus_key
      from jsonb_array_elements(coalesce(p_payload->'finalAssignments','[]'::jsonb)) item(value)
      join app_modules.fanbus_registrations registration
        on registration.id=(item.value->>'participantId')::uuid
      join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
      where booking.travel_group_id=v_group.travel_group_id
        and not registration.bus_assignment_override
    ) candidate;

    if v_distinct>1 or (
      v_fixed_bus is not null and exists (
        select 1
        from jsonb_array_elements(coalesce(p_payload->'finalAssignments','[]'::jsonb)) item(value)
        join app_modules.fanbus_registrations registration
          on registration.id=(item.value->>'participantId')::uuid
        join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
        where booking.travel_group_id=v_group.travel_group_id
          and not registration.bus_assignment_override
          and nullif(item.value->>'busId','')::uuid is distinct from v_fixed_bus
      )
    ) then
      raise exception 'FANBUS_TRAVEL_GROUP_SPLIT_REQUIRES_OVERRIDE' using errcode='22023';
    end if;
  end loop;

  return app_private.api_fanbus_assignment_apply_before_travel_groups_r1(p_payload);
exception when invalid_text_representation then
  raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_travel_groups_r1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
set search_path=''
as $function$
  select app_private.pd_api_current_actions_before_travel_groups_r1()
    ||array[
      'fanbus_travel_group_connect',
      'fanbus_travel_group_unlink'
    ]::text[]
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_travel_groups_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path=''
as $function$
  select case lower(btrim(coalesce(p_action,'')))
    when 'fanbus_travel_group_connect' then 'USER_MUTATION'
    when 'fanbus_travel_group_unlink' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_travel_groups_r1(p_action)
  end
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_travel_groups_r1;

create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_action text:=lower(btrim(coalesce(p_action,'')));
  v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
  case v_action
    when 'fanbus_travel_group_connect' then
      return app_private.api_fanbus_travel_group_connect(v_payload);
    when 'fanbus_travel_group_unlink' then
      return app_private.api_fanbus_travel_group_unlink(v_payload);
    else
      return app_private.pd_api_dispatch_current_before_travel_groups_r1(p_action,p_payload);
  end case;
end;
$function$;

revoke all on function
  app_private.api_fanbus_registrations_list_before_travel_groups_r1(jsonb),
  app_private.api_fanbus_registrations_list(jsonb),
  app_private.api_fanbus_travel_group_connect(jsonb),
  app_private.api_fanbus_travel_group_unlink(jsonb),
  app_private.m320_r3_assignment_fingerprint_before_travel_groups_r1(uuid),
  app_private.m320_r3_assignment_fingerprint(uuid),
  app_private.m320_r3_assignment_plan_before_travel_groups_r1(uuid),
  app_private.m320_r3_assignment_plan(uuid),
  app_private.api_fanbus_assignment_apply_before_travel_groups_r1(jsonb),
  app_private.api_fanbus_assignment_apply(jsonb),
  app_private.pd_api_current_actions_before_travel_groups_r1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_travel_groups_r1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_travel_groups_r1(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
from public,anon,authenticated,service_role;

grant execute on function
  app_private.api_fanbus_registrations_list_before_travel_groups_r1(jsonb),
  app_private.api_fanbus_registrations_list(jsonb),
  app_private.api_fanbus_travel_group_connect(jsonb),
  app_private.api_fanbus_travel_group_unlink(jsonb),
  app_private.m320_r3_assignment_fingerprint_before_travel_groups_r1(uuid),
  app_private.m320_r3_assignment_fingerprint(uuid),
  app_private.m320_r3_assignment_plan_before_travel_groups_r1(uuid),
  app_private.m320_r3_assignment_plan(uuid),
  app_private.api_fanbus_assignment_apply_before_travel_groups_r1(jsonb),
  app_private.api_fanbus_assignment_apply(jsonb),
  app_private.pd_api_current_actions_before_travel_groups_r1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_travel_groups_r1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_travel_groups_r1(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;

commit;
