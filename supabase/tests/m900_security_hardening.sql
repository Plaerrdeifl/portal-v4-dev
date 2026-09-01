\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(
  (select relrowsecurity from pg_class
   where oid = 'app_private.bootstrap_tokens'::regclass),
  'bootstrap_tokens nutzt RLS als Defense in depth'
);
select ok(
  (select relrowsecurity from pg_class
   where oid = 'app_private.companion_person_search_rate_limits'::regclass),
  'Companion-Suchlimit ist RLS-geschuetzt'
);
select ok(
  not has_table_privilege('anon', 'app_private.bootstrap_tokens', 'SELECT')
  and not has_table_privilege('authenticated', 'app_private.bootstrap_tokens', 'SELECT')
  and not has_table_privilege('service_role', 'app_private.bootstrap_tokens', 'SELECT'),
  'Bootstrap-Tokens haben keine Client- oder service_role-Tabellenrechte'
);
select ok(
  not has_table_privilege('anon', 'app_private.platform_release_bypass_tokens', 'SELECT')
  and not has_table_privilege('authenticated', 'app_private.platform_release_bypass_tokens', 'SELECT')
  and not has_table_privilege('service_role', 'app_private.platform_release_bypass_tokens', 'SELECT'),
  'Release-Bypass-Tabelle bleibt ausschliesslich intern'
);
select ok(
  not has_table_privilege('anon', 'app_private.companion_person_search_rate_limits', 'SELECT')
  and not has_table_privilege('authenticated', 'app_private.companion_person_search_rate_limits', 'SELECT')
  and not has_table_privilege('service_role', 'app_private.companion_person_search_rate_limits', 'SELECT'),
  'Suchlimit-Tabelle ist nicht direkt erreichbar'
);

select is(
  (select count(*)::integer
   from pg_proc as proc
   join pg_namespace as namespace on namespace.oid = proc.pronamespace
   where namespace.nspname = 'public'
     and proc.proname like 'pd_api_before_%'
     and pg_catalog.oidvectortypes(proc.proargtypes) = 'text, jsonb'),
  26,
  'Die vollstaendige aktive historische Routerkette ist inventarisiert'
);
select ok(
  not exists (
    select 1
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname like 'pd_api_before_%'
      and pg_catalog.oidvectortypes(proc.proargtypes) = 'text, jsonb'
      and (
        has_function_privilege('anon', proc.oid, 'EXECUTE')
        or has_function_privilege('authenticated', proc.oid, 'EXECUTE')
        or has_function_privilege('service_role', proc.oid, 'EXECUTE')
      )
  ),
  'Kein historischer Router ist direkt fuer Client- oder service_role aufrufbar'
);
select ok(
  not exists (
    select 1
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname like 'pd_api_before_%'
      and pg_catalog.oidvectortypes(proc.proargtypes) = 'text, jsonb'
      and not has_function_privilege('postgres', proc.oid, 'EXECUTE')
  ),
  'postgres kann die interne historische Routerkette weiter ausfuehren'
);
select ok(
  has_function_privilege('authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.pd_api(text,jsonb)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.pd_api(text,jsonb)', 'EXECUTE'),
  'Nur authenticated besitzt den aktiven pd_api-Einstieg'
);

