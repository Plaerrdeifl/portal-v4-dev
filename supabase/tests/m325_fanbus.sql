\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Schema, Rechte und bewusst unverändertes Capability-Modell.
select has_table('app_modules', 'fanbus_companion_lists', 'Mitfahrerlisten existieren');
select has_table('app_modules', 'fanbus_companion_list_members', 'Listenmitglieder existieren');
select has_table('app_modules', 'fanbus_boarding_stops', 'Zustiegsortstamm existiert');
select has_table('app_modules', 'fanbus_trip_boarding_stops', 'Fahrtzustiegsorte existieren');
select has_table('app_modules', 'fanbus_bus_boarding_stops', 'Buszustiegsorte existieren');
select has_table('app_modules', 'fanbus_participant_checkins', 'Check-ins existieren');
select ok((select relrowsecurity from pg_class where oid='app_modules.fanbus_companion_lists'::regclass), 'Listen haben RLS');
select ok((select relrowsecurity from pg_class where oid='app_modules.fanbus_participant_checkins'::regclass), 'Check-ins haben RLS');
select ok(not has_table_privilege('anon', 'app_modules.fanbus_companion_lists', 'SELECT'), 'Anon kann Listen nicht lesen');
select ok(not has_table_privilege('authenticated', 'app_modules.fanbus_participant_checkins', 'SELECT'), 'Browser kann Check-ins nicht lesen');
select has_column('app_modules', 'fanbus_registrations', 'trip_boarding_stop_id', 'Teilnehmerzustiegsort vorhanden');
select has_column('app_modules', 'fanbus_registrations', 'operational_note', 'Fahrt-Hinweis vorhanden');
select has_column('app_modules', 'fanbus_registrations', 'companion_list_member_id', 'Template-Herkunft vorhanden');
select ok(not exists (select 1 from app_portal.capabilities where code='fanbus.checkin.manage'), 'Keine neue Check-in-Capability');

insert into auth.users (id,email) values
  ('00000000-0000-4325-8000-000000000001','m325-owner@example.invalid'),
  ('00000000-0000-4325-8000-000000000002','m325-other@example.invalid'),
  ('00000000-0000-4325-8000-000000000003','m325-manager@example.invalid'),
  ('00000000-0000-4325-8000-000000000004','m325-waiter@example.invalid');
insert into app_portal.users(id,user_code,email,first_name,last_name,status,role_id) values
  ('00000000-0000-4325-8000-000000000001','U-M325-OWNER','m325-owner@example.invalid','Olivia','Owner','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4325-8000-000000000002','U-M325-OTHER','m325-other@example.invalid','Otto','Other','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4325-8000-000000000003','U-M325-MANAGER','m325-manager@example.invalid','Mara','Manager','ACTIVE','00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4325-8000-000000000004','U-M325-WAITER','m325-waiter@example.invalid','Willi','Waiter','ACTIVE','00000000-0000-4000-8000-000000000003');
insert into app_portal.user_capabilities(user_id,capability_code) values
  ('00000000-0000-4325-8000-000000000003','fanbus.manage'),
  ('00000000-0000-4325-8000-000000000003','fanbus.registrations.manage');

insert into app_modules.events(id,event_type,title,event_date,event_time,visibility) values
  ('00000000-0000-4325-8100-000000000001','OTHER','M325 Fahrt Eins',current_date+10,time '18:00','PUBLIC'),
  ('00000000-0000-4325-8100-000000000002','OTHER','M325 Fahrt Zwei',current_date+11,time '18:00','PUBLIC'),
  ('00000000-0000-4325-8100-000000000003','OTHER','M325 Fahrt Inaktiv',current_date+12,time '18:00','PUBLIC');
insert into app_modules.fanbus_trips(
  id,event_id,departure_at,departure_info,registration_opens_at,
  registration_closes_at,price_cents,capacity,privacy_reference,terms_reference,status
) values
  ('00000000-0000-4325-8200-000000000001','00000000-0000-4325-8100-000000000001',now()+interval '8 days','M325 Test 1',now()-interval '1 day',now()+interval '7 days',2500,30,'privacy-v1','terms-v1','PUBLISHED'),
  ('00000000-0000-4325-8200-000000000002','00000000-0000-4325-8100-000000000002',now()+interval '9 days','M325 Test 2',now()-interval '1 day',now()+interval '8 days',2500,30,'privacy-v1','terms-v1','PUBLISHED'),
  ('00000000-0000-4325-8200-000000000003','00000000-0000-4325-8100-000000000003',now()+interval '10 days','M325 Test Inaktiv',now()-interval '1 day',now()+interval '9 days',2500,30,'privacy-v1','terms-v1','PUBLISHED');

create temporary table m325_results(name text primary key,result jsonb) on commit drop;

-- Stammpunkte und Fahrtpunkte: Serverpositionierung, Bearbeitung und Neuordnung.
select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000003',true);
insert into m325_results values ('master_a',app_private.api_fanbus_boarding_stop_upsert(
  '{"label":"Nord","address":"Nord 1","defaultNote":"Tor A","position":99,"isActive":true}'::jsonb));
insert into m325_results values ('master_b',app_private.api_fanbus_boarding_stop_upsert(
  '{"label":"Süd","address":"Süd 2","position":99,"isActive":true}'::jsonb));
select is((select max(position) from app_modules.fanbus_boarding_stops),2,'Stammpunktposition wird serverseitig vergeben');

insert into m325_results values ('trip_a',app_private.api_fanbus_trip_boarding_stop_upsert(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','boardingStopId',(select result->>'id' from m325_results where name='master_a'),
  'departureAt',now()+interval '8 days','tripNote','Erster Halt','position',77,'isActive',true)));
insert into m325_results values ('trip_b',app_private.api_fanbus_trip_boarding_stop_upsert(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','boardingStopId',(select result->>'id' from m325_results where name='master_b'),
  'departureAt',now()+interval '8 days 10 minutes','tripNote','Zweiter Halt','position',77,'isActive',true)));
insert into m325_results values ('trip2_a',app_private.api_fanbus_trip_boarding_stop_upsert(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000002','boardingStopId',(select result->>'id' from m325_results where name='master_a'),
  'departureAt',now()+interval '9 days','tripNote','Fahrt zwei Nord','position',1,'isActive',true)));
