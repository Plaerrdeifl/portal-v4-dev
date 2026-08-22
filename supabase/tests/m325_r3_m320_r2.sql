\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column(
  'app_modules', 'fanbus_trips', 'default_boarding_stop_id',
  'M325-R3 Fahrtdefault ist additiv vorhanden'
);
select has_column(
  'app_modules', 'fanbus_trips', 'bus_preference_enabled',
  'M320-R2 Freigabeflag ist additiv vorhanden'
);
select has_table(
  'app_modules', 'fanbus_user_preferences',
  'M325-R3 besitzt genau das enge Preference-Read-Model'
);
select ok(
  (select relrowsecurity from pg_class
   where oid = 'app_modules.fanbus_user_preferences'::regclass),
  'User Preferences haben RLS'
);
select ok(
  not has_table_privilege(
    'anon', 'app_modules.fanbus_user_preferences', 'SELECT'
  ) and not has_table_privilege(
    'authenticated', 'app_modules.fanbus_user_preferences', 'SELECT'
  ) and not has_table_privilege(
    'service_role', 'app_modules.fanbus_user_preferences', 'SELECT'
  ),
  'Keine Browser- oder service_role-Tabellenrechte bestehen'
);
select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'app_modules'
     and tablename = 'fanbus_user_preferences'),
  0,
  'Keine direkte Browser-Policy besteht'
);

insert into auth.users(id, email) values
  ('00000000-0000-4327-8000-000000000001', 'joint-admin@example.invalid'),
  ('00000000-0000-4327-8000-000000000002', 'joint-owner@example.invalid'),
  ('00000000-0000-4327-8000-000000000003', 'joint-linked@example.invalid'),
  ('00000000-0000-4327-8000-000000000004', 'joint-pref-delete@example.invalid');
insert into app_portal.users(
  id, user_code, email, first_name, last_name, status, role_id
) values
  (
    '00000000-0000-4327-8000-000000000001', 'U-JOINT-ADMIN',
    'joint-admin@example.invalid', 'Joint', 'Admin', 'ACTIVE',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '00000000-0000-4327-8000-000000000002', 'U-JOINT-OWNER',
    'joint-owner@example.invalid', 'Olga', 'Owner', 'ACTIVE',
    '00000000-0000-4000-8000-000000000003'
  ),
  (
    '00000000-0000-4327-8000-000000000003', 'U-JOINT-LINKED',
    'joint-linked@example.invalid', 'Lina', 'Linked', 'ACTIVE',
    '00000000-0000-4000-8000-000000000003'
  ),
  (
    '00000000-0000-4327-8000-000000000004', 'U-JOINT-DELETE',
    'joint-pref-delete@example.invalid', 'Dora', 'Delete', 'ACTIVE',
    '00000000-0000-4000-8000-000000000003'
  );

insert into app_modules.events(
  id, event_type, title, event_date, event_time, visibility
) values
  ('00000000-0000-4327-8100-000000000001', 'OTHER', 'Joint Fahrt 1', current_date + 20, time '20:00', 'PUBLIC'),
  ('00000000-0000-4327-8100-000000000002', 'OTHER', 'Joint Fahrt 2', current_date + 21, time '20:00', 'PUBLIC'),
  ('00000000-0000-4327-8100-000000000003', 'OTHER', 'Joint Fahrt 3', current_date + 22, time '20:00', 'PUBLIC'),
  ('00000000-0000-4327-8100-000000000004', 'OTHER', 'Joint Matrix', current_date + 23, time '20:00', 'PUBLIC');
insert into app_modules.fanbus_trips(
  id, event_id, departure_at, departure_info,
  registration_opens_at, registration_closes_at,
  price_cents, privacy_reference, terms_reference, status
) values
  (
    '00000000-0000-4327-8200-000000000001',
    '00000000-0000-4327-8100-000000000001', now() + interval '19 days',
    'Joint 1', now() - interval '1 day', now() + interval '18 days',
    2500, 'privacy-v1', 'terms-v1', 'PUBLISHED'
  ),
  (
    '00000000-0000-4327-8200-000000000002',
    '00000000-0000-4327-8100-000000000002', null,
    null, null, null, null, null, null, 'DRAFT'
  ),
  (
    '00000000-0000-4327-8200-000000000003',
    '00000000-0000-4327-8100-000000000003', null,
    null, null, null, null, null, null, 'DRAFT'
  ),
  (
    '00000000-0000-4327-8200-000000000004',
    '00000000-0000-4327-8100-000000000004', null,
    null, null, null, null, null, null, 'DRAFT'
  );

insert into app_modules.fanbus_boarding_stops(
  id, label, position, is_active
) values
  ('00000000-0000-4327-8300-000000000001', 'Icedome', 432701, true),
  ('00000000-0000-4327-8300-000000000002', 'Hauptbahnhof', 432702, true),
  ('00000000-0000-4327-8300-000000000003', 'Nur andere Fahrt', 432703, true),
  ('00000000-0000-4327-8300-000000000004', 'Ohne Fahrtstop', 432704, true),
  ('00000000-0000-4327-8300-000000000005', 'Inaktiv', 432705, false);
