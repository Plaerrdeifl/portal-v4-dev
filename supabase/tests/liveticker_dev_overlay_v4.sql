\set ON_ERROR_STOP on
begin;
select plan(1);
do $test$
declare
  v_env text := app_private.platform_release_environment();
  r record;
  v_current jsonb;
  v_previous jsonb;
  v_expected jsonb;
  v_actual jsonb;
  v_old uuid;
  v_new uuid;
  v_count integer := 0;
begin
  for r in select system_key,current_published_version_id from app_social_media.templates
    where system_key in ('LIVETICKER_POST','LIVETICKER_STORY') order by system_key
  loop
    v_count := v_count + 1;
    if r.system_key='LIVETICKER_POST' then
      v_old := '20000000-0000-4000-8000-000000000021';
      v_new := '20000000-0000-4000-8000-000000000031';
      v_expected := '{"width":1080,"height":1080}'::jsonb;
    else
      v_old := '20000000-0000-4000-8000-000000000022';
      v_new := '20000000-0000-4000-8000-000000000032';
      v_expected := '{"width":1080,"height":1920}'::jsonb;
    end if;
    if v_env='DEV' then
      if r.current_published_version_id is distinct from v_new then
        raise exception 'V4_NOT_PUBLISHED';
      end if;
      select document into strict v_current from app_social_media.template_versions
        where id=v_new and version_number=4 and status='PUBLISHED';
      select document into strict v_previous from app_social_media.template_versions
        where id=v_old and version_number=3 and status='PUBLISHED';
      if v_current->'format' is distinct from v_expected
        or jsonb_array_length(v_current->'elements')<>18
        or v_current->'elements'->0 is distinct from v_previous->'elements'->0
        or (select count(*) from jsonb_array_elements(v_current->'elements') e
            where e#>>'{binding,protected}'='true')<>13 then
        raise exception 'V4_DIMENSIONS_OR_BINDINGS_CHANGED';
      end if;
      select jsonb_object_agg(e->>'id',e#>>'{style,textEffect}')
      into v_actual from jsonb_array_elements(v_current->'elements') e
        where e#>>'{style,textEffect}' in ('ice-depth-glow','metal-depth','sticker-gloss');
      v_expected := jsonb_build_object(
        case when r.system_key='LIVETICKER_POST' then 'lt-post-headline' else 'lt-story-headline' end,'ice-depth-glow',
        case when r.system_key='LIVETICKER_POST' then 'lt-post-status' else 'lt-story-status' end,'metal-depth',
        case when r.system_key='LIVETICKER_POST' then 'lt-post-goals-heading' else 'lt-story-goals-heading' end,'sticker-gloss'
      );
      if v_actual is distinct from v_expected then
        raise exception 'V4_REQUIRED_EFFECTS_MISSING';
      end if;
      if exists (
        select 1 from jsonb_array_elements(v_current->'elements') with ordinality e(value,ordinality)
        join lateral (select old.value as original from jsonb_array_elements(v_previous->'elements') with ordinality old(value,ordinality)
          where old.ordinality=e.ordinality) prior on true
        where (e.value-'style') is distinct from (prior.original-'style')
          or ((e.value->'style')-'textEffect') is distinct from ((prior.original->'style')-'textEffect')
      ) then
        raise exception 'V4_CHANGED_NON_EFFECT_DATA';
      end if;
    else
      if r.current_published_version_id=v_new then
        raise exception 'V4_PUBLISHED_OUTSIDE_DEV';
      end if;
    end if;
  end loop;
  if v_count<>2 then raise exception 'V4_TEMPLATES_INCOMPLETE'; end if;
end;
$test$;
select pass('V4 changes only the three effect selectors and preserves both 1080 canvases and bindings');
select * from finish();
rollback;
