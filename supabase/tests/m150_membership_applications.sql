\set ON_ERROR_STOP on

begin;

select plan(1);

do $m150_verification$
declare
  v_role_member constant uuid := '00000000-0000-4000-8000-000000000002';
  v_role_admin constant uuid := '00000000-0000-4000-8000-000000000001';
  v_u1 constant uuid := '15000000-0000-4000-8000-000000000001';
  v_u2 constant uuid := '15000000-0000-4000-8000-000000000002';
  v_u3 constant uuid := '15000000-0000-4000-8000-000000000003';
  v_u4 constant uuid := '15000000-0000-4000-8000-000000000004';
  v_u5 constant uuid := '15000000-0000-4000-8000-000000000005';
  v_u6 constant uuid := '15000000-0000-4000-8000-000000000006';
  v_admin constant uuid := '15000000-0000-4000-8000-000000000099';
  v_m1 constant uuid := '15000000-0000-4001-8000-000000000001';
  v_m2 constant uuid := '15000000-0000-4001-8000-000000000002';
  v_m3 constant uuid := '15000000-0000-4001-8000-000000000003';
  v_m4 constant uuid := '15000000-0000-4001-8000-000000000004';
  v_m5 constant uuid := '15000000-0000-4001-8000-000000000005';
  v_m6 constant uuid := '15000000-0000-4001-8000-000000000006';
  v_match_member constant uuid := '15000000-0000-4001-8000-000000000099';
  v_yes_app constant uuid := '15000000-0000-4002-8000-000000000001';
  v_no_app constant uuid := '15000000-0000-4002-8000-000000000002';
  v_early_app constant uuid := '15000000-0000-4002-8000-000000000003';
  v_manual_app constant uuid := '15000000-0000-4002-8000-000000000004';
  v_incomplete_app constant uuid := '15000000-0000-4002-8000-000000000005';
  v_roster_app constant uuid := '15000000-0000-4002-8000-000000000006';
  v_hint_app constant uuid := '15000000-0000-4002-8000-000000000007';
  v_hint_other constant uuid := '15000000-0000-4002-8000-000000000008';
  v_roster_before_vote_app constant uuid := '15000000-0000-4002-8000-000000000009';
  v_roster_non_voter_app constant uuid := '15000000-0000-4002-8000-000000000010';
  v_incomplete_snapshot_app constant uuid := '15000000-0000-4002-8000-000000000011';
  v_vote_constraint_app constant uuid := '15000000-0000-4002-8000-000000000012';
  v_response jsonb;
  v_status text;
  v_reason text;
  v_method text;
  v_revision integer;
  v_count bigint;
  v_members_before bigint;
  v_access_before bigint;
  v_accounts_before bigint;
  v_entries_before bigint;
  v_reports_before bigint;
  v_privilege text;
