create or replace function app_private.liveticker_graphic_job_realtime_wake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'QUEUED' then
    perform realtime.send(
      jsonb_build_object('availableAt', new.available_at),
      'wake',
      'liveticker-graphic-jobs',
      false
    );
  end if;
  return new;
end;
$function$;

revoke all on function app_private.liveticker_graphic_job_realtime_wake()
from public, anon, authenticated, service_role;

drop trigger if exists liveticker_graphic_jobs_realtime_wake
on app_modules.liveticker_graphic_jobs;

create trigger liveticker_graphic_jobs_realtime_wake
after insert or update of status, available_at
on app_modules.liveticker_graphic_jobs
for each row
when (new.status = 'QUEUED')
execute function app_private.liveticker_graphic_job_realtime_wake();

create or replace function app_private.liveticker_whatsapp_job_realtime_wake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'PENDING' then
    perform realtime.send(
      jsonb_build_object('availableAt', new.next_attempt_at),
      'wake',
      'liveticker-whatsapp-jobs',
      false
    );
  end if;
  return new;
end;
$function$;

revoke all on function app_private.liveticker_whatsapp_job_realtime_wake()
from public, anon, authenticated, service_role;

drop trigger if exists liveticker_whatsapp_jobs_realtime_wake
on app_modules.liveticker_whatsapp_jobs;

create trigger liveticker_whatsapp_jobs_realtime_wake
after insert or update of status, next_attempt_at
on app_modules.liveticker_whatsapp_jobs
for each row
when (new.status = 'PENDING')
execute function app_private.liveticker_whatsapp_job_realtime_wake();

create or replace function app_private.liveticker_runtime_control_realtime_wake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_topic text;
begin
  v_topic := case new.worker_code
    when 'LIVETICKER_GRAPHICS' then 'liveticker-graphic-jobs'
    when 'LIVETICKER_WHATSAPP' then 'liveticker-whatsapp-jobs'
    else null
  end;
  if v_topic is not null then
    perform realtime.send('{}'::jsonb, 'wake', v_topic, false);
  end if;
  return new;
end;
$function$;

revoke all on function app_private.liveticker_runtime_control_realtime_wake()
from public, anon, authenticated, service_role;

drop trigger if exists worker_runtime_controls_liveticker_realtime_wake
on app_private.worker_runtime_controls;

create trigger worker_runtime_controls_liveticker_realtime_wake
after update of enabled
on app_private.worker_runtime_controls
for each row
when (
  old.enabled is distinct from new.enabled
  and new.worker_code in ('LIVETICKER_GRAPHICS', 'LIVETICKER_WHATSAPP')
)
execute function app_private.liveticker_runtime_control_realtime_wake();

create or replace function app_private.liveticker_wpp_control_realtime_wake()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform realtime.send('{}'::jsonb, 'wake', 'liveticker-whatsapp-jobs', false);
  return new;
end;
$function$;

revoke all on function app_private.liveticker_wpp_control_realtime_wake()
from public, anon, authenticated, service_role;

drop trigger if exists liveticker_wpp_runtime_control_realtime_wake
on app_private.liveticker_wpp_runtime_control;

create trigger liveticker_wpp_runtime_control_realtime_wake
after update of desired_connected
on app_private.liveticker_wpp_runtime_control
for each row
when (old.desired_connected is distinct from new.desired_connected)
execute function app_private.liveticker_wpp_control_realtime_wake();
