\set ON_ERROR_STOP on
begin;
select plan(1);
do $check$
declare
  v_env text := app_private.platform_release_environment();
  v_post jsonb;
  v_story jsonb;
  v_post_original jsonb;
  v_story_original jsonb;
  v_post_expected uuid := '20000000-0000-4000-8000-000000000011';
  v_story_expected uuid := '20000000-0000-4000-8000-000000000012';
begin
  select v.document into strict v_post
    from app_social_media.templates t
    join app_social_media.template_versions v on v.id=t.current_published_version_id
    where t.system_key='LIVETICKER_POST';
  select v.document into strict v_story
    from app_social_media.templates t
    join app_social_media.template_versions v on v.id=t.current_published_version_id
    where t.system_key='LIVETICKER_STORY';
  select document into strict v_post_original
    from app_social_media.template_versions where id='20000000-0000-4000-8000-000000000001';
  select document into strict v_story_original
    from app_social_media.template_versions where id='20000000-0000-4000-8000-000000000002';

  if v_post->'format'<>'{"width":1080,"height":1080}'::jsonb
     or v_story->'format'<>'{"width":1080,"height":1920}'::jsonb then
    raise exception 'DEV Liveticker canvases changed';
  end if;

  if v_env='DEV' then
    if not exists (
      select 1 from app_social_media.templates
      where system_key='LIVETICKER_POST' and current_published_version_id=v_post_expected
    ) or not exists (
      select 1 from app_social_media.templates
      where system_key='LIVETICKER_STORY' and current_published_version_id=v_story_expected
    ) then
      raise exception 'DEV overlay v2 not published for both formats';
    end if;
    if v_post->'elements'->0 <> v_post_original->'elements'->0
       or v_story->'elements'->0 <> v_story_original->'elements'->0 then
      raise exception 'Original DEV background altered';
    end if;
    if not exists (
      select 1 from jsonb_array_elements(v_post->'elements') e
      where e->>'id'='lt-post-goals' and e->>'y'='554'
        and e#>>'{style,fontSize}'='34'
    ) or not exists (
      select 1 from jsonb_array_elements(v_story->'elements') e
      where e->>'id'='lt-story-goals' and e->>'y'='1025'
        and e#>>'{style,fontSize}'='46'
    ) then
      raise exception 'PROD-overlay scorer layout not adopted';
    end if;
    if (select count(*) from jsonb_array_elements(v_post->'elements') e
         where e#>>'{binding,protected}'='true')<>13
      or (select count(*) from jsonb_array_elements(v_story->'elements') e
         where e#>>'{binding,protected}'='true')<>13 then
      raise exception 'Protected Liveticker bindings changed';
    end if;
  else
    if exists (
      select 1 from app_social_media.templates
      where system_key='LIVETICKER_POST' and current_published_version_id=v_post_expected
         or system_key='LIVETICKER_STORY' and current_published_version_id=v_story_expected
    ) then
      raise exception 'Non-DEV environment inherited DEV overlay publication';
    end if;
  end if;
end;
$check$;
select pass('DEV-only classic-overlay template versions preserve 1080 formats, imagery and bindings');
select * from finish();
rollback;
