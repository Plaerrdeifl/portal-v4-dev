-- Plärrdeifl Portal V4
-- P900 / M900-R1 Auftrag 3: gezieltes Security Hardening

begin;

-- Private token state remains inaccessible even if schema grants change later.
alter table app_private.bootstrap_tokens enable row level security;
alter table app_private.platform_release_bypass_tokens enable row level security;

revoke all on table
  app_private.bootstrap_tokens,
  app_private.platform_release_bypass_tokens
from public, anon, authenticated, service_role;

-- Lightweight, actor-bound abuse protection for the authenticated companion
-- person search. No public source identifiers or personal search terms persist.
create table app_private.companion_person_search_rate_limits (
  user_id uuid primary key
    references app_portal.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  constraint companion_person_search_rate_limits_request_count_check
    check (request_count between 1 and 30)
);

alter table app_private.companion_person_search_rate_limits
  enable row level security;

revoke all on table app_private.companion_person_search_rate_limits
from public, anon, authenticated, service_role;

create function app_private.consume_companion_person_search_rate_limit(
  p_actor uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := statement_timestamp();
  v_count integer;
begin
  if p_actor is null then
    raise exception 'FANBUS_PERSON_SEARCH_RATE_LIMITED' using errcode = 'P3252';
  end if;

  insert into app_private.companion_person_search_rate_limits as rate_limit (
    user_id,
    window_started_at,
    request_count
  )
  values (p_actor, v_now, 1)
  on conflict (user_id) do update
  set window_started_at = case
        when rate_limit.window_started_at <= v_now - interval '5 minutes'
          then v_now
        else rate_limit.window_started_at
      end,
      request_count = case
        when rate_limit.window_started_at <= v_now - interval '5 minutes'
          then 1
        else rate_limit.request_count + 1
      end
  where rate_limit.window_started_at <= v_now - interval '5 minutes'
     or rate_limit.request_count < 30
  returning request_count into v_count;

  if v_count is null then
    raise exception 'FANBUS_PERSON_SEARCH_RATE_LIMITED' using errcode = 'P3252';
  end if;
end;
$function$;

-- Data-minimal ACTIVE portal-user lookup. Query tokens must match the prefix of
-- a name token; arbitrary infix enumeration and membership joins are removed.
create or replace function app_private.m325_portal_people_search(p_query text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with query_tokens as (
    select token.value
    from pg_catalog.unnest(
      pg_catalog.regexp_split_to_array(
        pg_catalog.lower(pg_catalog.btrim(p_query)),
        E'\\s+'
      )
    ) as token(value)
    where token.value <> ''
  ), searchable as (
    select
      portal_user.id,
      pg_catalog.btrim(portal_user.first_name) || ' '
        || pg_catalog.btrim(portal_user.last_name) as display_name,
      pg_catalog.regexp_split_to_array(
        pg_catalog.lower(
          pg_catalog.btrim(portal_user.first_name) || ' '
            || pg_catalog.btrim(portal_user.last_name)
        ),
        E'\\s+'
      ) as name_tokens
    from app_portal.users as portal_user
    where portal_user.status = 'ACTIVE'
  ), matches as (
    select searchable.id, searchable.display_name
    from searchable
    where not exists (
      select 1
      from query_tokens as query_token
      where not exists (
        select 1
        from pg_catalog.unnest(searchable.name_tokens) as name_token(value)
        where pg_catalog.left(
          name_token.value,
          pg_catalog.length(query_token.value)
        ) = query_token.value
      )
    )
    order by pg_catalog.lower(searchable.display_name), searchable.id
    limit 8
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'portalUserId', matched.id,
        'displayName', matched.display_name
      )
      order by pg_catalog.lower(matched.display_name), matched.id
    ),
    '[]'::jsonb
  )
  from matches as matched;
$function$;

create or replace function app_private.api_fanbus_companion_person_search(
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_query text;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or not p_payload ? 'query'
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'query'
     ) then
    raise exception 'FANBUS_PERSON_SEARCH_INVALID_QUERY' using errcode = '22023';
  end if;

  v_query := pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(coalesce(p_payload ->> 'query', '')),
      E'\\s+',
      ' ',
      'g'
    )
  );

  if pg_catalog.length(v_query) < 5
     or pg_catalog.length(v_query) > 120
     or v_query !~ '^[[:alpha:]][[:alpha:]''’.-]*( [[:alpha:]][[:alpha:]''’.-]*)*$'
     or exists (
       select 1
       from pg_catalog.regexp_split_to_table(v_query, ' ') as token(value)
       where pg_catalog.length(token.value) < 2
     ) then
    raise exception 'FANBUS_PERSON_SEARCH_INVALID_QUERY' using errcode = '22023';
  end if;

  perform app_private.consume_companion_person_search_rate_limit(v_actor);

  return pg_catalog.jsonb_build_object(
    'people', app_private.m325_portal_people_search(v_query)
  );
end;
$function$;

