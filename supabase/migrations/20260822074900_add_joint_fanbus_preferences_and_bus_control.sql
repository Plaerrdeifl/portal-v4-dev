-- Plaerrdeifl Digitalplattform V4
-- P300 / gemeinsamer F1-Block: M325-R3 + M320-R2
-- Zustiegsdefaults, persoenliche Zustiegspraeferenz und wirksame Buswunschsteuerung.

alter table app_modules.fanbus_trips
  add column default_boarding_stop_id uuid
    references app_modules.fanbus_boarding_stops(id) on delete set null,
  add column bus_preference_enabled boolean not null default false;

create table app_modules.fanbus_user_preferences (
  user_id uuid primary key
    references app_portal.users(id) on delete cascade,
  default_boarding_stop_id uuid
    references app_modules.fanbus_boarding_stops(id) on delete set null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fanbus_user_preferences_revision_check check (revision > 0)
);

create trigger fanbus_user_preferences_set_updated_at
before update on app_modules.fanbus_user_preferences
for each row execute function app_private.set_updated_at();

alter table app_modules.fanbus_user_preferences enable row level security;
revoke all on table app_modules.fanbus_user_preferences
from public, anon, authenticated, service_role;

-- Fail-closed central M320 resolver. NORMAL is deliberately not a passenger
-- preference and no partial set of preferences is ever returned.
create function app_private.fanbus_bus_preference_selection_enabled(
  p_trip_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce((
    select trip.bus_preference_enabled
      and count(*) filter (where bus.is_active) >= 2
      and count(*) filter (
        where bus.is_active and bus.category = 'PARTY'
      ) >= 1
      and count(*) filter (
        where bus.is_active and bus.category = 'RUHIG'
      ) >= 1
    from app_modules.fanbus_trips as trip
    left join app_modules.fanbus_buses as bus on bus.trip_id = trip.id
    where trip.id = p_trip_id
    group by trip.id, trip.bus_preference_enabled
  ), false);
$function$;

create function app_private.fanbus_allowed_bus_preferences(p_trip_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when app_private.fanbus_bus_preference_selection_enabled(p_trip_id)
      then '["EGAL", "RUHIG", "PARTY"]'::jsonb
    else '[]'::jsonb
  end;
$function$;

-- Central M325 resolver. Callers only supply the applicable preferred master
-- stop; therefore a linked Companion can never cause a foreign user preference
-- lookup here. A valid explicit concrete trip stop always wins.
create function app_private.fanbus_resolve_trip_boarding_stop(
  p_trip_id uuid,
  p_explicit_trip_boarding_stop_id uuid,
  p_preferred_boarding_stop_id uuid,
  p_preferred_source text default 'PERSONAL'
)
returns table(trip_boarding_stop_id uuid, effective_source text)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_stop_id uuid;
begin
  if p_explicit_trip_boarding_stop_id is not null then
    select trip_stop.id into v_stop_id
    from app_modules.fanbus_trip_boarding_stops as trip_stop
    where trip_stop.id = p_explicit_trip_boarding_stop_id
      and trip_stop.trip_id = p_trip_id
      and trip_stop.is_active;
    if not found then
      raise exception 'FANBUS_BOARDING_STOP_UNAVAILABLE' using errcode = '22023';
    end if;
    return query select v_stop_id, 'MANUAL'::text;
    return;
  end if;

  if p_preferred_boarding_stop_id is not null then
    select trip_stop.id into v_stop_id
    from app_modules.fanbus_trip_boarding_stops as trip_stop
    where trip_stop.trip_id = p_trip_id
      and trip_stop.boarding_stop_id = p_preferred_boarding_stop_id
      and trip_stop.is_active;
    if found then
      return query select v_stop_id, upper(btrim(p_preferred_source));
      return;
    end if;
  end if;

  select trip_stop.id into v_stop_id
  from app_modules.fanbus_trips as trip
  join app_modules.fanbus_trip_boarding_stops as trip_stop
    on trip_stop.trip_id = trip.id
   and trip_stop.boarding_stop_id = trip.default_boarding_stop_id
   and trip_stop.is_active
  where trip.id = p_trip_id;
  if found then
    return query select v_stop_id, 'TRIP'::text;
    return;
  end if;

  return query select null::uuid, 'NONE'::text;
end;
$function$;

create function app_private.api_fanbus_user_preference_get(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_trip_id uuid;
  v_preference app_modules.fanbus_user_preferences%rowtype;
  v_effective_stop uuid;
  v_effective_source text := 'NONE';
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'tripId'
     ) then
    raise exception 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_trip_id := nullif(btrim(coalesce(p_payload ->> 'tripId', '')), '')::uuid;
  exception when others then
    raise exception 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD' using errcode = '22023';
  end;

  select preference.* into v_preference
  from app_modules.fanbus_user_preferences as preference
  where preference.user_id = v_actor;

  if v_trip_id is not null then
    if not exists (select 1 from app_modules.fanbus_trips where id = v_trip_id) then
      raise exception 'FANBUS_TRIP_UNAVAILABLE' using errcode = 'P0002';
    end if;
    select resolved.trip_boarding_stop_id, resolved.effective_source
    into v_effective_stop, v_effective_source
    from app_private.fanbus_resolve_trip_boarding_stop(
      v_trip_id, null, v_preference.default_boarding_stop_id, 'PERSONAL'
    ) as resolved;
  end if;

  return jsonb_build_object(
    'defaultBoardingStopId', v_preference.default_boarding_stop_id,
    'revision', v_preference.revision,
    'effectiveTripBoardingStopId', v_effective_stop,
    'effectiveSource', v_effective_source,
    'availableBoardingStops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', stop.id, 'label', stop.label
      ) order by stop.position, stop.id)
      from app_modules.fanbus_boarding_stops as stop
      where stop.is_active
    ), '[]'::jsonb)
  );
