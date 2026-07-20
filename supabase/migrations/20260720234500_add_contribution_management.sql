create table app_fanclub.contribution_seasons (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  constraint contribution_seasons_code_check
    check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$'),
  constraint contribution_seasons_name_check
    check (length(btrim(name)) between 1 and 120),
  constraint contribution_seasons_dates_check
    check (starts_on <= ends_on)
);

create table app_fanclub.contribution_classes (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  amount numeric(12,2) not null,
  is_active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  constraint contribution_classes_code_check
    check (code ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
  constraint contribution_classes_name_check
    check (length(btrim(name)) between 1 and 120),
  constraint contribution_classes_amount_check
    check (amount between 0 and 999999.99)
);

create table app_fanclub.member_contributions (
  id uuid primary key default extensions.gen_random_uuid(),
  season_id uuid not null
    references app_fanclub.contribution_seasons(id) on delete restrict,
  member_id uuid not null
    references app_fanclub.members(id) on delete restrict,
  contribution_class_id uuid not null
    references app_fanclub.contribution_classes(id) on delete restrict,
  amount_due numeric(12,2) not null,
  notes text not null default '',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  unique (season_id, member_id),
  constraint member_contributions_amount_check
    check (amount_due between 0 and 999999.99),
  constraint member_contributions_notes_check
    check (length(notes) <= 1000)
);

create table app_fanclub.finance_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  account_type text not null,
  is_active boolean not null default true,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  constraint finance_accounts_code_check
    check (code ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
  constraint finance_accounts_name_check
    check (length(btrim(name)) between 1 and 120),
  constraint finance_accounts_type_check
    check (account_type in ('CASH', 'BANK', 'PAYPAL', 'OTHER'))
);

create table app_fanclub.contribution_payment_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  member_contribution_id uuid not null
    references app_fanclub.member_contributions(id) on delete restrict,
  amount numeric(12,2) not null,
  account_id uuid not null
    references app_fanclub.finance_accounts(id) on delete restrict,
  payment_method text not null default 'CASH',
  paid_on date not null default current_date,
  status text not null default 'PENDING',
  reported_by uuid not null
    references app_portal.users(id) on delete restrict,
  reported_at timestamptz not null default now(),
  reviewed_by uuid references app_portal.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text not null default '',
  revision integer not null default 1,
  constraint contribution_payment_reports_amount_check
    check (amount > 0 and amount <= 999999.99),
  constraint contribution_payment_reports_method_check
    check (payment_method in ('CASH', 'BANK', 'PAYPAL', 'OTHER')),
  constraint contribution_payment_reports_status_check
    check (status in ('PENDING', 'CONFIRMED', 'REJECTED')),
  constraint contribution_payment_reports_reason_check
    check (length(rejection_reason) <= 1000)
);

create table app_fanclub.finance_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  entry_no bigint generated always as identity unique,
  account_id uuid not null
    references app_fanclub.finance_accounts(id) on delete restrict,
  entry_type text not null,
  amount numeric(12,2) not null,
  booked_on date not null,
  payment_method text not null,
  description text not null,
  source_type text not null,
  source_id uuid not null,
  created_by uuid not null
    references app_portal.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (source_type, source_id),
  constraint finance_entries_type_check
    check (entry_type in ('INCOME', 'EXPENSE')),
  constraint finance_entries_amount_check
    check (amount > 0 and amount <= 999999.99),
  constraint finance_entries_method_check
    check (payment_method in ('CASH', 'BANK', 'PAYPAL', 'OTHER')),
  constraint finance_entries_description_check
    check (length(btrim(description)) between 1 and 500)
);

insert into app_fanclub.finance_accounts (
  id,
  code,
  name,
  account_type
)
values (
  '00000000-0000-4000-8000-000000000101',
  'KASSE',
  'Kasse',
  'CASH'
);

create index member_contributions_season_member_idx
  on app_fanclub.member_contributions(season_id, member_id);
create index contribution_payment_reports_contribution_status_idx
  on app_fanclub.contribution_payment_reports(member_contribution_id, status);
create index contribution_payment_reports_status_reported_idx
  on app_fanclub.contribution_payment_reports(status, reported_at desc);
create index finance_entries_account_booked_idx
  on app_fanclub.finance_entries(account_id, booked_on desc, entry_no desc);

