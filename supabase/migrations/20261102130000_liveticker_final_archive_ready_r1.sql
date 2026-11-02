-- AP-LT-FINAL-ARCHIVE-READY: only the authorized, durable FINAL intent can complete a game.
-- No historic render request is implicitly finalizable. No new queue or browser privileges.
begin;

create table app_modules.liveticker_finalizations (
  event_id uuid primary key references app_modules.events(id) on delete restrict,
  id uuid not null unique default extensions.gen_random_uuid(),
  request_id uuid not null unique references app_social_media.liveticker_render_requests(id) on delete restrict,
  requested_by uuid not null references app_portal.users(id) on delete restrict,
  requested_revision integer not null check (requested_revision >= 0),
  client_request_id uuid not null,
  status text not null check (status in (
    'RENDERING','FINALIZE_PENDING','RETRYABLE_ERROR','GRAPHIC_FAILED',
    'REQUIRES_REVIEW','COMPLETED'
  )),
  error_code text,
  retry_attempts integer not null default 0 check (retry_attempts >= 0),
  next_retry_at timestamptz,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint liveticker_finalizations_completed_chk
    check ((status = 'COMPLETED') = (completed_at is not null))
);

create index liveticker_finalizations_recovery_idx
  on app_modules.liveticker_finalizations(status,next_retry_at)
  where status in ('FINALIZE_PENDING','RETRYABLE_ERROR');

alter table app_modules.liveticker_finalizations enable row level security;
revoke all on table app_modules.liveticker_finalizations from public, anon, authenticated, service_role;