insert into app_modules.fanbus_trip_boarding_stops(
  id, trip_id, boarding_stop_id, departure_at, position, is_active
) values
  (
    '00000000-0000-4327-8400-000000000001',
    '00000000-0000-4327-8200-000000000001',
    '00000000-0000-4327-8300-000000000001', now() + interval '19 days', 1, true
  ),
  (
    '00000000-0000-4327-8400-000000000002',
    '00000000-0000-4327-8200-000000000001',
    '00000000-0000-4327-8300-000000000002', now() + interval '19 days', 2, true
  ),
  (
    '00000000-0000-4327-8400-000000000003',
    '00000000-0000-4327-8200-000000000002',
    '00000000-0000-4327-8300-000000000003', now() + interval '20 days', 1, true
  ),
  (
    '00000000-0000-4327-8400-000000000004',
    '00000000-0000-4327-8200-000000000003',
    '00000000-0000-4327-8300-000000000001', now() + interval '21 days', 1, true
  ),
  (
    '00000000-0000-4327-8400-000000000005',
    '00000000-0000-4327-8200-000000000003',
    '00000000-0000-4327-8300-000000000002', now() + interval '21 days', 2, true
  );

insert into app_modules.fanbus_buses(
  id, trip_id, label, category, capacity, is_active
) values
  ('00000000-0000-4327-8500-000000000001', '00000000-0000-4327-8200-000000000001', 'Party 1', 'PARTY', 1, true),
  ('00000000-0000-4327-8500-000000000002', '00000000-0000-4327-8200-000000000001', 'Ruhig 1', 'RUHIG', 1, true),
  ('00000000-0000-4327-8500-000000000003', '00000000-0000-4327-8200-000000000002', 'Normal 2', 'NORMAL', 10, true),
  ('00000000-0000-4327-8500-000000000004', '00000000-0000-4327-8200-000000000003', 'Party 3', 'PARTY', 10, true),
  ('00000000-0000-4327-8500-000000000005', '00000000-0000-4327-8200-000000000003', 'Ruhig 3', 'RUHIG', 10, true);

update app_modules.fanbus_trips
set default_boarding_stop_id = '00000000-0000-4327-8300-000000000001'
where id = '00000000-0000-4327-8200-000000000001';

-- Enger Self-Service-Vertrag, Actorbindung und CAS.
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4327-8000-000000000002', true
);
select is(
  app_private.api_fanbus_user_preference_set(jsonb_build_object(
    'defaultBoardingStopId', '00000000-0000-4327-8300-000000000001'
  )) ->> 'revision',
  '1',
  'User Preference Create startet bei Revision 1'
);
select is(
  app_private.api_fanbus_user_preference_get('{}'::jsonb)
    ->> 'defaultBoardingStopId',
  '00000000-0000-4327-8300-000000000001',
  'User liest nur die eigene Preference'
);
select throws_ok(
  $$select app_private.api_fanbus_user_preference_set(
    '{"userId":"00000000-0000-4327-8000-000000000003","defaultBoardingStopId":"00000000-0000-4327-8300-000000000002"}'::jsonb
  )$$,
  '22023', 'FANBUS_USER_PREFERENCE_INVALID_PAYLOAD',
  'Client-userId ist per Allowlist unmoeglich'
);
select throws_ok(
  $$select app_private.api_fanbus_user_preference_set(
    '{"defaultBoardingStopId":"00000000-0000-4327-8300-000000000002","expectedRevision":9}'::jsonb
  )$$,
  '40001', 'STALE_REVISION',
  'User Preference Update erzwingt CAS'
);
select is(
  app_private.api_fanbus_user_preference_set(jsonb_build_object(
    'defaultBoardingStopId', '00000000-0000-4327-8300-000000000002',
    'expectedRevision', 1
  )) ->> 'revision',
  '2',
  'User Preference Update erhoeht die Revision'
);
select throws_ok(
  $$select app_private.api_fanbus_user_preference_set(
    '{"defaultBoardingStopId":"00000000-0000-4327-8300-000000000005","expectedRevision":2}'::jsonb
  )$$,
  '22023', 'FANBUS_BOARDING_STOP_UNAVAILABLE',
  'Inaktiver allgemeiner Stop ist nicht speicherbar'
);

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4327-8000-000000000003', true
);
select is(
  app_private.api_fanbus_user_preference_get('{}'::jsonb)
    ->> 'defaultBoardingStopId',
  null,
  'Fremduser liest die Preference des Owners nicht'
);
select app_private.api_fanbus_user_preference_set(jsonb_build_object(
  'defaultBoardingStopId', '00000000-0000-4327-8300-000000000002'
));

