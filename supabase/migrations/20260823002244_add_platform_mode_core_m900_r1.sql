begin;

insert into app_portal.settings (key, value, description)
values (
  'platform.mode',
  jsonb_build_object('mode', 'NORMAL'),
  'M900-R1 Release-/Operations-Konfiguration fuer den zentralen Plattformmodus.'
)
on conflict (key) do nothing;

create function app_private.platform_runtime_state()
returns table (
  mode text,
  message text,
  expected_end timestamptz,
  revision integer,
  is_valid boolean,
  error_code text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_value jsonb;
  v_revision integer;
  v_mode text;
  v_message text;
  v_expected_end timestamptz;
  v_expected_end_text text;
begin
  select setting.value, setting.revision
  into v_value, v_revision
  from app_portal.settings as setting
  where setting.key = 'platform.mode';

  if not found
     or v_revision < 1
     or jsonb_typeof(v_value) <> 'object'
     or jsonb_typeof(v_value -> 'mode') <> 'string' then
    return query select
      'MAINTENANCE'::text,
      null::text,
      null::timestamptz,
      v_revision,
      false,
      'PLATFORM_WRITE_UNAVAILABLE'::text;
    return;
  end if;

  v_mode := v_value ->> 'mode';
  if v_mode not in ('NORMAL', 'READ_ONLY', 'MAINTENANCE') then
    return query select
      'MAINTENANCE'::text,
      null::text,
      null::timestamptz,
      v_revision,
      false,
      'PLATFORM_WRITE_UNAVAILABLE'::text;
    return;
  end if;

  if v_value ? 'message' then
    if v_value -> 'message' = 'null'::jsonb then
      v_message := null;
    elsif jsonb_typeof(v_value -> 'message') = 'string' then
      v_message := nullif(btrim(v_value ->> 'message'), '');
    else
      return query select
        'MAINTENANCE'::text,
        null::text,
        null::timestamptz,
        v_revision,
        false,
        'PLATFORM_WRITE_UNAVAILABLE'::text;
      return;
    end if;
  end if;

  if v_value ? 'expectedEnd' then
    if v_value -> 'expectedEnd' = 'null'::jsonb then
      v_expected_end := null;
    elsif jsonb_typeof(v_value -> 'expectedEnd') <> 'string' then
      return query select
        'MAINTENANCE'::text,
        null::text,
        null::timestamptz,
        v_revision,
        false,
        'PLATFORM_WRITE_UNAVAILABLE'::text;
      return;
    else
      v_expected_end_text := btrim(v_value ->> 'expectedEnd');
      if v_expected_end_text !~
         '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
        return query select
          'MAINTENANCE'::text,
          null::text,
          null::timestamptz,
          v_revision,
          false,
          'PLATFORM_WRITE_UNAVAILABLE'::text;
        return;
      end if;
      begin
        v_expected_end := v_expected_end_text::timestamptz;
      exception when others then
        return query select
          'MAINTENANCE'::text,
          null::text,
          null::timestamptz,
          v_revision,
          false,
          'PLATFORM_WRITE_UNAVAILABLE'::text;
        return;
      end;
    end if;
  end if;

  return query select
    v_mode,
    v_message,
    v_expected_end,
    v_revision,
    true,
    null::text;
end;
$function$;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when lower(btrim(coalesce(p_action, ''))) = any (array[
      'admin_snapshot',
      'bootstrap',
      'dashboard',
      'events_list',
      'fanbus_available_events',
      'fanbus_boarding_stops_list',
      'fanbus_bus_boarding_stops_list',
      'fanbus_buses_list',
      'fanbus_companion_duplicate_preview',
      'fanbus_companion_lists_list',
      'fanbus_companion_person_search',
      'fanbus_operations_snapshot',
      'fanbus_registration_identity_search',
      'fanbus_registration_identity_suggestion',
      'fanbus_registration_operational_detail',
      'fanbus_registration_people_list',
      'fanbus_registrations_list',
      'fanbus_trip_boarding_stops_list',
      'fanbus_trip_boarding_stops_public',
      'fanbus_trips_list',
      'fanbus_user_preference_get',
      'fanclub_snapshot',
      'member_detail',
      'member_match',
      'membership_application_detail',
      'membership_applications_list',
      'push_snapshot',
      'tasks_snapshot',
      'teams_snapshot'
    ]::text[])
      then 'READ'::text
    else 'USER_MUTATION'::text
  end;
$function$;

create function app_private.require_platform_user_write_allowed()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_state record;
begin
  select runtime.*
  into v_state
  from app_private.platform_runtime_state() as runtime;

  if v_state.is_valid is distinct from true then
    raise exception 'PLATFORM_WRITE_UNAVAILABLE' using errcode = 'P0901';
  end if;

  case v_state.mode
    when 'NORMAL' then
      return;
    when 'READ_ONLY' then
      raise exception 'PLATFORM_READ_ONLY' using errcode = 'P0902';
    when 'MAINTENANCE' then
      raise exception 'PLATFORM_MAINTENANCE' using errcode = 'P0903';
    else
      raise exception 'PLATFORM_WRITE_UNAVAILABLE' using errcode = 'P0901';
  end case;
end;
$function$;

create function public.pd_public_platform_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'mode', runtime.mode,
    'message', runtime.message,
    'expectedEnd', runtime.expected_end,
    'revision', runtime.revision
  )
  from app_private.platform_runtime_state() as runtime;
$function$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_platform_mode_m900_r1;

create function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_error_code text;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.' using errcode = '42501';
  end if;

  if app_private.platform_action_classification(v_action) = 'USER_MUTATION' then
    perform app_private.require_platform_user_write_allowed();
  end if;

  return public.pd_api_before_platform_mode_m900_r1(p_action, p_payload);
exception when others then
  v_error_code := case sqlstate
    when 'P0901' then 'PLATFORM_WRITE_UNAVAILABLE'
    when 'P0902' then 'PLATFORM_READ_ONLY'
    when 'P0903' then 'PLATFORM_MAINTENANCE'
    else sqlstate
  end;
  return jsonb_build_object(
    'ok', false,
    'error', jsonb_build_object('code', v_error_code, 'message', sqlerrm)
  );
end;
$function$;

revoke all on function
  app_private.platform_runtime_state(),
  app_private.platform_action_classification(text),
  app_private.require_platform_user_write_allowed(),
  public.pd_api_before_platform_mode_m900_r1(text, jsonb),
  public.pd_public_platform_status(),
  public.pd_api(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.platform_runtime_state(),
  app_private.platform_action_classification(text),
  app_private.require_platform_user_write_allowed(),
  public.pd_api_before_platform_mode_m900_r1(text, jsonb)
to postgres;

grant execute on function public.pd_public_platform_status()
to anon, authenticated;

grant execute on function public.pd_api(text, jsonb)
to authenticated;

comment on function app_private.platform_runtime_state() is
  'M900-R1 fail-closed Resolver fuer platform.mode mit stabilem internem Vertrag.';
comment on function app_private.platform_action_classification(text) is
  'M900-R1 zentrale pd_api-Klassifikation: explizite READ-Allowlist, sonst USER_MUTATION.';
comment on function app_private.require_platform_user_write_allowed() is
  'M900-R1 zentraler Guard fuer User-Mutationen; bestehende Fachberechtigungen bleiben nachgelagert.';
comment on function public.pd_public_platform_status() is
  'M900-R1 minimaler oeffentlicher Plattformstatus ohne interne Metadaten.';
comment on function public.pd_api(text, jsonb) is
  'M900-R1 authenticated API boundary mit zentralem Platform-Mode-Guard vor der bestehenden Router-Kette.';

commit;
