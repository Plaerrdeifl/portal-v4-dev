alter table app_fanclub.contribution_payment_reports
  add column reversed_by uuid
  references app_portal.users(id) on delete set null;

alter table app_fanclub.contribution_payment_reports
  add column reversed_at timestamptz;

alter table app_fanclub.contribution_payment_reports
  add column reversal_reason text not null default '';

alter table app_fanclub.contribution_payment_reports
  drop constraint contribution_payment_reports_status_check;

alter table app_fanclub.contribution_payment_reports
  add constraint contribution_payment_reports_status_check
  check (status in ('PENDING', 'CONFIRMED', 'REJECTED', 'REVERSED'));

alter table app_fanclub.contribution_payment_reports
  add constraint contribution_payment_reports_reversal_reason_check
  check (length(reversal_reason) <= 1000);

alter table app_fanclub.finance_entries
  add column operation_id uuid not null
  default extensions.gen_random_uuid();

alter table app_fanclub.finance_entries
  add column counter_account_id uuid
  references app_fanclub.finance_accounts(id) on delete restrict;

alter table app_fanclub.finance_entries
  add column reverses_entry_id uuid
  references app_fanclub.finance_entries(id) on delete restrict;

alter table app_fanclub.finance_entries
  add column reversal_reason text not null default '';

alter table app_fanclub.finance_entries
  add constraint finance_entries_reversal_reason_check
  check (length(reversal_reason) <= 1000);

create unique index finance_entries_one_reversal_idx
  on app_fanclub.finance_entries(reverses_entry_id)
  where reverses_entry_id is not null;

create index finance_entries_operation_idx
  on app_fanclub.finance_entries(operation_id, entry_no);

create or replace function app_private.api_fanclub_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_capability('members.read');
  v_can_read_finance boolean :=
    app_private.has_capability(v_user_id, 'finance.read');
  v_can_manage_finance boolean :=
    app_private.has_capability(v_user_id, 'finance.manage');
begin
  return jsonb_build_object(
    'members', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', member.id,
        'memberCode', member.member_code,
        'firstName', member.first_name,
        'lastName', member.last_name,
        'email', member.email,
        'phone', member.phone,
        'street', member.street,
        'houseNumber', member.house_number,
        'postalCode', member.postal_code,
        'city', member.city,
        'joinedOn', member.joined_on,
        'leftOn', member.left_on,
        'status', member.status,
        'notes', member.notes,
        'revision', member.revision
      ) order by member.last_name, member.first_name), '[]'::jsonb)
      from app_fanclub.members as member
    ),
    'offices', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'code', office.code,
        'label', office.label,
        'sortOrder', office.sort_order,
        'memberId', office.member_id,
        'memberCode', member.member_code,
        'memberName', case
          when member.id is null then ''
          else member.first_name || ' ' || member.last_name
        end,
        'revision', office.revision
      ) order by office.sort_order), '[]'::jsonb)
      from app_fanclub.office_slots as office
      left join app_fanclub.members as member
        on member.id = office.member_id
    ),
    'contributionSeasons', case when v_can_read_finance then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', season.id,
        'code', season.code,
        'name', season.name,
        'startsOn', season.starts_on,
        'endsOn', season.ends_on,
        'active', season.is_active,
        'revision', season.revision
      ) order by season.starts_on desc, season.name), '[]'::jsonb)
      from app_fanclub.contribution_seasons as season
    ) else '[]'::jsonb end,
    'contributionClasses', case when v_can_read_finance then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', contribution_class.id,
        'code', contribution_class.code,
        'name', contribution_class.name,
        'amount', contribution_class.amount,
        'active', contribution_class.is_active,
        'revision', contribution_class.revision
      ) order by contribution_class.name), '[]'::jsonb)
      from app_fanclub.contribution_classes as contribution_class
    ) else '[]'::jsonb end,
    'financeAccounts', case when v_can_read_finance then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', account.id,
        'code', account.code,
        'name', account.name,
        'accountType', account.account_type,
        'active', account.is_active,
        'balance', coalesce((
          select sum(case entry.entry_type
            when 'INCOME' then entry.amount
            else -entry.amount
          end)
          from app_fanclub.finance_entries as entry
          where entry.account_id = account.id
        ), 0),
        'used',
          exists (
            select 1
            from app_fanclub.finance_entries as entry
            where entry.account_id = account.id
          )
          or exists (
            select 1
            from app_fanclub.contribution_payment_reports as report
            where report.account_id = account.id
          ),
        'canDelete',
          v_can_manage_finance
          and account.code <> 'KASSE'
          and not exists (
            select 1
            from app_fanclub.finance_entries as entry
            where entry.account_id = account.id
          )
          and not exists (
            select 1
            from app_fanclub.contribution_payment_reports as report
            where report.account_id = account.id
          ),
        'revision', account.revision
      ) order by account.name), '[]'::jsonb)
      from app_fanclub.finance_accounts as account
    ) else '[]'::jsonb end,
    'memberContributions', case when v_can_read_finance then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', contribution.id,
        'seasonId', contribution.season_id,
        'memberId', contribution.member_id,
        'memberCode', member.member_code,
        'memberName', member.first_name || ' ' || member.last_name,
        'contributionClassId', contribution.contribution_class_id,
        'contributionClassName', contribution_class.name,
        'amountDue', contribution.amount_due,
        'paidAmount', payment.paid_amount,
        'pendingAmount', payment.pending_amount,
        'openAmount', greatest(
          contribution.amount_due - payment.paid_amount,
          0
        ),
        'reportableAmount', greatest(
          contribution.amount_due
          - payment.paid_amount
          - payment.pending_amount,
          0
        ),
        'notes', contribution.notes,
        'revision', contribution.revision
      ) order by member.last_name, member.first_name), '[]'::jsonb)
      from app_fanclub.member_contributions as contribution
      join app_fanclub.members as member
        on member.id = contribution.member_id
      join app_fanclub.contribution_classes as contribution_class
        on contribution_class.id = contribution.contribution_class_id
      left join lateral (
        select
          coalesce(sum(report.amount) filter (
            where report.status = 'CONFIRMED'
          ), 0) as paid_amount,
          coalesce(sum(report.amount) filter (
            where report.status = 'PENDING'
          ), 0) as pending_amount
        from app_fanclub.contribution_payment_reports as report
        where report.member_contribution_id = contribution.id
      ) as payment on true
    ) else '[]'::jsonb end,
    'contributionPaymentReports', case when v_can_read_finance then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', report.id,
        'memberContributionId', report.member_contribution_id,
        'seasonId', contribution.season_id,
        'memberId', contribution.member_id,
        'memberCode', member.member_code,
        'memberName', member.first_name || ' ' || member.last_name,
        'amount', report.amount,
        'accountId', report.account_id,
        'accountName', account.name,
        'paymentMethod', report.payment_method,
        'paymentMethodLabel', case report.payment_method
          when 'CASH' then 'Bar'
          when 'BANK' then 'Bank'
          when 'PAYPAL' then 'PayPal'
          else 'Sonstiges'
        end,
        'paidOn', report.paid_on,
        'status', report.status,
        'reportedBy', report.reported_by,
        'reportedByName',
          reporter.first_name || ' ' || reporter.last_name,
        'reportedAt', report.reported_at,
        'reviewedBy', report.reviewed_by,
        'reviewedByName', case
          when reviewer.id is null then ''
          else reviewer.first_name || ' ' || reviewer.last_name
        end,
        'reviewedAt', report.reviewed_at,
        'rejectionReason', report.rejection_reason,
        'reversedBy', report.reversed_by,
        'reversedByName', case
          when reversed_by.id is null then ''
          else reversed_by.first_name || ' ' || reversed_by.last_name
        end,
        'reversedAt', report.reversed_at,
        'reversalReason', report.reversal_reason,
        'revision', report.revision
      ) order by
        case report.status
          when 'PENDING' then 1
          when 'CONFIRMED' then 2
          else 3
        end,
        report.reported_at desc), '[]'::jsonb)
      from app_fanclub.contribution_payment_reports as report
      join app_fanclub.member_contributions as contribution
        on contribution.id = report.member_contribution_id
      join app_fanclub.members as member
        on member.id = contribution.member_id
      join app_fanclub.finance_accounts as account
        on account.id = report.account_id
      join app_portal.users as reporter
        on reporter.id = report.reported_by
      left join app_portal.users as reviewer
        on reviewer.id = report.reviewed_by
      left join app_portal.users as reversed_by
        on reversed_by.id = report.reversed_by
    ) else '[]'::jsonb end,
    'financeEntries', case when v_can_read_finance then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', entry.id,
        'entryNo', entry.entry_no,
        'operationId', entry.operation_id,
        'accountId', entry.account_id,
        'accountName', account.name,
        'entryType', entry.entry_type,
        'amount', entry.amount,
        'signedAmount', case entry.entry_type
          when 'INCOME' then entry.amount
          else -entry.amount
        end,
        'bookedOn', entry.booked_on,
        'paymentMethod', entry.payment_method,
        'paymentMethodLabel', case entry.payment_method
          when 'CASH' then 'Bar'
          when 'BANK' then 'Bank'
          when 'PAYPAL' then 'PayPal'
          else 'Sonstiges'
        end,
        'description', entry.description,
        'sourceType', entry.source_type,
        'sourceId', entry.source_id,
        'counterAccountId', entry.counter_account_id,
        'counterAccountName', counter_account.name,
        'reversesEntryId', entry.reverses_entry_id,
        'reversalEntryId', reversal.id,
        'isReversed', reversal.id is not null,
        'reversalReason', coalesce(
          nullif(reversal.reversal_reason, ''),
          entry.reversal_reason
        ),
        'createdBy', entry.created_by,
        'createdByName', creator.first_name || ' ' || creator.last_name,
        'createdAt', entry.created_at,
        'canReverse',
          v_can_manage_finance
          and entry.reverses_entry_id is null
          and reversal.id is null
          and entry.source_type <> 'TRANSFER_IN'
      ) order by entry.booked_on desc, entry.entry_no desc), '[]'::jsonb)
      from (
        select *
        from app_fanclub.finance_entries
        order by booked_on desc, entry_no desc
      ) as entry
      join app_fanclub.finance_accounts as account
        on account.id = entry.account_id
      left join app_fanclub.finance_accounts as counter_account
        on counter_account.id = entry.counter_account_id
      join app_portal.users as creator
        on creator.id = entry.created_by
      left join app_fanclub.finance_entries as reversal
        on reversal.reverses_entry_id = entry.id
    ) else '[]'::jsonb end,
    'canManageMembers',
      app_private.has_capability(v_user_id, 'members.manage'),
    'canManageOffices',
      app_private.has_capability(v_user_id, 'offices.manage'),
    'canReadFinance', v_can_read_finance,
    'canManageFinance', v_can_manage_finance,
    'canReportPayments',
      v_can_read_finance
      and app_private.can_report_contribution_payment(v_user_id)
  );
