-- DEV-only immutable Liveticker overlay v3.
-- Requires the matching graphics-core/renderer from social-media-generator PR #34.
-- Do not apply before the DEV render worker and preview share this implementation.
begin;
set local lock_timeout = '8s';

do $publish$
declare
  v_env text := app_private.platform_release_environment();
  v_patches jsonb := $patches$
  {
    "LIVETICKER_POST": {
      "lt-post-headline-shadow": {"style": {"opacity": 0.24}},
      "lt-post-headline": {"style": {"textEffect": "ice-glow"}},
      "lt-post-status": {"style": {"textEffect": "frost-metal"}},
      "lt-post-score": {"style": {"strokeWidth": 0}},
      "lt-post-goals-shadow": {"style": {"classicOverlayRole": "goal-shadow"}},
      "lt-post-goals-heading": {"style": {
        "classicOverlayRole": "goal-heading",
        "fill": "#f8fdff", "stroke": "#168bdf", "strokeWidth": 8
      }},
      "lt-post-goals": {
        "style": {
          "classicOverlayRole": "goal-lines",
          "fontSize": 42, "lineHeight": 58, "strokeWidth": 2
        },
        "binding": {"goalScorerFormat": "classic"}
      },
      "lt-post-footer": {
        "x": 250, "y": 1020, "width": 580, "height": 60,
        "style": {
          "fontSize": 34, "strokeWidth": 2.8, "letterSpacing": 3.3
        }
      },
      "lt-post-footer-line-l": {"width": 200},
      "lt-post-footer-line-r": {"x": 842, "width": 200}
    },
    "LIVETICKER_STORY": {
      "lt-story-headline-shadow": {"style": {"opacity": 0.24}},
      "lt-story-headline": {"style": {"textEffect": "ice-glow"}},
      "lt-story-status": {"style": {"textEffect": "frost-metal"}},
      "lt-story-score": {"style": {"strokeWidth": 0, "fontSize": 198}},
      "lt-story-goals-shadow": {
        "style": {"classicOverlayRole": "goal-shadow", "textAlign": "center"}
      },
      "lt-story-goals-heading": {
        "style": {
          "classicOverlayRole": "goal-heading",
          "textAlign": "center", "fill": "#f8fdff", 
          "stroke": "#168bdf", "strokeWidth": 10
        }
      },
      "lt-story-goals": {
        "style": {
          "classicOverlayRole": "goal-lines", "blockAlign": "center",
          "fontSize": 52, "lineHeight": 69, "strokeWidth": 2
        },
        "binding": {"goalScorerFormat": "classic"}
      },
      "lt-story-footer": {
        "x": 200, "y": 1766, "width": 680, "height": 65,
        "style": {
          "fontSize": 42, "strokeWidth": 2.8, "letterSpacing": 4.2
        }
      },
      "lt-story-footer-line-l": {"y": 1805, "width": 150},
      "lt-story-footer-line-r": {"x": 894, "y": 1805, "width": 150}
    }
  }
  $patches$::jsonb;
  r record;
  v_base uuid;
  v_target uuid;
  v_format jsonb;
  v_document jsonb;
  v_built jsonb;
  v_element jsonb;
  v_patch jsonb;
  v_seen integer;
  v_count integer := 0;
begin
  -- The migration belongs to the DEV migration source, but publication is
  -- explicitly restricted to the DEV database, never PROD.
  if v_env = 'PROD' then
    raise exception 'LIVETICKER_CLASSIC_V3_DEV_ONLY' using errcode = '55000';
  end if;
  if v_env is distinct from 'DEV' then
    return;
  end if;

  for r in
    select id, system_key, current_published_version_id
    from app_social_media.templates
    where system_key in ('LIVETICKER_POST', 'LIVETICKER_STORY')
    order by system_key
    for update
  loop
    v_count := v_count + 1;
    if r.system_key = 'LIVETICKER_POST' then
      v_base := '20000000-0000-4000-8000-000000000011';
      v_target := '20000000-0000-4000-8000-000000000021';
      v_format := '{"width":1080,"height":1080}'::jsonb;
    else
      v_base := '20000000-0000-4000-8000-000000000012';
      v_target := '20000000-0000-4000-8000-000000000022';
      v_format := '{"width":1080,"height":1920}'::jsonb;
    end if;

    if r.current_published_version_id = v_target then
      continue;
    end if;
    if r.current_published_version_id is distinct from v_base then
      raise exception 'LIVETICKER_V3_SOURCE_CHANGED' using errcode = '55000';
    end if;
    select document into strict v_document
    from app_social_media.template_versions
    where id = v_base and template_id = r.id
      and status = 'PUBLISHED' and version_number = 2;
    if v_document->'format' <> v_format
      or jsonb_array_length(v_document->'elements') <> 18 then
      raise exception 'LIVETICKER_V3_SOURCE_INVALID' using errcode = '55000';
    end if;

    v_built := '[]'::jsonb;
    v_seen := 0;
    for v_element in
      select value from jsonb_array_elements(v_document->'elements')
    loop
      v_patch := v_patches->r.system_key->(v_element->>'id');
      if v_patch is not null then
        v_seen := v_seen + 1;
        -- Geometry fields are immutable in v2, but v3 can recompose
        -- the footer without touching the source template.
        v_element := v_element || (v_patch - 'style' - 'binding');
        if v_patch ? 'style' then
          v_element := jsonb_set(
            v_element, '{style}',
            coalesce(v_element->'style','{}'::jsonb) || v_patch->'style',
            true
          );
        end if;
        if v_patch ? 'binding' then
          v_element := jsonb_set(
            v_element, '{binding}',
            coalesce(v_element->'binding','{}'::jsonb) || v_patch->'binding',
            true
          );
        end if;
      end if;
      v_built := v_built || jsonb_build_array(v_element);
    end loop;
    if v_seen <> (select count(*) from jsonb_object_keys(v_patches->r.system_key)) then
      raise exception 'LIVETICKER_V3_ELEMENT_MISSING' using errcode = '55000';
    end if;
    v_document := jsonb_set(v_document, '{elements}', v_built);
    perform app_private.social_media_generator_validate_system_template_document(
      r.system_key, v_document
    );

    insert into app_social_media.template_versions
      (id, template_id, version_number, revision, status, document,
       document_schema_version, change_note, created_by, created_at,
       updated_at, published_by, published_at)
    values
      (v_target, r.id, 3, 1, 'PUBLISHED', v_document, 1,
       'DEV: original ice/metal overlay, classic scorer formatting and responsive scorer block',
       null, statement_timestamp(), statement_timestamp(),
       null, statement_timestamp());

    update app_social_media.templates
    set current_published_version_id = v_target,
        updated_at = statement_timestamp()
    where id = r.id and current_published_version_id = v_base;
    if not found then
      raise exception 'LIVETICKER_V3_PUBLISH_CONFLICT' using errcode = '55000';
    end if;

    perform app_private.log_audit(
      null, 'LIVETICKER_DEV_OVERLAY_V3_PUBLISHED',
      'social_media_template', r.system_key,
      jsonb_build_object('version',v_base,'canvas',v_format),
      jsonb_build_object('version',v_target,'canvas',v_format),
      jsonb_build_object('scope','DEV','historicalJobsChanged',false)
    );
  end loop;
  if v_count <> 2 then
    raise exception 'LIVETICKER_V3_TEMPLATES_INCOMPLETE' using errcode = '55000';
  end if;
end;
$publish$;
commit;
