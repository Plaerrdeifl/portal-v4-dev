-- D-056 / 2026-10-29: keep the legacy DEV Portal READ_ONLY barrier, while
-- permitting the new, server-authorized Cockpit Liveticker to operate.
-- This is deliberately a narrow action allowlist, NOT a blanket M900 bypass.
-- In PROD or MAINTENANCE the previous platform policy remains unchanged.
create or replace function app_private.require_platform_user_write_allowed(
  p_action text,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_state record;
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_cockpit jsonb;
  v_role text;
begin
  select runtime.* into v_state
  from app_private.platform_runtime_state() as runtime;

  if v_state.is_valid is distinct from true then
    raise exception 'PLATFORM_WRITE_UNAVAILABLE' using errcode = 'P0901';
  end if;

  if v_state.mode = 'NORMAL' then
    return;
  end if;

  -- DEV only. An authenticated actor must have an independently assigned,
  -- active Cockpit account. No portal.admin/team wildcard grants admission.
  if v_state.mode = 'READ_ONLY'
     and app_private.platform_release_environment() = 'DEV'
     and p_actor is not null
     and p_actor = auth.uid()
     and app_private.cockpit_user_has_access(p_actor) then

    -- Cockpit administration: authorization, target-user checks, revision,
    -- audit and last-SYSTEM_ADMIN protection remain inside the action.
    if v_action in (
      'cockpit_admin_access_set',
      'cockpit_admin_personal_capabilities_set'
    ) then
      select access.role into v_role
      from app_portal.cockpit_access as access
      where access.user_id = p_actor
        and access.is_enabled;
      if v_role in ('ADMIN', 'SYSTEM_ADMIN') then
        return;
      end if;
    end if;

    -- Only the leading Liveticker's explicitly enumerated mutations.
    -- Neither unknown actions, generic worker controls nor other modules
    -- are eligible for this exception.
    if v_action = any (array[
      'liveticker_game_reset',
      'liveticker_graphics_enqueue',
      'liveticker_graphic_template_save',
      'liveticker_output_template_save',
      'liveticker_output_variant_delete',
      'liveticker_output_variant_save',
      'liveticker_player_delete',
      'liveticker_player_save',
      'liveticker_team_save',
      'liveticker_whatsapp_delivery_enqueue',
      'liveticker_whatsapp_delivery_link',
      'liveticker_whatsapp_delivery_retry',
      'liveticker_whatsapp_routing_set',
      'liveticker_whatsapp_sticker_enqueue',
      'liveticker_whatsapp_sticker_metadata_set',
      'liveticker_whatsapp_sticker_rename',
      'liveticker_whatsapp_sticker_set_active',
      'liveticker_wpp_runtime_set'
    ]::text[]) then
      v_cockpit := app_private.api_cockpit_access_get('{}'::jsonb);
      if (v_cockpit #>> '{permissions,liveticker,effectiveAllowed}') = 'true'
         and (v_cockpit ->> 'userId') = p_actor::text
         and (v_cockpit #>> '{cockpit,allowed}') = 'true'
         and (v_cockpit #>> '{portal,active}') = 'true' then
        return;
      end if;
    end if;
  end if;

  -- The existing strictly user-bound release bypass and error mapping
  -- are preserved for unrelated system workflows.
  if p_actor is not null
     and app_private.try_platform_release_bypass(p_action, p_actor) then
    return;
  end if;

  case v_state.mode
    when 'READ_ONLY' then
      raise exception 'PLATFORM_READ_ONLY' using errcode = 'P0902';
    when 'MAINTENANCE' then
      raise exception 'PLATFORM_MAINTENANCE' using errcode = 'P0903';
    else
      raise exception 'PLATFORM_WRITE_UNAVAILABLE' using errcode = 'P0901';
  end case;
end;
$function$;

-- Maintain the existing private surface. No direct Data API grant.
revoke all on function app_private.require_platform_user_write_allowed(text, uuid)
from public, anon, authenticated, service_role;

comment on function app_private.require_platform_user_write_allowed(text,uuid) is
'DEV Cockpit-scoped M900 user-write gate (D-056): explicit Liveticker/Cockpit allowlist, verified effective rights, legacy READ_ONLY and MAINTENANCE retained.';
