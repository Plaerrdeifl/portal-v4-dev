-- Plaerrdeifl Digitalplattform V4
-- P300 / M326-R1 F1-F2: Stammfahrer, Personengruppen und Identitaetsaufloesung

begin;

create table app_modules.fanbus_regular_riders (
  id uuid primary key default extensions.gen_random_uuid(),
  first_name text not null check (length(btrim(first_name)) between 1 and 160),
  last_name text not null check (length(btrim(last_name)) between 1 and 160),
  email text check (
    email is null or (
      length(btrim(email)) between 3 and 320
      and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
  ),
  mobile text check (mobile is null or length(btrim(mobile)) between 3 and 40),
  default_boarding_stop_id uuid references app_modules.fanbus_boarding_stops(id)
    on delete set null,
  default_bus_preference text not null default 'EGAL'
    check (default_bus_preference in ('EGAL', 'RUHIG', 'PARTY')),
  linked_portal_user_id uuid references app_portal.users(id) on delete restrict,
  note text check (note is null or length(btrim(note)) <= 1000),
  is_active boolean not null default true,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null
);

create unique index fanbus_regular_riders_linked_portal_user_uidx
  on app_modules.fanbus_regular_riders(linked_portal_user_id)
  where linked_portal_user_id is not null;
create index fanbus_regular_riders_name_idx
  on app_modules.fanbus_regular_riders(lower(last_name), lower(first_name), id);

create table app_modules.fanbus_person_groups (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  note text check (note is null or length(btrim(note)) <= 1000),
  is_active boolean not null default true,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null
);
create unique index fanbus_person_groups_name_uidx
  on app_modules.fanbus_person_groups(lower(btrim(name)));

create table app_modules.fanbus_person_group_members (
  id uuid primary key default extensions.gen_random_uuid(),
  group_id uuid not null references app_modules.fanbus_person_groups(id)
    on delete cascade,
  position integer not null check (position > 0),
  portal_user_id uuid references app_portal.users(id) on delete restrict,
  member_id uuid references app_fanclub.members(id) on delete restrict,
  regular_rider_id uuid references app_modules.fanbus_regular_riders(id)
    on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_person_group_members_one_anchor_check check (
    num_nonnulls(portal_user_id, member_id, regular_rider_id) = 1
  ),
  constraint fanbus_person_group_members_group_position_uidx
    unique (group_id, position) deferrable initially deferred
);
create unique index fanbus_person_group_members_portal_uidx
  on app_modules.fanbus_person_group_members(group_id, portal_user_id)
  where portal_user_id is not null;
create unique index fanbus_person_group_members_member_uidx
  on app_modules.fanbus_person_group_members(group_id, member_id)
  where member_id is not null;
create unique index fanbus_person_group_members_regular_uidx
  on app_modules.fanbus_person_group_members(group_id, regular_rider_id)
  where regular_rider_id is not null;

alter table app_modules.fanbus_registrations
  add column regular_rider_id uuid references app_modules.fanbus_regular_riders(id)
    on delete set null;
create index fanbus_registrations_regular_rider_idx
  on app_modules.fanbus_registrations(regular_rider_id)
  where regular_rider_id is not null;
create unique index fanbus_registrations_live_regular_rider_uidx
  on app_modules.fanbus_registrations(trip_id, regular_rider_id)
  where status in ('ACTIVE', 'WAITLISTED') and regular_rider_id is not null;

create trigger fanbus_regular_riders_set_updated_at
before update on app_modules.fanbus_regular_riders
for each row execute function app_private.set_updated_at();
create trigger fanbus_person_groups_set_updated_at
before update on app_modules.fanbus_person_groups
for each row execute function app_private.set_updated_at();

alter table app_modules.fanbus_regular_riders enable row level security;
alter table app_modules.fanbus_person_groups enable row level security;
alter table app_modules.fanbus_person_group_members enable row level security;
revoke all on table
  app_modules.fanbus_regular_riders,
  app_modules.fanbus_person_groups,
  app_modules.fanbus_person_group_members
from public, anon, authenticated, service_role;

create function app_private.m326_uuid(p_value text, p_error text)
returns uuid
language plpgsql immutable set search_path = ''
as $function$
begin
  if nullif(btrim(coalesce(p_value, '')), '') is null then
    return null;
  end if;
  return btrim(p_value)::uuid;
exception when others then
  raise exception '%', p_error using errcode = '22023';
end;
$function$;

create function app_private.fanbus_effective_person(
  p_portal_user_id uuid default null,
  p_member_id uuid default null,
  p_regular_rider_id uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_portal app_portal.users%rowtype;
  v_member app_fanclub.members%rowtype;
  v_rider app_modules.fanbus_regular_riders%rowtype;
  v_linked uuid;
  v_anchor_type text;
  v_anchor_id uuid;
begin
  if num_nonnulls(p_portal_user_id, p_member_id, p_regular_rider_id) <> 1 then
    raise exception 'FANBUS_PERSON_ANCHOR_INVALID' using errcode = '22023';
  end if;

  if p_portal_user_id is not null then
    v_anchor_type := 'PORTAL_USER';
    v_anchor_id := p_portal_user_id;
    select * into v_portal from app_portal.users where id = p_portal_user_id;
    if not found then
      return jsonb_build_object(
        'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
        'available', false, 'reason', 'PORTAL_USER_INACTIVE'
      );
    end if;
    if v_portal.status <> 'ACTIVE' then
      return jsonb_build_object(
        'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
        'available', false, 'reason', 'PORTAL_USER_INACTIVE',
        'firstName', btrim(v_portal.first_name), 'lastName', btrim(v_portal.last_name)
      );
    end if;
    return jsonb_build_object(
      'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
      'available', true, 'effectiveType', 'PORTAL_USER',
      'effectiveId', v_portal.id, 'identityKey', 'PORTAL:' || v_portal.id,
      'portalUserId', v_portal.id,
      'firstName', btrim(v_portal.first_name),
      'lastName', btrim(v_portal.last_name),
      'email', nullif(lower(btrim(v_portal.email)), '')
    );
  end if;

  if p_member_id is not null then
    v_anchor_type := 'MEMBER';
    v_anchor_id := p_member_id;
    select * into v_member from app_fanclub.members where id = p_member_id;
    if not found then
      return jsonb_build_object(
        'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
        'available', false, 'reason', 'MEMBER_INACTIVE'
      );
    end if;
    if v_member.status <> 'ACTIVE' then
      return jsonb_build_object(
        'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
        'available', false, 'reason', 'MEMBER_INACTIVE',
        'firstName', btrim(v_member.first_name), 'lastName', btrim(v_member.last_name)
      );
    end if;
    select portal.id into v_linked
    from app_portal.user_member_links as link
    join app_portal.users as portal
      on portal.id = link.user_id and portal.status = 'ACTIVE'
    where link.member_id = p_member_id;
    if v_linked is not null then
      select * into v_portal from app_portal.users where id = v_linked;
      return jsonb_build_object(
        'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
        'available', true, 'effectiveType', 'PORTAL_USER',
        'effectiveId', v_portal.id, 'identityKey', 'PORTAL:' || v_portal.id,
        'portalUserId', v_portal.id, 'memberId', v_member.id,
        'firstName', btrim(v_portal.first_name),
        'lastName', btrim(v_portal.last_name),
        'email', case
          when nullif(lower(btrim(v_member.email)), '')
            ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
            then nullif(lower(btrim(v_member.email)), '')
          else nullif(lower(btrim(v_portal.email)), '') end
      );
    end if;
    return jsonb_build_object(
      'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
      'available', true, 'effectiveType', 'MEMBER',
      'effectiveId', v_member.id, 'identityKey', 'MEMBER:' || v_member.id,
      'memberId', v_member.id,
      'firstName', btrim(v_member.first_name),
      'lastName', btrim(v_member.last_name),
      'email', case when nullif(lower(btrim(v_member.email)), '')
        ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
        then nullif(lower(btrim(v_member.email)), '') end
    );
  end if;

  v_anchor_type := 'REGULAR_RIDER';
  v_anchor_id := p_regular_rider_id;
  select * into v_rider from app_modules.fanbus_regular_riders
  where id = p_regular_rider_id;
  if not found then
    return jsonb_build_object(
      'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
      'available', false, 'reason', 'REGULAR_RIDER_INACTIVE'
    );
  end if;
  if not v_rider.is_active then
    return jsonb_build_object(
      'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
      'available', false, 'reason', 'REGULAR_RIDER_INACTIVE',
      'firstName', btrim(v_rider.first_name), 'lastName', btrim(v_rider.last_name)
    );
  end if;
  if v_rider.linked_portal_user_id is not null then
    select * into v_portal from app_portal.users
    where id = v_rider.linked_portal_user_id and status = 'ACTIVE';
    if found then
      return jsonb_build_object(
        'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
        'available', true, 'effectiveType', 'PORTAL_USER',
        'effectiveId', v_portal.id, 'identityKey', 'PORTAL:' || v_portal.id,
        'portalUserId', v_portal.id, 'regularRiderId', v_rider.id,
        'firstName', btrim(v_portal.first_name),
        'lastName', btrim(v_portal.last_name),
        'email', nullif(lower(btrim(v_portal.email)), ''),
        'defaultBoardingStopId', v_rider.default_boarding_stop_id,
        'defaultBusPreference', v_rider.default_bus_preference
      );
    end if;
  end if;
  return jsonb_build_object(
    'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
    'available', true, 'effectiveType', 'REGULAR_RIDER',
    'effectiveId', v_rider.id,
    'identityKey', 'REGULAR_RIDER:' || v_rider.id,
    'regularRiderId', v_rider.id,
    'firstName', btrim(v_rider.first_name),
    'lastName', btrim(v_rider.last_name),
    'email', nullif(lower(btrim(v_rider.email)), ''),
    'defaultBoardingStopId', v_rider.default_boarding_stop_id,
    'defaultBusPreference', v_rider.default_bus_preference
  );
end;
$function$;

create function app_private.api_fanbus_regular_riders_list(p_payload jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_query text := lower(btrim(coalesce(p_payload ->> 'query', '')));
  v_include_inactive boolean := coalesce((p_payload ->> 'includeInactive')::boolean, false);
begin
  if jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object'
     or length(v_query) > 120
     or exists (
       select 1 from jsonb_object_keys(coalesce(p_payload, '{}'::jsonb)) as key(name)
       where key.name <> all(array['query', 'includeInactive'])
     ) then
    raise exception 'FANBUS_REGULAR_RIDER_LIST_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  return jsonb_build_object('regularRiders', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', rider.id, 'firstName', rider.first_name, 'lastName', rider.last_name,
      'defaultBoardingStopId', rider.default_boarding_stop_id,
      'defaultBusPreference', rider.default_bus_preference,
      'linkedPortalUserId', rider.linked_portal_user_id,
      'effectiveIdentityKey', rider.effective_person->>'identityKey',
      'effectiveFirstName', rider.effective_person->>'firstName',
      'effectiveLastName', rider.effective_person->>'lastName',
      'isActive', rider.is_active, 'revision', rider.revision
    ) order by lower(rider.last_name), lower(rider.first_name), rider.id)
    from (
      select item.*,
        app_private.fanbus_effective_person(null,null,item.id) as effective_person
      from app_modules.fanbus_regular_riders as item
      where (v_include_inactive or item.is_active)
        and (v_query = '' or lower(item.first_name || ' ' || item.last_name) like '%' || v_query || '%')
      order by lower(item.last_name), lower(item.first_name), item.id
      limit 100
    ) as rider
  ), '[]'::jsonb));
