\set ON_ERROR_STOP on

begin;

do $contribution_payment_report_edit$
declare
  v_reporter constant uuid := '00000000-0000-4922-8000-000000000001';
  v_reviewer constant uuid := '00000000-0000-4922-8000-000000000002';
  v_denied constant uuid := '00000000-0000-4922-8000-000000000003';
  v_member constant uuid := '00000000-0000-4922-8000-000000000101';
  v_season constant uuid := '00000000-0000-4922-8000-000000000102';
  v_class constant uuid := '00000000-0000-4922-8000-000000000103';
  v_contribution constant uuid := '00000000-0000-4922-8000-000000000104';
  v_cash constant uuid := '00000000-0000-4922-8000-000000000105';
  v_paypal constant uuid := '00000000-0000-4922-8000-000000000106';
  v_report_id uuid;
  v_second_report_id uuid;
  v_third_report_id uuid;
  v_response jsonb;
begin
  insert into auth.users (id, email)
  values
    (v_reporter, 'contribution-reporter@example.invalid'),
    (v_reviewer, 'contribution-reviewer@example.invalid'),
    (v_denied, 'contribution-denied@example.invalid');

  insert into app_portal.users (
    id, user_code, email, first_name, last_name, status, role_id
  )
  values
    (v_reporter, 'U-CONTRIB-REPORTER', 'contribution-reporter@example.invalid',
      'Vorstand', 'Reporter', 'ACTIVE',
      '00000000-0000-4000-8000-000000000001'),
    (v_reviewer, 'U-CONTRIB-REVIEWER', 'contribution-reviewer@example.invalid',
      'Vorstand', 'Reviewer', 'ACTIVE',
      '00000000-0000-4000-8000-000000000001'),
    (v_denied, 'U-CONTRIB-DENIED', 'contribution-denied@example.invalid',
      'Portal', 'User', 'ACTIVE',
      '00000000-0000-4000-8000-000000000003');

  insert into app_fanclub.members (
    id, member_code, first_name, last_name, status
  )
  values (v_member, 'PD-CONTRIB-1', 'Erika', 'Mustermann', 'ACTIVE');

  insert into app_fanclub.contribution_seasons (
    id, code, name, starts_on, ends_on, is_active, created_by
  )
  values (
    v_season, 'CONTRIB_TEST_2026', 'Beitragstest 2026',
    date '2026-01-01', date '2026-12-31', true, v_reporter
  );

  insert into app_fanclub.contribution_classes (
    id, code, name, amount, is_active, sort_position, created_by
  )
  values (
    v_class, 'CONTRIB_TEST', 'Beitragstest', 100, true, 9900, v_reporter
  );

  insert into app_fanclub.member_contributions (
    id, season_id, member_id, contribution_class_id,
    amount_due, created_by
  )
  values (
    v_contribution, v_season, v_member, v_class, 100, v_reporter
  );

  insert into app_fanclub.finance_accounts (
    id, code, name, account_type, is_active, sort_position, created_by
  )
  values
    (v_cash, 'CONTRIB_CASH', 'Beitragstest Kasse', 'CASH', true, 9900, v_reporter),
    (v_paypal, 'CONTRIB_PAYPAL', 'Beitragstest PayPal', 'PAYPAL', true, 9910, v_reporter);

  perform set_config('request.jwt.claim.sub', v_reporter::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_reporter, 'role', 'authenticated')::text,
    true
  );

  v_response := public.pd_api(
    'report_contribution_payment',
    jsonb_build_object(
      'memberContributionId', v_contribution,
      'amount', 40,
      'accountId', v_cash,
      'paymentMethod', 'CASH',
      'paidOn', '2026-09-10'
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Kasse-Zahlungsmeldung fehlgeschlagen: %', v_response;
  end if;

  select report.id
  into v_report_id
  from app_fanclub.contribution_payment_reports as report
  where report.member_contribution_id = v_contribution
    and report.reported_by = v_reporter
  order by report.reported_at desc
  limit 1;

  perform set_config('request.jwt.claim.sub', v_denied::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_denied, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'update_contribution_payment_report',
    jsonb_build_object(
      'id', v_report_id,
      'revision', 1,
      'amount', 35,
      'accountId', v_paypal,
      'paymentMethod', 'PAYPAL',
      'paidOn', '2026-09-11'
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501'
     or exists (
       select 1 from app_fanclub.contribution_payment_reports
       where id = v_report_id and revision <> 1
     ) then
    raise exception 'Unberechtigter User konnte die Meldung bearbeiten: %', v_response;
  end if;

  v_response := public.pd_api(
    'review_contribution_payment',
    jsonb_build_object(
      'id', v_report_id,
      'revision', 1,
      'decision', 'CONFIRMED',
      'reason', ''
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501' then
    raise exception 'Unberechtigter User konnte die Meldung bestätigen: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_reviewer::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_reviewer, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'update_contribution_payment_report',
    jsonb_build_object(
      'id', v_report_id,
      'revision', 1,
      'amount', 35,
      'accountId', v_paypal,
      'paymentMethod', 'PAYPAL',
      'paidOn', '2026-09-11'
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Bearbeiten der offenen Meldung fehlgeschlagen: %', v_response;
  end if;

  if not exists (
    select 1
    from app_fanclub.contribution_payment_reports as report
    where report.id = v_report_id
      and report.status = 'PENDING'
      and report.amount = 35
      and report.account_id = v_paypal
      and report.payment_method = 'PAYPAL'
      and report.paid_on = date '2026-09-11'
      and report.revision = 2
  ) or exists (
    select 1
    from app_fanclub.finance_entries as entry
    where entry.source_type = 'CONTRIBUTION_PAYMENT'
      and entry.source_id = v_report_id
  ) then
    raise exception 'Bearbeiten hat Werte nicht korrekt gespeichert oder vorzeitig gebucht.';
  end if;

  v_response := public.pd_api(
    'review_contribution_payment',
    jsonb_build_object(
      'id', v_report_id,
      'revision', 2,
      'decision', 'CONFIRMED',
      'reason', ''
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Bestätigen der korrigierten Meldung fehlgeschlagen: %', v_response;
  end if;

  if not exists (
    select 1
    from app_fanclub.finance_entries as entry
    where entry.source_type = 'CONTRIBUTION_PAYMENT'
      and entry.source_id = v_report_id
      and entry.amount = 35
      and entry.account_id = v_paypal
      and entry.payment_method = 'PAYPAL'
      and entry.booked_on = date '2026-09-11'
  ) then
    raise exception 'Finale Buchung hat nicht die korrigierten PayPal-Werte übernommen.';
  end if;

  v_response := public.pd_api(
    'review_contribution_payment',
    jsonb_build_object(
      'id', v_report_id,
      'revision', 3,
      'decision', 'CONFIRMED',
      'reason', ''
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '23514' then
    raise exception 'Doppelte Bestätigung wurde nicht abgefangen: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_reporter::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_reporter, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'report_contribution_payment',
    jsonb_build_object(
      'memberContributionId', v_contribution,
      'amount', 25,
      'accountId', v_cash,
      'paymentMethod', 'CASH',
      'paidOn', '2026-09-12'
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Unbearbeitete Kontrollmeldung fehlgeschlagen: %', v_response;
  end if;

  select report.id
  into v_second_report_id
  from app_fanclub.contribution_payment_reports as report
  where report.member_contribution_id = v_contribution
    and report.status = 'PENDING'
  order by report.reported_at desc
  limit 1;

  perform set_config('request.jwt.claim.sub', v_reviewer::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_reviewer, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'review_contribution_payment',
    jsonb_build_object(
      'id', v_second_report_id,
      'revision', 1,
      'decision', 'CONFIRMED',
      'reason', ''
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or not exists (
       select 1 from app_fanclub.finance_entries
       where source_id = v_second_report_id
         and amount = 25
         and account_id = v_cash
         and payment_method = 'CASH'
         and booked_on = date '2026-09-12'
     ) then
    raise exception 'Unbearbeitete Meldung konnte nicht normal bestätigt werden: %', v_response;
  end if;

  perform set_config('request.jwt.claim.sub', v_reporter::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_reporter, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'report_contribution_payment',
    jsonb_build_object(
      'memberContributionId', v_contribution,
      'amount', 10,
      'accountId', v_cash,
      'paymentMethod', 'CASH',
      'paidOn', '2026-09-13'
    )
  );
  select report.id
  into v_third_report_id
  from app_fanclub.contribution_payment_reports as report
  where report.member_contribution_id = v_contribution
    and report.status = 'PENDING'
  order by report.reported_at desc
  limit 1;

  perform set_config('request.jwt.claim.sub', v_reviewer::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_reviewer, 'role', 'authenticated')::text,
    true
  );
  v_response := public.pd_api(
    'update_contribution_payment_report',
    jsonb_build_object(
      'id', v_third_report_id,
      'revision', 1,
      'amount', 10,
      'accountId', v_paypal,
      'paymentMethod', 'PAYPAL',
      'paidOn', '2026-09-14'
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Revisionstest konnte Meldung nicht vorbereiten: %', v_response;
  end if;

  v_response := public.pd_api(
    'update_contribution_payment_report',
    jsonb_build_object(
      'id', v_third_report_id,
      'revision', 1,
      'amount', 9,
      'accountId', v_cash,
      'paymentMethod', 'CASH',
      'paidOn', '2026-09-15'
    )
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> 'PT409' then
    raise exception 'Veraltete Revision wurde nicht abgefangen: %', v_response;
  end if;
end;
$contribution_payment_report_edit$;

rollback;
