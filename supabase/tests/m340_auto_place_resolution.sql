\set ON_ERROR_STOP on

begin;

insert into auth.users(id, email)
values
  ('00000000-0000-4340-b000-000000000001', 'm340-auto-publisher@example.invalid'),
  ('00000000-0000-4340-b000-000000000002', 'm340-auto-denied@example.invalid');

insert into app_portal.users(
  id, user_code, email, first_name, last_name, status, role_id
)
select
  fixture.id,
  fixture.user_code,
  fixture.email,
  'M340',
  fixture.last_name,
  'ACTIVE',
  role.id
from (
  values
    (
      '00000000-0000-4340-b000-000000000001'::uuid,
      'U-M340-AUTO-PUBLISHER',
      'm340-auto-publisher@example.invalid',
      'Auto Publisher'
    ),
    (
      '00000000-0000-4340-b000-000000000002'::uuid,
      'U-M340-AUTO-DENIED',
      'm340-auto-denied@example.invalid',
      'Auto Denied'
    )
) as fixture(id, user_code, email, last_name)
join app_portal.portal_roles as role
  on role.code = 'PORTAL_USER'
 and role.is_active;

insert into app_portal.team_memberships(team_id, user_id, team_role, is_active)
select
  team.id,
  fixture.user_id,
  'MEMBER',
  true
from app_portal.teams as team
cross join (
  values
    ('00000000-0000-4340-b000-000000000001'::uuid),
    ('00000000-0000-4340-b000-000000000002'::uuid)
) as fixture(user_id)
where team.code = 'BUS_ORGA'
  and team.is_active;

insert into app_portal.team_function_assignments(
  team_id, user_id, function_code, created_by
)
select
  team.id,
  '00000000-0000-4340-b000-000000000001',
  'BUS_PUBLISHING',
  null
from app_portal.teams as team
where team.code = 'BUS_ORGA'
  and team.is_active;

do $m340_auto_contract$
begin
  if app_private.platform_action_classification(
    'fanbus_publishing_resolution_ensure'
  ) <> 'USER_MUTATION'
     or app_private.platform_action_classification(
       'fanbus_publishing_resolution_choose'
     ) <> 'USER_MUTATION' then
    raise exception 'M340 auto-resolution action classification missing';
  end if;

  if pg_catalog.pg_get_functiondef(
    'app_private.pd_api_dispatch_current(text,jsonb)'::pg_catalog.regprocedure
  ) !~ 'fanbus_publishing_resolution_ensure'
     or pg_catalog.pg_get_functiondef(
       'app_private.pd_api_dispatch_current(text,jsonb)'::pg_catalog.regprocedure
     ) !~ 'fanbus_publishing_resolution_choose' then
    raise exception 'M340 auto-resolution pd_api routes missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'app_modules'
      and relation.relname = 'fanbus_publishing_resolution_aliases'
      and relation.relrowsecurity
  ) or not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'app_modules'
      and relation.relname = 'fanbus_publishing_alias_candidates'
      and relation.relrowsecurity
  ) or has_table_privilege(
    'authenticated',
    'app_modules.fanbus_publishing_resolution_aliases',
    'SELECT'
  ) or has_table_privilege(
    'authenticated',
    'app_modules.fanbus_publishing_alias_candidates',
    'SELECT'
  ) then
    raise exception 'M340 internal alias tables are not default-deny';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'app_portal.audit_events'::pg_catalog.regclass
      and attribute.attname = 'actor_user_id'
      and attribute.attnotnull
  ) then
    raise exception 'M340 migration backfill cannot use a NULL audit actor';
  end if;

  begin
    insert into app_modules.fanbus_publishing_resolution_aliases(
      alias_place_key,
      resolution_kind
    )
    values ('v1:invalid-canonical-rule', 'CANONICAL');
    raise exception 'Incomplete CANONICAL rule was accepted';
  exception when check_violation then
    null;
  end;

  if app_private.has_capability(
    '00000000-0000-4340-b000-000000000001',
    'portal.admin'
  ) or not app_private.has_capability(
    '00000000-0000-4340-b000-000000000001',
    'fanbus.publishing.manage'
  ) or app_private.has_capability(
    '00000000-0000-4340-b000-000000000002',
    'fanbus.publishing.manage'
  ) then
    raise exception 'M340 auto-resolution M010 capability fixture invalid';
  end if;
