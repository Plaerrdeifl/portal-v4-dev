-- Open contribution payment reports may be corrected by the same finance
-- managers who already review them. Saving keeps the report pending; only the
-- established review action creates the final finance entry.

begin;

create function app_private.api_update_contribution_payment_report(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('finance.manage');
  v_id uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_expected_revision integer :=
    nullif(p_payload ->> 'revision', '')::integer;
  v_amount numeric(12,2) :=
    round(nullif(p_payload ->> 'amount', '')::numeric, 2);
  v_account_id uuid := nullif(p_payload ->> 'accountId', '')::uuid;
  v_payment_method text :=
    upper(btrim(coalesce(p_payload ->> 'paymentMethod', '')));
  v_paid_on date := nullif(p_payload ->> 'paidOn', '')::date;
  v_report app_fanclub.contribution_payment_reports%rowtype;
  v_contribution app_fanclub.member_contributions%rowtype;
  v_other_committed numeric(12,2);
begin
  if v_id is null or v_expected_revision is null then
    raise exception 'Zahlungsmeldung oder Revision fehlt.'
      using errcode = '22023';
  end if;

  if v_amount is null or v_amount <= 0 or v_amount > 999999.99 then
    raise exception 'Der Zahlungsbetrag ist ungültig.'
      using errcode = '22023';
  end if;

  if v_paid_on is null then
    raise exception 'Das Zahlungsdatum fehlt.'
      using errcode = '22023';
  end if;

  if v_payment_method not in ('CASH', 'BANK', 'PAYPAL', 'OTHER') then
    raise exception 'Die Zahlungsart ist ungültig.'
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
    raise exception 'Nur offene Zahlungsmeldungen können bearbeitet werden.'
      using errcode = '23514';
  end if;

  if v_expected_revision <> v_report.revision then
    raise exception
      'Die Zahlungsmeldung wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = 'PT409';
  end if;

  if not exists (
    select 1
    from app_fanclub.finance_accounts as account
    where account.id = v_account_id
      and account.retired_at is null
      and (account.is_active or account.id = v_report.account_id)
  ) then
    raise exception 'Aktives Zielkonto wurde nicht gefunden.'
      using errcode = '23503';
  end if;

  select *
  into v_contribution
  from app_fanclub.member_contributions
  where id = v_report.member_contribution_id
  for update;

  if v_contribution.id is null then
    raise exception 'Beitragszuordnung wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  select coalesce(sum(report.amount), 0)
  into v_other_committed
  from app_fanclub.contribution_payment_reports as report
  where report.member_contribution_id = v_contribution.id
    and report.id <> v_report.id
    and report.status in ('PENDING', 'CONFIRMED');

  if v_other_committed + v_amount > v_contribution.amount_due then
    raise exception
      'Der korrigierte Betrag übersteigt den noch verfügbaren Beitrag.'
      using errcode = '23514';
  end if;

  update app_fanclub.contribution_payment_reports
  set amount = v_amount,
      account_id = v_account_id,
      payment_method = v_payment_method,
      paid_on = v_paid_on,
      revision = revision + 1
  where id = v_report.id;

  perform app_private.log_audit(
    v_actor,
    'CONTRIBUTION_PAYMENT_REPORT_UPDATED',
    'contribution_payment',
    v_report.id::text,
    jsonb_build_object(
      'amount', v_report.amount,
      'accountId', v_report.account_id,
      'paymentMethod', v_report.payment_method,
      'paidOn', v_report.paid_on,
      'status', v_report.status,
      'revision', v_report.revision
    ),
    jsonb_build_object(
      'amount', v_amount,
      'accountId', v_account_id,
      'paymentMethod', v_payment_method,
      'paidOn', v_paid_on,
      'status', 'PENDING',
      'revision', v_report.revision + 1
    )
  );

  return app_private.api_fanclub_snapshot();
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_contribution_report_edit_dev_r1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_contribution_report_edit_dev_r1()
    || array['update_contribution_payment_report']::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_contribution_edit_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'update_contribution_payment_report' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_contribution_edit_r1(p_action)
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_contribution_report_edit_dev_r1;

create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
     = 'update_contribution_payment_report' then
    return app_private.api_update_contribution_payment_report(
      coalesce(p_payload, '{}'::jsonb)
    );
  end if;

  return app_private.pd_api_dispatch_current_before_contribution_report_edit_dev_r1(
    p_action,
    p_payload
  );
end;
$function$;

revoke all on function
  app_private.api_update_contribution_payment_report(jsonb),
  app_private.pd_api_current_actions_before_contribution_report_edit_dev_r1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_contribution_edit_r1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_contribution_report_edit_dev_r1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_update_contribution_payment_report(jsonb),
  app_private.pd_api_current_actions_before_contribution_report_edit_dev_r1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_contribution_edit_r1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_contribution_report_edit_dev_r1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