insert into m325_results values ('trip2_b',app_private.api_fanbus_trip_boarding_stop_upsert(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000002','boardingStopId',(select result->>'id' from m325_results where name='master_b'),
  'departureAt',now()+interval '9 days 10 minutes','tripNote','Fahrt zwei Süd','position',2,'isActive',true)));
select is((select max(position) from app_modules.fanbus_trip_boarding_stops where trip_id='00000000-0000-4325-8200-000000000001'),2,'Fahrtpunktposition wird serverseitig vergeben');
select lives_ok(format('select app_private.api_fanbus_boarding_stops_reorder(%L::jsonb)',jsonb_build_object('ids',jsonb_build_array(
  (select result->>'id' from m325_results where name='master_b'),(select result->>'id' from m325_results where name='master_a')))::text),'Stammpunkte lassen sich atomar neu ordnen');
select is((select label from app_modules.fanbus_boarding_stops where position=1),'Süd','Stammpunkt-Neuordnung ist gespeichert');
select lives_ok(format('select app_private.api_fanbus_trip_boarding_stops_reorder(%L::jsonb)',jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','ids',jsonb_build_array(
    (select result->>'id' from m325_results where name='trip_b'),(select result->>'id' from m325_results where name='trip_a')))::text),'Fahrtpunkte lassen sich atomar neu ordnen');
select is((select trip_note from app_modules.fanbus_trip_boarding_stops where id=(select (result->>'id')::uuid from m325_results where name='trip_a')),'Erster Halt','Fahrtpunkt-Hinweis bleibt bei Neuordnung erhalten');
insert into m325_results values ('master_unmapped',app_private.api_fanbus_boarding_stop_upsert(
  '{"label":"Nicht angeboten","position":3,"isActive":true}'::jsonb));
select lives_ok(format('select app_private.api_fanbus_boarding_stop_upsert(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='master_unmapped'),'expectedRevision',1,
  'label','Nicht angeboten','position',3,'isActive',false)::text),'Ungenutzter Stammpunkt kann deaktiviert werden');
select is((select is_active from app_modules.fanbus_boarding_stops where id=(select (result->>'id')::uuid from m325_results where name='master_unmapped')),false,'Stammpunkt-Deaktivierung ist gespeichert');
select lives_ok(format('select app_private.api_fanbus_boarding_stop_upsert(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='master_unmapped'),'expectedRevision',2,
  'label','Nicht angeboten','position',3,'isActive',true)::text),'Stammpunkt kann wieder aktiviert werden');
insert into m325_results values ('trip_unavailable',app_private.api_fanbus_trip_boarding_stop_upsert(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','boardingStopId',(select result->>'id' from m325_results where name='master_unmapped'),
  'departureAt',now()+interval '8 days 20 minutes','tripNote','Nicht aktiv','position',3,'isActive',true)));
select lives_ok(format('select app_private.api_fanbus_trip_boarding_stop_upsert(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='trip_unavailable'),'tripId','00000000-0000-4325-8200-000000000001',
  'boardingStopId',(select result->>'id' from m325_results where name='master_unmapped'),'expectedRevision',1,
  'departureAt',now()+interval '8 days 20 minutes','position',3,'tripNote','Nicht aktiv','isActive',false)::text),'Fahrtzustieg kann deaktiviert werden');
select is((select is_active from app_modules.fanbus_trip_boarding_stops where id=(select (result->>'id')::uuid from m325_results where name='trip_unavailable')),false,'Fahrtzustieg-Deaktivierung ist gespeichert');
select lives_ok(format('select app_private.api_fanbus_boarding_stop_upsert(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='master_unmapped'),'expectedRevision',3,
  'label','Nicht angeboten','position',3,'isActive',false)::text),'Masterpunkt mit historischer Fahrtverknüpfung kann deaktiviert werden');
select is((select boarding_stop_id::text from app_modules.fanbus_trip_boarding_stops where id=(select (result->>'id')::uuid from m325_results where name='trip_unavailable')),(select result->>'id' from m325_results where name='master_unmapped'),'Master-Deaktivierung erhält historische Fahrtverknüpfung');
select lives_ok(format('select app_private.api_fanbus_boarding_stop_upsert(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='master_unmapped'),'expectedRevision',4,
  'label','Nicht angeboten','position',3,'isActive',true)::text),'Historischer Masterpunkt kann wieder aktiviert werden');
insert into m325_results values ('master_disabled',app_private.api_fanbus_boarding_stop_upsert(
  '{"label":"Deaktivierter Master","position":4,"isActive":false}'::jsonb));
select throws_ok(format($q$select app_private.api_fanbus_trip_boarding_stop_upsert(%L::jsonb)$q$,jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000003','boardingStopId',(select result->>'id' from m325_results where name='master_disabled'),
  'departureAt',now()+interval '10 days','position',1,'isActive',true)::text),
  '22023','FANBUS_ACTIVE_TRIP_STOP_REQUIRES_ACTIVE_MASTER','Inaktiver Master kann kein neuer aktiver Fahrtzustieg werden');
insert into m325_results values ('trip3_inactive',app_private.api_fanbus_trip_boarding_stop_upsert(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000003','boardingStopId',(select result->>'id' from m325_results where name='master_a'),
  'departureAt',now()+interval '10 days','position',1,'isActive',false)));

insert into app_modules.fanbus_buses(id,trip_id,label,category,capacity,is_active,created_by,updated_by) values
  ('00000000-0000-4325-8400-000000000001','00000000-0000-4325-8200-000000000001','Bus Eins','NORMAL',20,true,'00000000-0000-4325-8000-000000000003','00000000-0000-4325-8000-000000000003'),
  ('00000000-0000-4325-8400-000000000002','00000000-0000-4325-8200-000000000001','Bus Zwei','PARTY',20,true,'00000000-0000-4325-8000-000000000003','00000000-0000-4325-8000-000000000003');
insert into m325_results values ('map_bus_1',app_private.api_fanbus_bus_boarding_stops_set(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','busId','00000000-0000-4325-8400-000000000001','expectedRevision',1,
  'tripBoardingStopIds',jsonb_build_array((select result->>'id' from m325_results where name='trip_a')))));
insert into m325_results values ('map_bus_2',app_private.api_fanbus_bus_boarding_stops_set(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','busId','00000000-0000-4325-8400-000000000002','expectedRevision',1,
  'tripBoardingStopIds',jsonb_build_array((select result->>'id' from m325_results where name='trip_b')))));