end;
$function$;

create function app_private.api_fanbus_user_preference_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_stop_id uuid;
  v_expected_revision integer;
  v_existing app_modules.fanbus_user_preferences%rowtype;
  v_revision integer;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ? 'defaultBoardingStopId'
     or p_payload ->> 'defaultBoardingStopId' is null
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array[
         'defaultBoardingStopId', 'expectedRevision'
       ])
     ) then
    raise exception 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_stop_id := (p_payload ->> 'defaultBoardingStopId')::uuid;
    v_expected_revision := nullif(
      btrim(coalesce(p_payload ->> 'expectedRevision', '')), ''
    )::integer;
  exception when others then
    raise exception 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD' using errcode = '22023';
  end;
  if not exists (
    select 1 from app_modules.fanbus_boarding_stops
    where id = v_stop_id and is_active
  ) then
    raise exception 'FANBUS_BOARDING_STOP_UNAVAILABLE' using errcode = '22023';
  end if;

  select preference.* into v_existing
  from app_modules.fanbus_user_preferences as preference
  where preference.user_id = v_actor
  for update;
  if found then
    if v_expected_revision is null or v_expected_revision <> v_existing.revision then
      raise exception 'STALE_REVISION' using errcode = '40001';
    end if;
    update app_modules.fanbus_user_preferences
    set default_boarding_stop_id = v_stop_id,
        revision = revision + 1
    where user_id = v_actor and revision = v_expected_revision
    returning revision into v_revision;
  else
    if v_expected_revision is not null then
      raise exception 'STALE_REVISION' using errcode = '40001';
    end if;
    insert into app_modules.fanbus_user_preferences(
      user_id, default_boarding_stop_id
    ) values (v_actor, v_stop_id)
    returning revision into v_revision;
  end if;

  return jsonb_build_object(
    'defaultBoardingStopId', v_stop_id, 'revision', v_revision
  );
end;
$function$;

create function app_private.api_fanbus_user_preference_delete(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_expected_revision integer;
  v_existing app_modules.fanbus_user_preferences%rowtype;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ? 'expectedRevision'
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'expectedRevision'
     ) then
    raise exception 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception when others then
    raise exception 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD' using errcode = '22023';
  end;
  if v_expected_revision is null or v_expected_revision <= 0 then
    raise exception 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  select preference.* into v_existing
  from app_modules.fanbus_user_preferences as preference
  where preference.user_id = v_actor
  for update;
  if not found or v_existing.revision <> v_expected_revision then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;
  delete from app_modules.fanbus_user_preferences
  where user_id = v_actor and revision = v_expected_revision;

  return jsonb_build_object(
    'defaultBoardingStopId', null, 'revision', null
  );
end;
$function$;

-- Preserve the complete current M010/M330 snapshot and enrich every trip.
alter function app_private.api_fanbus_trips_list()
  rename to api_fanbus_trips_list_before_joint_f1;

