begin;

alter table app_social_media.templates
  add column system_key text;

alter table app_social_media.templates
  alter column created_by drop not null;

alter table app_social_media.template_versions
  alter column created_by drop not null;

alter table app_social_media.templates
  add constraint social_media_templates_system_key_check
  check (
    system_key is null
    or system_key in (
      'LIVETICKER_POST',
      'LIVETICKER_STORY',
      'FANBUS_POST',
      'FANBUS_STORY'
    )
  );

alter table app_social_media.templates
  add constraint social_media_templates_system_key_uq unique (system_key);

alter table app_social_media.templates
  add constraint social_media_templates_owner_check
  check (
    (system_key is null and created_by is not null)
    or (system_key is not null)
  );

alter table app_social_media.template_versions
  drop constraint social_media_template_versions_publish_check;

alter table app_social_media.template_versions
  add constraint social_media_template_versions_publish_check
  check (
    (status = 'DRAFT' and published_by is null and published_at is null)
    or
    (status = 'PUBLISHED' and published_at is not null)
  );

alter table app_social_media.drafts
  add column binding_context jsonb not null default '{}'::jsonb;

alter table app_social_media.drafts
  add constraint social_media_drafts_binding_context_check
  check (
    pg_catalog.jsonb_typeof(binding_context) = 'object'
    and pg_catalog.octet_length(binding_context::text) <= 1048576
  );

alter table app_social_media.liveticker_render_requests
  add column post_template_version_id uuid
    references app_social_media.template_versions(id) on delete restrict,
  add column story_template_version_id uuid
    references app_social_media.template_versions(id) on delete restrict;


insert into app_social_media.templates (
  id, name, category, description, sort_position, is_active,
  current_published_version_id, created_by, created_at, updated_at, system_key
) values (
  '10000000-0000-4000-8000-000000000001'::uuid, 'Liveticker POST', 'Liveticker',
  'Systemvorlage Liveticker POST; Layout editierbar, Datenbindung geschützt.',
  10, true, null, null, pg_catalog.now(), pg_catalog.now(), 'LIVETICKER_POST'
)
on conflict (id) do nothing;

