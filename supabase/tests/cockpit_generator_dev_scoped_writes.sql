\set ON_ERROR_STOP on
begin;

select plan(1);

do $cockpit_generator_scoped$
declare
  v_actor uuid := '00000000-0000-4603-8000-000000000001';
  v_no_generator uuid := '00000000-0000-4603-8000-000000000002';
  v_no_cockpit uuid := '00000000-0000-4603-8000-000000000003';
  v_role_id uuid;
  v_response jsonb;
  v_draft_id uuid;
  v_document jsonb := jsonb_build_object(
    'id','cockpit-generator-dev-readonly-e2e',
    'title','Cockpit DEV Generator Test',
    'schemaVersion',1,
    'format',jsonb_build_object('width',1080,'height',1080),
    'elements','[]'::jsonb,
    'metadata',jsonb_build_object(
      'createdAt','2026-11-03T00:00:00.000Z',
      'updatedAt','2026-11-03T00:00:00.000Z'
    )
  );
  v_action text;
  v_user uuid;
  v_state record;
  v_actions text[] := array[
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
  ];
begin
  select id into strict v_role_id
  from app_portal.portal_roles
  where code = 'PORTAL_USER' and is_active;

  insert into auth.users(id,email) values
    (v_actor,'ck-generator-allow@example.invalid'),
    (v_no_generator,'ck-generator-no-right@example.invalid'),
    (v_no_cockpit,'ck-generator-no-cockpit@example.invalid');

  insert into app_portal.users(id,user_code,email,first_name,last_name,status,role_id)
  values
    (v_actor,'U-CKGEN-001','ck-generator-allow@example.invalid','Generator','Allow','ACTIVE',v_role_id),
    (v_no_generator,'U-CKGEN-002','ck-generator-no-right@example.invalid','Generator','NoRight','ACTIVE',v_role_id),
    (v_no_cockpit,'U-CKGEN-003','ck-generator-no-cockpit@example.invalid','Generator','NoCockpit','ACTIVE',v_role_id);

  insert into app_portal.cockpit_access(user_id,role,is_enabled,revision)
  values
    (v_actor,'USER',true,1),
    (v_no_generator,'USER',true,1);

  insert into app_portal.user_capabilities(user_id,capability_code,created_by)
  values
    (v_actor,'social_media_generator.use',v_actor),
    (v_no_cockpit,'social_media_generator.use',v_actor);

  update app_portal.settings
  set value=jsonb_build_object('mode','READ_ONLY','environment','DEV'),
      revision=revision+1
  where key='platform.mode';

  select * into v_state from app_private.platform_runtime_state();
  if v_state.mode is distinct from 'READ_ONLY' or v_state.is_valid is distinct from true then
    raise exception 'DEV READ_ONLY test fixture not active';
  end if;

  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_actor,'role','authenticated')::text,
    true
  );

  if cardinality(v_actions)<>18 then
    raise exception 'Generator mutation allowlist count changed';
  end if;

  foreach v_action in array v_actions loop
    if app_private.platform_action_classification(v_action)<>'USER_MUTATION' then
      raise exception 'Unexpected Generator classification for %',v_action;
    end if;
    perform app_private.require_platform_user_write_allowed(v_action,v_actor);
  end loop;

  -- Exercise the actual public Browser API, not just the private guard:
  -- creating, reading and saving a draft must work as this JWT actor.
  v_response := public.pd_api(
    'social_media_generator_draft_create',
    jsonb_build_object('title','Cockpit DEV Generator Test','document',v_document)
  );
  if v_response #>> '{ok}' is distinct from 'true'
     or v_response #>> '{data,version}' is distinct from '1' then
    raise exception 'Cockpit Generator draft creation failed: %',v_response;
  end if;
  v_draft_id := (v_response #>> '{data,id}')::uuid;
  v_response := public.pd_api(
    'social_media_generator_draft_get',
    jsonb_build_object('draftId',v_draft_id)
  );
  if v_response #>> '{ok}' is distinct from 'true'
     or v_response #> '{data,document}' is distinct from v_document then
    raise exception 'Cockpit Generator draft reading failed: %',v_response;
  end if;
  v_response := public.pd_api(
    'social_media_generator_draft_save',
    jsonb_build_object(
      'draftId',v_draft_id,
      'title','Cockpit DEV Generator Test gespeichert',
      'document',v_document,
      'expectedVersion',1
    )
  );
  if v_response #>> '{ok}' is distinct from 'true'
     or v_response #>> '{data,version}' is distinct from '2' then
    raise exception 'Cockpit Generator draft saving failed: %',v_response;
  end if;
  if not exists (
    select 1 from app_social_media.drafts
    where id=v_draft_id and owner_user_id=v_actor and version=2
  ) then
    raise exception 'Cockpit Generator draft write breached ownership';
  end if;

  foreach v_action in array array[
    'event_create',
    'fanbus_trip_create',
    'liveticker_team_save',
    'social_media_generator_unknown_mutation',
    'social_media_generator_render_retry'
  ]::text[] loop
    begin
      perform app_private.require_platform_user_write_allowed(v_action,v_actor);
      raise exception 'Non-allowlisted mutation unexpectedly allowed: %',v_action;
    exception when sqlstate 'P0902' then null;
    end;
  end loop;

  -- Valid Cockpit membership without Generator permission cannot write.
  perform set_config('request.jwt.claim.sub',v_no_generator::text,true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_no_generator,'role','authenticated')::text,true);
  begin
    perform app_private.require_platform_user_write_allowed(
      'social_media_generator_draft_save',v_no_generator);
    raise exception 'Cockpit user without Generator permission unexpectedly allowed';
  exception when sqlstate 'P0902' then null;
  end;

  -- Generator permission alone never creates a Cockpit membership.
  perform set_config('request.jwt.claim.sub',v_no_cockpit::text,true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_no_cockpit,'role','authenticated')::text,true);
  begin
    perform app_private.require_platform_user_write_allowed(
      'social_media_generator_draft_save',v_no_cockpit);
    raise exception 'Generator permission without Cockpit membership unexpectedly allowed';
  exception when sqlstate 'P0902' then null;
  end;

  -- JWT actor is authoritative: a provided foreign UUID never grants access.
  begin
    perform app_private.require_platform_user_write_allowed(
      'social_media_generator_draft_save',v_actor);
    raise exception 'Foreign actor UUID unexpectedly allowed';
  exception when sqlstate 'P0902' then null;
  end;

  perform set_config('request.jwt.claim.sub',v_actor::text,true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub',v_actor,'role','authenticated')::text,true);
  update app_portal.cockpit_access
    set is_enabled=false,revision=revision+1 where user_id=v_actor;
  begin
    perform app_private.require_platform_user_write_allowed(
      'social_media_generator_draft_save',v_actor);
    raise exception 'Disabled Cockpit membership unexpectedly allowed';
  exception when sqlstate 'P0902' then null;
  end;
  update app_portal.cockpit_access
    set is_enabled=true,revision=revision+1 where user_id=v_actor;

  -- PROD READ_ONLY, DEV maintenance and invalid runtime remain closed.
  update app_portal.settings
  set value=jsonb_build_object('mode','READ_ONLY','environment','PROD'),
      revision=revision+1 where key='platform.mode';
  begin
    perform app_private.require_platform_user_write_allowed(
      'social_media_generator_draft_save',v_actor);
    raise exception 'PROD read-only unexpectedly allowed';
  exception when sqlstate 'P0902' then null;
  end;

  update app_portal.settings
  set value=jsonb_build_object('mode','MAINTENANCE','environment','DEV'),
      revision=revision+1 where key='platform.mode';
  begin
    perform app_private.require_platform_user_write_allowed(
      'social_media_generator_draft_save',v_actor);
    raise exception 'MAINTENANCE unexpectedly allowed';
  exception when sqlstate 'P0903' then null;
  end;

  if has_function_privilege('authenticated',
      'app_private.require_platform_user_write_allowed(text,uuid)','EXECUTE')
     or has_function_privilege('anon',
      'app_private.require_platform_user_write_allowed(text,uuid)','EXECUTE') then
    raise exception 'Private write gate is callable directly by browser roles';
  end if;
end;
$cockpit_generator_scoped$;

select pass('DEV Cockpit Generator writes are exact, user-bound, and fail closed everywhere else');
select * from finish();

rollback;
