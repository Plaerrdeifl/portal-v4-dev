-- Plaerrdeifl Digitalplattform V4
-- M340 / F4 DEV / Slice 1: dauerhaftes Place-, Shortlink- und Tracking-Fundament

begin;

-- ============================================================
-- 1. Autorisierung: eigene Capability und BUS_ORGA-Teamfunktion
-- ============================================================

insert into app_portal.capabilities (
  code,
  name,
  category,
  description,
  is_active,
  sort_order
)
values (
  'fanbus.publishing.manage',
  'Fanbus-Publishing verwalten',
  'Fanbus',
  'Dauerhafte Fanbus-Ortslinks, Ortsbindungen und spaetere Publishing-Abläufe verwalten.',
  true,
  240
)
on conflict (code) do update
set
  name = excluded.name,
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
  'BUS_PUBLISHING',
  'Fanbus-Publishing',
  'Dauerhafte Ortslinks und die Zuordnung von Veranstaltungen zu Publishing-Orten verwalten.',
  true
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

do $m340_bus_orga$
begin
  if not exists (
    select 1
    from app_portal.teams
    where code = 'BUS_ORGA'
      and is_active
  ) then
    raise exception 'M340_BUS_ORGA_TEAM_MISSING'
      using errcode = 'P0002';
  end if;
end
$m340_bus_orga$;

insert into app_portal.team_function_capabilities (
  team_id,
  function_code,
  capability_code,
  is_active,
  created_by
)
select
  team.id,
  'BUS_PUBLISHING',
  'fanbus.publishing.manage',
  true,
  null
from app_portal.teams as team
where team.code = 'BUS_ORGA'
  and team.is_active
on conflict (team_id, function_code, capability_code) do update
set is_active = true;

-- ============================================================
-- 2. Dauerhafte Places, Venue-Keys und Event-Bindungen
-- ============================================================

create table app_modules.fanbus_publishing_places (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  slug_locked boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  revision integer not null default 1,
  constraint fanbus_publishing_places_slug_check
    check (
      char_length(slug) between 1 and 48
      and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ),
  constraint fanbus_publishing_places_display_name_check
    check (char_length(btrim(display_name)) between 1 and 160),
  constraint fanbus_publishing_places_revision_check
    check (revision > 0)
);

