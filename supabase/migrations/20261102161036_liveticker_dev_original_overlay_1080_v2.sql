-- DEV-only Liveticker layout sync: preserve the published generator canvas,
-- inherit the established overlay geometry/type hierarchy from classic PROD.
-- No changes to PROD, render worker, files, or existing jobs.
begin;
set local lock_timeout = '8s';
do $v2$
declare
  v_env text := app_private.platform_release_environment();
  v_patches jsonb := '{"LIVETICKER_POST":{"lt-post-shade":{"style":{"opacity":0}},"lt-post-headline-shadow":{"y":53,"style":{"fontSize":79,"fill":"#043253","strokeWidth":8,"opacity":0.58}},"lt-post-headline":{"y":46,"style":{"fontSize":79,"fill":"#ccefff","stroke":"#dff4ff","strokeWidth":3.2}},"lt-post-status-shadow":{"y":155,"style":{"fill":"#24425a","strokeWidth":5}},"lt-post-status":{"y":148,"style":{"fill":"#c8d7e3","stroke":"#ecf7ff","strokeWidth":2.4}},"lt-post-away-logo":{"x":820},"lt-post-home-name":{"style":{"opacity":0}},"lt-post-away-name":{"style":{"opacity":0}},"lt-post-score":{"y":263,"style":{"fontSize":151}},"lt-post-suffix":{"x":770,"y":383,"width":210,"height":50,"style":{"fontSize":36,"textAlign":"right","stroke":"#000000"}},"lt-post-goals-shadow":{"x":85,"y":487,"width":900,"height":66,"style":{"fontSize":48,"opacity":0.38}},"lt-post-goals-heading":{"x":85,"y":480,"width":900,"height":66,"style":{"fontSize":48,"strokeWidth":8.4}},"lt-post-goals":{"x":79,"y":554,"width":922,"height":462,"style":{"fontSize":34,"lineHeight":47,"fontWeight":900,"strokeWidth":2.8}},"lt-post-footer":{"y":1038}},"LIVETICKER_STORY":{"lt-story-shade":{"style":{"opacity":0}},"lt-story-headline-shadow":{"y":175,"style":{"fontSize":105,"fill":"#043253","strokeWidth":9,"opacity":0.58}},"lt-story-headline":{"y":168,"style":{"fontSize":105,"fill":"#ccefff","stroke":"#dff4ff","strokeWidth":3.7}},"lt-story-status-shadow":{"y":358,"style":{"fontSize":84,"fill":"#24425a","strokeWidth":7}},"lt-story-status":{"y":350,"style":{"fontSize":84,"fill":"#c8d7e3","stroke":"#ecf7ff","strokeWidth":3.3}},"lt-story-home-logo":{"y":532},"lt-story-away-logo":{"y":532},"lt-story-home-name":{"style":{"opacity":0}},"lt-story-away-name":{"style":{"opacity":0}},"lt-story-score":{"y":543,"style":{"fontSize":188}},"lt-story-suffix":{"x":750,"y":764,"width":230,"height":65,"style":{"fontSize":45,"textAlign":"right","stroke":"#000000"}},"lt-story-goals-shadow":{"x":75,"y":926,"width":930,"height":85,"style":{"fontSize":67,"strokeWidth":15,"opacity":0.38}},"lt-story-goals-heading":{"x":75,"y":918,"width":930,"height":85,"style":{"fontSize":67,"strokeWidth":11.5}},"lt-story-goals":{"x":65,"y":1025,"width":950,"height":720,"style":{"fontSize":46,"lineHeight":62,"fontWeight":900,"strokeWidth":3.4}},"lt-story-footer":{"y":1835}}}'::jsonb;
  r record;
  d jsonb;
  el jsonb;
  delta jsonb;
  built jsonb;
  map jsonb;
  old_id uuid;
  new_id uuid;
  dim jsonb;
  n integer;
begin
  if v_env='PROD' then raise exception 'DEV_ONLY_OVERLAY' using errcode='55000'; end if;
  if v_env is distinct from 'DEV' then return; end if;
  for r in select id,system_key,current_published_version_id
    from app_social_media.templates
    where system_key in ('LIVETICKER_POST','LIVETICKER_STORY')
    order by system_key for update
  loop
    old_id:=case r.system_key when 'LIVETICKER_POST'
      then '20000000-0000-4000-8000-000000000001'::uuid
      else '20000000-0000-4000-8000-000000000002'::uuid end;
    new_id:=case r.system_key when 'LIVETICKER_POST'
      then '20000000-0000-4000-8000-000000000011'::uuid
      else '20000000-0000-4000-8000-000000000012'::uuid end;
    dim:=case r.system_key when 'LIVETICKER_POST'
      then '{"width":1080,"height":1080}'::jsonb
      else '{"width":1080,"height":1920}'::jsonb end;
    if r.current_published_version_id=new_id then continue; end if;
    if r.current_published_version_id is distinct from old_id then
      raise exception 'SOURCE_TEMPLATE_CHANGED' using errcode='55000'; end if;
    select document into strict d from app_social_media.template_versions
      where id=old_id and template_id=r.id and status='PUBLISHED' and version_number=1;
    if d->'format'<>dim or jsonb_array_length(d->'elements')<>18 then
      raise exception 'SOURCE_TEMPLATE_INVALID' using errcode='55000'; end if;
    built:='[]'::jsonb; map:=v_patches->r.system_key; n:=0;
    for el in select value from jsonb_array_elements(d->'elements') loop
      delta:=map->(el->>'id');
      if delta is not null then
        el:=(el || (delta - 'style')) ||
          jsonb_build_object('style',coalesce(el->'style','{}'::jsonb) ||
          coalesce(delta->'style','{}'::jsonb));
        n:=n+1;
      end if;
      built:=built || jsonb_build_array(el);
    end loop;
    if n<>(select count(*) from jsonb_object_keys(map)) then
      raise exception 'OVERLAY_ELEMENT_MISMATCH' using errcode='55000'; end if;
    d:=jsonb_set(d,'{elements}',built);
    perform app_private.social_media_generator_validate_system_template_document(r.system_key,d);
    insert into app_social_media.template_versions
      (id,template_id,version_number,revision,status,document,
       document_schema_version,change_note,created_by,created_at,updated_at,
       published_by,published_at)
    values(new_id,r.id,2,1,'PUBLISHED',d,1,
      'DEV original Liveticker overlay composition on approved 1080 canvas',
      null,statement_timestamp(),statement_timestamp(),null,statement_timestamp());
    update app_social_media.templates set current_published_version_id=new_id,
      updated_at=statement_timestamp()
      where id=r.id and current_published_version_id=old_id;
    if not found then raise exception 'OVERLAY_PUBLISH_CONFLICT' using errcode='55000'; end if;
    perform app_private.log_audit(null,'LIVETICKER_DEV_OVERLAY_V2_PUBLISHED',
      'social_media_template',r.system_key,
      jsonb_build_object('version',old_id,'canvas',dim),
      jsonb_build_object('version',new_id,'canvas',dim),
      jsonb_build_object('scope','DEV','approvedOn','2026-11-02',
        'backgroundChanged',false,'existingJobsChanged',false));
  end loop;
  if (select count(*) from app_social_media.templates
    where system_key in('LIVETICKER_POST','LIVETICKER_STORY')
      and current_published_version_id in(
        '20000000-0000-4000-8000-000000000011'::uuid,
        '20000000-0000-4000-8000-000000000012'::uuid))<>2 then
    raise exception 'OVERLAY_INCOMPLETE' using errcode='55000'; end if;
end;
$v2$;
commit;