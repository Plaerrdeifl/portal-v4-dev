\set ON_ERROR_STOP on

do $m340_concurrency_assert$
begin
  if (
    select landing_count
    from app_modules.fanbus_publishing_place_landing_daily
    where place_id = '00000000-0000-4340-9100-000000000001'
      and day = app_private.fanbus_publishing_berlin_day(statement_timestamp())
  ) is distinct from 20 then
    raise exception 'M340 concurrent Place Landing increments lost updates';
  end if;
end
$m340_concurrency_assert$;

select 'M340_CONCURRENCY_OK' as result;
