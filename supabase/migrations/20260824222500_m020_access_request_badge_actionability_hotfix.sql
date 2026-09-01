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
    return exists(
      select 1
      from app_portal.access_requests x
      where x.id = v_id
        and x.status = 'PENDING'
    );
  elsif v_type = 'event' then
    return exists(select 1 from app_modules.events x where x.id = v_id);
  elsif v_type = 'event_import_run' then
    return exists(select 1 from app_modules.event_import_runs x where x.id = v_id);
  end if;

  return true;
end;
$function$;

comment on function app_private.notification_projection_actionable(text, text) is
'Returns whether a projected notification still points to an actionable entity. Access requests count as actionable only while PENDING so resolved requests cannot keep unread app badges alive.';