end;
$$;

create or replace function app_private.api_save_finance_account(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('finance.manage');
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_code text := upper(btrim(coalesce(p_payload ->> 'code', '')));
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_account_type text :=
    upper(coalesce(p_payload ->> 'accountType', 'OTHER'));
  v_active boolean :=
    coalesce((p_payload ->> 'active')::boolean, true);
  v_existing app_fanclub.finance_accounts%rowtype;
begin
  if v_code !~ '^[A-Z][A-Z0-9_-]{1,31}$' then
    raise exception 'Der Kontocode ist ungültig.'
      using errcode = '22023';
  end if;

  if length(v_name) < 1 or length(v_name) > 120 then
    raise exception 'Die Kontobezeichnung ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_account_type not in ('CASH', 'BANK', 'PAYPAL', 'OTHER') then
    raise exception 'Der Kontotyp ist ungültig.'
      using errcode = '22023';
  end if;

  if v_id is null then
    insert into app_fanclub.finance_accounts (
      code,
      name,
      account_type,
      is_active,
      created_by
    )
    values (
      v_code,
      v_name,
      v_account_type,
      v_active,
      v_actor
    )
    returning id into v_id;

    perform app_private.log_audit(
      v_actor,
      'FINANCE_ACCOUNT_CREATED',
      'finance_account',
      v_id::text,
      null,
      jsonb_build_object(
        'code', v_code,
        'name', v_name,
        'accountType', v_account_type,
        'active', v_active
      )
    );
  else
    select *
    into v_existing
    from app_fanclub.finance_accounts
    where id = v_id
    for update;

    if v_existing.id is null then
      raise exception 'Konto wurde nicht gefunden.'
        using errcode = 'P0002';
    end if;

    if v_expected_revision is null
       or v_expected_revision <> v_existing.revision then
      raise exception
        'Das Konto wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
        using errcode = '40001';
    end if;

    if v_existing.code = 'KASSE'
       and (
         v_code <> 'KASSE'
         or v_account_type <> 'CASH'
         or not v_active
       ) then
      raise exception
        'Das Standardkonto Kasse muss aktiv bleiben und den Typ Kasse behalten.'
        using errcode = '23514';
    end if;

    update app_fanclub.finance_accounts
    set code = v_code,
        name = v_name,
        account_type = v_account_type,
        is_active = v_active,
        revision = revision + 1
    where id = v_id;

    perform app_private.log_audit(
      v_actor,
      'FINANCE_ACCOUNT_UPDATED',
      'finance_account',
      v_id::text,
      to_jsonb(v_existing),
      jsonb_build_object(
        'code', v_code,
        'name', v_name,
        'accountType', v_account_type,
        'active', v_active,
        'revision', v_existing.revision + 1
      )
    );
  end if;

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_delete_finance_account(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('finance.manage');
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_existing app_fanclub.finance_accounts%rowtype;
begin
  select *
  into v_existing
  from app_fanclub.finance_accounts
  where id = v_id
  for update;

  if v_existing.id is null then
    raise exception 'Konto wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_existing.revision then
    raise exception
      'Das Konto wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if v_existing.code = 'KASSE' then
    raise exception 'Das Standardkonto Kasse kann nicht gelöscht werden.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from app_fanclub.finance_entries
    where account_id = v_id
       or counter_account_id = v_id
  ) or exists (
    select 1
    from app_fanclub.contribution_payment_reports
    where account_id = v_id
  ) then
    raise exception
      'Das Konto wurde bereits verwendet und kann nur deaktiviert werden.'
      using errcode = '23503';
  end if;

  delete from app_fanclub.finance_accounts
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'FINANCE_ACCOUNT_DELETED',
    'finance_account',
    v_id::text,
    to_jsonb(v_existing),
    null
  );

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_create_finance_entry(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('finance.manage');
  v_entry_type text :=
    upper(coalesce(p_payload ->> 'entryType', ''));
  v_account_id uuid := (p_payload ->> 'accountId')::uuid;
  v_amount numeric(12,2) :=
    round(nullif(p_payload ->> 'amount', '')::numeric, 2);
  v_booked_on date :=
    coalesce(nullif(p_payload ->> 'bookedOn', '')::date, current_date);
  v_payment_method text :=
    upper(coalesce(p_payload ->> 'paymentMethod', 'OTHER'));
  v_description text :=
    left(btrim(coalesce(p_payload ->> 'description', '')), 500);
  v_operation_id uuid := extensions.gen_random_uuid();
  v_entry_id uuid;
begin
  if v_entry_type not in ('INCOME', 'EXPENSE') then
    raise exception 'Die Buchungsart ist ungültig.'
      using errcode = '22023';
  end if;

  if v_amount is null or v_amount <= 0 or v_amount > 999999.99 then
    raise exception 'Der Buchungsbetrag ist ungültig.'
      using errcode = '22023';
  end if;

  if v_payment_method not in ('CASH', 'BANK', 'PAYPAL', 'OTHER') then
    raise exception 'Die Zahlungsart ist ungültig.'
      using errcode = '22023';
  end if;

  if length(v_description) < 1 then
    raise exception 'Eine Buchungsbeschreibung ist erforderlich.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from app_fanclub.finance_accounts
    where id = v_account_id
      and is_active
  ) then
    raise exception 'Aktives Konto wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  insert into app_fanclub.finance_entries (
    account_id,
    entry_type,
    amount,
    booked_on,
    payment_method,
    description,
    source_type,
    source_id,
    operation_id,
    created_by
  )
  values (
    v_account_id,
    v_entry_type,
    v_amount,
    v_booked_on,
    v_payment_method,
    v_description,
    case
      when v_entry_type = 'INCOME' then 'FREE_INCOME'
      else 'FREE_EXPENSE'
    end,
    v_operation_id,
    v_operation_id,
    v_actor
  )
  returning id into v_entry_id;

  perform app_private.log_audit(
    v_actor,
    'FINANCE_ENTRY_CREATED',
    'finance_entry',
    v_entry_id::text,
    null,
    jsonb_build_object(
      'entryType', v_entry_type,
      'accountId', v_account_id,
      'amount', v_amount,
      'bookedOn', v_booked_on,
      'paymentMethod', v_payment_method,
      'description', v_description,
      'operationId', v_operation_id
    )
  );

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_transfer_finance(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('finance.manage');
  v_from_account_id uuid := (p_payload ->> 'fromAccountId')::uuid;
  v_to_account_id uuid := (p_payload ->> 'toAccountId')::uuid;
  v_amount numeric(12,2) :=
    round(nullif(p_payload ->> 'amount', '')::numeric, 2);
  v_booked_on date :=
    coalesce(nullif(p_payload ->> 'bookedOn', '')::date, current_date);
  v_description text :=
    left(btrim(coalesce(p_payload ->> 'description', '')), 500);
  v_operation_id uuid := extensions.gen_random_uuid();
begin
  if v_from_account_id = v_to_account_id then
    raise exception 'Quell- und Zielkonto müssen verschieden sein.'
      using errcode = '23514';
  end if;

  if v_amount is null or v_amount <= 0 or v_amount > 999999.99 then
    raise exception 'Der Umbuchungsbetrag ist ungültig.'
      using errcode = '22023';
  end if;

  if length(v_description) < 1 then
    raise exception 'Eine Beschreibung der Umbuchung ist erforderlich.'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from app_fanclub.finance_accounts
    where id in (v_from_account_id, v_to_account_id)
      and is_active
  ) <> 2 then
    raise exception 'Beide Konten müssen aktiv sein.'
      using errcode = '23503';
  end if;

  insert into app_fanclub.finance_entries (
    account_id,
    entry_type,
    amount,
    booked_on,
    payment_method,
    description,
    source_type,
    source_id,
    operation_id,
    counter_account_id,
    created_by
  )
  values
    (
      v_from_account_id,
      'EXPENSE',
      v_amount,
      v_booked_on,
      'OTHER',
      v_description,
      'TRANSFER_OUT',
      v_operation_id,
      v_operation_id,
      v_to_account_id,
      v_actor
    ),
    (
      v_to_account_id,
      'INCOME',
      v_amount,
      v_booked_on,
      'OTHER',
      v_description,
      'TRANSFER_IN',
      v_operation_id,
      v_operation_id,
      v_from_account_id,
      v_actor
    );

  perform app_private.log_audit(
    v_actor,
    'FINANCE_TRANSFER_CREATED',
    'finance_transfer',
    v_operation_id::text,
    null,
    jsonb_build_object(
      'fromAccountId', v_from_account_id,
      'toAccountId', v_to_account_id,
      'amount', v_amount,
      'bookedOn', v_booked_on,
      'description', v_description
    )
  );

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_reverse_finance_entry(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('finance.manage');
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_booked_on date :=
    coalesce(nullif(p_payload ->> 'bookedOn', '')::date, current_date);
  v_reason text :=
    left(btrim(coalesce(p_payload ->> 'reason', '')), 1000);
  v_original app_fanclub.finance_entries%rowtype;
  v_item app_fanclub.finance_entries%rowtype;
  v_report app_fanclub.contribution_payment_reports%rowtype;
  v_reversal_operation uuid := extensions.gen_random_uuid();
  v_transfer_count integer := 0;
begin
  if length(v_reason) < 1 then
    raise exception 'Ein Stornogrund ist erforderlich.'
      using errcode = '22023';
  end if;

  select *
  into v_original
  from app_fanclub.finance_entries
  where id = v_id
  for update;

  if v_original.id is null then
    raise exception 'Buchung wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_original.reverses_entry_id is not null then
    raise exception 'Stornobuchungen können nicht erneut storniert werden.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from app_fanclub.finance_entries
    where reverses_entry_id = v_original.id
  ) then
    raise exception 'Die Buchung wurde bereits storniert.'
      using errcode = '23514';
  end if;

  if v_booked_on < v_original.booked_on then
    raise exception
      'Das Stornodatum darf nicht vor dem ursprünglichen Buchungsdatum liegen.'
      using errcode = '23514';
  end if;

  if v_original.source_type in ('TRANSFER_OUT', 'TRANSFER_IN') then
    for v_item in
      select *
      from app_fanclub.finance_entries
      where operation_id = v_original.operation_id
        and source_type in ('TRANSFER_OUT', 'TRANSFER_IN')
      order by entry_no
      for update
    loop
      v_transfer_count := v_transfer_count + 1;

      if exists (
        select 1
        from app_fanclub.finance_entries
        where reverses_entry_id = v_item.id
      ) then
        raise exception 'Die Umbuchung wurde bereits storniert.'
          using errcode = '23514';
      end if;
    end loop;

    if v_transfer_count <> 2 then
      raise exception 'Die Umbuchung ist unvollständig und kann nicht automatisch storniert werden.'
        using errcode = '23514';
    end if;

    for v_item in
      select *
      from app_fanclub.finance_entries
      where operation_id = v_original.operation_id
        and source_type in ('TRANSFER_OUT', 'TRANSFER_IN')
      order by entry_no
    loop
      insert into app_fanclub.finance_entries (
        account_id,
        entry_type,
        amount,
        booked_on,
        payment_method,
        description,
        source_type,
        source_id,
        operation_id,
        counter_account_id,
        reverses_entry_id,
        reversal_reason,
        created_by
      )
      values (
        v_item.account_id,
        case
          when v_item.entry_type = 'INCOME' then 'EXPENSE'
          else 'INCOME'
        end,
        v_item.amount,
        v_booked_on,
        v_item.payment_method,
        left('Storno: ' || v_item.description, 500),
        case
          when v_item.source_type = 'TRANSFER_OUT'
            then 'REVERSAL_TRANSFER_OUT'
          else 'REVERSAL_TRANSFER_IN'
        end,
        v_reversal_operation,
        v_reversal_operation,
        v_item.counter_account_id,
        v_item.id,
        v_reason,
        v_actor
      );
    end loop;

    perform app_private.log_audit(
      v_actor,
      'FINANCE_TRANSFER_REVERSED',
      'finance_transfer',
      v_original.operation_id::text,
      jsonb_build_object(
        'operationId', v_original.operation_id
      ),
      jsonb_build_object(
        'reversalOperationId', v_reversal_operation,
        'bookedOn', v_booked_on,
        'reason', v_reason
      )
    );
  else
    if v_original.source_type = 'CONTRIBUTION_PAYMENT' then
      select *
      into v_report
      from app_fanclub.contribution_payment_reports
      where id = v_original.source_id
      for update;

      if v_report.id is null or v_report.status <> 'CONFIRMED' then
        raise exception
          'Die zugehörige Beitragszahlung kann nicht mehr storniert werden.'
          using errcode = '23514';
      end if;

      update app_fanclub.contribution_payment_reports
      set status = 'REVERSED',
          reversed_by = v_actor,
          reversed_at = now(),
          reversal_reason = v_reason,
          revision = revision + 1
      where id = v_report.id;
    end if;

    insert into app_fanclub.finance_entries (
      account_id,
      entry_type,
      amount,
      booked_on,
      payment_method,
      description,
      source_type,
      source_id,
      operation_id,
      counter_account_id,
      reverses_entry_id,
      reversal_reason,
      created_by
    )
    values (
      v_original.account_id,
      case
        when v_original.entry_type = 'INCOME' then 'EXPENSE'
        else 'INCOME'
      end,
      v_original.amount,
      v_booked_on,
      v_original.payment_method,
      left('Storno: ' || v_original.description, 500),
      'REVERSAL',
      v_reversal_operation,
      v_reversal_operation,
      v_original.counter_account_id,
      v_original.id,
      v_reason,
      v_actor
    );

    perform app_private.log_audit(
      v_actor,
      'FINANCE_ENTRY_REVERSED',
      'finance_entry',
      v_original.id::text,
      jsonb_build_object(
        'entryType', v_original.entry_type,
        'amount', v_original.amount,
        'accountId', v_original.account_id,
        'sourceType', v_original.source_type
      ),
      jsonb_build_object(
        'reversalOperationId', v_reversal_operation,
        'bookedOn', v_booked_on,
        'reason', v_reason
      )
    );
  end if;

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_tasks_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_active_user();
begin
  return jsonb_build_object(
    'tasks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', task.id,
        'context', task.context_type,
        'teamId', task.team_id,
        'teamName', team.name,
        'title', task.title,
        'description', task.description,
        'priority', task.priority,
        'status', task.status,
        'assignedUserId', task.assigned_user_id,
        'assignedName', assigned.first_name || ' ' || assigned.last_name,
        'assignmentReason', task.assignment_reason,
        'createdBy', task.created_by,
        'createdByName', creator.first_name || ' ' || creator.last_name,
        'createdAt', task.created_at,
        'updatedAt', task.updated_at,
        'completedAt', task.completed_at,
        'completedBy', task.completed_by,
        'archivedAt', task.archived_at,
        'archivedBy', task.archived_by,
        'archivedByName', archived_by.first_name || ' ' || archived_by.last_name,
        'revision', task.revision,
        'canManage', app_private.task_is_manageable(v_user_id, task.id),
        'canChangeStatus',
          task.status in ('OPEN', 'IN_PROGRESS')
          and (
            task.assigned_user_id = v_user_id
            or app_private.task_is_manageable(v_user_id, task.id)
          ),
        'canReopen',
          task.status = 'DONE'
          and app_private.task_can_reopen_or_archive(v_user_id, task.id),
        'canArchive',
          task.status <> 'ARCHIVED'
          and app_private.task_can_reopen_or_archive(v_user_id, task.id),
        'canRestore',
          task.status = 'ARCHIVED'
          and app_private.task_can_reopen_or_archive(v_user_id, task.id),
        'canDeletePermanently',
          task.status = 'ARCHIVED'
          and app_private.has_capability(v_user_id, 'portal.admin'),
        'ownNote', note.content,
        'ownNoteRevision', coalesce(note.revision, 0)
      ) order by
        case task.priority
          when 'URGENT' then 1
          when 'HIGH' then 2
          when 'NORMAL' then 3
          else 4
        end,
        task.updated_at desc), '[]'::jsonb)
      from app_modules.tasks as task
      left join app_portal.teams as team
        on team.id = task.team_id
      left join app_portal.users as assigned
        on assigned.id = task.assigned_user_id
      join app_portal.users as creator
        on creator.id = task.created_by
      left join app_portal.users as archived_by
        on archived_by.id = task.archived_by
      left join app_modules.task_notes as note
        on note.task_id = task.id
       and note.user_id = v_user_id
      where app_private.task_is_visible(v_user_id, task.id)
    ),
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', team.id,
        'name', team.name,
        'canManage', app_private.can_manage_team(v_user_id, team.id),
        'memberIds', coalesce((
          select jsonb_agg(membership.user_id order by membership.user_id)
          from app_portal.team_memberships as membership
          where membership.team_id = team.id
            and membership.is_active
        ), '[]'::jsonb)
      ) order by team.name), '[]'::jsonb)
      from app_portal.teams as team
      where team.is_active
        and (
          app_private.has_capability(v_user_id, 'tasks.manage')
          or app_private.is_team_member(v_user_id, team.id)
        )
    ),
    'users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', portal_user.id,
        'name', portal_user.first_name || ' ' || portal_user.last_name,
        'isOfficeHolder', app_private.is_office_holder(portal_user.id),
        'officeLabel', coalesce((
          select office.label
          from app_portal.user_member_links as link
          join app_fanclub.office_slots as office
            on office.member_id = link.member_id
          where link.user_id = portal_user.id
          limit 1
        ), '')
      ) order by portal_user.last_name, portal_user.first_name), '[]'::jsonb)
      from app_portal.users as portal_user
      where portal_user.status = 'ACTIVE'
        and (
          app_private.has_capability(v_user_id, 'tasks.manage')
          or portal_user.id = v_user_id
          or exists (
            select 1
            from app_portal.team_memberships as own_membership
            join app_portal.team_memberships as target_membership
              on target_membership.team_id = own_membership.team_id
             and target_membership.user_id = portal_user.id
             and target_membership.is_active
            where own_membership.user_id = v_user_id
              and own_membership.is_active
              and own_membership.team_role in ('LEAD', 'CO_LEAD')
          )
          or app_private.is_office_holder(v_user_id)
        )
    ),
    'canCreateBoard',
      app_private.has_capability(v_user_id, 'tasks.manage')
      or app_private.is_office_holder(v_user_id),
    'canManageAll', app_private.has_capability(v_user_id, 'tasks.manage')
  );
