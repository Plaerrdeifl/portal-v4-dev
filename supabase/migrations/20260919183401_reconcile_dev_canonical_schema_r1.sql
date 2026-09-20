-- Plärrdeifl Digitalplattform V4
-- DEV reconciliation: align active database contract with canonical main.
-- Forward-only and data-preserving: function bodies, one CHECK constraint, and RPC grants.
-- PROD is not targeted by this migration during the current repair.

begin;

-- Canonical predecessor required by the converged Liveticker bootstrap chain.
CREATE OR REPLACE FUNCTION app_private.api_bootstrap_before_liveticker_prod_r1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_auth_id uuid := auth.uid();

  v_base jsonb :=
    app_private.api_bootstrap_before_m010_r2();

  v_member jsonb := null;

  v_can_view_fanclub boolean := false;
begin
  if v_auth_id is null then
    return v_base;
  end if;

  select jsonb_build_object(
    'id',
    member.id,

    'memberCode',
    member.member_code,

    'firstName',
    member.first_name,

    'lastName',
    member.last_name,

    'status',
    member.status
  )
  into v_member
  from app_portal.user_member_links as link
  join app_fanclub.members as member
    on member.id = link.member_id
   and member.status = 'ACTIVE'
  where link.user_id = v_auth_id;

  if v_base -> 'user' is not null
     and jsonb_typeof(v_base -> 'user') = 'object' then
    v_base :=
      jsonb_set(
        v_base,
        '{user,member}',
        coalesce(
          v_member,
          'null'::jsonb
        ),
        true
      );
  end if;

  if coalesce(
    v_base ->> 'state',
    ''
  ) = 'ACTIVE' then

    v_can_view_fanclub :=
      app_private.has_capability(
        v_auth_id,
        'members.read'
      )
      or v_member is not null;

    v_base :=
      jsonb_set(
        v_base,
        '{navigation,fanclub}',
        to_jsonb(v_can_view_fanclub),
        true
      );
  end if;

  return v_base;
end;
$function$;

-- Canonical definition: app_private.api_bootstrap()
CREATE OR REPLACE FUNCTION app_private.api_bootstrap()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_auth uuid:=auth.uid(); v_base jsonb:=app_private.api_bootstrap_before_liveticker_prod_r1(); v_can boolean:=false; begin
 if v_auth is not null and coalesce(v_base->>'state','')='ACTIVE' then v_can:=app_private.has_capability(v_auth,'liveticker.manage'); end if;
 return jsonb_set(v_base,'{navigation,liveticker}',to_jsonb(v_can),true);
end; $function$;

-- Canonical definition: app_private.api_fanbus_assignment_preview(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_assignment_preview(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

-- Canonical definition: app_private.api_fanbus_contact_admin_save(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_contact_admin_save(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_expected_revision integer;
  v_current_revision integer;
  v_before jsonb;
  v_primary jsonb := coalesce(p_payload -> 'primary', '{}'::jsonb);
  v_contacts jsonb := coalesce(p_payload -> 'contacts', '[]'::jsonb);
  v_primary_normalized jsonb;
  v_contacts_normalized jsonb := '[]'::jsonb;
  v_emails jsonb := '[]'::jsonb;
  v_phones jsonb := '[]'::jsonb;
  v_whatsapp jsonb := '{}'::jsonb;
  v_new jsonb;
  v_item jsonb;
  v_name text;
  v_phone text;
  v_email text;
  v_e164 text;
  v_whatsapp_enabled boolean;
begin
  if jsonb_typeof(v_primary) <> 'object' then
    raise exception 'Der Plärrdeifl-Hauptkontakt ist ungültig.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_contacts) <> 'array' then
    raise exception 'Kontakte müssen als Liste übergeben werden.' using errcode = '22023';
  end if;
  if jsonb_array_length(v_contacts) > 20 then
    raise exception 'Es können maximal 20 Bus-Orga-Kontakte gespeichert werden.' using errcode = '22023';
  end if;

  begin
    v_expected_revision := nullif(p_payload ->> 'expectedRevision', '')::integer;
  exception when others then
    v_expected_revision := null;
  end;

  select setting.value, setting.revision
  into v_before, v_current_revision
  from app_portal.settings as setting
  where setting.key = 'fanbus.organization_contact'
  for update;

  if not found then
    raise exception 'Die Fanbus-Kontakteinstellung wurde nicht gefunden.' using errcode = 'P0002';
  end if;
  if v_expected_revision is null or v_expected_revision <> v_current_revision then
    raise exception 'Die Kontaktdaten wurden zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode = '40001';
  end if;

  v_name := btrim(coalesce(v_primary ->> 'name', ''));
  v_phone := btrim(coalesce(v_primary ->> 'phone', ''));
  v_email := btrim(coalesce(v_primary ->> 'email', ''));
  v_whatsapp_enabled := coalesce((v_primary ->> 'whatsapp')::boolean, false);
  v_e164 := app_private.fanbus_contact_e164(v_phone);

  if length(v_name) not between 1 and 80 or v_name ~ E'[\r\n]' then
    raise exception 'Der Name des Plärrdeifl-Hauptkontakts ist ungültig.' using errcode = '22023';
  end if;
  if length(v_phone) > 40 or v_phone ~ E'[\r\n]' then
    raise exception 'Die Telefonnummer des Plärrdeifl-Hauptkontakts ist ungültig.' using errcode = '22023';
  end if;
  if v_phone <> '' and v_e164 is null then
    raise exception 'Die Telefonnummer des Plärrdeifl-Hauptkontakts ist nicht eindeutig.' using errcode = '22023';
  end if;
  if v_email <> '' and not app_private.notification_email_is_valid(v_email) then
    raise exception 'Die E-Mail-Adresse des Plärrdeifl-Hauptkontakts ist ungültig.' using errcode = '22023';
  end if;

  v_primary_normalized := jsonb_build_object(
    'name', v_name,
    'phone', v_phone,
    'whatsapp', v_whatsapp_enabled,
    'email', v_email
  );

  if v_email <> '' then
    v_emails := v_emails || jsonb_build_array(jsonb_build_object('label', v_name, 'value', v_email));
  end if;
  if v_e164 is not null then
    v_phones := v_phones || jsonb_build_array(jsonb_build_object('label', v_name, 'value', v_phone, 'href', 'tel:' || v_e164));
    if v_whatsapp_enabled then
      v_whatsapp := jsonb_build_object(
        'label', v_name,
        'username', v_phone,
        'url', 'https://wa.me/' || replace(v_e164, '+', '')
      );
    end if;
  end if;

  for v_item in select item.value from jsonb_array_elements(v_contacts) as item(value)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Mindestens ein Bus-Orga-Kontakt ist ungültig.' using errcode = '22023';
    end if;

    v_name := btrim(coalesce(v_item ->> 'name', ''));
    v_phone := btrim(coalesce(v_item ->> 'phone', ''));
    v_email := btrim(coalesce(v_item ->> 'email', ''));
    v_whatsapp_enabled := coalesce((v_item ->> 'whatsapp')::boolean, false);
    v_e164 := app_private.fanbus_contact_e164(v_phone);

    if length(v_name) not between 1 and 80 or v_name ~ E'[\r\n]' then
      raise exception 'Mindestens ein Kontaktname ist ungültig.' using errcode = '22023';
    end if;
    if length(v_phone) not between 3 and 40 or v_phone ~ E'[\r\n]' or v_e164 is null then
      raise exception 'Für jeden Bus-Orga-Kontakt ist eine gültige Telefonnummer erforderlich.' using errcode = '22023';
    end if;
    if v_email <> '' and not app_private.notification_email_is_valid(v_email) then
      raise exception 'Mindestens eine Kontakt-E-Mail-Adresse ist ungültig.' using errcode = '22023';
    end if;

    v_contacts_normalized := v_contacts_normalized || jsonb_build_array(jsonb_build_object(
      'name', v_name,
      'phone', v_phone,
      'whatsapp', v_whatsapp_enabled,
      'email', v_email
    ));
    v_phones := v_phones || jsonb_build_array(jsonb_build_object('label', v_name, 'value', v_phone, 'href', 'tel:' || v_e164));
    if v_email <> '' then
      v_emails := v_emails || jsonb_build_array(jsonb_build_object('label', v_name, 'value', v_email));
    end if;
  end loop;

  v_new := jsonb_build_object(
    'version', 2,
    'primary', v_primary_normalized,
    'contacts', v_contacts_normalized,
    'emails', v_emails,
    'phones', v_phones,
    'whatsapp', v_whatsapp
  );

  update app_portal.settings as setting
  set value = v_new,
      revision = setting.revision + 1,
      updated_at = now(),
      updated_by = v_actor
  where setting.key = 'fanbus.organization_contact';

  perform app_private.log_audit(
    v_actor,
    'FANBUS_CONTACTS_UPDATED',
    'settings',
    'fanbus.organization_contact',
    v_before,
    v_new,
    jsonb_build_object('contactCount', jsonb_array_length(v_contacts_normalized))
  );

  return app_private.api_fanbus_contact_admin_get('{}'::jsonb);
end;
$function$;

-- Canonical definition: app_private.api_fanbus_publishing_event_place_bind(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_publishing_event_place_bind(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_event_id uuid;
  v_place_id uuid;
  v_venue text;
  v_place_key text;
  v_before jsonb;
  v_binding app_modules.fanbus_publishing_event_places%rowtype;
begin
  if coalesce(p_payload, '{}'::jsonb) - array['eventId', 'placeId']::text[]
     <> '{}'::jsonb then
    raise exception 'M340_EVENT_PLACE_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_event_id := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'eventId', '')), '')::uuid;
    v_place_id := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'placeId', '')), '')::uuid;
  exception when others then
    raise exception 'M340_EVENT_PLACE_INVALID_PAYLOAD' using errcode = '22023';
  end;
  if v_event_id is null or v_place_id is null then
    raise exception 'M340_EVENT_PLACE_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  select event.venue
    into v_venue
  from app_modules.events as event
  where event.id = v_event_id
  for update;
  if not found then
    raise exception 'M340_EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_place_key := app_private.fanbus_publishing_normalize_place_key(v_venue);
  if v_place_key is null then
    raise exception 'M340_EVENT_VENUE_MISSING' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from app_modules.fanbus_publishing_places as place
    join app_modules.fanbus_publishing_place_keys as place_key
      on place_key.place_id = place.id
    where place.id = v_place_id
      and place.is_active
      and place_key.place_key = v_place_key
  ) then
    raise exception 'M340_EVENT_PLACE_KEY_MISMATCH' using errcode = '22023';
  end if;

  select to_jsonb(binding)
    into v_before
  from app_modules.fanbus_publishing_event_places as binding
  where binding.event_id = v_event_id
  for update;

  insert into app_modules.fanbus_publishing_event_places (
    event_id,
    place_id,
    bound_place_key,
    created_by,
    updated_by
  )
  values (
    v_event_id,
    v_place_id,
    v_place_key,
    v_actor,
    v_actor
  )
  on conflict (event_id) do update
  set
    place_id = excluded.place_id,
    bound_place_key = excluded.bound_place_key,
    updated_by = excluded.updated_by
  returning * into v_binding;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PUBLISHING_EVENT_PLACE_BOUND',
    'event',
    v_event_id::text,
    v_before,
    to_jsonb(v_binding)
  );

  return jsonb_build_object(
    'binding',
    jsonb_build_object(
      'eventId', v_binding.event_id,
      'placeId', v_binding.place_id,
      'boundPlaceKey', v_binding.bound_place_key
    )
  );
end;
$function$;

-- Canonical definition: app_private.api_fanbus_publishing_job_enqueue(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_publishing_job_enqueue(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin perform app_private.require_capability('fanbus.publishing.manage'); perform app_private.worker_runtime_assert_ready('FANBUS_PUBLISHING'); return app_private.api_fanbus_publishing_job_enqueue_before_worker_control_r1(p_payload); end;$function$;

-- Canonical definition: app_private.api_fanbus_publishing_place_create(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_publishing_place_create(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_slug text := pg_catalog.btrim(coalesce(p_payload ->> 'slug', ''));
  v_display_name text := pg_catalog.btrim(coalesce(p_payload ->> 'displayName', ''));
  v_place app_modules.fanbus_publishing_places%rowtype;
begin
  if coalesce(p_payload, '{}'::jsonb) - array['slug', 'displayName']::text[]
     <> '{}'::jsonb then
    raise exception 'M340_PLACE_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  if char_length(v_slug) not between 1 and 48
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'M340_PLACE_SLUG_INVALID' using errcode = '22023';
  end if;
  if char_length(v_display_name) not between 1 and 160 then
    raise exception 'M340_PLACE_DISPLAY_NAME_INVALID' using errcode = '22023';
  end if;

  insert into app_modules.fanbus_publishing_places (
    slug,
    display_name,
    created_by,
    updated_by
  )
  values (
    v_slug,
    v_display_name,
    v_actor,
    v_actor
  )
  returning * into v_place;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PUBLISHING_PLACE_CREATED',
    'fanbus_publishing_place',
    v_place.id::text,
    null,
    jsonb_build_object(
      'id', v_place.id,
      'slug', v_place.slug,
      'displayName', v_place.display_name,
      'active', v_place.is_active,
      'revision', v_place.revision
    )
  );

  return jsonb_build_object(
    'place',
    jsonb_build_object(
      'id', v_place.id,
      'slug', v_place.slug,
      'displayName', v_place.display_name,
      'active', v_place.is_active,
      'slugLocked', v_place.slug_locked,
      'revision', v_place.revision
    )
  );
exception
  when unique_violation then
    raise exception 'M340_PLACE_SLUG_CONFLICT' using errcode = '23505';
end;
$function$;

-- Canonical definition: app_private.api_fanbus_publishing_place_key_add(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_publishing_place_key_add(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_place_id uuid;
  v_source_label text := pg_catalog.btrim(coalesce(p_payload ->> 'sourceLabel', ''));
  v_place_key text;
begin
  if coalesce(p_payload, '{}'::jsonb) - array['placeId', 'sourceLabel']::text[]
     <> '{}'::jsonb then
    raise exception 'M340_PLACE_KEY_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  begin
    v_place_id := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'placeId', '')), '')::uuid;
  exception when others then
    raise exception 'M340_PLACE_KEY_INVALID_PAYLOAD' using errcode = '22023';
  end;
  v_place_key := app_private.fanbus_publishing_normalize_place_key(v_source_label);
  if v_place_id is null
     or v_place_key is null
     or char_length(v_source_label) > 240 then
    raise exception 'M340_PLACE_KEY_INVALID_PAYLOAD' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from app_modules.fanbus_publishing_places as place
    where place.id = v_place_id
  ) then
    raise exception 'M340_PLACE_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into app_modules.fanbus_publishing_place_keys (
    place_id,
    place_key,
    source_label,
    created_by
  )
  values (
    v_place_id,
    v_place_key,
    v_source_label,
    v_actor
  );

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PUBLISHING_PLACE_KEY_ADDED',
    'fanbus_publishing_place',
    v_place_id::text,
    null,
    jsonb_build_object(
      'placeKey', v_place_key,
      'sourceLabel', v_source_label
    )
  );

  return jsonb_build_object(
    'placeId', v_place_id,
    'placeKey', v_place_key,
    'sourceLabel', v_source_label
  );
exception
  when unique_violation then
    raise exception 'M340_PLACE_KEY_CONFLICT' using errcode = '23505';
end;
$function$;