select is((select (result->>'revision')::integer from m325_results where name='map_bus_1'),2,'Mapping erhöht und liefert Busrevision');

-- Persönliche Listen: Isolation, Umbenennen, CRUD, Löcher und explizite Reihenfolge.
select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000001',true);
insert into m325_results values ('owner_list',app_private.api_fanbus_companion_list_upsert('{"name":"Auswärts"}'::jsonb));
insert into m325_results values ('spare_list',app_private.api_fanbus_companion_list_upsert('{"name":"Löschen"}'::jsonb));
select lives_ok(format('select app_private.api_fanbus_companion_list_delete(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='spare_list'),'expectedRevision',1)::text),'Eigene leere Liste kann gelöscht werden');
insert into m325_results values ('rename_list',app_private.api_fanbus_companion_list_upsert(jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='owner_list'),'expectedRevision',1,'name','Stammcrew')));
select is((select name from app_modules.fanbus_companion_lists where id=(select (result->>'id')::uuid from m325_results where name='owner_list')),'Stammcrew','Liste wird umbenannt');

insert into m325_results values ('member_a',app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'firstName','Anna','lastName','Alpha',
  'defaultBoardingStopId',(select result->>'id' from m325_results where name='master_a'),'defaultBusPreference','RUHIG','operationalNote','Fenster')));
insert into m325_results values ('member_b',app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'firstName','Berta','lastName','Beta',
  'defaultBoardingStopId',(select result->>'id' from m325_results where name='master_b'),'defaultBusPreference','PARTY','operationalNote','Vorne')));
insert into m325_results values ('member_c',app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'firstName','Clara','lastName','Gamma',
  'defaultBoardingStopId',(select result->>'id' from m325_results where name='master_b'),'defaultBusPreference','EGAL')));
select is((select string_agg(position::text,',' order by position) from app_modules.fanbus_companion_list_members where list_id=(select (result->>'id')::uuid from m325_results where name='owner_list')),'1,2,3','Neue Mitglieder erhalten fortlaufende Serverpositionen');
select lives_ok(format('select app_private.api_fanbus_companion_member_delete(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='member_b'),'expectedRevision',1)::text),'Mittleres Mitglied kann gelöscht werden');
select is((select string_agg(position::text,',' order by position) from app_modules.fanbus_companion_list_members where list_id=(select (result->>'id')::uuid from m325_results where name='owner_list')),'1,2','Löschen schließt Positionslöcher');
insert into m325_results values ('member_d',app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'firstName','Dora','lastName','Delta',
  'defaultBoardingStopId',(select result->>'id' from m325_results where name='master_b'),'defaultBusPreference','PARTY','operationalNote','Vorschlag')));
select is((select (result->>'position')::integer from m325_results where name='member_d'),3,'Einfügen nach Löschung bleibt lochrobust');
select lives_ok(format('select app_private.api_fanbus_companion_members_reorder(%L::jsonb)',jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'memberIds',jsonb_build_array(
    (select result->>'id' from m325_results where name='member_d'),(select result->>'id' from m325_results where name='member_a'),
    (select result->>'id' from m325_results where name='member_c')))::text),'Mitfahrer lassen sich atomar neu ordnen');
select is((select first_name from app_modules.fanbus_companion_list_members where list_id=(select (result->>'id')::uuid from m325_results where name='owner_list') and position=1),'Dora','Mitfahrer-Neuordnung ist gespeichert');

select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000002',true);
insert into m325_results values ('foreign_list',app_private.api_fanbus_companion_list_upsert('{"name":"Fremd"}'::jsonb));
insert into m325_results values ('foreign_member',app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='foreign_list'),'firstName','Frieda','lastName','Fremd','defaultBusPreference','EGAL')));
insert into m325_results values ('foreign_member_2',app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='foreign_list'),'firstName','Felix','lastName','Fremd',
  'defaultBoardingStopId',(select result->>'id' from m325_results where name='master_b'),'defaultBusPreference','RUHIG')));
insert into m325_results values ('foreign_unmapped',app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='foreign_list'),'firstName','Una','lastName','Unmapped',
  'defaultBoardingStopId',(select result->>'id' from m325_results where name='master_unmapped'),'defaultBusPreference','EGAL')));
select is(jsonb_array_length(app_private.api_fanbus_companion_lists_list()->'lists'),1,'User B sieht nur die eigene Liste');
select throws_ok(format($q$select app_private.api_fanbus_companion_list_upsert(%L::jsonb)$q$,jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='owner_list'),'expectedRevision',2,'name','Manipuliert')::text),
  '40001','STALE_REVISION_OR_NOT_FOUND','User B kann Liste von A nicht ändern');
select throws_ok($q$select app_private.api_fanbus_trip_boarding_stops_list('{"tripId":"00000000-0000-4325-8200-000000000001"}'::jsonb)$q$,
  '42501','Berechtigung fehlt: fanbus.manage oder fanbus.registrations.manage','Interne Fahrthaltliste verweigert normalen aktiven Usern den Zugriff');
insert into app_portal.user_capabilities(user_id,capability_code) values
  ('00000000-0000-4325-8000-000000000002','fanbus.manage');
select lives_ok($q$select app_private.api_fanbus_trip_boarding_stops_list('{"tripId":"00000000-0000-4325-8200-000000000001"}'::jsonb)$q$,
  'Interne Fahrthaltliste erlaubt fanbus.manage allein');
delete from app_portal.user_capabilities where user_id='00000000-0000-4325-8000-000000000002' and capability_code='fanbus.manage';
insert into app_portal.user_capabilities(user_id,capability_code) values
  ('00000000-0000-4325-8000-000000000002','fanbus.registrations.manage');
select lives_ok($q$select app_private.api_fanbus_trip_boarding_stops_list('{"tripId":"00000000-0000-4325-8200-000000000001"}'::jsonb)$q$,
  'Interne Fahrthaltliste erlaubt fanbus.registrations.manage allein');
