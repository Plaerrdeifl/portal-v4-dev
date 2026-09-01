-- Plärrdeifl Digitalplattform V4
-- R6-PROD-003 / M020 – Push-Navigation, Read-State und Badge-Acknowledge
-- DEV migration. Keine PROD-Mutation wird durch diese Datei ausgeführt.

begin;

create function app_private.m020_bus_orga_notification_route(p_event_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_event app_private.notification_events%rowtype;
  v_trip_id uuid;
begin
  select event.*
  into v_event
  from app_private.notification_events as event
  where event.id = p_event_id;

  if not found or v_event.notification_type not in (
    'FANBUS_BOOKING_CREATED',
    'FANBUS_BOOKING_EXTENDED',
    'FANBUS_REGISTRATION_CANCELLED'
  ) then
    return '';
  end if;

  if v_event.entity_type = 'fanbus_registration' then
    select registration.trip_id
    into v_trip_id
    from app_modules.fanbus_registrations as registration
    where registration.id::text = v_event.entity_id;
  elsif v_event.entity_type = 'fanbus_booking' then
    select booking.trip_id
    into v_trip_id
    from app_modules.fanbus_bookings as booking
    where booking.id::text = v_event.entity_id;
  end if;

  if v_trip_id is null then
    return '';
  end if;

  return '#/bus-orga?view=bookings&trip=' || v_trip_id::text;
end;
$function$;

revoke execute on function app_private.m020_bus_orga_notification_route(uuid)
  from public, anon, authenticated, service_role;

-- Die bestehende Expansion bleibt fachlich unverändert. Nach erfolgreicher
-- Expansion wird ausschließlich das Ziel interner BUS_ORGA-Empfänger auf die
-- vorhandene tripbezogene Buchungsansicht korrigiert.
alter function app_private.notification_expand_event(uuid)
  rename to notification_expand_event_before_m020_push_navigation_r1;

create function app_private.notification_expand_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_route text;
begin
  perform app_private.notification_expand_event_before_m020_push_navigation_r1(
    p_event_id
  );

  v_route := app_private.m020_bus_orga_notification_route(p_event_id);
  if v_route = '' then
    return;
  end if;

  update app_portal.notifications as notification
  set route = v_route
  where notification.event_key = (
      'm020:' || p_event_id::text || ':' || notification.user_id::text
    )
    and notification.user_id in (
      select app_private.notification_config_user_ids(
        array['fanbusOrganization', 'userIds']
      )
    );

  update app_private.notification_outbox as outbox
  set deep_link = v_route,
      updated_at = clock_timestamp()
  where outbox.event_id = p_event_id
    and outbox.channel = 'PUSH'
    and outbox.recipient_user_id in (
      select app_private.notification_config_user_ids(
        array['fanbusOrganization', 'userIds']
      )
    );
end;
$function$;

revoke execute on function app_private.notification_expand_event(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function app_private.notification_expand_event_before_m020_push_navigation_r1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function app_private.notification_expand_event(uuid) to postgres;

-- Bereits projizierte, noch relevante DEV-Meldungen erhalten dasselbe Ziel.
with corrected as (
  select
    event.id as event_id,
    configured_user.id as user_id,
    app_private.m020_bus_orga_notification_route(event.id) as route
  from app_private.notification_events as event
  cross join lateral app_private.notification_config_user_ids(
    array['fanbusOrganization', 'userIds']
  ) as configured_user(id)
  where event.notification_type in (
    'FANBUS_BOOKING_CREATED',
    'FANBUS_BOOKING_EXTENDED',
    'FANBUS_REGISTRATION_CANCELLED'
  )
)
update app_portal.notifications as notification
set route = corrected.route
from corrected
where corrected.route <> ''
  and notification.user_id = corrected.user_id
  and notification.event_key = (
    'm020:' || corrected.event_id::text || ':' || corrected.user_id::text
  );

with corrected as (
  select
    event.id as event_id,
    configured_user.id as user_id,
    app_private.m020_bus_orga_notification_route(event.id) as route
  from app_private.notification_events as event
  cross join lateral app_private.notification_config_user_ids(
    array['fanbusOrganization', 'userIds']
  ) as configured_user(id)
  where event.notification_type in (
    'FANBUS_BOOKING_CREATED',
    'FANBUS_BOOKING_EXTENDED',
    'FANBUS_REGISTRATION_CANCELLED'
  )
)
update app_private.notification_outbox as outbox
set deep_link = corrected.route,
    updated_at = clock_timestamp()
from corrected
where corrected.route <> ''
  and outbox.event_id = corrected.event_id
  and outbox.recipient_user_id = corrected.user_id
  and outbox.channel = 'PUSH'
  and outbox.status in ('PENDING', 'RETRY', 'PROCESSING');

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
  v_scope text := lower(left(btrim(coalesce(p_payload ->> 'scope', '')), 100));
  v_trip_id uuid;
  v_changed integer := 0;
  v_marked integer := 0;
begin
  if v_notification_id is null
     and v_scope = ''
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
        'FANBUS_BOOKING_EXTENDED',
        'FANBUS_REGISTRATION_CANCELLED'
      )
      and (
        (
          notification.entity_type = 'fanbus_registration'
          and exists (
            select 1
            from app_modules.fanbus_registrations as registration
            where registration.id::text = notification.entity_id
              and registration.trip_id = v_trip_id
          )
        )
        or (
          notification.entity_type = 'fanbus_booking'
          and exists (
            select 1
            from app_modules.fanbus_bookings as booking
            where booking.id::text = notification.entity_id
              and booking.trip_id = v_trip_id
          )
        )
      );

    get diagnostics v_changed = row_count;
    v_marked := v_marked + v_changed;
  end if;

  if v_scope <> '' then
    if v_scope = 'membership_applications' then
      perform app_private.m150_require_current_board_member();
      update app_portal.notifications as notification
      set read_at = coalesce(notification.read_at, now())
      where notification.user_id = v_actor
        and notification.read_at is null
        and notification.event_type = 'MEMBERSHIP_APPLICATION_INTERNAL_NEW'
        and notification.entity_type = 'membership_application';
    elsif v_scope = 'access_requests' then
      perform app_private.require_capability('users.manage');
      update app_portal.notifications as notification
      set read_at = coalesce(notification.read_at, now())
      where notification.user_id = v_actor
        and notification.read_at is null
        and notification.event_type = 'ACCESS_REQUEST_INTERNAL_NEW'
        and notification.entity_type = 'access_request';
    elsif v_scope = 'tasks' then
      update app_portal.notifications as notification
      set read_at = coalesce(notification.read_at, now())
      where notification.user_id = v_actor
        and notification.read_at is null
        and left(notification.event_type, 5) = 'TASK_'
        and notification.entity_type = 'task';
    elsif v_scope = 'dates' then
      update app_portal.notifications as notification
      set read_at = coalesce(notification.read_at, now())
      where notification.user_id = v_actor
        and notification.read_at is null
        and notification.event_type in (
          'DATE_EVENT_CREATED',
          'DATE_EVENT_CHANGED',
          'DATE_EVENT_DELETED',
          'DATE_ICS_IMPORT_SUMMARY'
        );
    elsif v_scope = 'dashboard' then
      update app_portal.notifications as notification
      set read_at = coalesce(notification.read_at, now())
      where notification.user_id = v_actor
        and notification.read_at is null
        and notification.event_type in (
          'MEMBERSHIP_ADMISSION_COMPLETED',
          'PUSH_TEST'
        );
    elsif v_scope = 'fanbuses' then
      update app_portal.notifications as notification
      set read_at = coalesce(notification.read_at, now())
      where notification.user_id = v_actor
        and notification.read_at is null
        and left(notification.event_type, 7) = 'FANBUS_'
        and notification.route like '#/fanbuses%';
    else
      raise exception 'Unbekannter Benachrichtigungsbereich.'
        using errcode = '22023';
    end if;

    get diagnostics v_changed = row_count;
    v_marked := v_marked + v_changed;
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
        and v_entity_type <> 'fanbus_trip_operational'
        and v_entity_id <> ''
        and notification.entity_type = v_entity_type
        and notification.entity_id = v_entity_id
      )
    );

  get diagnostics v_changed = row_count;
  v_marked := v_marked + v_changed;

  return app_private.api_push_snapshot()
    || jsonb_build_object('markedCount', v_marked);
end;
$function$;

commit;
