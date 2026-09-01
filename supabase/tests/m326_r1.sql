begin;

set local role postgres;
create extension if not exists pgtap with schema extensions;

set local search_path = extensions, public, pg_catalog;

select plan(29);

select has_table('app_modules','fanbus_regular_riders','Stammfahrer table exists');
select has_table('app_modules','fanbus_person_groups','person groups table exists');
select has_table('app_modules','fanbus_person_group_members','group members table exists');
select has_column('app_modules','fanbus_registrations','regular_rider_id','registration provenance exists');
select col_is_null('app_modules','fanbus_registrations','regular_rider_id','provenance stays optional');
select col_default_is('app_modules','fanbus_regular_riders','default_bus_preference','EGAL','regular rider defaults to EGAL');
select col_default_is('app_modules','fanbus_regular_riders','revision','1','regular rider revision starts at one');
select col_default_is('app_modules','fanbus_person_groups','revision','1','group revision starts at one');
select has_index('app_modules','fanbus_regular_riders','fanbus_regular_riders_linked_portal_user_uidx','portal link is DB-unique');
select has_index('app_modules','fanbus_registrations','fanbus_registrations_live_regular_rider_uidx','live regular rider duplicate guard exists');
select ok(
  exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'app_modules'
      and t.relname = 'fanbus_person_group_members'
      and c.conname = 'fanbus_person_group_members_one_anchor_check'
      and c.contype = 'c'
  ),
  'exactly one group anchor is enforced'
);
select table_privs_are('app_modules','fanbus_regular_riders','anon',array[]::text[],'anon has no rider rights');
select table_privs_are('app_modules','fanbus_regular_riders','authenticated',array[]::text[],'browser has no rider rights');
select table_privs_are('app_modules','fanbus_person_groups','authenticated',array[]::text[],'browser has no group rights');
select table_privs_are('app_modules','fanbus_person_group_members','authenticated',array[]::text[],'browser has no membership rights');
select is((select relrowsecurity from pg_class where oid='app_modules.fanbus_regular_riders'::regclass),true,'rider RLS enabled');
select is((select relrowsecurity from pg_class where oid='app_modules.fanbus_person_groups'::regclass),true,'group RLS enabled');
select is((select relrowsecurity from pg_class where oid='app_modules.fanbus_person_group_members'::regclass),true,'group member RLS enabled');
select has_function('app_private','fanbus_effective_person',array['uuid','uuid','uuid'],'identity resolver exists');
select has_function('app_private','api_fanbus_registration_create_manual_bulk',array['jsonb'],'bulk API exists');
select has_function('app_private','fanbus_trip_mail_label',array['uuid'],'mail label resolver exists');
select function_privs_are('app_private','api_fanbus_registration_create_manual_bulk',array['jsonb'],'authenticated',array[]::text[],'bulk helper is not browser callable');
select is(app_private.platform_action_classification('fanbus_regular_riders_list'),'READ','rider list remains available in read-only mode');
select is(app_private.platform_action_classification('fanbus_registration_create_manual_bulk'),'USER_MUTATION','bulk is guarded as user mutation');

insert into app_modules.events(id,event_type,title,event_date,event_time,visibility) values
  ('00000000-0000-4326-8100-000000000001','GAME','Nicht als Mailbezeichnung verwenden',current_date+30,time '18:00','PUBLIC'),
  ('00000000-0000-4326-8100-000000000002','GAME','Auch nicht als Mailbezeichnung verwenden',current_date+31,time '18:00','PUBLIC'),
  ('00000000-0000-4326-8100-000000000003','FANCLUB','Sommerfest 2026',current_date+32,time '18:00','PUBLIC'),
  ('00000000-0000-4326-8100-000000000004','OTHER','Sonderfahrt Regensburg',current_date+33,time '18:00','PUBLIC'),
  ('00000000-0000-4326-8100-000000000005','OTHER','Fanbusfahrt',current_date+34,time '18:00','PUBLIC');
insert into app_modules.event_games(event_id,home_away,opponent_name) values
  ('00000000-0000-4326-8100-000000000001','AWAY','Landsberg'),
  ('00000000-0000-4326-8100-000000000002','AWAY','Peiting');
insert into app_modules.fanbus_trips(id,event_id,status) values
  ('00000000-0000-4326-8200-000000000001','00000000-0000-4326-8100-000000000001','DRAFT'),
  ('00000000-0000-4326-8200-000000000002','00000000-0000-4326-8100-000000000002','DRAFT'),
  ('00000000-0000-4326-8200-000000000003','00000000-0000-4326-8100-000000000003','DRAFT'),
  ('00000000-0000-4326-8200-000000000004','00000000-0000-4326-8100-000000000004','DRAFT'),
  ('00000000-0000-4326-8200-000000000005','00000000-0000-4326-8100-000000000005','DRAFT');

select is(app_private.fanbus_trip_mail_label('00000000-0000-4326-8200-000000000001'),'Landsberg','GAME mail label is the first concrete opponent');
select is(app_private.fanbus_trip_mail_label('00000000-0000-4326-8200-000000000002'),'Peiting','GAME mail label varies with the concrete opponent');
select is(app_private.fanbus_trip_mail_label('00000000-0000-4326-8200-000000000003'),'Sommerfest 2026','FANCLUB mail label is the event title');
select is(app_private.fanbus_trip_mail_label('00000000-0000-4326-8200-000000000004'),'Sonderfahrt Regensburg','OTHER mail label is the event title');
select throws_ok(
  $$select app_private.fanbus_trip_mail_label('00000000-0000-4326-8200-000000000005')$$,
  '22023','FANBUS_MAIL_LABEL_MISSING','generic Fanbusfahrt fails closed'
);

select * from finish();
rollback;
