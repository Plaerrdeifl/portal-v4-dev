-- Liveticker -> WhatsApp Channel publishing outbox (DEV first).
-- The browser may attach a transient _whatsapp marker to an upsert. This
-- wrapper strips it before persistence and enqueues only first-time actions.

create table app_modules.liveticker_whatsapp_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  event_id uuid not null,
  client_action_id text not null,
  publication_version integer not null default 1,
  requested_by uuid not null,
  message text not null,
  status text not null default 'PENDING',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  worker_received_at timestamptz,
  waha_sent_at timestamptz,
  completed_at timestamptz,
  waha_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint liveticker_whatsapp_jobs_action_check check (char_length(client_action_id) between 1 and 100),
  constraint liveticker_whatsapp_jobs_version_check check (publication_version > 0),
  constraint liveticker_whatsapp_jobs_message_check check (char_length(btrim(message)) between 1 and 4000),
  constraint liveticker_whatsapp_jobs_status_check check (status in ('PENDING','PROCESSING','SUCCEEDED','FAILED')),
  constraint liveticker_whatsapp_jobs_attempt_check check (attempt_count between 0 and 5),
  constraint liveticker_whatsapp_jobs_unique unique (event_id, client_action_id, publication_version)
);

create index liveticker_whatsapp_jobs_claim_idx
  on app_modules.liveticker_whatsapp_jobs(status, next_attempt_at, created_at)
  where status in ('PENDING','FAILED','PROCESSING');

alter table app_modules.liveticker_whatsapp_jobs enable row level security;
revoke all on table app_modules.liveticker_whatsapp_jobs from public, anon, authenticated, service_role;
-- Required for a service-role Realtime postgres_changes subscription. Mutations
-- remain RPC-only and therefore unavailable as direct table writes.
grant select on table app_modules.liveticker_whatsapp_jobs to service_role;

-- Realtime is only the low-latency wake-up path. The worker still claims from
-- the durable outbox, so missed websocket events are recovered by polling.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'app_modules'
      and tablename = 'liveticker_whatsapp_jobs'
  ) then
    alter publication supabase_realtime add table app_modules.liveticker_whatsapp_jobs;
  end if;
end
$$;

alter function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  rename to pd_public_liveticker_sync_before_whatsapp_channel_r1;

-- The renamed implementation must not remain an externally callable bypass.
revoke all on function public.pd_public_liveticker_sync_before_whatsapp_channel_r1(uuid, integer, jsonb, text)
  from public, anon, authenticated, service_role;

