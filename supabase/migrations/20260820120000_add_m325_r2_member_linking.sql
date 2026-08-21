-- Plaerrdeifl Digitalplattform V4
-- P300 / M325-R2: Portalidentitaet fuer Mitfahrer und Teilnehmer
-- D-055 ersetzt das noch nicht angewendete D-054-Mitgliedsankermodell.

alter table app_modules.fanbus_companion_list_members
  add column linked_portal_user_id uuid;

alter table app_modules.fanbus_companion_list_members
  add constraint fanbus_companion_list_members_linked_portal_user_fk
  foreign key (linked_portal_user_id)
  references app_portal.users(id)
  on delete restrict;

create index fanbus_companion_list_members_linked_portal_user_idx
  on app_modules.fanbus_companion_list_members(linked_portal_user_id)
  where linked_portal_user_id is not null;

alter table app_modules.fanbus_companion_list_members enable row level security;
revoke all on table app_modules.fanbus_companion_list_members
from public, anon, authenticated;
revoke all on table app_portal.users
from public, anon, authenticated;

insert into app_portal.capabilities (
  code,
  name,
  category,
  description,
  is_active,
  sort_order
)
values (
  'fanbus.participant_identity.manage',
  'Fanbus-Teilnehmeridentitaeten verknuepfen',
  'Fanbus',
  'Bestehende aktuelle Fanbus-Gastteilnahmen explizit mit aktiven Portalusern verknuepfen oder korrigieren.',
  true,
  220
)
on conflict (code) do update
set name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

insert into app_portal.team_functions (
  code,
  name,
  description,
  is_active
)
values (
  'BUS_PARTICIPANT_IDENTITY',
  'Teilnehmeridentitäten verknüpfen',
  'Bestehende Fanbus-Gastteilnehmer kontrolliert mit Portalidentitäten verknüpfen und Zuordnungen korrigieren.',
  true
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = excluded.is_active;

do $$
begin
  if not exists (
    select 1
    from app_portal.teams
    where code = 'BUS_ORGA'
  ) then
    raise exception 'M325_R2_BUS_ORGA_TEAM_MISSING'
      using errcode = 'P0002';
  end if;
end;
$$;

insert into app_portal.team_function_capabilities (
  team_id,
  function_code,
  capability_code,
  is_active,
  created_by
)
select
  team.id,
  'BUS_PARTICIPANT_IDENTITY',
  'fanbus.participant_identity.manage',
  true,
  null
from app_portal.teams as team
where team.code = 'BUS_ORGA'
on conflict (team_id, function_code, capability_code) do update
set is_active = true;

-- Gemeinsamer datensparsamer Suchkern. Die aufrufenden API-Funktionen
-- erzwingen entweder einen aktiven Portalactor oder die neue M010-Capability.
create function app_private.m325_portal_people_search(p_query text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with searchable as (
    select
      portal_user.id,
      btrim(portal_user.first_name) || ' ' || btrim(portal_user.last_name)
        as display_name,
      exists (
        select 1
        from app_portal.user_member_links as link
        join app_fanclub.members as member
          on member.id = link.member_id
         and member.status = 'ACTIVE'
        where link.user_id = portal_user.id
      ) as is_member
    from app_portal.users as portal_user
    where portal_user.status = 'ACTIVE'
  ), matches as (
    select searchable.*
    from searchable
    where strpos(lower(searchable.display_name), lower(p_query)) > 0
    order by lower(searchable.display_name), searchable.id
    limit 8
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'portalUserId', matched.id,
      'displayName', matched.display_name,
      'badge', 'Portaluser',
      'isMember', matched.is_member
    )
    order by lower(matched.display_name), matched.id
  ), '[]'::jsonb)
  from matches as matched;
$function$;

create function app_private.api_fanbus_companion_person_search(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_query text;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ? 'query'
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'query'
     ) then
    raise exception 'FANBUS_PERSON_SEARCH_INVALID_QUERY' using errcode = '22023';
  end if;

  v_query := lower(btrim(coalesce(p_payload ->> 'query', '')));
  if length(v_query) < 3 then
    raise exception 'FANBUS_PERSON_SEARCH_INVALID_QUERY' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'people', app_private.m325_portal_people_search(v_query)
  );
end;
$function$;

-- Stable IDs haben Vorrang. Nur ein eingehender Gast ohne stabile Identitaet
-- faellt auf den vorsichtigen Namensvergleich gegen jede bestehende Live-Zeile.
create function app_private.m325_companion_conflict_status(
  p_trip_id uuid,
  p_template_member_id uuid,
  p_linked_portal_user_id uuid,
  p_derived_member_id uuid,
  p_first_name text,
  p_last_name text,
  p_exclude_registration_id uuid default null
)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when exists (
      select 1
      from app_modules.fanbus_registrations as registration
      where registration.trip_id = p_trip_id
        and registration.id is distinct from p_exclude_registration_id
        and registration.status in ('ACTIVE', 'WAITLISTED')
        and (
          (p_linked_portal_user_id is not null
            and registration.portal_user_id = p_linked_portal_user_id)
          or (p_derived_member_id is not null
            and registration.member_id = p_derived_member_id)
          or (p_template_member_id is not null
            and registration.companion_list_member_id = p_template_member_id)
        )
    ) then 'ALREADY_REGISTERED'
    when p_linked_portal_user_id is null
      and p_derived_member_id is null
      and exists (
        select 1
        from app_modules.fanbus_registrations as registration
        where registration.trip_id = p_trip_id
          and registration.id is distinct from p_exclude_registration_id
          and registration.status in ('ACTIVE', 'WAITLISTED')
          and lower(btrim(registration.first_name)) = lower(btrim(p_first_name))
          and lower(btrim(registration.last_name)) = lower(btrim(p_last_name))
      ) then 'CONFLICT'
    else null
  end;