select ok(
  has_function_privilege('anon', 'public.pd_public_events()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.pd_public_events()', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.pd_public_events()', 'EXECUTE'),
  'Public Events behaelt exakt den anon-Read-Grant'
);
select ok(
  has_function_privilege('anon', 'public.pd_public_fanbus_trip(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.pd_public_fanbus_trip(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.pd_public_fanbus_trip(uuid)', 'EXECUTE'),
  'Public Fanbus-Detail behaelt nur die vorgesehenen Read-Rollen'
);
select ok(
  has_function_privilege('anon', 'public.pd_public_fanbus_trip_boarding_stops(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.pd_public_fanbus_trip_boarding_stops(uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.pd_public_fanbus_trip_boarding_stops(uuid)', 'EXECUTE'),
  'Public Zustiegsorte behalten nur die vorgesehenen Read-Rollen'
);
select ok(
  has_function_privilege('anon', 'public.pd_public_fanbus_trips()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.pd_public_fanbus_trips()', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.pd_public_fanbus_trips()', 'EXECUTE'),
  'Public Fanbus-Liste behaelt nur die vorgesehenen Read-Rollen'
);
select ok(
  has_function_privilege('anon', 'public.pd_public_platform_status()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.pd_public_platform_status()', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.pd_public_platform_status()', 'EXECUTE'),
  'Platformstatus behaelt nur die vorgesehenen Read-Rollen'
);

select is(
  (select count(*)::integer
   from pg_proc as proc
   join pg_namespace as namespace on namespace.oid = proc.pronamespace
   where namespace.nspname in ('app_private', 'public')
     and proc.proname in (
       'consume_companion_person_search_rate_limit',
       'm325_portal_people_search',
       'api_fanbus_companion_person_search',
       'api_fanbus_registration_identity_search',
       'api_fanbus_registration_identity_suggestion',
       'create_platform_release_bypass',
       'revoke_platform_release_bypass',
       'pd_public_events',
       'pd_public_fanbus_trip',
       'pd_public_fanbus_trip_boarding_stops',
       'pd_public_fanbus_trips',
       'pd_public_platform_status'
     )
     and proc.prosecdef
     and 'search_path=""' = any(proc.proconfig)),
  12,
  'Alle neuen/geaenderten und oeffentlichen SECURITY-DEFINER haben leeren search_path'
);

select ok(
  not has_function_privilege(
    'service_role',
    'app_private.create_platform_release_bypass(text,text,timestamp with time zone,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'app_private.revoke_platform_release_bypass(uuid)',
    'EXECUTE'
  ),
  'Release-Bypass-Verwaltung bleibt postgres-only'
);

insert into app_portal.settings(key, value, description, revision)
values (
  'platform.mode',
  jsonb_build_object(
    'mode', 'READ_ONLY',
    'message', null,
    'expectedEnd', null,
    'environment', 'LOCAL'
  ),
  'M900 Security Test',
  1
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    revision = app_portal.settings.revision + 1;

insert into auth.users(id, email)
values ('00000000-0000-4900-8000-000000000021', 'm900-security-bypass@example.invalid');

insert into app_portal.users(
  id, user_code, email, first_name, last_name, status, role_id
)
select
  '00000000-0000-4900-8000-000000000021',
  'U-M900-SECURITY-BYPASS',
  'm900-security-bypass@example.invalid',
  'M900',
  'Security Bypass',
  'ACTIVE',
  role.id
from app_portal.portal_roles as role
where role.code = 'PORTAL_USER'
  and role.is_active;

create temporary table m900_security_bypass_fixture(result jsonb) on commit drop;
insert into m900_security_bypass_fixture(result)
select app_private.create_platform_release_bypass(
  'LOCAL',
  'm900-security-test',
  now() + interval '15 minutes',
  '00000000-0000-4900-8000-000000000021'
);

select is(
  (select count(*)::integer
   from app_portal.audit_events
   where action = 'PLATFORM_RELEASE_BYPASS_CREATED'
     and entity_id = (select result ->> 'id' from m900_security_bypass_fixture)),
  1,
  'Erfolgreiche Bypass-Erzeugung wird auditiert'
);
select ok(
  not exists (
    select 1
    from app_portal.audit_events
    where action = 'PLATFORM_RELEASE_BYPASS_CREATED'
      and entity_id = (select result ->> 'id' from m900_security_bypass_fixture)
      and lower(coalesce(before_data::text, '') || coalesce(after_data::text, '') || metadata::text)
        ~ '(token|digest)'
  ),
  'Bypass-Erzeugung auditiert weder Roh-Token noch Digest'
);
select ok(
  app_private.revoke_platform_release_bypass(
    (select (result ->> 'id')::uuid from m900_security_bypass_fixture)
  ),
  'Bypass kann ueber den Ops-Weg widerrufen werden'
);
select is(
  (select count(*)::integer
   from app_portal.audit_events
   where action = 'PLATFORM_RELEASE_BYPASS_REVOKED'
     and entity_id = (select result ->> 'id' from m900_security_bypass_fixture)),
  1,
  'Erfolgreicher Bypass-Widerruf wird auditiert'
);
select ok(
  not exists (
    select 1
    from app_portal.audit_events
    where action in (
      'PLATFORM_RELEASE_BYPASS_CREATED',
      'PLATFORM_RELEASE_BYPASS_REVOKED'
    )
      and entity_id = (select result ->> 'id' from m900_security_bypass_fixture)
      and lower(coalesce(before_data::text, '') || coalesce(after_data::text, '') || metadata::text)
        ~ '(token|digest)'
  ),
  'Bypass-Verwaltung bleibt im Audit secret-frei'
);

select * from finish();
rollback;