insert into app_social_media.template_versions (
  id, template_id, version_number, revision, status, document,
  document_schema_version, change_note, created_by, created_at, updated_at,
  published_by, published_at
) values (
  '20000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000001'::uuid, 1, 1, 'PUBLISHED',
  $json${"schemaVersion":1,"id":"system-template-liveticker-post-v1","title":"Liveticker POST","format":{"width":1080,"height":1080},"elements":[{"id":"lt-post-bg","name":"Liveticker Hintergrund","type":"background","x":0,"y":0,"width":1080,"height":1080,"rotation":0,"mediaId":"lt-post-bg-media","href":"https://dev.plaerrdeifl.de/assets/generator-dev/liveticker/post-background.jpg","preserveAspectRatio":"xMidYMid slice","style":{"opacity":1}},{"id":"lt-post-shade","name":"Kontrastverlauf oben","type":"shape","shape":"rect","x":0,"y":0,"width":1080,"height":580,"rotation":0,"radius":0,"style":{"fill":"#03111f","opacity":0.14}},{"id":"lt-post-headline-shadow","name":"Headline Schatten","type":"text","text":"ZWISCHENSTAND","x":36,"y":35,"width":1008,"height":100,"rotation":0,"style":{"fill":"#043253","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":78,"fontWeight":900,"textAlign":"center","opacity":0.88,"stroke":"#020b12","strokeWidth":7},"binding":{"key":"liveticker.headline","source":"central","protected":true}},{"id":"lt-post-headline","name":"Headline","type":"text","text":"ZWISCHENSTAND","x":36,"y":28,"width":1008,"height":100,"rotation":0,"style":{"fill":"#56bff7","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":78,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#e7f8ff","strokeWidth":3},"binding":{"key":"liveticker.headline","source":"central","protected":true}},{"id":"lt-post-status-shadow","name":"Status Schatten","type":"text","text":"1. DRITTEL","x":48,"y":138,"width":984,"height":68,"rotation":0,"style":{"fill":"#24425a","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":45,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#091725","strokeWidth":6},"binding":{"key":"liveticker.status","source":"central","protected":true}},{"id":"lt-post-status","name":"Status","type":"text","text":"1. DRITTEL","x":48,"y":131,"width":984,"height":68,"rotation":0,"style":{"fill":"#dceaf4","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":45,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#f4fbff","strokeWidth":2},"binding":{"key":"liveticker.status","source":"central","protected":true}},{"id":"lt-post-home-logo","name":"Heimteam Logo","type":"logo","x":54,"y":250,"width":218,"height":218,"rotation":0,"mediaId":"lt-post-home-logo-media","href":"","preserveAspectRatio":"xMidYMid meet","style":{"opacity":1},"binding":{"key":"liveticker.homeLogoHref","source":"central","protected":true}},{"id":"lt-post-away-logo","name":"Gastteam Logo","type":"logo","x":808,"y":250,"width":218,"height":218,"rotation":0,"mediaId":"lt-post-away-logo-media","href":"","preserveAspectRatio":"xMidYMid meet","style":{"opacity":1},"binding":{"key":"liveticker.awayLogoHref","source":"central","protected":true}},{"id":"lt-post-home-name","name":"Heimteam Name","type":"text","text":"HEIMTEAM","x":36,"y":480,"width":300,"height":48,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":24,"fontWeight":800,"textAlign":"center","opacity":1,"stroke":"#02080d","strokeWidth":2},"binding":{"key":"liveticker.homeTeamName","source":"central","protected":true}},{"id":"lt-post-away-name","name":"Gastteam Name","type":"text","text":"GASTTEAM","x":744,"y":480,"width":300,"height":48,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":24,"fontWeight":800,"textAlign":"center","opacity":1,"stroke":"#02080d","strokeWidth":2},"binding":{"key":"liveticker.awayTeamName","source":"central","protected":true}},{"id":"lt-post-score","name":"Spielstand","type":"text","text":"0 : 0","x":280,"y":264,"width":520,"height":190,"rotation":0,"style":{"fill":"#f7fdff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":150,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#02080d","strokeWidth":5},"binding":{"key":"liveticker.score","source":"central","protected":true}},{"id":"lt-post-suffix","name":"Ergebniszusatz","type":"text","text":"","x":280,"y":418,"width":520,"height":60,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":36,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#08131d","strokeWidth":3},"binding":{"key":"liveticker.resultSuffix","source":"central","protected":true}},{"id":"lt-post-goals-shadow","name":"Unsere Tore Schatten","type":"text","text":"UNSERE TORE","x":72,"y":564,"width":936,"height":58,"rotation":0,"style":{"fill":"#0b1d2c","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":40,"fontWeight":900,"textAlign":"left","opacity":0.52,"stroke":"#0b1d2c","strokeWidth":10},"binding":{"key":"liveticker.goalsHeading","source":"central","protected":true}},{"id":"lt-post-goals-heading","name":"Unsere Tore","type":"text","text":"UNSERE TORE","x":72,"y":558,"width":936,"height":58,"rotation":0,"style":{"fill":"#1ca9ff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":40,"fontWeight":900,"textAlign":"left","opacity":1,"stroke":"#ffffff","strokeWidth":7},"binding":{"key":"liveticker.goalsHeading","source":"central","protected":true}},{"id":"lt-post-goals","name":"Liveticker-Torschützenliste","type":"text","text":"","x":72,"y":636,"width":936,"height":368,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":31,"fontWeight":800,"textAlign":"left","opacity":1,"stroke":"#000000","strokeWidth":3,"lineHeight":41},"binding":{"key":"liveticker.goalScorers","source":"central","protected":true,"minFontSize":20,"minLineHeight":25,"standardMaxLines":7,"renderer":"liveticker-goal-scorers"}},{"id":"lt-post-footer-line-l","name":"Footer Linie links","type":"shape","shape":"rect","x":38,"y":1043,"width":300,"height":2,"rotation":0,"radius":0,"style":{"fill":"#ffffff","opacity":0.9}},{"id":"lt-post-footer-line-r","name":"Footer Linie rechts","type":"shape","shape":"rect","x":742,"y":1043,"width":300,"height":2,"rotation":0,"radius":0,"style":{"fill":"#ffffff","opacity":0.9}},{"id":"lt-post-footer","name":"Footer","type":"text","text":"WWW.PLAERRDEIFL.DE","x":355,"y":1026,"width":370,"height":42,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":20,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#000000","strokeWidth":2}}],"metadata":{"createdAt":"2026-09-29T04:38:17Z","updatedAt":"2026-09-29T04:38:17Z"}}$json$::jsonb,
  1, 'Initiale Systemvorlage', null, pg_catalog.now(), pg_catalog.now(),
  null, pg_catalog.now()
)
on conflict (id) do nothing;

update app_social_media.templates
set current_published_version_id = '20000000-0000-4000-8000-000000000001'::uuid,
    updated_at = pg_catalog.now()
where id = '10000000-0000-4000-8000-000000000001'::uuid
  and current_published_version_id is null;


insert into app_social_media.templates (
  id, name, category, description, sort_position, is_active,
  current_published_version_id, created_by, created_at, updated_at, system_key
) values (
  '10000000-0000-4000-8000-000000000002'::uuid, 'Liveticker STORY', 'Liveticker',
  'Systemvorlage Liveticker STORY; Layout editierbar, Datenbindung geschützt.',
  20, true, null, null, pg_catalog.now(), pg_catalog.now(), 'LIVETICKER_STORY'
)
on conflict (id) do nothing;

insert into app_social_media.template_versions (
  id, template_id, version_number, revision, status, document,
  document_schema_version, change_note, created_by, created_at, updated_at,
  published_by, published_at
) values (
  '20000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000002'::uuid, 1, 1, 'PUBLISHED',
  $json${"schemaVersion":1,"id":"system-template-liveticker-story-v1","title":"Liveticker STORY","format":{"width":1080,"height":1920},"elements":[{"id":"lt-story-bg","name":"Liveticker Hintergrund","type":"background","x":0,"y":0,"width":1080,"height":1920,"rotation":0,"mediaId":"lt-story-bg-media","href":"https://dev.plaerrdeifl.de/assets/generator-dev/liveticker/story-background.jpg","preserveAspectRatio":"xMidYMid slice","style":{"opacity":1}},{"id":"lt-story-shade","name":"Kontrastverlauf oben","type":"shape","shape":"rect","x":0,"y":0,"width":1080,"height":980,"rotation":0,"radius":0,"style":{"fill":"#03111f","opacity":0.12}},{"id":"lt-story-headline-shadow","name":"Headline Schatten","type":"text","text":"ZWISCHENSTAND","x":36,"y":139,"width":1008,"height":120,"rotation":0,"style":{"fill":"#043253","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":96,"fontWeight":900,"textAlign":"center","opacity":0.88,"stroke":"#020b12","strokeWidth":7},"binding":{"key":"liveticker.headline","source":"central","protected":true}},{"id":"lt-story-headline","name":"Headline","type":"text","text":"ZWISCHENSTAND","x":36,"y":132,"width":1008,"height":120,"rotation":0,"style":{"fill":"#56bff7","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":96,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#e7f8ff","strokeWidth":3},"binding":{"key":"liveticker.headline","source":"central","protected":true}},{"id":"lt-story-status-shadow","name":"Status Schatten","type":"text","text":"1. DRITTEL","x":48,"y":313,"width":984,"height":92,"rotation":0,"style":{"fill":"#24425a","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":64,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#091725","strokeWidth":8},"binding":{"key":"liveticker.status","source":"central","protected":true}},{"id":"lt-story-status","name":"Status","type":"text","text":"1. DRITTEL","x":48,"y":306,"width":984,"height":92,"rotation":0,"style":{"fill":"#dceaf4","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":64,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#f4fbff","strokeWidth":3},"binding":{"key":"liveticker.status","source":"central","protected":true}},{"id":"lt-story-home-logo","name":"Heimteam Logo","type":"logo","x":28,"y":500,"width":246,"height":246,"rotation":0,"mediaId":"lt-story-home-logo-media","href":"","preserveAspectRatio":"xMidYMid meet","style":{"opacity":1},"binding":{"key":"liveticker.homeLogoHref","source":"central","protected":true}},{"id":"lt-story-away-logo","name":"Gastteam Logo","type":"logo","x":806,"y":500,"width":246,"height":246,"rotation":0,"mediaId":"lt-story-away-logo-media","href":"","preserveAspectRatio":"xMidYMid meet","style":{"opacity":1},"binding":{"key":"liveticker.awayLogoHref","source":"central","protected":true}},{"id":"lt-story-home-name","name":"Heimteam Name","type":"text","text":"HEIMTEAM","x":36,"y":770,"width":300,"height":48,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":30,"fontWeight":800,"textAlign":"center","opacity":1,"stroke":"#02080d","strokeWidth":2},"binding":{"key":"liveticker.homeTeamName","source":"central","protected":true}},{"id":"lt-story-away-name","name":"Gastteam Name","type":"text","text":"GASTTEAM","x":744,"y":770,"width":300,"height":48,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":30,"fontWeight":800,"textAlign":"center","opacity":1,"stroke":"#02080d","strokeWidth":2},"binding":{"key":"liveticker.awayTeamName","source":"central","protected":true}},{"id":"lt-story-score","name":"Spielstand","type":"text","text":"0 : 0","x":262,"y":556,"width":556,"height":224,"rotation":0,"style":{"fill":"#f7fdff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":180,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#02080d","strokeWidth":6},"binding":{"key":"liveticker.score","source":"central","protected":true}},{"id":"lt-story-suffix","name":"Ergebniszusatz","type":"text","text":"","x":262,"y":744,"width":556,"height":72,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":44,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#08131d","strokeWidth":3},"binding":{"key":"liveticker.resultSuffix","source":"central","protected":true}},{"id":"lt-story-goals-shadow","name":"Unsere Tore Schatten","type":"text","text":"UNSERE TORE","x":64,"y":1051,"width":952,"height":76,"rotation":0,"style":{"fill":"#0b1d2c","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":53,"fontWeight":900,"textAlign":"left","opacity":0.52,"stroke":"#0b1d2c","strokeWidth":12},"binding":{"key":"liveticker.goalsHeading","source":"central","protected":true}},{"id":"lt-story-goals-heading","name":"Unsere Tore","type":"text","text":"UNSERE TORE","x":64,"y":1045,"width":952,"height":76,"rotation":0,"style":{"fill":"#1ca9ff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":53,"fontWeight":900,"textAlign":"left","opacity":1,"stroke":"#ffffff","strokeWidth":9},"binding":{"key":"liveticker.goalsHeading","source":"central","protected":true}},{"id":"lt-story-goals","name":"Liveticker-Torschützenliste","type":"text","text":"","x":64,"y":1152,"width":952,"height":600,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":41,"fontWeight":800,"textAlign":"left","opacity":1,"stroke":"#000000","strokeWidth":3,"lineHeight":55},"binding":{"key":"liveticker.goalScorers","source":"central","protected":true,"minFontSize":24,"minLineHeight":30,"standardMaxLines":7,"renderer":"liveticker-goal-scorers"}},{"id":"lt-story-footer-line-l","name":"Footer Linie links","type":"shape","shape":"rect","x":36,"y":1833,"width":210,"height":2,"rotation":0,"radius":0,"style":{"fill":"#ffffff","opacity":0.9}},{"id":"lt-story-footer-line-r","name":"Footer Linie rechts","type":"shape","shape":"rect","x":834,"y":1833,"width":210,"height":2,"rotation":0,"radius":0,"style":{"fill":"#ffffff","opacity":0.9}},{"id":"lt-story-footer","name":"Footer","type":"text","text":"WWW.PLAERRDEIFL.DE","x":270,"y":1816,"width":540,"height":42,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":24,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#000000","strokeWidth":2}}],"metadata":{"createdAt":"2026-09-29T04:38:17Z","updatedAt":"2026-09-29T04:38:17Z"}}$json$::jsonb,
  1, 'Initiale Systemvorlage', null, pg_catalog.now(), pg_catalog.now(),
  null, pg_catalog.now()
)
on conflict (id) do nothing;

update app_social_media.templates
set current_published_version_id = '20000000-0000-4000-8000-000000000002'::uuid,
    updated_at = pg_catalog.now()
where id = '10000000-0000-4000-8000-000000000002'::uuid
  and current_published_version_id is null;


insert into app_social_media.templates (
  id, name, category, description, sort_position, is_active,
  current_published_version_id, created_by, created_at, updated_at, system_key
) values (
  '10000000-0000-4000-8000-000000000003'::uuid, 'Fanbus POST', 'Fanbus',
  'Systemvorlage Fanbus POST; Layout editierbar, Datenbindung geschützt.',
  30, true, null, null, pg_catalog.now(), pg_catalog.now(), 'FANBUS_POST'
)
on conflict (id) do nothing;

insert into app_social_media.template_versions (
  id, template_id, version_number, revision, status, document,
  document_schema_version, change_note, created_by, created_at, updated_at,
  published_by, published_at
) values (
  '20000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000003'::uuid, 1, 1, 'PUBLISHED',
  $json${"schemaVersion":1,"id":"system-template-fanbus-post-v1","title":"Fanbus POST","format":{"width":1080,"height":1350},"elements":[{"id":"fb-post-bg","name":"Hintergrund","type":"shape","shape":"rect","x":0,"y":0,"width":1080,"height":1350,"rotation":0,"radius":0,"style":{"fill":"#071420","opacity":1}},{"id":"fb-post-ice-top","name":"Eisfläche oben","type":"shape","shape":"rect","x":0,"y":0,"width":1080,"height":520,"rotation":0,"radius":0,"style":{"fill":"#0c2d45","opacity":1}},{"id":"fb-post-ice-glow","name":"Eis-Akzent","type":"shape","shape":"rect","x":0,"y":330,"width":1080,"height":190,"rotation":0,"radius":0,"style":{"fill":"#153f5c","opacity":0.72}},{"id":"fb-post-data-left","name":"Datenfläche links","type":"shape","shape":"rect","x":44,"y":540,"width":485,"height":390,"rotation":0,"radius":22,"style":{"fill":"#071019","opacity":0.86,"stroke":"#2caaf7","strokeWidth":2}},{"id":"fb-post-data-right","name":"Datenfläche rechts","type":"shape","shape":"rect","x":548,"y":540,"width":488,"height":390,"rotation":0,"radius":22,"style":{"fill":"#071019","opacity":0.86,"stroke":"#2caaf7","strokeWidth":2}},{"id":"fb-post-contacts","name":"Kontaktleiste","type":"shape","shape":"rect","x":54,"y":1078,"width":972,"height":128,"rotation":0,"radius":20,"style":{"fill":"#05101b","opacity":0.9}},{"id":"fb-post-footer","name":"Footerfläche","type":"shape","shape":"rect","x":0,"y":1205,"width":1080,"height":145,"rotation":0,"radius":0,"style":{"fill":"#030b12","opacity":0.95}},{"id":"fb-post-away","name":"Auswärtsfahrt","type":"text","text":"AUSWÄRTSFAHRT","x":54,"y":185,"width":972,"height":72,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":54,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#071420","strokeWidth":3}},{"id":"fb-post-destination","name":"Ziel","type":"text","text":"LANDSBERG","x":40,"y":255,"width":1000,"height":165,"rotation":0,"style":{"fill":"#49a8e8","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":142,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#dff4ff","strokeWidth":3.2},"binding":{"key":"fanbus.destination","source":"central","protected":true}},{"id":"fb-post-trip-label","name":"Fahrtbezeichnung","type":"text","text":"FANBUSFAHRT","x":130,"y":450,"width":820,"height":62,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":38,"fontWeight":900,"textAlign":"center","opacity":1},"binding":{"key":"fanbus.tripLabel","source":"central","protected":true}},{"id":"fb-post-weekday","name":"Wochentag","type":"text","text":"SAMSTAG","x":62,"y":545,"width":235,"height":35,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.weekday","source":"central","protected":true}},{"id":"fb-post-date","name":"Spieldatum","type":"text","text":"03.10.2026","x":62,"y":582,"width":250,"height":50,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":34,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.eventDate","source":"central","protected":true}},{"id":"fb-post-start-label","name":"Spielbeginn Label","type":"text","text":"SPIELBEGINN","x":338,"y":545,"width":190,"height":35,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1}},{"id":"fb-post-game-start","name":"Spielzeit","type":"text","text":"18:00 UHR","x":338,"y":582,"width":190,"height":50,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":34,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.eventTime","source":"central","protected":true}},{"id":"fb-post-depart-label","name":"Abfahrten Label","type":"text","text":"ABFAHRTEN","x":96,"y":660,"width":300,"height":32,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1}},{"id":"fb-post-stops","name":"Boarding-/Abfahrtsorte","type":"text","text":"","x":96,"y":700,"width":405,"height":188,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1,"lineHeight":36},"binding":{"key":"fanbus.boardingStops","source":"central","protected":true,"minFontSize":17,"minLineHeight":24,"standardMaxLines":4,"renderer":"fanbus-boarding-stops"}},{"id":"fb-post-price-label","name":"Fahrtpreis Label","type":"text","text":"FAHRTPREIS","x":574,"y":660,"width":390,"height":34,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1}},{"id":"fb-post-price","name":"Preis","type":"text","text":"25,00 €","x":574,"y":700,"width":390,"height":70,"rotation":0,"style":{"fill":"#1ca9ff","fontFamily":"Arial, sans-serif","fontSize":53,"fontWeight":900,"textAlign":"left","opacity":1,"stroke":"#ffffff","strokeWidth":4},"binding":{"key":"fanbus.price","source":"central","protected":true}},{"id":"fb-post-deadline-label","name":"Anmeldeschluss Label","type":"text","text":"ANMELDESCHLUSS","x":574,"y":792,"width":390,"height":32,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1}},{"id":"fb-post-deadline-date","name":"Anmeldeschluss Datum","type":"text","text":"30.09.2026,","x":574,"y":828,"width":390,"height":34,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.registrationDeadlineDate","source":"central","protected":true}},{"id":"fb-post-deadline-time","name":"Anmeldeschluss Uhrzeit","type":"text","text":"20:00 UHR","x":574,"y":858,"width":390,"height":34,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.registrationDeadlineTime","source":"central","protected":true}},{"id":"fb-post-departure-info","name":"Abfahrtsinformation","type":"text","text":"","x":96,"y":902,"width":868,"height":45,"rotation":0,"style":{"fill":"#cfeeff","fontFamily":"Arial, sans-serif","fontSize":20,"fontWeight":700,"textAlign":"center","opacity":1},"binding":{"key":"fanbus.departureInfo","source":"central","protected":true}},{"id":"fb-post-remaining-small","name":"Restplätze Label","type":"text","text":"NUR NOCH","x":100,"y":975,"width":240,"height":32,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":900,"textAlign":"center","opacity":1}},{"id":"fb-post-remaining","name":"Restplätze","type":"text","text":"XX PLÄTZE FREI!","x":62,"y":1006,"width":320,"height":50,"rotation":0,"style":{"fill":"#1ca9ff","fontFamily":"Arial, sans-serif","fontSize":34,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#ffffff","strokeWidth":2},"binding":{"key":"fanbus.remainingCapacity","source":"central","protected":true}},{"id":"fb-post-contact-1-name","name":"Kontakt 1 Name","type":"text","text":"Pascal","x":104,"y":1090,"width":170,"height":42,"rotation":0,"style":{"fill":"#3ea6ff","fontFamily":"Arial, sans-serif","fontSize":31,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.contact1Name","source":"central","protected":true}},{"id":"fb-post-contact-1-phone","name":"Kontakt 1 Telefon","type":"text","text":"0172 9744908","x":272,"y":1093,"width":260,"height":42,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":27,"fontWeight":800,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.contact1Phone","source":"central","protected":true}},{"id":"fb-post-contact-2-name","name":"Kontakt 2 Name","type":"text","text":"Luca","x":620,"y":1090,"width":160,"height":42,"rotation":0,"style":{"fill":"#3ea6ff","fontFamily":"Arial, sans-serif","fontSize":31,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.contact2Name","source":"central","protected":true}},{"id":"fb-post-contact-2-phone","name":"Kontakt 2 Telefon","type":"text","text":"0174 6681046","x":780,"y":1093,"width":250,"height":42,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":27,"fontWeight":800,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.contact2Phone","source":"central","protected":true}},{"id":"fb-post-cta","name":"CTA","type":"text","text":"JETZT ANMELDEN!","x":388,"y":1220,"width":304,"height":50,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":30,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#1ca9ff","strokeWidth":2}},{"id":"fb-post-website","name":"Website","type":"text","text":"WWW.PLAERRDEIFL.DE","x":290,"y":1280,"width":500,"height":40,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"center","opacity":1}}],"metadata":{"createdAt":"2026-09-29T04:38:17Z","updatedAt":"2026-09-29T04:38:17Z"}}$json$::jsonb,
  1, 'Initiale Systemvorlage', null, pg_catalog.now(), pg_catalog.now(),
  null, pg_catalog.now()
)
on conflict (id) do nothing;

update app_social_media.templates
set current_published_version_id = '20000000-0000-4000-8000-000000000003'::uuid,
    updated_at = pg_catalog.now()
where id = '10000000-0000-4000-8000-000000000003'::uuid
  and current_published_version_id is null;


insert into app_social_media.templates (
  id, name, category, description, sort_position, is_active,
  current_published_version_id, created_by, created_at, updated_at, system_key
) values (
  '10000000-0000-4000-8000-000000000004'::uuid, 'Fanbus STORY', 'Fanbus',
  'Systemvorlage Fanbus STORY; Layout editierbar, Datenbindung geschützt.',
  40, true, null, null, pg_catalog.now(), pg_catalog.now(), 'FANBUS_STORY'
)
on conflict (id) do nothing;

insert into app_social_media.template_versions (
  id, template_id, version_number, revision, status, document,
  document_schema_version, change_note, created_by, created_at, updated_at,
  published_by, published_at
) values (
  '20000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-4000-8000-000000000004'::uuid, 1, 1, 'PUBLISHED',
  $json${"schemaVersion":1,"id":"system-template-fanbus-story-v1","title":"Fanbus STORY","format":{"width":1080,"height":1920},"elements":[{"id":"fb-story-bg","name":"Hintergrund","type":"shape","shape":"rect","x":0,"y":0,"width":1080,"height":1920,"rotation":0,"radius":0,"style":{"fill":"#071420","opacity":1}},{"id":"fb-story-ice-top","name":"Eisfläche oben","type":"shape","shape":"rect","x":0,"y":0,"width":1080,"height":520,"rotation":0,"radius":0,"style":{"fill":"#0c2d45","opacity":1}},{"id":"fb-story-ice-glow","name":"Eis-Akzent","type":"shape","shape":"rect","x":0,"y":330,"width":1080,"height":190,"rotation":0,"radius":0,"style":{"fill":"#153f5c","opacity":0.72}},{"id":"fb-story-data-left","name":"Datenfläche links","type":"shape","shape":"rect","x":44,"y":540,"width":485,"height":390,"rotation":0,"radius":22,"style":{"fill":"#071019","opacity":0.86,"stroke":"#2caaf7","strokeWidth":2}},{"id":"fb-story-data-right","name":"Datenfläche rechts","type":"shape","shape":"rect","x":548,"y":540,"width":488,"height":390,"rotation":0,"radius":22,"style":{"fill":"#071019","opacity":0.86,"stroke":"#2caaf7","strokeWidth":2}},{"id":"fb-story-contacts","name":"Kontaktleiste","type":"shape","shape":"rect","x":54,"y":1078,"width":972,"height":128,"rotation":0,"radius":20,"style":{"fill":"#05101b","opacity":0.9}},{"id":"fb-story-footer","name":"Footerfläche","type":"shape","shape":"rect","x":0,"y":1775,"width":1080,"height":145,"rotation":0,"radius":0,"style":{"fill":"#030b12","opacity":0.95}},{"id":"fb-story-away","name":"Auswärtsfahrt","type":"text","text":"AUSWÄRTSFAHRT","x":54,"y":185,"width":972,"height":72,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":54,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#071420","strokeWidth":3}},{"id":"fb-story-destination","name":"Ziel","type":"text","text":"LANDSBERG","x":40,"y":255,"width":1000,"height":165,"rotation":0,"style":{"fill":"#49a8e8","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":142,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#dff4ff","strokeWidth":3.2},"binding":{"key":"fanbus.destination","source":"central","protected":true}},{"id":"fb-story-trip-label","name":"Fahrtbezeichnung","type":"text","text":"FANBUSFAHRT","x":130,"y":450,"width":820,"height":62,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":38,"fontWeight":900,"textAlign":"center","opacity":1},"binding":{"key":"fanbus.tripLabel","source":"central","protected":true}},{"id":"fb-story-weekday","name":"Wochentag","type":"text","text":"SAMSTAG","x":62,"y":545,"width":235,"height":35,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.weekday","source":"central","protected":true}},{"id":"fb-story-date","name":"Spieldatum","type":"text","text":"03.10.2026","x":62,"y":582,"width":250,"height":50,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":34,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.eventDate","source":"central","protected":true}},{"id":"fb-story-start-label","name":"Spielbeginn Label","type":"text","text":"SPIELBEGINN","x":338,"y":545,"width":190,"height":35,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1}},{"id":"fb-story-game-start","name":"Spielzeit","type":"text","text":"18:00 UHR","x":338,"y":582,"width":190,"height":50,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":34,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.eventTime","source":"central","protected":true}},{"id":"fb-story-depart-label","name":"Abfahrten Label","type":"text","text":"ABFAHRTEN","x":96,"y":660,"width":300,"height":32,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1}},{"id":"fb-story-stops","name":"Boarding-/Abfahrtsorte","type":"text","text":"","x":96,"y":700,"width":405,"height":188,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1,"lineHeight":36},"binding":{"key":"fanbus.boardingStops","source":"central","protected":true,"minFontSize":17,"minLineHeight":24,"standardMaxLines":4,"renderer":"fanbus-boarding-stops"}},{"id":"fb-story-price-label","name":"Fahrtpreis Label","type":"text","text":"FAHRTPREIS","x":574,"y":660,"width":390,"height":34,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1}},{"id":"fb-story-price","name":"Preis","type":"text","text":"25,00 €","x":574,"y":700,"width":390,"height":70,"rotation":0,"style":{"fill":"#1ca9ff","fontFamily":"Arial, sans-serif","fontSize":53,"fontWeight":900,"textAlign":"left","opacity":1,"stroke":"#ffffff","strokeWidth":4},"binding":{"key":"fanbus.price","source":"central","protected":true}},{"id":"fb-story-deadline-label","name":"Anmeldeschluss Label","type":"text","text":"ANMELDESCHLUSS","x":574,"y":792,"width":390,"height":32,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"left","opacity":1}},{"id":"fb-story-deadline-date","name":"Anmeldeschluss Datum","type":"text","text":"30.09.2026,","x":574,"y":828,"width":390,"height":34,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.registrationDeadlineDate","source":"central","protected":true}},{"id":"fb-story-deadline-time","name":"Anmeldeschluss Uhrzeit","type":"text","text":"20:00 UHR","x":574,"y":858,"width":390,"height":34,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.registrationDeadlineTime","source":"central","protected":true}},{"id":"fb-story-departure-info","name":"Abfahrtsinformation","type":"text","text":"","x":96,"y":902,"width":868,"height":45,"rotation":0,"style":{"fill":"#cfeeff","fontFamily":"Arial, sans-serif","fontSize":20,"fontWeight":700,"textAlign":"center","opacity":1},"binding":{"key":"fanbus.departureInfo","source":"central","protected":true}},{"id":"fb-story-remaining-small","name":"Restplätze Label","type":"text","text":"NUR NOCH","x":100,"y":975,"width":240,"height":32,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":900,"textAlign":"center","opacity":1}},{"id":"fb-story-remaining","name":"Restplätze","type":"text","text":"XX PLÄTZE FREI!","x":62,"y":1006,"width":320,"height":50,"rotation":0,"style":{"fill":"#1ca9ff","fontFamily":"Arial, sans-serif","fontSize":34,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#ffffff","strokeWidth":2},"binding":{"key":"fanbus.remainingCapacity","source":"central","protected":true}},{"id":"fb-story-contact-1-name","name":"Kontakt 1 Name","type":"text","text":"Pascal","x":104,"y":1090,"width":170,"height":42,"rotation":0,"style":{"fill":"#3ea6ff","fontFamily":"Arial, sans-serif","fontSize":31,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.contact1Name","source":"central","protected":true}},{"id":"fb-story-contact-1-phone","name":"Kontakt 1 Telefon","type":"text","text":"0172 9744908","x":272,"y":1093,"width":260,"height":42,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":27,"fontWeight":800,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.contact1Phone","source":"central","protected":true}},{"id":"fb-story-contact-2-name","name":"Kontakt 2 Name","type":"text","text":"Luca","x":620,"y":1090,"width":160,"height":42,"rotation":0,"style":{"fill":"#3ea6ff","fontFamily":"Arial, sans-serif","fontSize":31,"fontWeight":900,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.contact2Name","source":"central","protected":true}},{"id":"fb-story-contact-2-phone","name":"Kontakt 2 Telefon","type":"text","text":"0174 6681046","x":780,"y":1093,"width":250,"height":42,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":27,"fontWeight":800,"textAlign":"left","opacity":1},"binding":{"key":"fanbus.contact2Phone","source":"central","protected":true}},{"id":"fb-story-cta","name":"CTA","type":"text","text":"JETZT ANMELDEN!","x":388,"y":1790,"width":304,"height":50,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"'Komika Axis','Arial Black',Impact,sans-serif","fontSize":30,"fontWeight":900,"textAlign":"center","opacity":1,"stroke":"#1ca9ff","strokeWidth":2}},{"id":"fb-story-website","name":"Website","type":"text","text":"WWW.PLAERRDEIFL.DE","x":290,"y":1850,"width":500,"height":40,"rotation":0,"style":{"fill":"#ffffff","fontFamily":"Arial, sans-serif","fontSize":22,"fontWeight":800,"textAlign":"center","opacity":1}}],"metadata":{"createdAt":"2026-09-29T04:38:17Z","updatedAt":"2026-09-29T04:38:17Z"}}$json$::jsonb,
  1, 'Initiale Systemvorlage', null, pg_catalog.now(), pg_catalog.now(),
  null, pg_catalog.now()
)
on conflict (id) do nothing;

update app_social_media.templates
set current_published_version_id = '20000000-0000-4000-8000-000000000004'::uuid,
    updated_at = pg_catalog.now()
where id = '10000000-0000-4000-8000-000000000004'::uuid
  and current_published_version_id is null;


create or replace function app_private.social_media_generator_template_json(
  p_template_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'id', template.id,
      'name', template.name,
      'category', template.category,
      'description', template.description,
      'sortPosition', template.sort_position,
      'isActive', template.is_active,
      'systemKey', template.system_key,
      'isFavorite', favorite.user_id is not null,
      'publishedVersion',
        case
          when template.current_published_version_id is not null then
            app_private.social_media_generator_template_version_json(
              template.current_published_version_id,
              false
            )
          else null
        end,
      'draftVersion',
        case
          when draft.id is not null then
            app_private.social_media_generator_template_version_json(
              draft.id,
              false
            )
          else null
        end,
      'createdAt', template.created_at,
      'updatedAt', template.updated_at
    )
  )
  from app_social_media.templates as template
  left join app_social_media.template_versions as draft
    on draft.template_id = template.id
   and draft.status = 'DRAFT'
  left join app_social_media.template_favorites as favorite
    on favorite.template_id = template.id
   and favorite.user_id = p_user_id
  where template.id = p_template_id;
$function$;

create or replace function app_private.social_media_generator_draft_json(
  p_draft_id uuid,
  p_include_document boolean default true
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'id', draft.id,
      'title', draft.title,
      'document',
        case when p_include_document then draft.document else null end,
      'documentSchemaVersion', draft.document_schema_version,
      'version', draft.version,
      'templateVersionId', draft.template_version_id,
      'mediaPackageId', draft.media_package_id,
      'packageSlotKey', draft.package_slot_key,
      'bindingContext', draft.binding_context,
      'createdAt', draft.created_at,
      'updatedAt', draft.updated_at
    )
  )
  from app_social_media.drafts as draft
  where draft.id = p_draft_id;
$function$;

create function app_private.social_media_generator_system_template_version(
  p_system_key text
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_key text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_system_key, '')));
  v_version_id uuid;
begin
  select template.current_published_version_id
  into v_version_id
  from app_social_media.templates as template
  join app_social_media.template_versions as version
    on version.id = template.current_published_version_id
   and version.template_id = template.id
   and version.status = 'PUBLISHED'
  where template.system_key = v_key
    and template.is_active;

  if v_version_id is null then
    if v_key like 'LIVETICKER_%' then
      raise exception 'LIVETICKER_TEMPLATE_NOT_PUBLISHED'
        using errcode = 'P0002';
    elsif v_key like 'FANBUS_%' then
      raise exception 'FANBUS_TEMPLATE_NOT_PUBLISHED'
        using errcode = 'P0002';
    end if;
    raise exception 'SOCIAL_MEDIA_SYSTEM_TEMPLATE_NOT_PUBLISHED'
      using errcode = 'P0002';
  end if;

  return v_version_id;
end;
$function$;

create function app_private.social_media_generator_validate_system_template_document(
  p_system_key text,
  p_document jsonb
)
returns void
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_required text[];
  v_key text;
  v_element jsonb;
begin
  case p_system_key
    when 'LIVETICKER_POST', 'LIVETICKER_STORY' then
      v_required := array[
        'liveticker.headline',
        'liveticker.status',
        'liveticker.homeTeamName',
        'liveticker.awayTeamName',
        'liveticker.homeLogoHref',
        'liveticker.awayLogoHref',
        'liveticker.score',
        'liveticker.resultSuffix',
        'liveticker.goalsHeading',
        'liveticker.goalScorers'
      ];
    when 'FANBUS_POST', 'FANBUS_STORY' then
      v_required := array[
        'fanbus.destination',
        'fanbus.tripLabel',
        'fanbus.weekday',
        'fanbus.eventDate',
        'fanbus.eventTime',
        'fanbus.departureInfo',
        'fanbus.boardingStops',
        'fanbus.price',
        'fanbus.registrationDeadlineDate',
        'fanbus.registrationDeadlineTime',
        'fanbus.remainingCapacity',
        'fanbus.contact1Name',
        'fanbus.contact1Phone',
        'fanbus.contact2Name',
        'fanbus.contact2Phone'
      ];
    else
      return;
  end case;

  foreach v_key in array v_required loop
    select element.value
    into v_element
    from pg_catalog.jsonb_array_elements(p_document -> 'elements') as element(value)
    where element.value #>> '{binding,key}' = v_key
      and coalesce((element.value #>> '{binding,protected}')::boolean, false)
    limit 1;

    if v_element is null then
      raise exception 'SOCIAL_MEDIA_SYSTEM_TEMPLATE_BINDING_REQUIRED'
        using errcode = '22023', detail = v_key;
    end if;

    if v_key = 'liveticker.goalScorers'
       and v_element #>> '{binding,renderer}' is distinct from
         'liveticker-goal-scorers' then
      raise exception 'SOCIAL_MEDIA_SYSTEM_TEMPLATE_BINDING_INVALID'
        using errcode = '22023', detail = v_key;
    end if;

    if v_key = 'fanbus.boardingStops'
       and v_element #>> '{binding,renderer}' is distinct from
         'fanbus-boarding-stops' then
      raise exception 'SOCIAL_MEDIA_SYSTEM_TEMPLATE_BINDING_INVALID'
        using errcode = '22023', detail = v_key;
    end if;

    v_element := null;
  end loop;
end;
$function$;

create or replace function app_private.api_social_media_generator_template_draft_save(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_template_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'templateId', '')), ''
  )::uuid;
  v_version_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'versionId', '')), ''
  )::uuid;
  v_expected_revision bigint;
  v_name text := app_private.require_valid_name(
    p_payload ->> 'name', 'Vorlagenname'
  );
  v_category text := pg_catalog.btrim(
    coalesce(nullif(p_payload ->> 'category', ''), 'Allgemein')
  );
  v_description text := coalesce(p_payload ->> 'description', '');
  v_document jsonb := p_payload -> 'document';
  v_schema_version integer;
  v_current_revision bigint;
  v_system_key text;
  v_current_name text;
  v_current_category text;
begin
  if pg_catalog.jsonb_typeof(p_payload -> 'expectedRevision') <> 'number'
     or coalesce(p_payload ->> 'expectedRevision', '')
       !~ '^[1-9][0-9]{0,18}$' then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_EXPECTED_REVISION_INVALID'
      using errcode = '22023';
  end if;
  v_expected_revision := (p_payload ->> 'expectedRevision')::bigint;

  if pg_catalog.length(v_category) not between 1 and 80 then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_CATEGORY_INVALID'
      using errcode = '22023';
  end if;
  if pg_catalog.length(v_description) > 2000 then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_DESCRIPTION_INVALID'
      using errcode = '22023';
  end if;

  select template.system_key, template.name, template.category
  into v_system_key, v_current_name, v_current_category
  from app_social_media.templates as template
  where template.id = v_template_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_TEMPLATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_system_key is not null then
    if v_name is distinct from v_current_name
       or v_category is distinct from v_current_category then
      raise exception 'SOCIAL_MEDIA_SYSTEM_TEMPLATE_IDENTITY_LOCKED'
        using errcode = '22023';
    end if;
    perform app_private.social_media_generator_validate_system_template_document(
      v_system_key,
      v_document
    );
  end if;

  v_schema_version :=
    app_private.social_media_generator_document_schema_version(v_document);

  update app_social_media.template_versions as version
  set document = v_document,
      document_schema_version = v_schema_version,
      revision = version.revision + 1,
      updated_at = pg_catalog.now()
  where version.id = v_version_id
    and version.template_id = v_template_id
    and version.status = 'DRAFT'
    and version.revision = v_expected_revision;

  if not found then
    select version.revision
    into v_current_revision
    from app_social_media.template_versions as version
    where version.id = v_version_id
      and version.template_id = v_template_id
      and version.status = 'DRAFT';

    if not found then
      raise exception 'SOCIAL_MEDIA_TEMPLATE_DRAFT_NOT_FOUND'
        using errcode = 'P0002';
    end if;

    raise exception 'SOCIAL_MEDIA_TEMPLATE_DRAFT_VERSION_CONFLICT'
      using errcode = 'PT409',
            detail = pg_catalog.format(
              'expectedRevision=%s,currentRevision=%s',
              v_expected_revision,
              v_current_revision
            );
  end if;

  update app_social_media.templates
  set name = v_name,
      category = v_category,
      description = v_description,
      updated_at = pg_catalog.now()
  where id = v_template_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_TEMPLATE_DRAFT_SAVED',
    'social_media_generator_template',
    v_template_id::text,
    pg_catalog.jsonb_build_object(
      'versionId', v_version_id,
      'revision', v_expected_revision
    ),
    pg_catalog.jsonb_build_object(
      'versionId', v_version_id,
      'revision', v_expected_revision + 1
    )
  );

  return app_private.api_social_media_generator_template_get(
    pg_catalog.jsonb_build_object(
      'templateId', v_template_id,
      'versionId', v_version_id,
      'mode', 'DRAFT'
    )
  );
end;
$function$;

create function app_private.social_media_generator_fanbus_binding_context(
  p_trip_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_trip jsonb;
  v_trip_row app_modules.fanbus_trips%rowtype;
  v_place_name text;
  v_settings jsonb;
  v_contact jsonb;
  v_contacts jsonb;
  v_stops jsonb;
  v_weekday text;
begin
  select item.value
  into v_trip
  from pg_catalog.jsonb_array_elements(
    coalesce(public.pd_public_fanbus_trips() -> 'trips', '[]'::jsonb)
  ) as item(value)
  where item.value ->> 'tripId' = p_trip_id::text
  limit 1;

  select trip.*
  into v_trip_row
  from app_modules.fanbus_trips as trip
  where trip.id = p_trip_id
    and trip.status <> 'CANCELLED';

  if not found or v_trip is null then
    raise exception 'SOCIAL_MEDIA_FANBUS_TRIP_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select place.display_name
  into v_place_name
  from app_modules.fanbus_publishing_event_places as binding
  join app_modules.fanbus_publishing_places as place
    on place.id = binding.place_id
   and place.is_active
  where binding.event_id = v_trip_row.event_id
  limit 1;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'label', stop.label,
        'departureAt', trip_stop.departure_at,
        'display',
          case
            when trip_stop.departure_at is null then stop.label
            else pg_catalog.to_char(
              trip_stop.departure_at at time zone 'Europe/Berlin',
              'HH24:MI'
            ) || ' UHR · ' || stop.label
          end
      )
      order by trip_stop.position, trip_stop.departure_at, stop.label
    ),
    '[]'::jsonb
  )
  into v_stops
  from app_modules.fanbus_trip_boarding_stops as trip_stop
  join app_modules.fanbus_boarding_stops as stop
    on stop.id = trip_stop.boarding_stop_id
  where trip_stop.trip_id = p_trip_id
    and trip_stop.is_active
    and stop.is_active;

  v_settings := app_private.m340_fanbus_publishing_output_settings_current();
  v_contact := public.pd_public_fanbus_contact();
  v_contacts := coalesce(v_contact -> 'contacts', '[]'::jsonb);

  v_weekday := case pg_catalog.date_part(
    'isodow',
    (v_trip ->> 'eventDate')::date
  )::integer
    when 1 then 'MONTAG'
    when 2 then 'DIENSTAG'
    when 3 then 'MITTWOCH'
    when 4 then 'DONNERSTAG'
    when 5 then 'FREITAG'
    when 6 then 'SAMSTAG'
    when 7 then 'SONNTAG'
  end;

  return pg_catalog.jsonb_build_object(
    'central',
    pg_catalog.jsonb_build_object(
      'fanbus.tripId', p_trip_id,
      'fanbus.eventId', v_trip_row.event_id,
      'fanbus.destination',
        pg_catalog.upper(coalesce(
          nullif(pg_catalog.btrim(v_place_name), ''),
          nullif(pg_catalog.btrim(v_trip ->> 'venue'), ''),
          'ZIEL OFFEN'
        )),
      'fanbus.tripLabel',
        pg_catalog.upper(coalesce(
          nullif(v_settings #>> '{tripLabel,text}', ''),
          'FANBUSFAHRT'
        )),
      'fanbus.weekday', v_weekday,
      'fanbus.eventDate',
        pg_catalog.to_char((v_trip ->> 'eventDate')::date, 'DD.MM.YYYY'),
      'fanbus.eventTime',
        case
          when nullif(v_trip ->> 'eventTime', '') is null
            then 'SPIELZEIT OFFEN'
          else pg_catalog.substring(v_trip ->> 'eventTime' from 1 for 5)
            || ' UHR'
        end,
      'fanbus.price',
        case
          when nullif(v_trip ->> 'priceCents', '') is null then 'PREIS OFFEN'
          else pg_catalog.replace(
            pg_catalog.to_char(
              (v_trip ->> 'priceCents')::numeric / 100,
              'FM999990.00'
            ),
            '.',
            ','
          ) || ' €'
        end,
      'fanbus.registrationDeadlineDate',
        case
          when nullif(v_trip ->> 'registrationClosesAt', '') is null then ''
          else pg_catalog.to_char(
            (v_trip ->> 'registrationClosesAt')::timestamptz
              at time zone 'Europe/Berlin',
            'DD.MM.YYYY,'
          )
        end,
      'fanbus.registrationDeadlineTime',
        case
          when nullif(v_trip ->> 'registrationClosesAt', '') is null then ''
          else pg_catalog.to_char(
            (v_trip ->> 'registrationClosesAt')::timestamptz
              at time zone 'Europe/Berlin',
            'HH24:MI "UHR"'
          )
        end,
      'fanbus.departureAt',
        case
          when v_trip_row.departure_at is null then 'ABFAHRT OFFEN'
          else pg_catalog.to_char(
            v_trip_row.departure_at at time zone 'Europe/Berlin',
            'DD.MM.YYYY · HH24:MI'
          )
        end,
      'fanbus.departureInfo', coalesce(v_trip_row.departure_info, ''),
      'fanbus.boardingStops', v_stops,
      'fanbus.remainingCapacity',
        case
          when nullif(v_trip ->> 'remainingCapacity', '') is null then ''
          else (v_trip ->> 'remainingCapacity') || ' PLÄTZE FREI!'
        end,
      'fanbus.contact1Name',
        coalesce(v_contacts #>> '{0,name}', ''),
      'fanbus.contact1Phone',
        coalesce(v_contacts #>> '{0,phone}', ''),
      'fanbus.contact2Name',
        coalesce(v_contacts #>> '{1,name}', ''),
      'fanbus.contact2Phone',
        coalesce(v_contacts #>> '{1,phone}', '')
    )
  );
end;
$function$;

create function app_private.api_social_media_generator_fanbus_draft_create(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_trip_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'tripId', '')), ''
  )::uuid;
  v_kind text := pg_catalog.upper(
    pg_catalog.btrim(coalesce(p_payload ->> 'artifactKind', ''))
  );
  v_title text := app_private.require_valid_name(
    p_payload ->> 'title', 'Entwurfstitel'
  );
  v_system_key text;
  v_version_id uuid;
  v_document jsonb;
  v_schema_version integer;
  v_binding_context jsonb;
  v_draft_id uuid;
  v_now text := pg_catalog.now()::text;
begin
  if v_trip_id is null or v_kind not in ('POST', 'STORY') then
    raise exception 'SOCIAL_MEDIA_FANBUS_DRAFT_INPUT_INVALID'
      using errcode = '22023';
  end if;

  v_system_key := 'FANBUS_' || v_kind;
  v_version_id :=
    app_private.social_media_generator_system_template_version(v_system_key);

  select version.document, version.document_schema_version
  into v_document, v_schema_version
  from app_social_media.template_versions as version
  where version.id = v_version_id
    and version.status = 'PUBLISHED';

  v_binding_context :=
    app_private.social_media_generator_fanbus_binding_context(v_trip_id);

  v_document := pg_catalog.jsonb_set(
    v_document, '{id}',
    pg_catalog.to_jsonb(extensions.gen_random_uuid()::text), true
  );
  v_document := pg_catalog.jsonb_set(
    v_document, '{title}',
    pg_catalog.to_jsonb(v_title), true
  );
  v_document := pg_catalog.jsonb_set(
    v_document, '{metadata,templateVersionId}',
    pg_catalog.to_jsonb(v_version_id::text), true
  );
  v_document := pg_catalog.jsonb_set(
    v_document, '{metadata,createdAt}',
    pg_catalog.to_jsonb(v_now), true
  );
  v_document := pg_catalog.jsonb_set(
    v_document, '{metadata,updatedAt}',
    pg_catalog.to_jsonb(v_now), true
  );

  perform app_private.social_media_generator_document_schema_version(v_document);

  insert into app_social_media.drafts (
    owner_user_id, title, document, document_schema_version,
    version, template_version_id, binding_context, created_at, updated_at
  )
  values (
    v_user_id, v_title, v_document, v_schema_version,
    1, v_version_id, v_binding_context, pg_catalog.now(), pg_catalog.now()
  )
  returning id into v_draft_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_FANBUS_DRAFT_CREATED',
    'social_media_generator_draft',
    v_draft_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'tripId', v_trip_id,
      'artifactKind', v_kind,
      'templateVersionId', v_version_id
    )
  );

  return app_private.social_media_generator_draft_json(v_draft_id, true);
end;
$function$;

create or replace function app_private.api_social_media_generator_render_start(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_draft_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'draftId', '')),
    ''
  )::uuid;
  v_expected_version bigint;
  v_payload_binding_context jsonb := coalesce(
    p_payload -> 'bindingContext',
    '{}'::jsonb
  );
  v_binding_context jsonb;
  v_draft app_social_media.drafts%rowtype;
  v_job_id uuid;
begin
  if v_draft_id is null then
    raise exception 'SOCIAL_MEDIA_RENDER_DRAFT_ID_REQUIRED'
      using errcode = '22023';
  end if;

  if pg_catalog.jsonb_typeof(p_payload -> 'expectedVersion') <> 'number'
     or coalesce(p_payload ->> 'expectedVersion', '') !~ '^[1-9][0-9]{0,18}$' then
    raise exception 'SOCIAL_MEDIA_RENDER_EXPECTED_VERSION_INVALID'
      using errcode = '22023';
  end if;

  v_expected_version := (p_payload ->> 'expectedVersion')::bigint;

  if pg_catalog.jsonb_typeof(v_payload_binding_context) is distinct from 'object'
     or pg_catalog.octet_length(v_payload_binding_context::text) > 1048576 then
    raise exception 'SOCIAL_MEDIA_RENDER_BINDING_CONTEXT_INVALID'
      using errcode = '22023';
  end if;

  select draft.*
  into v_draft
  from app_social_media.drafts as draft
  where draft.id = v_draft_id
    and draft.owner_user_id = v_user_id;

  if not found then
    raise exception 'SOCIAL_MEDIA_DRAFT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_draft.version <> v_expected_version then
    raise exception 'SOCIAL_MEDIA_DRAFT_VERSION_CONFLICT'
      using errcode = 'PT409',
            detail = pg_catalog.format(
              'expectedVersion=%s,currentVersion=%s',
              v_expected_version,
              v_draft.version
            );
  end if;

  perform app_private.social_media_generator_document_schema_version(
    v_draft.document
  );

  v_binding_context := case
    when v_draft.binding_context <> '{}'::jsonb
      then v_draft.binding_context
    else v_payload_binding_context
  end;

  insert into app_social_media.render_jobs (
    owner_user_id,
    draft_id,
    draft_version,
    document,
    binding_context,
    compatibility_version,
    render_status,
    cloud_status,
    max_attempts
  )
  values (
    v_user_id,
    v_draft.id,
    v_draft.version,
    v_draft.document,
    v_binding_context,
    1,
    'QUEUED',
    'PENDING',
    3
  )
  returning id into v_job_id;

  perform app_private.log_audit(
    v_user_id,
    'SOCIAL_MEDIA_GENERATOR_RENDER_STARTED',
    'social_media_generator_render_job',
    v_job_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'draftId', v_draft.id,
      'draftVersion', v_draft.version,
      'templateVersionId', v_draft.template_version_id,
      'compatibilityVersion', 1
    )
  );

  return app_private.social_media_generator_render_job_json(v_job_id);
end;
$function$;

create or replace function app_private.api_social_media_generator_liveticker_render_start(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_event_id uuid := nullif(
    pg_catalog.btrim(coalesce(p_payload ->> 'eventId', '')),
    ''
  )::uuid;
  v_kind text := pg_catalog.upper(
    pg_catalog.btrim(coalesce(p_payload ->> 'kind', ''))
  );
  v_snapshot jsonb;
  v_revision integer;
  v_request_id uuid;
  v_post_template_version_id uuid;
  v_story_template_version_id uuid;
begin
  if v_event_id is null or v_kind not in ('PERIOD_1', 'PERIOD_2', 'FINAL') then
    raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_INPUT_INVALID'
      using errcode = '22023';
  end if;

  select request.id
  into v_request_id
  from app_social_media.liveticker_render_requests as request
  where request.event_id = v_event_id
    and request.graphic_kind = v_kind
    and request.status in ('QUEUED', 'PROCESSING')
  order by request.created_at desc, request.id
  limit 1;

  if found then
    return app_private.social_media_liveticker_render_request_json(v_request_id);
  end if;

  v_post_template_version_id :=
    app_private.social_media_generator_system_template_version('LIVETICKER_POST');
  v_story_template_version_id :=
    app_private.social_media_generator_system_template_version('LIVETICKER_STORY');

  v_snapshot := app_private.social_media_liveticker_render_snapshot(
    v_event_id,
    v_kind
  );
  v_revision := (v_snapshot ->> 'sourceRevision')::integer;

  insert into app_social_media.liveticker_render_requests(
    owner_user_id,
    event_id,
    graphic_kind,
    source_revision,
    source_snapshot,
    post_template_version_id,
    story_template_version_id
  )
  values (
    v_actor,
    v_event_id,
    v_kind,
    v_revision,
    v_snapshot,
    v_post_template_version_id,
    v_story_template_version_id
  )
  on conflict do nothing
  returning id into v_request_id;

  if v_request_id is null then
    select request.id
    into v_request_id
    from app_social_media.liveticker_render_requests as request
    where request.event_id = v_event_id
      and request.graphic_kind = v_kind
      and request.status in ('QUEUED', 'PROCESSING')
    order by request.created_at desc, request.id
    limit 1;

    if v_request_id is null then
      raise exception 'SOCIAL_MEDIA_LIVETICKER_RENDER_QUEUE_CONFLICT'
        using errcode = 'PT409';
    end if;

    return app_private.social_media_liveticker_render_request_json(v_request_id);
  end if;

  perform app_private.log_audit(
    v_actor,
    'SOCIAL_MEDIA_LIVETICKER_RENDER_STARTED',
    'social_media_liveticker_render_request',
    v_request_id::text,
    null,
    pg_catalog.jsonb_build_object(
      'eventId', v_event_id,
      'kind', v_kind,
      'sourceRevision', v_revision,
      'postTemplateVersionId', v_post_template_version_id,
      'storyTemplateVersionId', v_story_template_version_id
    )
  );

  return app_private.social_media_liveticker_render_request_json(v_request_id);
end;
$function$;

create or replace function public.pd_social_media_liveticker_render_worker_claim()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request app_social_media.liveticker_render_requests%rowtype;
  v_claim_token uuid := extensions.gen_random_uuid();
  v_post_document jsonb;
  v_story_document jsonb;
begin
  update app_social_media.liveticker_render_requests as request
  set status = case
        when request.attempt_count >= request.max_attempts then 'FAILED'
        else 'QUEUED'
      end,
      available_at = case
        when request.attempt_count >= request.max_attempts
        then request.available_at
        else pg_catalog.now()
      end,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      last_error_code = coalesce(
        request.last_error_code,
        'LEASE_EXPIRED'
      ),
      updated_at = pg_catalog.now()
  where request.status = 'PROCESSING'
    and request.claim_expires_at < pg_catalog.now();

  select request.*
  into v_request
  from app_social_media.liveticker_render_requests as request
  where request.status = 'QUEUED'
    and request.attempt_count < request.max_attempts
    and request.available_at <= pg_catalog.now()
  order by request.created_at, request.id
  for update skip locked
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object('claimed', false);
  end if;

  if v_request.post_template_version_id is null
     or v_request.story_template_version_id is null then
    raise exception 'LIVETICKER_TEMPLATE_NOT_PUBLISHED'
      using errcode = 'P0002';
  end if;

  select version.document
  into v_post_document
  from app_social_media.template_versions as version
  where version.id = v_request.post_template_version_id
    and version.status = 'PUBLISHED';

  select version.document
  into v_story_document
  from app_social_media.template_versions as version
  where version.id = v_request.story_template_version_id
    and version.status = 'PUBLISHED';

  if v_post_document is null or v_story_document is null then
    raise exception 'LIVETICKER_TEMPLATE_NOT_PUBLISHED'
      using errcode = 'P0002';
  end if;

  update app_social_media.liveticker_render_requests as request
  set status = 'PROCESSING',
      attempt_count = request.attempt_count + 1,
      claim_token = v_claim_token,
      claimed_at = pg_catalog.now(),
      claim_expires_at = pg_catalog.now() + interval '5 minutes',
      updated_at = pg_catalog.now()
  where request.id = v_request.id
  returning * into v_request;

  return pg_catalog.jsonb_build_object(
    'claimed', true,
    'request', pg_catalog.jsonb_build_object(
      'requestId', v_request.id,
      'claimToken', v_claim_token,
      'eventId', v_request.event_id,
      'graphicKind', v_request.graphic_kind,
      'sourceRevision', v_request.source_revision,
      'snapshot', v_request.source_snapshot,
      'templates', pg_catalog.jsonb_build_object(
        'POST', pg_catalog.jsonb_build_object(
          'versionId', v_request.post_template_version_id,
          'document', v_post_document
        ),
        'STORY', pg_catalog.jsonb_build_object(
          'versionId', v_request.story_template_version_id,
          'document', v_story_document
        )
      ),
      'attemptCount', v_request.attempt_count,
      'maxAttempts', v_request.max_attempts
    )
  );
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_social_media_system_templates_v1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_social_media_system_templates_v1()
    || array['social_media_generator_fanbus_draft_create']::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_social_media_system_templates_v1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_fanbus_draft_create' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_social_media_system_templates_v1(
      p_action
    )
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_social_media_system_templates_v1;

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
begin
  case v_action
    when 'social_media_generator_fanbus_draft_create' then
      return app_private.api_social_media_generator_fanbus_draft_create(
        coalesce(p_payload, '{}'::jsonb)
      );
    else
      return app_private.pd_api_dispatch_current_before_social_media_system_templates_v1(
        p_action,
        p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.social_media_generator_system_template_version(text),
  app_private.social_media_generator_validate_system_template_document(text, jsonb),
  app_private.social_media_generator_fanbus_binding_context(uuid),
  app_private.api_social_media_generator_fanbus_draft_create(jsonb),
  app_private.pd_api_current_actions_before_social_media_system_templates_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_social_media_system_templates_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_social_media_system_templates_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.social_media_generator_system_template_version(text),
  app_private.social_media_generator_validate_system_template_document(text, jsonb),
  app_private.social_media_generator_fanbus_binding_context(uuid),
  app_private.api_social_media_generator_fanbus_draft_create(jsonb),
  app_private.pd_api_current_actions_before_social_media_system_templates_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_social_media_system_templates_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_social_media_system_templates_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

revoke all on function
  public.pd_social_media_liveticker_render_worker_claim()
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_social_media_liveticker_render_worker_claim()
to postgres, service_role;

commit;