select set_config(
  'request.jwt.claim.sub', '00000000-0000-4327-8000-000000000004', true
);
select app_private.api_fanbus_user_preference_set(jsonb_build_object(
  'defaultBoardingStopId', '00000000-0000-4327-8300-000000000001'
));
select throws_ok(
  $$select app_private.api_fanbus_user_preference_delete(
    '{"expectedRevision":2}'::jsonb
  )$$,
  '40001', 'STALE_REVISION',
  'User Preference Delete erzwingt CAS'
);
select is(
  app_private.api_fanbus_user_preference_delete(
    '{"expectedRevision":1}'::jsonb
  ) ->> 'defaultBoardingStopId',
  null,
  'User Preference Delete loescht die eigene Zeile'
);
select is(
  (select count(*)::integer from app_modules.fanbus_user_preferences
   where user_id = '00000000-0000-4327-8000-000000000004'),
  0,
  'Preference-Delete hinterlaesst keine Zeile'
);
select is(
  (select count(*)::integer
   from app_portal.audit_events
   where action in (
     'FANBUS_USER_PREFERENCE_SET',
     'FANBUS_USER_PREFERENCE_DELETED'
   )),
  0,
  'Preference SET und DELETE erzeugen kein Detailaudit'
);

-- Zentraler Zustiegsresolver: Personal, Trip, NONE, Guest und manuell.
select results_eq(
  $$select trip_boarding_stop_id, effective_source
    from app_private.fanbus_resolve_trip_boarding_stop(
      '00000000-0000-4327-8200-000000000001', null,
      '00000000-0000-4327-8300-000000000002', 'PERSONAL'
    )$$,
  $$values (
    '00000000-0000-4327-8400-000000000002'::uuid, 'PERSONAL'::text
  )$$,
  'Gueltiger persoenlicher Default gewinnt'
);
select results_eq(
  $$select trip_boarding_stop_id, effective_source
    from app_private.fanbus_resolve_trip_boarding_stop(
      '00000000-0000-4327-8200-000000000001', null,
      '00000000-0000-4327-8300-000000000003', 'PERSONAL'
    )$$,
  $$values (
    '00000000-0000-4327-8400-000000000001'::uuid, 'TRIP'::text
  )$$,
  'Ungueltiger persoenlicher Default faellt auf Fahrtdefault zurueck'
);
select results_eq(
  $$select trip_boarding_stop_id, effective_source
    from app_private.fanbus_resolve_trip_boarding_stop(
      '00000000-0000-4327-8200-000000000001', null, null, 'NONE'
    )$$,
  $$values (
    '00000000-0000-4327-8400-000000000001'::uuid, 'TRIP'::text
  )$$,
  'Guest erhaelt den Fahrtdefault'
);
select results_eq(
  $$select trip_boarding_stop_id, effective_source
    from app_private.fanbus_resolve_trip_boarding_stop(
      '00000000-0000-4327-8200-000000000001',
      '00000000-0000-4327-8400-000000000001',
      '00000000-0000-4327-8300-000000000002', 'PERSONAL'
    )$$,
  $$values (
    '00000000-0000-4327-8400-000000000001'::uuid, 'MANUAL'::text
  )$$,
  'Explizite gueltige Auswahl gewinnt immer'
);
select throws_ok(
  $$select * from app_private.fanbus_resolve_trip_boarding_stop(
    '00000000-0000-4327-8200-000000000001',
    '00000000-0000-4327-8400-000000000003', null, 'NONE'
  )$$,
  '22023', 'FANBUS_BOARDING_STOP_UNAVAILABLE',
  'Expliziter Stop einer anderen Fahrt wird abgewiesen'
);

update app_modules.fanbus_trips
set default_boarding_stop_id = '00000000-0000-4327-8300-000000000004'
where id = '00000000-0000-4327-8200-000000000001';
select results_eq(
  $$select trip_boarding_stop_id, effective_source
    from app_private.fanbus_resolve_trip_boarding_stop(
      '00000000-0000-4327-8200-000000000001', null,
      '00000000-0000-4327-8300-000000000003', 'COMPANION'
    )$$,
  $$values (null::uuid, 'NONE'::text)$$,
  'Ungueltiger Companion- und Fahrtdefault ergeben Bitte waehlen'
);
update app_modules.fanbus_trips
set default_boarding_stop_id = '00000000-0000-4327-8300-000000000001'
where id = '00000000-0000-4327-8200-000000000001';