end;
$$;

create or replace function app_private.api_delete_archived_task(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('portal.admin');
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_confirmation text := coalesce(p_payload ->> 'confirmation', '');
  v_task app_modules.tasks%rowtype;
  v_audit_snapshot jsonb;
begin
  if v_confirmation <> 'LÖSCHEN' then
    raise exception
      'Zur endgültigen Löschung muss LÖSCHEN exakt eingegeben werden.'
      using errcode = '22023';
  end if;

  select *
  into v_task
  from app_modules.tasks
  where id = v_id
  for update;

  if v_task.id is null then
    raise exception 'Aufgabe wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_task.status <> 'ARCHIVED' then
    raise exception
      'Nur bereits archivierte Aufgaben können endgültig gelöscht werden.'
      using errcode = '23514';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_task.revision then
    raise exception
      'Die Aufgabe wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  select jsonb_build_object(
    'id', v_task.id,
    'context', v_task.context_type,
    'teamId', v_task.team_id,
    'title', v_task.title,
    'description', v_task.description,
    'priority', v_task.priority,
    'status', v_task.status,
    'assignedUserId', v_task.assigned_user_id,
    'assignmentReason', v_task.assignment_reason,
    'createdBy', v_task.created_by,
    'createdAt', v_task.created_at,
    'updatedAt', v_task.updated_at,
    'completedAt', v_task.completed_at,
    'completedBy', v_task.completed_by,
    'archivedAt', v_task.archived_at,
    'archivedBy', v_task.archived_by,
    'revision', v_task.revision,
    'personalNoteCount', (
      select count(*)
      from app_modules.task_notes as note
      where note.task_id = v_task.id
    )
  )
  into v_audit_snapshot;

  perform app_private.log_audit(
    v_actor,
    'TASK_PERMANENTLY_DELETED',
    'task',
    v_id::text,
    v_audit_snapshot,
    jsonb_build_object('deleted', true)
  );

  delete from app_modules.tasks
  where id = v_id;

  return app_private.api_tasks_snapshot();
