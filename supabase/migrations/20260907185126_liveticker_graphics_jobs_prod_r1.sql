create table if not exists app_modules.liveticker_graphic_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null references app_modules.events(id) on delete cascade,
  graphic_kind text not null check (graphic_kind in ('PERIOD_1','PERIOD_2','FINAL')),
  source_revision integer not null check (source_revision >= 0),
  status text not null default 'QUEUED' check (status in ('QUEUED','PROCESSING','SUCCEEDED','FAILED')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  available_at timestamptz not null default now(),
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  last_completed_claim_token uuid,
  last_completion_success boolean,
  completed_at timestamptz,
  last_error_code text,
  request_snapshot jsonb not null,
  result_manifest jsonb,
  created_at timestamptz not null default now(),
  created_by uuid,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  revision integer not null default 1 check (revision >= 1)
);

create index if not exists liveticker_graphic_jobs_claim_idx
  on app_modules.liveticker_graphic_jobs(status, available_at, created_at, id);
create index if not exists liveticker_graphic_jobs_event_idx
  on app_modules.liveticker_graphic_jobs(event_id, created_at desc);
create unique index if not exists liveticker_graphic_jobs_active_kind_uidx
  on app_modules.liveticker_graphic_jobs(event_id, graphic_kind)
  where status in ('QUEUED','PROCESSING');

alter table app_modules.liveticker_graphic_jobs enable row level security;
revoke all on table app_modules.liveticker_graphic_jobs from public, anon, authenticated, service_role;

create or replace function app_private.liveticker_graphic_enqueue(
  p_event_id uuid,
  p_kind text,
  p_actor uuid default null
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_kind text := upper(btrim(coalesce(p_kind,'')));
  v_state app_modules.liveticker_game_states%rowtype;
  v_event record;
  v_own record;
  v_opp record;
  v_history jsonb := '[]'::jsonb;
  v_snapshot jsonb;
  v_job app_modules.liveticker_graphic_jobs%rowtype;
begin
  if v_kind not in ('PERIOD_1','PERIOD_2','FINAL') then
    raise exception 'LIVETICKER_GRAPHIC_KIND_INVALID' using errcode='22023';
  end if;
  perform app_private.liveticker_assert_supported_game(p_event_id);

  select * into v_state
  from app_modules.liveticker_game_states
  where event_id=p_event_id;
  if not found then
    raise exception 'LIVETICKER_GRAPHIC_STATE_MISSING' using errcode='22023';
  end if;
  if v_kind='PERIOD_1' and v_state.minute < 20 then
    raise exception 'LIVETICKER_GRAPHIC_PERIOD_NOT_READY' using errcode='22023';
  end if;
  if v_kind='PERIOD_2' and v_state.minute < 40 then
    raise exception 'LIVETICKER_GRAPHIC_PERIOD_NOT_READY' using errcode='22023';
  end if;
  if v_kind='FINAL' and v_state.completed_at is null then
    raise exception 'LIVETICKER_GRAPHIC_FINAL_NOT_READY' using errcode='22023';
  end if;

  select e.event_date,e.title,g.opponent_name
    into v_event
  from app_modules.events e
  join app_modules.event_games g on g.event_id=e.id
  where e.id=p_event_id;

  select t.id,t.name,t.short_name,t.team_code,t.logo_asset_path
    into v_own
  from app_modules.liveticker_teams t
  where t.is_active and t.is_home_club
  order by t.name
  limit 1;
  if v_own.id is null or nullif(btrim(coalesce(v_own.logo_asset_path,'')),'') is null then
    raise exception 'LIVETICKER_GRAPHIC_OUR_ASSET_MISSING' using errcode='22023';
  end if;

  select t.id,t.name,t.short_name,t.team_code,t.logo_asset_path
    into v_opp
  from app_modules.liveticker_teams t
  where t.is_active and not t.is_home_club
    and (
      lower(btrim(t.name))=lower(btrim(v_event.opponent_name))
      or lower(btrim(t.short_name))=lower(btrim(v_event.opponent_name))
      or lower(v_event.opponent_name) like '%'||lower(btrim(t.short_name))||'%'
    )
  order by case when lower(btrim(t.name))=lower(btrim(v_event.opponent_name)) then 0 else 1 end,t.name
  limit 1;
  if v_opp.id is null or nullif(btrim(coalesce(v_opp.logo_asset_path,'')),'') is null then
    raise exception 'LIVETICKER_GRAPHIC_OPPONENT_ASSET_MISSING' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(a.payload order by a.ordinal),'[]'::jsonb)
    into v_history
  from app_modules.liveticker_actions a
  where a.event_id=p_event_id and a.is_active;

  v_snapshot := jsonb_build_object(
    'schemaVersion',1,
    'kind',v_kind,
    'eventId',p_event_id,
    'eventDate',v_event.event_date,
    'eventTitle',coalesce(v_event.title,''),
    'revision',v_state.revision,
    'competitionLabel','',
    'seriesInfo','',
    'ourTeam',jsonb_build_object(
      'id',v_own.id,'name',v_own.name,'shortName',v_own.short_name,
      'teamCode',v_own.team_code,'logoAssetPath',v_own.logo_asset_path
    ),
    'opponentTeam',jsonb_build_object(
      'id',v_opp.id,'name',v_opp.name,'shortName',v_opp.short_name,
      'teamCode',v_opp.team_code,'logoAssetPath',v_opp.logo_asset_path
    ),
    'history',v_history
  );

  insert into app_modules.liveticker_graphic_jobs(
    event_id,graphic_kind,source_revision,request_snapshot,created_by,updated_by
  ) values (
    p_event_id,v_kind,v_state.revision,v_snapshot,p_actor,p_actor
  )
  on conflict do nothing
  returning * into v_job;

  if v_job.id is null then
    select * into v_job
    from app_modules.liveticker_graphic_jobs
    where event_id=p_event_id and graphic_kind=v_kind and status in ('QUEUED','PROCESSING')
    order by created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'jobId',v_job.id,'eventId',v_job.event_id,'kind',v_job.graphic_kind,
    'status',v_job.status,'sourceRevision',v_job.source_revision,
    'createdAt',v_job.created_at
  );
