-- Plärrdeifl Portal V4
-- Dashboard Small Widgets R1
-- Ausschließlich für Supabase DEV vorgesehen.

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

    if v_size not in ('small', 'compact', 'standard', 'wide') then
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

revoke all on function
  app_private.normalize_dashboard_layout(jsonb)
from public, anon, authenticated;

comment on function
  app_private.normalize_dashboard_layout(jsonb)
is
  'Validiert Dashboard-Layouts inklusive der sehr kompakten Größe small.';