-- Canonical definition: app_private.api_fanbus_publishing_resolution_choose(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_publishing_resolution_choose(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_event_id uuid;
  v_place_id uuid;
  v_venue text;
  v_place_key text;
  v_canonical_key text;
  v_chosen_place app_modules.fanbus_publishing_places%rowtype;
  v_before jsonb;
  v_binding app_modules.fanbus_publishing_event_places%rowtype;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['eventId', 'placeId']::text[] <> '{}'::jsonb
     or not p_payload ?& array['eventId', 'placeId']::text[] then
    raise exception 'M340_PUBLISHING_RESOLUTION_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  begin
    v_event_id := nullif(pg_catalog.btrim(p_payload ->> 'eventId'), '')::uuid;
    v_place_id := nullif(pg_catalog.btrim(p_payload ->> 'placeId'), '')::uuid;
  exception when others then
    raise exception 'M340_PUBLISHING_RESOLUTION_INVALID_PAYLOAD'
      using errcode = '22023';
  end;

  if v_event_id is null or v_place_id is null then
    raise exception 'M340_PUBLISHING_RESOLUTION_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select event.venue
    into v_venue
  from app_modules.events as event
  where event.id = v_event_id
  for update;
  if not found then
    raise exception 'M340_EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_venue := app_private.fanbus_publishing_clean_venue(v_venue);
  v_place_key := app_private.fanbus_publishing_normalize_place_key(v_venue);
  if v_place_key is null then
    raise exception 'M340_PUBLISHING_VENUE_MISSING' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('m340-place:' || v_place_key, 0)
  );

  if not exists (
    select 1
    from app_modules.fanbus_publishing_resolution_aliases as alias
    where alias.alias_place_key = v_place_key
      and alias.resolution_kind = 'AMBIGUOUS'
  ) or not exists (
    select 1
    from app_modules.fanbus_publishing_alias_candidates as candidate
    join app_modules.fanbus_publishing_places as place
      on place.id = candidate.place_id
     and place.is_active
    where candidate.alias_place_key = v_place_key
      and candidate.place_id = v_place_id
  ) or (
    select count(*)
    from app_modules.fanbus_publishing_alias_candidates as candidate
    join app_modules.fanbus_publishing_places as place
      on place.id = candidate.place_id
     and place.is_active
    where candidate.alias_place_key = v_place_key
  ) < 2 then
    raise exception 'M340_PUBLISHING_RESOLUTION_STALE'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from app_modules.fanbus_publishing_place_keys as place_key
    where place_key.place_key = v_place_key
      and place_key.place_id <> v_place_id
  ) then
    raise exception 'M340_PUBLISHING_RESOLUTION_STALE'
      using errcode = '55000';
  end if;

  select place.*
    into v_chosen_place
  from app_modules.fanbus_publishing_places as place
  where place.id = v_place_id
    and place.is_active
  for update;
  if not found then
    raise exception 'M340_PUBLISHING_RESOLUTION_STALE'
      using errcode = '55000';
  end if;

  v_canonical_key := 'v1:' || v_chosen_place.slug;

  if exists (
    select 1
    from app_modules.fanbus_publishing_place_keys as place_key
    where place_key.place_key = v_canonical_key
      and place_key.place_id <> v_place_id
  ) then
    raise exception 'M340_PUBLISHING_RESOLUTION_STALE'
      using errcode = '55000';
  end if;

  insert into app_modules.fanbus_publishing_place_keys (
    place_id,
    place_key,
    source_label,
    created_by
  )
  values (
    v_place_id,
    v_canonical_key,
    v_chosen_place.display_name,
    v_actor
  )
  on conflict (place_key) do nothing;

  insert into app_modules.fanbus_publishing_place_keys (
    place_id,
    place_key,
    source_label,
    created_by
  )
  values (v_place_id, v_place_key, pg_catalog.left(v_venue, 240), v_actor)
  on conflict (place_key) do nothing;

  select to_jsonb(binding)
    into v_before
  from app_modules.fanbus_publishing_event_places as binding
  where binding.event_id = v_event_id
  for update;

  insert into app_modules.fanbus_publishing_event_places (
    event_id,
    place_id,
    bound_place_key,
    created_by,
    updated_by
  )
  values (v_event_id, v_place_id, v_place_key, v_actor, v_actor)
  on conflict (event_id) do update
  set
    place_id = excluded.place_id,
    bound_place_key = excluded.bound_place_key,
    updated_by = excluded.updated_by
  returning * into v_binding;

  delete from app_modules.fanbus_publishing_alias_candidates as candidate
  where candidate.alias_place_key = v_place_key;

  update app_modules.fanbus_publishing_resolution_aliases as alias
  set
    resolution_kind = 'CANONICAL',
    canonical_place_key = v_canonical_key,
    canonical_slug = v_chosen_place.slug,
    canonical_display_name = v_chosen_place.display_name
  where alias.alias_place_key = v_place_key
    and alias.resolution_kind = 'AMBIGUOUS';
  if not found then
    raise exception 'M340_PUBLISHING_RESOLUTION_STALE'
      using errcode = '55000';
  end if;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PUBLISHING_PLACE_AMBIGUITY_RESOLVED',
    'event',
    v_event_id::text,
    v_before,
    to_jsonb(v_binding),
    jsonb_build_object(
      'resolution', 'MANUAL_CANDIDATE_SELECTION',
      'rulePersisted', true
    )
  );

  return jsonb_build_object(
    'resolution',
    app_private.fanbus_publishing_ensure_event_place(v_event_id, v_actor)
  );
end;
$function$;

