begin;

alter table app_social_media.render_jobs
  add column cloud_attempt_count integer not null default 0,
  add column cloud_max_attempts integer not null default 3,
  add column cloud_available_at timestamptz not null default pg_catalog.now(),
  add column cloud_claim_token uuid,
  add column cloud_claimed_at timestamptz,
  add column cloud_claim_expires_at timestamptz,
  add column cloud_last_completed_claim_token uuid;

alter table app_social_media.render_jobs
  add constraint social_media_render_jobs_cloud_attempt_count_check
    check (cloud_attempt_count >= 0),
  add constraint social_media_render_jobs_cloud_max_attempts_check
    check (cloud_max_attempts >= 1 and cloud_max_attempts <= 20),
  add constraint social_media_render_jobs_cloud_claim_check
    check (
      (cloud_status = 'PROCESSING'
        and cloud_claim_token is not null
        and cloud_claimed_at is not null
        and cloud_claim_expires_at is not null)
      or cloud_status <> 'PROCESSING'
    );

create index social_media_render_jobs_cloud_claim_idx
  on app_social_media.render_jobs(
    cloud_status,
    cloud_available_at,
    cloud_claim_expires_at,
    rendered_at,
    id
  )
  where render_status = 'SUCCEEDED';

create or replace function app_private.social_media_generator_render_job_json(
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
      'cloudAttemptCount', job.cloud_attempt_count,
      'cloudMaxAttempts', job.cloud_max_attempts,
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

create function app_private.api_social_media_generator_render_cloud_retry(
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
  set cloud_status = 'PENDING',
      cloud_available_at = pg_catalog.now(),
      cloud_claim_token = null,
      cloud_claimed_at = null,
      cloud_claim_expires_at = null,
      cloud_max_attempts = least(20, job.cloud_attempt_count + 3),
      last_cloud_error_code = null,
      updated_at = pg_catalog.now()
  where job.id = v_job_id
    and job.owner_user_id = v_user_id
    and job.render_status = 'SUCCEEDED'
    and job.cloud_status = 'FAILED';

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

    raise exception 'SOCIAL_MEDIA_RENDER_CLOUD_RETRY_NOT_ALLOWED'
      using errcode = '22023';
  end if;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_CLOUD_RETRIED',
    'social_media_generator_render_job',
    v_job_id::text,
    null,
    pg_catalog.jsonb_build_object('queued', true)
  );

  return app_private.social_media_generator_render_job_json(v_job_id);
end;
$function$;

create function public.pd_social_media_render_worker_cloud_claim()
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
  where job.render_status = 'SUCCEEDED'
    and job.result_manifest is not null
    and (
      (
        job.cloud_status = 'PENDING'
        and job.cloud_available_at <= pg_catalog.now()
      )
      or (
        job.cloud_status = 'PROCESSING'
        and job.cloud_claim_expires_at < pg_catalog.now()
      )
    )
    and job.cloud_attempt_count < job.cloud_max_attempts
  order by job.cloud_available_at, job.rendered_at, job.id
  for update skip locked
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('claimed', false);
  end if;

  v_token := extensions.gen_random_uuid();

  update app_social_media.render_jobs as job
  set cloud_status = 'PROCESSING',
      cloud_attempt_count = job.cloud_attempt_count + 1,
      cloud_claim_token = v_token,
      cloud_claimed_at = pg_catalog.now(),
      cloud_claim_expires_at = pg_catalog.now() + interval '10 minutes',
      last_cloud_error_code = null,
      updated_at = pg_catalog.now()
  where job.id = v_job.id
  returning job.* into v_job;

  return pg_catalog.jsonb_build_object(
    'claimed', true,
    'job', pg_catalog.jsonb_build_object(
      'jobId', v_job.id,
      'cloudClaimToken', v_job.cloud_claim_token,
      'environment', v_environment,
      'draftId', v_job.draft_id,
      'draftVersion', v_job.draft_version,
      'document', v_job.document,
      'bindingContext', v_job.binding_context,
      'compatibilityVersion', v_job.compatibility_version,
      'resultManifest', v_job.result_manifest,
      'cloudAttemptCount', v_job.cloud_attempt_count,
      'cloudMaxAttempts', v_job.cloud_max_attempts,
      'cloudClaimExpiresAt', v_job.cloud_claim_expires_at
    )
  );
end;
$function$;

create function public.pd_social_media_render_worker_cloud_heartbeat(
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
  set cloud_claim_expires_at = pg_catalog.now() + interval '10 minutes',
      updated_at = pg_catalog.now()
  where job.id = p_job_id
    and job.render_status = 'SUCCEEDED'
    and job.cloud_status = 'PROCESSING'
    and job.cloud_claim_token = p_claim_token
    and job.cloud_claim_expires_at >= pg_catalog.now() - interval '2 minutes'
  returning job.cloud_claim_expires_at into v_expires_at;

  if not found then
    raise exception 'SOCIAL_MEDIA_RENDER_CLOUD_CLAIM_INVALID'
      using errcode = '40001';
  end if;

  return pg_catalog.jsonb_build_object(
    'heartbeat', true,
    'cloudClaimExpiresAt', v_expires_at
  );
end;
$function$;

create function public.pd_social_media_render_worker_cloud_complete(
  p_job_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error_code text,
  p_cloud_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job app_social_media.render_jobs%rowtype;
  v_retry boolean;
  v_nextcloud_path text;
  v_share_url text;
  v_download_url text;
  v_filename text;
  v_sha256 text;
  v_size_bytes bigint;
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

  if v_job.cloud_last_completed_claim_token = p_claim_token then
    return pg_catalog.jsonb_build_object(
      'completed', true,
      'renderStatus', v_job.render_status,
      'cloudStatus', v_job.cloud_status,
      'idempotent', true
    );
  end if;

  if v_job.render_status <> 'SUCCEEDED'
     or v_job.cloud_status <> 'PROCESSING'
     or v_job.cloud_claim_token is distinct from p_claim_token then
    raise exception 'SOCIAL_MEDIA_RENDER_CLOUD_CLAIM_INVALID'
      using errcode = '40001';
  end if;

  if p_success then
    if pg_catalog.jsonb_typeof(p_cloud_result) is distinct from 'object' then
      raise exception 'SOCIAL_MEDIA_RENDER_CLOUD_RESULT_INVALID'
        using errcode = '22023';
    end if;

    v_nextcloud_path := coalesce(p_cloud_result ->> 'nextcloudPath', '');
    v_share_url := coalesce(p_cloud_result ->> 'shareUrl', '');
    v_download_url := coalesce(p_cloud_result ->> 'downloadUrl', '');
    v_filename := coalesce(p_cloud_result ->> 'filename', '');
    v_sha256 := coalesce(p_cloud_result ->> 'sha256', '');
    v_size_bytes := case
      when coalesce(p_cloud_result ->> 'sizeBytes', '') ~ '^[1-9][0-9]{0,18}$'
      then (p_cloud_result ->> 'sizeBytes')::bigint
      else null
    end;

    if v_nextcloud_path not like '/Publishing/%'
       or pg_catalog.char_length(v_nextcloud_path) > 500
       or pg_catalog.strpos(v_nextcloud_path, '..') > 0
       or pg_catalog.strpos(v_nextcloud_path, pg_catalog.chr(92)) > 0
       or pg_catalog.strpos(v_nextcloud_path, '?') > 0
       or pg_catalog.strpos(v_nextcloud_path, '#') > 0
       or v_filename !~ '^[A-Za-z0-9._-]{1,160}[.]png$'
       or v_share_url !~ '^https://cloud[.]plaerrdeifl[.]de/s/[A-Za-z0-9]{8,128}$'
       or v_download_url <> v_share_url || '/download'
       or v_sha256 !~ '^[a-f0-9]{64}$'
       or v_size_bytes is null
       or v_sha256 <> coalesce(v_job.result_manifest ->> 'sha256', '')
       or v_size_bytes::text <> coalesce(v_job.result_manifest ->> 'sizeBytes', '') then
      raise exception 'SOCIAL_MEDIA_RENDER_CLOUD_RESULT_INVALID'
        using errcode = '22023';
    end if;

    update app_social_media.render_jobs as job
    set cloud_status = 'SUCCEEDED',
        result_manifest = job.result_manifest || pg_catalog.jsonb_build_object(
          'nextcloudPath', v_nextcloud_path,
          'shareUrl', v_share_url,
          'downloadUrl', v_download_url,
          'filename', v_filename
        ),
        last_cloud_error_code = null,
        cloud_completed_at = pg_catalog.now(),
        cloud_last_completed_claim_token = p_claim_token,
        cloud_claim_token = null,
        cloud_claimed_at = null,
        cloud_claim_expires_at = null,
        updated_at = pg_catalog.now()
    where job.id = p_job_id
    returning job.* into v_job;
  else
    if p_error_code is null
       or p_error_code !~ '^[A-Z0-9_:-]{1,80}$' then
      raise exception 'SOCIAL_MEDIA_RENDER_CLOUD_ERROR_CODE_INVALID'
        using errcode = '22023';
    end if;

    v_retry := v_job.cloud_attempt_count < v_job.cloud_max_attempts;

    update app_social_media.render_jobs as job
    set cloud_status = case
          when v_retry then 'PENDING'
          else 'FAILED'
        end,
        cloud_available_at = case
          when v_retry
            then pg_catalog.now()
                 + pg_catalog.make_interval(
                     secs => least(
                       120,
                       15 * greatest(1, v_job.cloud_attempt_count)
                     )
                   )
          else job.cloud_available_at
        end,
        last_cloud_error_code = p_error_code,
        cloud_last_completed_claim_token = p_claim_token,
        cloud_claim_token = null,
        cloud_claimed_at = null,
        cloud_claim_expires_at = null,
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
  rename to pd_api_current_actions_before_sm_render_cloud_p3;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select (
    app_private.pd_api_current_actions_before_sm_render_cloud_p3()
    || array[
      'social_media_generator_render_cloud_retry'
    ]::text[]
  );
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_render_cloud_p3;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_render_cloud_retry' then 'WRITE'
    else app_private.platform_action_classification_before_sm_render_cloud_p3(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_render_cloud_p3;

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
    when 'social_media_generator_render_cloud_retry' then
      return app_private.api_social_media_generator_render_cloud_retry(v_payload);
    else
      return app_private.pd_api_dispatch_current_before_sm_render_cloud_p3(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.social_media_generator_render_job_json(uuid),
  app_private.api_social_media_generator_render_cloud_retry(jsonb),
  app_private.pd_api_current_actions_before_sm_render_cloud_p3(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_render_cloud_p3(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_render_cloud_p3(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.social_media_generator_render_job_json(uuid),
  app_private.api_social_media_generator_render_cloud_retry(jsonb),
  app_private.pd_api_current_actions_before_sm_render_cloud_p3(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_render_cloud_p3(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_render_cloud_p3(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

revoke all on function
  public.pd_social_media_render_worker_cloud_claim(),
  public.pd_social_media_render_worker_cloud_heartbeat(uuid, uuid),
  public.pd_social_media_render_worker_cloud_complete(uuid, uuid, boolean, text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_social_media_render_worker_cloud_claim(),
  public.pd_social_media_render_worker_cloud_heartbeat(uuid, uuid),
  public.pd_social_media_render_worker_cloud_complete(uuid, uuid, boolean, text, jsonb)
to service_role;

commit;
