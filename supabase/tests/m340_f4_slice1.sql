\set ON_ERROR_STOP on

begin;

do $m340_normalization$
begin
  if app_private.fanbus_publishing_normalize_place_key('  Bad Tölz  ') <> 'v1:bad-toelz' then
    raise exception 'M340 V1 trim/lower/ö normalization failed';
  end if;
  if app_private.fanbus_publishing_normalize_place_key('Ärger über Größe') <> 'v1:aerger-ueber-groesse' then
    raise exception 'M340 V1 ä/ü/ß normalization failed';
  end if;
  if app_private.fanbus_publishing_normalize_place_key(' -- Landsberg / am   Lech -- ') <> 'v1:landsberg-am-lech' then
    raise exception 'M340 V1 separator normalization failed';
  end if;
  if app_private.fanbus_publishing_normalize_place_key('---') is not null then
    raise exception 'M340 empty normalized key must be null';
  end if;
  if app_private.fanbus_publishing_berlin_day('2026-01-01 22:59:59+00'::timestamptz) <> date '2026-01-01'
     or app_private.fanbus_publishing_berlin_day('2026-01-01 23:00:00+00'::timestamptz) <> date '2026-01-02'
     or app_private.fanbus_publishing_berlin_day('2026-07-01 21:59:59+00'::timestamptz) <> date '2026-07-01'
     or app_private.fanbus_publishing_berlin_day('2026-07-01 22:00:00+00'::timestamptz) <> date '2026-07-02' then
    raise exception 'M340 Europe/Berlin day boundary failed';
  end if;
  raise notice 'M340_NORMALIZATION_OK';
end
$m340_normalization$;

do $m340_constraints$
declare
  v_first uuid := '00000000-0000-4340-8100-000000000001';
  v_second uuid := '00000000-0000-4340-8100-000000000002';
begin
  begin
    insert into app_modules.fanbus_publishing_places(id, slug, display_name)
    values (v_first, '-ungueltig', 'Ungültig');
    raise exception 'Invalid slug was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into app_modules.fanbus_publishing_places(id, slug, display_name)
    values (v_first, repeat('a', 49), 'Zu lang');
    raise exception 'Overlong slug was accepted';
  exception when check_violation then null;
  end;

  insert into app_modules.fanbus_publishing_places(id, slug, display_name)
  values
    (v_first, 'constraint-place', 'Constraint Place'),
    (v_second, 'constraint-place-two', 'Constraint Place Two');

  begin
    insert into app_modules.fanbus_publishing_places(slug, display_name)
    values ('constraint-place', 'Duplikat');
    raise exception 'Duplicate slug was accepted';
  exception when unique_violation then null;
  end;
  begin
    update app_modules.fanbus_publishing_places
    set slug = 'changed-place'
    where id = v_first;
    raise exception 'Locked slug was changed';
  exception when sqlstate '55000' then null;
  end;

  insert into app_modules.fanbus_publishing_place_keys(place_id, place_key, source_label)
  values
    (v_first, 'v1:constraint-place', 'Constraint Place'),
    (v_first, 'v1:constraint-arena', 'Constraint Arena');
  if (select count(*) from app_modules.fanbus_publishing_place_keys where place_id = v_first) <> 2 then
    raise exception 'Multiple keys for one Place failed';
  end if;
  begin
    insert into app_modules.fanbus_publishing_place_keys(place_id, place_key, source_label)
    values (v_second, 'v1:constraint-place', 'Duplicate Key');
    raise exception 'Global duplicate place_key was accepted';
  exception when unique_violation then null;
  end;
  raise notice 'M340_CONSTRAINTS_OK';
end
$m340_constraints$;

insert into auth.users(id, email)
values ('00000000-0000-4340-8000-000000000001', 'm340-admin@example.invalid');

insert into app_portal.users(
  id, user_code, email, first_name, last_name, status, role_id
)
values (
  '00000000-0000-4340-8000-000000000001',
  'U-M340-ADMIN',
  'm340-admin@example.invalid',
  'M340',
  'Admin',
  'ACTIVE',
  '00000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4340-8000-000000000001',
  true
);

create temporary table m340_places (
  name text primary key,
  id uuid not null
) on commit drop;

