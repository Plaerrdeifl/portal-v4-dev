-- One shared POST and one shared STORY template for PERIOD_1, PERIOD_2 and FINAL.
-- The static files are checksum-pinned; temporary use of the http extension keeps this migration self-validating.

do $$
declare
  v_http_preexisting boolean:=exists(select 1 from pg_extension where extname='http');
  v_post text; v_story text;
begin
  if not v_http_preexisting then execute 'create extension http with schema extensions'; end if;
  execute 'select (extensions.http_get($1)).content' into v_post using 'https://dev.plaerrdeifl.de/assets/liveticker/templates/LT_post.svg';
  execute 'select (extensions.http_get($1)).content' into v_story using 'https://dev.plaerrdeifl.de/assets/liveticker/templates/LT_story.svg';
  if encode(extensions.digest(convert_to(v_post,'UTF8'),'sha256'),'hex') <> '8f641ab7f50d939d3f66a8e1a7fcfa1f1b6ab3cd3a8c773c964593c34f5c1f0e' then raise exception 'LIVETICKER_POST_TEMPLATE_CHECKSUM_MISMATCH'; end if;
  if encode(extensions.digest(convert_to(v_story,'UTF8'),'sha256'),'hex') <> '429e524563530972d940fc0775890936a95e722e4d1f157b9ee3f76d4ad7d473' then raise exception 'LIVETICKER_STORY_TEMPLATE_CHECKSUM_MISMATCH'; end if;
  update app_modules.liveticker_graphic_templates set label='Liveticker · POST',filename='LT_post.svg',svg_text=v_post,sha256=encode(extensions.digest(convert_to(v_post,'UTF8'),'sha256'),'hex'),revision=revision+1,updated_at=now() where template_key='PERIOD_POST';
  update app_modules.liveticker_graphic_templates set label='Liveticker · STORY',filename='LT_story.svg',svg_text=v_story,sha256=encode(extensions.digest(convert_to(v_story,'UTF8'),'sha256'),'hex'),revision=revision+1,updated_at=now() where template_key='PERIOD_STORY';
  if not v_http_preexisting then execute 'drop extension http'; end if;
end; $$;

create or replace function app_private.api_liveticker_graphic_templates_list()
returns jsonb language plpgsql security definer set search_path=''
as $$
begin
  perform app_private.liveticker_actor();
  return jsonb_build_object('templates',coalesce((select jsonb_agg(jsonb_build_object(
    'key',t.template_key,'label',t.label,'filename',t.filename,'group',t.graphic_group,'format',t.format,
    'svgText',t.svg_text,'sha256',t.sha256,'revision',t.revision,'updatedAt',t.updated_at
  ) order by case t.template_key when 'PERIOD_POST' then 1 else 2 end)
  from app_modules.liveticker_graphic_templates t where t.template_key in ('PERIOD_POST','PERIOD_STORY')),'[]'::jsonb));
end; $$;

