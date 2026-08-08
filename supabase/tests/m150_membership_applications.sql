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

do $m150_conversion_verification$
declare
  v_role_member constant uuid := '00000000-0000-4000-8000-000000000002';
  v_u1 constant uuid := '15000000-0000-4000-8000-000000000001';
  v_u2 constant uuid := '15000000-0000-4000-8000-000000000002';
  v_admin constant uuid := '15000000-0000-4000-8000-000000000099';
  v_stale_office_user constant uuid := '15000000-0000-4000-8000-000000000199';
  v_active_member constant uuid := '15000000-0000-4001-8000-000000000099';
  v_inactive_member constant uuid := '15000000-0000-4001-8000-000000000199';
  v_admin_app constant uuid := '15000000-0000-4002-8000-000000000101';
  v_pending_app constant uuid := '15000000-0000-4002-8000-000000000102';
  v_rejected_app constant uuid := '15000000-0000-4002-8000-000000000103';
  v_withdrawn_app constant uuid := '15000000-0000-4002-8000-000000000104';
  v_new_app constant uuid := '15000000-0000-4002-8000-000000000105';
  v_reactivate_app constant uuid := '15000000-0000-4002-8000-000000000106';
  v_resolve_app constant uuid := '15000000-0000-4002-8000-000000000107';
  v_reactivate_active_app constant uuid := '15000000-0000-4002-8000-000000000108';
  v_resolve_inactive_app constant uuid := '15000000-0000-4002-8000-000000000109';
  v_stale_office_app constant uuid := '15000000-0000-4002-8000-000000000110';
  v_response jsonb;
  v_new_member_id uuid;
  v_members_before bigint;
  v_members_after_new bigint;
  v_access_before bigint;
  v_users_before bigint;
  v_links_before bigint;
  v_offices_before jsonb;
  v_accounts_before bigint;
  v_entries_before bigint;
  v_reports_before bigint;
  v_votes_before bigint;
  v_inactive_before jsonb;
  v_active_before jsonb;
  v_office_member_before uuid;
  v_stale_office_before jsonb;
  v_count bigint;
  v_privilege text;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'app_fanclub'
      and table_name = 'membership_applications'
      and column_name = 'converted_at'
      and data_type = 'timestamp with time zone'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'app_fanclub'
      and table_name = 'membership_applications'
      and column_name = 'converted_by'
      and data_type = 'uuid'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'app_fanclub'
      and table_name = 'membership_applications'
      and column_name = 'converted_member_id'
      and data_type = 'uuid'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'app_fanclub'
      and table_name = 'membership_applications'
      and column_name = 'conversion_mode'
      and data_type = 'text'
  ) then
    raise exception 'Conversion-Felder fehlen oder besitzen falsche Typen.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'app_fanclub.membership_applications'::regclass
      and conname = 'membership_applications_conversion_mode_check'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid = 'app_fanclub.membership_applications'::regclass
      and conname = 'membership_applications_conversion_state_check'
  ) then
    raise exception 'Conversion-Constraints fehlen.';
  end if;

  foreach v_privilege in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
  loop
    if has_table_privilege('anon', 'app_fanclub.membership_applications', v_privilege)
       or has_table_privilege('authenticated', 'app_fanclub.membership_applications', v_privilege)
       or has_table_privilege('anon', 'app_fanclub.members', v_privilege)
       or has_table_privilege('authenticated', 'app_fanclub.members', v_privilege) then
      raise exception 'Browserrolle besitzt direktes Conversion-Tabellenrecht %.', v_privilege;
    end if;
  end loop;

  if has_function_privilege(
       'authenticated',
       'app_private.api_membership_application_convert(jsonb)',
       'EXECUTE'
     ) then
    raise exception 'authenticated darf die private Conversion-Funktion direkt ausfuehren.';
  end if;

  if has_function_privilege('anon', 'public.pd_api(text,jsonb)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE') then
    raise exception 'pd_api-Grant ist nach F1.2B fuer anon/authenticated falsch.';
  end if;

  insert into app_fanclub.members (
    id, member_code, first_name, last_name, birth_date, email, phone,
    street, house_number, postal_code, city, joined_on, left_on, status, notes
  ) values (
    v_inactive_member, 'M-M150-INACTIVE', 'Bestand', 'Unveraendert', date '1980-05-06',
    'bestand@example.invalid', '09999', 'Alte Strasse', '9', '99999', 'Altort',
    date '2010-04-03', date '2020-08-09', 'INACTIVE', 'Interne Bestandsnotiz'
  );

  insert into auth.users (id, email)
  values (v_stale_office_user, 'm150-stale-office@example.invalid');

  insert into app_portal.users (
    id, user_code, email, first_name, last_name, role_id
  ) values (
    v_stale_office_user,
    'U-M150-STALE-OFFICE',
    'm150-stale-office@example.invalid',
    'Stale',
    'Amt',
    v_role_member
  );

  insert into app_portal.user_member_links (user_id, member_id)
  values (v_stale_office_user, v_inactive_member);

  select to_jsonb(member)
  into v_inactive_before
  from app_fanclub.members as member
  where member.id = v_inactive_member;

  select to_jsonb(member)
  into v_active_before
  from app_fanclub.members as member
  where member.id = v_active_member;

  insert into app_fanclub.membership_applications (
    id, first_name, last_name, birth_date, email, phone, street, house_number,
    postal_code, city, applicant_message, status, submitted_at, decided_at,
    decided_by, decision_method, decision_reason_internal, declaration_version,
    statutes_version, statutes_reference, declaration_confirmed, statutes_confirmed
  ) values
    (v_admin_app, 'Admin', 'Versuch', date '1990-01-01', 'admin-convert@example.invalid', '01001', 'A', '1', '10001', 'Ort', null, 'APPROVED', now(), now(), v_u1, 'VOTE_MAJORITY', null, 'D1', 'S1', 'satzung-2026', true, true),
    (v_pending_app, 'Pending', 'Conversion', date '1990-01-02', 'pending-convert@example.invalid', '01002', 'B', '2', '10002', 'Ort', null, 'PENDING', now(), null, null, null, null, 'D1', 'S1', 'satzung-2026', true, true),
    (v_rejected_app, 'Rejected', 'Conversion', date '1990-01-03', 'rejected-convert@example.invalid', '01003', 'C', '3', '10003', 'Ort', null, 'REJECTED', now(), now(), v_u1, 'VOTE_MAJORITY', 'Abgelehnt', 'D1', 'S1', 'satzung-2026', true, true),
    (v_withdrawn_app, 'Withdrawn', 'Conversion', date '1990-01-04', 'withdrawn-convert@example.invalid', '01004', 'D', '4', '10004', 'Ort', null, 'WITHDRAWN', now(), null, null, null, null, 'D1', 'S1', 'satzung-2026', true, true),
    (v_new_app, 'Neu', 'Mitglied', date '1991-02-03', ' M150-MATCH@Example.Invalid ', '+49 170 7654321', 'Neue Strasse', '12a', '86150', 'Augsburg', 'NICHT IN NOTES UEBERNEHMEN', 'APPROVED', timestamptz '2026-01-15 23:30:00+00', now(), v_u1, 'VOTE_MAJORITY', null, 'D1', 'S1', 'satzung-2026', true, true),
    (v_reactivate_app, 'Antrag', 'DarfBestandNichtAendern', date '2001-02-03', 'neu@example.invalid', '01111', 'Neue Daten', '77', '77777', 'Neuort', 'GEHEIM REACTIVATE', 'APPROVED', timestamptz '2026-07-15 22:30:00+00', now(), v_u1, 'VOTE_MAJORITY', null, 'D1', 'S1', 'satzung-2026', true, true),
    (v_resolve_app, 'Anna', 'Antrag', date '1990-02-03', 'm150-match@example.invalid', '+49 170 123456', 'Andere Strasse', '5', '55555', 'Anderswo', 'GEHEIM RESOLVE', 'APPROVED', now(), now(), v_u1, 'VOTE_MAJORITY', null, 'D1', 'S1', 'satzung-2026', true, true),
    (v_reactivate_active_app, 'Active', 'NichtReaktivieren', date '1990-01-08', 'active-reactivate@example.invalid', '01008', 'H', '8', '10008', 'Ort', null, 'APPROVED', now(), now(), v_u1, 'VOTE_MAJORITY', null, 'D1', 'S1', 'satzung-2026', true, true),
    (v_resolve_inactive_app, 'Inactive', 'NichtAufloesen', date '1990-01-09', 'inactive-resolve@example.invalid', '01009', 'I', '9', '10009', 'Ort', null, 'APPROVED', now(), now(), v_u1, 'VOTE_MAJORITY', null, 'D1', 'S1', 'satzung-2026', true, true),
    (v_stale_office_app, 'Stale', 'Office', date '1990-01-10', 'stale-office@example.invalid', '01010', 'J', '10', '10010', 'Ort', null, 'APPROVED', now(), now(), v_u1, 'VOTE_MAJORITY', null, 'D1', 'S1', 'satzung-2026', true, true);

  begin
    update app_fanclub.membership_applications
    set converted_at = now()
    where id = v_pending_app;
    raise exception 'Partielle Conversion-Metadaten wurden akzeptiert.';
  exception when check_violation then null;
  end;

  begin
    update app_fanclub.membership_applications
    set converted_at = now(),
        converted_by = v_u1,
        converted_member_id = v_active_member,
        conversion_mode = 'RESOLVE_EXISTING_ACTIVE'
    where id = v_pending_app;
    raise exception 'PENDING Antrag akzeptierte vollstaendige Conversion-Metadaten.';
  exception when check_violation then null;
  end;

  if exists (
    select 1
    from app_fanclub.membership_applications as application
    where application.id = v_pending_app
      and (
        application.converted_at is not null
        or application.converted_by is not null
        or application.converted_member_id is not null
        or application.conversion_mode is not null
      )
  ) then
    raise exception 'Fehlgeschlagener APPROVED-DB-Constraint hinterliess Conversion-Metadaten.';
  end if;

  select office.member_id
  into v_office_member_before
  from app_fanclub.office_slots as office
  where office.code = 'SCHRIFTFUEHRER';

  update app_fanclub.office_slots
  set member_id = v_inactive_member
  where code = 'SCHRIFTFUEHRER';

  select to_jsonb(office)
  into v_stale_office_before
  from app_fanclub.office_slots as office
  where office.code = 'SCHRIFTFUEHRER';

  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u1, 'role', 'authenticated')::text, true);
  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object(
      'id', v_stale_office_app,
      'expectedRevision', 1,
      'mode', 'REACTIVATE_EXISTING',
      'targetMemberId', v_inactive_member
    )
  );

  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '23514'
     or v_response #>> '{error,message}' <> 'M150_REACTIVATION_OFFICE_ASSIGNMENT_REQUIRES_REVIEW'
     or (select to_jsonb(member) from app_fanclub.members as member where member.id = v_inactive_member) <> v_inactive_before
     or not exists (
       select 1
       from app_fanclub.membership_applications as application
       where application.id = v_stale_office_app
         and application.revision = 1
         and application.converted_at is null
         and application.converted_by is null
         and application.converted_member_id is null
         and application.conversion_mode is null
     )
     or (select to_jsonb(office) from app_fanclub.office_slots as office where office.code = 'SCHRIFTFUEHRER') <> v_stale_office_before
     or exists (
       select 1
       from app_portal.audit_events as audit
       where audit.action = 'MEMBERSHIP_APPLICATION_CONVERTED'
         and audit.entity_id = v_stale_office_app::text
     )
     or exists (
       select 1
       from app_private.m150_current_board() as board
       where board.user_id = v_stale_office_user
     ) then
    raise exception 'Stale Amtszuordnung wurde nicht vollstaendig mutationsfrei blockiert: %', v_response;
  end if;

  update app_fanclub.office_slots
  set member_id = v_office_member_before
  where code = 'SCHRIFTFUEHRER';

  if (select count(*) from app_private.m150_current_board()) <> 5 then
    raise exception 'Vorstandsfixture wurde nach stale Amtszuordnung nicht wiederhergestellt.';
  end if;

  select count(*) into v_members_before from app_fanclub.members;
  select count(*) into v_access_before from app_portal.access_requests;
  select count(*) into v_users_before from app_portal.users;
  select count(*) into v_links_before from app_portal.user_member_links;
  select jsonb_agg(to_jsonb(office) order by office.code)
    into v_offices_before from app_fanclub.office_slots as office;
  select count(*) into v_accounts_before from app_fanclub.finance_accounts;
  select count(*) into v_entries_before from app_fanclub.finance_entries;
  select count(*) into v_reports_before from app_fanclub.contribution_payment_reports;
  select count(*) into v_votes_before from app_fanclub.membership_application_votes;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_admin_app, 'expectedRevision', 1, 'mode', 'NEW_MEMBER')
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or (select count(*) from app_fanclub.members) <> v_members_before
     or (select converted_at from app_fanclub.membership_applications where id = v_admin_app) is not null then
    raise exception 'Admin ohne Amt durfte konvertieren oder erzeugte eine Mutation: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_u1::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_u1, 'role', 'authenticated')::text, true);

  foreach v_response in array array[
    public.pd_api('membership_application_convert', jsonb_build_object('id', v_pending_app, 'expectedRevision', 1, 'mode', 'NEW_MEMBER')),
    public.pd_api('membership_application_convert', jsonb_build_object('id', v_rejected_app, 'expectedRevision', 1, 'mode', 'NEW_MEMBER')),
    public.pd_api('membership_application_convert', jsonb_build_object('id', v_withdrawn_app, 'expectedRevision', 1, 'mode', 'NEW_MEMBER'))
  ]
  loop
    if coalesce((v_response ->> 'ok')::boolean, false)
       or v_response #>> '{error,message}' <> 'M150_CONVERSION_REQUIRES_APPROVED' then
      raise exception 'Nicht-APPROVED Antrag konnte konvertiert werden: %', v_response;
    end if;
  end loop;

  if (select count(*) from app_fanclub.members) <> v_members_before then
    raise exception 'Statusfehler erzeugten Mitgliedsmutationen.';
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_new_app, 'expectedRevision', 99, 'mode', 'NEW_MEMBER')
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_REVISION_CONFLICT'
     or (select count(*) from app_fanclub.members) <> v_members_before then
    raise exception 'Revision Conflict war nicht mutationsfrei: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_new_app, 'expectedRevision', 1, 'mode', 'NEW_MEMBER', 'targetMemberId', v_active_member)
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_NEW_MEMBER_TARGET_FORBIDDEN' then
    raise exception 'NEW_MEMBER akzeptierte targetMemberId: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_reactivate_app, 'expectedRevision', 1, 'mode', 'REACTIVATE_EXISTING')
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_TARGET_MEMBER_REQUIRED' then
    raise exception 'REACTIVATE_EXISTING akzeptierte fehlende targetMemberId: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_resolve_app, 'expectedRevision', 1, 'mode', 'RESOLVE_EXISTING_ACTIVE')
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_TARGET_MEMBER_REQUIRED' then
    raise exception 'RESOLVE_EXISTING_ACTIVE akzeptierte fehlende targetMemberId: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_reactivate_app, 'expectedRevision', 1, 'mode', 'REACTIVATE_EXISTING', 'targetMemberId', 'keine-uuid')
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_INVALID_TARGET_MEMBER_ID' then
    raise exception 'Ungueltige targetMemberId wurde akzeptiert: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object(
      'id', v_reactivate_app,
      'expectedRevision', 1,
      'mode', 'REACTIVATE_EXISTING',
      'targetMemberId', '15000000-0000-4001-8000-000000000999'
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_TARGET_MEMBER_NOT_FOUND' then
    raise exception 'Nicht existente targetMemberId wurde akzeptiert: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_reactivate_active_app, 'expectedRevision', 1, 'mode', 'REACTIVATE_EXISTING', 'targetMemberId', v_active_member)
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_REACTIVATION_REQUIRES_INACTIVE_MEMBER'
     or (select to_jsonb(member) from app_fanclub.members as member where member.id = v_active_member) <> v_active_before then
    raise exception 'ACTIVE Mitglied wurde reaktiviert oder mutiert: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_resolve_inactive_app, 'expectedRevision', 1, 'mode', 'RESOLVE_EXISTING_ACTIVE', 'targetMemberId', v_inactive_member)
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_RESOLUTION_REQUIRES_ACTIVE_MEMBER'
     or (select to_jsonb(member) from app_fanclub.members as member where member.id = v_inactive_member) <> v_inactive_before then
    raise exception 'INACTIVE Mitglied wurde als aktiv aufgeloest oder mutiert: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_new_app, 'expectedRevision', 1, 'mode', 'NEW_MEMBER')
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,conversionMode}' <> 'NEW_MEMBER'
     or v_response #>> '{data,convertedBy}' <> v_u1::text
     or v_response #>> '{data,convertedAt}' is null then
    raise exception 'NEW_MEMBER Conversion fehlgeschlagen: %', v_response;
  end if;

  v_new_member_id := (v_response #>> '{data,convertedMemberId}')::uuid;
  select count(*) into v_members_after_new from app_fanclub.members;
  if v_members_after_new <> v_members_before + 1
     or not exists (
       select 1
       from app_fanclub.members as member
       where member.id = v_new_member_id
         and member.first_name = 'Neu'
         and member.last_name = 'Mitglied'
         and member.birth_date = date '1991-02-03'
         and member.email = ' M150-MATCH@Example.Invalid '
         and member.phone = '+49 170 7654321'
         and member.street = 'Neue Strasse'
         and member.house_number = '12a'
         and member.postal_code = '86150'
         and member.city = 'Augsburg'
         and member.joined_on = date '2026-01-16'
         and member.status = 'ACTIVE'
         and member.left_on is null
         and member.notes = ''
         and member.member_code like 'PD-%'
     ) then
    raise exception 'NEW_MEMBER uebernahm Antrag, Berlin-Datum, Status oder Member-Code-Vertrag nicht korrekt.';
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_new_app, 'expectedRevision', 2, 'mode', 'NEW_MEMBER')
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,message}' <> 'M150_APPLICATION_ALREADY_CONVERTED'
     or (select count(*) from app_fanclub.members) <> v_members_after_new then
    raise exception 'Zweite NEW_MEMBER Conversion war nicht idempotent: %', v_response;
  end if;

  begin
    update app_fanclub.membership_applications
    set status = 'WITHDRAWN',
        decided_at = null,
        decided_by = null,
        decision_method = null,
        decision_reason_internal = null,
        applicant_notice = null
    where id = v_new_app;
    raise exception 'Konvertierter Antrag konnte APPROVED verlassen.';
  exception when check_violation then null;
  end;

  if not exists (
    select 1
    from app_fanclub.membership_applications as application
    where application.id = v_new_app
      and application.status = 'APPROVED'
      and application.revision = 2
      and application.converted_at is not null
      and application.converted_by = v_u1
      and application.converted_member_id = v_new_member_id
      and application.conversion_mode = 'NEW_MEMBER'
  ) then
    raise exception 'Fehlgeschlagener Statuswechsel veraenderte Status oder Conversion-Metadaten.';
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_reactivate_app, 'expectedRevision', 1, 'mode', 'REACTIVATE_EXISTING', 'targetMemberId', v_inactive_member)
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,conversionMode}' <> 'REACTIVATE_EXISTING'
     or (v_response #>> '{data,convertedMemberId}')::uuid <> v_inactive_member
     or not exists (
       select 1
       from app_fanclub.members as member
       where member.id = v_inactive_member
         and member.member_code = v_inactive_before ->> 'member_code'
         and member.first_name = v_inactive_before ->> 'first_name'
         and member.last_name = v_inactive_before ->> 'last_name'
         and member.birth_date = (v_inactive_before ->> 'birth_date')::date
         and member.email = v_inactive_before ->> 'email'
         and member.phone = v_inactive_before ->> 'phone'
         and member.street = v_inactive_before ->> 'street'
         and member.house_number = v_inactive_before ->> 'house_number'
         and member.postal_code = v_inactive_before ->> 'postal_code'
         and member.city = v_inactive_before ->> 'city'
         and member.notes = v_inactive_before ->> 'notes'
         and member.status = 'ACTIVE'
         and member.left_on is null
         and member.joined_on = date '2026-07-16'
     ) then
    raise exception 'REACTIVATE_EXISTING verletzte Identitaet, Member-Code, Stammdaten oder Berlin-Datum: %', v_response;
  end if;

  v_response := public.pd_api(
    'membership_application_convert',
    jsonb_build_object('id', v_resolve_app, 'expectedRevision', 1, 'mode', 'RESOLVE_EXISTING_ACTIVE', 'targetMemberId', v_active_member)
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,conversionMode}' <> 'RESOLVE_EXISTING_ACTIVE'
     or (v_response #>> '{data,convertedMemberId}')::uuid <> v_active_member
     or (select to_jsonb(member) from app_fanclub.members as member where member.id = v_active_member) <> v_active_before then
    raise exception 'RESOLVE_EXISTING_ACTIVE mutierte das Mitglied oder setzte Metadaten nicht: %', v_response;
  end if;

  begin
    update app_fanclub.membership_applications
    set converted_member_id = v_active_member
    where id = v_new_app;
    raise exception 'converted_member_id konnte nach Conversion geaendert werden.';
  exception when sqlstate '22000' then null;
  end;

  begin
    update app_fanclub.membership_applications
    set conversion_mode = 'RESOLVE_EXISTING_ACTIVE'
    where id = v_new_app;
    raise exception 'conversion_mode konnte nach Conversion geaendert werden.';
  exception when sqlstate '22000' then null;
  end;

  begin
    update app_fanclub.membership_applications
    set converted_at = converted_at + interval '1 second'
    where id = v_new_app;
    raise exception 'converted_at konnte nach Conversion geaendert werden.';
  exception when sqlstate '22000' then null;
  end;

  begin
    update app_fanclub.membership_applications
    set converted_by = v_u2
    where id = v_new_app;
    raise exception 'converted_by konnte nach Conversion geaendert werden.';
  exception when sqlstate '22000' then null;
  end;

  if (select count(*) from app_fanclub.members) <> v_members_before + 1
     or (select count(*) from app_portal.access_requests) <> v_access_before
     or (select count(*) from app_portal.users) <> v_users_before
     or (select count(*) from app_portal.user_member_links) <> v_links_before
     or (select jsonb_agg(to_jsonb(office) order by office.code) from app_fanclub.office_slots as office) <> v_offices_before
     or (select count(*) from app_fanclub.finance_accounts) <> v_accounts_before
     or (select count(*) from app_fanclub.finance_entries) <> v_entries_before
     or (select count(*) from app_fanclub.contribution_payment_reports) <> v_reports_before
     or (select count(*) from app_fanclub.membership_application_votes) <> v_votes_before then
    raise exception 'Conversion erzeugte unzulaessige Portal-, Amts-, Finance- oder Vote-Seiteneffekte.';
  end if;

  select count(*)
  into v_count
  from app_portal.audit_events as audit
  where audit.action = 'MEMBERSHIP_APPLICATION_CONVERTED'
    and audit.entity_type = 'membership_application'
    and audit.entity_id in (v_new_app::text, v_reactivate_app::text, v_resolve_app::text)
    and audit.metadata ? 'conversionMode'
    and audit.metadata ? 'memberId'
    and audit.metadata ? 'convertedBy'
    and audit.metadata ? 'convertedAt';
  if v_count <> 3 then
    raise exception 'Conversion-Audit ist unvollstaendig.';
  end if;

  if not exists (
    select 1 from app_portal.audit_events as audit
    where audit.entity_id = v_new_app::text
      and audit.action = 'MEMBERSHIP_APPLICATION_CONVERTED'
      and audit.metadata ->> 'conversionMode' = 'NEW_MEMBER'
      and (audit.metadata ->> 'newMemberCreated')::boolean
      and (audit.metadata ->> 'memberId')::uuid = v_new_member_id
  ) or not exists (
    select 1 from app_portal.audit_events as audit
    where audit.entity_id = v_reactivate_app::text
      and audit.action = 'MEMBERSHIP_APPLICATION_CONVERTED'
      and audit.metadata ->> 'conversionMode' = 'REACTIVATE_EXISTING'
      and audit.metadata ->> 'previousStatus' = 'INACTIVE'
      and (audit.metadata ->> 'previousJoinedOn')::date = date '2010-04-03'
      and (audit.metadata ->> 'previousLeftOn')::date = date '2020-08-09'
  ) or not exists (
    select 1 from app_portal.audit_events as audit
    where audit.entity_id = v_resolve_app::text
      and audit.action = 'MEMBERSHIP_APPLICATION_CONVERTED'
      and audit.metadata ->> 'conversionMode' = 'RESOLVE_EXISTING_ACTIVE'
      and not (audit.metadata ->> 'memberMutationPerformed')::boolean
  ) then
    raise exception 'Modusspezifischer Conversion-Audit ist unvollstaendig.';
  end if;

  if exists (
    select 1
    from app_portal.audit_events as audit
    where audit.action = 'MEMBERSHIP_APPLICATION_CONVERTED'
      and audit.entity_id in (v_new_app::text, v_reactivate_app::text, v_resolve_app::text)
      and lower(
        coalesce(audit.before_data, '{}'::jsonb)::text
        || coalesce(audit.after_data, '{}'::jsonb)::text
        || coalesce(audit.metadata, '{}'::jsonb)::text
      ) ~ '(m150-match@example|neu@example|nicht in notes|geheim reactivate|geheim resolve)'
  ) then
    raise exception 'Conversion-Audit enthaelt vollstaendige Antragspersonendaten.';
  end if;

  v_response := public.pd_api('events_list', '{}'::jsonb);
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'M210-Regression nach F1.2B: events_list ist fehlgeschlagen: %', v_response;
  end if;
end
$m150_conversion_verification$;

select pass('PORTAL_CORE_STRUCTURE_OK - M150 F1.2A/F1.2B contract');
select * from finish();

rollback;
