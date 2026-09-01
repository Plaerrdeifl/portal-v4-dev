begin;

-- Der Plattformmodus ist Betriebszustand und darf innerhalb lang laufender
-- Requests nicht auf einem STABLE-Snapshot stehen bleiben. Fehlende JSON-Werte
-- werden mit IS DISTINCT FROM explizit behandelt (SQL-NULL darf nie gültig sein).
create or replace function app_private.platform_runtime_state()
returns table (
  mode text,
  message text,
  expected_end timestamptz,
  revision integer,
  is_valid boolean,
  error_code text
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_value jsonb;
  v_revision integer;
  v_mode text;
  v_message text;
  v_expected_end timestamptz;
  v_expected_end_text text;
begin
  select setting.value, setting.revision
  into v_value, v_revision
  from app_portal.settings as setting
  where setting.key = 'platform.mode';

  if not found
     or v_revision < 1
     or jsonb_typeof(v_value) is distinct from 'object'
     or jsonb_typeof(v_value -> 'mode') is distinct from 'string' then
    return query select
      'MAINTENANCE'::text, null::text, null::timestamptz, v_revision,
      false, 'PLATFORM_WRITE_UNAVAILABLE'::text;
    return;
  end if;

  v_mode := v_value ->> 'mode';
  if v_mode is null or v_mode not in ('NORMAL', 'READ_ONLY', 'MAINTENANCE') then
    return query select
      'MAINTENANCE'::text, null::text, null::timestamptz, v_revision,
      false, 'PLATFORM_WRITE_UNAVAILABLE'::text;
    return;
  end if;

  if v_value ? 'message' then
    if v_value -> 'message' = 'null'::jsonb then
      v_message := null;
    elsif jsonb_typeof(v_value -> 'message') = 'string' then
      v_message := nullif(btrim(v_value ->> 'message'), '');
    else
      return query select
        'MAINTENANCE'::text, null::text, null::timestamptz, v_revision,
        false, 'PLATFORM_WRITE_UNAVAILABLE'::text;
      return;
    end if;
  end if;

  if v_value ? 'expectedEnd' then
    if v_value -> 'expectedEnd' = 'null'::jsonb then
      v_expected_end := null;
    elsif jsonb_typeof(v_value -> 'expectedEnd') is distinct from 'string' then
      return query select
        'MAINTENANCE'::text, null::text, null::timestamptz, v_revision,
        false, 'PLATFORM_WRITE_UNAVAILABLE'::text;
      return;
    else
      v_expected_end_text := btrim(v_value ->> 'expectedEnd');
      if v_expected_end_text !~
         '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
        return query select
          'MAINTENANCE'::text, null::text, null::timestamptz, v_revision,
          false, 'PLATFORM_WRITE_UNAVAILABLE'::text;
        return;
      end if;
      begin
        v_expected_end := v_expected_end_text::timestamptz;
      exception when others then
        return query select
          'MAINTENANCE'::text, null::text, null::timestamptz, v_revision,
          false, 'PLATFORM_WRITE_UNAVAILABLE'::text;
        return;
      end;
    end if;
  end if;

  return query select
    v_mode, v_message, v_expected_end, v_revision, true, null::text;
end;
$function$;

alter function public.pd_public_platform_status() volatile;

create table app_private.platform_release_bypass_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  token_digest text not null unique,
  environment text not null,
  run_id text not null,
  bound_user_id uuid references app_portal.users(id) on delete restrict,
  expires_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint platform_release_bypass_token_digest_check
    check (token_digest ~ '^[0-9a-f]{64}$'),
  constraint platform_release_bypass_environment_check
    check (environment ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
  constraint platform_release_bypass_run_id_check
    check (run_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$'),
  constraint platform_release_bypass_expiry_check
    check (expires_at > created_at and expires_at <= created_at + interval '1 hour'),
  constraint platform_release_bypass_revocation_check
    check ((is_active and revoked_at is null) or (not is_active and revoked_at is not null))
);

alter table app_private.platform_release_bypass_tokens enable row level security;

create function app_private.platform_release_environment()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_value jsonb;
  v_environment text;
begin
  select setting.value
  into v_value
  from app_portal.settings as setting
  where setting.key = 'platform.mode';

  if not found
     or jsonb_typeof(v_value) <> 'object'
     or jsonb_typeof(v_value -> 'environment') <> 'string' then
    return null;
  end if;

  v_environment := upper(btrim(v_value ->> 'environment'));
  if v_environment !~ '^[A-Z][A-Z0-9_-]{1,31}$' then
    return null;
  end if;

  return v_environment;
end;
$function$;

create function app_private.create_platform_release_bypass(
  p_environment text,
  p_run_id text,
  p_expires_at timestamptz,
  p_bound_user_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_environment text := upper(btrim(coalesce(p_environment, '')));
  v_run_id text := btrim(coalesce(p_run_id, ''));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  if v_environment !~ '^[A-Z][A-Z0-9_-]{1,31}$'
     or v_environment is distinct from app_private.platform_release_environment()
     or v_run_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$'
     or p_expires_at is null
     or p_expires_at <= now()
     or p_expires_at > now() + interval '1 hour'
     or (p_bound_user_id is not null and not exists (
       select 1 from app_portal.users as portal_user where portal_user.id = p_bound_user_id
     )) then
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
    encode(extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'), 'hex'),
    v_environment,
    v_run_id,
    p_bound_user_id,
    p_expires_at
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'environment', v_environment,
    'runId', v_run_id,
    'expiresAt', p_expires_at,
    'boundUserId', p_bound_user_id
  );
end;
$function$;

create function app_private.revoke_platform_release_bypass(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  update app_private.platform_release_bypass_tokens as bypass
  set is_active = false,
      revoked_at = now()
  where bypass.id = p_id
    and bypass.is_active;

  return found;
end;
$function$;

create function app_private.try_platform_release_bypass(
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
  v_headers jsonb;
  v_token text;
  v_environment text;
  v_run_id text;
  v_bypass app_private.platform_release_bypass_tokens%rowtype;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return false;
  end;

  if jsonb_typeof(v_headers) <> 'object' then
    return false;
  end if;

  v_token := btrim(coalesce(v_headers ->> 'x-pd-release-bypass', ''));
  v_environment := upper(btrim(coalesce(v_headers ->> 'x-pd-environment', '')));
  v_run_id := btrim(coalesce(v_headers ->> 'x-pd-release-run', ''));

  if v_token !~ '^[0-9a-f]{64}$'
     or v_environment !~ '^[A-Z][A-Z0-9_-]{1,31}$'
     or v_run_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$'
     or v_environment is distinct from app_private.platform_release_environment() then
    return false;
  end if;

  select bypass.*
  into v_bypass
  from app_private.platform_release_bypass_tokens as bypass
  where bypass.token_digest = encode(
      extensions.digest(convert_to(v_token, 'UTF8'), 'sha256'),
      'hex'
    )
    and bypass.environment = v_environment
    and bypass.run_id = v_run_id
    and bypass.is_active
    and bypass.revoked_at is null
    and bypass.expires_at > now()
    and (bypass.bound_user_id is null or bypass.bound_user_id = p_actor)
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
    jsonb_build_object(
      'action', lower(btrim(coalesce(p_action, ''))),
      'environment', v_environment,
      'runId', v_run_id,
      'boundToUser', v_bypass.bound_user_id is not null,
      'actorType', case when p_actor is null then 'PUBLIC_ANONYMOUS' else 'PORTAL_USER' end,
      'bypassUsed', true
    )
  );

  return true;
end;
$function$;

create function app_private.require_platform_user_write_allowed(
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

  if app_private.try_platform_release_bypass(p_action, p_actor) then
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

create or replace function app_private.require_platform_user_write_allowed()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_platform_user_write_allowed('', auth.uid());
end;
$function$;

create or replace function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_error_code text;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  if app_private.platform_action_classification(v_action) = 'USER_MUTATION' then
    perform app_private.require_platform_user_write_allowed(v_action, auth.uid());
  end if;

  return public.pd_api_before_platform_mode_m900_r1(p_action, p_payload);
exception when others then
  v_error_code := case sqlstate
    when 'P0901' then 'PLATFORM_WRITE_UNAVAILABLE'
    when 'P0902' then 'PLATFORM_READ_ONLY'
    when 'P0903' then 'PLATFORM_MAINTENANCE'
    else sqlstate
  end;
  return jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object('code', v_error_code, 'message', sqlerrm)
  );
end;
$function$;

alter function public.m150_submit_membership_application(jsonb, text)
  rename to m150_submit_membership_application_before_platform_mode_m900_r1;

create function public.m150_submit_membership_application(
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_platform_user_write_allowed(
    'm150_submit_membership_application',
    null
  );
  return public.m150_submit_membership_application_before_platform_mode_m900_r1(
    p_payload,
    p_idempotency_key
  );
end;
$function$;

alter function public.m210_ics_import_confirm(
  uuid, text, text, text, text, integer, jsonb, jsonb, text
) rename to m210_ics_import_confirm_before_platform_mode_m900_r1;

create function public.m210_ics_import_confirm(
  p_actor uuid,
  p_source_type text,
  p_source_key text,
  p_original_filename text,
  p_file_sha256 text,
  p_file_size integer,
  p_records jsonb,
  p_expected_state jsonb,
  p_preview_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_platform_user_write_allowed(
    'm210_ics_import_confirm',
    p_actor
  );
  return public.m210_ics_import_confirm_before_platform_mode_m900_r1(
    p_actor,
    p_source_type,
    p_source_key,
    p_original_filename,
    p_file_sha256,
    p_file_size,
    p_records,
    p_expected_state,
    p_preview_fingerprint
  );
end;
$function$;

alter function public.m310_submit_guest_fanbus_registration(jsonb, uuid, text)
  rename to m310_submit_guest_fanbus_registration_before_platform_m900_r1;

create function public.m310_submit_guest_fanbus_registration(
  p_payload jsonb,
  p_idempotency_key uuid,
  p_source_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.require_platform_user_write_allowed(
    'm310_submit_guest_fanbus_registration',
    null
  );
  return public.m310_submit_guest_fanbus_registration_before_platform_m900_r1(
    p_payload,
    p_idempotency_key,
    p_source_hash
  );
end;
$function$;

revoke all on table app_private.platform_release_bypass_tokens
from public, anon, authenticated, service_role;

revoke all on function
  app_private.platform_release_environment(),
  app_private.create_platform_release_bypass(text, text, timestamptz, uuid),
  app_private.revoke_platform_release_bypass(uuid),
  app_private.try_platform_release_bypass(text, uuid),
  app_private.require_platform_user_write_allowed(text, uuid),
  app_private.require_platform_user_write_allowed(),
  public.pd_api(text, jsonb),
  public.m150_submit_membership_application_before_platform_mode_m900_r1(jsonb, text),
  public.m150_submit_membership_application(jsonb, text),
  public.m210_ics_import_confirm_before_platform_mode_m900_r1(
    uuid, text, text, text, text, integer, jsonb, jsonb, text
  ),
  public.m210_ics_import_confirm(
    uuid, text, text, text, text, integer, jsonb, jsonb, text
  ),
  public.m310_submit_guest_fanbus_registration_before_platform_m900_r1(jsonb, uuid, text),
  public.m310_submit_guest_fanbus_registration(jsonb, uuid, text)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.platform_release_environment(),
  app_private.create_platform_release_bypass(text, text, timestamptz, uuid),
  app_private.revoke_platform_release_bypass(uuid),
  app_private.try_platform_release_bypass(text, uuid),
  app_private.require_platform_user_write_allowed(text, uuid),
  app_private.require_platform_user_write_allowed(),
  public.m150_submit_membership_application_before_platform_mode_m900_r1(jsonb, text),
  public.m210_ics_import_confirm_before_platform_mode_m900_r1(
    uuid, text, text, text, text, integer, jsonb, jsonb, text
  ),
  public.m310_submit_guest_fanbus_registration_before_platform_m900_r1(jsonb, uuid, text)
to postgres;

grant execute on function public.pd_api(text, jsonb) to authenticated;
grant execute on function public.m150_submit_membership_application(jsonb, text) to service_role;
grant execute on function public.m210_ics_import_confirm(
  uuid, text, text, text, text, integer, jsonb, jsonb, text
) to service_role;
grant execute on function public.m310_submit_guest_fanbus_registration(jsonb, uuid, text)
to service_role;

comment on table app_private.platform_release_bypass_tokens is
  'M900-R1 kurzlebige Release-Testfreigaben; nur SHA-256-Digests, nie Roh-Tokens.';
comment on function app_private.create_platform_release_bypass(text, text, timestamptz, uuid) is
  'M900-R1 Ops-only Tokenausgabe genau bei Erstellung, maximal eine Stunde, optional usergebunden.';
comment on function app_private.try_platform_release_bypass(text, uuid) is
  'M900-R1 fail-closed Pruefung von Token, Umgebung, Lauf, Ablauf, Aktivitaet und optionalem User-Binding mit Audit.';
comment on function app_private.require_platform_user_write_allowed(text, uuid) is
  'M900-R1 zentraler User-Mutationsguard mit eng begrenztem Release-Test-Bypass.';

commit;
