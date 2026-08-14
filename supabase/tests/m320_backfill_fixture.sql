\set ON_ERROR_STOP on

insert into app_modules.events (
  id, event_type, title, event_date, event_time, visibility
) values (
  '00000000-0000-4320-a100-000000000001',
  'OTHER', 'M320 Backfill', current_date + 30, time '18:00', 'PUBLIC'
);

insert into app_modules.fanbus_trips (
  id, event_id, departure_at, departure_info,
  registration_opens_at, registration_closes_at,
  price_cents, capacity, privacy_reference, terms_reference, status
) values (
  '00000000-0000-4320-a200-000000000001',
  '00000000-0000-4320-a100-000000000001',
  timestamptz '2026-09-20 08:00:00+02', 'Backfill-Abfahrt',
  timestamptz '2026-08-01 08:00:00+02',
  timestamptz '2026-09-19 08:00:00+02',
  2500, 40, 'privacy-backfill', 'terms-backfill', 'PUBLISHED'
);

insert into app_modules.fanbus_registrations (
  id, trip_id, first_name, last_name, email, bus_preference, source, status,
  privacy_reference, terms_reference, privacy_accepted_at, terms_accepted_at,
  revision, registered_at, cancelled_at, created_at, updated_at
) values
  (
    '00000000-0000-4320-a300-000000000001',
    '00000000-0000-4320-a200-000000000001',
    'Alt', 'Aktiv', 'alt-aktiv@example.invalid', 'PARTY', 'GUEST', 'ACTIVE',
    'privacy-backfill', 'terms-backfill',
    timestamptz '2026-08-02 10:00:00+02',
    timestamptz '2026-08-02 10:00:00+02',
    3, timestamptz '2026-08-02 10:00:00+02', null,
    timestamptz '2026-08-02 10:00:00+02',
    timestamptz '2026-08-03 10:00:00+02'
  ),
  (
    '00000000-0000-4320-a300-000000000002',
    '00000000-0000-4320-a200-000000000001',
    'Alt', 'Storniert', null, 'RUHIG', 'MANUAL', 'CANCELLED',
    'privacy-backfill', 'terms-backfill',
    timestamptz '2026-08-04 10:00:00+02',
    timestamptz '2026-08-04 10:00:00+02',
    4, timestamptz '2026-08-04 10:00:00+02',
    timestamptz '2026-08-05 10:00:00+02',
    timestamptz '2026-08-04 10:00:00+02',
    timestamptz '2026-08-05 10:00:00+02'
  );
