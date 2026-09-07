alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_liveticker_graphics_prod_r1;

create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_action text:=lower(btrim(coalesce(p_action,'')));
  v_event uuid;
  v_kind text;
begin
  case v_action
    when 'liveticker_graphics_games' then
      return public.pd_public_liveticker_games();
    when 'liveticker_graphics_status' then
      v_event:=nullif(btrim(coalesce(p_payload->>'eventId','')),'')::uuid;
      return jsonb_build_object(
        'state',public.pd_public_liveticker_state(v_event),
        'jobs',coalesce(public.pd_public_liveticker_graphic_jobs(v_event)->'jobs','[]'::jsonb)
      );
    when 'liveticker_graphics_enqueue' then
      v_event:=nullif(btrim(coalesce(p_payload->>'eventId','')),'')::uuid;
      v_kind:=upper(btrim(coalesce(p_payload->>'kind','')));
      return public.pd_public_liveticker_graphic_enqueue(v_event,v_kind);
    else
      return app_private.pd_api_dispatch_current_before_liveticker_graphics_prod_r1(p_action,p_payload);
  end case;
exception
  when invalid_text_representation then
    raise exception 'Ungültige Liveticker-Grafik-Anfrage.' using errcode='22023';
end;
$$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_liveticker_graphics_prod_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path=''
as $$
  select case lower(btrim(coalesce(p_action,'')))
    when 'liveticker_graphics_games' then 'READ'
    when 'liveticker_graphics_status' then 'READ'
    when 'liveticker_graphics_enqueue' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_liveticker_graphics_prod_r1(p_action)
  end
$$;

revoke all on function app_private.pd_api_dispatch_current_before_liveticker_graphics_prod_r1(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.pd_api_dispatch_current(text,jsonb) from public,anon,authenticated;
revoke all on function app_private.platform_action_classification_before_liveticker_graphics_prod_r1(text) from public,anon,authenticated;
revoke all on function app_private.platform_action_classification(text) from public,anon,authenticated;
