-- Plaerrdeifl Digitalplattform V4
-- Fanbus: booking_id is the operational travel group.
-- DEV only. This migration is intentionally additive and preserves historic rows.

begin;

alter table app_modules.fanbus_bookings
  add column person_group_id uuid references app_modules.fanbus_person_groups(id) on delete set null,
  add column group_bus_preference text not null default 'EGAL',
  add column group_bus_id uuid,
  add column merged_into_booking_id uuid references app_modules.fanbus_bookings(id) on delete restrict,
  add column merged_at timestamptz,
  add column merged_by uuid references app_portal.users(id) on delete set null,
  add column split_from_booking_id uuid references app_modules.fanbus_bookings(id) on delete restrict,
  add column revision integer not null default 1,
  add column updated_at timestamptz not null default now(),
  add column updated_by uuid references app_portal.users(id) on delete set null,
  add constraint fanbus_bookings_group_bus_preference_check
    check (group_bus_preference in ('EGAL','RUHIG','PARTY')),
  add constraint fanbus_bookings_group_bus_trip_fk
    foreign key (group_bus_id,trip_id)
    references app_modules.fanbus_buses(id,trip_id) on delete restrict,
  add constraint fanbus_bookings_merge_state_check check (
    (merged_into_booking_id is null and merged_at is null and merged_by is null)
    or (merged_into_booking_id is not null and merged_at is not null)
  ),
  add constraint fanbus_bookings_not_merged_into_self_check
    check (merged_into_booking_id is null or merged_into_booking_id <> id);

alter table app_modules.fanbus_registrations
  add column bus_preference_override boolean not null default false,
  add column bus_assignment_override boolean not null default false;

create index fanbus_bookings_person_group_idx
  on app_modules.fanbus_bookings(person_group_id)
  where person_group_id is not null;
create index fanbus_bookings_merged_into_idx
  on app_modules.fanbus_bookings(merged_into_booking_id)
  where merged_into_booking_id is not null;
create index fanbus_bookings_split_from_idx
  on app_modules.fanbus_bookings(split_from_booking_id)
  where split_from_booking_id is not null;

create trigger fanbus_bookings_set_updated_at
before update on app_modules.fanbus_bookings
for each row execute function app_private.set_updated_at();

-- Derive a conservative group baseline. Existing differences are retained and
-- explicitly marked as overrides; no participant value is rewritten.
with baseline as (
  select booking.id,
    coalesce((
      select registration.bus_preference
      from app_modules.fanbus_registrations registration
      where registration.booking_id=booking.id
      order by
        case when registration.status in ('ACTIVE','WAITLISTED') then 0 else 1 end,
        case when registration.booking_role='PRIMARY' then 0 else 1 end,
        registration.participant_sequence,registration.id
      limit 1
    ),'EGAL') preference
  from app_modules.fanbus_bookings booking
)
update app_modules.fanbus_bookings booking
set group_bus_preference=baseline.preference
from baseline where baseline.id=booking.id;

update app_modules.fanbus_registrations registration
set bus_preference_override=true
from app_modules.fanbus_bookings booking
where booking.id=registration.booking_id
  and registration.status in ('ACTIVE','WAITLISTED')
  and registration.bus_preference is distinct from booking.group_bus_preference;

with baseline as (
  select booking.id,(
    select assignment.bus_id
    from app_modules.fanbus_registrations registration
    join app_modules.fanbus_bus_assignments assignment
      on assignment.participant_id=registration.id
    where registration.booking_id=booking.id
      and registration.status in ('ACTIVE','WAITLISTED')
    order by case when registration.booking_role='PRIMARY' then 0 else 1 end,
      registration.participant_sequence,registration.id
    limit 1
  ) bus_id
  from app_modules.fanbus_bookings booking
)
update app_modules.fanbus_bookings booking
set group_bus_id=baseline.bus_id
from baseline where baseline.id=booking.id and baseline.bus_id is not null;

update app_modules.fanbus_registrations registration
set bus_assignment_override=true
from app_modules.fanbus_bookings booking
where booking.id=registration.booking_id
  and registration.status in ('ACTIVE','WAITLISTED')
  and (select assignment.bus_id from app_modules.fanbus_bus_assignments assignment
       where assignment.participant_id=registration.id) is distinct from booking.group_bus_id
  and exists (
    select 1 from app_modules.fanbus_bus_assignments sibling_assignment
    join app_modules.fanbus_registrations sibling
      on sibling.id=sibling_assignment.participant_id
    where sibling.booking_id=booking.id
      and sibling.status in ('ACTIVE','WAITLISTED')
  );

