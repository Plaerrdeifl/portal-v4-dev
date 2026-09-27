begin;

create table app_social_media.render_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  owner_user_id uuid not null
    references app_portal.users(id) on delete restrict,
  draft_id uuid not null
    references app_social_media.drafts(id) on delete restrict,
  draft_version bigint not null,
  document jsonb not null,
  binding_context jsonb not null default '{}'::jsonb,
  compatibility_version integer not null default 1,
  render_status text not null default 'QUEUED',
  cloud_status text not null default 'PENDING',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default pg_catalog.now(),
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  last_completed_claim_token uuid,
  renderer_version text,
  result_manifest jsonb,
  last_render_error_code text,
  last_cloud_error_code text,
  rendered_at timestamptz,
  cloud_completed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint social_media_render_jobs_draft_version_check
    check (draft_version > 0),
  constraint social_media_render_jobs_document_check
    check (pg_catalog.jsonb_typeof(document) = 'object'),
  constraint social_media_render_jobs_binding_context_check
    check (pg_catalog.jsonb_typeof(binding_context) = 'object'),
  constraint social_media_render_jobs_compatibility_version_check
    check (compatibility_version > 0),
  constraint social_media_render_jobs_render_status_check
    check (render_status in ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  constraint social_media_render_jobs_cloud_status_check
    check (cloud_status in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  constraint social_media_render_jobs_attempt_count_check
    check (attempt_count >= 0),
  constraint social_media_render_jobs_max_attempts_check
    check (max_attempts >= 1 and max_attempts <= 20),
  constraint social_media_render_jobs_claim_check
    check (
      (render_status = 'PROCESSING'
        and claim_token is not null
        and claimed_at is not null
        and claim_expires_at is not null)
      or render_status <> 'PROCESSING'
    )
);

create index social_media_render_jobs_owner_created_idx
  on app_social_media.render_jobs(owner_user_id, created_at desc, id);

create index social_media_render_jobs_claim_idx
  on app_social_media.render_jobs(
    render_status,
    available_at,
    claim_expires_at,
    created_at,
    id
  );

alter table app_social_media.render_jobs enable row level security;

revoke all on table app_social_media.render_jobs
  from public, anon, authenticated, service_role;

create function app_private.social_media_generator_render_job_json(
  p_job_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'id', job.id,
      'draftId', job.draft_id,
      'draftVersion', job.draft_version,
      'compatibilityVersion', job.compatibility_version,
      'renderStatus', job.render_status,
      'cloudStatus', job.cloud_status,
      'attemptCount', job.attempt_count,
      'maxAttempts', job.max_attempts,
      'rendererVersion', job.renderer_version,
      'resultManifest', job.result_manifest,
      'renderErrorCode', job.last_render_error_code,
      'cloudErrorCode', job.last_cloud_error_code,
      'renderedAt', job.rendered_at,
      'cloudCompletedAt', job.cloud_completed_at,
      'createdAt', job.created_at,
      'updatedAt', job.updated_at
    )
  )
  from app_social_media.render_jobs as job
  where job.id = p_job_id;
$function$;

create function app_private.api_social_media_generator_render_start(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_draft_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'draftId', '')),
    ''
  )::uuid;
  v_expected_version bigint;
  v_binding_context jsonb := coalesce(
    p_payload -> 'bindingContext',
    '{}'::jsonb
  );
  v_draft app_social_media.drafts%rowtype;
  v_job_id uuid;
