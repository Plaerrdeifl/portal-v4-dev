\set ON_ERROR_STOP on
begin;

do $cockpit_lt_scoped_writes$
declare
  v_user uuid := '00000000-0000-4587-8000-000000000001';
  v_admin uuid := '00000000-0000-4587-8000-000000000002';
  v_denied uuid := '00000000-0000-4587-8000-000000000003';
  v_portal_role uuid;
  v_error text;
begin
  select id into v_portal_role from app_portal.portal_roles
  where code = 'PORTAL_USER' and is_active;
  if v_portal_role is null then
    raise exception 'PORTAL_USER fixture missing';
  end if;

  insert into auth.users(id,email)
  values
    (v_user,'cockpit-lt-test@example.invalid'),
    (v_admin,'cockpit-lt-admin@example.invalid'),
    (v_denied,'cockpit-lt-denied@example.invalid');

  insert into app_portal.users(
    id,user_code,email,first_name,last_name,status,role_id
  ) values
    (v_user,'U-CKLT-001','cockpit-lt-test@example.invalid','Cockpit','Ticker','ACTIVE',v_portal_role),
    (v_admin,'U-CKLT-002','cockpit-lt-admin@example.invalid','Cockpit','Admin','ACTIVE',v_portal_role),
    (v_denied,'U-CKLT-003','cockpit-lt-denied@example.invalid','Cockpit','Denied','ACTIVE',v_portal_role);
  insert into app_portal.cockpit_access(user_id,role,is_enabled,revision)
  values
    (v_user,'USER',true,1),
    (v_admin,'ADMIN',true,1);
  insert into app_portal.user_capabilities(user_id,capability_code,granted_by)
  values (v_user,'liveticker.manage',v_admin);

  update app_portal.settings set
    value=jsonb_build_object('mode','READ_ONLY','environment','DEV'),
    revision=revision+1 where key='platform.mode';

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',v_user,'role','authenticated')::text,true);

  -- Explicit Liveticker write allowed for active Cockpit user with right.
  perform app_private.require_platform_user_write_allowed('liveticker_team_save',v_user);
  perform app_private.require_platform_user_write_allowed('liveticker_whatsapp_delivery_retry',v_user);

  -- An unknown/generic/other-module action must remain READ_ONLY.
  foreach v_error in array array['event_create','worker_runtime_set','liveticker_unknown_mutation'] loop
    begin
      perform app_private.require_platform_user_write_allowed(v_error,v_user);
      raise exception 'Non-Liveticker action unexpectedly allowed: %',v_error;
    exception when sqlstate 'P0902' then null;
    end;
  end loop;

  -- A Cockpit USER cannot perform an admin mutation.
  begin
    perform app_private.require_platform_user_write_allowed('cockpit_admin_access_set',v_user);
    raise exception 'Cockpit USER unexpectedly got write access to administration';
  exception when sqlstate 'P0902' then null;
  end;

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',v_admin,'role','authenticated')::text,true);
  perform app_private.require_platform_user_write_allowed('cockpit_admin_access_set',v_admin);
  perform app_private.require_platform_user_write_allowed('cockpit_admin_personal_capabilities_set',v_admin);
  begin
    perform app_private.require_platform_user_write_allowed('liveticker_team_save',v_admin);
    raise exception 'Admin without Liveticker capability got Liveticker write access';
  exception when sqlstate 'P0902' then null;
  end;

  perform set_config('request.jwt.claim.sub',v_denied::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',v_denied,'role','authenticated')::text,true);
  begin
    perform app_private.require_platform_user_write_allowed('liveticker_team_save',v_denied);
    raise exception 'User without Cockpit access got Liveticker write access';
  exception when sqlstate 'P0902' then null;
  end;

  -- An actor ID must never replace the authenticated JWT user.
  begin
    perform app_private.require_platform_user_write_allowed('liveticker_team_save',v_user);
    raise exception 'Wrong actor JWT was accepted';
  exception when sqlstate 'P0902' then null;
  end;

  -- PROD and MAINTENANCE are not unlocked by the DEV-only contract.
  update app_portal.settings set value=jsonb_build_object('mode','READ_ONLY','environment','PROD'),
    revision=revision+1 where key='platform.mode';
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',v_user,'role','authenticated')::text,true);
  begin
    perform app_private.require_platform_user_write_allowed('liveticker_team_save',v_user);
    raise exception 'PROD was unlocked';
  exception when sqlstate 'P0902' then null;
  end;
  update app_portal.settings set value=jsonb_build_object('mode','MAINTENANCE','environment','DEV'),
    revision=revision+1 where key='platform.mode';
  begin
    perform app_private.require_platform_user_write_allowed('liveticker_team_save',v_user);
    raise exception 'MAINTENANCE was unlocked';
  exception when sqlstate 'P0903' then null;
  end;

  if has_function_privilege('authenticated',
    'app_private.require_platform_user_write_allowed(text,uuid)','EXECUTE') then
    raise exception 'The private M900 gate is callable from browser roles';
  end if;
end;
$cockpit_lt_scoped_writes$;

rollback;
