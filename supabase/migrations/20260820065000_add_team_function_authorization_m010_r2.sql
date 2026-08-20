-- Plaerrdeifl Portal V4
-- P800 / M010-R2
-- Rollen-, Team- und Berechtigungsbereinigung
--
-- F1-A: TEAM_FUNCTION als additive Quelle des zentralen
-- Berechtigungsmodells und granularer Fanbus-Rechtesplit.
--
-- Zielmodell:
-- ROLE OR OFFICE OR TEAM_FUNCTION OR PERSONAL OR ADMIN_OVERRIDE
--
-- Keine PROD-spezifischen Daten und keine hardcodierten User-UUIDs.

-- ============================================================
-- 1. Granulare Fanbus-Capabilities
-- ============================================================

insert into app_portal.capabilities (
  code,
  name,
  category,
  description,
  is_active,
  sort_order
)
values
  (
    'fanbus.operations.manage',
    'Fanbus-Fahrtbetrieb',
    'Fanbus',
    'Operativen Fahrtbetrieb und Check-in einer Fanbusfahrt durchführen.',
    true,
    200
  ),
  (
    'fanbus.payment_marker.manage',
    'Fanbus-Bezahlt-Marker',
    'Fanbus',
    'Ausschließlich den manuellen Bezahlt-Marker einer Fanbus-Teilnahme setzen oder zurücksetzen.',
    true,
    210
  )
on conflict (code) do update
set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

-- ============================================================
-- 2. Team + Funktion -> Capability
-- ============================================================
--
-- Die Zuordnung ist bewusst teamgebunden.
-- Eine gleichnamige Funktion in einem anderen Team erzeugt dadurch
-- niemals automatisch dieselben Fachrechte.

create table app_portal.team_function_capabilities (
  team_id uuid not null
    references app_portal.teams(id) on delete cascade,
  function_code text not null
    references app_portal.team_functions(code) on delete cascade,
  capability_code text not null
    references app_portal.capabilities(code) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid
    references app_portal.users(id) on delete set null,
  primary key (team_id, function_code, capability_code),
  constraint team_function_capabilities_no_portal_admin_check
    check (capability_code <> 'portal.admin')
);

create index team_function_capabilities_capability_idx
  on app_portal.team_function_capabilities(
    capability_code,
    team_id,
    function_code
  );

alter table app_portal.team_function_capabilities
  enable row level security;

revoke all on table app_portal.team_function_capabilities
  from public, anon, authenticated;

-- ============================================================
-- 3. M010-R2 Bus-Orga-Funktionen
-- ============================================================

