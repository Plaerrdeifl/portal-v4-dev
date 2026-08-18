\set ON_ERROR_STOP on

begin;

select plan(1);

do $m020_r2_behavior$
declare
  v_actor uuid := '00000000-0000-4020-8000-000000000201';
  v_user uuid := '00000000-0000-4020-8000-000000000202';
  v_event uuid;
  v_event2 uuid;
  v_trip uuid;
  v_booking uuid;
  v_registration uuid;
  v_bus uuid;
  v_audit bigint;
  v_key text;
begin
  -- ----------------------------------------------------------
  -- 1. R2-Präferenzschema
  -- ----------------------------------------------------------
  if (
    select count(*)
    from information_schema.columns
    where table_schema='app_portal'
      and table_name='notification_preferences'
      and column_name = any(array[
        'push_membership_applications',
        'push_access_requests',
        'push_own_account_status',
        'push_fanbus_new_trips',
        'push_fanbus_own_bookings',
        'push_fanbus_waitlist',
        'push_fanbus_cancellations',
        'push_fanbus_times',
        'push_fanbus_boarding',
        'push_fanbus_bus_assignment',
        'push_fanbus_price_changes',
        'push_fanbus_org_bookings',
        'push_fanbus_org_cancellations',
        'push_dates_new',
        'push_dates_changes',
        'push_dates_deleted'
      ])
  ) <> 16 then
    raise exception 'M020-R2: granulare Präferenzspalten fehlen.';
  end if;

  if has_function_privilege(
       'authenticated',
       'app_private.notification_push_preference_enabled(uuid,text,text,text,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'app_private.notification_unread_count(uuid)',
       'EXECUTE'
     ) then
    raise exception 'M020-R2: private Helper sind browser-ausführbar.';
  end if;

  -- ----------------------------------------------------------
  -- 2. Testbenutzer + Push-Gerät
  -- ----------------------------------------------------------
  insert into auth.users(id,email)
  values
    (v_actor, 'm020-r2-actor@example.invalid'),
    (v_user,  'm020-r2-recipient@example.invalid');

  insert into app_portal.users(
    id,user_code,email,first_name,last_name,status,role_id
  )
  values
    (
      v_actor,'U-M020-R2-ACTOR',
      'm020-r2-actor@example.invalid',
      'M020','Actor','ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    ),
    (
      v_user,'U-M020-R2-USER',
      'm020-r2-recipient@example.invalid',
      'M020','Recipient','ACTIVE',
      '00000000-0000-4000-8000-000000000003'
    );

  insert into app_portal.notification_preferences(
    user_id,
    push_enabled,
    push_account_membership,
    push_fanbus,
    push_dates,
    email_fanbus
  )
  values (
    v_user,
    true,
    true,
    true,
    true,
    false
  );

  insert into app_portal.push_subscriptions(
    user_id,endpoint,p256dh,auth_key,device_label,user_agent
  )
  values (
    v_user,
    'https://push.example.invalid/m020-r2-recipient-device',
    repeat('p',32),
    repeat('a',16),
    'M020 R2 Testgerät',
    'M020-R2-Test'
  );

  -- ----------------------------------------------------------
  -- 3. Konto-Unterpräferenz
  -- ----------------------------------------------------------
  update app_portal.notification_preferences
  set push_membership_applications=false
  where user_id=v_user;

  if app_private.notification_push_preference_enabled(
       v_user,
       'ACCOUNT_MEMBERSHIP',
       'MEMBERSHIP_APPLICATION_INTERNAL_NEW',
       'membership.internal_new',
       '{}'::jsonb
     ) then
    raise exception 'M020-R2: deaktivierter Mitgliedsantrag-Push bleibt aktiv.';
  end if;

  update app_portal.notification_preferences
  set push_membership_applications=true
  where user_id=v_user;

  if not app_private.notification_push_preference_enabled(
       v_user,
       'ACCOUNT_MEMBERSHIP',
       'MEMBERSHIP_APPLICATION_INTERNAL_NEW',
       'membership.internal_new',
       '{}'::jsonb
     ) then
    raise exception 'M020-R2: aktivierter Mitgliedsantrag-Push bleibt aus.';
  end if;

  -- ----------------------------------------------------------
  -- 4. Reale Auswärtsfahrt + Buchung
  -- ----------------------------------------------------------
  insert into app_modules.events(
    event_type,event_date,event_time,venue,visibility,
    created_by,updated_by
  )
  values (
    'GAME',date '2026-12-20',time '18:00',
    'Amberg','PUBLIC',v_actor,v_actor
  )
  returning id into v_event;

  insert into app_modules.event_games(
    event_id,home_away,opponent_name
  )
  values (
    v_event,'AWAY','ERSC Amberg'
  );

  insert into app_modules.fanbus_trips(
    event_id,
    departure_at,
    price_cents,
    capacity,
    status,
    privacy_reference,
    terms_reference,
    created_by,
    updated_by
  )
  values (
    v_event,
    timestamptz '2026-12-20 12:00:00+01',
    1500,
    50,
    'PUBLISHED',
    'https://example.invalid/privacy',
    'https://example.invalid/terms',
    v_actor,
    v_actor
  )
  returning id into v_trip;

  insert into app_modules.fanbus_bookings(
    trip_id,source,created_by
  )
  values (
    v_trip,'PORTAL',v_user
  )
  returning id into v_booking;

  insert into app_modules.fanbus_registrations(
    trip_id,
    portal_user_id,
    first_name,
    last_name,
    email,
    bus_preference,
    status,
    privacy_reference,
    terms_reference,
    privacy_accepted_at,
    terms_accepted_at,
    created_by,
    updated_by,
    source,
    booking_id,
    booking_role,
    participant_sequence
  )
  values (
    v_trip,
    v_user,
    'M020',
    'Recipient',
    'm020-r2-recipient@example.invalid',
    'EGAL',
    'ACTIVE',
    'https://example.invalid/privacy',
    'https://example.invalid/terms',
    now(),
    now(),
    v_user,
    v_user,
    'PORTAL',
    v_booking,
    'PRIMARY',
    1
  )
  returning id into v_registration;

  insert into app_modules.fanbus_buses(
    trip_id,label,category,capacity,created_by,updated_by
  )
  values (
    v_trip,'Bus 1','NORMAL',50,v_actor,v_actor
  )
  returning id into v_bus;

  insert into app_modules.fanbus_bus_assignments(
    participant_id,trip_id,bus_id,created_by,updated_by
  )
  values (
    v_registration,v_trip,v_bus,v_actor,v_actor
  );

  -- R1-Buchungsereignis aus Fixture entfernen.
  delete from app_private.notification_outbox;
  delete from app_private.notification_events;
  delete from app_portal.notifications
  where user_id in (v_actor,v_user);

  -- ----------------------------------------------------------
  -- 5. Neue veröffentlichte Auswärtsfahrt → Push
  -- ----------------------------------------------------------
  insert into app_portal.audit_events(
    actor_user_id,action,entity_type,entity_id,
    before_data,after_data,metadata
  )
  values (
    v_actor,
    'FANBUS_TRIP_PUBLISHED',
    'fanbus_trip',
    v_trip::text,
    jsonb_build_object(
      'status','DRAFT',
      'eventId',v_event,
      'revision',1
    ),
    jsonb_build_object(
      'status','PUBLISHED',
      'eventId',v_event,
      'revision',2
    ),
    '{}'::jsonb
  )
  returning id into v_audit;

  v_key := 'audit:' || v_audit::text;

  if not exists (
    select 1
    from app_private.notification_events
    where event_key=v_key
      and category='FANBUS'
  ) then
    raise exception 'M020-R2: Veröffentlichung erzeugt kein zentrales Event.';
  end if;

  perform app_private.notification_expand_pending_events(50);

  if not exists (
    select 1
    from app_private.notification_outbox
    where event_key=v_key
      and recipient_user_id=v_user
      and channel='PUSH'
      and preference_mode='OPTIONAL'
  ) then
    raise exception 'M020-R2: neue Auswärtsfahrt erzeugt keinen optionalen Push.';
  end if;

  if not exists (
    select 1
    from app_portal.notifications n
    join app_private.notification_events ne
      on n.event_key =
        'm020:' || ne.id::text || ':' || v_user::text
    where ne.event_key=v_key
      and n.user_id=v_user
  ) then
    raise exception 'M020-R2: neue Auswärtsfahrt fehlt in der Push-Projektion.';
  end if;

  -- ----------------------------------------------------------
  -- 6. Unterpräferenz „Neue Auswärtsfahrten“ AUS
  -- ----------------------------------------------------------
  update app_portal.notification_preferences
  set push_fanbus_new_trips=false
  where user_id=v_user;

  insert into app_portal.audit_events(
    actor_user_id,action,entity_type,entity_id,
    before_data,after_data,metadata
  )
  values (
    v_actor,
    'FANBUS_TRIP_PUBLISHED',
    'fanbus_trip',
    v_trip::text,
    jsonb_build_object(
      'status','DRAFT',
      'eventId',v_event,
      'revision',2
    ),
    jsonb_build_object(
      'status','PUBLISHED',
      'eventId',v_event,
      'revision',3
    ),
    '{}'::jsonb
  )
  returning id into v_audit;

  v_key := 'audit:' || v_audit::text;

  perform app_private.notification_expand_pending_events(50);

  if exists (
    select 1
    from app_private.notification_outbox
    where event_key=v_key
      and recipient_user_id=v_user
      and channel='PUSH'
  ) then
    raise exception 'M020-R2: deaktivierte neue Auswärtsfahrt erzeugt Push.';
  end if;

  if exists (
    select 1
    from app_portal.notifications n
    join app_private.notification_events ne
      on n.event_key =
        'm020:' || ne.id::text || ':' || v_user::text
    where ne.event_key=v_key
      and n.user_id=v_user
  ) then
    raise exception 'M020-R2: deaktivierter Push erzeugt trotzdem Badge-Projektion.';
  end if;

  update app_portal.notification_preferences
  set push_fanbus_new_trips=true
  where user_id=v_user;

  -- ----------------------------------------------------------
  -- 7. Buszuordnung → optionaler Push
  -- ----------------------------------------------------------
  insert into app_portal.audit_events(
    actor_user_id,action,entity_type,entity_id,
    before_data,after_data,metadata
  )
  values (
    v_actor,
    'FANBUS_BUS_ASSIGNED',
    'fanbus_registration',
    v_registration::text,
    null,
    jsonb_build_object('busId',v_bus),
    jsonb_build_object(
      'busId',v_bus,
      'tripId',v_trip,
      'bookingId',v_booking,
      'participantId',v_registration
    )
  )
  returning id into v_audit;

  v_key := 'audit:' || v_audit::text;

  perform app_private.notification_expand_pending_events(50);

  if not exists (
    select 1
    from app_private.notification_outbox
    where event_key=v_key
      and recipient_user_id=v_user
      and channel='PUSH'
      and preference_mode='OPTIONAL'
  ) then
    raise exception 'M020-R2: Buszuordnung erzeugt keinen optionalen Push.';
  end if;

  -- ----------------------------------------------------------
  -- 8. Preisänderung:
  -- Pflicht-E-Mail MUSS bleiben, Push darf AUS sein
  -- ----------------------------------------------------------
  update app_portal.notification_preferences
  set push_fanbus=false,
      email_fanbus=false
  where user_id=v_user;

  update app_modules.fanbus_trips
  set price_cents=2500
  where id=v_trip;

  insert into app_portal.audit_events(
    actor_user_id,action,entity_type,entity_id,
    before_data,after_data,metadata
  )
  values (
    v_actor,
    'FANBUS_TRIP_UPDATED',
    'fanbus_trip',
    v_trip::text,
    jsonb_build_object(
      'status','PUBLISHED',
      'eventId',v_event,
      'priceCents',1500,
      'revision',3
    ),
    jsonb_build_object(
      'status','PUBLISHED',
      'eventId',v_event,
      'priceCents',2500,
      'revision',4
    ),
    jsonb_build_object('eventId',v_event)
  )
  returning id into v_audit;

  v_key := 'audit:' || v_audit::text;

  perform app_private.notification_expand_pending_events(50);

  if not exists (
    select 1
    from app_private.notification_outbox
    where event_key=v_key
      and channel='EMAIL'
      and recipient_address='m020-r2-recipient@example.invalid'
      and preference_mode='MANDATORY'
  ) then
    raise exception 'M020-R2: Preisänderung erzeugt keine Pflicht-E-Mail.';
  end if;

  if exists (
    select 1
    from app_private.notification_outbox
    where event_key=v_key
      and recipient_user_id=v_user
      and channel='PUSH'
  ) then
    raise exception 'M020-R2: Fanbus-Push AUS wird bei Preisänderung ignoriert.';
  end if;

  update app_portal.notification_preferences
  set push_fanbus=true
  where user_id=v_user;

  -- ----------------------------------------------------------
  -- 9. Manueller neuer Termin → Push
  -- ----------------------------------------------------------
  insert into app_portal.audit_events(
    actor_user_id,action,entity_type,entity_id,
    before_data,after_data,metadata
  )
  values (
    v_actor,
    'EVENT_CREATED',
    'event',
    v_event::text,
    null,
    jsonb_build_object(
      'event_type','GAME',
      'event_date','2026-12-20',
      'event_time','18:00:00',
      'venue','Amberg',
      'homeAway','AWAY',
      'opponentName','ERSC Amberg'
    ),
    '{}'::jsonb
  )
  returning id into v_audit;

  v_key := 'audit:' || v_audit::text;

  perform app_private.notification_expand_pending_events(50);

  if not exists (
    select 1
    from app_private.notification_outbox
    where event_key=v_key
      and recipient_user_id=v_user
      and channel='PUSH'
  ) then
    raise exception 'M020-R2: neuer manueller Termin erzeugt keinen Push.';
  end if;

  -- ----------------------------------------------------------
  -- 10. Neuer Termin Unterpräferenz AUS
  -- ----------------------------------------------------------
  insert into app_modules.events(
    event_type,title,event_date,event_time,venue,visibility,
    created_by,updated_by
  )
  values (
    'OTHER',
    'M020 R2 Termin',
    date '2026-12-21',
    time '19:00',
    'Schweinfurt',
    'PUBLIC',
    v_actor,
    v_actor
  )
  returning id into v_event2;

  update app_portal.notification_preferences
  set push_dates_new=false
  where user_id=v_user;

  insert into app_portal.audit_events(
    actor_user_id,action,entity_type,entity_id,
    before_data,after_data,metadata
  )
  values (
    v_actor,
    'EVENT_CREATED',
    'event',
    v_event2::text,
    null,
    jsonb_build_object(
      'event_type','OTHER',
      'title','M020 R2 Termin',
      'event_date','2026-12-21',
      'event_time','19:00:00',
      'venue','Schweinfurt'
    ),
    '{}'::jsonb
  )
  returning id into v_audit;

  v_key := 'audit:' || v_audit::text;

  perform app_private.notification_expand_pending_events(50);

  if exists (
    select 1
    from app_private.notification_outbox
    where event_key=v_key
      and recipient_user_id=v_user
      and channel='PUSH'
  ) then
    raise exception 'M020-R2: deaktivierter Neue-Termine-Push wird ignoriert.';
  end if;

  -- ----------------------------------------------------------
  -- 11. Nur Beschreibung geändert → KEIN Event
  -- ----------------------------------------------------------
  insert into app_portal.audit_events(
    actor_user_id,action,entity_type,entity_id,
    before_data,after_data,metadata
  )
  values (
    v_actor,
    'EVENT_UPDATED',
    'event',
    v_event2::text,
    jsonb_build_object(
      'event_type','OTHER',
      'title','M020 R2 Termin',
      'event_date','2026-12-21',
      'event_time','19:00:00',
      'venue','Schweinfurt',
      'description','Alt'
    ),
    jsonb_build_object(
      'event_type','OTHER',
      'title','M020 R2 Termin',
      'event_date','2026-12-21',
      'event_time','19:00:00',
      'venue','Schweinfurt',
      'description','Neu'
    ),
    '{}'::jsonb
  )
  returning id into v_audit;

  v_key := 'audit:' || v_audit::text;

  if exists (
    select 1
    from app_private.notification_events
    where event_key=v_key
  ) then
    raise exception 'M020-R2: reine Beschreibungskorrektur erzeugt Benachrichtigung.';
  end if;

  -- ----------------------------------------------------------
  -- 12. ICS Einzeländerung → KEIN Einzelpush
  -- ----------------------------------------------------------
  insert into app_portal.audit_events(
    actor_user_id,action,entity_type,entity_id,
    before_data,after_data,metadata
  )
  values (
    v_actor,
    'EVENT_UPDATED',
    'event',
    v_event::text,
    jsonb_build_object(
      'eventDate','2026-12-20',
      'venue','Alt'
    ),
    jsonb_build_object(
      'eventDate','2026-12-20',
      'venue','Neu'
    ),
    jsonb_build_object(
      'source','ICS_IMPORT',
      'sourceType','ICS',
      'sourceKey','ERV_BAYERNLIGA_2026_27'
    )
  )
  returning id into v_audit;

  v_key := 'audit:' || v_audit::text;

  if exists (
    select 1
    from app_private.notification_events
    where event_key=v_key
  ) then
    raise exception 'M020-R2: ICS-Einzeländerung erzeugt Einzelbenachrichtigung.';
  end if;

  -- ----------------------------------------------------------
  -- 13. ICS Confirm → genau eine Sammelmeldung
  -- ----------------------------------------------------------
  update app_portal.notification_preferences
  set push_dates_new=true,
      push_dates_changes=true
  where user_id=v_user;

  insert into app_portal.audit_events(
    actor_user_id,action,entity_type,entity_id,
    before_data,after_data,metadata
  )
  values (
    v_actor,
    'EVENT_ICS_IMPORT_CONFIRMED',
    'event_import_run',
    '00000000-0000-4020-8000-000000000299',
    null,
    jsonb_build_object(
      'sourceType','ICS',
      'sourceKey','ERV_BAYERNLIGA_2026_27',
      'createdCount',2,
      'updatedCount',1,
      'unchangedCount',27
    ),
    '{}'::jsonb
  )
  returning id into v_audit;

  v_key := 'audit:' || v_audit::text;

  if (
    select count(*)
    from app_private.notification_events
    where event_key=v_key
  ) <> 1 then
    raise exception 'M020-R2: ICS Confirm erzeugt nicht exakt eine Sammelmeldung.';
  end if;

  perform app_private.notification_expand_pending_events(50);

  if (
    select count(*)
    from app_private.notification_outbox
    where event_key=v_key
      and recipient_user_id=v_user
      and channel='PUSH'
  ) <> 1 then
    raise exception 'M020-R2: ICS Sammelmeldung erzeugt nicht exakt einen Push.';
  end if;

  -- ----------------------------------------------------------
  -- 14. Badge-Härtung: verwaistes Ziel ignorieren
  -- ----------------------------------------------------------
  update app_portal.notifications
  set read_at=now()
  where user_id=v_user;

  insert into app_portal.notifications(
    user_id,event_key,event_type,title,body,route,
    entity_type,entity_id
  )
  values (
    v_user,
    'm020:r2:orphan',
    'TASK_CREATED',
    'Verwaister Test',
    'Darf Badge nicht erhöhen',
    '#/tasks',
    'task',
    '00000000-0000-4020-8000-000000009999'
  );

  if app_private.notification_unread_count(v_user) <> 0 then
    raise exception 'M020-R2: verwaiste Meldung hält Badge aktiv.';
  end if;

  insert into app_portal.notifications(
    user_id,event_key,event_type,title,body,route,
    entity_type,entity_id
  )
  values (
    v_user,
    'm020:r2:valid',
    'DATE_EVENT_CREATED',
    'Gültiger Test',
    'Muss Badge erhöhen',
    '#/dates',
    'event',
    v_event::text
  );

  if app_private.notification_unread_count(v_user) <> 1 then
    raise exception 'M020-R2: gültige ungelesene Meldung wird im Badge nicht gezählt.';
  end if;
end;
$m020_r2_behavior$;

select pass(
  'M020-R2 Verhalten PASS: Feinpräferenzen, Auswärtsfahrt, Buszuordnung, Preis-Pflichtmail, Termine, ICS-Sammelpush und Badge-Härtung.'
);

select * from finish();

rollback;
