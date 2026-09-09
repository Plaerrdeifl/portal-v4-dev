create table app_private.worker_runtime_controls (
  worker_code text primary key,
  enabled boolean not null default false,
  last_seen_at timestamptz,
  last_state text not null default 'DISABLED',
  updated_at timestamptz not null default statement_timestamp(),
  updated_by uuid,
  revision bigint not null default 1,
  constraint worker_runtime_controls_code_check check (worker_code in ('LIVETICKER_GRAPHICS','FANBUS_PUBLISHING')),
  constraint worker_runtime_controls_state_check check (last_state in ('DISABLED','STARTING','ACTIVE')),
  constraint worker_runtime_controls_revision_check check (revision >= 1)
);
revoke all on table app_private.worker_runtime_controls from public, anon, authenticated, service_role;
insert into app_private.worker_runtime_controls(worker_code, enabled, last_state) values
 ('LIVETICKER_GRAPHICS', false, 'DISABLED'),('FANBUS_PUBLISHING', false, 'DISABLED');

create or replace function app_private.worker_runtime_capability(p_worker_code text) returns text language plpgsql immutable set search_path='' as $function$
declare v_code text := upper(btrim(coalesce(p_worker_code,''))); begin
 case v_code when 'LIVETICKER_GRAPHICS' then return 'liveticker.operator'; when 'FANBUS_PUBLISHING' then return 'fanbus.publishing.manage'; else raise exception 'WORKER_CODE_INVALID' using errcode='22023'; end case;
end;$function$;
create or replace function app_private.worker_runtime_is_enabled(p_worker_code text) returns boolean language sql stable security definer set search_path='' as $function$
 select coalesce((select c.enabled from app_private.worker_runtime_controls c where c.worker_code=upper(btrim(coalesce(p_worker_code,'')))),false);$function$;
create or replace function app_private.worker_runtime_is_ready(p_worker_code text) returns boolean language sql stable security definer set search_path='' as $function$
 select coalesce((select c.enabled and c.last_state='ACTIVE' and c.last_seen_at is not null and c.last_seen_at>=c.updated_at and c.last_seen_at>=statement_timestamp()-interval '90 seconds' from app_private.worker_runtime_controls c where c.worker_code=upper(btrim(coalesce(p_worker_code,'')))),false);$function$;
create or replace function app_private.worker_runtime_status_internal(p_worker_code text) returns jsonb language plpgsql stable security definer set search_path='' as $function$
declare v_code text:=upper(btrim(coalesce(p_worker_code,''))); v_row app_private.worker_runtime_controls%rowtype; v_ready boolean:=false; v_state text; begin
 perform app_private.worker_runtime_capability(v_code); select * into v_row from app_private.worker_runtime_controls c where c.worker_code=v_code; if not found then raise exception 'WORKER_CODE_INVALID' using errcode='22023'; end if;
 v_ready:=v_row.enabled and v_row.last_state='ACTIVE' and v_row.last_seen_at is not null and v_row.last_seen_at>=v_row.updated_at and v_row.last_seen_at>=statement_timestamp()-interval '90 seconds';
 if not v_row.enabled then v_state:='DISABLED'; elsif v_ready then v_state:='ACTIVE'; elsif v_row.updated_at>=statement_timestamp()-interval '75 seconds' then v_state:='STARTING'; else v_state:='UNREACHABLE'; end if;
 return jsonb_build_object('workerCode',v_code,'enabled',v_row.enabled,'ready',v_ready,'state',v_state,'lastSeenAt',v_row.last_seen_at,'updatedAt',v_row.updated_at,'revision',v_row.revision,'activePollSeconds',5,'disabledPollSeconds',60);
end;$function$;
create or replace function app_private.worker_runtime_assert_ready(p_worker_code text) returns void language plpgsql stable security definer set search_path='' as $function$ begin
 if not app_private.worker_runtime_is_enabled(p_worker_code) then raise exception 'WORKER_DISABLED' using errcode='55000'; end if; if not app_private.worker_runtime_is_ready(p_worker_code) then raise exception 'WORKER_NOT_READY' using errcode='55000'; end if;