$function$;

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
    if v_stop_id is not null and not exists (
      select 1
      from app_modules.fanbus_trip_boarding_stops
      where id = v_stop_id and trip_id = new.trip_id and is_active
    ) then
      raise exception 'FANBUS_BOARDING_STOP_UNAVAILABLE' using errcode = '22023';
    end if;

    if v_template_id is not null then
      if new.source <> 'PORTAL'
         or new.booking_role <> 'COMPANION'
         or new.created_by is null then
        raise exception 'FANBUS_TEMPLATE_MEMBER_FORBIDDEN' using errcode = '42501';
      end if;

      select list.owner_user_id
      into v_owner
      from app_modules.fanbus_companion_list_members as companion
      join app_modules.fanbus_companion_lists as list
        on list.id = companion.list_id
      where companion.id = v_template_id
        and companion.linked_portal_user_id
          is not distinct from v_linked_portal_user_id;
      if not found or v_owner <> new.created_by then
        raise exception 'FANBUS_TEMPLATE_MEMBER_FORBIDDEN' using errcode = '42501';
      end if;

      if v_linked_portal_user_id is not null then
        select
          btrim(portal_user.first_name),
          btrim(portal_user.last_name)
        into v_first, v_last
        from app_portal.users as portal_user
        where portal_user.id = v_linked_portal_user_id
          and portal_user.status = 'ACTIVE';
        if not found then
          raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode = '22023';
        end if;

        select link.member_id
        into v_derived_member_id
        from app_portal.user_member_links as link
        join app_fanclub.members as member
          on member.id = link.member_id
         and member.status = 'ACTIVE'
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

    new.trip_boarding_stop_id := v_stop_id;
    new.companion_list_member_id := v_template_id;
    new.operational_note := v_note;
  end if;

  if exists (
    select 1
    from app_modules.fanbus_trip_boarding_stops
    where trip_id = new.trip_id and is_active
  ) and new.trip_boarding_stop_id is null then
    raise exception 'FANBUS_BOARDING_STOP_REQUIRED' using errcode = '22023';
  end if;
  return new;
end;
$function$;

create or replace function app_private.api_fanbus_self_register(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_context jsonb := '[]'::jsonb;
  v_trusted_context jsonb := coalesce(
    nullif(current_setting('app.m325_companion_identity_context', true), ''), '[]'
  )::jsonb;
  v_companion jsonb;
  v_trusted jsonb;
  v_clean jsonb;
  v_index integer := 1;
  v_key uuid;
  v_extended boolean := false;
  v_has_linked_identity boolean := false;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(v_trusted_context) <> 'array' then
    raise exception 'FANBUS_SELF_REGISTRATION_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  perform set_config('app.m325_companion_identity_context', '[]', true);
  select exists (
    select 1
    from jsonb_array_elements(v_trusted_context) as trusted(value)
    where trusted.value ? 'linkedPortalUserId'
  ) into v_has_linked_identity;
  begin
    v_key := (p_payload ->> 'idempotencyKey')::uuid;
  exception when others then
    raise exception 'FANBUS_SELF_REGISTRATION_INVALID_PAYLOAD' using errcode = '22023';
  end;

  v_context := v_context || jsonb_build_array(jsonb_build_object(
    'sequence', 1,
    'boardingStopId', nullif(p_payload ->> 'boardingStopId', ''),
    'operationalNote', nullif(btrim(coalesce(p_payload ->> 'operationalNote', '')), '')
  ));
  v_extended := p_payload ? 'boardingStopId' or p_payload ? 'operationalNote';

  for v_companion in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'companions', '[]'::jsonb))
  loop
    v_index := v_index + 1;
    select value into v_trusted
    from jsonb_array_elements(v_trusted_context)
    where (value ->> 'sequence')::integer = v_index
    limit 1;
    v_extended := v_extended
      or v_companion ? 'boardingStopId'
      or v_companion ? 'operationalNote'
      or v_companion ? 'templateMemberId'
      or v_trusted is not null;
    v_context := v_context || jsonb_build_array(
      jsonb_strip_nulls(jsonb_build_object(
        'sequence', v_index,
        'boardingStopId', nullif(v_companion ->> 'boardingStopId', ''),
        'operationalNote', nullif(
          btrim(coalesce(v_companion ->> 'operationalNote', '')), ''
        ),
        'templateMemberId', nullif(v_companion ->> 'templateMemberId', ''),
        'linkedPortalUserId', v_trusted ->> 'linkedPortalUserId'
      ))
    );
  end loop;

  perform app_private.m325_assert_idempotency(
    v_key,
    jsonb_build_object(
      'version', case when v_has_linked_identity then 2 else 1 end,
      'actor', v_actor,
      'context', v_context
    ),
    v_extended
  );
  v_clean := p_payload - 'boardingStopId' - 'operationalNote';
  if v_clean ? 'companions' then
    v_clean := jsonb_set(v_clean, '{companions}', coalesce((
      select jsonb_agg(
        value - 'boardingStopId' - 'operationalNote' - 'templateMemberId'
      )
      from jsonb_array_elements(v_clean -> 'companions')
    ), '[]'::jsonb));
  end if;
  perform set_config('app.m325_registration_context', v_context::text, true);
  return app_private.api_fanbus_self_register_before_m325_r1(v_clean);
end;
$function$;