end
$m340_auto_contract$;

insert into app_modules.events(
  id, event_type, title, event_date, event_time, venue, visibility
)
values
  ('00000000-0000-4340-b100-000000000001', 'OTHER', 'Auto Landsberg', current_date + 20, time '18:00', 'Landsberg', 'PUBLIC'),
  ('00000000-0000-4340-b100-000000000002', 'OTHER', 'Auto Landsberg Alias', current_date + 21, time '18:00', 'Landsberg am Lech', 'PUBLIC'),
  ('00000000-0000-4340-b100-000000000003', 'OTHER', 'Auto Bayreuth', current_date + 22, time '18:00', 'Bayreuth', 'PUBLIC'),
  ('00000000-0000-4340-b100-000000000004', 'OTHER', 'Auto Missing', current_date + 23, time '18:00', null, 'PUBLIC'),
  ('00000000-0000-4340-b100-000000000005', 'OTHER', 'Auto Neustadt', current_date + 24, time '18:00', 'Neustadt', 'PUBLIC'),
  ('00000000-0000-4340-b100-000000000006', 'OTHER', 'Auto Neustadt Future', current_date + 25, time '18:00', 'Neustadt', 'PUBLIC'),
  ('00000000-0000-4340-b100-000000000007', 'OTHER', 'Auto Springfield', current_date + 26, time '18:00', 'Springfield', 'PUBLIC'),
  ('00000000-0000-4340-b100-000000000008', 'OTHER', 'Auto Missing Publish', current_date + 27, time '18:00', null, 'PUBLIC'),
  ('00000000-0000-4340-b100-000000000009', 'OTHER', 'Auto Bayreuth Again', current_date + 28, time '18:00', 'Bayreuth', 'PUBLIC'),
  ('00000000-0000-4340-b100-000000000010', 'OTHER', 'Auto Historical Alias', current_date + 29, time '18:00', 'Teststadt Alt', 'PUBLIC'),
  ('00000000-0000-4340-b100-000000000011', 'OTHER', 'Auto Incomplete Conflict', current_date + 30, time '18:00', 'Solo Conflict', 'PUBLIC');

do $m340_auto_landsberg$
declare
  v_result jsonb;
  v_place_id uuid;
begin
  v_result := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000001',
    '00000000-0000-4340-b000-000000000001'
  );
  v_place_id := (v_result ->> 'placeId')::uuid;
  if v_result ->> 'status' <> 'RESOLVED'
     or v_result ->> 'shortlinkPath' <> '/ontour/landsberg'
     or not exists (
       select 1
       from app_modules.fanbus_publishing_places as place
       where place.id = v_place_id
         and place.slug = 'landsberg'
         and place.display_name = 'Landsberg'
         and place.is_active
     ) then
    raise exception 'Landsberg did not resolve canonically: %', v_result;
  end if;
  raise notice 'M340_AUTO_LANDSBERG_OK';
end
$m340_auto_landsberg$;

do $m340_auto_landsberg_alias$
declare
  v_canonical uuid;
  v_alias_result jsonb;
begin
  select place_id into v_canonical
  from app_modules.fanbus_publishing_event_places
  where event_id = '00000000-0000-4340-b100-000000000001';

  v_alias_result := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000002',
    '00000000-0000-4340-b000-000000000001'
  );
  if v_alias_result ->> 'status' <> 'RESOLVED'
     or (v_alias_result ->> 'placeId')::uuid is distinct from v_canonical
     or v_alias_result ->> 'shortlinkPath' <> '/ontour/landsberg'
     or exists (
       select 1
       from app_modules.fanbus_publishing_places
       where slug = 'landsberg-am-lech'
     ) then
    raise exception 'Landsberg alias created a second canonical target: %', v_alias_result;
  end if;
  raise notice 'M340_AUTO_LANDSBERG_ALIAS_OK';
  raise notice 'M340_AUTO_KNOWN_ALIAS_OK';
