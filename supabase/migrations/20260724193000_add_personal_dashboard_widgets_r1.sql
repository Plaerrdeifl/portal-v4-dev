-- Plärrdeifl Portal V4
-- Persönliches Widget-Dashboard R1
-- Ausschließlich für Supabase DEV vorgesehen.

create table app_portal.user_dashboard_preferences (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,
  layout jsonb not null
    default '{"version":1,"widgets":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_dashboard_preferences_layout_object_check
    check (jsonb_typeof(layout) = 'object')
);

alter table app_portal.user_dashboard_preferences
  enable row level security;

revoke all on table app_portal.user_dashboard_preferences
from public, anon, authenticated;

comment on table app_portal.user_dashboard_preferences is
  'Persönliche, serverseitig validierte Dashboard-Anordnung je Portalnutzer.';

create or replace function app_private.normalize_dashboard_layout(
  p_layout jsonb
)
returns jsonb
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_key text;
  v_size text;
  v_visible_text text;
  v_visible boolean;
  v_seen text[] := array[]::text[];
  v_widgets jsonb := '[]'::jsonb;
  v_allowed_keys constant text[] := array[
    'member_count',
    'contribution',
    'open_contributions',
    'birthdays',
    'own_tasks',
    'team_tasks',
    'finance',
    'board_tasks'
  ];
begin
  if p_layout is null
     or jsonb_typeof(p_layout) <> 'object' then
    raise exception 'Das Dashboard-Layout muss ein Objekt sein.'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_layout -> 'widgets') <> 'array' then
    raise exception 'Die Widget-Liste muss ein Array sein.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_layout -> 'widgets') >
     array_length(v_allowed_keys, 1) then
    raise exception 'Das Dashboard enthält zu viele Widgets.'
      using errcode = '22023';
  end if;

  for v_item in
    select item.value
    from jsonb_array_elements(p_layout -> 'widgets') as item(value)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Jeder Widget-Eintrag muss ein Objekt sein.'
        using errcode = '22023';
    end if;

    v_key := btrim(coalesce(v_item ->> 'key', ''));
    v_size := lower(btrim(coalesce(v_item ->> 'size', '')));
    v_visible_text := lower(
      btrim(coalesce(v_item ->> 'visible', 'true'))
    );

    if not (v_key = any(v_allowed_keys)) then
      raise exception 'Unbekanntes Dashboard-Widget: %', v_key
        using errcode = '22023';
    end if;

    if v_key = any(v_seen) then
      raise exception 'Dashboard-Widget ist doppelt vorhanden: %', v_key
        using errcode = '22023';
    end if;

    if v_size not in ('compact', 'standard', 'wide') then
      raise exception 'Ungültige Widget-Größe für %.', v_key
        using errcode = '22023';
    end if;

    if v_visible_text = 'true' then
      v_visible := true;
    elsif v_visible_text = 'false' then
      v_visible := false;
    else
      raise exception 'Ungültige Sichtbarkeit für %.', v_key
        using errcode = '22023';
    end if;

    v_seen := array_append(v_seen, v_key);
    v_widgets := v_widgets || jsonb_build_array(
      jsonb_build_object(
        'key', v_key,
        'size', v_size,
        'visible', v_visible
      )
    );
  end loop;

  return jsonb_build_object(
    'version', 1,
    'widgets', v_widgets
  );
end;
$$;

create or replace function app_private.api_dashboard_preferences()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_layout jsonb;
  v_updated_at timestamptz;
begin
  select
    preference.layout,
    preference.updated_at
  into
    v_layout,
    v_updated_at
  from app_portal.user_dashboard_preferences as preference
  where preference.user_id = v_actor;

  return jsonb_build_object(
    'saved', v_layout is not null,
    'layout', v_layout,
    'updatedAt', v_updated_at
  );
end;
$$;

create or replace function app_private.api_save_dashboard_preferences(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := app_private.require_active_user();
  v_layout jsonb;
begin
  v_layout := app_private.normalize_dashboard_layout(
    p_payload -> 'layout'
  );

  insert into app_portal.user_dashboard_preferences (
    user_id,
    layout,
    updated_at
  )
  values (
    v_actor,
    v_layout,
    now()
  )
  on conflict (user_id)
  do update
  set layout = excluded.layout,
      updated_at = excluded.updated_at;

  return app_private.api_dashboard_preferences();
end;
$$;

revoke all on function
  app_private.normalize_dashboard_layout(jsonb)
from public, anon, authenticated;

revoke all on function
  app_private.api_dashboard_preferences()
from public, anon, authenticated;

revoke all on function
  app_private.api_save_dashboard_preferences(jsonb)
from public, anon, authenticated;

alter function public.pd_api(text, jsonb)
  rename to pd_api_core_before_dashboard_widgets_r1;

revoke all on function
  public.pd_api_core_before_dashboard_widgets_r1(text, jsonb)
from public, anon, authenticated;

create function public.pd_api(
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_response jsonb;
begin
  if p_action = 'saveDashboardPreferences' then
    return jsonb_build_object(
      'ok', true,
      'data',
        app_private.api_save_dashboard_preferences(
          coalesce(p_payload, '{}'::jsonb)
        )
    );
  end if;

  v_response :=
    public.pd_api_core_before_dashboard_widgets_r1(
      p_action,
      coalesce(p_payload, '{}'::jsonb)
    );

  if p_action = 'dashboard'
     and coalesce((v_response ->> 'ok')::boolean, false) then
    v_response := jsonb_set(
      v_response,
      '{data,preferences}',
      app_private.api_dashboard_preferences(),
      true
    );
  end if;

  return v_response;
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error',
        jsonb_build_object(
          'code', sqlstate,
          'message', sqlerrm
        )
    );
end;
$$;

revoke all on function
  public.pd_api(text, jsonb)
from public;

grant execute on function
  public.pd_api(text, jsonb)
to anon, authenticated;

comment on function public.pd_api(text, jsonb) is
  'Portal-RPC mit persönlicher Dashboard-Widget-Konfiguration R1.';
