\set ON_ERROR_STOP on

begin;

do $verification$
declare
  v_schema text;
  v_table text;
begin
  foreach v_schema in array array['app_private', 'app_portal', 'app_fanclub', 'app_modules']
  loop
    if to_regnamespace(v_schema) is null then
      raise exception 'Schema fehlt: %', v_schema;
    end if;
    if has_schema_privilege('anon', v_schema, 'USAGE')
       or has_schema_privilege('authenticated', v_schema, 'USAGE') then
      raise exception 'Data-API-Rolle besitzt unerlaubtes USAGE auf %', v_schema;
    end if;
  end loop;

  foreach v_table in array array[
    'app_portal.portal_roles',
    'app_portal.capabilities',
    'app_portal.role_capabilities',
    'app_portal.users',
    'app_portal.access_requests',
    'app_portal.user_member_links',
    'app_portal.teams',
    'app_portal.team_memberships',
    'app_fanclub.members',
    'app_fanclub.office_slots',
    'app_modules.tasks',
    'app_modules.task_notes'
  ]
  loop
    if to_regclass(v_table) is null then
      raise exception 'Tabelle fehlt: %', v_table;
    end if;
    if not (select relrowsecurity from pg_class where oid = to_regclass(v_table)) then
      raise exception 'RLS fehlt auf %', v_table;
    end if;
  end loop;

  if (select count(*) from app_portal.portal_roles) <> 3 then
    raise exception 'Initiale Rollenanzahl ist nicht 3.';
  end if;
  if (select count(*) from app_fanclub.office_slots) <> 5 then
    raise exception 'Feste Amtsplatzanzahl ist nicht 5.';
  end if;
  if not exists (
    select 1 from app_portal.role_capabilities
    where role_id = '00000000-0000-4000-8000-000000000001'
      and capability_code = 'portal.admin'
  ) then
    raise exception 'Initiale Adminrolle besitzt portal.admin nicht.';
  end if;
  if to_regprocedure('public.pd_api(text,jsonb)') is null then
    raise exception 'Portal-RPC fehlt.';
  end if;
  if to_regprocedure('public.pd_create_bootstrap_token(text,timestamp with time zone)') is null then
    raise exception 'Bootstrap-Service-RPC fehlt.';
  end if;
  if has_function_privilege('anon', 'public.pd_api(text,jsonb)', 'EXECUTE') then
    raise exception 'anon darf pd_api nicht ausführen.';
  end if;
  if not has_function_privilege('authenticated', 'public.pd_api(text,jsonb)', 'EXECUTE') then
    raise exception 'authenticated darf pd_api nicht ausführen.';
  end if;
  if has_function_privilege('authenticated', 'public.pd_create_bootstrap_token(text,timestamp with time zone)', 'EXECUTE') then
    raise exception 'authenticated darf Bootstrap-Service-RPC nicht ausführen.';
  end if;
  if not has_function_privilege('service_role', 'public.pd_create_bootstrap_token(text,timestamp with time zone)', 'EXECUTE') then
    raise exception 'service_role darf Bootstrap-Service-RPC nicht ausführen.';
  end if;
end
$verification$;

select 'PORTAL_CORE_STRUCTURE_OK' as result;
rollback;