end;
$$;

create or replace function app_private.api_teams_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := app_private.require_active_user();
  v_see_all boolean := app_private.has_capability(v_user_id, 'teams.read');
  v_can_manage_all boolean :=
    app_private.has_capability(v_user_id, 'teams.manage');
begin
  return jsonb_build_object(
    'teams', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', team.id,
        'code', team.code,
        'name', team.name,
        'description', team.description,
        'active', team.is_active,
        'revision', team.revision,
        'canManage', app_private.can_manage_team(v_user_id, team.id),
        'taskCount', (
          select count(*)
          from app_modules.tasks as task
          where task.team_id = team.id
        ),
        'activeTaskCount', (
          select count(*)
          from app_modules.tasks as task
          where task.team_id = team.id
            and task.status <> 'ARCHIVED'
        ),
        'archivedTaskCount', (
          select count(*)
          from app_modules.tasks as task
          where task.team_id = team.id
            and task.status = 'ARCHIVED'
        ),
        'canDelete',
          v_can_manage_all
          and not exists (
            select 1
            from app_modules.tasks as task
            where task.team_id = team.id
          ),
        'members', coalesce((
          select jsonb_agg(jsonb_build_object(
            'userId', membership.user_id,
            'userCode', portal_user.user_code,
            'name', portal_user.first_name || ' ' || portal_user.last_name,
            'role', membership.team_role,
            'active', membership.is_active,
            'revision', membership.revision
          ) order by
            case membership.team_role
              when 'LEAD' then 1
              when 'CO_LEAD' then 2
              else 3
            end,
            portal_user.last_name,
            portal_user.first_name)
          from app_portal.team_memberships as membership
          join app_portal.users as portal_user
            on portal_user.id = membership.user_id
          where membership.team_id = team.id
        ), '[]'::jsonb)
      ) order by team.name), '[]'::jsonb)
      from app_portal.teams as team
      where v_see_all
         or app_private.is_team_member(v_user_id, team.id)
    ),
    'users', case
      when v_can_manage_all
        or exists (
          select 1
          from app_portal.team_memberships as own_membership
          where own_membership.user_id = v_user_id
            and own_membership.is_active
            and own_membership.team_role in ('LEAD', 'CO_LEAD')
        ) then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', portal_user.id,
          'userCode', portal_user.user_code,
          'name', portal_user.first_name || ' ' || portal_user.last_name
        ) order by portal_user.last_name, portal_user.first_name), '[]'::jsonb)
        from app_portal.users as portal_user
        where portal_user.status = 'ACTIVE'
      )
      else (
        select coalesce(jsonb_agg(distinct jsonb_build_object(
          'id', portal_user.id,
          'userCode', portal_user.user_code,
          'name', portal_user.first_name || ' ' || portal_user.last_name
        )), '[]'::jsonb)
        from app_portal.team_memberships as own_membership
        join app_portal.team_memberships as membership
          on membership.team_id = own_membership.team_id
         and membership.is_active
        join app_portal.users as portal_user
          on portal_user.id = membership.user_id
         and portal_user.status = 'ACTIVE'
        where own_membership.user_id = v_user_id
          and own_membership.is_active
          and own_membership.team_role in ('LEAD', 'CO_LEAD')
      )
    end,
    'canCreateTeam', v_can_manage_all
  );