end
$m340_auto_landsberg_alias$;

do $m340_auto_inactive_canonical$
declare
  v_place_id uuid;
  v_result jsonb;
begin
  select place_id
    into v_place_id
  from app_modules.fanbus_publishing_event_places
  where event_id = '00000000-0000-4340-b100-000000000001';

  update app_modules.fanbus_publishing_places
  set is_active = false
  where id = v_place_id;

  v_result := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000002',
    '00000000-0000-4340-b000-000000000001'
  );
  if (v_result ->> 'placeId')::uuid is distinct from v_place_id
     or not exists (
       select 1
       from app_modules.fanbus_publishing_places
       where id = v_place_id
         and is_active
     ) then
    raise exception 'Inactive canonical Place was not safely reactivated: %', v_result;
  end if;
  raise notice 'M340_AUTO_INACTIVE_CANONICAL_OK';
end
$m340_auto_inactive_canonical$;

insert into app_modules.fanbus_publishing_resolution_aliases(
  alias_place_key,
  resolution_kind,
  canonical_place_key,
  canonical_slug,
  canonical_display_name
)
values (
  'v1:teststadt-alt',
  'CANONICAL',
  'v1:teststadt',
  'teststadt',
  'Teststadt'
);

insert into app_modules.fanbus_publishing_places(id, slug, display_name)
values (
  '00000000-0000-4340-b210-000000000001',
  'teststadt-alt',
  'Teststadt Alt'
);

insert into app_modules.fanbus_publishing_place_keys(
  place_id,
  place_key,
  source_label
)
values (
  '00000000-0000-4340-b210-000000000001',
  'v1:teststadt-alt',
  'Teststadt Alt'
);

insert into app_modules.fanbus_publishing_event_places(
  event_id,
  place_id,
  bound_place_key
)
values (
  '00000000-0000-4340-b100-000000000010',
  '00000000-0000-4340-b210-000000000001',
  'v1:teststadt-alt'
);

do $m340_auto_historical_alias_repair$
declare
  v_result jsonb;
begin
  v_result := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000010',
    '00000000-0000-4340-b000-000000000001'
  );
  if v_result ->> 'status' <> 'RESOLVED'
     or v_result ->> 'shortlinkPath' <> '/ontour/teststadt'
     or exists (
       select 1
       from app_modules.fanbus_publishing_places
       where id = '00000000-0000-4340-b210-000000000001'
     )
     or not exists (
       select 1
       from app_modules.fanbus_publishing_event_places
       where event_id = '00000000-0000-4340-b100-000000000010'
         and place_id = (v_result ->> 'placeId')::uuid
         and bound_place_key = 'v1:teststadt-alt'
     ) then
    raise exception 'Historical Alias Place was not repaired safely: %', v_result;
  end if;
  raise notice 'M340_AUTO_HISTORICAL_ALIAS_REPAIR_OK';
end
$m340_auto_historical_alias_repair$;

do $m340_auto_bayreuth$
declare
  v_first jsonb;
  v_second jsonb;
begin
  v_first := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000003',
    '00000000-0000-4340-b000-000000000001'
  );
  if v_first ->> 'status' <> 'RESOLVED'
     or v_first ->> 'shortlinkPath' <> '/ontour/bayreuth'
     or not exists (
       select 1
       from app_modules.fanbus_publishing_places
       where id = (v_first ->> 'placeId')::uuid
         and slug = 'bayreuth'
     ) then
    raise exception 'Unique Bayreuth target was not auto-created: %', v_first;
  end if;
  raise notice 'M340_AUTO_BAYREUTH_OK';

  v_second := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000003',
    '00000000-0000-4340-b000-000000000001'
  );
  if v_second is distinct from v_first
     or (select count(*) from app_modules.fanbus_publishing_places where slug = 'bayreuth') <> 1
     or (select count(*) from app_modules.fanbus_publishing_place_keys where place_key = 'v1:bayreuth') <> 1
     or (select count(*) from app_modules.fanbus_publishing_event_places where event_id = '00000000-0000-4340-b100-000000000003') <> 1 then
    raise exception 'Repeated Bayreuth resolution is not idempotent: %, %', v_first, v_second;
  end if;
  raise notice 'M340_AUTO_IDEMPOTENCY_OK';
