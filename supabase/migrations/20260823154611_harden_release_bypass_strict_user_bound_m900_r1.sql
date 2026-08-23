-- Plärrdeifl Portal V4
-- P900 / M900-R1 additive hardening: Master-Entscheidung B

begin;

-- Fail closed. Existing unbound rows must be reviewed operationally; this
-- migration must never delete, revoke or silently bind them.
do $strict_user_bound_preflight$
begin
  if exists (
    select 1
    from app_private.platform_release_bypass_tokens as bypass
    where bypass.bound_user_id is null
  ) then
    raise exception 'PLATFORM_RELEASE_BYPASS_UNBOUND_ROWS_EXIST'
      using errcode = '23502';
  end if;
end;
$strict_user_bound_preflight$;

alter table app_private.platform_release_bypass_tokens
  alter column bound_user_id set not null;

alter table app_private.platform_release_bypass_tokens enable row level security;

-- CREATE OR REPLACE preserves an existing argument default when the new
-- declaration omits it. Recreate this postgres-only function without CASCADE
-- so the catalog contract is genuinely mandatory and dependencies fail closed.
drop function app_private.create_platform_release_bypass(
  text, text, timestamptz, uuid
);

create function app_private.create_platform_release_bypass(
  p_environment text,
  p_run_id text,
  p_expires_at timestamptz,
  p_bound_user_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_environment text := pg_catalog.upper(
    pg_catalog.btrim(coalesce(p_environment, ''))
  );
  v_run_id text := pg_catalog.btrim(coalesce(p_run_id, ''));
  v_token text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  if v_environment !~ '^[A-Z][A-Z0-9_-]{1,31}$'
     or v_environment is distinct from app_private.platform_release_environment()
     or v_run_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$'
     or p_expires_at is null
     or p_expires_at <= pg_catalog.now()
     or p_expires_at > pg_catalog.now() + interval '1 hour'
     or p_bound_user_id is null
     or not exists (
       select 1
       from app_portal.users as portal_user
       where portal_user.id = p_bound_user_id
         and portal_user.status = 'ACTIVE'
     ) then
    raise exception 'PLATFORM_RELEASE_BYPASS_INVALID' using errcode = '22023';
  end if;

  insert into app_private.platform_release_bypass_tokens (
    token_digest,
    environment,
    run_id,
    bound_user_id,
    expires_at
  )
  values (
    pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
      'hex'
    ),
    v_environment,
    v_run_id,
    p_bound_user_id,
    p_expires_at
  )
  returning id into v_id;

  perform app_private.log_audit(
    null,
    'PLATFORM_RELEASE_BYPASS_CREATED',
    'platform_release_bypass',
    v_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'active', true,
      'expiresAt', p_expires_at
    ),
    pg_catalog.jsonb_build_object(
      'environment', v_environment,
      'runId', v_run_id,
      'boundUserId', p_bound_user_id,
      'actorType', 'PORTAL_USER',
      'operatorRole', session_user
    )
  );

  return pg_catalog.jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'environment', v_environment,
    'runId', v_run_id,
    'expiresAt', p_expires_at,
    'boundUserId', p_bound_user_id
  );
end;
$function$;

create or replace function app_private.try_platform_release_bypass(
  p_action text,
  p_actor uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_action, ''))
  );
  v_headers jsonb;
  v_token text;
  v_environment text;
  v_run_id text;
  v_bypass app_private.platform_release_bypass_tokens%rowtype;
begin
  -- Public submissions are never release-bypass-capable, even if a future
  -- wrapper accidentally supplies an actor.
  if p_actor is null
     or v_action = any(array[
       'm150_submit_membership_application',
       'm310_submit_guest_fanbus_registration'
     ]::text[])
     or not exists (
       select 1
       from app_portal.users as portal_user
       where portal_user.id = p_actor
         and portal_user.status = 'ACTIVE'
     ) then
    return false;
  end if;

  begin
    v_headers := nullif(
      pg_catalog.current_setting('request.headers', true),
      ''
    )::jsonb;
  exception when others then
    return false;
  end;

  if pg_catalog.jsonb_typeof(v_headers) <> 'object' then
    return false;
  end if;

  v_token := pg_catalog.btrim(
    coalesce(v_headers ->> 'x-pd-release-bypass', '')
  );
  v_environment := pg_catalog.upper(
    pg_catalog.btrim(
      coalesce(v_headers ->> 'x-pd-environment', '')
    )
  );
  v_run_id := pg_catalog.btrim(
    coalesce(v_headers ->> 'x-pd-release-run', '')
  );

  if v_token !~ '^[0-9a-f]{64}$'
     or v_environment !~ '^[A-Z][A-Z0-9_-]{1,31}$'
     or v_run_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$'
     or v_environment is distinct from app_private.platform_release_environment() then
    return false;
  end if;

  select bypass.*
  into v_bypass
  from app_private.platform_release_bypass_tokens as bypass
  where bypass.token_digest = pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(v_token, 'UTF8'), 'sha256'),
      'hex'
    )
    and bypass.environment = v_environment
    and bypass.run_id = v_run_id
    and bypass.bound_user_id = p_actor
    and bypass.is_active
    and bypass.revoked_at is null
    and bypass.expires_at > pg_catalog.now()
  for update;

  if not found then
    return false;
  end if;

  perform app_private.log_audit(
    p_actor,
    'PLATFORM_RELEASE_BYPASS_USED',
    'platform_release_bypass',
    v_bypass.id::text,
    null,
    null,
    pg_catalog.jsonb_build_object(
      'action', v_action,
      'environment', v_environment,
      'runId', v_run_id,
      'boundUserId', v_bypass.bound_user_id,
      'actorType', 'PORTAL_USER',
      'bypassUsed', true
    )
  );

  return true;
