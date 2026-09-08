-- M340 DEV: Social-Media-Generator settings are frozen per enqueue.
-- Backward compatible: legacy enqueue payload {tripId} remains valid.

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
  v_settings jsonb;
  v_generator_payload boolean := false;
  v_label_enabled boolean := false;
  v_label_text text := '';
  v_job app_modules.fanbus_publishing_jobs%rowtype;
  v_inserted boolean := false;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD' using errcode='22023';
  end if;

  v_generator_payload := p_payload ? 'tripLabelEnabled' or p_payload ? 'tripLabelText';

  if not p_payload ? 'tripId'
     or pg_catalog.jsonb_typeof(p_payload -> 'tripId') <> 'string'
     or (
       not v_generator_payload
       and p_payload - array['tripId']::text[] <> '{}'::jsonb
     )
     or (
       v_generator_payload
       and (
         p_payload - array['tripId','tripLabelEnabled','tripLabelText']::text[] <> '{}'::jsonb
         or not p_payload ? 'tripLabelEnabled'
         or not p_payload ? 'tripLabelText'
         or pg_catalog.jsonb_typeof(p_payload -> 'tripLabelEnabled') <> 'boolean'
         or pg_catalog.jsonb_typeof(p_payload -> 'tripLabelText') <> 'string'
       )
     ) then
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

  if v_generator_payload then
    v_label_enabled := (p_payload ->> 'tripLabelEnabled')::boolean;
    v_label_text := pg_catalog.regexp_replace(pg_catalog.btrim(p_payload ->> 'tripLabelText'), '[[:space:]]+', ' ', 'g');
    if char_length(v_label_text) > 32
       or v_label_text ~ '[[:cntrl:]]'
       or (v_label_enabled and char_length(v_label_text) < 1) then
      raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD' using errcode='22023';
    end if;
    if not v_label_enabled then
      v_label_text := '';
    end if;
    v_settings := jsonb_build_object(
      'tripLabel', jsonb_build_object('enabled', v_label_enabled, 'text', v_label_text)
    );
  else
    v_settings := app_private.m340_fanbus_publishing_output_settings_current();
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
      'settings',v_settings,
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

create or replace function app_private.api_fanbus_publishing_job_enqueue(p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.require_capability('fanbus.publishing.manage');
  v_trip_id uuid;
  v_event_id uuid;
  v_resolution jsonb;
  v_generator_payload boolean := false;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD' using errcode='22023';
  end if;

  v_generator_payload := p_payload ? 'tripLabelEnabled' or p_payload ? 'tripLabelText';
  if not p_payload ? 'tripId'
     or pg_catalog.jsonb_typeof(p_payload -> 'tripId') <> 'string'
     or (
       not v_generator_payload
       and p_payload - array['tripId']::text[] <> '{}'::jsonb
     )
     or (
       v_generator_payload
       and (
         p_payload - array['tripId','tripLabelEnabled','tripLabelText']::text[] <> '{}'::jsonb
         or not p_payload ? 'tripLabelEnabled'
         or not p_payload ? 'tripLabelText'
         or pg_catalog.jsonb_typeof(p_payload -> 'tripLabelEnabled') <> 'boolean'
         or pg_catalog.jsonb_typeof(p_payload -> 'tripLabelText') <> 'string'
       )
     ) then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD' using errcode='22023';
  end if;

  begin
    v_trip_id := nullif(pg_catalog.btrim(p_payload ->> 'tripId'),'')::uuid;
  exception when others then
    raise exception 'M340_PUBLISHING_JOB_INVALID_PAYLOAD' using errcode='22023';
  end;

  select trip.event_id into v_event_id
  from app_modules.fanbus_trips as trip
  where trip.id=v_trip_id and trip.status='PUBLISHED';
  if not found then
    raise exception 'M340_PUBLISHING_TRIP_NOT_ELIGIBLE' using errcode='P0002';
  end if;

  v_resolution := app_private.fanbus_publishing_ensure_event_place(v_event_id,v_actor);
  case v_resolution ->> 'status'
    when 'AMBIGUOUS' then raise exception 'M340_PUBLISHING_PLACE_AMBIGUOUS' using errcode='55000';
    when 'MISSING_VENUE' then raise exception 'M340_PUBLISHING_VENUE_MISSING' using errcode='22023';
    when 'RESOLVED' then null;
    else raise exception 'M340_PUBLISHING_PLACE_UNRESOLVED' using errcode='55000';
  end case;

  return app_private.api_fanbus_publishing_job_enqueue_before_auto_place_resolution(p_payload);
end;
$function$;

revoke all on function
  app_private.api_fanbus_publishing_job_enqueue_before_auto_place_resolution(jsonb),
  app_private.api_fanbus_publishing_job_enqueue(jsonb)
from public, anon, authenticated, service_role;