end
$m340_auto_bayreuth$;

do $m340_auto_same_venue$
declare
  v_first_place uuid;
  v_second jsonb;
begin
  select place_id
    into v_first_place
  from app_modules.fanbus_publishing_event_places
  where event_id = '00000000-0000-4340-b100-000000000003';

  v_second := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000009',
    '00000000-0000-4340-b000-000000000001'
  );
  if v_second ->> 'status' <> 'RESOLVED'
     or (v_second ->> 'placeId')::uuid is distinct from v_first_place
     or v_second ->> 'shortlinkPath' <> '/ontour/bayreuth' then
    raise exception 'Same venue across events did not reuse Place: %', v_second;
  end if;
  raise notice 'M340_AUTO_SAME_VENUE_OK';
end
$m340_auto_same_venue$;

do $m340_auto_venue_change$
declare
  v_bayreuth uuid;
  v_changed jsonb;
begin
  select place_id
    into v_bayreuth
  from app_modules.fanbus_publishing_event_places
  where event_id = '00000000-0000-4340-b100-000000000003';

  update app_modules.events
  set venue = 'Bamberg'
  where id = '00000000-0000-4340-b100-000000000009';

  v_changed := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000009',
    '00000000-0000-4340-b000-000000000001'
  );
  if v_changed ->> 'status' <> 'RESOLVED'
     or v_changed ->> 'shortlinkPath' <> '/ontour/bamberg'
     or (v_changed ->> 'placeId')::uuid is not distinct from v_bayreuth
     or not exists (
       select 1
       from app_modules.fanbus_publishing_event_places
       where event_id = '00000000-0000-4340-b100-000000000003'
         and place_id = v_bayreuth
     ) then
    raise exception 'Changed venue was not rebound independently: %', v_changed;
  end if;
  raise notice 'M340_AUTO_VENUE_CHANGE_OK';
end
$m340_auto_venue_change$;

insert into app_modules.fanbus_publishing_places(id, slug, display_name)
values
  ('00000000-0000-4340-b200-000000000001', 'neustadt-a', 'Neustadt A'),
  ('00000000-0000-4340-b200-000000000002', 'neustadt-b', 'Neustadt B'),
  ('00000000-0000-4340-b200-000000000003', 'springfield-a', 'Springfield A'),
  ('00000000-0000-4340-b200-000000000004', 'springfield-b', 'Springfield B');

do $m340_auto_ambiguity_source$
begin
  begin
    insert into app_modules.fanbus_publishing_alias_candidates(
      alias_place_key,
      place_id
    )
    values (
      'v1:orphan-conflict',
      '00000000-0000-4340-b200-000000000001'
    );
    raise exception 'Loose ambiguity candidate without rule was accepted';
  exception when foreign_key_violation then
    null;
  end;
  raise notice 'M340_AUTO_AMBIGUITY_SOURCE_OK';
end
$m340_auto_ambiguity_source$;

insert into app_modules.fanbus_publishing_resolution_aliases(
  alias_place_key,
  resolution_kind
)
values ('v1:solo-conflict', 'AMBIGUOUS');

insert into app_modules.fanbus_publishing_alias_candidates(
  alias_place_key,
  place_id
)
values (
  'v1:solo-conflict',
  '00000000-0000-4340-b200-000000000001'
);

do $m340_auto_ambiguity_incomplete$
begin
  begin
    perform app_private.fanbus_publishing_ensure_event_place(
      '00000000-0000-4340-b100-000000000011',
      '00000000-0000-4340-b000-000000000001'
    );
    raise exception 'Incomplete ambiguity rule was treated as resolved';
  exception when check_violation then
    null;
  end;
  raise notice 'M340_AUTO_AMBIGUITY_INCOMPLETE_OK';
end
$m340_auto_ambiguity_incomplete$;

delete from app_modules.fanbus_publishing_resolution_aliases
where alias_place_key = 'v1:solo-conflict';

