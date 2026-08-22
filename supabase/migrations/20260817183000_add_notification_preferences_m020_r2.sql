-- M020-R2 – Erweiterte Benachrichtigungseinstellungen
-- Additiv auf M020-R1. Das eingefrorene R1-Migrationsfile bleibt unverändert.
-- Scope: granulare optionale Push-Einstellungen, Termine, neue veröffentlichte
-- Fanbusfahrten, Buszuordnung, Fahrtpreisänderung und Badge-Härtung.

alter table app_portal.notification_preferences
  add column if not exists push_membership_applications boolean not null default true,
  add column if not exists push_access_requests boolean not null default true,
  add column if not exists push_own_account_status boolean not null default true,
  add column if not exists push_fanbus_new_trips boolean not null default true,
  add column if not exists push_fanbus_own_bookings boolean not null default true,
  add column if not exists push_fanbus_waitlist boolean not null default true,
  add column if not exists push_fanbus_cancellations boolean not null default true,
  add column if not exists push_fanbus_times boolean not null default true,
  add column if not exists push_fanbus_boarding boolean not null default true,
  add column if not exists push_fanbus_bus_assignment boolean not null default true,
  add column if not exists push_fanbus_price_changes boolean not null default true,
  add column if not exists push_fanbus_org_bookings boolean not null default true,
  add column if not exists push_fanbus_org_cancellations boolean not null default true,
  add column if not exists push_dates_new boolean not null default true,
  add column if not exists push_dates_changes boolean not null default true,
  add column if not exists push_dates_deleted boolean not null default true;