create function public.pd_public_liveticker_sync(
  p_event_id uuid,
  p_expected_revision integer,
  p_changes jsonb,
  p_client_id text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb := p_changes;
  v_clean_upserts jsonb := '[]'::jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_item jsonb;
  v_candidate jsonb;
  v_marker jsonb;
  v_action_id text;
  v_message text;
  v_result jsonb;
  v_actor uuid;
  v_exists boolean;
begin
  -- Leave malformed legacy payloads to the existing implementation so its
  -- established validation/error contract remains unchanged.
  if p_changes is not null
     and jsonb_typeof(p_changes) = 'object'
     and p_changes ? 'upserts'
     and jsonb_typeof(p_changes -> 'upserts') = 'array' then

    for v_item in select value from jsonb_array_elements(p_changes -> 'upserts')
    loop
      if jsonb_typeof(v_item) = 'object' and v_item ? '_whatsapp' then
        v_marker := v_item -> '_whatsapp';

        if jsonb_typeof(v_marker) <> 'object'
           or v_marker - array['publish','text'] <> '{}'::jsonb
           or jsonb_typeof(v_marker -> 'publish') <> 'boolean' then
          raise exception 'LIVETICKER_INVALID_WHATSAPP_PUBLISH' using errcode = '22023';
        end if;

        if (v_marker ->> 'publish')::boolean then
          if jsonb_typeof(v_marker -> 'text') <> 'string' then
            raise exception 'LIVETICKER_INVALID_WHATSAPP_TEXT' using errcode = '22023';
          end if;

          v_message := v_marker ->> 'text';
          if char_length(btrim(v_message)) not between 1 and 4000 then
            raise exception 'LIVETICKER_INVALID_WHATSAPP_TEXT' using errcode = '22023';
          end if;

          if jsonb_typeof(v_item -> 'id') = 'string' then
            v_action_id := v_item ->> 'id';
            select exists (
              select 1
              from app_modules.liveticker_actions a
              where a.event_id = p_event_id
                and a.client_action_id = v_action_id
            ) into v_exists;

            if not v_exists then
              v_candidates := v_candidates || jsonb_build_array(
                jsonb_build_object('actionId', v_action_id, 'message', v_message)
              );
            end if;
          end if;
        end if;
      end if;

      if jsonb_typeof(v_item) = 'object' then
        v_clean_upserts := v_clean_upserts || jsonb_build_array(v_item - '_whatsapp');
      else
        v_clean_upserts := v_clean_upserts || jsonb_build_array(v_item);
      end if;
    end loop;

    v_changes := jsonb_set(p_changes, '{upserts}', v_clean_upserts, false);
  end if;

  -- Authenticate publication requests separately. The historical DEV sync RPC
  -- remains usable exactly as before, but only an ACTIVE operator with the
  -- liveticker.manage capability can create an outbound WhatsApp job.
  if jsonb_array_length(v_candidates) > 0 then
    v_actor := app_private.liveticker_require_operator();
  end if;

  v_result := public.pd_public_liveticker_sync_before_whatsapp_channel_r1(
    p_event_id,
    p_expected_revision,
    v_changes,
    p_client_id
  );

  if jsonb_array_length(v_candidates) > 0 then
    for v_candidate in select value from jsonb_array_elements(v_candidates)
    loop
      insert into app_modules.liveticker_whatsapp_jobs(
        event_id,
        client_action_id,
        publication_version,
        requested_by,
        message
      ) values (
        p_event_id,
        v_candidate ->> 'actionId',
        1,
        v_actor,
        v_candidate ->> 'message'
      )
      on conflict (event_id, client_action_id, publication_version) do nothing;
    end loop;
  end if;

  return v_result;
end
$$;

revoke all on function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  to anon, authenticated;

create function public.pd_liveticker_whatsapp_worker_claim()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job app_modules.liveticker_whatsapp_jobs%rowtype;
begin
  select j.* into v_job
  from app_modules.liveticker_whatsapp_jobs j
  where j.attempt_count < 5
    and (
      (j.status in ('PENDING','FAILED') and j.next_attempt_at <= now())
      or (j.status = 'PROCESSING' and j.claimed_at < now() - interval '2 minutes')
    )
  order by j.created_at, j.id
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update app_modules.liveticker_whatsapp_jobs
  set status = 'PROCESSING',
      attempt_count = attempt_count + 1,
      claimed_at = now(),
      worker_received_at = now(),
      last_error = null,
      updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object(
    'id', v_job.id,
    'eventId', v_job.event_id,
    'clientActionId', v_job.client_action_id,
    'publicationVersion', v_job.publication_version,
    'message', v_job.message,
    'attemptCount', v_job.attempt_count,
    'createdAt', v_job.created_at,
    'workerReceivedAt', v_job.worker_received_at
  );
end
$$;

create function public.pd_liveticker_whatsapp_worker_complete(
  p_job_id uuid,
  p_waha_message_id text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job app_modules.liveticker_whatsapp_jobs%rowtype;
begin
  select * into v_job
  from app_modules.liveticker_whatsapp_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'LIVETICKER_WHATSAPP_JOB_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_job.status = 'SUCCEEDED' then
    return jsonb_build_object('id', v_job.id, 'status', v_job.status, 'completedAt', v_job.completed_at);
  end if;

  if v_job.status <> 'PROCESSING' then
    raise exception 'LIVETICKER_WHATSAPP_JOB_NOT_PROCESSING' using errcode = '55000';
  end if;

  update app_modules.liveticker_whatsapp_jobs
  set status = 'SUCCEEDED',
      waha_message_id = nullif(btrim(p_waha_message_id), ''),
      waha_sent_at = now(),
      completed_at = now(),
      next_attempt_at = now(),
      last_error = null,
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  return jsonb_build_object('id', v_job.id, 'status', v_job.status, 'completedAt', v_job.completed_at);
end
$$;

create function public.pd_liveticker_whatsapp_worker_fail(
  p_job_id uuid,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job app_modules.liveticker_whatsapp_jobs%rowtype;
  v_delay_seconds integer;
begin
  select * into v_job
  from app_modules.liveticker_whatsapp_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'LIVETICKER_WHATSAPP_JOB_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_job.status = 'SUCCEEDED' then
    return jsonb_build_object('id', v_job.id, 'status', v_job.status, 'nextAttemptAt', null);
  end if;

  if v_job.status <> 'PROCESSING' then
    raise exception 'LIVETICKER_WHATSAPP_JOB_NOT_PROCESSING' using errcode = '55000';
  end if;

  v_delay_seconds := case v_job.attempt_count
    when 1 then 1
    when 2 then 5
    when 3 then 15
    else 60
  end;

  update app_modules.liveticker_whatsapp_jobs
  set status = 'FAILED',
      next_attempt_at = case
        when attempt_count < 5 then now() + (v_delay_seconds * interval '1 second')
        else now()
      end,
      last_error = left(coalesce(nullif(btrim(p_error), ''), 'UNKNOWN_ERROR'), 1000),
      updated_at = now()
  where id = p_job_id
  returning * into v_job;

  return jsonb_build_object(
    'id', v_job.id,
    'status', v_job.status,
    'attemptCount', v_job.attempt_count,
    'retryable', v_job.attempt_count < 5,
    'nextAttemptAt', case when v_job.attempt_count < 5 then v_job.next_attempt_at else null end
  );
end
$$;

revoke all on function public.pd_liveticker_whatsapp_worker_claim() from public, anon, authenticated, service_role;
revoke all on function public.pd_liveticker_whatsapp_worker_complete(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.pd_liveticker_whatsapp_worker_fail(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.pd_liveticker_whatsapp_worker_claim() to service_role;
grant execute on function public.pd_liveticker_whatsapp_worker_complete(uuid, text) to service_role;
grant execute on function public.pd_liveticker_whatsapp_worker_fail(uuid, text) to service_role;
