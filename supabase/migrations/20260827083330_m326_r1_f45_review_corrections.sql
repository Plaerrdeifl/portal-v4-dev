-- Plaerrdeifl Digitalplattform V4
-- P300 / M326-R1 F4.5: Korrekturen aus unabhaengigem Diff-Review

begin;

-- Nur freie manuelle Identitaeten duerfen auf den Namensfallback fallen.
drop index app_modules.fanbus_registrations_live_manual_name_uidx;
create unique index fanbus_registrations_live_manual_name_uidx
  on app_modules.fanbus_registrations(
    trip_id, lower(btrim(first_name)), lower(btrim(last_name))
  )
  where status in ('ACTIVE', 'WAITLISTED')
    and source = 'MANUAL'
    and member_id is null
    and portal_user_id is null
    and regular_rider_id is null
    and email is null;

-- M330 umschliesst den zuletzt freigegebenen M320-Core. Dessen einzige
-- namensbasierte Bestandsabfrage wird auf dem exakt erwarteten Baseline-Text
-- fail-closed um dieselbe Provenienzbedingung erweitert. Alle anderen Teile
-- des Core-Vertrags bleiben bytegleich erhalten.
do $migration$
declare
  v_function regprocedure :=
    'app_private.fanbus_submit_booking_core_before_m330_r1(uuid,text,uuid,jsonb,jsonb,boolean,boolean,uuid,text)'::regprocedure;
  v_definition text;
  v_needle text := E'          and registration.email is null\n          and lower(btrim(registration.first_name)) =';
  v_replacement text := E'          and registration.email is null\n          and registration.regular_rider_id is null\n          and lower(btrim(registration.first_name)) =';
begin
  select pg_catalog.pg_get_functiondef(v_function) into v_definition;
  if v_definition is null
     or pg_catalog.strpos(v_definition, v_needle) = 0
     or pg_catalog.strpos(v_definition, v_replacement) > 0 then
    raise exception 'M326_F45_M320_MANUAL_NAME_BASELINE_MISMATCH'
      using errcode = '55000';
  end if;
  execute pg_catalog.replace(v_definition, v_needle, v_replacement);
end;
$migration$;

-- Derselbe Provenienzschutz gilt fuer den bestehenden M325-Namensfallback
-- fuer eingehende Companion-Gaeste. Stable Member-/Portal-/Template-Pruefungen
-- sowie der freie Gast-Namensvergleich bleiben ansonsten unveraendert.
do $migration$
declare
  v_function regprocedure :=
    'app_private.m325_companion_conflict_status(uuid,uuid,uuid,uuid,text,text,uuid)'::regprocedure;
  v_definition text;
  v_needle text := E'          and registration.status in (''ACTIVE'', ''WAITLISTED'')\n          and lower(btrim(registration.first_name)) =';
  v_replacement text := E'          and registration.status in (''ACTIVE'', ''WAITLISTED'')\n          and registration.regular_rider_id is null\n          and lower(btrim(registration.first_name)) =';
begin
  select pg_catalog.pg_get_functiondef(v_function) into v_definition;
  if v_definition is null
     or pg_catalog.strpos(v_definition, v_needle) = 0
     or pg_catalog.strpos(v_definition, v_replacement) > 0 then
    raise exception 'M326_F45_M325_MANUAL_NAME_BASELINE_MISMATCH'
      using errcode = '55000';
  end if;
  execute pg_catalog.replace(v_definition, v_needle, v_replacement);
end;
$migration$;

revoke all on table
  app_modules.fanbus_regular_riders,
  app_modules.fanbus_person_groups,
  app_modules.fanbus_person_group_members
from public, anon, authenticated, service_role;

commit;
