-- M340 DEV: output settings + immutable template snapshot + template reset/resolution.
-- Additive on top of the already-applied 20260908101657 template foundation.

create table app_modules.fanbus_publishing_output_settings (
  environment text primary key,
  trip_label_enabled boolean not null default true,
  trip_label_text text not null default 'FANBUSFAHRT',
  updated_at timestamptz not null default now(),
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint fanbus_publishing_output_settings_environment_check
    check (environment ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
  constraint fanbus_publishing_output_settings_label_check
    check (
      char_length(trip_label_text) between 1 and 32
      and trip_label_text = pg_catalog.btrim(trip_label_text)
      and trip_label_text !~ '[[:cntrl:]]'
    )
);

alter table app_modules.fanbus_publishing_output_settings enable row level security;
revoke all on table app_modules.fanbus_publishing_output_settings
  from public, anon, authenticated, service_role;

create function app_private.m340_fanbus_publishing_output_settings_current()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_row app_modules.fanbus_publishing_output_settings%rowtype;
begin
  if v_environment is null then
    raise exception 'M340_PUBLISHING_ENVIRONMENT_UNAVAILABLE' using errcode = '55000';
  end if;

  select settings.* into v_row
  from app_modules.fanbus_publishing_output_settings as settings
  where settings.environment = v_environment;

  return jsonb_build_object(
    'tripLabel', jsonb_build_object(
      'enabled', coalesce(v_row.trip_label_enabled, true),
      'text', coalesce(v_row.trip_label_text, 'FANBUSFAHRT')
    )
  );
end;
$function$;

create function app_private.m340_fanbus_publishing_template_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
begin
  if v_environment is null then
    raise exception 'M340_PUBLISHING_ENVIRONMENT_UNAVAILABLE' using errcode = '55000';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_strip_nulls(jsonb_build_object(
        'kind', kinds.kind,
        'source', case when version.id is null then 'SERVER_DEFAULT' else 'CUSTOM' end,
        'versionId', version.id,
        'objectName', version.object_name,
        'filename', version.original_filename,
        'sha256', version.sha256,
        'bytes', version.bytes
      )) order by kinds.ordinal
    )
    from (values ('POST',1),('STORY',2),('LED',3)) as kinds(kind, ordinal)
    left join app_modules.fanbus_publishing_template_state as state
      on state.environment = v_environment
     and state.kind = kinds.kind
    left join app_modules.fanbus_publishing_template_versions as version
      on version.id = state.active_version_id
  ), '[]'::jsonb);
end;
$function$;

create function app_private.m340_fanbus_publishing_template_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
begin
  if v_environment is null then
    raise exception 'M340_PUBLISHING_ENVIRONMENT_UNAVAILABLE' using errcode = '55000';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'kind', kinds.kind,
        'label', kinds.label,
        'source', case when version.id is null then 'SERVER_DEFAULT' else 'CUSTOM' end,
        'versionId', version.id,
        'filename', version.original_filename,
        'sha256', version.sha256,
        'bytes', version.bytes,
        'updatedAt', version.created_at,
        'canRollback', version.id is not null,
        'canReset', version.id is not null
      ) order by kinds.ordinal
    )
    from (values
      ('POST','Instagram Post',1),
      ('STORY','Instagram Story',2),
      ('LED','LED 16:9',3)
    ) as kinds(kind,label,ordinal)
    left join app_modules.fanbus_publishing_template_state as state
      on state.environment = v_environment
     and state.kind = kinds.kind
    left join app_modules.fanbus_publishing_template_versions as version
      on version.id = state.active_version_id
  ), '[]'::jsonb);
end;
$function$;

