-- Plaerrdeifl Portal V4
-- Reproducible migration prerequisite for M010-R2.
--
-- BUS_ORGA originally existed as operator-created DEV data before the
-- M010-R2 authorization package was applied. Fresh databases do not contain
-- that operational row, while the following migration requires it.
-- Keep existing teams untouched and only materialize the required reference
-- team when the migration chain starts from an empty database.

insert into app_portal.teams (
  code,
  name,
  description,
  is_active
)
values (
  'BUS_ORGA',
  'Bus-Orga',
  'Organisation der Fanbusfahrten.',
  true
)
on conflict (code) do nothing;
