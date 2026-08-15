-- Plaerrdeifl Digitalplattform V4
-- P300 / M325-R1: persönliche Mitfahrer, Zustiegsorte und Fahrtbetrieb
-- This migration deliberately extends the M320 contracts without changing them.

create table app_modules.fanbus_companion_lists (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null references app_portal.users(id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fanbus_companion_lists_owner_name_uidx unique (owner_user_id, name)
);

create table app_modules.fanbus_companion_list_members (
  id uuid primary key default extensions.gen_random_uuid(),
  list_id uuid not null references app_modules.fanbus_companion_lists(id) on delete cascade,
  position integer not null check (position > 0),
  first_name text not null check (length(btrim(first_name)) between 1 and 120),
  last_name text not null check (length(btrim(last_name)) between 1 and 120),
  default_boarding_stop_id uuid,
  default_bus_preference text not null default 'EGAL'
    check (default_bus_preference in ('RUHIG', 'PARTY', 'EGAL')),
  operational_note text check (operational_note is null or length(btrim(operational_note)) <= 240),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fanbus_companion_list_members_list_position_uidx
    unique (list_id, position) deferrable initially deferred
);

create table app_modules.fanbus_boarding_stops (
  id uuid primary key default extensions.gen_random_uuid(),
  label text not null check (length(btrim(label)) between 1 and 160),
  address text,
  default_note text,
  position integer not null check (position > 0),
  is_active boolean not null default true,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null
);
create unique index fanbus_boarding_stops_position_uidx on app_modules.fanbus_boarding_stops(position);

create table app_modules.fanbus_trip_boarding_stops (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null references app_modules.fanbus_trips(id) on delete restrict,
  boarding_stop_id uuid not null references app_modules.fanbus_boarding_stops(id) on delete restrict,
  departure_at timestamptz not null,
  position integer not null check (position > 0),
  trip_note text,
  is_active boolean not null default true,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_trip_boarding_stops_id_trip_key unique (id, trip_id),
  constraint fanbus_trip_boarding_stops_trip_stop_uidx unique (trip_id, boarding_stop_id),
  constraint fanbus_trip_boarding_stops_trip_position_uidx unique (trip_id, position)
);

create table app_modules.fanbus_bus_boarding_stops (
  id uuid primary key default extensions.gen_random_uuid(),
  trip_id uuid not null,
  bus_id uuid not null,
  trip_boarding_stop_id uuid not null,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_bus_boarding_stops_bus_trip_fk foreign key (bus_id, trip_id)
    references app_modules.fanbus_buses(id, trip_id) on delete restrict,
  constraint fanbus_bus_boarding_stops_stop_trip_fk foreign key (trip_boarding_stop_id, trip_id)
    references app_modules.fanbus_trip_boarding_stops(id, trip_id) on delete restrict,
  constraint fanbus_bus_boarding_stops_unique unique (bus_id, trip_boarding_stop_id)
);

alter table app_modules.fanbus_companion_list_members
  add constraint fanbus_companion_member_default_stop_fk foreign key (default_boarding_stop_id)
  references app_modules.fanbus_boarding_stops(id) on delete set null;

alter table app_modules.fanbus_registrations
  add column trip_boarding_stop_id uuid,
  add column operational_note text,
  add column companion_list_member_id uuid,
  add constraint fanbus_registrations_operational_note_check
    check (operational_note is null or length(btrim(operational_note)) <= 240),
  add constraint fanbus_registrations_stop_trip_fk
    foreign key (trip_boarding_stop_id, trip_id)
    references app_modules.fanbus_trip_boarding_stops(id, trip_id) on delete restrict,
  add constraint fanbus_registrations_companion_template_fk
    foreign key (companion_list_member_id)
    references app_modules.fanbus_companion_list_members(id) on delete set null;
create index fanbus_registrations_trip_stop_idx
  on app_modules.fanbus_registrations(trip_id, trip_boarding_stop_id)
  where trip_boarding_stop_id is not null;
create index fanbus_registrations_template_member_idx
  on app_modules.fanbus_registrations(trip_id, companion_list_member_id)
  where companion_list_member_id is not null;

create table app_modules.fanbus_participant_checkins (
  id uuid primary key default extensions.gen_random_uuid(),
  participant_id uuid not null,
  trip_id uuid not null,
  checkin_kind text not null check (checkin_kind = 'OUTBOUND'),
  status text not null default 'OPEN' check (status in ('OPEN', 'PRESENT', 'NO_SHOW')),
  status_changed_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_participant_checkins_participant_trip_fk foreign key (participant_id, trip_id)
    references app_modules.fanbus_registrations(id, trip_id) on delete restrict,
  constraint fanbus_participant_checkins_participant_kind_uidx unique (participant_id, checkin_kind)
);
create index fanbus_participant_checkins_trip_status_idx
  on app_modules.fanbus_participant_checkins(trip_id, status);

create table app_private.fanbus_m325_idempotency (
  idempotency_key uuid primary key,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
revoke all on table app_private.fanbus_m325_idempotency
from public, anon, authenticated, service_role;

create trigger fanbus_companion_lists_set_updated_at before update on app_modules.fanbus_companion_lists
for each row execute function app_private.set_updated_at();
create trigger fanbus_companion_members_set_updated_at before update on app_modules.fanbus_companion_list_members
for each row execute function app_private.set_updated_at();
create trigger fanbus_boarding_stops_set_updated_at before update on app_modules.fanbus_boarding_stops
for each row execute function app_private.set_updated_at();
create trigger fanbus_trip_boarding_stops_set_updated_at before update on app_modules.fanbus_trip_boarding_stops
for each row execute function app_private.set_updated_at();
create trigger fanbus_bus_boarding_stops_set_updated_at before update on app_modules.fanbus_bus_boarding_stops
for each row execute function app_private.set_updated_at();
create trigger fanbus_participant_checkins_set_updated_at before update on app_modules.fanbus_participant_checkins
for each row execute function app_private.set_updated_at();

-- The booking core is the single insertion route. The trusted wrapper below puts
-- a validated per-participant M325 context in transaction-local settings before it calls M320.
create function app_private.m325_registration_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb := coalesce(nullif(current_setting('app.m325_registration_context', true), ''), '[]')::jsonb;
  v_entry jsonb;
  v_stop_id uuid;
  v_template_id uuid;
  v_note text;
  v_owner uuid;
begin
  select value into v_entry
  from jsonb_array_elements(v_context)
  where (value ->> 'sequence')::integer = new.participant_sequence
  limit 1;
  if v_entry is not null then
    begin
      v_stop_id := nullif(v_entry ->> 'boardingStopId', '')::uuid;
      v_template_id := nullif(v_entry ->> 'templateMemberId', '')::uuid;
    exception when others then
      raise exception 'FANBUS_BOARDING_STOP_INVALID' using errcode = '22023';
    end;
    v_note := nullif(btrim(coalesce(v_entry ->> 'operationalNote', '')), '');
    if v_note is not null and length(v_note) > 240 then
      raise exception 'FANBUS_OPERATIONAL_NOTE_TOO_LONG' using errcode = '22023';
    end if;
    if v_stop_id is not null and not exists (
      select 1 from app_modules.fanbus_trip_boarding_stops
      where id = v_stop_id and trip_id = new.trip_id and is_active
    ) then
      raise exception 'FANBUS_BOARDING_STOP_UNAVAILABLE' using errcode = '22023';
    end if;
    if v_template_id is not null then
      if new.source <> 'PORTAL' or new.booking_role <> 'COMPANION'
         or new.created_by is null then
        raise exception 'FANBUS_TEMPLATE_MEMBER_FORBIDDEN' using errcode = '42501';
      end if;
      select list.owner_user_id into v_owner
      from app_modules.fanbus_companion_list_members member
      join app_modules.fanbus_companion_lists list on list.id = member.list_id
      where member.id = v_template_id;
      if not found or v_owner <> new.created_by then
        raise exception 'FANBUS_TEMPLATE_MEMBER_FORBIDDEN' using errcode = '42501';
      end if;
      if exists (
        select 1 from app_modules.fanbus_registrations registration
        where registration.trip_id = new.trip_id
          and registration.status in ('ACTIVE', 'WAITLISTED')
          and (
            registration.companion_list_member_id = v_template_id
            or (
              lower(btrim(registration.first_name)) = lower(btrim(new.first_name))
              and lower(btrim(registration.last_name)) = lower(btrim(new.last_name))
            )
          )
      ) then
        raise exception 'FANBUS_COMPANION_CONFLICT' using errcode = 'P3251';
      end if;
    end if;
    new.trip_boarding_stop_id := v_stop_id;
    new.companion_list_member_id := v_template_id;
    new.operational_note := v_note;
  end if;
  if exists (select 1 from app_modules.fanbus_trip_boarding_stops where trip_id = new.trip_id and is_active)
     and new.trip_boarding_stop_id is null then
    raise exception 'FANBUS_BOARDING_STOP_REQUIRED' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger fanbus_registrations_m325_before_insert
before insert on app_modules.fanbus_registrations
for each row execute function app_private.m325_registration_before_insert();

create function app_private.m325_registration_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into app_modules.fanbus_participant_checkins(participant_id, trip_id, checkin_kind, status, updated_by)
  values (new.id, new.trip_id, 'OUTBOUND', 'OPEN', new.updated_by)
  on conflict (participant_id, checkin_kind) do nothing;
  return new;
end;
$$;
create trigger fanbus_registrations_m325_after_insert
after insert on app_modules.fanbus_registrations
for each row execute function app_private.m325_registration_after_insert();

insert into app_modules.fanbus_participant_checkins(participant_id, trip_id, checkin_kind, status)
select id, trip_id, 'OUTBOUND', 'OPEN' from app_modules.fanbus_registrations
on conflict (participant_id, checkin_kind) do nothing;

create function app_private.m325_assignment_stop_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_stop uuid;
begin
  select trip_boarding_stop_id into v_stop from app_modules.fanbus_registrations where id = new.participant_id;
  if v_stop is not null and not exists (
    select 1 from app_modules.fanbus_bus_boarding_stops
    where trip_id = new.trip_id and bus_id = new.bus_id and trip_boarding_stop_id = v_stop
  ) then
    raise exception 'FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger fanbus_bus_assignments_m325_stop_guard before insert or update of bus_id on app_modules.fanbus_bus_assignments
for each row execute function app_private.m325_assignment_stop_guard();

alter table app_modules.fanbus_companion_lists enable row level security;
alter table app_modules.fanbus_companion_list_members enable row level security;
alter table app_modules.fanbus_boarding_stops enable row level security;
alter table app_modules.fanbus_trip_boarding_stops enable row level security;
alter table app_modules.fanbus_bus_boarding_stops enable row level security;
alter table app_modules.fanbus_participant_checkins enable row level security;
revoke all on table app_modules.fanbus_companion_lists, app_modules.fanbus_companion_list_members,
  app_modules.fanbus_boarding_stops, app_modules.fanbus_trip_boarding_stops,
  app_modules.fanbus_bus_boarding_stops, app_modules.fanbus_participant_checkins
from public, anon, authenticated;

create function app_private.m325_parse_uuid(p_value text, p_error text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin return nullif(btrim(coalesce(p_value, '')), '')::uuid;
exception when others then raise exception '%', p_error using errcode = '22023'; end;
$$;

create function app_private.api_fanbus_companion_lists_list()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := app_private.require_active_user();
begin
  return jsonb_build_object('lists', coalesce((select jsonb_agg(jsonb_build_object(
    'id', l.id, 'name', l.name, 'revision', l.revision,
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'position', m.position,
      'firstName', m.first_name, 'lastName', m.last_name, 'defaultBoardingStopId', m.default_boarding_stop_id,
      'defaultBusPreference', m.default_bus_preference, 'operationalNote', m.operational_note, 'revision', m.revision)
      order by m.position) from app_modules.fanbus_companion_list_members m where m.list_id = l.id), '[]'::jsonb))
    order by lower(l.name), l.id) from app_modules.fanbus_companion_lists l where l.owner_user_id = v_actor), '[]'::jsonb));
