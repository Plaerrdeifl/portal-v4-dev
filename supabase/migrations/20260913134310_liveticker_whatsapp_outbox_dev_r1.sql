-- Liveticker -> WhatsApp Channel durable outbox (DEV).

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
grant select on table app_modules.liveticker_whatsapp_jobs to service_role;

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