-- Ungelesene Projektionen mit inzwischen gelöschtem Zielobjekt dürfen das PWA-Badge
-- nicht dauerhaft erhöhen. Semantische Ereignisse ohne aktuelles Quellobjekt
-- (z. B. ein bewusst gemeldeter gelöschter Termin) verwenden einen anderen
-- entity_type und bleiben deshalb zählbar.
create or replace function app_private.notification_projection_actionable(
  p_entity_type text,
  p_entity_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_type text := lower(btrim(coalesce(p_entity_type, '')));
begin
  if v_type = '' then
    return true;
  end if;

  if v_type not in (
    'task',
    'fanbus_registration',
    'fanbus_trip',
    'fanbus_trip_boarding_stop',
    'membership_application',
    'access_request',
    'event',
    'event_import_run'
  ) then
    return true;
  end if;

  begin
    v_id := nullif(btrim(coalesce(p_entity_id, '')), '')::uuid;
  exception when others then
    return false;
  end;

  if v_id is null then
    return false;
  end if;

  if v_type = 'task' then
    return exists(select 1 from app_modules.tasks x where x.id = v_id);
  elsif v_type = 'fanbus_registration' then
    return exists(select 1 from app_modules.fanbus_registrations x where x.id = v_id);
  elsif v_type = 'fanbus_trip' then
    return exists(select 1 from app_modules.fanbus_trips x where x.id = v_id);
  elsif v_type = 'fanbus_trip_boarding_stop' then
    return exists(select 1 from app_modules.fanbus_trip_boarding_stops x where x.id = v_id);
  elsif v_type = 'membership_application' then
    return exists(select 1 from app_fanclub.membership_applications x where x.id = v_id);
  elsif v_type = 'access_request' then
    return exists(select 1 from app_portal.access_requests x where x.id = v_id);
  elsif v_type = 'event' then
    return exists(select 1 from app_modules.events x where x.id = v_id);
  elsif v_type = 'event_import_run' then
    return exists(select 1 from app_modules.event_import_runs x where x.id = v_id);
  end if;

  return true;
end;
$function$;


create or replace function app_private.notification_unread_count(
  p_user_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select count(*)::integer
  from app_portal.notifications n
  where n.user_id = p_user_id
    and n.read_at is null
    and app_private.notification_projection_actionable(n.entity_type, n.entity_id);
$function$;


-- Die bestehende R1-Kategorieentscheidung bleibt die erste Schranke. R2 fügt
-- darunter nur die fachliche Feingranularität hinzu.
create or replace function app_private.notification_push_preference_enabled(
  p_user_id uuid,
  p_category text,
  p_event_type text,
  p_template_key text,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_pref app_portal.notification_preferences%rowtype;
  v_template text := lower(btrim(coalesce(p_template_key, '')));
  v_created integer := 0;
  v_updated integer := 0;
begin
  if not app_private.notification_preference_enabled(
    p_user_id,
    p_category,
    'PUSH',
    p_event_type
  ) then
    return false;
  end if;

  select * into v_pref
  from app_portal.notification_preferences np
  where np.user_id = p_user_id;

  if not found then
    return false;
  end if;

  if p_category = 'ACCOUNT_MEMBERSHIP' then
    if v_template = 'membership.internal_new' then
      return v_pref.push_membership_applications;
    elsif v_template = 'access.internal_new' then
      return v_pref.push_access_requests;
    elsif v_template = 'membership.admission' then
      return v_pref.push_own_account_status;
    end if;
    return true;

  elsif p_category = 'FANBUS' then
    if v_template = 'fanbus.trip_published' then
      return v_pref.push_fanbus_new_trips;
    elsif v_template = 'fanbus.booking.active' then
      return v_pref.push_fanbus_own_bookings;
    elsif v_template in ('fanbus.booking.waitlisted', 'fanbus.waitlist_promoted') then
      return v_pref.push_fanbus_waitlist;
    elsif v_template = 'fanbus.cancelled' then
      return v_pref.push_fanbus_cancellations;
    elsif v_template in ('fanbus.trip_departure_changed', 'fanbus.boarding_time_changed') then
      return v_pref.push_fanbus_times;
    elsif v_template = 'fanbus.selected_boarding_stop_changed' then
      return v_pref.push_fanbus_boarding;
    elsif v_template = 'fanbus.bus_assignment_changed' then
      return v_pref.push_fanbus_bus_assignment;
    elsif v_template = 'fanbus.trip_price_changed' then
      return v_pref.push_fanbus_price_changes;
    elsif v_template = 'fanbus.internal_new' then
      return v_pref.push_fanbus_org_bookings;
    elsif v_template = 'fanbus.internal_cancelled' then
      return v_pref.push_fanbus_org_cancellations;
    end if;
    return true;

  elsif p_category = 'DATES' then
    if p_event_type = 'DATE_EVENT_CREATED' then
      return v_pref.push_dates_new;
    elsif p_event_type = 'DATE_EVENT_CHANGED' then
      return v_pref.push_dates_changes;
    elsif p_event_type = 'DATE_EVENT_DELETED' then
      return v_pref.push_dates_deleted;
    elsif p_event_type = 'DATE_ICS_IMPORT_SUMMARY' then
      begin
        v_created := greatest(coalesce((p_payload ->> 'createdCount')::integer, 0), 0);
      exception when others then
        v_created := 0;
      end;
      begin
        v_updated := greatest(coalesce((p_payload ->> 'updatedCount')::integer, 0), 0);
      exception when others then
        v_updated := 0;
      end;
      return (v_created > 0 and v_pref.push_dates_new)
        or (v_updated > 0 and v_pref.push_dates_changes);
    end if;
    return true;
  end if;

  return true;
end;
$function$;


-- R2-Projektionen existieren nur, wenn für den Benutzer tatsächlich ein optionaler
-- Push an mindestens ein aktives Gerät erzeugt wird. Pflicht-E-Mails bleiben davon
-- vollständig unabhängig.
create or replace function app_private.notification_add_user(
  p_event app_private.notification_events,
  p_user_id uuid,
  p_title text,
  p_body text,
  p_template_key text,
  p_template_data jsonb,
  p_deep_link text default ''::text,
  p_email_mandatory boolean default false,
  p_email_allowed boolean default true,
  p_push_allowed boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user app_portal.users%rowtype;
  v_email_enabled boolean;
  v_push_enabled boolean;
  v_has_push_subscription boolean := false;
  v_sub record;
  v_target text;
begin
  select * into v_user
  from app_portal.users u
  where u.id = p_user_id
    and u.status = 'ACTIVE';

  if not found then
    return;
  end if;

  v_email_enabled := p_email_allowed and (
    p_email_mandatory
    or app_private.notification_preference_enabled(
      p_user_id, p_event.category, 'EMAIL', p_event.notification_type
    )
  );

  if v_email_enabled then
    perform app_private.notification_add_external_email(
      p_event,
      v_user.email,
      'USER',
      'user:' || p_user_id::text || ':email',
      p_template_key,
      p_template_data,
      p_deep_link,
      p_email_mandatory
    );
  end if;

  v_push_enabled := p_push_allowed
    and app_private.notification_push_preference_enabled(
      p_user_id,
      p_event.category,
      p_event.notification_type,
      p_template_key,
      p_event.payload
    );

  if v_push_enabled then
    select exists(
      select 1
      from app_portal.push_subscriptions ps
      where ps.user_id = p_user_id
        and ps.is_active = true
    )
    into v_has_push_subscription;
  end if;

  if not v_push_enabled or not v_has_push_subscription then
    return;
  end if;

  perform app_private.notification_project_user(
    p_event, p_user_id, p_title, p_body, p_deep_link
  );

  for v_sub in
    select ps.id
    from app_portal.push_subscriptions ps
    where ps.user_id = p_user_id
      and ps.is_active = true
    order by ps.created_at, ps.id
  loop
    v_target := 'push:' || v_sub.id::text;

    insert into app_private.notification_outbox(
      event_id, notification_type, category, event_key,
      recipient_kind, recipient_user_id, push_subscription_id,
      channel, delivery_target_key, preference_mode,
      next_attempt_at, payload, deep_link
    )
    values (
      p_event.id, p_event.notification_type, p_event.category, p_event.event_key,
      'USER', p_user_id, v_sub.id,
      'PUSH', v_target, 'OPTIONAL',
      app_private.notification_push_ready_at(p_user_id),
      jsonb_build_object(
        'title', left(coalesce(p_title, 'Plärrdeifl'), 120),
        'body', left(coalesce(p_body, ''), 240)
      ),
      coalesce(p_deep_link, '')
    )
    on conflict (event_id, channel, delivery_target_key) do nothing;
  end loop;
end;
$function$;


create or replace function app_private.api_push_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_pref app_portal.notification_preferences%rowtype;
  v_key text := '';
begin
  perform app_private.require_active_user();

  insert into app_portal.notification_preferences(user_id)
  values(v_user)
  on conflict(user_id) do nothing;

  select * into v_pref
  from app_portal.notification_preferences
  where user_id = v_user;

  select coalesce(s.value ->> 'publicKey', '') into v_key
  from app_portal.settings s
  where s.key = 'web_push';

  return jsonb_build_object(
    'supported', v_key <> '',
    'publicKey', v_key,
    'activeDeviceCount', (
      select count(*)
      from app_portal.push_subscriptions ps
      where ps.user_id = v_user
        and ps.is_active = true
    ),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ps.id,
        'deviceLabel', ps.device_label,
        'lastSeenAt', ps.last_seen_at,
        'lastSuccessAt', ps.last_success_at,
        'createdAt', ps.created_at
      ) order by ps.last_seen_at desc, ps.id)
      from app_portal.push_subscriptions ps
      where ps.user_id = v_user
        and ps.is_active = true
    ), '[]'::jsonb),
    'unreadNotificationCount',
      app_private.notification_unread_count(v_user),
    'preferences', jsonb_build_object(
      'pushEnabled', v_pref.push_enabled,
      'newTasks', v_pref.new_tasks,
      'taskUpdates', v_pref.task_updates,
      'taskStatus', v_pref.task_status,
      'taskTransfers', v_pref.task_transfers,
      'waitingDeadlines', v_pref.waiting_deadlines,
      'badgeEnabled', v_pref.badge_enabled,
      'quietHoursEnabled', v_pref.quiet_hours_enabled,
      'quietStart', to_char(v_pref.quiet_start, 'HH24:MI'),
      'quietEnd', to_char(v_pref.quiet_end, 'HH24:MI'),
      'timeZone', v_pref.time_zone,

      'emailAccountMembership', v_pref.email_account_membership,
      'pushAccountMembership', v_pref.push_account_membership,
      'pushMembershipApplications', v_pref.push_membership_applications,
      'pushAccessRequests', v_pref.push_access_requests,
      'pushOwnAccountStatus', v_pref.push_own_account_status,

      'emailFanbus', v_pref.email_fanbus,
      'pushFanbus', v_pref.push_fanbus,
      'pushFanbusNewTrips', v_pref.push_fanbus_new_trips,
      'pushFanbusOwnBookings', v_pref.push_fanbus_own_bookings,
      'pushFanbusWaitlist', v_pref.push_fanbus_waitlist,
      'pushFanbusCancellations', v_pref.push_fanbus_cancellations,
      'pushFanbusTimes', v_pref.push_fanbus_times,
      'pushFanbusBoarding', v_pref.push_fanbus_boarding,
      'pushFanbusBusAssignment', v_pref.push_fanbus_bus_assignment,
      'pushFanbusPriceChanges', v_pref.push_fanbus_price_changes,
      'pushFanbusOrgBookings', v_pref.push_fanbus_org_bookings,
      'pushFanbusOrgCancellations', v_pref.push_fanbus_org_cancellations,

      'emailDates', v_pref.email_dates,
      'pushDates', v_pref.push_dates,
      'pushDatesNew', v_pref.push_dates_new,
      'pushDatesChanges', v_pref.push_dates_changes,
      'pushDatesDeleted', v_pref.push_dates_deleted,

      'emailTasks', v_pref.email_tasks,
      'pushTasks', v_pref.push_tasks,
      'revision', v_pref.revision
    )
  );