end;
$function$;

create function app_private.api_fanbus_regular_rider_detail(p_payload jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_id uuid := app_private.m326_uuid(p_payload ->> 'id', 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD');
  v_result jsonb;
begin
  if v_id is null or jsonb_typeof(p_payload) <> 'object'
     or (select count(*) from jsonb_object_keys(p_payload)) <> 1 then
    raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  select jsonb_build_object(
    'id', rider.id, 'firstName', rider.first_name, 'lastName', rider.last_name,
    'email', rider.email, 'mobile', rider.mobile,
    'defaultBoardingStopId', rider.default_boarding_stop_id,
    'defaultBusPreference', rider.default_bus_preference,
    'linkedPortalUserId', rider.linked_portal_user_id,
    'note', rider.note, 'isActive', rider.is_active, 'revision', rider.revision
  ) into v_result from app_modules.fanbus_regular_riders as rider where rider.id = v_id;
  if v_result is null then
    raise exception 'FANBUS_REGULAR_RIDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_result;
end;
$function$;

create function app_private.m326_regular_rider_values(p_payload jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_first text := app_private.require_valid_name(app_private.clean_name(p_payload ->> 'firstName'), 'Vorname');
  v_last text := app_private.require_valid_name(app_private.clean_name(p_payload ->> 'lastName'), 'Nachname');
  v_email text := nullif(lower(btrim(coalesce(p_payload ->> 'email', ''))), '');
  v_mobile text := nullif(btrim(coalesce(p_payload ->> 'mobile', '')), '');
  v_note text := nullif(btrim(coalesce(p_payload ->> 'note', '')), '');
  v_stop uuid := app_private.m326_uuid(p_payload ->> 'defaultBoardingStopId', 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD');
  v_preference text := upper(btrim(coalesce(p_payload ->> 'defaultBusPreference', 'EGAL')));
begin
  if v_preference not in ('EGAL', 'RUHIG', 'PARTY')
     or (v_email is not null and (length(v_email) not between 3 and 320
       or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
     or (v_mobile is not null and length(v_mobile) not between 3 and 40)
     or (v_note is not null and length(v_note) > 1000)
     or (v_stop is not null and not exists (
       select 1 from app_modules.fanbus_boarding_stops where id = v_stop
     )) then
    raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'firstName', v_first, 'lastName', v_last, 'email', v_email,
    'mobile', v_mobile, 'note', v_note, 'defaultBoardingStopId', v_stop,
    'defaultBusPreference', v_preference
  );
end;
$function$;

create function app_private.api_fanbus_regular_rider_create(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_values jsonb;
  v_id uuid;
begin
  if jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['firstName', 'lastName']
     or exists (select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array['firstName','lastName','email','mobile','defaultBoardingStopId','defaultBusPreference','note'])) then
    raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  v_values := app_private.m326_regular_rider_values(p_payload);
  insert into app_modules.fanbus_regular_riders(
    first_name,last_name,email,mobile,default_boarding_stop_id,
    default_bus_preference,note,created_by,updated_by
  ) values (
    v_values->>'firstName',v_values->>'lastName',v_values->>'email',v_values->>'mobile',
    nullif(v_values->>'defaultBoardingStopId','')::uuid,v_values->>'defaultBusPreference',
    v_values->>'note',v_actor,v_actor
  ) returning id into v_id;
  perform app_private.log_audit(v_actor,'FANBUS_REGULAR_RIDER_CREATED','fanbus_regular_rider',v_id::text,
    null,jsonb_build_object('revision',1,'isActive',true),jsonb_build_object('regularRiderId',v_id));
  return app_private.api_fanbus_regular_rider_detail(jsonb_build_object('id',v_id));
end;
$function$;

create function app_private.api_fanbus_regular_rider_update(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_id uuid := app_private.m326_uuid(p_payload->>'id','FANBUS_REGULAR_RIDER_INVALID_PAYLOAD');
  v_expected integer;
  v_old app_modules.fanbus_regular_riders%rowtype;
  v_values jsonb;
begin
  begin v_expected := (p_payload->>'expectedRevision')::integer;
  exception when others then raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode='22023'; end;
  if v_id is null or v_expected is null
     or exists (select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array['id','expectedRevision','firstName','lastName','email','mobile','defaultBoardingStopId','defaultBusPreference','note'])) then
    raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select * into v_old from app_modules.fanbus_regular_riders where id=v_id for update;
  if not found then raise exception 'FANBUS_REGULAR_RIDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.revision<>v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
  v_values:=app_private.m326_regular_rider_values(jsonb_build_object(
    'firstName',coalesce(p_payload->>'firstName',v_old.first_name),
    'lastName',coalesce(p_payload->>'lastName',v_old.last_name),
    'email',case when p_payload?'email' then p_payload->'email' else to_jsonb(v_old.email) end,
    'mobile',case when p_payload?'mobile' then p_payload->'mobile' else to_jsonb(v_old.mobile) end,
    'defaultBoardingStopId',case when p_payload?'defaultBoardingStopId' then p_payload->'defaultBoardingStopId' else to_jsonb(v_old.default_boarding_stop_id) end,
    'defaultBusPreference',coalesce(p_payload->>'defaultBusPreference',v_old.default_bus_preference),
    'note',case when p_payload?'note' then p_payload->'note' else to_jsonb(v_old.note) end
  ));
  update app_modules.fanbus_regular_riders set
    first_name=v_values->>'firstName',last_name=v_values->>'lastName',email=v_values->>'email',
    mobile=v_values->>'mobile',default_boarding_stop_id=nullif(v_values->>'defaultBoardingStopId','')::uuid,
    default_bus_preference=v_values->>'defaultBusPreference',note=v_values->>'note',
    revision=revision+1,updated_by=v_actor where id=v_id;
  perform app_private.log_audit(v_actor,'FANBUS_REGULAR_RIDER_UPDATED','fanbus_regular_rider',v_id::text,
    jsonb_build_object('revision',v_old.revision),jsonb_build_object('revision',v_old.revision+1),
    jsonb_build_object('regularRiderId',v_id));
  return app_private.api_fanbus_regular_rider_detail(jsonb_build_object('id',v_id));
end;
$function$;

create function app_private.api_fanbus_regular_rider_deactivate(p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_id uuid := app_private.m326_uuid(p_payload->>'id','FANBUS_REGULAR_RIDER_INVALID_PAYLOAD');
  v_expected integer;
  v_old app_modules.fanbus_regular_riders%rowtype;
begin
  begin v_expected:=(p_payload->>'expectedRevision')::integer;
  exception when others then raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode='22023'; end;
  if v_id is null or v_expected is null
     or not p_payload ?& array['id','expectedRevision']
     or exists (select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array['id','expectedRevision'])) then
    raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select * into v_old from app_modules.fanbus_regular_riders where id=v_id for update;
  if not found then raise exception 'FANBUS_REGULAR_RIDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.revision<>v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
  if not v_old.is_active then return app_private.api_fanbus_regular_rider_detail(jsonb_build_object('id',v_id)); end if;
  update app_modules.fanbus_regular_riders set is_active=false,revision=revision+1,updated_by=v_actor where id=v_id;
  perform app_private.log_audit(v_actor,'FANBUS_REGULAR_RIDER_DEACTIVATED','fanbus_regular_rider',v_id::text,
    jsonb_build_object('revision',v_old.revision,'isActive',true),
    jsonb_build_object('revision',v_old.revision+1,'isActive',false),jsonb_build_object('regularRiderId',v_id));
  return app_private.api_fanbus_regular_rider_detail(jsonb_build_object('id',v_id));
end;
$function$;

create function app_private.m326_regular_rider_link_change(p_payload jsonb,p_mode text)
returns jsonb
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_id uuid := app_private.m326_uuid(p_payload->>'regularRiderId','FANBUS_REGULAR_RIDER_LINK_INVALID_PAYLOAD');
  v_portal uuid := app_private.m326_uuid(p_payload->>'portalUserId','FANBUS_REGULAR_RIDER_LINK_INVALID_PAYLOAD');
  v_expected integer;
  v_old app_modules.fanbus_regular_riders%rowtype;
begin
  begin v_expected:=(p_payload->>'expectedRevision')::integer;
  exception when others then raise exception 'FANBUS_REGULAR_RIDER_LINK_INVALID_PAYLOAD' using errcode='22023'; end;
  if v_id is null or v_expected is null or p_mode not in('LINK','UNLINK','RELINK')
     or (p_mode in('LINK','RELINK') and v_portal is null)
     or (p_mode='UNLINK' and p_payload?'portalUserId')
     or not p_payload ?& array['regularRiderId','expectedRevision']
     or (p_mode='UNLINK' and exists (
       select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array['regularRiderId','expectedRevision'])
     ))
     or (p_mode in('LINK','RELINK') and exists (
       select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array['regularRiderId','portalUserId','expectedRevision'])
     )) then
    raise exception 'FANBUS_REGULAR_RIDER_LINK_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select * into v_old from app_modules.fanbus_regular_riders where id=v_id for update;
  if not found then raise exception 'FANBUS_REGULAR_RIDER_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.revision<>v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
  if (p_mode='LINK' and v_old.linked_portal_user_id is not null)
     or (p_mode in('UNLINK','RELINK') and v_old.linked_portal_user_id is null)
     or (p_mode='RELINK' and v_old.linked_portal_user_id=v_portal) then
    raise exception 'FANBUS_REGULAR_RIDER_LINK_STATE_INVALID' using errcode='22023';
  end if;
  if p_mode in('LINK','RELINK') then
    perform 1 from app_portal.users where id=v_portal and status='ACTIVE' for share;
    if not found then raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode='22023'; end if;
    if exists(select 1 from app_modules.fanbus_regular_riders
      where linked_portal_user_id=v_portal and id<>v_id) then
      raise exception 'FANBUS_REGULAR_RIDER_PORTAL_LINK_CONFLICT' using errcode='23505';
    end if;
  end if;
  update app_modules.fanbus_regular_riders set
    linked_portal_user_id=case when p_mode='UNLINK' then null else v_portal end,
    revision=revision+1,updated_by=v_actor where id=v_id;
  perform app_private.log_audit(v_actor,'FANBUS_REGULAR_RIDER_'||p_mode,'fanbus_regular_rider',v_id::text,
    jsonb_build_object('revision',v_old.revision,'portalUserId',v_old.linked_portal_user_id),
    jsonb_build_object('revision',v_old.revision+1,'portalUserId',case when p_mode='UNLINK' then null else v_portal end),
    jsonb_build_object(
      'regularRiderId',v_id,'linkOperation',p_mode,
      'oldPortalUserId',v_old.linked_portal_user_id,
      'newPortalUserId',case when p_mode='UNLINK' then null else v_portal end
    ));
  return app_private.api_fanbus_regular_rider_detail(jsonb_build_object('id',v_id));
end;
$function$;

create function app_private.api_fanbus_regular_rider_link(p_payload jsonb) returns jsonb
language sql security definer set search_path='' as $function$
  select app_private.m326_regular_rider_link_change(p_payload,'LINK')
$function$;
create function app_private.api_fanbus_regular_rider_unlink(p_payload jsonb) returns jsonb
language sql security definer set search_path='' as $function$
  select app_private.m326_regular_rider_link_change(p_payload,'UNLINK')
$function$;
create function app_private.api_fanbus_regular_rider_relink(p_payload jsonb) returns jsonb
language sql security definer set search_path='' as $function$
  select app_private.m326_regular_rider_link_change(p_payload,'RELINK')
$function$;

create function app_private.fanbus_person_group_projection(p_group_id uuid,p_trip_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path=''
as $function$
declare
  v_group app_modules.fanbus_person_groups%rowtype;
  v_members jsonb:='[]'::jsonb;
  v_member record;
  v_person jsonb;
  v_seen text[]:=array[]::text[];
  v_key text;
  v_conflict boolean;
  v_trip_stop uuid;
begin
  select * into v_group from app_modules.fanbus_person_groups where id=p_group_id;
  if not found then raise exception 'FANBUS_PERSON_GROUP_NOT_FOUND' using errcode='P0002'; end if;
  for v_member in select * from app_modules.fanbus_person_group_members
    where group_id=p_group_id order by position,id
  loop
    v_person:=app_private.fanbus_effective_person(v_member.portal_user_id,v_member.member_id,v_member.regular_rider_id);
    v_key:=v_person->>'identityKey';
    v_conflict:=v_key is not null and v_key=any(v_seen);
    if v_key is not null then v_seen:=array_append(v_seen,v_key); end if;
    v_trip_stop:=null;
    if p_trip_id is not null and nullif(v_person->>'defaultBoardingStopId','') is not null then
      select stop.id into v_trip_stop from app_modules.fanbus_trip_boarding_stops as stop
      where stop.trip_id=p_trip_id
        and stop.boarding_stop_id=(v_person->>'defaultBoardingStopId')::uuid
        and stop.is_active;
    end if;
    v_members:=v_members||jsonb_build_array(v_person||jsonb_build_object(
      'groupMemberId',v_member.id,'position',v_member.position,
      'conflict',v_conflict,'tripBoardingStopId',v_trip_stop
    ));
  end loop;
  if exists(select 1 from jsonb_array_elements(v_members) as left_item
    join jsonb_array_elements(v_members) as right_item
      on left_item.value->>'identityKey'=right_item.value->>'identityKey'
     and (left_item.value->>'groupMemberId')<(right_item.value->>'groupMemberId')) then
    v_members:=coalesce((select jsonb_agg(item.value||jsonb_build_object('conflict',
      (select count(*) from jsonb_array_elements(v_members) other
       where other.value->>'identityKey'=item.value->>'identityKey')>1) order by (item.value->>'position')::integer)
      from jsonb_array_elements(v_members) item),'[]'::jsonb);
  end if;
  return jsonb_build_object('id',v_group.id,'name',v_group.name,'note',v_group.note,
    'isActive',v_group.is_active,'revision',v_group.revision,'tripId',p_trip_id,
    'members',v_members,'totalCount',jsonb_array_length(v_members),
    'availableCount',(select count(*) from jsonb_array_elements(v_members) item
      where (item.value->>'available')::boolean and not (item.value->>'conflict')::boolean),
    'hasConflicts',exists(select 1 from jsonb_array_elements(v_members) item
      where (item.value->>'conflict')::boolean));
end;
$function$;

create function app_private.api_fanbus_person_groups_list(p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_include boolean:=coalesce((p_payload->>'includeInactive')::boolean,false);
begin
  if jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object'
     or exists(select 1 from jsonb_object_keys(coalesce(p_payload,'{}'::jsonb)) as key(name)
       where key.name<>'includeInactive') then
    raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end if;
  return jsonb_build_object('groups',coalesce((select jsonb_agg(jsonb_build_object(
    'id',g.id,'name',g.name,'note',g.note,'isActive',g.is_active,'revision',g.revision,
    'memberCount',(select count(*) from app_modules.fanbus_person_group_members m where m.group_id=g.id)
  ) order by lower(g.name),g.id) from app_modules.fanbus_person_groups g
  where v_include or g.is_active),'[]'::jsonb));
end;
$function$;

create function app_private.api_fanbus_person_group_detail(p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_id uuid:=app_private.m326_uuid(p_payload->>'id','FANBUS_PERSON_GROUP_INVALID_PAYLOAD');
begin
  if v_id is null or not p_payload?'id'
     or exists(select 1 from jsonb_object_keys(p_payload) as key(name) where key.name<>'id') then
    raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end if;
  return app_private.fanbus_person_group_projection(v_id,null);
end;
$function$;

create function app_private.api_fanbus_person_group_resolve(p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_id uuid:=app_private.m326_uuid(p_payload->>'id','FANBUS_PERSON_GROUP_INVALID_PAYLOAD');
  v_trip uuid:=app_private.m326_uuid(p_payload->>'tripId','FANBUS_PERSON_GROUP_INVALID_PAYLOAD');
begin
  if v_id is null or v_trip is null or not p_payload?&array['id','tripId']
     or exists(select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name<>all(array['id','tripId']))
     or not exists(select 1 from app_modules.fanbus_trips where id=v_trip) then
    raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end if;
  return app_private.fanbus_person_group_projection(v_id,v_trip);
end;
$function$;

create function app_private.api_fanbus_person_group_create(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_name text:=nullif(btrim(coalesce(p_payload->>'name','')),'');
  v_note text:=nullif(btrim(coalesce(p_payload->>'note','')),'');
  v_id uuid;
begin
  if v_name is null or length(v_name)>120 or (v_note is not null and length(v_note)>1000)
     or not p_payload?'name'
     or exists(select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name<>all(array['name','note'])) then
    raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end if;
  insert into app_modules.fanbus_person_groups(name,note,created_by,updated_by)
  values(v_name,v_note,v_actor,v_actor) returning id into v_id;
  perform app_private.log_audit(v_actor,'FANBUS_PERSON_GROUP_CREATED','fanbus_person_group',v_id::text,
    null,jsonb_build_object('revision',1,'isActive',true),jsonb_build_object('groupId',v_id));
  return app_private.fanbus_person_group_projection(v_id,null);
end;
$function$;

create function app_private.api_fanbus_person_group_update(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_id uuid:=app_private.m326_uuid(p_payload->>'id','FANBUS_PERSON_GROUP_INVALID_PAYLOAD');
  v_expected integer;
  v_old app_modules.fanbus_person_groups%rowtype;
  v_name text;
  v_note text;
begin
  begin v_expected:=(p_payload->>'expectedRevision')::integer;
  exception when others then raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023'; end;
  if v_id is null or v_expected is null or not p_payload?&array['id','expectedRevision']
     or exists(select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name<>all(array['id','expectedRevision','name','note'])) then
    raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select * into v_old from app_modules.fanbus_person_groups where id=v_id for update;
  if not found then raise exception 'FANBUS_PERSON_GROUP_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.revision<>v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
  v_name:=coalesce(nullif(btrim(p_payload->>'name'),''),v_old.name);
  v_note:=case when p_payload?'note' then nullif(btrim(p_payload->>'note'),'') else v_old.note end;
  if length(v_name)>120 or (v_note is not null and length(v_note)>1000) then
    raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end if;
  update app_modules.fanbus_person_groups set name=v_name,note=v_note,revision=revision+1,updated_by=v_actor where id=v_id;
  perform app_private.log_audit(v_actor,'FANBUS_PERSON_GROUP_UPDATED','fanbus_person_group',v_id::text,
    jsonb_build_object('revision',v_old.revision),jsonb_build_object('revision',v_old.revision+1),jsonb_build_object('groupId',v_id));
  return app_private.fanbus_person_group_projection(v_id,null);
end;
$function$;

create function app_private.api_fanbus_person_group_deactivate(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_id uuid:=app_private.m326_uuid(p_payload->>'id','FANBUS_PERSON_GROUP_INVALID_PAYLOAD');
  v_expected integer;
  v_old app_modules.fanbus_person_groups%rowtype;
begin
  begin v_expected:=(p_payload->>'expectedRevision')::integer;
  exception when others then raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023'; end;
  if v_id is null or v_expected is null or not p_payload?&array['id','expectedRevision']
     or exists(select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name<>all(array['id','expectedRevision'])) then
    raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select * into v_old from app_modules.fanbus_person_groups where id=v_id for update;
  if not found then raise exception 'FANBUS_PERSON_GROUP_NOT_FOUND' using errcode='P0002'; end if;
  if v_old.revision<>v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
  if v_old.is_active then
    update app_modules.fanbus_person_groups set is_active=false,revision=revision+1,updated_by=v_actor where id=v_id;
    perform app_private.log_audit(v_actor,'FANBUS_PERSON_GROUP_DEACTIVATED','fanbus_person_group',v_id::text,
      jsonb_build_object('revision',v_old.revision,'isActive',true),
      jsonb_build_object('revision',v_old.revision+1,'isActive',false),jsonb_build_object('groupId',v_id));
  end if;
  return app_private.fanbus_person_group_projection(v_id,null);
end;
$function$;

create function app_private.api_fanbus_person_group_members_replace(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_actor uuid:=app_private.require_capability('fanbus.registrations.manage');
  v_id uuid:=app_private.m326_uuid(p_payload->>'id','FANBUS_PERSON_GROUP_INVALID_PAYLOAD');
  v_expected integer;
  v_items jsonb:=p_payload->'members';
  v_group app_modules.fanbus_person_groups%rowtype;
  v_item jsonb;
  v_position integer:=0;
  v_portal uuid;
  v_member uuid;
  v_rider uuid;
  v_person jsonb;
  v_anchor_type text;
  v_anchor_id uuid;
  v_anchor_key text;
  v_old_anchor_keys text[]:=array[]::text[];
  v_old_members jsonb:='[]'::jsonb;
  v_new_members jsonb:='[]'::jsonb;
  v_member_id uuid;
  v_audit jsonb;
begin
  begin v_expected:=(p_payload->>'expectedRevision')::integer;
  exception when others then raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023'; end;
  if v_id is null or v_expected is null or not p_payload?&array['id','expectedRevision','members']
     or exists(select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name<>all(array['id','expectedRevision','members']))
     or jsonb_typeof(v_items)<>'array' or jsonb_array_length(v_items)>50 then
    raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023';
  end if;
  select * into v_group from app_modules.fanbus_person_groups where id=v_id for update;
  if not found then raise exception 'FANBUS_PERSON_GROUP_NOT_FOUND' using errcode='P0002'; end if;
  if v_group.revision<>v_expected then raise exception 'STALE_REVISION' using errcode='40001'; end if;
  if not v_group.is_active then raise exception 'FANBUS_PERSON_GROUP_INACTIVE' using errcode='22023'; end if;
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'groupMemberId',existing.id,
      'anchorType',case when existing.portal_user_id is not null then 'PORTAL_USER'
        when existing.member_id is not null then 'MEMBER' else 'REGULAR_RIDER' end,
      'anchorId',coalesce(existing.portal_user_id,existing.member_id,existing.regular_rider_id)
    ) order by existing.position,existing.id),'[]'::jsonb),
    coalesce(array_agg(
      (case when existing.portal_user_id is not null then 'PORTAL_USER'
        when existing.member_id is not null then 'MEMBER' else 'REGULAR_RIDER' end)
      ||':'||coalesce(existing.portal_user_id,existing.member_id,existing.regular_rider_id)::text
    ),array[]::text[])
  into v_old_members,v_old_anchor_keys
  from app_modules.fanbus_person_group_members existing where existing.group_id=v_id;
  delete from app_modules.fanbus_person_group_members where group_id=v_id;
  for v_item in select value from jsonb_array_elements(v_items) loop
    v_position:=v_position+1;
    if jsonb_typeof(v_item)<>'object'
       or exists(select 1 from jsonb_object_keys(v_item) as key(name)
         where key.name<>all(array['portalUserId','memberId','regularRiderId'])) then
      raise exception 'FANBUS_PERSON_GROUP_INVALID_PAYLOAD' using errcode='22023';
    end if;
    v_portal:=app_private.m326_uuid(v_item->>'portalUserId','FANBUS_PERSON_GROUP_INVALID_PAYLOAD');
    v_member:=app_private.m326_uuid(v_item->>'memberId','FANBUS_PERSON_GROUP_INVALID_PAYLOAD');
    v_rider:=app_private.m326_uuid(v_item->>'regularRiderId','FANBUS_PERSON_GROUP_INVALID_PAYLOAD');
    if num_nonnulls(v_portal,v_member,v_rider)<>1 then
      raise exception 'FANBUS_PERSON_GROUP_MEMBER_ANCHOR_INVALID' using errcode='22023';
    end if;
    v_anchor_type:=case when v_portal is not null then 'PORTAL_USER'
      when v_member is not null then 'MEMBER' else 'REGULAR_RIDER' end;
    v_anchor_id:=coalesce(v_portal,v_member,v_rider);
    v_anchor_key:=v_anchor_type||':'||v_anchor_id::text;
    v_person:=app_private.fanbus_effective_person(v_portal,v_member,v_rider);
    if (v_person->>'available')::boolean is distinct from true
       and not v_anchor_key=any(v_old_anchor_keys) then
      raise exception 'FANBUS_PERSON_GROUP_MEMBER_UNAVAILABLE' using errcode='22023';
    end if;
    insert into app_modules.fanbus_person_group_members(
      group_id,position,portal_user_id,member_id,regular_rider_id,created_by
    ) values(v_id,v_position,v_portal,v_member,v_rider,v_actor) returning id into v_member_id;
    v_new_members:=v_new_members||jsonb_build_array(jsonb_build_object(
      'groupMemberId',v_member_id,'anchorType',v_anchor_type,'anchorId',v_anchor_id
    ));
  end loop;
  update app_modules.fanbus_person_groups set revision=revision+1,updated_by=v_actor where id=v_id;
  for v_audit in select value from jsonb_array_elements(v_old_members) loop
    v_audit:=v_audit||jsonb_build_object('groupId',v_id);
    perform app_private.log_audit(v_actor,'FANBUS_PERSON_GROUP_MEMBER_REMOVED','fanbus_person_group_member',v_audit->>'groupMemberId',
      v_audit,null,v_audit);
  end loop;
  for v_audit in select value from jsonb_array_elements(v_new_members) loop
    v_audit:=v_audit||jsonb_build_object('groupId',v_id);
    perform app_private.log_audit(v_actor,'FANBUS_PERSON_GROUP_MEMBER_ADDED','fanbus_person_group_member',v_audit->>'groupMemberId',
      null,v_audit,v_audit);
  end loop;
  return app_private.fanbus_person_group_projection(v_id,null);
end;
$function$;

-- Additive M900 action inventory, READ classification and dispatcher.
alter function app_private.pd_api_current_actions() rename to pd_api_current_actions_before_m326_r1;
create function app_private.pd_api_current_actions() returns text[]
language sql stable set search_path=''
as $function$
  select app_private.pd_api_current_actions_before_m326_r1() || array[
    'fanbus_regular_riders_list','fanbus_regular_rider_detail',
    'fanbus_regular_rider_create','fanbus_regular_rider_update','fanbus_regular_rider_deactivate',
    'fanbus_regular_rider_link','fanbus_regular_rider_unlink','fanbus_regular_rider_relink',
    'fanbus_person_groups_list','fanbus_person_group_detail','fanbus_person_group_resolve',
    'fanbus_person_group_create','fanbus_person_group_update','fanbus_person_group_deactivate',
    'fanbus_person_group_members_replace'
  ]::text[]
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_m326_r1;
create function app_private.platform_action_classification(p_action text) returns text
language sql stable set search_path=''
as $function$
  select case when lower(btrim(coalesce(p_action,'')))=any(array[
    'fanbus_regular_riders_list','fanbus_regular_rider_detail',
    'fanbus_person_groups_list','fanbus_person_group_detail','fanbus_person_group_resolve'
  ]::text[]) then 'READ'
  else app_private.platform_action_classification_before_m326_r1(p_action) end
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_m326_r1;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare v_action text:=lower(btrim(coalesce(p_action,''))); v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
begin
  case v_action
    when 'fanbus_regular_riders_list' then return app_private.api_fanbus_regular_riders_list(v_payload);
    when 'fanbus_regular_rider_detail' then return app_private.api_fanbus_regular_rider_detail(v_payload);
    when 'fanbus_regular_rider_create' then return app_private.api_fanbus_regular_rider_create(v_payload);
    when 'fanbus_regular_rider_update' then return app_private.api_fanbus_regular_rider_update(v_payload);
    when 'fanbus_regular_rider_deactivate' then return app_private.api_fanbus_regular_rider_deactivate(v_payload);
    when 'fanbus_regular_rider_link' then return app_private.api_fanbus_regular_rider_link(v_payload);
    when 'fanbus_regular_rider_unlink' then return app_private.api_fanbus_regular_rider_unlink(v_payload);
    when 'fanbus_regular_rider_relink' then return app_private.api_fanbus_regular_rider_relink(v_payload);
    when 'fanbus_person_groups_list' then return app_private.api_fanbus_person_groups_list(v_payload);
    when 'fanbus_person_group_detail' then return app_private.api_fanbus_person_group_detail(v_payload);
    when 'fanbus_person_group_resolve' then return app_private.api_fanbus_person_group_resolve(v_payload);
    when 'fanbus_person_group_create' then return app_private.api_fanbus_person_group_create(v_payload);
    when 'fanbus_person_group_update' then return app_private.api_fanbus_person_group_update(v_payload);
    when 'fanbus_person_group_deactivate' then return app_private.api_fanbus_person_group_deactivate(v_payload);
    when 'fanbus_person_group_members_replace' then return app_private.api_fanbus_person_group_members_replace(v_payload);
    else return app_private.pd_api_dispatch_current_before_m326_r1(p_action,p_payload);
  end case;
end;
$function$;

revoke all on function
  app_private.m326_uuid(text,text),
  app_private.fanbus_effective_person(uuid,uuid,uuid),
  app_private.m326_regular_rider_values(jsonb),
  app_private.m326_regular_rider_link_change(jsonb,text),
  app_private.fanbus_person_group_projection(uuid,uuid),
  app_private.api_fanbus_regular_riders_list(jsonb),
  app_private.api_fanbus_regular_rider_detail(jsonb),
  app_private.api_fanbus_regular_rider_create(jsonb),
  app_private.api_fanbus_regular_rider_update(jsonb),
  app_private.api_fanbus_regular_rider_deactivate(jsonb),
  app_private.api_fanbus_regular_rider_link(jsonb),
  app_private.api_fanbus_regular_rider_unlink(jsonb),
  app_private.api_fanbus_regular_rider_relink(jsonb),
  app_private.api_fanbus_person_groups_list(jsonb),
  app_private.api_fanbus_person_group_detail(jsonb),
  app_private.api_fanbus_person_group_resolve(jsonb),
  app_private.api_fanbus_person_group_create(jsonb),
  app_private.api_fanbus_person_group_update(jsonb),
  app_private.api_fanbus_person_group_deactivate(jsonb),
  app_private.api_fanbus_person_group_members_replace(jsonb),
  app_private.pd_api_current_actions_before_m326_r1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_m326_r1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_m326_r1(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
from public,anon,authenticated,service_role;

grant execute on function
  app_private.pd_api_current_actions_before_m326_r1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_m326_r1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_m326_r1(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;

commit;
