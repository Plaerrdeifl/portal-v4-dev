-- Kompakte Portalabläufe R1:
-- Inaktive Konten mit Nullsaldo können durch Portaladmins aus der aktiven
-- Kontoverwaltung entfernt werden. Buchungen und Audit-Historie bleiben erhalten.

alter table app_fanclub.finance_accounts add column retired_at timestamptz;
alter table app_fanclub.finance_accounts add column retired_by uuid references app_portal.users(id) on delete set null;
create index finance_accounts_active_retirement_idx on app_fanclub.finance_accounts(retired_at, is_active, sort_position);

alter function app_private.api_fanclub_snapshot() rename to api_fanclub_snapshot_before_account_retirement;

create or replace function app_private.api_fanclub_snapshot()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_base jsonb := app_private.api_fanclub_snapshot_before_account_retirement();
  v_actor uuid := app_private.current_portal_user_id();
  v_is_admin boolean := app_private.has_capability(v_actor, 'portal.admin');
  v_accounts jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(item || jsonb_build_object(
    'canDelete', v_is_admin and account.code <> 'KASSE' and not account.is_active
      and coalesce((select sum(case entry.entry_type when 'INCOME' then entry.amount else -entry.amount end)
                    from app_fanclub.finance_entries as entry where entry.account_id = account.id), 0) = 0
      and not exists (select 1 from app_fanclub.contribution_payment_reports as report
                      where report.account_id = account.id and report.status = 'PENDING')
  ) order by account.sort_position, lower(account.name), account.id), '[]'::jsonb)
  into v_accounts
  from jsonb_array_elements(coalesce(v_base -> 'financeAccounts', '[]'::jsonb)) as item
  join app_fanclub.finance_accounts as account on account.id = (item ->> 'id')::uuid
  where account.retired_at is null;

  return jsonb_set(v_base, '{financeAccounts}', v_accounts, true);
end;
$$;

create or replace function app_private.api_delete_finance_account(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := app_private.require_capability('portal.admin');
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_expected_revision integer := nullif(p_payload ->> 'revision', '')::integer;
  v_existing app_fanclub.finance_accounts%rowtype;
  v_balance numeric(12,2);
begin
  if v_id is null then raise exception 'Konto fehlt.' using errcode='22023'; end if;
  select * into v_existing from app_fanclub.finance_accounts where id=v_id for update;
  if v_existing.id is null or v_existing.retired_at is not null then raise exception 'Konto wurde nicht gefunden.' using errcode='P0002'; end if;
  if v_expected_revision is null or v_expected_revision <> v_existing.revision then
    raise exception 'Das Konto wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001';
  end if;
  if v_existing.code='KASSE' then raise exception 'Das Standardkonto Kasse kann nicht gelöscht werden.' using errcode='23514'; end if;
  if v_existing.is_active then raise exception 'Das Konto muss vor dem Löschen deaktiviert werden.' using errcode='23514'; end if;
  select coalesce(sum(case entry.entry_type when 'INCOME' then entry.amount else -entry.amount end),0)
    into v_balance from app_fanclub.finance_entries as entry where entry.account_id=v_id;
  if v_balance<>0 then raise exception 'Nur Konten mit einem Kontostand von 0,00 € können gelöscht werden.' using errcode='23514'; end if;
  if exists(select 1 from app_fanclub.contribution_payment_reports where account_id=v_id and status='PENDING') then
    raise exception 'Für dieses Konto existiert noch eine offene Zahlungsmeldung.' using errcode='23514';
  end if;
  update app_fanclub.finance_accounts set retired_at=clock_timestamp(), retired_by=v_actor, is_active=false, revision=revision+1 where id=v_id;
  perform app_private.log_audit(v_actor,'FINANCE_ACCOUNT_RETIRED','finance_account',v_id::text,to_jsonb(v_existing),
    jsonb_build_object('balance',v_balance,'retiredAt',clock_timestamp(),'historyPreserved',true));
  return app_private.api_fanclub_snapshot();
end;
$$;

revoke all on function app_private.api_fanclub_snapshot_before_account_retirement() from public, anon, authenticated;
revoke all on function app_private.api_fanclub_snapshot() from public, anon, authenticated;
revoke all on function app_private.api_delete_finance_account(jsonb) from public, anon, authenticated;
