-- Plaerrdeifl Portal V4
-- P800 / M010-R2
-- F1-C1: Mitgliedschaft von Portalrolle entkoppeln.
--
-- Fachmodell:
-- Mitgliedschaft = expliziter user_member_link auf ACTIVE member.
-- PORTAL_USER = neutrale Standardrolle.
-- MEMBER wird nach verlustfreier Migration deaktiviert, nicht gelöscht.
--
-- members.read bleibt ein privilegiertes Leserecht für fremde
-- Mitgliedsdaten und wird NICHT auf PORTAL_USER übertragen.

-- ============================================================
-- 1. Sicherer Self-Snapshot für normale Mitglieder
-- ============================================================

create function app_private.api_fanclub_member_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_member app_fanclub.members%rowtype;
begin
  select member.*
  into v_member
  from app_portal.user_member_links as link
  join app_fanclub.members as member
    on member.id = link.member_id
   and member.status = 'ACTIVE'
  where link.user_id = v_actor;

  if v_member.id is null then
    raise exception
      'Aktive Mitgliedsverknüpfung erforderlich.'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'scope',
    'SELF',

    'members',
    jsonb_build_array(
      jsonb_build_object(
        'id',
        v_member.id,

        'memberCode',
        v_member.member_code,

        'firstName',
        v_member.first_name,

        'lastName',
        v_member.last_name,

        'birthDate',
        v_member.birth_date,

        'email',
        v_member.email,

        'phone',
        v_member.phone,

        'street',
        v_member.street,

        'houseNumber',
        v_member.house_number,

        'postalCode',
        v_member.postal_code,

        'city',
        v_member.city,

        'joinedOn',
        v_member.joined_on,

        'leftOn',
        v_member.left_on,

        'status',
        v_member.status,

        'notes',
        v_member.notes,

        'revision',
        v_member.revision
      )
    ),

    'offices',
    (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'code',
            office.code,

            'label',
            office.label,

            'sortOrder',
            office.sort_order,

            'memberId',
            office.member_id,

            'memberCode',
            office_member.member_code,

            'memberName',
            case
              when office_member.id is null
                then ''
              else
                office_member.first_name
                || ' '
                || office_member.last_name
            end,

            'memberPhone',
            coalesce(
              office_member.phone,
              ''
            ),

            'revision',
            office.revision
          )
          order by office.sort_order
        ),
        '[]'::jsonb
      )
      from app_fanclub.office_slots as office
      left join app_fanclub.members as office_member
        on office_member.id = office.member_id
       and office_member.status = 'ACTIVE'
    ),

    'contributionSeasons',
    '[]'::jsonb,

    'contributionClasses',
    '[]'::jsonb,

    'financeAccounts',
    '[]'::jsonb,

    'memberContributions',
    '[]'::jsonb,

    'contributionPaymentReports',
    '[]'::jsonb,

    'financeEntries',
    '[]'::jsonb,

    'canViewMemberDetails',
    false,

    'canManageMembers',
    false,

    'canManageOffices',
    false,

    'canReadFinance',
    false,

    'canManageFinance',
    false,

    'canReportPayments',
    false
  );
end;
$$;

-- ============================================================
-- 2. Bestehenden privilegierten Fanclub-Snapshot bewahren
-- ============================================================
--
-- Der aktuell produktive Funktionskörper bleibt unverändert erhalten.
-- Nur ein neuer Dispatcher wird davor gesetzt.

alter function app_private.api_fanclub_snapshot()
  rename to api_fanclub_snapshot_before_m010_r2;

create function app_private.api_fanclub_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
begin
  if app_private.has_capability(
    v_actor,
    'members.read'
  ) then
    return
      app_private.api_fanclub_snapshot_before_m010_r2();
  end if;

  return
    app_private.api_fanclub_member_snapshot();
end;
$$;

-- ============================================================
-- 3. Bootstrap: Mitglied nur bei ACTIVE-Ziel
-- ============================================================
--
-- Der bestehende komplette Bootstrap inklusive Profiländerungsmodell
-- wird erhalten. M010-R2 normalisiert ausschließlich member/navigation.

alter function app_private.api_bootstrap()
  rename to api_bootstrap_before_m010_r2;

create function app_private.api_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- ============================================================
-- 4. Sicherheitsvorbedingungen der Rollenbereinigung
-- ============================================================

do $$
declare
  v_member_role_id uuid;
  v_portal_user_role_id uuid;
begin
  select role.id
  into v_member_role_id
  from app_portal.portal_roles as role
  where role.code = 'MEMBER';

  if v_member_role_id is null then
    raise exception
      'M010_R2_MEMBER_ROLE_MISSING'
      using errcode = 'P0002';
  end if;

  select role.id
  into v_portal_user_role_id
  from app_portal.portal_roles as role
  where role.code = 'PORTAL_USER'
    and role.is_active;

  if v_portal_user_role_id is null then
    raise exception
      'M010_R2_ACTIVE_PORTAL_USER_ROLE_MISSING'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from app_portal.role_capabilities
      as role_capability
    join app_portal.capabilities
      as capability
      on capability.code =
         role_capability.capability_code
     and capability.is_active
    where role_capability.role_id =
          v_portal_user_role_id
      and role_capability.capability_code =
          'portal.access'
  ) then
    raise exception
      'M010_R2_PORTAL_USER_ACCESS_MISSING'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from app_portal.users as portal_user
    where portal_user.role_id = v_member_role_id
      and not exists (
        select 1
        from app_portal.user_member_links as link
        join app_fanclub.members as member
          on member.id = link.member_id
         and member.status = 'ACTIVE'
        where link.user_id = portal_user.id
      )
  ) then
    raise exception
      'M010_R2_MEMBER_ROLE_USER_WITHOUT_ACTIVE_MEMBER_LINK'
      using errcode = '23514';
  end if;