create function app_private.liveticker_finalization_json(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_final app_modules.liveticker_finalizations%rowtype; v_job app_social_media.liveticker_render_requests%rowtype;
        v_game app_modules.liveticker_game_states%rowtype;
begin
  select * into v_final from app_modules.liveticker_finalizations where event_id = p_event_id;
  select * into v_game from app_modules.liveticker_game_states where event_id = p_event_id;
  if not found then
    return jsonb_build_object('eventId',p_event_id,'status','NOT_REQUESTED','completedAt',null);
  end if;
  if v_final.id is null then
    return jsonb_build_object('eventId',p_event_id,
      'status',case when v_game.completed_at is not null then 'COMPLETED' else 'NOT_REQUESTED' end,
      'completedAt',v_game.completed_at);
  end if;
  select * into v_job from app_social_media.liveticker_render_requests where id = v_final.request_id;
  return pg_catalog.jsonb_strip_nulls(jsonb_build_object(
    'eventId',v_final.event_id,'finalizationId',v_final.id,'jobId',v_final.request_id,
    'status',v_final.status,'graphicStatus',v_job.status,'errorCode',v_final.error_code,
    'requestedRevision',v_final.requested_revision,'requestedAt',v_final.requested_at,
    'updatedAt',v_final.updated_at,'completedAt',v_game.completed_at
  ));
end;
$fn$;

create function app_private.api_liveticker_finalization_status(p_payload jsonb)
returns jsonb language plpgsql stable security definer set search_path = ''
as $fn$
declare v_event_id uuid;
begin
  perform app_private.liveticker_require_operator();
  v_event_id := nullif(btrim(coalesce(p_payload->>'eventId','')),'')::uuid;
  if v_event_id is null then
    raise exception 'LIVETICKER_FINAL_EVENT_REQUIRED' using errcode = '22023';
  end if;
  perform app_private.liveticker_assert_supported_game(v_event_id);
  return app_private.liveticker_finalization_json(v_event_id);
end;
$fn$;

create function app_private.api_liveticker_finalization_start(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare v_actor uuid := app_private.liveticker_require_operator();
        v_event_id uuid; v_expected integer; v_key uuid; v_retry boolean;
        v_state app_modules.liveticker_game_states%rowtype;
        v_final app_modules.liveticker_finalizations%rowtype;
        v_result jsonb; v_request uuid; v_request_revision integer;
begin
  v_event_id := nullif(btrim(coalesce(p_payload->>'eventId','')),'')::uuid;
  v_expected := nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  v_key := nullif(btrim(coalesce(p_payload->>'clientRequestId','')),'')::uuid;
  v_retry := coalesce((p_payload->>'retry')::boolean,false);
  if v_event_id is null or v_expected is null or v_key is null then
    raise exception 'LIVETICKER_FINAL_REQUEST_INVALID' using errcode = '22023';
  end if;
  perform app_private.liveticker_assert_supported_game(v_event_id);
  select * into v_state from app_modules.liveticker_game_states
  where event_id = v_event_id for update;
  if not found then
    raise exception 'LIVETICKER_FINAL_GAME_NOT_STARTED' using errcode = 'PT409';
  end if;
  select * into v_final from app_modules.liveticker_finalizations
  where event_id = v_event_id for update;
  if v_state.completed_at is not null then
    if v_final.id is not null then return app_private.liveticker_finalization_json(v_event_id); end if;
    raise exception 'LIVETICKER_GAME_COMPLETED' using errcode = 'PT409';
  end if;
  if v_final.id is not null then
    if v_final.status in ('RENDERING','FINALIZE_PENDING','RETRYABLE_ERROR') then
      return app_private.liveticker_finalization_json(v_event_id);
    end if;
    if not v_retry then
      raise exception 'LIVETICKER_FINAL_RETRY_REQUIRED' using errcode = 'PT409';
    end if;
  elsif v_retry then
    raise exception 'LIVETICKER_FINAL_NOT_REQUESTED' using errcode = 'PT409';
  end if;
  if v_state.revision <> v_expected then
    raise exception 'LIVETICKER_STALE_REVISION' using errcode = 'PT409';
  end if;
  if v_state.minute < 60 then
    raise exception 'LIVETICKER_FINAL_TOO_EARLY' using errcode = 'PT409';
  end if;
  -- Rendering is enqueued inside the same transaction as the durable intent.
  v_result := app_private.api_social_media_generator_liveticker_render_start(
    jsonb_build_object('eventId',v_event_id,'kind','FINAL')
  );
  v_request := coalesce(nullif(v_result->>'requestId',''),nullif(v_result->>'jobId',''))::uuid;
  if v_request is null then
    raise exception 'LIVETICKER_FINAL_JOB_MISSING' using errcode = 'PT409';
  end if;
  select source_revision into v_request_revision from app_social_media.liveticker_render_requests
  where id = v_request and event_id = v_event_id and graphic_kind = 'FINAL'
    and status in ('QUEUED','PROCESSING');
  if not found or v_request_revision <> v_state.revision then
    raise exception 'LIVETICKER_FINAL_JOB_STALE' using errcode = 'PT409';
  end if;
  insert into app_modules.liveticker_finalizations(
    event_id,request_id,requested_by,requested_revision,client_request_id,status
  ) values (v_event_id,v_request,v_actor,v_state.revision,v_key,'RENDERING')
  on conflict (event_id) do update set
    request_id = excluded.request_id,
    requested_by = excluded.requested_by,
    requested_revision = excluded.requested_revision,
    client_request_id = excluded.client_request_id,
    status = 'RENDERING', error_code = null, retry_attempts = 0,
    next_retry_at = null, updated_at = now(), completed_at = null
  ;
  perform app_private.log_audit(
    v_actor,'LIVETICKER_FINAL_REQUESTED','liveticker_finalization',v_event_id::text,
    null,jsonb_build_object('requestId',v_request,'revision',v_state.revision,'retry',v_retry)
  );
  return app_private.liveticker_finalization_json(v_event_id);
end;
$fn$;

-- The worker is already authenticated by the existing token-gated Edge RPC.
-- Never emulate auth.uid() or call the browser completion contract as service_role.
create function app_private.liveticker_finalization_process(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_final app_modules.liveticker_finalizations%rowtype;
        v_state app_modules.liveticker_game_states%rowtype;
        v_job app_social_media.liveticker_render_requests%rowtype;
        v_kinds text[];
        v_new integer;
begin
  -- Serialize completion with concurrent game changes and operator requests.
  select * into v_job from app_social_media.liveticker_render_requests
  where id = p_request_id and graphic_kind = 'FINAL';
  if not found then return; end if;
  select * into v_state from app_modules.liveticker_game_states
  where event_id = v_job.event_id for update;
  select * into v_final from app_modules.liveticker_finalizations
  where event_id = v_job.event_id and request_id = p_request_id for update;
  if not found or v_final.status in ('COMPLETED','REQUIRES_REVIEW','GRAPHIC_FAILED') then return; end if;
  if v_job.status <> 'SUCCEEDED' then return; end if;
  if v_state.event_id is null or v_state.completed_at is not null
     or v_state.revision <> v_final.requested_revision
     or v_job.source_revision <> v_final.requested_revision
     or (v_job.result_manifest->>'sourceRevision')::integer <> v_final.requested_revision then
    update app_modules.liveticker_finalizations set status='REQUIRES_REVIEW',
      error_code='LIVETICKER_FINAL_REVISION_CHANGED',next_retry_at=null,updated_at=now()
    where event_id=v_final.event_id;
    return;
  end if;
  if jsonb_typeof(v_job.result_manifest->'artifacts') <> 'array' then
    update app_modules.liveticker_finalizations set status='REQUIRES_REVIEW',
      error_code='LIVETICKER_FINAL_ARTIFACTS_INVALID',next_retry_at=null,updated_at=now()
    where event_id=v_final.event_id;
    return;
  end if;
  select array_agg(artifact->>'kind' order by artifact->>'kind')
  into v_kinds
  from jsonb_array_elements(v_job.result_manifest->'artifacts') artifact;
  if v_kinds is distinct from array['POST','STORY']::text[] then
    update app_modules.liveticker_finalizations set status='REQUIRES_REVIEW',
      error_code='LIVETICKER_FINAL_ARTIFACTS_INVALID',next_retry_at=null,updated_at=now()
    where event_id=v_final.event_id;
    return;
  end if;
  v_new := v_state.revision + 1;
  update app_modules.liveticker_game_states
  set completed_at=now(),revision=v_new,updated_at=now()
  where event_id=v_final.event_id and completed_at is null;
  if not found then
    raise exception 'LIVETICKER_FINAL_CONCURRENT_COMPLETE' using errcode='PT409';
  end if;
  insert into app_modules.liveticker_journal(event_id,game_revision,mutation_type,client_id)
  values (v_final.event_id,v_new,'GAME_COMPLETED','server:final:'||v_final.id::text);
  update app_modules.liveticker_finalizations set status='COMPLETED',
    error_code=null,next_retry_at=null,completed_at=now(),updated_at=now()
  where event_id=v_final.event_id;
  perform app_private.log_audit(
    v_final.requested_by,'LIVETICKER_FINAL_COMPLETED','liveticker_finalization',
    v_final.event_id::text,null,jsonb_build_object('requestId',p_request_id,'revision',v_new)
  );
end;
$fn$;

-- Retain the existing service-role endpoint/lease behaviour; extend it in place.
alter function public.pd_social_media_liveticker_render_worker_complete(uuid,uuid,boolean,text,jsonb)
  rename to pd_social_media_liveticker_render_worker_complete_before_final_r1;
create function public.pd_social_media_liveticker_render_worker_complete(
  p_request_id uuid,p_claim_token uuid,p_success boolean,p_error_code text,p_result_manifest jsonb
) returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare v_result jsonb; v_job app_social_media.liveticker_render_requests%rowtype;
begin
  select * into v_job from app_social_media.liveticker_render_requests where id=p_request_id;
  if v_job.status='SUCCEEDED' and p_success
     and v_job.last_completed_claim_token=p_claim_token then
    begin
      perform app_private.liveticker_finalization_process(p_request_id);
    exception when others then
      null; -- Scheduled recovery remains authoritative for transient failures.
    end;
    return app_private.social_media_liveticker_render_request_json(p_request_id);
  end if;
  v_result := public.pd_social_media_liveticker_render_worker_complete_before_final_r1(
    p_request_id,p_claim_token,p_success,p_error_code,p_result_manifest
  );
  if p_success then
    update app_modules.liveticker_finalizations set status='FINALIZE_PENDING',
      updated_at=now() where request_id=p_request_id and status='RENDERING';
    begin
      perform app_private.liveticker_finalization_process(p_request_id);
    exception when others then
      update app_modules.liveticker_finalizations set
        status=case when retry_attempts >= 19 then 'REQUIRES_REVIEW' else 'RETRYABLE_ERROR' end,
        error_code='LIVETICKER_FINAL_COMPLETE_RETRY',
        retry_attempts=retry_attempts+1,
        next_retry_at=now()+interval '30 seconds',
        updated_at=now()
      where request_id=p_request_id and status in ('RENDERING','FINALIZE_PENDING','RETRYABLE_ERROR');
    end;
  else
    update app_modules.liveticker_finalizations f set
      status=case when r.status='FAILED' then 'GRAPHIC_FAILED' else 'RENDERING' end,
      error_code=case when r.status='FAILED' then 'LIVETICKER_FINAL_GRAPHIC_FAILED' else null end,
      updated_at=now()
    from app_social_media.liveticker_render_requests r
    where r.id=p_request_id and f.request_id=r.id and f.status='RENDERING';
  end if;
  return v_result;
end;
$fn$;
revoke all on function public.pd_social_media_liveticker_render_worker_complete(uuid,uuid,boolean,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.pd_social_media_liveticker_render_worker_complete(uuid,uuid,boolean,text,jsonb)
  to service_role;

-- Recovery is scheduled by the worker's existing poll. No new worker or queue.
create function app_private.liveticker_finalization_recover_one()
returns void language plpgsql security definer set search_path = ''
as $fn$
declare v_request_id uuid;
begin
  select f.request_id into v_request_id
  from app_modules.liveticker_finalizations f
  join app_social_media.liveticker_render_requests r on r.id=f.request_id
  where f.status in ('FINALIZE_PENDING','RETRYABLE_ERROR')
    and r.status='SUCCEEDED'
    and (f.next_retry_at is null or f.next_retry_at <= now())
  order by f.updated_at,f.event_id
  limit 1;
  if not found then return; end if;
  begin
    perform app_private.liveticker_finalization_process(v_request_id);
  exception when others then
    update app_modules.liveticker_finalizations set
      status=case when retry_attempts >= 19 then 'REQUIRES_REVIEW' else 'RETRYABLE_ERROR' end,
      error_code='LIVETICKER_FINAL_RECOVERY_RETRY',
      retry_attempts=retry_attempts+1,next_retry_at=now()+interval '30 seconds',
      updated_at=now()
    where request_id=v_request_id and status in ('FINALIZE_PENDING','RETRYABLE_ERROR');
  end;
end;
$fn$;

alter function public.pd_social_media_liveticker_render_worker_claim()
  rename to pd_social_media_liveticker_render_worker_claim_before_final_r1;
create function public.pd_social_media_liveticker_render_worker_claim()
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
begin
  perform app_private.liveticker_finalization_recover_one();
  return public.pd_social_media_liveticker_render_worker_claim_before_final_r1();
end;
$fn$;
revoke all on function public.pd_social_media_liveticker_render_worker_claim()
  from public,anon,authenticated;
grant execute on function public.pd_social_media_liveticker_render_worker_claim()
  to service_role;

alter function public.pd_social_media_render_worker_work_status()
  rename to pd_social_media_render_worker_work_status_before_final_r1;
create function public.pd_social_media_render_worker_work_status()
returns jsonb language sql stable security definer set search_path = ''
as $fn$
  select jsonb_set(
    public.pd_social_media_render_worker_work_status_before_final_r1(),
    '{liveticker}',
    to_jsonb(
      coalesce((public.pd_social_media_render_worker_work_status_before_final_r1()->>'liveticker')::boolean,false)
      or exists(
        select 1 from app_modules.liveticker_finalizations f
        join app_social_media.liveticker_render_requests r on r.id=f.request_id
        where f.status in ('FINALIZE_PENDING','RETRYABLE_ERROR') and r.status='SUCCEEDED'
          and (f.next_retry_at is null or f.next_retry_at<=now())
      )
    )
  );
$fn$;
revoke all on function public.pd_social_media_render_worker_work_status()
  from public,anon,authenticated;
grant execute on function public.pd_social_media_render_worker_work_status()
  to service_role;

-- Give the new actions the same narrowly-scoped DEV cockpit mutation gate as
-- other existing Liveticker game management, never a global READ_ONLY bypass.
alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_final_r1;
create function app_private.platform_action_classification(p_action text)
returns text language plpgsql stable security definer set search_path = ''
as $fn$
begin
  case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_finalization_start' then return 'USER_MUTATION';
    when 'liveticker_finalization_status' then return 'READ';
    else return app_private.platform_action_classification_before_final_r1(p_action);
  end case;
end;
$fn$;

alter function app_private.require_platform_user_write_allowed(text,uuid)
  rename to require_platform_user_write_allowed_before_final_r1;
create function app_private.require_platform_user_write_allowed(p_action text,p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $fn$
begin
  if lower(btrim(coalesce(p_action,'')))='liveticker_finalization_start' then
    perform app_private.require_platform_user_write_allowed_before_final_r1(
      'liveticker_spieltage_status',p_actor
    );
  else
    perform app_private.require_platform_user_write_allowed_before_final_r1(p_action,p_actor);
  end if;
end;
$fn$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_before_final_r1;
create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $fn$
begin
  case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_finalization_start' then
      return app_private.api_liveticker_finalization_start(p_payload);
    when 'liveticker_finalization_status' then
      return app_private.api_liveticker_finalization_status(p_payload);
    else
      return app_private.pd_api_dispatch_before_final_r1(p_action,p_payload);
  end case;
end;
$fn$;


-- Register only the new, explicitly handled API actions.
alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_final_r1;
create function app_private.pd_api_current_actions()
returns text[] language sql stable security definer set search_path = ''
as $fn$
  select app_private.pd_api_current_actions_before_final_r1()
    || array['liveticker_finalization_start','liveticker_finalization_status']::text[];
$fn$;
revoke all on function app_private.pd_api_current_actions() from public,anon,authenticated,service_role;
grant execute on function app_private.pd_api_current_actions() to postgres;

-- Guard the canonical game sync against changes while a chosen final is being
-- rendered. Explicit REVIEW allows operator corrections and a fresh FINAL.
alter function public.pd_public_liveticker_sync(uuid,integer,jsonb,text)
  rename to pd_public_liveticker_sync_before_final_r1;
create function public.pd_public_liveticker_sync(
 p_event_id uuid,p_expected_revision integer,p_changes jsonb,p_client_id text default null
) returns jsonb language plpgsql security definer set search_path = ''
as $fn$
declare v_message text;
begin
  perform app_private.liveticker_require_operator();
  if exists(
    select 1 from app_modules.liveticker_finalizations
    where event_id=p_event_id and status in ('RENDERING','FINALIZE_PENDING','RETRYABLE_ERROR')
  ) then
    raise exception 'LIVETICKER_FINAL_IN_PROGRESS' using errcode='PT409';
  end if;
  return public.pd_public_liveticker_sync_before_final_r1(
    p_event_id,p_expected_revision,p_changes,p_client_id
  );
exception when sqlstate '55000' then
  get stacked diagnostics v_message=message_text;
  if v_message='LIVETICKER_GAME_COMPLETED' then
    raise sqlstate 'PT409' using message=v_message;
  end if;
  raise;
end;
$fn$;
revoke all on function public.pd_public_liveticker_sync(uuid,integer,jsonb,text)
  from public,anon;
grant execute on function public.pd_public_liveticker_sync(uuid,integer,jsonb,text)
  to authenticated,service_role;

-- Private implementation is never directly executable by client or service roles.
revoke all on function
  app_private.liveticker_finalization_json(uuid),
  app_private.api_liveticker_finalization_status(jsonb),
  app_private.api_liveticker_finalization_start(jsonb),
  app_private.liveticker_finalization_process(uuid),
  app_private.liveticker_finalization_recover_one(),
  app_private.platform_action_classification(text),
  app_private.require_platform_user_write_allowed(text,uuid),
  app_private.pd_api_dispatch_current(text,jsonb)
from public,anon,authenticated,service_role;
grant execute on function
  app_private.liveticker_finalization_json(uuid),
  app_private.api_liveticker_finalization_status(jsonb),
  app_private.api_liveticker_finalization_start(jsonb),
  app_private.liveticker_finalization_process(uuid),
  app_private.liveticker_finalization_recover_one(),
  app_private.platform_action_classification(text),
  app_private.require_platform_user_write_allowed(text,uuid),
  app_private.pd_api_dispatch_current(text,jsonb)
to postgres;

commit;
