\set ON_ERROR_STOP on

do $m320_backfill_assert$
begin
  if (select count(*) from app_modules.fanbus_registrations
      where id in (
        '00000000-0000-4320-a300-000000000001',
        '00000000-0000-4320-a300-000000000002'
      )) <> 2 then
    raise exception 'M310 registration IDs wurden beim Backfill nicht erhalten.';
  end if;
  if exists (
    select 1
    from app_modules.fanbus_registrations as registration
    left join app_modules.fanbus_bookings as booking
      on (booking.id, booking.trip_id) =
        (registration.booking_id, registration.trip_id)
    where registration.id in (
      '00000000-0000-4320-a300-000000000001',
      '00000000-0000-4320-a300-000000000002'
    )
      and (
        registration.booking_id is distinct from registration.id
        or registration.booking_role <> 'PRIMARY'
        or registration.participant_sequence <> 1
        or booking.id is null
        or booking.source <> registration.source
        or booking.created_at <> registration.registered_at
      )
  ) then
    raise exception 'M310 registration wurde nicht als PRIMARY/1-Booking backfilled.';
  end if;
  if not exists (
    select 1 from app_modules.fanbus_registrations
    where id = '00000000-0000-4320-a300-000000000001'
      and status = 'ACTIVE'
      and first_name = 'Alt'
      and last_name = 'Aktiv'
      and email = 'alt-aktiv@example.invalid'
      and bus_preference = 'PARTY'
      and source = 'GUEST'
      and privacy_reference = 'privacy-backfill'
      and terms_reference = 'terms-backfill'
      and revision = 3
      and registered_at = timestamptz '2026-08-02 10:00:00+02'
      and created_at = timestamptz '2026-08-02 10:00:00+02'
      and updated_at = timestamptz '2026-08-03 10:00:00+02'
  ) then
    raise exception 'Relevante ACTIVE-M310-Daten wurden beim Backfill verändert.';
  end if;
  if not exists (
    select 1 from app_modules.fanbus_registrations
    where id = '00000000-0000-4320-a300-000000000002'
      and status = 'CANCELLED'
      and email is null
      and bus_preference = 'RUHIG'
      and source = 'MANUAL'
      and revision = 4
      and cancelled_at = timestamptz '2026-08-05 10:00:00+02'
  ) then
    raise exception 'Relevante CANCELLED-M310-Daten wurden beim Backfill verändert.';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'fanbus_registrations_booking_trip_fk'
  ) then
    raise exception 'Booking-Trip-Integrität fehlt nach der Migration.';
  end if;
end
$m320_backfill_assert$;

select 'M320_BACKFILL_OK' as result;