end;
$$;

create or replace function app_private.api_delete_team(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('teams.manage');
  v_team_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_before jsonb;
  v_active_task_count integer := 0;
  v_archived_task_count integer := 0;
begin
  if v_team_id is null then
    raise exception 'Team-ID ist erforderlich.'
      using errcode = '22023';
  end if;

  select to_jsonb(team)
  into v_before
  from app_portal.teams as team
  where team.id = v_team_id
  for update;

  if v_before is null then
    raise exception 'Team wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  select
    count(*) filter (where task.status <> 'ARCHIVED')::integer,
    count(*) filter (where task.status = 'ARCHIVED')::integer
  into v_active_task_count, v_archived_task_count
  from app_modules.tasks as task
  where task.team_id = v_team_id;

  if v_active_task_count > 0 then
    raise exception
      'Team kann nicht gelöscht werden: % nicht archivierte und % archivierte Aufgabe(n) sind noch zugeordnet.',
      v_active_task_count,
      v_archived_task_count
      using errcode = '23503';
  end if;

  if v_archived_task_count > 0 then
    raise exception
      'Team kann nicht gelöscht werden: % archivierte Aufgabe(n) sind noch zugeordnet. Diese müssen im Aufgabenarchiv durch einen Admin endgültig gelöscht werden.',
      v_archived_task_count
      using errcode = '23503';
  end if;

  perform app_private.log_audit(
    v_actor,
    'TEAM_DELETED',
    'team',
    v_team_id::text,
    v_before,
    null,
    jsonb_build_object(
      'activeTaskCount', v_active_task_count,
      'archivedTaskCount', v_archived_task_count
    )
  );

  delete from app_portal.teams
  where id = v_team_id;

  return app_private.api_teams_snapshot();
end;
$$;

create table app_portal.profile_change_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null
    references app_portal.users(id) on delete restrict,
  member_id uuid not null
    references app_fanclub.members(id) on delete restrict,
  requested_data jsonb not null,
  reason text not null,
  status text not null default 'PENDING',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references app_portal.users(id) on delete set null,
  decision_reason text not null default '',
  revision integer not null default 1,
  constraint profile_change_requests_status_check
    check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  constraint profile_change_requests_reason_check
    check (length(reason) between 3 and 1000),
  constraint profile_change_requests_decision_reason_check
    check (length(decision_reason) <= 1000)
);