insert into app_modules.fanbus_publishing_resolution_aliases(
  alias_place_key,
  resolution_kind
)
values
  ('v1:neustadt', 'AMBIGUOUS'),
  ('v1:springfield', 'AMBIGUOUS');

insert into app_modules.fanbus_publishing_alias_candidates(alias_place_key, place_id)
values
  ('v1:neustadt', '00000000-0000-4340-b200-000000000001'),
  ('v1:neustadt', '00000000-0000-4340-b200-000000000002'),
  ('v1:springfield', '00000000-0000-4340-b200-000000000003'),
  ('v1:springfield', '00000000-0000-4340-b200-000000000004');

set constraints
  app_modules.fanbus_publishing_resolution_aliases_complete,
  app_modules.fanbus_publishing_alias_candidates_complete
immediate;
set constraints
  app_modules.fanbus_publishing_resolution_aliases_complete,
  app_modules.fanbus_publishing_alias_candidates_complete
deferred;

do $m340_auto_ambiguous$
declare
  v_result jsonb;
begin
  v_result := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000005',
    '00000000-0000-4340-b000-000000000001'
  );
  if v_result ->> 'status' <> 'AMBIGUOUS'
     or jsonb_array_length(v_result -> 'candidates') <> 2
     or exists (
       select 1 from app_modules.fanbus_publishing_event_places
       where event_id = '00000000-0000-4340-b100-000000000005'
     ) then
    raise exception 'Genuine ambiguity was not preserved: %', v_result;
  end if;
  raise notice 'M340_AUTO_AMBIGUOUS_OK';
end
$m340_auto_ambiguous$;

do $m340_auto_inactive_candidate$
begin
  update app_modules.fanbus_publishing_places
  set is_active = false
  where id = '00000000-0000-4340-b200-000000000004';

  begin
    perform app_private.fanbus_publishing_ensure_event_place(
      '00000000-0000-4340-b100-000000000007',
      '00000000-0000-4340-b000-000000000001'
    );
    raise exception 'Incomplete active ambiguity candidates were accepted';
  exception when check_violation then
    null;
  end;

  update app_modules.fanbus_publishing_places
  set is_active = true
  where id = '00000000-0000-4340-b200-000000000004';
  raise notice 'M340_AUTO_INACTIVE_CANDIDATE_OK';
end
$m340_auto_inactive_candidate$;

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4340-b000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '00000000-0000-4340-b000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

do $m340_auto_choice$
declare
  v_response jsonb;
  v_future jsonb;
begin
  v_response := public.pd_api(
    'fanbus_publishing_resolution_choose',
    jsonb_build_object(
      'eventId', '00000000-0000-4340-b100-000000000005',
      'placeId', '00000000-0000-4340-b200-000000000001'
    )
  );
  if (v_response ->> 'ok')::boolean is distinct from true
     or v_response #>> '{data,resolution,status}' <> 'RESOLVED'
     or v_response #>> '{data,resolution,shortlinkPath}' <> '/ontour/neustadt-a'
     or exists (
       select 1 from app_modules.fanbus_publishing_alias_candidates
       where alias_place_key = 'v1:neustadt'
     )
     or not exists (
       select 1
       from app_modules.fanbus_publishing_resolution_aliases as alias
       where alias.alias_place_key = 'v1:neustadt'
         and alias.resolution_kind = 'CANONICAL'
         and alias.canonical_place_key = 'v1:neustadt-a'
         and alias.canonical_slug = 'neustadt-a'
     ) then
    raise exception 'Authorized ambiguity choice failed: %', v_response;
  end if;

  v_future := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000006',
    '00000000-0000-4340-b000-000000000001'
  );
  if v_future ->> 'status' <> 'RESOLVED'
     or (v_future ->> 'placeId')::uuid <> '00000000-0000-4340-b200-000000000001'
     or v_future ->> 'shortlinkPath' <> '/ontour/neustadt-a' then
    raise exception 'Stored ambiguity choice was not reused: %', v_future;
  end if;
  raise notice 'M340_AUTO_CHOICE_OK';
end
$m340_auto_choice$;

do $m340_auto_missing$
declare
  v_result jsonb;
