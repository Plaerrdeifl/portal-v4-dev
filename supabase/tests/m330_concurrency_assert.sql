\set ON_ERROR_STOP on

do $m330_assert$
begin
  if exists (
    select 1 from app_modules.fanbus_trips
    where id::text like '00000000-0000-4330-9200-%' and status <> 'CANCELLED'
  ) then raise exception 'Not every M330 race ended in terminal CANCELLED.'; end if;
  if exists (
    select 1 from app_modules.fanbus_trips
    where id::text like '00000000-0000-4330-9200-%'
      and (revision < 2 or cancellation_reason <> 'Concurrency-Testabsage')
  ) then raise exception 'Cancellation metadata or revision is inconsistent.'; end if;
  if (select count(*) from app_portal.audit_events
      where action='FANBUS_TRIP_CANCELLED' and entity_id like '00000000-0000-4330-9200-%') <> 5
  then raise exception 'Cancellation audit count is not exactly one per trip.'; end if;
  if (select count(*) from app_private.notification_events
      where notification_type='FANBUS_TRIP_CANCELLED' and entity_id like '00000000-0000-4330-9200-%') <> 5
  then raise exception 'Cancellation event count is not exactly one per trip.'; end if;
end $m330_assert$;

select 'M330_CONCURRENCY_OK' as result;
