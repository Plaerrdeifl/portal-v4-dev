create or replace function public.pd_liveticker_graphic_worker_claim()
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_job app_modules.liveticker_graphic_jobs%rowtype;
  v_token uuid;
  v_environment text := app_private.platform_release_environment();
begin
  if v_environment not in ('DEV','PROD') then
    raise exception 'LIVETICKER_ENVIRONMENT_INVALID' using errcode='55000';
  end if;

  select * into v_job
  from app_modules.liveticker_graphic_jobs j
  where ((j.status='QUEUED' and j.available_at<=now()) or (j.status='PROCESSING' and j.claim_expires_at<now()))
    and j.attempt_count<5
  order by j.available_at,j.created_at,j.id
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object('claimed',false);
  end if;

  v_token:=extensions.gen_random_uuid();

  update app_modules.liveticker_graphic_jobs
  set status='PROCESSING',
      attempt_count=v_job.attempt_count+1,
      claim_token=v_token,
      claimed_at=now(),
      claim_expires_at=now()+interval '10 minutes',
      updated_at=now(),
      revision=revision+1
  where id=v_job.id
  returning * into v_job;

  return jsonb_build_object('claimed',true,'job',jsonb_build_object(
    'jobId',v_job.id,
    'claimToken',v_job.claim_token,
    'environment',v_environment,
    'attemptCount',v_job.attempt_count,
    'claimExpiresAt',v_job.claim_expires_at,
    'request',v_job.request_snapshot
  ));
end;
$$;

revoke all on function public.pd_liveticker_graphic_worker_claim() from public,anon,authenticated,service_role;
grant execute on function public.pd_liveticker_graphic_worker_claim() to service_role;
