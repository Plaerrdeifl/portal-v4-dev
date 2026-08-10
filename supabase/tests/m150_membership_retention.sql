\set ON_ERROR_STOP on

begin;

select plan(1);

do $m150_retention_verification$
declare
  v_role_member constant uuid := '00000000-0000-4000-8000-000000000002';
  v_actor constant uuid := '17000000-0000-4000-8000-000000000001';
  v_member constant uuid := '17000000-0000-4001-8000-000000000001';
  v_pending_old constant uuid := '17000000-0000-4002-8000-000000000001';
  v_pending_fresh constant uuid := '17000000-0000-4002-8000-000000000002';
  v_rejected_old constant uuid := '17000000-0000-4002-8000-000000000003';
  v_rejected_fresh constant uuid := '17000000-0000-4002-8000-000000000004';
  v_withdrawn_old constant uuid := '17000000-0000-4002-8000-000000000005';
  v_withdrawn_fresh constant uuid := '17000000-0000-4002-8000-000000000006';
  v_approved_old constant uuid := '17000000-0000-4002-8000-000000000007';
  v_converted_approved constant uuid := '17000000-0000-4002-8000-000000000008';
  v_sending_blocked constant uuid := '17000000-0000-4002-8000-000000000009';
  v_response jsonb;
  v_members_before jsonb;
  v_accounts_before jsonb;
  v_entries_before jsonb;
  v_reports_before jsonb;
  v_converted_updated_at timestamptz;
  v_privilege text;
