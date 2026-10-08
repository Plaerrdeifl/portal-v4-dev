begin;

create or replace function app_private.notification_dispatch_has_work()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (
      select 1
      from app_private.notification_events as event
      where event.status in ('PENDING', 'PROCESSING')
        and event.next_attempt_at <= pg_catalog.now()
        and (
          event.status = 'PENDING'
          or event.claim_expires_at is null
          or event.claim_expires_at <= pg_catalog.now()
        )
    )
    or exists (
      select 1
      from app_private.notification_outbox as outbox
      where outbox.status = 'PROCESSING'
        and outbox.claim_expires_at <= pg_catalog.now()
    )
    or exists (
      select 1
      from app_private.notification_outbox as outbox
      where outbox.status in ('PENDING', 'RETRY')
        and (
          outbox.next_attempt_at <= pg_catalog.now()
          or outbox.expires_at <= pg_catalog.now()
          or (
            outbox.channel = 'PUSH'
            and not exists (
              select 1
              from app_portal.push_subscriptions as subscription
              where subscription.id = outbox.push_subscription_id
                and subscription.is_active = true
            )
          )
        )
    )
    or exists (
      select 1
      from app_private.notification_events as event
      where event.status = 'EXPANDED'
        and exists (
          select 1
          from app_private.notification_outbox as outbox
          where outbox.event_id = event.id
        )
        and not exists (
          select 1
          from app_private.notification_outbox as outbox
          where outbox.event_id = event.id
            and outbox.status in ('PENDING', 'PROCESSING', 'RETRY')
        )
    );
$function$;

revoke all on function app_private.notification_dispatch_has_work()
from public, anon, authenticated, service_role;

grant execute on function app_private.notification_dispatch_has_work()
to postgres;

create or replace function app_private.invoke_notification_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_url text := '';
  v_secret text := '';
  v_request_id bigint;
begin
  if not app_private.notification_dispatch_has_work() then
    return null;
  end if;

  select ds.decrypted_secret into v_url
  from vault.decrypted_secrets ds
  where ds.name = 'pd_notification_dispatch_url'
  limit 1;

  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets ds
  where ds.name = 'pd_notification_dispatch_secret'
  limit 1;

  if coalesce(v_url, '') = ''
     or coalesce(v_secret, '') = '' then
    return null;
  end if;

  if v_url !~ '^https://[a-z0-9-]+\.supabase\.co/functions/v1/notification-dispatch$' then
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-m020-notification-dispatch-secret', v_secret
    ),
    body := jsonb_build_object(
      'source', 'database',
      'requestedAt', now()
    ),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

revoke all on function app_private.invoke_notification_dispatch()
from public, anon, authenticated, service_role;

grant execute on function app_private.invoke_notification_dispatch()
to postgres;

create or replace function public.pd_social_media_render_worker_work_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'media', exists (
      select 1
      from app_social_media.media_uploads as upload
      where (
          (
            upload.upload_status = 'QUEUED'
            and upload.available_at <= pg_catalog.now()
          )
          or (
            upload.upload_status = 'PROCESSING'
            and upload.claim_expires_at < pg_catalog.now()
          )
        )
        and upload.attempt_count < upload.max_attempts
    ),
    'liveticker', exists (
      select 1
      from app_social_media.liveticker_render_requests as request
      where (
          (
            request.status = 'QUEUED'
            and request.attempt_count < request.max_attempts
            and request.available_at <= pg_catalog.now()
          )
          or (
            request.status = 'PROCESSING'
            and request.claim_expires_at < pg_catalog.now()
          )
        )
    ),
    'render', exists (
      select 1
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
    ),
    'cloud', exists (
      select 1
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
    )
  );
$function$;

revoke all on function public.pd_social_media_render_worker_work_status()
from public, anon, authenticated, service_role;

grant execute on function public.pd_social_media_render_worker_work_status()
to postgres, service_role;

commit;
