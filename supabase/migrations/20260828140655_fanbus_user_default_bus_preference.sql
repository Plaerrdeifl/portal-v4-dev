-- Plaerrdeifl Digitalplattform V4
-- P300 / Acceptance-Erweiterung: persönliche Fanbus-Standards
-- DEV overlay; vor gemeinsamem PROD-Release in die regulaere Migrationskette ueberfuehren.
--
-- Fachvertrag:
-- - Jeder Portaluser hat effektiv den Standard-Buswunsch EGAL.
-- - RUHIG/PARTY werden nur als persönliche Vorgabe gespeichert.
-- - Ist die Buswunschauswahl einer Fahrt deaktiviert, bleibt die konkrete
--   Registrierung serverseitig EGAL; der persönliche Standard hat dort keine Wirkung.

alter table app_modules.fanbus_user_preferences
  add column default_bus_preference text not null default 'EGAL',
  add constraint fanbus_user_preferences_default_bus_preference_check
    check (default_bus_preference in ('EGAL', 'RUHIG', 'PARTY'));

create or replace function app_private.api_fanbus_user_preference_get(p_payload jsonb)
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
    'defaultBusPreference', coalesce(v_preference.default_bus_preference, 'EGAL'),
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

create or replace function app_private.api_fanbus_user_preference_set(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_has_stop boolean := p_payload ? 'defaultBoardingStopId';
  v_has_bus boolean := p_payload ? 'defaultBusPreference';
  v_stop_id uuid;
  v_bus_preference text;
  v_expected_revision integer;
  v_existing app_modules.fanbus_user_preferences%rowtype;
  v_revision integer;
  v_result_stop uuid;
  v_result_bus text;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not (v_has_stop or v_has_bus)
     or exists (
       select 1 from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array[
         'defaultBoardingStopId', 'defaultBusPreference', 'expectedRevision'
       ])
     ) then
    raise exception 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  begin
    if v_has_stop and p_payload -> 'defaultBoardingStopId' <> 'null'::jsonb then
      v_stop_id := nullif(btrim(coalesce(p_payload ->> 'defaultBoardingStopId', '')), '')::uuid;
    end if;
    if v_has_bus then
      v_bus_preference := upper(btrim(coalesce(p_payload ->> 'defaultBusPreference', '')));
    end if;
    v_expected_revision := nullif(
      btrim(coalesce(p_payload ->> 'expectedRevision', '')), ''
    )::integer;
  exception when others then
    raise exception 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD' using errcode = '22023';
  end;

  if v_has_stop and v_stop_id is not null and not exists (
    select 1 from app_modules.fanbus_boarding_stops
    where id = v_stop_id and is_active
  ) then
    raise exception 'FANBUS_BOARDING_STOP_UNAVAILABLE' using errcode = '22023';
  end if;

  if v_has_bus and v_bus_preference not in ('EGAL', 'RUHIG', 'PARTY') then
    raise exception 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD' using errcode = '22023';
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
    set default_boarding_stop_id = case
          when v_has_stop then v_stop_id
          else v_existing.default_boarding_stop_id
        end,
        default_bus_preference = case
          when v_has_bus then v_bus_preference
          else v_existing.default_bus_preference
        end,
        revision = revision + 1
    where user_id = v_actor and revision = v_expected_revision
    returning default_boarding_stop_id, default_bus_preference, revision
    into v_result_stop, v_result_bus, v_revision;
  else
    if v_expected_revision is not null then
      raise exception 'STALE_REVISION' using errcode = '40001';
    end if;

    insert into app_modules.fanbus_user_preferences(
      user_id,
      default_boarding_stop_id,
      default_bus_preference
    ) values (
      v_actor,
      case when v_has_stop then v_stop_id else null end,
      case when v_has_bus then v_bus_preference else 'EGAL' end
    )
    returning default_boarding_stop_id, default_bus_preference, revision
    into v_result_stop, v_result_bus, v_revision;
  end if;

  return jsonb_build_object(
    'defaultBoardingStopId', v_result_stop,
    'defaultBusPreference', v_result_bus,
    'revision', v_revision
  );
end;
$function$;

