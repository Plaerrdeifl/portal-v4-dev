\set ON_ERROR_STOP on

do $m320_concurrency_assert$
begin
  if (select count(*) from app_modules.fanbus_registrations
      where trip_id = '00000000-0000-4320-9200-000000000001'
        and status = 'ACTIVE') <> 1 then
    raise exception 'Single-Rennen hatte nicht exakt einen ACTIVE-Gewinner.';
  end if;
  if (select count(*) from app_modules.fanbus_registrations
      where trip_id = '00000000-0000-4320-9200-000000000002'
        and status = 'ACTIVE') <> 2 then
    raise exception 'Batch-Rennen hatte nicht exakt ein vollständig aktives Batch.';
  end if;
  if exists (
    select booking_id from app_modules.fanbus_registrations
    where trip_id = '00000000-0000-4320-9200-000000000002'
    group by booking_id having count(distinct status) <> 1
  ) then
    raise exception 'Batch-Rennen erzeugte einen Teilsplit.';
  end if;
  if (select count(*) from app_modules.fanbus_registrations
      where trip_id = '00000000-0000-4320-9200-000000000003'
        and status = 'ACTIVE') <> 1 then
    raise exception 'Promotion-Rennen hatte nicht exakt einen Gewinner.';
  end if;
  if (select count(*) from app_modules.fanbus_registrations
      where trip_id = '00000000-0000-4320-9200-000000000004'
        and status = 'ACTIVE') > 1 then
    raise exception 'Storno/Anmeldung hat die Fahrt überbucht.';
  end if;
  if exists (
    select assignment.bus_id
    from app_modules.fanbus_bus_assignments as assignment
    join app_modules.fanbus_registrations as participant
      on participant.id = assignment.participant_id
    where participant.status = 'ACTIVE'
    group by assignment.bus_id
    having count(*) > 1
  ) then
    raise exception 'Assignment-Rennen hat einen Bus überbucht.';
  end if;
end
$m320_concurrency_assert$;

select 'M320_CONCURRENCY_OK' as result;