insert into app_portal.team_functions (
  code,
  name,
  description,
  is_active
)
values
  (
    'BUS_TRIPS_MANAGE',
    'Fanbusfahrten verwalten',
    'Fanbusfahrten konfigurieren, bearbeiten, veröffentlichen, schließen und stornieren.',
    true
  ),
  (
    'BUS_PARTICIPANTS_MANAGE',
    'Fanbus-Teilnehmer verwalten',
    'Fanbus-Anmeldungen, Teilnehmer, Warteliste, Buszuordnung und teilnehmerbezogene Betriebsdaten verwalten.',
    true
  ),
  (
    'BUS_OPERATIONS',
    'Fanbus-Fahrtbetrieb',
    'Operativen Fahrtbetrieb einschließlich Check-in durchführen.',
    true
  ),
  (
    'BUS_PAYMENT_MARKER',
    'Fanbus-Bezahlt-Marker',
    'Ausschließlich den manuellen Bezahlt-Marker im Fahrtbetrieb pflegen; keine Finanzberechtigung.',
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

-- BUS_KASSE bleibt absichtlich unverändert und erhält in M010-R2
-- keine Capability-Zuordnung.

do $$
begin
  if not exists (
    select 1
    from app_portal.teams
    where code = 'BUS_ORGA'
  ) then
    raise exception 'M010_R2_BUS_ORGA_TEAM_MISSING'
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
  mapping.function_code,
  mapping.capability_code,
  true,
  null
from app_portal.teams as team
cross join (
  values
    ('BUS_TRIPS_MANAGE',        'fanbus.manage'),
    ('BUS_PARTICIPANTS_MANAGE', 'fanbus.registrations.manage'),
    ('BUS_OPERATIONS',          'fanbus.operations.manage'),
    ('BUS_PAYMENT_MARKER',      'fanbus.payment_marker.manage')
) as mapping(function_code, capability_code)
where team.code = 'BUS_ORGA'
on conflict (team_id, function_code, capability_code) do update
set is_active = true;

-- ============================================================
-- 4. Zentrale Capability-Engine
-- ============================================================

create or replace function app_private.has_capability(
  p_user_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_user as (
    select
      portal_user.id,
      portal_user.role_id
    from app_portal.users as portal_user
    join app_portal.portal_roles as role
      on role.id = portal_user.role_id
     and role.is_active
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
  ),
  requested_capability as (
    select capability.code
    from app_portal.capabilities as capability
    where capability.code = p_capability
      and capability.is_active
  )
  select exists (
    select 1
    from eligible_user
    cross join requested_capability
    where

      -- ROLE inklusive portal.admin-Wildcard.
      exists (
        select 1
        from app_portal.role_capabilities as role_capability
        join app_portal.capabilities as granted_capability
          on granted_capability.code =
             role_capability.capability_code
         and granted_capability.is_active
        where role_capability.role_id = eligible_user.role_id
          and role_capability.capability_code in (
            p_capability,
            'portal.admin'
          )
      )

      -- OFFICE
      or exists (
        select 1
        from app_portal.user_member_links as link
        join app_fanclub.members as member
          on member.id = link.member_id
         and member.status = 'ACTIVE'
        join app_fanclub.office_slots as office
          on office.member_id = member.id
        join app_fanclub.office_capabilities as office_capability
          on office_capability.office_code = office.code
         and office_capability.capability_code = p_capability
        where link.user_id = eligible_user.id
      )

      -- TEAM_FUNCTION
      or exists (
        select 1
        from app_portal.team_memberships as membership
        join app_portal.teams as team
          on team.id = membership.team_id
         and team.is_active
        join app_portal.team_function_assignments as assignment
          on assignment.team_id = membership.team_id
         and assignment.user_id = membership.user_id
        join app_portal.team_functions as team_function
          on team_function.code = assignment.function_code
         and team_function.is_active
        join app_portal.team_function_capabilities as function_capability
          on function_capability.team_id = assignment.team_id
         and function_capability.function_code =
             assignment.function_code
         and function_capability.capability_code = p_capability
         and function_capability.is_active
        where membership.user_id = eligible_user.id
          and membership.is_active
      )

      -- PERSONAL
      or exists (
        select 1
        from app_portal.user_capabilities as personal
        where personal.user_id = eligible_user.id
          and personal.capability_code = p_capability
      )
  );
$$;

-- ============================================================
-- 5. Capability-Provenance
-- ============================================================

create or replace function app_private.user_capability_provenance(
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with eligible_user as (
    select
      portal_user.id,
      role.id as role_id,
      role.code as role_code,
      role.name as role_name
    from app_portal.users as portal_user
    join app_portal.portal_roles as role
      on role.id = portal_user.role_id
     and role.is_active
    where portal_user.id = p_user_id
      and portal_user.status = 'ACTIVE'
  ),
  sources as (

    -- ROLE
    select
      capability.code as capability_code,
      'ROLE'::text as source,
      jsonb_build_object(
        'roleId', eligible_user.role_id,
        'roleCode', eligible_user.role_code,
        'roleName', eligible_user.role_name
      ) as detail
    from eligible_user
    join app_portal.role_capabilities as role_capability
      on role_capability.role_id = eligible_user.role_id
    join app_portal.capabilities as capability
      on capability.code = role_capability.capability_code
     and capability.is_active

    union all

    -- OFFICE
    select
      capability.code,
      'OFFICE'::text,
      jsonb_build_object(
        'officeCode', office.code,
        'officeLabel', office.label
      )
    from eligible_user
    join app_portal.user_member_links as link
      on link.user_id = eligible_user.id
    join app_fanclub.members as member
      on member.id = link.member_id
     and member.status = 'ACTIVE'
    join app_fanclub.office_slots as office
      on office.member_id = member.id
    join app_fanclub.office_capabilities as office_capability
      on office_capability.office_code = office.code
    join app_portal.capabilities as capability
      on capability.code = office_capability.capability_code
     and capability.is_active

    union all

    -- TEAM_FUNCTION
    select
      capability.code,
      'TEAM_FUNCTION'::text,
      jsonb_build_object(
        'teamCode', team.code,
        'teamName', team.name,
        'functionCode', team_function.code,
        'functionName', team_function.name
      )
    from eligible_user
    join app_portal.team_memberships as membership
      on membership.user_id = eligible_user.id
     and membership.is_active
    join app_portal.teams as team
      on team.id = membership.team_id
     and team.is_active
    join app_portal.team_function_assignments as assignment
      on assignment.team_id = membership.team_id
     and assignment.user_id = membership.user_id
    join app_portal.team_functions as team_function
      on team_function.code = assignment.function_code
     and team_function.is_active
    join app_portal.team_function_capabilities as function_capability
      on function_capability.team_id = assignment.team_id
     and function_capability.function_code =
         assignment.function_code
     and function_capability.is_active
    join app_portal.capabilities as capability
      on capability.code = function_capability.capability_code
     and capability.is_active

    union all

    -- PERSONAL
    select
      capability.code,
      'PERSONAL'::text,
      jsonb_build_object(
        'createdAt', personal.created_at,
        'createdBy', personal.created_by
      )
    from eligible_user
    join app_portal.user_capabilities as personal
      on personal.user_id = eligible_user.id
    join app_portal.capabilities as capability
      on capability.code = personal.capability_code
     and capability.is_active

    union all

    -- ADMIN_OVERRIDE
    select
      capability.code,
      'ADMIN_OVERRIDE'::text,
      jsonb_build_object(
        'roleId', eligible_user.role_id,
        'roleCode', eligible_user.role_code,
        'roleName', eligible_user.role_name,
        'wildcardCapability', 'portal.admin'
      )
    from eligible_user
    join app_portal.role_capabilities as admin_capability
      on admin_capability.role_id = eligible_user.role_id
     and admin_capability.capability_code = 'portal.admin'
    join app_portal.capabilities as admin_catalog
      on admin_catalog.code = admin_capability.capability_code
     and admin_catalog.is_active
    cross join app_portal.capabilities as capability
    where capability.is_active
      and capability.code <> 'portal.admin'
  ),
  source_rows as (
    select
      source.capability_code,
      jsonb_agg(
        jsonb_build_object(
          'source', source.source,
          'detail', source.detail
        )
        order by
          case source.source
            when 'ROLE' then 1
            when 'OFFICE' then 2
            when 'TEAM_FUNCTION' then 3
            when 'PERSONAL' then 4
            when 'ADMIN_OVERRIDE' then 5
            else 9
          end,
          source.detail::text
      ) as source_list
    from sources as source
    group by source.capability_code
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', capability.code,
        'name', capability.name,
        'category', capability.category,
        'description', capability.description,
        'sortOrder', capability.sort_order,
        'effective', true,
        'sources', source_rows.source_list
      )
      order by capability.sort_order, capability.code
    ),
    '[]'::jsonb
  )
  from source_rows
  join app_portal.capabilities as capability
    on capability.code = source_rows.capability_code;
$$;

revoke all on function
  app_private.has_capability(uuid, text),
  app_private.user_capability_provenance(uuid)
from public, anon, authenticated;

grant execute on function
  app_private.has_capability(uuid, text),
  app_private.user_capability_provenance(uuid)
to postgres;

-- ============================================================
-- 6. Bestehende BUS_ORGA-Rechte verlustfrei übernehmen
-- ============================================================
--
-- Bisher:
--   PERSONAL fanbus.manage
--   PERSONAL fanbus.registrations.manage
--
-- Neu:
--   fanbus.manage
--     -> BUS_TRIPS_MANAGE
--
--   fanbus.registrations.manage
--     -> BUS_PARTICIPANTS_MANAGE
--     -> BUS_OPERATIONS
--     -> BUS_PAYMENT_MARKER
--
-- Die neuen beiden Capability-Codes werden erst im späteren
-- Fanbus-Split verwendet. Dadurch gehen bei dieser Migration
-- keine bestehenden Aktionen verloren.

with candidates as (
  select
    membership.team_id,
    membership.user_id,
    mapping.function_code
  from app_portal.team_memberships as membership
  join app_portal.teams as team
    on team.id = membership.team_id
   and team.code = 'BUS_ORGA'
   and team.is_active
  join app_portal.user_capabilities as personal
    on personal.user_id = membership.user_id
  cross join lateral (
    values
      (
        'fanbus.manage',
        'BUS_TRIPS_MANAGE'
      ),
      (
        'fanbus.registrations.manage',
        'BUS_PARTICIPANTS_MANAGE'
      ),
      (
        'fanbus.registrations.manage',
        'BUS_OPERATIONS'
      ),
      (
        'fanbus.registrations.manage',
        'BUS_PAYMENT_MARKER'
      )
  ) as mapping(capability_code, function_code)
  where membership.is_active
    and personal.capability_code = mapping.capability_code
),
inserted as (
  insert into app_portal.team_function_assignments (
    team_id,
    user_id,
    function_code,
    created_by
  )
  select
    candidate.team_id,
    candidate.user_id,
    candidate.function_code,
    null
  from candidates as candidate
  on conflict (team_id, user_id, function_code) do nothing
  returning team_id, user_id, function_code
)
insert into app_portal.audit_events (
  actor_user_id,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data,
  metadata
)
select
  null,
  'TEAM_FUNCTION_ASSIGNED',
  'team_function_assignment',
  inserted.user_id::text,
  null,
  jsonb_build_object(
    'teamId', inserted.team_id,
    'functionCode', inserted.function_code
  ),
  jsonb_build_object(
    'migration', 'M010-R2',
    'reason', 'BUS_ORGA_PERSONAL_RIGHTS_MIGRATION'
  )
from inserted;

-- Erst nach vorhandener TEAM_FUNCTION-Zuordnung werden die
-- redundanten alten PERSONAL-Quellen entfernt.

with deleted as (
  delete from app_portal.user_capabilities as personal
  using app_portal.team_memberships as membership,
        app_portal.teams as team
  where membership.user_id = personal.user_id
    and team.id = membership.team_id
    and team.code = 'BUS_ORGA'
    and team.is_active
    and membership.is_active
    and personal.capability_code in (
      'fanbus.manage',
      'fanbus.registrations.manage'
    )
    and (
      (
        personal.capability_code = 'fanbus.manage'
        and exists (
          select 1
          from app_portal.team_function_assignments as assignment
          where assignment.team_id = membership.team_id
            and assignment.user_id = membership.user_id
            and assignment.function_code = 'BUS_TRIPS_MANAGE'
        )
      )
      or
      (
        personal.capability_code = 'fanbus.registrations.manage'
        and not exists (
          select 1
          from (
            values
              ('BUS_PARTICIPANTS_MANAGE'),
              ('BUS_OPERATIONS'),
              ('BUS_PAYMENT_MARKER')
          ) as required(function_code)
          where not exists (
            select 1
            from app_portal.team_function_assignments as assignment
            where assignment.team_id = membership.team_id
              and assignment.user_id = membership.user_id
              and assignment.function_code =
                  required.function_code
          )
        )
      )
    )
  returning
    personal.user_id,
    personal.capability_code,
    personal.created_at,
    personal.created_by
)
insert into app_portal.audit_events (
  actor_user_id,
  action,
  entity_type,
  entity_id,
  before_data,
  after_data,
  metadata
)
select
  null,
  'USER_CAPABILITY_MIGRATED_TO_TEAM_FUNCTION',
  'user_capabilities',
  deleted.user_id::text,
  jsonb_build_object(
    'capabilityCode', deleted.capability_code,
    'source', 'PERSONAL',
    'createdAt', deleted.created_at,
    'createdBy', deleted.created_by
  ),
  jsonb_build_object(
    'source', 'TEAM_FUNCTION'
  ),
  jsonb_build_object(
    'migration', 'M010-R2',
    'teamCode', 'BUS_ORGA'
  )
from deleted;

comment on table app_portal.team_function_capabilities is
  'M010-R2: teamgebundene Zuordnung organisatorischer Teamfunktionen zu zentralen Fach-Capabilities.';

comment on function app_private.has_capability(uuid, text) is
  'M010-R2 zentrale additive Engine: ROLE OR OFFICE OR TEAM_FUNCTION OR PERSONAL OR ADMIN_OVERRIDE.';

comment on function app_private.user_capability_provenance(uuid) is
  'M010-R2 liefert alle effektiven Capability-Quellen einschließlich TEAM_FUNCTION.';