create function app_private.api_fanbus_trips_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_base jsonb := app_private.api_fanbus_trips_list_before_joint_f1();
begin
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(
        item.value || jsonb_build_object(
          'defaultBoardingStopId', trip.default_boarding_stop_id,
          'busPreferenceEnabled', trip.bus_preference_enabled,
          'busPreferenceSelectionEnabled',
            app_private.fanbus_bus_preference_selection_enabled(trip.id),
          'allowedBusPreferences',
            app_private.fanbus_allowed_bus_preferences(trip.id)
        ) order by item.ordinality
      )
      from jsonb_array_elements(coalesce(v_base -> 'trips', '[]'::jsonb))
        with ordinality as item(value, ordinality)
      join app_modules.fanbus_trips as trip
        on trip.id = (item.value ->> 'id')::uuid
    ), '[]'::jsonb)
  );
end;
$function$;

-- Public projections expose only the resolved defaults/effectiveness contract,
-- never the underlying bus topology.
alter function public.pd_public_fanbus_trip(uuid)
  rename to pd_public_fanbus_trip_before_joint_f1;

create function public.pd_public_fanbus_trip(p_trip_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_base jsonb := public.pd_public_fanbus_trip_before_joint_f1(p_trip_id);
  v_default_trip_stop uuid;
begin
  if coalesce((v_base ->> 'available')::boolean, false) is not true then
    return v_base;
  end if;
  select resolved.trip_boarding_stop_id into v_default_trip_stop
  from app_private.fanbus_resolve_trip_boarding_stop(
    p_trip_id, null, null, 'NONE'
  ) as resolved;
  return v_base || jsonb_build_object(
    'defaultTripBoardingStopId', v_default_trip_stop,
    'busPreferenceSelectionEnabled',
      app_private.fanbus_bus_preference_selection_enabled(p_trip_id),
    'allowedBusPreferences',
      app_private.fanbus_allowed_bus_preferences(p_trip_id)
  );
end;
$function$;

alter function public.pd_public_fanbus_trips()
  rename to pd_public_fanbus_trips_before_joint_f1;

create function public.pd_public_fanbus_trips()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_base jsonb := public.pd_public_fanbus_trips_before_joint_f1();
begin
  return jsonb_build_object(
    'trips', coalesce((
      select jsonb_agg(
        item.value || jsonb_build_object(
          'defaultTripBoardingStopId', resolved.trip_boarding_stop_id,
          'busPreferenceSelectionEnabled',
            app_private.fanbus_bus_preference_selection_enabled(trip.id),
          'allowedBusPreferences',
            app_private.fanbus_allowed_bus_preferences(trip.id)
        ) order by item.ordinality
      )
      from jsonb_array_elements(coalesce(v_base -> 'trips', '[]'::jsonb))
        with ordinality as item(value, ordinality)
      join app_modules.fanbus_trips as trip
        on trip.id = (item.value ->> 'tripId')::uuid
      cross join lateral app_private.fanbus_resolve_trip_boarding_stop(
        trip.id, null, null, 'NONE'
      ) as resolved
    ), '[]'::jsonb)
  );
end;
$function$;

-- Existing trip-update API with the two additive fields. The pre-M330
-- implementation still owns allowlisting of all legacy fields, CAS and audit;
-- this wrapper owns the M330 lock and the new validated settings.
create or replace function app_private.api_fanbus_trip_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_trip_id uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ACTION_ID');
  v_existing app_modules.fanbus_trips%rowtype;
  v_default_stop uuid;
  v_bus_preference_enabled boolean;
  v_clean jsonb;
begin
  if v_trip_id is null then
    raise exception 'Die Fanbusfahrt-Daten haben ein ungültiges Format.'
      using errcode = '22023';
  end if;
  if p_payload ? 'busPreferenceEnabled'
     and jsonb_typeof(p_payload -> 'busPreferenceEnabled') <> 'boolean' then
    raise exception 'FANBUS_TRIP_SETTINGS_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  perform app_private.m330_lock_mutable_fanbus_trip(v_trip_id);
  select trip.* into v_existing
  from app_modules.fanbus_trips as trip
  where trip.id = v_trip_id;

  begin
    v_default_stop := case when p_payload ? 'defaultBoardingStopId'
      then nullif(btrim(coalesce(p_payload ->> 'defaultBoardingStopId', '')), '')::uuid
      else v_existing.default_boarding_stop_id end;
    v_bus_preference_enabled := case when p_payload ? 'busPreferenceEnabled'
      then (p_payload ->> 'busPreferenceEnabled')::boolean
      else v_existing.bus_preference_enabled end;
  exception when others then
    raise exception 'FANBUS_TRIP_SETTINGS_INVALID_PAYLOAD' using errcode = '22023';
  end;

  if v_default_stop is not null and not exists (
    select 1
    from app_modules.fanbus_trip_boarding_stops as trip_stop
    where trip_stop.trip_id = v_trip_id
      and trip_stop.boarding_stop_id = v_default_stop
      and trip_stop.is_active
  ) then
    raise exception 'FANBUS_TRIP_DEFAULT_BOARDING_STOP_UNAVAILABLE'
      using errcode = '22023';
  end if;
  if v_bus_preference_enabled
     and not app_private.fanbus_bus_preference_selection_enabled(v_trip_id) then
    -- The helper includes the current flag, so validate the physical structure
    -- directly while enabling from false.
    if not (
      (select count(*) from app_modules.fanbus_buses
       where trip_id = v_trip_id and is_active) >= 2
      and exists (select 1 from app_modules.fanbus_buses
       where trip_id = v_trip_id and is_active and category = 'PARTY')
      and exists (select 1 from app_modules.fanbus_buses
       where trip_id = v_trip_id and is_active and category = 'RUHIG')
    ) then
      raise exception 'FANBUS_BUS_PREFERENCE_STRUCTURE_INVALID'
        using errcode = '22023';
    end if;
  end if;

  v_clean := p_payload - 'defaultBoardingStopId' - 'busPreferenceEnabled';
  perform app_private.api_fanbus_trip_update_before_m330_r1(v_clean);

  if v_existing.default_boarding_stop_id is distinct from v_default_stop
     or v_existing.bus_preference_enabled is distinct from v_bus_preference_enabled then
    update app_modules.fanbus_trips
    set default_boarding_stop_id = v_default_stop,
        bus_preference_enabled = v_bus_preference_enabled,
        updated_by = v_actor
    where id = v_trip_id;
    perform app_private.log_audit(
      v_actor, 'FANBUS_TRIP_SETTINGS_UPDATED', 'fanbus_trip', v_trip_id::text,
      jsonb_build_object(
        'defaultBoardingStopId', v_existing.default_boarding_stop_id,
        'busPreferenceEnabled', v_existing.bus_preference_enabled
      ),
      jsonb_build_object(
        'defaultBoardingStopId', v_default_stop,
        'busPreferenceEnabled', v_bus_preference_enabled
      ),
      jsonb_build_object('tripId', v_trip_id)
    );
  end if;
  return app_private.api_fanbus_trips_list();
end;
$function$;

-- Single insertion-time boarding resolver for portal primary, guest, template
-- Companion, guest Companion and manual registration paths.
create or replace function app_private.m325_registration_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_context jsonb := coalesce(
    nullif(current_setting('app.m325_registration_context', true), ''), '[]'
  )::jsonb;
  v_entry jsonb;
  v_stop_id uuid;
  v_template_id uuid;
  v_linked_portal_user_id uuid;
  v_derived_member_id uuid;
  v_preferred_stop_id uuid;
  v_preferred_source text := 'NONE';
  v_effective_source text;
  v_note text;
  v_owner uuid;
  v_first text;
  v_last text;
begin
  select value into v_entry
  from jsonb_array_elements(v_context)
  where (value ->> 'sequence')::integer = new.participant_sequence
  limit 1;

  if v_entry is not null then
    begin
      v_stop_id := nullif(v_entry ->> 'boardingStopId', '')::uuid;
      v_template_id := nullif(v_entry ->> 'templateMemberId', '')::uuid;
      v_linked_portal_user_id :=
        nullif(v_entry ->> 'linkedPortalUserId', '')::uuid;
    exception when others then
      raise exception 'FANBUS_BOARDING_STOP_INVALID' using errcode = '22023';
    end;
    v_note := nullif(btrim(coalesce(v_entry ->> 'operationalNote', '')), '');
    if v_note is not null and length(v_note) > 240 then
      raise exception 'FANBUS_OPERATIONAL_NOTE_TOO_LONG' using errcode = '22023';
    end if;
  end if;

  if v_template_id is not null then
    if new.source <> 'PORTAL'
       or new.booking_role <> 'COMPANION'
       or new.created_by is null then
      raise exception 'FANBUS_TEMPLATE_MEMBER_FORBIDDEN' using errcode = '42501';
    end if;

    select list.owner_user_id, companion.default_boarding_stop_id
    into v_owner, v_preferred_stop_id
    from app_modules.fanbus_companion_list_members as companion
    join app_modules.fanbus_companion_lists as list
      on list.id = companion.list_id
    where companion.id = v_template_id
      and companion.linked_portal_user_id
        is not distinct from v_linked_portal_user_id;
    if not found or v_owner <> new.created_by then
      raise exception 'FANBUS_TEMPLATE_MEMBER_FORBIDDEN' using errcode = '42501';
    end if;
    v_preferred_source := 'COMPANION';

    if v_linked_portal_user_id is not null then
      select btrim(portal_user.first_name), btrim(portal_user.last_name)
      into v_first, v_last
      from app_portal.users as portal_user
      where portal_user.id = v_linked_portal_user_id
        and portal_user.status = 'ACTIVE';
      if not found then
        raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode = '22023';
      end if;

      select link.member_id into v_derived_member_id
      from app_portal.user_member_links as link
      join app_fanclub.members as member
        on member.id = link.member_id and member.status = 'ACTIVE'
      where link.user_id = v_linked_portal_user_id;

      new.portal_user_id := v_linked_portal_user_id;
      new.member_id := v_derived_member_id;
      new.first_name := v_first;
      new.last_name := v_last;
      new.email := null;
    else
      new.portal_user_id := null;
      new.member_id := null;
    end if;
  elsif new.source = 'PORTAL'
        and new.booking_role = 'PRIMARY'
        and new.created_by is not null then
    -- Only the actor's own preference is read. Linked Companion identities
    -- never enter this branch.
    select preference.default_boarding_stop_id into v_preferred_stop_id
    from app_modules.fanbus_user_preferences as preference
    where preference.user_id = new.created_by;
    v_preferred_source := 'PERSONAL';
  end if;

  if new.booking_role = 'COMPANION'
     and app_private.m325_companion_conflict_status(
       new.trip_id,
       v_template_id,
       v_linked_portal_user_id,
       v_derived_member_id,
       new.first_name,
       new.last_name
     ) is not null then
    raise exception 'FANBUS_COMPANION_CONFLICT' using errcode = 'P3251';
  end if;

  select resolved.trip_boarding_stop_id, resolved.effective_source
  into v_stop_id, v_effective_source
  from app_private.fanbus_resolve_trip_boarding_stop(
    new.trip_id, v_stop_id, v_preferred_stop_id, v_preferred_source
  ) as resolved;

  new.trip_boarding_stop_id := v_stop_id;
  new.companion_list_member_id := v_template_id;
  new.operational_note := v_note;

  if exists (
    select 1 from app_modules.fanbus_trip_boarding_stops
    where trip_id = new.trip_id and is_active
  ) and new.trip_boarding_stop_id is null then
    raise exception 'FANBUS_BOARDING_STOP_REQUIRED' using errcode = '22023';
  end if;

  -- The existing booking core has already hashed and validated the requested
  -- value. Only the effective value is normalized here, immediately before the
  -- one shared insert used by ACTIVE and WAITLISTED registrations.
  if new.bus_preference not in ('EGAL', 'RUHIG', 'PARTY') then
    raise exception 'FANBUS_BUS_PREFERENCE_INVALID' using errcode = '22023';
  end if;
  if not app_private.fanbus_bus_preference_selection_enabled(new.trip_id) then
    new.bus_preference := 'EGAL';
  end if;
  return new;
end;
$function$;

alter function app_private.api_fanbus_companion_duplicate_preview(jsonb)
  rename to api_fanbus_companion_duplicate_preview_before_joint_f1;

create function app_private.api_fanbus_companion_duplicate_preview(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_trip_id uuid := app_private.m325_parse_uuid(
    p_payload ->> 'tripId', 'FANBUS_COMPANION_PREVIEW_INVALID_PAYLOAD'
  );
  v_base jsonb;
begin
  v_base := app_private.api_fanbus_companion_duplicate_preview_before_joint_f1(
    p_payload
  );
  return jsonb_set(v_base, '{members}', coalesce((
    select jsonb_agg(
      result_item.value || jsonb_build_object(
        'effectiveTripBoardingStopId', resolved.trip_boarding_stop_id,
        'effectiveSource', resolved.effective_source
      ) order by result_item.ordinality
    )
    from jsonb_array_elements(v_base -> 'members') with ordinality
      as result_item(value, ordinality)
    join jsonb_array_elements(p_payload -> 'participants') with ordinality
      as requested(value, ordinality) using (ordinality)
    join app_modules.fanbus_companion_list_members as companion
      on companion.id = (requested.value ->> 'templateMemberId')::uuid
    join app_modules.fanbus_companion_lists as list
      on list.id = companion.list_id and list.owner_user_id = v_actor
    cross join lateral app_private.fanbus_resolve_trip_boarding_stop(
      v_trip_id,
      nullif(requested.value ->> 'boardingStopId', '')::uuid,
      companion.default_boarding_stop_id,
      'COMPANION'
    ) as resolved
  ), '[]'::jsonb), true);
end;
$function$;

-- Companion submit keeps explicit selections in the request context. Template
-- and trip fallbacks are resolved only once by the insertion trigger above.
create or replace function app_private.api_fanbus_companion_booking_submit(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_list uuid := app_private.m325_parse_uuid(
    p_payload ->> 'listId', 'FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD'
  );
  v_trip uuid := app_private.m325_parse_uuid(
    p_payload ->> 'tripId', 'FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD'
  );
  v_selected jsonb := p_payload -> 'participants';
  v_members jsonb := '[]'::jsonb;
  v_identity_context jsonb := '[]'::jsonb;
  v_item jsonb;
  v_member app_modules.fanbus_companion_list_members%rowtype;
  v_template uuid;
  v_trip_stop uuid;
  v_portal_first text;
  v_portal_last text;
  v_companion jsonb;
  v_requested jsonb;
  v_sequence integer := 1;
begin
  if jsonb_typeof(v_selected) <> 'array'
     or jsonb_array_length(v_selected) not between 1 and 19 then
    raise exception 'FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  perform 1 from app_modules.fanbus_trips as trip
  where trip.id = v_trip for update;
  perform 1 from app_modules.fanbus_companion_lists as list
  where list.id = v_list and list.owner_user_id = v_actor for update;
  if not found then
    raise exception 'FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_selected)
  loop
    v_sequence := v_sequence + 1;
    v_template := app_private.m325_parse_uuid(
      v_item ->> 'templateMemberId', 'FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD'
    );
    v_trip_stop := app_private.m325_parse_uuid(
      v_item ->> 'boardingStopId', 'FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD'
    );
    if v_template is null then
      v_companion := jsonb_build_object(
        'firstName', v_item ->> 'firstName',
        'lastName', v_item ->> 'lastName',
        'busPreference', v_item ->> 'busPreference',
        'boardingStopId', v_trip_stop,
        'operationalNote', nullif(
          btrim(coalesce(v_item ->> 'operationalNote', '')), ''
        )
      );
      if nullif(btrim(coalesce(v_item ->> 'email', '')), '') is not null then
        v_companion := v_companion || jsonb_build_object(
          'email', v_item ->> 'email'
        );
      end if;
      v_members := v_members || jsonb_build_array(v_companion);
      v_identity_context := v_identity_context || jsonb_build_array(
        jsonb_build_object('sequence', v_sequence)
      );
      continue;
    end if;

    select companion.* into v_member
    from app_modules.fanbus_companion_list_members as companion
    where companion.id = v_template and companion.list_id = v_list
    for update;
    if not found then
      raise exception 'FANBUS_COMPANION_MEMBER_UNAVAILABLE' using errcode = '42501';
    end if;

    if v_member.linked_portal_user_id is not null then
      select btrim(portal_user.first_name), btrim(portal_user.last_name)
      into v_portal_first, v_portal_last
      from app_portal.users as portal_user
      where portal_user.id = v_member.linked_portal_user_id
        and portal_user.status = 'ACTIVE'
      for share;
      if not found then
        raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode = '22023';
      end if;
    else
      v_portal_first := coalesce(
        nullif(btrim(v_item ->> 'firstName'), ''), v_member.first_name
      );
      v_portal_last := coalesce(
        nullif(btrim(v_item ->> 'lastName'), ''), v_member.last_name
      );
    end if;

    v_companion := jsonb_build_object(
      'firstName', v_portal_first,
      'lastName', v_portal_last,
      'busPreference', coalesce(
        nullif(upper(btrim(v_item ->> 'busPreference')), ''),
        v_member.default_bus_preference
      ),
      'boardingStopId', v_trip_stop,
      'operationalNote', case when v_item ? 'operationalNote'
        then nullif(btrim(v_item ->> 'operationalNote'), '')
        else v_member.operational_note end,
      'templateMemberId', v_member.id
    );
    if v_member.linked_portal_user_id is null
       and nullif(btrim(coalesce(v_item ->> 'email', '')), '') is not null then
      v_companion := v_companion || jsonb_build_object(
        'email', v_item ->> 'email'
      );
    end if;
    v_members := v_members || jsonb_build_array(v_companion);
    v_identity_context := v_identity_context || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'sequence', v_sequence,
        'linkedPortalUserId', v_member.linked_portal_user_id
      ))
    );
  end loop;

  v_requested := jsonb_build_object(
    'tripId', v_trip,
    'busPreference', p_payload ->> 'busPreference',
    'boardingStopId', p_payload ->> 'boardingStopId',
    'operationalNote', p_payload ->> 'operationalNote',
    'companions', v_members,
    'privacyConfirmed', p_payload -> 'privacyConfirmed',
    'termsConfirmed', p_payload -> 'termsConfirmed',
    'idempotencyKey', p_payload ->> 'idempotencyKey'
  );
  perform set_config(
    'app.m325_companion_identity_context', v_identity_context::text, true
  );
  return app_private.api_fanbus_self_register(v_requested);