create trigger contribution_seasons_set_updated_at
before update on app_fanclub.contribution_seasons
for each row execute function app_private.set_updated_at();

create trigger contribution_classes_set_updated_at
before update on app_fanclub.contribution_classes
for each row execute function app_private.set_updated_at();

create trigger member_contributions_set_updated_at
before update on app_fanclub.member_contributions
for each row execute function app_private.set_updated_at();

create trigger finance_accounts_set_updated_at
before update on app_fanclub.finance_accounts
for each row execute function app_private.set_updated_at();

alter table app_fanclub.contribution_seasons enable row level security;
alter table app_fanclub.contribution_classes enable row level security;
alter table app_fanclub.member_contributions enable row level security;
alter table app_fanclub.finance_accounts enable row level security;
alter table app_fanclub.contribution_payment_reports enable row level security;
alter table app_fanclub.finance_entries enable row level security;

revoke all on app_fanclub.contribution_seasons from public, anon, authenticated;
revoke all on app_fanclub.contribution_classes from public, anon, authenticated;
revoke all on app_fanclub.member_contributions from public, anon, authenticated;
revoke all on app_fanclub.finance_accounts from public, anon, authenticated;
revoke all on app_fanclub.contribution_payment_reports from public, anon, authenticated;
revoke all on app_fanclub.finance_entries from public, anon, authenticated;
revoke all on sequence app_fanclub.finance_entries_entry_no_seq
from public, anon, authenticated;