-- Trip-Update-API validiert den allgemeinen Default und die Busstruktur.
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4327-8000-000000000001', true
);
select lives_ok(
  $$select app_private.api_fanbus_trip_update(jsonb_build_object(
    'id', trip.id, 'expectedRevision', trip.revision,
    'departureAt', trip.departure_at, 'departureInfo', trip.departure_info,
    'registrationClosesAt', trip.registration_closes_at,
    'priceCents', trip.price_cents,
    'privacyReference', trip.privacy_reference,
    'termsReference', trip.terms_reference,
    'defaultBoardingStopId', '00000000-0000-4327-8300-000000000002',
    'busPreferenceEnabled', false
  )) from app_modules.fanbus_trips trip
  where trip.id = '00000000-0000-4327-8200-000000000001'$$,
  'Gueltiger Fahrtdefault wird ueber die bestehende Trip-API gespeichert'
);
update app_modules.fanbus_trip_boarding_stops set is_active = false
where id = '00000000-0000-4327-8400-000000000002';
select throws_ok(
  $$select app_private.api_fanbus_trip_update(jsonb_build_object(
    'id', trip.id, 'expectedRevision', trip.revision,
    'departureAt', null, 'departureInfo', null,
    'registrationClosesAt', null, 'priceCents', null,
    'privacyReference', null, 'termsReference', null,
    'defaultBoardingStopId', null, 'busPreferenceEnabled', null
  )) from app_modules.fanbus_trips trip
  where trip.id = '00000000-0000-4327-8200-000000000002'$$,
  '22023', 'FANBUS_TRIP_SETTINGS_INVALID_PAYLOAD',
  'Buswunsch-Flag NULL wird als ungueltiger Payload abgewiesen'
);
select throws_ok(
  $$select app_private.api_fanbus_trip_update(jsonb_build_object(
    'id', trip.id, 'expectedRevision', trip.revision,
    'departureAt', trip.departure_at, 'departureInfo', trip.departure_info,
    'registrationClosesAt', trip.registration_closes_at,
    'priceCents', trip.price_cents,
    'privacyReference', trip.privacy_reference,
    'termsReference', trip.terms_reference,
    'defaultBoardingStopId', '00000000-0000-4327-8300-000000000002',
    'busPreferenceEnabled', false
  )) from app_modules.fanbus_trips trip
  where trip.id = '00000000-0000-4327-8200-000000000001'$$,
  '22023', 'FANBUS_TRIP_DEFAULT_BOARDING_STOP_UNAVAILABLE',
  'Inaktiver Fahrtstop ist kein gueltiger Default'
);
update app_modules.fanbus_trip_boarding_stops set is_active = true
where id = '00000000-0000-4327-8400-000000000002';
select throws_ok(
  $$select app_private.api_fanbus_trip_update(jsonb_build_object(
    'id', trip.id, 'expectedRevision', trip.revision,
    'departureAt', trip.departure_at, 'departureInfo', trip.departure_info,
    'registrationClosesAt', trip.registration_closes_at,
    'priceCents', trip.price_cents,
    'privacyReference', trip.privacy_reference,
    'termsReference', trip.terms_reference,
    'defaultBoardingStopId', '00000000-0000-4327-8300-000000000003',
    'busPreferenceEnabled', false
  )) from app_modules.fanbus_trips trip
  where trip.id = '00000000-0000-4327-8200-000000000001'$$,
  '22023', 'FANBUS_TRIP_DEFAULT_BOARDING_STOP_UNAVAILABLE',
  'Fahrtstop einer anderen Fahrt ist kein gueltiger Default'
);
select throws_ok(
  $$select app_private.api_fanbus_trip_update(jsonb_build_object(
    'id', trip.id, 'expectedRevision', trip.revision,
    'departureAt', trip.departure_at, 'departureInfo', trip.departure_info,
    'registrationClosesAt', trip.registration_closes_at,
    'priceCents', trip.price_cents,
    'privacyReference', trip.privacy_reference,
    'termsReference', trip.terms_reference,
    'defaultBoardingStopId', '00000000-0000-4327-8300-000000000004',
    'busPreferenceEnabled', false
  )) from app_modules.fanbus_trips trip
  where trip.id = '00000000-0000-4327-8200-000000000001'$$,
  '22023', 'FANBUS_TRIP_DEFAULT_BOARDING_STOP_UNAVAILABLE',
  'Master ohne Fahrtstop ist kein gueltiger Default'
);
select lives_ok(
  $$select app_private.api_fanbus_trip_update(jsonb_build_object(
    'id', trip.id, 'expectedRevision', trip.revision,
    'departureAt', trip.departure_at, 'departureInfo', trip.departure_info,
    'registrationClosesAt', trip.registration_closes_at,
    'priceCents', trip.price_cents,
    'privacyReference', trip.privacy_reference,
    'termsReference', trip.terms_reference,
    'defaultBoardingStopId', null, 'busPreferenceEnabled', false
  )) from app_modules.fanbus_trips trip
  where trip.id = '00000000-0000-4327-8200-000000000001'$$,
  'NULL entfernt den Fahrtdefault'
);

select throws_ok(
  $$select app_private.api_fanbus_trip_update(jsonb_build_object(
    'id', trip.id, 'expectedRevision', trip.revision,
    'departureAt', null, 'departureInfo', null,
    'registrationClosesAt', null, 'priceCents', null,
    'privacyReference', null, 'termsReference', null,
    'defaultBoardingStopId', null, 'busPreferenceEnabled', true
  )) from app_modules.fanbus_trips trip
  where trip.id = '00000000-0000-4327-8200-000000000002'$$,
  '22023', 'FANBUS_BUS_PREFERENCE_STRUCTURE_INVALID',
  'Flag true wird bei einer ungueltigen Busstruktur abgewiesen'
);
select lives_ok(
  $$select app_private.api_fanbus_trip_update(jsonb_build_object(
    'id', trip.id, 'expectedRevision', trip.revision,
    'departureAt', trip.departure_at, 'departureInfo', trip.departure_info,
    'registrationClosesAt', trip.registration_closes_at,
    'priceCents', trip.price_cents,
    'privacyReference', trip.privacy_reference,
    'termsReference', trip.terms_reference,
    'defaultBoardingStopId', '00000000-0000-4327-8300-000000000001',
    'busPreferenceEnabled', true
  )) from app_modules.fanbus_trips trip
  where trip.id = '00000000-0000-4327-8200-000000000001'$$,
  'Flag true wird bei PARTY+RUHIG gespeichert'
);
select is(
  app_private.fanbus_allowed_bus_preferences(
    '00000000-0000-4327-8200-000000000001'
  ),
  '["EGAL", "RUHIG", "PARTY"]'::jsonb,
  'Wirksame Struktur liefert exakt EGAL/RUHIG/PARTY'
);