begin
  if to_regclass('app_fanclub.membership_applications') is null
     or to_regclass('app_fanclub.membership_application_board_roster') is null
     or to_regclass('app_fanclub.membership_application_votes') is null then
    raise exception 'M150-Tabellen fehlen.';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'app_fanclub.membership_applications'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'app_fanclub.membership_application_board_roster'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'app_fanclub.membership_application_votes'::regclass) then
    raise exception 'M150-RLS fehlt.';
  end if;

  foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
  loop
    if has_table_privilege('anon', 'app_fanclub.membership_applications', v_privilege)
       or has_table_privilege('authenticated', 'app_fanclub.membership_applications', v_privilege)
       or has_table_privilege('anon', 'app_fanclub.membership_application_board_roster', v_privilege)
       or has_table_privilege('authenticated', 'app_fanclub.membership_application_board_roster', v_privilege)
       or has_table_privilege('anon', 'app_fanclub.membership_application_votes', v_privilege)
       or has_table_privilege('authenticated', 'app_fanclub.membership_application_votes', v_privilege) then
      raise exception 'Browserrolle besitzt direktes M150-Tabellenrecht %.', v_privilege;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.pd_api(text,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE') then
    raise exception 'pd_api-Grant ist fuer anon/authenticated falsch.';
  end if;

  if has_function_privilege('authenticated', 'app_private.api_membership_application_vote(jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'app_private.m150_current_board()', 'EXECUTE')
     or has_function_privilege('authenticated', 'app_private.m150_capture_board_roster()', 'EXECUTE') then
    raise exception 'authenticated darf M150-private Funktionen direkt ausfuehren.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'app_fanclub.membership_application_votes'::regclass
      and contype = 'p'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'app_fanclub.membership_applications'::regclass
      and conname = 'membership_applications_status_check'
  ) then
    raise exception 'M150-Schluessel oder Status-Constraint fehlt.';
  end if;

  begin
    insert into app_fanclub.membership_applications (
      first_name, last_name, birth_date, email, phone, street, house_number,
      postal_code, city, status, declaration_version, statutes_version,
      statutes_reference, declaration_confirmed, statutes_confirmed
    ) values (
      'Invalid', 'Status', date '1990-01-01', 'invalid@example.invalid', '0123',
      'Strasse', '1', '12345', 'Ort', 'INVALID', 'D1', 'S1', 'ref', true, true
    );
    raise exception 'Ungueltiger M150-Status wurde akzeptiert.';
  exception when check_violation then null;
  end;

  insert into auth.users (id, email)
  values
    (v_u1, 'm150-board1@example.invalid'),
    (v_u2, 'm150-board2@example.invalid'),
    (v_u3, 'm150-board3@example.invalid'),
    (v_u4, 'm150-board4@example.invalid'),
    (v_u5, 'm150-board5@example.invalid'),
    (v_u6, 'm150-board6@example.invalid'),
    (v_admin, 'm150-match@example.invalid');

  insert into app_portal.users (id, user_code, email, first_name, last_name, role_id)
  values
    (v_u1, 'U-M150-1', 'm150-board1@example.invalid', 'Board', 'Eins', v_role_member),
    (v_u2, 'U-M150-2', 'm150-board2@example.invalid', 'Board', 'Zwei', v_role_member),
    (v_u3, 'U-M150-3', 'm150-board3@example.invalid', 'Board', 'Drei', v_role_member),
    (v_u4, 'U-M150-4', 'm150-board4@example.invalid', 'Board', 'Vier', v_role_member),
    (v_u5, 'U-M150-5', 'm150-board5@example.invalid', 'Board', 'Fuenf', v_role_member),
    (v_u6, 'U-M150-6', 'm150-board6@example.invalid', 'Board', 'Sechs', v_role_member),
    (v_admin, 'U-M150-ADMIN', 'm150-match@example.invalid', 'Admin', 'OhneAmt', v_role_admin);

  insert into app_fanclub.members (
    id, member_code, first_name, last_name, email, phone, birth_date
  ) values
    (v_m1, 'M-M150-1', 'Board', 'Eins', '', '', date '1981-01-01'),
    (v_m2, 'M-M150-2', 'Board', 'Zwei', '', '', date '1982-01-01'),
    (v_m3, 'M-M150-3', 'Board', 'Drei', '', '', date '1983-01-01'),
    (v_m4, 'M-M150-4', 'Board', 'Vier', '', '', date '1984-01-01'),
    (v_m5, 'M-M150-5', 'Board', 'Fuenf', '', '', date '1985-01-01'),
    (v_m6, 'M-M150-6', 'Board', 'Sechs', '', '', date '1986-01-01'),
    (v_match_member, 'M-M150-MATCH', 'Anna', 'Antrag', ' M150-MATCH@Example.Invalid ', '+49 (170) 123-456', date '1990-02-03');

  insert into app_portal.user_member_links (user_id, member_id)
  values
    (v_u1, v_m1), (v_u2, v_m2), (v_u3, v_m3),
    (v_u4, v_m4), (v_u5, v_m5), (v_u6, v_m6);

  update app_fanclub.office_slots
  set member_id = case code
    when 'VORSTAND_1' then v_m1
    when 'VORSTAND_2' then v_m2
    when 'VORSTAND_3' then v_m3
    when 'KASSIER' then v_m4
    when 'SCHRIFTFUEHRER' then v_m5
  end;

  if (select count(*) from app_private.m150_current_board()) <> 5 then
    raise exception 'Es wurden nicht exakt fuenf aktuelle Board-User ermittelt.';
  end if;

  begin
    insert into app_fanclub.membership_applications (
      first_name, last_name, birth_date, email, phone, street, house_number,
      postal_code, city, status, decided_at, decided_by, decision_method,
      declaration_version, statutes_version, statutes_reference,
      declaration_confirmed, statutes_confirmed
    ) values (
      'Invalid', 'ManualApproved', date '1990-01-01',
      'invalid-manual-approved@example.invalid', '01000', 'Constraint', '1',
      '10000', 'Ort', 'APPROVED', now(), v_u1, 'SEVEN_DAY_MANUAL',
      'D1', 'S1', 'satzung-2026', true, true
    );
    raise exception 'APPROVED + SEVEN_DAY_MANUAL ohne internen Grund wurde akzeptiert.';
  exception when check_violation then null;
  end;

  insert into app_fanclub.membership_applications (
    id, first_name, last_name, birth_date, email, phone, street, house_number,
    postal_code, city, status, decided_at, decided_by, decision_method,
    declaration_version, statutes_version, statutes_reference,
    declaration_confirmed, statutes_confirmed
  ) values (
    v_vote_constraint_app, 'Valid', 'VoteApproved', date '1990-01-01',
    'valid-vote-approved@example.invalid', '01009', 'Constraint', '2',
    '10001', 'Ort', 'APPROVED', now(), v_u1, 'VOTE_MAJORITY',
    'D1', 'S1', 'satzung-2026', true, true
  );

  if not exists (
    select 1
    from app_fanclub.membership_applications as application
    where application.id = v_vote_constraint_app
      and application.status = 'APPROVED'
      and application.decision_method = 'VOTE_MAJORITY'
      and application.decision_reason_internal is null
  ) then
    raise exception 'APPROVED + VOTE_MAJORITY ohne Grund wurde nicht zugelassen.';
  end if;

  insert into app_fanclub.membership_applications (
    id, first_name, last_name, birth_date, email, phone, street, house_number,
    postal_code, city, applicant_message, submitted_at, declaration_version,
    statutes_version, statutes_reference, declaration_confirmed, statutes_confirmed
  ) values
    (v_yes_app, 'Yes', 'Flow', date '1991-01-01', 'yes@example.invalid', '01001', 'A', '1', '11111', 'Ort', null, now(), 'D1', 'S1', 'satzung-2026', true, true),
    (v_no_app, 'No', 'Flow', date '1992-01-01', 'no@example.invalid', '01002', 'B', '2', '22222', 'Ort', null, now(), 'D1', 'S1', 'satzung-2026', true, true),
    (v_early_app, 'Early', 'Manual', date '1993-01-01', 'early@example.invalid', '01003', 'C', '3', '33333', 'Ort', null, ((((now() at time zone 'Europe/Berlin')::date - 6)::timestamp) at time zone 'Europe/Berlin'), 'D1', 'S1', 'satzung-2026', true, true),
    (v_manual_app, 'Ready', 'Manual', date '1994-01-01', 'ready@example.invalid', '01004', 'D', '4', '44444', 'Ort', null, ((((now() at time zone 'Europe/Berlin')::date - 7)::timestamp) at time zone 'Europe/Berlin'), 'D1', 'S1', 'satzung-2026', true, true),
    (v_incomplete_app, 'Incomplete', 'Board', date '1995-01-01', 'incomplete@example.invalid', '01005', 'E', '5', '55555', 'Ort', null, now(), 'D1', 'S1', 'satzung-2026', true, true),
    (v_roster_app, 'Roster', 'Change', date '1996-01-01', 'roster@example.invalid', '01006', 'F', '6', '66666', 'Ort', null, now(), 'D1', 'S1', 'satzung-2026', true, true),
    (v_hint_app, 'Anna', 'Antrag', date '1990-02-03', 'm150-match@example.invalid', '+49 170 123456', 'G', '7', '77777', 'Ort', 'Nur Hinweis', now(), 'D1', 'S1', 'satzung-2026', true, true),
    (v_hint_other, 'Andere', 'Person', date '1997-01-01', 'M150-MATCH@example.invalid', '0170999', 'H', '8', '88888', 'Ort', null, now(), 'D1', 'S1', 'satzung-2026', true, true),
    (v_roster_before_vote_app, 'Roster', 'BeforeVote', date '1998-01-01', 'roster-before@example.invalid', '01007', 'I', '9', '99991', 'Ort', null, ((((now() at time zone 'Europe/Berlin')::date - 7)::timestamp) at time zone 'Europe/Berlin'), 'D1', 'S1', 'satzung-2026', true, true),
    (v_roster_non_voter_app, 'Roster', 'NonVoter', date '1999-01-01', 'roster-non-voter@example.invalid', '01008', 'J', '10', '99992', 'Ort', null, now(), 'D1', 'S1', 'satzung-2026', true, true);

  update app_fanclub.office_slots
  set member_id = null
  where code = 'SCHRIFTFUEHRER';

  insert into app_fanclub.membership_applications (
    id, first_name, last_name, birth_date, email, phone, street, house_number,
    postal_code, city, submitted_at, declaration_version, statutes_version,
    statutes_reference, declaration_confirmed, statutes_confirmed
  ) values (
    v_incomplete_snapshot_app, 'Snapshot', 'Incomplete', date '1990-01-01',
    'snapshot-incomplete@example.invalid', '01010', 'K', '11', '99993', 'Ort',
    ((((now() at time zone 'Europe/Berlin')::date - 7)::timestamp) at time zone 'Europe/Berlin'),
    'D1', 'S1', 'satzung-2026', true, true
  );

  update app_fanclub.office_slots
  set member_id = v_m5
  where code = 'SCHRIFTFUEHRER';

  if (select count(*)
      from app_fanclub.membership_application_board_roster as roster
      where roster.application_id = v_incomplete_snapshot_app) <> 4 then
    raise exception 'Unvollstaendiger Eingangsvorstand wurde nicht mit vier Eintraegen eingefroren.';
  end if;

  if exists (
    select application.id
    from app_fanclub.membership_applications as application
    where application.id <> v_incomplete_snapshot_app
      and not exists (
        select 1
        from app_fanclub.membership_application_board_roster as roster
        where roster.application_id = application.id
      )
  ) then
    raise exception 'Automatischer Vorstandssnapshot fehlt bei einem Antrag.';
  end if;

  begin
    update app_fanclub.membership_applications
    set submitted_at = submitted_at + interval '1 second'
    where id = v_yes_app;
    raise exception 'submitted_at konnte geaendert werden.';
  exception when sqlstate '22000' then null;
  end;

  begin
    update app_fanclub.membership_application_board_roster
    set captured_at = captured_at + interval '1 second'
    where application_id = v_yes_app
      and office_code = 'VORSTAND_1';
    raise exception 'Vorstandssnapshot konnte ueberschrieben werden.';
  exception when sqlstate '22000' then null;
  end;

  select count(*) into v_members_before from app_fanclub.members;
  select count(*) into v_access_before from app_portal.access_requests;
  select count(*) into v_accounts_before from app_fanclub.finance_accounts;
  select count(*) into v_entries_before from app_fanclub.finance_entries;
  select count(*) into v_reports_before from app_fanclub.contribution_payment_reports;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_response := public.pd_api('membership_applications_list', '{}'::jsonb);
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501' then
    raise exception 'Admin ohne Amt durfte M150 lesen: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_vote',
    jsonb_build_object(
      'id', v_yes_app,
      'vote', 'YES',
      'expectedRevision', 1
    )
  );
  select status, revision
  into v_status, v_revision
  from app_fanclub.membership_applications
  where id = v_yes_app;
  select count(*)
  into v_count
  from app_fanclub.membership_application_votes
  where application_id = v_yes_app;
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or v_status <> 'PENDING'
     or v_revision <> 1
     or v_count <> 0 then
    raise exception 'Admin ohne Amt durfte voten oder erzeugte eine Mutation: %, %, %, %',
      v_response, v_status, v_revision, v_count;
  end if;

  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_response := public.pd_api('membership_applications_list', '{}'::jsonb);
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or jsonb_array_length(v_response -> 'data') <> 12 then
    raise exception 'Aktueller Vorstand kann Liste nicht lesen: %', v_response;
  end if;

  v_response := public.pd_api('membership_application_detail', jsonb_build_object('id', v_hint_app));
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or jsonb_array_length(v_response #> '{data,matches,membersByEmail}') <> 1
     or jsonb_array_length(v_response #> '{data,matches,membersByIdentity}') <> 1
     or jsonb_array_length(v_response #> '{data,matches,membersByPhone}') <> 1
     or jsonb_array_length(v_response #> '{data,matches,portalUsersByEmail}') <> 1
     or jsonb_array_length(v_response #> '{data,matches,pendingApplications}') <> 1 then
    raise exception 'Duplicate-Hints sind unvollstaendig: %', v_response;
  end if;

  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_yes_app, 'vote', 'YES', 'expectedRevision', 1));
  if v_response #>> '{data,status}' <> 'PENDING' or (v_response #>> '{data,revision}')::integer <> 2 then
    raise exception 'Erste YES-Stimme blieb nicht PENDING: %', v_response;
  end if;

  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_yes_app, 'vote', 'NO', 'expectedRevision', 2));
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_VOTE_ALREADY_EXISTS' then
    raise exception 'Doppelte Stimme derselben Person wurde nicht abgewiesen: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_yes_app, 'vote', 'YES', 'expectedRevision', 2));
  if v_response #>> '{data,status}' <> 'PENDING' then
    raise exception 'Zweite YES-Stimme blieb nicht PENDING: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_u3::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u3, 'role', 'authenticated')::text, true);
  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_yes_app, 'vote', 'YES', 'expectedRevision', 3));
  if v_response #>> '{data,status}' <> 'APPROVED'
     or v_response #>> '{data,decisionMethod}' <> 'VOTE_MAJORITY' then
    raise exception 'Dritte YES-Stimme hat nicht APPROVED entschieden: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_u4::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u4, 'role', 'authenticated')::text, true);
  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_yes_app, 'vote', 'YES', 'expectedRevision', 4));
  if coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Vote nach Entscheidung wurde akzeptiert: %', v_response;
  end if;

  begin
    insert into app_fanclub.membership_application_votes (
      application_id, voter_user_id, vote
    ) values (v_yes_app, v_u4, 'YES');
    raise exception 'Direkte Vote auf entschiedenen Antrag wurde akzeptiert.';
  exception when sqlstate 'P1503' then null;
  end;

  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_no_app, 'vote', 'NO', 'expectedRevision', 1));
  if v_response #>> '{data,status}' <> 'PENDING' then raise exception 'Erste NO-Stimme blieb nicht PENDING.'; end if;

  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_no_app, 'vote', 'NO', 'expectedRevision', 2));
  if v_response #>> '{data,status}' <> 'PENDING' then raise exception 'Zweite NO-Stimme blieb nicht PENDING.'; end if;

  perform set_config('request.jwt.claim.sub', v_u3::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u3, 'role', 'authenticated')::text, true);
  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_no_app, 'vote', 'NO', 'expectedRevision', 3));
  select status, revision into v_status, v_revision from app_fanclub.membership_applications where id = v_no_app;
  select count(*) into v_count from app_fanclub.membership_application_votes where application_id = v_no_app;
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_DECISIVE_NO_REASON_REQUIRED'
     or v_status <> 'PENDING' or v_revision <> 3 or v_count <> 2 then
    raise exception 'Dritte NO ohne Grund mutierte den Antrag: %, %, %, %', v_response, v_status, v_revision, v_count;
  end if;

  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_no_app, 'vote', 'NO', 'reasonInternal', 'Interner Ablehnungsgrund', 'expectedRevision', 3));
  select status, decision_reason_internal into v_status, v_reason from app_fanclub.membership_applications where id = v_no_app;
  if v_status <> 'REJECTED' or v_reason <> 'Interner Ablehnungsgrund'
     or v_response #>> '{data,applicantNotice}' is not null then
    raise exception 'Dritte NO mit Grund entschied nicht korrekt: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_response := public.pd_api('membership_application_manual_decide', jsonb_build_object('id', v_early_app, 'decision', 'APPROVED', 'reasonInternal', 'Noch zu frueh', 'expectedRevision', 1));
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_SEVEN_DAY_PERIOD_NOT_REACHED' then
    raise exception '7-Tage-Aktion vor Frist wurde nicht abgewiesen: %', v_response;
  end if;

  v_response := public.pd_api('membership_application_manual_decide', jsonb_build_object('id', v_manual_app, 'decision', 'APPROVED', 'expectedRevision', 1));
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_MANUAL_DECISION_REASON_REQUIRED' then
    raise exception 'Manueller Grund war nicht Pflicht: %', v_response;
  end if;

  v_response := public.pd_api('membership_application_manual_decide', jsonb_build_object('id', v_manual_app, 'decision', 'APPROVED', 'reasonInternal', 'Sieben Kalendertage erreicht', 'applicantNotice', 'Aufnahme beschlossen', 'expectedRevision', 1));
  select status, decision_method, revision into v_status, v_method, v_revision from app_fanclub.membership_applications where id = v_manual_app;
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_status <> 'APPROVED' or v_method <> 'SEVEN_DAY_MANUAL' or v_revision <> 2 then
    raise exception '7-Tage-Aktion nach Frist fehlgeschlagen: %', v_response;
  end if;

  v_response := public.pd_api('membership_application_manual_decide', jsonb_build_object('id', v_yes_app, 'decision', 'REJECTED', 'reasonInternal', 'Nicht ueberschreiben', 'expectedRevision', 4));
  select status, decision_method into v_status, v_method from app_fanclub.membership_applications where id = v_yes_app;
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_status <> 'APPROVED' or v_method <> 'VOTE_MAJORITY' then
    raise exception 'Mehrheitsentscheidung wurde manuell ueberschrieben: %', v_response;
  end if;

  update app_fanclub.office_slots
  set member_id = v_m6
  where code = 'VORSTAND_1';
  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  v_response := public.pd_api(
    'membership_application_vote',
    jsonb_build_object('id', v_roster_before_vote_app, 'vote', 'YES', 'expectedRevision', 1)
  );
  select status, revision
  into v_status, v_revision
  from app_fanclub.membership_applications
  where id = v_roster_before_vote_app;
  select count(*)
  into v_count
  from app_fanclub.membership_application_votes
  where application_id = v_roster_before_vote_app;
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_BOARD_ROSTER_CHANGED'
     or v_status <> 'PENDING'
     or v_revision <> 1
     or v_count <> 0
     or app_private.m150_seven_day_available(v_roster_before_vote_app) then
    raise exception 'Wechsel vor erster Stimme wurde nicht mutationsfrei blockiert: %, %, %, %',
      v_response, v_status, v_revision, v_count;
  end if;
  update app_fanclub.office_slots
  set member_id = v_m1
  where code = 'VORSTAND_1';

  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_response := public.pd_api(
    'membership_application_vote',
    jsonb_build_object('id', v_roster_non_voter_app, 'vote', 'YES', 'expectedRevision', 1)
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Normaler Vote vor Nicht-Voter-Wechsel fehlgeschlagen: %', v_response;
  end if;
  update app_fanclub.office_slots
  set member_id = v_m6
  where code = 'SCHRIFTFUEHRER';
  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  v_response := public.pd_api(
    'membership_application_vote',
    jsonb_build_object('id', v_roster_non_voter_app, 'vote', 'YES', 'expectedRevision', 2)
  );
  select status, revision
  into v_status, v_revision
  from app_fanclub.membership_applications
  where id = v_roster_non_voter_app;
  select count(*)
  into v_count
  from app_fanclub.membership_application_votes
  where application_id = v_roster_non_voter_app;
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_BOARD_ROSTER_CHANGED'
     or v_status <> 'PENDING'
     or v_revision <> 2
     or v_count <> 1 then
    raise exception 'Wechsel eines Nicht-Voters wurde nicht mutationsfrei blockiert: %, %, %, %',
      v_response, v_status, v_revision, v_count;
  end if;
  update app_fanclub.office_slots
  set member_id = v_m5
  where code = 'SCHRIFTFUEHRER';

  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_response := public.pd_api(
    'membership_application_vote',
    jsonb_build_object('id', v_incomplete_snapshot_app, 'vote', 'YES', 'expectedRevision', 1)
  );
  select status, revision
  into v_status, v_revision
  from app_fanclub.membership_applications
  where id = v_incomplete_snapshot_app;
  select count(*)
  into v_count
  from app_fanclub.membership_application_votes
  where application_id = v_incomplete_snapshot_app;
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_BOARD_SNAPSHOT_INCOMPLETE'
     or v_status <> 'PENDING'
     or v_revision <> 1
     or v_count <> 0
     or app_private.m150_seven_day_available(v_incomplete_snapshot_app)
     or (select count(*)
         from app_fanclub.membership_application_board_roster as roster
         where roster.application_id = v_incomplete_snapshot_app) <> 4 then
    raise exception 'Unvollstaendiger Eingangssnapshot wurde nicht dauerhaft blockiert: %, %, %, %',
      v_response, v_status, v_revision, v_count;
  end if;

  update app_fanclub.office_slots set member_id = null where code = 'SCHRIFTFUEHRER';
  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_incomplete_app, 'vote', 'YES', 'expectedRevision', 1));
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_BOARD_INCOMPLETE' then
    raise exception 'Unvollstaendiger Vorstand erzeugte keinen STOP-Fehler: %', v_response;
  end if;
  update app_fanclub.office_slots set member_id = v_m5 where code = 'SCHRIFTFUEHRER';

  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_roster_app, 'vote', 'YES', 'expectedRevision', 1));
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Roster-Test Erststimme fehlgeschlagen: %', v_response;
  end if;
  update app_fanclub.office_slots set member_id = v_m6 where code = 'VORSTAND_1';
  perform set_config('request.jwt.claim.sub', v_u2::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u2, 'role', 'authenticated')::text, true);
  v_response := public.pd_api('membership_application_vote', jsonb_build_object('id', v_roster_app, 'vote', 'YES', 'expectedRevision', 2));
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_BOARD_ROSTER_CHANGED' then
    raise exception 'Board-Roster-Wechsel erzeugte keinen STOP-Fehler: %', v_response;
  end if;
  update app_fanclub.office_slots set member_id = v_m1 where code = 'VORSTAND_1';

  begin
    update app_fanclub.membership_application_votes
    set vote = 'NO'
    where application_id = v_roster_app and voter_user_id = v_u1;
    raise exception 'Bestehende Vote konnte geaendert werden.';
  exception when sqlstate '22000' then null;
  end;

  if (select count(*) from app_fanclub.members) <> v_members_before
     or (select count(*) from app_portal.access_requests) <> v_access_before
     or (select count(*) from app_fanclub.finance_accounts) <> v_accounts_before
     or (select count(*) from app_fanclub.finance_entries) <> v_entries_before
     or (select count(*) from app_fanclub.contribution_payment_reports) <> v_reports_before then
    raise exception 'M150 veraenderte Members, Access Requests oder Finance.';
  end if;

  if not exists (
    select 1 from app_portal.audit_events
    where entity_type = 'membership_application'
      and action = 'MEMBERSHIP_APPLICATION_VOTE_CAST'
  ) or not exists (
    select 1 from app_portal.audit_events
    where entity_type = 'membership_application'
      and action = 'MEMBERSHIP_APPLICATION_AUTO_APPROVED'
  ) or not exists (
    select 1 from app_portal.audit_events
    where entity_type = 'membership_application'
      and action = 'MEMBERSHIP_APPLICATION_AUTO_REJECTED'
  ) or not exists (
    select 1 from app_portal.audit_events
    where entity_type = 'membership_application'
      and action = 'MEMBERSHIP_APPLICATION_SEVEN_DAY_DECIDED'
      and metadata ->> 'sevenDayDecision' = 'true'
  ) then
    raise exception 'M150-Audit ist unvollstaendig.';
  end if;

  v_response := public.pd_api('events_list', '{}'::jsonb);
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'M210-Regression: events_list ist fehlgeschlagen: %', v_response;
  end if;
end
$m150_verification$;

select pass('PORTAL_CORE_STRUCTURE_OK - M150 F1.2A contract');
select * from finish();

rollback;
