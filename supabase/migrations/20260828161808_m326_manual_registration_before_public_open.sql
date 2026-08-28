-- Plaerrdeifl Digitalplattform V4
-- DEV overlay: Busorga may create MANUAL registrations before public opening.
-- Public/guest registration windows remain unchanged. CLOSED/CANCELLED stay blocked.
--
-- The current M330 cancellation layer wraps the pre-M330 booking core. Patch only
-- the preserved core so the cancellation wrapper remains authoritative.

do $migration$
declare
  v_definition text;
  v_status_old text := $old$
  elsif v_trip.status <> 'PUBLISHED'
     or v_event_visibility is distinct from 'PUBLIC'
$old$;
  v_status_new text := $new$
  elsif (v_source = 'MANUAL' and v_trip.status not in ('DRAFT', 'PUBLISHED'))
     or (v_source <> 'MANUAL' and v_trip.status <> 'PUBLISHED')
     or v_event_visibility is distinct from 'PUBLIC'
$new$;
  v_open_old text := $old$
  elsif v_now < v_trip.registration_opens_at then
    v_outcome := 'NOT_STARTED';
$old$;
  v_open_new text := $new$
  elsif v_source <> 'MANUAL' and v_now < v_trip.registration_opens_at then
    v_outcome := 'NOT_STARTED';
$new$;
begin
  select pg_catalog.pg_get_functiondef(
    'app_private.fanbus_submit_booking_core_before_m330_r1(uuid,text,uuid,jsonb,jsonb,boolean,boolean,uuid,text)'::regprocedure
  )
  into v_definition;

  if pg_catalog.strpos(v_definition, v_status_old) = 0 then
    raise exception 'M326_MANUAL_PREOPEN_STATUS_PATCH_TARGET_MISSING';
  end if;
  if pg_catalog.strpos(v_definition, v_open_old) = 0 then
    raise exception 'M326_MANUAL_PREOPEN_WINDOW_PATCH_TARGET_MISSING';
  end if;

  v_definition := pg_catalog.replace(v_definition, v_status_old, v_status_new);
  v_definition := pg_catalog.replace(v_definition, v_open_old, v_open_new);
  execute v_definition;
end;
$migration$;

revoke all on function app_private.fanbus_submit_booking_core_before_m330_r1(
  uuid, text, uuid, jsonb, jsonb, boolean, boolean, uuid, text
) from public, anon, authenticated, service_role;