-- Vollstaendige M320-R2-Strukturmatrix, inklusive Fail-Closed bei Flag false.
select is(
  app_private.fanbus_bus_preference_selection_enabled(
    '00000000-0000-4327-8200-000000000004'
  ), false, 'Flag aus ergibt trotz beliebiger Struktur keine Auswahl'
);
insert into app_modules.fanbus_buses(trip_id, label, category, capacity, is_active)
values ('00000000-0000-4327-8200-000000000004', 'Matrix A', 'NORMAL', 10, true);
update app_modules.fanbus_trips set bus_preference_enabled = true
where id = '00000000-0000-4327-8200-000000000004';
select is(app_private.fanbus_bus_preference_selection_enabled('00000000-0000-4327-8200-000000000004'), false, '1 NORMAL ist unwirksam');
update app_modules.fanbus_buses set category = 'PARTY'
where trip_id = '00000000-0000-4327-8200-000000000004';
select is(app_private.fanbus_bus_preference_selection_enabled('00000000-0000-4327-8200-000000000004'), false, '1 PARTY ist unwirksam');
update app_modules.fanbus_buses set category = 'RUHIG'
where trip_id = '00000000-0000-4327-8200-000000000004';
select is(app_private.fanbus_bus_preference_selection_enabled('00000000-0000-4327-8200-000000000004'), false, '1 RUHIG ist unwirksam');
insert into app_modules.fanbus_buses(trip_id, label, category, capacity, is_active)
values ('00000000-0000-4327-8200-000000000004', 'Matrix B', 'RUHIG', 10, true);
select is(app_private.fanbus_bus_preference_selection_enabled('00000000-0000-4327-8200-000000000004'), false, 'RUHIG+RUHIG ist unwirksam');
update app_modules.fanbus_buses set category = 'PARTY'
where trip_id = '00000000-0000-4327-8200-000000000004';
select is(app_private.fanbus_bus_preference_selection_enabled('00000000-0000-4327-8200-000000000004'), false, 'PARTY+PARTY ist unwirksam');
update app_modules.fanbus_buses set category = 'NORMAL'
where trip_id = '00000000-0000-4327-8200-000000000004';
select is(app_private.fanbus_bus_preference_selection_enabled('00000000-0000-4327-8200-000000000004'), false, 'NORMAL+NORMAL ist unwirksam');
update app_modules.fanbus_buses set category = case label
  when 'Matrix A' then 'PARTY' else 'RUHIG' end
where trip_id = '00000000-0000-4327-8200-000000000004';
select is(app_private.fanbus_bus_preference_selection_enabled('00000000-0000-4327-8200-000000000004'), true, 'PARTY+RUHIG ist wirksam');
insert into app_modules.fanbus_buses(trip_id, label, category, capacity, is_active)
values ('00000000-0000-4327-8200-000000000004', 'Matrix C', 'NORMAL', 10, true);
select is(app_private.fanbus_bus_preference_selection_enabled('00000000-0000-4327-8200-000000000004'), true, 'NORMAL+PARTY+RUHIG ist wirksam');

-- Portal PRIMARY und Linked Companion durchlaufen denselben Insert-Resolver.
insert into app_modules.fanbus_companion_lists(id, owner_user_id, name)
values (
  '00000000-0000-4327-8600-000000000001',
  '00000000-0000-4327-8000-000000000002', 'Joint Liste'
);
insert into app_modules.fanbus_companion_list_members(
  id, list_id, position, first_name, last_name,
  default_boarding_stop_id, default_bus_preference, linked_portal_user_id
) values (
  '00000000-0000-4327-8700-000000000001',
  '00000000-0000-4327-8600-000000000001', 1, 'Lina', 'Linked',
  '00000000-0000-4327-8300-000000000001', 'PARTY',
  '00000000-0000-4327-8000-000000000003'
);
update app_modules.fanbus_trips
set bus_preference_enabled = false,
    default_boarding_stop_id = '00000000-0000-4327-8300-000000000001'