begin
  v_result := app_private.fanbus_publishing_ensure_event_place(
    '00000000-0000-4340-b100-000000000004',
    '00000000-0000-4340-b000-000000000001'
  );
  if v_result ->> 'status' <> 'MISSING_VENUE'
     or exists (
       select 1 from app_modules.fanbus_publishing_event_places
       where event_id = '00000000-0000-4340-b100-000000000004'
     )
     or exists (
       select 1 from app_modules.fanbus_publishing_places
       where display_name is null or btrim(display_name) = ''
     ) then
    raise exception 'Missing venue generated a publishing target: %', v_result;
  end if;
  raise notice 'M340_AUTO_MISSING_VENUE_OK';
end
$m340_auto_missing$;

do $m340_auto_auth_and_deprecation$
declare
  v_response jsonb;
begin
  v_response := public.pd_api(
    'fanbus_publishing_resolution_ensure',
    '{}'::jsonb
  );
  if (v_response ->> 'ok')::boolean is distinct from true then
    raise exception 'Authorized auto-resolution pd_api failed: %', v_response;
  end if;

  v_response := public.pd_api(
    'fanbus_publishing_place_create',
    jsonb_build_object('slug', 'forbidden', 'displayName', 'Forbidden')
  );
  if (v_response ->> 'ok')::boolean is distinct from false
     or v_response #>> '{error,code}' <> '0A000'
     or v_response #>> '{error,message}' <> 'M340_PUBLISHING_MANUAL_PLACE_API_DEPRECATED' then
    raise exception 'Manual publishing API was not deprecated: %', v_response;
  end if;
  raise notice 'M340_AUTO_MANUAL_API_DEPRECATED_OK';

  perform set_config(
    'request.jwt.claim.sub',
    '00000000-0000-4340-b000-000000000002',
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', '00000000-0000-4340-b000-000000000002',
      'role', 'authenticated'
    )::text,
    true
  );
  v_response := public.pd_api(
    'fanbus_publishing_resolution_ensure',
    '{}'::jsonb
  );
  if (v_response ->> 'ok')::boolean is distinct from false
     or v_response #>> '{error,code}' <> '42501' then
    raise exception 'Unauthorized auto-resolution mutation succeeded: %', v_response;
  end if;
end
$m340_auto_auth_and_deprecation$;

insert into app_modules.fanbus_trips(id, event_id, status)
values
  ('00000000-0000-4340-b300-000000000001', '00000000-0000-4340-b100-000000000007', 'PUBLISHED'),
  ('00000000-0000-4340-b300-000000000002', '00000000-0000-4340-b100-000000000008', 'PUBLISHED');

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4340-b000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '00000000-0000-4340-b000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);

do $m340_auto_enqueue_guard$
declare
  v_response jsonb;
begin
  v_response := public.pd_api(
    'fanbus_publishing_job_enqueue',
    jsonb_build_object('tripId', '00000000-0000-4340-b300-000000000001')
  );
  if (v_response ->> 'ok')::boolean is distinct from false
     or v_response #>> '{error,message}' <> 'M340_PUBLISHING_PLACE_AMBIGUOUS'
     or exists (
       select 1 from app_modules.fanbus_publishing_jobs
       where trip_id = '00000000-0000-4340-b300-000000000001'
     ) then
    raise exception 'Ambiguous enqueue was not blocked: %', v_response;
  end if;

  v_response := public.pd_api(
    'fanbus_publishing_job_enqueue',
    jsonb_build_object('tripId', '00000000-0000-4340-b300-000000000002')
  );
  if (v_response ->> 'ok')::boolean is distinct from false
     or v_response #>> '{error,message}' <> 'M340_PUBLISHING_VENUE_MISSING'
     or exists (
       select 1 from app_modules.fanbus_publishing_jobs
       where trip_id = '00000000-0000-4340-b300-000000000002'
     ) then
    raise exception 'Missing-venue enqueue was not blocked: %', v_response;
  end if;
  raise notice 'M340_AUTO_ENQUEUE_GUARD_OK';
end
$m340_auto_enqueue_guard$;

rollback;