create unique index profile_change_requests_one_pending_user_idx
  on app_portal.profile_change_requests(user_id)
  where status = 'PENDING';

create index profile_change_requests_status_requested_idx
  on app_portal.profile_change_requests(status, requested_at desc);

alter table app_portal.profile_change_requests enable row level security;
revoke all on app_portal.profile_change_requests
from public, anon, authenticated;

alter function app_private.api_bootstrap()
rename to api_bootstrap_before_profile_changes;

create or replace function app_private.api_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_id uuid := auth.uid();
  v_base jsonb := app_private.api_bootstrap_before_profile_changes();
  v_profile jsonb;
begin
  if v_auth_id is null then
    return v_base;
  end if;

  select jsonb_build_object(
    'portal', jsonb_build_object(
      'id', portal_user.id,
      'userCode', portal_user.user_code,
      'email', coalesce(portal_user.email, auth_user.email, ''),
      'firstName', portal_user.first_name,
      'lastName', portal_user.last_name,
      'status', portal_user.status,
      'roleName', role.name
    ),
    'member', case
      when member.id is null then null
      else jsonb_build_object(
        'id', member.id,
        'memberCode', member.member_code,
        'firstName', member.first_name,
        'lastName', member.last_name,
        'email', member.email,
        'phone', member.phone,
        'street', member.street,
        'houseNumber', member.house_number,
        'postalCode', member.postal_code,
        'city', member.city,
        'joinedOn', member.joined_on,
        'leftOn', member.left_on,
        'status', member.status
      )
    end,
    'pendingRequest', (
      select jsonb_build_object(
        'id', request.id,
        'memberId', request.member_id,
        'requestedData', request.requested_data,
        'reason', request.reason,
        'status', request.status,
        'requestedAt', request.requested_at,
        'revision', request.revision
      )
      from app_portal.profile_change_requests as request
      where request.user_id = v_auth_id
        and request.status = 'PENDING'
      order by request.requested_at desc
      limit 1
    )
  )
  into v_profile
  from auth.users as auth_user
  left join app_portal.users as portal_user
    on portal_user.id = auth_user.id
  left join app_portal.portal_roles as role
    on role.id = portal_user.role_id
  left join app_portal.user_member_links as link
    on link.user_id = portal_user.id
  left join app_fanclub.members as member
    on member.id = link.member_id
  where auth_user.id = v_auth_id;

  return v_base || jsonb_build_object(
    'profile',
    coalesce(
      v_profile,
      jsonb_build_object(
        'portal', null,
        'member', null,
        'pendingRequest', null
      )
    )
  );
end;
$$;