where id = '00000000-0000-4327-8200-000000000001';
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4327-8000-000000000002', true
);
create temporary table joint_results(name text primary key, result jsonb)
on commit drop;
insert into joint_results values (
  'disabled_first',
  app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
    'listId', '00000000-0000-4327-8600-000000000001',
    'tripId', '00000000-0000-4327-8200-000000000001',
    'busPreference', 'PARTY',
    'participants', jsonb_build_array(jsonb_build_object(
      'templateMemberId', '00000000-0000-4327-8700-000000000001',
      'busPreference', 'PARTY'
    )),
    'privacyConfirmed', true, 'termsConfirmed', true,
    'idempotencyKey', '00000000-0000-4327-8800-000000000001'
  ))
);
select is(
  (select count(*)::integer from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4327-8200-000000000001'
     and bus_preference = 'EGAL'),
  2,
  'Gesperrte PARTY-Wuensche werden fuer PRIMARY und Companion EGAL'
);
select is(
  (select trip_boarding_stop_id::text from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4327-8200-000000000001'
     and booking_role = 'PRIMARY'),
  '00000000-0000-4327-8400-000000000002',
  'Portal PRIMARY nutzt den persoenlichen Default'
);
select is(
  (select trip_boarding_stop_id::text from app_modules.fanbus_registrations
   where trip_id = '00000000-0000-4327-8200-000000000001'
     and booking_role = 'COMPANION'),
  '00000000-0000-4327-8400-000000000001',
  'Linked Companion nutzt Companiondefault statt fremder User Preference'
);
select is(
  (select default_bus_preference from app_modules.fanbus_companion_list_members
   where id = '00000000-0000-4327-8700-000000000001'),
  'PARTY',
  'Gesperrte Fahrt veraendert den Companion Default nicht'
);

update app_modules.fanbus_trips set bus_preference_enabled = true
where id = '00000000-0000-4327-8200-000000000001';
insert into joint_results values (
  'disabled_replay',
  app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
    'listId', '00000000-0000-4327-8600-000000000001',
    'tripId', '00000000-0000-4327-8200-000000000001',
    'busPreference', 'PARTY',
    'participants', jsonb_build_array(jsonb_build_object(
      'templateMemberId', '00000000-0000-4327-8700-000000000001',
      'busPreference', 'PARTY'
    )),
    'privacyConfirmed', true, 'termsConfirmed', true,
    'idempotencyKey', '00000000-0000-4327-8800-000000000001'
  ))
);
select is(
  (select result from joint_results where name = 'disabled_replay'),
  (select result from joint_results where name = 'disabled_first'),
  'Idempotenz-Replay bewertet spaetere Flag-Aenderung nicht neu'
);

insert into joint_results values (
  'enabled_waitlist',
  app_private.fanbus_submit_booking_core(
    '00000000-0000-4327-8200-000000000001', 'GUEST', null,
    '{"firstName":"Wera","lastName":"Wartend","email":"wait@example.invalid","busPreference":"PARTY"}'::jsonb,
    '[]'::jsonb, true, true,
    '00000000-0000-4327-8800-000000000002'
  )
);
select is(
  (select status from app_modules.fanbus_registrations
   where email = 'wait@example.invalid'),
  'WAITLISTED',
  'WAITLISTED verwendet denselben zentralen Bookingpfad'
);
select is(
  (select bus_preference from app_modules.fanbus_registrations
   where email = 'wait@example.invalid'),
  'PARTY',
  'Wirksame PARTY-Auswahl bleibt auch auf der Warteliste PARTY'
);
select throws_ok(
  $$select app_private.fanbus_submit_booking_core(
    '00000000-0000-4327-8200-000000000001', 'GUEST', null,
    '{"firstName":"Fanta","lastName":"Wert","email":"invalid@example.invalid","busPreference":"NORMAL"}'::jsonb,
    '[]'::jsonb, true, true,
    '00000000-0000-4327-8800-000000000003'
  )$$,
  '22023', 'FANBUS_BUS_PREFERENCE_INVALID',
  'Fantasiewert NORMAL bleibt ungueltiger Fahrgastinput'
);

insert into joint_results values (
  'manual_waitlist',
  app_private.fanbus_submit_booking_core(
    '00000000-0000-4327-8200-000000000001', 'MANUAL',
    '00000000-0000-4327-8000-000000000001',
    '{"firstName":"Manu","lastName":"Ell","email":"manual@example.invalid","busPreference":"RUHIG"}'::jsonb,
    '[]'::jsonb, true, true,
    '00000000-0000-4327-8800-000000000004'
  )
);
select is(
  (select bus_preference from app_modules.fanbus_registrations
   where email = 'manual@example.invalid'),
  'RUHIG',
  'Manuell neue Registration verwendet dieselbe wirksame Regel'
);