create function app_private.api_fanbus_publishing_output_settings_update(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_environment text := app_private.platform_release_environment();
  v_enabled boolean;
  v_text text;
  v_before jsonb;
  v_after jsonb;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['tripLabelEnabled','tripLabelText']::text[] <> '{}'::jsonb
     or not p_payload ? 'tripLabelEnabled'
     or not p_payload ? 'tripLabelText'
     or pg_catalog.jsonb_typeof(p_payload -> 'tripLabelEnabled') <> 'boolean'
     or pg_catalog.jsonb_typeof(p_payload -> 'tripLabelText') <> 'string'
     or v_environment is null then
    raise exception 'M340_PUBLISHING_SETTINGS_INVALID' using errcode = '22023';
  end if;

  v_enabled := (p_payload ->> 'tripLabelEnabled')::boolean;
  v_text := pg_catalog.regexp_replace(pg_catalog.btrim(p_payload ->> 'tripLabelText'), '[[:space:]]+', ' ', 'g');
  if char_length(v_text) not between 1 and 32 or v_text ~ '[[:cntrl:]]' then
    raise exception 'M340_PUBLISHING_SETTINGS_INVALID' using errcode = '22023';
  end if;

  v_before := app_private.m340_fanbus_publishing_output_settings_current();

  insert into app_modules.fanbus_publishing_output_settings(
    environment, trip_label_enabled, trip_label_text, updated_by
  ) values (
    v_environment, v_enabled, v_text, v_actor
  )
  on conflict (environment) do update
  set trip_label_enabled = excluded.trip_label_enabled,
      trip_label_text = excluded.trip_label_text,
      updated_at = now(),
      updated_by = excluded.updated_by;

  v_after := app_private.m340_fanbus_publishing_output_settings_current();
  perform app_private.log_audit(
    v_actor,
    'FANBUS_PUBLISHING_SETTINGS_UPDATED',
    'fanbus_publishing_settings',
    v_environment,
    v_before,
    v_after
  );
  return v_after;
end;
$function$;

create function app_private.api_fanbus_publishing_template_reset(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_environment text := app_private.platform_release_environment();
  v_kind text := upper(pg_catalog.btrim(coalesce(p_payload ->> 'kind','')));
  v_before uuid;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['kind']::text[] <> '{}'::jsonb
     or v_kind not in ('POST','STORY','LED')
     or v_environment is null then
    raise exception 'M340_TEMPLATE_RESET_INVALID' using errcode = '22023';
  end if;

  insert into app_modules.fanbus_publishing_template_state(environment,kind,active_version_id,updated_by)
  values(v_environment,v_kind,null,v_actor)
  on conflict (environment,kind) do nothing;

  select active_version_id into v_before
  from app_modules.fanbus_publishing_template_state
  where environment = v_environment and kind = v_kind
  for update;

  update app_modules.fanbus_publishing_template_state
  set active_version_id = null, updated_at = now(), updated_by = v_actor
  where environment = v_environment and kind = v_kind;

  if v_before is not null then
    perform app_private.log_audit(
      v_actor,
      'FANBUS_PUBLISHING_TEMPLATE_RESET',
      'fanbus_publishing_template',
      v_kind,
      jsonb_build_object('versionId',v_before),
      jsonb_build_object('versionId',null)
    );
  end if;

  return jsonb_build_object('kind',v_kind,'source','SERVER_DEFAULT','changed',v_before is not null);
end;
$function$;

create function public.pd_m340_fanbus_publishing_template_resolve(p_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_environment text := app_private.platform_release_environment();
  v_version app_modules.fanbus_publishing_template_versions%rowtype;
begin
  if p_version_id is null or v_environment is null then
    raise exception 'M340_TEMPLATE_RESOLVE_INVALID' using errcode='22023';
  end if;

  select version.* into strict v_version
  from app_modules.fanbus_publishing_template_versions as version
  where version.id = p_version_id
    and version.environment = v_environment;

  if not exists (
    select 1 from storage.objects as object
    where object.bucket_id = 'm340-publishing-templates'
      and object.name = v_version.object_name
  ) then
    raise exception 'M340_TEMPLATE_OBJECT_MISSING' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'environment',v_version.environment,
    'kind',v_version.kind,
    'versionId',v_version.id,
    'objectName',v_version.object_name,
    'filename',v_version.original_filename,
    'sha256',v_version.sha256,
    'bytes',v_version.bytes
  );
exception when no_data_found then
  raise exception 'M340_TEMPLATE_VERSION_MISSING' using errcode='P0002';
end;
$function$;

-- Snapshot v2: freeze current output settings and exact template versions when enqueueing.
create or replace function app_private.api_fanbus_publishing_job_enqueue_before_auto_place_resolution(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_environment text := app_private.platform_release_environment();
  v_trip_id uuid;
  v_event_id uuid;
  v_place_id uuid;
  v_place_slug text;
  v_place_display_name text;
  v_trip_projection jsonb;
  v_boarding_stops jsonb;
  v_snapshot jsonb;
  v_job app_modules.fanbus_publishing_jobs%rowtype;
  v_inserted boolean := false;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or not p_payload ? 'tripId'
     or p_payload - array['tripId']::text[] <> '{}'::jsonb
     or pg_catalog.jsonb_typeof(p_payload -> 'tripId') <> 'string' then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD' using errcode='22023';
  end if;

  begin
    v_trip_id := nullif(pg_catalog.btrim(p_payload ->> 'tripId'),'')::uuid;
  exception when others then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD' using errcode='22023';
  end;

  if v_trip_id is null or v_environment is null then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD' using errcode='22023';
  end if;

  select trip.event_id,binding.place_id,place.slug,place.display_name
  into v_event_id,v_place_id,v_place_slug,v_place_display_name
  from app_modules.fanbus_trips as trip
  join app_modules.fanbus_publishing_event_places as binding on binding.event_id=trip.event_id
  join app_modules.fanbus_publishing_places as place on place.id=binding.place_id and place.is_active
  where trip.id=v_trip_id and trip.status='PUBLISHED';
  if not found then
    raise exception 'M340_PUBLISHING_TRIP_NOT_ELIGIBLE' using errcode='P0002';
  end if;

  select item.value into v_trip_projection
  from pg_catalog.jsonb_array_elements(coalesce(public.pd_public_fanbus_trips()->'trips','[]'::jsonb)) as item(value)
  where item.value->>'tripId'=v_trip_id::text and item.value->>'tripStatus'='PUBLISHED'
  limit 1;
  if v_trip_projection is null then
    raise exception 'M340_PUBLISHING_TRIP_NOT_PUBLIC' using errcode='P0002';
  end if;

  v_boarding_stops:=coalesce(public.pd_public_fanbus_trip_boarding_stops(v_trip_id)->'stops','[]'::jsonb);
  if pg_catalog.jsonb_typeof(v_boarding_stops)<>'array' then
    raise exception 'M340_PUBLISHING_STOPS_INVALID' using errcode='22023';
  end if;

  v_snapshot:=jsonb_build_object(
    'schemaVersion',2,
    'shortlinkPath','/ontour/'||v_place_slug,
    'place',jsonb_build_object('id',v_place_id,'slug',v_place_slug,'displayName',v_place_display_name),
    'trip',v_trip_projection,
    'boardingStops',v_boarding_stops,
    'publishing',jsonb_build_object(
      'settings',app_private.m340_fanbus_publishing_output_settings_current(),
      'templates',app_private.m340_fanbus_publishing_template_snapshot()
    )
  );

  insert into app_modules.fanbus_publishing_jobs(environment,trip_id,event_id,place_id,request_snapshot,created_by,updated_by)
  values(v_environment,v_trip_id,v_event_id,v_place_id,v_snapshot,v_actor,v_actor)
  on conflict(environment,trip_id) where status in ('QUEUED','PROCESSING') do nothing
  returning * into v_job;

  if found then
    v_inserted:=true;
  else
    select job.* into v_job
    from app_modules.fanbus_publishing_jobs as job
    where job.environment=v_environment and job.trip_id=v_trip_id and job.status in ('QUEUED','PROCESSING')
    order by job.created_at,job.id limit 1;
  end if;
  if v_job.id is null then
    raise exception 'M340_PUBLISHING_ENQUEUE_CONFLICT' using errcode='40001';
  end if;

  if v_inserted then
    perform app_private.log_audit(
      v_actor,'FANBUS_PUBLISHING_JOB_ENQUEUED','fanbus_publishing_job',v_job.id::text,null,
      jsonb_build_object('id',v_job.id,'environment',v_job.environment,'tripId',v_job.trip_id,'eventId',v_job.event_id,'placeId',v_job.place_id,'jobType',v_job.job_type,'status',v_job.status)
    );
  end if;

  return jsonb_build_object(
    'job',jsonb_build_object(
      'id',v_job.id,'environment',v_job.environment,'tripId',v_job.trip_id,'eventId',v_job.event_id,
      'placeId',v_job.place_id,'jobType',v_job.job_type,'status',v_job.status,
      'attemptCount',v_job.attempt_count,'createdAt',v_job.created_at
    ),
    'idempotent',not v_inserted
  );
end;
$function$;

-- Preserve the latest click-stat overview and add settings/template status additively.
alter function app_private.api_fanbus_publishing_overview(jsonb)
  rename to api_fanbus_publishing_overview_before_m340_settings_templates_r1;

create function app_private.api_fanbus_publishing_overview(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_base jsonb;
begin
  v_base := app_private.api_fanbus_publishing_overview_before_m340_settings_templates_r1(p_payload);
  return v_base || jsonb_build_object(
    'settings',app_private.m340_fanbus_publishing_output_settings_current(),
    'templates',app_private.m340_fanbus_publishing_template_overview()
  );
end;
$function$;

alter function app_private.pd_api_dispatch_current(text,jsonb)
  rename to pd_api_dispatch_current_before_m340_settings_templates_r1;

create function app_private.pd_api_dispatch_current(p_action text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action,'')));
begin
  case v_action
    when 'fanbus_publishing_output_settings_update' then
      return app_private.api_fanbus_publishing_output_settings_update(coalesce(p_payload,'{}'::jsonb));
    when 'fanbus_publishing_template_reset' then
      return app_private.api_fanbus_publishing_template_reset(coalesce(p_payload,'{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_m340_settings_templates_r1(p_action,p_payload);
  end case;
end;
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_m340_settings_templates_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action,'')))
    when 'fanbus_publishing_output_settings_update' then 'USER_MUTATION'
    when 'fanbus_publishing_template_reset' then 'USER_MUTATION'
    when 'fanbus_publishing_template_upload_authorize' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_m340_settings_templates_r1(p_action)
  end;
$function$;

revoke all on function
  app_private.m340_fanbus_publishing_output_settings_current(),
  app_private.m340_fanbus_publishing_template_snapshot(),
  app_private.m340_fanbus_publishing_template_overview(),
  app_private.api_fanbus_publishing_output_settings_update(jsonb),
  app_private.api_fanbus_publishing_template_reset(jsonb),
  app_private.api_fanbus_publishing_overview_before_m340_settings_templates_r1(jsonb),
  app_private.api_fanbus_publishing_overview(jsonb),
  app_private.pd_api_dispatch_current_before_m340_settings_templates_r1(text,jsonb),
  app_private.pd_api_dispatch_current(text,jsonb),
  app_private.platform_action_classification_before_m340_settings_templates_r1(text),
  app_private.platform_action_classification(text)
from public,anon,authenticated,service_role;

revoke all on function public.pd_m340_fanbus_publishing_template_resolve(uuid)
  from public,anon,authenticated;
grant execute on function public.pd_m340_fanbus_publishing_template_resolve(uuid)
  to service_role;
