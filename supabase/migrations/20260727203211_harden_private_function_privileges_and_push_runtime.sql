-- Plärrdeifl Portal V4
-- Umgebungsneutrale Funktions- und Web-Push-Härtung.
--
-- Diese Migration enthält bewusst keine DEV- oder PROD-Project-Ref.
-- Web Push bleibt deaktiviert, bis jede Umgebung ausdrücklich eine eigene
-- Funktions-URL und eigene Schlüssel erhalten hat.

insert into app_portal.settings (
  key,
  value,
  description
)
values (
  'web_push',
  jsonb_build_object(
    'enabled', false,
    'publicKey', '',
    'functionUrl', '',
    'subject', '',
    'version', 'R2_ENVIRONMENT_NEUTRAL'
  ),
  'Umgebungsabhängige Web-Push-Konfiguration. Standardmäßig sicher deaktiviert.'
)
on conflict (key)
do update set
  value = excluded.value,
  description = excluded.description,
  revision = app_portal.settings.revision + 1,
  updated_at = now();

update app_portal.notification_preferences
set push_enabled = false,
    revision = revision + 1,
    updated_at = now()
where push_enabled;

update app_portal.notifications
set push_state = 'SKIPPED',
    push_attempted_at = now(),
    push_error =
      'Web Push wurde bis zur umgebungsspezifischen Einrichtung deaktiviert.'
where push_state in ('PENDING', 'PROCESSING');

create or replace function app_private.api_push_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_enabled boolean := false;
  v_public_key text := '';
begin
  insert into app_portal.notification_preferences (user_id)
  values (v_actor)
  on conflict (user_id) do nothing;

  select
    lower(
      coalesce(setting.value ->> 'enabled', 'false')
    ) = 'true',
    btrim(
      coalesce(setting.value ->> 'publicKey', '')
    )
  into
    v_enabled,
    v_public_key
  from app_portal.settings as setting
  where setting.key = 'web_push';

  return jsonb_build_object(
    'supported',
      coalesce(v_enabled, false)
      and coalesce(v_public_key, '') <> '',
    'publicKey',
      case
        when coalesce(v_enabled, false)
          then coalesce(v_public_key, '')
        else ''
      end,
    'activeDeviceCount', (
      select count(*)
      from app_portal.push_subscriptions as subscription
      where subscription.user_id = v_actor
        and subscription.is_active
    ),
    'unreadNotificationCount', (
      select count(*)
      from app_portal.notifications as notification
      where notification.user_id = v_actor
        and notification.read_at is null
        and notification.event_type <> 'PUSH_TEST'
    ),
    'preferences', (
      select jsonb_build_object(
        'pushEnabled', preference.push_enabled,
        'newTasks', preference.new_tasks,
        'taskUpdates', preference.task_updates,
        'taskStatus', preference.task_status,
        'taskTransfers', preference.task_transfers,
        'waitingDeadlines', preference.waiting_deadlines,
        'badgeEnabled', preference.badge_enabled,
        'quietHoursEnabled', preference.quiet_hours_enabled,
        'quietStart',
          to_char(preference.quiet_start, 'HH24:MI'),
        'quietEnd',
          to_char(preference.quiet_end, 'HH24:MI'),
        'timeZone', preference.time_zone,
        'revision', preference.revision
      )
      from app_portal.notification_preferences as preference
      where preference.user_id = v_actor
    )
  );
end;
$$;

create or replace function app_private.invoke_push_dispatch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean := false;
  v_function_url text := '';
  v_secret text := '';
  v_request_id bigint;
begin
  select
    lower(
      coalesce(setting.value ->> 'enabled', 'false')
    ) = 'true',
    btrim(
      coalesce(setting.value ->> 'functionUrl', '')
    )
  into
    v_enabled,
    v_function_url
  from app_portal.settings as setting
  where setting.key = 'web_push';

  if not coalesce(v_enabled, false)
     or coalesce(v_function_url, '') = '' then
    update app_portal.notifications
    set push_state = 'SKIPPED',
        push_attempted_at = now(),
        push_error =
          'Web Push ist in dieser Umgebung nicht eingerichtet.'
    where push_state in ('PENDING', 'PROCESSING');

    return null;
  end if;

  if v_function_url !~
     '^https://[a-z0-9-]+\.supabase\.co/functions/v1/send-web-push$' then
    update app_portal.notifications
    set push_state = 'SKIPPED',
        push_attempted_at = now(),
        push_error =
          'Der konfigurierte Web-Push-Endpunkt ist ungültig.'
    where push_state in ('PENDING', 'PROCESSING');

    return null;
  end if;

  select secret.decrypted_secret
  into v_secret
  from vault.decrypted_secrets as secret
  where secret.name = 'pd_push_dispatch_secret'
  limit 1;

  if coalesce(v_secret, '') = '' then
    update app_portal.notifications
    set push_state = 'SKIPPED',
        push_attempted_at = now(),
        push_error =
          'Der interne Web-Push-Schlüssel fehlt.'
    where push_state in ('PENDING', 'PROCESSING');

    return null;
  end if;

  select net.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-dispatch-secret', v_secret
    ),
    body := jsonb_build_object(
      'source', 'database',
      'requestedAt', now()
    ),
    timeout_milliseconds := 5000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

-- Alle internen Funktionen bleiben ausschließlich intern.
revoke all on all functions in schema app_private
from public, anon, authenticated;

-- Auch zukünftige Funktionen dürfen kein automatisches EXECUTE für PUBLIC
-- oder die beiden Browserrollen erhalten.
alter default privileges in schema app_private
revoke execute on functions
from public, anon, authenticated;

-- Der einzige Browser-RPC-Einstieg bleibt public.pd_api.
revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated;

grant execute on function public.pd_api(text, jsonb)
to anon, authenticated;

comment on function app_private.invoke_push_dispatch() is
  'Startet Web Push ausschließlich bei explizit aktivierter, umgebungsspezifischer Laufzeitkonfiguration.';

comment on function app_private.api_push_snapshot() is
  'Liefert Push-Funktionen nur bei ausdrücklich aktivierter Umgebungskonfiguration aus.';