insert into m340_places(name, id)
select 'single', (result #>> '{place,id}')::uuid
from (
  select app_private.api_fanbus_publishing_place_create(
    jsonb_build_object('slug', 'single-place', 'displayName', 'Single Place')
  ) as result
) as created;

insert into m340_places(name, id)
select 'multiple', (result #>> '{place,id}')::uuid
from (
  select app_private.api_fanbus_publishing_place_create(
    jsonb_build_object('slug', 'multiple-place', 'displayName', 'Multiple Place')
  ) as result
) as created;

insert into m340_places(name, id)
select 'fallback', (result #>> '{place,id}')::uuid
from (
  select app_private.api_fanbus_publishing_place_create(
    jsonb_build_object('slug', 'fallback-place', 'displayName', 'Fallback Place')
  ) as result
) as created;

select app_private.api_fanbus_publishing_place_key_add(jsonb_build_object(
  'placeId', (select id from m340_places where name = 'single'),
  'sourceLabel', 'Münnerstadt'
));
select app_private.api_fanbus_publishing_place_key_add(jsonb_build_object(
  'placeId', (select id from m340_places where name = 'single'),
  'sourceLabel', 'Münnerstadt Arena'
));
select app_private.api_fanbus_publishing_place_key_add(jsonb_build_object(
  'placeId', (select id from m340_places where name = 'multiple'),
  'sourceLabel', 'Bad Tölz'
));
select app_private.api_fanbus_publishing_place_key_add(jsonb_build_object(
  'placeId', (select id from m340_places where name = 'fallback'),
  'sourceLabel', 'Örtchen'
));

insert into app_modules.events(
  id, event_type, title, event_date, event_time, venue, visibility
)
values
  ('00000000-0000-4340-8200-000000000001', 'OTHER', 'Single', app_private.fanbus_publishing_berlin_day(statement_timestamp()) + 10, time '18:00', 'Münnerstadt', 'PUBLIC'),
  ('00000000-0000-4340-8200-000000000002', 'OTHER', 'Multiple später', app_private.fanbus_publishing_berlin_day(statement_timestamp()) + 20, time '18:00', 'Bad Tölz', 'PUBLIC'),
  ('00000000-0000-4340-8200-000000000003', 'OTHER', 'Multiple früher', app_private.fanbus_publishing_berlin_day(statement_timestamp()) + 15, time '19:00', 'Bad Tölz', 'PUBLIC'),
  ('00000000-0000-4340-8200-000000000004', 'OTHER', 'Fallback geschlossen', app_private.fanbus_publishing_berlin_day(statement_timestamp()) + 12, time '18:00', 'Örtchen', 'PUBLIC'),
  ('00000000-0000-4340-8200-000000000005', 'OTHER', 'Nicht öffentlich', app_private.fanbus_publishing_berlin_day(statement_timestamp()) + 13, time '18:00', 'Bad Tölz', 'INTERNAL'),
  ('00000000-0000-4340-8200-000000000006', 'OTHER', 'Noch nicht offen', app_private.fanbus_publishing_berlin_day(statement_timestamp()) + 14, time '18:00', 'Bad Tölz', 'PUBLIC'),
  ('00000000-0000-4340-8200-000000000007', 'OTHER', 'Entwurf', app_private.fanbus_publishing_berlin_day(statement_timestamp()) + 16, time '18:00', 'Bad Tölz', 'PUBLIC');

insert into app_modules.fanbus_trips(
  id,
  event_id,
  departure_at,
  departure_info,
  registration_opens_at,
  registration_closes_at,
  price_cents,
  capacity,
  privacy_reference,
  terms_reference,
  status
)
select
  fixture.trip_id,
  fixture.event_id,
  (event.event_date + time '12:00') at time zone 'Europe/Berlin',
  'M340 Testabfahrt',
  case
    when fixture.kind = 'NOT_STARTED' then statement_timestamp() + interval '1 day'
    else statement_timestamp() - interval '1 day'
  end,
  case
    when fixture.kind = 'CLOSED' then statement_timestamp() - interval '1 hour'
    else (event.event_date - 1 + time '20:00') at time zone 'Europe/Berlin'
  end,
  2500,
  20,
  'privacy-v1',
  'terms-v1',
  case when fixture.kind = 'DRAFT' then 'DRAFT' else 'PUBLISHED' end
from (
  values
    ('00000000-0000-4340-8300-000000000001'::uuid, '00000000-0000-4340-8200-000000000001'::uuid, 'OPEN'),
    ('00000000-0000-4340-8300-000000000002'::uuid, '00000000-0000-4340-8200-000000000002'::uuid, 'OPEN'),
    ('00000000-0000-4340-8300-000000000003'::uuid, '00000000-0000-4340-8200-000000000003'::uuid, 'OPEN'),
    ('00000000-0000-4340-8300-000000000004'::uuid, '00000000-0000-4340-8200-000000000004'::uuid, 'CLOSED'),
    ('00000000-0000-4340-8300-000000000005'::uuid, '00000000-0000-4340-8200-000000000005'::uuid, 'OPEN'),
    ('00000000-0000-4340-8300-000000000006'::uuid, '00000000-0000-4340-8200-000000000006'::uuid, 'NOT_STARTED'),
    ('00000000-0000-4340-8300-000000000007'::uuid, '00000000-0000-4340-8200-000000000007'::uuid, 'DRAFT')
) as fixture(trip_id, event_id, kind)
join app_modules.events as event on event.id = fixture.event_id;

insert into app_modules.fanbus_buses(
  id, trip_id, label, category, capacity, is_active
)
select
  ('00000000-0000-4340-8400-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
  ('00000000-0000-4340-8300-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
  'M340 Bus ' || value,
  'NORMAL',
  20,
  true
from generate_series(1, 7) as value;

select app_private.api_fanbus_publishing_event_place_bind(jsonb_build_object(
  'eventId', event.id,
  'placeId', case event.venue
    when 'Münnerstadt' then (select id from m340_places where name = 'single')
    when 'Bad Tölz' then (select id from m340_places where name = 'multiple')
    else (select id from m340_places where name = 'fallback')
  end
))
from app_modules.events as event
where event.id::text like '00000000-0000-4340-8200-%';

do $m340_binding$
declare
  v_place_id uuid := (select id from m340_places where name = 'single');
  v_key text;
begin
  select bound_place_key
    into v_key
  from app_modules.fanbus_publishing_event_places
  where event_id = '00000000-0000-4340-8200-000000000001';
  update app_modules.events
  set venue = 'Vollständig geänderter Anzeigetext'
  where id = '00000000-0000-4340-8200-000000000001';
  if not exists (
    select 1
    from app_modules.fanbus_publishing_event_places
    where event_id = '00000000-0000-4340-8200-000000000001'
      and place_id = v_place_id
      and bound_place_key = v_key
  ) then
    raise exception 'Venue edit changed persistent M340 binding';
  end if;
  raise notice 'M340_BINDING_OK';
end
$m340_binding$;

do $m340_resolver$
declare
  v_result jsonb;
begin
  v_result := public.pd_public_fanbus_ontour_resolve('missing-place');
  if v_result ->> 'mode' <> 'FALLBACK' then
    raise exception 'Missing Place did not resolve to FALLBACK';
  end if;
  v_result := public.pd_public_fanbus_ontour_resolve('fallback-place');
  if v_result ->> 'mode' <> 'FALLBACK' then
    raise exception 'Place without open trip did not resolve to FALLBACK';
  end if;
  v_result := public.pd_public_fanbus_ontour_resolve('single-place');
  if v_result ->> 'mode' <> 'SINGLE'
     or jsonb_array_length(v_result -> 'trips') <> 1
     or v_result #>> '{trips,0,tripId}' <> '00000000-0000-4340-8300-000000000001' then
    raise exception 'Single Place did not resolve deterministically to SINGLE';
  end if;
  v_result := public.pd_public_fanbus_ontour_resolve('multiple-place');
  if v_result ->> 'mode' <> 'MULTIPLE'
     or jsonb_array_length(v_result -> 'trips') <> 2
     or v_result #>> '{trips,0,tripId}' <> '00000000-0000-4340-8300-000000000003'
     or v_result #>> '{trips,1,tripId}' <> '00000000-0000-4340-8300-000000000002' then
    raise exception 'Multiple Place order or filtering is invalid: %', v_result;
  end if;
  raise notice 'M340_RESOLVER_OK';
end
$m340_resolver$;

do $m340_tracking$
declare
  v_place_id uuid := (select id from m340_places where name = 'single');
  v_trip_id uuid := '00000000-0000-4340-8300-000000000001';
  v_day date := app_private.fanbus_publishing_berlin_day(statement_timestamp());
  v_before bigint;
  v_after bigint;
  v_result jsonb;
begin
  select coalesce(landing_count, 0)
    into v_before
  from app_modules.fanbus_publishing_place_landing_daily
  where place_id = v_place_id and day = v_day;
  v_before := coalesce(v_before, 0);
  v_result := public.pd_public_fanbus_ontour_resolve('single-place');
  select landing_count
    into v_after
  from app_modules.fanbus_publishing_place_landing_daily
  where place_id = v_place_id and day = v_day;
  if v_after <> v_before + 1 or v_result ->> 'mode' <> 'SINGLE' then
    raise exception 'Place Landing aggregate failed';
  end if;
  if exists (
    select 1
    from app_modules.fanbus_publishing_trip_referral_daily
    where place_id = v_place_id and trip_id = v_trip_id and day = v_day
  ) then
    raise exception 'Resolver implicitly counted a Trip Referral';
  end if;

  v_result := public.pd_public_fanbus_trip_referral_track('single-place', v_trip_id);
  if coalesce((v_result ->> 'tracked')::boolean, false) is not true
     or (select referral_count
         from app_modules.fanbus_publishing_trip_referral_daily
         where place_id = v_place_id and trip_id = v_trip_id and day = v_day) <> 1 then
    raise exception 'Separate Trip Referral aggregate failed';
  end if;
  v_result := public.pd_public_fanbus_trip_referral_track(
    'fallback-place',
    v_trip_id
  );
  if coalesce((v_result ->> 'tracked')::boolean, false) is true
     or exists (
       select 1
       from app_modules.fanbus_publishing_trip_referral_daily
       where place_id = (select id from m340_places where name = 'fallback')
         and trip_id = v_trip_id
     ) then
    raise exception 'Invalid Place/Trip combination was tracked';
  end if;

  update app_modules.fanbus_publishing_place_landing_daily
  set landing_count = 9223372036854775807
  where place_id = v_place_id and day = v_day;
  v_result := public.pd_public_fanbus_ontour_resolve('single-place');
  if v_result ->> 'mode' <> 'SINGLE' then
    raise exception 'Tracking failure changed Resolver response';
  end if;
  raise notice 'M340_TRACKING_OK';
end
$m340_tracking$;

do $m340_security$
declare
  v_table text;
  v_privilege text;
begin
  foreach v_table in array array[
    'app_modules.fanbus_publishing_places',
    'app_modules.fanbus_publishing_place_keys',
    'app_modules.fanbus_publishing_event_places',
    'app_modules.fanbus_publishing_place_landing_daily',
    'app_modules.fanbus_publishing_trip_referral_daily'
  ] loop
    if not (select relrowsecurity from pg_class where oid = to_regclass(v_table)) then
      raise exception 'RLS missing on %', v_table;
    end if;
    foreach v_privilege in array array[
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ] loop
      if has_table_privilege('anon', v_table, v_privilege)
         or has_table_privilege('authenticated', v_table, v_privilege) then
        raise exception 'Browser role owns % on %', v_privilege, v_table;
      end if;
    end loop;
  end loop;

  if not has_function_privilege(
    'anon',
    'public.pd_public_fanbus_ontour_resolve(text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.pd_public_fanbus_ontour_resolve(text)',
    'EXECUTE'
  ) or not has_function_privilege(
    'anon',
    'public.pd_public_fanbus_trip_referral_track(text,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.pd_public_fanbus_trip_referral_track(text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'Required public M340 RPC grant is missing';
  end if;

  if has_function_privilege(
    'anon',
    'app_private.api_fanbus_publishing_place_create(jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'app_private.api_fanbus_publishing_place_create(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Private M340 administration is browser-executable';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'app_modules'
      and table_name in (
        'fanbus_publishing_place_landing_daily',
        'fanbus_publishing_trip_referral_daily'
      )
      and column_name ~* '(ip|user_agent|cookie|session|device|fingerprint|visitor|user_id|header|profile)'
  ) then
    raise exception 'Personal or device-related M340 tracking column exists';
  end if;

  if not exists (
    select 1
    from app_portal.capabilities
    where code = 'fanbus.publishing.manage' and is_active
  ) or not exists (
    select 1
    from app_portal.team_function_capabilities as mapping
    join app_portal.teams as team on team.id = mapping.team_id
    where team.code = 'BUS_ORGA'
      and mapping.function_code = 'BUS_PUBLISHING'
      and mapping.capability_code = 'fanbus.publishing.manage'
      and mapping.is_active
  ) then
    raise exception 'M340 capability or BUS_PUBLISHING mapping is missing';
  end if;
  raise notice 'M340_SECURITY_OK';
end
$m340_security$;

do $m340_pd_api_authorization$
declare
  v_authorized uuid := '00000000-0000-4340-8000-000000000002';
  v_denied uuid := '00000000-0000-4340-8000-000000000003';
  v_role uuid;
  v_bus_team uuid;
  v_response jsonb;
begin
  select id
    into v_role
  from app_portal.portal_roles
  where code = 'PORTAL_USER'
    and is_active;

  select id
    into v_bus_team
  from app_portal.teams
  where code = 'BUS_ORGA'
    and is_active;

  if v_role is null or v_bus_team is null then
    raise exception 'M340 pd_api auth prerequisites PORTAL_USER/BUS_ORGA missing';
  end if;

  insert into auth.users(id, email)
  values
    (v_authorized, 'm340-publisher@example.invalid'),
    (v_denied, 'm340-publishing-denied@example.invalid');

  insert into app_portal.users(
    id, user_code, email, first_name, last_name, status, role_id
  )
  values
    (
      v_authorized,
      'U-M340-PUBLISHER',
      'm340-publisher@example.invalid',
      'M340',
      'Publisher',
      'ACTIVE',
      v_role
    ),
    (
      v_denied,
      'U-M340-PUBLISHING-DENIED',
      'm340-publishing-denied@example.invalid',
      'M340',
      'Denied',
      'ACTIVE',
      v_role
    );

  if app_private.has_capability(v_authorized, 'portal.admin')
     or app_private.has_capability(v_denied, 'portal.admin') then
    raise exception 'M340 auth fixture unexpectedly receives portal.admin';
  end if;

  insert into app_portal.team_memberships(
    team_id, user_id, team_role, is_active
  )
  values
    (v_bus_team, v_authorized, 'MEMBER', true),
    (v_bus_team, v_denied, 'MEMBER', true);

  insert into app_portal.team_function_assignments(
    team_id, user_id, function_code, created_by
  )
  values (
    v_bus_team,
    v_authorized,
    'BUS_PUBLISHING',
    '00000000-0000-4340-8000-000000000001'
  );

  if not app_private.has_capability(
    v_authorized,
    'fanbus.publishing.manage'
  ) then
    raise exception 'BUS_PUBLISHING does not grant fanbus.publishing.manage';
  end if;
  if app_private.has_capability(
    v_denied,
    'fanbus.publishing.manage'
  ) then
    raise exception 'BUS_ORGA membership alone grants fanbus.publishing.manage';
  end if;
  if exists (
    select 1
    from app_portal.user_capabilities
    where user_id = v_authorized
      and capability_code = 'fanbus.publishing.manage'
  ) then
    raise exception 'M340 publisher received a direct personal capability';
  end if;

  perform set_config('request.jwt.claim.sub', v_authorized::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_authorized, 'role', 'authenticated')::text,
    true
  );

  v_response := public.pd_api(
    'fanbus_publishing_resolution_ensure',
    '{}'::jsonb
  );
  if (v_response ->> 'ok')::boolean is distinct from true then
    raise exception 'Authorized pd_api auto resolution failed: %', v_response;
  end if;

  v_response := public.pd_api(
    'fanbus_publishing_place_create',
    jsonb_build_object(
      'slug', 'pd-api-deprecated-place',
      'displayName', 'PD API Deprecated Place'
    )
  );
  if (v_response ->> 'ok')::boolean is distinct from false
     or v_response #>> '{error,code}' <> '0A000' then
    raise exception 'Deprecated manual Place API remained reachable: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_denied::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_denied, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'fanbus_publishing_resolution_ensure',
    '{}'::jsonb
  );
  if (v_response ->> 'ok')::boolean is distinct from false
     or v_response #>> '{error,code}' <> '42501'
     or pg_catalog.strpos(
       coalesce(v_response #>> '{error,message}', ''),
       'fanbus.publishing.manage'
     ) = 0 then
    raise exception 'Unauthorized auto resolution did not fail by capability: %', v_response;
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4340-8000-000000000001',
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', '00000000-0000-4340-8000-000000000001',
      'role', 'authenticated'
    )::text,
    true
  );
  raise notice 'M340_PD_API_AUTHORIZATION_OK';
end
$m340_pd_api_authorization$;

rollback;