begin
  if to_regprocedure('app_private.m150_membership_retention_run()') is null
     or to_regprocedure('public.m150_membership_retention_run()') is null then
    raise exception 'F1.7A Retention-Funktionen fehlen.';
  end if;

  if has_function_privilege(
       'anon',
       'public.m150_membership_retention_run()',
       'EXECUTE'
     ) or has_function_privilege(
       'authenticated',
       'public.m150_membership_retention_run()',
       'EXECUTE'
     ) or not has_function_privilege(
       'service_role',
       'public.m150_membership_retention_run()',
       'EXECUTE'
     ) or has_function_privilege(
       'service_role',
       'app_private.m150_membership_retention_run()',
       'EXECUTE'
     ) then
    raise exception 'Retention-Wrapper ist nicht service_role-only.';
  end if;

  insert into auth.users (id, email)
  values (v_actor, 'm150-retention-actor@example.invalid');

  insert into app_portal.users (
    id, user_code, email, first_name, last_name, role_id
  ) values (
    v_actor,
    'U-M150-RETENTION',
    'm150-retention-actor@example.invalid',
    'Retention',
    'Actor',
    v_role_member
  );

  insert into app_fanclub.members (
    id, member_code, first_name, last_name, birth_date, email, phone, status
  ) values (
    v_member,
    'M-M150-RETENTION',
    'Existing',
    'Member',
    date '1980-01-01',
    'm150-retention-member@example.invalid',
    '01000',
    'ACTIVE'
  );

  insert into app_fanclub.membership_applications (
    id, first_name, last_name, birth_date, email, phone, street, house_number,
    postal_code, city, applicant_message, status, submitted_at, decided_at,
    decided_by, decision_method, decision_reason_internal,
    rejection_applicant_notice, declaration_version, statutes_version,
    statutes_reference, declaration_confirmed, statutes_confirmed, updated_at
  ) values
    (
      v_pending_old, 'Old', 'Pending', date '1990-01-01',
      'old-pending-retention@example.invalid', '02001', 'Pendingweg', '1',
      '10001', 'Altstadt', 'PENDING PII', 'PENDING',
      clock_timestamp() - interval '12 months', null, null, null, null, null,
      'D1', 'S1', 'ref', true, true, clock_timestamp()
    ),
    (
      v_pending_fresh, 'Fresh', 'Pending', date '1990-01-02',
      'fresh-pending-retention@example.invalid', '02002', 'Pendingweg', '2',
      '10002', 'Neustadt', 'FRESH PENDING', 'PENDING',
      clock_timestamp() - interval '12 months' + interval '1 day',
      null, null, null, null, null, 'D1', 'S1', 'ref', true, true,
      clock_timestamp()
    ),
    (
      v_rejected_old, 'Old', 'Rejected', date '1990-01-03',
      'old-rejected-retention@example.invalid', '02003', 'Rejectedweg', '3',
      '10003', 'Altstadt', 'REJECTED PII', 'PENDING',
      clock_timestamp() - interval '13 months', null, null, null, null, null,
      'D1', 'S1', 'ref', true, true, clock_timestamp()
    ),
    (
      v_rejected_fresh, 'Fresh', 'Rejected', date '1990-01-04',
      'fresh-rejected-retention@example.invalid', '02004', 'Rejectedweg', '4',
      '10004', 'Neustadt', 'FRESH REJECTED', 'REJECTED',
      clock_timestamp() - interval '12 months',
      clock_timestamp() - interval '12 months' + interval '1 day',
      v_actor, 'VOTE_MAJORITY', 'Fresh internal reason', 'Fresh notice',
      'D1', 'S1', 'ref', true, true, clock_timestamp()
    ),
    (
      v_withdrawn_old, 'Old', 'Withdrawn', date '1990-01-05',
      'old-withdrawn-retention@example.invalid', '02005', 'Withdrawnweg', '5',
      '10005', 'Altstadt', 'WITHDRAWN PII', 'WITHDRAWN',
      clock_timestamp() - interval '13 months', null, null, null, null, null,
      'D1', 'S1', 'ref', true, true,
      clock_timestamp() - interval '12 months'
    ),
    (
      v_withdrawn_fresh, 'Fresh', 'Withdrawn', date '1990-01-06',
      'fresh-withdrawn-retention@example.invalid', '02006', 'Withdrawnweg', '6',
      '10006', 'Neustadt', 'FRESH WITHDRAWN', 'WITHDRAWN',
      clock_timestamp() - interval '12 months', null, null, null, null, null,
      'D1', 'S1', 'ref', true, true,
      clock_timestamp() - interval '12 months' + interval '1 day'
    ),
    (
      v_approved_old, 'Old', 'Approved', date '1990-01-07',
      'old-approved-retention@example.invalid', '02007', 'Approvedweg', '7',
      '10007', 'Altstadt', 'APPROVED STAYS', 'APPROVED',
      clock_timestamp() - interval '14 months',
      clock_timestamp() - interval '13 months',
      v_actor, 'VOTE_MAJORITY', null, null,
      'D1', 'S1', 'ref', true, true,
      clock_timestamp() - interval '13 months'
    ),
    (
      v_converted_approved, 'Converted', 'Approved', date '1990-01-08',
      'converted-approved-retention@example.invalid', '02008',
      'Conversion Street', '8a', '10008', 'Conversion City',
      'REMOVE AFTER CONVERSION', 'APPROVED',
      clock_timestamp() - interval '14 months',
      clock_timestamp() - interval '13 months',
      v_actor, 'VOTE_MAJORITY', null, null,
      'DECLARATION-RETENTION', 'STATUTES-RETENTION', 'retention-reference',
      true, true, clock_timestamp() - interval '13 months'
    ),
    (
      v_sending_blocked, 'Sending', 'Blocked', date '1990-01-09',
      'sending-blocked-retention@example.invalid', '02009', 'Sendingweg', '9',
      '10009', 'Altstadt', 'SENDING STAYS', 'PENDING',
      clock_timestamp() - interval '13 months', null, null, null, null, null,
      'D1', 'S1', 'ref', true, true, clock_timestamp()
    );

  insert into app_fanclub.membership_application_votes (
    application_id, voter_user_id, vote, reason_internal
  ) values (
    v_rejected_old, v_actor, 'NO', 'Vote PII must be purged before Application'
  );

  update app_fanclub.membership_applications
  set status = 'REJECTED',
      decided_at = clock_timestamp() - interval '12 months',
      decided_by = v_actor,
      decision_method = 'VOTE_MAJORITY',
      decision_reason_internal = 'OLD INTERNAL REASON PII',
      rejection_applicant_notice = 'OLD APPLICANT NOTICE PII'
  where id = v_rejected_old;

  insert into app_private.membership_application_intake_idempotency (
    idempotency_key, payload_sha256, application_id, outcome
  ) values (
    'm150-retention-rejected-old',
    repeat('a', 64),
    v_rejected_old,
    'CREATED'
  );

  insert into app_fanclub.membership_application_board_roster (
    application_id, office_code, voter_user_id, member_id
  ) values (
    v_rejected_old, 'VORSTAND_1', v_actor, v_member
  ) on conflict (application_id, office_code) do nothing;

  update app_private.membership_application_email_outbox
  set status = 'SENT',
      attempts = 1,
      sent_at = clock_timestamp(),
      last_error_code = null
  where application_id = v_rejected_old;

  update app_private.membership_application_email_outbox
  set status = 'FAILED',
      attempts = 5,
      last_error_code = 'RETENTION_TEST'
  where application_id = v_withdrawn_old;

  update app_private.membership_application_email_outbox
  set status = 'SENDING',
      attempts = 1,
      claim_token = '17000000-0000-4003-8000-000000000001',
      claimed_at = clock_timestamp(),
      claim_expires_at = clock_timestamp() + interval '10 minutes'
  where application_id = v_sending_blocked
    and email_type = 'RECEIPT';

  select updated_at
  into v_converted_updated_at
  from app_fanclub.membership_applications
  where id = v_converted_approved;

  update app_fanclub.membership_applications
  set converted_at = clock_timestamp(),
      converted_by = v_actor,
      converted_member_id = v_member,
      conversion_mode = 'RESOLVE_EXISTING_ACTIVE'
  where id = v_converted_approved;

  if not exists (
    select 1
    from app_fanclub.membership_applications as application
    where application.id = v_converted_approved
      and application.applicant_message is null
      and application.first_name = 'Converted'
      and application.last_name = 'Approved'
      and application.birth_date = date '1990-01-08'
      and application.email = 'converted-approved-retention@example.invalid'
      and application.phone = '02008'
      and application.street = 'Conversion Street'
      and application.house_number = '8a'
      and application.postal_code = '10008'
      and application.city = 'Conversion City'
      and application.declaration_version = 'DECLARATION-RETENTION'
      and application.statutes_version = 'STATUTES-RETENTION'
      and application.statutes_reference = 'retention-reference'
      and application.declaration_confirmed
      and application.statutes_confirmed
      and application.status = 'APPROVED'
      and application.decision_method = 'VOTE_MAJORITY'
      and application.converted_at is not null
      and application.converted_by = v_actor
      and application.converted_member_id = v_member
      and application.conversion_mode = 'RESOLVE_EXISTING_ACTIVE'
      and application.updated_at = v_converted_updated_at
      and application.revision = 1
  ) then
    raise exception 'Conversion minimierte strukturierte Application- oder Conversion-Daten.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(member) order by member.id), '[]'::jsonb)
  into v_members_before
  from app_fanclub.members as member;
  select coalesce(jsonb_agg(to_jsonb(account) order by account.id), '[]'::jsonb)
  into v_accounts_before
  from app_fanclub.finance_accounts as account;
  select coalesce(jsonb_agg(to_jsonb(entry) order by entry.id), '[]'::jsonb)
  into v_entries_before
  from app_fanclub.finance_entries as entry;
  select coalesce(jsonb_agg(to_jsonb(report) order by report.id), '[]'::jsonb)
  into v_reports_before
  from app_fanclub.contribution_payment_reports as report;

  v_response := public.m150_membership_retention_run();

  if v_response <> jsonb_build_object(
       'purged', 3,
       'pending', 1,
       'rejected', 1,
       'withdrawn', 1
     ) or exists (
       select 1
       from jsonb_object_keys(v_response) as response_key(key)
       where response_key.key not in ('purged', 'pending', 'rejected', 'withdrawn')
     ) then
    raise exception 'Retention-Return enthält falsche Counts oder nichttechnische Daten: %', v_response;
  end if;

  if exists (
    select 1
    from app_fanclub.membership_applications
    where id in (v_pending_old, v_rejected_old, v_withdrawn_old)
  ) then
    raise exception 'Fällige PENDING/REJECTED/WITHDRAWN Applications wurden nicht gelöscht.';
  end if;

  if not exists (
    select 1 from app_fanclub.membership_applications where id = v_pending_fresh
  ) or not exists (
    select 1 from app_fanclub.membership_applications where id = v_rejected_fresh
  ) or not exists (
    select 1 from app_fanclub.membership_applications where id = v_withdrawn_fresh
  ) or not exists (
    select 1 from app_fanclub.membership_applications where id = v_approved_old
  ) or not exists (
    select 1 from app_fanclub.membership_applications where id = v_converted_approved
  ) or not exists (
    select 1 from app_fanclub.membership_applications where id = v_sending_blocked
  ) then
    raise exception 'Frische, APPROVED, konvertierte oder SENDING-blockierte Application wurde gelöscht.';
  end if;

  if exists (
    select 1
    from app_private.membership_application_intake_idempotency
    where application_id = v_rejected_old
  ) or exists (
    select 1
    from app_fanclub.membership_application_votes
    where application_id = v_rejected_old
  ) or exists (
    select 1
    from app_fanclub.membership_application_board_roster
    where application_id = v_rejected_old
  ) or exists (
    select 1
    from app_private.membership_application_email_outbox
    where application_id in (v_pending_old, v_rejected_old, v_withdrawn_old)
  ) then
    raise exception 'RESTRICT-Kinder oder Cascade-Kinder der gelöschten Applications bestehen fort.';
  end if;

  if not exists (
    select 1
    from app_private.membership_application_email_outbox
    where application_id = v_sending_blocked
      and status = 'SENDING'
  ) then
    raise exception 'SENDING-Outbox oder zugehörige Application wurde nicht übersprungen.';
  end if;

  if (select count(*)
      from app_portal.audit_events as audit
      where audit.action = 'MEMBERSHIP_APPLICATION_RETENTION_PURGED'
        and audit.entity_type = 'membership_application'
        and audit.entity_id in (
          v_pending_old::text,
          v_rejected_old::text,
          v_withdrawn_old::text
        )
        and audit.actor_user_id is null
        and audit.before_data is null
        and audit.after_data is null
        and audit.metadata ? 'status'
        and audit.metadata ? 'retentionReason') <> 3 then
    raise exception 'Minimaler Retention-Audit fehlt.';
  end if;

  if not exists (
    select 1 from app_portal.audit_events
    where action = 'MEMBERSHIP_APPLICATION_RETENTION_PURGED'
      and entity_id = v_pending_old::text
      and metadata = jsonb_build_object(
        'status', 'PENDING',
        'retentionReason', 'STALE_PENDING'
      )
  ) or not exists (
    select 1 from app_portal.audit_events
    where action = 'MEMBERSHIP_APPLICATION_RETENTION_PURGED'
      and entity_id = v_rejected_old::text
      and metadata = jsonb_build_object(
        'status', 'REJECTED',
        'retentionReason', 'REJECTED_12_MONTHS'
      )
  ) or not exists (
    select 1 from app_portal.audit_events
    where action = 'MEMBERSHIP_APPLICATION_RETENTION_PURGED'
      and entity_id = v_withdrawn_old::text
      and metadata = jsonb_build_object(
        'status', 'WITHDRAWN',
        'retentionReason', 'WITHDRAWN_12_MONTHS'
      )
  ) then
    raise exception 'Retention-Audit besitzt falschen Status oder Retention-Grund.';
  end if;

  if exists (
    select 1
    from app_portal.audit_events as audit
    where audit.action = 'MEMBERSHIP_APPLICATION_RETENTION_PURGED'
      and lower(
        coalesce(audit.before_data, '{}'::jsonb)::text
        || coalesce(audit.after_data, '{}'::jsonb)::text
        || coalesce(audit.metadata, '{}'::jsonb)::text
      ) ~ '(old-pending-retention|old-rejected-retention|old-withdrawn-retention|pii|internal reason|applicant notice)'
  ) then
    raise exception 'Retention-Audit enthält Application-PII.';
  end if;

  if (select coalesce(jsonb_agg(to_jsonb(member) order by member.id), '[]'::jsonb)
      from app_fanclub.members as member) <> v_members_before
     or (select coalesce(jsonb_agg(to_jsonb(account) order by account.id), '[]'::jsonb)
         from app_fanclub.finance_accounts as account) <> v_accounts_before
     or (select coalesce(jsonb_agg(to_jsonb(entry) order by entry.id), '[]'::jsonb)
         from app_fanclub.finance_entries as entry) <> v_entries_before
     or (select coalesce(jsonb_agg(to_jsonb(report) order by report.id), '[]'::jsonb)
         from app_fanclub.contribution_payment_reports as report) <> v_reports_before then
    raise exception 'Retention veränderte Members oder Finance-/SEPA-Daten.';
  end if;

  foreach v_privilege in array array['EXECUTE']
  loop
    if has_function_privilege(
         'anon',
         'public.m150_membership_retention_run()',
         v_privilege
       ) or has_function_privilege(
         'authenticated',
         'public.m150_membership_retention_run()',
         v_privilege
       ) then
      raise exception 'Browserrolle besitzt Retention-Privileg %.', v_privilege;
    end if;
  end loop;
end
$m150_retention_verification$;

select pass('PORTAL_CORE_STRUCTURE_OK - M150 F1.7A retention and minimization contract');
select * from finish();

rollback;
