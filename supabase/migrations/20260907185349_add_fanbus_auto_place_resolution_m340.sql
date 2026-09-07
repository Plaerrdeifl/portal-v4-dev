-- Plaerrdeifl Digitalplattform V4
-- M340: automatische, interne Zielort-/Kurzlink-Aufloesung

begin;

-- Vollstaendige interne Quelle fuer bekannte Aliasentscheidungen. Eine
-- Regel ist entweder eindeutig kanonisch oder ausdruecklich mehrdeutig.
-- Unbekannte Keys besitzen keine Regel und werden automatisch angelegt.
create table app_modules.fanbus_publishing_resolution_aliases (
  alias_place_key text primary key,
  resolution_kind text not null,
  canonical_place_key text,
  canonical_slug text,
  canonical_display_name text,
  created_at timestamptz not null default now(),
  constraint fanbus_publishing_resolution_aliases_alias_key_check
    check (alias_place_key ~ '^v1:[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint fanbus_publishing_resolution_aliases_kind_check
    check (resolution_kind in ('CANONICAL', 'AMBIGUOUS')),
  constraint fanbus_publishing_resolution_aliases_shape_check
    check (
      (
        resolution_kind = 'CANONICAL'
        and canonical_place_key is not null
        and canonical_place_key ~ '^v1:[a-z0-9]+(-[a-z0-9]+)*$'
        and canonical_slug is not null
        and char_length(canonical_slug) between 1 and 48
        and canonical_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        and canonical_display_name is not null
        and char_length(btrim(canonical_display_name)) between 1 and 160
      )
      or (
        resolution_kind = 'AMBIGUOUS'
        and canonical_place_key is null
        and canonical_slug is null
        and canonical_display_name is null
      )
    ),
  unique (alias_place_key, resolution_kind)
);

create index fanbus_publishing_resolution_aliases_canonical_key_idx
  on app_modules.fanbus_publishing_resolution_aliases(canonical_place_key)
  where resolution_kind = 'CANONICAL';

-- Kandidaten koennen ausschliesslich zu einer expliziten AMBIGUOUS-Regel
-- gehoeren; ein loses manuelles Befuellen ohne Konfliktregel ist unmoeglich.
create table app_modules.fanbus_publishing_alias_candidates (
  alias_place_key text not null,
  resolution_kind text not null default 'AMBIGUOUS',
  place_id uuid not null
    references app_modules.fanbus_publishing_places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (alias_place_key, place_id),
  constraint fanbus_publishing_alias_candidates_key_check
    check (alias_place_key ~ '^v1:[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint fanbus_publishing_alias_candidates_kind_check
    check (resolution_kind = 'AMBIGUOUS'),
  constraint fanbus_publishing_alias_candidates_rule_fk
    foreign key (alias_place_key, resolution_kind)
    references app_modules.fanbus_publishing_resolution_aliases(
      alias_place_key,
      resolution_kind
    )
    on delete cascade
);

create index fanbus_publishing_alias_candidates_place_idx
  on app_modules.fanbus_publishing_alias_candidates(place_id, alias_place_key);

create function app_private.fanbus_publishing_assert_resolution_rule(
  p_alias_place_key text
)
returns void
language plpgsql
volatile
set search_path = ''
as $function$
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

create function app_private.fanbus_publishing_resolution_rule_constraint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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

create constraint trigger fanbus_publishing_resolution_aliases_complete
after insert or update or delete
on app_modules.fanbus_publishing_resolution_aliases
deferrable initially deferred
for each row
execute function app_private.fanbus_publishing_resolution_rule_constraint();

create constraint trigger fanbus_publishing_alias_candidates_complete
after insert or update or delete
on app_modules.fanbus_publishing_alias_candidates
deferrable initially deferred
for each row
execute function app_private.fanbus_publishing_resolution_rule_constraint();

alter table app_modules.fanbus_publishing_resolution_aliases
  enable row level security;
alter table app_modules.fanbus_publishing_alias_candidates
  enable row level security;

revoke all on table
  app_modules.fanbus_publishing_resolution_aliases,
  app_modules.fanbus_publishing_alias_candidates
from public, anon, authenticated, service_role;

insert into app_modules.fanbus_publishing_resolution_aliases (
  alias_place_key,
  resolution_kind,
  canonical_place_key,
  canonical_slug,
  canonical_display_name
)
values (
  'v1:landsberg-am-lech',
  'CANONICAL',
  'v1:landsberg',
  'landsberg',
  'Landsberg'
);

create function app_private.fanbus_publishing_slug_for_key(p_place_key text)
returns text
language plpgsql
immutable
set search_path = ''
as $function$
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

create function app_private.fanbus_publishing_clean_venue(p_venue text)
returns text
language sql
immutable
set search_path = ''
as $function$
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

-- Read-only Projektion desselben deterministischen Entscheiders fuer das
-- Portal. Technische Keys und Slugs werden nicht ausgegeben.
create function app_private.fanbus_publishing_event_place_status(
  p_event_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
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

-- Atomarer Ensure-Resolver. Bekannte Aliasregeln gewinnen bewusst vor einem
-- eventuell historisch falsch angelegten exakten Alias-Key.
create function app_private.fanbus_publishing_ensure_event_place(
  p_event_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
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

-- Bestehende veroeffentlichte Fanbusfahrten werden beim spaeteren Anwenden
-- derselben deterministischen Regel unterzogen. Es werden keine Realdaten
-- geseedet; vorhandene Events sind lediglich die Quelle.
do $m340_auto_place_backfill$
declare
  v_event record;
begin
  for v_event in
    select trip.event_id
    from app_modules.fanbus_trips as trip
    join app_modules.events as event
      on event.id = trip.event_id
     and event.visibility = 'PUBLIC'
    where trip.status = 'PUBLISHED'
    order by trip.event_id
  loop
    perform app_private.fanbus_publishing_ensure_event_place(
      v_event.event_id,
      null
    );
  end loop;
end
$m340_auto_place_backfill$;

create function app_private.api_fanbus_publishing_resolution_ensure(
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
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

create function app_private.api_fanbus_publishing_resolution_choose(
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
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

-- Enqueue bleibt fachlich unveraendert, stellt aber vor dem bestehenden
-- Snapshot-/Queue-Vertrag zwingend die automatische Ortsaufloesung sicher.
alter function app_private.api_fanbus_publishing_job_enqueue(jsonb)
  rename to api_fanbus_publishing_job_enqueue_before_auto_place_resolution;

create function app_private.api_fanbus_publishing_job_enqueue(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_trip_id uuid;
  v_event_id uuid;
  v_resolution jsonb;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['tripId']::text[] <> '{}'::jsonb
     or not p_payload ? 'tripId' then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  begin
    v_trip_id := nullif(pg_catalog.btrim(p_payload ->> 'tripId'), '')::uuid;
  exception when others then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD'
      using errcode = '22023';
  end;

  select trip.event_id
    into v_event_id
  from app_modules.fanbus_trips as trip
  where trip.id = v_trip_id
    and trip.status = 'PUBLISHED';
  if not found then
    raise exception 'M340_PUBLISHING_TRIP_NOT_ELIGIBLE'
      using errcode = 'P0002';
  end if;

  v_resolution := app_private.fanbus_publishing_ensure_event_place(
    v_event_id,
    v_actor
  );

  case v_resolution ->> 'status'
    when 'AMBIGUOUS' then
      raise exception 'M340_PUBLISHING_PLACE_AMBIGUOUS'
        using errcode = '55000';
    when 'MISSING_VENUE' then
      raise exception 'M340_PUBLISHING_VENUE_MISSING'
        using errcode = '22023';
    when 'RESOLVED' then
      null;
    else
      raise exception 'M340_PUBLISHING_PLACE_UNRESOLVED'
        using errcode = '55000';
  end case;

  return app_private.api_fanbus_publishing_job_enqueue_before_auto_place_resolution(
    p_payload
  );
end;
$function$;

-- Das user-facing Readmodell enthaelt keine technische Place-Verwaltung mehr.
create or replace function app_private.api_fanbus_publishing_overview(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_trips jsonb := '[]'::jsonb;
  v_jobs jsonb := '[]'::jsonb;
  v_daily jsonb := '[]'::jsonb;
  v_landing_count bigint := 0;
  v_referral_count bigint := 0;
begin
  perform app_private.require_capability('fanbus.publishing.manage');

  if coalesce(p_payload, '{}'::jsonb) <> '{}'::jsonb then
    raise exception 'M340_PUBLISHING_OVERVIEW_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;
  if v_environment is null then
    raise exception 'M340_PUBLISHING_ENVIRONMENT_UNAVAILABLE'
      using errcode = '55000';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tripId', trip.id,
        'eventId', trip.event_id,
        'displayTitle', projection.value ->> 'displayTitle',
        'eventDate', projection.value ->> 'eventDate',
        'eventTime', projection.value ->> 'eventTime',
        'venue', projection.value ->> 'venue',
        'registrationStatus', projection.value ->> 'registrationStatus',
        'resolutionStatus', resolution.value ->> 'status',
        'shortlinkPath', resolution.value -> 'shortlinkPath',
        'resolutionCandidates', resolution.value -> 'candidates',
        'lastJob', case
          when latest_job.id is null then null
          else jsonb_build_object(
            'id', latest_job.id,
            'status', latest_job.status,
            'attemptCount', latest_job.attempt_count,
            'createdAt', latest_job.created_at,
            'completedAt', latest_job.completed_at,
            'lastErrorCode', latest_job.last_error_code
          )
        end
      )
      order by
        (projection.value ->> 'eventDate')::date,
        nullif(projection.value ->> 'eventTime', '')::time asc nulls last,
        trip.id
    ),
    '[]'::jsonb
  )
  into v_trips
  from jsonb_array_elements(
    coalesce(public.pd_public_fanbus_trips() -> 'trips', '[]'::jsonb)
  ) as projection(value)
  join app_modules.fanbus_trips as trip
    on trip.id = (projection.value ->> 'tripId')::uuid
  cross join lateral (
    select app_private.fanbus_publishing_event_place_status(
      trip.event_id
    ) as value
  ) as resolution
  left join lateral (
    select job.*
    from app_modules.fanbus_publishing_jobs as job
    where job.environment = v_environment
      and job.trip_id = trip.id
    order by job.created_at desc, job.id desc
    limit 1
  ) as latest_job on true
  where projection.value ->> 'tripStatus' = 'PUBLISHED';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', history.id,
        'tripId', history.trip_id,
        'eventId', history.event_id,
        'displayTitle', history.display_title,
        'eventDate', history.event_date,
        'shortlinkPath', history.shortlink_path,
        'jobType', history.job_type,
        'status', history.status,
        'attemptCount', history.attempt_count,
        'createdAt', history.created_at,
        'completedAt', history.completed_at,
        'lastErrorCode', history.last_error_code,
        'resultManifest', history.result_manifest
      )
      order by history.created_at desc, history.id desc
    ),
    '[]'::jsonb
  )
  into v_jobs
  from (
    select
      job.id,
      job.trip_id,
      job.event_id,
      job.request_snapshot #>> '{trip,displayTitle}' as display_title,
      job.request_snapshot #>> '{trip,eventDate}' as event_date,
      job.request_snapshot ->> 'shortlinkPath' as shortlink_path,
      job.job_type,
      job.status,
      job.attempt_count,
      job.created_at,
      job.completed_at,
      job.last_error_code,
      job.result_manifest
    from app_modules.fanbus_publishing_jobs as job
    where job.environment = v_environment
    order by job.created_at desc, job.id desc
    limit 50
  ) as history;

  select coalesce(sum(daily.landing_count), 0)
    into v_landing_count
  from app_modules.fanbus_publishing_place_landing_daily as daily;

  select coalesce(sum(daily.referral_count), 0)
    into v_referral_count
  from app_modules.fanbus_publishing_trip_referral_daily as daily;

  with days as (
    select generate_series(
      app_private.fanbus_publishing_berlin_day(statement_timestamp()) - 29,
      app_private.fanbus_publishing_berlin_day(statement_timestamp()),
      interval '1 day'
    )::date as day
  ),
  landings as (
    select daily.day, sum(daily.landing_count)::bigint as count
    from app_modules.fanbus_publishing_place_landing_daily as daily
    where daily.day >=
      app_private.fanbus_publishing_berlin_day(statement_timestamp()) - 29
    group by daily.day
  ),
  referrals as (
    select daily.day, sum(daily.referral_count)::bigint as count
    from app_modules.fanbus_publishing_trip_referral_daily as daily
    where daily.day >=
      app_private.fanbus_publishing_berlin_day(statement_timestamp()) - 29
    group by daily.day
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'day', days.day,
        'landingCount', coalesce(landings.count, 0),
        'referralCount', coalesce(referrals.count, 0)
      )
      order by days.day
    ),
    '[]'::jsonb
  )
  into v_daily
  from days
  left join landings on landings.day = days.day
  left join referrals on referrals.day = days.day;

  return jsonb_build_object(
    'environment', v_environment,
    'trips', v_trips,
    'jobs', v_jobs,
    'stats', jsonb_build_object(
      'landingCount', v_landing_count,
      'referralCount', v_referral_count,
      'daily', v_daily
    )
  );
