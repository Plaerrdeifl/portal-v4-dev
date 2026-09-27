begin;

create or replace function app_private.api_social_media_generator_render_retry(
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
      max_attempts = least(20, job.attempt_count + 3),
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

create or replace function public.pd_social_media_render_worker_complete(
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
                     secs => least(
                       120,
                       15 * greatest(1, v_job.attempt_count)
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

revoke all on function
  app_private.api_social_media_generator_render_retry(jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_social_media_generator_render_retry(jsonb)
to postgres;

revoke all on function
  public.pd_social_media_render_worker_complete(uuid, uuid, boolean, text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_social_media_render_worker_complete(uuid, uuid, boolean, text, jsonb)
to service_role;

commit;