begin
  if v_draft_id is null then
    raise exception 'SOCIAL_MEDIA_RENDER_DRAFT_ID_REQUIRED'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_payload -> 'expectedVersion') <> 'number'
     or coalesce(p_payload ->> 'expectedVersion', '') !~ '^[1-9][0-9]{0,18}$' then
    raise exception 'SOCIAL_MEDIA_RENDER_EXPECTED_VERSION_INVALID'
      using errcode = '22023';
  end if;

  v_expected_version := (p_payload ->> 'expectedVersion')::bigint;

  if pg_catalog.jsonb_typeof(v_binding_context) is distinct from 'object'
     or pg_catalog.octet_length(v_binding_context::text) > 1048576 then
    raise exception 'SOCIAL_MEDIA_RENDER_BINDING_CONTEXT_INVALID'
      using errcode = '22023';
  end if;

  select draft.*
  into v_draft
  from app_social_media.drafts as draft
  where draft.id = v_draft_id
    and draft.owner_user_id = v_user_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_DRAFT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_draft.version <> v_expected_version then
    raise exception 'SOCIAL_MEDIA_DRAFT_VERSION_CONFLICT'
      using errcode = 'PT409',
            detail = pg_catalog.format(
              'expectedVersion=%s,currentVersion=%s',
              v_expected_version,
              v_draft.version
            );
  end if;

  perform app_private.social_media_generator_document_schema_version(
    v_draft.document
  );

  insert into app_social_media.render_jobs (
    owner_user_id,
    draft_id,
    draft_version,
    document,
    binding_context,
    compatibility_version,
    render_status,
    cloud_status,
    max_attempts
  )
  values (
    v_user_id,
    v_draft.id,
    v_draft.version,
    v_draft.document,
    v_binding_context,
    1,
    'QUEUED',
    'PENDING',
    3
  )
  returning id into v_job_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_RENDER_STARTED',
    'social_media_generator_render_job',
    v_job_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'draftId', v_draft.id,
      'draftVersion', v_draft.version,
      'compatibilityVersion', 1
    )
  );

  return app_private.social_media_generator_render_job_json(v_job_id);
end;
$function$;

create function app_private.api_social_media_generator_render_get(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_job_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'jobId', '')),
    ''
  )::uuid;
  v_result jsonb;
begin
  if v_job_id is null then
    raise exception 'SOCIAL_MEDIA_RENDER_JOB_ID_REQUIRED'
      using errcode = '22023';
  end if;

  select app_private.social_media_generator_render_job_json(job.id)
  into v_result
  from app_social_media.render_jobs as job
  where job.id = v_job_id
    and job.owner_user_id = v_user_id;

  if not found or v_result is null then
    raise exception 'SOCIAL_MEDIA_RENDER_JOB_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$function$;

create function app_private.api_social_media_generator_render_retry(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_job_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'jobId', '')),
    ''
  )::uuid;
begin
  if v_job_id is null then
    raise exception 'SOCIAL_MEDIA_RENDER_JOB_ID_REQUIRED'
      using errcode = '22023';
  end if;

  update app_social_media.render_jobs as job
  set render_status = 'QUEUED',
      available_at = pg_catalog.now(),
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      max_attempts = pg_catalog.least(20, job.attempt_count + 3),
      last_render_error_code = null,
      updated_at = pg_catalog.now()
  where job.id = v_job_id
    and job.owner_user_id = v_user_id
    and job.render_status = 'FAILED';

  if not found then
    if not exists (
      select 1
      from app_social_media.render_jobs as job
      where job.id = v_job_id
        and job.owner_user_id = v_user_id
    ) then
      raise exception 'SOCIAL_MEDIA_RENDER_JOB_NOT_FOUND'
        using errcode = 'P0002';
    end if;

    raise exception 'SOCIAL_MEDIA_RENDER_RETRY_NOT_ALLOWED'
      using errcode = '22023';
  end if;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_RENDER_RETRIED',
    'social_media_generator_render_job',
    v_job_id::text,
    null,
    pg_catalog.jsonb_build_object('queued', true)
  );

  return app_private.social_media_generator_render_job_json(v_job_id);
end;
$function$;

create function public.pd_social_media_render_worker_claim()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job app_social_media.render_jobs%rowtype;
  v_token uuid;
  v_environment text := app_private.platform_release_environment();
