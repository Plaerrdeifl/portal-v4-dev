-- Portal V4 Phase 2 Abnahme:
-- 1. Abgelehnte und vollständig stornierte Beitragszahlungen bleiben
--    nachvollziehbar, blockieren aber nicht mehr das Entfernen der Zuordnung.
-- 2. Zahlungsmeldungen behalten eigenständige Mitglieds- und Jahressnapshots.

alter table app_fanclub.contribution_payment_reports
  add column season_id_snapshot uuid;

alter table app_fanclub.contribution_payment_reports
  add column member_id_snapshot uuid;

alter table app_fanclub.contribution_payment_reports
  add column member_code_snapshot text not null default '';

alter table app_fanclub.contribution_payment_reports
  add column member_name_snapshot text not null default '';

alter table app_fanclub.contribution_payment_reports
  add column season_name_snapshot text not null default '';

update app_fanclub.contribution_payment_reports as report
set season_id_snapshot = contribution.season_id,
    member_id_snapshot = contribution.member_id,
    member_code_snapshot = coalesce(member.member_code, ''),
    member_name_snapshot = btrim(member.first_name || ' ' || member.last_name),
    season_name_snapshot = season.name
from app_fanclub.member_contributions as contribution
join app_fanclub.members as member
  on member.id = contribution.member_id
join app_fanclub.contribution_seasons as season
  on season.id = contribution.season_id
where contribution.id = report.member_contribution_id;

alter table app_fanclub.contribution_payment_reports
  alter column season_id_snapshot set not null;

alter table app_fanclub.contribution_payment_reports
  alter column member_id_snapshot set not null;

alter table app_fanclub.contribution_payment_reports
  add constraint contribution_payment_reports_member_code_snapshot_check
  check (length(member_code_snapshot) <= 80);

alter table app_fanclub.contribution_payment_reports
  add constraint contribution_payment_reports_member_name_snapshot_check
  check (length(member_name_snapshot) between 1 and 321);

alter table app_fanclub.contribution_payment_reports
  add constraint contribution_payment_reports_season_name_snapshot_check
  check (length(season_name_snapshot) between 1 and 120);

alter table app_fanclub.contribution_payment_reports
  drop constraint if exists contribution_payment_reports_member_contribution_id_fkey;

alter table app_fanclub.contribution_payment_reports
  alter column member_contribution_id drop not null;

alter table app_fanclub.contribution_payment_reports
  add constraint contribution_payment_reports_member_contribution_id_fkey
  foreign key (member_contribution_id)
  references app_fanclub.member_contributions(id)
  on delete set null;

create or replace function app_private.set_contribution_payment_report_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.member_contribution_id is null then
    return new;
  end if;

  select
    contribution.season_id,
    contribution.member_id,
    coalesce(member.member_code, ''),
    btrim(member.first_name || ' ' || member.last_name),
    season.name
  into
    new.season_id_snapshot,
    new.member_id_snapshot,
    new.member_code_snapshot,
    new.member_name_snapshot,
    new.season_name_snapshot
  from app_fanclub.member_contributions as contribution
  join app_fanclub.members as member
    on member.id = contribution.member_id
  join app_fanclub.contribution_seasons as season
    on season.id = contribution.season_id
  where contribution.id = new.member_contribution_id;

  if not found then
    raise exception
      'Beitragszuordnung für die Zahlungsmeldung wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger contribution_payment_reports_set_snapshot
before insert or update of member_contribution_id
on app_fanclub.contribution_payment_reports
for each row
execute function app_private.set_contribution_payment_report_snapshot();

alter function app_private.api_fanclub_snapshot()
rename to api_fanclub_snapshot_before_portal_phase2_acceptance;

create or replace function app_private.api_fanclub_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base jsonb :=
    app_private.api_fanclub_snapshot_before_portal_phase2_acceptance();
  v_reports jsonb := '[]'::jsonb;
  v_can_read_finance boolean :=
    coalesce((v_base ->> 'canReadFinance')::boolean, false);
begin
  if v_can_read_finance then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', report.id,
      'memberContributionId', report.member_contribution_id,
      'seasonId', report.season_id_snapshot,
      'memberId', report.member_id_snapshot,
      'memberCode', report.member_code_snapshot,
      'memberName', report.member_name_snapshot,
      'seasonName', report.season_name_snapshot,
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
        when 'REJECTED' then 3
        else 4
      end,
      report.reported_at desc), '[]'::jsonb)
    into v_reports
    from app_fanclub.contribution_payment_reports as report
    join app_fanclub.finance_accounts as account
      on account.id = report.account_id
    join app_portal.users as reporter
      on reporter.id = report.reported_by
    left join app_portal.users as reviewer
      on reviewer.id = report.reviewed_by
    left join app_portal.users as reversed_by
      on reversed_by.id = report.reversed_by;
  end if;

  return jsonb_set(
    v_base,
    '{contributionPaymentReports}',
    v_reports,
    true
  );
end;
$$;

create or replace function app_private.api_remove_member_contribution(
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
  v_existing app_fanclub.member_contributions%rowtype;
  v_resolved_reports integer := 0;
begin
  if v_id is null then
    raise exception 'Beitragszuordnung fehlt.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_fanclub.member_contributions as contribution
  where contribution.id = v_id
  for update;

  if v_existing.id is null then
    raise exception 'Beitragszuordnung wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision is null
     or v_expected_revision <> v_existing.revision then
    raise exception
      'Die Beitragszuordnung wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if exists (
    select 1
    from app_fanclub.contribution_payment_reports as report
    where report.member_contribution_id = v_id
      and report.status = 'PENDING'
  ) then
    raise exception
      'Für diese Beitragszuordnung gibt es noch eine offene Zahlungsmeldung. Prüfe oder lehne sie zuerst ab.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from app_fanclub.contribution_payment_reports as report
    where report.member_contribution_id = v_id
      and report.status = 'CONFIRMED'
  ) then
    raise exception
      'Für diese Beitragszuordnung besteht noch eine wirksame Buchung. Storniere die Buchung zuerst.'
      using errcode = '23514';
  end if;

  select count(*)
  into v_resolved_reports
  from app_fanclub.contribution_payment_reports as report
  where report.member_contribution_id = v_id
    and report.status in ('REJECTED', 'REVERSED');

  delete from app_fanclub.member_contributions
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'MEMBER_CONTRIBUTION_REMOVED',
    'member_contribution',
    v_id::text,
    to_jsonb(v_existing),
    jsonb_build_object(
      'resolvedPaymentReportsPreserved', v_resolved_reports
    )
  );

  return app_private.api_fanclub_snapshot();
end;
$$;

revoke all on function app_private.set_contribution_payment_report_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_fanclub_snapshot_before_portal_phase2_acceptance()
from public, anon, authenticated;
revoke all on function app_private.api_fanclub_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_remove_member_contribution(jsonb)
from public, anon, authenticated;
