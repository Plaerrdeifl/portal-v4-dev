-- Nextcloud OAuth access follows the same Portal-derived groups as the
-- Nextcloud runtime sync: Social Media and current board members.

create or replace function nextcloud_sync.user_has_access(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p_user_id is not null
    and exists (
      select 1
      from nextcloud_sync.portal_group_members() as member
      where member.user_id = p_user_id
    );
$function$;

revoke all on function nextcloud_sync.user_has_access(uuid) from public;

create or replace function app_private.api_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_auth uuid := auth.uid();
  v_base jsonb :=
    app_private.api_bootstrap_before_liveticker_prod_r1();
  v_can_liveticker boolean := false;
  v_nextcloud_access boolean := false;
begin
  if v_auth is not null
     and coalesce(v_base ->> 'state', '') = 'ACTIVE' then
    v_can_liveticker :=
      app_private.has_capability(
        v_auth,
        'liveticker.manage'
      );

    v_nextcloud_access :=
      nextcloud_sync.user_has_access(v_auth);
  end if;

  v_base := jsonb_set(
    v_base,
    '{navigation,liveticker}',
    to_jsonb(v_can_liveticker),
    true
  );

  return jsonb_set(
    v_base,
    '{nextcloudAccess}',
    to_jsonb(v_nextcloud_access),
    true
  );
end;
$function$;
