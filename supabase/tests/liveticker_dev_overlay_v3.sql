\set ON_ERROR_STOP on
begin;
select plan(1);
do $check$
declare
  v_env text := app_private.platform_release_environment();
  v_key text;
  v_id uuid;
  v_original uuid;
  v_format jsonb;
  v_document jsonb;
  v_previous jsonb;
  v_headline text;
  v_status text;
  v_scorers text;
begin
  for v_key, v_id, v_original, v_format in
    select *
    from (values
      ('LIVETICKER_POST'::text,
        '20000000-0000-4000-8000-000000000021'::uuid,
        '20000000-0000-4000-8000-000000000011'::uuid,
        '{"width":1080,"height":1080}'::jsonb),
      ('LIVETICKER_STORY'::text,
        '20000000-0000-4000-8000-000000000022'::uuid,
        '20000000-0000-4000-8000-000000000012'::uuid,
        '{"width":1080,"height":1920}'::jsonb)
    ) as expected(system_key, version_id, prior_id, canvas)
  loop
    if v_env='DEV' then
      select v.document into strict v_document
      from app_social_media.templates t
      join app_social_media.template_versions v
        on v.id=t.current_published_version_id
      where t.system_key=v_key and v.id=v_id and v.version_number=3
        and v.status='PUBLISHED';
      select document into strict v_previous
      from app_social_media.template_versions where id=v_original;
      if v_document->'format' is distinct from v_format
        or v_document->'elements'->0 is distinct from v_previous->'elements'->0
        or jsonb_array_length(v_document->'elements')<>18 then
        raise exception 'CLASSIC_V3_CANVAS_OR_BACKGROUND_CHANGED';
      end if;
      select e#>>'{style,textEffect}' into v_headline
      from jsonb_array_elements(v_document->'elements') as e
      where e->>'id'=case when v_key='LIVETICKER_POST'
        then 'lt-post-headline' else 'lt-story-headline' end;
      select e#>>'{style,textEffect}' into v_status
      from jsonb_array_elements(v_document->'elements') as e
      where e->>'id'=case when v_key='LIVETICKER_POST'
        then 'lt-post-status' else 'lt-story-status' end;
      select e#>>'{binding,goalScorerFormat}' into v_scorers
      from jsonb_array_elements(v_document->'elements') as e
      where e->>'id'=case when v_key='LIVETICKER_POST'
        then 'lt-post-goals' else 'lt-story-goals' end;
      if v_headline is distinct from 'ice-glow'
        or v_status is distinct from 'frost-metal'
        or v_scorers is distinct from 'classic'
        or (select count(*) from jsonb_array_elements(v_document->'elements') as e
            where e#>>'{binding,protected}'='true')<>13 then
        raise exception 'CLASSIC_V3_EFFECT_OR_BINDING_INVALID';
      end if;
    else
      if exists (
        select 1 from app_social_media.templates
        where system_key=v_key and current_published_version_id=v_id
      ) then
        raise exception 'CLASSIC_V3_PUBLISHED_OUTSIDE_DEV';
      end if;
    end if;
  end loop;
end;
$check$;
select pass('Classic DEV v3 keeps the original canvas, imagery, protected data and opt-in effects');
select * from finish();
rollback;
