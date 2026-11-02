-- DEV-only opt-in to complete legacy SVG compositing; historical V1-V3 immutable.
-- Requires social-media-generator PR #35 deployed on Acer DEV before publication.
begin;
set local lock_timeout = '8s';

do $v4$
declare
  v_environment text := app_private.platform_release_environment();
  r record;
  v_old uuid;
  v_new uuid;
  v_canvas jsonb;
  v_doc jsonb;
  v_elements jsonb;
  v_count integer := 0;
  v_patches jsonb := '{
    "LIVETICKER_POST": {
      "lt-post-headline": "ice-depth-glow",
      "lt-post-status": "metal-depth",
      "lt-post-goals-heading": "sticker-gloss"
    },
    "LIVETICKER_STORY": {
      "lt-story-headline": "ice-depth-glow",
      "lt-story-status": "metal-depth",
      "lt-story-goals-heading": "sticker-gloss"
    }
  }'::jsonb;
begin
  if v_environment = 'PROD' then
    raise exception 'LIVETICKER_FULL_LEGACY_V4_DEV_ONLY' using errcode = '55000';
  end if;
  -- Local CI databases have no release environment and should only check
  -- migration parsing/contracts, never publish release templates.
  if v_environment is distinct from 'DEV' then
    return;
  end if;
  for r in
    select id,system_key,current_published_version_id
    from app_social_media.templates
    where system_key in ('LIVETICKER_POST','LIVETICKER_STORY')
    order by system_key
    for update
  loop
    v_count := v_count + 1;
    if r.system_key='LIVETICKER_POST' then
      v_old := '20000000-0000-4000-8000-000000000021';
      v_new := '20000000-0000-4000-8000-000000000031';
      v_canvas := '{"width":1080,"height":1080}'::jsonb;
    else
      v_old := '20000000-0000-4000-8000-000000000022';
      v_new := '20000000-0000-4000-8000-000000000032';
      v_canvas := '{"width":1080,"height":1920}'::jsonb;
    end if;
    if r.current_published_version_id=v_new then
      continue;
    end if;
    if r.current_published_version_id is distinct from v_old then
      raise exception 'LIVETICKER_V4_SOURCE_VERSION_CHANGED' using errcode = '55000';
    end if;
    select document into strict v_doc
    from app_social_media.template_versions
    where id=v_old and template_id=r.id and status='PUBLISHED'
      and version_number=3;
    if v_doc->'format'<>v_canvas
      or jsonb_array_length(v_doc->'elements')<>18
      or (select count(*) from jsonb_array_elements(v_doc->'elements') e
          where e#>>'{binding,protected}'='true')<>13 then
      raise exception 'LIVETICKER_V4_SOURCE_INVALID' using errcode = '55000';
    end if;
    -- Change only the three presentation selectors. All other document
    -- coordinates, font fallbacks, logo refs and protected bindings survive.
    select jsonb_agg(
      case when (v_patches->r.system_key) ? (e.value->>'id') then
        jsonb_set(e.value,'{style,textEffect}',
          v_patches->r.system_key->(e.value->>'id'),true)
      else e.value end
      order by e.ordinality
    ) into v_elements
    from jsonb_array_elements(v_doc->'elements') with ordinality e(value,ordinality);
    if (select count(*) from jsonb_array_elements(v_elements) e
      where e#>>'{style,textEffect}' in ('ice-depth-glow','metal-depth','sticker-gloss'))<>3 then
      raise exception 'LIVETICKER_V4_EFFECT_PATCH_INCOMPLETE' using errcode = '55000';
    end if;
    v_doc := jsonb_set(v_doc,'{elements}',v_elements);
    perform app_private.social_media_generator_validate_system_template_document(
      r.system_key,v_doc);
    insert into app_social_media.template_versions
      (id,template_id,version_number,revision,status,document,
        document_schema_version,change_note,created_by,created_at,
        updated_at,published_by,published_at)
    values
      (v_new,r.id,4,1,'PUBLISHED',v_doc,1,
      'DEV full legacy SVG layers: ice depth/glow/highlight, metal shadow/sheen, scorer sticker shadow/gloss',
      null,statement_timestamp(),statement_timestamp(),null,statement_timestamp());
    update app_social_media.templates
    set current_published_version_id=v_new,updated_at=statement_timestamp()
    where id=r.id and current_published_version_id=v_old;
    if not found then
      raise exception 'LIVETICKER_V4_PUBLISH_CONFLICT' using errcode='55000';
    end if;
    perform app_private.log_audit(
      null,'LIVETICKER_DEV_LEGACY_EFFECTS_V4_PUBLISHED',
      'social_media_template',r.system_key,
      jsonb_build_object('version',v_old,'canvas',v_canvas),
      jsonb_build_object('version',v_new,'canvas',v_canvas),
      jsonb_build_object('scope','DEV','historicalJobsChanged',false));
  end loop;
  if v_count<>2 then
    raise exception 'LIVETICKER_V4_TEMPLATES_INCOMPLETE' using errcode='55000';
  end if;
end;
$v4$;
commit;
