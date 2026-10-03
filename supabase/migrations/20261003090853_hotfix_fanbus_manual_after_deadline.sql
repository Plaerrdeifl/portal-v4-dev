-- Urgent Fanbus operations hotfix:
-- Keep the public/self-service registration deadline intact while allowing
-- capability-gated MANUAL registrations from Bus-Orga after that deadline.
--
-- The MANUAL path is already restricted by fanbus.registrations.manage.
-- CLOSED/CANCELLED trip protections and all other availability checks stay intact.

do $migration$
declare
  v_signature regprocedure :=
    'app_private.fanbus_submit_booking_core_before_m330_r1(uuid,text,uuid,jsonb,jsonb,boolean,boolean,uuid,text)'::regprocedure;
  v_definition text;
  v_old text := '  elsif v_now >= v_trip.registration_closes_at then';
  v_new text := '  elsif v_source <> ''MANUAL'' and v_now >= v_trip.registration_closes_at then';
begin
  select pg_get_functiondef(v_signature)
  into v_definition;

  if strpos(v_definition, v_new) > 0 then
    return;
  end if;

  if strpos(v_definition, v_old) = 0 then
    raise exception
      'Unexpected fanbus_submit_booking_core_before_m330_r1 definition; hotfix not applied';
  end if;

  if length(v_definition) - length(replace(v_definition, v_old, '')) <> length(v_old) then
    raise exception
      'Expected exactly one fanbus registration deadline guard; hotfix not applied';
  end if;

  execute replace(v_definition, v_old, v_new);
end
$migration$;
