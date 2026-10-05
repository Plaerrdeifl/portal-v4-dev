-- Gate every Nextcloud OAuth token issuance against the current Portal access
-- decision. Stored OAuth consent is intentionally not part of this decision.

create or replace function app_private.identity_oauth_client_access_for_user(
  p_user_id uuid,
  p_client_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_client_name text;
  v_registration_type text;
  v_client_code text := 'UNKNOWN';
  v_allowed boolean := false;
  v_active boolean := false;
  v_reason text;
begin
  if p_client_id is null then
    raise exception 'OAuth-Client fehlt.' using errcode = '22023';
  end if;

  select
    c.client_name,
    c.registration_type::text
  into
    v_client_name,
    v_registration_type
  from auth.oauth_clients as c
  where c.id = p_client_id
    and c.deleted_at is null;

  if not found or v_registration_type <> 'manual' then
    raise exception 'OAuth-Client ist nicht freigegeben.' using errcode = '42501';
  end if;

  case pg_catalog.lower(pg_catalog.btrim(coalesce(v_client_name, '')))
    when 'nextcloud' then
      v_client_code := 'NEXTCLOUD';
    when 'wordpress' then
      v_client_code := 'WORDPRESS';
  end case;

  begin
    select exists (
      select 1
      from app_portal.users as u
      where u.id = p_user_id
        and u.status = 'ACTIVE'
    )
    into v_active;
  exception when others then
    if v_client_code = 'NEXTCLOUD' then
      return pg_catalog.jsonb_build_object(
        'clientId', p_client_id,
        'clientName', coalesce(v_client_name, ''),
        'clientCode', v_client_code,
        'allowed', false,
        'reason', 'ACCESS_CHECK_FAILED'
      );
    end if;
    raise;
  end;

  if not v_active then
    return pg_catalog.jsonb_build_object(
      'clientId', p_client_id,
      'clientName', coalesce(v_client_name, ''),
      'clientCode', v_client_code,
      'allowed', false,
      'reason', 'PORTAL_USER_INACTIVE'
    );
  end if;

  case v_client_code
    when 'NEXTCLOUD' then
      begin
        v_allowed := coalesce(
          nextcloud_sync.user_has_access(p_user_id),
          false
        );
      exception when others then
        -- A failing central access check must never mint a Nextcloud token.
        v_allowed := false;
        v_reason := 'ACCESS_CHECK_FAILED';
      end;
    when 'WORDPRESS' then
      select exists (
        select 1
        from app_portal.team_memberships as membership
        join app_portal.teams as team
          on team.id = membership.team_id
        where membership.user_id = p_user_id
          and membership.is_active = true
          and team.is_active = true
          and team.code = 'SOCIAL_MEDIA'
      )
      into v_allowed;
    else
      v_allowed := false;
  end case;

  return pg_catalog.jsonb_build_object(
    'clientId', p_client_id,
    'clientName', coalesce(v_client_name, ''),
    'clientCode', v_client_code,
    'allowed', v_allowed,
    'reason', case
      when v_allowed then null
      when v_reason is not null then v_reason
      when v_client_code = 'UNKNOWN' then 'CLIENT_NOT_SUPPORTED'
      else 'ACCESS_REQUIRED'
    end
  );
end;
$function$;

revoke all on function app_private.identity_oauth_client_access_for_user(uuid, uuid)
  from public, anon, authenticated, service_role;

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
begin
  if v_auth is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  begin
    v_client_id := nullif(
      pg_catalog.btrim(coalesce(p_payload ->> 'clientId', '')),
      ''
    )::uuid;
  exception when invalid_text_representation then
    raise exception 'Ungültiger OAuth-Client.' using errcode = '22023';
  end;

  if v_client_id is null then
    raise exception 'OAuth-Client fehlt.' using errcode = '22023';
  end if;

  return app_private.identity_oauth_client_access_for_user(
    v_auth,
    v_client_id
  );
end;
$function$;

revoke all on function app_private.api_identity_oauth_client_access(jsonb)
  from public, anon, authenticated, service_role;

create or replace function app_private.custom_access_token_hook(
  p_event jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_client_id_text text := nullif(
    pg_catalog.btrim(coalesce(p_event -> 'claims' ->> 'client_id', '')),
    ''
  );
  v_client_id uuid;
  v_user_id uuid;
  v_access jsonb;
begin
  -- Ordinary Portal tokens have no OAuth client and remain untouched.
  if v_client_id_text is null then
    return p_event;
  end if;

  begin
    v_client_id := v_client_id_text::uuid;
  exception when invalid_text_representation then
    -- Only a positively identified Nextcloud client is restricted here.
    return p_event;
  end;

  begin
    v_user_id := nullif(
      pg_catalog.btrim(coalesce(p_event ->> 'user_id', '')),
      ''
    )::uuid;
  exception when invalid_text_representation then
    -- The helper can still identify the client. A malformed identity therefore
    -- fails closed for Nextcloud without changing other OAuth clients.
    v_user_id := null;
  end;

  begin
    v_access := app_private.identity_oauth_client_access_for_user(
      v_user_id,
      v_client_id
    );
  exception when others then
    -- Unknown, deleted, dynamic, or otherwise unsupported OAuth clients are
    -- outside this work package and must retain their existing behavior.
    return p_event;
  end;

  if coalesce(v_access ->> 'clientCode', '') <> 'NEXTCLOUD' then
    return p_event;
  end if;

  if coalesce((v_access ->> 'allowed')::boolean, false) then
    return p_event;
  end if;

  return pg_catalog.jsonb_build_object(
    'error', pg_catalog.jsonb_build_object(
      'http_code', 403,
      'message', 'Nextcloud access requires a currently active Portal permission.'
    )
  );
end;
$function$;

revoke all on function app_private.custom_access_token_hook(jsonb)
  from public, anon, authenticated, service_role;

grant usage on schema app_private to supabase_auth_admin;
grant execute
  on function app_private.identity_oauth_client_access_for_user(uuid, uuid)
  to supabase_auth_admin;
grant execute
  on function app_private.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

comment on function app_private.identity_oauth_client_access_for_user(uuid, uuid)
  is 'Internal OAuth client access decision for an explicit Portal user and client.';
comment on function app_private.custom_access_token_hook(jsonb)
  is 'Supabase Custom Access Token Hook: fail-closed gate for Nextcloud OAuth token issuance.';