begin
  if v_environment not in ('DEV', 'PROD') then
    raise exception 'SOCIAL_MEDIA_RENDER_ENVIRONMENT_INVALID'
      using errcode = '55000';
  end if;

  select job.*
  into v_job
  from app_social_media.render_jobs as job
  where (
      (
        job.render_status = 'QUEUED'
        and job.available_at <= pg_catalog.now()
      )
      or (
        job.render_status = 'PROCESSING'
        and job.claim_expires_at < pg_catalog.now()
      )
    )
    and job.attempt_count < job.max_attempts
  order by job.available_at, job.created_at, job.id
  for update skip locked
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('claimed', false);
  end if;

  v_token := extensions.gen_random_uuid();

  update app_social_media.render_jobs as job
  set render_status = 'PROCESSING',
      attempt_count = job.attempt_count + 1,
      claim_token = v_token,
      claimed_at = pg_catalog.now(),
      claim_expires_at = pg_catalog.now() + interval '10 minutes',
      last_render_error_code = null,
      updated_at = pg_catalog.now()
  where job.id = v_job.id
  returning job.* into v_job;

  return pg_catalog.jsonb_build_object(
    'claimed', true,
    'job', pg_catalog.jsonb_build_object(
      'jobId', v_job.id,
      'claimToken', v_job.claim_token,
      'environment', v_environment,
      'draftId', v_job.draft_id,
      'draftVersion', v_job.draft_version,
      'document', v_job.document,
      'bindingContext', v_job.binding_context,
      'compatibilityVersion', v_job.compatibility_version,
      'attemptCount', v_job.attempt_count,
      'maxAttempts', v_job.max_attempts,
      'claimExpiresAt', v_job.claim_expires_at
    )
  );
end;
$function$;

