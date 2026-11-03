begin;

-- The legacy Portal 1.0 runs in READ_ONLY on DEV while Portal 2.0 is built.
-- Permit only authenticated, explicitly enrolled Cockpit members with
-- effective Generator permission to use the leading Generator fach API.
-- Never set the platform to NORMAL or permit PROD/MAINTENANCE writes.
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
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_state record;
  v_cockpit jsonb;
begin
  -- Exact, audited user-facing Generator mutations only. Unknown actions,
  -- other module writes and worker/service operations are not exceptions.
  if v_action = any (array[
    'social_media_generator_draft_create',
    'social_media_generator_draft_create_from_template',
    'social_media_generator_draft_save',
    'social_media_generator_fanbus_draft_create',
    'social_media_generator_media_archive',
    'social_media_generator_media_package_create',
    'social_media_generator_media_package_data_save',
    'social_media_generator_package_template_create',
    'social_media_generator_package_template_draft_begin',
    'social_media_generator_package_template_draft_save',
    'social_media_generator_package_template_favorite_set',
    'social_media_generator_package_template_publish',
    'social_media_generator_preferences_update',
    'social_media_generator_template_create',
    'social_media_generator_template_draft_begin',
    'social_media_generator_template_draft_save',
    'social_media_generator_template_favorite_set',
    'social_media_generator_template_publish'
  ]::text[])
     and app_private.platform_action_classification(v_action) = 'USER_MUTATION'
     and p_actor is not null
     and p_actor = auth.uid()
     and app_private.platform_release_environment() = 'DEV' then

    select state.* into v_state
    from app_private.platform_runtime_state() as state;

    if v_state.is_valid is true
       and v_state.mode = 'READ_ONLY'
       and app_private.cockpit_user_has_access(p_actor)
       and app_private.social_media_generator_user_has_access(p_actor) then
      v_cockpit := app_private.api_cockpit_access_get('{}'::jsonb);

      if (v_cockpit ->> 'userId') = p_actor::text
         and (v_cockpit #>> '{portal,active}') = 'true'
         and (v_cockpit #>> '{cockpit,allowed}') = 'true'
         and (v_cockpit #>> '{permissions,generator,effectiveAllowed}') = 'true' then
        -- The fach action still enforces ownership, revision, schema,
        -- publishing permissions and audit inside its own API handler.
        return;
      end if;
    end if;
  end if;

  -- Keep existing Liveticker finalization and Cockpit/Liveticker
  -- exceptions, strict user-bound bypasses and all error mappings.
  if v_action = 'liveticker_finalization_start' then
    perform app_private.require_platform_user_write_allowed_before_final_r1(
      'liveticker_spieltage_status', p_actor
    );
  else
    perform app_private.require_platform_user_write_allowed_before_final_r1(
      p_action, p_actor
    );
  end if;
end;
$function$;

revoke all on function app_private.require_platform_user_write_allowed(text, uuid)
from public, anon, authenticated, service_role;

comment on function app_private.require_platform_user_write_allowed(text,uuid) is
'DEV READ_ONLY: effective Cockpit-Generator rights may perform explicitly listed Generator user mutations; existing Liveticker and legacy policies preserved, PROD/MAINTENANCE closed.';

commit;
