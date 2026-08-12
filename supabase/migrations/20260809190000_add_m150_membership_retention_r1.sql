create function app_private.m150_minimize_membership_application_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.converted_at is null and new.converted_at is not null then
    new.applicant_message := null;
  end if;

  return new;
end;
$$;

create trigger membership_applications_minimize_message_on_conversion
before update of converted_at on app_fanclub.membership_applications
for each row
when (old.converted_at is null and new.converted_at is not null)
execute function app_private.m150_minimize_membership_application_message();

update app_fanclub.membership_applications
set applicant_message = null
where converted_at is not null
  and applicant_message is not null;

create function app_private.m150_membership_retention_run()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application record;
  v_cutoff timestamptz := clock_timestamp() - interval '12 months';
  v_purged integer := 0;
  v_pending integer := 0;
  v_rejected integer := 0;
  v_withdrawn integer := 0;
begin
  for v_application in
    select
      application.id,
      application.status,
      case application.status
        when 'PENDING' then application.submitted_at
        when 'REJECTED' then application.decided_at
        when 'WITHDRAWN' then application.updated_at
      end as retention_anchor,
      case application.status
        when 'PENDING' then 'STALE_PENDING'
        when 'REJECTED' then 'REJECTED_12_MONTHS'
        when 'WITHDRAWN' then 'WITHDRAWN_12_MONTHS'
      end as retention_reason
    from app_fanclub.membership_applications as application
    where (
      (application.status = 'PENDING' and application.submitted_at <= v_cutoff)
      or (application.status = 'REJECTED' and application.decided_at <= v_cutoff)
      or (application.status = 'WITHDRAWN' and application.updated_at <= v_cutoff)
    )
      and not exists (
        select 1
        from app_private.membership_application_email_outbox as sending_outbox
        where sending_outbox.application_id = application.id
          and sending_outbox.status = 'SENDING'
      )
    order by retention_anchor, application.id
    limit 100
    for update of application skip locked
  loop
    perform outbox.id
    from app_private.membership_application_email_outbox as outbox
    where outbox.application_id = v_application.id
    order by outbox.id
    for update;

    if exists (
      select 1
      from app_private.membership_application_email_outbox as sending_outbox
      where sending_outbox.application_id = v_application.id
        and sending_outbox.status = 'SENDING'
    ) then
      continue;
    end if;

    delete from app_private.membership_application_intake_idempotency as intake
    where intake.application_id = v_application.id;

    delete from app_fanclub.membership_application_votes as vote
    where vote.application_id = v_application.id;

    perform app_private.log_audit(
      null,
      'MEMBERSHIP_APPLICATION_RETENTION_PURGED',
      'membership_application',
      v_application.id::text,
      null,
      null,
      jsonb_build_object(
        'status', v_application.status,
        'retentionReason', v_application.retention_reason
      )
    );

    delete from app_fanclub.membership_applications as application
    where application.id = v_application.id;

    v_purged := v_purged + 1;
    case v_application.status
      when 'PENDING' then v_pending := v_pending + 1;
      when 'REJECTED' then v_rejected := v_rejected + 1;
      when 'WITHDRAWN' then v_withdrawn := v_withdrawn + 1;
    end case;
  end loop;

  return jsonb_build_object(
    'purged', v_purged,
    'pending', v_pending,
    'rejected', v_rejected,
    'withdrawn', v_withdrawn
  );
end;
$$;

create function public.m150_membership_retention_run()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.m150_membership_retention_run();
$$;

revoke all on function app_private.m150_minimize_membership_application_message()
from public, anon, authenticated, service_role;
revoke all on function app_private.m150_membership_retention_run()
from public, anon, authenticated, service_role;
revoke all on function public.m150_membership_retention_run()
from public, anon, authenticated, service_role;

grant execute on function public.m150_membership_retention_run()
to service_role;
