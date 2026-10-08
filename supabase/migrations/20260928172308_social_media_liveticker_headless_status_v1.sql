begin;

create function app_private.api_social_media_generator_liveticker_render_status(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_event_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'eventId', '')),
    ''
  )::uuid;
  v_jobs jsonb;
begin
  if v_event_id is null then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_EVENT_ID_REQUIRED'
      using errcode = '22023';
  end if;

  perform app_private.liveticker_assert_supported_game(v_event_id);

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'jobId', request.id,
          'kind', request.graphic_kind,
          'status', request.status,
          'result', request.result_manifest,
          'errorCode', request.last_error_code,
          'sourceRevision', request.source_revision,
          'createdAt', request.created_at,
          'updatedAt', request.updated_at
        )
      )
      order by request.created_at desc, request.id desc
    ),
    '[]'::jsonb
  )
  into v_jobs
  from (
    select request.*
    from app_social_media.liveticker_render_requests as request
    where request.event_id = v_event_id
    order by request.created_at desc, request.id desc
    limit 30
  ) as request;

  perform v_actor;

  return pg_catalog.jsonb_build_object('jobs', v_jobs);
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_sm_liveticker_status_v1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_sm_liveticker_status_v1()
    || array[
      'social_media_generator_liveticker_render_status'
    ]::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_liveticker_status_v1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_liveticker_render_status' then 'READ'
    else app_private.platform_action_classification_before_sm_liveticker_status_v1(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_liveticker_status_v1;

create function app_private.pd_api_dispatch_current(
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_action, ''))
  );
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  case v_action
    when 'social_media_generator_liveticker_render_status' then
      return app_private.api_social_media_generator_liveticker_render_status(
        v_payload
      );
    else
      return app_private.pd_api_dispatch_current_before_sm_liveticker_status_v1(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.api_social_media_generator_liveticker_render_status(jsonb),
  app_private.pd_api_current_actions_before_sm_liveticker_status_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_liveticker_status_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_liveticker_status_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.api_social_media_generator_liveticker_render_status(jsonb),
  app_private.pd_api_current_actions_before_sm_liveticker_status_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_liveticker_status_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_liveticker_status_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

commit;