-- Public/internal snapshots enthalten nur die additiven Verträge.
select ok(
  public.pd_public_fanbus_trip(
    '00000000-0000-4327-8200-000000000001'
  ) ?& array[
    'defaultTripBoardingStopId', 'busPreferenceSelectionEnabled',
    'allowedBusPreferences'
  ],
  'Public Snapshot ist additiv erweitert'
);
select ok(
  not (
    public.pd_public_fanbus_trip(
      '00000000-0000-4327-8200-000000000001'
    ) ? 'buses'
  ),
  'Public Snapshot gibt keine interne Bustopologie aus'
);
select ok(
  exists (
    select 1
    from jsonb_array_elements(
      public.pd_public_fanbus_trips() -> 'trips'
    ) as item(value)
    where item.value ->> 'tripId' = '00000000-0000-4327-8200-000000000001'
      and item.value ?& array[
        'defaultTripBoardingStopId', 'busPreferenceSelectionEnabled',
        'allowedBusPreferences'
      ]
  ),
  'Public List Snapshot ist additiv erweitert'
);
select set_config(
  'request.jwt.claim.sub', '00000000-0000-4327-8000-000000000001', true
);
select ok(
  exists (
    select 1
    from jsonb_array_elements(
      app_private.api_fanbus_trips_list() -> 'trips'
    ) as item(value)
    where item.value ->> 'id' = '00000000-0000-4327-8200-000000000001'
      and item.value ?& array[
        'defaultBoardingStopId', 'busPreferenceEnabled',
        'busPreferenceSelectionEnabled', 'allowedBusPreferences'
      ]
  ),
  'Interner Trip Snapshot ist additiv erweitert'
);

