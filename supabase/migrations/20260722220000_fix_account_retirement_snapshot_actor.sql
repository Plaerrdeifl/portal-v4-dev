-- Runtime-Fix für den Fanclub-Snapshot nach Einführung des Konto-Ruhestands.
-- Verwendet ausschließlich die bereits etablierte Portal-Authentifizierung.

create or replace function app_private.api_fanclub_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('members.read');
  v_base jsonb :=
    app_private.api_fanclub_snapshot_before_account_retirement();
  v_is_admin boolean :=
    app_private.has_capability(v_actor, 'portal.admin');
  v_accounts jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'canDelete',
        v_is_admin
        and account.code <> 'KASSE'
        and not account.is_active
        and coalesce((
          select sum(case entry.entry_type
            when 'INCOME' then entry.amount
            else -entry.amount
          end)
          from app_fanclub.finance_entries as entry
          where entry.account_id = account.id
        ), 0) = 0
        and not exists (
          select 1
          from app_fanclub.contribution_payment_reports as report
          where report.account_id = account.id
            and report.status = 'PENDING'
        )
    )
    order by
      account.sort_position,
      lower(account.name),
      account.id
  ), '[]'::jsonb)
  into v_accounts
  from jsonb_array_elements(
    coalesce(v_base -> 'financeAccounts', '[]'::jsonb)
  ) as item
  join app_fanclub.finance_accounts as account
    on account.id = (item ->> 'id')::uuid
  where account.retired_at is null;

  return jsonb_set(
    v_base,
    '{financeAccounts}',
    v_accounts,
    true
  );
end;
$$;

revoke all on function app_private.api_fanclub_snapshot()
from public, anon, authenticated;