delete from app_portal.user_capabilities where user_id='00000000-0000-4325-8000-000000000002' and capability_code='fanbus.registrations.manage';
update app_portal.users set status='INACTIVE' where id='00000000-0000-4325-8000-000000000002';
select throws_ok('select app_private.api_fanbus_companion_lists_list()','42501','Aktiver Portalzugang erforderlich.','Inaktiver User kann persönliche Listen nicht lesen');
update app_portal.users set status='ACTIVE' where id='00000000-0000-4325-8000-000000000002';
select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000001',true);
select is(jsonb_array_length(app_private.api_fanbus_companion_lists_list()->'lists'),1,'Listenabfrage liefert nur eigene Listen');
select throws_ok(format($q$select app_private.api_fanbus_companion_duplicate_preview(%L::jsonb)$q$,jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000002','participants',jsonb_build_array(jsonb_build_object(
    'templateMemberId',(select result->>'id' from m325_results where name='foreign_member'),'firstName','Frieda','lastName','Fremd')))::text),
  '42501','FANBUS_TEMPLATE_MEMBER_FORBIDDEN','Preview verbirgt fremde Templates');

-- Direkte Manipulation des alten Self-Register-Pfads wird im Insert-Trigger abgewehrt und bleibt atomar.
select throws_ok(format($q$select app_private.api_fanbus_self_register(%L::jsonb)$q$,jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000002','busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a'),
  'companions',jsonb_build_array(jsonb_build_object('firstName','Frieda','lastName','Fremd','busPreference','EGAL',
    'boardingStopId',(select result->>'id' from m325_results where name='trip2_a'),'templateMemberId',(select result->>'id' from m325_results where name='foreign_member'))),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000001')::text),
  '42501','FANBUS_TEMPLATE_MEMBER_FORBIDDEN','Direkter Fremd-Template-Versuch wird abgewehrt');
select is((select count(*)::integer from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000002' and portal_user_id='00000000-0000-4325-8000-000000000001'),0,'Fremd-Template-Versuch hinterlässt keine Teilbuchung');

-- Preview und echte Subset-Buchung mit Overrides und Master-zu-Fahrt-Mapping.
insert into m325_results values ('preview_ready',app_private.api_fanbus_companion_duplicate_preview(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','participants',jsonb_build_array(jsonb_build_object(
    'templateMemberId',(select result->>'id' from m325_results where name='member_d'),'firstName','Rita','lastName','Override')))));
select is((select result->>'canSubmit' from m325_results where name='preview_ready'),'true','Preview erlaubt konfliktfreie Auswahl');
insert into m325_results values ('booking_subset',app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'tripId','00000000-0000-4325-8200-000000000001',
  'busPreference','RUHIG','boardingStopId',(select result->>'id' from m325_results where name='trip_a'),'operationalNote','Primärnotiz',
  'participants',jsonb_build_array(jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='member_d'),
    'firstName','Rita','lastName','Override','busPreference','PARTY','operationalNote','Editierter Vorschlag')),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000002')));
select is((select count(*)::integer from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001'),2,'Subset-Buchung legt Primary plus genau einen Mitfahrer an');
select is((select first_name||' '||last_name from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),'Rita Override','Namensoverride wird gebucht');
select is((select bus_preference from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),'PARTY','Buspräferenz-Override wird gebucht');
select is((select operational_note from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),'Editierter Vorschlag','Editierte Notiz wird gebucht');
select is((select trip_boarding_stop_id::text from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),(select result->>'id' from m325_results where name='trip_b'),'Master-Standardhalt wird auf aktiven Fahrthalt abgebildet');
select ok((public.pd_public_fanbus_trip_boarding_stops('00000000-0000-4325-8200-000000000001'::uuid)->'stops'->0 ?& array['tripBoardingStopId','boardingStopId']),'Öffentliche Fahrthalt-API liefert normalen Usern beide IDs');
select is((app_private.api_fanbus_companion_duplicate_preview(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','participants',jsonb_build_array(jsonb_build_object(
    'templateMemberId',(select result->>'id' from m325_results where name='member_d'),'firstName','Rita','lastName','Override'))))->'members'->0->>'status'),'ALREADY_REGISTERED','Preview erkennt gebuchtes Template');
insert into m325_results values ('booking_subset_replay',app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'tripId','00000000-0000-4325-8200-000000000001',
  'busPreference','RUHIG','boardingStopId',(select result->>'id' from m325_results where name='trip_a'),'operationalNote','Primärnotiz',
  'participants',jsonb_build_array(jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='member_d'),
    'firstName','Rita','lastName','Override','busPreference','PARTY','operationalNote','Editierter Vorschlag')),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000002')));
select is((select result from m325_results where name='booking_subset_replay'),(select result from m325_results where name='booking_subset'),'Gleicher Key und identisches M325-Payload liefern stabilen Replay');
select throws_ok(format($q$select app_private.api_fanbus_companion_booking_submit(%L::jsonb)$q$,jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'tripId','00000000-0000-4325-8200-000000000001',
  'busPreference','RUHIG','boardingStopId',(select result->>'id' from m325_results where name='trip_b'),'operationalNote','Primärnotiz',
  'participants',jsonb_build_array(jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='member_d'),
    'firstName','Rita','lastName','Override','busPreference','PARTY','operationalNote','Editierter Vorschlag')),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000002')::text),
  '22023','FANBUS_IDEMPOTENCY_KEY_REUSED','Gleicher Key mit anderem M325-Zustieg wird abgelehnt');
select throws_ok(format($q$select app_private.api_fanbus_companion_booking_submit(%L::jsonb)$q$,jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'tripId','00000000-0000-4325-8200-000000000001',
  'busPreference','RUHIG','boardingStopId',(select result->>'id' from m325_results where name='trip_a'),'operationalNote','Primärnotiz',
  'participants',jsonb_build_array(jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='member_d'),
    'firstName','Rita','lastName','Override','busPreference','PARTY','operationalNote','Andere Notiz')),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000002')::text),
  '22023','FANBUS_IDEMPOTENCY_KEY_REUSED','Gleicher Key mit anderer M325-Notiz wird abgelehnt');
select throws_ok(format($q$select app_private.api_fanbus_companion_booking_submit(%L::jsonb)$q$,jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'tripId','00000000-0000-4325-8200-000000000001',
  'busPreference','RUHIG','boardingStopId',(select result->>'id' from m325_results where name='trip_a'),'operationalNote','Primärnotiz',
  'participants',jsonb_build_array(jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='member_a'),
    'firstName','Anna','lastName','Alpha','busPreference','RUHIG','operationalNote','Editierter Vorschlag')),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000002')::text),
  '22023','FANBUS_IDEMPOTENCY_KEY_REUSED','Gleicher Key mit anderer Template-Zuordnung wird abgelehnt');

