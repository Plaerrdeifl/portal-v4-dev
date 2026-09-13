-- Service-role-only worker projection for the DEV WhatsApp outbox.
-- The Edge Function uses this updatable view; browser roles receive no access.

create view public.pd_liveticker_whatsapp_jobs_worker
with (security_invoker = true)
as
select
  id,
  event_id,
  client_action_id,
  publication_version,
  requested_by,
  message,
  status,
  attempt_count,
  next_attempt_at,
  claimed_at,
  worker_received_at,
  waha_sent_at,
  completed_at,
  waha_message_id,
  last_error,
  created_at,
  updated_at
from app_modules.liveticker_whatsapp_jobs;

revoke all on table app_modules.liveticker_whatsapp_jobs
  from public, anon, authenticated, service_role;
grant select, update on table app_modules.liveticker_whatsapp_jobs to service_role;

revoke all on table public.pd_liveticker_whatsapp_jobs_worker
  from public, anon, authenticated, service_role;
grant select, update on table public.pd_liveticker_whatsapp_jobs_worker to service_role;
