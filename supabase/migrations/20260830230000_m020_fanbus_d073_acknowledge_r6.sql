-- Plaerrdeifl Digitalplattform V4
-- PROD R6 / M020 – D-073 Fanbus-Read-Acknowledge
-- Nur fachlich passende interne Fanbusmeldungen der erfolgreich geoeffneten
-- Teilnehmer-/Belegungsansicht werden serverseitig quittiert.
-- Der Client liefert ausschliesslich die Trip-ID; die Notification-Auswahl
-- erfolgt anhand der Registration->Trip-Beziehung auf dem Server.

begin;

create or replace function app_private.api_mark_notification_read(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_active_user();
  v_notification_id uuid := nullif(p_payload ->> 'notificationId', '')::uuid;
  v_resolved_notification_id uuid;
  v_entity_type text := left(btrim(coalesce(p_payload ->> 'entityType', '')), 100);
  v_entity_id text := left(btrim(coalesce(p_payload ->> 'entityId', '')), 240);
  v_trip_id uuid;
  v_marked integer := 0;
begin
  if v_notification_id is null
     and (v_entity_type = '' or v_entity_id = '') then
    raise exception 'Meldung oder Zielbereich fehlt.'
      using errcode = '22023';
  end if;

  if v_entity_type = 'fanbus_trip_operational' then
    begin
      v_trip_id := nullif(v_entity_id, '')::uuid;
    exception when others then
      raise exception 'Ungültige Fanbusfahrt.' using errcode = '22023';
    end;

    if v_trip_id is null then
      raise exception 'Ungültige Fanbusfahrt.' using errcode = '22023';
    end if;

    if not (
      app_private.has_capability(v_actor, 'fanbus.registrations.manage')
      or app_private.has_capability(v_actor, 'fanbus.manage')
    ) then
      raise exception 'Berechtigung fehlt.' using errcode = '42501';
    end if;

    update app_portal.notifications as notification
    set read_at = coalesce(notification.read_at, now())
    where notification.user_id = v_actor
      and notification.read_at is null
      and notification.event_type in (
        'FANBUS_BOOKING_CREATED',
        'FANBUS_REGISTRATION_CANCELLED'
      )
      and notification.entity_type = 'fanbus_registration'
      and exists (
        select 1
        from app_modules.fanbus_registrations as registration
        where registration.id::text = notification.entity_id
          and registration.trip_id = v_trip_id
      );

    get diagnostics v_marked = row_count;

    return app_private.api_push_snapshot()
      || jsonb_build_object('markedCount', v_marked);
  end if;

  if v_notification_id is not null then
    select notification.id
    into v_resolved_notification_id
    from app_portal.notifications as notification
    where notification.id = v_notification_id
      and notification.user_id = v_actor
    limit 1;

    if v_resolved_notification_id is null then
      select notification.id
      into v_resolved_notification_id
      from app_private.notification_outbox as outbox
      join app_portal.notifications as notification
        on notification.user_id = v_actor
       and notification.event_key = (
         'm020:' || outbox.event_id::text || ':' || v_actor::text
       )
      where outbox.id = v_notification_id
        and outbox.recipient_user_id = v_actor
      limit 1;
    end if;
  end if;

  update app_portal.notifications as notification
  set read_at = coalesce(notification.read_at, now())
  where notification.user_id = v_actor
    and notification.read_at is null
    and (
      (
        v_resolved_notification_id is not null
        and notification.id = v_resolved_notification_id
      )
      or (
        v_entity_type <> ''
        and v_entity_id <> ''
        and notification.entity_type = v_entity_type
        and notification.entity_id = v_entity_id
      )
    );

  get diagnostics v_marked = row_count;

  return app_private.api_push_snapshot()
    || jsonb_build_object('markedCount', v_marked);
end;
$function$;

commit;