create or replace function app_private.api_fanbus_companion_lists_list()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
begin
  return jsonb_build_object(
    'lists', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', list.id,
          'name', list.name,
          'revision', list.revision,
          'members', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', companion.id,
                'position', companion.position,
                'firstName', coalesce(portal_user.first_name, companion.first_name),
                'lastName', coalesce(portal_user.last_name, companion.last_name),
                'linkedPortalUserId', companion.linked_portal_user_id,
                'portalUserStatus', portal_user.status,
                'memberStatus', linked_member.status,
                'isMember', linked_member.status = 'ACTIVE',
                'personType', case when companion.linked_portal_user_id is not null
                  then 'PORTAL_USER' else 'GUEST' end,
                'defaultBoardingStopId', companion.default_boarding_stop_id,
                'defaultBusPreference', companion.default_bus_preference,
                'operationalNote', companion.operational_note,
                'revision', companion.revision
              )
              order by companion.position, companion.id
            )
            from app_modules.fanbus_companion_list_members as companion
            left join app_portal.users as portal_user
              on portal_user.id = companion.linked_portal_user_id
            left join app_portal.user_member_links as member_link
              on member_link.user_id = portal_user.id
            left join app_fanclub.members as linked_member
              on linked_member.id = member_link.member_id
            where companion.list_id = list.id
          ), '[]'::jsonb)
        )
        order by lower(list.name), list.id
      )
      from app_modules.fanbus_companion_lists as list
      where list.owner_user_id = v_actor
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function app_private.api_fanbus_companion_member_upsert(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_list uuid := app_private.m325_parse_uuid(
    p_payload ->> 'listId', 'FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD'
  );
  v_id uuid := app_private.m325_parse_uuid(
    p_payload ->> 'id', 'FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD'
  );
  v_linked_portal_user uuid := app_private.m325_parse_uuid(
    p_payload ->> 'linkedPortalUserId', 'FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD'
  );
  v_stop uuid := app_private.m325_parse_uuid(
    p_payload ->> 'defaultBoardingStopId', 'FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD'
  );
  v_pref text := upper(btrim(coalesce(p_payload ->> 'defaultBusPreference', '')));
  v_note text := nullif(btrim(coalesce(p_payload ->> 'operationalNote', '')), '');
  v_revision integer;
  v_position integer;
  v_first text;
  v_last text;
  v_existing app_modules.fanbus_companion_list_members%rowtype;
begin
  begin
    v_revision := nullif(p_payload ->> 'expectedRevision', '')::integer;
  exception when others then
    raise exception 'FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD' using errcode = '22023';
  end;

  perform 1
  from app_modules.fanbus_companion_lists as list
  where list.id = v_list and list.owner_user_id = v_actor
  for update;
  if not found
     or v_pref not in ('RUHIG', 'PARTY', 'EGAL')
     or (v_note is not null and length(v_note) > 240)
     or (v_stop is not null and not exists (
       select 1 from app_modules.fanbus_boarding_stops
       where id = v_stop and is_active
     )) then
    raise exception 'FANBUS_COMPANION_MEMBER_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  if v_id is null then
    if v_linked_portal_user is not null then
      select btrim(portal_user.first_name), btrim(portal_user.last_name)
      into v_first, v_last
      from app_portal.users as portal_user
      where portal_user.id = v_linked_portal_user
        and portal_user.status = 'ACTIVE'
      for share;
      if not found then
        raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode = '22023';
      end if;
    else
      v_first := app_private.require_valid_name(
        app_private.clean_name(p_payload ->> 'firstName'), 'Vorname'
      );
      v_last := app_private.require_valid_name(
        app_private.clean_name(p_payload ->> 'lastName'), 'Nachname'
      );
    end if;

    select coalesce(max(companion.position), 0) + 1
    into v_position
    from app_modules.fanbus_companion_list_members as companion
    where companion.list_id = v_list;

    insert into app_modules.fanbus_companion_list_members(
      list_id, position, first_name, last_name, linked_portal_user_id,
      default_boarding_stop_id, default_bus_preference, operational_note
    ) values (
      v_list, v_position, v_first, v_last, v_linked_portal_user,
      v_stop, v_pref, v_note
    ) returning id into v_id;

    if v_linked_portal_user is not null then
      perform app_private.log_audit(
        v_actor, 'FANBUS_COMPANION_PORTAL_USER_LINKED',
        'fanbus_companion_list_member', v_id::text,
        null, jsonb_build_object('linkedPortalUserId', v_linked_portal_user),
        jsonb_build_object(
          'listId', v_list,
          'linkedPortalUserId', v_linked_portal_user,
          'oldRevision', null,
          'newRevision', 1
        )
      );
    end if;
  else
    select companion.*
    into v_existing
    from app_modules.fanbus_companion_list_members as companion
    where companion.id = v_id and companion.list_id = v_list
    for update;

    if not found or v_revision is null or v_existing.revision <> v_revision
       or v_linked_portal_user is not null then
      raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode = '40001';
    end if;

    if v_existing.linked_portal_user_id is null then
      v_first := app_private.require_valid_name(
        app_private.clean_name(p_payload ->> 'firstName'), 'Vorname'
      );
      v_last := app_private.require_valid_name(
        app_private.clean_name(p_payload ->> 'lastName'), 'Nachname'
      );
    else
      v_first := v_existing.first_name;
      v_last := v_existing.last_name;
    end if;

    update app_modules.fanbus_companion_list_members
    set first_name = v_first,
        last_name = v_last,
        default_boarding_stop_id = v_stop,
        default_bus_preference = v_pref,
        operational_note = v_note,
        revision = revision + 1
    where id = v_id;
  end if;

  return jsonb_build_object(
    'id', v_id,
    'position', (
      select companion.position
      from app_modules.fanbus_companion_list_members as companion
      where companion.id = v_id
    )
  );
end;
$function$;

create function app_private.api_fanbus_companion_person_link(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := app_private.m325_parse_uuid(
    p_payload ->> 'id', 'FANBUS_COMPANION_PERSON_LINK_INVALID_PAYLOAD'
  );
  v_target uuid := app_private.m325_parse_uuid(
    p_payload ->> 'linkedPortalUserId', 'FANBUS_COMPANION_PERSON_LINK_INVALID_PAYLOAD'
  );
  v_expected integer;
  v_existing app_modules.fanbus_companion_list_members%rowtype;
  v_first text;
  v_last text;
begin
  begin
    v_expected := nullif(p_payload ->> 'expectedRevision', '')::integer;
  exception when others then
    raise exception 'FANBUS_COMPANION_PERSON_LINK_INVALID_PAYLOAD' using errcode = '22023';
  end;
  if v_id is null or v_target is null or v_expected is null then
    raise exception 'FANBUS_COMPANION_PERSON_LINK_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  select companion.*
  into v_existing
  from app_modules.fanbus_companion_list_members as companion
  join app_modules.fanbus_companion_lists as list on list.id = companion.list_id
  where companion.id = v_id and list.owner_user_id = v_actor
  for update of list, companion;

  if not found or v_existing.revision <> v_expected then
    raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode = '40001';
  end if;
  if v_existing.linked_portal_user_id = v_target then
    return jsonb_build_object(
      'id', v_id, 'revision', v_existing.revision, 'noOp', true
    );
  end if;

  select btrim(portal_user.first_name), btrim(portal_user.last_name)
  into v_first, v_last
  from app_portal.users as portal_user
  where portal_user.id = v_target and portal_user.status = 'ACTIVE'
  for share;
  if not found then
    raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode = '22023';
  end if;

  update app_modules.fanbus_companion_list_members
  set linked_portal_user_id = v_target,
      first_name = v_first,
      last_name = v_last,
      revision = revision + 1
  where id = v_id;

  perform app_private.log_audit(
    v_actor, 'FANBUS_COMPANION_PORTAL_USER_LINKED',
    'fanbus_companion_list_member', v_id::text,
    jsonb_build_object('linkedPortalUserId', v_existing.linked_portal_user_id),
    jsonb_build_object('linkedPortalUserId', v_target),
    jsonb_build_object(
      'listId', v_existing.list_id,
      'oldRevision', v_existing.revision,
      'newRevision', v_existing.revision + 1
    )
  );
  return jsonb_build_object(
    'id', v_id, 'revision', v_existing.revision + 1, 'noOp', false
  );
end;
$function$;

create function app_private.api_fanbus_companion_person_unlink(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_id uuid := app_private.m325_parse_uuid(
    p_payload ->> 'id', 'FANBUS_COMPANION_PERSON_UNLINK_INVALID_PAYLOAD'
  );
  v_expected integer;
  v_existing app_modules.fanbus_companion_list_members%rowtype;
begin
  begin
    v_expected := nullif(p_payload ->> 'expectedRevision', '')::integer;
  exception when others then
    raise exception 'FANBUS_COMPANION_PERSON_UNLINK_INVALID_PAYLOAD' using errcode = '22023';
  end;
  if v_id is null or v_expected is null then
    raise exception 'FANBUS_COMPANION_PERSON_UNLINK_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  select companion.*
  into v_existing
  from app_modules.fanbus_companion_list_members as companion
  join app_modules.fanbus_companion_lists as list on list.id = companion.list_id
  where companion.id = v_id and list.owner_user_id = v_actor
  for update of list, companion;

  if not found or v_existing.revision <> v_expected then
    raise exception 'STALE_REVISION_OR_NOT_FOUND' using errcode = '40001';
  end if;
  if v_existing.linked_portal_user_id is null then
    return jsonb_build_object(
      'id', v_id, 'revision', v_existing.revision, 'noOp', true
    );
  end if;

  update app_modules.fanbus_companion_list_members
  set linked_portal_user_id = null,
      revision = revision + 1
  where id = v_id;

  perform app_private.log_audit(
    v_actor, 'FANBUS_COMPANION_PORTAL_USER_UNLINKED',
    'fanbus_companion_list_member', v_id::text,
    jsonb_build_object('linkedPortalUserId', v_existing.linked_portal_user_id),
    jsonb_build_object('linkedPortalUserId', null),
    jsonb_build_object(
      'listId', v_existing.list_id,
      'oldRevision', v_existing.revision,
      'newRevision', v_existing.revision + 1
    )
  );
  return jsonb_build_object(
    'id', v_id, 'revision', v_existing.revision + 1, 'noOp', false
  );
end;
$function$;

create or replace function app_private.api_fanbus_companion_duplicate_preview(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_trip uuid := app_private.m325_parse_uuid(
    p_payload ->> 'tripId', 'FANBUS_COMPANION_PREVIEW_INVALID_PAYLOAD'
  );
  v_participants jsonb := p_payload -> 'participants';
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
  v_template uuid;
  v_linked_portal_user uuid;
  v_derived_member uuid;
  v_primary_member uuid;
  v_first text;
  v_last text;
  v_status text;
  v_portal_status text;
  v_primary text;
  v_seen_templates uuid[] := array[]::uuid[];
  v_seen_portals uuid[] := array[]::uuid[];
  v_seen_members uuid[] := array[]::uuid[];
  v_seen_guest_names text[] := array[]::text[];
  v_guest_key text;
begin
  if jsonb_typeof(v_participants) <> 'array'
     or jsonb_array_length(v_participants) not between 1 and 19 then
    raise exception 'FANBUS_COMPANION_PREVIEW_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  select link.member_id
  into v_primary_member
  from app_portal.user_member_links as link
  join app_fanclub.members as member
    on member.id = link.member_id
   and member.status = 'ACTIVE'
  where link.user_id = v_actor;

  v_primary := case when exists (
    select 1
    from app_modules.fanbus_registrations as registration
    where registration.trip_id = v_trip
      and registration.status in ('ACTIVE', 'WAITLISTED')
      and (
        registration.portal_user_id = v_actor
        or (v_primary_member is not null
          and registration.member_id = v_primary_member)
      )
  ) then 'ALREADY_REGISTERED' else 'READY' end;

  for v_item in
    select value from jsonb_array_elements(v_participants)
  loop
    v_template := app_private.m325_parse_uuid(
      v_item ->> 'templateMemberId', 'FANBUS_COMPANION_PREVIEW_INVALID_PAYLOAD'
    );
    select
      companion.linked_portal_user_id,
      coalesce(portal_user.first_name, companion.first_name),
      coalesce(portal_user.last_name, companion.last_name),
      portal_user.status
    into v_linked_portal_user, v_first, v_last, v_portal_status
    from app_modules.fanbus_companion_list_members as companion
    join app_modules.fanbus_companion_lists as list
      on list.id = companion.list_id
    left join app_portal.users as portal_user
      on portal_user.id = companion.linked_portal_user_id
    where companion.id = v_template and list.owner_user_id = v_actor;
    if not found then
      raise exception 'FANBUS_TEMPLATE_MEMBER_FORBIDDEN' using errcode = '42501';
    end if;

    v_derived_member := null;
    if v_linked_portal_user is null then
      v_first := app_private.require_valid_name(
        app_private.clean_name(
          coalesce(nullif(v_item ->> 'firstName', ''), v_first)
        ), 'Vorname'
      );
      v_last := app_private.require_valid_name(
        app_private.clean_name(
          coalesce(nullif(v_item ->> 'lastName', ''), v_last)
        ), 'Nachname'
      );
      v_guest_key := lower(btrim(v_first)) || ':' || lower(btrim(v_last));
    else
      select link.member_id
      into v_derived_member
      from app_portal.user_member_links as link
      join app_fanclub.members as member
        on member.id = link.member_id
       and member.status = 'ACTIVE'
      where link.user_id = v_linked_portal_user;
      v_guest_key := null;
    end if;

    v_status := null;
    if v_template = any(v_seen_templates)
       or (v_linked_portal_user is not null
         and v_linked_portal_user = any(v_seen_portals))
       or (v_derived_member is not null
         and v_derived_member = any(v_seen_members))
       or (v_guest_key is not null
         and v_guest_key = any(v_seen_guest_names))
       or (v_linked_portal_user is not null
         and v_linked_portal_user = v_actor)
       or (v_derived_member is not null
         and v_derived_member = v_primary_member) then
      v_status := 'CONFLICT';
    elsif v_linked_portal_user is not null and v_portal_status <> 'ACTIVE' then
      v_status := 'UNAVAILABLE';
    else
      v_status := coalesce(app_private.m325_companion_conflict_status(
        v_trip,
        v_template,
        v_linked_portal_user,
        v_derived_member,
        v_first,
        v_last
      ), 'READY');
    end if;

    v_seen_templates := array_append(v_seen_templates, v_template);
    if v_linked_portal_user is not null then
      v_seen_portals := array_append(v_seen_portals, v_linked_portal_user);
    end if;
    if v_derived_member is not null then
      v_seen_members := array_append(v_seen_members, v_derived_member);
    end if;
    if v_guest_key is not null then
      v_seen_guest_names := array_append(v_seen_guest_names, v_guest_key);
    end if;
    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'templateMemberId', v_template,
      'linkedPortalUserId', v_linked_portal_user,
      'isMember', v_derived_member is not null,
      'status', v_status
    ));
  end loop;

  return jsonb_build_object(
    'tripId', v_trip,
    'primaryStatus', v_primary,
    'members', v_result,
    'canSubmit', v_primary = 'READY' and not exists (
      select 1
      from jsonb_array_elements(v_result) as item
      where item.value ->> 'status' <> 'READY'
    )
  );
end;
$function$;

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

  perform 1
  from app_modules.fanbus_trips as trip
  where trip.id = v_trip
  for update;
  perform 1
  from app_modules.fanbus_companion_lists as list
  where list.id = v_list and list.owner_user_id = v_actor
  for update;
  if not found then
    raise exception 'FANBUS_COMPANION_BOOKING_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  for v_item in
    select value from jsonb_array_elements(v_selected)
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

    select companion.*
    into v_member
    from app_modules.fanbus_companion_list_members as companion
    where companion.id = v_template and companion.list_id = v_list
    for update;
    if not found then
      raise exception 'FANBUS_COMPANION_MEMBER_UNAVAILABLE' using errcode = '42501';
    end if;

    if v_trip_stop is null and v_member.default_boarding_stop_id is not null then
      select stop.id into v_trip_stop
      from app_modules.fanbus_trip_boarding_stops as stop
      where stop.trip_id = v_trip
        and stop.boarding_stop_id = v_member.default_boarding_stop_id
        and stop.is_active;
    end if;

    if v_member.linked_portal_user_id is not null then
      select
        btrim(portal_user.first_name),
        btrim(portal_user.last_name)
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

create function app_private.api_fanbus_registration_identity_suggestion(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability(
    'fanbus.participant_identity.manage'
  );
  v_registration_id uuid := app_private.m325_parse_uuid(
    p_payload ->> 'registrationId',
    'FANBUS_REGISTRATION_IDENTITY_INVALID_PAYLOAD'
  );
  v_registration app_modules.fanbus_registrations%rowtype;
  v_match_count integer;
  v_match jsonb;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or v_registration_id is null
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'registrationId'
     ) then
    raise exception 'FANBUS_REGISTRATION_IDENTITY_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select registration.*
  into v_registration
  from app_modules.fanbus_registrations as registration
  join app_modules.fanbus_trips as trip on trip.id = registration.trip_id
  where registration.id = v_registration_id
    and registration.status in ('ACTIVE', 'WAITLISTED')
    and registration.portal_user_id is null
    and trip.status in ('PUBLISHED', 'CLOSED');
  if not found then
    raise exception 'FANBUS_REGISTRATION_IDENTITY_NOT_MUTABLE'
      using errcode = '22023';
  end if;

  with matches as (
    select
      portal_user.id,
      btrim(portal_user.first_name) || ' ' || btrim(portal_user.last_name)
        as display_name,
      exists (
        select 1
        from app_portal.user_member_links as link
        join app_fanclub.members as member
          on member.id = link.member_id
         and member.status = 'ACTIVE'
        where link.user_id = portal_user.id
      ) as is_member
    from app_portal.users as portal_user
    where portal_user.status = 'ACTIVE'
      and lower(btrim(portal_user.first_name)) =
        lower(btrim(v_registration.first_name))
      and lower(btrim(portal_user.last_name)) =
        lower(btrim(v_registration.last_name))
  )
  select
    count(*)::integer,
    case when count(*) = 1 then (
      jsonb_agg(jsonb_build_object(
        'portalUserId', matches.id,
        'displayName', matches.display_name,
        'badge', 'Portaluser',
        'isMember', matches.is_member
      )) -> 0
    ) end
  into v_match_count, v_match
  from matches;

  return jsonb_build_object(
    'registrationId', v_registration_id,
    'status', case
      when v_match_count = 0 then 'NONE'
      when v_match_count = 1 then 'SINGLE'
      else 'MULTIPLE'
    end,
    'suggestion', v_match
  );
end;
$function$;

create function app_private.api_fanbus_registration_identity_search(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability(
    'fanbus.participant_identity.manage'
  );
  v_query text;
begin
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or not p_payload ? 'query'
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'query'
     ) then
    raise exception 'FANBUS_PERSON_SEARCH_INVALID_QUERY' using errcode = '22023';
  end if;

  v_query := lower(btrim(coalesce(p_payload ->> 'query', '')));
  if length(v_query) < 3 then
    raise exception 'FANBUS_PERSON_SEARCH_INVALID_QUERY' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'people', app_private.m325_portal_people_search(v_query)
  );
end;
$function$;

create function app_private.m325_registration_identity_set(
  p_payload jsonb,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability(
    'fanbus.participant_identity.manage'
  );
  v_mode text := upper(btrim(coalesce(p_mode, '')));
  v_registration_id uuid := app_private.m325_parse_uuid(
    p_payload ->> 'registrationId',
    'FANBUS_REGISTRATION_IDENTITY_INVALID_PAYLOAD'
  );
  v_target_portal_user_id uuid := app_private.m325_parse_uuid(
    p_payload ->> 'portalUserId',
    'FANBUS_REGISTRATION_IDENTITY_INVALID_PAYLOAD'
  );
  v_expected integer;
  v_trip_id uuid;
  v_trip_status text;
  v_existing app_modules.fanbus_registrations%rowtype;
  v_companion app_modules.fanbus_companion_list_members%rowtype;
  v_target_member_id uuid;
  v_first text;
  v_last text;
  v_companion_changed boolean := false;
  v_companion_old_revision integer;
  v_companion_new_revision integer;
begin
  begin
    v_expected := nullif(p_payload ->> 'expectedRevision', '')::integer;
  exception when others then
    raise exception 'FANBUS_REGISTRATION_IDENTITY_INVALID_PAYLOAD'
      using errcode = '22023';
  end;
  if p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or v_mode not in ('LINK', 'RELINK', 'UNLINK')
     or v_registration_id is null
     or v_expected is null
     or v_expected <= 0
     or (v_mode in ('LINK', 'RELINK') and v_target_portal_user_id is null)
     or (v_mode = 'UNLINK' and p_payload ? 'portalUserId')
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(
         case when v_mode = 'UNLINK'
           then array['registrationId', 'expectedRevision']
           else array['registrationId', 'expectedRevision', 'portalUserId']
         end
       )
     ) then
    raise exception 'FANBUS_REGISTRATION_IDENTITY_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select registration.trip_id
  into v_trip_id
  from app_modules.fanbus_registrations as registration
  where registration.id = v_registration_id;
  if not found then
    raise exception 'FANBUS_REGISTRATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform app_private.m330_lock_mutable_fanbus_trip(v_trip_id);
  select trip.status into v_trip_status
  from app_modules.fanbus_trips as trip
  where trip.id = v_trip_id;
  if v_trip_status not in ('PUBLISHED', 'CLOSED') then
    raise exception 'FANBUS_REGISTRATION_IDENTITY_NOT_MUTABLE'
      using errcode = '22023';
  end if;

  select registration.*
  into v_existing
  from app_modules.fanbus_registrations as registration
  where registration.id = v_registration_id
    and registration.trip_id = v_trip_id
  for update;
  if not found then
    raise exception 'FANBUS_REGISTRATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_existing.revision <> v_expected then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;
  if v_existing.status not in ('ACTIVE', 'WAITLISTED') then
    raise exception 'FANBUS_REGISTRATION_IDENTITY_NOT_MUTABLE'
      using errcode = '22023';
  end if;
  if v_existing.source = 'PORTAL'
     and v_existing.booking_role = 'PRIMARY' then
    raise exception 'FANBUS_PRIMARY_PORTAL_IDENTITY_IMMUTABLE'
      using errcode = '22023';
  end if;

  if v_mode = 'LINK' then
    if v_existing.portal_user_id is not null
       or v_existing.member_id is not null then
      raise exception 'FANBUS_REGISTRATION_IDENTITY_RELINK_REQUIRED'
        using errcode = '22023';
    end if;
  elsif v_mode = 'RELINK' then
    if v_existing.portal_user_id is null then
      raise exception 'FANBUS_REGISTRATION_IDENTITY_LINK_REQUIRED'
        using errcode = '22023';
    end if;
    if v_existing.portal_user_id = v_target_portal_user_id then
      return jsonb_build_object(
        'registrationId', v_existing.id,
        'revision', v_existing.revision,
        'noOp', true
      );
    end if;
  elsif v_existing.portal_user_id is null then
    return jsonb_build_object(
      'registrationId', v_existing.id,
      'revision', v_existing.revision,
      'noOp', true
    );
  end if;

  if v_mode in ('LINK', 'RELINK') then
    select
      btrim(portal_user.first_name),
      btrim(portal_user.last_name)
    into v_first, v_last
    from app_portal.users as portal_user
    where portal_user.id = v_target_portal_user_id
      and portal_user.status = 'ACTIVE'
    for share;
    if not found then
      raise exception 'FANBUS_PORTAL_USER_UNAVAILABLE' using errcode = '22023';
    end if;

    select link.member_id
    into v_target_member_id
    from app_portal.user_member_links as link
    join app_fanclub.members as member
      on member.id = link.member_id
     and member.status = 'ACTIVE'
    where link.user_id = v_target_portal_user_id
    for share of link, member;

    if app_private.m325_companion_conflict_status(
      v_existing.trip_id,
      v_existing.companion_list_member_id,
      v_target_portal_user_id,
      v_target_member_id,
      v_first,
      v_last,
      v_existing.id
    ) is not null then
      raise exception 'FANBUS_REGISTRATION_IDENTITY_DUPLICATE'
        using errcode = 'P3251';
    end if;
  else
    v_target_portal_user_id := null;
    v_target_member_id := null;
    v_first := v_existing.first_name;
    v_last := v_existing.last_name;
  end if;

  if v_existing.companion_list_member_id is not null then
    select companion.*
    into v_companion
    from app_modules.fanbus_companion_list_members as companion
    join app_modules.fanbus_companion_lists as list
      on list.id = companion.list_id
    where companion.id = v_existing.companion_list_member_id
      and list.owner_user_id = v_existing.created_by
    for update of list, companion;
    if not found then
      raise exception 'FANBUS_COMPANION_IDENTITY_PROVENANCE_CONFLICT'
        using errcode = 'P3251';
    end if;

    if v_mode = 'LINK' then
      if v_companion.linked_portal_user_id is null then
        v_companion_changed := true;
      elsif v_companion.linked_portal_user_id <> v_target_portal_user_id then
        raise exception 'FANBUS_COMPANION_IDENTITY_CONFLICT'
          using errcode = 'P3251';
      end if;
    elsif v_mode = 'RELINK' then
      if v_companion.linked_portal_user_id is null
         or v_companion.linked_portal_user_id = v_existing.portal_user_id then
        v_companion_changed := true;
      elsif v_companion.linked_portal_user_id <> v_target_portal_user_id then
        raise exception 'FANBUS_COMPANION_IDENTITY_CONFLICT'
          using errcode = 'P3251';
      end if;
    else
      if v_companion.linked_portal_user_id = v_existing.portal_user_id then
        v_companion_changed := true;
      elsif v_companion.linked_portal_user_id is not null then
        raise exception 'FANBUS_COMPANION_IDENTITY_CONFLICT'
          using errcode = 'P3251';
      end if;
    end if;

    if v_companion_changed then
      v_companion_old_revision := v_companion.revision;
      update app_modules.fanbus_companion_list_members
      set linked_portal_user_id = v_target_portal_user_id,
          first_name = case when v_mode = 'UNLINK'
            then first_name else v_first end,
          last_name = case when v_mode = 'UNLINK'
            then last_name else v_last end,
          revision = revision + 1
      where id = v_companion.id
      returning revision into v_companion_new_revision;
    end if;
  end if;

  update app_modules.fanbus_registrations
  set portal_user_id = v_target_portal_user_id,
      member_id = v_target_member_id,
      first_name = v_first,
      last_name = v_last,
      revision = revision + 1,
      updated_by = v_actor
  where id = v_existing.id;

  perform app_private.log_audit(
    v_actor,
    case v_mode
      when 'LINK' then 'FANBUS_REGISTRATION_IDENTITY_LINKED'
      when 'RELINK' then 'FANBUS_REGISTRATION_IDENTITY_RELINKED'
      else 'FANBUS_REGISTRATION_IDENTITY_UNLINKED'
    end,
    'fanbus_registration',
    v_existing.id::text,
    jsonb_build_object(
      'portalUserId', v_existing.portal_user_id,
      'memberId', v_existing.member_id,
      'revision', v_existing.revision
    ),
    jsonb_build_object(
      'portalUserId', v_target_portal_user_id,
      'memberId', v_target_member_id,
      'revision', v_existing.revision + 1
    ),
    jsonb_strip_nulls(jsonb_build_object(
      'tripId', v_existing.trip_id,
      'registrationId', v_existing.id,
      'companionId', v_existing.companion_list_member_id,
      'companionOldRevision', v_companion_old_revision,
      'companionNewRevision', v_companion_new_revision
    ))
  );

  if v_companion_changed then
    perform app_private.log_audit(
      v_actor,
      case v_mode
        when 'LINK' then 'FANBUS_COMPANION_PORTAL_USER_LINKED'
        when 'RELINK' then 'FANBUS_COMPANION_PORTAL_USER_RELINKED'
        else 'FANBUS_COMPANION_PORTAL_USER_UNLINKED'
      end,
      'fanbus_companion_list_member',
      v_companion.id::text,
      jsonb_build_object(
        'linkedPortalUserId', v_companion.linked_portal_user_id,
        'revision', v_companion_old_revision
      ),
      jsonb_build_object(
        'linkedPortalUserId', v_target_portal_user_id,
        'revision', v_companion_new_revision
      ),
      jsonb_build_object(
        'registrationId', v_existing.id,
        'tripId', v_existing.trip_id
      )
    );
  end if;

  return jsonb_build_object(
    'registrationId', v_existing.id,
    'revision', v_existing.revision + 1,
    'portalUserId', v_target_portal_user_id,
    'isMember', v_target_member_id is not null,
    'companionId', v_existing.companion_list_member_id,
    'companionRevision', v_companion_new_revision,
    'noOp', false
  );
end;
$function$;

create function app_private.api_fanbus_registration_identity_link(
  p_payload jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select app_private.m325_registration_identity_set(p_payload, 'LINK');
$function$;

create function app_private.api_fanbus_registration_identity_relink(
  p_payload jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select app_private.m325_registration_identity_set(p_payload, 'RELINK');
$function$;

create function app_private.api_fanbus_registration_identity_unlink(
  p_payload jsonb
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select app_private.m325_registration_identity_set(p_payload, 'UNLINK');
$function$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_m325_r2_member_linking;

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
    when 'fanbus_companion_person_search' then
      v_data := app_private.api_fanbus_companion_person_search(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_companion_person_link' then
      v_data := app_private.api_fanbus_companion_person_link(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_companion_person_unlink' then
      v_data := app_private.api_fanbus_companion_person_unlink(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_registration_identity_search' then
      v_data := app_private.api_fanbus_registration_identity_search(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_registration_identity_suggestion' then
      v_data := app_private.api_fanbus_registration_identity_suggestion(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_registration_identity_link' then
      v_data := app_private.api_fanbus_registration_identity_link(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_registration_identity_relink' then
      v_data := app_private.api_fanbus_registration_identity_relink(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_registration_identity_unlink' then
      v_data := app_private.api_fanbus_registration_identity_unlink(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return public.pd_api_before_m325_r2_member_linking(p_action, p_payload);
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
  app_private.m325_portal_people_search(text),
  app_private.api_fanbus_companion_person_search(jsonb),
  app_private.api_fanbus_companion_lists_list(),
  app_private.api_fanbus_companion_member_upsert(jsonb),
  app_private.api_fanbus_companion_person_link(jsonb),
  app_private.api_fanbus_companion_person_unlink(jsonb),
  app_private.m325_companion_conflict_status(
    uuid, uuid, uuid, uuid, text, text, uuid
  ),
  app_private.m325_registration_before_insert(),
  app_private.api_fanbus_self_register(jsonb),
  app_private.api_fanbus_companion_duplicate_preview(jsonb),
  app_private.api_fanbus_companion_booking_submit(jsonb),
  app_private.api_fanbus_registration_identity_suggestion(jsonb),
  app_private.api_fanbus_registration_identity_search(jsonb),
  app_private.m325_registration_identity_set(jsonb, text),
  app_private.api_fanbus_registration_identity_link(jsonb),
  app_private.api_fanbus_registration_identity_relink(jsonb),
  app_private.api_fanbus_registration_identity_unlink(jsonb),
  public.pd_api_before_m325_r2_member_linking(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.m325_portal_people_search(text),
  app_private.api_fanbus_companion_person_search(jsonb),
  app_private.api_fanbus_companion_lists_list(),
  app_private.api_fanbus_companion_member_upsert(jsonb),
  app_private.api_fanbus_companion_person_link(jsonb),
  app_private.api_fanbus_companion_person_unlink(jsonb),
  app_private.m325_companion_conflict_status(
    uuid, uuid, uuid, uuid, text, text, uuid
  ),
  app_private.m325_registration_before_insert(),
  app_private.api_fanbus_self_register(jsonb),
  app_private.api_fanbus_companion_duplicate_preview(jsonb),
  app_private.api_fanbus_companion_booking_submit(jsonb),
  app_private.api_fanbus_registration_identity_suggestion(jsonb),
  app_private.api_fanbus_registration_identity_search(jsonb),
  app_private.m325_registration_identity_set(jsonb, text),
  app_private.api_fanbus_registration_identity_link(jsonb),
  app_private.api_fanbus_registration_identity_relink(jsonb),
  app_private.api_fanbus_registration_identity_unlink(jsonb),
  public.pd_api_before_m325_r2_member_linking(text, jsonb)
to postgres;

revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.pd_api(text, jsonb) to authenticated;

comment on column
  app_modules.fanbus_companion_list_members.linked_portal_user_id is
  'M325-R2 stabile Companion-Portalidentitaet; Mitgliedschaft wird nur aktuell ueber M150 abgeleitet.';
comment on function app_private.api_fanbus_companion_person_search(jsonb) is
  'M325-R2 begrenzte ACTIVE-Portalusersuche ohne PII.';
comment on function app_private.m325_registration_identity_set(jsonb, text) is
  'M325-R2 expliziter Capability-, CAS-, Duplicate- und M330-gesicherter administrativer Identity-Link.';
comment on function public.pd_api(text, jsonb) is
  'M325-R2 authenticated API boundary fuer private Companion- und administrative Teilnehmeridentitaet.';
