-- Plärrdeifl Portal V4
-- Liveticker R1: Navigation nur für berechtigte aktive Portaluser.

alter function app_private.api_bootstrap()
  rename to api_bootstrap_before_liveticker_nav_r1;

create or replace function app_private.api_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_id uuid := auth.uid();
  v_base jsonb := app_private.api_bootstrap_before_liveticker_nav_r1();
  v_can_liveticker boolean := false;
begin
  if v_auth_id is null then
    return v_base;
  end if;

  if coalesce(v_base ->> 'state', '') = 'ACTIVE' then
    v_can_liveticker := app_private.has_capability(v_auth_id, 'liveticker.manage');
    v_base := jsonb_set(
      v_base,
      '{navigation,liveticker}',
      to_jsonb(v_can_liveticker),
      true
    );
  end if;

  return v_base;
end;
$$;

revoke all on function app_private.api_bootstrap() from public, anon, authenticated;
revoke all on function app_private.api_bootstrap_before_liveticker_nav_r1() from public, anon, authenticated;