-- Canonical definition: app_private.api_fanbus_publishing_resolution_ensure(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_publishing_resolution_ensure(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_projection record;
  v_resolution jsonb;
  v_processed integer := 0;
  v_ambiguous integer := 0;
  v_missing integer := 0;
begin
  if coalesce(p_payload, '{}'::jsonb) <> '{}'::jsonb then
    raise exception 'M340_PUBLISHING_RESOLUTION_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  for v_projection in
    select trip.id as trip_id, trip.event_id
    from pg_catalog.jsonb_array_elements(
      coalesce(public.pd_public_fanbus_trips() -> 'trips', '[]'::jsonb)
    ) as item(value)
    join app_modules.fanbus_trips as trip
      on trip.id = (item.value ->> 'tripId')::uuid
    where item.value ->> 'tripStatus' = 'PUBLISHED'
    order by trip.id
  loop
    v_resolution := app_private.fanbus_publishing_ensure_event_place(
      v_projection.event_id,
      v_actor
    );
    v_processed := v_processed + 1;
    if v_resolution ->> 'status' = 'AMBIGUOUS' then
      v_ambiguous := v_ambiguous + 1;
    elsif v_resolution ->> 'status' = 'MISSING_VENUE' then
      v_missing := v_missing + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'processed', v_processed,
    'ambiguous', v_ambiguous,
    'missingVenue', v_missing
  );
end;
$function$;

-- Canonical definition: app_private.api_fanbus_publishing_template_preview_authorize(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_publishing_template_preview_authorize(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_environment text := app_private.platform_release_environment();
  v_kind text := upper(pg_catalog.btrim(coalesce(p_payload ->> 'kind', '')));
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['kind']::text[] <> '{}'::jsonb
     or v_kind not in ('POST', 'STORY', 'LED')
     or v_environment is null then
    raise exception 'M340_TEMPLATE_PREVIEW_INVALID'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'actorId', v_actor,
    'environment', v_environment,
    'kind', v_kind
  );
end;
$function$;

-- Canonical definition: app_private.api_fanbus_publishing_template_rollback(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_publishing_template_rollback(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_environment text := app_private.platform_release_environment();
  v_kind text := upper(pg_catalog.btrim(coalesce(p_payload ->> 'kind', '')));
  v_state app_modules.fanbus_publishing_template_state%rowtype;
  v_current app_modules.fanbus_publishing_template_versions%rowtype;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['kind']::text[] <> '{}'::jsonb
     or v_kind not in ('POST', 'STORY', 'LED')
     or v_environment is null then
    raise exception 'M340_TEMPLATE_ROLLBACK_INVALID'
      using errcode = '22023';
  end if;

  insert into app_modules.fanbus_publishing_template_state(
    environment, kind, active_version_id, updated_by
  ) values (v_environment, v_kind, null, v_actor)
  on conflict (environment, kind) do nothing;

  select state.* into v_state
  from app_modules.fanbus_publishing_template_state as state
  where state.environment = v_environment
    and state.kind = v_kind
  for update;

  if v_state.active_version_id is null then
    raise exception 'M340_TEMPLATE_DEFAULT_ACTIVE'
      using errcode = '22023';
  end if;

  select version.* into strict v_current
  from app_modules.fanbus_publishing_template_versions as version
  where version.id = v_state.active_version_id
    and version.environment = v_environment
    and version.kind = v_kind;

  update app_modules.fanbus_publishing_template_state
  set active_version_id = v_current.supersedes_id,
      updated_at = now(),
      updated_by = v_actor
  where environment = v_environment
    and kind = v_kind;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_PUBLISHING_TEMPLATE_ROLLBACK',
    'fanbus_publishing_template',
    v_kind,
    jsonb_build_object('versionId', v_current.id),
    jsonb_build_object('versionId', v_current.supersedes_id)
  );

  return jsonb_build_object(
    'kind', v_kind,
    'source', case when v_current.supersedes_id is null then 'SERVER_DEFAULT' else 'CUSTOM' end
  );
end;
$function$;

-- Canonical definition: app_private.api_fanbus_publishing_template_upload_authorize(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_fanbus_publishing_template_upload_authorize(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_environment text := app_private.platform_release_environment();
  v_kind text := upper(pg_catalog.btrim(coalesce(p_payload ->> 'kind', '')));
  v_filename text := pg_catalog.btrim(coalesce(p_payload ->> 'filename', ''));
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['kind', 'filename']::text[] <> '{}'::jsonb
     or v_kind not in ('POST', 'STORY', 'LED')
     or char_length(v_filename) not between 5 and 160
     or v_filename !~ '^[A-Za-z0-9ÄÖÜäöüß._ -]+[.]svg$'
     or v_environment is null then
    raise exception 'M340_TEMPLATE_UPLOAD_INVALID'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'actorId', v_actor,
    'environment', v_environment,
    'kind', v_kind,
    'filename', v_filename
  );
end;
$function$;

-- Canonical definition: app_private.api_liveticker_archive_list()
CREATE OR REPLACE FUNCTION app_private.api_liveticker_archive_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_actor uuid:=app_private.liveticker_require_operator(); begin
 return jsonb_build_object('games',coalesce((
  select jsonb_agg(x.item order by x.completed_at desc) from (
   select s.completed_at,
    jsonb_build_object('eventId',e.id,'eventDate',e.event_date,'eventTime',e.event_time,'venue',e.venue,'homeAway',g.home_away,
      'displayTitle',case g.home_away when 'HOME' then own.short_name||' – '||coalesce(opp.short_name,g.opponent_name) else coalesce(opp.short_name,g.opponent_name)||' – '||own.short_name end,
      'revision',s.revision,'minute',s.minute,'completedAt',s.completed_at,
      'ownScore',sc.own_goals + case when sc.so_count>0 and sc.so_own>sc.so_opp then 1 else 0 end,
      'opponentScore',sc.opp_goals + case when sc.so_count>0 and sc.so_opp>sc.so_own then 1 else 0 end,
      'suffix',case when sc.so_count>0 and sc.so_own<>sc.so_opp then 'n. P.' when sc.ot_goal then 'n. V.' else '' end,
      'goalCount',sc.goal_count,'penaltyCount',sc.penalty_count,'shootoutCount',sc.so_count) item
   from app_modules.liveticker_game_states s join app_modules.events e on e.id=s.event_id join app_modules.event_games g on g.event_id=e.id
   join app_modules.liveticker_teams own on own.is_home_club and own.is_active
   left join lateral(select t.id,t.short_name from app_modules.liveticker_teams t where t.is_active and not t.is_home_club and (lower(btrim(t.name))=lower(btrim(g.opponent_name)) or lower(btrim(t.short_name))=lower(btrim(g.opponent_name)) or lower(g.opponent_name) like '%'||lower(btrim(t.short_name))||'%') order by case when lower(btrim(t.name))=lower(btrim(g.opponent_name)) then 0 else 1 end,t.name limit 1) opp on true
   left join lateral(select
     count(*) filter(where a.action_type='goal')::int goal_count,
     count(*) filter(where a.action_type='goal' and a.payload->>'team'='mighty')::int own_goals,
     count(*) filter(where a.action_type='goal' and a.payload->>'team'='opponent')::int opp_goals,
     coalesce(sum(case when a.action_type='penalty' and jsonb_typeof(a.payload->'penalties')='array' then jsonb_array_length(a.payload->'penalties') else 0 end),0)::int penalty_count,
     count(*) filter(where a.action_type='shootout')::int so_count,
     count(*) filter(where a.action_type='shootout' and a.payload->>'team'='mighty' and a.payload->>'result'='scored')::int so_own,
     count(*) filter(where a.action_type='shootout' and a.payload->>'team'='opponent' and a.payload->>'result'='scored')::int so_opp,
     coalesce(bool_or(a.action_type='goal' and (a.payload->>'minute')::int>60),false) ot_goal
    from app_modules.liveticker_actions a where a.event_id=e.id and a.is_active) sc on true
   where s.completed_at is not null
  ) x
 ),'[]'::jsonb));
end; $function$;

-- Canonical definition: app_private.api_liveticker_game_reset(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_liveticker_game_reset(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_actor uuid:=app_private.liveticker_require_operator(); v_event uuid:=nullif(btrim(coalesce(p_payload->>'eventId','')),'')::uuid; v_expected integer:=nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer; v_state app_modules.liveticker_game_states%rowtype; v_new integer; begin
 if v_event is null then raise exception 'Spiel ist erforderlich.' using errcode='22023'; end if;
 select * into v_state from app_modules.liveticker_game_states where event_id=v_event for update;
 if not found or v_state.completed_at is null then raise exception 'Abgeschlossenes Spiel wurde nicht gefunden.' using errcode='P0002'; end if;
 if v_expected is null or v_expected<>v_state.revision then raise exception 'Das Spiel wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
 v_new:=v_state.revision+1;
 update app_modules.liveticker_actions set is_active=false,revision=revision+1,updated_at=now() where event_id=v_event and is_active;
 update app_modules.liveticker_game_states set revision=v_new,minute=1,completed_at=null,updated_at=now() where event_id=v_event;
 insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,payload,client_id) values(v_event,v_new,'GAME_RESET',jsonb_build_object('actor',v_actor),null);
 perform app_private.log_audit(v_actor,'LIVETICKER_GAME_RESET','liveticker_game',v_event::text,to_jsonb(v_state),(select to_jsonb(s) from app_modules.liveticker_game_states s where s.event_id=v_event),'{}'::jsonb);
 return app_private.api_liveticker_archive_list();
end; $function$;

-- Canonical definition: app_private.api_liveticker_output_templates_list()
CREATE OR REPLACE FUNCTION app_private.api_liveticker_output_templates_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin perform app_private.liveticker_require_operator(); return app_private.liveticker_output_templates_json(); end $function$;

-- Canonical definition: app_private.api_liveticker_player_save(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_liveticker_player_save(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare
 v_actor uuid := app_private.liveticker_require_operator(); v_id uuid := nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid; v_team uuid := nullif(btrim(coalesce(p_payload->>'teamId','')),'')::uuid;
 v_name text := nullif(btrim(coalesce(p_payload->>'name','')),''); v_num text := nullif(regexp_replace(btrim(coalesce(p_payload->>'number','')),'^#',''),''); v_pos text := upper(btrim(coalesce(p_payload->>'position','')));
 v_active boolean := coalesce((p_payload->>'active')::boolean,true); v_expected integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer; v_old app_modules.liveticker_players%rowtype;
begin
 if v_team is null or not exists(select 1 from app_modules.liveticker_teams where id=v_team) then raise exception 'Gültiges Team ist erforderlich.' using errcode='22023'; end if;
 if v_name is null or char_length(v_name)>160 or v_pos not in ('GOALIE','DEFENSE','FORWARD') then raise exception 'Spielerdaten sind ungültig.' using errcode='22023'; end if;
 if v_num is not null and char_length(v_num)>8 then raise exception 'Trikotnummer darf maximal 8 Zeichen haben.' using errcode='22023'; end if;
 if v_id is null then insert into app_modules.liveticker_players(team_id,full_name,jersey_number,position,is_active,created_by,updated_by) values(v_team,v_name,v_num,v_pos,v_active,v_actor,v_actor);
 else
  select * into v_old from app_modules.liveticker_players where id=v_id for update;
  if not found then raise exception 'Spieler wurde nicht gefunden.' using errcode='P0002'; end if;
  if v_expected is null or v_expected<>v_old.revision then raise exception 'Der Spieler wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
  update app_modules.liveticker_players set team_id=v_team,full_name=v_name,jersey_number=v_num,position=v_pos,is_active=v_active,revision=revision+1,updated_at=now(),updated_by=v_actor where id=v_id;
 end if;
 return app_private.api_liveticker_teams_list();
end; $function$;

-- Canonical definition: app_private.api_liveticker_team_logo_get(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_liveticker_team_logo_get(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid := nullif(btrim(coalesce(p_payload->>'teamId','')),'')::uuid;
  v_row record;
begin
  perform app_private.liveticker_require_operator();
  select id,logo_data,logo_mime,logo_sha256 into v_row
  from app_modules.liveticker_teams
  where id=v_id;
  if not found then
    raise exception 'Team wurde nicht gefunden.' using errcode='P0002';
  end if;
  if v_row.logo_data is null then
    return jsonb_build_object('teamId',v_id,'uploaded',false);
  end if;
  return jsonb_build_object(
    'teamId',v_id,
    'uploaded',true,
    'mime',v_row.logo_mime,
    'sha256',v_row.logo_sha256,
    'dataBase64',encode(v_row.logo_data,'base64')
  );
end;
$function$;

-- Canonical definition: app_private.api_liveticker_team_save(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_liveticker_team_save(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_id uuid := nullif(btrim(coalesce(p_payload->>'id','')),'')::uuid;
  v_name text := nullif(btrim(coalesce(p_payload->>'name','')),'');
  v_short text := nullif(btrim(coalesce(p_payload->>'shortName','')),'');
  v_code text := upper(nullif(btrim(coalesce(p_payload->>'teamCode','')),''));
  v_home boolean := coalesce((p_payload->>'homeClub')::boolean,false);
  v_active boolean := coalesce((p_payload->>'active')::boolean,true);
  v_expected integer := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_logo_b64 text := nullif(btrim(coalesce(p_payload->>'logoDataBase64','')),'');
  v_logo_mime text := lower(nullif(btrim(coalesce(p_payload->>'logoMime','')),''));
  v_logo_data bytea;
  v_logo_hash text;
  v_old app_modules.liveticker_teams%rowtype;
begin
  if v_name is null or char_length(v_name)>160 or v_short is null or char_length(v_short)>60 then
    raise exception 'Teamname und Kurzname sind erforderlich.' using errcode='22023';
  end if;
  if v_code is null or v_code !~ '^[A-Z0-9/-]{2,12}$' then
    raise exception 'Teamkürzel ist erforderlich und darf nur A-Z, 0-9, / und - enthalten.' using errcode='22023';
  end if;

  if v_logo_b64 is not null then
    if v_logo_mime not in ('image/png','image/jpeg','image/webp') then
      raise exception 'Teamlogo muss PNG, JPG oder WebP sein.' using errcode='22023';
    end if;
    if char_length(v_logo_b64)>1400000 then
      raise exception 'Teamlogo darf maximal 1 MB groß sein.' using errcode='22023';
    end if;
    begin
      v_logo_data := decode(v_logo_b64,'base64');
    exception when others then
      raise exception 'Teamlogo konnte nicht verarbeitet werden.' using errcode='22023';
    end;
    if octet_length(v_logo_data)<1 or octet_length(v_logo_data)>1048576 then
      raise exception 'Teamlogo darf maximal 1 MB groß sein.' using errcode='22023';
    end if;
    if v_logo_mime='image/png' and substring(v_logo_data from 1 for 8)<>decode('89504e470d0a1a0a','hex') then
      raise exception 'PNG-Teamlogo ist ungültig.' using errcode='22023';
    elsif v_logo_mime='image/jpeg' and substring(v_logo_data from 1 for 3)<>decode('ffd8ff','hex') then
      raise exception 'JPG-Teamlogo ist ungültig.' using errcode='22023';
    elsif v_logo_mime='image/webp' and not (
      substring(v_logo_data from 1 for 4)=decode('52494646','hex')
      and substring(v_logo_data from 9 for 4)=decode('57454250','hex')
    ) then
      raise exception 'WebP-Teamlogo ist ungültig.' using errcode='22023';
    end if;
    v_logo_hash := encode(extensions.digest(v_logo_data,'sha256'),'hex');
  elsif v_logo_mime is not null then
    raise exception 'Teamlogo-Daten fehlen.' using errcode='22023';
  end if;

  if v_id is null then
    if v_logo_data is null then
      raise exception 'Bitte ein Teamlogo hochladen.' using errcode='22023';
    end if;
    if v_home then
      update app_modules.liveticker_teams
      set is_home_club=false,revision=revision+1,updated_at=now(),updated_by=v_actor
      where is_home_club;
    end if;
    insert into app_modules.liveticker_teams(
      name,short_name,team_code,logo_data,logo_mime,logo_sha256,is_home_club,is_active,created_by,updated_by
    ) values (
      v_name,v_short,v_code,v_logo_data,v_logo_mime,v_logo_hash,v_home,v_active,v_actor,v_actor
    );
  else
    select * into v_old
    from app_modules.liveticker_teams
    where id=v_id
    for update;
    if not found then
      raise exception 'Team wurde nicht gefunden.' using errcode='P0002';
    end if;
    if v_expected is null or v_expected<>v_old.revision then
      raise exception 'Das Team wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001';
    end if;
    if v_home and not v_old.is_home_club then
      update app_modules.liveticker_teams
      set is_home_club=false,revision=revision+1,updated_at=now(),updated_by=v_actor
      where is_home_club and id<>v_id;
    end if;
    update app_modules.liveticker_teams
    set name=v_name,
        short_name=v_short,
        team_code=v_code,
        logo_data=case when v_logo_b64 is not null then v_logo_data else v_old.logo_data end,
        logo_mime=case when v_logo_b64 is not null then v_logo_mime else v_old.logo_mime end,
        logo_sha256=case when v_logo_b64 is not null then v_logo_hash else v_old.logo_sha256 end,
        is_home_club=v_home,
        is_active=v_active,
        revision=revision+1,
        updated_at=now(),
        updated_by=v_actor
    where id=v_id;
  end if;

  return app_private.api_liveticker_teams_list();
end;
$function$;

-- Canonical definition: app_private.api_liveticker_teams_list()
CREATE OR REPLACE FUNCTION app_private.api_liveticker_teams_list()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 perform app_private.liveticker_require_operator();
 return jsonb_build_object('canManage',true,'teams',coalesce((select jsonb_agg(jsonb_build_object(
  'id',t.id,
  'name',t.name,
  'shortName',t.short_name,
  'teamCode',t.team_code,
  'logoAssetPath',t.logo_asset_path,
  'logoUrl',t.logo_asset_path,
  'logoUploaded',t.logo_data is not null,
  'logoMime',t.logo_mime,
  'logoSha256',t.logo_sha256,
  'homeClub',t.is_home_club,
  'active',t.is_active,
  'revision',t.revision,
  'players',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'teamId',p.team_id,'name',p.full_name,'number',p.jersey_number,'position',p.position,'active',p.is_active,'revision',p.revision)
    order by case p.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end,case when p.jersey_number ~ '^[0-9]+$' then p.jersey_number::integer else 9999 end,p.full_name) from app_modules.liveticker_players p where p.team_id=t.id),'[]'::jsonb)) order by t.is_home_club desc,t.name) from app_modules.liveticker_teams t),'[]'::jsonb));
end; $function$;

-- Canonical definition: app_private.api_remove_push_subscription(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_remove_push_subscription(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_endpoint text := btrim(coalesce(p_payload ->> 'endpoint', ''));
  v_id uuid;
begin
  perform app_private.require_active_user();

  begin
    v_id := nullif(p_payload ->> 'id', '')::uuid;
  exception when others then
    raise exception 'PUSH_SUBSCRIPTION_INVALID_ID' using errcode = '22023';
  end;

  if v_id is null and v_endpoint = '' then
    raise exception 'PUSH_SUBSCRIPTION_REQUIRED' using errcode = '22023';
  end if;

  update app_portal.push_subscriptions
  set
    is_active = false,
    disabled_at = coalesce(disabled_at, now()),
    updated_at = now()
  where user_id = v_user
    and is_active = true
    and (
      (v_id is not null and id = v_id)
      or (v_id is null and endpoint = v_endpoint)
    );

  -- Geräte-Lifecycle und dauerhafte Benutzerpräferenz sind bewusst getrennt.
  -- Ein Logout oder das Entfernen eines einzelnen Geräts ist kein globaler Opt-out.
  return app_private.api_push_snapshot();
end;
$function$;

-- Canonical definition: app_private.api_save_notification_preferences(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_save_notification_preferences(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_push_enabled_requested boolean;
begin
  if p_payload ? 'pushEnabled' then
    begin
      v_push_enabled_requested := (p_payload ->> 'pushEnabled')::boolean;
    exception when invalid_text_representation then
      raise exception 'PUSH_PREFERENCE_INVALID_VALUE'
        using errcode = '22023';
    end;
  end if;

  -- Der M330-Vorgänger hält den bestehenden CAS-/Revision-Vertrag und alle
  -- granularen M020-R2-Felder. Der nachfolgende Update erhält das additive
  -- M330-Feld push_fanbus_trip_cancellations.
  perform app_private.api_save_notification_preferences_before_m330_r1(p_payload);

  update app_portal.notification_preferences
  set push_fanbus_trip_cancellations = coalesce(
    (p_payload ->> 'pushFanbusTripCancellations')::boolean,
    push_fanbus_trip_cancellations
  )
  where user_id = auth.uid();

  if v_push_enabled_requested is false then
    update app_portal.push_subscriptions
    set is_active = false,
        disabled_at = coalesce(disabled_at, now()),
        updated_at = now()
    where user_id = auth.uid()
      and is_active = true;
  end if;

  return app_private.api_push_snapshot();
exception when invalid_text_representation then
  raise exception 'PUSH_PREFERENCE_INVALID_VALUE' using errcode = '22023';
end;
$function$;

-- Canonical definition: app_private.api_save_push_subscription(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_save_push_subscription(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user uuid := auth.uid();
  v_endpoint text := btrim(coalesce(p_payload ->> 'endpoint', ''));
  v_p256dh text := btrim(coalesce(p_payload ->> 'p256dh', ''));
  v_auth text := btrim(coalesce(p_payload ->> 'auth', ''));
  v_existing_user uuid;
begin
  perform app_private.require_active_user();

  if length(v_endpoint) not between 20 and 4000
     or v_endpoint !~ '^https://'
     or v_endpoint ~ E'[\\r\\n]'
     or length(v_p256dh) not between 20 and 500
     or length(v_auth) not between 8 and 500 then
    raise exception 'PUSH_SUBSCRIPTION_INVALID' using errcode = '22023';
  end if;

  select subscription.user_id
  into v_existing_user
  from app_portal.push_subscriptions as subscription
  where subscription.endpoint = v_endpoint
  for update;

  if found and v_existing_user is distinct from v_user then
    raise exception 'PUSH_SUBSCRIPTION_ENDPOINT_OWNED' using errcode = '23505';
  end if;

  insert into app_portal.push_subscriptions(
    user_id,
    endpoint,
    p256dh,
    auth_key,
    device_label,
    user_agent,
    is_active,
    failure_count,
    last_seen_at,
    disabled_at,
    updated_at
  )
  values(
    v_user,
    v_endpoint,
    v_p256dh,
    v_auth,
    left(btrim(coalesce(p_payload ->> 'deviceLabel', '')), 120),
    left(btrim(coalesce(p_payload ->> 'userAgent', '')), 500),
    true,
    0,
    now(),
    null,
    now()
  )
  on conflict(endpoint) do update
  set
    p256dh = excluded.p256dh,
    auth_key = excluded.auth_key,
    device_label = excluded.device_label,
    user_agent = excluded.user_agent,
    is_active = true,
    failure_count = 0,
    last_seen_at = now(),
    disabled_at = null,
    updated_at = now()
  where app_portal.push_subscriptions.user_id = v_user;

  if not found then
    -- Deckt das Ownership-Rennen zwischen SELECT und INSERT ab.
    raise exception 'PUSH_SUBSCRIPTION_ENDPOINT_OWNED' using errcode = '23505';
  end if;

  insert into app_portal.notification_preferences(user_id, push_enabled)
  values(v_user, true)
  on conflict(user_id) do update
    set push_enabled = true,
        revision = case
          when app_portal.notification_preferences.push_enabled
            then app_portal.notification_preferences.revision
          else app_portal.notification_preferences.revision + 1
        end,
        updated_at = case
          when app_portal.notification_preferences.push_enabled
            then app_portal.notification_preferences.updated_at
          else now()
        end;

  return app_private.api_push_snapshot();
end;
$function$;

-- Canonical definition: app_private.api_worker_runtime_status(p_payload jsonb)
CREATE OR REPLACE FUNCTION app_private.api_worker_runtime_status(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_code text; v_capability text; begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or not p_payload?'workerCode' or jsonb_typeof(p_payload->'workerCode')<>'string' or p_payload-array['workerCode']::text[]<>'{}'::jsonb then raise exception 'WORKER_RUNTIME_STATUS_INVALID_PAYLOAD' using errcode='22023'; end if;
 v_code:=upper(btrim(p_payload->>'workerCode')); v_capability:=app_private.worker_runtime_capability(v_code); perform app_private.require_capability(v_capability); return app_private.worker_runtime_status_internal(v_code);
end;$function$;

-- Canonical definition: app_private.fanbus_next_booking_number()
CREATE OR REPLACE FUNCTION app_private.fanbus_next_booking_number()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_prefix text;
begin
  v_prefix := case
    when v_environment in ('DEV', 'LOCAL') then 'DEV-'
    when v_environment = 'PROD' then 'FB-'
    else null
  end;

  if v_prefix is null then
    raise exception using
      errcode = 'P0001',
      message = 'FANBUS_BOOKING_ENVIRONMENT_INVALID';
  end if;

  return v_prefix
    || pg_catalog.to_char(
      pg_catalog.clock_timestamp() at time zone 'Europe/Berlin',
      'YY'
    )
    || '-'
    || pg_catalog.lpad(
      pg_catalog.nextval('app_private.fanbus_booking_number_seq'::pg_catalog.regclass)::text,
      6,
      '0'
    );
end;
$function$;

-- Canonical definition: app_private.fanbus_publishing_assert_resolution_rule(p_alias_place_key text)
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_assert_resolution_rule(p_alias_place_key text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if exists (
    select 1
    from app_modules.fanbus_publishing_resolution_aliases as alias
    where alias.alias_place_key = p_alias_place_key
      and alias.resolution_kind = 'AMBIGUOUS'
  ) and (
    select count(*)
    from app_modules.fanbus_publishing_alias_candidates as candidate
    join app_modules.fanbus_publishing_places as place
      on place.id = candidate.place_id
     and place.is_active
    where candidate.alias_place_key = p_alias_place_key
  ) < 2 then
    raise exception 'M340_PUBLISHING_AMBIGUITY_RULE_INVALID'
      using errcode = '23514';
  end if;
end;
$function$;

-- Canonical definition: app_private.fanbus_publishing_clean_venue(p_venue text)
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_clean_venue(p_venue text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select nullif(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        coalesce(p_venue, ''),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    ''
  );
$function$;

-- Canonical definition: app_private.fanbus_publishing_ensure_event_place(p_event_id uuid, p_actor uuid)
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_ensure_event_place(p_event_id uuid, p_actor uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue text;
  v_place_key text;
  v_display_name text;
  v_slug text;
  v_canonical_key text;
  v_lock_key text;
  v_alias app_modules.fanbus_publishing_resolution_aliases%rowtype;
  v_alias_found boolean := false;
  v_place app_modules.fanbus_publishing_places%rowtype;
  v_alias_owner uuid;
  v_legacy_place uuid;
  v_candidates jsonb := '[]'::jsonb;
  v_candidate_count integer := 0;
  v_before jsonb;
  v_binding app_modules.fanbus_publishing_event_places%rowtype;
  v_created boolean := false;
  v_key_inserted boolean := false;
begin
  select event.venue
    into v_venue
  from app_modules.events as event
  where event.id = p_event_id
  for update;

  if not found then
    raise exception 'M340_EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_venue := app_private.fanbus_publishing_clean_venue(v_venue);
  v_place_key := app_private.fanbus_publishing_normalize_place_key(v_venue);

  if v_place_key is null then
    delete from app_modules.fanbus_publishing_event_places as binding
    where binding.event_id = p_event_id
    returning to_jsonb(binding) into v_before;

    if v_before is not null then
      perform app_private.log_audit(
        p_actor,
        'FANBUS_PUBLISHING_EVENT_PLACE_AUTO_UNBOUND',
        'event',
        p_event_id::text,
        v_before,
        null,
        jsonb_build_object('reason', 'MISSING_VENUE')
      );
    end if;

    return jsonb_build_object(
      'status', 'MISSING_VENUE',
      'eventId', p_event_id,
      'shortlinkPath', null,
      'candidates', '[]'::jsonb
    );
  end if;

  select alias.*
    into v_alias
  from app_modules.fanbus_publishing_resolution_aliases as alias
  where alias.alias_place_key = v_place_key;
  v_alias_found := found;

  v_lock_key := case
    when v_alias_found and v_alias.resolution_kind = 'CANONICAL'
      then v_alias.canonical_place_key
    else v_place_key
  end;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('m340-place:' || v_lock_key, 0)
  );

  -- Eine parallel abgeschlossene Ausnahmeentscheidung kann AMBIGUOUS in
  -- CANONICAL umwandeln. Nach dem Lock deshalb die Regel erneut lesen.
  select alias.*
    into v_alias
  from app_modules.fanbus_publishing_resolution_aliases as alias
  where alias.alias_place_key = v_place_key;
  v_alias_found := found;

  if v_alias_found
     and v_alias.resolution_kind = 'CANONICAL'
     and v_alias.canonical_place_key <> v_lock_key then
    v_lock_key := v_alias.canonical_place_key;
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('m340-place:' || v_lock_key, 0)
    );
  end if;

  if v_alias_found and v_alias.resolution_kind = 'AMBIGUOUS' then
    select
      count(*)::integer,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'placeId', place.id,
            'displayName', place.display_name
          )
          order by place.display_name, place.id
        ),
        '[]'::jsonb
      )
    into v_candidate_count, v_candidates
    from app_modules.fanbus_publishing_alias_candidates as candidate
    join app_modules.fanbus_publishing_places as place
      on place.id = candidate.place_id
     and place.is_active
    where candidate.alias_place_key = v_place_key;

    if v_candidate_count < 2 then
      raise exception 'M340_PUBLISHING_AMBIGUITY_RULE_INVALID'
        using errcode = '23514';
    end if;

    delete from app_modules.fanbus_publishing_event_places as binding
    where binding.event_id = p_event_id
    returning to_jsonb(binding) into v_before;

    if v_before is not null then
      perform app_private.log_audit(
        p_actor,
        'FANBUS_PUBLISHING_EVENT_PLACE_AUTO_UNBOUND',
        'event',
        p_event_id::text,
        v_before,
        null,
        jsonb_build_object('reason', 'AMBIGUOUS')
      );
    end if;

    return jsonb_build_object(
      'status', 'AMBIGUOUS',
      'eventId', p_event_id,
      'shortlinkPath', null,
      'candidates', v_candidates
    );
  end if;

  if v_alias_found and v_alias.resolution_kind = 'CANONICAL' then
    v_canonical_key := v_alias.canonical_place_key;
    v_slug := v_alias.canonical_slug;
    v_display_name := v_alias.canonical_display_name;

    select place.*
      into v_place
    from app_modules.fanbus_publishing_place_keys as place_key
    join app_modules.fanbus_publishing_places as place
      on place.id = place_key.place_id
    where place_key.place_key = v_canonical_key
    for update of place;

    if not found then
      select place.*
        into v_place
      from app_modules.fanbus_publishing_places as place
      where place.slug = v_slug
      for update;
    end if;

    if not found then
      insert into app_modules.fanbus_publishing_places (
        slug,
        display_name,
        created_by,
        updated_by
      )
      values (v_slug, v_display_name, p_actor, p_actor)
      returning * into v_place;
      v_created := true;
    elsif not v_place.is_active then
      update app_modules.fanbus_publishing_places as place
      set
        is_active = true,
        updated_by = p_actor,
        revision = place.revision + 1
      where place.id = v_place.id
      returning place.* into v_place;
    end if;

    if v_place.slug <> v_slug then
      raise exception 'M340_PUBLISHING_ALIAS_COLLISION'
        using errcode = '23505';
    end if;

    insert into app_modules.fanbus_publishing_place_keys (
      place_id,
      place_key,
      source_label,
      created_by
    )
    values (v_place.id, v_canonical_key, v_display_name, p_actor)
    on conflict (place_key) do nothing;

    select place_key.place_id
      into v_alias_owner
    from app_modules.fanbus_publishing_place_keys as place_key
    where place_key.place_key = v_canonical_key;
    if v_alias_owner is distinct from v_place.id then
      raise exception 'M340_PUBLISHING_ALIAS_COLLISION'
        using errcode = '23505';
    end if;

    select place_key.place_id
      into v_alias_owner
    from app_modules.fanbus_publishing_place_keys as place_key
    where place_key.place_key = v_place_key
    for update;

    if v_alias_owner is not null and v_alias_owner <> v_place.id then
      v_legacy_place := v_alias_owner;

      update app_modules.fanbus_publishing_event_places as binding
      set
        place_id = v_place.id,
        bound_place_key = v_canonical_key,
        updated_by = p_actor
      where binding.place_id = v_legacy_place
        and binding.bound_place_key = v_place_key;

      delete from app_modules.fanbus_publishing_place_keys as place_key
      where place_key.place_key = v_place_key
        and place_key.place_id = v_legacy_place;

      if exists (
        select 1
        from app_modules.fanbus_publishing_places as legacy
        where legacy.id = v_legacy_place
          and legacy.slug = app_private.fanbus_publishing_slug_for_key(v_place_key)
          and not exists (
            select 1
            from app_modules.fanbus_publishing_place_keys as remaining_key
            where remaining_key.place_id = v_legacy_place
          )
      ) then
        if not exists (
          select 1
          from app_modules.fanbus_publishing_event_places as binding
          where binding.place_id = v_legacy_place
        ) and not exists (
          select 1
          from app_modules.fanbus_publishing_jobs as job
          where job.place_id = v_legacy_place
        ) and not exists (
          select 1
          from app_modules.fanbus_publishing_place_landing_daily as landing
          where landing.place_id = v_legacy_place
        ) and not exists (
          select 1
          from app_modules.fanbus_publishing_trip_referral_daily as referral
          where referral.place_id = v_legacy_place
        ) and not exists (
          select 1
          from app_modules.fanbus_publishing_alias_candidates as candidate
          where candidate.place_id = v_legacy_place
        ) then
          delete from app_modules.fanbus_publishing_places as legacy
          where legacy.id = v_legacy_place;
        else
          update app_modules.fanbus_publishing_places as legacy
          set
            is_active = false,
            updated_by = p_actor,
            revision = legacy.revision + 1
          where legacy.id = v_legacy_place;
        end if;
      end if;
    end if;

    insert into app_modules.fanbus_publishing_place_keys (
      place_id,
      place_key,
      source_label,
      created_by
    )
    values (v_place.id, v_place_key, pg_catalog.left(v_venue, 240), p_actor)
    on conflict (place_key) do nothing;
    v_key_inserted := found;

    select place_key.place_id
      into v_alias_owner
    from app_modules.fanbus_publishing_place_keys as place_key
    where place_key.place_key = v_place_key;
    if v_alias_owner is distinct from v_place.id then
      raise exception 'M340_PUBLISHING_ALIAS_COLLISION'
        using errcode = '23505';
    end if;
  else
    v_canonical_key := v_place_key;
    v_display_name := pg_catalog.left(v_venue, 160);
    v_slug := app_private.fanbus_publishing_slug_for_key(v_place_key);

    select place.*
      into v_place
    from app_modules.fanbus_publishing_place_keys as place_key
    join app_modules.fanbus_publishing_places as place
      on place.id = place_key.place_id
    where place_key.place_key = v_place_key
    for update of place;

    if not found then
      select place.*
        into v_place
      from app_modules.fanbus_publishing_places as place
      where place.slug = v_slug
      for update;

      if found and v_place_key <> ('v1:' || v_slug) then
        raise exception 'M340_PUBLISHING_SLUG_COLLISION'
          using errcode = '23505';
      elsif not found then
        insert into app_modules.fanbus_publishing_places (
          slug,
          display_name,
          created_by,
          updated_by
        )
        values (v_slug, v_display_name, p_actor, p_actor)
        returning * into v_place;
        v_created := true;
      end if;
    end if;

    if not v_place.is_active then
      update app_modules.fanbus_publishing_places as place
      set
        is_active = true,
        updated_by = p_actor,
        revision = place.revision + 1
      where place.id = v_place.id
      returning place.* into v_place;
    end if;

    insert into app_modules.fanbus_publishing_place_keys (
      place_id,
      place_key,
      source_label,
      created_by
    )
    values (v_place.id, v_place_key, pg_catalog.left(v_venue, 240), p_actor)
    on conflict (place_key) do nothing;
    v_key_inserted := found;
  end if;

  select to_jsonb(binding)
    into v_before
  from app_modules.fanbus_publishing_event_places as binding
  where binding.event_id = p_event_id
  for update;

  if v_before is not null
     and (v_before ->> 'place_id')::uuid = v_place.id
     and v_before ->> 'bound_place_key' = v_place_key then
    return jsonb_build_object(
      'status', 'RESOLVED',
      'eventId', p_event_id,
      'placeId', v_place.id,
      'shortlinkPath', '/ontour/' || v_place.slug,
      'candidates', '[]'::jsonb
    );
  end if;

  insert into app_modules.fanbus_publishing_event_places (
    event_id,
    place_id,
    bound_place_key,
    created_by,
    updated_by
  )
  values (p_event_id, v_place.id, v_place_key, p_actor, p_actor)
  on conflict (event_id) do update
  set
    place_id = excluded.place_id,
    bound_place_key = excluded.bound_place_key,
    updated_by = excluded.updated_by
  returning * into v_binding;

  if v_created then
    perform app_private.log_audit(
      p_actor,
      'FANBUS_PUBLISHING_PLACE_AUTO_CREATED',
      'fanbus_publishing_place',
      v_place.id::text,
      null,
      jsonb_build_object(
        'shortlinkPath', '/ontour/' || v_place.slug,
        'source', 'EVENT_VENUE'
      )
    );
  end if;

  if v_key_inserted and not v_created then
    perform app_private.log_audit(
      p_actor,
      'FANBUS_PUBLISHING_PLACE_ALIAS_AUTO_BOUND',
      'fanbus_publishing_place',
      v_place.id::text,
      null,
      jsonb_build_object('source', 'EVENT_VENUE')
    );
  end if;

  perform app_private.log_audit(
    p_actor,
    'FANBUS_PUBLISHING_EVENT_PLACE_AUTO_RESOLVED',
    'event',
    p_event_id::text,
    v_before,
    to_jsonb(v_binding),
    jsonb_build_object('source', 'EVENT_VENUE')
  );

  return jsonb_build_object(
    'status', 'RESOLVED',
    'eventId', p_event_id,
    'placeId', v_place.id,
    'shortlinkPath', '/ontour/' || v_place.slug,
    'candidates', '[]'::jsonb
  );
end;
$function$;

-- Canonical definition: app_private.fanbus_publishing_event_place_status(p_event_id uuid)
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_event_place_status(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_venue text;
  v_place_key text;
  v_alias app_modules.fanbus_publishing_resolution_aliases%rowtype;
  v_place app_modules.fanbus_publishing_places%rowtype;
  v_candidates jsonb := '[]'::jsonb;
  v_candidate_count integer := 0;
begin
  select event.venue
    into v_venue
  from app_modules.events as event
  where event.id = p_event_id;

  if not found then
    raise exception 'M340_EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_venue := app_private.fanbus_publishing_clean_venue(v_venue);
  v_place_key := app_private.fanbus_publishing_normalize_place_key(v_venue);
  if v_place_key is null then
    return jsonb_build_object(
      'status', 'MISSING_VENUE',
      'shortlinkPath', null,
      'candidates', '[]'::jsonb
    );
  end if;

  select alias.*
    into v_alias
  from app_modules.fanbus_publishing_resolution_aliases as alias
  where alias.alias_place_key = v_place_key;

  if found and v_alias.resolution_kind = 'CANONICAL' then
    return jsonb_build_object(
      'status', 'RESOLVED',
      'shortlinkPath', '/ontour/' || v_alias.canonical_slug,
      'candidates', '[]'::jsonb
    );
  end if;

  if found and v_alias.resolution_kind = 'AMBIGUOUS' then
    select
      count(*)::integer,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'placeId', place.id,
            'displayName', place.display_name
          )
          order by place.display_name, place.id
        ),
        '[]'::jsonb
      )
    into v_candidate_count, v_candidates
    from app_modules.fanbus_publishing_alias_candidates as candidate
    join app_modules.fanbus_publishing_places as place
      on place.id = candidate.place_id
     and place.is_active
    where candidate.alias_place_key = v_place_key;

    if v_candidate_count < 2 then
      raise exception 'M340_PUBLISHING_AMBIGUITY_RULE_INVALID'
        using errcode = '23514';
    end if;

    return jsonb_build_object(
      'status', 'AMBIGUOUS',
      'shortlinkPath', null,
      'candidates', v_candidates
    );
  end if;

  select place.*
    into v_place
  from app_modules.fanbus_publishing_place_keys as place_key
  join app_modules.fanbus_publishing_places as place
    on place.id = place_key.place_id
   and place.is_active
  where place_key.place_key = v_place_key;

  if found then
    return jsonb_build_object(
      'status', 'RESOLVED',
      'shortlinkPath', '/ontour/' || v_place.slug,
      'candidates', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'status', 'RESOLVED',
    'shortlinkPath', '/ontour/'
      || app_private.fanbus_publishing_slug_for_key(v_place_key),
    'candidates', '[]'::jsonb
  );
end;
$function$;

-- Canonical definition: app_private.fanbus_publishing_guard_locked_slug()
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_guard_locked_slug()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old.slug_locked
     and (
       new.slug is distinct from old.slug
       or new.slug_locked is distinct from true
     ) then
    raise exception 'M340_PLACE_SLUG_LOCKED'
      using errcode = '55000';
  end if;
  return new;
end;
$function$;

-- Canonical definition: app_private.fanbus_publishing_normalize_place_key(p_value text)
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_normalize_place_key(p_value text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  with normalized as (
    select pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.replace(
          pg_catalog.replace(
            pg_catalog.replace(
              pg_catalog.replace(
                pg_catalog.lower(pg_catalog.btrim(coalesce(p_value, ''))),
                'ä', 'ae'
              ),
              'ö', 'oe'
            ),
            'ü', 'ue'
          ),
          'ß', 'ss'
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '-'
    ) as value
  )
  select case
    when normalized.value = '' then null
    else 'v1:' || normalized.value
  end
  from normalized;
$function$;

-- Canonical definition: app_private.fanbus_publishing_open_trips(p_place_id uuid)
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_open_trips(p_place_id uuid)
 RETURNS TABLE(trip_id uuid, event_date date, event_time time without time zone, departure_at timestamp with time zone, projection jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    trip.id,
    event.event_date,
    event.event_time,
    trip.departure_at,
    item.value
  from pg_catalog.jsonb_array_elements(
    coalesce(public.pd_public_fanbus_trips() -> 'trips', '[]'::jsonb)
  ) as item(value)
  join app_modules.fanbus_trips as trip
    on trip.id = (item.value ->> 'tripId')::uuid
  join app_modules.events as event
    on event.id = trip.event_id
  join app_modules.fanbus_publishing_event_places as binding
    on binding.event_id = event.id
   and binding.place_id = p_place_id
  where item.value ->> 'registrationStatus' in ('OPEN', 'WAITLIST')
  order by
    event.event_date,
    event.event_time asc nulls last,
    trip.departure_at,
    trip.id;
$function$;

-- Canonical definition: app_private.fanbus_publishing_record_place_landing(p_place_id uuid, p_at timestamp with time zone)
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_record_place_landing(p_place_id uuid, p_at timestamp with time zone)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into app_modules.fanbus_publishing_place_landing_daily (
    place_id,
    day,
    landing_count
  )
  values (
    p_place_id,
    app_private.fanbus_publishing_berlin_day(p_at),
    1
  )
  on conflict (place_id, day) do update
  set landing_count =
    app_modules.fanbus_publishing_place_landing_daily.landing_count + 1;
$function$;

-- Canonical definition: app_private.fanbus_publishing_record_trip_referral(p_place_id uuid, p_trip_id uuid, p_at timestamp with time zone)
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_record_trip_referral(p_place_id uuid, p_trip_id uuid, p_at timestamp with time zone)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into app_modules.fanbus_publishing_trip_referral_daily (
    place_id,
    trip_id,
    day,
    referral_count
  )
  values (
    p_place_id,
    p_trip_id,
    app_private.fanbus_publishing_berlin_day(p_at),
    1
  )
  on conflict (place_id, trip_id, day) do update
  set referral_count =
    app_modules.fanbus_publishing_trip_referral_daily.referral_count + 1;
$function$;

-- Canonical definition: app_private.fanbus_publishing_resolution_rule_constraint()
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_resolution_rule_constraint()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    perform app_private.fanbus_publishing_assert_resolution_rule(
      new.alias_place_key
    );
  elsif tg_op = 'DELETE' then
    perform app_private.fanbus_publishing_assert_resolution_rule(
      old.alias_place_key
    );
  else
    perform app_private.fanbus_publishing_assert_resolution_rule(
      old.alias_place_key
    );
    if new.alias_place_key is distinct from old.alias_place_key then
      perform app_private.fanbus_publishing_assert_resolution_rule(
        new.alias_place_key
      );
    end if;
  end if;
  return null;
end;
$function$;

-- Canonical definition: app_private.fanbus_publishing_slug_for_key(p_place_key text)
CREATE OR REPLACE FUNCTION app_private.fanbus_publishing_slug_for_key(p_place_key text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_base text := pg_catalog.substr(coalesce(p_place_key, ''), 4);
begin
  if v_base = ''
     or p_place_key !~ '^v1:[a-z0-9]+(-[a-z0-9]+)*$' then
    return null;
  end if;

  if pg_catalog.char_length(v_base) <= 48 then
    return v_base;
  end if;

  return pg_catalog.rtrim(pg_catalog.left(v_base, 39), '-')
    || '-'
    || pg_catalog.left(
      pg_catalog.encode(
        extensions.digest(pg_catalog.convert_to(v_base, 'UTF8'), 'sha256'),
        'hex'
      ),
      8
    );
end;
$function$;

-- Canonical definition: app_private.liveticker_assert_supported_game(p_event_id uuid)
CREATE OR REPLACE FUNCTION app_private.liveticker_assert_supported_game(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
  if not exists(select 1 from app_modules.events e join app_modules.event_games g on g.event_id=e.id where e.id=p_event_id and e.event_type='GAME' and e.visibility='PUBLIC') then
    raise exception 'LIVETICKER_GAME_NOT_AVAILABLE' using errcode='P0002';
  end if;
end; $function$;

-- Canonical definition: app_private.liveticker_graphic_autqueue()
CREATE OR REPLACE FUNCTION app_private.liveticker_graphic_autqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op='UPDATE' then
    if old.minute <= 20 and new.minute > 20 then
      perform app_private.liveticker_graphic_enqueue(new.event_id,'PERIOD_1',null);
    end if;
    if old.minute <= 40 and new.minute > 40 then
      perform app_private.liveticker_graphic_enqueue(new.event_id,'PERIOD_2',null);
    end if;
    if old.completed_at is null and new.completed_at is not null then
      perform app_private.liveticker_graphic_enqueue(new.event_id,'FINAL',null);
    end if;
  end if;
  return new;
end;
$function$;

-- Canonical definition: app_private.liveticker_graphic_enqueue(p_event_id uuid, p_kind text, p_actor uuid)
CREATE OR REPLACE FUNCTION app_private.liveticker_graphic_enqueue(p_event_id uuid, p_kind text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin if not app_private.worker_runtime_is_ready('LIVETICKER_GRAPHICS') then if p_actor is null then return jsonb_build_object('skipped',true,'reason',case when app_private.worker_runtime_is_enabled('LIVETICKER_GRAPHICS') then 'WORKER_NOT_READY' else 'WORKER_DISABLED' end); end if; perform app_private.worker_runtime_assert_ready('LIVETICKER_GRAPHICS'); end if; return app_private.liveticker_graphic_enqueue_before_worker_control_r1(p_event_id,p_kind,p_actor); end;$function$;

-- Canonical definition: app_private.liveticker_graphic_job_attach_home_away()
CREATE OR REPLACE FUNCTION app_private.liveticker_graphic_job_attach_home_away()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_home_away text;
begin
  select g.home_away into v_home_away
  from app_modules.event_games g
  where g.event_id=new.event_id;

  if v_home_away not in ('HOME','AWAY') then
    raise exception 'LIVETICKER_GRAPHIC_HOME_AWAY_MISSING' using errcode='22023';
  end if;

  new.request_snapshot:=jsonb_set(
    coalesce(new.request_snapshot,'{}'::jsonb),
    '{homeAway}',
    to_jsonb(v_home_away),
    true
  );
  return new;
end;
$function$;

-- Canonical definition: app_private.liveticker_graphic_manifest_valid(p_manifest jsonb, p_kind text)
CREATE OR REPLACE FUNCTION app_private.liveticker_graphic_manifest_valid(p_manifest jsonb, p_kind text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare
  v_artifact jsonb;
  v_seen text[]:=array[]::text[];
  v_kind text;
  v_share text;
  v_download text;
begin
  if jsonb_typeof(p_manifest)<>'object'
     or p_manifest->>'schemaVersion'<>'1'
     or upper(coalesce(p_manifest->>'graphicKind',''))<>upper(coalesce(p_kind,''))
     or jsonb_typeof(p_manifest->'artifacts')<>'array'
     or jsonb_array_length(p_manifest->'artifacts')<>2 then
    return false;
  end if;

  for v_artifact in select value from jsonb_array_elements(p_manifest->'artifacts') loop
    v_kind:=upper(coalesce(v_artifact->>'kind',''));
    if v_kind not in ('POST','STORY') or v_kind=any(v_seen) then return false; end if;
    if coalesce(v_artifact->>'filename','') !~ '^[A-Za-z0-9._-]+[.]png$' then return false; end if;
    if coalesce(v_artifact->>'nextcloudPath','') not like '/Liveticker/%'
       or (v_artifact->>'nextcloudPath') like '%..%'
       or (v_artifact->>'nextcloudPath') like '%\\%'
       or (v_artifact->>'nextcloudPath') like '%?%'
       or (v_artifact->>'nextcloudPath') like '%#%' then return false; end if;
    if coalesce(v_artifact->>'sha256','') !~ '^[0-9a-f]{64}$' then return false; end if;
    if coalesce(v_artifact->>'bytes','') !~ '^[0-9]+$'
       or (v_artifact->>'bytes')::numeric not between 1 and 104857600 then return false; end if;

    v_share:=coalesce(v_artifact->>'shareUrl','');
    v_download:=coalesce(v_artifact->>'downloadUrl','');
    if v_share !~ '^https://cloud[.]plaerrdeifl[.]de/s/[A-Za-z0-9]{8,128}$' then return false; end if;
    if v_download <> (v_share || '/download') then return false; end if;

    v_seen:=array_append(v_seen,v_kind);
  end loop;
  return array['POST','STORY'] <@ v_seen;
exception when others then
  return false;
end;
$function$;

-- Canonical definition: app_private.liveticker_graphic_retry_delay(p_attempt integer)
CREATE OR REPLACE FUNCTION app_private.liveticker_graphic_retry_delay(p_attempt integer)
 RETURNS interval
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select make_interval(secs => least(900, 30 * (2 ^ greatest(0,least(coalesce(p_attempt,1)-1,5)))::integer));
$function$;

-- Canonical definition: app_private.liveticker_output_templates_validate_row()
CREATE OR REPLACE FUNCTION app_private.liveticker_output_templates_validate_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$ begin
 if tg_op='UPDATE' and new.template_key is distinct from old.template_key then raise exception 'Technischer Varianten-Key darf nicht geändert werden.' using errcode='22023'; end if;
 perform app_private.liveticker_validate_output_template(new.own_goal_template,array['minute','mighty_score','opponent_score']);
 perform app_private.liveticker_validate_output_template(new.own_penalty_template,array['minute','penalties']);
 perform app_private.liveticker_validate_output_template(new.opponent_goal_template,array['minute','mighty_score','opponent_score','opponent_name']);
 perform app_private.liveticker_validate_output_template(new.opponent_penalty_template,array['minute','penalties']);
 return new; end $function$;

-- Canonical definition: app_private.liveticker_team_json(p_team_id uuid)
CREATE OR REPLACE FUNCTION app_private.liveticker_team_json(p_team_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object(
   'id',t.id,
   'name',t.name,
   'shortName',t.short_name,
   'teamCode',t.team_code,
   'logoAssetPath',t.logo_asset_path,
   -- Compatibility for already-open PROD clients; value is still a local portal asset.
   'logoUrl',t.logo_asset_path,
   'homeClub',t.is_home_club,
   'players',coalesce((
     select jsonb_agg(jsonb_build_object('id',p.id,'name',p.full_name,'number',p.jersey_number,'position',case p.position when 'GOALIE' then 'Tor' when 'DEFENSE' then 'Verteidigung' else 'Sturm' end)
       order by case p.position when 'GOALIE' then 1 when 'DEFENSE' then 2 else 3 end, case when p.jersey_number ~ '^[0-9]+$' then p.jersey_number::integer else 9999 end,p.full_name)
     from app_modules.liveticker_players p where p.team_id=t.id and p.is_active
   ),'[]'::jsonb)
 ) from app_modules.liveticker_teams t where t.id=p_team_id and t.is_active;
$function$;

-- Canonical definition: app_private.m320_r3_assignment_fingerprint(p_trip_id uuid)
CREATE OR REPLACE FUNCTION app_private.m320_r3_assignment_fingerprint(p_trip_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(app_private.m320_r3_assignment_snapshot(p_trip_id)::text,'UTF8'),
      'sha256'
    ),
    'hex'
  )
$function$;

-- Canonical definition: app_private.m320_r3_assignment_snapshot(p_trip_id uuid)
CREATE OR REPLACE FUNCTION app_private.m320_r3_assignment_snapshot(p_trip_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

-- Canonical definition: app_private.m340_fanbus_publishing_job_claim()
CREATE OR REPLACE FUNCTION app_private.m340_fanbus_publishing_job_claim()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_now timestamptz := now();
  v_job app_modules.fanbus_publishing_jobs%rowtype;
begin
  if v_environment is null then
    raise exception 'M340_PUBLISHING_ENVIRONMENT_INVALID'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('m340-publishing:' || v_environment, 0)
  );

  update app_modules.fanbus_publishing_jobs as job
  set
    status = case
      when job.attempt_count >= 5 then 'FAILED'
      else 'QUEUED'
    end,
    available_at = case
      when job.attempt_count < 5 then
        v_now + app_private.m340_fanbus_publishing_retry_delay(job.attempt_count)
      else job.available_at
    end,
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null,
    completed_at = case
      when job.attempt_count >= 5 then v_now
      else null
    end,
    result_manifest = null,
    last_error_code = 'CLAIM_EXPIRED',
    updated_by = null,
    revision = job.revision + 1
  where job.environment = v_environment
    and job.status = 'PROCESSING'
    and job.claim_expires_at <= v_now;

  if exists (
    select 1
    from app_modules.fanbus_publishing_jobs as job
    where job.environment = v_environment
      and job.status = 'PROCESSING'
  ) then
    return jsonb_build_object('claimed', false);
  end if;

  with candidate as materialized (
    select job.id
    from app_modules.fanbus_publishing_jobs as job
    where job.environment = v_environment
      and job.status = 'QUEUED'
      and job.attempt_count < 5
      and job.available_at <= v_now
    order by job.available_at, job.created_at, job.id
    limit 1
    for update skip locked
  )
  update app_modules.fanbus_publishing_jobs as job
  set
    status = 'PROCESSING',
    attempt_count = job.attempt_count + 1,
    claim_token = extensions.gen_random_uuid(),
    claimed_at = v_now,
    claim_expires_at = v_now + interval '15 minutes',
    completed_at = null,
    result_manifest = null,
    updated_by = null,
    revision = job.revision + 1
  from candidate
  where job.id = candidate.id
  returning job.* into v_job;

  if v_job.id is null then
    return jsonb_build_object('claimed', false);
  end if;

  return jsonb_build_object(
    'claimed', true,
    'job', jsonb_build_object(
      'jobId', v_job.id,
      'claimToken', v_job.claim_token,
      'environment', v_job.environment,
      'attemptCount', v_job.attempt_count,
      'claimExpiresAt', v_job.claim_expires_at,
      'request', v_job.request_snapshot
    )
  );
end;
$function$;

-- Canonical definition: app_private.m340_fanbus_publishing_job_complete(p_job_id uuid, p_claim_token uuid, p_success boolean, p_error_code text, p_result_manifest jsonb)
CREATE OR REPLACE FUNCTION app_private.m340_fanbus_publishing_job_complete(p_job_id uuid, p_claim_token uuid, p_success boolean, p_error_code text, p_result_manifest jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_now timestamptz := now();
  v_error_code text := nullif(pg_catalog.btrim(coalesce(p_error_code, '')), '');
  v_job app_modules.fanbus_publishing_jobs%rowtype;
  v_status text;
begin
  if p_job_id is null
     or p_claim_token is null
     or p_success is null
     or v_environment is null then
    raise exception 'M340_PUBLISHING_COMPLETE_INVALID'
      using errcode = '22023';
  end if;

  if p_success then
    if v_error_code is not null
       or not app_private.m340_fanbus_publishing_manifest_is_valid(
         p_result_manifest
       ) then
      raise exception 'M340_PUBLISHING_COMPLETE_INVALID'
        using errcode = '22023';
    end if;
  elsif p_result_manifest is not null
        or v_error_code is null
        or pg_catalog.char_length(v_error_code) not between 1 and 80
        or v_error_code !~ '^[A-Z0-9_:-]+$' then
    raise exception 'M340_PUBLISHING_COMPLETE_INVALID'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('m340-publishing:' || v_environment, 0)
  );

  select job.*
    into v_job
  from app_modules.fanbus_publishing_jobs as job
  where job.id = p_job_id
    and job.environment = v_environment
  for update;

  if not found then
    raise exception 'M340_PUBLISHING_CLAIM_INVALID'
      using errcode = '42501';
  end if;

  if v_job.last_completed_claim_token is not distinct from p_claim_token then
    if v_job.last_completion_success is not distinct from p_success
       and (
         (
           p_success
           and v_job.result_manifest is not distinct from p_result_manifest
           and v_error_code is null
         )
         or
         (
           not p_success
           and v_job.last_error_code is not distinct from v_error_code
           and p_result_manifest is null
         )
       ) then
      return jsonb_build_object(
        'completed', true,
        'idempotent', true,
        'status', v_job.status
      );
    end if;

    raise exception 'M340_PUBLISHING_COMPLETE_REPLAY_CONFLICT'
      using errcode = '23505';
  end if;

  if v_job.status <> 'PROCESSING'
     or v_job.claim_token is distinct from p_claim_token
     or v_job.claim_expires_at <= v_now then
    raise exception 'M340_PUBLISHING_CLAIM_INVALID'
      using errcode = '42501';
  end if;

  if p_success then
    v_status := 'SUCCESS';
    update app_modules.fanbus_publishing_jobs as job
    set
      status = v_status,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      completed_at = v_now,
      last_error_code = null,
      result_manifest = p_result_manifest,
      last_completed_claim_token = p_claim_token,
      last_completion_success = true,
      updated_by = null,
      revision = job.revision + 1
    where job.id = p_job_id;
  else
    v_status := case
      when v_job.attempt_count >= 5 then 'FAILED'
      else 'QUEUED'
    end;
    update app_modules.fanbus_publishing_jobs as job
    set
      status = v_status,
      available_at = case
        when v_status = 'QUEUED' then
          v_now + app_private.m340_fanbus_publishing_retry_delay(
            v_job.attempt_count
          )
        else job.available_at
      end,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      completed_at = case when v_status = 'FAILED' then v_now else null end,
      last_error_code = v_error_code,
      result_manifest = null,
      last_completed_claim_token = p_claim_token,
      last_completion_success = false,
      updated_by = null,
      revision = job.revision + 1
    where job.id = p_job_id;
  end if;

  return jsonb_build_object(
    'completed', true,
    'idempotent', false,
    'status', v_status
  );
end;
$function$;

-- Canonical definition: app_private.m340_fanbus_publishing_job_guard_snapshot()
CREATE OR REPLACE FUNCTION app_private.m340_fanbus_publishing_job_guard_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if new.request_snapshot is distinct from old.request_snapshot then
    raise exception 'M340_PUBLISHING_REQUEST_SNAPSHOT_IMMUTABLE'
      using errcode = '55000';
  end if;
  return new;
end;
$function$;

-- Canonical definition: app_private.m340_fanbus_publishing_trip_stats(p_trip_id uuid, p_place_id uuid)
CREATE OR REPLACE FUNCTION app_private.m340_fanbus_publishing_trip_stats(p_trip_id uuid, p_place_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with bounds as (
    select
      app_private.fanbus_publishing_berlin_day(statement_timestamp()) - 29 as first_day,
      app_private.fanbus_publishing_berlin_day(statement_timestamp()) as last_day
  ),
  days as (
    select generate_series(bounds.first_day, bounds.last_day, interval '1 day')::date as day
    from bounds
  ),
  landings as (
    select daily.day, daily.landing_count::bigint as count
    from app_modules.fanbus_publishing_place_landing_daily as daily, bounds
    where daily.place_id = p_place_id
      and daily.day between bounds.first_day and bounds.last_day
  ),
  referrals as (
    select daily.day, daily.referral_count::bigint as count
    from app_modules.fanbus_publishing_trip_referral_daily as daily, bounds
    where daily.place_id = p_place_id
      and daily.trip_id = p_trip_id
      and daily.day between bounds.first_day and bounds.last_day
  ),
  totals as (
    select
      coalesce((
        select sum(daily.landing_count)::bigint
        from app_modules.fanbus_publishing_place_landing_daily as daily
        where daily.place_id = p_place_id
      ), 0) as landing_count,
      coalesce((
        select sum(daily.referral_count)::bigint
        from app_modules.fanbus_publishing_trip_referral_daily as daily
        where daily.place_id = p_place_id
          and daily.trip_id = p_trip_id
      ), 0) as referral_count
  )
  select jsonb_build_object(
    'landingCount', totals.landing_count,
    'referralCount', totals.referral_count,
    'daily', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'day', days.day,
          'landingCount', coalesce(landings.count, 0),
          'referralCount', coalesce(referrals.count, 0)
        ) order by days.day
      )
      from days
      left join landings on landings.day = days.day
      left join referrals on referrals.day = days.day
    ), '[]'::jsonb)
  )
  from totals;
$function$;

-- Canonical definition: app_private.worker_runtime_assert_ready(p_worker_code text)
CREATE OR REPLACE FUNCTION app_private.worker_runtime_assert_ready(p_worker_code text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 if not app_private.worker_runtime_is_enabled(p_worker_code) then raise exception 'WORKER_DISABLED' using errcode='55000'; end if; if not app_private.worker_runtime_is_ready(p_worker_code) then raise exception 'WORKER_NOT_READY' using errcode='55000'; end if;
end;$function$;

-- Canonical definition: app_private.worker_runtime_is_enabled(p_worker_code text)
CREATE OR REPLACE FUNCTION app_private.worker_runtime_is_enabled(p_worker_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce((select c.enabled from app_private.worker_runtime_controls c where c.worker_code=upper(btrim(coalesce(p_worker_code,'')))),false);$function$;

-- Canonical definition: app_private.worker_runtime_is_ready(p_worker_code text)
CREATE OR REPLACE FUNCTION app_private.worker_runtime_is_ready(p_worker_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select coalesce((select c.enabled and c.last_state='ACTIVE' and c.last_seen_at is not null and c.last_seen_at>=c.updated_at and c.last_seen_at>=statement_timestamp()-interval '90 seconds' from app_private.worker_runtime_controls c where c.worker_code=upper(btrim(coalesce(p_worker_code,'')))),false);$function$;

-- Canonical definition: app_private.worker_runtime_status_internal(p_worker_code text)
CREATE OR REPLACE FUNCTION app_private.worker_runtime_status_internal(p_worker_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_code text:=upper(btrim(coalesce(p_worker_code,''))); v_row app_private.worker_runtime_controls%rowtype; v_ready boolean:=false; v_state text; begin
 perform app_private.worker_runtime_capability(v_code); select * into v_row from app_private.worker_runtime_controls c where c.worker_code=v_code; if not found then raise exception 'WORKER_CODE_INVALID' using errcode='22023'; end if;
 v_ready:=v_row.enabled and v_row.last_state='ACTIVE' and v_row.last_seen_at is not null and v_row.last_seen_at>=v_row.updated_at and v_row.last_seen_at>=statement_timestamp()-interval '90 seconds';
 if not v_row.enabled then v_state:='DISABLED'; elsif v_ready then v_state:='ACTIVE'; elsif v_row.updated_at>=statement_timestamp()-interval '75 seconds' then v_state:='STARTING'; else v_state:='UNREACHABLE'; end if;
 return jsonb_build_object('workerCode',v_code,'enabled',v_row.enabled,'ready',v_ready,'state',v_state,'lastSeenAt',v_row.last_seen_at,'updatedAt',v_row.updated_at,'revision',v_row.revision,'activePollSeconds',5,'disabledPollSeconds',60);
end;$function$;

-- Canonical definition: public.pd_liveticker_graphic_worker_claim()
CREATE OR REPLACE FUNCTION public.pd_liveticker_graphic_worker_claim()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_job app_modules.liveticker_graphic_jobs%rowtype;
  v_token uuid;
  v_environment text := app_private.platform_release_environment();
begin
  if v_environment not in ('DEV','PROD') then
    raise exception 'LIVETICKER_ENVIRONMENT_INVALID' using errcode='55000';
  end if;

  select * into v_job
  from app_modules.liveticker_graphic_jobs j
  where ((j.status='QUEUED' and j.available_at<=now()) or (j.status='PROCESSING' and j.claim_expires_at<now()))
    and j.attempt_count<5
  order by j.available_at,j.created_at,j.id
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object('claimed',false);
  end if;

  v_token:=extensions.gen_random_uuid();

  update app_modules.liveticker_graphic_jobs
  set status='PROCESSING',
      attempt_count=v_job.attempt_count+1,
      claim_token=v_token,
      claimed_at=now(),
      claim_expires_at=now()+interval '10 minutes',
      updated_at=now(),
      revision=revision+1
  where id=v_job.id
  returning * into v_job;

  return jsonb_build_object('claimed',true,'job',jsonb_build_object(
    'jobId',v_job.id,
    'claimToken',v_job.claim_token,
    'environment',v_environment,
    'attemptCount',v_job.attempt_count,
    'claimExpiresAt',v_job.claim_expires_at,
    'request',v_job.request_snapshot
  ));
end;
$function$;

-- Canonical definition: public.pd_liveticker_graphic_worker_complete(p_job_id uuid, p_claim_token uuid, p_success boolean, p_error_code text, p_result_manifest jsonb)
CREATE OR REPLACE FUNCTION public.pd_liveticker_graphic_worker_complete(p_job_id uuid, p_claim_token uuid, p_success boolean, p_error_code text, p_result_manifest jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_job app_modules.liveticker_graphic_jobs%rowtype; v_retry boolean;
begin
  select * into v_job from app_modules.liveticker_graphic_jobs where id=p_job_id for update;
  if not found then raise exception 'LIVETICKER_JOB_NOT_FOUND' using errcode='22023'; end if;
  if v_job.last_completed_claim_token=p_claim_token then
    return jsonb_build_object('completed',true,'status',v_job.status,'idempotent',true);
  end if;
  if v_job.status<>'PROCESSING' or v_job.claim_token is distinct from p_claim_token then
    raise exception 'LIVETICKER_CLAIM_INVALID' using errcode='40001';
  end if;
  if p_success then
    if not app_private.liveticker_graphic_manifest_valid(p_result_manifest,v_job.graphic_kind) then
      raise exception 'LIVETICKER_MANIFEST_INVALID' using errcode='22023';
    end if;
    update app_modules.liveticker_graphic_jobs
    set status='SUCCEEDED',completed_at=now(),last_error_code=null,result_manifest=p_result_manifest,
        last_completed_claim_token=p_claim_token,last_completion_success=true,
        claim_token=null,claim_expires_at=null,updated_at=now(),revision=revision+1
    where id=p_job_id returning * into v_job;
  else
    if p_error_code is null or p_error_code !~ '^[A-Z0-9_:-]{1,80}$' then
      raise exception 'LIVETICKER_ERROR_CODE_INVALID' using errcode='22023';
    end if;
    v_retry:=v_job.attempt_count<5;
    update app_modules.liveticker_graphic_jobs
    set status=case when v_retry then 'QUEUED' else 'FAILED' end,
        available_at=case when v_retry then now()+app_private.liveticker_graphic_retry_delay(v_job.attempt_count) else available_at end,
        completed_at=case when v_retry then null else now() end,
        last_error_code=p_error_code,result_manifest=null,
        last_completed_claim_token=p_claim_token,last_completion_success=false,
        claim_token=null,claim_expires_at=null,updated_at=now(),revision=revision+1
    where id=p_job_id returning * into v_job;
  end if;
  return jsonb_build_object('completed',true,'status',v_job.status,'idempotent',false);
end;
$function$;

-- Canonical definition: public.pd_m340_fanbus_publishing_job_claim()
CREATE OR REPLACE FUNCTION public.pd_m340_fanbus_publishing_job_claim()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_control jsonb:=public.pd_worker_runtime_control('FANBUS_PUBLISHING'); v_enabled boolean:=coalesce((v_control->>'enabled')::boolean,false); v_result jsonb; begin if not v_enabled then return jsonb_build_object('claimed',false,'workerEnabled',false,'pollSeconds',60); end if; v_result:=public.pd_m340_fanbus_publishing_job_claim_before_worker_control_r1(); return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('workerEnabled',true,'pollSeconds',5); end;$function$;

-- Canonical definition: public.pd_m340_fanbus_publishing_job_complete(p_job_id uuid, p_claim_token uuid, p_success boolean, p_error_code text, p_result_manifest jsonb)
CREATE OR REPLACE FUNCTION public.pd_m340_fanbus_publishing_job_complete(p_job_id uuid, p_claim_token uuid, p_success boolean, p_error_code text, p_result_manifest jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select app_private.m340_fanbus_publishing_job_complete(
    p_job_id,
    p_claim_token,
    p_success,
    p_error_code,
    p_result_manifest
  );
$function$;

-- Canonical definition: public.pd_m340_fanbus_publishing_template_activate(p_actor uuid, p_kind text, p_object_name text, p_original_filename text, p_sha256 text, p_bytes bigint)
CREATE OR REPLACE FUNCTION public.pd_m340_fanbus_publishing_template_activate(p_actor uuid, p_kind text, p_object_name text, p_original_filename text, p_sha256 text, p_bytes bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_kind text := upper(pg_catalog.btrim(coalesce(p_kind, '')));
  v_state app_modules.fanbus_publishing_template_state%rowtype;
  v_version app_modules.fanbus_publishing_template_versions%rowtype;
  v_expected_prefix text;
begin
  if p_actor is null
     or not app_private.has_capability(p_actor, 'fanbus.publishing.manage')
     or v_environment is null
     or v_kind not in ('POST', 'STORY', 'LED') then
    raise exception 'M340_TEMPLATE_ACTIVATE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  v_expected_prefix := 'versions/' || lower(v_environment) || '/' || p_actor::text || '/';
  if p_object_name is null
     or p_object_name not like v_expected_prefix || '%'
     or p_object_name !~ '[0-9a-f-]{36}[.]svg$'
     or p_object_name ~ '[?#\\]'
     or p_object_name ~ '[.][.]'
     or p_original_filename is null
     or char_length(p_original_filename) not between 5 and 160
     or p_original_filename !~ '^[A-Za-z0-9ÄÖÜäöüß._ -]+[.]svg$'
     or p_sha256 !~ '^[0-9a-f]{64}$'
     or p_bytes not between 1000 and 5242880 then
    raise exception 'M340_TEMPLATE_ACTIVATE_INVALID'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'm340-publishing-templates'
      and object.name = p_object_name
  ) then
    raise exception 'M340_TEMPLATE_OBJECT_MISSING'
      using errcode = 'P0002';
  end if;

  insert into app_modules.fanbus_publishing_template_state(
    environment, kind, active_version_id, updated_by
  ) values (v_environment, v_kind, null, p_actor)
  on conflict (environment, kind) do nothing;

  select state.* into v_state
  from app_modules.fanbus_publishing_template_state as state
  where state.environment = v_environment
    and state.kind = v_kind
  for update;

  insert into app_modules.fanbus_publishing_template_versions(
    environment,
    kind,
    object_name,
    original_filename,
    sha256,
    bytes,
    supersedes_id,
    created_by
  ) values (
    v_environment,
    v_kind,
    p_object_name,
    p_original_filename,
    p_sha256,
    p_bytes,
    v_state.active_version_id,
    p_actor
  )
  returning * into v_version;

  update app_modules.fanbus_publishing_template_state
  set active_version_id = v_version.id,
      updated_at = now(),
      updated_by = p_actor
  where environment = v_environment
    and kind = v_kind;

  perform app_private.log_audit(
    p_actor,
    'FANBUS_PUBLISHING_TEMPLATE_ACTIVATED',
    'fanbus_publishing_template',
    v_kind,
    jsonb_build_object('versionId', v_state.active_version_id),
    jsonb_build_object(
      'versionId', v_version.id,
      'sha256', v_version.sha256,
      'bytes', v_version.bytes
    )
  );

  return jsonb_build_object(
    'kind', v_kind,
    'versionId', v_version.id,
    'filename', v_version.original_filename,
    'sha256', v_version.sha256,
    'bytes', v_version.bytes,
    'createdAt', v_version.created_at
  );
end;
$function$;

-- Canonical definition: public.pd_m340_fanbus_publishing_template_current(p_kind text)
CREATE OR REPLACE FUNCTION public.pd_m340_fanbus_publishing_template_current(p_kind text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_kind text := nullif(upper(pg_catalog.btrim(coalesce(p_kind, ''))), '');
begin
  if v_environment is null
     or (v_kind is not null and v_kind not in ('POST', 'STORY', 'LED')) then
    raise exception 'M340_TEMPLATE_CURRENT_INVALID'
      using errcode = '22023';
  end if;

  return jsonb_build_object(
    'environment', v_environment,
    'templates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'kind', kinds.kind,
          'source', case when version.id is null then 'SERVER_DEFAULT' else 'CUSTOM' end,
          'versionId', version.id,
          'objectName', version.object_name,
          'filename', version.original_filename,
          'sha256', version.sha256,
          'bytes', version.bytes,
          'createdAt', version.created_at
        ) order by kinds.ordinal
      )
      from (values ('POST', 1), ('STORY', 2), ('LED', 3)) as kinds(kind, ordinal)
      left join app_modules.fanbus_publishing_template_state as state
        on state.environment = v_environment
       and state.kind = kinds.kind
      left join app_modules.fanbus_publishing_template_versions as version
        on version.id = state.active_version_id
      where v_kind is null or kinds.kind = v_kind
    ), '[]'::jsonb)
  );
end;
$function$;

-- Canonical definition: public.pd_public_fanbus_ontour_resolve(p_slug text)
CREATE OR REPLACE FUNCTION public.pd_public_fanbus_ontour_resolve(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_slug text := pg_catalog.btrim(coalesce(p_slug, ''));
  v_place app_modules.fanbus_publishing_places%rowtype;
  v_count integer := 0;
  v_trips jsonb := '[]'::jsonb;
  v_mode text := 'FALLBACK';
  v_result jsonb;
begin
  if char_length(v_slug) not between 1 and 48
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return jsonb_build_object(
      'mode', 'FALLBACK',
      'place', null,
      'trips', '[]'::jsonb
    );
  end if;

  select place.*
    into v_place
  from app_modules.fanbus_publishing_places as place
  where place.slug = v_slug
    and place.is_active;

  if not found then
    return jsonb_build_object(
      'mode', 'FALLBACK',
      'place', null,
      'trips', '[]'::jsonb
    );
  end if;

  select
    count(*)::integer,
    coalesce(
      jsonb_agg(open_trip.projection order by
        open_trip.event_date,
        open_trip.event_time asc nulls last,
        open_trip.departure_at,
        open_trip.trip_id
      ),
      '[]'::jsonb
    )
  into v_count, v_trips
  from app_private.fanbus_publishing_open_trips(v_place.id) as open_trip;

  v_mode := case
    when v_count = 1 then 'SINGLE'
    when v_count > 1 then 'MULTIPLE'
    else 'FALLBACK'
  end;

  v_result := jsonb_build_object(
    'mode', v_mode,
    'place', jsonb_build_object(
      'slug', v_place.slug,
      'displayName', v_place.display_name
    ),
    'trips', v_trips
  );

  begin
    perform app_private.fanbus_publishing_record_place_landing(
      v_place.id,
      statement_timestamp()
    );
  exception when others then
    null;
  end;

  return v_result;
end;
$function$;

-- Canonical definition: public.pd_public_fanbus_trip_referral_track(p_slug text, p_trip_id uuid)
CREATE OR REPLACE FUNCTION public.pd_public_fanbus_trip_referral_track(p_slug text, p_trip_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_slug text := pg_catalog.btrim(coalesce(p_slug, ''));
  v_place_id uuid;
begin
  if p_trip_id is null
     or char_length(v_slug) not between 1 and 48
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return jsonb_build_object('tracked', false);
  end if;

  select place.id
    into v_place_id
  from app_modules.fanbus_publishing_places as place
  where place.slug = v_slug
    and place.is_active;

  if v_place_id is null
     or not exists (
       select 1
       from app_private.fanbus_publishing_open_trips(v_place_id) as open_trip
       where open_trip.trip_id = p_trip_id
     ) then
    return jsonb_build_object('tracked', false);
  end if;

  begin
    perform app_private.fanbus_publishing_record_trip_referral(
      v_place_id,
      p_trip_id,
      statement_timestamp()
    );
  exception when others then
    return jsonb_build_object('tracked', false);
  end;

  return jsonb_build_object('tracked', true);
exception when others then
  return jsonb_build_object('tracked', false);
end;
$function$;

-- Canonical definition: public.pd_public_liveticker_graphic_enqueue(p_event_id uuid, p_kind text)
CREATE OR REPLACE FUNCTION public.pd_public_liveticker_graphic_enqueue(p_event_id uuid, p_kind text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_actor uuid;
begin
  v_actor:=app_private.liveticker_require_operator();
  return app_private.liveticker_graphic_enqueue(p_event_id,p_kind,v_actor);
end;
$function$;

-- Canonical definition: public.pd_public_liveticker_graphic_jobs(p_event_id uuid)
CREATE OR REPLACE FUNCTION public.pd_public_liveticker_graphic_jobs(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform app_private.liveticker_require_operator();
  perform app_private.liveticker_assert_supported_game(p_event_id);
  return jsonb_build_object('jobs',coalesce((
    select jsonb_agg(jsonb_build_object(
      'jobId',j.id,'kind',j.graphic_kind,'status',j.status,
      'sourceRevision',j.source_revision,'attemptCount',j.attempt_count,
      'createdAt',j.created_at,'completedAt',j.completed_at,
      'errorCode',j.last_error_code,'result',j.result_manifest
    ) order by j.created_at desc)
    from (select * from app_modules.liveticker_graphic_jobs where event_id=p_event_id order by created_at desc limit 30) j
  ),'[]'::jsonb));
end;
$function$;

-- Canonical definition: public.pd_public_liveticker_graphics_games()
CREATE OR REPLACE FUNCTION public.pd_public_liveticker_graphics_games()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform app_private.liveticker_require_operator();
  return jsonb_build_object('games',coalesce((
    select jsonb_agg(
      x.item
      order by
        (x.completed_at is not null) asc,
        case when x.completed_at is null then x.event_date end asc,
        case when x.completed_at is null then x.event_time end asc nulls last,
        case when x.completed_at is not null then x.event_date end desc,
        case when x.completed_at is not null then x.event_time end desc nulls last,
        x.event_id
    )
    from (
      select e.id event_id,e.event_date,e.event_time,s.completed_at,
        jsonb_build_object(
          'eventId',e.id,'eventDate',e.event_date,'eventTime',e.event_time,'venue',e.venue,'homeAway',g.home_away,
          'minute',coalesce(s.minute,0),
          'completedAt',s.completed_at,
          'displayTitle',case g.home_away when 'HOME' then own.short_name||' – '||coalesce(opp.short_name,g.opponent_name) else coalesce(opp.short_name,g.opponent_name)||' – '||own.short_name end,
          'ownTeam',app_private.liveticker_team_json(own.id),
          'opponentTeam',coalesce(app_private.liveticker_team_json(opp.id),jsonb_build_object('id',null,'name',g.opponent_name,'shortName',g.opponent_name,'teamCode',null,'logoAssetPath',null,'logoUrl',null,'homeClub',false,'players','[]'::jsonb))
        ) item
      from app_modules.events e
      join app_modules.event_games g on g.event_id=e.id
      join app_modules.liveticker_teams own on own.is_home_club and own.is_active
      left join lateral(
        select t.id,t.short_name from app_modules.liveticker_teams t
        where t.is_active and not t.is_home_club and (
          lower(btrim(t.name))=lower(btrim(g.opponent_name))
          or lower(btrim(t.short_name))=lower(btrim(g.opponent_name))
          or lower(g.opponent_name) like '%'||lower(btrim(t.short_name))||'%'
        )
        order by case when lower(btrim(t.name))=lower(btrim(g.opponent_name)) then 0 else 1 end,t.name
        limit 1
      ) opp on true
      left join app_modules.liveticker_game_states s on s.event_id=e.id
      where e.event_type='GAME' and e.visibility='PUBLIC'
        and e.event_date between ((now() at time zone 'Europe/Berlin')::date-30) and ((now() at time zone 'Europe/Berlin')::date+220)
    ) x
  ),'[]'::jsonb));
end;
$function$;

-- Canonical definition: public.pd_public_liveticker_state(p_event_id uuid)
CREATE OR REPLACE FUNCTION public.pd_public_liveticker_state(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_rev integer:=0; v_min integer:=1; v_done timestamptz; v_hist jsonb:='[]'::jsonb; v_g record; begin
 perform app_private.liveticker_require_operator(); perform app_private.liveticker_assert_supported_game(p_event_id);
 select e.event_date,e.event_time,e.venue,g.home_away,g.opponent_name,opp.id opponent_team_id into v_g
 from app_modules.events e join app_modules.event_games g on g.event_id=e.id
 left join lateral(select t.id from app_modules.liveticker_teams t where t.is_active and not t.is_home_club and (lower(btrim(t.name))=lower(btrim(g.opponent_name)) or lower(btrim(t.short_name))=lower(btrim(g.opponent_name)) or lower(g.opponent_name) like '%'||lower(btrim(t.short_name))||'%') order by case when lower(btrim(t.name))=lower(btrim(g.opponent_name)) then 0 else 1 end,t.name limit 1) opp on true where e.id=p_event_id;
 select revision,minute,completed_at into v_rev,v_min,v_done from app_modules.liveticker_game_states where event_id=p_event_id;
 if not found then v_rev:=0;v_min:=1;v_done:=null; end if;
 select coalesce(jsonb_agg(a.payload order by a.ordinal),'[]'::jsonb) into v_hist from app_modules.liveticker_actions a where a.event_id=p_event_id and a.is_active;
 return jsonb_build_object('eventId',p_event_id,'revision',v_rev,'minute',v_min,'completedAt',v_done,'opponentId',v_g.opponent_team_id,'opponentName',v_g.opponent_name,'history',v_hist,'homeAway',v_g.home_away,'eventDate',v_g.event_date,'eventTime',v_g.event_time,'venue',v_g.venue);
end; $function$;

-- Canonical definition: public.pd_public_liveticker_templates()
CREATE OR REPLACE FUNCTION public.pd_public_liveticker_templates()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin perform app_private.liveticker_require_operator(); return app_private.liveticker_output_templates_json(); end $function$;

-- Canonical definition: public.pd_worker_runtime_control(p_worker_code text)
CREATE OR REPLACE FUNCTION public.pd_worker_runtime_control(p_worker_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_code text:=upper(btrim(coalesce(p_worker_code,''))); v_row app_private.worker_runtime_controls%rowtype; begin perform app_private.worker_runtime_capability(v_code); update app_private.worker_runtime_controls c set last_seen_at=statement_timestamp(),last_state=case when c.enabled then 'ACTIVE' else 'DISABLED' end where c.worker_code=v_code returning * into v_row; if not found then raise exception 'WORKER_CODE_INVALID' using errcode='22023'; end if; return jsonb_build_object('workerCode',v_code,'enabled',v_row.enabled,'state',case when v_row.enabled then 'ACTIVE' else 'DISABLED' end,'activePollSeconds',5,'disabledPollSeconds',60); end;$function$;

-- Align booking-number validation with the canonical reset-safe contract.
alter table app_modules.fanbus_bookings
  drop constraint if exists fanbus_bookings_booking_number_check;

alter table app_modules.fanbus_bookings
  add constraint fanbus_bookings_booking_number_check
  check (booking_number ~ '^(FB|DEV)-[0-9]{2}-[0-9]{6,}$'::text);

-- Retire the old anonymous DEV-prototype exposure.
revoke all on function public.pd_public_liveticker_state(uuid) from public, anon;
revoke all on function public.pd_public_liveticker_templates() from public, anon;
grant execute on function public.pd_public_liveticker_state(uuid) to authenticated;
grant execute on function public.pd_public_liveticker_templates() to authenticated;

-- Full historical helper canonicalization after DEV/PROD convergence.
CREATE OR REPLACE FUNCTION app_private.api_fanbus_assignment_apply_before_booking_groups(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
revoke all on function app_private.api_fanbus_assignment_apply_before_booking_groups(p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.api_fanbus_bus_assignment_set_before_m330_r1_before_m327_r1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
revoke all on function app_private.api_fanbus_bus_assignment_set_before_m330_r1_before_m327_r1(p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.api_fanbus_registration_create_manual_batches_before_booking_gr(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_trip uuid := app_private.m326_uuid(p_payload ->> 'tripId','FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD');
  v_key uuid := app_private.m326_uuid(p_payload ->> 'idempotencyKey','FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD');
  v_bookings jsonb := p_payload -> 'bookings';
  v_booking jsonb;
  v_participants jsonb;
  v_total_participants integer := 0;
  v_booking_count integer := 0;
  v_index integer := 0;
  v_sub_key uuid;
  v_result jsonb;
  v_booking_number text;
  v_results jsonb := '[]'::jsonb;
  v_any_waitlisted boolean := false;
begin
  if jsonb_typeof(p_payload) <> 'object'
     or not p_payload ?& array['tripId','bookings','termsConfirmed','idempotencyKey']
     or exists (
       select 1 from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array['tripId','bookings','termsConfirmed','idempotencyKey'])
     )
     or v_trip is null or v_key is null
     or (p_payload ->> 'termsConfirmed')::boolean is distinct from true
     or jsonb_typeof(v_bookings) <> 'array'
     or jsonb_array_length(v_bookings) not between 1 and 20 then
    raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD' using errcode='22023';
  end if;

  for v_booking in
    select value from jsonb_array_elements(v_bookings) with ordinality as booking(value, position)
    order by position
  loop
    if jsonb_typeof(v_booking) <> 'object'
       or not v_booking ? 'participants'
       or exists (select 1 from jsonb_object_keys(v_booking) as key(name) where key.name <> 'participants') then
      raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD' using errcode='22023';
    end if;

    v_participants := v_booking -> 'participants';
    if jsonb_typeof(v_participants) <> 'array'
       or jsonb_array_length(v_participants) not between 1 and 20 then
      raise exception 'FANBUS_MANUAL_BATCHES_INVALID_PAYLOAD' using errcode='22023';
    end if;

    v_booking_count := v_booking_count + 1;
    v_total_participants := v_total_participants + jsonb_array_length(v_participants);
    if v_total_participants > 20 then
      raise exception 'FANBUS_MANUAL_BATCHES_TOO_MANY_PARTICIPANTS' using errcode='22023';
    end if;

    v_index := v_index + 1;
    v_sub_key := (
      substr(md5(v_key::text || ':m328-booking:' || v_index::text), 1, 8) || '-' ||
      substr(md5(v_key::text || ':m328-booking:' || v_index::text), 9, 4) || '-' ||
      substr(md5(v_key::text || ':m328-booking:' || v_index::text), 13, 4) || '-' ||
      substr(md5(v_key::text || ':m328-booking:' || v_index::text), 17, 4) || '-' ||
      substr(md5(v_key::text || ':m328-booking:' || v_index::text), 21, 12)
    )::uuid;

    v_result := app_private.api_fanbus_registration_create_manual_bulk(
      jsonb_build_object(
        'tripId',v_trip,'participants',v_participants,'termsConfirmed',true,
        'idempotencyKey',v_sub_key,'bookingMode','GROUP','primaryParticipantIndex',0
      )
    );

    if coalesce(v_result ->> 'outcome','') not in ('CREATED','WAITLISTED') then
      raise exception 'FANBUS_MANUAL_BATCHES_UNEXPECTED_OUTCOME' using errcode='55000';
    end if;

    select booking.booking_number into v_booking_number
    from app_modules.fanbus_bookings as booking
    where booking.id = nullif(v_result ->> 'bookingId','')::uuid;

    if v_booking_number is null then
      raise exception 'FANBUS_BOOKING_NUMBER_MISSING' using errcode='55000';
    end if;

    v_any_waitlisted := v_any_waitlisted or (v_result ->> 'outcome')='WAITLISTED';
    v_results := v_results || jsonb_build_array(v_result || jsonb_build_object('bookingNumber',v_booking_number));
  end loop;

  return jsonb_build_object(
    'outcome',case when v_any_waitlisted then 'WAITLISTED' else 'CREATED' end,
    'bookingCount',v_booking_count,'participantCount',v_total_participants,'bookings',v_results
  );
end;
$function$;
revoke all on function app_private.api_fanbus_registration_create_manual_batches_before_booking_gr(p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.api_fanbus_registrations_list_before_group_duplicate_r1(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_base jsonb := app_private.api_fanbus_registrations_list_before_m328_r1(p_payload);
  v_registrations jsonb;
begin
  select coalesce(
    jsonb_agg(
      item.value || jsonb_build_object('bookingNumber', booking.booking_number)
      order by item.ordinality
    ),
    '[]'::jsonb
  )
  into v_registrations
  from jsonb_array_elements(coalesce(v_base -> 'registrations', '[]'::jsonb))
    with ordinality as item(value, ordinality)
  left join app_modules.fanbus_bookings as booking
    on booking.id = nullif(item.value ->> 'bookingId', '')::uuid;

  return jsonb_set(v_base, '{registrations}', v_registrations, true);
end;
$function$;
revoke all on function app_private.api_fanbus_registrations_list_before_group_duplicate_r1(p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.liveticker_graphic_enqueue_before_worker_control_r1(p_event_id uuid, p_kind text, p_actor uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_kind text := upper(btrim(coalesce(p_kind,'')));
  v_state app_modules.liveticker_game_states%rowtype;
  v_event record;
  v_own record;
  v_opp record;
  v_history jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_job app_modules.liveticker_graphic_jobs%rowtype;
begin
  if v_kind not in ('PERIOD_1','PERIOD_2','FINAL') then
    raise exception 'LIVETICKER_GRAPHIC_KIND_INVALID' using errcode='22023';
  end if;
  perform app_private.liveticker_assert_supported_game(p_event_id);

  select * into v_state from app_modules.liveticker_game_states where event_id=p_event_id;
  if not found then raise exception 'LIVETICKER_GRAPHIC_STATE_MISSING' using errcode='22023'; end if;

  select e.event_date,e.title,g.opponent_name into v_event
  from app_modules.events e join app_modules.event_games g on g.event_id=e.id where e.id=p_event_id;

  select t.id,t.name,t.short_name,t.team_code,t.logo_asset_path,t.logo_data,t.logo_mime
    into v_own
  from app_modules.liveticker_teams t
  where t.is_active and t.is_home_club order by t.name limit 1;
  if v_own.id is null or (v_own.logo_data is null and nullif(btrim(coalesce(v_own.logo_asset_path,'')),'') is null) then
    raise exception 'LIVETICKER_GRAPHIC_OUR_ASSET_MISSING' using errcode='22023';
  end if;

  select t.id,t.name,t.short_name,t.team_code,t.logo_asset_path,t.logo_data,t.logo_mime
    into v_opp
  from app_modules.liveticker_teams t
  where t.is_active and not t.is_home_club and (
    lower(btrim(t.name))=lower(btrim(v_event.opponent_name))
    or lower(btrim(t.short_name))=lower(btrim(v_event.opponent_name))
    or lower(v_event.opponent_name) like '%'||lower(btrim(t.short_name))||'%'
  )
  order by case when lower(btrim(t.name))=lower(btrim(v_event.opponent_name)) then 0 else 1 end,t.name limit 1;
  if v_opp.id is null or (v_opp.logo_data is null and nullif(btrim(coalesce(v_opp.logo_asset_path,'')),'') is null) then
    raise exception 'LIVETICKER_GRAPHIC_OPPONENT_ASSET_MISSING' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(a.payload order by a.ordinal),'[]'::jsonb) into v_history
  from app_modules.liveticker_actions a where a.event_id=p_event_id and a.is_active;

  v_snapshot := jsonb_build_object(
    'schemaVersion',2,'kind',v_kind,'eventId',p_event_id,'eventDate',v_event.event_date,
    'eventTitle',coalesce(v_event.title,''),'revision',v_state.revision,'competitionLabel','','seriesInfo','',
    'ourTeam',jsonb_build_object(
      'id',v_own.id,'name',v_own.name,'shortName',v_own.short_name,'teamCode',v_own.team_code,
      'logoAssetPath',v_own.logo_asset_path,'logoMime',v_own.logo_mime,
      'logoDataBase64',case when v_own.logo_data is null then null else encode(v_own.logo_data,'base64') end
    ),
    'opponentTeam',jsonb_build_object(
      'id',v_opp.id,'name',v_opp.name,'shortName',v_opp.short_name,'teamCode',v_opp.team_code,
      'logoAssetPath',v_opp.logo_asset_path,'logoMime',v_opp.logo_mime,
      'logoDataBase64',case when v_opp.logo_data is null then null else encode(v_opp.logo_data,'base64') end
    ),
    'history',v_history
  );

  insert into app_modules.liveticker_graphic_jobs(event_id,graphic_kind,source_revision,request_snapshot,created_by,updated_by)
  values(p_event_id,v_kind,v_state.revision,v_snapshot,p_actor,p_actor)
  on conflict do nothing returning * into v_job;

  if v_job.id is null then
    select * into v_job from app_modules.liveticker_graphic_jobs
    where event_id=p_event_id and graphic_kind=v_kind and status in ('QUEUED','PROCESSING')
    order by created_at desc limit 1;
  end if;

  return jsonb_build_object('jobId',v_job.id,'eventId',v_job.event_id,'kind',v_job.graphic_kind,
    'status',v_job.status,'sourceRevision',v_job.source_revision,'createdAt',v_job.created_at);
end;
$function$;
revoke all on function app_private.liveticker_graphic_enqueue_before_worker_control_r1(p_event_id uuid, p_kind text, p_actor uuid) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.m320_r3_assignment_plan_before_booking_groups(p_trip_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'freeAfter',greatest(bus.capacity-existing.occupancy-proposed.proposed_count,0),
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
revoke all on function app_private.m320_r3_assignment_plan_before_booking_groups(p_trip_id uuid) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.notification_add_external_email_before_m328_booking_contact_con(p_event app_private.notification_events, p_email text, p_recipient_kind text, p_target_key text, p_template_key text, p_template_data jsonb, p_deep_link text DEFAULT ''::text, p_mandatory boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_data jsonb := coalesce(p_template_data,'{}'::jsonb);
  v_booking_id uuid;
  v_booking_number text;
begin
  begin
    v_booking_id := nullif(v_data ->> 'bookingId','')::uuid;
  exception when others then
    v_booking_id := null;
  end;

  if v_booking_id is not null then
    select booking.booking_number into v_booking_number
    from app_modules.fanbus_bookings as booking where booking.id=v_booking_id;
    if v_booking_number is not null then
      v_data := v_data || jsonb_build_object('bookingNumber',v_booking_number);
    end if;
  end if;

  perform app_private.notification_add_external_email_before_m328_r1(
    p_event,p_email,p_recipient_kind,p_target_key,p_template_key,v_data,p_deep_link,p_mandatory
  );
end;
$function$;
revoke all on function app_private.notification_add_external_email_before_m328_booking_contact_con(p_event app_private.notification_events, p_email text, p_recipient_kind text, p_target_key text, p_template_key text, p_template_data jsonb, p_deep_link text, p_mandatory boolean) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_current_actions_before_m327_r1()
 RETURNS text[]
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select app_private.pd_api_current_actions_before_m320_r3()
    || array['fanbus_assignment_preview','fanbus_assignment_apply']::text[]
$function$;
revoke all on function app_private.pd_api_current_actions_before_m327_r1() from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_liveticker_graphic_templates_pro(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
begin
  case v_action
    when 'fanbus_publishing_template_upload_authorize' then
      return app_private.api_fanbus_publishing_template_upload_authorize(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_publishing_template_preview_authorize' then
      return app_private.api_fanbus_publishing_template_preview_authorize(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_publishing_template_rollback' then
      return app_private.api_fanbus_publishing_template_rollback(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return app_private.pd_api_dispatch_current_before_m340_publishing_ux_templates(
        p_action, p_payload
      );
  end case;
end;
$function$;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_graphic_templates_pro(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_liveticker_graphics_prod_r1(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
begin
  case v_action
    when 'fanbus_publishing_resolution_ensure' then
      return app_private.api_fanbus_publishing_resolution_ensure(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_publishing_resolution_choose' then
      return app_private.api_fanbus_publishing_resolution_choose(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_publishing_job_enqueue' then
      return app_private.api_fanbus_publishing_job_enqueue(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_publishing_place_create' then
      raise exception 'M340_PUBLISHING_MANUAL_PLACE_API_DEPRECATED'
        using errcode = '0A000';
    when 'fanbus_publishing_place_key_add' then
      raise exception 'M340_PUBLISHING_MANUAL_PLACE_API_DEPRECATED'
        using errcode = '0A000';
    when 'fanbus_publishing_event_place_bind' then
      raise exception 'M340_PUBLISHING_MANUAL_PLACE_API_DEPRECATED'
        using errcode = '0A000';
    else
      return app_private.pd_api_dispatch_current_before_m340_auto_place_resolution(
        p_action,
        p_payload
      );
  end case;
end;
$function$;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_graphics_prod_r1(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_liveticker_player_delete_r1(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_action text:=lower(btrim(coalesce(p_action,''))); begin case v_action when 'worker_runtime_status' then return app_private.api_worker_runtime_status(coalesce(p_payload,'{}'::jsonb)); when 'worker_runtime_set' then return app_private.api_worker_runtime_set(coalesce(p_payload,'{}'::jsonb)); when 'liveticker_graphic_templates_list' then return app_private.api_liveticker_graphic_templates_list(); when 'liveticker_graphic_template_save' then return app_private.api_liveticker_graphic_template_save(coalesce(p_payload,'{}'::jsonb)); else return app_private.pd_api_dispatch_current_before_liveticker_graphic_templates_prod_r1(p_action,p_payload); end case; end;$function$;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_player_delete_r1(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_liveticker_team_logo_upload_r1(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_action text:=lower(btrim(coalesce(p_action,'')));
  v_event uuid;
  v_kind text;
begin
  case v_action
    when 'liveticker_graphics_games' then
      return public.pd_public_liveticker_graphics_games();
    when 'liveticker_graphics_status' then
      v_event:=nullif(btrim(coalesce(p_payload->>'eventId','')),'')::uuid;
      return jsonb_build_object(
        'state',public.pd_public_liveticker_state(v_event),
        'jobs',coalesce(public.pd_public_liveticker_graphic_jobs(v_event)->'jobs','[]'::jsonb)
      );
    when 'liveticker_graphics_enqueue' then
      v_event:=nullif(btrim(coalesce(p_payload->>'eventId','')),'')::uuid;
      v_kind:=upper(btrim(coalesce(p_payload->>'kind','')));
      return public.pd_public_liveticker_graphic_enqueue(v_event,v_kind);
    else
      return app_private.pd_api_dispatch_current_before_liveticker_graphics_prod_r1(p_action,p_payload);
  end case;
exception
  when invalid_text_representation then
    raise exception 'Ungültige Liveticker-Grafik-Anfrage.' using errcode='22023';
end;
$function$;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_team_logo_upload_r1(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_m327_r1(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
revoke all on function app_private.pd_api_dispatch_current_before_m327_r1(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_m328_r1_booking_actions(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if lower(btrim(coalesce(p_action,'')))='fanbus_registration_create_manual_batches' then
    return app_private.api_fanbus_registration_create_manual_batches(coalesce(p_payload,'{}'::jsonb));
  end if;
  return app_private.pd_api_dispatch_current_before_m328_r1_bookings(p_action,p_payload);
end;
$function$;
revoke all on function app_private.pd_api_dispatch_current_before_m328_r1_booking_actions(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_m340_publishing_slice1(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_action text:=lower(btrim(coalesce(p_action,''))); begin case v_action when 'liveticker_output_templates_list' then return app_private.api_liveticker_output_templates_list(); when 'liveticker_output_template_save' then return app_private.api_liveticker_output_template_save(coalesce(p_payload,'{}'::jsonb)); else return app_private.pd_api_dispatch_current_before_liveticker_templates_prod_r1(p_action,p_payload); end case; end $function$;
revoke all on function app_private.pd_api_dispatch_current_before_m340_publishing_slice1(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_m340_publishing_slice3(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
begin
  case v_action
    when 'fanbus_publishing_place_create' then
      return app_private.api_fanbus_publishing_place_create(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_publishing_place_key_add' then
      return app_private.api_fanbus_publishing_place_key_add(
        coalesce(p_payload, '{}'::jsonb)
      );
    when 'fanbus_publishing_event_place_bind' then
      return app_private.api_fanbus_publishing_event_place_bind(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return app_private.pd_api_dispatch_current_before_m340_publishing_slice1(
        p_action,
        p_payload
      );
  end case;
end;
$function$;
revoke all on function app_private.pd_api_dispatch_current_before_m340_publishing_slice3(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_m340_publishing_slice5(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
begin
  if v_action = 'fanbus_publishing_job_enqueue' then
    return app_private.api_fanbus_publishing_job_enqueue(
      coalesce(p_payload, '{}'::jsonb)
    );
  end if;

  return app_private.pd_api_dispatch_current_before_m340_publishing_slice3(
    p_action,
    p_payload
  );
end;
$function$;
revoke all on function app_private.pd_api_dispatch_current_before_m340_publishing_slice5(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_m340_publishing_ux_templates(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_action text:=lower(btrim(coalesce(p_action,'')));
begin
  case v_action
    when 'liveticker_team_logo_get' then
      return app_private.api_liveticker_team_logo_get(coalesce(p_payload,'{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_liveticker_team_logo_upload_r1(p_action,p_payload);
  end case;
end;
$function$;
revoke all on function app_private.pd_api_dispatch_current_before_m340_publishing_ux_templates(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_m340_settings_templates_r1(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_action text:=lower(btrim(coalesce(p_action,'')));
begin
  case v_action
    when 'liveticker_graphic_templates_list' then return app_private.api_liveticker_graphic_templates_list();
    when 'liveticker_graphic_template_save' then return app_private.api_liveticker_graphic_template_save(coalesce(p_payload,'{}'::jsonb));
    else return app_private.pd_api_dispatch_current_before_liveticker_graphic_templates_prod_r1(p_action,p_payload);
  end case;
end;
$function$;
revoke all on function app_private.pd_api_dispatch_current_before_m340_settings_templates_r1(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.platform_action_classification_before_liveticker_graphic_templa(p_action text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'fanbus_publishing_template_upload_authorize' then 'READ'
    when 'fanbus_publishing_template_preview_authorize' then 'READ'
    when 'fanbus_publishing_template_rollback' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m340_publishing_ux_templates(p_action)
  end;
$function$;
revoke all on function app_private.platform_action_classification_before_liveticker_graphic_templa(p_action text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.platform_action_classification_before_liveticker_graphics_prod_(p_action text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'fanbus_publishing_resolution_ensure' then 'USER_MUTATION'
    when 'fanbus_publishing_resolution_choose' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m340_auto_place_resolution(
      p_action
    )
  end;
$function$;
revoke all on function app_private.platform_action_classification_before_liveticker_graphics_prod_(p_action text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.platform_action_classification_before_liveticker_player_delete_(p_action text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select case lower(btrim(coalesce(p_action,''))) when 'worker_runtime_status' then 'READ' when 'worker_runtime_set' then 'USER_MUTATION' when 'liveticker_graphic_templates_list' then 'READ' when 'liveticker_graphic_template_save' then 'USER_MUTATION' else app_private.platform_action_classification_before_liveticker_graphic_templates_prod_r1(p_action) end;$function$;
revoke all on function app_private.platform_action_classification_before_liveticker_player_delete_(p_action text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.platform_action_classification_before_m340_publishing_slice1(p_action text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select case lower(btrim(coalesce(p_action,''))) when 'liveticker_output_templates_list' then 'READ' when 'liveticker_output_template_save' then 'USER_MUTATION' else app_private.platform_action_classification_before_liveticker_templates_prod_r1(p_action) end $function$;
revoke all on function app_private.platform_action_classification_before_m340_publishing_slice1(p_action text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.platform_action_classification_before_m340_publishing_slice3(p_action text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'fanbus_publishing_place_create' then 'USER_MUTATION'
    when 'fanbus_publishing_place_key_add' then 'USER_MUTATION'
    when 'fanbus_publishing_event_place_bind' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m340_publishing_slice1(
      p_action
    )
  end;
$function$;
revoke all on function app_private.platform_action_classification_before_m340_publishing_slice3(p_action text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.platform_action_classification_before_m340_publishing_slice5(p_action text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'fanbus_publishing_job_enqueue' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m340_publishing_slice3(
      p_action
    )
  end;
$function$;
revoke all on function app_private.platform_action_classification_before_m340_publishing_slice5(p_action text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.platform_action_classification_before_m340_publishing_ux_templa(p_action text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_team_logo_get' then 'READ'
    else app_private.platform_action_classification_before_liveticker_team_logo_upload_r1(p_action)
  end
$function$;
revoke all on function app_private.platform_action_classification_before_m340_publishing_ux_templa(p_action text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.platform_action_classification_before_m340_settings_templates_r(p_action text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_graphic_templates_list' then 'READ'
    when 'liveticker_graphic_template_save' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_liveticker_graphic_templates_prod_r1(p_action)
  end
$function$;
revoke all on function app_private.platform_action_classification_before_m340_settings_templates_r(p_action text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pd_liveticker_graphic_worker_claim_before_worker_control_r1()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_job app_modules.liveticker_graphic_jobs%rowtype; v_token uuid;
begin
  select * into v_job
  from app_modules.liveticker_graphic_jobs j
  where ((j.status='QUEUED' and j.available_at<=now()) or (j.status='PROCESSING' and j.claim_expires_at<now()))
    and j.attempt_count<5
  order by j.available_at,j.created_at,j.id
  for update skip locked
  limit 1;
  if not found then return jsonb_build_object('claimed',false); end if;
  v_token:=extensions.gen_random_uuid();
  update app_modules.liveticker_graphic_jobs
  set status='PROCESSING',attempt_count=v_job.attempt_count+1,
      claim_token=v_token,claimed_at=now(),claim_expires_at=now()+interval '10 minutes',
      updated_at=now(),revision=revision+1
  where id=v_job.id
  returning * into v_job;
  return jsonb_build_object('claimed',true,'job',jsonb_build_object(
    'jobId',v_job.id,'claimToken',v_job.claim_token,'environment','PROD',
    'attemptCount',v_job.attempt_count,'claimExpiresAt',v_job.claim_expires_at,
    'request',v_job.request_snapshot
  ));
end;
$function$;
revoke all on function public.pd_liveticker_graphic_worker_claim_before_worker_control_r1() from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pd_public_liveticker_complete_before_stale_revision_pt409_r1(p_event_id uuid, p_expected_revision integer, p_client_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_state app_modules.liveticker_game_states%rowtype; v_new integer; begin
 perform app_private.liveticker_require_operator(); perform app_private.liveticker_assert_supported_game(p_event_id);
 select * into v_state from app_modules.liveticker_game_states where event_id=p_event_id for update;
 if not found then if coalesce(p_expected_revision,0)<>0 then raise exception 'LIVETICKER_STALE_REVISION' using errcode='40001'; end if; insert into app_modules.liveticker_game_states(event_id,revision,minute) values(p_event_id,0,1) returning * into v_state;
 elsif p_expected_revision is null or v_state.revision<>p_expected_revision then raise exception 'LIVETICKER_STALE_REVISION' using errcode='40001'; end if;
 if v_state.completed_at is null then v_new:=v_state.revision+1; update app_modules.liveticker_game_states set revision=v_new,completed_at=now(),updated_at=now() where event_id=p_event_id; insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,client_id) values(p_event_id,v_new,'GAME_COMPLETED',nullif(btrim(p_client_id),'')); end if;
 return public.pd_public_liveticker_state(p_event_id);
end; $function$;
revoke all on function public.pd_public_liveticker_complete_before_stale_revision_pt409_r1(p_event_id uuid, p_expected_revision integer, p_client_id text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pd_public_liveticker_sync_before_stale_revision_pt409_dev_r1(p_event_id uuid, p_expected_revision integer, p_changes jsonb, p_client_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_state app_modules.liveticker_game_states%rowtype; v_item jsonb; v_id text; v_type text; v_min integer; v_new integer; v_changed boolean:=false; v_rows integer; begin
 perform app_private.liveticker_require_operator(); perform app_private.liveticker_assert_supported_game(p_event_id);
 if p_expected_revision is null or p_expected_revision<0 or p_changes is null or jsonb_typeof(p_changes)<>'object' or p_changes-array['upserts','deletes','minute']<>'{}'::jsonb or (p_client_id is not null and char_length(btrim(p_client_id)) not between 1 and 100) then raise exception 'LIVETICKER_INVALID_SYNC' using errcode='22023'; end if;
 select * into v_state from app_modules.liveticker_game_states where event_id=p_event_id for update;
 if not found then if p_expected_revision<>0 then raise exception 'LIVETICKER_STALE_REVISION' using errcode='40001'; end if; insert into app_modules.liveticker_game_states(event_id,revision,minute) values(p_event_id,0,1) returning * into v_state;
 elsif v_state.revision<>p_expected_revision then raise exception 'LIVETICKER_STALE_REVISION' using errcode='40001'; end if;
 if v_state.completed_at is not null then raise exception 'LIVETICKER_GAME_COMPLETED' using errcode='55000'; end if;
 v_new:=v_state.revision+1;
 if p_changes?'minute' then begin v_min:=(p_changes->>'minute')::integer; exception when others then raise exception 'LIVETICKER_INVALID_MINUTE' using errcode='22023'; end; if v_min not between 1 and 200 then raise exception 'LIVETICKER_INVALID_MINUTE' using errcode='22023'; end if; if v_min<>v_state.minute then update app_modules.liveticker_game_states set minute=v_min where event_id=p_event_id; insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,payload,client_id) values(p_event_id,v_new,'MINUTE_SET',jsonb_build_object('minute',v_min),nullif(btrim(p_client_id),'')); v_changed:=true; end if; end if;
 if p_changes?'upserts' then
  if jsonb_typeof(p_changes->'upserts')<>'array' or jsonb_array_length(p_changes->'upserts')>20 then raise exception 'LIVETICKER_INVALID_UPSERTS' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_changes->'upserts') loop
   if jsonb_typeof(v_item)<>'object' or jsonb_typeof(v_item->'id')<>'string' or jsonb_typeof(v_item->'type')<>'string' or octet_length(v_item::text)>20000 then raise exception 'LIVETICKER_INVALID_ACTION' using errcode='22023'; end if;
   v_id:=v_item->>'id';v_type:=v_item->>'type'; if v_id!~'^[A-Za-z0-9._:-]{1,100}$' or v_type not in ('goal','penalty','shootout') then raise exception 'LIVETICKER_INVALID_ACTION' using errcode='22023'; end if;
   if v_type in ('goal','penalty') then begin v_min:=(v_item->>'minute')::integer; exception when others then raise exception 'LIVETICKER_INVALID_ACTION_MINUTE' using errcode='22023'; end; if v_min not between 1 and 200 then raise exception 'LIVETICKER_INVALID_ACTION_MINUTE' using errcode='22023'; end if; end if;
   if v_type='goal' and coalesce(v_item->>'team','') not in ('mighty','opponent') then raise exception 'LIVETICKER_INVALID_GOAL' using errcode='22023'; end if;
   if v_type='shootout' and (coalesce(v_item->>'team','') not in ('mighty','opponent') or coalesce(v_item->>'result','') not in ('scored','missed')) then raise exception 'LIVETICKER_INVALID_SHOOTOUT' using errcode='22023'; end if;
   if v_type='penalty' and (jsonb_typeof(v_item->'penalties')<>'array' or jsonb_array_length(v_item->'penalties') not between 1 and 8) then raise exception 'LIVETICKER_INVALID_PENALTY' using errcode='22023'; end if;
   insert into app_modules.liveticker_actions(event_id,client_action_id,action_type,payload,is_active) values(p_event_id,v_id,v_type,v_item,true) on conflict(event_id,client_action_id) do update set action_type=excluded.action_type,payload=excluded.payload,is_active=true,revision=app_modules.liveticker_actions.revision+1,updated_at=now();
   insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,client_action_id,payload,client_id) values(p_event_id,v_new,'ACTION_UPSERT',v_id,v_item,nullif(btrim(p_client_id),'')); v_changed:=true;
  end loop;
 end if;
 if p_changes?'deletes' then
  if jsonb_typeof(p_changes->'deletes')<>'array' or jsonb_array_length(p_changes->'deletes')>50 then raise exception 'LIVETICKER_INVALID_DELETES' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_changes->'deletes') loop
   if jsonb_typeof(v_item)<>'string' then raise exception 'LIVETICKER_INVALID_DELETE' using errcode='22023'; end if; v_id:=trim(both '"' from v_item::text); if v_id!~'^[A-Za-z0-9._:-]{1,100}$' then raise exception 'LIVETICKER_INVALID_DELETE' using errcode='22023'; end if;
   update app_modules.liveticker_actions set is_active=false,revision=revision+1,updated_at=now() where event_id=p_event_id and client_action_id=v_id and is_active; get diagnostics v_rows=row_count;
   if v_rows>0 then insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,client_action_id,client_id) values(p_event_id,v_new,'ACTION_REMOVE',v_id,nullif(btrim(p_client_id),'')); v_changed:=true; end if;
  end loop;
 end if;
 if v_changed then update app_modules.liveticker_game_states set revision=v_new,updated_at=now() where event_id=p_event_id; end if;
 return public.pd_public_liveticker_state(p_event_id);
end; $function$;
revoke all on function public.pd_public_liveticker_sync_before_stale_revision_pt409_dev_r1(p_event_id uuid, p_expected_revision integer, p_changes jsonb, p_client_id text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_liveticker_prod_r1(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
begin
  if v_action = 'fanbus_duplicate_review_resolve' then
    return app_private.api_fanbus_duplicate_review_resolve(coalesce(p_payload, '{}'::jsonb));
  end if;
  return app_private.pd_api_dispatch_current_before_fanbus_duplicate_review_r1(p_action, p_payload);
end;
$function$;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_prod_r1(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.pd_api_dispatch_current_before_liveticker_templates_prod_r1(p_action text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare v_action text:=lower(btrim(coalesce(p_action,''))); begin
 case v_action
  when 'liveticker_teams_list' then return app_private.api_liveticker_teams_list();
  when 'liveticker_team_save' then return app_private.api_liveticker_team_save(coalesce(p_payload,'{}'::jsonb));
  when 'liveticker_player_save' then return app_private.api_liveticker_player_save(coalesce(p_payload,'{}'::jsonb));
  when 'liveticker_archive_list' then return app_private.api_liveticker_archive_list();
  when 'liveticker_game_reset' then return app_private.api_liveticker_game_reset(coalesce(p_payload,'{}'::jsonb));
  else return app_private.pd_api_dispatch_current_before_liveticker_prod_r1(p_action,p_payload);
 end case;
end; $function$;
revoke all on function app_private.pd_api_dispatch_current_before_liveticker_templates_prod_r1(p_action text, p_payload jsonb) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.platform_action_classification_before_liveticker_prod_r1(p_action text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select case lower(btrim(coalesce(p_action, '')))
    when 'fanbus_duplicate_review_resolve' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_fanbus_duplicate_review_r1(p_action)
  end;
$function$;
revoke all on function app_private.platform_action_classification_before_liveticker_prod_r1(p_action text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.platform_action_classification_before_liveticker_templates_prod(p_action text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ select case lower(btrim(coalesce(p_action,''))) when 'liveticker_teams_list' then 'READ' when 'liveticker_archive_list' then 'READ' when 'liveticker_team_save' then 'USER_MUTATION' when 'liveticker_player_save' then 'USER_MUTATION' when 'liveticker_game_reset' then 'USER_MUTATION' else app_private.platform_action_classification_before_liveticker_prod_r1(p_action) end; $function$;
revoke all on function app_private.platform_action_classification_before_liveticker_templates_prod(p_action text) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pd_public_fanbus_trip_before_m328_completion(p_trip_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
revoke all on function public.pd_public_fanbus_trip_before_m328_completion(p_trip_id uuid) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pd_public_fanbus_trip_boarding_stops_before_m328_completion(p_trip_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'stops',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', trip_stop.id,
          'tripBoardingStopId', trip_stop.id,
          'boardingStopId', trip_stop.boarding_stop_id,
          'label', stop.label,
          'address', stop.address,
          'departureAt', trip_stop.departure_at,
          'tripNote', trip_stop.trip_note,
          'position', trip_stop.position
        )
        order by trip_stop.position, trip_stop.id
      )
      from app_modules.fanbus_trip_boarding_stops as trip_stop
      join app_modules.fanbus_boarding_stops as stop
        on stop.id = trip_stop.boarding_stop_id
      join app_modules.fanbus_trips as trip on trip.id = trip_stop.trip_id
      join app_modules.events as event on event.id = trip.event_id
      where trip_stop.trip_id = p_trip_id
        and trip_stop.is_active
        and trip.status in ('PUBLISHED', 'CANCELLED')
        and event.visibility = 'PUBLIC'
        and event.event_date >= (statement_timestamp() at time zone 'Europe/Berlin')::date
    ), '[]'::jsonb)
  );
$function$;
revoke all on function public.pd_public_fanbus_trip_boarding_stops_before_m328_completion(p_trip_id uuid) from public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.pd_public_fanbus_trips_before_m328_completion()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
revoke all on function public.pd_public_fanbus_trips_before_m328_completion() from public, anon, authenticated, service_role;

drop function if exists app_private.api_bootstrap_before_liveticker_nav_r1();
drop function if exists app_private.liveticker_require_public_dev();
drop function if exists app_private.pd_api_dispatch_current_before_liveticker_archive_r1(p_action text, p_payload jsonb);
drop function if exists app_private.pd_api_dispatch_current_before_liveticker_output_templates_r1(p_action text, p_payload jsonb);
drop function if exists app_private.pd_api_dispatch_current_before_liveticker_teams_r1(p_action text, p_payload jsonb);
drop function if exists app_private.platform_action_classification_before_liveticker_archive_r1(p_action text);
drop function if exists app_private.platform_action_classification_before_liveticker_teams_r1(p_action text);
drop function if exists app_private.platform_action_classification_before_lt_templates_r1(p_action text);
drop function if exists public.pd_public_liveticker_games_before_archive_r1();
drop function if exists public.pd_public_liveticker_state_before_archive_r1(p_event_id uuid);
drop function if exists public.pd_public_liveticker_sync_before_archive_r1(p_event_id uuid, p_expected_revision integer, p_changes jsonb, p_client_id text);

commit;