-- Manuelle M320-Erfassung auf strukturierter Fahrt sowie finaler Name-Konflikt und Rebooking nach Storno.
select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000003',true);
insert into m325_results values ('manual_conflict',app_private.api_fanbus_registration_create_manual(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000002','mode','GUEST','firstName','Dora','lastName','Delta',
  'email','dora@example.invalid','busPreference','EGAL','privacyConfirmed',true,'termsConfirmed',true,
  'idempotencyKey','00000000-0000-4325-8300-000000000003','boardingStopId',(select result->>'id' from m325_results where name='trip2_b'),
  'operationalNote','Manuell erfasst')));
select is((select trip_boarding_stop_id::text from app_modules.fanbus_registrations where id=(select (result->>'registrationId')::uuid from m325_results where name='manual_conflict')),(select result->>'id' from m325_results where name='trip2_b'),'Manuelle Erfassung speichert Fahrtzustieg');
select is((select operational_note from app_modules.fanbus_registrations where id=(select (result->>'registrationId')::uuid from m325_results where name='manual_conflict')),'Manuell erfasst','Manuelle Erfassung speichert Hinweis');
insert into m325_results values ('manual_no_active_stop',app_private.api_fanbus_registration_create_manual(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000003','mode','GUEST','firstName','Ohne','lastName','Zustieg',
  'email','ohne-zustieg@example.invalid','busPreference','EGAL','privacyConfirmed',true,'termsConfirmed',true,
  'idempotencyKey','00000000-0000-4325-8300-000000000011')));
select is((select result->>'outcome' from m325_results where name='manual_no_active_stop'),'CREATED','Manuelle Erfassung bleibt ohne aktive Fahrtzustiege M320-kompatibel');
select is((select trip_boarding_stop_id from app_modules.fanbus_registrations where id=(select (result->>'registrationId')::uuid from m325_results where name='manual_no_active_stop')),null,'Manuelle Erfassung ohne aktive Fahrtzustiege speichert keinen Halt');

select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000001',true);
select throws_ok(format($q$select app_private.api_fanbus_companion_booking_submit(%L::jsonb)$q$,jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'tripId','00000000-0000-4325-8200-000000000002',
  'busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a'),
  'participants',jsonb_build_array(jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='member_d'),
    'firstName','Dora','lastName','Delta','busPreference','PARTY','boardingStopId',(select result->>'id' from m325_results where name='trip2_b'))),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000004')::text),
  'P3251','FANBUS_COMPANION_CONFLICT','Finaler Insert-Guard erkennt Namenskonflikt unter Fahrt-Lock');
select is((select count(*)::integer from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000002' and portal_user_id='00000000-0000-4325-8000-000000000001'),0,'Finaler Konflikt rollt Primary und Companion gemeinsam zurück');

select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000003',true);
select lives_ok(format('select app_private.api_fanbus_registration_cancel(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'registrationId' from m325_results where name='manual_conflict'),'expectedRevision',1)::text),'Konfliktteilnehmer kann storniert werden');
select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000001',true);
insert into m325_results values ('booking_after_cancel',app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='owner_list'),'tripId','00000000-0000-4325-8200-000000000002',
  'busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a'),
  'participants',jsonb_build_array(jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='member_d'),
    'firstName','Dora','lastName','Delta','busPreference','PARTY','boardingStopId',(select result->>'id' from m325_results where name='trip2_b'))),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000005')));
select is((select result->>'outcome' from m325_results where name='booking_after_cancel'),'CREATED','Stornierter Konflikt blockiert spätere Buchung nicht');

-- Nicht angebotener Default, vollständige Liste, PRIMARY-Sperre und einheitliche Gruppenstatus.
select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000002',true);
select throws_ok(format($q$select app_private.api_fanbus_companion_booking_submit(%L::jsonb)$q$,jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='foreign_list'),'tripId','00000000-0000-4325-8200-000000000001',
  'busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip_a'),
  'participants',jsonb_build_array(jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='foreign_unmapped'),
    'firstName','Una','lastName','Unmapped','busPreference','EGAL')),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000006')::text),
  '22023','FANBUS_BOARDING_STOP_REQUIRED','Nicht angebotener Master-Default wird nicht als Fahrt-ID übernommen');
select is((select count(*)::integer from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and portal_user_id='00000000-0000-4325-8000-000000000002'),0,'Ungültiger Default hinterlässt keine Teilbuchung');
select lives_ok(format('select app_private.api_fanbus_companion_member_delete(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='foreign_unmapped'),'expectedRevision',1)::text),'Nicht benötigte Vorlage kann entfernt werden');
insert into m325_results values ('foreign_complete_booking',app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='foreign_list'),'tripId','00000000-0000-4325-8200-000000000002',
  'busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a'),
  'participants',jsonb_build_array(
    jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='foreign_member'),
      'firstName','Frieda','lastName','Fremd','busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a')),
    jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='foreign_member_2'),
      'firstName','Felix','lastName','Fremd','busPreference','RUHIG')),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000007')));
select is((select count(*)::integer from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='foreign_complete_booking')),3,'Komplette zweiköpfige Liste wird mit Primary gebucht');
select is((select count(distinct status)::integer from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='foreign_complete_booking')),1,'Komplette Gruppe hat einheitlichen ACTIVE-Status');
insert into m325_results values ('foreign_member_after_primary',app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='foreign_list'),'firstName','Nina','lastName','Neu','defaultBusPreference','EGAL')));
select is((app_private.api_fanbus_companion_duplicate_preview(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000002','participants',jsonb_build_array(jsonb_build_object(
    'templateMemberId',(select result->>'id' from m325_results where name='foreign_member_after_primary'),'firstName','Nina','lastName','Neu'))))->>'primaryStatus'),'ALREADY_REGISTERED','Preview sperrt nach bereits registriertem PRIMARY');
select is((app_private.api_fanbus_companion_duplicate_preview(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000002','participants',jsonb_build_array(jsonb_build_object(
    'templateMemberId',(select result->>'id' from m325_results where name='foreign_member_after_primary'),'firstName','Nina','lastName','Neu'))))->>'canSubmit'),'false','PRIMARY-Sperre verhindert nachträgliche Companion-Erweiterung');
