\set ON_ERROR_STOP on

begin;

select plan(1);

do $m150_communication_verification$
declare
  v_role_member constant uuid := '00000000-0000-4000-8000-000000000003';
  v_u1 constant uuid := '16000000-0000-4000-8000-000000000001';
  v_u2 constant uuid := '16000000-0000-4000-8000-000000000002';
  v_u3 constant uuid := '16000000-0000-4000-8000-000000000003';
  v_u4 constant uuid := '16000000-0000-4000-8000-000000000004';
  v_u5 constant uuid := '16000000-0000-4000-8000-000000000005';
  v_m1 constant uuid := '16000000-0000-4001-8000-000000000001';
  v_m2 constant uuid := '16000000-0000-4001-8000-000000000002';
  v_m3 constant uuid := '16000000-0000-4001-8000-000000000003';
  v_m4 constant uuid := '16000000-0000-4001-8000-000000000004';
  v_m5 constant uuid := '16000000-0000-4001-8000-000000000005';
  v_inactive_member constant uuid := '16000000-0000-4001-8000-000000000010';
  v_active_member constant uuid := '16000000-0000-4001-8000-000000000011';
  v_vote_app constant uuid := '16000000-0000-4002-8000-000000000001';
  v_manual_app constant uuid := '16000000-0000-4002-8000-000000000002';
  v_approval_app constant uuid := '16000000-0000-4002-8000-000000000003';
  v_new_app constant uuid := '16000000-0000-4002-8000-000000000004';
  v_reactivate_app constant uuid := '16000000-0000-4002-8000-000000000005';
  v_resolve_app constant uuid := '16000000-0000-4002-8000-000000000006';
  v_failed_app constant uuid := '16000000-0000-4002-8000-000000000007';
  v_withdrawn_app constant uuid := '16000000-0000-4002-8000-000000000008';
  v_payload jsonb;
  v_response jsonb;
  v_public_application_id uuid;
  v_outbox_id uuid;
  v_claim_token uuid;
  v_next_claim_token uuid;
  v_count bigint;
  v_attempts integer;
  v_status text;
  v_available_at timestamptz;
  v_privilege text;
  v_loop integer;