create function app_private.fanbus_booking_current_participant_ids(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(jsonb_agg(registration.id order by registration.participant_sequence,registration.id),'[]'::jsonb)
  from app_modules.fanbus_registrations registration
  where registration.booking_id=p_booking_id
    and registration.status in ('ACTIVE','WAITLISTED')
$function$;

create function app_private.fanbus_booking_assert_bus_capacity(
  p_booking_id uuid,
  p_bus_id uuid,
  p_include_overrides boolean default false
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_booking app_modules.fanbus_bookings%rowtype;
  v_bus app_modules.fanbus_buses%rowtype;
  v_needed integer;
  v_other integer;
begin
  if p_bus_id is null then return; end if;
  select * into v_booking from app_modules.fanbus_bookings where id=p_booking_id;
  if not found then raise exception 'FANBUS_BOOKING_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_bus from app_modules.fanbus_buses where id=p_bus_id for update;
  if not found or not v_bus.is_active or v_bus.trip_id<>v_booking.trip_id then
    raise exception 'FANBUS_ASSIGNMENT_BUS_UNAVAILABLE' using errcode='22023';
  end if;

  select count(*)::integer into v_needed
  from app_modules.fanbus_registrations registration
  where registration.booking_id=p_booking_id and registration.status='ACTIVE'
    and (p_include_overrides or not registration.bus_assignment_override);
  select count(*)::integer into v_other
  from app_modules.fanbus_bus_assignments assignment
  join app_modules.fanbus_registrations registration on registration.id=assignment.participant_id
  where assignment.bus_id=p_bus_id and registration.status='ACTIVE'
    and (registration.booking_id<>p_booking_id
      or (registration.bus_assignment_override and not p_include_overrides));
  if v_other+v_needed>v_bus.capacity then
    raise exception 'FANBUS_GROUP_BUS_CAPACITY_CONFLICT' using errcode='P3204';
  end if;
  if exists (
    select 1 from app_modules.fanbus_registrations registration
    where registration.booking_id=p_booking_id and registration.status='ACTIVE'
      and (p_include_overrides or not registration.bus_assignment_override)
      and registration.trip_boarding_stop_id is not null
      and not exists (
        select 1 from app_modules.fanbus_bus_boarding_stops mapping
        where mapping.trip_id=v_booking.trip_id and mapping.bus_id=p_bus_id
          and mapping.trip_boarding_stop_id=registration.trip_boarding_stop_id
      )
  ) then
    raise exception 'FANBUS_GROUP_BUS_STOP_CONFLICT' using errcode='22023';
  end if;
end;
$function$;

create function app_private.fanbus_booking_apply_group_bus(
  p_booking_id uuid,
  p_bus_id uuid,
  p_actor uuid,
  p_align_overrides boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_booking app_modules.fanbus_bookings%rowtype;
  v_before jsonb;
  v_ids jsonb;
begin
  select * into v_booking from app_modules.fanbus_bookings where id=p_booking_id for update;
  if not found or v_booking.merged_into_booking_id is not null then
    raise exception 'FANBUS_BOOKING_NOT_ACTIVE' using errcode='22023';
  end if;
  perform app_private.fanbus_booking_assert_bus_capacity(p_booking_id,p_bus_id,p_align_overrides);
  select coalesce(jsonb_agg(jsonb_build_object(
    'participantId',registration.id,'busId',assignment.bus_id,
    'override',registration.bus_assignment_override
  ) order by registration.participant_sequence),'[]'::jsonb)
  into v_before
  from app_modules.fanbus_registrations registration
  left join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=registration.id
  where registration.booking_id=p_booking_id and registration.status in ('ACTIVE','WAITLISTED');

  delete from app_modules.fanbus_bus_assignments assignment
  using app_modules.fanbus_registrations registration
  where assignment.participant_id=registration.id
    and registration.booking_id=p_booking_id
    and registration.status in ('ACTIVE','WAITLISTED')
    and (p_align_overrides or not registration.bus_assignment_override)
    and (p_bus_id is null or registration.status<>'ACTIVE');

  if p_bus_id is not null then
    insert into app_modules.fanbus_bus_assignments(
      participant_id,trip_id,bus_id,assignment_source,created_by,updated_by
    )
    select registration.id,registration.trip_id,p_bus_id,'MANUAL',p_actor,p_actor
    from app_modules.fanbus_registrations registration
    where registration.booking_id=p_booking_id and registration.status='ACTIVE'
      and (p_align_overrides or not registration.bus_assignment_override)
    on conflict(participant_id) do update set
      bus_id=excluded.bus_id,assignment_source='MANUAL',revision=fanbus_bus_assignments.revision+1,
      updated_by=p_actor;
  else
    delete from app_modules.fanbus_bus_assignments assignment
    using app_modules.fanbus_registrations registration
    where assignment.participant_id=registration.id
      and registration.booking_id=p_booking_id
      and registration.status in ('ACTIVE','WAITLISTED')
      and (p_align_overrides or not registration.bus_assignment_override);
  end if;

  if p_align_overrides then
    update app_modules.fanbus_registrations set bus_assignment_override=false
    where booking_id=p_booking_id and status in ('ACTIVE','WAITLISTED');
  end if;
  update app_modules.fanbus_bookings set group_bus_id=p_bus_id,revision=revision+1,updated_by=p_actor
  where id=p_booking_id;
  v_ids:=app_private.fanbus_booking_current_participant_ids(p_booking_id);
  perform app_private.log_audit(
    p_actor,'FANBUS_BOOKING_GROUP_BUS_CHANGED','fanbus_booking',p_booking_id::text,
    jsonb_build_object('groupBusId',v_booking.group_bus_id,'participants',v_before),
    jsonb_build_object('groupBusId',p_bus_id,'participantIds',v_ids),
    jsonb_build_object('tripId',v_booking.trip_id,'bookingId',p_booking_id,
      'participantIds',v_ids,'scope','BOOKING','alignOverrides',p_align_overrides)
  );
  return v_ids;
end;
$function$;

alter function app_private.api_fanbus_registrations_list(jsonb)
  rename to api_fanbus_registrations_list_before_booking_groups;
create function app_private.api_fanbus_registrations_list(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_base jsonb:=app_private.api_fanbus_registrations_list_before_booking_groups(p_payload);
  v_items jsonb;
begin
  select coalesce(jsonb_agg(item.value||jsonb_build_object(
    'personGroupId',booking.person_group_id,
    'personGroupName',person_group.name,
    'groupBusPreference',booking.group_bus_preference,
    'groupBusId',booking.group_bus_id,
    'bookingRevision',booking.revision,
    'mergedIntoBookingId',booking.merged_into_booking_id,
    'splitFromBookingId',booking.split_from_booking_id,
    'busPreferenceOverride',registration.bus_preference_override,
    'busAssignmentOverride',registration.bus_assignment_override,
    'hasIndividualOverride',registration.bus_preference_override or registration.bus_assignment_override,
    'assignmentSource',assignment.assignment_source
  ) order by item.ordinality),'[]'::jsonb)
  into v_items
  from jsonb_array_elements(coalesce(v_base->'registrations','[]'::jsonb))
    with ordinality item(value,ordinality)
  join app_modules.fanbus_registrations registration
    on registration.id=(item.value->>'id')::uuid
  join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
  left join app_modules.fanbus_person_groups person_group on person_group.id=booking.person_group_id
  left join app_modules.fanbus_bus_assignments assignment on assignment.participant_id=registration.id;
  return jsonb_set(v_base,'{registrations}',v_items,true);
end;
$function$;

create function app_private.fanbus_registration_inherit_booking_rules()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_preference text; v_count integer;
begin
  select booking.group_bus_preference,
    (select count(*) from app_modules.fanbus_registrations existing where existing.booking_id=new.booking_id)
  into v_preference,v_count
  from app_modules.fanbus_bookings booking where booking.id=new.booking_id for update;
  if v_count=0 then
    update app_modules.fanbus_bookings set group_bus_preference=new.bus_preference
    where id=new.booking_id;
    new.bus_preference_override:=false;
  elsif not new.bus_preference_override then
    new.bus_preference:=v_preference;
  end if;
  return new;
end;
$function$;

create trigger fanbus_registration_inherit_booking_rules
before insert on app_modules.fanbus_registrations
for each row execute function app_private.fanbus_registration_inherit_booking_rules();

alter function app_private.api_fanbus_registration_create_manual_batches(jsonb)
  rename to api_fanbus_registration_create_manual_batches_before_booking_groups;
create function app_private.api_fanbus_registration_create_manual_batches(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_clean jsonb:='[]'::jsonb;
  v_result jsonb;
  v_input jsonb;
  v_saved jsonb;
  v_group_id uuid;
  v_booking_id uuid;
  v_preference text;
begin
  if jsonb_typeof(p_payload)<>'object' or jsonb_typeof(p_payload->'bookings')<>'array' then
    raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD' using errcode='22023';
  end if;
  for v_input in select value from jsonb_array_elements(p_payload->'bookings') loop
    if jsonb_typeof(v_input)<>'object' or not v_input?'participants'
      or exists(select 1 from jsonb_object_keys(v_input) key(name)
        where key.name<>all(array['participants','personGroupId'])) then
      raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD' using errcode='22023';
    end if;
    v_clean:=v_clean||jsonb_build_array(jsonb_build_object('participants',v_input->'participants'));
  end loop;
  v_result:=app_private.api_fanbus_registration_create_manual_batches_before_booking_groups(
    jsonb_set(p_payload,'{bookings}',v_clean,true)
  );

  for v_input,v_saved in
    select source_item.value,result_item.value
    from jsonb_array_elements(p_payload->'bookings') with ordinality source_item(value,n)
    join jsonb_array_elements(v_result->'bookings') with ordinality result_item(value,n) using(n)
  loop
    v_booking_id:=(v_saved->>'bookingId')::uuid;
    v_group_id:=nullif(v_input->>'personGroupId','')::uuid;
    if v_group_id is not null and not exists(
      select 1 from app_modules.fanbus_person_groups where id=v_group_id and is_active
    ) then raise exception 'FANBUS_PERSON_GROUP_NOT_FOUND' using errcode='P0002'; end if;
    v_preference:=upper(coalesce(v_input#>>'{participants,0,busPreference}','EGAL'));
    if v_preference not in ('EGAL','RUHIG','PARTY') then v_preference:='EGAL'; end if;
    update app_modules.fanbus_bookings set
      person_group_id=v_group_id,group_bus_preference=v_preference,
      revision=revision+1,updated_by=v_actor
    where id=v_booking_id;
    update app_modules.fanbus_registrations set
      bus_preference=v_preference,bus_preference_override=false
    where booking_id=v_booking_id and status in ('ACTIVE','WAITLISTED');
    if v_group_id is not null then
      perform app_private.log_audit(v_actor,'FANBUS_BOOKING_PERSON_GROUP_LINKED',
        'fanbus_booking',v_booking_id::text,null,jsonb_build_object('personGroupId',v_group_id),
        jsonb_build_object('tripId',p_payload->>'tripId','bookingId',v_booking_id,
          'personGroupId',v_group_id,'scope','BOOKING'));
    end if;
  end loop;
  return v_result;
exception when invalid_text_representation then
  raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD' using errcode='22023';
end;
$function$;

alter function app_private.api_fanbus_booking_operator_update(jsonb)
  rename to api_fanbus_booking_operator_update_before_booking_groups;
create function app_private.api_fanbus_booking_operator_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
begin
  if exists(
    select 1
    from jsonb_array_elements(coalesce(p_payload->'participants','[]'::jsonb)) item(value)
    join app_modules.fanbus_registrations registration
      on registration.id=(item.value->>'id')::uuid
    where upper(coalesce(item.value->>'busPreference',''))<>registration.bus_preference
  ) then
    raise exception 'FANBUS_GROUP_PREFERENCE_REQUIRES_GROUP_ACTION' using errcode='22023';
  end if;
  return app_private.api_fanbus_booking_operator_update_before_booking_groups(p_payload);
exception when invalid_text_representation then
  raise exception 'FANBUS_BOOKING_OPERATOR_UPDATE_INVALID_PAYLOAD' using errcode='22023';
end;
$function$;

create function app_private.api_fanbus_booking_group_candidates(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_booking app_modules.fanbus_bookings%rowtype;
  v_projection jsonb;
  v_members jsonb;
begin
  if jsonb_typeof(p_payload)<>'object' or not p_payload?'bookingId'
    or exists(select 1 from jsonb_object_keys(p_payload) key(name) where key.name<>'bookingId') then
    raise exception 'FANBUS_BOOKING_CANDIDATES_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select * into v_booking from app_modules.fanbus_bookings
  where id=(p_payload->>'bookingId')::uuid and merged_into_booking_id is null;
  if not found then raise exception 'FANBUS_BOOKING_NOT_FOUND' using errcode='P0002'; end if;
  if v_booking.person_group_id is null then
    return jsonb_build_object('bookingId',v_booking.id,'personGroupId',null,'members','[]'::jsonb);
  end if;
  v_projection:=app_private.fanbus_person_group_projection(v_booking.person_group_id,v_booking.trip_id);
  select coalesce(jsonb_agg(member.value||jsonb_build_object('booked',exists(
    select 1 from app_modules.fanbus_registrations registration
    where registration.booking_id=v_booking.id and registration.status in ('ACTIVE','WAITLISTED')
      and (
        (member.value->>'portalUserId' is not null and registration.portal_user_id=(member.value->>'portalUserId')::uuid)
        or (member.value->>'memberId' is not null and registration.member_id=(member.value->>'memberId')::uuid)
        or (member.value->>'regularRiderId' is not null and registration.regular_rider_id=(member.value->>'regularRiderId')::uuid)
      )
  )) order by (member.value->>'position')::integer),'[]'::jsonb)
  into v_members from jsonb_array_elements(v_projection->'members') member(value);
  return jsonb_build_object('bookingId',v_booking.id,'personGroupId',v_booking.person_group_id,
    'personGroupName',v_projection->>'name','members',v_members);
exception when invalid_text_representation then
  raise exception 'FANBUS_BOOKING_CANDIDATES_INVALID_PAYLOAD' using errcode='22023';
end;
$function$;

create function app_private.api_fanbus_booking_operator_append(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_booking app_modules.fanbus_bookings%rowtype;
  v_trip app_modules.fanbus_trips%rowtype;
  v_person jsonb:=p_payload->'participant';
  v_resolved jsonb;
  v_portal uuid;
  v_member uuid;
  v_rider uuid;
  v_first text;
  v_last text;
  v_email text;
  v_stop uuid;
  v_note text;
  v_status text;
  v_waitlisted_at timestamptz;
  v_sequence integer;
  v_registration_id uuid;
  v_active integer;
  v_capacity integer;
  v_bus app_modules.fanbus_buses%rowtype;
begin
  if jsonb_typeof(p_payload)<>'object' or not p_payload?&array['bookingId','participant']
    or exists(select 1 from jsonb_object_keys(p_payload) key(name)
      where key.name<>all(array['bookingId','participant']))
    or jsonb_typeof(v_person)<>'object'
    or exists(select 1 from jsonb_object_keys(v_person) key(name) where key.name<>all(array[
      'portalUserId','memberId','regularRiderId','firstName','lastName','email',
      'tripBoardingStopId','operationalNote'
    ])) then raise exception 'FANBUS_BOOKING_APPEND_INVALID_PAYLOAD' using errcode='22023'; end if;
  begin
    select * into v_booking from app_modules.fanbus_bookings
      where id=(p_payload->>'bookingId')::uuid for update;
    v_portal:=nullif(v_person->>'portalUserId','')::uuid;
    v_member:=nullif(v_person->>'memberId','')::uuid;
    v_rider:=nullif(v_person->>'regularRiderId','')::uuid;
    v_stop:=nullif(v_person->>'tripBoardingStopId','')::uuid;
  exception when others then
    raise exception 'FANBUS_BOOKING_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end;
  if not found or v_booking.merged_into_booking_id is not null then
    raise exception 'FANBUS_BOOKING_NOT_ACTIVE' using errcode='22023';
  end if;
  perform app_private.m330_lock_mutable_fanbus_trip(v_booking.trip_id);
  select * into v_trip from app_modules.fanbus_trips where id=v_booking.trip_id;

  if num_nonnulls(v_portal,v_member,v_rider)>1 then
    raise exception 'FANBUS_BOOKING_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end if;
  if num_nonnulls(v_portal,v_member,v_rider)=1 then
    v_resolved:=app_private.fanbus_effective_person(v_portal,v_member,v_rider);
    if coalesce((v_resolved->>'available')::boolean,false) is not true then
      raise exception 'FANBUS_BOOKING_APPEND_PERSON_UNAVAILABLE' using errcode='22023';
    end if;
    v_portal:=nullif(v_resolved->>'portalUserId','')::uuid;
    v_member:=nullif(v_resolved->>'memberId','')::uuid;
    v_rider:=nullif(v_resolved->>'regularRiderId','')::uuid;
    v_first:=v_resolved->>'firstName'; v_last:=v_resolved->>'lastName';
    v_email:=nullif(v_resolved->>'email','');
  else
    v_first:=btrim(coalesce(v_person->>'firstName',''));
    v_last:=btrim(coalesce(v_person->>'lastName',''));
    v_email:=nullif(lower(btrim(coalesce(v_person->>'email',''))),'');
  end if;
  v_note:=nullif(btrim(coalesce(v_person->>'operationalNote','')),'');
  if length(v_first) not between 1 and 160 or length(v_last) not between 1 and 160
    or (v_note is not null and length(v_note)>240) then
    raise exception 'FANBUS_BOOKING_APPEND_INVALID_PAYLOAD' using errcode='22023';
  end if;
  if v_stop is not null and not exists(select 1 from app_modules.fanbus_trip_boarding_stops
    where id=v_stop and trip_id=v_booking.trip_id and is_active) then
    raise exception 'FANBUS_BOOKING_APPEND_INVALID_STOP' using errcode='22023';
  end if;

  select count(*)::integer into v_active from app_modules.fanbus_registrations
  where trip_id=v_booking.trip_id and status='ACTIVE';
  v_capacity:=app_private.fanbus_effective_capacity(v_booking.trip_id);
  if exists(select 1 from app_modules.fanbus_registrations
      where booking_id=v_booking.id and status='WAITLISTED') or v_active>=v_capacity then
    v_status:='WAITLISTED'; v_waitlisted_at:=clock_timestamp();
  else v_status:='ACTIVE'; v_waitlisted_at:=null; end if;
  select coalesce(max(participant_sequence),0)+1 into v_sequence
  from app_modules.fanbus_registrations where booking_id=v_booking.id;

  if v_status='ACTIVE' and v_booking.group_bus_id is not null then
    select * into v_bus from app_modules.fanbus_buses where id=v_booking.group_bus_id;
    if v_stop is not null and not exists(select 1 from app_modules.fanbus_bus_boarding_stops mapping
      where mapping.trip_id=v_booking.trip_id and mapping.bus_id=v_booking.group_bus_id
        and mapping.trip_boarding_stop_id=v_stop) then
      raise exception 'FANBUS_GROUP_BUS_STOP_CONFLICT' using errcode='22023';
    end if;
  end if;

  insert into app_modules.fanbus_registrations(
    trip_id,booking_id,booking_role,participant_sequence,portal_user_id,member_id,regular_rider_id,
    first_name,last_name,email,bus_preference,bus_preference_override,bus_assignment_override,
    source,status,waitlisted_at,trip_boarding_stop_id,operational_note,
    privacy_reference,terms_reference,privacy_accepted_at,terms_accepted_at,
    registered_at,created_by,updated_by
  ) values (
    v_booking.trip_id,v_booking.id,'COMPANION',v_sequence,v_portal,v_member,v_rider,
    v_first,v_last,v_email,v_booking.group_bus_preference,false,false,
    'MANUAL',v_status,v_waitlisted_at,v_stop,v_note,
    v_trip.privacy_reference,v_trip.terms_reference,clock_timestamp(),clock_timestamp(),
    clock_timestamp(),v_actor,v_actor
  ) returning id into v_registration_id;
  if v_status='ACTIVE' and v_booking.group_bus_id is not null then
    perform app_private.fanbus_booking_assert_bus_capacity(v_booking.id,v_booking.group_bus_id,false);
    insert into app_modules.fanbus_bus_assignments(
      participant_id,trip_id,bus_id,assignment_source,created_by,updated_by
    ) values(v_registration_id,v_booking.trip_id,v_booking.group_bus_id,'MANUAL',v_actor,v_actor);
  end if;
  update app_modules.fanbus_bookings set revision=revision+1,updated_by=v_actor where id=v_booking.id;
  perform app_private.log_audit(v_actor,'FANBUS_BOOKING_PARTICIPANT_ADDED','fanbus_booking',v_booking.id::text,
    null,jsonb_build_object('participantId',v_registration_id,'status',v_status),
    jsonb_build_object('tripId',v_booking.trip_id,'bookingId',v_booking.id,
      'participantIds',jsonb_build_array(v_registration_id),'scope','BOOKING'));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_booking.trip_id));
end;
$function$;

create function app_private.api_fanbus_booking_group_rules_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_booking app_modules.fanbus_bookings%rowtype;
  v_preference text:=upper(btrim(coalesce(p_payload->>'busPreference','')));
  v_bus_id uuid;
  v_align boolean:=coalesce((p_payload->>'alignOverrides')::boolean,false);
  v_before jsonb;
  v_ids jsonb;
begin
  if jsonb_typeof(p_payload)<>'object' or not p_payload?&array['bookingId','busPreference','busId']
    or exists(select 1 from jsonb_object_keys(p_payload) key(name)
      where key.name<>all(array['bookingId','busPreference','busId','alignOverrides']))
    or v_preference not in ('EGAL','RUHIG','PARTY') then
    raise exception 'FANBUS_BOOKING_GROUP_RULES_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin
    select * into v_booking from app_modules.fanbus_bookings where id=(p_payload->>'bookingId')::uuid for update;
    v_bus_id:=nullif(btrim(coalesce(p_payload->>'busId','')),'')::uuid;
  exception when others then
    raise exception 'FANBUS_BOOKING_GROUP_RULES_INVALID_PAYLOAD' using errcode='22023';
  end;
  if not found or v_booking.merged_into_booking_id is not null then
    raise exception 'FANBUS_BOOKING_NOT_ACTIVE' using errcode='22023';
  end if;
  perform app_private.m330_lock_mutable_fanbus_trip(v_booking.trip_id);
  v_before:=jsonb_build_object('busPreference',v_booking.group_bus_preference,'busId',v_booking.group_bus_id);
  update app_modules.fanbus_registrations set
    bus_preference=v_preference,
    bus_preference_override=case when v_align then false else bus_preference_override end
  where booking_id=v_booking.id and status in ('ACTIVE','WAITLISTED')
    and (v_align or not bus_preference_override);
  update app_modules.fanbus_bookings set group_bus_preference=v_preference,revision=revision+1,updated_by=v_actor
    where id=v_booking.id;
  perform app_private.fanbus_booking_apply_group_bus(v_booking.id,v_bus_id,v_actor,v_align);
  v_ids:=app_private.fanbus_booking_current_participant_ids(v_booking.id);
  perform app_private.log_audit(v_actor,'FANBUS_BOOKING_GROUP_PREFERENCE_CHANGED','fanbus_booking',v_booking.id::text,
    v_before,jsonb_build_object('busPreference',v_preference,'busId',v_bus_id),
    jsonb_build_object('tripId',v_booking.trip_id,'bookingId',v_booking.id,
      'participantIds',v_ids,'scope','BOOKING','alignOverrides',v_align));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_booking.trip_id));
end;
$function$;

create function app_private.api_fanbus_booking_participant_override_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_registration app_modules.fanbus_registrations%rowtype;
  v_booking app_modules.fanbus_bookings%rowtype;
  v_preference text;
  v_bus_id uuid;
  v_old_bus uuid;
  v_occupancy integer;
  v_bus app_modules.fanbus_buses%rowtype;
  v_before jsonb;
begin
  if jsonb_typeof(p_payload)<>'object' or not p_payload?'participantId'
    or not (p_payload?'busPreference' or p_payload?'busId')
    or exists(select 1 from jsonb_object_keys(p_payload) key(name)
      where key.name<>all(array['participantId','busPreference','busId'])) then
    raise exception 'FANBUS_PARTICIPANT_OVERRIDE_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin
    select * into v_registration from app_modules.fanbus_registrations
      where id=(p_payload->>'participantId')::uuid for update;
    if p_payload?'busId' then v_bus_id:=nullif(btrim(coalesce(p_payload->>'busId','')),'')::uuid; end if;
  exception when others then
    raise exception 'FANBUS_PARTICIPANT_OVERRIDE_INVALID_PAYLOAD' using errcode='22023';
  end;
  if not found or v_registration.status not in ('ACTIVE','WAITLISTED') then
    raise exception 'FANBUS_PARTICIPANT_NOT_EDITABLE' using errcode='22023';
  end if;
  select * into v_booking from app_modules.fanbus_bookings where id=v_registration.booking_id for update;
  perform app_private.m330_lock_mutable_fanbus_trip(v_registration.trip_id);
  select bus_id into v_old_bus from app_modules.fanbus_bus_assignments where participant_id=v_registration.id;
  v_before:=jsonb_build_object('busPreference',v_registration.bus_preference,'busId',v_old_bus,
    'busPreferenceOverride',v_registration.bus_preference_override,
    'busAssignmentOverride',v_registration.bus_assignment_override);
  if p_payload?'busPreference' then
    v_preference:=upper(btrim(coalesce(p_payload->>'busPreference','')));
    if v_preference not in ('EGAL','RUHIG','PARTY') then
      raise exception 'FANBUS_PARTICIPANT_OVERRIDE_INVALID_PAYLOAD' using errcode='22023';
    end if;
    update app_modules.fanbus_registrations set bus_preference=v_preference,bus_preference_override=true
    where id=v_registration.id;
  end if;
  if p_payload?'busId' then
    if v_bus_id is null then
      delete from app_modules.fanbus_bus_assignments where participant_id=v_registration.id;
    else
      if v_registration.status<>'ACTIVE' then
        raise exception 'FANBUS_ASSIGNMENT_REQUIRES_ACTIVE_PARTICIPANT' using errcode='22023';
      end if;
      select * into v_bus from app_modules.fanbus_buses where id=v_bus_id for update;
      if not found or not v_bus.is_active or v_bus.trip_id<>v_registration.trip_id then
        raise exception 'FANBUS_ASSIGNMENT_BUS_UNAVAILABLE' using errcode='22023';
      end if;
      select count(*)::integer into v_occupancy from app_modules.fanbus_bus_assignments assignment
      join app_modules.fanbus_registrations registration on registration.id=assignment.participant_id
      where assignment.bus_id=v_bus_id and registration.status='ACTIVE'
        and registration.id<>v_registration.id;
      if v_occupancy>=v_bus.capacity then
        raise exception 'FANBUS_BUS_CAPACITY_EXHAUSTED' using errcode='P3204';
      end if;
      if v_registration.trip_boarding_stop_id is not null and not exists(
        select 1 from app_modules.fanbus_bus_boarding_stops mapping
        where mapping.trip_id=v_registration.trip_id and mapping.bus_id=v_bus_id
          and mapping.trip_boarding_stop_id=v_registration.trip_boarding_stop_id
      ) then raise exception 'FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP' using errcode='22023'; end if;
      insert into app_modules.fanbus_bus_assignments(
        participant_id,trip_id,bus_id,assignment_source,created_by,updated_by
      ) values(v_registration.id,v_registration.trip_id,v_bus_id,'MANUAL',v_actor,v_actor)
      on conflict(participant_id) do update set bus_id=excluded.bus_id,assignment_source='MANUAL',
        revision=fanbus_bus_assignments.revision+1,updated_by=v_actor;
    end if;
    update app_modules.fanbus_registrations set bus_assignment_override=true where id=v_registration.id;
  end if;
  perform app_private.log_audit(v_actor,'FANBUS_BOOKING_PARTICIPANT_OVERRIDE_SET',
    'fanbus_registration',v_registration.id::text,v_before,
    jsonb_build_object('busPreference',case when p_payload?'busPreference' then v_preference else v_registration.bus_preference end,
      'busId',case when p_payload?'busId' then v_bus_id else v_old_bus end),
    jsonb_build_object('tripId',v_registration.trip_id,'bookingId',v_registration.booking_id,
      'participantIds',jsonb_build_array(v_registration.id),'scope','PARTICIPANT_OVERRIDE'));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_registration.trip_id));
end;
$function$;

create function app_private.api_fanbus_booking_participant_override_clear(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_registration app_modules.fanbus_registrations%rowtype;
  v_booking app_modules.fanbus_bookings%rowtype;
  v_kind text:=upper(btrim(coalesce(p_payload->>'kind','ALL')));
  v_old jsonb;
begin
  if jsonb_typeof(p_payload)<>'object' or not p_payload?'participantId'
    or exists(select 1 from jsonb_object_keys(p_payload) key(name)
      where key.name<>all(array['participantId','kind']))
    or v_kind not in ('ALL','PREFERENCE','BUS') then
    raise exception 'FANBUS_PARTICIPANT_OVERRIDE_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin
    select * into v_registration from app_modules.fanbus_registrations
      where id=(p_payload->>'participantId')::uuid for update;
  exception when others then
    raise exception 'FANBUS_PARTICIPANT_OVERRIDE_INVALID_PAYLOAD' using errcode='22023';
  end;
  if not found or v_registration.status not in ('ACTIVE','WAITLISTED') then
    raise exception 'FANBUS_PARTICIPANT_NOT_EDITABLE' using errcode='22023';
  end if;
  select * into v_booking from app_modules.fanbus_bookings where id=v_registration.booking_id for update;
  v_old:=jsonb_build_object('busPreference',v_registration.bus_preference,
    'busPreferenceOverride',v_registration.bus_preference_override,
    'busAssignmentOverride',v_registration.bus_assignment_override);
  if v_kind in ('ALL','PREFERENCE') then
    update app_modules.fanbus_registrations set
      bus_preference=v_booking.group_bus_preference,bus_preference_override=false
    where id=v_registration.id;
  end if;
  if v_kind in ('ALL','BUS') then
    update app_modules.fanbus_registrations set bus_assignment_override=false where id=v_registration.id;
    if v_registration.status='ACTIVE' and v_booking.group_bus_id is not null then
      perform app_private.fanbus_booking_assert_bus_capacity(v_booking.id,v_booking.group_bus_id,false);
      insert into app_modules.fanbus_bus_assignments(
        participant_id,trip_id,bus_id,assignment_source,created_by,updated_by
      ) values(v_registration.id,v_registration.trip_id,v_booking.group_bus_id,'MANUAL',v_actor,v_actor)
      on conflict(participant_id) do update set bus_id=excluded.bus_id,assignment_source='MANUAL',
        revision=fanbus_bus_assignments.revision+1,updated_by=v_actor;
    else delete from app_modules.fanbus_bus_assignments where participant_id=v_registration.id; end if;
  end if;
  perform app_private.log_audit(v_actor,'FANBUS_BOOKING_PARTICIPANT_OVERRIDE_CLEARED',
    'fanbus_registration',v_registration.id::text,v_old,
    jsonb_build_object('busPreference',v_booking.group_bus_preference,'busId',v_booking.group_bus_id),
    jsonb_build_object('tripId',v_registration.trip_id,'bookingId',v_registration.booking_id,
      'participantIds',jsonb_build_array(v_registration.id),'scope','PARTICIPANT_OVERRIDE','kind',v_kind));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_registration.trip_id));
end;
$function$;

create function app_private.api_fanbus_bookings_merge(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_target app_modules.fanbus_bookings%rowtype;
  v_source_id uuid;
  v_source_ids uuid[];
  v_all_ids uuid[];
  v_preference text:=upper(btrim(coalesce(p_payload->>'busPreference','')));
  v_bus_id uuid;
  v_override_mode text:=upper(btrim(coalesce(p_payload->>'overrideMode','KEEP')));
  v_before jsonb;
  v_source_numbers jsonb;
  v_primary uuid;
  v_sequence integer:=0;
  v_participant record;
begin
  if jsonb_typeof(p_payload)<>'object' or not p_payload?&array[
      'targetBookingId','sourceBookingIds','busPreference','busId','overrideMode']
    or exists(select 1 from jsonb_object_keys(p_payload) key(name) where key.name<>all(array[
      'targetBookingId','sourceBookingIds','busPreference','busId','overrideMode']))
    or jsonb_typeof(p_payload->'sourceBookingIds')<>'array'
    or jsonb_array_length(p_payload->'sourceBookingIds')<1
    or v_preference not in ('EGAL','RUHIG','PARTY')
    or v_override_mode not in ('KEEP','ALIGN') then
    raise exception 'FANBUS_BOOKING_MERGE_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin
    select * into v_target from app_modules.fanbus_bookings
      where id=(p_payload->>'targetBookingId')::uuid for update;
    v_bus_id:=nullif(btrim(coalesce(p_payload->>'busId','')),'')::uuid;
    select array_agg((item.value#>>'{}')::uuid order by item.ordinality)
      into v_source_ids from jsonb_array_elements(p_payload->'sourceBookingIds')
      with ordinality item(value,ordinality);
  exception when others then
    raise exception 'FANBUS_BOOKING_MERGE_INVALID_PAYLOAD' using errcode='22023';
  end;
  if not found or v_target.merged_into_booking_id is not null
    or v_target.id=any(v_source_ids) or cardinality(v_source_ids)<>cardinality(array(select distinct unnest(v_source_ids))) then
    raise exception 'FANBUS_BOOKING_MERGE_INVALID_PAYLOAD' using errcode='22023';
  end if;
  v_all_ids:=array_prepend(v_target.id,v_source_ids);
  perform app_private.m330_lock_mutable_fanbus_trip(v_target.trip_id);
  if (select count(*) from app_modules.fanbus_bookings booking
      where booking.id=any(v_all_ids) and booking.trip_id=v_target.trip_id
        and booking.merged_into_booking_id is null)<>cardinality(v_all_ids) then
    raise exception 'FANBUS_BOOKING_MERGE_TRIP_CONFLICT' using errcode='22023';
  end if;
  perform 1 from app_modules.fanbus_bookings where id=any(v_all_ids) order by id for update;
  select jsonb_agg(jsonb_build_object('bookingId',booking.id,'bookingNumber',booking.booking_number,
    'participantIds',app_private.fanbus_booking_current_participant_ids(booking.id)) order by booking.booking_number),
    jsonb_agg(booking.booking_number order by booking.booking_number)
  into v_before,v_source_numbers
  from app_modules.fanbus_bookings booking where booking.id=any(v_all_ids);

  update app_modules.fanbus_registrations set booking_role='COMPANION'
  where booking_id=any(v_source_ids) and booking_role='PRIMARY';
  update app_modules.fanbus_registrations set participant_sequence=participant_sequence+1000000
  where booking_id=any(v_source_ids);
  update app_modules.fanbus_registrations set booking_id=v_target.id
  where booking_id=any(v_source_ids);
  select id into v_primary from app_modules.fanbus_registrations
  where booking_id=v_target.id and booking_role='PRIMARY'
  order by participant_sequence,id limit 1;
  if v_primary is null then
    select id into v_primary from app_modules.fanbus_registrations where booking_id=v_target.id
    order by case when status in ('ACTIVE','WAITLISTED') then 0 else 1 end,participant_sequence,id limit 1;
    update app_modules.fanbus_registrations set booking_role='PRIMARY' where id=v_primary;
  end if;
  for v_participant in select id from app_modules.fanbus_registrations
    where booking_id=v_target.id order by case when id=v_primary then 0 else 1 end,participant_sequence,id
  loop
    v_sequence:=v_sequence+1;
    update app_modules.fanbus_registrations set participant_sequence=v_sequence,
      booking_role=case when id=v_primary then 'PRIMARY' else 'COMPANION' end
    where id=v_participant.id;
  end loop;
  update app_modules.fanbus_bookings set merged_into_booking_id=v_target.id,
    merged_at=clock_timestamp(),merged_by=v_actor,revision=revision+1,updated_by=v_actor
  where id=any(v_source_ids);
  update app_modules.fanbus_bookings set group_bus_preference=v_preference,
    revision=revision+1,updated_by=v_actor where id=v_target.id;
  update app_modules.fanbus_registrations set bus_preference=v_preference,
    bus_preference_override=case when v_override_mode='ALIGN' then false else bus_preference_override end
  where booking_id=v_target.id and status in ('ACTIVE','WAITLISTED')
    and (v_override_mode='ALIGN' or not bus_preference_override);
  perform app_private.fanbus_booking_apply_group_bus(v_target.id,v_bus_id,v_actor,v_override_mode='ALIGN');
  perform app_private.log_audit(v_actor,'FANBUS_BOOKINGS_MERGED','fanbus_booking',v_target.id::text,
    v_before,jsonb_build_object('targetBookingId',v_target.id,'participantIds',
      app_private.fanbus_booking_current_participant_ids(v_target.id)),
    jsonb_build_object('tripId',v_target.trip_id,'bookingId',v_target.id,
      'sourceBookingIds',to_jsonb(v_source_ids),'sourceBookingNumbers',v_source_numbers,
      'targetBookingId',v_target.id,'targetBookingNumber',v_target.booking_number,
      'participantIds',app_private.fanbus_booking_current_participant_ids(v_target.id),
      'scope','BOOKING_MERGE','overrideMode',v_override_mode));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_target.trip_id));
end;
$function$;

create function app_private.api_fanbus_booking_split(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_source app_modules.fanbus_bookings%rowtype;
  v_ids uuid[];
  v_new_id uuid;
  v_new_number text;
  v_source_primary uuid;
  v_new_primary uuid;
  v_sequence integer;
  v_row record;
begin
  if jsonb_typeof(p_payload)<>'object' or not p_payload?&array['bookingId','participantIds']
    or exists(select 1 from jsonb_object_keys(p_payload) key(name)
      where key.name<>all(array['bookingId','participantIds']))
    or jsonb_typeof(p_payload->'participantIds')<>'array' or jsonb_array_length(p_payload->'participantIds')<1 then
    raise exception 'FANBUS_BOOKING_SPLIT_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin
    select * into v_source from app_modules.fanbus_bookings where id=(p_payload->>'bookingId')::uuid for update;
    select array_agg((item.value#>>'{}')::uuid order by item.ordinality) into v_ids
    from jsonb_array_elements(p_payload->'participantIds') with ordinality item(value,ordinality);
  exception when others then
    raise exception 'FANBUS_BOOKING_SPLIT_INVALID_PAYLOAD' using errcode='22023';
  end;
  if not found or v_source.merged_into_booking_id is not null
    or cardinality(v_ids)<>cardinality(array(select distinct unnest(v_ids)))
    or (select count(*) from app_modules.fanbus_registrations where booking_id=v_source.id
      and status in ('ACTIVE','WAITLISTED') and id=any(v_ids))<>cardinality(v_ids)
    or (select count(*) from app_modules.fanbus_registrations where booking_id=v_source.id
      and status in ('ACTIVE','WAITLISTED'))<=cardinality(v_ids) then
    raise exception 'FANBUS_BOOKING_SPLIT_INVALID_SELECTION' using errcode='22023';
  end if;
  perform app_private.m330_lock_mutable_fanbus_trip(v_source.trip_id);
  insert into app_modules.fanbus_bookings(
    trip_id,source,group_bus_preference,group_bus_id,split_from_booking_id,created_by,updated_by
  ) values(v_source.trip_id,v_source.source,v_source.group_bus_preference,v_source.group_bus_id,
    v_source.id,v_actor,v_actor) returning id,booking_number into v_new_id,v_new_number;
  select id into v_new_primary from app_modules.fanbus_registrations
  where booking_id=v_source.id and id=any(v_ids)
  order by case when booking_role='PRIMARY' then 0 else 1 end,participant_sequence,id limit 1;
  update app_modules.fanbus_registrations set participant_sequence=participant_sequence+2000000,
    booking_role='COMPANION' where booking_id=v_source.id and id=any(v_ids);
  update app_modules.fanbus_registrations set booking_id=v_new_id where id=any(v_ids);
  update app_modules.fanbus_registrations set booking_role='PRIMARY' where id=v_new_primary;
  select id into v_source_primary from app_modules.fanbus_registrations
  where booking_id=v_source.id and booking_role='PRIMARY' limit 1;
  if v_source_primary is null then
    select id into v_source_primary from app_modules.fanbus_registrations where booking_id=v_source.id
      order by case when status in ('ACTIVE','WAITLISTED') then 0 else 1 end,participant_sequence,id limit 1;
    update app_modules.fanbus_registrations set booking_role='PRIMARY' where id=v_source_primary;
  end if;
  v_sequence:=0;
  for v_row in select id from app_modules.fanbus_registrations where booking_id=v_source.id
    order by case when id=v_source_primary then 0 else 1 end,participant_sequence,id
  loop v_sequence:=v_sequence+1; update app_modules.fanbus_registrations set participant_sequence=v_sequence where id=v_row.id; end loop;
  v_sequence:=0;
  for v_row in select id from app_modules.fanbus_registrations where booking_id=v_new_id
    order by case when id=v_new_primary then 0 else 1 end,participant_sequence,id
  loop v_sequence:=v_sequence+1; update app_modules.fanbus_registrations set participant_sequence=v_sequence where id=v_row.id; end loop;
  update app_modules.fanbus_bookings set revision=revision+1,updated_by=v_actor where id=v_source.id;
  perform app_private.log_audit(v_actor,'FANBUS_BOOKING_SPLIT','fanbus_booking',v_source.id::text,
    jsonb_build_object('sourceBookingId',v_source.id,'sourceBookingNumber',v_source.booking_number),
    jsonb_build_object('newBookingId',v_new_id,'newBookingNumber',v_new_number),
    jsonb_build_object('tripId',v_source.trip_id,'bookingId',v_source.id,
      'sourceBookingId',v_source.id,'sourceBookingNumber',v_source.booking_number,
      'newBookingId',v_new_id,'newBookingNumber',v_new_number,'participantIds',to_jsonb(v_ids),
      'scope','BOOKING_SPLIT'));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_source.trip_id));
end;
$function$;

-- The historic planner deliberately fell back to person-by-person placement.
-- Post-process that plan so non-overridden members of a booking are all placed
-- in the same bus or all stay unassigned with a visible conflict.
alter function app_private.m320_r3_assignment_plan(uuid)
  rename to m320_r3_assignment_plan_before_booking_groups;
create function app_private.m320_r3_assignment_plan(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_plan jsonb:=app_private.m320_r3_assignment_plan_before_booking_groups(p_trip_id);
  v_proposals jsonb;
  v_conflicts jsonb:=coalesce(v_plan->'conflicts','[]'::jsonb);
  v_booking record;
  v_non_null integer;
  v_distinct integer;
  v_group_bus_id uuid;
begin
  select coalesce(jsonb_agg(proposal.value order by proposal.ordinality),'[]'::jsonb)
  into v_proposals
  from jsonb_array_elements(coalesce(v_plan->'participantProposals','[]'::jsonb))
    with ordinality proposal(value,ordinality)
  left join app_modules.fanbus_registrations registration
    on registration.id=(proposal.value->>'participantId')::uuid
  where not (proposal.value->>'assignmentState'='PROPOSED_AUTO'
    and coalesce(registration.bus_assignment_override,false));

  for v_booking in
    select registration.booking_id
    from app_modules.fanbus_registrations registration
    where registration.trip_id=p_trip_id and registration.status='ACTIVE'
      and not registration.bus_assignment_override
    group by registration.booking_id having count(*)>1
  loop
    select group_bus_id into v_group_bus_id from app_modules.fanbus_bookings
    where id=v_booking.booking_id;
    select count(*) filter(where nullif(proposal.value->>'proposedBusId','') is not null),
      count(distinct nullif(proposal.value->>'proposedBusId',''))
    into v_non_null,v_distinct
    from jsonb_array_elements(v_proposals) proposal(value)
    where proposal.value->>'assignmentState'='PROPOSED_AUTO'
      and proposal.value->>'bookingId'=v_booking.booking_id::text;
    if v_non_null>0 and (v_distinct<>1 or v_non_null<>(select count(*) from jsonb_array_elements(v_proposals) p(value)
      where p.value->>'assignmentState'='PROPOSED_AUTO' and p.value->>'bookingId'=v_booking.booking_id::text)
      or (v_group_bus_id is not null and exists(
        select 1 from jsonb_array_elements(v_proposals) p(value)
        where p.value->>'assignmentState'='PROPOSED_AUTO'
          and p.value->>'bookingId'=v_booking.booking_id::text
          and nullif(p.value->>'proposedBusId','')::uuid is distinct from v_group_bus_id
      ))) then
      select coalesce(jsonb_agg(case
        when proposal.value->>'assignmentState'='PROPOSED_AUTO'
          and proposal.value->>'bookingId'=v_booking.booking_id::text
        then jsonb_set(jsonb_set(jsonb_set(proposal.value,'{proposedBusId}','null'::jsonb,true),
          '{bookingCohesion}',to_jsonb('GROUP_CONFLICT'::text),true),'{warnings}',
          coalesce(proposal.value->'warnings','[]'::jsonb)||jsonb_build_array('GROUP_CAPACITY_CONFLICT'),true)
        else proposal.value end order by proposal.ordinality),'[]'::jsonb)
      into v_proposals from jsonb_array_elements(v_proposals) with ordinality proposal(value,ordinality);
      v_conflicts:=v_conflicts||jsonb_build_array(jsonb_build_object(
        'severity','NON_BLOCKING','code','GROUP_CAPACITY_CONFLICT','bookingId',v_booking.booking_id
      ));
    end if;
  end loop;
  return jsonb_set(jsonb_set(jsonb_set(v_plan,'{participantProposals}',v_proposals,true),
    '{conflicts}',v_conflicts,true),'{canApply}',to_jsonb(exists(
      select 1 from jsonb_array_elements(v_proposals) proposal(value)
      where proposal.value->>'assignmentState'='PROPOSED_AUTO'
        and nullif(proposal.value->>'proposedBusId','') is not null
    )),true);
end;
$function$;

alter function app_private.api_fanbus_assignment_apply(jsonb)
  rename to api_fanbus_assignment_apply_before_booking_groups;
create function app_private.api_fanbus_assignment_apply(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare v_split boolean;
begin
  select exists(
    select 1
    from jsonb_array_elements(coalesce(p_payload->'finalAssignments','[]'::jsonb)) item(value)
    join app_modules.fanbus_registrations registration on registration.id=(item.value->>'participantId')::uuid
    join app_modules.fanbus_bookings booking on booking.id=registration.booking_id
    where not registration.bus_assignment_override
    group by registration.booking_id
    having count(distinct coalesce(nullif(item.value->>'busId',''),'UNASSIGNED'))>1
      or bool_or(booking.group_bus_id is not null
        and nullif(item.value->>'busId','')::uuid is distinct from booking.group_bus_id)
  ) into v_split;
  if v_split then raise exception 'FANBUS_GROUP_SPLIT_REQUIRES_OVERRIDE' using errcode='22023'; end if;
  return app_private.api_fanbus_assignment_apply_before_booking_groups(p_payload);
exception when invalid_text_representation then
  raise exception 'FANBUS_ASSIGNMENT_APPLY_INVALID_PAYLOAD' using errcode='22023';
end;
$function$;

-- Existing participant-level assignment calls now mean group assignment unless
-- the caller explicitly requests PARTICIPANT scope.
alter function app_private.api_fanbus_bus_assignment_set(jsonb)
  rename to api_fanbus_bus_assignment_set_before_booking_groups;
create function app_private.api_fanbus_bus_assignment_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_registration app_modules.fanbus_registrations%rowtype;
  v_bus_id uuid;
  v_old_bus_id uuid;
  v_scope text:=upper(btrim(coalesce(p_payload->>'scope','BOOKING')));
begin
  if jsonb_typeof(p_payload)<>'object' or not p_payload?&array['participantId','busId']
    or exists(select 1 from jsonb_object_keys(p_payload) key(name)
      where key.name<>all(array['participantId','busId','scope']))
    or v_scope not in ('BOOKING','PARTICIPANT') then
    raise exception 'FANBUS_ASSIGNMENT_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin
    select * into v_registration from app_modules.fanbus_registrations
      where id=(p_payload->>'participantId')::uuid;
    v_bus_id:=nullif(btrim(coalesce(p_payload->>'busId','')),'')::uuid;
  exception when others then raise exception 'FANBUS_ASSIGNMENT_INVALID_PAYLOAD' using errcode='22023'; end;
  if not found then raise exception 'FANBUS_PARTICIPANT_NOT_FOUND' using errcode='P0002'; end if;
  if v_scope='PARTICIPANT' then
    select assignment.bus_id into v_old_bus_id
    from app_modules.fanbus_bus_assignments assignment
    where assignment.participant_id=v_registration.id;
    perform app_private.api_fanbus_bus_assignment_set_before_booking_groups(
      p_payload-'scope'
    );
    update app_modules.fanbus_registrations
    set bus_assignment_override=true
    where id=v_registration.id;
    perform app_private.log_audit(
      v_actor,'FANBUS_BOOKING_PARTICIPANT_OVERRIDE_SET',
      'fanbus_registration',v_registration.id::text,
      jsonb_build_object('busId',v_old_bus_id,'busAssignmentOverride',v_registration.bus_assignment_override),
      jsonb_build_object('busId',v_bus_id,'busAssignmentOverride',true),
      jsonb_build_object('tripId',v_registration.trip_id,'bookingId',v_registration.booking_id,
        'participantIds',jsonb_build_array(v_registration.id),'scope','PARTICIPANT_OVERRIDE')
    );
    return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_registration.trip_id));
  end if;
  perform app_private.m330_lock_mutable_fanbus_trip(v_registration.trip_id);
  perform app_private.fanbus_booking_apply_group_bus(v_registration.booking_id,v_bus_id,v_actor,false);
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_registration.trip_id));
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_booking_groups;
create function app_private.pd_api_current_actions()
returns text[] language sql stable set search_path=''
as $function$
  select app_private.pd_api_current_actions_before_booking_groups()||array[
    'fanbus_booking_group_candidates','fanbus_booking_operator_append',
    'fanbus_booking_group_rules_set','fanbus_booking_participant_override_set',
    'fanbus_booking_participant_override_clear','fanbus_bookings_merge','fanbus_booking_split'
  ]::text[]
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_booking_groups;
create function app_private.platform_action_classification(p_action text)
returns text language sql stable set search_path=''
as $function$
  select case lower(btrim(coalesce(p_action,'')))
    when 'fanbus_booking_group_candidates' then 'READ'
    when 'fanbus_booking_operator_append' then 'USER_MUTATION'
    when 'fanbus_booking_group_rules_set' then 'USER_MUTATION'
    when 'fanbus_booking_participant_override_set' then 'USER_MUTATION'
    when 'fanbus_booking_participant_override_clear' then 'USER_MUTATION'
    when 'fanbus_bookings_merge' then 'USER_MUTATION'
    when 'fanbus_booking_split' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_booking_groups(p_action)
  end
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_booking_groups;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $function$
declare v_action text:=lower(btrim(coalesce(p_action,''))); v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
  case v_action
    when 'fanbus_booking_group_candidates' then return app_private.api_fanbus_booking_group_candidates(v_payload);
    when 'fanbus_booking_operator_append' then return app_private.api_fanbus_booking_operator_append(v_payload);
    when 'fanbus_booking_group_rules_set' then return app_private.api_fanbus_booking_group_rules_set(v_payload);
    when 'fanbus_booking_participant_override_set' then return app_private.api_fanbus_booking_participant_override_set(v_payload);
    when 'fanbus_booking_participant_override_clear' then return app_private.api_fanbus_booking_participant_override_clear(v_payload);
    when 'fanbus_bookings_merge' then return app_private.api_fanbus_bookings_merge(v_payload);
    when 'fanbus_booking_split' then return app_private.api_fanbus_booking_split(v_payload);
    else return app_private.pd_api_dispatch_current_before_booking_groups(p_action,p_payload);
  end case;
end;
$function$;

revoke all on function
  app_private.fanbus_booking_current_participant_ids(uuid),
  app_private.fanbus_booking_assert_bus_capacity(uuid,uuid,boolean),
  app_private.fanbus_booking_apply_group_bus(uuid,uuid,uuid,boolean),
  app_private.fanbus_registration_inherit_booking_rules(),
  app_private.api_fanbus_registrations_list_before_booking_groups(jsonb),
  app_private.api_fanbus_registrations_list(jsonb),
  app_private.api_fanbus_registration_create_manual_batches_before_booking_groups(jsonb),
  app_private.api_fanbus_registration_create_manual_batches(jsonb),
  app_private.api_fanbus_booking_operator_update_before_booking_groups(jsonb),
  app_private.api_fanbus_booking_operator_update(jsonb),
  app_private.api_fanbus_booking_group_candidates(jsonb),
  app_private.api_fanbus_booking_operator_append(jsonb),
  app_private.api_fanbus_booking_group_rules_set(jsonb),
  app_private.api_fanbus_booking_participant_override_set(jsonb),
  app_private.api_fanbus_booking_participant_override_clear(jsonb),
  app_private.api_fanbus_bookings_merge(jsonb),
  app_private.api_fanbus_booking_split(jsonb),
  app_private.m320_r3_assignment_plan_before_booking_groups(uuid),
  app_private.m320_r3_assignment_plan(uuid),
  app_private.api_fanbus_assignment_apply_before_booking_groups(jsonb),
  app_private.api_fanbus_assignment_apply(jsonb),
  app_private.api_fanbus_bus_assignment_set_before_booking_groups(jsonb),
  app_private.api_fanbus_bus_assignment_set(jsonb),
  app_private.pd_api_current_actions_before_booking_groups(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_booking_groups(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_booking_groups(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
from public,anon,authenticated,service_role;

grant execute on function
  app_private.fanbus_booking_current_participant_ids(uuid),
  app_private.fanbus_booking_assert_bus_capacity(uuid,uuid,boolean),
  app_private.fanbus_booking_apply_group_bus(uuid,uuid,uuid,boolean),
  app_private.fanbus_registration_inherit_booking_rules(),
  app_private.api_fanbus_registrations_list_before_booking_groups(jsonb),
  app_private.api_fanbus_registrations_list(jsonb),
  app_private.api_fanbus_registration_create_manual_batches_before_booking_groups(jsonb),
  app_private.api_fanbus_registration_create_manual_batches(jsonb),
  app_private.api_fanbus_booking_operator_update_before_booking_groups(jsonb),
  app_private.api_fanbus_booking_operator_update(jsonb),
  app_private.api_fanbus_booking_group_candidates(jsonb),
  app_private.api_fanbus_booking_operator_append(jsonb),
  app_private.api_fanbus_booking_group_rules_set(jsonb),
  app_private.api_fanbus_booking_participant_override_set(jsonb),
  app_private.api_fanbus_booking_participant_override_clear(jsonb),
  app_private.api_fanbus_bookings_merge(jsonb),
  app_private.api_fanbus_booking_split(jsonb),
  app_private.m320_r3_assignment_plan_before_booking_groups(uuid),
  app_private.m320_r3_assignment_plan(uuid),
  app_private.api_fanbus_assignment_apply_before_booking_groups(jsonb),
  app_private.api_fanbus_assignment_apply(jsonb),
  app_private.api_fanbus_bus_assignment_set_before_booking_groups(jsonb),
  app_private.api_fanbus_bus_assignment_set(jsonb),
  app_private.pd_api_current_actions_before_booking_groups(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_booking_groups(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_booking_groups(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;

commit;
