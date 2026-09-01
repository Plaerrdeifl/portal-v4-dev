-- P000 / M020 – Push-/Benachrichtigungs-Hotfix
-- Spiegelt den bereits auf DEV angewendeten Stand.
-- Keine Tabellen-, Empfänger-, Quiet-Hours-, Badge- oder Dispatch-Änderungen.

create or replace function app_private.api_remove_push_subscription(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_endpoint text := btrim(coalesce(p_payload ->> 'endpoint', ''));
  v_id uuid;
begin
  perform app_private.require_active_user();

  begin
    v_id := nullif(p_payload ->> 'id', '')::uuid;
  exception when others then
    raise exception 'PUSH_SUBSCRIPTION_INVALID_ID' using errcode = '22023';
  end;

  if v_id is null and v_endpoint = '' then
    raise exception 'PUSH_SUBSCRIPTION_REQUIRED' using errcode = '22023';
  end if;

  update app_portal.push_subscriptions
  set
    is_active = false,
    disabled_at = coalesce(disabled_at, now()),
    updated_at = now()
  where user_id = v_user
    and is_active = true
    and (
      (v_id is not null and id = v_id)
      or (v_id is null and endpoint = v_endpoint)
    );

  -- Geräte-Lifecycle und dauerhafte Benutzerpräferenz sind bewusst getrennt.
  -- Ein Logout oder das Entfernen eines einzelnen Geräts ist kein globaler Opt-out.
  return app_private.api_push_snapshot();
end;
$function$;

create or replace function app_private.api_save_push_subscription(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_endpoint text := btrim(coalesce(p_payload ->> 'endpoint', ''));
  v_p256dh text := btrim(coalesce(p_payload ->> 'p256dh', ''));
  v_auth text := btrim(coalesce(p_payload ->> 'auth', ''));
  v_existing_user uuid;
begin
  perform app_private.require_active_user();

  if length(v_endpoint) not between 20 and 4000
     or v_endpoint !~ '^https://'
     or v_endpoint ~ E'[\\r\\n]'
     or length(v_p256dh) not between 20 and 500
     or length(v_auth) not between 8 and 500 then
    raise exception 'PUSH_SUBSCRIPTION_INVALID' using errcode = '22023';
  end if;

  select subscription.user_id
  into v_existing_user
  from app_portal.push_subscriptions as subscription
  where subscription.endpoint = v_endpoint
  for update;

  if found and v_existing_user is distinct from v_user then
    raise exception 'PUSH_SUBSCRIPTION_ENDPOINT_OWNED' using errcode = '23505';
  end if;

  insert into app_portal.push_subscriptions(
    user_id,
    endpoint,
    p256dh,
    auth_key,
    device_label,
    user_agent,
    is_active,
    failure_count,
    last_seen_at,
    disabled_at,
    updated_at
  )
  values(
    v_user,
    v_endpoint,
    v_p256dh,
    v_auth,
    left(btrim(coalesce(p_payload ->> 'deviceLabel', '')), 120),
    left(btrim(coalesce(p_payload ->> 'userAgent', '')), 500),
    true,
    0,
    now(),
    null,
    now()
  )
  on conflict(endpoint) do update
  set
    p256dh = excluded.p256dh,
    auth_key = excluded.auth_key,
    device_label = excluded.device_label,
    user_agent = excluded.user_agent,
    is_active = true,
    failure_count = 0,
    last_seen_at = now(),
    disabled_at = null,
    updated_at = now()
  where app_portal.push_subscriptions.user_id = v_user;

  if not found then
    -- Deckt das Ownership-Rennen zwischen SELECT und INSERT ab.
    raise exception 'PUSH_SUBSCRIPTION_ENDPOINT_OWNED' using errcode = '23505';
  end if;

  insert into app_portal.notification_preferences(user_id, push_enabled)
  values(v_user, true)
  on conflict(user_id) do update
    set push_enabled = true,
        revision = case
          when app_portal.notification_preferences.push_enabled
            then app_portal.notification_preferences.revision
          else app_portal.notification_preferences.revision + 1
        end,
        updated_at = case
          when app_portal.notification_preferences.push_enabled
            then app_portal.notification_preferences.updated_at
          else now()
        end;

  return app_private.api_push_snapshot();
end;
$function$;

create or replace function app_private.api_save_notification_preferences(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_push_enabled_requested boolean;
begin
  if p_payload ? 'pushEnabled' then
    begin
      v_push_enabled_requested := (p_payload ->> 'pushEnabled')::boolean;
    exception when invalid_text_representation then
      raise exception 'PUSH_PREFERENCE_INVALID_VALUE'
        using errcode = '22023';
    end;
  end if;

  -- Der M330-Vorgänger hält den bestehenden CAS-/Revision-Vertrag und alle
  -- granularen M020-R2-Felder. Der nachfolgende Update erhält das additive
  -- M330-Feld push_fanbus_trip_cancellations.
  perform app_private.api_save_notification_preferences_before_m330_r1(p_payload);

  update app_portal.notification_preferences
  set push_fanbus_trip_cancellations = coalesce(
    (p_payload ->> 'pushFanbusTripCancellations')::boolean,
    push_fanbus_trip_cancellations
  )
  where user_id = auth.uid();

  if v_push_enabled_requested is false then
    update app_portal.push_subscriptions
    set is_active = false,
        disabled_at = coalesce(disabled_at, now()),
        updated_at = now()
    where user_id = auth.uid()
      and is_active = true;
  end if;

  return app_private.api_push_snapshot();
exception when invalid_text_representation then
  raise exception 'PUSH_PREFERENCE_INVALID_VALUE' using errcode = '22023';
end;
$function$;