end;
$function$;

-- M325 stop lifecycle: clearing is limited to a mutation of the selected
-- concrete trip-stop mapping; time, note and position changes do not clear it.
create or replace function app_private.api_fanbus_trip_boarding_stop_upsert(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_trip_id uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ID');
  v_stop_row_id uuid;
  v_before app_modules.fanbus_trip_boarding_stops%rowtype;
  v_trip_default uuid;
  v_result jsonb;
  v_new_master_stop uuid;
  v_new_active boolean;
begin
  if v_trip_id is not null then
    perform app_private.m330_lock_mutable_fanbus_trip(v_trip_id);
  end if;
  begin
    v_stop_row_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_new_master_stop := nullif(
      btrim(coalesce(p_payload ->> 'boardingStopId', '')), ''
    )::uuid;
    v_new_active := (p_payload ->> 'isActive')::boolean;
  exception when others then
    raise exception 'FANBUS_TRIP_BOARDING_STOP_INVALID_PAYLOAD'
      using errcode = '22023';
  end;
  if v_stop_row_id is not null then
    select trip_stop.* into v_before
    from app_modules.fanbus_trip_boarding_stops as trip_stop
    where trip_stop.id = v_stop_row_id and trip_stop.trip_id = v_trip_id
    for update;
  end if;
  select trip.default_boarding_stop_id into v_trip_default
  from app_modules.fanbus_trips as trip where trip.id = v_trip_id;

  v_result := app_private.api_fanbus_trip_boarding_stop_upsert_before_m330_r1(
    p_payload
  );

  if v_before.id is not null
     and v_trip_default = v_before.boarding_stop_id
     and (v_new_active is false
       or v_new_master_stop is distinct from v_before.boarding_stop_id) then
    update app_modules.fanbus_trips
    set default_boarding_stop_id = null,
        revision = revision + 1,
        updated_by = v_actor
    where id = v_trip_id
      and default_boarding_stop_id = v_before.boarding_stop_id;
    if found then
      perform app_private.log_audit(
        v_actor, 'FANBUS_TRIP_DEFAULT_BOARDING_STOP_CLEARED',
        'fanbus_trip', v_trip_id::text,
        jsonb_build_object(
          'defaultBoardingStopId', v_before.boarding_stop_id
        ),
        jsonb_build_object('defaultBoardingStopId', null),
        jsonb_build_object(
          'tripId', v_trip_id, 'tripBoardingStopId', v_before.id
        )
      );
    end if;
  end if;
  return v_result;
end;
$function$;

-- M320 AUTO_RESET_FALSE after every bus mutation. Existing occupancy,
-- capacity, category, CAS and M330 checks remain in the delegated function.
create or replace function app_private.api_fanbus_bus_upsert(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_trip_id uuid := app_private.m330_payload_trip_id(p_payload, 'TRIP_ID');
  v_result jsonb;
begin
  if v_trip_id is not null then
    perform app_private.m330_lock_mutable_fanbus_trip(v_trip_id);
  end if;
  v_result := app_private.api_fanbus_bus_upsert_before_m330_r1(p_payload);

  if exists (
    select 1 from app_modules.fanbus_trips
    where id = v_trip_id and bus_preference_enabled
  ) and not app_private.fanbus_bus_preference_selection_enabled(v_trip_id) then
    update app_modules.fanbus_trips
    set bus_preference_enabled = false,
        revision = revision + 1,
        updated_by = v_actor
    where id = v_trip_id and bus_preference_enabled;
    perform app_private.log_audit(
      v_actor, 'FANBUS_BUS_PREFERENCE_AUTO_DISABLED',
      'fanbus_trip', v_trip_id::text,
      jsonb_build_object('busPreferenceEnabled', true),
      jsonb_build_object('busPreferenceEnabled', false),
      jsonb_build_object('tripId', v_trip_id, 'policy', 'AUTO_RESET_FALSE')
    );
  end if;
  return v_result;
end;
$function$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_joint_f1;

create function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;
  case v_action
    when 'fanbus_user_preference_get' then
      v_data := app_private.api_fanbus_user_preference_get(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_user_preference_set' then
      v_data := app_private.api_fanbus_user_preference_set(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_user_preference_delete' then
      v_data := app_private.api_fanbus_user_preference_delete(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return public.pd_api_before_joint_f1(p_action, p_payload);
  end case;
  return jsonb_build_object('ok', true, 'data', v_data);
exception when others then
  return jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object('code', sqlstate, 'message', sqlerrm)
  );
end;
$function$;

revoke all on function
  app_private.fanbus_bus_preference_selection_enabled(uuid),
  app_private.fanbus_allowed_bus_preferences(uuid),
  app_private.fanbus_resolve_trip_boarding_stop(uuid, uuid, uuid, text),
  app_private.api_fanbus_user_preference_get(jsonb),
  app_private.api_fanbus_user_preference_set(jsonb),
  app_private.api_fanbus_user_preference_delete(jsonb),
  app_private.api_fanbus_trips_list_before_joint_f1(),
  app_private.api_fanbus_trips_list(),
  app_private.api_fanbus_trip_update(jsonb),
  app_private.m325_registration_before_insert(),
  app_private.api_fanbus_companion_duplicate_preview_before_joint_f1(jsonb),
  app_private.api_fanbus_companion_duplicate_preview(jsonb),
  app_private.api_fanbus_companion_booking_submit(jsonb),
  app_private.api_fanbus_trip_boarding_stop_upsert(jsonb),
  app_private.api_fanbus_bus_upsert(jsonb),
  public.pd_api_before_joint_f1(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.fanbus_bus_preference_selection_enabled(uuid),
  app_private.fanbus_allowed_bus_preferences(uuid),
  app_private.fanbus_resolve_trip_boarding_stop(uuid, uuid, uuid, text),
  app_private.api_fanbus_user_preference_get(jsonb),
  app_private.api_fanbus_user_preference_set(jsonb),
  app_private.api_fanbus_user_preference_delete(jsonb),
  app_private.api_fanbus_trips_list_before_joint_f1(),
  app_private.api_fanbus_trips_list(),
  app_private.api_fanbus_trip_update(jsonb),
  app_private.m325_registration_before_insert(),
  app_private.api_fanbus_companion_duplicate_preview_before_joint_f1(jsonb),
  app_private.api_fanbus_companion_duplicate_preview(jsonb),
  app_private.api_fanbus_companion_booking_submit(jsonb),
  app_private.api_fanbus_trip_boarding_stop_upsert(jsonb),
  app_private.api_fanbus_bus_upsert(jsonb),
  public.pd_api_before_joint_f1(text, jsonb)
to postgres;

revoke all on function
  public.pd_public_fanbus_trip_before_joint_f1(uuid),
  public.pd_public_fanbus_trips_before_joint_f1()
from public, anon, authenticated, service_role;
grant execute on function
  public.pd_public_fanbus_trip_before_joint_f1(uuid),
  public.pd_public_fanbus_trips_before_joint_f1()
to postgres;

revoke all on function
  public.pd_public_fanbus_trip(uuid),
  public.pd_public_fanbus_trips(),
  public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;
grant execute on function
  public.pd_public_fanbus_trip(uuid),
  public.pd_public_fanbus_trips()
to anon, authenticated;
grant execute on function public.pd_api(text, jsonb) to authenticated;

comment on table app_modules.fanbus_user_preferences is
  'M325-R3 enger eigener Standard-Zustiegsort je aktivem Portaluser.';
comment on function app_private.fanbus_resolve_trip_boarding_stop(
  uuid, uuid, uuid, text
) is
  'M325-R3 zentraler Resolver: explizit, person-/companionbezogen, Fahrtdefault, NONE.';
comment on function app_private.fanbus_bus_preference_selection_enabled(uuid) is
  'M320-R2 fail-closed Resolver fuer PARTY+RUHIG-Mehrbusstruktur.';
