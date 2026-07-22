-- Phase 2: explizite, serverseitig persistierte Reihenfolge für
-- Beitragsklassen und Finanzkonten.

alter table app_fanclub.contribution_classes
  add column sort_position integer;

with ranked as (
  select
    contribution_class.id,
    (row_number() over (
      order by lower(contribution_class.name), contribution_class.id
    ) * 10)::integer as sort_position
  from app_fanclub.contribution_classes as contribution_class
)
update app_fanclub.contribution_classes as contribution_class
set sort_position = ranked.sort_position
from ranked
where ranked.id = contribution_class.id;

alter table app_fanclub.contribution_classes
  alter column sort_position set not null;

alter table app_fanclub.contribution_classes
  add constraint contribution_classes_sort_position_check
  check (sort_position between 1 and 9999);

create index contribution_classes_sort_position_idx
  on app_fanclub.contribution_classes(sort_position, name, id);

alter table app_fanclub.finance_accounts
  add column sort_position integer;

with ranked as (
  select
    account.id,
    (row_number() over (
      order by
        case when account.code = 'KASSE' then 0 else 1 end,
        lower(account.name),
        account.id
    ) * 10)::integer as sort_position
  from app_fanclub.finance_accounts as account
)
update app_fanclub.finance_accounts as account
set sort_position = ranked.sort_position
from ranked
where ranked.id = account.id;

alter table app_fanclub.finance_accounts
  alter column sort_position set not null;

alter table app_fanclub.finance_accounts
  add constraint finance_accounts_sort_position_check
  check (sort_position between 1 and 9999);

create index finance_accounts_sort_position_idx
  on app_fanclub.finance_accounts(sort_position, name, id);

alter function app_private.api_fanclub_snapshot()
rename to api_fanclub_snapshot_before_phase2_sorting;

create or replace function app_private.api_fanclub_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base jsonb := app_private.api_fanclub_snapshot_before_phase2_sorting();
  v_classes jsonb := '[]'::jsonb;
  v_accounts jsonb := '[]'::jsonb;
begin
  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'position', contribution_class.sort_position,
      'canDelete', not exists (
        select 1
        from app_fanclub.member_contributions as contribution
        where contribution.contribution_class_id = contribution_class.id
      )
    )
    order by
      contribution_class.sort_position,
      lower(contribution_class.name),
      contribution_class.id
  ), '[]'::jsonb)
  into v_classes
  from jsonb_array_elements(
    coalesce(v_base -> 'contributionClasses', '[]'::jsonb)
  ) as item
  join app_fanclub.contribution_classes as contribution_class
    on contribution_class.id = (item ->> 'id')::uuid;

  select coalesce(jsonb_agg(
    item || jsonb_build_object(
      'position', account.sort_position
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
    on account.id = (item ->> 'id')::uuid;

  return jsonb_set(
    jsonb_set(
      v_base,
      '{contributionClasses}',
      v_classes,
      true
    ),
    '{financeAccounts}',
    v_accounts,
    true
  );
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
  v_code text;
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_amount numeric(12,2) :=
    round(nullif(p_payload ->> 'amount', '')::numeric, 2);
  v_active boolean :=
    coalesce((p_payload ->> 'active')::boolean, true);
  v_position integer := nullif(
    btrim(coalesce(p_payload ->> 'position', '')),
    ''
  )::integer;
  v_existing app_fanclub.contribution_classes%rowtype;
begin
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
    if v_position is null then
      select coalesce(max(sort_position), 0) + 10
      into v_position
      from app_fanclub.contribution_classes;
    end if;

    if v_position not between 1 and 9999 then
      raise exception 'Die Position der Beitragsklasse muss zwischen 1 und 9999 liegen.'
        using errcode = '22023';
    end if;

    loop
      v_code := 'BEITRAG_' || upper(substr(
        replace(extensions.gen_random_uuid()::text, '-', ''),
        1,
        16
      ));
      exit when not exists (
        select 1
        from app_fanclub.contribution_classes as contribution_class
        where contribution_class.code = v_code
      );
    end loop;

    insert into app_fanclub.contribution_classes (
      code,
      name,
      amount,
      is_active,
      sort_position,
      created_by
    )
    values (
      v_code,
      v_name,
      v_amount,
      v_active,
      v_position,
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
        'active', v_active,
        'position', v_position
      )
    );
  else
    select *
    into v_existing
    from app_fanclub.contribution_classes as contribution_class
    where contribution_class.id = v_id
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

    v_code := v_existing.code;
    v_position := coalesce(v_position, v_existing.sort_position);

    if v_position not between 1 and 9999 then
      raise exception 'Die Position der Beitragsklasse muss zwischen 1 und 9999 liegen.'
        using errcode = '22023';
    end if;

    update app_fanclub.contribution_classes
    set name = v_name,
        amount = v_amount,
        is_active = v_active,
        sort_position = v_position,
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
        'position', v_position,
        'revision', v_existing.revision + 1
      )
    );
  end if;

  return app_private.api_fanclub_snapshot();