create table app_modules.fanbus_publishing_place_keys (
  place_id uuid not null
    references app_modules.fanbus_publishing_places(id) on delete restrict,
  place_key text primary key,
  source_label text,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_publishing_place_keys_format_check
    check (place_key ~ '^v1:[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint fanbus_publishing_place_keys_source_label_check
    check (
      source_label is null
      or char_length(btrim(source_label)) between 1 and 240
    ),
  unique (place_id, place_key)
);

create index fanbus_publishing_place_keys_place_idx
  on app_modules.fanbus_publishing_place_keys(place_id, place_key);

create table app_modules.fanbus_publishing_event_places (
  event_id uuid primary key
    references app_modules.events(id) on delete cascade,
  place_id uuid not null,
  bound_place_key text not null,
  created_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_publishing_event_places_bound_key_fk
    foreign key (place_id, bound_place_key)
    references app_modules.fanbus_publishing_place_keys(place_id, place_key)
    on delete restrict
);

create index fanbus_publishing_event_places_place_idx
  on app_modules.fanbus_publishing_event_places(place_id, event_id);

-- ============================================================
-- 3. Ausschliesslich anonyme Tagesaggregate
-- ============================================================

create table app_modules.fanbus_publishing_place_landing_daily (
  place_id uuid not null
    references app_modules.fanbus_publishing_places(id) on delete restrict,
  day date not null,
  landing_count bigint not null default 0,
  primary key (place_id, day),
  constraint fanbus_publishing_place_landing_daily_count_check
    check (landing_count >= 0)
);

create table app_modules.fanbus_publishing_trip_referral_daily (
  place_id uuid not null
    references app_modules.fanbus_publishing_places(id) on delete restrict,
  trip_id uuid not null
    references app_modules.fanbus_trips(id) on delete restrict,
  day date not null,
  referral_count bigint not null default 0,
  primary key (place_id, trip_id, day),
  constraint fanbus_publishing_trip_referral_daily_count_check
    check (referral_count >= 0)
);

alter table app_modules.fanbus_publishing_places enable row level security;
alter table app_modules.fanbus_publishing_place_keys enable row level security;
alter table app_modules.fanbus_publishing_event_places enable row level security;
alter table app_modules.fanbus_publishing_place_landing_daily enable row level security;
alter table app_modules.fanbus_publishing_trip_referral_daily enable row level security;

revoke all on table
  app_modules.fanbus_publishing_places,
  app_modules.fanbus_publishing_place_keys,
  app_modules.fanbus_publishing_event_places,
  app_modules.fanbus_publishing_place_landing_daily,
  app_modules.fanbus_publishing_trip_referral_daily
from public, anon, authenticated, service_role;

create trigger fanbus_publishing_places_set_updated_at
before update on app_modules.fanbus_publishing_places
for each row execute function app_private.set_updated_at();

create trigger fanbus_publishing_event_places_set_updated_at
before update on app_modules.fanbus_publishing_event_places
for each row execute function app_private.set_updated_at();

-- ============================================================
-- 4. Verbindliche Place-Normalisierung V1 und Slug-Lock
-- ============================================================

create function app_private.fanbus_publishing_normalize_place_key(p_value text)
returns text
language sql
immutable
set search_path = ''
as $function$
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

create function app_private.fanbus_publishing_berlin_day(p_at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $function$
  select (p_at at time zone 'Europe/Berlin')::date;
$function$;

create function app_private.fanbus_publishing_guard_locked_slug()
returns trigger
language plpgsql
set search_path = ''
as $function$
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

create trigger fanbus_publishing_places_guard_locked_slug
before update of slug, slug_locked
on app_modules.fanbus_publishing_places
for each row execute function app_private.fanbus_publishing_guard_locked_slug();

-- ============================================================
-- 5. Kontrollierte Verwaltungsfunktionen
-- ============================================================

create function app_private.api_fanbus_publishing_place_create(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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

create function app_private.api_fanbus_publishing_place_key_add(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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

create function app_private.api_fanbus_publishing_event_place_bind(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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

-- ============================================================
-- 6. Autoritative oeffentliche Fahrtprojektion fuer einen Place
-- ============================================================

create function app_private.fanbus_publishing_open_trips(p_place_id uuid)
returns table (
  trip_id uuid,
  event_date date,
  event_time time without time zone,
  departure_at timestamptz,
  projection jsonb
)
language sql
stable
security definer
set search_path = ''
as $function$
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

create function app_private.fanbus_publishing_record_place_landing(
  p_place_id uuid,
  p_at timestamptz
)
returns void
language sql
volatile
security definer
set search_path = ''
as $function$
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

create function app_private.fanbus_publishing_record_trip_referral(
  p_place_id uuid,
  p_trip_id uuid,
  p_at timestamptz
)
returns void
language sql
volatile
security definer
set search_path = ''
as $function$
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

-- ============================================================
-- 7. Oeffentlicher Resolver und separates Referral-Tracking
-- ============================================================

create function public.pd_public_fanbus_ontour_resolve(p_slug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
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

create function public.pd_public_fanbus_trip_referral_track(
  p_slug text,
  p_trip_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
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

-- ============================================================
-- 8. Einbindung in die bestehende Portal-API
-- ============================================================

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_m340_publishing_slice1;

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

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_m340_publishing_slice1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'fanbus_publishing_place_create' then 'USER_MUTATION'
    when 'fanbus_publishing_place_key_add' then 'USER_MUTATION'
    when 'fanbus_publishing_event_place_bind' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m340_publishing_slice1(
      p_action
    )
  end;
$function$;

-- ============================================================
-- 9. Explizite Funktionsrechte
-- ============================================================

revoke all on function
  app_private.fanbus_publishing_normalize_place_key(text),
  app_private.fanbus_publishing_berlin_day(timestamptz),
  app_private.fanbus_publishing_guard_locked_slug(),
  app_private.api_fanbus_publishing_place_create(jsonb),
  app_private.api_fanbus_publishing_place_key_add(jsonb),
  app_private.api_fanbus_publishing_event_place_bind(jsonb),
  app_private.fanbus_publishing_open_trips(uuid),
  app_private.fanbus_publishing_record_place_landing(uuid, timestamptz),
  app_private.fanbus_publishing_record_trip_referral(uuid, uuid, timestamptz),
  app_private.pd_api_dispatch_current_before_m340_publishing_slice1(text, jsonb),
  app_private.platform_action_classification_before_m340_publishing_slice1(text)
from public, anon, authenticated, service_role;

revoke all on function app_private.pd_api_dispatch_current(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function app_private.platform_action_classification(text)
  from public, anon, authenticated, service_role;

revoke all on function public.pd_public_fanbus_ontour_resolve(text)
  from public, anon, authenticated, service_role;
revoke all on function public.pd_public_fanbus_trip_referral_track(text, uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.pd_public_fanbus_ontour_resolve(text)
  to anon, authenticated;
grant execute on function public.pd_public_fanbus_trip_referral_track(text, uuid)
  to anon, authenticated;

comment on table app_modules.fanbus_publishing_places is
  'M340 dauerhafte Orte fuer stabile /ontour/<slug>-Links; ein Place ist keine Fahrt.';
comment on table app_modules.fanbus_publishing_place_landing_daily is
  'M340 anonymes, tagesaggregiertes Place-Landing-Tracking ohne Request- oder Besuchermetadaten.';
comment on table app_modules.fanbus_publishing_trip_referral_daily is
  'M340 anonymes, tagesaggregiertes Referral-Tracking je konkreter Fahrt.';
comment on function public.pd_public_fanbus_ontour_resolve(text) is
  'M340 Resolver fuer dauerhafte Ortslinks mit SINGLE, MULTIPLE oder FALLBACK; zaehlt nur Place Landing best effort.';
comment on function public.pd_public_fanbus_trip_referral_track(text, uuid) is
  'M340 separates best-effort Trip-Referral-Tracking ohne Request-Metadaten.';

commit;
