create function app_private.api_fanbus_trip_reopen(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_capability('fanbus.manage');
  v_id uuid;
  v_expected_revision integer;
  v_existing app_modules.fanbus_trips%rowtype;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Die Wiederöffnungsdaten sind ungültig.'
      using errcode = '22023';
  end if;

  if not (p_payload ?& array['id', 'expectedRevision'])
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as payload_key(key)
       where payload_key.key <> all(array['id', 'expectedRevision'])
     ) then
    raise exception 'Für das Wiederöffnen sind ausschließlich id und expectedRevision zulässig.'
      using errcode = '22023';
  end if;

  begin
    v_id := nullif(btrim(coalesce(p_payload ->> 'id', '')), '')::uuid;
    v_expected_revision :=
      nullif(btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  exception
    when others then
      raise exception 'Die Wiederöffnungsdaten haben ein ungültiges Format.'
        using errcode = '22023';
  end;

  if v_id is null or v_expected_revision is null then
    raise exception 'Fanbusfahrt-ID und erwartete Revision sind erforderlich.'
      using errcode = '22023';
  end if;

  select *
  into v_existing
  from app_modules.fanbus_trips
  where id = v_id
  for update;

  if not found then
    raise exception 'Die Fanbusfahrt wurde nicht gefunden.'
      using errcode = 'P0002';
  end if;

  if v_expected_revision <> v_existing.revision then
    raise exception
      'Die Fanbusfahrt wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.'
      using errcode = '40001';
  end if;

  if v_existing.status <> 'CLOSED' then
    raise exception 'Nur eine geschlossene Fanbusfahrt kann wieder als Entwurf geöffnet werden.'
      using errcode = '22023';
  end if;

  update app_modules.fanbus_trips
  set status = 'DRAFT',
      revision = revision + 1,
      updated_by = v_actor
  where id = v_id;

  perform app_private.log_audit(
    v_actor,
    'FANBUS_TRIP_REOPENED',
    'fanbus_trip',
    v_id::text,
    jsonb_build_object(
      'eventId', v_existing.event_id,
      'status', 'CLOSED',
      'revision', v_existing.revision
    ),
    jsonb_build_object(
      'eventId', v_existing.event_id,
      'status', 'DRAFT',
      'revision', v_existing.revision + 1
    )
  );

  return app_private.api_fanbus_trips_list();
end;
$$;

alter function public.pd_api(text, jsonb)
  rename to pd_api_before_fanbus_reopen_m310_r1;

create or replace function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_data jsonb;
begin
  if auth.uid() is null then
    raise exception 'Anmeldung erforderlich.'
      using errcode = '42501';
  end if;

  case v_action
    when 'fanbus_trip_reopen' then
      v_data := app_private.api_fanbus_trip_reopen(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return public.pd_api_before_fanbus_reopen_m310_r1(
        p_action,
        p_payload
      );
  end case;

  return jsonb_build_object(
    'ok', true,
    'data', v_data
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', sqlstate,
        'message', sqlerrm
      )
    );
end;
$$;

revoke all on function app_private.api_fanbus_trip_reopen(jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.pd_api_before_fanbus_reopen_m310_r1(text, jsonb)
from public, anon, authenticated;

revoke all on function public.pd_api(text, jsonb)
from public, anon, authenticated;

grant execute on function public.pd_api(text, jsonb)
to authenticated;