-- The privileged identity search uses the same privacy-minimal result model.
create or replace function app_private.api_fanbus_registration_identity_search(
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability(
    'fanbus.participant_identity.manage'
  );
  v_query text;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or not p_payload ? 'query'
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'query'
     ) then
    raise exception 'FANBUS_PERSON_SEARCH_INVALID_QUERY' using errcode = '22023';
  end if;

  v_query := pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(coalesce(p_payload ->> 'query', '')),
      E'\\s+',
      ' ',
      'g'
    )
  );

  if pg_catalog.length(v_query) < 5
     or pg_catalog.length(v_query) > 120
     or v_query !~ '^[[:alpha:]][[:alpha:]''’.-]*( [[:alpha:]][[:alpha:]''’.-]*)*$'
     or exists (
       select 1
       from pg_catalog.regexp_split_to_table(v_query, ' ') as token(value)
       where pg_catalog.length(token.value) < 2
     ) then
    raise exception 'FANBUS_PERSON_SEARCH_INVALID_QUERY' using errcode = '22023';
  end if;

  perform app_private.consume_companion_person_search_rate_limit(v_actor);

  return pg_catalog.jsonb_build_object(
    'people', app_private.m325_portal_people_search(v_query)
  );
end;
$function$;

-- Exact, capability-protected suggestions also no longer disclose membership.
create or replace function app_private.api_fanbus_registration_identity_suggestion(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_registration_id uuid;
  v_registration app_modules.fanbus_registrations%rowtype;
  v_match_count integer;
  v_match jsonb;
begin
  perform app_private.require_capability('fanbus.participant_identity.manage');
  v_registration_id := app_private.m325_parse_uuid(
    p_payload ->> 'registrationId',
    'FANBUS_REGISTRATION_IDENTITY_INVALID_PAYLOAD'
  );

  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or v_registration_id is null
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> 'registrationId'
     ) then
    raise exception 'FANBUS_REGISTRATION_IDENTITY_INVALID_PAYLOAD'
      using errcode = '22023';
  end if;

  select registration.*
  into v_registration
  from app_modules.fanbus_registrations as registration
  join app_modules.fanbus_trips as trip on trip.id = registration.trip_id
  where registration.id = v_registration_id
    and registration.status in ('ACTIVE', 'WAITLISTED')
    and registration.portal_user_id is null
    and trip.status in ('PUBLISHED', 'CLOSED');
  if not found then
    raise exception 'FANBUS_REGISTRATION_IDENTITY_NOT_MUTABLE'
      using errcode = '22023';
  end if;

  with matches as (
    select
      portal_user.id,
      pg_catalog.btrim(portal_user.first_name) || ' '
        || pg_catalog.btrim(portal_user.last_name) as display_name
    from app_portal.users as portal_user
    where portal_user.status = 'ACTIVE'
      and pg_catalog.lower(pg_catalog.btrim(portal_user.first_name)) =
        pg_catalog.lower(pg_catalog.btrim(v_registration.first_name))
      and pg_catalog.lower(pg_catalog.btrim(portal_user.last_name)) =
        pg_catalog.lower(pg_catalog.btrim(v_registration.last_name))
  )
  select
    pg_catalog.count(*)::integer,
    case when pg_catalog.count(*) = 1 then (
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'portalUserId', matches.id,
        'displayName', matches.display_name
      )) -> 0
    ) end
  into v_match_count, v_match
  from matches;

  return pg_catalog.jsonb_build_object(
    'registrationId', v_registration_id,
    'status', case
      when v_match_count = 0 then 'NONE'
      when v_match_count = 1 then 'SINGLE'
      else 'MULTIPLE'
    end,
    'suggestion', v_match
  );
end;
$function$;

-- Release bypass management is already postgres-only; management events now
-- receive the same data-minimal audit coverage as successful bypass use.
create or replace function app_private.create_platform_release_bypass(
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
  v_environment text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_environment, '')));
  v_run_id text := pg_catalog.btrim(coalesce(p_run_id, ''));
  v_token text := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  v_id uuid;
begin
  if v_environment !~ '^[A-Z][A-Z0-9_-]{1,31}$'
     or v_environment is distinct from app_private.platform_release_environment()
     or v_run_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,95}$'
     or p_expires_at is null
     or p_expires_at <= now()
     or p_expires_at > now() + interval '1 hour'
     or (p_bound_user_id is not null and not exists (
       select 1
       from app_portal.users as portal_user
       where portal_user.id = p_bound_user_id
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
      'boundToUser', p_bound_user_id is not null,
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
      revoked_at = now()
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
      'boundToUser', v_bypass.bound_user_id is not null,
      'operatorRole', session_user
    )
  );

  return true;
end;
$function$;