end;$function$;
create or replace function app_private.api_worker_runtime_status(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_code text; v_capability text; begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or not p_payload?'workerCode' or jsonb_typeof(p_payload->'workerCode')<>'string' or p_payload-array['workerCode']::text[]<>'{}'::jsonb then raise exception 'WORKER_RUNTIME_STATUS_INVALID_PAYLOAD' using errcode='22023'; end if;
 v_code:=upper(btrim(p_payload->>'workerCode')); v_capability:=app_private.worker_runtime_capability(v_code); perform app_private.require_capability(v_capability); return app_private.worker_runtime_status_internal(v_code);
end;$function$;
create or replace function app_private.api_worker_runtime_set(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_code text; v_enabled boolean; v_capability text; v_actor uuid; v_before app_private.worker_runtime_controls%rowtype; v_after app_private.worker_runtime_controls%rowtype; begin
 if p_payload is null or jsonb_typeof(p_payload)<>'object' or not p_payload?'workerCode' or not p_payload?'enabled' or jsonb_typeof(p_payload->'workerCode')<>'string' or jsonb_typeof(p_payload->'enabled')<>'boolean' or p_payload-array['workerCode','enabled']::text[]<>'{}'::jsonb then raise exception 'WORKER_RUNTIME_SET_INVALID_PAYLOAD' using errcode='22023'; end if;
 v_code:=upper(btrim(p_payload->>'workerCode')); v_enabled:=(p_payload->>'enabled')::boolean; v_capability:=app_private.worker_runtime_capability(v_code); v_actor:=app_private.require_capability(v_capability);
 select * into v_before from app_private.worker_runtime_controls c where c.worker_code=v_code for update; if not found then raise exception 'WORKER_CODE_INVALID' using errcode='22023'; end if;
 if v_before.enabled is distinct from v_enabled then update app_private.worker_runtime_controls c set enabled=v_enabled,last_seen_at=null,last_state=case when v_enabled then 'STARTING' else 'DISABLED' end,updated_at=statement_timestamp(),updated_by=v_actor,revision=c.revision+1 where c.worker_code=v_code returning * into v_after;
 perform app_private.log_audit(v_actor,case when v_code='LIVETICKER_GRAPHICS' and v_enabled then 'LIVETICKER_GRAPHICS_WORKER_ENABLED' when v_code='LIVETICKER_GRAPHICS' then 'LIVETICKER_GRAPHICS_WORKER_DISABLED' when v_enabled then 'FANBUS_PUBLISHING_WORKER_ENABLED' else 'FANBUS_PUBLISHING_WORKER_DISABLED' end,'worker_runtime_control',v_code,jsonb_build_object('enabled',v_before.enabled,'revision',v_before.revision),jsonb_build_object('enabled',v_after.enabled,'revision',v_after.revision),jsonb_build_object('source','portal')); end if;
 return app_private.worker_runtime_status_internal(v_code);
end;$function$;
create or replace function public.pd_worker_runtime_control(p_worker_code text) returns jsonb language plpgsql security definer set search_path='' as $function$
declare v_code text:=upper(btrim(coalesce(p_worker_code,''))); v_row app_private.worker_runtime_controls%rowtype; begin perform app_private.worker_runtime_capability(v_code); update app_private.worker_runtime_controls c set last_seen_at=statement_timestamp(),last_state=case when c.enabled then 'ACTIVE' else 'DISABLED' end where c.worker_code=v_code returning * into v_row; if not found then raise exception 'WORKER_CODE_INVALID' using errcode='22023'; end if; return jsonb_build_object('workerCode',v_code,'enabled',v_row.enabled,'state',case when v_row.enabled then 'ACTIVE' else 'DISABLED' end,'activePollSeconds',5,'disabledPollSeconds',60); end;$function$;
revoke all on function public.pd_worker_runtime_control(text) from public,anon,authenticated,service_role; grant execute on function public.pd_worker_runtime_control(text) to service_role;
alter function app_private.api_fanbus_publishing_job_enqueue(jsonb) rename to api_fanbus_publishing_job_enqueue_before_worker_control_r1;
create function app_private.api_fanbus_publishing_job_enqueue(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $function$ begin perform app_private.require_capability('fanbus.publishing.manage'); perform app_private.worker_runtime_assert_ready('FANBUS_PUBLISHING'); return app_private.api_fanbus_publishing_job_enqueue_before_worker_control_r1(p_payload); end;$function$;
alter function app_private.liveticker_graphic_enqueue(uuid,text,uuid) rename to liveticker_graphic_enqueue_before_worker_control_r1;
create function app_private.liveticker_graphic_enqueue(p_event_id uuid,p_kind text,p_actor uuid default null::uuid) returns jsonb language plpgsql security definer set search_path='' as $function$ begin if not app_private.worker_runtime_is_ready('LIVETICKER_GRAPHICS') then if p_actor is null then return jsonb_build_object('skipped',true,'reason',case when app_private.worker_runtime_is_enabled('LIVETICKER_GRAPHICS') then 'WORKER_NOT_READY' else 'WORKER_DISABLED' end); end if; perform app_private.worker_runtime_assert_ready('LIVETICKER_GRAPHICS'); end if; return app_private.liveticker_graphic_enqueue_before_worker_control_r1(p_event_id,p_kind,p_actor); end;$function$;
alter function public.pd_liveticker_graphic_worker_claim() rename to pd_liveticker_graphic_worker_claim_before_worker_control_r1;
create function public.pd_liveticker_graphic_worker_claim() returns jsonb language plpgsql security definer set search_path='' as $function$ begin if not app_private.worker_runtime_is_enabled('LIVETICKER_GRAPHICS') then return jsonb_build_object('claimed',false); end if; return public.pd_liveticker_graphic_worker_claim_before_worker_control_r1(); end;$function$;
revoke all on function public.pd_liveticker_graphic_worker_claim_before_worker_control_r1() from public,anon,authenticated,service_role; revoke all on function public.pd_liveticker_graphic_worker_claim() from public,anon,authenticated,service_role; grant execute on function public.pd_liveticker_graphic_worker_claim() to service_role;
alter function public.pd_m340_fanbus_publishing_job_claim() rename to pd_m340_fanbus_publishing_job_claim_before_worker_control_r1;
create function public.pd_m340_fanbus_publishing_job_claim() returns jsonb language plpgsql security definer set search_path='' as $function$ begin if not app_private.worker_runtime_is_enabled('FANBUS_PUBLISHING') then return jsonb_build_object('claimed',false); end if; return public.pd_m340_fanbus_publishing_job_claim_before_worker_control_r1(); end;$function$;
revoke all on function public.pd_m340_fanbus_publishing_job_claim_before_worker_control_r1() from public,anon,authenticated,service_role; revoke all on function public.pd_m340_fanbus_publishing_job_claim() from public,anon,authenticated,service_role; grant execute on function public.pd_m340_fanbus_publishing_job_claim() to service_role;
create or replace function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $function$ declare v_action text:=lower(btrim(coalesce(p_action,''))); begin case v_action when 'worker_runtime_status' then return app_private.api_worker_runtime_status(coalesce(p_payload,'{}'::jsonb)); when 'worker_runtime_set' then return app_private.api_worker_runtime_set(coalesce(p_payload,'{}'::jsonb)); when 'liveticker_graphic_templates_list' then return app_private.api_liveticker_graphic_templates_list(); when 'liveticker_graphic_template_save' then return app_private.api_liveticker_graphic_template_save(coalesce(p_payload,'{}'::jsonb)); else return app_private.pd_api_dispatch_current_before_liveticker_graphic_templates_prod_r1(p_action,p_payload); end case; end;$function$;
create or replace function app_private.platform_action_classification(p_action text) returns text language sql stable set search_path='' as $function$ select case lower(btrim(coalesce(p_action,''))) when 'worker_runtime_status' then 'READ' when 'worker_runtime_set' then 'USER_MUTATION' when 'liveticker_graphic_templates_list' then 'READ' when 'liveticker_graphic_template_save' then 'USER_MUTATION' else app_private.platform_action_classification_before_liveticker_graphic_templates_prod_r1(p_action) end;$function$;
