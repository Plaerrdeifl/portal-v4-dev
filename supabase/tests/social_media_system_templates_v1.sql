\set ON_ERROR_STOP on

begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

select is(
  (
    select count(*)::integer
    from app_social_media.templates
    where system_key in (
      'LIVETICKER_POST',
      'LIVETICKER_STORY',
      'FANBUS_POST',
      'FANBUS_STORY'
    )
  ),
  4,
  'All four generator system templates are seeded'
);

select is(
  (
    select count(*)::integer
    from app_social_media.templates as template
    join app_social_media.template_versions as version
      on version.id = template.current_published_version_id
     and version.template_id = template.id
    where template.system_key is not null
      and template.is_active
      and version.status = 'PUBLISHED'
  ),
  4,
  'Every active system template has a concrete published version'
);

select is(
  (
    select version.document #>> '{format,width}'
    from app_social_media.templates as template
    join app_social_media.template_versions as version
      on version.id = template.current_published_version_id
    where template.system_key = 'LIVETICKER_POST'
  ),
  '1080',
  'Liveticker POST keeps the 1080 pixel width'
);

select is(
  (
    select version.document #>> '{format,height}'
    from app_social_media.templates as template
    join app_social_media.template_versions as version
      on version.id = template.current_published_version_id
    where template.system_key = 'FANBUS_POST'
  ),
  '1350',
  'Fanbus POST keeps the current 4:5 format'
);

select ok(
  exists (
    select 1
    from app_social_media.templates as template
    join app_social_media.template_versions as version
      on version.id = template.current_published_version_id
    cross join lateral jsonb_array_elements(version.document -> 'elements') as element(value)
    where template.system_key = 'LIVETICKER_POST'
      and element.value #>> '{binding,key}' = 'liveticker.goalScorers'
      and element.value #>> '{binding,renderer}' = 'liveticker-goal-scorers'
      and (element.value #>> '{binding,protected}')::boolean
  ),
  'Liveticker scorer list is one protected dynamic template element'
);

select ok(
  exists (
    select 1
    from app_social_media.templates as template
    join app_social_media.template_versions as version
      on version.id = template.current_published_version_id
    cross join lateral jsonb_array_elements(version.document -> 'elements') as element(value)
    where template.system_key = 'FANBUS_STORY'
      and element.value #>> '{binding,key}' = 'fanbus.boardingStops'
      and element.value #>> '{binding,renderer}' = 'fanbus-boarding-stops'
      and (element.value #>> '{binding,protected}')::boolean
  ),
  'Fanbus boarding stops stay one protected dynamic template element'
);

select lives_ok(
  $$
    select app_private.social_media_generator_system_template_version(
      'LIVETICKER_POST'
    )
  $$,
  'Published system template resolution succeeds'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.social_media_generator_system_template_version(text)',
    'EXECUTE'
  ),
  'Browser cannot resolve system template versions directly'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'app_private.api_social_media_generator_fanbus_draft_create(jsonb)',
    'EXECUTE'
  ),
  'Fanbus system draft action is only reachable through pd_api'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.pd_social_media_liveticker_render_worker_claim()',
    'EXECUTE'
  ),
  'Server worker can claim frozen Liveticker template versions'
);

select * from finish();
rollback;