-- Legacy-Aktion bleibt kompatibel mit der bisherigen Oberfläche: "Löschen"
-- löscht nur den Standard-Zustieg. Ein persönlicher Busstandard darf dadurch
-- nicht unbemerkt verloren gehen.
create or replace function app_private.api_fanbus_user_preference_delete(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_expected_revision integer;
  v_existing app_modules.fanbus_user_preferences%rowtype;
  v_revision integer;
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

  if v_existing.default_bus_preference = 'EGAL' then
    delete from app_modules.fanbus_user_preferences
    where user_id = v_actor and revision = v_expected_revision;
    return jsonb_build_object(
      'defaultBoardingStopId', null,
      'defaultBusPreference', 'EGAL',
      'revision', null
    );
  end if;

  update app_modules.fanbus_user_preferences
  set default_boarding_stop_id = null,
      revision = revision + 1
  where user_id = v_actor and revision = v_expected_revision
  returning revision into v_revision;

  return jsonb_build_object(
    'defaultBoardingStopId', null,
    'defaultBusPreference', v_existing.default_bus_preference,
    'revision', v_revision
  );
end;
$function$;

-- Die manuelle Teilnehmerauswahl erhält die persönlichen Defaults nur für
-- Identitäten, die tatsächlich mit einem aktiven Portaluser verbunden sind.
create or replace function app_private.api_fanbus_registration_people_list()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability(
    'fanbus.registrations.manage'
  );
begin
  return jsonb_build_object(
    'people',
    coalesce((
      with selectable_people as (
        select
          'MEMBER'::text as person_type,
          member.id as member_id,
          portal_user.id as portal_user_id,
          member.first_name,
          member.last_name,
          case
            when nullif(lower(btrim(member.email)), '')
              ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
              then nullif(lower(btrim(member.email)), '')
            when nullif(lower(btrim(portal_user.email)), '')
              ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
              then nullif(lower(btrim(portal_user.email)), '')
            else null
          end as email,
          preference.default_boarding_stop_id,
          preference_stop.label as default_boarding_stop_label,
          coalesce(preference.default_bus_preference, 'EGAL') as default_bus_preference
        from app_fanclub.members as member
        left join app_portal.user_member_links as link
          on link.member_id = member.id
        left join app_portal.users as portal_user
          on portal_user.id = link.user_id
         and portal_user.status = 'ACTIVE'
        left join app_modules.fanbus_user_preferences as preference
          on preference.user_id = portal_user.id
        left join app_modules.fanbus_boarding_stops as preference_stop
          on preference_stop.id = preference.default_boarding_stop_id
        where member.status = 'ACTIVE'

        union all

        select
          'PORTAL_USER'::text as person_type,
          null::uuid as member_id,
          portal_user.id as portal_user_id,
          portal_user.first_name,
          portal_user.last_name,
          nullif(btrim(portal_user.email), '') as email,
          preference.default_boarding_stop_id,
          preference_stop.label as default_boarding_stop_label,
          coalesce(preference.default_bus_preference, 'EGAL') as default_bus_preference
        from app_portal.users as portal_user
        left join app_modules.fanbus_user_preferences as preference
          on preference.user_id = portal_user.id
        left join app_modules.fanbus_boarding_stops as preference_stop
          on preference_stop.id = preference.default_boarding_stop_id
        where portal_user.status = 'ACTIVE'
          and not exists (
            select 1
            from app_portal.user_member_links as link
            join app_fanclub.members as member
              on member.id = link.member_id
             and member.status = 'ACTIVE'
            where link.user_id = portal_user.id
          )
      )
      select jsonb_agg(
        jsonb_build_object(
          'personType', person.person_type,
          'memberId', person.member_id,
          'portalUserId', person.portal_user_id,
          'firstName', person.first_name,
          'lastName', person.last_name,
          'email', person.email,
          'defaultBoardingStopId', person.default_boarding_stop_id,
          'defaultBoardingStopLabel', person.default_boarding_stop_label,
          'defaultBusPreference', person.default_bus_preference
        )
        order by
          lower(person.last_name),
          lower(person.first_name),
          person.member_id nulls last,
          person.portal_user_id
      )
      from selectable_people as person
    ), '[]'::jsonb)
  );
end;
$function$;

-- Personengruppen verwenden für Portaluser bzw. verknüpfte Mitglieder
-- ebenfalls den persönlichen Standard. Stammfahrer behalten ihre eigenen
-- Stammfahrer-Defaults als eigenständige Fachquelle.
create or replace function app_private.fanbus_effective_person(
  p_portal_user_id uuid default null,
  p_member_id uuid default null,
  p_regular_rider_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_portal app_portal.users%rowtype;
  v_member app_fanclub.members%rowtype;
  v_rider app_modules.fanbus_regular_riders%rowtype;
  v_linked uuid;
  v_anchor_type text;
  v_anchor_id uuid;
  v_default_stop uuid;
  v_default_bus text := 'EGAL';
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

    select preference.default_boarding_stop_id,
           preference.default_bus_preference
    into v_default_stop, v_default_bus
    from app_modules.fanbus_user_preferences as preference
    where preference.user_id = v_portal.id;

    return jsonb_build_object(
      'anchorType', v_anchor_type, 'anchorId', v_anchor_id,
      'available', true, 'effectiveType', 'PORTAL_USER',
      'effectiveId', v_portal.id, 'identityKey', 'PORTAL:' || v_portal.id,
      'portalUserId', v_portal.id,
      'firstName', btrim(v_portal.first_name),
      'lastName', btrim(v_portal.last_name),
      'email', nullif(lower(btrim(v_portal.email)), ''),
      'defaultBoardingStopId', v_default_stop,
      'defaultBusPreference', coalesce(v_default_bus, 'EGAL')
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
      select preference.default_boarding_stop_id,
             preference.default_bus_preference
      into v_default_stop, v_default_bus
      from app_modules.fanbus_user_preferences as preference
      where preference.user_id = v_portal.id;

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
          else nullif(lower(btrim(v_portal.email)), '') end,
        'defaultBoardingStopId', v_default_stop,
        'defaultBusPreference', coalesce(v_default_bus, 'EGAL')
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
        then nullif(lower(btrim(v_member.email)), '') end,
      'defaultBoardingStopId', null,
      'defaultBusPreference', 'EGAL'
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
