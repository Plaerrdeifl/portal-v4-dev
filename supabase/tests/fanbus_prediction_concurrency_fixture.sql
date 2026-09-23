\set ON_ERROR_STOP on

insert into auth.users (id, email)
values ('00000000-0000-4555-9600-000000000001', 'prediction-concurrency@example.invalid');
insert into app_portal.users (id, user_code, email, first_name, last_name, status, role_id)
select '00000000-0000-4555-9600-000000000001', 'U-PRED-CONCURRENCY',
  'prediction-concurrency@example.invalid', 'Tipp', 'Parallel', 'ACTIVE', id
from app_portal.portal_roles where code='ADMIN';
insert into app_modules.events (id,event_type,title,event_date,visibility,created_by,updated_by)
values ('00000000-0000-4555-9610-000000000001','GAME','Concurrency','2035-10-01','PUBLIC','00000000-0000-4555-9600-000000000001','00000000-0000-4555-9600-000000000001');
insert into app_modules.event_games(event_id,home_away,opponent_name)
values ('00000000-0000-4555-9610-000000000001','AWAY','Parallel Gegner');
insert into app_modules.fanbus_trips(id,event_id,status,bus_preference_enabled,created_by,updated_by)
values ('00000000-0000-4555-9620-000000000001','00000000-0000-4555-9610-000000000001','PUBLISHED',true,'00000000-0000-4555-9600-000000000001','00000000-0000-4555-9600-000000000001');
insert into app_modules.fanbus_bookings(id,trip_id,source,created_by,updated_by) values
('00000000-0000-4555-9630-000000000001','00000000-0000-4555-9620-000000000001','MANUAL','00000000-0000-4555-9600-000000000001','00000000-0000-4555-9600-000000000001'),
('00000000-0000-4555-9630-000000000002','00000000-0000-4555-9620-000000000001','MANUAL','00000000-0000-4555-9600-000000000001','00000000-0000-4555-9600-000000000001');
insert into app_modules.fanbus_registrations(
 id,trip_id,first_name,last_name,email,bus_preference,status,privacy_reference,terms_reference,
 privacy_accepted_at,terms_accepted_at,source,booking_id,booking_role,participant_sequence,created_by,updated_by
) values
('00000000-0000-4555-9640-000000000001','00000000-0000-4555-9620-000000000001','Erste','Person','first@example.invalid','EGAL','ACTIVE','test','test',now(),now(),'MANUAL','00000000-0000-4555-9630-000000000001','PRIMARY',1,'00000000-0000-4555-9600-000000000001','00000000-0000-4555-9600-000000000001'),
('00000000-0000-4555-9640-000000000002','00000000-0000-4555-9620-000000000001','Zweite','Person','second@example.invalid','EGAL','ACTIVE','test','test',now(),now(),'MANUAL','00000000-0000-4555-9630-000000000002','PRIMARY',1,'00000000-0000-4555-9600-000000000001','00000000-0000-4555-9600-000000000001');
insert into app_modules.fanbus_prediction_games(id,event_id,trip_id,mode,created_by,updated_by)
values ('00000000-0000-4555-9650-000000000001','00000000-0000-4555-9610-000000000001','00000000-0000-4555-9620-000000000001','TRIP','00000000-0000-4555-9600-000000000001','00000000-0000-4555-9600-000000000001');

begin;
select set_config('request.jwt.claim.sub','00000000-0000-4555-9600-000000000001',true);
select app_private.api_fanbus_prediction_entry_save('{"gameId":"00000000-0000-4555-9650-000000000001","registrationId":"00000000-0000-4555-9640-000000000001","tips":[{"dogsGoals":1,"opponentGoals":0}]}'::jsonb);
commit;
