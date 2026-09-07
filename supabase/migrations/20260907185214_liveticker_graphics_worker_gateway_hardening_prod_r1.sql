drop function if exists public.pd_public_liveticker_graphic_worker_claim(text);
drop function if exists public.pd_public_liveticker_graphic_worker_complete(text,uuid,uuid,boolean,text,jsonb);
drop function if exists app_private.liveticker_graphic_worker_authorized(text);

create or replace function public.pd_liveticker_graphic_worker_claim()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_job app_modules.liveticker_graphic_jobs%rowtype; v_token uuid;
begin
  select * into v_job
  from app_modules.liveticker_graphic_jobs j
  where ((j.status='QUEUED' and j.available_at<=now()) or (j.status='PROCESSING' and j.claim_expires_at<now()))
    and j.attempt_count<5
  order by j.available_at,j.created_at,j.id
  for update skip locked
  limit 1;
  if not found then return jsonb_build_object('claimed',false); end if;
  v_token:=extensions.gen_random_uuid();
  update app_modules.liveticker_graphic_jobs
  set status='PROCESSING',attempt_count=v_job.attempt_count+1,
      claim_token=v_token,claimed_at=now(),claim_expires_at=now()+interval '10 minutes',
      updated_at=now(),revision=revision+1
  where id=v_job.id
  returning * into v_job;
  return jsonb_build_object('claimed',true,'job',jsonb_build_object(
    'jobId',v_job.id,'claimToken',v_job.claim_token,'environment','PROD',
    'attemptCount',v_job.attempt_count,'claimExpiresAt',v_job.claim_expires_at,
    'request',v_job.request_snapshot
  ));
end;
$$;

create or replace function public.pd_liveticker_graphic_worker_complete(
  p_job_id uuid,p_claim_token uuid,p_success boolean,p_error_code text,p_result_manifest jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_job app_modules.liveticker_graphic_jobs%rowtype; v_retry boolean;
begin
  select * into v_job from app_modules.liveticker_graphic_jobs where id=p_job_id for update;
  if not found then raise exception 'LIVETICKER_JOB_NOT_FOUND' using errcode='22023'; end if;
  if v_job.last_completed_claim_token=p_claim_token then
    return jsonb_build_object('completed',true,'status',v_job.status,'idempotent',true);
  end if;
  if v_job.status<>'PROCESSING' or v_job.claim_token is distinct from p_claim_token then
    raise exception 'LIVETICKER_CLAIM_INVALID' using errcode='40001';
  end if;
  if p_success then
    if not app_private.liveticker_graphic_manifest_valid(p_result_manifest,v_job.graphic_kind) then
      raise exception 'LIVETICKER_MANIFEST_INVALID' using errcode='22023';
    end if;
    update app_modules.liveticker_graphic_jobs
    set status='SUCCEEDED',completed_at=now(),last_error_code=null,result_manifest=p_result_manifest,
        last_completed_claim_token=p_claim_token,last_completion_success=true,
        claim_token=null,claim_expires_at=null,updated_at=now(),revision=revision+1
    where id=p_job_id returning * into v_job;
  else
    if p_error_code is null or p_error_code !~ '^[A-Z0-9_:-]{1,80}$' then
      raise exception 'LIVETICKER_ERROR_CODE_INVALID' using errcode='22023';
    end if;
    v_retry:=v_job.attempt_count<5;
    update app_modules.liveticker_graphic_jobs
    set status=case when v_retry then 'QUEUED' else 'FAILED' end,
        available_at=case when v_retry then now()+app_private.liveticker_graphic_retry_delay(v_job.attempt_count) else available_at end,
        completed_at=case when v_retry then null else now() end,
        last_error_code=p_error_code,result_manifest=null,
        last_completed_claim_token=p_claim_token,last_completion_success=false,
        claim_token=null,claim_expires_at=null,updated_at=now(),revision=revision+1
    where id=p_job_id returning * into v_job;
  end if;
  return jsonb_build_object('completed',true,'status',v_job.status,'idempotent',false);
end;
$$;

revoke all on function public.pd_liveticker_graphic_worker_claim() from public,anon,authenticated,service_role;
grant execute on function public.pd_liveticker_graphic_worker_claim() to service_role;
revoke all on function public.pd_liveticker_graphic_worker_complete(uuid,uuid,boolean,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.pd_liveticker_graphic_worker_complete(uuid,uuid,boolean,text,jsonb) to service_role;