end; $$;

create function app_private.api_fanbus_companion_list_upsert(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := app_private.require_active_user(); v_id uuid; v_name text; v_revision integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or not p_payload ? 'name' then raise exception 'FANBUS_COMPANION_LIST_INVALID_PAYLOAD' using errcode = '22023'; end if;
  v_id := app_private.m325_parse_uuid(p_payload ->> 'id', 'FANBUS_COMPANION_LIST_INVALID_PAYLOAD');
  v_name := btrim(coalesce(p_payload ->> 'name', '')); v_revision := nullif(p_payload ->> 'expectedRevision', '')::integer;
  if length(v_name) not between 1 and 120 then raise exception 'FANBUS_COMPANION_LIST_INVALID_PAYLOAD' using errcode = '22023'; end if;
  if v_id is null then insert into app_modules.fanbus_companion_lists(owner_user_id, name) values(v_actor, v_name) returning id into v_id;
  else
    update app_modules.fanbus_companion_lists set name=v_name, revision=revision+1 where id=v_id and owner_user_id=v_actor and revision=v_revision;
    if not found then raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode = '40001'; end if;
  end if;
  perform app_private.log_audit(v_actor, 'FANBUS_COMPANION_LIST_SAVED', 'fanbus_companion_list', v_id::text, null, null, jsonb_build_object('listId', v_id));
  return jsonb_build_object('id',v_id);
end; $$;

create function app_private.api_fanbus_companion_list_delete(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := app_private.require_active_user(); v_id uuid := app_private.m325_parse_uuid(p_payload ->> 'id','FANBUS_COMPANION_LIST_INVALID_PAYLOAD'); v_revision integer := nullif(p_payload ->> 'expectedRevision','')::integer;
begin
  delete from app_modules.fanbus_companion_lists where id=v_id and owner_user_id=v_actor and revision=v_revision;
  if not found then raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode = '40001'; end if;
  perform app_private.log_audit(v_actor,'FANBUS_COMPANION_LIST_DELETED','fanbus_companion_list',v_id::text,null,null,jsonb_build_object('listId',v_id)); return jsonb_build_object('id',v_id);
end; $$;

create function app_private.api_fanbus_companion_member_upsert(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_list uuid := app_private.m325_parse_uuid(p_payload ->> 'listId','FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD');
  v_id uuid := app_private.m325_parse_uuid(p_payload ->> 'id','FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD');
  v_stop uuid := app_private.m325_parse_uuid(p_payload ->> 'defaultBoardingStopId','FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD');
  v_pref text := upper(btrim(coalesce(p_payload ->> 'defaultBusPreference','')));
  v_note text := nullif(btrim(coalesce(p_payload ->> 'operationalNote','')), '');
  v_revision integer := nullif(p_payload ->> 'expectedRevision','')::integer;
  v_position integer;
begin
  perform 1 from app_modules.fanbus_companion_lists
  where id = v_list and owner_user_id = v_actor for update;
  if not found or v_pref not in ('RUHIG','PARTY','EGAL')
     or length(btrim(coalesce(p_payload->>'firstName',''))) not between 1 and 120
     or length(btrim(coalesce(p_payload->>'lastName',''))) not between 1 and 120
     or (v_note is not null and length(v_note)>240)
     or (v_stop is not null and not exists(
       select 1 from app_modules.fanbus_boarding_stops where id=v_stop and is_active
     )) then
    raise exception 'FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD' using errcode='22023';
  end if;
  if v_id is null then
    select coalesce(max(position), 0) + 1 into v_position
    from app_modules.fanbus_companion_list_members where list_id = v_list;
    insert into app_modules.fanbus_companion_list_members(
      list_id,position,first_name,last_name,default_boarding_stop_id,
      default_bus_preference,operational_note
    ) values (
      v_list,v_position,btrim(p_payload->>'firstName'),btrim(p_payload->>'lastName'),
      v_stop,v_pref,v_note
    ) returning id into v_id;
  else
    update app_modules.fanbus_companion_list_members set
      first_name=btrim(p_payload->>'firstName'),last_name=btrim(p_payload->>'lastName'),
      default_boarding_stop_id=v_stop,default_bus_preference=v_pref,
      operational_note=v_note,revision=revision+1
    where id=v_id and list_id=v_list and revision=v_revision;
    if not found then raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode='40001'; end if;
  end if;
  return jsonb_build_object('id',v_id,'position',(
    select position from app_modules.fanbus_companion_list_members where id=v_id
  ));
end;
$$;

create function app_private.api_fanbus_companion_members_reorder(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_list uuid := app_private.m325_parse_uuid(p_payload ->> 'listId','FANBUS_COMPANION_REORDER_INVALID_PAYLOAD');
  v_ids jsonb := p_payload -> 'memberIds';
begin
  perform 1 from app_modules.fanbus_companion_lists
  where id=v_list and owner_user_id=v_actor for update;
  if not found or jsonb_typeof(v_ids) <> 'array'
     or jsonb_array_length(v_ids) <> (
       select count(*) from app_modules.fanbus_companion_list_members where list_id=v_list
     ) or exists (
       select 1 from jsonb_array_elements_text(v_ids) item
       left join app_modules.fanbus_companion_list_members member
         on member.id = app_private.m325_parse_uuid(item.value,'FANBUS_COMPANION_REORDER_INVALID_PAYLOAD')
        and member.list_id=v_list
       where member.id is null
     ) or (
       select count(distinct value) from jsonb_array_elements_text(v_ids)
     ) <> jsonb_array_length(v_ids) then
    raise exception 'FANBUS_COMPANION_REORDER_INVALID_PAYLOAD' using errcode='22023';
  end if;
  update app_modules.fanbus_companion_list_members member
  set position=ordered.position,revision=member.revision+1
  from (
    select app_private.m325_parse_uuid(value,'FANBUS_COMPANION_REORDER_INVALID_PAYLOAD') id,
      ordinality::integer position
    from jsonb_array_elements_text(v_ids) with ordinality
  ) ordered
  where member.id=ordered.id and member.list_id=v_list;
  return jsonb_build_object('listId',v_list);
end;
$$;

create function app_private.api_fanbus_boarding_stops_list()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := app_private.require_active_user(); begin
  return jsonb_build_object('stops',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'address',address,'defaultNote',default_note,'position',position,'isActive',is_active,'revision',revision) order by position,id) from app_modules.fanbus_boarding_stops where is_active or app_private.has_capability(v_actor,'fanbus.manage')),'[]'::jsonb)); end; $$;