end;
$$;

create or replace function app_private.api_delete_contribution_class(
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
  v_existing app_fanclub.contribution_classes%rowtype;
begin
  if v_id is null then
    raise exception 'Beitragsklasse fehlt.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_fanclub.contribution_classes as contribution_class
  where contribution_class.id = v_id
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

  if exists (
    select 1
    from app_fanclub.member_contributions as contribution
    where contribution.contribution_class_id = v_id
  ) then
    raise exception
      'Die Beitragsklasse wird bereits verwendet und kann nur deaktiviert werden.'
      using errcode = '23503';
  end if;

  delete from app_fanclub.contribution_classes
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'CONTRIBUTION_CLASS_DELETED',
    'contribution_class',
    v_id::text,
    to_jsonb(v_existing),
    null
  );

  return app_private.api_fanclub_snapshot();
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
  v_code text;
  v_name text := btrim(coalesce(p_payload ->> 'name', ''));
  v_account_type text :=
    upper(coalesce(p_payload ->> 'accountType', 'OTHER'));
  v_active boolean :=
    coalesce((p_payload ->> 'active')::boolean, true);
  v_position integer := nullif(
    btrim(coalesce(p_payload ->> 'position', '')),
    ''
  )::integer;
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
    if v_position is null then
      select coalesce(max(sort_position), 0) + 10
      into v_position
      from app_fanclub.finance_accounts;
    end if;

    if v_position not between 1 and 9999 then
      raise exception 'Die Position des Kontos muss zwischen 1 und 9999 liegen.'
        using errcode = '22023';
    end if;

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
      sort_position,
      created_by
    )
    values (
      v_id,
      v_code,
      v_name,
      v_account_type,
      v_active,
      v_position,
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
        'position', v_position,
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
    from app_fanclub.finance_accounts as account
    where account.id = v_id
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
    v_position := coalesce(v_position, v_existing.sort_position);

    if v_position not between 1 and 9999 then
      raise exception 'Die Position des Kontos muss zwischen 1 und 9999 liegen.'
        using errcode = '22023';
    end if;

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
        sort_position = v_position,
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
        'position', v_position,
        'revision', v_existing.revision + 1
      )
    );
  end if;

  return app_private.api_fanclub_snapshot();
end;
$$;

alter function public.pd_api(text, jsonb)
rename to pd_api_before_phase2_sorting;

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
    raise exception 'Anmeldung erforderlich.'
      using errcode = '42501';
  end if;

  if v_action = 'delete_contribution_class' then
    v_data := app_private.api_delete_contribution_class(
      coalesce(p_payload, '{}'::jsonb)
    );
    return jsonb_build_object('ok', true, 'data', v_data);
  end if;

  return public.pd_api_before_phase2_sorting(p_action, p_payload);
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

revoke all on function app_private.api_fanclub_snapshot_before_phase2_sorting()
from public, anon, authenticated;
revoke all on function app_private.api_fanclub_snapshot()
from public, anon, authenticated;
revoke all on function app_private.api_save_contribution_class(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_delete_contribution_class(jsonb)
from public, anon, authenticated;
revoke all on function app_private.api_save_finance_account(jsonb)
from public, anon, authenticated;
revoke all on function public.pd_api_before_phase2_sorting(text, jsonb)
from public, anon, authenticated;
revoke all on function public.pd_api(text, jsonb) from public;
revoke all on function public.pd_api(text, jsonb) from anon;
grant execute on function public.pd_api(text, jsonb) to authenticated;
