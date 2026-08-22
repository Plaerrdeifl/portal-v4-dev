-- Plaerrdeifl Portal V4
-- P800 / M010-R2
-- F1-E1: M020 Fanbus-Orga-Empfänger dynamisch aus dem
-- Team-/Berechtigungsmodell ableiten.
--
-- Ziel:
-- FANBUS_REGISTRATION_CREATED / FANBUS_REGISTRATION_CANCELLED
-- verwenden weiterhin den bestehenden M020-Expander.
--
-- Dessen zentraler Resolver für
-- notifications.m020.fanbusOrganization.userIds
-- wird jedoch nicht mehr aus der statischen UUID-Liste gespeist.
--
-- Empfänger sind DISTINCT aktive Portaluser, die:
-- - aktive Mitgliedschaft im aktiven Team BUS_ORGA besitzen
-- - effektiv fanbus.registrations.manage besitzen
--
-- Damit erhalten:
-- - Teilnehmermanager der BUS_ORGA die internen Meldungen
--
-- Nicht allein dadurch erhalten:
-- - reine Fahrtmanager
-- - reine Fahrtbetrieb-Nutzer
-- - reine Bezahlt-Marker-Nutzer
-- - registrations.manage-Nutzer außerhalb BUS_ORGA
--
-- Andere M020-Konfigurationspfade bleiben unverändert.

create or replace function app_private.notification_config_user_ids(
  p_path text[]
)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_value jsonb;
  v_item text;
  v_id uuid;
begin
  if p_path =
     array[
       'fanbusOrganization',
       'userIds'
     ]::text[] then

    return query
      select distinct
        membership.user_id

      from app_portal.team_memberships
        as membership

      join app_portal.teams
        as team
        on team.id = membership.team_id
       and team.is_active
       and team.code = 'BUS_ORGA'

      join app_portal.users
        as portal_user
        on portal_user.id = membership.user_id
       and portal_user.status = 'ACTIVE'

      where membership.is_active
        and app_private.has_capability(
          membership.user_id,
          'fanbus.registrations.manage'
        )

      order by membership.user_id;

    return;
  end if;

  select setting.value #> p_path
  into v_value
  from app_portal.settings
    as setting
  where setting.key = 'notifications.m020';

  if jsonb_typeof(v_value) <> 'array' then
    return;
  end if;

  for v_item in
    select jsonb_array_elements_text(
      v_value
    )
  loop
    begin
      v_id := v_item::uuid;
    exception
      when others then
        continue;
    end;

    if exists (
      select 1
      from app_portal.users
        as portal_user
      where portal_user.id = v_id
        and portal_user.status = 'ACTIVE'
    ) then
      return next v_id;
    end if;
  end loop;
end;
$$;

revoke all on function
  app_private.notification_config_user_ids(text[])
from public, anon, authenticated, service_role;

grant execute on function
  app_private.notification_config_user_ids(text[])
to postgres;

comment on function
  app_private.notification_config_user_ids(text[])
is
  'M010-R2: fanbusOrganization.userIds wird dynamisch aus aktivem BUS_ORGA-Team plus effektivem fanbus.registrations.manage ermittelt; andere M020-Konfigurationspfade bleiben statisch.';
