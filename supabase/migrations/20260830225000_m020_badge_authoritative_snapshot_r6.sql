-- P900 / PROD R6 – M020 Badge Authority
-- Der App-Badge folgt ausschließlich dem serverseitigen actionable unread count
-- des aktuell authentifizierten Users. Ist badge_enabled=false, ist der
-- badgewirksame Count 0. Die bestehende M330-Erweiterung bleibt erhalten.

create or replace function app_private.api_push_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_trip_cancellations boolean;
  v_badge_enabled boolean;
  v_unread_count bigint;
begin
  v_result := app_private.api_push_snapshot_before_m330_r1();

  select
    preference.push_fanbus_trip_cancellations,
    preference.badge_enabled
  into
    v_trip_cancellations,
    v_badge_enabled
  from app_portal.notification_preferences as preference
  where preference.user_id = auth.uid();

  v_result := jsonb_set(
    v_result,
    '{preferences,pushFanbusTripCancellations}',
    to_jsonb(coalesce(v_trip_cancellations, true)),
    true
  );

  v_unread_count := greatest(
    coalesce((v_result ->> 'unreadNotificationCount')::bigint, 0),
    0
  );

  return jsonb_set(
    v_result,
    '{unreadNotificationCount}',
    to_jsonb(case when coalesce(v_badge_enabled, true) then v_unread_count else 0 end),
    true
  );
end;
$function$;
