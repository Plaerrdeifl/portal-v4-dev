alter table app_fanclub.membership_applications
  add column rejection_applicant_notice text;

update app_fanclub.membership_applications
set rejection_applicant_notice = btrim(applicant_notice)
where status = 'REJECTED'
  and applicant_notice is not null;

update app_fanclub.membership_applications
set applicant_notice = null
where applicant_notice is not null;

alter table app_fanclub.membership_applications
  drop constraint membership_applications_applicant_notice_check,
  add constraint membership_applications_legacy_applicant_notice_null_check
    check (applicant_notice is null),
  add constraint membership_applications_rejection_applicant_notice_check
    check (
      rejection_applicant_notice is null
      or (
        status = 'REJECTED'
        and rejection_applicant_notice = btrim(rejection_applicant_notice)
        and length(rejection_applicant_notice) between 1 and 2000
        and position('<' in rejection_applicant_notice) = 0
        and position('>' in rejection_applicant_notice) = 0
      )
    );

create function app_private.m150_rejection_applicant_notice(p_payload jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_notice text;
begin
  if p_payload is null
     or not (p_payload ? 'applicantNotice')
     or p_payload -> 'applicantNotice' = 'null'::jsonb then
    return null;
  end if;

  if jsonb_typeof(p_payload -> 'applicantNotice') <> 'string' then
    raise exception 'M150_INVALID_APPLICANT_NOTICE'
      using errcode = '22023';
  end if;

  v_notice := nullif(btrim(p_payload ->> 'applicantNotice'), '');

  if v_notice is not null
     and (
       length(v_notice) > 2000
       or position('<' in v_notice) > 0
       or position('>' in v_notice) > 0
     ) then
    raise exception 'M150_INVALID_APPLICANT_NOTICE'
      using errcode = '22023';
  end if;

  return v_notice;
end;
$$;

create function app_private.m150_guard_rejection_applicant_notice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'REJECTED'
     and new.rejection_applicant_notice is distinct from old.rejection_applicant_notice then
    raise exception 'M150_REJECTION_APPLICANT_NOTICE_IMMUTABLE'
      using errcode = '22000';
  end if;

  return new;
end;
$$;

create trigger membership_applications_rejection_applicant_notice_immutable
before update on app_fanclub.membership_applications
for each row execute function app_private.m150_guard_rejection_applicant_notice();

alter function app_private.api_membership_application_detail(jsonb)
  rename to api_membership_application_detail_before_communication_r1;

create function app_private.api_membership_application_detail(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_id uuid;
begin
  v_result := app_private.api_membership_application_detail_before_communication_r1(p_payload);
  v_id := (v_result ->> 'id')::uuid;

  select (v_result - 'applicantNotice') || jsonb_build_object(
    'applicantNotice', application.rejection_applicant_notice
  )
  into v_result
  from app_fanclub.membership_applications as application
  where application.id = v_id;

  return v_result;
end;
$$;

create or replace function app_private.api_membership_application_vote(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_id uuid;
  v_vote text := upper(btrim(coalesce(p_payload ->> 'vote', '')));
  v_reason text := nullif(btrim(coalesce(p_payload ->> 'reasonInternal', '')), '');
  v_notice text;
  v_expected_revision integer;
  v_application app_fanclub.membership_applications%rowtype;
  v_yes integer;
  v_no integer;
  v_new_status text;
begin
  v_actor := app_private.m150_require_current_board_member();

  begin
    v_id := nullif(p_payload ->> 'id', '')::uuid;
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception when invalid_text_representation then
    raise exception 'M150_INVALID_VOTE_PAYLOAD' using errcode = '22023';
  end;

  if v_id is null or v_expected_revision is null or v_vote not in ('YES', 'NO') then
    raise exception 'M150_INVALID_VOTE_PAYLOAD' using errcode = '22023';
  end if;

  if v_vote = 'NO' then
    v_notice := app_private.m150_rejection_applicant_notice(p_payload);
  end if;

  select application.*
  into v_application
  from app_fanclub.membership_applications as application
  where application.id = v_id
  for update;

  if not found then
    raise exception 'M150_APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_application.revision <> v_expected_revision then
    raise exception 'M150_REVISION_CONFLICT' using errcode = '40001';
  end if;

  if v_application.status <> 'PENDING' then
    raise exception 'M150_APPLICATION_ALREADY_DECIDED' using errcode = 'P1503';
  end if;

  perform app_private.m150_lock_board_roster();
  perform app_private.m150_assert_board_ready(v_id);

  if not exists (
    select 1
    from app_private.m150_current_board() as board
    where board.user_id = v_actor
  ) then
    raise exception 'M150_BOARD_ROSTER_CHANGED' using errcode = 'P1502';
  end if;

  if exists (
    select 1
    from app_fanclub.membership_application_votes as existing_vote
    where existing_vote.application_id = v_id
      and existing_vote.voter_user_id = v_actor
  ) then
    raise exception 'M150_VOTE_ALREADY_EXISTS' using errcode = '23505';
  end if;

  select
    count(*) filter (where existing_vote.vote = 'YES')::integer,
    count(*) filter (where existing_vote.vote = 'NO')::integer
  into v_yes, v_no
  from app_fanclub.membership_application_votes as existing_vote
  where existing_vote.application_id = v_id;

  if v_vote = 'NO' and v_no = 2 and v_reason is null then
    raise exception 'M150_DECISIVE_NO_REASON_REQUIRED' using errcode = '22023';
  end if;

  insert into app_fanclub.membership_application_votes (
    application_id,
    voter_user_id,
    vote,
    reason_internal
  ) values (
    v_id,
    v_actor,
    v_vote,
    v_reason
  );

  v_yes := v_yes + case when v_vote = 'YES' then 1 else 0 end;
  v_no := v_no + case when v_vote = 'NO' then 1 else 0 end;
  v_new_status := case
    when v_yes >= 3 then 'APPROVED'
    when v_no >= 3 then 'REJECTED'
    else 'PENDING'
  end;

  update app_fanclub.membership_applications as application
  set status = v_new_status,
      decided_at = case when v_new_status <> 'PENDING' then now() else null end,
      decided_by = case when v_new_status <> 'PENDING' then v_actor else null end,
      decision_method = case when v_new_status <> 'PENDING' then 'VOTE_MAJORITY' else null end,
      decision_reason_internal = case when v_new_status = 'REJECTED' then v_reason else null end,
      rejection_applicant_notice = case when v_new_status = 'REJECTED' then v_notice else null end,
      revision = application.revision + 1,
      updated_at = now()
  where application.id = v_id;

  perform app_private.log_audit(
    v_actor,
    'MEMBERSHIP_APPLICATION_VOTE_CAST',
    'membership_application',
    v_id::text,
    null,
    jsonb_build_object('vote', v_vote),
    jsonb_build_object('yesVotes', v_yes, 'noVotes', v_no, 'missingVotes', 5 - v_yes - v_no)
  );

  if v_new_status <> 'PENDING' then
    perform app_private.log_audit(
      v_actor,
      case when v_new_status = 'APPROVED'
        then 'MEMBERSHIP_APPLICATION_AUTO_APPROVED'
        else 'MEMBERSHIP_APPLICATION_AUTO_REJECTED'
      end,
      'membership_application',
      v_id::text,
      jsonb_build_object('status', 'PENDING'),
      jsonb_build_object('status', v_new_status, 'decisionMethod', 'VOTE_MAJORITY'),
      jsonb_build_object(
        'yesVotes', v_yes,
        'noVotes', v_no,
        'missingVotes', 5 - v_yes - v_no,
        'decisionReasonInternal', case when v_new_status = 'REJECTED' then v_reason else null end,
        'applicantNoticeProvided', v_new_status = 'REJECTED' and v_notice is not null
      )
    );
  end if;

  return app_private.api_membership_application_detail(jsonb_build_object('id', v_id));
end;
$$;

create or replace function app_private.api_membership_application_manual_decide(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_id uuid;
  v_decision text := upper(btrim(coalesce(p_payload ->> 'decision', '')));
  v_reason text := nullif(btrim(coalesce(p_payload ->> 'reasonInternal', '')), '');
  v_notice text;
  v_expected_revision integer;
  v_application app_fanclub.membership_applications%rowtype;
  v_yes integer;
  v_no integer;
begin
  v_actor := app_private.m150_require_current_board_member();

  begin
    v_id := nullif(p_payload ->> 'id', '')::uuid;
    v_expected_revision := (p_payload ->> 'expectedRevision')::integer;
  exception when invalid_text_representation then
    raise exception 'M150_INVALID_MANUAL_DECISION_PAYLOAD' using errcode = '22023';
  end;

  if v_id is null
     or v_expected_revision is null
     or v_decision not in ('APPROVED', 'REJECTED')
     or v_reason is null then
    raise exception 'M150_MANUAL_DECISION_REASON_REQUIRED' using errcode = '22023';
  end if;

  if v_decision = 'REJECTED' then
    v_notice := app_private.m150_rejection_applicant_notice(p_payload);
  end if;

  select application.*
  into v_application
  from app_fanclub.membership_applications as application
  where application.id = v_id
  for update;

  if not found then
    raise exception 'M150_APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_application.revision <> v_expected_revision then
    raise exception 'M150_REVISION_CONFLICT' using errcode = '40001';
  end if;

  if v_application.status <> 'PENDING' then
    raise exception 'M150_APPLICATION_ALREADY_DECIDED' using errcode = 'P1503';
  end if;

  perform app_private.m150_lock_board_roster();
  perform app_private.m150_assert_board_ready(v_id);

  if not exists (
    select 1
    from app_private.m150_current_board() as board
    where board.user_id = v_actor
  ) then
    raise exception 'M150_BOARD_ROSTER_CHANGED' using errcode = 'P1502';
  end if;

  select
    count(*) filter (where vote.vote = 'YES')::integer,
    count(*) filter (where vote.vote = 'NO')::integer
  into v_yes, v_no
  from app_fanclub.membership_application_votes as vote
  where vote.application_id = v_id;

  if v_yes >= 3 or v_no >= 3 then
    raise exception 'M150_MAJORITY_MUST_NOT_BE_OVERWRITTEN' using errcode = 'P1504';
  end if;

  if (v_application.submitted_at at time zone 'Europe/Berlin')::date + 7
      > (now() at time zone 'Europe/Berlin')::date then
    raise exception 'M150_SEVEN_DAY_PERIOD_NOT_REACHED' using errcode = 'P1505';
  end if;

  update app_fanclub.membership_applications as application
  set status = v_decision,
      decided_at = now(),
      decided_by = v_actor,
      decision_method = 'SEVEN_DAY_MANUAL',
      decision_reason_internal = v_reason,
      rejection_applicant_notice = case when v_decision = 'REJECTED' then v_notice else null end,
      revision = application.revision + 1,
      updated_at = now()
  where application.id = v_id;

  perform app_private.log_audit(
    v_actor,
    'MEMBERSHIP_APPLICATION_SEVEN_DAY_DECIDED',
    'membership_application',
    v_id::text,
    jsonb_build_object('status', 'PENDING'),
    jsonb_build_object('status', v_decision, 'decisionMethod', 'SEVEN_DAY_MANUAL'),
    jsonb_build_object(
      'decidingBoardUser', v_actor,
      'decidedAt', now(),
      'yesVotes', v_yes,
      'noVotes', v_no,
      'missingVotes', 5 - v_yes - v_no,
      'sevenDayDecision', true,
      'decisionReasonInternal', v_reason,
      'applicantNoticeProvided', v_decision = 'REJECTED' and v_notice is not null
    )
  );

  return app_private.api_membership_application_detail(jsonb_build_object('id', v_id));
end;
$$;

create table app_private.membership_application_email_outbox (
  id uuid primary key default extensions.gen_random_uuid(),
  application_id uuid not null
    references app_fanclub.membership_applications(id) on delete cascade,
  email_type text not null,
  status text not null default 'PENDING',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  sent_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_application_email_outbox_type_check
    check (email_type in ('RECEIPT', 'REJECTION', 'ADMISSION')),
  constraint membership_application_email_outbox_status_check
    check (status in ('PENDING', 'SENDING', 'SENT', 'FAILED')),
  constraint membership_application_email_outbox_attempts_check
    check (attempts between 0 and 5),
  constraint membership_application_email_outbox_claim_state_check
    check (
      (status = 'SENDING'
        and claim_token is not null
        and claimed_at is not null
        and claim_expires_at is not null
        and sent_at is null)
      or
      (status <> 'SENDING'
        and claim_token is null
        and claimed_at is null
        and claim_expires_at is null)
    ),
  constraint membership_application_email_outbox_sent_state_check
    check (
      (status = 'SENT' and sent_at is not null)
      or (status <> 'SENT' and sent_at is null)
    ),
  constraint membership_application_email_outbox_error_code_check
    check (
      last_error_code is null
      or (
        length(last_error_code) between 1 and 80
        and last_error_code ~ '^[A-Z0-9_:-]+$'
      )
    ),
  constraint membership_application_email_outbox_application_type_unique
    unique (application_id, email_type)
);

create index membership_application_email_outbox_pending_idx
on app_private.membership_application_email_outbox (available_at, created_at, id)
where status = 'PENDING' and attempts < 5;

create index membership_application_email_outbox_stale_claim_idx
on app_private.membership_application_email_outbox (claim_expires_at, created_at, id)
where status = 'SENDING' and attempts < 5;

alter table app_private.membership_application_email_outbox
enable row level security;

revoke all on table app_private.membership_application_email_outbox
from public, anon, authenticated, service_role;

create function app_private.m150_enqueue_membership_email(
  p_application_id uuid,
  p_email_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_application_id is null
     or p_email_type not in ('RECEIPT', 'REJECTION', 'ADMISSION') then
    raise exception 'M150_INVALID_EMAIL_EVENT' using errcode = '22023';
  end if;

  insert into app_private.membership_application_email_outbox (
    application_id,
    email_type
  ) values (
    p_application_id,
    p_email_type
  )
  on conflict (application_id, email_type) do nothing;
end;
$$;

create function app_private.m150_enqueue_membership_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.m150_enqueue_membership_email(new.id, 'RECEIPT');
  return new;
end;
$$;

create function app_private.m150_enqueue_membership_rejection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.m150_enqueue_membership_email(new.id, 'REJECTION');
  return new;
end;
$$;

create function app_private.m150_enqueue_membership_admission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'APPROVED'
     or new.converted_at is null
     or new.converted_by is null
     or new.converted_member_id is null
     or new.conversion_mode not in (
       'NEW_MEMBER',
       'REACTIVATE_EXISTING',
       'RESOLVE_EXISTING_ACTIVE'
     ) then
    raise exception 'M150_ADMISSION_REQUIRES_SUCCESSFUL_CONVERSION'
      using errcode = '23514';
  end if;

  perform app_private.m150_enqueue_membership_email(new.id, 'ADMISSION');
  return new;
end;
$$;

create trigger membership_applications_email_receipt
after insert on app_fanclub.membership_applications
for each row execute function app_private.m150_enqueue_membership_receipt();

create trigger membership_applications_email_rejection
after update of status on app_fanclub.membership_applications
for each row
when (old.status is distinct from 'REJECTED' and new.status = 'REJECTED')
execute function app_private.m150_enqueue_membership_rejection();

create trigger membership_applications_email_admission
after update of converted_at on app_fanclub.membership_applications
for each row
when (old.converted_at is null and new.converted_at is not null)
execute function app_private.m150_enqueue_membership_admission();

create function app_private.m150_membership_email_claim()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  update app_private.membership_application_email_outbox as outbox
  set status = 'FAILED',
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      last_error_code = coalesce(outbox.last_error_code, 'CLAIM_EXPIRED'),
      updated_at = now()
  where outbox.status = 'SENDING'
    and outbox.claim_expires_at < now()
    and outbox.attempts >= 5;

  with candidate as materialized (
    select outbox.id
    from app_private.membership_application_email_outbox as outbox
    where outbox.attempts < 5
      and (
        (outbox.status = 'PENDING' and outbox.available_at <= now())
        or
        (outbox.status = 'SENDING' and outbox.claim_expires_at < now())
      )
    order by
      case
        when outbox.status = 'PENDING' then outbox.available_at
        else outbox.claim_expires_at
      end,
      outbox.created_at,
      outbox.id
    limit 1
    for update skip locked
  ), claimed as (
    update app_private.membership_application_email_outbox as outbox
    set status = 'SENDING',
        attempts = outbox.attempts + 1,
        claim_token = extensions.gen_random_uuid(),
        claimed_at = now(),
        claim_expires_at = now() + interval '10 minutes',
        updated_at = now()
    from candidate
    where outbox.id = candidate.id
    returning outbox.*
  )
  select jsonb_build_object(
    'claimed', true,
    'outboxId', claimed.id,
    'claimToken', claimed.claim_token,
    'emailType', claimed.email_type,
    'recipientEmail', application.email,
    'firstName', application.first_name
  ) || case
    when claimed.email_type = 'REJECTION' then jsonb_build_object(
      'applicantNotice', application.rejection_applicant_notice
    )
    else '{}'::jsonb
  end
  into v_result
  from claimed
  join app_fanclub.membership_applications as application
    on application.id = claimed.application_id;

  return coalesce(v_result, jsonb_build_object('claimed', false));
end;
$$;

create function public.m150_membership_email_claim()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.m150_membership_email_claim();
$$;

create function app_private.m150_membership_email_complete(
  p_outbox_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_outbox app_private.membership_application_email_outbox%rowtype;
  v_error_code text := nullif(btrim(coalesce(p_error_code, '')), '');
  v_status text;
begin
  if p_outbox_id is null or p_claim_token is null or p_success is null then
    raise exception 'M150_INVALID_EMAIL_COMPLETE_PAYLOAD' using errcode = '22023';
  end if;

  if p_success and v_error_code is not null then
    raise exception 'M150_INVALID_EMAIL_ERROR_CODE' using errcode = '22023';
  end if;

  if not p_success
     and (
       v_error_code is null
       or length(v_error_code) > 80
       or v_error_code !~ '^[A-Z0-9_:-]+$'
     ) then
    raise exception 'M150_INVALID_EMAIL_ERROR_CODE' using errcode = '22023';
  end if;

  select outbox.*
  into v_outbox
  from app_private.membership_application_email_outbox as outbox
  where outbox.id = p_outbox_id
  for update;

  if not found then
    raise exception 'M150_EMAIL_OUTBOX_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_outbox.status <> 'SENDING'
     or v_outbox.claim_token is distinct from p_claim_token
     or v_outbox.claim_expires_at < now() then
    raise exception 'M150_EMAIL_CLAIM_INVALID' using errcode = '42501';
  end if;

  if p_success then
    update app_private.membership_application_email_outbox as outbox
    set status = 'SENT',
        sent_at = now(),
        claim_token = null,
        claimed_at = null,
        claim_expires_at = null,
        last_error_code = null,
        updated_at = now()
    where outbox.id = p_outbox_id;
    v_status := 'SENT';
  else
    v_status := case when v_outbox.attempts >= 5 then 'FAILED' else 'PENDING' end;
    update app_private.membership_application_email_outbox as outbox
    set status = v_status,
        available_at = case
          when v_status = 'PENDING' then now() + interval '5 minutes'
          else outbox.available_at
        end,
        claim_token = null,
        claimed_at = null,
        claim_expires_at = null,
        last_error_code = v_error_code,
        updated_at = now()
    where outbox.id = p_outbox_id;
  end if;

  return jsonb_build_object('completed', true, 'status', v_status);
end;
$$;

create function public.m150_membership_email_complete(
  p_outbox_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error_code text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select app_private.m150_membership_email_complete(
    p_outbox_id,
    p_claim_token,
    p_success,
    p_error_code
  );
$$;

revoke all on function app_private.m150_rejection_applicant_notice(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.m150_guard_rejection_applicant_notice()
from public, anon, authenticated, service_role;
revoke all on function app_private.api_membership_application_detail_before_communication_r1(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_membership_application_detail(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_membership_application_vote(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.api_membership_application_manual_decide(jsonb)
from public, anon, authenticated, service_role;
revoke all on function app_private.m150_enqueue_membership_email(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function app_private.m150_enqueue_membership_receipt()
from public, anon, authenticated, service_role;
revoke all on function app_private.m150_enqueue_membership_rejection()
from public, anon, authenticated, service_role;
revoke all on function app_private.m150_enqueue_membership_admission()
from public, anon, authenticated, service_role;
revoke all on function app_private.m150_membership_email_claim()
from public, anon, authenticated, service_role;
revoke all on function app_private.m150_membership_email_complete(uuid, uuid, boolean, text)
from public, anon, authenticated, service_role;

revoke all on function public.m150_membership_email_claim()
from public, anon, authenticated, service_role;
revoke all on function public.m150_membership_email_complete(uuid, uuid, boolean, text)
from public, anon, authenticated, service_role;

grant execute on function public.m150_membership_email_claim()
to service_role;
grant execute on function public.m150_membership_email_complete(uuid, uuid, boolean, text)
to service_role;
