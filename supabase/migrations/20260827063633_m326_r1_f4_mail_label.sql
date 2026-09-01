-- Plaerrdeifl Digitalplattform V4
-- P300 / M326-R1 F4: zentrale Fahrtbezeichnung fuer alle Fanbus-Mails

begin;

create function app_private.fanbus_trip_mail_label(p_trip_id uuid)
returns text
language plpgsql stable security definer set search_path=''
as $function$
declare
  v_type text;
  v_title text;
  v_opponent text;
  v_label text;
begin
  select event.event_type,event.title,game.opponent_name
  into v_type,v_title,v_opponent
  from app_modules.fanbus_trips trip
  join app_modules.events event on event.id=trip.event_id
  left join app_modules.event_games game on game.event_id=event.id
  where trip.id=p_trip_id;
  if not found then
    raise exception 'FANBUS_MAIL_TRIP_NOT_FOUND' using errcode='P0002';
  end if;
  v_label:=case when v_type='GAME' then nullif(btrim(v_opponent),'')
    when v_type in('FANCLUB','OTHER') then nullif(btrim(v_title),'') end;
  if v_label is null or lower(v_label) in(
    'fanbusfahrt','die fanbusfahrt','der fanbusfahrt','eine fanbusfahrt'
  ) then
    raise exception 'FANBUS_MAIL_LABEL_MISSING' using errcode='22023';
  end if;
  return v_label;
end;
$function$;

create function app_private.m326_fanbus_mail_projection_guard()
returns trigger
language plpgsql security definer set search_path=''
as $function$
declare
  v_template text:=lower(btrim(coalesce(new.payload->>'templateKey','')));
  v_trip uuid;
  v_label text;
begin
  if new.channel<>'EMAIL' or v_template not like 'fanbus.%' then
    return new;
  end if;
  begin
    v_trip:=nullif(new.payload#>>'{data,tripId}','')::uuid;
  exception when others then
    raise exception 'FANBUS_MAIL_TRIP_ID_INVALID' using errcode='22023';
  end;
  if v_trip is null then
    raise exception 'FANBUS_MAIL_TRIP_ID_REQUIRED' using errcode='22023';
  end if;
  v_label:=app_private.fanbus_trip_mail_label(v_trip);
  new.payload:=jsonb_set(new.payload,'{data,tripTitle}',to_jsonb(v_label),true);
  return new;
end;
$function$;

create trigger notification_outbox_m326_fanbus_mail_label
before insert or update of payload on app_private.notification_outbox
for each row execute function app_private.m326_fanbus_mail_projection_guard();

revoke all on function
  app_private.fanbus_trip_mail_label(uuid),
  app_private.m326_fanbus_mail_projection_guard()
from public,anon,authenticated,service_role;
grant execute on function app_private.fanbus_trip_mail_label(uuid) to postgres;

comment on function app_private.fanbus_trip_mail_label(uuid) is
  'M326-R1 zentrale Fanbus-Mailbezeichnung: GAME=event_games.opponent_name, FANCLUB/OTHER=events.title; fail-closed ohne generischen Fallback.';

commit;