select throws_ok(format($q$select app_private.api_fanbus_companion_booking_submit(%L::jsonb)$q$,jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='foreign_list'),'tripId','00000000-0000-4325-8200-000000000002',
  'busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a'),
  'participants',jsonb_build_array(jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='foreign_member_after_primary'),
    'firstName','Nina','lastName','Neu','busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a'))),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000008')::text),
  'P3201','FANBUS_BATCH_DUPLICATE','Finaler Submit lehnt Erweiterung bei registriertem PRIMARY ab');
select is((select count(*)::integer from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='foreign_complete_booking')),3,'PRIMARY-Konflikt fügt keinen weiteren Companion hinzu');
select throws_ok(format($q$select app_private.api_fanbus_companion_booking_submit(%L::jsonb)$q$,jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='foreign_list'),'tripId','00000000-0000-4325-8200-000000000002',
  'busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a'),
  'participants',jsonb_build_array(jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='foreign_member'),
    'firstName','Frieda','lastName','Fremd','busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a'))),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000009')::text),
  'P3201','FANBUS_BATCH_DUPLICATE','Finaler Submit bucht gleiches Template nicht erneut');
select is((select count(*)::integer from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='foreign_complete_booking')),3,'Gleiches Template verändert bestehende Gruppe nicht');

update app_modules.fanbus_trips set capacity=5 where id='00000000-0000-4325-8200-000000000002';
select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000004',true);
insert into m325_results values ('wait_list',app_private.api_fanbus_companion_list_upsert('{"name":"Warteliste"}'::jsonb));
insert into m325_results values ('wait_member_1',app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='wait_list'),'firstName','Wanda','lastName','Wartet','defaultBusPreference','EGAL')));
insert into m325_results values ('wait_member_2',app_private.api_fanbus_companion_member_upsert(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='wait_list'),'firstName','Werner','lastName','Wartet','defaultBusPreference','EGAL')));
insert into m325_results values ('wait_booking',app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='wait_list'),'tripId','00000000-0000-4325-8200-000000000002',
  'busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a'),
  'participants',jsonb_build_array(
    jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='wait_member_1'),'firstName','Wanda','lastName','Wartet','busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_a')),
    jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='wait_member_2'),'firstName','Werner','lastName','Wartet','busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip2_b'))),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000010')));
select is((select result->>'outcome' from m325_results where name='wait_booking'),'WAITLISTED','Volle Fahrt stellt komplette neue Gruppe auf Warteliste');
select is((select count(*)::integer from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='wait_booking')),3,'Wartelistenbuchung enthält Primary und komplette Liste');
select is((select count(distinct status)::integer from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='wait_booking')),1,'Wartelistengruppe hat einen einheitlichen Status');
select is((select min(status) from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='wait_booking')),'WAITLISTED','Alle Gruppenmitglieder sind WAITLISTED');

-- Template-Änderung und -Löschung verändern bestehende Fahrt-Snapshots nicht.
select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000001',true);
select lives_ok(format('select app_private.api_fanbus_companion_member_upsert(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='member_d'),'listId',(select result->>'id' from m325_results where name='owner_list'),
  'expectedRevision',2,'firstName','Geändert','lastName','Vorlage','defaultBusPreference','RUHIG')::text),'Vorlage kann nach Buchung geändert werden');
select is((select first_name||' '||last_name from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),'Rita Override','Vorlagenänderung beeinflusst alte Registrierung nicht');
select lives_ok(format('select app_private.api_fanbus_companion_member_delete(%L::jsonb)',jsonb_build_object(
  'id',(select result->>'id' from m325_results where name='member_d'),'expectedRevision',3)::text),'Gebuchte Vorlage kann gelöscht werden');
select is((select first_name||' '||last_name from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='booking_after_cancel') and booking_role='COMPANION'),'Dora Delta','Vorlagenlöschung beeinflusst alte Registrierung nicht');
select is((select companion_list_member_id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),null,'Gelöschte Vorlage wird referenziell gelöst');
select throws_ok($q$select app_private.api_fanbus_operations_snapshot('{"tripId":"00000000-0000-4325-8200-000000000001"}'::jsonb)$q$,
  '42501','Berechtigung fehlt: fanbus.registrations.manage','User ohne Capability kann Betriebssnapshot nicht lesen');
select set_config('request.jwt.claim.sub','',true);
select throws_ok('select app_private.api_fanbus_companion_lists_list()','42501','Anmeldung erforderlich.','Nicht angemeldeter Aufruf wird abgelehnt');

-- Bus-/Zustiegsinvarianten, Optimistic Locking und replace-all.
select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000003',true);
select lives_ok(format('select app_private.api_fanbus_bus_assignment_set(%L::jsonb)',jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='PRIMARY'),
  'busId','00000000-0000-4325-8400-000000000001')::text),'Primary wird passendem Bus zugeordnet');
select lives_ok(format('select app_private.api_fanbus_bus_assignment_set(%L::jsonb)',jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'busId','00000000-0000-4325-8400-000000000002')::text),'Companion wird passendem Bus zugeordnet');
select throws_ok(format($q$select app_private.api_fanbus_bus_assignment_set(%L::jsonb)$q$,jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'busId','00000000-0000-4325-8400-000000000001')::text),'22023','FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP','Assignment lehnt nicht bedienten Halt ab');
select throws_ok(format($q$select app_private.api_fanbus_registration_operational_update(%L::jsonb)$q$,jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',1,'tripBoardingStopId',(select result->>'id' from m325_results where name='trip_a'),'operationalNote','Falscher Bus')::text),
  '22023','FANBUS_BUS_DOES_NOT_SERVE_BOARDING_STOP','Operational Update wahrt Bus-Halt-Invariante');
select throws_ok(format($q$select app_private.api_fanbus_bus_boarding_stops_set(%L::jsonb)$q$,jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','busId','00000000-0000-4325-8400-000000000002','expectedRevision',2,
  'tripBoardingStopIds','[]'::jsonb)::text),'22023','FANBUS_BUS_STOP_IN_USE','Mapping entfernt keinen aktiv genutzten Halt');
select throws_ok(format($q$select app_private.api_fanbus_bus_boarding_stops_set(%L::jsonb)$q$,jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','busId','00000000-0000-4325-8400-000000000002','expectedRevision',1,
  'tripBoardingStopIds',jsonb_build_array((select result->>'id' from m325_results where name='trip_b')))::text),
  '40001','STALE_REVISION','Mapping lehnt veraltete Busrevision ab');
