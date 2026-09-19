-- DEV: mirror PROD preseason games into the Liveticker calendar.
-- Keep the existing DEV Erfurt home game's ID to preserve any DEV-only test history.

with existing_erfurt_home as (
  select e.id
  from app_modules.events e
  join app_modules.event_games g on g.event_id = e.id
  where e.event_type = 'GAME'
    and e.event_date = date '2026-09-11'
    and e.event_time = time '20:00'
    and g.home_away = 'HOME'
    and g.opponent_name ilike '%Erfurt%'
  order by e.created_at
  limit 1
)
update app_modules.events e
set title = null,
    description = 'Pre-Season',
    visibility = 'PUBLIC',
    revision = e.revision + 1,
    updated_at = now()
from existing_erfurt_home x
where e.id = x.id;

with existing_erfurt_home as (
  select e.id
  from app_modules.events e
  join app_modules.event_games g on g.event_id = e.id
  where e.event_type = 'GAME'
    and e.event_date = date '2026-09-11'
    and e.event_time = time '20:00'
    and g.home_away = 'HOME'
    and g.opponent_name ilike '%Erfurt%'
  order by e.created_at
  limit 1
)
update app_modules.event_games g
set opponent_name = 'Black Dragons Erfurt'
from existing_erfurt_home x
where g.event_id = x.id;

insert into app_modules.events (
  id, event_type, title, event_date, event_time, end_date, end_time,
  venue, description, visibility, revision, created_at, created_by, updated_at, updated_by
)
values
  ('ad415fa7-cc79-4ff8-b095-88d341a439b0','GAME',null,date '2026-09-12',time '16:00',null,null,'Erfurt','Pre-Season','PUBLIC',1,now(),null,now(),null),
  ('2a6a67df-1174-47b5-ae19-cac9bc1e4272','GAME',null,date '2026-09-18',time '20:00',null,null,null,'Pre-Season','PUBLIC',1,now(),null,now(),null),
  ('0aba8f6a-ab30-405e-9e0c-2f2b23b20c15','GAME',null,date '2026-09-20',time '18:00',null,null,null,'Pre-Season','PUBLIC',1,now(),null,now(),null),
  ('e2cd8261-5d3f-4626-88a3-cdf1adad4e2f','GAME',null,date '2026-09-25',time '20:00',null,null,null,'Pre-Season','PUBLIC',1,now(),null,now(),null),
  ('f768100b-4ec2-41e4-ac80-350f33949f73','GAME',null,date '2026-09-27',time '18:00',null,null,null,'Pre-Season','PUBLIC',1,now(),null,now(),null)
on conflict (id) do update
set event_type = excluded.event_type,
    title = excluded.title,
    event_date = excluded.event_date,
    event_time = excluded.event_time,
    end_date = excluded.end_date,
    end_time = excluded.end_time,
    venue = excluded.venue,
    description = excluded.description,
    visibility = excluded.visibility,
    updated_at = now();

insert into app_modules.event_games (event_id, home_away, opponent_name)
values
  ('ad415fa7-cc79-4ff8-b095-88d341a439b0','AWAY','Black Dragons Erfurt'),
  ('2a6a67df-1174-47b5-ae19-cac9bc1e4272','AWAY','EHC Bayreuth'),
  ('0aba8f6a-ab30-405e-9e0c-2f2b23b20c15','HOME','Chemnitz Crashers'),
  ('e2cd8261-5d3f-4626-88a3-cdf1adad4e2f','HOME','EG Diez-Limburg'),
  ('f768100b-4ec2-41e4-ac80-350f33949f73','HOME','EHC Bayreuth')
on conflict (event_id) do update
set home_away = excluded.home_away,
    opponent_name = excluded.opponent_name;