begin
  if to_regclass('app_private.membership_application_email_outbox') is null then
    raise exception 'M150-Kommunikations-Outbox fehlt.';
  end if;

  if not (select relrowsecurity
          from pg_class
          where oid = 'app_private.membership_application_email_outbox'::regclass) then
    raise exception 'Outbox-RLS fehlt.';
  end if;

  foreach v_privilege in array array[
    'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
  ]
  loop
    if has_table_privilege(
         'anon',
         'app_private.membership_application_email_outbox',
         v_privilege
       ) or has_table_privilege(
         'authenticated',
         'app_private.membership_application_email_outbox',
         v_privilege
       ) or has_table_privilege(
         'service_role',
         'app_private.membership_application_email_outbox',
         v_privilege
       ) then
      raise exception 'Direktes Outbox-Tabellenrecht % vorhanden.', v_privilege;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.m150_membership_email_claim()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.m150_membership_email_claim()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.m150_membership_email_claim()', 'EXECUTE')
     or has_function_privilege(
       'anon',
       'public.m150_membership_email_complete(uuid,uuid,boolean,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.m150_membership_email_complete(uuid,uuid,boolean,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.m150_membership_email_complete(uuid,uuid,boolean,text)',
       'EXECUTE'
     ) then
    raise exception 'Claim-/Complete-Wrapper sind nicht service_role-only.';
  end if;

  if has_function_privilege(
       'service_role',
       'app_private.m150_membership_email_claim()',
       'EXECUTE'
     ) or has_function_privilege(
       'service_role',
       'app_private.m150_membership_email_complete(uuid,uuid,boolean,text)',
       'EXECUTE'
     ) or has_function_privilege(
       'service_role',
       'app_private.m150_enqueue_membership_email(uuid,text)',
       'EXECUTE'
     ) then
    raise exception 'service_role darf private Kommunikationsfunktionen direkt ausführen.';
  end if;

  if exists (
    select 1
    from information_schema.columns as column_info
    where column_info.table_schema = 'app_private'
      and column_info.table_name = 'membership_application_email_outbox'
      and column_info.column_name in (
        'email',
        'recipient_email',
        'first_name',
        'last_name',
        'birth_date',
        'phone',
        'street',
        'house_number',
        'postal_code',
        'city',
        'applicant_message',
        'decision_reason_internal',
        'applicant_notice',
        'rejection_applicant_notice'
      )
  ) then
    raise exception 'Outbox dupliziert PII oder fachliche Antragstexte.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'app_fanclub'
      and table_name = 'membership_applications'
      and column_name = 'rejection_applicant_notice'
      and data_type = 'text'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'app_fanclub.membership_applications'::regclass
      and conname = 'membership_applications_rejection_applicant_notice_check'
  ) then
    raise exception 'Rejection Applicant Notice oder Constraint fehlt.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'app_private.membership_application_email_outbox'::regclass
      and conname = 'membership_application_email_outbox_application_type_unique'
      and contype = 'u'
  ) then
    raise exception 'Unique Application+Type fehlt.';
  end if;

  insert into auth.users (id, email)
  values
    (v_u1, 'm150-mail-board1@example.invalid'),
    (v_u2, 'm150-mail-board2@example.invalid'),
    (v_u3, 'm150-mail-board3@example.invalid'),
    (v_u4, 'm150-mail-board4@example.invalid'),
    (v_u5, 'm150-mail-board5@example.invalid');

  insert into app_portal.users (
    id,
    user_code,
    email,
    first_name,
    last_name,
    role_id
  ) values
    (v_u1, 'U-M150-MAIL-1', 'm150-mail-board1@example.invalid', 'Board', 'Eins', v_role_member),
    (v_u2, 'U-M150-MAIL-2', 'm150-mail-board2@example.invalid', 'Board', 'Zwei', v_role_member),
    (v_u3, 'U-M150-MAIL-3', 'm150-mail-board3@example.invalid', 'Board', 'Drei', v_role_member),
    (v_u4, 'U-M150-MAIL-4', 'm150-mail-board4@example.invalid', 'Board', 'Vier', v_role_member),
    (v_u5, 'U-M150-MAIL-5', 'm150-mail-board5@example.invalid', 'Board', 'Fuenf', v_role_member);

  insert into app_fanclub.members (
    id,
    member_code,
    first_name,
    last_name,
    birth_date,
    email,
    status,
    left_on
  ) values
    (v_m1, 'M-M150-MAIL-1', 'Board', 'Eins', date '1981-01-01', '', 'ACTIVE', null),
    (v_m2, 'M-M150-MAIL-2', 'Board', 'Zwei', date '1982-01-01', '', 'ACTIVE', null),
    (v_m3, 'M-M150-MAIL-3', 'Board', 'Drei', date '1983-01-01', '', 'ACTIVE', null),
    (v_m4, 'M-M150-MAIL-4', 'Board', 'Vier', date '1984-01-01', '', 'ACTIVE', null),
    (v_m5, 'M-M150-MAIL-5', 'Board', 'Fuenf', date '1985-01-01', '', 'ACTIVE', null),
    (v_inactive_member, 'M-M150-MAIL-INACTIVE', 'Alt', 'Mitglied', date '1975-01-01', 'inactive-mail@example.invalid', 'INACTIVE', date '2020-01-01'),
    (v_active_member, 'M-M150-MAIL-ACTIVE', 'Aktiv', 'Mitglied', date '1976-01-01', 'active-mail@example.invalid', 'ACTIVE', null);

  insert into app_portal.user_member_links (user_id, member_id)
  values
    (v_u1, v_m1),
    (v_u2, v_m2),
    (v_u3, v_m3),
    (v_u4, v_m4),
    (v_u5, v_m5);

  update app_fanclub.office_slots
  set member_id = case code
    when 'VORSTAND_1' then v_m1
    when 'VORSTAND_2' then v_m2
    when 'VORSTAND_3' then v_m3
    when 'KASSIER' then v_m4
    when 'SCHRIFTFUEHRER' then v_m5
  end;

  if (select count(*) from app_private.m150_current_board()) <> 5 then
    raise exception 'Kommunikationstest besitzt keinen vollständigen Vorstand.';
  end if;

  v_payload := jsonb_build_object(
    'firstName', 'Receipt',
    'lastName', 'Public',
    'birthDate', '1990-01-01',
    'email', 'receipt-public@example.invalid',
    'phone', '01001',
    'street', 'Receiptweg',
    'houseNumber', '1',
    'postalCode', '86150',
    'city', 'Augsburg',
    'applicantMessage', null,
    'declarationConfirmed', true,
    'declarationVersion', 'D-MAIL-1',
    'statutesConfirmed', true,
    'statutesVersion', 'S-MAIL-1',
    'statutesReference', 'satzung-mail-1'
  );

  v_response := public.m150_submit_membership_application(
    v_payload,
    'm150-mail-receipt-created'
  );
  v_public_application_id := (v_response ->> 'applicationId')::uuid;

  if not coalesce((v_response ->> 'created')::boolean, false)
     or (select count(*)
         from app_private.notification_events
         where notification_type = 'MEMBERSHIP_APPLICATION_RECEIVED'
           and source_module = 'M150'
           and entity_type = 'membership_application'
           and entity_id = v_public_application_id::text) <> 1
     or exists (
       select 1
       from app_private.membership_application_email_outbox
       where application_id = v_public_application_id
     ) then
    raise exception 'Echte Neuanlage erzeugte nicht genau ein zentrales RECEIPT-Event oder schrieb noch in die Legacy-Outbox.';
  end if;

  perform public.m150_submit_membership_application(
    v_payload,
    'm150-mail-receipt-created'
  );
  perform public.m150_submit_membership_application(
    v_payload || jsonb_build_object('phone', '01999'),
    'm150-mail-receipt-duplicate-pending'
  );
  perform app_private.m150_enqueue_membership_email(v_public_application_id, 'RECEIPT');

  if (select count(*)
      from app_private.notification_events
      where notification_type = 'MEMBERSHIP_APPLICATION_RECEIVED'
        and source_module = 'M150'
        and entity_type = 'membership_application'
        and entity_id = v_public_application_id::text) <> 1
     or exists (
       select 1
       from app_private.membership_application_email_outbox
       where application_id = v_public_application_id
     ) then
    raise exception 'Idempotency-Retry, PENDING-Dublette oder Enqueue-Retry erzeugte doppeltes RECEIPT oder einen Legacy-Dual-Write.';
  end if;

  insert into app_fanclub.membership_applications (
    id,
    first_name,
    last_name,
    birth_date,
    email,
    phone,
    street,
    house_number,
    postal_code,
    city,
    status,
    submitted_at,
    declaration_version,
    statutes_version,
    statutes_reference,
    declaration_confirmed,
    statutes_confirmed
  ) values
    (v_vote_app, 'Vote', 'Rejection', date '1990-01-02', 'vote-rejection@example.invalid', '02001', 'A', '1', '10001', 'Ort', 'PENDING', now(), 'D1', 'S1', 'ref', true, true),
    (v_manual_app, 'Manual', 'Rejection', date '1990-01-03', 'manual-rejection@example.invalid', '02002', 'B', '2', '10002', 'Ort', 'PENDING', now() - interval '8 days', 'D1', 'S1', 'ref', true, true),
    (v_approval_app, 'Manual', 'Approval', date '1990-01-04', 'manual-approval@example.invalid', '02003', 'C', '3', '10003', 'Ort', 'PENDING', now() - interval '8 days', 'D1', 'S1', 'ref', true, true),
    (v_failed_app, 'Failed', 'Conversion', date '1990-01-08', 'failed-conversion@example.invalid', '02007', 'G', '7', '10007', 'Ort', 'PENDING', now(), 'D1', 'S1', 'ref', true, true),
    (v_withdrawn_app, 'Withdrawn', 'NoMail', date '1990-01-09', 'withdrawn-mail@example.invalid', '02008', 'H', '8', '10008', 'Ort', 'PENDING', now(), 'D1', 'S1', 'ref', true, true);

  update app_fanclub.membership_applications as application
  set status = 'WITHDRAWN',
      revision = application.revision + 1,
      updated_at = now()
  where application.id = v_withdrawn_app;

  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_u1, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'membership_application_vote',
    jsonb_build_object(
      'id', v_vote_app,
      'vote', 'NO',
      'expectedRevision', 1,
      'applicantNotice', 'Nicht entscheidend und nicht zu speichern'
    )
  );

  if v_response #>> '{data,status}' <> 'PENDING'
     or v_response #>> '{data,applicantNotice}' is not null
     or exists (
       select 1
       from app_private.notification_events
       where notification_type = 'MEMBERSHIP_APPLICATION_REJECTED'
         and source_module = 'M150'
         and entity_type = 'membership_application'
         and entity_id = v_vote_app::text
     ) then
    raise exception 'Erste NO-Stimme speicherte Notice oder REJECTION-Event: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_u2, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'membership_application_vote',
    jsonb_build_object(
      'id', v_vote_app,
      'vote', 'NO',
      'expectedRevision', 2,
      'applicantNotice', 'Auch die zweite NO-Mitteilung bleibt flüchtig'
    )
  );

  if v_response #>> '{data,status}' <> 'PENDING'
     or v_response #>> '{data,applicantNotice}' is not null
     or exists (
       select 1
       from app_private.notification_events
       where notification_type = 'MEMBERSHIP_APPLICATION_REJECTED'
         and source_module = 'M150'
         and entity_type = 'membership_application'
         and entity_id = v_vote_app::text
     ) then
    raise exception 'Zweite NO-Stimme speicherte Notice oder REJECTION-Event: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_u3::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_u3, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'membership_application_vote',
    jsonb_build_object(
      'id', v_vote_app,
      'vote', 'NO',
      'expectedRevision', 3,
      'applicantNotice', 'Externe Mitteilung ohne internen Grund'
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_DECISIVE_NO_REASON_REQUIRED' then
    raise exception 'Interner Grund war bei entscheidender NO-Stimme nicht Pflicht: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_vote',
    jsonb_build_object(
      'id', v_vote_app,
      'vote', 'NO',
      'expectedRevision', 3,
      'reasonInternal', 'INTERNER GRUND DARF NICHT IN CLAIM',
      'applicantNotice', 'Bitte beachte unsere separate Rückmeldung.'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,status}' <> 'REJECTED'
     or v_response #>> '{data,decisionReasonInternal}' <> 'INTERNER GRUND DARF NICHT IN CLAIM'
     or v_response #>> '{data,applicantNotice}' <> 'Bitte beachte unsere separate Rückmeldung.'
     or (select count(*)
         from app_private.notification_events
         where notification_type = 'MEMBERSHIP_APPLICATION_REJECTED'
           and source_module = 'M150'
           and entity_type = 'membership_application'
           and entity_id = v_vote_app::text) <> 1 then
    raise exception 'Echte REJECTED-Transition speicherte Texte/zentrales Event nicht korrekt: %', v_response;
  end if;

  perform app_private.m150_enqueue_membership_email(v_vote_app, 'REJECTION');
  if (select count(*)
      from app_private.notification_events
      where notification_type = 'MEMBERSHIP_APPLICATION_REJECTED'
        and source_module = 'M150'
        and entity_type = 'membership_application'
        and entity_id = v_vote_app::text) <> 1 then
    raise exception 'Zentrale Event-Idempotenz verhinderte doppeltes REJECTION nicht.';
  end if;

  begin
    update app_fanclub.membership_applications
    set rejection_applicant_notice = 'Nachträglich verändert'
    where id = v_vote_app;
    raise exception 'Applicant Notice war nach REJECTED veränderbar.';
  exception when sqlstate '22000' then null;
  end;

  begin
    perform app_private.m150_rejection_applicant_notice(
      jsonb_build_object('applicantNotice', repeat('x', 2001))
    );
    raise exception 'Applicant Notice über 2000 Zeichen wurde akzeptiert.';
  exception when sqlstate '22023' then null;
  end;

  begin
    perform app_private.m150_rejection_applicant_notice(
      jsonb_build_object('applicantNotice', '<strong>HTML</strong>')
    );
    raise exception 'HTML Applicant Notice wurde akzeptiert.';
  exception when sqlstate '22023' then null;
  end;

  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_u1, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'membership_application_manual_decide',
    jsonb_build_object(
      'id', v_manual_app,
      'decision', 'REJECTED',
      'expectedRevision', 1,
      'reasonInternal', 'Manueller interner Grund',
      'applicantNotice', 'Manuelle externe Mitteilung'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,status}' <> 'REJECTED'
     or v_response #>> '{data,applicantNotice}' <> 'Manuelle externe Mitteilung'
     or (select count(*)
         from app_private.notification_events
         where notification_type = 'MEMBERSHIP_APPLICATION_REJECTED'
           and source_module = 'M150'
           and entity_type = 'membership_application'
           and entity_id = v_manual_app::text) <> 1 then
    raise exception 'Manuelle REJECTED-Transition erzeugte Notice/zentrales Event nicht korrekt: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_manual_decide',
    jsonb_build_object(
      'id', v_approval_app,
      'decision', 'APPROVED',
      'expectedRevision', 1,
      'reasonInternal', 'Interner Approval-Grund',
      'applicantNotice', 'Darf bei Approval nicht gespeichert werden'
    )
  );

  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,status}' <> 'APPROVED'
     or v_response #>> '{data,applicantNotice}' is not null
     or exists (
       select 1
       from app_private.notification_events
       where notification_type = 'MEMBERSHIP_ADMISSION_COMPLETED'
         and source_module = 'M150'
         and entity_type = 'membership_application'
         and entity_id = v_approval_app::text
     ) then
    raise exception 'APPROVED übernahm Applicant Notice oder erzeugte ADMISSION: %', v_response;
  end if;

  insert into app_fanclub.membership_applications (
    id,
    first_name,
    last_name,
    birth_date,
    email,
    phone,
    street,
    house_number,
    postal_code,
    city,
    status,
    submitted_at,
    decided_at,
    decided_by,
    decision_method,
    declaration_version,
    statutes_version,
    statutes_reference,
    declaration_confirmed,
    statutes_confirmed
  ) values
    (v_new_app, 'New', 'Admission', date '1990-01-05', 'new-admission@example.invalid', '02004', 'D', '4', '10004', 'Ort', 'APPROVED', now(), now(), v_u1, 'VOTE_MAJORITY', 'D1', 'S1', 'ref', true, true),
    (v_reactivate_app, 'Reactivate', 'Admission', date '1990-01-06', 'reactivate-admission@example.invalid', '02005', 'E', '5', '10005', 'Ort', 'APPROVED', now(), now(), v_u1, 'VOTE_MAJORITY', 'D1', 'S1', 'ref', true, true),
    (v_resolve_app, 'Resolve', 'Admission', date '1990-01-07', 'resolve-admission@example.invalid', '02006', 'F', '6', '10006', 'Ort', 'APPROVED', now(), now(), v_u1, 'VOTE_MAJORITY', 'D1', 'S1', 'ref', true, true);

  foreach v_response in array array[
    public.pd_api(
      'membership_application_convert',
      jsonb_build_object('id', v_new_app, 'expectedRevision', 1, 'mode', 'NEW_MEMBER')
    ),
    public.pd_api(
      'membership_application_convert',
      jsonb_build_object(
        'id', v_reactivate_app,
        'expectedRevision', 1,
        'mode', 'REACTIVATE_EXISTING',
        'targetMemberId', v_inactive_member
      )
    ),
    public.pd_api(
      'membership_application_convert',
      jsonb_build_object(
        'id', v_resolve_app,
        'expectedRevision', 1,
        'mode', 'RESOLVE_EXISTING_ACTIVE',
        'targetMemberId', v_active_member
      )
    )
  ]
  loop
    if not coalesce((v_response ->> 'ok')::boolean, false) then
      raise exception 'Erfolgreiche Conversion für ADMISSION fehlgeschlagen: %', v_response;
    end if;
  end loop;

  if (select count(*)
      from app_private.notification_events
      where notification_type = 'MEMBERSHIP_ADMISSION_COMPLETED'
        and source_module = 'M150'
        and entity_type = 'membership_application'
        and entity_id in (v_new_app::text, v_reactivate_app::text, v_resolve_app::text)) <> 3 then
    raise exception 'Die drei erfolgreichen Conversion-Modi erzeugten nicht je ein zentrales ADMISSION-Event.';
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_failed_app, 'expectedRevision', 1, 'mode', 'NEW_MEMBER')
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or exists (
       select 1
       from app_private.notification_events
       where notification_type = 'MEMBERSHIP_ADMISSION_COMPLETED'
         and source_module = 'M150'
         and entity_type = 'membership_application'
         and entity_id = v_failed_app::text
     ) then
    raise exception 'Fehlgeschlagene Conversion erzeugte ADMISSION: %', v_response;
  end if;

  if exists (
    select 1
    from app_private.notification_events
    where source_module = 'M150'
      and entity_type = 'membership_application'
      and entity_id = v_withdrawn_app::text
      and notification_type in (
        'MEMBERSHIP_APPLICATION_REJECTED',
        'MEMBERSHIP_ADMISSION_COMPLETED'
      )
  ) then
    raise exception 'WITHDRAWN erzeugte ein unzulässiges zentrales Entscheidungs-/Aufnahmeereignis.';
  end if;

  if exists (
    select 1
    from app_portal.audit_events as audit
    where audit.entity_id in (v_vote_app::text, v_manual_app::text)
      and lower(
        coalesce(audit.before_data, '{}'::jsonb)::text
        || coalesce(audit.after_data, '{}'::jsonb)::text
        || coalesce(audit.metadata, '{}'::jsonb)::text
      ) ~ '(bitte beachte unsere separate rückmeldung|manuelle externe mitteilung)'
  ) then
    raise exception 'Applicant Notice wurde als Klartext ins Audit kopiert.';
  end if;

  -- Legacy-Drain-Fixture: M020 erzeugt keine neuen Rows mehr in dieser Outbox.
  -- Die alten Claim-/Complete-RPCs bleiben jedoch für vor M020 vorhandene Rows funktionsfähig.
  insert into app_private.membership_application_email_outbox (
    application_id,
    email_type
  ) values
    (v_vote_app, 'REJECTION'),
    (v_manual_app, 'RECEIPT')
  on conflict (application_id, email_type) do nothing;

  update app_private.membership_application_email_outbox
  set available_at = now() + interval '1 day'
  where status = 'PENDING';

  update app_private.membership_application_email_outbox
  set available_at = now()
  where application_id = v_vote_app
    and email_type = 'REJECTION';

  v_response := public.m150_membership_email_claim();
  v_outbox_id := (v_response ->> 'outboxId')::uuid;
  v_claim_token := (v_response ->> 'claimToken')::uuid;

  if not coalesce((v_response ->> 'claimed')::boolean, false)
     or v_response ->> 'emailType' <> 'REJECTION'
     or v_response ->> 'recipientEmail' <> 'vote-rejection@example.invalid'
     or v_response ->> 'firstName' <> 'Vote'
     or v_response ->> 'applicantNotice' <> 'Bitte beachte unsere separate Rückmeldung.'
     or v_response::text ilike '%INTERNER GRUND DARF NICHT IN CLAIM%'
     or exists (
       select 1
       from jsonb_object_keys(v_response) as response_key(key)
       where response_key.key not in (
         'claimed',
         'outboxId',
         'claimToken',
         'emailType',
         'recipientEmail',
         'firstName',
         'applicantNotice'
       )
     ) then
    raise exception 'REJECTION-Claim enthält falsche oder zu viele Daten: %', v_response;
  end if;

  if not exists (
    select 1
    from app_private.membership_application_email_outbox as outbox
    where outbox.id = v_outbox_id
      and outbox.status = 'SENDING'
      and outbox.attempts = 1
      and outbox.claim_token = v_claim_token
      and outbox.claimed_at = now()
      and outbox.claim_expires_at = now() + interval '10 minutes'
  ) then
    raise exception 'Claim setzte Status, Attempt oder 10-Minuten-Lease falsch.';
  end if;

  begin
    perform public.m150_membership_email_complete(
      v_outbox_id,
      extensions.gen_random_uuid(),
      true,
      null
    );
    raise exception 'Complete akzeptierte einen falschen Claim-Token.';
  exception when sqlstate '42501' then null;
  end;

  v_response := public.m150_membership_email_complete(
    v_outbox_id,
    v_claim_token,
    true,
    null
  );
  if v_response ->> 'status' <> 'SENT'
     or not exists (
       select 1
       from app_private.membership_application_email_outbox as outbox
       where outbox.id = v_outbox_id
         and outbox.status = 'SENT'
         and outbox.sent_at = now()
         and outbox.claim_token is null
         and outbox.claimed_at is null
         and outbox.claim_expires_at is null
         and outbox.last_error_code is null
     ) then
    raise exception 'Success Complete setzte SENT nicht korrekt: %', v_response;
  end if;

  update app_private.membership_application_email_outbox
  set available_at = now()
  where application_id = v_manual_app
    and email_type = 'RECEIPT';

  v_response := public.m150_membership_email_claim();
  v_outbox_id := (v_response ->> 'outboxId')::uuid;
  v_claim_token := (v_response ->> 'claimToken')::uuid;

  update app_private.membership_application_email_outbox
  set claim_expires_at = now() - interval '1 second'
  where id = v_outbox_id;

  v_response := public.m150_membership_email_claim();
  v_next_claim_token := (v_response ->> 'claimToken')::uuid;
  if (v_response ->> 'outboxId')::uuid <> v_outbox_id
     or v_next_claim_token = v_claim_token
     or not exists (
       select 1
       from app_private.membership_application_email_outbox
       where id = v_outbox_id
         and attempts = 2
         and claim_token = v_next_claim_token
     ) then
    raise exception 'Verwaister SENDING-Claim war nicht wieder claimbar: %', v_response;
  end if;

  v_response := public.m150_membership_email_complete(
    v_outbox_id,
    v_next_claim_token,
    false,
    'PROVIDER_TEMPORARY'
  );
  select status, attempts, available_at
  into v_status, v_attempts, v_available_at
  from app_private.membership_application_email_outbox
  where id = v_outbox_id;
  if v_status <> 'PENDING'
     or v_attempts <> 2
     or v_available_at <> now() + interval '5 minutes' then
    raise exception 'Failure unter Attempt 5 setzte Retry nicht auf fünf Minuten: %', v_response;
  end if;

  for v_loop in 3..4
  loop
    update app_private.membership_application_email_outbox
    set available_at = now()
    where id = v_outbox_id;
    v_response := public.m150_membership_email_claim();
    v_claim_token := (v_response ->> 'claimToken')::uuid;
    perform public.m150_membership_email_complete(
      v_outbox_id,
      v_claim_token,
      false,
      'PROVIDER_TEMPORARY'
    );
  end loop;

  update app_private.membership_application_email_outbox
  set available_at = now()
  where id = v_outbox_id;
  v_response := public.m150_membership_email_claim();
  v_claim_token := (v_response ->> 'claimToken')::uuid;
  select attempts into v_attempts
  from app_private.membership_application_email_outbox
  where id = v_outbox_id;
  if v_attempts <> 5 then
    raise exception 'Fünfter Claim setzte attempts nicht auf 5.';
  end if;

  v_response := public.m150_membership_email_complete(
    v_outbox_id,
    v_claim_token,
    false,
    'PROVIDER_FINAL'
  );
  if v_response ->> 'status' <> 'FAILED'
     or not exists (
       select 1
       from app_private.membership_application_email_outbox
       where id = v_outbox_id
         and status = 'FAILED'
         and attempts = 5
         and claim_token is null
         and claimed_at is null
         and claim_expires_at is null
         and last_error_code = 'PROVIDER_FINAL'
     ) then
    raise exception 'Fünfter fehlgeschlagener Versuch setzte FAILED nicht korrekt: %', v_response;
  end if;

  update app_private.membership_application_email_outbox
  set available_at = now() + interval '1 day'
  where status = 'PENDING';
  v_response := public.m150_membership_email_claim();
  if coalesce((v_response ->> 'claimed')::boolean, true) then
    raise exception 'FAILED/max-attempt Outbox-Event wurde erneut geclaimt: %', v_response;
  end if;

  if pg_get_functiondef(
       'app_private.m150_membership_email_claim()'::regprocedure
     ) !~* 'for update skip locked'
     or pg_get_functiondef(
       'app_private.m150_membership_email_claim()'::regprocedure
     ) ~* 'decision_reason_internal|birth_date|phone|street|applicant_message' then
    raise exception 'Claim ist nicht SKIP-LOCKED-atomar oder liest unzulässige Daten.';
  end if;
end
$m150_communication_verification$;

select pass('PORTAL_CORE_STRUCTURE_OK - M150 F1.6A communication contract');
select * from finish();

rollback;
