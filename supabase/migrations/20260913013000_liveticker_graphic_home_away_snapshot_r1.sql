create or replace function app_private.liveticker_graphic_job_attach_home_away()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_home_away text;
begin
  select g.home_away into v_home_away
  from app_modules.event_games g
  where g.event_id=new.event_id;

  if v_home_away not in ('HOME','AWAY') then
    raise exception 'LIVETICKER_GRAPHIC_HOME_AWAY_MISSING' using errcode='22023';
  end if;

  new.request_snapshot:=jsonb_set(
    coalesce(new.request_snapshot,'{}'::jsonb),
    '{homeAway}',
    to_jsonb(v_home_away),
    true
  );
  return new;
end;
$$;

drop trigger if exists liveticker_graphic_jobs_home_away on app_modules.liveticker_graphic_jobs;
create trigger liveticker_graphic_jobs_home_away
before insert on app_modules.liveticker_graphic_jobs
for each row execute function app_private.liveticker_graphic_job_attach_home_away();

revoke all on function app_private.liveticker_graphic_job_attach_home_away() from public,anon,authenticated,service_role;
