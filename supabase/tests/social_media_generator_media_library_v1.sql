\set ON_ERROR_STOP on

begin;

do $social_media_generator_media_library_v1$
declare
  v_admin uuid := '00000000-0000-4210-8000-000000000001';
  v_user uuid := '00000000-0000-4210-8000-000000000002';
  v_denied uuid := '00000000-0000-4210-8000-000000000003';
  v_response jsonb;
  v_claim jsonb;
  v_upload_id uuid;
  v_asset_id uuid;
  v_draft_id uuid;
  v_document jsonb;
  v_sha text := repeat('a', 64);
begin
  update app_portal.settings
  set value = pg_catalog.jsonb_set(value, '{environment}', '"DEV"'::jsonb, true)
  where key = 'platform.mode';

  insert into auth.users (id, email) values
    (v_admin, 'smg-library-admin@example.invalid'),
    (v_user, 'smg-library-user@example.invalid'),
    (v_denied, 'smg-library-denied@example.invalid');

  insert into app_portal.users (
    id, user_code, email, first_name, last_name, status, role_id
  ) values
    (v_admin, 'U-SMG-LIB-ADMIN', 'smg-library-admin@example.invalid',
      'Library', 'Admin', 'ACTIVE', '00000000-0000-4000-8000-000000000001'),
    (v_user, 'U-SMG-LIB-USER', 'smg-library-user@example.invalid',
      'Library', 'User', 'ACTIVE', '00000000-0000-4000-8000-000000000003'),
    (v_denied, 'U-SMG-LIB-DENIED', 'smg-library-denied@example.invalid',
      'Library', 'Denied', 'ACTIVE', '00000000-0000-4000-8000-000000000003');

  insert into app_portal.user_capabilities (
    user_id, capability_code, created_by
  ) values (v_user, 'social_media_generator.use', v_admin);

  if pg_catalog.has_table_privilege('authenticated', 'app_social_media.media_assets', 'select')
     or pg_catalog.has_table_privilege('authenticated', 'app_social_media.media_uploads', 'select')
     or pg_catalog.has_function_privilege(
       'authenticated', 'public.pd_social_media_library_worker_claim()', 'execute'
     ) then
    raise exception 'Private Medienobjekte oder Worker-RPC sind fuer Browserrollen offen.';
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_denied::text, true);
  v_response := public.pd_api(
    'social_media_generator_media_list', '{"type":"UPLOAD"}'::jsonb
  );
  if coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{error,code}' <> '42501' then
    raise exception 'Unberechtigte Medienliste wurde nicht abgewiesen: %', v_response;
  end if;

  perform pg_catalog.set_config('request.jwt.claim.sub', v_user::text, true);
  v_response := public.pd_api(
    'social_media_generator_media_upload_start',
    pg_catalog.jsonb_build_object(
      'type', 'UPLOAD', 'filename', 'motiv.png', 'title', 'Testmotiv',
      'mimeType', 'image/png', 'sizeBytes', 1234, 'width', 600, 'height', 400
    )
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,status}' <> 'UPLOADING' then
    raise exception 'Upload-Autorisierung ist falsch: %', v_response;
  end if;
  v_upload_id := (v_response #>> '{data,uploadId}')::uuid;
  v_asset_id := (v_response #>> '{data,assetId}')::uuid;

  insert into storage.objects(bucket_id, name)
  values (
    'social-media-generator-library',
    v_response #>> '{data,storageObjectPath}'
  );

  perform public.pd_social_media_library_upload_queue(
    v_upload_id,
    v_response #>> '{data,storageObjectPath}',
    v_sha, 1234, 'image/png', 600, 400
  );
  v_claim := public.pd_social_media_library_worker_claim();
  if not coalesce((v_claim ->> 'claimed')::boolean, false)
     or v_claim #>> '{job,uploadId}' <> v_upload_id::text
     or v_claim #>> '{job,assetId}' <> v_asset_id::text then
    raise exception 'Medien-Worker-Claim ist falsch: %', v_claim;
  end if;

  perform public.pd_social_media_library_worker_complete(
    v_upload_id,
    (v_claim #>> '{job,claimToken}')::uuid,
    true,
    null,
    pg_catalog.jsonb_build_object(
      'nextcloudPath', '/Library/Uploads/' || v_asset_id::text || '/original.png',
      'mimeType', 'image/png', 'sha256', v_sha, 'sizeBytes', 1234,
      'width', 600, 'height', 400
    )
  );

  v_response := public.pd_api(
    'social_media_generator_media_list', '{"type":"UPLOAD"}'::jsonb
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,media,0,id}' <> v_asset_id::text
     or v_response #>> '{data,media,0,sha256}' <> v_sha
     or not coalesce((v_response #>> '{data,media,0,canArchive}')::boolean, false) then
    raise exception 'Aktive Medienliste ist falsch: %', v_response;
  end if;

  v_document := pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'id', 'media-library-document',
    'title', 'Medienbibliothek',
    'format', pg_catalog.jsonb_build_object('width', 1080, 'height', 1080),
    'elements', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id', 'library-image', 'type', 'image', 'x', 0, 'y', 0,
      'width', 1080, 'height', 720, 'rotation', 0,
      'mediaId', v_asset_id,
      'mediaRef', pg_catalog.jsonb_build_object(
        'source', 'library', 'mediaId', v_asset_id, 'version', 1,
        'sha256', v_sha, 'name', 'Testmotiv'
      )
    )),
    'metadata', pg_catalog.jsonb_build_object(
      'createdAt', '2026-09-27T00:00:00.000Z',
      'updatedAt', '2026-09-27T00:00:00.000Z'
    )
  );
  if v_document::text like '%base64%' or v_document #> '{elements,0}' ? 'href' then
    raise exception 'Draft enthaelt persistente Bilddaten oder URL.';
  end if;

  v_response := public.pd_api(
    'social_media_generator_draft_create',
    pg_catalog.jsonb_build_object('title', 'Medientest', 'document', v_document)
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Draft mit Medienreferenz wurde nicht angelegt: %', v_response;
  end if;
  v_draft_id := (v_response #>> '{data,id}')::uuid;

  v_response := public.pd_api(
    'social_media_generator_render_start',
    pg_catalog.jsonb_build_object('draftId', v_draft_id, 'expectedVersion', 1)
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Renderjob mit Medienreferenz wurde nicht angelegt: %', v_response;
  end if;
  if not exists (
    select 1 from app_social_media.render_jobs as job
    where job.id = (v_response #>> '{data,id}')::uuid
      and job.media_manifest #>> '{0,mediaId}' = v_asset_id::text
      and job.media_manifest #>> '{0,sha256}' = v_sha
      and job.media_manifest #>> '{0,nextcloudPath}' =
        '/Library/Uploads/' || v_asset_id::text || '/original.png'
  ) then
    raise exception 'Renderjob hat keine eingefrorene Medienversion.';
  end if;

  v_response := public.pd_api(
    'social_media_generator_media_archive',
    pg_catalog.jsonb_build_object('mediaId', v_asset_id)
  );
  if not coalesce((v_response ->> 'ok')::boolean, false)
     or v_response #>> '{data,status}' <> 'ARCHIVED' then
    raise exception 'Archivierung ist falsch: %', v_response;
  end if;
  v_response := public.pd_api(
    'social_media_generator_media_list', '{"type":"UPLOAD"}'::jsonb
  );
  if pg_catalog.jsonb_array_length(v_response #> '{data,media}') <> 0 then
    raise exception 'Archiviertes Medium bleibt in der aktiven Liste: %', v_response;
  end if;

  v_response := public.pd_api(
    'social_media_generator_render_start',
    pg_catalog.jsonb_build_object('draftId', v_draft_id, 'expectedVersion', 1)
  );
  if not coalesce((v_response ->> 'ok')::boolean, false) then
    raise exception 'Archivierung hat historischen Draft zerstoert: %', v_response;
  end if;
end
$social_media_generator_media_library_v1$;

rollback;