create or replace function app_private.api_submit_profile_change_request(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_member_id uuid;
  v_member_payload jsonb := coalesce(p_payload -> 'member', '{}'::jsonb);
  v_reason text := left(btrim(coalesce(p_payload ->> 'reason', '')), 1000);
  v_first_name text;
  v_last_name text;
  v_email text;
  v_phone text;
  v_street text;
  v_house_number text;
  v_postal_code text;
  v_city text;
  v_requested_data jsonb;
  v_existing app_portal.profile_change_requests%rowtype;
  v_request_id uuid;
begin
  select link.member_id
  into v_member_id
  from app_portal.user_member_links as link
  join app_fanclub.members as member
    on member.id = link.member_id
   and member.status = 'ACTIVE'
  where link.user_id = v_actor;

  if v_member_id is null then
    raise exception
      'Für Änderungsanfragen ist eine aktive Mitgliedsverknüpfung erforderlich.'
      using errcode = '42501';
  end if;

  if length(v_reason) < 3 then
    raise exception
      'Bitte gib einen kurzen Grund für die Änderungsanfrage an.'
      using errcode = '22023';
  end if;

  v_first_name := app_private.require_valid_name(
    v_member_payload ->> 'firstName',
    'Vorname'
  );
  v_last_name := app_private.require_valid_name(
    v_member_payload ->> 'lastName',
    'Nachname'
  );
  v_email := left(btrim(coalesce(v_member_payload ->> 'email', '')), 320);
  v_phone := left(btrim(coalesce(v_member_payload ->> 'phone', '')), 80);
  v_street := left(btrim(coalesce(v_member_payload ->> 'street', '')), 160);
  v_house_number :=
    left(btrim(coalesce(v_member_payload ->> 'houseNumber', '')), 40);
  v_postal_code :=
    left(btrim(coalesce(v_member_payload ->> 'postalCode', '')), 20);
  v_city := left(btrim(coalesce(v_member_payload ->> 'city', '')), 160);

  if v_email <> ''
     and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Die angegebene E-Mail-Adresse ist ungültig.'
      using errcode = '22023';
  end if;

  v_requested_data := jsonb_build_object(
    'firstName', v_first_name,
    'lastName', v_last_name,
    'email', v_email,
    'phone', v_phone,
    'street', v_street,
    'houseNumber', v_house_number,
    'postalCode', v_postal_code,
    'city', v_city
  );

  select *
  into v_existing
  from app_portal.profile_change_requests
  where user_id = v_actor
    and status = 'PENDING'
  for update;

  if v_existing.id is null then
    insert into app_portal.profile_change_requests (
      user_id,
      member_id,
      requested_data,
      reason
    )
    values (
      v_actor,
      v_member_id,
      v_requested_data,
      v_reason
    )
    returning id into v_request_id;
  else
    update app_portal.profile_change_requests
    set member_id = v_member_id,
        requested_data = v_requested_data,
        reason = v_reason,
        requested_at = now(),
        reviewed_at = null,
        reviewed_by = null,
        decision_reason = '',
        revision = revision + 1
    where id = v_existing.id
    returning id into v_request_id;
  end if;

  perform app_private.log_audit(
    v_actor,
    'PROFILE_CHANGE_REQUEST_SUBMITTED',
    'profile_change_request',
    v_request_id::text,
    case
      when v_existing.id is null then null
      else jsonb_build_object(
        'status', v_existing.status,
        'revision', v_existing.revision
      )
    end,
    jsonb_build_object(
      'status', 'PENDING',
      'memberId', v_member_id,
      'changedFields', jsonb_build_array(
        'firstName',
        'lastName',
        'email',
        'phone',
        'street',
        'houseNumber',
        'postalCode',
        'city'
      )
    )
  );

  return app_private.api_bootstrap();
end;
$$;

alter function app_private.api_admin_snapshot()
rename to api_admin_snapshot_before_profile_changes;

create or replace function app_private.api_admin_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_base jsonb := app_private.api_admin_snapshot_before_profile_changes();
  v_can_review boolean :=
    app_private.has_capability(v_actor, 'portal.admin');
begin
  return v_base || jsonb_build_object(
    'canReviewProfileChanges', v_can_review,
    'profileChangeRequests', case
      when v_can_review then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', request.id,
          'userId', request.user_id,
          'userCode', portal_user.user_code,
          'userName',
            portal_user.first_name || ' ' || portal_user.last_name,
          'memberId', request.member_id,
          'memberCode', member.member_code,
          'currentData', jsonb_build_object(
            'firstName', member.first_name,
            'lastName', member.last_name,
            'email', member.email,
            'phone', member.phone,
            'street', member.street,
            'houseNumber', member.house_number,
            'postalCode', member.postal_code,
            'city', member.city
          ),
          'requestedData', request.requested_data,
          'reason', request.reason,
          'status', request.status,
          'requestedAt', request.requested_at,
          'reviewedAt', request.reviewed_at,
          'reviewedByName', case
            when reviewer.id is null then ''
            else reviewer.first_name || ' ' || reviewer.last_name
          end,
          'decisionReason', request.decision_reason,
          'revision', request.revision
        ) order by
          case request.status
            when 'PENDING' then 1
            when 'APPROVED' then 2
            else 3
          end,
          request.requested_at desc), '[]'::jsonb)
        from app_portal.profile_change_requests as request
        join app_portal.users as portal_user
          on portal_user.id = request.user_id
        join app_fanclub.members as member
          on member.id = request.member_id
        left join app_portal.users as reviewer
          on reviewer.id = request.reviewed_by
      )
      else '[]'::jsonb
    end
  );
end;
$$;

create or replace function app_private.api_review_profile_change_request(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('portal.admin');
  v_id uuid := (p_payload ->> 'id')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_decision text := upper(coalesce(p_payload ->> 'decision', ''));
  v_reason text :=
    left(btrim(coalesce(p_payload ->> 'reason', '')), 1000);
  v_request app_portal.profile_change_requests%rowtype;
  v_data jsonb;
begin
  if v_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'Die Prüfentscheidung ist ungültig.'
      using errcode = '22023';
  end if;

  if v_decision = 'REJECTED' and length(v_reason) < 3 then
    raise exception 'Für die Ablehnung ist eine Begründung erforderlich.'
      using errcode = '22023';
  end if;

  select *
  into v_request
  from app_portal.profile_change_requests
  where id = v_id
  for update;

  if v_request.id is null then
    raise exception 'Änderungsanfrage wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_request.status <> 'PENDING' then
    raise exception 'Die Änderungsanfrage wurde bereits bearbeitet.'
      using errcode = '23514';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_request.revision then
    raise exception
      'Die Änderungsanfrage wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  v_data := v_request.requested_data;

  if v_decision = 'APPROVED' then
    update app_fanclub.members
    set first_name = app_private.require_valid_name(
          v_data ->> 'firstName',
          'Vorname'
        ),
        last_name = app_private.require_valid_name(
          v_data ->> 'lastName',
          'Nachname'
        ),
        email = left(btrim(coalesce(v_data ->> 'email', '')), 320),
        phone = left(btrim(coalesce(v_data ->> 'phone', '')), 80),
        street = left(btrim(coalesce(v_data ->> 'street', '')), 160),
        house_number =
          left(btrim(coalesce(v_data ->> 'houseNumber', '')), 40),
        postal_code =
          left(btrim(coalesce(v_data ->> 'postalCode', '')), 20),
        city = left(btrim(coalesce(v_data ->> 'city', '')), 160),
        revision = revision + 1
    where id = v_request.member_id;
  end if;

  update app_portal.profile_change_requests
  set status = v_decision,
      reviewed_at = now(),
      reviewed_by = v_actor,
      decision_reason = v_reason,
      revision = revision + 1
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    case
      when v_decision = 'APPROVED'
        then 'PROFILE_CHANGE_REQUEST_APPROVED'
      else 'PROFILE_CHANGE_REQUEST_REJECTED'
    end,
    'profile_change_request',
    v_id::text,
    jsonb_build_object(
      'status', v_request.status,
      'revision', v_request.revision
    ),
    jsonb_build_object(
      'status', v_decision,
      'memberId', v_request.member_id,
      'reason', v_reason,
      'changedFields', jsonb_build_array(
        'firstName',
        'lastName',
        'email',
        'phone',
        'street',
        'houseNumber',
        'postalCode',
        'city'
      ),
      'revision', v_request.revision + 1
    )
  );

  return app_private.api_admin_snapshot();