end;
$$;

-- ============================================================
-- 5. MEMBER-Benutzer -> PORTAL_USER
-- ============================================================
--
-- Status, Mitgliedslink, Offices, PERSONAL-Rechte, Teams usw.
-- bleiben unverändert. Nur role_id + revision ändern sich.

with role_ids as (
  select
    (
      select id
      from app_portal.portal_roles
      where code = 'MEMBER'
    ) as member_role_id,

    (
      select id
      from app_portal.portal_roles
      where code = 'PORTAL_USER'
        and is_active
    ) as portal_user_role_id
),
migrated as (
  update app_portal.users as portal_user
  set
    role_id = role_ids.portal_user_role_id,
    revision = portal_user.revision + 1
  from role_ids
  where portal_user.role_id =
        role_ids.member_role_id
  returning
    portal_user.id,
    role_ids.member_role_id as old_role_id,
    role_ids.portal_user_role_id as new_role_id,
    portal_user.status,
    portal_user.revision - 1 as old_revision,
    portal_user.revision as new_revision
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
  'USER_ROLE_MIGRATED',
  'portal_user',
  migrated.id::text,

  jsonb_build_object(
    'roleId',
    migrated.old_role_id,

    'status',
    migrated.status,

    'revision',
    migrated.old_revision
  ),

  jsonb_build_object(
    'roleId',
    migrated.new_role_id,

    'status',
    migrated.status,

    'revision',
    migrated.new_revision
  ),

  jsonb_build_object(
    'migration',
    'M010-R2',

    'fromRoleCode',
    'MEMBER',

    'toRoleCode',
    'PORTAL_USER'
  )
from migrated;

-- ============================================================
-- 6. MEMBER-Rolle deaktivieren
-- ============================================================

with retired as (
  update app_portal.portal_roles
  set
    is_active = false,
    revision = revision + 1
  where code = 'MEMBER'
    and is_active
  returning
    id,
    revision - 1 as old_revision,
    revision as new_revision
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
  'PORTAL_ROLE_RETIRED',
  'portal_role',
  retired.id::text,

  jsonb_build_object(
    'code',
    'MEMBER',

    'active',
    true,

    'revision',
    retired.old_revision
  ),

  jsonb_build_object(
    'code',
    'MEMBER',

    'active',
    false,

    'revision',
    retired.new_revision
  ),

  jsonb_build_object(
    'migration',
    'M010-R2',

    'replacementRoleCode',
    'PORTAL_USER',

    'membershipSource',
    'user_member_links'
  )
from retired;

-- ============================================================
-- 7. Postconditions
-- ============================================================

do $$
begin
  if exists (
    select 1
    from app_portal.users as portal_user
    join app_portal.portal_roles as role
      on role.id = portal_user.role_id
    where role.code = 'MEMBER'
  ) then
    raise exception
      'M010_R2_MEMBER_ROLE_USERS_REMAIN'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from app_portal.portal_roles
    where code = 'MEMBER'
      and is_active
  ) then
    raise exception
      'M010_R2_MEMBER_ROLE_STILL_ACTIVE'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from app_portal.portal_roles
    where code = 'MEMBER'
  ) then
    raise exception
      'M010_R2_MEMBER_ROLE_HISTORY_LOST'
      using errcode = '23514';
  end if;
end;
$$;

-- ============================================================
-- 8. Privilege hardening
-- ============================================================

revoke all on function
  app_private.api_fanclub_member_snapshot(),
  app_private.api_fanclub_snapshot_before_m010_r2(),
  app_private.api_fanclub_snapshot(),
  app_private.api_bootstrap_before_m010_r2(),
  app_private.api_bootstrap()
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_fanclub_member_snapshot(),
  app_private.api_fanclub_snapshot_before_m010_r2(),
  app_private.api_fanclub_snapshot(),
  app_private.api_bootstrap_before_m010_r2(),
  app_private.api_bootstrap()
to postgres;

comment on function
  app_private.api_fanclub_member_snapshot()
is
  'M010-R2: Self-only Fanclub-Snapshot für Portaluser mit explizitem Link auf ein ACTIVE-Mitglied.';

comment on function
  app_private.api_fanclub_snapshot()
is
  'M010-R2: members.read liefert den bestehenden Vollsnapshot; normale aktive Mitglieder erhalten ausschließlich den Self-Snapshot.';

comment on function
  app_private.api_bootstrap()
is
  'M010-R2: Mitgliedsidentität und Fanclub-Navigation basieren ausschließlich auf Link zu ACTIVE-Mitglied.';
