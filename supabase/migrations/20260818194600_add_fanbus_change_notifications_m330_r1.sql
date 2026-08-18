-- P300 / M330-R1 – M020/M210-Erweiterung für Fahrtabsage und Terminänderungen
-- Keine neue Queue, kein neuer Provider und keine neue Notification-Edge-Function.

alter table app_portal.notification_preferences
  add column push_fanbus_trip_cancellations boolean not null default true;

-- Die bestehende persönliche Stornierungspräferenz fanbus.cancelled bleibt
-- unverändert. Nur fanbus.trip_cancelled wird auf das additive Feld abgebildet.
alter function app_private.notification_push_preference_enabled(
  uuid, text, text, text, jsonb
) rename to notification_push_preference_enabled_before_m330_r1;

create function app_private.notification_push_preference_enabled(
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
  v_enabled boolean;
begin
  if lower(btrim(coalesce(p_template_key, ''))) = 'fanbus.trip_cancelled' then
    if p_category <> 'FANBUS'
       or not app_private.notification_preference_enabled(
         p_user_id, p_category, 'PUSH', p_event_type
       ) then
      return false;
    end if;

    select preference.push_fanbus_trip_cancellations
    into v_enabled
    from app_portal.notification_preferences as preference
    where preference.user_id = p_user_id;

    return coalesce(v_enabled, false);
  end if;

  return app_private.notification_push_preference_enabled_before_m330_r1(
    p_user_id, p_category, p_event_type, p_template_key, p_payload
  );
end;
$function$;

alter function app_private.api_push_snapshot()
  rename to api_push_snapshot_before_m330_r1;

create function app_private.api_push_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_value boolean;
begin
  v_result := app_private.api_push_snapshot_before_m330_r1();

  select preference.push_fanbus_trip_cancellations
  into v_value
  from app_portal.notification_preferences as preference
  where preference.user_id = auth.uid();

  return jsonb_set(
    v_result,
    '{preferences,pushFanbusTripCancellations}',
    to_jsonb(coalesce(v_value, true)),
    true
  );
end;
$function$;

alter function app_private.api_save_notification_preferences(jsonb)
  rename to api_save_notification_preferences_before_m330_r1;

create function app_private.api_save_notification_preferences(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform app_private.api_save_notification_preferences_before_m330_r1(p_payload);

  update app_portal.notification_preferences
  set push_fanbus_trip_cancellations = coalesce(
    (p_payload ->> 'pushFanbusTripCancellations')::boolean,
    push_fanbus_trip_cancellations
  )
  where user_id = auth.uid();

  return app_private.api_push_snapshot();
exception when invalid_text_representation then
  raise exception 'PUSH_PREFERENCE_INVALID_VALUE' using errcode = '22023';
end;
$function$;

-- Ergänzt das bestehende M020-Audit-Routing ausschließlich um Metadaten für
-- dieselben DATE_EVENT_CHANGED/DATE_ICS_IMPORT_SUMMARY-Ereignisse.
create function app_private.m330_event_audit_notification_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_before_type text;
  v_after_type text;
  v_before_relevant jsonb;
  v_after_relevant jsonb;
  v_changed boolean;
begin
  if new.action = 'EVENT_UPDATED'
     and upper(btrim(coalesce(new.metadata ->> 'source', ''))) <> 'ICS_IMPORT' then
    v_before_type := upper(coalesce(
      new.before_data ->> 'event_type', new.before_data ->> 'eventType', ''
    ));
    v_after_type := upper(coalesce(
      new.after_data ->> 'event_type', new.after_data ->> 'eventType', ''
    ));

    v_before_relevant := jsonb_build_object(
      'eventDate', coalesce(new.before_data -> 'event_date', new.before_data -> 'eventDate'),
      'eventTime', coalesce(new.before_data -> 'event_time', new.before_data -> 'eventTime'),
      'venue', new.before_data -> 'venue',
      'title', new.before_data -> 'title',
      'opponentName', case when v_before_type = 'GAME' then new.before_data -> 'opponentName' end,
      'homeAway', case when v_before_type = 'GAME' then new.before_data -> 'homeAway' end
    );
    v_after_relevant := jsonb_build_object(
      'eventDate', coalesce(new.after_data -> 'event_date', new.after_data -> 'eventDate'),
      'eventTime', coalesce(new.after_data -> 'event_time', new.after_data -> 'eventTime'),
      'venue', new.after_data -> 'venue',
      'title', new.after_data -> 'title',
      'opponentName', case when v_after_type = 'GAME' then new.after_data -> 'opponentName' end,
      'homeAway', case when v_after_type = 'GAME' then new.after_data -> 'homeAway' end
    );
    v_changed := v_before_relevant is distinct from v_after_relevant;

    update app_private.notification_events
    set payload = payload || jsonb_build_object(
          'fanbusRelevantChanged', v_changed,
          'changedEventIds', jsonb_build_array(new.entity_id)
        ),
        updated_at = now()
    where notification_type = 'DATE_EVENT_CHANGED'
      and event_key = 'audit:' || new.id::text;

  elsif new.action = 'EVENT_ICS_IMPORT_CONFIRMED' then
    update app_private.notification_events
    set payload = payload || jsonb_build_object(
          'changedEventIds', coalesce(new.after_data -> 'changedEventIds', '[]'::jsonb)
        ),
        updated_at = now()
    where notification_type = 'DATE_ICS_IMPORT_SUMMARY'
      and event_key = 'audit:' || new.id::text;
  end if;

  return new;
end;
$function$;

drop trigger if exists m330_event_audit_notification_context on app_portal.audit_events;
create trigger m330_event_audit_notification_context
after insert on app_portal.audit_events
for each row execute function app_private.m330_event_audit_notification_context();

create function app_private.notification_expand_m330_event(
  p_event_id uuid,
  p_cancellation boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  e app_private.notification_events%rowtype;
  trip app_modules.fanbus_trips%rowtype;
  v_event_ids uuid[] := array[]::uuid[];
  v_trip_title text;
  v_event_date date;
  v_route text;
  v_email_data jsonb;
  v_push_data jsonb;
  r record;
begin
  select event.*
  into e
  from app_private.notification_events as event
  where event.id = p_event_id
  for update;

  if not found then
    raise exception 'M020_EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_cancellation then
    if e.notification_type <> 'FANBUS_TRIP_CANCELLED' then
      raise exception 'M020_NOTIFICATION_TYPE_UNSUPPORTED' using errcode = '22023';
    end if;

    select source_trip.*
    into trip
    from app_modules.fanbus_trips as source_trip
    where source_trip.id::text = e.entity_id;

    if not found or trip.status <> 'CANCELLED' then
      update app_private.notification_events
      set status = 'SKIPPED',
          last_error_code = 'SOURCE_ENTITY_NOT_FOUND',
          updated_at = now()
      where id = e.id;
      return;
    end if;

    select
      case
        when event.event_type = 'GAME' and game.home_away = 'AWAY'
          then coalesce(nullif(game.opponent_name, ''), 'Auswärtsspiel') || ' – Mighty Dogs Schweinfurt'
        when event.event_type = 'GAME' and game.home_away = 'HOME'
          then 'Mighty Dogs Schweinfurt – ' || coalesce(nullif(game.opponent_name, ''), 'Heimspiel')
        else coalesce(nullif(event.title, ''), 'Fanbusfahrt')
      end,
      event.event_date
    into v_trip_title, v_event_date
    from app_modules.events as event
    left join app_modules.event_games as game on game.event_id = event.id
    where event.id = trip.event_id;

    v_trip_title := coalesce(v_trip_title, 'Fanbusfahrt');
    v_route := '#/fanbuses?detail=' || trip.id::text;
    v_push_data := jsonb_build_object(
      'tripId', trip.id,
      'tripTitle', v_trip_title,
      'eventDate', v_event_date,
      'cancellationReason', trip.cancellation_reason
    );

    for r in
      select distinct on (primary_registration.booking_id)
        primary_registration.booking_id,
        primary_registration.portal_user_id,
        primary_registration.email,
        primary_registration.first_name,
        primary_registration.last_name
      from app_modules.fanbus_registrations as affected
      join app_modules.fanbus_registrations as primary_registration
        on primary_registration.booking_id = affected.booking_id
       and primary_registration.booking_role = 'PRIMARY'
      where affected.trip_id = trip.id
        and affected.status in ('ACTIVE', 'WAITLISTED')
      order by primary_registration.booking_id,
        primary_registration.registered_at,
        primary_registration.id
    loop
      v_email_data := jsonb_build_object(
        'firstName', r.first_name,
        'lastName', r.last_name,
        'name', btrim(concat_ws(' ', r.first_name, r.last_name)),
        'tripId', trip.id,
        'tripTitle', v_trip_title,
        'eventDate', v_event_date,
        'bookingId', r.booking_id,
        'cancellationReason', trip.cancellation_reason
      );

      if app_private.notification_email_is_valid(r.email) then
        perform app_private.notification_add_external_email(
          e,
          r.email,
          case when r.portal_user_id is null then 'EXTERNAL_EMAIL' else 'USER' end,
          'fanbus-booking:' || r.booking_id::text || ':contact',
          'fanbus.trip_cancelled',
          v_email_data,
          case when r.portal_user_id is null then '' else v_route end,
          true
        );
      end if;

      if r.portal_user_id is not null then
        perform app_private.notification_add_user(
          e,
          r.portal_user_id,
          'Fanbusfahrt abgesagt',
          v_trip_title || ' am ' || to_char(v_event_date, 'DD.MM.YYYY') || ' wurde abgesagt.',
          'fanbus.trip_cancelled',
          v_push_data,
          v_route,
          false,
          false,
          true
        );
      end if;
    end loop;

  elsif e.notification_type in ('DATE_EVENT_CHANGED', 'DATE_ICS_IMPORT_SUMMARY') then
    if e.notification_type = 'DATE_EVENT_CHANGED'
       and coalesce((e.payload ->> 'fanbusRelevantChanged')::boolean, false) = false then
      return;
    end if;

    begin
      select coalesce(array_agg(value::uuid), array[]::uuid[])
      into v_event_ids
      from jsonb_array_elements_text(
        coalesce(e.payload -> 'changedEventIds', '[]'::jsonb)
      );
    exception when others then
      v_event_ids := array[]::uuid[];
    end;

    for r in
      select distinct on (primary_registration.booking_id)
        primary_registration.booking_id,
        primary_registration.portal_user_id,
        primary_registration.email,
        primary_registration.first_name,
        primary_registration.last_name,
        source_trip.id as trip_id,
        source_event.event_date,
        case
          when source_event.event_type = 'GAME' and game.home_away = 'AWAY'
            then coalesce(nullif(game.opponent_name, ''), 'Auswärtsspiel') || ' – Mighty Dogs Schweinfurt'
          when source_event.event_type = 'GAME' and game.home_away = 'HOME'
            then 'Mighty Dogs Schweinfurt – ' || coalesce(nullif(game.opponent_name, ''), 'Heimspiel')
          else coalesce(nullif(source_event.title, ''), 'Fanbusfahrt')
        end as trip_title
      from app_modules.fanbus_trips as source_trip
      join app_modules.events as source_event on source_event.id = source_trip.event_id
      left join app_modules.event_games as game on game.event_id = source_event.id
      join app_modules.fanbus_registrations as affected
        on affected.trip_id = source_trip.id
       and affected.status in ('ACTIVE', 'WAITLISTED')
      join app_modules.fanbus_registrations as primary_registration
        on primary_registration.booking_id = affected.booking_id
       and primary_registration.booking_role = 'PRIMARY'
      where source_trip.status in ('PUBLISHED', 'CLOSED')
        and source_trip.event_id = any(v_event_ids)
      order by primary_registration.booking_id,
        primary_registration.registered_at,
        primary_registration.id
    loop
      if app_private.notification_email_is_valid(r.email) then
        perform app_private.notification_add_external_email(
          e,
          r.email,
          case when r.portal_user_id is null then 'EXTERNAL_EMAIL' else 'USER' end,
          'fanbus-booking:' || r.booking_id::text || ':event-change',
          'fanbus.linked_event_changed',
          jsonb_build_object(
            'firstName', r.first_name,
            'lastName', r.last_name,
            'name', btrim(concat_ws(' ', r.first_name, r.last_name)),
            'tripId', r.trip_id,
            'tripTitle', r.trip_title,
            'eventDate', r.event_date,
            'bookingId', r.booking_id
          ),
          case when r.portal_user_id is null
            then '' else '#/fanbuses?detail=' || r.trip_id::text end,
          true
        );
      end if;
    end loop;
  end if;

  update app_private.notification_events
  set status = case
        when exists (
          select 1 from app_private.notification_outbox as outbox
          where outbox.event_id = e.id
        ) then 'EXPANDED'
        else 'SKIPPED'
      end,
      expanded_at = coalesce(expanded_at, now()),
      last_error_code = case
        when exists (
          select 1 from app_private.notification_outbox as outbox
          where outbox.event_id = e.id
        ) then '' else 'NO_RECIPIENTS'
      end,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      updated_at = now()
  where id = e.id;

  if exists (
    select 1 from app_private.notification_outbox as outbox
    where outbox.event_id = e.id
  ) then
    perform app_private.notification_refresh_event_status(e.id);
  end if;
end;
$function$;

-- Bestehende R2-Expansion zuerst unverändert ausführen und danach nur die
-- notwendigen Fanbus-E-Mails an dasselbe DATE-Ereignis anhängen.
alter function app_private.notification_expand_r2_event(uuid)
  rename to notification_expand_r2_event_before_m330_r1;

create function app_private.notification_expand_r2_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_type text;
begin
  select notification_type into v_type
  from app_private.notification_events
  where id = p_event_id;

  perform app_private.notification_expand_r2_event_before_m330_r1(p_event_id);

  if v_type in ('DATE_EVENT_CHANGED', 'DATE_ICS_IMPORT_SUMMARY') then
    perform app_private.notification_expand_m330_event(p_event_id, false);
  end if;
end;
$function$;

-- R1/R2 Retry- und Claim-Vertrag bleibt unverändert; nur der neue Typ wird an
-- den M330-Expander delegiert.
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
    select event.id, event.notification_type
    from app_private.notification_events as event
    where event.status in ('PENDING', 'PROCESSING')
      and event.next_attempt_at <= now()
      and (
        event.status = 'PENDING'
        or event.claim_expires_at is null
        or event.claim_expires_at <= now()
      )
    order by event.created_at, event.id
    for update skip locked
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  loop
    update app_private.notification_events
    set status = 'PROCESSING',
        attempt_count = attempt_count + 1,
        claim_token = extensions.gen_random_uuid(),
        claimed_at = now(),
        claim_expires_at = now() + interval '10 minutes',
        updated_at = now()
    where id = r.id;

    begin
      if r.notification_type = 'FANBUS_TRIP_CANCELLED' then
        perform app_private.notification_expand_m330_event(r.id, true);
      elsif r.notification_type in (
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
      v_count := v_count + 1;
    exception when others then
      update app_private.notification_events
      set status = case when attempt_count >= 5 then 'FAILED' else 'PENDING' end,
          next_attempt_at = case
            when attempt_count = 1 then now() + interval '1 minute'
            when attempt_count = 2 then now() + interval '5 minutes'
            when attempt_count = 3 then now() + interval '30 minutes'
            when attempt_count = 4 then now() + interval '2 hours'
            else now() + interval '12 hours'
          end,
          last_error_code = 'EXPANSION_FAILED',
          claim_token = null,
          claimed_at = null,
          claim_expires_at = null,
          updated_at = now()
      where id = r.id;
    end;
  end loop;
  return v_count;
end;
$function$;

-- M210 Visibility Guard mit derselben Lock-Reihenfolge wie Fanbus-Mutationen.
alter function app_private.api_event_update(jsonb)
  rename to api_event_update_before_m330_r1;

create function app_private.api_event_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
  v_trip_id uuid;
  v_visibility text;
begin
  perform app_private.require_capability('events.manage');
  begin
    v_event_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_visibility := upper(btrim(coalesce(p_payload ->> 'visibility', '')));
  exception when others then
    return app_private.api_event_update_before_m330_r1(p_payload);
  end;

  select trip.id
  into v_trip_id
  from app_modules.fanbus_trips as trip
  where trip.event_id = v_event_id;

  if v_trip_id is not null then
    perform 1
    from app_modules.fanbus_trips as trip
    where trip.id = v_trip_id
    for update;

    if v_visibility = 'INTERNAL'
       and exists (
         select 1
         from app_modules.fanbus_trips as trip
         where trip.id = v_trip_id and trip.status = 'PUBLISHED'
       ) then
      raise exception 'EVENT_PUBLIC_VISIBILITY_REQUIRED_BY_FANBUS'
        using errcode = 'P3303';
    end if;
  end if;

  return app_private.api_event_update_before_m330_r1(p_payload);
end;
$function$;

-- Die vorhandene ICS-Funktion bleibt autoritativ. Der Wrapper übernimmt nur
-- fanbusrelevante EVENT_UPDATED-Audits desselben Confirm-Laufs in Summary/Audit.
alter function public.m210_ics_import_confirm(
  uuid, text, text, text, text, integer, jsonb, jsonb, text
) rename to m210_ics_import_confirm_before_m330_r1;

create function public.m210_ics_import_confirm(
  p_actor uuid,
  p_source_type text,
  p_source_key text,
  p_original_filename text,
  p_file_sha256 text,
  p_file_size integer,
  p_records jsonb,
  p_expected_state jsonb,
  p_preview_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_changed_ids jsonb;
  v_audit_floor bigint;
  v_audit_id bigint;
begin
  -- Derselbe Quellen-Lock wie im autoritativen M210-Confirm.
  -- Wichtig: vor v_audit_floor, damit parallele Imports derselben Quelle
  -- keine EVENT_UPDATED-Audits des vorherigen Laufs einsammeln.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_source_type || ':' || p_source_key, 210)
  );

  select coalesce(max(audit.id), 0)
  into v_audit_floor
  from app_portal.audit_events as audit;

  v_result := public.m210_ics_import_confirm_before_m330_r1(
    p_actor,
    p_source_type,
    p_source_key,
    p_original_filename,
    p_file_sha256,
    p_file_size,
    p_records,
    p_expected_state,
    p_preview_fingerprint
  );

  -- Nur tatsächlich fanbusrelevante ICS-Änderungen übernehmen.
  -- EVENT_UPDATED-Audits aus genau diesem Confirm-Lauf sind die bestehende
  -- Fachwahrheit; reine endDate/endTime-Änderungen bleiben außen vor.
  select coalesce(jsonb_agg(audit.entity_id), '[]'::jsonb)
  into v_changed_ids
  from app_portal.audit_events as audit
  where audit.id > v_audit_floor
    and audit.action = 'EVENT_UPDATED'
    and audit.entity_type = 'event'
    and upper(btrim(coalesce(audit.metadata ->> 'source', ''))) = 'ICS_IMPORT'
    and coalesce(audit.metadata ->> 'sourceType', '') = p_source_type
    and coalesce(audit.metadata ->> 'sourceKey', '') = p_source_key
    and (
      audit.before_data -> 'eventDate'
        is distinct from audit.after_data -> 'eventDate'
      or audit.before_data -> 'eventTime'
        is distinct from audit.after_data -> 'eventTime'
      or audit.before_data -> 'venue'
        is distinct from audit.after_data -> 'venue'
      or audit.before_data -> 'homeAway'
        is distinct from audit.after_data -> 'homeAway'
      or audit.before_data -> 'opponentName'
        is distinct from audit.after_data -> 'opponentName'
    );

  select audit.id
  into v_audit_id
  from app_portal.audit_events as audit
  where audit.action = 'EVENT_ICS_IMPORT_CONFIRMED'
    and audit.entity_type = 'event_import_run'
    and audit.entity_id = v_result ->> 'runId'
  order by audit.id desc
  limit 1;

  if v_audit_id is not null then
    update app_portal.audit_events
    set after_data = coalesce(after_data, '{}'::jsonb)
      || jsonb_build_object('changedEventIds', v_changed_ids)
    where id = v_audit_id;

    update app_private.notification_events
    set payload = payload || jsonb_build_object('changedEventIds', v_changed_ids),
        updated_at = now()
    where notification_type = 'DATE_ICS_IMPORT_SUMMARY'
      and event_key = 'audit:' || v_audit_id::text;
  end if;

  return v_result;
end;
$function$;

revoke all on function app_private.notification_push_preference_enabled(
  uuid, text, text, text, jsonb
),
  app_private.notification_push_preference_enabled_before_m330_r1(
    uuid, text, text, text, jsonb
  ),
  app_private.api_push_snapshot(),
  app_private.api_push_snapshot_before_m330_r1(),
  app_private.api_save_notification_preferences(jsonb),
  app_private.api_save_notification_preferences_before_m330_r1(jsonb),
  app_private.m330_event_audit_notification_context(),
  app_private.notification_expand_m330_event(uuid, boolean),
  app_private.notification_expand_r2_event(uuid),
  app_private.notification_expand_r2_event_before_m330_r1(uuid),
  app_private.notification_expand_pending_events(integer),
  app_private.api_event_update(jsonb),
  app_private.api_event_update_before_m330_r1(jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.m210_ics_import_confirm_before_m330_r1(
  uuid, text, text, text, text, integer, jsonb, jsonb, text
)
from public, anon, authenticated, service_role;
revoke all on function public.m210_ics_import_confirm(
  uuid, text, text, text, text, integer, jsonb, jsonb, text
)
from public, anon, authenticated;
grant execute on function public.m210_ics_import_confirm(
  uuid, text, text, text, text, integer, jsonb, jsonb, text
) to service_role;
