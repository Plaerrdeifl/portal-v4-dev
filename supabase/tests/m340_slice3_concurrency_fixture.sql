\set ON_ERROR_STOP on

update app_portal.settings
set
  value = jsonb_build_object('mode', 'NORMAL', 'environment', 'LOCAL'),
  revision = revision + 1,
  updated_at = now(),
  updated_by = null
where key = 'platform.mode';

insert into app_modules.fanbus_publishing_places(
  id,
  slug,
  display_name
)
values (
  '00000000-0000-4340-b100-000000000001',
  'slice3-concurrency',
  'Slice 3 Concurrency'
);

insert into app_modules.events(
  id,
  event_type,
  title,
  event_date,
  event_time,
  venue,
  visibility
)
select
  ('00000000-0000-4340-b200-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
  'OTHER',
  'Slice 3 Concurrency ' || value,
  (now() at time zone 'Europe/Berlin')::date + value,
  time '18:00',
  'Slice 3 Concurrency',
  'PUBLIC'
from pg_catalog.generate_series(1, 10) as value;

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
  ('00000000-0000-4340-b300-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
  event.id,
  (event.event_date - 1 + time '12:00') at time zone 'Europe/Berlin',
  'M340 Slice 3 Concurrency',
  now() - interval '1 day',
  (event.event_date - 2 + time '20:00') at time zone 'Europe/Berlin',
  2500,
  20,
  'privacy-v1',
  'terms-v1',
  'PUBLISHED'
from pg_catalog.generate_series(1, 10) as value
join app_modules.events as event
  on event.id = (
    '00000000-0000-4340-b200-' || pg_catalog.lpad(value::text, 12, '0')
  )::uuid;

insert into app_modules.fanbus_publishing_jobs(
  environment,
  trip_id,
  event_id,
  place_id,
  request_snapshot
)
select
  app_private.platform_release_environment(),
  trip.id,
  trip.event_id,
  '00000000-0000-4340-b100-000000000001',
  jsonb_build_object(
    'schemaVersion', 1,
    'shortlinkPath', '/ontour/slice3-concurrency',
    'place', jsonb_build_object(
      'id', '00000000-0000-4340-b100-000000000001',
      'slug', 'slice3-concurrency',
      'displayName', 'Slice 3 Concurrency'
    ),
    'trip', jsonb_build_object('tripId', trip.id, 'tripStatus', 'PUBLISHED'),
    'boardingStops', '[]'::jsonb
  )
from app_modules.fanbus_trips as trip
where trip.id::text like '00000000-0000-4340-b300-%';