end;
$$;

create or replace function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  case v_action
    when 'bootstrap' then
      v_data := app_private.api_bootstrap();
    when 'submit_access_request' then
      v_data := app_private.api_submit_access_request(coalesce(p_payload, '{}'::jsonb));
    when 'claim_initial_admin' then
      v_data := app_private.api_claim_initial_admin(coalesce(p_payload, '{}'::jsonb));
    when 'update_profile' then
      v_data := app_private.api_update_profile(coalesce(p_payload, '{}'::jsonb));
    when 'submit_profile_change_request' then
      v_data := app_private.api_submit_profile_change_request(coalesce(p_payload, '{}'::jsonb));
    when 'dashboard' then
      v_data := app_private.api_dashboard();
    when 'admin_snapshot' then
      v_data := app_private.api_admin_snapshot();
    when 'member_match' then
      v_data := app_private.api_member_match(coalesce(p_payload, '{}'::jsonb));
    when 'save_role' then
      v_data := app_private.api_save_role(coalesce(p_payload, '{}'::jsonb));
    when 'delete_role' then
      v_data := app_private.api_delete_role(coalesce(p_payload, '{}'::jsonb));
    when 'set_role_capabilities' then
      v_data := app_private.api_set_role_capabilities(coalesce(p_payload, '{}'::jsonb));
    when 'save_user' then
      v_data := app_private.api_save_user(coalesce(p_payload, '{}'::jsonb));
    when 'approve_request' then
      v_data := app_private.api_approve_request(coalesce(p_payload, '{}'::jsonb));
    when 'reject_request' then
      v_data := app_private.api_reject_request(coalesce(p_payload, '{}'::jsonb));
    when 'review_profile_change_request' then
      v_data := app_private.api_review_profile_change_request(coalesce(p_payload, '{}'::jsonb));
    when 'fanclub_snapshot' then
      v_data := app_private.api_fanclub_snapshot();
    when 'save_member' then
      v_data := app_private.api_save_member(coalesce(p_payload, '{}'::jsonb));
    when 'save_offices' then
      v_data := app_private.api_save_offices(coalesce(p_payload, '{}'::jsonb));
    when 'save_contribution_season' then
      v_data := app_private.api_save_contribution_season(coalesce(p_payload, '{}'::jsonb));
    when 'save_contribution_class' then
      v_data := app_private.api_save_contribution_class(coalesce(p_payload, '{}'::jsonb));
    when 'save_member_contribution' then
      v_data := app_private.api_save_member_contribution(coalesce(p_payload, '{}'::jsonb));
    when 'report_contribution_payment' then
      v_data := app_private.api_report_contribution_payment(coalesce(p_payload, '{}'::jsonb));
    when 'review_contribution_payment' then
      v_data := app_private.api_review_contribution_payment(coalesce(p_payload, '{}'::jsonb));
    when 'save_finance_account' then
      v_data := app_private.api_save_finance_account(coalesce(p_payload, '{}'::jsonb));
    when 'delete_finance_account' then
      v_data := app_private.api_delete_finance_account(coalesce(p_payload, '{}'::jsonb));
    when 'create_finance_entry' then
      v_data := app_private.api_create_finance_entry(coalesce(p_payload, '{}'::jsonb));
    when 'transfer_finance' then
      v_data := app_private.api_transfer_finance(coalesce(p_payload, '{}'::jsonb));
    when 'reverse_finance_entry' then
      v_data := app_private.api_reverse_finance_entry(coalesce(p_payload, '{}'::jsonb));
    when 'teams_snapshot' then
      v_data := app_private.api_teams_snapshot();
    when 'save_team' then
      v_data := app_private.api_save_team(coalesce(p_payload, '{}'::jsonb));
    when 'delete_team' then
      v_data := app_private.api_delete_team(coalesce(p_payload, '{}'::jsonb));
    when 'save_team_member' then
      v_data := app_private.api_save_team_member(coalesce(p_payload, '{}'::jsonb));
    when 'remove_team_member' then
      v_data := app_private.api_remove_team_member(coalesce(p_payload, '{}'::jsonb));
    when 'tasks_snapshot' then
      v_data := app_private.api_tasks_snapshot();
    when 'save_task' then
      v_data := app_private.api_save_task(coalesce(p_payload, '{}'::jsonb));
    when 'set_task_status' then
      v_data := app_private.api_set_task_status(coalesce(p_payload, '{}'::jsonb));
    when 'archive_task' then
      v_data := app_private.api_archive_task(coalesce(p_payload, '{}'::jsonb));
    when 'restore_task' then
      v_data := app_private.api_restore_task(coalesce(p_payload, '{}'::jsonb));
    when 'delete_archived_task' then
      v_data := app_private.api_delete_archived_task(coalesce(p_payload, '{}'::jsonb));
    when 'save_task_note' then
      v_data := app_private.api_save_task_note(coalesce(p_payload, '{}'::jsonb));
    else
      raise exception 'Unbekannte Portalaktion: %', v_action
        using errcode = '22023';
  end case;

  return jsonb_build_object(
    'ok', true,
    'data', v_data
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', sqlstate,
        'message', sqlerrm
      )
    );
end;
$$;

revoke all on function app_private.api_tasks_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_delete_archived_task(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_teams_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_delete_team(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_bootstrap_before_profile_changes()
from public, anon, authenticated;
revoke all on function app_private.api_bootstrap()
from public, anon, authenticated;
revoke all on function app_private.api_submit_profile_change_request(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_admin_snapshot_before_profile_changes()
from public, anon, authenticated;
revoke all on function app_private.api_admin_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_review_profile_change_request(jsonb)
from public, anon, authenticated;

revoke all on function app_private.api_fanclub_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_save_finance_account(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_delete_finance_account(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_create_finance_entry(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_transfer_finance(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_reverse_finance_entry(jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;
