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
  v_code text;
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_account_type text :=
    upper(coalesce(p_payload ->> 'accountType', 'OTHER'));
  v_active boolean :=
    coalesce((p_payload ->> 'active')::boolean, true);
  v_opening_balance numeric(12,2) :=
    round(coalesce(
      nullif(btrim(coalesce(p_payload ->> 'openingBalance', '')), '')::numeric,
      0
    ), 2);
  v_opening_balance_date date :=
    coalesce(
      nullif(p_payload ->> 'openingBalanceDate', '')::date,
      current_date
    );
  v_existing app_fanclub.finance_accounts%rowtype;
  v_entry_id uuid;
begin
  if length(v_name) < 1 or length(v_name) > 120 then
    raise exception 'Die Kontobezeichnung ist erforderlich.'
      using errcode = '22023';
  end if;

  if v_account_type not in ('CASH', 'BANK', 'PAYPAL', 'OTHER') then
    raise exception 'Der Kontotyp ist ungültig.'
      using errcode = '22023';
  end if;

  if v_opening_balance < -999999.99
     or v_opening_balance > 999999.99 then
    raise exception 'Der Startsaldo ist ungültig.'
      using errcode = '22023';
  end if;

  if v_id is null then
    v_id := extensions.gen_random_uuid();

    loop
      v_code :=
        'KONTO_'
        || upper(substr(
          replace(extensions.gen_random_uuid()::text, '-', ''),
          1,
          10
        ));

      exit when not exists (
        select 1
        from app_fanclub.finance_accounts as account
        where account.code = v_code
      );
    end loop;

    insert into app_fanclub.finance_accounts (
      id,
      code,
      name,
      account_type,
      is_active,
      created_by
    )
    values (
      v_id,
      v_code,
      v_name,
      v_account_type,
      v_active,
      v_actor
    );

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
        'active', v_active,
        'openingBalance', v_opening_balance,
        'openingBalanceDate', v_opening_balance_date
      )
    );

    if v_opening_balance <> 0 then
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
        v_id,
        case
          when v_opening_balance > 0 then 'INCOME'
          else 'EXPENSE'
        end,
        abs(v_opening_balance),
        v_opening_balance_date,
        case v_account_type
          when 'CASH' then 'CASH'
          when 'BANK' then 'BANK'
          when 'PAYPAL' then 'PAYPAL'
          else 'OTHER'
        end,
        'Startsaldo',
        'OPENING_BALANCE',
        v_id,
        v_actor
      )
      returning id into v_entry_id;

      perform app_private.log_audit(
        v_actor,
        'FINANCE_OPENING_BALANCE_CREATED',
        'finance_entry',
        v_entry_id::text,
        null,
        jsonb_build_object(
          'accountId', v_id,
          'amount', v_opening_balance,
          'bookedOn', v_opening_balance_date,
          'sourceType', 'OPENING_BALANCE'
        )
      );
    end if;
  else
    if v_opening_balance <> 0 then
      raise exception
        'Ein Startsaldo kann ausschließlich beim Anlegen eines Kontos erfasst werden.'
        using errcode = '23514';
    end if;

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

    v_code := v_existing.code;

    if v_existing.code = 'KASSE'
       and (
         v_account_type <> 'CASH'
         or not v_active
       ) then
      raise exception
        'Das Standardkonto Kasse muss aktiv bleiben und den Typ Kasse behalten.'
        using errcode = '23514';
    end if;

    update app_fanclub.finance_accounts
    set name = v_name,
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

revoke all on function app_private.api_save_finance_account(jsonb)
from public, anon, authenticated;