end;
$$;

create or replace function app_private.liveticker_graphic_autqueue()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='UPDATE' then
    if old.minute <= 20 and new.minute > 20 then
      perform app_private.liveticker_graphic_enqueue(new.event_id,'PERIOD_1',null);
    end if;
    if old.minute <= 40 and new.minute > 40 then
      perform app_private.liveticker_graphic_enqueue(new.event_id,'PERIOD_2',null);
    end if;
    if old.completed_at is null and new.completed_at is not null then
      perform app_private.liveticker_graphic_enqueue(new.event_id,'FINAL',null);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists liveticker_graphic_autqueue_r1 on app_modules.liveticker_game_states;
create trigger liveticker_graphic_autqueue_r1
after update of minute,completed_at on app_modules.liveticker_game_states
for each row execute function app_private.liveticker_graphic_autqueue();

create or replace function public.pd_public_liveticker_graphic_enqueue(p_event_id uuid,p_kind text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_actor uuid;
begin
  v_actor:=app_private.liveticker_require_operator();
  return app_private.liveticker_graphic_enqueue(p_event_id,p_kind,v_actor);
end;
$$;

create or replace function public.pd_public_liveticker_graphic_jobs(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  perform app_private.liveticker_require_operator();
  perform app_private.liveticker_assert_supported_game(p_event_id);
  return jsonb_build_object('jobs',coalesce((
    select jsonb_agg(jsonb_build_object(
      'jobId',j.id,'kind',j.graphic_kind,'status',j.status,
      'sourceRevision',j.source_revision,'attemptCount',j.attempt_count,
      'createdAt',j.created_at,'completedAt',j.completed_at,
      'errorCode',j.last_error_code,'result',j.result_manifest
    ) order by j.created_at desc)
    from (select * from app_modules.liveticker_graphic_jobs where event_id=p_event_id order by created_at desc limit 30) j
  ),'[]'::jsonb));
end;
$$;

create or replace function app_private.liveticker_graphic_worker_authorized(p_token text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select p_token is not null
    and length(p_token) between 32 and 2048
    and pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_token,'UTF8'),'sha256'),'hex')
        = 'b70a4b43dbb9d1e65050fab9199b10b8f6ae67f03ba879cbec1484ee2548085d';