select throws_ok(format($q$select app_private.api_fanbus_bus_boarding_stops_set(%L::jsonb)$q$,jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','busId','00000000-0000-4325-8400-000000000002','expectedRevision',2,
  'tripBoardingStopIds',jsonb_build_array((select result->>'id' from m325_results where name='trip2_a')))::text),
  '22023','FANBUS_BUS_BOARDING_STOP_CROSS_TRIP','Mapping lehnt Fahrt-fremden Halt ab');
insert into m325_results values ('map_bus_2_replace',app_private.api_fanbus_bus_boarding_stops_set(jsonb_build_object(
  'tripId','00000000-0000-4325-8200-000000000001','busId','00000000-0000-4325-8400-000000000002','expectedRevision',2,
  'tripBoardingStopIds',jsonb_build_array((select result->>'id' from m325_results where name='trip_b'),(select result->>'id' from m325_results where name='trip_a')))));
select is((select (result->>'revision')::integer from m325_results where name='map_bus_2_replace'),3,'Replace-all liefert neue Busrevision');
select is((select jsonb_array_length(value->'tripBoardingStopIds') from jsonb_array_elements(app_private.api_fanbus_bus_boarding_stops_list('{"tripId":"00000000-0000-4325-8200-000000000001"}'::jsonb)->'buses') value where value->>'busId'='00000000-0000-4325-8400-000000000002'),2,'Mapping-Lese-API liefert replace-all Ergebnis');
insert into m325_results values ('operational_to_a',app_private.api_fanbus_registration_operational_update(jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',1,'tripBoardingStopId',(select result->>'id' from m325_results where name='trip_a'),'operationalNote','Korrigiert')));
select is((select (result->>'revision')::integer from m325_results where name='operational_to_a'),2,'Operational Update liefert neue Revision');
select lives_ok(format('select app_private.api_fanbus_registration_operational_update(%L::jsonb)',jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',2,'tripBoardingStopId',(select result->>'id' from m325_results where name='trip_b'),'operationalNote','Zurück Süd')::text),'Operational Update kann zu bedientem Halt zurückkorrigieren');
select throws_ok(format($q$select app_private.api_fanbus_registration_operational_update(%L::jsonb)$q$,jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',3,'tripBoardingStopId',(select result->>'id' from m325_results where name='trip2_a'),'operationalNote','Fremde Fahrt')::text),
  '22023','FANBUS_PARTICIPANT_OPERATIONAL_INVALID_PAYLOAD','Operational Update lehnt Fahrt-fremden Halt ab');
insert into m325_results values ('atomic_update_success',app_private.api_fanbus_registration_update_m325(jsonb_build_object(
  'id',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',3,'firstName','Rita Atom','lastName','Erfolg','email','rita.atomic@example.invalid','busPreference','RUHIG',
  'tripBoardingStopId',(select result->>'id' from m325_results where name='trip_a'),'operationalNote','Atomar')));
select is((select first_name||'|'||last_name||'|'||email||'|'||bus_preference||'|'||revision::text
  from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'Rita Atom|Erfolg|rita.atomic@example.invalid|RUHIG|5','Atomarer Editor speichert Stamm- und Betriebsdaten mit zwei Revisionserhöhungen');
select throws_ok(format($q$select app_private.api_fanbus_registration_update_m325(%L::jsonb)$q$,jsonb_build_object(
  'id',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',5,'firstName','Rollback','lastName','Fehler','email','rollback@example.invalid','busPreference','PARTY',
  'tripBoardingStopId',(select result->>'id' from m325_results where name='trip2_a'),'operationalNote','Darf nicht bleiben')::text),
  '22023','FANBUS_PARTICIPANT_OPERATIONAL_INVALID_PAYLOAD','Fehler im zweiten Schritt lässt atomaren Teilnehmereditor scheitern');
select is((select first_name||'|'||last_name||'|'||email||'|'||bus_preference||'|'||revision::text
  from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'Rita Atom|Erfolg|rita.atomic@example.invalid|RUHIG|5','Fehler im Betriebsupdate rollt auch das vorherige Stammdatenupdate zurück');
select lives_ok(format('select app_private.api_fanbus_registration_operational_update(%L::jsonb)',jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',5,'tripBoardingStopId',(select result->>'id' from m325_results where name='trip_b'),'operationalNote','Zurück Süd')::text),
  'Teilnehmer kann nach atomarem Update zum zweiten bedienten Halt zurückkehren');
select ok(
  position('from app_modules.fanbus_buses bus' in lower(definition))
    > position('from app_modules.fanbus_registrations' in lower(definition)),
  'Technischer Lockvertrag ordnet Teilnehmer-Lock vor Bus-Lock an'
) from (select pg_get_functiondef('app_private.api_fanbus_registration_operational_update(jsonb)'::regprocedure) definition) lock_contract;

-- Snapshot: zwei Busse, zwei Halte, fehlender Check-in sowie Statuswechsel.
delete from app_modules.fanbus_participant_checkins where participant_id=(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION');
insert into m325_results values ('checkin_present',app_private.api_fanbus_checkin_set(jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='PRIMARY'),
  'expectedRevision',1,'status','PRESENT')));
insert into m325_results values ('snapshot',app_private.api_fanbus_operations_snapshot('{"tripId":"00000000-0000-4325-8200-000000000001"}'::jsonb));
select is((select (result->'summary'->>'expected')::integer from m325_results where name='snapshot'),2,'Snapshot zählt zwei aktive Teilnehmer');
select is((select jsonb_array_length(result->'buses') from m325_results where name='snapshot'),2,'Snapshot gruppiert zwei Busse ohne Mehrzeilenfehler');
select is((select jsonb_array_length(result->'stops') from m325_results where name='snapshot'),2,'Snapshot gruppiert zwei Halte ohne Mehrzeilenfehler');
select is((select sum((value->>'expected')::integer)::integer from m325_results,jsonb_array_elements(result->'buses') value where name='snapshot'),2,'Busgruppen summieren sich korrekt');
select is((select sum((value->>'expected')::integer)::integer from m325_results,jsonb_array_elements(result->'stops') value where name='snapshot'),2,'Haltgruppen summieren sich korrekt');
select is((select value->>'checkinStatus' from m325_results,jsonb_array_elements(result->'participants') value where name='snapshot' and value->>'firstName'='Rita Atom'),'OPEN','Fehlender Check-in wird im Snapshot als OPEN behandelt');
select is((select (value->>'checkinRevision')::integer from m325_results,jsonb_array_elements(result->'participants') value where name='snapshot' and value->>'firstName'='Rita Atom'),1,'Fehlender Check-in erhält virtuelle Revision eins');
insert into m325_results values ('checkin_missing_created',app_private.api_fanbus_checkin_set(jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',1,'status','NO_SHOW')));
select is((select result->'summary'->>'present' from m325_results where name='checkin_missing_created'),'1','Check-in-Snapshot zählt PRESENT');
select is((select result->'summary'->>'noShow' from m325_results where name='checkin_missing_created'),'1','Fehlender Check-in wird angelegt und als NO_SHOW gezählt');
insert into m325_results values ('checkin_companion_open',app_private.api_fanbus_checkin_set(jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',2,'status','OPEN')));
select is((select result->'summary'->>'open' from m325_results where name='checkin_companion_open'),'1','NO_SHOW lässt sich auf OPEN korrigieren');
insert into m325_results values ('checkin_companion_present',app_private.api_fanbus_checkin_set(jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',3,'status','PRESENT')));
select is((select result->'summary'->>'present' from m325_results where name='checkin_companion_present'),'2','OPEN lässt sich auf PRESENT korrigieren');
insert into m325_results values ('checkin_companion_no_show_again',app_private.api_fanbus_checkin_set(jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',4,'status','NO_SHOW')));
select is((select result->'summary'->>'noShow' from m325_results where name='checkin_companion_no_show_again'),'1','PRESENT lässt sich auf NO_SHOW korrigieren');
insert into m325_results values ('checkin_primary_open',app_private.api_fanbus_checkin_set(jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='PRIMARY'),
  'expectedRevision',2,'status','OPEN')));
select is((select result->'summary'->>'open' from m325_results where name='checkin_primary_open'),'1','PRESENT lässt sich auf OPEN korrigieren');
select lives_ok(format('select app_private.api_fanbus_checkin_set(%L::jsonb)',jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='PRIMARY'),
  'expectedRevision',3,'status','PRESENT')::text),'OPEN lässt sich wieder auf PRESENT korrigieren');
select throws_ok(format($q$select app_private.api_fanbus_checkin_set(%L::jsonb)$q$,jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000001' and booking_role='COMPANION'),
  'expectedRevision',1,'status','PRESENT')::text),'40001','STALE_REVISION_OR_NOT_FOUND','Check-in schützt gegen veraltete Revision');
select throws_ok(format($q$select app_private.api_fanbus_checkin_set(%L::jsonb)$q$,jsonb_build_object(
  'participantId',(select result->>'registrationId' from m325_results where name='manual_conflict'),
  'expectedRevision',1,'status','PRESENT')::text),'22023','FANBUS_CHECKIN_REQUIRES_ACTIVE_PARTICIPANT','CANCELLED wird nicht eingecheckt');
select throws_ok(format($q$select app_private.api_fanbus_checkin_set(%L::jsonb)$q$,jsonb_build_object(
  'participantId',(select id from app_modules.fanbus_registrations where trip_id='00000000-0000-4325-8200-000000000002' and portal_user_id='00000000-0000-4325-8000-000000000004' and booking_role='PRIMARY'),
  'expectedRevision',1,'status','PRESENT')::text),'22023','FANBUS_CHECKIN_REQUIRES_ACTIVE_PARTICIPANT','WAITLISTED wird nicht eingecheckt');
select is((app_private.api_fanbus_operations_snapshot('{"tripId":"00000000-0000-4325-8200-000000000002"}'::jsonb)->'summary'->>'expected')::integer,5,'Snapshot erwartet weder WAITLISTED noch CANCELLED');
update app_portal.users set status='INACTIVE' where id='00000000-0000-4325-8000-000000000003';
select throws_ok($q$select app_private.api_fanbus_operations_snapshot('{"tripId":"00000000-0000-4325-8200-000000000001"}'::jsonb)$q$,
  '42501','Aktiver Portalzugang erforderlich.','Inaktiver Manager kann Betriebssnapshot nicht lesen');
update app_portal.users set status='ACTIVE' where id='00000000-0000-4325-8000-000000000003';

-- Gemischte Gruppe: Template-Mitfahrer, normaler M320-Mitfahrer und konkrete Fahrt-E-Mail bleiben atomar erhalten.
select set_config('request.jwt.claim.sub','00000000-0000-4325-8000-000000000002',true);
insert into m325_results values ('mixed_booking',app_private.api_fanbus_companion_booking_submit(jsonb_build_object(
  'listId',(select result->>'id' from m325_results where name='foreign_list'),'tripId','00000000-0000-4325-8200-000000000001',
  'busPreference','EGAL','boardingStopId',(select result->>'id' from m325_results where name='trip_a'),
  'participants',jsonb_build_array(
    jsonb_build_object('templateMemberId',(select result->>'id' from m325_results where name='foreign_member_after_primary'),
      'firstName','Nina','lastName','Neu','email',' Nina.Fahrt@Example.INVALID ','busPreference','EGAL',
      'boardingStopId',(select result->>'id' from m325_results where name='trip_a')),
    jsonb_build_object('firstName','Manuel','lastName','Mix','busPreference','PARTY',
      'boardingStopId',(select result->>'id' from m325_results where name='trip_b'),'operationalNote','Normaler Mitfahrer')),
  'privacyConfirmed',true,'termsConfirmed',true,'idempotencyKey','00000000-0000-4325-8300-000000000012')));
select is((select count(*)::integer from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='mixed_booking')),3,'Gemischte Gruppe bucht Primary, Template- und normalen Mitfahrer atomar');
select is((select email from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='mixed_booking') and first_name='Nina'),'nina.fahrt@example.invalid','Konkrete Template-Fahrt-E-Mail wird normalisiert gespeichert');
select is((select companion_list_member_id::text from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='mixed_booking') and first_name='Nina'),(select result->>'id' from m325_results where name='foreign_member_after_primary'),'Template-Mitfahrer behält seine Herkunft');
select is((select companion_list_member_id from app_modules.fanbus_registrations where booking_id=(select (result->>'bookingId')::uuid from m325_results where name='mixed_booking') and first_name='Manuel'),null,'Normaler Mitfahrer erhält keine Template-Herkunft');
select hasnt_column('app_modules','fanbus_companion_list_members','email','Template speichert weiterhin keine E-Mail');

select * from finish();
rollback;
