-- Plaerrdeifl Digitalplattform V4
-- P300 / M328-R1 – Stammfahrer reaktivieren
-- Additiver DEV-Vertrag. PROD wird durch diesen Auftrag nicht beruehrt.

begin;

create function app_private.api_fanbus_regular_rider_activate(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.registrations.manage');
  v_id uuid := app_private.m326_uuid(
    p_payload ->> 'id',
    'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD'
  );
  v_expected integer;
  v_old app_modules.fanbus_regular_riders%rowtype;
begin
  begin
    v_expected := (p_payload ->> 'expectedRevision')::integer;
  exception when others then
    raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode = '22023';
  end;

  if jsonb_typeof(p_payload) <> 'object'
     or v_id is null
     or v_expected is null
     or not p_payload ?& array['id','expectedRevision']
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as key(name)
       where key.name <> all(array['id','expectedRevision'])
     ) then
    raise exception 'FANBUS_REGULAR_RIDER_INVALID_PAYLOAD' using errcode = '22023';
  end if;

  select * into v_old
  from app_modules.fanbus_regular_riders
  where id = v_id
  for update;

  if not found then
    raise exception 'FANBUS_REGULAR_RIDER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_old.revision <> v_expected then
    raise exception 'STALE_REVISION' using errcode = '40001';
  end if;
  if v_old.is_active then
    return app_private.api_fanbus_regular_rider_detail(jsonb_build_object('id', v_id));
  end if;

  update app_modules.fanbus_regular_riders
  set
    is_active = true,
    revision = revision + 1,
    updated_by = v_actor
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_REGULAR_RIDER_ACTIVATED',
    'fanbus_regular_rider',
    v_id::text,
    jsonb_build_object('revision', v_old.revision, 'isActive', false),
    jsonb_build_object('revision', v_old.revision + 1, 'isActive', true),
    jsonb_build_object('regularRiderId', v_id)
  );

  return app_private.api_fanbus_regular_rider_detail(jsonb_build_object('id', v_id));
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_m328_r1_rider_reactivate;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_m328_r1_rider_reactivate()
    || array['fanbus_regular_rider_activate']::text[];
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_m328_r1_rider_reactivate;

create function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if lower(btrim(coalesce(p_action, ''))) = 'fanbus_regular_rider_activate' then
    return app_private.api_fanbus_regular_rider_activate(coalesce(p_payload, '{}'::jsonb));
  end if;

  return app_private.pd_api_dispatch_current_before_m328_r1_rider_reactivate(
    p_action,
    p_payload
  );
end;
$function$;

revoke all on function
  app_private.api_fanbus_regular_rider_activate(jsonb),
  app_private.pd_api_current_actions_before_m328_r1_rider_reactivate(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m328_r1_rider_reactivate(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.pd_api_current_actions_before_m328_r1_rider_reactivate(),
  app_private.pd_api_current_actions(),
  app_private.pd_api_dispatch_current_before_m328_r1_rider_reactivate(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