$$;

create or replace function app_private.liveticker_graphic_retry_delay(p_attempt integer)
returns interval
language sql
immutable
set search_path=''
as $$
  select make_interval(secs => least(900, 30 * (2 ^ greatest(0,least(coalesce(p_attempt,1)-1,5)))::integer));
$$;

create or replace function app_private.liveticker_graphic_manifest_valid(p_manifest jsonb,p_kind text)
returns boolean
language plpgsql
immutable
set search_path=''
as $$
declare v_artifact jsonb; v_seen text[]:=array[]::text[]; v_kind text;
begin
  if jsonb_typeof(p_manifest)<>'object' or p_manifest->>'schemaVersion'<>'1'
     or upper(coalesce(p_manifest->>'graphicKind',''))<>upper(coalesce(p_kind,''))
     or jsonb_typeof(p_manifest->'artifacts')<>'array'
     or jsonb_array_length(p_manifest->'artifacts')<>2 then return false; end if;
  for v_artifact in select value from jsonb_array_elements(p_manifest->'artifacts') loop
    v_kind:=upper(coalesce(v_artifact->>'kind',''));
    if v_kind not in ('POST','STORY') or v_kind=any(v_seen) then return false; end if;
    if coalesce(v_artifact->>'filename','') !~ '^[A-Za-z0-9._-]+[.]png$' then return false; end if;
    if coalesce(v_artifact->>'nextcloudPath','') not like '/Liveticker/%'
       or (v_artifact->>'nextcloudPath') like '%..%'
       or (v_artifact->>'nextcloudPath') like '%\\%'
       or (v_artifact->>'nextcloudPath') like '%?%'
       or (v_artifact->>'nextcloudPath') like '%#%' then return false; end if;
    if coalesce(v_artifact->>'sha256','') !~ '^[0-9a-f]{64}$' then return false; end if;
    if coalesce(v_artifact->>'bytes','') !~ '^[0-9]+$' or (v_artifact->>'bytes')::numeric not between 1 and 104857600 then return false; end if;
    v_seen:=array_append(v_seen,v_kind);
  end loop;
  return array['POST','STORY'] <@ v_seen;
exception when others then return false;
end;
$$;

create or replace function public.pd_public_liveticker_graphic_worker_claim(p_worker_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_job app_modules.liveticker_graphic_jobs%rowtype; v_token uuid;
begin
  if not app_private.liveticker_graphic_worker_authorized(p_worker_token) then
    raise exception 'LIVETICKER_WORKER_UNAUTHORIZED' using errcode='42501';
  end if;
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

create or replace function public.pd_public_liveticker_graphic_worker_complete(
  p_worker_token text,p_job_id uuid,p_claim_token uuid,p_success boolean,
  p_error_code text,p_result_manifest jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_job app_modules.liveticker_graphic_jobs%rowtype; v_retry boolean;
begin
  if not app_private.liveticker_graphic_worker_authorized(p_worker_token) then
    raise exception 'LIVETICKER_WORKER_UNAUTHORIZED' using errcode='42501';
  end if;
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

revoke all on function app_private.liveticker_graphic_enqueue(uuid,text,uuid) from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_graphic_autqueue() from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_graphic_worker_authorized(text) from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_graphic_retry_delay(integer) from public,anon,authenticated,service_role;
revoke all on function app_private.liveticker_graphic_manifest_valid(jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.pd_public_liveticker_graphic_enqueue(uuid,text) from public,anon,authenticated;
grant execute on function public.pd_public_liveticker_graphic_enqueue(uuid,text) to authenticated;
revoke all on function public.pd_public_liveticker_graphic_jobs(uuid) from public,anon,authenticated;
grant execute on function public.pd_public_liveticker_graphic_jobs(uuid) to authenticated;
revoke all on function public.pd_public_liveticker_graphic_worker_claim(text) from public,anon,authenticated;
grant execute on function public.pd_public_liveticker_graphic_worker_claim(text) to anon;
revoke all on function public.pd_public_liveticker_graphic_worker_complete(text,uuid,uuid,boolean,text,jsonb) from public,anon,authenticated;
grant execute on function public.pd_public_liveticker_graphic_worker_complete(text,uuid,uuid,boolean,text,jsonb) to anon;
