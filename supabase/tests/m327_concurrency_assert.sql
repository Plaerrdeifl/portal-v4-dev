\set ON_ERROR_STOP on

do $assert$
begin
  if (select count(*) from app_modules.fanbus_registrations where booking_id='00000000-0000-4328-8500-000000000001') <> 3 then
    raise exception 'M327_C1_LOST_OR_DUPLICATE_INSERT';
  end if;
  if (select count(distinct participant_sequence) from app_modules.fanbus_registrations where booking_id='00000000-0000-4328-8500-000000000001') <> 3 then
    raise exception 'M327_C1_SEQUENCE_COLLISION';
  end if;
  if exists(select 1 from app_modules.fanbus_registrations where booking_id='00000000-0000-4328-8500-000000000001' and status<>'ACTIVE') then
    raise exception 'M327_C1_CAPACITY_OUTCOME_WRONG';
  end if;
  if (select count(*) from app_private.notification_events where notification_type='FANBUS_BOOKING_EXTENDED') <> 2 then
    raise exception 'M327_C1_NOTIFICATION_COUNT_WRONG';
  end if;
  if (select revision from app_modules.fanbus_registrations where id='00000000-0000-4328-8600-000000000001') <> 2 then
    raise exception 'M327_C2_CAS_REVISION_WRONG';
  end if;
end;
$assert$;
