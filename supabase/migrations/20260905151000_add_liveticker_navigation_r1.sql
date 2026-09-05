-- Plärrdeifl Portal V4
-- Liveticker R1: Navigation nur für berechtigte aktive Portaluser.
-- Die Berechtigung wird innerhalb des Social-Media-Teams als Fachfunktion
-- vergeben. Reine Teammitgliedschaft reicht ausdrücklich nicht.

alter function app_private.api_bootstrap()
  rename to api_bootstrap_before_liveticker_nav_r1;

create or replace function app_private.api_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_id uuid := auth.uid();
  v_base jsonb := app_private.api_bootstrap_before_liveticker_nav_r1();
  v_can_liveticker boolean := false;
begin
  if v_auth_id is null then
    return v_base;
  end if;

  if coalesce(v_base ->> 'state', '') = 'ACTIVE' then
    v_can_liveticker := app_private.has_capability(v_auth_id, 'liveticker.manage');
    v_base := jsonb_set(
      v_base,
      '{navigation,liveticker}',
      to_jsonb(v_can_liveticker),
      true
    );
  end if;

  return v_base;
end;
$$;

revoke all on function app_private.api_bootstrap() from public, anon, authenticated;
revoke all on function app_private.api_bootstrap_before_liveticker_nav_r1() from public, anon, authenticated;

-- ============================================================
-- Social-Media -> Liveticker-Fachfunktion
-- ============================================================
-- Keine automatische Zuweisung an bestehende Teammitglieder.
-- Das bestehende generische Team-UI zeigt die Funktion nur im
-- Social-Media-Team an und verwaltet sie über set_team_functions.

do $$
begin
  if not exists (
    select 1
    from app_portal.teams
    where code = 'SOCIAL_MEDIA'
      and is_active
  ) then
    raise exception 'LIVETICKER_SOCIAL_MEDIA_TEAM_MISSING'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from app_portal.capabilities
    where code = 'liveticker.manage'
      and is_active
  ) then
    raise exception 'LIVETICKER_CAPABILITY_MISSING'
      using errcode = 'P0002';
  end if;
end;
$$;

insert into app_portal.team_functions (
  code,
  name,
  description,
  is_active
)
values (
  'SOCIAL_LIVETICKER',
  'Liveticker',
  'Liveticker bedienen sowie Liveticker-Teams und Kader verwalten.',
  true
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

insert into app_portal.team_function_capabilities (
  team_id,
  function_code,
  capability_code,
  is_active,
  created_by
)
select
  team.id,
  'SOCIAL_LIVETICKER',
  'liveticker.manage',
  true,
  null
from app_portal.teams as team
where team.code = 'SOCIAL_MEDIA'
on conflict (team_id, function_code, capability_code) do update
set is_active = true;
