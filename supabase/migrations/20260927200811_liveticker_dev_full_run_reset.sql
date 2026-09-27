create or replace function app_private.api_liveticker_game_reset(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_event uuid := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'eventId', '')), '')::uuid;
  v_expected integer := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'expectedRevision', '')), '')::integer;
  v_state app_modules.liveticker_game_states%rowtype;
  v_new integer;
  v_pending_whatsapp bigint;
  v_pending_graphics bigint;
begin
  if app_private.platform_release_environment() is distinct from 'DEV' then
    raise exception 'Testspiel-Reset ist nur in DEV erlaubt.' using errcode = '55000';
  end if;

  if v_event is null then
    raise exception 'Spiel ist erforderlich.' using errcode = '22023';
  end if;

  select *
  into v_state
  from app_modules.liveticker_game_states
  where event_id = v_event
  for update;

  if not found then
    raise exception 'Spiel wurde nicht gefunden.' using errcode = 'P0002';
  end if;

  if v_expected is null or v_expected <> v_state.revision then
    raise exception 'Das Spiel wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode = '40001';
  end if;

  select pg_catalog.count(*)
  into v_pending_whatsapp
  from app_modules.liveticker_whatsapp_jobs
  where event_id = v_event
    and status in ('PENDING', 'PROCESSING');

  select pg_catalog.count(*)
  into v_pending_graphics
  from app_modules.liveticker_graphic_jobs
  where event_id = v_event
    and status in ('QUEUED', 'PROCESSING');

  if v_pending_whatsapp > 0 or v_pending_graphics > 0 then
    raise exception 'Testspiel kann erst zurückgesetzt werden, wenn laufende WhatsApp- und Grafikjobs beendet sind.'
      using errcode = '55000';
  end if;

  v_new := v_state.revision + 1;

  update app_modules.liveticker_actions
  set
    is_active = false,
    revision = revision + 1,
    updated_at = pg_catalog.now()
  where event_id = v_event
    and is_active;

  update app_modules.liveticker_game_states
  set
    revision = v_new,
    minute = 1,
    completed_at = null,
    updated_at = pg_catalog.now()
  where event_id = v_event;

  insert into app_modules.liveticker_journal(
    event_id,
    game_revision,
    mutation_type,
    payload,
    client_id
  )
  values (
    v_event,
    v_new,
    'GAME_RESET',
    pg_catalog.jsonb_build_object(
      'actor', v_actor,
      'previousRevision', v_state.revision,
      'previousMinute', v_state.minute,
      'previousCompletedAt', v_state.completed_at
    ),
    null
  );

  perform app_private.log_audit(
    v_actor,
    'LIVETICKER_GAME_RESET',
    'liveticker_game',
    v_event::text,
    pg_catalog.to_jsonb(v_state),
    (
      select pg_catalog.to_jsonb(s)
      from app_modules.liveticker_game_states as s
      where s.event_id = v_event
    ),
    '{}'::jsonb
  );

  return app_private.api_liveticker_archive_list();
end;
$function$;

create or replace function public.pd_public_liveticker_graphic_jobs(p_event_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_reset_at timestamptz;
begin
  perform app_private.liveticker_require_operator();
  perform app_private.liveticker_assert_supported_game(p_event_id);

  select pg_catalog.max(journal.created_at)
  into v_reset_at
  from app_modules.liveticker_journal as journal
  where journal.event_id = p_event_id
    and journal.mutation_type = 'GAME_RESET';

  return pg_catalog.jsonb_build_object(
    'jobs',
    coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'jobId', job.id,
          'kind', job.graphic_kind,
          'status', job.status,
          'sourceRevision', job.source_revision,
          'attemptCount', job.attempt_count,
          'createdAt', job.created_at,
          'completedAt', job.completed_at,
          'errorCode', job.last_error_code,
          'result', job.result_manifest
        )
        order by job.created_at desc
      )
      from (
        select *
        from app_modules.liveticker_graphic_jobs
        where event_id = p_event_id
          and (v_reset_at is null or created_at >= v_reset_at)
        order by created_at desc
        limit 30
      ) as job
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function app_private.api_liveticker_whatsapp_deliveries_list(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_event_id uuid;
  v_reset_at timestamptz;
begin
  perform app_private.liveticker_require_operator();

  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['eventId']::text[] <> '{}'::jsonb
     or not (p_payload ? 'eventId')
     or pg_catalog.jsonb_typeof(p_payload -> 'eventId') <> 'string'
     or (p_payload ->> 'eventId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'LIVETICKER_WHATSAPP_DELIVERIES_LIST_INVALID' using errcode = '22023';
  end if;

  v_event_id := (p_payload ->> 'eventId')::uuid;
  perform app_private.liveticker_assert_supported_game(v_event_id);

  select pg_catalog.max(journal.created_at)
  into v_reset_at
  from app_modules.liveticker_journal as journal
  where journal.event_id = v_event_id
    and journal.mutation_type = 'GAME_RESET';

  return pg_catalog.jsonb_build_object(
    'deliveries',
    coalesce((
      select pg_catalog.jsonb_agg(job.payload order by job.created_at desc, job.id desc)
      from (
        select
          delivery.id,
          delivery.created_at,
          app_private.liveticker_whatsapp_delivery_json(delivery) as payload
        from app_modules.liveticker_whatsapp_jobs as delivery
        where delivery.event_id = v_event_id
          and (v_reset_at is null or delivery.created_at >= v_reset_at)
        order by delivery.created_at desc, delivery.id desc
        limit 100
      ) as job
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function app_private.api_liveticker_game_reset(jsonb)
from public, anon, authenticated, service_role;

revoke all on function app_private.api_liveticker_whatsapp_deliveries_list(jsonb)
from public, anon, authenticated, service_role;