create or replace function app_private.api_liveticker_graphic_template_save(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid; v_key text:=upper(btrim(coalesce(p_payload->>'key',''))); v_svg text:=coalesce(p_payload->>'svgText','');
  v_expected integer; v_old app_modules.liveticker_graphic_templates%rowtype; v_id text;
  v_required text[]:=array['background_image','headline','period_label','result_suffix','logo_home','logo_away','home_score','away_score','our_goals_heading','our_goals_line_1','our_goals_line_2','our_goals_line_3','our_goals_line_4','our_goals_line_5','our_goals_line_6','our_goals_line_7','our_goals_line_8','our_goals_line_9','our_goals_line_10'];
begin
  v_actor:=app_private.liveticker_actor();
  if v_key not in ('PERIOD_POST','PERIOD_STORY') then raise exception 'Unbekannte Grafikvorlage.' using errcode='22023'; end if;
  begin v_expected:=nullif(btrim(coalesce(p_payload->>'expectedRevision','')),'')::integer;
  exception when invalid_text_representation then raise exception 'Ungültige Vorlagen-Version.' using errcode='22023'; end;
  if v_expected is null then raise exception 'Vorlagen-Version fehlt.' using errcode='22023'; end if;
  if octet_length(convert_to(v_svg,'UTF8')) < 200 or octet_length(convert_to(v_svg,'UTF8')) > 1048576 then raise exception 'SVG-Vorlage muss zwischen 200 Byte und 1 MiB groß sein.' using errcode='22023'; end if;
  if v_svg !~* '<svg([[:space:]>])' or upper(v_svg) like '%<!DOCTYPE%' or v_svg ~* '<script([[:space:]>])' or v_svg ~* 'javascript[[:space:]]*:' or v_svg ~* 'onload[[:space:]]*=' then raise exception 'SVG-Vorlage enthält nicht erlaubte Inhalte.' using errcode='22023'; end if;
  if v_key='PERIOD_POST' then
    if v_svg !~* 'viewBox[[:space:]]*=[[:space:]]*["'']0[[:space:]]+0[[:space:]]+1254([.]0+)?[[:space:]]+1254([.]0+)?["'']' then raise exception 'POST-Vorlage muss den viewBox 0 0 1254 1254 besitzen.' using errcode='22023'; end if;
  else
    if v_svg !~* 'viewBox[[:space:]]*=[[:space:]]*["'']0[[:space:]]+0[[:space:]]+941([.]0+)?[[:space:]]+1672([.]0+)?["'']' then raise exception 'STORY-Vorlage muss den viewBox 0 0 941 1672 besitzen.' using errcode='22023'; end if;
  end if;
  foreach v_id in array v_required loop
    if v_svg !~* ('id[[:space:]]*=[[:space:]]*(["'']'||v_id||'["''])') then raise exception 'SVG-Vorlage enthält das Pflichtfeld % nicht.',v_id using errcode='22023'; end if;
  end loop;
  select * into v_old from app_modules.liveticker_graphic_templates where template_key=v_key for update;
  if not found then raise exception 'Grafikvorlage wurde nicht gefunden.' using errcode='P0002'; end if;
  if v_expected<>v_old.revision then raise exception 'Die Grafikvorlage wurde zwischenzeitlich geändert. Bitte Ansicht aktualisieren.' using errcode='40001'; end if;
  update app_modules.liveticker_graphic_templates set svg_text=v_svg,sha256=encode(extensions.digest(convert_to(v_svg,'UTF8'),'sha256'),'hex'),revision=revision+1,updated_at=now(),updated_by=v_actor where template_key=v_key;
  return app_private.api_liveticker_graphic_templates_list();
end; $$;

create or replace function app_private.liveticker_graphic_job_attach_templates()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_post app_modules.liveticker_graphic_templates%rowtype; v_story app_modules.liveticker_graphic_templates%rowtype;
begin
  select * into v_post from app_modules.liveticker_graphic_templates where template_key='PERIOD_POST';
  select * into v_story from app_modules.liveticker_graphic_templates where template_key='PERIOD_STORY';
  if v_post.template_key is null or v_story.template_key is null then raise exception 'LIVETICKER_GRAPHIC_TEMPLATE_MISSING' using errcode='22023'; end if;
  new.request_snapshot:=jsonb_set(coalesce(new.request_snapshot,'{}'::jsonb),'{graphicTemplates}',jsonb_build_object(
    'post',jsonb_build_object('filename',v_post.filename,'svgText',v_post.svg_text,'sha256',v_post.sha256,'revision',v_post.revision),
    'story',jsonb_build_object('filename',v_story.filename,'svgText',v_story.svg_text,'sha256',v_story.sha256,'revision',v_story.revision)),true);
  return new;
end; $$;

revoke all on function app_private.api_liveticker_graphic_templates_list() from public,anon,authenticated;
revoke all on function app_private.api_liveticker_graphic_template_save(jsonb) from public,anon,authenticated;
revoke all on function app_private.liveticker_graphic_job_attach_templates() from public,anon,authenticated;
