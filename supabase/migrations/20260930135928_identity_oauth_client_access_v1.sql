create or replace function app_private.api_identity_oauth_client_access(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_auth uuid := auth.uid();
  v_client_id uuid;
  v_client_name text;
  v_registration_type text;
  v_client_code text := 'UNKNOWN';
  v_allowed boolean := false;
  v_active boolean := false;
begin
  if v_auth is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  begin
    v_client_id := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'clientId', '')), '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Ungültiger OAuth-Client.' using errcode = '22023';
  end;

  if v_client_id is null then
    raise exception 'OAuth-Client fehlt.' using errcode = '22023';
  end if;

  select
    c.client_name,
    c.registration_type::text
  into
    v_client_name,
    v_registration_type
  from auth.oauth_clients as c
  where c.id = v_client_id
    and c.deleted_at is null;

  if not found or v_registration_type <> 'manual' then
    raise exception 'OAuth-Client ist nicht freigegeben.' using errcode = '42501';
  end if;

  select exists (
    select 1
    from app_portal.users as u
    where u.id = v_auth
      and u.status = 'ACTIVE'
  )
  into v_active;

  if not v_active then
    return pg_catalog.jsonb_build_object(
      'clientId', v_client_id,
      'clientName', coalesce(v_client_name, ''),
      'clientCode', v_client_code,
      'allowed', false,
      'reason', 'PORTAL_USER_INACTIVE'
    );
  end if;

  case pg_catalog.lower(pg_catalog.btrim(coalesce(v_client_name, '')))
    when 'nextcloud' then
      v_client_code := 'NEXTCLOUD';
      v_allowed := nextcloud_sync.user_has_access(v_auth);
    when 'wordpress' then
      v_client_code := 'WORDPRESS';
      select exists (
        select 1
        from app_portal.team_memberships as membership
        join app_portal.teams as team
          on team.id = membership.team_id
        where membership.user_id = v_auth
          and membership.is_active = true
          and team.is_active = true
          and team.code = 'SOCIAL_MEDIA'
      )
      into v_allowed;
    else
      v_allowed := false;
  end case;

  return pg_catalog.jsonb_build_object(
    'clientId', v_client_id,
    'clientName', coalesce(v_client_name, ''),
    'clientCode', v_client_code,
    'allowed', v_allowed,
    'reason', case
      when v_allowed then null
      when v_client_code = 'UNKNOWN' then 'CLIENT_NOT_SUPPORTED'
      else 'ACCESS_REQUIRED'
    end
  );
end;
$function$;

revoke all on function app_private.api_identity_oauth_client_access(jsonb)
  from public, anon, authenticated;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_identity_oauth_v1;

create or replace function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_action, ''))
  );
begin
  case v_action
    when 'identity_oauth_client_access' then
      return app_private.api_identity_oauth_client_access(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return app_private.pd_api_dispatch_current_before_identity_oauth_v1(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function app_private.pd_api_dispatch_current_before_identity_oauth_v1(text, jsonb)
  from public, anon, authenticated;
revoke all on function app_private.pd_api_dispatch_current(text, jsonb)
  from public, anon, authenticated;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_identity_oauth_v1;

create or replace function app_private.platform_action_classification(
  p_action text
)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'identity_oauth_client_access' then 'READ'
    else app_private.platform_action_classification_before_identity_oauth_v1(
      p_action
    )
  end;
$function$;

revoke all on function app_private.platform_action_classification_before_identity_oauth_v1(text)
  from public, anon, authenticated;
revoke all on function app_private.platform_action_classification(text)
  from public, anon, authenticated;