-- Stop-Lifecycle auf einer separaten Fahrt ohne historische Registrierungen.
update app_modules.fanbus_trips
set default_boarding_stop_id = '00000000-0000-4327-8300-000000000001'
where id = '00000000-0000-4327-8200-000000000003';
select lives_ok(
  $$select app_private.api_fanbus_trip_boarding_stop_upsert(jsonb_build_object(
    'id', stop.id, 'tripId', stop.trip_id,
    'boardingStopId', stop.boarding_stop_id,
    'expectedRevision', stop.revision,
    'departureAt', stop.departure_at + interval '5 minutes',
    'position', stop.position, 'tripNote', 'Zeit neu', 'isActive', true
  )) from app_modules.fanbus_trip_boarding_stops stop
  where stop.id = '00000000-0000-4327-8400-000000000004'$$,
  'Reine Abfahrtszeit-Aenderung ist erlaubt'
);
select is(
  (select default_boarding_stop_id::text from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  '00000000-0000-4327-8300-000000000001',
  'Abfahrtszeit-Aenderung behaelt den Fahrtdefault'
);
select lives_ok(
  $$select app_private.api_fanbus_trip_boarding_stop_upsert(jsonb_build_object(
    'id', stop.id, 'tripId', stop.trip_id,
    'boardingStopId', stop.boarding_stop_id,
    'expectedRevision', stop.revision,
    'departureAt', stop.departure_at,
    'position', 3, 'tripNote', stop.trip_note, 'isActive', true
  )) from app_modules.fanbus_trip_boarding_stops stop
  where stop.id = '00000000-0000-4327-8400-000000000004'$$,
  'Reine Positionsaenderung ist erlaubt'
);
select is(
  (select default_boarding_stop_id::text from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  '00000000-0000-4327-8300-000000000001',
  'Reine Positionsaenderung behaelt den Fahrtdefault'
);
create temporary table joint_trip_revision(value integer) on commit drop;
insert into joint_trip_revision
select revision from app_modules.fanbus_trips
where id = '00000000-0000-4327-8200-000000000003';
select lives_ok(
  $$select app_private.api_fanbus_trip_boarding_stop_upsert(jsonb_build_object(
    'id', stop.id, 'tripId', stop.trip_id,
    'boardingStopId', stop.boarding_stop_id,
    'expectedRevision', stop.revision,
    'departureAt', stop.departure_at,
    'position', stop.position, 'tripNote', stop.trip_note, 'isActive', false
  )) from app_modules.fanbus_trip_boarding_stops stop
  where stop.id = '00000000-0000-4327-8400-000000000004'$$,
  'Default-Fahrtstop darf deaktiviert werden'
);
select is(
  (select default_boarding_stop_id from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  null,
  'Deaktivierung loescht den Fahrtdefault ohne Ersatz'
);
select is(
  (select revision from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  (select value + 1 from joint_trip_revision),
  'Default-Clear erhoeht die Trip-Revision'
);
select ok(
  exists (
    select 1
    from app_portal.audit_events
    where action = 'FANBUS_TRIP_DEFAULT_BOARDING_STOP_CLEARED'
      and entity_id = '00000000-0000-4327-8200-000000000003'
  ),
  'Trip-Default-Clear-Audit bleibt erhalten'
);
update app_modules.fanbus_trip_boarding_stops
set is_active = true, revision = revision + 1
where id = '00000000-0000-4327-8400-000000000004';
select is(
  (select default_boarding_stop_id from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  null,
  'Spaetere Reaktivierung stellt den Default nicht automatisch wieder her'
);
update app_modules.fanbus_trips
set default_boarding_stop_id = '00000000-0000-4327-8300-000000000001'
where id = '00000000-0000-4327-8200-000000000003';
select lives_ok(
  $$select app_private.api_fanbus_trip_boarding_stop_upsert(jsonb_build_object(
    'id', stop.id, 'tripId', stop.trip_id,
    'boardingStopId', '00000000-0000-4327-8300-000000000003',
    'expectedRevision', stop.revision,
    'departureAt', stop.departure_at,
    'position', stop.position, 'tripNote', stop.trip_note, 'isActive', true
  )) from app_modules.fanbus_trip_boarding_stops stop
  where stop.id = '00000000-0000-4327-8400-000000000004'$$,
  'boarding_stop_id des Default-Fahrtstopps darf geaendert werden'
);
select is(
  (select default_boarding_stop_id from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  null,
  'boarding_stop_id-Aenderung loescht den Fahrtdefault'
);

-- AUTO_RESET_FALSE laesst die Busmutation zu und reaktiviert nie automatisch.
update app_modules.fanbus_trips set bus_preference_enabled = true
where id = '00000000-0000-4327-8200-000000000003';
select lives_ok(
  $$select app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'id', bus.id, 'tripId', bus.trip_id, 'expectedRevision', bus.revision,
    'label', bus.label, 'category', 'NORMAL',
    'capacity', bus.capacity, 'isActive', bus.is_active
  )) from app_modules.fanbus_buses bus
  where bus.id = '00000000-0000-4327-8500-000000000004'$$,
  'Letzten PARTY-Bus auf NORMAL aendern wird nicht blockiert'
);
select is(
  (select bus_preference_enabled from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  false,
  'PARTY auf NORMAL setzt Flag automatisch false'
);
update app_modules.fanbus_buses set category = 'PARTY', revision = revision + 1
where id = '00000000-0000-4327-8500-000000000004';
select is(
  (select bus_preference_enabled from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  false,
  'Spaeter wieder gueltige Struktur reaktiviert das Flag nicht'
);
update app_modules.fanbus_trips set bus_preference_enabled = true
where id = '00000000-0000-4327-8200-000000000003';
select lives_ok(
  $$select app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'id', bus.id, 'tripId', bus.trip_id, 'expectedRevision', bus.revision,
    'label', bus.label, 'category', bus.category,
    'capacity', bus.capacity, 'isActive', false
  )) from app_modules.fanbus_buses bus
  where bus.id = '00000000-0000-4327-8500-000000000004'$$,
  'Letzten PARTY-Bus deaktivieren wird nicht blockiert'
);
select is(
  (select bus_preference_enabled from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  false,
  'Letzten PARTY-Bus deaktivieren setzt Flag false'
);
update app_modules.fanbus_buses set is_active = true, revision = revision + 1
where id = '00000000-0000-4327-8500-000000000004';
update app_modules.fanbus_trips set bus_preference_enabled = true
where id = '00000000-0000-4327-8200-000000000003';
select lives_ok(
  $$select app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'id', bus.id, 'tripId', bus.trip_id, 'expectedRevision', bus.revision,
    'label', bus.label, 'category', 'NORMAL',
    'capacity', bus.capacity, 'isActive', bus.is_active
  )) from app_modules.fanbus_buses bus
  where bus.id = '00000000-0000-4327-8500-000000000005'$$,
  'Letzten RUHIG-Bus auf NORMAL aendern wird nicht blockiert'
);
select is(
  (select bus_preference_enabled from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  false,
  'RUHIG auf NORMAL setzt Flag false'
);
update app_modules.fanbus_buses
set category = 'RUHIG', revision = revision + 1
where id = '00000000-0000-4327-8500-000000000005';
update app_modules.fanbus_trips set bus_preference_enabled = true
where id = '00000000-0000-4327-8200-000000000003';
select lives_ok(
  $$select app_private.api_fanbus_bus_upsert(jsonb_build_object(
    'id', bus.id, 'tripId', bus.trip_id, 'expectedRevision', bus.revision,
    'label', bus.label, 'category', bus.category,
    'capacity', bus.capacity, 'isActive', false
  )) from app_modules.fanbus_buses bus
  where bus.id = '00000000-0000-4327-8500-000000000005'$$,
  'Letzten RUHIG-Bus deaktivieren wird nicht blockiert'
);
select is(
  (select bus_preference_enabled from app_modules.fanbus_trips
   where id = '00000000-0000-4327-8200-000000000003'),
  false,
  'Letzten RUHIG-Bus deaktivieren setzt Flag false'
);

-- Konfigurationsmutationen schreiben historische Registration-Snapshots nicht um.
create temporary table joint_history as
select id, status, bus_preference, trip_boarding_stop_id
from app_modules.fanbus_registrations
where trip_id = '00000000-0000-4327-8200-000000000001';
update app_modules.fanbus_trips set bus_preference_enabled = false
where id = '00000000-0000-4327-8200-000000000001';
select results_eq(
  $$select id, status, bus_preference, trip_boarding_stop_id
    from app_modules.fanbus_registrations
    where trip_id = '00000000-0000-4327-8200-000000000001'
    order by id$$,
  $$select id, status, bus_preference, trip_boarding_stop_id
    from joint_history order by id$$,
  'ACTIVE und WAITLISTED Snapshots bleiben historisch unveraendert'
);
select is(
  (select count(*)::integer from app_modules.fanbus_bus_assignments
   where trip_id = '00000000-0000-4327-8200-000000000001'),
  0,
  'Keine automatische Assignment-Erzeugung findet statt'
);

select * from finish();
rollback;