end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_m340_auto_place_resolution;

create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_m340_auto_place_resolution;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'fanbus_publishing_resolution_ensure' then 'USER_MUTATION'
    when 'fanbus_publishing_resolution_choose' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m340_auto_place_resolution(
      p_action
    )
  end;
$function$;

revoke all on function
  app_private.fanbus_publishing_assert_resolution_rule(text),
  app_private.fanbus_publishing_resolution_rule_constraint(),
  app_private.fanbus_publishing_slug_for_key(text),
  app_private.fanbus_publishing_clean_venue(text),
  app_private.fanbus_publishing_event_place_status(uuid),
  app_private.fanbus_publishing_ensure_event_place(uuid, uuid),
  app_private.api_fanbus_publishing_resolution_ensure(jsonb),
  app_private.api_fanbus_publishing_resolution_choose(jsonb),
  app_private.api_fanbus_publishing_overview(jsonb),
  app_private.api_fanbus_publishing_job_enqueue_before_auto_place_resolution(jsonb),
  app_private.api_fanbus_publishing_job_enqueue(jsonb),
  app_private.pd_api_dispatch_current_before_m340_auto_place_resolution(text, jsonb),
  app_private.platform_action_classification_before_m340_auto_place_resolution(text)
from public, anon, authenticated, service_role;

revoke all on function app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

revoke all on function app_private.platform_action_classification(text)
from public, anon, authenticated, service_role;

comment on table app_modules.fanbus_publishing_resolution_aliases is
  'Interne M340-Regelquelle: ein Venue-Key ist entweder CANONICAL oder explizit AMBIGUOUS.';

comment on table app_modules.fanbus_publishing_alias_candidates is
  'Interne Kandidaten ausschliesslich fuer explizite AMBIGUOUS-Regeln; keine Portal-Verwaltungsoberflaeche.';

comment on function app_private.fanbus_publishing_ensure_event_place(uuid, uuid) is
  'Atomare und idempotente M340-Aufloesung Event-Venue zu dauerhaftem internem Publishing-Place.';

commit;
