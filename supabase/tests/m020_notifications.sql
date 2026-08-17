\set ON_ERROR_STOP on

begin;

select plan(1);

do $m020_notifications_verification$
declare
  v_privilege text;
begin
  if to_regclass('app_private.notification_events') is null
     or to_regclass('app_private.notification_outbox') is null then
    raise exception 'M020 zentrale Event-/Outbox-Tabellen fehlen.';
  end if;

  if not (select relrowsecurity and relforcerowsecurity
          from pg_class where oid='app_private.notification_events'::regclass)
     or not (select relrowsecurity and relforcerowsecurity
             from pg_class where oid='app_private.notification_outbox'::regclass) then
    raise exception 'M020 RLS/FORCE RLS fehlt.';
  end if;

  foreach v_privilege in array array[
    'SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'
  ]
  loop
    if has_table_privilege('anon','app_private.notification_events',v_privilege)
       or has_table_privilege('authenticated','app_private.notification_events',v_privilege)
       or has_table_privilege('service_role','app_private.notification_events',v_privilege)
       or has_table_privilege('anon','app_private.notification_outbox',v_privilege)
       or has_table_privilege('authenticated','app_private.notification_outbox',v_privilege)
       or has_table_privilege('service_role','app_private.notification_outbox',v_privilege) then
      raise exception 'Direktes M020-Tabellenrecht % vorhanden.',v_privilege;
    end if;
  end loop;

  if has_function_privilege('anon','public.pd_notification_claim_batch(integer)','EXECUTE')
     or has_function_privilege('authenticated','public.pd_notification_claim_batch(integer)','EXECUTE')
     or not has_function_privilege('service_role','public.pd_notification_claim_batch(integer)','EXECUTE')
     or has_function_privilege('anon','public.pd_notification_complete(jsonb)','EXECUTE')
     or has_function_privilege('authenticated','public.pd_notification_complete(jsonb)','EXECUTE')
     or not has_function_privilege('service_role','public.pd_notification_complete(jsonb)','EXECUTE') then
    raise exception 'M020 Claim/Complete sind nicht service_role-only.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='app_private.notification_events'::regclass
      and contype='u'
      and pg_get_constraintdef(oid) ilike '%notification_type%event_key%'
  ) then
    raise exception 'M020 Event-Idempotenzconstraint fehlt.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='app_private.notification_outbox'::regclass
      and contype='u'
      and pg_get_constraintdef(oid) ilike '%event_id%channel%delivery_target_key%'
  ) then
    raise exception 'M020 Delivery-Idempotenzconstraint fehlt.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='app_portal'
      and table_name='notification_preferences'
      and column_name='push_fanbus'
      and data_type='boolean'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='app_portal'
      and table_name='notification_preferences'
      and column_name='email_tasks'
      and data_type='boolean'
  ) then
    raise exception 'M020 fachliche Präferenzen fehlen.';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app_private'
      and p.proname in ('notification_event_enqueue','notification_expand_event')
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  ) then
    raise exception 'Browser darf private M020-Core-Funktionen ausführen.';
  end if;

  if not exists (
    select 1 from pg_trigger t
    where t.tgrelid='app_fanclub.membership_applications'::regclass
      and t.tgname='m020_membership_internal_new'
      and not t.tgisinternal
  ) or not exists (
    select 1 from pg_trigger t
    where t.tgrelid='app_modules.fanbus_registrations'::regclass
      and t.tgname='m020_fanbus_registration_events'
      and not t.tgisinternal
  ) then
    raise exception 'M020 fachliche Trigger fehlen.';
  end if;

  if not exists (
    select 1 from app_portal.settings where key='notifications.m020'
  ) then
    raise exception 'M020 Empfänger-Konfiguration fehlt.';
  end if;

  if not exists (select 1 from pg_extension where extname='pg_cron')
     or not exists (select 1 from pg_extension where extname='pg_net')
     or not exists (select 1 from pg_extension where extname='supabase_vault') then
    raise exception 'M020 benötigte DEV-Erweiterungen pg_cron/pg_net/Vault fehlen.';
  end if;

  if position('p_target_user_id uuid DEFAULT NULL::uuid' in
      pg_get_function_arguments('app_private.task_notification_queue(uuid,uuid,text,text,text,text,uuid)'::regprocedure)) = 0 then
    raise exception 'Bestehender 6-Argument-Aufrufvertrag von task_notification_queue wurde gebrochen.';
  end if;

  if to_regprocedure('app_private.push_event_enabled(uuid,text)') is null then
    raise exception 'Legacy PUSH_TEST-Gate push_event_enabled fehlt.';
  end if;

  if not exists (
    select 1 from cron.job
    where jobname='pd-notification-dispatch-m020-r1'
      and schedule='* * * * *'
  ) or not exists (
    select 1 from cron.job
    where jobname='pd-notification-retention-m020-r1'
      and schedule='17 3 * * *'
  ) then
    raise exception 'M020 Cron-Jobs fehlen oder haben unerwartete Zeitpläne.';
  end if;

  if pg_get_functiondef('app_private.notification_retention_run()'::regprocedure)
       not ilike '%event_key like ''m020:%''%30 days%' then
    raise exception '30-Tage-Retention der M020 In-App-Projektionen fehlt.';
  end if;

  if pg_get_functiondef('app_private.m150_membership_retention_run()'::regprocedure)
       not ilike '%notification_events as pending_event%PENDING%PROCESSING%EXPANDED%'
     or pg_get_functiondef('app_private.m150_membership_retention_run()'::regprocedure)
       not ilike '%notification_outbox as pending_outbox%PENDING%PROCESSING%RETRY%'
     or pg_get_functiondef('app_private.m150_membership_retention_run()'::regprocedure)
       not ilike '%membership_application_email_outbox as sending_outbox%SENDING%' then
    raise exception 'M150-Retention schützt aktive Legacy- und M020-Zustellungen nicht vollständig.';
  end if;

  if pg_get_functiondef('app_private.api_save_push_subscription(jsonb)'::regprocedure)
       not ilike '%length(v_endpoint) not between 20 and 4000%'
     or pg_get_functiondef('app_private.api_save_push_subscription(jsonb)'::regprocedure)
       not ilike '%length(v_p256dh) not between 20 and 500%'
     or pg_get_functiondef('app_private.api_save_push_subscription(jsonb)'::regprocedure)
       not ilike '%PUSH_SUBSCRIPTION_ENDPOINT_OWNED%' then
    raise exception 'M020 Push-Subscription-Härtung fehlt.';
  end if;
end;
$m020_notifications_verification$;

select pass('M020-R1 zentrale Benachrichtigungsarchitektur ist strukturell abgesichert.');
select * from finish();

rollback;