create function app_private.api_fanbus_boarding_stop_upsert(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=app_private.require_capability('fanbus.manage'); v_id uuid:=app_private.m325_parse_uuid(p_payload->>'id','FANBUS_BOARDING_STOP_INVALID_PAYLOAD'); v_revision integer:=nullif(p_payload->>'expectedRevision','')::integer; v_label text:=btrim(coalesce(p_payload->>'label','')); v_position integer:=(p_payload->>'position')::integer; v_active boolean:=(p_payload->>'isActive')::boolean;
begin if length(v_label) not between 1 and 160 or v_position<=0 or v_active is null then raise exception 'FANBUS_BOARDING_STOP_INVALID_PAYLOAD' using errcode='22023'; end if;
if v_id is null then select coalesce(max(position),0)+1 into v_position from app_modules.fanbus_boarding_stops; insert into app_modules.fanbus_boarding_stops(label,address,default_note,position,is_active,created_by,updated_by) values(v_label,nullif(btrim(coalesce(p_payload->>'address','')),''),nullif(btrim(coalesce(p_payload->>'defaultNote','')),''),v_position,v_active,v_actor,v_actor) returning id into v_id;
else update app_modules.fanbus_boarding_stops set label=v_label,address=nullif(btrim(coalesce(p_payload->>'address','')),''),default_note=nullif(btrim(coalesce(p_payload->>'defaultNote','')),''),position=v_position,is_active=v_active,revision=revision+1,updated_by=v_actor where id=v_id and revision=v_revision; if not found then raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode='40001'; end if; end if;
perform app_private.log_audit(v_actor,'FANBUS_BOARDING_STOP_SAVED','fanbus_boarding_stop',v_id::text,null,null,jsonb_build_object('boardingStopId',v_id)); return jsonb_build_object('id',v_id); end; $$;

create function app_private.api_fanbus_trip_boarding_stops_list(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=app_private.require_active_user();
  v_trip uuid:=app_private.m325_parse_uuid(p_payload->>'tripId','FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD');
begin
  if not app_private.has_capability(v_actor,'fanbus.manage')
     and not app_private.has_capability(v_actor,'fanbus.registrations.manage') then
    raise exception 'Berechtigung fehlt: fanbus.manage oder fanbus.registrations.manage'
      using errcode='42501';
  end if;
  return jsonb_build_object('tripId',v_trip,'stops',coalesce((select jsonb_agg(jsonb_build_object(
    'id',t.id,'tripBoardingStopId',t.id,'boardingStopId',t.boarding_stop_id,
    'label',s.label,'departureAt',t.departure_at,'position',t.position,
    'tripNote',t.trip_note,'isActive',t.is_active,'revision',t.revision
  ) order by t.position,t.id)
  from app_modules.fanbus_trip_boarding_stops t
  join app_modules.fanbus_boarding_stops s on s.id=t.boarding_stop_id
  where t.trip_id=v_trip),'[]'::jsonb));
end;
$$;

create function app_private.api_fanbus_trip_boarding_stop_upsert(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=app_private.require_capability('fanbus.manage');
  v_id uuid:=app_private.m325_parse_uuid(p_payload->>'id','FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD');
  v_trip uuid:=app_private.m325_parse_uuid(p_payload->>'tripId','FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD');
  v_stop uuid:=app_private.m325_parse_uuid(p_payload->>'boardingStopId','FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD');
  v_revision integer:=nullif(p_payload->>'expectedRevision','')::integer;
  v_position integer:=(p_payload->>'position')::integer;
  v_departure timestamptz:=(p_payload->>'departureAt')::timestamptz;
  v_active boolean:=(p_payload->>'isActive')::boolean;
  v_master_active boolean;
  v_existing app_modules.fanbus_trip_boarding_stops%rowtype;
begin
  select is_active into v_master_active
  from app_modules.fanbus_boarding_stops where id=v_stop;
  if v_position<=0 or v_departure is null or v_active is null or v_master_active is null
     or not exists(select 1 from app_modules.fanbus_trips where id=v_trip) then
    raise exception 'FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD' using errcode='22023';
  end if;
  if v_id is null then
    if v_active and not v_master_active then
      raise exception 'FANBUS_ACTIVE_TRIP_STOP_REQUIRES_ACTIVE_MASTER' using errcode='22023';
    end if;
    select coalesce(max(position),0)+1 into v_position
    from app_modules.fanbus_trip_boarding_stops where trip_id=v_trip;
    insert into app_modules.fanbus_trip_boarding_stops(
      trip_id,boarding_stop_id,departure_at,position,trip_note,is_active,created_by,updated_by
    ) values(
      v_trip,v_stop,v_departure,v_position,nullif(btrim(coalesce(p_payload->>'tripNote','')),''),
      v_active,v_actor,v_actor
    ) returning id into v_id;
  else
    select * into v_existing from app_modules.fanbus_trip_boarding_stops
    where id=v_id and trip_id=v_trip for update;
    if not found or v_existing.revision<>v_revision then
      raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode='40001';
    end if;
    if v_active and (not v_existing.is_active or v_existing.boarding_stop_id<>v_stop)
       and not v_master_active then
      raise exception 'FANBUS_ACTIVE_TRIP_STOP_REQUIRES_ACTIVE_MASTER' using errcode='22023';
    end if;
    update app_modules.fanbus_trip_boarding_stops set
      boarding_stop_id=v_stop,departure_at=v_departure,position=v_position,
      trip_note=nullif(btrim(coalesce(p_payload->>'tripNote','')),''),
      is_active=v_active,revision=revision+1,updated_by=v_actor
    where id=v_id;
  end if;
  perform app_private.log_audit(v_actor,'FANBUS_TRIP_BOARDING_STOP_SAVED',
    'fanbus_trip_boarding_stop',v_id::text,null,null,
    jsonb_build_object('tripId',v_trip,'tripBoardingStopId',v_id));
  return jsonb_build_object('id',v_id);
end;
$$;

create function app_private.api_fanbus_bus_boarding_stops_set(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=app_private.require_capability('fanbus.manage');
  v_trip uuid:=app_private.m325_parse_uuid(p_payload->>'tripId','FANBUS_BUS_BOARDING_STOP_INVALID_PAYLOAD');
  v_bus uuid:=app_private.m325_parse_uuid(p_payload->>'busId','FANBUS_BUS_BOARDING_STOP_INVALID_PAYLOAD');
  v_expected integer; v_revision integer; v_stops uuid[] := array[]::uuid[]; v_stop uuid;
begin
  begin
    v_expected := (p_payload ->> 'expectedRevision')::integer;
    select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_stops
    from jsonb_array_elements_text(p_payload->'tripBoardingStopIds');
  exception when others then
    raise exception 'FANBUS_BUS_BOARDING_STOP_INVALID_PAYLOAD' using errcode='22023';
  end;
  if jsonb_typeof(p_payload->'tripBoardingStopIds') <> 'array' or v_expected <= 0
     or cardinality(v_stops) <> (select count(distinct value) from unnest(v_stops) value) then
    raise exception 'FANBUS_BUS_BOARDING_STOP_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select revision into v_revision from app_modules.fanbus_buses
  where id=v_bus and trip_id=v_trip for update;
  if not found then raise exception 'FANBUS_BUS_BOARDING_STOP_INVALID_PAYLOAD' using errcode='22023'; end if;
  if v_revision <> v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
  if exists (
    select 1 from unnest(v_stops) selected(id)
    where not exists(select 1 from app_modules.fanbus_trip_boarding_stops stop
      where stop.id=selected.id and stop.trip_id=v_trip and stop.is_active)
  ) then raise exception 'FANBUS_BUS_BOARDING_STOP_CROSS_TRIP' using errcode='22023'; end if;
  if exists (
    select 1 from app_modules.fanbus_bus_assignments assignment
    join app_modules.fanbus_registrations participant on participant.id=assignment.participant_id
    where assignment.bus_id=v_bus and participant.status='ACTIVE'
      and participant.trip_boarding_stop_id is not null
      and not (participant.trip_boarding_stop_id = any(v_stops))
  ) then raise exception 'FANBUS_BUS_STOP_IN_USE' using errcode='22023'; end if;
  delete from app_modules.fanbus_bus_boarding_stops where trip_id=v_trip and bus_id=v_bus;
  foreach v_stop in array v_stops loop
    insert into app_modules.fanbus_bus_boarding_stops(
      trip_id,bus_id,trip_boarding_stop_id,created_by,updated_by
    ) values(v_trip,v_bus,v_stop,v_actor,v_actor);
  end loop;
  update app_modules.fanbus_buses set revision=revision+1,updated_by=v_actor where id=v_bus
  returning revision into v_revision;
  perform app_private.log_audit(v_actor,'FANBUS_BUS_BOARDING_STOPS_SET','fanbus_bus',v_bus::text,null,null,jsonb_build_object('tripId',v_trip,'busId',v_bus));
  return jsonb_build_object('tripId',v_trip,'busId',v_bus,'revision',v_revision);
end;
$$;

create function app_private.api_fanbus_bus_boarding_stops_list(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=app_private.require_capability('fanbus.manage');
  v_trip uuid:=app_private.m325_parse_uuid(p_payload->>'tripId','FANBUS_BUS_BOARDING_STOP_INVALID_PAYLOAD');
begin
  return jsonb_build_object('tripId',v_trip,'buses',coalesce((
    select jsonb_agg(jsonb_build_object(
      'busId',bus.id,'label',bus.label,'revision',bus.revision,
      'tripBoardingStopIds',coalesce((select jsonb_agg(mapping.trip_boarding_stop_id order by stop.position)
        from app_modules.fanbus_bus_boarding_stops mapping
        join app_modules.fanbus_trip_boarding_stops stop on stop.id=mapping.trip_boarding_stop_id
        where mapping.bus_id=bus.id),'[]'::jsonb)
    ) order by lower(bus.label),bus.id)
    from app_modules.fanbus_buses bus where bus.trip_id=v_trip
  ),'[]'::jsonb));
end;
$$;

create function app_private.api_fanbus_registration_operational_update(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_id uuid:=app_private.m325_parse_uuid(p_payload->>'participantId','FANBUS_PARTICIPANT_OPERATIONAL_INVALID_PAYLOAD');
  v_stop uuid:=app_private.m325_parse_uuid(p_payload->>'tripBoardingStopId','FANBUS_PARTICIPANT_OPERATIONAL_INVALID_PAYLOAD');
  v_expected integer:=(p_payload->>'expectedRevision')::integer;
  v_note text:=nullif(btrim(coalesce(p_payload->>'operationalNote','')),'');
  v_row app_modules.fanbus_registrations%rowtype;
  v_bus uuid;
begin
  -- Shared lock order with M320 assignment changes: participant first, bus second.
  select * into v_row from app_modules.fanbus_registrations
  where id=v_id for update;
  if not found or v_row.revision<>v_expected then
    raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode='40001';
  end if;
  select assignment.bus_id into v_bus
  from app_modules.fanbus_bus_assignments assignment
  where assignment.participant_id=v_id;
  if v_bus is not null then
    perform 1 from app_modules.fanbus_buses bus
    where bus.id=v_bus and bus.trip_id=v_row.trip_id for update;
    if not found then
      raise exception 'FANBUS_PARTICIPANT_OPERATIONAL_INVALID_PAYLOAD' using errcode='22023';
    end if;
  end if;
  if (v_note is not null and length(v_note)>240)
     or (v_stop is not null and not exists(
       select 1 from app_modules.fanbus_trip_boarding_stops
       where id=v_stop and trip_id=v_row.trip_id and is_active
     )) then
    raise exception 'FANBUS_PARTICIPANT_OPERATIONAL_INVALID_PAYLOAD' using errcode='22023';
  end if;
  if v_stop is not null and v_bus is not null and not exists(
    select 1 from app_modules.fanbus_bus_boarding_stops mapping
    where mapping.trip_id=v_row.trip_id and mapping.bus_id=v_bus
      and mapping.trip_boarding_stop_id=v_stop
  ) then
    raise exception 'FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP' using errcode='22023';
  end if;
  update app_modules.fanbus_registrations set
    trip_boarding_stop_id=v_stop,operational_note=v_note,
    revision=revision+1,updated_by=v_actor
  where id=v_id;
  perform app_private.log_audit(v_actor,'FANBUS_PARTICIPANT_OPERATIONAL_UPDATED',
    'fanbus_registration',v_id::text,
    jsonb_build_object('hadNoteBefore',v_row.operational_note is not null),
    jsonb_build_object('hasNoteAfter',v_note is not null),
    jsonb_build_object('tripId',v_row.trip_id,'participantId',v_id));
  return jsonb_build_object('id',v_id,'revision',v_expected+1);
end;
$$;

create function app_private.api_fanbus_registration_update_m325(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_after_revision integer;
  v_trip uuid;
begin
  perform app_private.require_capability('fanbus.registrations.manage');
  if p_payload is null or jsonb_typeof(p_payload)<>'object'
     or not p_payload ?& array[
       'id','expectedRevision','firstName','lastName','email','busPreference',
       'tripBoardingStopId','operationalNote'
     ] or exists(
       select 1 from jsonb_object_keys(p_payload) key
       where key<>all(array[
         'id','expectedRevision','firstName','lastName','email','busPreference',
         'tripBoardingStopId','operationalNote'
       ])
     ) then
    raise exception 'FANBUS_PARTICIPANT_UPDATE_M325_INVALID_PAYLOAD' using errcode='22023';
  end if;
  v_id:=app_private.m325_parse_uuid(p_payload->>'id','FANBUS_PARTICIPANT_UPDATE_M325_INVALID_PAYLOAD');
  perform app_private.api_fanbus_registration_update(jsonb_build_object(
    'id',v_id,'expectedRevision',p_payload->'expectedRevision',
    'firstName',p_payload->'firstName','lastName',p_payload->'lastName',
    'email',p_payload->'email','busPreference',p_payload->'busPreference'
  ));
  select revision,trip_id into v_after_revision,v_trip
  from app_modules.fanbus_registrations where id=v_id;
  perform app_private.api_fanbus_registration_operational_update(jsonb_build_object(
    'participantId',v_id,'expectedRevision',v_after_revision,
    'tripBoardingStopId',p_payload->'tripBoardingStopId',
    'operationalNote',p_payload->'operationalNote'
  ));
  return app_private.api_fanbus_registrations_list(jsonb_build_object('tripId',v_trip));
end;
$$;

create function app_private.api_fanbus_operations_snapshot(p_payload jsonb)
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
        coalesce(c.revision,1) checkin_revision
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
        'checkinStatus',checkin_status,'checkinRevision',checkin_revision
      ) order by lower(last_name),lower(first_name),id) from active),'[]'::jsonb)
    ) from summary
  );
end;
$$;

create function app_private.api_fanbus_checkin_set(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=app_private.require_capability('fanbus.registrations.manage'); v_participant uuid:=app_private.m325_parse_uuid(p_payload->>'participantId','FANBUS_CHECKIN_INVALID_PAYLOAD'); v_expected integer:=(p_payload->>'expectedRevision')::integer; v_status text:=upper(btrim(coalesce(p_payload->>'status',''))); v_checkin app_modules.fanbus_participant_checkins%rowtype; v_registration app_modules.fanbus_registrations%rowtype;
begin if v_status not in ('OPEN','PRESENT','NO_SHOW') or v_expected is null then raise exception 'FANBUS_CHECKIN_INVALID_PAYLOAD' using errcode='22023'; end if; select r.* into v_registration from app_modules.fanbus_registrations r where r.id=v_participant for update; if not found or v_registration.status<>'ACTIVE' then raise exception 'FANBUS_CHECKIN_REQUIRES_ACTIVE_PARTICIPANT' using errcode='22023'; end if; select * into v_checkin from app_modules.fanbus_participant_checkins where participant_id=v_participant and checkin_kind='OUTBOUND' for update; if not found then insert into app_modules.fanbus_participant_checkins(participant_id,trip_id,checkin_kind,status,updated_by) values(v_participant,v_registration.trip_id,'OUTBOUND','OPEN',v_actor) returning * into v_checkin; end if; if v_checkin.revision<>v_expected then raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode='40001'; end if; update app_modules.fanbus_participant_checkins set status=v_status,status_changed_at=clock_timestamp(),revision=revision+1,updated_by=v_actor where id=v_checkin.id; perform app_private.log_audit(v_actor,'FANBUS_CHECKIN_CHANGED','fanbus_participant_checkin',v_checkin.id::text,jsonb_build_object('status',v_checkin.status),jsonb_build_object('status',v_status),jsonb_build_object('tripId',v_registration.trip_id,'participantId',v_participant,'oldStatus',v_checkin.status,'newStatus',v_status)); return app_private.api_fanbus_operations_snapshot(jsonb_build_object('tripId',v_registration.trip_id)); end; $$;

create function app_private.m325_assert_idempotency(
  p_idempotency_key uuid,
  p_context jsonb,
  p_is_extended boolean
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_hash text := encode(extensions.digest(coalesce(p_context, '{}'::jsonb)::text, 'sha256'), 'hex');
  v_existing text;
  v_lock_key bigint;
begin
  if p_idempotency_key is null then
    raise exception 'FANBUS_IDEMPOTENCY_KEY_REQUIRED' using errcode = '22023';
  end if;
  v_lock_key := (
    'x' || substr(encode(extensions.digest(
      'app_private.fanbus_submit_registration:' || p_idempotency_key::text,
      'sha256'
    ), 'hex'), 1, 16)
  )::bit(64)::bigint;
  perform pg_catalog.pg_advisory_xact_lock(v_lock_key);
  select request_hash into v_existing
  from app_private.fanbus_m325_idempotency
  where idempotency_key = p_idempotency_key;
  if found then
    if v_existing <> v_hash then
      raise exception 'FANBUS_IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
    end if;
    return;
  end if;
  if p_is_extended and exists (
    select 1 from app_private.fanbus_registration_idempotency
    where idempotency_key = p_idempotency_key
  ) then
    raise exception 'FANBUS_IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
  end if;
  insert into app_private.fanbus_m325_idempotency(idempotency_key, request_hash)
  values (p_idempotency_key, v_hash);
end;
$$;

-- Preserve M320 callable functions and only accept/strip the extra M325 fields here.
alter function app_private.api_fanbus_self_register(jsonb) rename to api_fanbus_self_register_before_m325_r1;
create function app_private.api_fanbus_self_register(p_payload jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_context jsonb := '[]'::jsonb;
  v_companion jsonb;
  v_clean jsonb;
  v_index integer := 1;
  v_key uuid;
  v_extended boolean := false;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'FANBUS_SELF_REGISTRATION_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin v_key := (p_payload ->> 'idempotencyKey')::uuid;
  exception when others then raise exception 'FANBUS_SELF_REGISTRATION_INVALID_PAYLOAD' using errcode='22023'; end;
  v_context := v_context || jsonb_build_array(jsonb_build_object(
    'sequence', 1, 'boardingStopId', nullif(p_payload ->> 'boardingStopId', ''),
    'operationalNote', nullif(btrim(coalesce(p_payload ->> 'operationalNote', '')), '')
  ));
  v_extended := p_payload ? 'boardingStopId' or p_payload ? 'operationalNote';
  for v_companion in
    select value from jsonb_array_elements(coalesce(p_payload -> 'companions', '[]'::jsonb))
  loop
    v_index := v_index + 1;
    v_extended := v_extended or v_companion ? 'boardingStopId'
      or v_companion ? 'operationalNote' or v_companion ? 'templateMemberId';
    v_context := v_context || jsonb_build_array(jsonb_build_object(
      'sequence', v_index,
      'boardingStopId', nullif(v_companion ->> 'boardingStopId', ''),
      'operationalNote', nullif(btrim(coalesce(v_companion ->> 'operationalNote', '')), ''),
      'templateMemberId', nullif(v_companion ->> 'templateMemberId', '')
    ));
  end loop;
  perform app_private.m325_assert_idempotency(
    v_key, jsonb_build_object('version', 1, 'actor', v_actor, 'context', v_context), v_extended
  );
  v_clean := p_payload - 'boardingStopId' - 'operationalNote';
  if v_clean ? 'companions' then
    v_clean := jsonb_set(v_clean, '{companions}', coalesce((
      select jsonb_agg(value - 'boardingStopId' - 'operationalNote' - 'templateMemberId')
      from jsonb_array_elements(v_clean -> 'companions')
    ), '[]'::jsonb));
  end if;
  perform set_config('app.m325_registration_context', v_context::text, true);
  return app_private.api_fanbus_self_register_before_m325_r1(v_clean);
end;
$$;

alter function public.m310_submit_guest_fanbus_registration(jsonb, uuid, text) rename to m310_submit_guest_fanbus_registration_before_m325_r1;
create function public.m310_submit_guest_fanbus_registration(p_payload jsonb,p_idempotency_key uuid,p_source_hash text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_context jsonb := '[]'::jsonb; v_companion jsonb; v_clean jsonb;
  v_index integer := 1; v_extended boolean := false;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'FANBUS_GUEST_REGISTRATION_INVALID_PAYLOAD' using errcode='22023';
  end if;
  v_context := v_context || jsonb_build_array(jsonb_build_object(
    'sequence', 1, 'boardingStopId', nullif(p_payload ->> 'boardingStopId', ''),
    'operationalNote', nullif(btrim(coalesce(p_payload ->> 'operationalNote', '')), '')
  ));
  v_extended := p_payload ? 'boardingStopId' or p_payload ? 'operationalNote';
  for v_companion in select value from jsonb_array_elements(coalesce(p_payload -> 'companions', '[]'::jsonb)) loop
    v_index := v_index + 1;
    v_extended := v_extended or v_companion ? 'boardingStopId' or v_companion ? 'operationalNote';
    v_context := v_context || jsonb_build_array(jsonb_build_object(
      'sequence', v_index, 'boardingStopId', nullif(v_companion ->> 'boardingStopId', ''),
      'operationalNote', nullif(btrim(coalesce(v_companion ->> 'operationalNote', '')), '')
    ));
  end loop;
  perform app_private.m325_assert_idempotency(
    p_idempotency_key, jsonb_build_object('version', 1, 'source', 'GUEST', 'context', v_context), v_extended
  );
  v_clean := p_payload - 'boardingStopId' - 'operationalNote';
  if v_clean ? 'companions' then
    v_clean := jsonb_set(v_clean, '{companions}', coalesce((select jsonb_agg(
      value - 'boardingStopId' - 'operationalNote'
    ) from jsonb_array_elements(v_clean -> 'companions')), '[]'::jsonb));
  end if;
  perform set_config('app.m325_registration_context', v_context::text, true);
  return public.m310_submit_guest_fanbus_registration_before_m325_r1(v_clean,p_idempotency_key,p_source_hash);
end;
$$;

alter function app_private.api_fanbus_registration_create_manual(jsonb)
  rename to api_fanbus_registration_create_manual_before_m325_r1;
create function app_private.api_fanbus_registration_create_manual(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_key uuid; v_context jsonb; v_clean jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'FANBUS_MANUAL_REGISTRATION_INVALID_PAYLOAD' using errcode='22023';
  end if;
  begin v_key:=(p_payload->>'idempotencyKey')::uuid;
  exception when others then raise exception 'FANBUS_MANUAL_REGISTRATION_INVALID_PAYLOAD' using errcode='22023'; end;
  v_context:=jsonb_build_array(jsonb_build_object(
    'sequence',1,'boardingStopId',nullif(p_payload->>'boardingStopId',''),
    'operationalNote',nullif(btrim(coalesce(p_payload->>'operationalNote','')),'')
  ));
  perform app_private.m325_assert_idempotency(v_key,jsonb_build_object(
    'version',1,'source','MANUAL','actor',v_actor,'context',v_context
  ),p_payload?'boardingStopId' or p_payload?'operationalNote');
  v_clean:=p_payload-'boardingStopId'-'operationalNote';
  perform set_config('app.m325_registration_context',v_context::text,true);
  return app_private.api_fanbus_registration_create_manual_before_m325_r1(v_clean);
end;
$$;

create function app_private.api_fanbus_companion_duplicate_preview(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=app_private.require_active_user();
  v_trip uuid:=app_private.m325_parse_uuid(p_payload->>'tripId','FANBUS_COMPANION_PREVIEW_INVALID_PAYLOAD');
  v_participants jsonb:=p_payload->'participants';
  v_result jsonb:='[]'::jsonb; v_item jsonb; v_member uuid; v_first text; v_last text;
  v_status text; v_primary text;
begin
  if jsonb_typeof(v_participants)<>'array' or jsonb_array_length(v_participants) not between 1 and 19 then
    raise exception 'FANBUS_COMPANION_PREVIEW_INVALID_PAYLOAD' using errcode='22023';
  end if;
  v_primary:=case when exists(select 1 from app_modules.fanbus_registrations
    where trip_id=v_trip and portal_user_id=v_actor and status in('ACTIVE','WAITLISTED'))
    then 'ALREADY_REGISTERED' else 'READY' end;
  for v_item in select value from jsonb_array_elements(v_participants) loop
    v_member:=app_private.m325_parse_uuid(v_item->>'templateMemberId','FANBUS_COMPANION_PREVIEW_INVALID_PAYLOAD');
    if not exists(select 1 from app_modules.fanbus_companion_list_members member
      join app_modules.fanbus_companion_lists list on list.id=member.list_id
      where member.id=v_member and list.owner_user_id=v_actor) then
      raise exception 'FANBUS_TEMPLATE_MEMBER_FORBIDDEN' using errcode='42501';
    end if;
    v_first:=app_private.require_valid_name(app_private.clean_name(v_item->>'firstName'),'Vorname');
    v_last:=app_private.require_valid_name(app_private.clean_name(v_item->>'lastName'),'Nachname');
    v_status:=case
      when (select count(*) from jsonb_array_elements(v_participants) duplicate
        where duplicate.value->>'templateMemberId'=v_member::text)>1 then 'CONFLICT'
      when exists(select 1 from app_modules.fanbus_registrations registration
        where registration.trip_id=v_trip and registration.status in('ACTIVE','WAITLISTED')
          and registration.companion_list_member_id=v_member) then 'ALREADY_REGISTERED'
      when exists(select 1 from app_modules.fanbus_registrations registration
        where registration.trip_id=v_trip and registration.status in('ACTIVE','WAITLISTED')
          and lower(btrim(registration.first_name))=lower(btrim(v_first))
          and lower(btrim(registration.last_name))=lower(btrim(v_last))) then 'CONFLICT'
      else 'READY' end;
    v_result:=v_result||jsonb_build_array(jsonb_build_object(
      'templateMemberId',v_member,'status',v_status
    ));
  end loop;
  return jsonb_build_object('tripId',v_trip,'primaryStatus',v_primary,'members',v_result,
    'canSubmit',v_primary='READY' and not exists(select 1 from jsonb_array_elements(v_result) item
      where item.value->>'status'<>'READY'));
end;
$$;

create function app_private.api_fanbus_companion_booking_submit(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=app_private.require_active_user();
  v_list uuid:=app_private.m325_parse_uuid(p_payload->>'listId','FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD');
  v_trip uuid:=app_private.m325_parse_uuid(p_payload->>'tripId','FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD');
  v_selected jsonb:=p_payload->'participants'; v_members jsonb:='[]'::jsonb;
  v_item jsonb; v_member app_modules.fanbus_companion_list_members%rowtype;
  v_template uuid; v_trip_stop uuid; v_companion jsonb; v_requested jsonb;
begin
  if jsonb_typeof(v_selected)<>'array' or jsonb_array_length(v_selected) not between 1 and 19
     or not exists(select 1 from app_modules.fanbus_companion_lists
       where id=v_list and owner_user_id=v_actor) then
    raise exception 'FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD' using errcode='22023';
  end if;
  for v_item in select value from jsonb_array_elements(v_selected) loop
    v_template:=app_private.m325_parse_uuid(v_item->>'templateMemberId','FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD');
    v_trip_stop:=app_private.m325_parse_uuid(v_item->>'boardingStopId','FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD');
    if v_template is not null then
      select member.* into v_member
      from app_modules.fanbus_companion_list_members member
      where member.id=v_template and member.list_id=v_list;
      if not found then
        raise exception 'FANBUS_COMPANION_MEMBER_UNAVAILABLE' using errcode='42501';
      end if;
      if v_trip_stop is null and v_member.default_boarding_stop_id is not null then
        select id into v_trip_stop from app_modules.fanbus_trip_boarding_stops
        where trip_id=v_trip and boarding_stop_id=v_member.default_boarding_stop_id and is_active;
      end if;
      v_companion:=jsonb_build_object(
        'firstName',coalesce(nullif(btrim(v_item->>'firstName'),''),v_member.first_name),
        'lastName',coalesce(nullif(btrim(v_item->>'lastName'),''),v_member.last_name),
        'busPreference',coalesce(nullif(upper(btrim(v_item->>'busPreference')),''),v_member.default_bus_preference),
        'boardingStopId',v_trip_stop,
        'operationalNote',case when v_item ? 'operationalNote'
          then nullif(btrim(v_item->>'operationalNote'),'') else v_member.operational_note end,
        'templateMemberId',v_member.id
      );
    else
      v_companion:=jsonb_build_object(
        'firstName',v_item->>'firstName','lastName',v_item->>'lastName',
        'busPreference',v_item->>'busPreference','boardingStopId',v_trip_stop,
        'operationalNote',nullif(btrim(coalesce(v_item->>'operationalNote','')),'')
      );
    end if;
    if nullif(btrim(coalesce(v_item->>'email','')),'') is not null then
      v_companion:=v_companion||jsonb_build_object('email',v_item->>'email');
    end if;
    v_members:=v_members||jsonb_build_array(v_companion);
  end loop;
  v_requested:=jsonb_build_object(
    'tripId',v_trip,'busPreference',p_payload->>'busPreference',
    'boardingStopId',p_payload->>'boardingStopId','operationalNote',p_payload->>'operationalNote',
    'companions',v_members,'privacyConfirmed',p_payload->'privacyConfirmed',
    'termsConfirmed',p_payload->'termsConfirmed','idempotencyKey',p_payload->>'idempotencyKey'
  );
  return app_private.api_fanbus_self_register(v_requested);
end;
$$;

create function app_private.api_fanbus_companion_member_delete(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=app_private.require_active_user(); v_id uuid:=app_private.m325_parse_uuid(p_payload->>'id','FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD'); v_revision integer:=nullif(p_payload->>'expectedRevision','')::integer; v_list uuid; begin
  select m.list_id into v_list from app_modules.fanbus_companion_list_members m
  join app_modules.fanbus_companion_lists l on l.id=m.list_id
  where m.id=v_id and l.owner_user_id=v_actor for update of l;
  if not found then raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode='40001'; end if;
  delete from app_modules.fanbus_companion_list_members m where m.id=v_id and m.list_id=v_list and m.revision=v_revision;
  if not found then raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode='40001'; end if;
  update app_modules.fanbus_companion_list_members member
  set position=ordered.position,revision=member.revision+1
  from (select id,row_number() over(order by position,id)::integer position
    from app_modules.fanbus_companion_list_members where list_id=v_list) ordered
  where member.id=ordered.id;
  perform app_private.log_audit(v_actor,'FANBUS_COMPANION_MEMBER_DELETED','fanbus_companion_list_member',v_id::text,null,null,jsonb_build_object('memberId',v_id)); return jsonb_build_object('id',v_id);
end; $$;

create function app_private.api_fanbus_boarding_stops_reorder(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=app_private.require_capability('fanbus.manage'); v_ids jsonb:=p_payload->'ids';
begin
  if jsonb_typeof(v_ids)<>'array' or jsonb_array_length(v_ids)<>(select count(*) from app_modules.fanbus_boarding_stops)
     or (select count(distinct value) from jsonb_array_elements_text(v_ids))<>jsonb_array_length(v_ids)
     or exists(select 1 from jsonb_array_elements_text(v_ids) item where not exists(
       select 1 from app_modules.fanbus_boarding_stops where id=app_private.m325_parse_uuid(item.value,'FANBUS_BOARDING_STOP_REORDER_INVALID_PAYLOAD')
     )) then raise exception 'FANBUS_BOARDING_STOP_REORDER_INVALID_PAYLOAD' using errcode='22023'; end if;
  perform 1 from app_modules.fanbus_boarding_stops for update;
  update app_modules.fanbus_boarding_stops set position=position+100000;
  update app_modules.fanbus_boarding_stops stop set position=ordered.position,revision=stop.revision+1,updated_by=v_actor
  from (select app_private.m325_parse_uuid(value,'FANBUS_BOARDING_STOP_REORDER_INVALID_PAYLOAD') id,ordinality::integer position from jsonb_array_elements_text(v_ids) with ordinality) ordered where stop.id=ordered.id;
  return jsonb_build_object('updated',jsonb_array_length(v_ids));
end; $$;

create function app_private.api_fanbus_trip_boarding_stops_reorder(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=app_private.require_capability('fanbus.manage'); v_trip uuid:=app_private.m325_parse_uuid(p_payload->>'tripId','FANBUS_TRIP_BOARDING_STOP_REORDER_INVALID_PAYLOAD'); v_ids jsonb:=p_payload->'ids';
begin
  perform 1 from app_modules.fanbus_trips where id=v_trip for update;
  if not found or jsonb_typeof(v_ids)<>'array' or jsonb_array_length(v_ids)<>(select count(*) from app_modules.fanbus_trip_boarding_stops where trip_id=v_trip)
     or (select count(distinct value) from jsonb_array_elements_text(v_ids))<>jsonb_array_length(v_ids)
     or exists(select 1 from jsonb_array_elements_text(v_ids) item where not exists(
       select 1 from app_modules.fanbus_trip_boarding_stops where trip_id=v_trip and id=app_private.m325_parse_uuid(item.value,'FANBUS_TRIP_BOARDING_STOP_REORDER_INVALID_PAYLOAD')
     )) then raise exception 'FANBUS_TRIP_BOARDING_STOP_REORDER_INVALID_PAYLOAD' using errcode='22023'; end if;
  update app_modules.fanbus_trip_boarding_stops set position=position+100000 where trip_id=v_trip;
  update app_modules.fanbus_trip_boarding_stops stop set position=ordered.position,revision=stop.revision+1,updated_by=v_actor
  from (select app_private.m325_parse_uuid(value,'FANBUS_TRIP_BOARDING_STOP_REORDER_INVALID_PAYLOAD') id,ordinality::integer position from jsonb_array_elements_text(v_ids) with ordinality) ordered where stop.id=ordered.id and stop.trip_id=v_trip;
  return jsonb_build_object('tripId',v_trip,'updated',jsonb_array_length(v_ids));
end; $$;

create function app_private.api_fanbus_registration_operational_detail(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=app_private.require_capability('fanbus.registrations.manage'); v_id uuid:=app_private.m325_parse_uuid(p_payload->>'participantId','FANBUS_PARTICIPANT_OPERATIONAL_INVALID_PAYLOAD');
begin
  return coalesce((select jsonb_build_object('id',id,'tripId',trip_id,'tripBoardingStopId',trip_boarding_stop_id,'operationalNote',operational_note,'revision',revision) from app_modules.fanbus_registrations where id=v_id),jsonb_build_object());
end; $$;

alter function public.pd_api(text,jsonb) rename to pd_api_before_fanbus_operations_m325_r1;
create function public.pd_api(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_action text:=lower(btrim(coalesce(p_action,''))); v_data jsonb;
begin
  if auth.uid() is null then raise exception 'Anmeldung erforderlich.' using errcode='42501'; end if;
  case v_action
    when 'fanbus_companion_lists_list' then v_data:=app_private.api_fanbus_companion_lists_list();
    when 'fanbus_companion_list_upsert' then v_data:=app_private.api_fanbus_companion_list_upsert(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_companion_list_delete' then v_data:=app_private.api_fanbus_companion_list_delete(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_companion_member_upsert' then v_data:=app_private.api_fanbus_companion_member_upsert(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_companion_member_delete' then v_data:=app_private.api_fanbus_companion_member_delete(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_companion_members_reorder' then v_data:=app_private.api_fanbus_companion_members_reorder(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_boarding_stops_list' then v_data:=app_private.api_fanbus_boarding_stops_list();
    when 'fanbus_boarding_stop_upsert' then v_data:=app_private.api_fanbus_boarding_stop_upsert(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_boarding_stops_reorder' then v_data:=app_private.api_fanbus_boarding_stops_reorder(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_trip_boarding_stops_list' then v_data:=app_private.api_fanbus_trip_boarding_stops_list(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_trip_boarding_stop_upsert' then v_data:=app_private.api_fanbus_trip_boarding_stop_upsert(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_trip_boarding_stops_reorder' then v_data:=app_private.api_fanbus_trip_boarding_stops_reorder(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_bus_boarding_stops_list' then v_data:=app_private.api_fanbus_bus_boarding_stops_list(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_bus_boarding_stops_set' then v_data:=app_private.api_fanbus_bus_boarding_stops_set(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_registration_operational_detail' then v_data:=app_private.api_fanbus_registration_operational_detail(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_registration_operational_update' then v_data:=app_private.api_fanbus_registration_operational_update(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_registration_update_m325' then v_data:=app_private.api_fanbus_registration_update_m325(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_operations_snapshot' then v_data:=app_private.api_fanbus_operations_snapshot(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_checkin_set' then v_data:=app_private.api_fanbus_checkin_set(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_companion_duplicate_preview' then v_data:=app_private.api_fanbus_companion_duplicate_preview(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_companion_booking_submit' then v_data:=app_private.api_fanbus_companion_booking_submit(coalesce(p_payload,'{}'::jsonb));
    else return public.pd_api_before_fanbus_operations_m325_r1(p_action,p_payload);
  end case;
  return jsonb_build_object('ok',true,'data',v_data);
exception when others then
  return jsonb_build_object('ok',false,'error',jsonb_build_object('code',sqlstate,'message',sqlerrm));
end;
$$;

create function public.pd_public_fanbus_trip_boarding_stops(p_trip_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('stops', coalesce((select jsonb_agg(jsonb_build_object(
    'id', t.id, 'tripBoardingStopId', t.id, 'boardingStopId', t.boarding_stop_id,
    'label', s.label, 'address', s.address, 'departureAt', t.departure_at,
    'tripNote', t.trip_note, 'position', t.position) order by t.position, t.id)
    from app_modules.fanbus_trip_boarding_stops t
    join app_modules.fanbus_boarding_stops s on s.id=t.boarding_stop_id
    join app_modules.fanbus_trips trip on trip.id=t.trip_id
    join app_modules.events event on event.id=trip.event_id
    where t.trip_id=p_trip_id and t.is_active and trip.status='PUBLISHED' and event.visibility='PUBLIC'), '[]'::jsonb));
$$;

revoke all on table app_modules.fanbus_companion_lists, app_modules.fanbus_companion_list_members,
  app_modules.fanbus_boarding_stops, app_modules.fanbus_trip_boarding_stops,
  app_modules.fanbus_bus_boarding_stops, app_modules.fanbus_participant_checkins
from anon, authenticated;
revoke all on function public.pd_api_before_fanbus_operations_m325_r1(text,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.pd_api(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.pd_api(text,jsonb) to authenticated;
revoke all on function public.pd_public_fanbus_trip_boarding_stops(uuid) from public, anon, authenticated;
grant execute on function public.pd_public_fanbus_trip_boarding_stops(uuid) to anon, authenticated;
revoke all on function public.m310_submit_guest_fanbus_registration_before_m325_r1(jsonb,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.m310_submit_guest_fanbus_registration(jsonb,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.m310_submit_guest_fanbus_registration(jsonb,uuid,text) to service_role;

revoke all on function app_private.m325_assert_idempotency(uuid,jsonb,boolean),
  app_private.api_fanbus_self_register(jsonb),
  app_private.api_fanbus_registration_create_manual(jsonb),
  app_private.api_fanbus_companion_lists_list(),
  app_private.api_fanbus_companion_list_upsert(jsonb),
  app_private.api_fanbus_companion_list_delete(jsonb),
  app_private.api_fanbus_companion_member_upsert(jsonb),
  app_private.api_fanbus_companion_member_delete(jsonb),
  app_private.api_fanbus_companion_members_reorder(jsonb),
  app_private.api_fanbus_companion_duplicate_preview(jsonb),
  app_private.api_fanbus_companion_booking_submit(jsonb),
  app_private.api_fanbus_boarding_stops_list(),
  app_private.api_fanbus_boarding_stop_upsert(jsonb),
  app_private.api_fanbus_boarding_stops_reorder(jsonb),
  app_private.api_fanbus_trip_boarding_stops_list(jsonb),
  app_private.api_fanbus_trip_boarding_stop_upsert(jsonb),
  app_private.api_fanbus_trip_boarding_stops_reorder(jsonb),
  app_private.api_fanbus_bus_boarding_stops_list(jsonb),
  app_private.api_fanbus_bus_boarding_stops_set(jsonb),
  app_private.api_fanbus_registration_operational_detail(jsonb),
  app_private.api_fanbus_registration_operational_update(jsonb),
  app_private.api_fanbus_registration_update_m325(jsonb),
  app_private.api_fanbus_operations_snapshot(jsonb),
  app_private.api_fanbus_checkin_set(jsonb)
from public,anon,authenticated,service_role;