create function public.pd_social_media_render_worker_heartbeat(
  p_job_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expires_at timestamptz;
begin
  update app_social_media.render_jobs as job
  set claim_expires_at = pg_catalog.now() + interval '10 minutes',
      updated_at = pg_catalog.now()
  where job.id = p_job_id
    and job.render_status = 'PROCESSING'
    and job.claim_token = p_claim_token
    and job.claim_expires_at >= pg_catalog.now() - interval '2 minutes'
  returning job.claim_expires_at into v_expires_at;

  if not found then
    raise exception 'SOCIAL_MEDIA_RENDER_CLAIM_INVALID'
      using errcode = '40001';
  end if;

  return pg_catalog.jsonb_build_object(
    'heartbeat', true,
    'claimExpiresAt', v_expires_at
  );
end;
$function$;

create function public.pd_social_media_render_worker_complete(
  p_job_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error_code text,
  p_result_manifest jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job app_social_media.render_jobs%rowtype;
  v_retry boolean;
  v_renderer_version text;
begin
  select job.*
  into v_job
  from app_social_media.render_jobs as job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception 'SOCIAL_MEDIA_RENDER_JOB_NOT_FOUND'
      using errcode = '22023';
  end if;

  if v_job.last_completed_claim_token = p_claim_token then
    return pg_catalog.jsonb_build_object(
      'completed', true,
      'renderStatus', v_job.render_status,
      'cloudStatus', v_job.cloud_status,
      'idempotent', true
    );
  end if;

  if v_job.render_status <> 'PROCESSING'
     or v_job.claim_token is distinct from p_claim_token then
    raise exception 'SOCIAL_MEDIA_RENDER_CLAIM_INVALID'
      using errcode = '40001';
  end if;

  if p_success then
    if pg_catalog.jsonb_typeof(p_result_manifest) is distinct from 'object'
       or p_result_manifest ->> 'mimeType' <> 'image/png'
       or coalesce(p_result_manifest ->> 'storagePath', '') = ''
       or coalesce(p_result_manifest ->> 'sha256', '') !~ '^[a-f0-9]{64}$'
       or coalesce(p_result_manifest ->> 'sizeBytes', '') !~ '^[1-9][0-9]{0,18}$'
       or coalesce(p_result_manifest ->> 'rendererVersion', '') = ''
       or coalesce(p_result_manifest ->> 'compatibilityVersion', '') !~ '^[1-9][0-9]{0,8}$'
       or (p_result_manifest ->> 'compatibilityVersion')::integer
            <> v_job.compatibility_version then
      raise exception 'SOCIAL_MEDIA_RENDER_MANIFEST_INVALID'
        using errcode = '22023';
    end if;

    v_renderer_version := p_result_manifest ->> 'rendererVersion';

    update app_social_media.render_jobs as job
    set render_status = 'SUCCEEDED',
        cloud_status = 'PENDING',
        renderer_version = v_renderer_version,
        result_manifest = p_result_manifest,
        last_render_error_code = null,
        rendered_at = pg_catalog.now(),
        last_completed_claim_token = p_claim_token,
        claim_token = null,
        claimed_at = null,
        claim_expires_at = null,
        updated_at = pg_catalog.now()
    where job.id = p_job_id
    returning job.* into v_job;
  else
    if p_error_code is null
       or p_error_code !~ '^[A-Z0-9_:-]{1,80}$' then
      raise exception 'SOCIAL_MEDIA_RENDER_ERROR_CODE_INVALID'
        using errcode = '22023';
    end if;

    v_retry := v_job.attempt_count < v_job.max_attempts;

    update app_social_media.render_jobs as job
    set render_status = case
          when v_retry then 'QUEUED'
          else 'FAILED'
        end,
        available_at = case
          when v_retry
            then pg_catalog.now()
                 + pg_catalog.make_interval(
                     secs => pg_catalog.least(
                       120,
                       15 * pg_catalog.greatest(1, v_job.attempt_count)
                     )
                   )
          else job.available_at
        end,
        last_render_error_code = p_error_code,
        result_manifest = null,
        renderer_version = null,
        last_completed_claim_token = p_claim_token,
        claim_token = null,
        claimed_at = null,
        claim_expires_at = null,
        updated_at = pg_catalog.now()
    where job.id = p_job_id
    returning job.* into v_job;
  end if;

  return pg_catalog.jsonb_build_object(
    'completed', true,
    'renderStatus', v_job.render_status,
    'cloudStatus', v_job.cloud_status,
    'idempotent', false
  );
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_sm_render_jobs_p3;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select (
    app_private.pd_api_current_actions_before_sm_render_jobs_p3()
    || array[
      'social_media_generator_render_start',
      'social_media_generator_render_get',
      'social_media_generator_render_retry'
    ]::text[]
  );
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_render_jobs_p3;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_render_start' then 'WRITE'
    when 'social_media_generator_render_get' then 'READ'
    when 'social_media_generator_render_retry' then 'WRITE'
    else app_private.platform_action_classification_before_sm_render_jobs_p3(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_render_jobs_p3;

create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_action, ''))
  );
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  case v_action
    when 'social_media_generator_render_start' then
      return app_private.api_social_media_generator_render_start(v_payload);
    when 'social_media_generator_render_get' then
      return app_private.api_social_media_generator_render_get(v_payload);
    when 'social_media_generator_render_retry' then
      return app_private.api_social_media_generator_render_retry(v_payload);
    else
      return app_private.pd_api_dispatch_current_before_sm_render_jobs_p3(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.social_media_generator_render_job_json(uuid),
  app_private.api_social_media_generator_render_start(jsonb),
  app_private.api_social_media_generator_render_get(jsonb),
  app_private.api_social_media_generator_render_retry(jsonb),
  app_private.pd_api_current_actions_before_sm_render_jobs_p3(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_render_jobs_p3(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_render_jobs_p3(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.social_media_generator_render_job_json(uuid),
  app_private.api_social_media_generator_render_start(jsonb),
  app_private.api_social_media_generator_render_get(jsonb),
  app_private.api_social_media_generator_render_retry(jsonb),
  app_private.pd_api_current_actions_before_sm_render_jobs_p3(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_render_jobs_p3(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_render_jobs_p3(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

revoke all on function
  public.pd_social_media_render_worker_claim(),
  public.pd_social_media_render_worker_heartbeat(uuid, uuid),
  public.pd_social_media_render_worker_complete(uuid, uuid, boolean, text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_social_media_render_worker_claim(),
  public.pd_social_media_render_worker_heartbeat(uuid, uuid),
  public.pd_social_media_render_worker_complete(uuid, uuid, boolean, text, jsonb)
to service_role;

commit;
