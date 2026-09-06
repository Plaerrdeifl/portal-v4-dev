\set ON_ERROR_STOP on

do $m340_slice3_concurrency$
declare
  v_processing integer;
  v_attempts integer;
begin
  select count(*)::integer
    into v_processing
  from app_modules.fanbus_publishing_jobs
  where environment = app_private.platform_release_environment()
    and status = 'PROCESSING';

  select coalesce(sum(attempt_count), 0)::integer
    into v_attempts
  from app_modules.fanbus_publishing_jobs
  where environment = app_private.platform_release_environment();

  if v_processing <> 1 or v_attempts <> 1 then
    raise exception
      'M340 Slice 3 concurrency failed: processing=%, attempts=%',
      v_processing,
      v_attempts;
  end if;
end
$m340_slice3_concurrency$;
