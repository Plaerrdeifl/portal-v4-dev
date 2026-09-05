-- Plärrdeifl Portal V4
-- Liveticker R1: TEAM_FUNCTION für ausgewählte Mitglieder des Social-Media-Teams.
--
-- Ziel:
-- - reine Social-Media-Teammitgliedschaft verleiht KEIN Liveticker-Recht
-- - die Fachfunktion SOCIAL_LIVETICKER verleiht ausschließlich liveticker.manage
-- - Vergabe erfolgt über das bestehende M010-Teamfunktionsmodell wie bei Bus-Orga
-- - keine automatische Zuweisung an bestehende Mitglieder

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