-- Every historical router participates only in the postgres-owned internal
-- chain. No browser or service role needs a direct entry into a predecessor.
revoke all on function
  public.pd_api_before_events_r1(text, jsonb),
  public.pd_api_before_fanbus_cancellation_m330_r1(text, jsonb),
  public.pd_api_before_fanbus_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_manual_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_open_on_publish_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_operations_m325_r1(text, jsonb),
  public.pd_api_before_fanbus_participants_m320_r1(text, jsonb),
  public.pd_api_before_fanbus_registration_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_reopen_m310_r1(text, jsonb),
  public.pd_api_before_joint_f1(text, jsonb),
  public.pd_api_before_m010_r1(text, jsonb),
  public.pd_api_before_m010_r2_team_functions(text, jsonb),
  public.pd_api_before_m325_r2_member_linking(text, jsonb),
  public.pd_api_before_member_detail(text, jsonb),
  public.pd_api_before_membership_access_m150_r2(text, jsonb),
  public.pd_api_before_membership_application_conversion_r1(text, jsonb),
  public.pd_api_before_membership_application_withdraw_r1(text, jsonb),
  public.pd_api_before_membership_applications_r1(text, jsonb),
  public.pd_api_before_p800_u5_r1(text, jsonb),
  public.pd_api_before_phase2_finalization(text, jsonb),
  public.pd_api_before_phase2_sorting(text, jsonb),
  public.pd_api_before_platform_mode_m900_r1(text, jsonb),
  public.pd_api_before_task_access_push_r3(text, jsonb),
  public.pd_api_before_task_workflow_r2(text, jsonb),
  public.pd_api_before_user_task_access_r1(text, jsonb),
  public.pd_api_before_web_push_r1(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_api_before_events_r1(text, jsonb),
  public.pd_api_before_fanbus_cancellation_m330_r1(text, jsonb),
  public.pd_api_before_fanbus_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_manual_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_open_on_publish_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_operations_m325_r1(text, jsonb),
  public.pd_api_before_fanbus_participants_m320_r1(text, jsonb),
  public.pd_api_before_fanbus_registration_m310_r1(text, jsonb),
  public.pd_api_before_fanbus_reopen_m310_r1(text, jsonb),
  public.pd_api_before_joint_f1(text, jsonb),
  public.pd_api_before_m010_r1(text, jsonb),
  public.pd_api_before_m010_r2_team_functions(text, jsonb),
  public.pd_api_before_m325_r2_member_linking(text, jsonb),
  public.pd_api_before_member_detail(text, jsonb),
  public.pd_api_before_membership_access_m150_r2(text, jsonb),
  public.pd_api_before_membership_application_conversion_r1(text, jsonb),
  public.pd_api_before_membership_application_withdraw_r1(text, jsonb),
  public.pd_api_before_membership_applications_r1(text, jsonb),
  public.pd_api_before_p800_u5_r1(text, jsonb),
  public.pd_api_before_phase2_finalization(text, jsonb),
  public.pd_api_before_phase2_sorting(text, jsonb),
  public.pd_api_before_platform_mode_m900_r1(text, jsonb),
  public.pd_api_before_task_access_push_r3(text, jsonb),
  public.pd_api_before_task_workflow_r2(text, jsonb),
  public.pd_api_before_user_task_access_r1(text, jsonb),
  public.pd_api_before_web_push_r1(text, jsonb)
to postgres;

-- Exact exposed function matrix: one authenticated mutation router and five
-- reviewed read-only projections with their existing consumers preserved.
revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.pd_api(text, jsonb) to authenticated;

revoke all on function public.pd_public_events()
from public, anon, authenticated, service_role;
grant execute on function public.pd_public_events() to anon;

revoke all on function
  public.pd_public_fanbus_trip(uuid),
  public.pd_public_fanbus_trip_boarding_stops(uuid),
  public.pd_public_fanbus_trips(),
  public.pd_public_platform_status()
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_public_fanbus_trip(uuid),
  public.pd_public_fanbus_trip_boarding_stops(uuid),
  public.pd_public_fanbus_trips(),
  public.pd_public_platform_status()
to anon, authenticated;

revoke all on function
  app_private.consume_companion_person_search_rate_limit(uuid),
  app_private.m325_portal_people_search(text),
  app_private.api_fanbus_companion_person_search(jsonb),
  app_private.api_fanbus_registration_identity_search(jsonb),
  app_private.api_fanbus_registration_identity_suggestion(jsonb),
  app_private.create_platform_release_bypass(text, text, timestamptz, uuid),
  app_private.revoke_platform_release_bypass(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.consume_companion_person_search_rate_limit(uuid),
  app_private.m325_portal_people_search(text),
  app_private.api_fanbus_companion_person_search(jsonb),
  app_private.api_fanbus_registration_identity_search(jsonb),
  app_private.api_fanbus_registration_identity_suggestion(jsonb),
  app_private.create_platform_release_bypass(text, text, timestamptz, uuid),
  app_private.revoke_platform_release_bypass(uuid)
to postgres;

comment on table app_private.companion_person_search_rate_limits is
  'M900-R1 private actor-bound abuse limit; stores no search terms or PII copies.';
comment on function app_private.m325_portal_people_search(text) is
  'M900-R1 privacy-minimal ACTIVE user name-prefix lookup; no membership or contact data.';
comment on function app_private.create_platform_release_bypass(text, text, timestamptz, uuid) is
  'M900-R1 postgres-only one-time token creation with data-minimal management audit.';
comment on function app_private.revoke_platform_release_bypass(uuid) is
  'M900-R1 postgres-only revocation with data-minimal management audit.';

commit;