end;
$function$;


create or replace function app_private.api_save_notification_preferences(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_expected integer;
begin
  perform app_private.require_active_user();

  begin
    v_expected := coalesce((p_payload ->> 'revision')::integer, 1);
  exception when others then
    raise exception 'PUSH_PREFERENCE_INVALID_REVISION' using errcode = '22023';
  end;

  insert into app_portal.notification_preferences(user_id)
  values(v_user)
  on conflict(user_id) do nothing;

  update app_portal.notification_preferences
  set
    push_enabled = coalesce((p_payload ->> 'pushEnabled')::boolean, push_enabled),
    new_tasks = coalesce((p_payload ->> 'newTasks')::boolean, new_tasks),
    task_updates = coalesce((p_payload ->> 'taskUpdates')::boolean, task_updates),
    task_status = coalesce((p_payload ->> 'taskStatus')::boolean, task_status),
    task_transfers = coalesce((p_payload ->> 'taskTransfers')::boolean, task_transfers),
    waiting_deadlines = coalesce((p_payload ->> 'waitingDeadlines')::boolean, waiting_deadlines),
    badge_enabled = coalesce((p_payload ->> 'badgeEnabled')::boolean, badge_enabled),
    quiet_hours_enabled = coalesce((p_payload ->> 'quietHoursEnabled')::boolean, quiet_hours_enabled),
    quiet_start = coalesce(nullif(p_payload ->> 'quietStart', '')::time, quiet_start),
    quiet_end = coalesce(nullif(p_payload ->> 'quietEnd', '')::time, quiet_end),
    time_zone = left(coalesce(nullif(btrim(p_payload ->> 'timeZone'), ''), time_zone), 80),

    email_account_membership = coalesce((p_payload ->> 'emailAccountMembership')::boolean, email_account_membership),
    push_account_membership = coalesce((p_payload ->> 'pushAccountMembership')::boolean, push_account_membership),
    push_membership_applications = coalesce((p_payload ->> 'pushMembershipApplications')::boolean, push_membership_applications),
    push_access_requests = coalesce((p_payload ->> 'pushAccessRequests')::boolean, push_access_requests),
    push_own_account_status = coalesce((p_payload ->> 'pushOwnAccountStatus')::boolean, push_own_account_status),

    email_fanbus = coalesce((p_payload ->> 'emailFanbus')::boolean, email_fanbus),
    push_fanbus = coalesce((p_payload ->> 'pushFanbus')::boolean, push_fanbus),
    push_fanbus_new_trips = coalesce((p_payload ->> 'pushFanbusNewTrips')::boolean, push_fanbus_new_trips),
    push_fanbus_own_bookings = coalesce((p_payload ->> 'pushFanbusOwnBookings')::boolean, push_fanbus_own_bookings),
    push_fanbus_waitlist = coalesce((p_payload ->> 'pushFanbusWaitlist')::boolean, push_fanbus_waitlist),
    push_fanbus_cancellations = coalesce((p_payload ->> 'pushFanbusCancellations')::boolean, push_fanbus_cancellations),
    push_fanbus_times = coalesce((p_payload ->> 'pushFanbusTimes')::boolean, push_fanbus_times),
    push_fanbus_boarding = coalesce((p_payload ->> 'pushFanbusBoarding')::boolean, push_fanbus_boarding),
    push_fanbus_bus_assignment = coalesce((p_payload ->> 'pushFanbusBusAssignment')::boolean, push_fanbus_bus_assignment),
    push_fanbus_price_changes = coalesce((p_payload ->> 'pushFanbusPriceChanges')::boolean, push_fanbus_price_changes),
    push_fanbus_org_bookings = coalesce((p_payload ->> 'pushFanbusOrgBookings')::boolean, push_fanbus_org_bookings),
    push_fanbus_org_cancellations = coalesce((p_payload ->> 'pushFanbusOrgCancellations')::boolean, push_fanbus_org_cancellations),

    email_dates = coalesce((p_payload ->> 'emailDates')::boolean, email_dates),
    push_dates = coalesce((p_payload ->> 'pushDates')::boolean, push_dates),
    push_dates_new = coalesce((p_payload ->> 'pushDatesNew')::boolean, push_dates_new),
    push_dates_changes = coalesce((p_payload ->> 'pushDatesChanges')::boolean, push_dates_changes),
    push_dates_deleted = coalesce((p_payload ->> 'pushDatesDeleted')::boolean, push_dates_deleted),

    email_tasks = coalesce((p_payload ->> 'emailTasks')::boolean, email_tasks),
    push_tasks = coalesce((p_payload ->> 'pushTasks')::boolean, push_tasks),

    revision = revision + 1,
    updated_at = now()
  where user_id = v_user
    and revision = v_expected;

  if not found then
    raise exception 'PUSH_PREFERENCE_REVISION_CONFLICT' using errcode = '40001';
  end if;

  return app_private.api_push_snapshot();
end;
$function$;


-- Leitet nur neue R2-Ereignisse aus den bereits transaktional geschriebenen
-- Fachaudits ab. Bestehende M020-R1-Trigger bleiben unverändert.
create or replace function app_private.m020_r2_audit_notification_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_source text := upper(btrim(coalesce(new.metadata ->> 'source', '')));
  v_event_data jsonb;
  v_before_relevant jsonb;
  v_after_relevant jsonb;
  v_event_type text;
  v_home_away text;
  v_opponent text;
  v_title text;
  v_event_date date;
  v_created integer := 0;
  v_updated integer := 0;
begin
  -- Der ICS-Import protokolliert jedes Spiel einzeln. Diese Einzelereignisse
  -- werden bewusst nicht benachrichtigt; dafür gibt es unten genau eine Summary.
  if new.action in ('EVENT_CREATED', 'EVENT_UPDATED')
     and v_source = 'ICS_IMPORT' then
    return new;
  end if;

  if new.action in ('EVENT_CREATED', 'EVENT_UPDATED', 'EVENT_DELETED') then
    v_event_data := case
      when new.action = 'EVENT_DELETED' then coalesce(new.before_data, '{}'::jsonb)
      else coalesce(new.after_data, '{}'::jsonb)
    end;

    if new.action = 'EVENT_UPDATED' then
      v_before_relevant := jsonb_build_object(
        'event_type', coalesce(new.before_data -> 'event_type', new.before_data -> 'eventType'),
        'title', new.before_data -> 'title',
        'event_date', coalesce(new.before_data -> 'event_date', new.before_data -> 'eventDate'),
        'event_time', coalesce(new.before_data -> 'event_time', new.before_data -> 'eventTime'),
        'end_date', coalesce(new.before_data -> 'end_date', new.before_data -> 'endDate'),
        'end_time', coalesce(new.before_data -> 'end_time', new.before_data -> 'endTime'),
        'venue', new.before_data -> 'venue',
        'visibility', new.before_data -> 'visibility',
        'homeAway', new.before_data -> 'homeAway',
        'opponentName', new.before_data -> 'opponentName'
      );
      v_after_relevant := jsonb_build_object(
        'event_type', coalesce(new.after_data -> 'event_type', new.after_data -> 'eventType'),
        'title', new.after_data -> 'title',
        'event_date', coalesce(new.after_data -> 'event_date', new.after_data -> 'eventDate'),
        'event_time', coalesce(new.after_data -> 'event_time', new.after_data -> 'eventTime'),
        'end_date', coalesce(new.after_data -> 'end_date', new.after_data -> 'endDate'),
        'end_time', coalesce(new.after_data -> 'end_time', new.after_data -> 'endTime'),
        'venue', new.after_data -> 'venue',
        'visibility', new.after_data -> 'visibility',
        'homeAway', new.after_data -> 'homeAway',
        'opponentName', new.after_data -> 'opponentName'
      );

      if v_before_relevant is not distinct from v_after_relevant then
        return new;
      end if;
    end if;

    begin
      v_event_date := coalesce(
        nullif(v_event_data ->> 'event_date', ''),
        nullif(v_event_data ->> 'eventDate', '')
      )::date;
    exception when others then
      v_event_date := null;
    end;

    if v_event_date is not null
       and v_event_date < (now() at time zone 'Europe/Berlin')::date then
      return new;
    end if;

    v_event_type := upper(coalesce(
      nullif(v_event_data ->> 'event_type', ''),
      nullif(v_event_data ->> 'eventType', ''),
      ''
    ));
    v_home_away := upper(coalesce(v_event_data ->> 'homeAway', ''));
    v_opponent := btrim(coalesce(v_event_data ->> 'opponentName', ''));

    if v_event_type = 'GAME' then
      if v_home_away = 'AWAY' and v_opponent <> '' then
        v_title := v_opponent || ' – Mighty Dogs Schweinfurt';
      elsif v_home_away = 'HOME' and v_opponent <> '' then
        v_title := 'Mighty Dogs Schweinfurt – ' || v_opponent;
      elsif v_opponent <> '' then
        v_title := 'Mighty Dogs Schweinfurt – ' || v_opponent;
      else
        v_title := 'Spieltag';
      end if;
    else
      v_title := coalesce(nullif(btrim(v_event_data ->> 'title'), ''), 'Termin');
    end if;

    perform app_private.notification_event_enqueue(
      case new.action
        when 'EVENT_CREATED' then 'DATE_EVENT_CREATED'
        when 'EVENT_UPDATED' then 'DATE_EVENT_CHANGED'
        else 'DATE_EVENT_DELETED'
      end,
      'DATES',
      'audit:' || new.id::text,
      'M020_R2',
      case when new.action = 'EVENT_DELETED' then 'event_deleted' else 'event' end,
      new.entity_id,
      new.actor_user_id,
      jsonb_build_object(
        'displayTitle', v_title,
        'eventDate', coalesce(v_event_data ->> 'event_date', v_event_data ->> 'eventDate', ''),
        'eventTime', coalesce(v_event_data ->> 'event_time', v_event_data ->> 'eventTime', ''),
        'venue', coalesce(v_event_data ->> 'venue', '')
      ),
      new.occurred_at
    );
    return new;
  end if;

  if new.action = 'EVENT_ICS_IMPORT_CONFIRMED' then
    begin
      v_created := greatest(coalesce((new.after_data ->> 'createdCount')::integer, 0), 0);
    exception when others then
      v_created := 0;
    end;
    begin
      v_updated := greatest(coalesce((new.after_data ->> 'updatedCount')::integer, 0), 0);
    exception when others then
      v_updated := 0;
    end;

    if v_created + v_updated > 0 then
      perform app_private.notification_event_enqueue(
        'DATE_ICS_IMPORT_SUMMARY',
        'DATES',
        'audit:' || new.id::text,
        'M020_R2',
        'event_import_run',
        new.entity_id,
        new.actor_user_id,
        jsonb_build_object(
          'createdCount', v_created,
          'updatedCount', v_updated,
          'sourceKey', coalesce(new.after_data ->> 'sourceKey', '')
        ),
        new.occurred_at
      );
    end if;
    return new;
  end if;

  if new.action = 'FANBUS_TRIP_PUBLISHED' then
    perform app_private.notification_event_enqueue(
      'FANBUS_TRIP_PUBLISHED',
      'FANBUS',
      'audit:' || new.id::text,
      'M020_R2',
      'fanbus_trip',
      new.entity_id,
      new.actor_user_id,
      jsonb_build_object(
        'eventId', coalesce(new.after_data ->> 'eventId', new.metadata ->> 'eventId', '')
      ),
      new.occurred_at
    );
    return new;
  end if;

  -- Ein Buswechsel wird fachlich als UNASSIGN + ASSIGN protokolliert. Nur ASSIGN
  -- erzeugt die Meldung, damit ein Wechsel genau einmal benachrichtigt wird.
  if new.action = 'FANBUS_BUS_ASSIGNED' then
    perform app_private.notification_event_enqueue(
      'FANBUS_BUS_ASSIGNMENT_CHANGED',
      'FANBUS',
      'audit:' || new.id::text,
      'M020_R2',
      'fanbus_registration',
      new.entity_id,
      new.actor_user_id,
      jsonb_build_object(
        'tripId', coalesce(new.after_data ->> 'tripId', new.metadata ->> 'tripId', ''),
        'bookingId', coalesce(new.metadata ->> 'bookingId', ''),
        'busId', coalesce(new.after_data ->> 'busId', new.metadata ->> 'busId', '')
      ),
      new.occurred_at
    );
    return new;
  end if;

  -- R1 erkennt Abfahrtsänderungen bereits separat. R2 ergänzt hier ausschließlich
  -- den fachlich relevanten Preiswechsel einer bereits veröffentlichten Fahrt.
  if new.action = 'FANBUS_TRIP_UPDATED'
     and upper(coalesce(new.before_data ->> 'status', '')) = 'PUBLISHED'
     and upper(coalesce(new.after_data ->> 'status', '')) = 'PUBLISHED'
     and (new.before_data ->> 'priceCents') is distinct from (new.after_data ->> 'priceCents') then
    perform app_private.notification_event_enqueue(
      'FANBUS_TRIP_PRICE_CHANGED',
      'FANBUS',
      'audit:' || new.id::text,
      'M020_R2',
      'fanbus_trip',
      new.entity_id,
      new.actor_user_id,
      jsonb_build_object(
        'eventId', coalesce(new.after_data ->> 'eventId', new.metadata ->> 'eventId', ''),
        'oldPriceCents', new.before_data ->> 'priceCents',
        'newPriceCents', new.after_data ->> 'priceCents'
      ),
      new.occurred_at
    );
    return new;
  end if;

  return new;
end;
$function$;

drop trigger if exists m020_r2_audit_notifications on app_portal.audit_events;
create trigger m020_r2_audit_notifications
after insert on app_portal.audit_events
for each row
execute function app_private.m020_r2_audit_notification_trigger();


create or replace function app_private.notification_expand_r2_event(
  p_event_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  e app_private.notification_events%rowtype;
  trip app_modules.fanbus_trips%rowtype;
  reg app_modules.fanbus_registrations%rowtype;
  contact app_modules.fanbus_registrations%rowtype;
  v_user_id uuid;
  v_title text;
  v_body text;
  v_route text;
  v_data jsonb;
  v_trip_title text;
  v_affected_name text;
  v_bus_label text;
  v_bus_id uuid;
  v_created integer := 0;
  v_updated integer := 0;
  v_old_price integer;
  v_new_price integer;
  r record;
begin
  select * into e
  from app_private.notification_events ne
  where ne.id = p_event_id
  for update;

  if not found then
    raise exception 'M020_EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if e.status in ('EXPANDED', 'COMPLETED', 'PARTIAL', 'SKIPPED') then
    return;
  end if;

  if e.notification_type = 'FANBUS_TRIP_PUBLISHED' then
    select * into trip
    from app_modules.fanbus_trips x
    where x.id::text = e.entity_id;

    if not found then
      update app_private.notification_events
      set status = 'SKIPPED',
          last_error_code = 'SOURCE_ENTITY_NOT_FOUND',
          updated_at = now()
      where id = e.id;
      return;
    end if;

    select
      case
        when ev.event_type = 'GAME' and eg.home_away = 'AWAY'
          then coalesce(nullif(eg.opponent_name, ''), 'Auswärtsspiel') || ' – Mighty Dogs Schweinfurt'
        when ev.event_type = 'GAME' and eg.home_away = 'HOME'
          then 'Mighty Dogs Schweinfurt – ' || coalesce(nullif(eg.opponent_name, ''), 'Heimspiel')
        else coalesce(nullif(ev.title, ''), 'Fanbusfahrt')
      end,
      case
        when ev.event_type = 'GAME' and eg.home_away = 'AWAY'
          then 'Neue Auswärtsfahrt'
        else 'Neue Fanbusfahrt'
      end
    into v_trip_title, v_title
    from app_modules.events ev
    left join app_modules.event_games eg on eg.event_id = ev.id
    where ev.id = trip.event_id;

    v_trip_title := coalesce(v_trip_title, 'Auswärtsfahrt');
    v_title := coalesce(v_title, 'Neue Fanbusfahrt');
    v_route := '#/fanbuses?detail=' || trip.id::text;
    v_data := jsonb_build_object(
      'tripId', trip.id,
      'tripTitle', v_trip_title,
      'departureAt', trip.departure_at
    );

    for v_user_id in
      select u.id
      from app_portal.users u
      where u.status = 'ACTIVE'
        and u.id is distinct from e.actor_user_id
      order by u.id
    loop
      perform app_private.notification_add_user(
        e,
        v_user_id,
        v_title,
        v_trip_title || ' ist jetzt als Fanbusfahrt verfügbar.',
        'fanbus.trip_published',
        v_data,
        v_route,
        false,
        false,
        true
      );
    end loop;

  elsif e.notification_type = 'FANBUS_BUS_ASSIGNMENT_CHANGED' then
    select * into reg
    from app_modules.fanbus_registrations x
    where x.id::text = e.entity_id;

    if not found then
      update app_private.notification_events
      set status = 'SKIPPED',
          last_error_code = 'SOURCE_ENTITY_NOT_FOUND',
          updated_at = now()
      where id = e.id;
      return;
    end if;

    select * into contact
    from app_modules.fanbus_registrations x
    where x.booking_id = reg.booking_id
      and x.booking_role = 'PRIMARY'
    order by x.registered_at, x.id
    limit 1;

    if not found then
      contact := reg;
    end if;

    begin
      v_bus_id := nullif(e.payload ->> 'busId', '')::uuid;
    exception when others then
      v_bus_id := null;
    end;

    select b.label
    into v_bus_label
    from app_modules.fanbus_buses b
    where b.id = v_bus_id
      and b.trip_id = reg.trip_id;

    select case
      when ev.event_type = 'GAME' and eg.home_away = 'AWAY'
        then coalesce(nullif(eg.opponent_name, ''), 'Auswärtsspiel') || ' – Mighty Dogs Schweinfurt'
      when ev.event_type = 'GAME' and eg.home_away = 'HOME'
        then 'Mighty Dogs Schweinfurt – ' || coalesce(nullif(eg.opponent_name, ''), 'Heimspiel')
      else coalesce(nullif(ev.title, ''), 'Fanbusfahrt')
    end
    into v_trip_title
    from app_modules.events ev
    left join app_modules.event_games eg on eg.event_id = ev.id
    join app_modules.fanbus_trips ft on ft.event_id = ev.id
    where ft.id = reg.trip_id;

    v_trip_title := coalesce(v_trip_title, 'Fanbusfahrt');
    v_bus_label := coalesce(nullif(v_bus_label, ''), 'dem zugewiesenen Bus');
    v_affected_name := btrim(concat_ws(' ', reg.first_name, reg.last_name));
    v_route := '#/fanbuses?detail=' || reg.trip_id::text;
    v_data := jsonb_build_object(
      'tripId', reg.trip_id,
      'bookingId', reg.booking_id,
      'affectedName', v_affected_name,
      'tripTitle', v_trip_title,
      'busLabel', v_bus_label
    );

    if contact.portal_user_id is not null
       and contact.portal_user_id is distinct from e.actor_user_id then
      perform app_private.notification_add_user(
        e,
        contact.portal_user_id,
        'Fanbus – Buszuordnung geändert',
        v_affected_name || ' fährt bei ' || v_trip_title || ' in ' || v_bus_label || '.',
        'fanbus.bus_assignment_changed',
        v_data,
        v_route,
        false,
        false,
        true
      );
    end if;

  elsif e.notification_type = 'FANBUS_TRIP_PRICE_CHANGED' then
    select * into trip
    from app_modules.fanbus_trips x
    where x.id::text = e.entity_id;

    if not found then
      update app_private.notification_events
      set status = 'SKIPPED',
          last_error_code = 'SOURCE_ENTITY_NOT_FOUND',
          updated_at = now()
      where id = e.id;
      return;
    end if;

    begin
      v_old_price := (e.payload ->> 'oldPriceCents')::integer;
      v_new_price := (e.payload ->> 'newPriceCents')::integer;
    exception when others then
      v_old_price := null;
      v_new_price := trip.price_cents;
    end;

    select case
      when ev.event_type = 'GAME' and eg.home_away = 'AWAY'
        then coalesce(nullif(eg.opponent_name, ''), 'Auswärtsspiel') || ' – Mighty Dogs Schweinfurt'
      when ev.event_type = 'GAME' and eg.home_away = 'HOME'
        then 'Mighty Dogs Schweinfurt – ' || coalesce(nullif(eg.opponent_name, ''), 'Heimspiel')
      else coalesce(nullif(ev.title, ''), 'Fanbusfahrt')
    end
    into v_trip_title
    from app_modules.events ev
    left join app_modules.event_games eg on eg.event_id = ev.id
    where ev.id = trip.event_id;

    v_trip_title := coalesce(v_trip_title, 'Fanbusfahrt');

    for r in
      select distinct on (primary_reg.booking_id)
        primary_reg.booking_id,
        primary_reg.portal_user_id,
        primary_reg.email,
        primary_reg.first_name,
        primary_reg.last_name,
        primary_reg.trip_id
      from app_modules.fanbus_registrations affected
      join app_modules.fanbus_registrations primary_reg
        on primary_reg.booking_id = affected.booking_id
       and primary_reg.booking_role = 'PRIMARY'
      where affected.trip_id = trip.id
        and affected.status in ('ACTIVE', 'WAITLISTED')
      order by primary_reg.booking_id, primary_reg.registered_at, primary_reg.id
    loop
      v_route := '#/fanbuses?detail=' || r.trip_id::text;
      v_data := jsonb_build_object(
        'firstName', r.first_name,
        'lastName', r.last_name,
        'name', btrim(concat_ws(' ', r.first_name, r.last_name)),
        'tripTitle', v_trip_title,
        'tripId', r.trip_id,
        'bookingId', r.booking_id,
        'oldPriceCents', v_old_price,
        'newPriceCents', v_new_price
      );

      if app_private.notification_email_is_valid(r.email) then
        perform app_private.notification_add_external_email(
          e,
          r.email,
          case when r.portal_user_id is null then 'EXTERNAL_EMAIL' else 'USER' end,
          'fanbus-booking:' || r.booking_id::text || ':contact',
          'fanbus.trip_price_changed',
          v_data,
          case when r.portal_user_id is null then '' else v_route end,
          true
        );
      end if;

      if r.portal_user_id is not null
         and r.portal_user_id is distinct from e.actor_user_id then
        perform app_private.notification_add_user(
          e,
          r.portal_user_id,
          'Fanbus – Preis geändert',
          'Der Fahrtpreis für ' || v_trip_title || ' wurde geändert.',
          'fanbus.trip_price_changed',
          v_data,
          v_route,
          false,
          false,
          true
        );
      end if;
    end loop;

  elsif e.notification_type in (
    'DATE_EVENT_CREATED',
    'DATE_EVENT_CHANGED',
    'DATE_EVENT_DELETED',
    'DATE_ICS_IMPORT_SUMMARY'
  ) then
    v_route := '#/dates';

    if e.notification_type = 'DATE_ICS_IMPORT_SUMMARY' then
      begin
        v_created := greatest(coalesce((e.payload ->> 'createdCount')::integer, 0), 0);
      exception when others then
        v_created := 0;
      end;
      begin
        v_updated := greatest(coalesce((e.payload ->> 'updatedCount')::integer, 0), 0);
      exception when others then
        v_updated := 0;
      end;

      v_title := 'Spielplan aktualisiert';
      v_body := v_created::text || ' neu, ' || v_updated::text || ' geändert.';
      v_data := jsonb_build_object(
        'createdCount', v_created,
        'updatedCount', v_updated
      );
    else
      v_data := e.payload;
      v_trip_title := coalesce(nullif(e.payload ->> 'displayTitle', ''), 'Termin');

      if e.notification_type = 'DATE_EVENT_CREATED' then
        v_title := 'Neuer Termin';
        v_body := v_trip_title || ' wurde eingetragen.';
      elsif e.notification_type = 'DATE_EVENT_CHANGED' then
        v_title := 'Termin geändert';
        v_body := v_trip_title || ' wurde geändert.';
      else
        v_title := 'Termin entfernt';
        v_body := v_trip_title || ' wurde aus dem Kalender entfernt.';
      end if;
    end if;

    for v_user_id in
      select u.id
      from app_portal.users u
      where u.status = 'ACTIVE'
        and u.id is distinct from e.actor_user_id
      order by u.id
    loop
      perform app_private.notification_add_user(
        e,
        v_user_id,
        v_title,
        v_body,
        case e.notification_type
          when 'DATE_EVENT_CREATED' then 'dates.created'
          when 'DATE_EVENT_CHANGED' then 'dates.changed'
          when 'DATE_EVENT_DELETED' then 'dates.deleted'
          else 'dates.ics_summary'
        end,
        v_data,
        v_route,
        false,
        false,
        true
      );
    end loop;

  else
    update app_private.notification_events
    set status = 'SKIPPED',
        last_error_code = 'NOTIFICATION_TYPE_UNSUPPORTED',
        updated_at = now()
    where id = e.id;
    return;
  end if;

  update app_private.notification_events
  set status = case
        when exists(
          select 1
          from app_private.notification_outbox o
          where o.event_id = e.id
        ) then 'EXPANDED'
        else 'SKIPPED'
      end,
      expanded_at = coalesce(expanded_at, now()),
      last_error_code = case
        when exists(
          select 1
          from app_private.notification_outbox o
          where o.event_id = e.id
        ) then ''
        else 'NO_RECIPIENTS'
      end,
      updated_at = now()
  where id = e.id;

  if exists(
    select 1
    from app_private.notification_outbox o
    where o.event_id = e.id
  ) then
    perform app_private.notification_refresh_event_status(e.id);
  end if;
end;
$function$;


-- R1 Claim-/Retry-Semantik bleibt unverändert; nur die neuen R2-Typen werden
-- an den zusätzlichen Expander delegiert.
create or replace function app_private.notification_expand_pending_events(
  p_limit integer default 25
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r record;
  v_count integer := 0;
begin
  for r in
    select ne.id, ne.notification_type
    from app_private.notification_events ne
    where ne.status in ('PENDING','PROCESSING')
      and ne.next_attempt_at <= now()
      and (
        ne.status='PENDING'
        or ne.claim_expires_at is null
        or ne.claim_expires_at <= now()
      )
    order by ne.created_at,ne.id
    for update skip locked
    limit least(greatest(coalesce(p_limit,25),1),100)
  loop
    update app_private.notification_events
    set status='PROCESSING',attempt_count=attempt_count+1,
        claim_token=extensions.gen_random_uuid(),claimed_at=now(),
        claim_expires_at=now()+interval '10 minutes',updated_at=now()
    where id=r.id;

    begin
      if r.notification_type in (
        'FANBUS_TRIP_PUBLISHED',
        'FANBUS_BUS_ASSIGNMENT_CHANGED',
        'FANBUS_TRIP_PRICE_CHANGED',
        'DATE_EVENT_CREATED',
        'DATE_EVENT_CHANGED',
        'DATE_EVENT_DELETED',
        'DATE_ICS_IMPORT_SUMMARY'
      ) then
        perform app_private.notification_expand_r2_event(r.id);
      else
        perform app_private.notification_expand_event(r.id);
      end if;
      v_count:=v_count+1;
    exception when others then
      update app_private.notification_events
      set status=case when attempt_count>=5 then 'FAILED' else 'PENDING' end,
          next_attempt_at=case
            when attempt_count=1 then now()+interval '1 minute'
            when attempt_count=2 then now()+interval '5 minutes'
            when attempt_count=3 then now()+interval '30 minutes'
            when attempt_count=4 then now()+interval '2 hours'
            else now()+interval '12 hours'
          end,
          last_error_code='EXPANSION_FAILED',
          claim_token=null,claimed_at=null,claim_expires_at=null,updated_at=now()
      where id=r.id;
    end;
  end loop;
  return v_count;
end;
$function$;


-- Exakter R1-Claim-Vertrag; einzige fachliche Änderung ist die Badge-Zählung über
-- notification_unread_count(), damit verwaiste Zielobjekte nicht mitzählen.
create or replace function public.pd_notification_claim_batch(
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb;
  r record;
begin
  perform app_private.notification_expand_pending_events(50);

  update app_private.notification_outbox o
  set status='RETRY', claim_token=null, claimed_at=null, claim_expires_at=null,
      next_attempt_at=now(), last_error_code='CLAIM_EXPIRED', updated_at=now()
  where o.status='PROCESSING'
    and o.claim_expires_at <= now()
    and o.attempt_count < o.max_attempts;

  update app_private.notification_outbox o
  set status='FAILED', claim_token=null, claimed_at=null, claim_expires_at=null,
      last_error_code='MAX_ATTEMPTS_REACHED', updated_at=now()
  where o.status='PROCESSING'
    and o.claim_expires_at <= now()
    and o.attempt_count >= o.max_attempts;

  update app_private.notification_outbox o
  set status='SKIPPED', last_error_code='DELIVERY_EXPIRED', updated_at=now()
  where o.status in ('PENDING','RETRY')
    and o.expires_at <= now();

  update app_private.notification_outbox o
  set status='SKIPPED',last_error_code='PUSH_SUBSCRIPTION_INACTIVE',updated_at=now()
  where o.channel='PUSH'
    and o.status in ('PENDING','RETRY')
    and not exists (
      select 1 from app_portal.push_subscriptions ps
      where ps.id=o.push_subscription_id and ps.is_active=true
    );

  for r in
    select ne.id
    from app_private.notification_events ne
    where ne.status='EXPANDED'
      and exists (
        select 1 from app_private.notification_outbox o where o.event_id=ne.id
      )
      and not exists (
        select 1 from app_private.notification_outbox o
        where o.event_id=ne.id and o.status in ('PENDING','PROCESSING','RETRY')
      )
  loop
    perform app_private.notification_refresh_event_status(r.id);
  end loop;

  with candidates as (
    select o.id
    from app_private.notification_outbox o
    where o.status in ('PENDING','RETRY')
      and o.next_attempt_at <= now()
      and o.expires_at > now()
    order by o.created_at,o.id
    for update skip locked
    limit least(greatest(coalesce(p_limit,20),1),50)
  ),
  claimed as (
    update app_private.notification_outbox o
    set status='PROCESSING',
        attempt_count=o.attempt_count+1,
        claim_token=extensions.gen_random_uuid(),
        claimed_at=now(),
        claim_expires_at=now()+interval '10 minutes',
        updated_at=now()
    from candidates c
    where o.id=c.id
    returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'outboxId',c.id,
    'claimToken',c.claim_token,
    'eventId',c.event_id,
    'notificationType',c.notification_type,
    'category',c.category,
    'channel',c.channel,
    'recipientAddress',case when c.channel='EMAIL' then c.recipient_address else null end,
    'push',case when c.channel='PUSH' then (
      select jsonb_build_object(
        'subscriptionId',ps.id,
        'endpoint',ps.endpoint,
        'p256dh',ps.p256dh,
        'auth',ps.auth_key
      )
      from app_portal.push_subscriptions ps
      where ps.id=c.push_subscription_id and ps.is_active=true
    ) else null end,
    'payload',c.payload,
    'deepLink',c.deep_link,
    'attemptCount',c.attempt_count,
    'maxAttempts',c.max_attempts,
    'badgeCount',case
      when c.recipient_user_id is null then 0
      when not coalesce((
        select np.badge_enabled from app_portal.notification_preferences np
        where np.user_id=c.recipient_user_id
      ),true) then 0
      else app_private.notification_unread_count(c.recipient_user_id)
    end
  ) order by c.created_at,c.id),'[]'::jsonb)
  into v_rows
  from claimed c;

  return v_rows;
end;
$function$;


-- Neue private Helfer sind nicht direkt über PostgREST aufrufbar.
revoke execute on function app_private.notification_projection_actionable(text, text)
  from public, anon, authenticated, service_role;
revoke execute on function app_private.notification_unread_count(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function app_private.notification_push_preference_enabled(uuid, text, text, text, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function app_private.m020_r2_audit_notification_trigger()
  from public, anon, authenticated, service_role;
revoke execute on function app_private.notification_expand_r2_event(uuid)
  from public, anon, authenticated, service_role;