end;
$function$;

create or replace function app_private.require_platform_user_write_allowed(
  p_action text,
  p_actor uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_state record;
begin
  select runtime.*
  into v_state
  from app_private.platform_runtime_state() as runtime;

  if v_state.is_valid is distinct from true then
    raise exception 'PLATFORM_WRITE_UNAVAILABLE' using errcode = 'P0901';
  end if;

  if v_state.mode = 'NORMAL' then
    return;
  end if;

  if p_actor is not null
     and app_private.try_platform_release_bypass(p_action, p_actor) then
    return;
  end if;

  case v_state.mode
    when 'READ_ONLY' then
      raise exception 'PLATFORM_READ_ONLY' using errcode = 'P0902';
    when 'MAINTENANCE' then
      raise exception 'PLATFORM_MAINTENANCE' using errcode = 'P0903';
    else
      raise exception 'PLATFORM_WRITE_UNAVAILABLE' using errcode = 'P0901';
  end case;
end;
$function$;

create or replace function app_private.revoke_platform_release_bypass(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_bypass app_private.platform_release_bypass_tokens%rowtype;
begin
  update app_private.platform_release_bypass_tokens as bypass
  set is_active = false,
      revoked_at = pg_catalog.now()
  where bypass.id = p_id
    and bypass.is_active
  returning bypass.* into v_bypass;

  if not found then
    return false;
  end if;

  perform app_private.log_audit(
    null,
    'PLATFORM_RELEASE_BYPASS_REVOKED',
    'platform_release_bypass',
    v_bypass.id::text,
    pg_catalog.jsonb_build_object('active', true),
    pg_catalog.jsonb_build_object(
      'active', false,
      'revokedAt', v_bypass.revoked_at
    ),
    pg_catalog.jsonb_build_object(
      'environment', v_bypass.environment,
      'runId', v_bypass.run_id,
      'boundUserId', v_bypass.bound_user_id,
      'actorType', 'PORTAL_USER',
      'operatorRole', session_user
    )
  );

  return true;
end;
$function$;

revoke all on table app_private.platform_release_bypass_tokens
from public, anon, authenticated, service_role;

revoke all on function
  app_private.create_platform_release_bypass(text, text, timestamptz, uuid),
  app_private.try_platform_release_bypass(text, uuid),
  app_private.require_platform_user_write_allowed(text, uuid),
  app_private.revoke_platform_release_bypass(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.create_platform_release_bypass(text, text, timestamptz, uuid),
  app_private.try_platform_release_bypass(text, uuid),
  app_private.require_platform_user_write_allowed(text, uuid),
  app_private.revoke_platform_release_bypass(uuid)
to postgres;

comment on table app_private.platform_release_bypass_tokens is
  'M900-R1 kurzlebige, zwingend ACTIVE-Portaluser-gebundene Release-Testfreigaben; nur SHA-256-Digests, nie Roh-Tokens.';
comment on function app_private.create_platform_release_bypass(text, text, timestamptz, uuid) is
  'M900-R1 Ops-only Tokenausgabe, zwingend an genau einen ACTIVE Portaluser gebunden, maximal eine Stunde.';
comment on function app_private.try_platform_release_bypass(text, uuid) is
  'M900-R1 strict user-bound Pruefung; kein anonymer oder oeffentlicher M150/M310-Bypass.';
comment on function app_private.require_platform_user_write_allowed(text, uuid) is
  'M900-R1 zentraler User-Mutationsguard mit strict user-bound Release-Test-Bypass.';

commit;