create or replace function app_private.can_report_contribution_payment(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.has_capability(p_user_id, 'finance.manage')
    or app_private.is_office_holder(p_user_id);
$$;

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

create or replace function app_private.api_save_contribution_season(
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
  v_starts_on date := nullif(p_payload ->> 'startsOn', '')::date;
  v_ends_on date := nullif(p_payload ->> 'endsOn', '')::date;
  v_active boolean :=
    coalesce((p_payload ->> 'active')::boolean, true);
  v_existing app_fanclub.contribution_seasons%rowtype;
begin
  if v_code !~ '^[A-Z0-9][A-Z0-9_-]{0,31}$' then
    raise exception 'Der Code des Beitragsjahres ist ungültig.'
      using errcode = '22023';
  end if;

  if length(v_name) < 1 or length(v_name) > 120 then
    raise exception 'Die Bezeichnung des Beitragsjahres ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_starts_on is null
     or v_ends_on is null
     or v_starts_on > v_ends_on then
    raise exception 'Der Zeitraum des Beitragsjahres ist ungültig.'
      using errcode = '22023';
  end if;

  if v_id is null then
    insert into app_fanclub.contribution_seasons (
      code,
      name,
      starts_on,
      ends_on,
      is_active,
      created_by
    )
    values (
      v_code,
      v_name,
      v_starts_on,
      v_ends_on,
      v_active,
      v_actor
    )
    returning id into v_id;

    perform app_private.log_audit(
      v_actor,
      'CONTRIBUTION_SEASON_CREATED',
      'contribution_season',
      v_id::text,
      null,
      jsonb_build_object(
        'code', v_code,
        'name', v_name,
        'startsOn', v_starts_on,
        'endsOn', v_ends_on,
        'active', v_active
      )
    );
  else
    select *
    into v_existing
    from app_fanclub.contribution_seasons
    where id = v_id
    for update;

    if v_existing.id is null then
      raise exception 'Beitragsjahr wurde nicht gefunden.'
        using errcode = 'P0002';
    end if;

    if v_expected_revision is null
       or v_expected_revision <> v_existing.revision then
      raise exception
        'Das Beitragsjahr wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
        using errcode = '40001';
    end if;

    update app_fanclub.contribution_seasons
    set code = v_code,
        name = v_name,
        starts_on = v_starts_on,
        ends_on = v_ends_on,
        is_active = v_active,
        revision = revision + 1
    where id = v_id;

    perform app_private.log_audit(
      v_actor,
      'CONTRIBUTION_SEASON_UPDATED',
      'contribution_season',
      v_id::text,
      to_jsonb(v_existing),
      jsonb_build_object(
        'code', v_code,
        'name', v_name,
        'startsOn', v_starts_on,
        'endsOn', v_ends_on,
        'active', v_active,
        'revision', v_existing.revision + 1
      )
    );
  end if;

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_save_contribution_class(
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
  v_amount numeric(12,2) :=
    round(nullif(p_payload ->> 'amount', '')::numeric, 2);
  v_active boolean :=
    coalesce((p_payload ->> 'active')::boolean, true);
  v_existing app_fanclub.contribution_classes%rowtype;
begin
  if v_code !~ '^[A-Z][A-Z0-9_-]{1,31}$' then
    raise exception 'Der Code der Beitragsklasse ist ungültig.'
      using errcode = '22023';
  end if;

  if length(v_name) < 1 or length(v_name) > 120 then
    raise exception 'Die Bezeichnung der Beitragsklasse ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_amount is null
     or v_amount < 0
     or v_amount > 999999.99 then
    raise exception 'Der Beitragsbetrag ist ungültig.'
      using errcode = '22023';
  end if;

  if v_id is null then
    insert into app_fanclub.contribution_classes (
      code,
      name,
      amount,
      is_active,
      created_by
    )
    values (
      v_code,
      v_name,
      v_amount,
      v_active,
      v_actor
    )
    returning id into v_id;

    perform app_private.log_audit(
      v_actor,
      'CONTRIBUTION_CLASS_CREATED',
      'contribution_class',
      v_id::text,
      null,
      jsonb_build_object(
        'code', v_code,
        'name', v_name,
        'amount', v_amount,
        'active', v_active
      )
    );
  else
    select *
    into v_existing
    from app_fanclub.contribution_classes
    where id = v_id
    for update;

    if v_existing.id is null then
      raise exception 'Beitragsklasse wurde nicht gefunden.'
        using errcode = 'P0002';
    end if;

    if v_expected_revision is null
       or v_expected_revision <> v_existing.revision then
      raise exception
        'Die Beitragsklasse wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
        using errcode = '40001';
    end if;

    update app_fanclub.contribution_classes
    set code = v_code,
        name = v_name,
        amount = v_amount,
        is_active = v_active,
        revision = revision + 1
    where id = v_id;

    perform app_private.log_audit(
      v_actor,
      'CONTRIBUTION_CLASS_UPDATED',
      'contribution_class',
      v_id::text,
      to_jsonb(v_existing),
      jsonb_build_object(
        'code', v_code,
        'name', v_name,
        'amount', v_amount,
        'active', v_active,
        'revision', v_existing.revision + 1
      )
    );
  end if;

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_save_member_contribution(
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
  v_season_id uuid := (p_payload ->> 'seasonId')::uuid;
  v_member_id uuid := (p_payload ->> 'memberId')::uuid;
  v_class_id uuid := (p_payload ->> 'contributionClassId')::uuid;
  v_notes text := left(coalesce(p_payload ->> 'notes', ''), 1000);
  v_class app_fanclub.contribution_classes%rowtype;
  v_existing app_fanclub.member_contributions%rowtype;
  v_reserved numeric(12,2);
begin
  if not exists (
    select 1
    from app_fanclub.contribution_seasons
    where id = v_season_id
  ) then
    raise exception 'Beitragsjahr wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from app_fanclub.members
    where id = v_member_id
  ) then
    raise exception 'Mitglied wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  select *
  into v_class
  from app_fanclub.contribution_classes
  where id = v_class_id;

  if v_class.id is null then
    raise exception 'Beitragsklasse wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  if v_id is null then
    if exists (
      select 1
      from app_fanclub.member_contributions
      where season_id = v_season_id
        and member_id = v_member_id
    ) then
      raise exception
        'Für dieses Mitglied existiert bereits eine Beitragszuordnung in diesem Beitragsjahr.'
        using errcode = '23505';
    end if;

    insert into app_fanclub.member_contributions (
      season_id,
      member_id,
      contribution_class_id,
      amount_due,
      notes,
      created_by
    )
    values (
      v_season_id,
      v_member_id,
      v_class_id,
      v_class.amount,
      v_notes,
      v_actor
    )
    returning id into v_id;

    perform app_private.log_audit(
      v_actor,
      'MEMBER_CONTRIBUTION_CREATED',
      'member_contribution',
      v_id::text,
      null,
      jsonb_build_object(
        'seasonId', v_season_id,
        'memberId', v_member_id,
        'contributionClassId', v_class_id,
        'amountDue', v_class.amount
      )
    );
  else
    select *
    into v_existing
    from app_fanclub.member_contributions
    where id = v_id
    for update;

    if v_existing.id is null then
      raise exception 'Beitragszuordnung wurde nicht gefunden.'
        using errcode = 'P0002';
    end if;

    if v_existing.season_id <> v_season_id
       or v_existing.member_id <> v_member_id then
      raise exception
        'Mitglied und Beitragsjahr einer bestehenden Zuordnung dürfen nicht geändert werden.'
        using errcode = '23514';
    end if;

    if v_expected_revision is null
       or v_expected_revision <> v_existing.revision then
      raise exception
        'Die Beitragszuordnung wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
        using errcode = '40001';
    end if;

    select coalesce(sum(report.amount), 0)
    into v_reserved
    from app_fanclub.contribution_payment_reports as report
    where report.member_contribution_id = v_id
      and report.status in ('PENDING', 'CONFIRMED');

    if v_reserved > v_class.amount then
      raise exception
        'Der neue Sollbetrag liegt unter bereits bestätigten oder gemeldeten Zahlungen.'
        using errcode = '23514';
    end if;

    update app_fanclub.member_contributions
    set contribution_class_id = v_class_id,
        amount_due = v_class.amount,
        notes = v_notes,
        revision = revision + 1
    where id = v_id;

    perform app_private.log_audit(
      v_actor,
      'MEMBER_CONTRIBUTION_UPDATED',
      'member_contribution',
      v_id::text,
      to_jsonb(v_existing),
      jsonb_build_object(
        'contributionClassId', v_class_id,
        'amountDue', v_class.amount,
        'revision', v_existing.revision + 1
      )
    );
  end if;

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_report_contribution_payment(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_contribution_id uuid :=
    (p_payload ->> 'memberContributionId')::uuid;
  v_amount numeric(12,2) :=
    round(nullif(p_payload ->> 'amount', '')::numeric, 2);
  v_account_id uuid := (p_payload ->> 'accountId')::uuid;
  v_payment_method text :=
    upper(coalesce(p_payload ->> 'paymentMethod', 'CASH'));
  v_paid_on date :=
    coalesce(nullif(p_payload ->> 'paidOn', '')::date, current_date);
  v_contribution app_fanclub.member_contributions%rowtype;
  v_paid numeric(12,2);
  v_pending numeric(12,2);
  v_report_id uuid;
begin
  if not app_private.can_report_contribution_payment(v_actor) then
    raise exception
      'Nur Amtsinhaber oder Administration dürfen Beitragszahlungen melden.'
      using errcode = '42501';
  end if;

  if v_amount is null or v_amount <= 0 or v_amount > 999999.99 then
    raise exception 'Der Zahlungsbetrag ist ungültig.'
      using errcode = '22023';
  end if;

  if v_payment_method not in ('CASH', 'BANK', 'PAYPAL', 'OTHER') then
    raise exception 'Die Zahlungsart ist ungültig.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from app_fanclub.finance_accounts
    where id = v_account_id
      and is_active
  ) then
    raise exception 'Aktives Zielkonto wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  select *
  into v_contribution
  from app_fanclub.member_contributions
  where id = v_contribution_id
  for update;

  if v_contribution.id is null then
    raise exception 'Beitragszuordnung wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  select
    coalesce(sum(report.amount) filter (
      where report.status = 'CONFIRMED'
    ), 0),
    coalesce(sum(report.amount) filter (
      where report.status = 'PENDING'
    ), 0)
  into v_paid, v_pending
  from app_fanclub.contribution_payment_reports as report
  where report.member_contribution_id = v_contribution_id;

  if v_amount > v_contribution.amount_due - v_paid - v_pending then
    raise exception
      'Der gemeldete Betrag übersteigt den noch meldbaren offenen Beitrag.'
      using errcode = '23514';
  end if;

  insert into app_fanclub.contribution_payment_reports (
    member_contribution_id,
    amount,
    account_id,
    payment_method,
    paid_on,
    reported_by
  )
  values (
    v_contribution_id,
    v_amount,
    v_account_id,
    v_payment_method,
    v_paid_on,
    v_actor
  )
  returning id into v_report_id;

  perform app_private.log_audit(
    v_actor,
    'CONTRIBUTION_PAYMENT_REPORTED',
    'contribution_payment',
    v_report_id::text,
    null,
    jsonb_build_object(
      'memberContributionId', v_contribution_id,
      'amount', v_amount,
      'accountId', v_account_id,
      'paymentMethod', v_payment_method,
      'paidOn', v_paid_on,
      'status', 'PENDING'
    )
  );

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_review_contribution_payment(
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
  v_decision text :=
    upper(coalesce(p_payload ->> 'decision', ''));
  v_reason text :=
    left(btrim(coalesce(p_payload ->> 'reason', '')), 1000);
  v_report app_fanclub.contribution_payment_reports%rowtype;
  v_contribution app_fanclub.member_contributions%rowtype;
  v_paid numeric(12,2);
  v_member_code text;
  v_season_name text;
begin
  if v_decision not in ('CONFIRMED', 'REJECTED') then
    raise exception 'Die Prüfentscheidung ist ungültig.'
      using errcode = '22023';
  end if;

  select *
  into v_report
  from app_fanclub.contribution_payment_reports
  where id = v_id
  for update;

  if v_report.id is null then
    raise exception 'Zahlungsmeldung wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_report.status <> 'PENDING' then
    raise exception 'Die Zahlungsmeldung wurde bereits geprüft.'
      using errcode = '23514';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_report.revision then
    raise exception
      'Die Zahlungsmeldung wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  select *
  into v_contribution
  from app_fanclub.member_contributions
  where id = v_report.member_contribution_id
  for update;

  if v_decision = 'CONFIRMED' then
    select coalesce(sum(report.amount), 0)
    into v_paid
    from app_fanclub.contribution_payment_reports as report
    where report.member_contribution_id = v_contribution.id
      and report.status = 'CONFIRMED';

    if v_paid + v_report.amount > v_contribution.amount_due then
      raise exception
        'Die Bestätigung würde den Sollbetrag überschreiten.'
        using errcode = '23514';
    end if;

    select member.member_code, season.name
    into v_member_code, v_season_name
    from app_fanclub.members as member
    join app_fanclub.contribution_seasons as season
      on season.id = v_contribution.season_id
    where member.id = v_contribution.member_id;

    update app_fanclub.contribution_payment_reports
    set status = 'CONFIRMED',
        reviewed_by = v_actor,
        reviewed_at = now(),
        rejection_reason = '',
        revision = revision + 1
    where id = v_id;

    insert into app_fanclub.finance_entries (
      account_id,
      entry_type,
      amount,
      booked_on,
      payment_method,
      description,
      source_type,
      source_id,
      created_by
    )
    values (
      v_report.account_id,
      'INCOME',
      v_report.amount,
      v_report.paid_on,
      v_report.payment_method,
      'Mitgliedsbeitrag '
        || v_season_name
        || ' · '
        || v_member_code,
      'CONTRIBUTION_PAYMENT',
      v_report.id,
      v_actor
    );
  else
    if length(v_reason) < 1 then
      raise exception 'Für die Ablehnung ist ein Grund erforderlich.'
        using errcode = '22023';
    end if;

    update app_fanclub.contribution_payment_reports
    set status = 'REJECTED',
        reviewed_by = v_actor,
        reviewed_at = now(),
        rejection_reason = v_reason,
        revision = revision + 1
    where id = v_id;
  end if;

  perform app_private.log_audit(
    v_actor,
    case
      when v_decision = 'CONFIRMED'
        then 'CONTRIBUTION_PAYMENT_CONFIRMED'
      else 'CONTRIBUTION_PAYMENT_REJECTED'
    end,
    'contribution_payment',
    v_id::text,
    jsonb_build_object(
      'status', v_report.status,
      'revision', v_report.revision
    ),
    jsonb_build_object(
      'status', v_decision,
      'reason', v_reason,
      'revision', v_report.revision + 1
    )
  );

  return app_private.api_fanclub_snapshot();
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

revoke all on function app_private.can_report_contribution_payment(uuid)
from public, anon, authenticated;
revoke all on function app_private.api_fanclub_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_save_contribution_season(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_contribution_class(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_member_contribution(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_report_contribution_payment(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_review_contribution_payment(jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;
