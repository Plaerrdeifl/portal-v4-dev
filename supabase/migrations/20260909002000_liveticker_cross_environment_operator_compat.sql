-- Shared DEV/PROD Liveticker operator compatibility after repository convergence.
-- Additive only: one canonical capability gate plus the helper name used by
-- the current graphic-template administration functions.

create or replace function app_private.liveticker_require_operator()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
begin
  v_actor := app_private.require_capability('liveticker.manage');
  return v_actor;
end;
$function$;

create or replace function app_private.liveticker_actor()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select app_private.liveticker_require_operator();
$function$;

revoke all on function app_private.liveticker_require_operator()
  from public, anon, authenticated, service_role;
revoke all on function app_private.liveticker_actor()
  from public, anon, authenticated, service_role;
