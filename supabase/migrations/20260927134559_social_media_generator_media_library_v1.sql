begin;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'social-media-generator-library',
  'social-media-generator-library',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table app_social_media.media_assets (
  id uuid primary key,
  owner_user_id uuid not null
    references app_portal.users(id) on delete restrict,
  created_by uuid not null
    references app_portal.users(id) on delete restrict,
  media_type text not null,
  visibility text not null,
  original_filename text not null,
  title text not null,
  mime_type text not null,
  size_bytes bigint not null,
  width integer not null,
  height integer not null,
  sha256 text not null,
  version integer not null default 1,
  storage_bucket text not null,
  storage_object_path text not null,
  nextcloud_path text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default pg_catalog.now(),
  archived_at timestamptz,
  archived_by uuid references app_portal.users(id) on delete restrict,
  constraint social_media_assets_type_check
    check (media_type in ('UPLOAD', 'GENERAL', 'BACKGROUND')),
  constraint social_media_assets_visibility_check
    check (visibility in ('OWNER', 'SHARED')),
  constraint social_media_assets_filename_check
    check (pg_catalog.length(pg_catalog.btrim(original_filename)) between 1 and 255),
  constraint social_media_assets_title_check
    check (pg_catalog.length(pg_catalog.btrim(title)) between 1 and 160),
  constraint social_media_assets_mime_check
    check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  constraint social_media_assets_size_check
    check (size_bytes between 1 and 10485760),
  constraint social_media_assets_dimensions_check
    check (width between 1 and 12000 and height between 1 and 12000
      and width::bigint * height::bigint <= 80000000),
  constraint social_media_assets_sha_check
    check (sha256 ~ '^[a-f0-9]{64}$'),
  constraint social_media_assets_version_check check (version = 1),
  constraint social_media_assets_storage_bucket_check
    check (storage_bucket = 'social-media-generator-library'),
  constraint social_media_assets_storage_path_check
    check (storage_object_path ~ '^library/[0-9a-f-]{36}/original[.](png|jpg|webp)$'
      and pg_catalog.strpos(storage_object_path, '..') = 0),
  constraint social_media_assets_nextcloud_path_check
    check (nextcloud_path ~ '^/Library/(Uploads|General|Backgrounds)/[0-9a-f-]{36}/original[.](png|jpg|webp)$'
      and pg_catalog.strpos(nextcloud_path, '..') = 0),
  constraint social_media_assets_status_check
    check (status in ('ACTIVE', 'ARCHIVED')),
  constraint social_media_assets_archive_check
    check ((status = 'ACTIVE' and archived_at is null and archived_by is null)
      or (status = 'ARCHIVED' and archived_at is not null and archived_by is not null))
);

create unique index social_media_assets_storage_object_idx
  on app_social_media.media_assets(storage_bucket, storage_object_path);
create unique index social_media_assets_nextcloud_path_idx
  on app_social_media.media_assets(nextcloud_path);
create index social_media_assets_library_idx
  on app_social_media.media_assets(media_type, status, created_at desc, id);
create index social_media_assets_owner_idx
  on app_social_media.media_assets(owner_user_id, status, created_at desc, id);

create table app_social_media.media_uploads (
  id uuid primary key default extensions.gen_random_uuid(),
  asset_id uuid not null unique,
  owner_user_id uuid not null
    references app_portal.users(id) on delete restrict,
  media_type text not null,
  visibility text not null,
  original_filename text not null,
  title text not null,
  expected_mime_type text not null,
  expected_size_bytes bigint not null,
  expected_width integer not null,
  expected_height integer not null,
  storage_bucket text not null default 'social-media-generator-library',
  storage_object_path text not null unique,
  sha256 text,
  upload_status text not null default 'UPLOADING',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default pg_catalog.now(),
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  last_completed_claim_token uuid,
  last_error_code text,
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null default pg_catalog.now() + interval '2 hours',
  constraint social_media_uploads_type_check
    check (media_type in ('UPLOAD', 'GENERAL', 'BACKGROUND')),
  constraint social_media_uploads_visibility_check
    check (visibility in ('OWNER', 'SHARED')),
  constraint social_media_uploads_filename_check
    check (pg_catalog.length(pg_catalog.btrim(original_filename)) between 1 and 255),
  constraint social_media_uploads_title_check
    check (pg_catalog.length(pg_catalog.btrim(title)) between 1 and 160),
  constraint social_media_uploads_mime_check
    check (expected_mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  constraint social_media_uploads_size_check
    check (expected_size_bytes between 1 and 10485760),
  constraint social_media_uploads_dimensions_check
    check (expected_width between 1 and 12000 and expected_height between 1 and 12000
      and expected_width::bigint * expected_height::bigint <= 80000000),
  constraint social_media_uploads_bucket_check
    check (storage_bucket = 'social-media-generator-library'),
  constraint social_media_uploads_storage_path_check
    check (storage_object_path ~ '^library/[0-9a-f-]{36}/original[.](png|jpg|webp)$'
      and pg_catalog.strpos(storage_object_path, '..') = 0),
  constraint social_media_uploads_sha_check
    check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  constraint social_media_uploads_status_check
    check (upload_status in ('UPLOADING', 'QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  constraint social_media_uploads_attempt_check
    check (attempt_count >= 0 and max_attempts between 1 and 10),
  constraint social_media_uploads_claim_check
    check ((upload_status = 'PROCESSING' and claim_token is not null
      and claimed_at is not null and claim_expires_at is not null)
      or upload_status <> 'PROCESSING')
);

create index social_media_uploads_claim_idx
  on app_social_media.media_uploads(
    upload_status, available_at, claim_expires_at, created_at, id
  );
create index social_media_uploads_owner_idx
  on app_social_media.media_uploads(owner_user_id, created_at desc, id);

alter table app_social_media.media_assets enable row level security;
alter table app_social_media.media_uploads enable row level security;

revoke all on table
  app_social_media.media_assets,
  app_social_media.media_uploads
from public, anon, authenticated, service_role;

create function app_private.social_media_generator_media_json(
  p_media_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id', media.id,
    'type', media.media_type,
    'visibility', media.visibility,
    'filename', media.original_filename,
    'title', media.title,
    'mimeType', media.mime_type,
    'sizeBytes', media.size_bytes,
    'width', media.width,
    'height', media.height,
    'sha256', media.sha256,
    'version', media.version,
    'status', media.status,
    'createdByMe', media.created_by = p_user_id,
    'canArchive', media.status = 'ACTIVE' and media.created_by = p_user_id,
    'createdAt', media.created_at,
    'archivedAt', media.archived_at
  ))
  from app_social_media.media_assets as media
  where media.id = p_media_id
    and (media.visibility = 'SHARED' or media.owner_user_id = p_user_id);
$function$;

create function app_private.social_media_generator_upload_json(
  p_upload_id uuid,
  p_user_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
    'id', upload.id,
    'assetId', upload.asset_id,
    'type', upload.media_type,
    'title', upload.title,
    'filename', upload.original_filename,
    'status', upload.upload_status,
    'errorCode', upload.last_error_code,
    'attemptCount', upload.attempt_count,
    'maxAttempts', upload.max_attempts,
    'asset', case when upload.upload_status = 'SUCCEEDED'
      then app_private.social_media_generator_media_json(upload.asset_id, p_user_id)
      else null end,
    'createdAt', upload.created_at,
    'updatedAt', upload.updated_at
  ))
  from app_social_media.media_uploads as upload
  where upload.id = p_upload_id
    and upload.owner_user_id = p_user_id;
$function$;

create function app_private.api_social_media_generator_media_list(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_type text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_payload ->> 'type', 'UPLOAD')));
  v_search text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_payload ->> 'search', '')));
  v_media jsonb;
begin
  if v_type not in ('UPLOAD', 'GENERAL', 'BACKGROUND')
     or pg_catalog.length(v_search) > 120 then
    raise exception 'SOCIAL_MEDIA_LIBRARY_FILTER_INVALID' using errcode = '22023';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    app_private.social_media_generator_media_json(media.id, v_user_id)
    order by media.created_at desc, media.id
  ), '[]'::jsonb)
  into v_media
  from app_social_media.media_assets as media
  where media.media_type = v_type
    and media.status = 'ACTIVE'
    and (media.visibility = 'SHARED' or media.owner_user_id = v_user_id)
    and (v_search = '' or pg_catalog.lower(media.title) like '%' || v_search || '%'
      or pg_catalog.lower(media.original_filename) like '%' || v_search || '%');

  return pg_catalog.jsonb_build_object('media', v_media);
end;
$function$;

create function app_private.api_social_media_generator_media_get(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_media_id uuid := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'mediaId', '')), '')::uuid;
  v_result jsonb;
begin
  select app_private.social_media_generator_media_json(media.id, v_user_id)
  into v_result
  from app_social_media.media_assets as media
  where media.id = v_media_id
    and (media.visibility = 'SHARED' or media.owner_user_id = v_user_id);
  if not found or v_result is null then
    raise exception 'SOCIAL_MEDIA_LIBRARY_MEDIA_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_result;
end;
$function$;

create function app_private.api_social_media_generator_media_asset_authorize(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_media_id uuid := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'mediaId', '')), '')::uuid;
  v_media app_social_media.media_assets%rowtype;
begin
  select media.* into v_media
  from app_social_media.media_assets as media
  where media.id = v_media_id
    and (media.visibility = 'SHARED' or media.owner_user_id = v_user_id);
  if not found then
    raise exception 'SOCIAL_MEDIA_LIBRARY_MEDIA_NOT_FOUND' using errcode = 'P0002';
  end if;
  return pg_catalog.jsonb_build_object(
    'mediaId', v_media.id,
    'storageBucket', v_media.storage_bucket,
    'storageObjectPath', v_media.storage_object_path,
    'mimeType', v_media.mime_type,
    'sizeBytes', v_media.size_bytes,
    'sha256', v_media.sha256,
    'version', v_media.version
  );
end;
$function$;

create function app_private.api_social_media_generator_media_upload_start(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_type text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_payload ->> 'type', 'UPLOAD')));
  v_filename text := pg_catalog.btrim(coalesce(p_payload ->> 'filename', ''));
  v_title text := pg_catalog.btrim(coalesce(p_payload ->> 'title', ''));
  v_mime text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_payload ->> 'mimeType', '')));
  v_size bigint;
  v_width integer;
  v_height integer;
  v_upload_id uuid := extensions.gen_random_uuid();
  v_asset_id uuid := extensions.gen_random_uuid();
  v_extension text;
  v_path text;
begin
  if v_type not in ('UPLOAD', 'GENERAL', 'BACKGROUND')
     or pg_catalog.length(v_filename) not between 1 and 255
     or v_filename ~ '[[:cntrl:]/\\]'
     or pg_catalog.length(v_title) not between 1 and 160
     or v_mime not in ('image/png', 'image/jpeg', 'image/webp')
     or coalesce(p_payload ->> 'sizeBytes', '') !~ '^[1-9][0-9]{0,8}$'
     or coalesce(p_payload ->> 'width', '') !~ '^[1-9][0-9]{0,5}$'
     or coalesce(p_payload ->> 'height', '') !~ '^[1-9][0-9]{0,5}$' then
    raise exception 'SOCIAL_MEDIA_LIBRARY_UPLOAD_INVALID' using errcode = '22023';
  end if;
  v_size := (p_payload ->> 'sizeBytes')::bigint;
  v_width := (p_payload ->> 'width')::integer;
  v_height := (p_payload ->> 'height')::integer;
  if v_size > 10485760 or v_width > 12000 or v_height > 12000
     or v_width::bigint * v_height::bigint > 80000000 then
    raise exception 'SOCIAL_MEDIA_LIBRARY_UPLOAD_INVALID' using errcode = '22023';
  end if;
  v_extension := case v_mime when 'image/png' then 'png'
    when 'image/jpeg' then 'jpg' else 'webp' end;
  v_path := 'library/' || v_asset_id::text || '/original.' || v_extension;

  insert into app_social_media.media_uploads (
    id, asset_id, owner_user_id, media_type, visibility,
    original_filename, title, expected_mime_type, expected_size_bytes,
    expected_width, expected_height, storage_object_path
  ) values (
    v_upload_id, v_asset_id, v_user_id, v_type,
    case when v_type = 'UPLOAD' then 'OWNER' else 'SHARED' end,
    v_filename, v_title, v_mime, v_size, v_width, v_height, v_path
  );

  return pg_catalog.jsonb_build_object(
    'uploadId', v_upload_id,
    'assetId', v_asset_id,
    'environment', app_private.platform_release_environment(),
    'storageBucket', 'social-media-generator-library',
    'storageObjectPath', v_path,
    'status', 'UPLOADING'
  );
end;
$function$;

create function app_private.api_social_media_generator_media_upload_get(
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_upload_id uuid := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'uploadId', '')), '')::uuid;
  v_result jsonb;
begin
  v_result := app_private.social_media_generator_upload_json(v_upload_id, v_user_id);
  if v_result is null then
    raise exception 'SOCIAL_MEDIA_LIBRARY_UPLOAD_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_result;
end;
$function$;

create function app_private.api_social_media_generator_media_archive(
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := app_private.social_media_generator_require_access();
  v_media_id uuid := nullif(pg_catalog.btrim(coalesce(p_payload ->> 'mediaId', '')), '')::uuid;
begin
  update app_social_media.media_assets as media
  set status = 'ARCHIVED', archived_at = pg_catalog.now(), archived_by = v_user_id
  where media.id = v_media_id and media.created_by = v_user_id and media.status = 'ACTIVE';
  if not found then
    raise exception 'SOCIAL_MEDIA_LIBRARY_ARCHIVE_NOT_ALLOWED' using errcode = '42501';
  end if;
  perform app_private.log_audit(v_user_id, 'SOCIAL_MEDIA_LIBRARY_MEDIA_ARCHIVED',
    'social_media_media_asset', v_media_id::text, null,
    pg_catalog.jsonb_build_object('status', 'ARCHIVED'));
  return app_private.social_media_generator_media_json(v_media_id, v_user_id);
end;
$function$;

create function public.pd_social_media_library_upload_queue(
  p_upload_id uuid,
  p_storage_path text,
  p_sha256 text,
  p_size_bytes bigint,
  p_mime_type text,
  p_width integer,
  p_height integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_upload app_social_media.media_uploads%rowtype;
begin
  select upload.* into v_upload
  from app_social_media.media_uploads as upload
  where upload.id = p_upload_id
  for update;
  if not found or v_upload.upload_status <> 'UPLOADING'
     or v_upload.expires_at < pg_catalog.now()
     or p_storage_path <> v_upload.storage_object_path
     or p_sha256 !~ '^[a-f0-9]{64}$'
     or p_size_bytes <> v_upload.expected_size_bytes
     or p_mime_type <> v_upload.expected_mime_type
     or p_width <> v_upload.expected_width
     or p_height <> v_upload.expected_height
     or not exists (
       select 1 from storage.objects as object
       where object.bucket_id = v_upload.storage_bucket
         and object.name = v_upload.storage_object_path
     ) then
    raise exception 'SOCIAL_MEDIA_LIBRARY_UPLOAD_QUEUE_INVALID' using errcode = '22023';
  end if;

  update app_social_media.media_uploads as upload
  set upload_status = 'QUEUED', sha256 = p_sha256,
      available_at = pg_catalog.now(), updated_at = pg_catalog.now()
  where upload.id = p_upload_id;
  return pg_catalog.jsonb_build_object(
    'uploadId', p_upload_id, 'assetId', v_upload.asset_id, 'status', 'QUEUED'
  );
end;
$function$;

create function public.pd_social_media_library_worker_claim()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_upload app_social_media.media_uploads%rowtype;
  v_token uuid;
  v_environment text := app_private.platform_release_environment();
begin
  if v_environment not in ('DEV', 'PROD') then
    raise exception 'SOCIAL_MEDIA_LIBRARY_ENVIRONMENT_INVALID' using errcode = '55000';
  end if;
  select upload.* into v_upload
  from app_social_media.media_uploads as upload
  where ((upload.upload_status = 'QUEUED' and upload.available_at <= pg_catalog.now())
      or (upload.upload_status = 'PROCESSING' and upload.claim_expires_at < pg_catalog.now()))
    and upload.attempt_count < upload.max_attempts
  order by upload.available_at, upload.created_at, upload.id
  for update skip locked limit 1;
  if not found then
    return pg_catalog.jsonb_build_object('claimed', false);
  end if;
  v_token := extensions.gen_random_uuid();
  update app_social_media.media_uploads as upload
  set upload_status = 'PROCESSING', attempt_count = upload.attempt_count + 1,
      claim_token = v_token, claimed_at = pg_catalog.now(),
      claim_expires_at = pg_catalog.now() + interval '10 minutes',
      last_error_code = null, updated_at = pg_catalog.now()
  where upload.id = v_upload.id returning upload.* into v_upload;
  return pg_catalog.jsonb_build_object('claimed', true, 'job', pg_catalog.jsonb_build_object(
    'uploadId', v_upload.id,
    'assetId', v_upload.asset_id,
    'claimToken', v_upload.claim_token,
    'environment', v_environment,
    'type', v_upload.media_type,
    'filename', v_upload.original_filename,
    'title', v_upload.title,
    'storageBucket', v_upload.storage_bucket,
    'storageObjectPath', v_upload.storage_object_path,
    'mimeType', v_upload.expected_mime_type,
    'sizeBytes', v_upload.expected_size_bytes,
    'width', v_upload.expected_width,
    'height', v_upload.expected_height,
    'sha256', v_upload.sha256,
    'attemptCount', v_upload.attempt_count,
    'maxAttempts', v_upload.max_attempts,
    'claimExpiresAt', v_upload.claim_expires_at
  ));
end;
$function$;

create function public.pd_social_media_library_worker_heartbeat(
  p_upload_id uuid,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expires_at timestamptz;
begin
  update app_social_media.media_uploads as upload
  set claim_expires_at = pg_catalog.now() + interval '10 minutes',
      updated_at = pg_catalog.now()
  where upload.id = p_upload_id and upload.upload_status = 'PROCESSING'
    and upload.claim_token = p_claim_token
    and upload.claim_expires_at >= pg_catalog.now() - interval '2 minutes'
  returning upload.claim_expires_at into v_expires_at;
  if not found then
    raise exception 'SOCIAL_MEDIA_LIBRARY_CLAIM_INVALID' using errcode = '40001';
  end if;
  return pg_catalog.jsonb_build_object('heartbeat', true, 'claimExpiresAt', v_expires_at);
end;
$function$;

create function public.pd_social_media_library_worker_complete(
  p_upload_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error_code text,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_upload app_social_media.media_uploads%rowtype;
  v_retry boolean;
  v_nextcloud_path text;
  v_expected_path text;
  v_extension text;
begin
  select upload.* into v_upload
  from app_social_media.media_uploads as upload
  where upload.id = p_upload_id for update;
  if not found then
    raise exception 'SOCIAL_MEDIA_LIBRARY_UPLOAD_NOT_FOUND' using errcode = '22023';
  end if;
  if v_upload.last_completed_claim_token = p_claim_token then
    return pg_catalog.jsonb_build_object('completed', true,
      'status', v_upload.upload_status, 'idempotent', true);
  end if;
  if v_upload.upload_status <> 'PROCESSING'
     or v_upload.claim_token is distinct from p_claim_token then
    raise exception 'SOCIAL_MEDIA_LIBRARY_CLAIM_INVALID' using errcode = '40001';
  end if;

  if p_success then
    v_extension := case v_upload.expected_mime_type when 'image/png' then 'png'
      when 'image/jpeg' then 'jpg' else 'webp' end;
    v_expected_path := '/Library/' || case v_upload.media_type
      when 'UPLOAD' then 'Uploads' when 'GENERAL' then 'General'
      else 'Backgrounds' end || '/' || v_upload.asset_id::text
      || '/original.' || v_extension;
    v_nextcloud_path := coalesce(p_result ->> 'nextcloudPath', '');
    if pg_catalog.jsonb_typeof(p_result) is distinct from 'object'
       or v_nextcloud_path <> v_expected_path
       or coalesce(p_result ->> 'mimeType', '') <> v_upload.expected_mime_type
       or coalesce(p_result ->> 'sha256', '') <> v_upload.sha256
       or coalesce(p_result ->> 'sizeBytes', '') <> v_upload.expected_size_bytes::text
       or coalesce(p_result ->> 'width', '') <> v_upload.expected_width::text
       or coalesce(p_result ->> 'height', '') <> v_upload.expected_height::text then
      raise exception 'SOCIAL_MEDIA_LIBRARY_RESULT_INVALID' using errcode = '22023';
    end if;

    insert into app_social_media.media_assets (
      id, owner_user_id, created_by, media_type, visibility,
      original_filename, title, mime_type, size_bytes, width, height,
      sha256, version, storage_bucket, storage_object_path, nextcloud_path
    ) values (
      v_upload.asset_id, v_upload.owner_user_id, v_upload.owner_user_id,
      v_upload.media_type, v_upload.visibility, v_upload.original_filename,
      v_upload.title, v_upload.expected_mime_type, v_upload.expected_size_bytes,
      v_upload.expected_width, v_upload.expected_height, v_upload.sha256, 1,
      v_upload.storage_bucket, v_upload.storage_object_path, v_nextcloud_path
    ) on conflict (id) do nothing;

    update app_social_media.media_uploads as upload
    set upload_status = 'SUCCEEDED', last_error_code = null,
        last_completed_claim_token = p_claim_token,
        claim_token = null, claimed_at = null, claim_expires_at = null,
        updated_at = pg_catalog.now()
    where upload.id = p_upload_id returning upload.* into v_upload;
  else
    if p_error_code is null or p_error_code !~ '^[A-Z0-9_:-]{1,80}$'
       or p_result is not null then
      raise exception 'SOCIAL_MEDIA_LIBRARY_ERROR_INVALID' using errcode = '22023';
    end if;
    v_retry := v_upload.attempt_count < v_upload.max_attempts;
    update app_social_media.media_uploads as upload
    set upload_status = case when v_retry then 'QUEUED' else 'FAILED' end,
        available_at = case when v_retry then pg_catalog.now()
          + pg_catalog.make_interval(secs => least(120, 15 * greatest(1, v_upload.attempt_count)))
          else upload.available_at end,
        last_error_code = p_error_code,
        last_completed_claim_token = p_claim_token,
        claim_token = null, claimed_at = null, claim_expires_at = null,
        updated_at = pg_catalog.now()
    where upload.id = p_upload_id returning upload.* into v_upload;
  end if;
  return pg_catalog.jsonb_build_object('completed', true,
    'status', v_upload.upload_status, 'idempotent', false);
end;
$function$;

create function app_private.social_media_generator_library_refs_valid(
  p_document jsonb
)
returns boolean
language sql
immutable
security invoker
set search_path = ''
as $function$
  with recursive nodes(element) as (
    select item.value
    from pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(p_document -> 'elements') = 'array'
        then p_document -> 'elements' else '[]'::jsonb end
    ) as item(value)
    union all
    select child.value
    from nodes as parent
    cross join lateral pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(parent.element -> 'children') = 'array'
        then parent.element -> 'children' else '[]'::jsonb end
    ) as child(value)
  )
  select not exists (
    select 1 from nodes
    where element #>> '{mediaRef,source}' = 'library'
      and (
        element ->> 'type' not in ('image', 'logo', 'background')
        or element ? 'href'
        or coalesce(element ->> 'mediaId', '')
          <> coalesce(element #>> '{mediaRef,mediaId}', '')
        or coalesce(element #>> '{mediaRef,mediaId}', '')
          !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or coalesce(element #>> '{mediaRef,version}', '') !~ '^[1-9][0-9]{0,8}$'
        or coalesce(element #>> '{mediaRef,sha256}', '') !~ '^[a-f0-9]{64}$'
        or pg_catalog.length(pg_catalog.btrim(
          coalesce(element #>> '{mediaRef,name}', '')
        )) not between 1 and 160
      )
  );
$function$;

alter table app_social_media.drafts
  add constraint social_media_drafts_library_refs_check
  check (app_private.social_media_generator_library_refs_valid(document));
alter table app_social_media.template_versions
  add constraint social_media_template_versions_library_refs_check
  check (app_private.social_media_generator_library_refs_valid(document));

create function app_private.social_media_generator_build_media_manifest(
  p_document jsonb,
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_manifest jsonb;
  v_reference_count bigint;
  v_resolved_count bigint;
begin
  with recursive nodes(element) as (
    select item.value from pg_catalog.jsonb_array_elements(p_document -> 'elements') item(value)
    union all
    select child.value from nodes parent
    cross join lateral pg_catalog.jsonb_array_elements(
      case when pg_catalog.jsonb_typeof(parent.element -> 'children') = 'array'
        then parent.element -> 'children' else '[]'::jsonb end
    ) child(value)
  ), media_refs as (
    select distinct
      (element #>> '{mediaRef,mediaId}')::uuid as media_id,
      (element #>> '{mediaRef,version}')::integer as version,
      element #>> '{mediaRef,sha256}' as sha256
    from nodes where element #>> '{mediaRef,source}' = 'library'
  ), resolved as (
    select reference.media_id, media.version, media.sha256, media.mime_type,
      media.size_bytes, media.width, media.height, media.nextcloud_path
    from media_refs as reference
    join app_social_media.media_assets media
      on media.id = reference.media_id
     and media.version = reference.version
     and media.sha256 = reference.sha256
     and (media.visibility = 'SHARED' or media.owner_user_id = p_user_id)
  )
  select (select count(*) from media_refs), count(*),
    coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'mediaId', resolved.media_id, 'version', resolved.version,
      'sha256', resolved.sha256, 'mimeType', resolved.mime_type,
      'sizeBytes', resolved.size_bytes, 'width', resolved.width,
      'height', resolved.height, 'nextcloudPath', resolved.nextcloud_path
    ) order by resolved.media_id), '[]'::jsonb)
  into v_reference_count, v_resolved_count, v_manifest
  from resolved;
  if v_reference_count <> v_resolved_count then
    raise exception 'SOCIAL_MEDIA_LIBRARY_REFERENCE_INVALID' using errcode = '22023';
  end if;
  return v_manifest;
end;
$function$;

alter table app_social_media.render_jobs
  add column media_manifest jsonb not null default '[]'::jsonb,
  add constraint social_media_render_jobs_media_manifest_check
    check (pg_catalog.jsonb_typeof(media_manifest) = 'array');

create function app_private.social_media_generator_render_media_manifest_set()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  new.media_manifest := app_private.social_media_generator_build_media_manifest(
    new.document, new.owner_user_id
  );
  return new;
end;
$function$;

create trigger social_media_render_jobs_media_manifest_before_insert
before insert on app_social_media.render_jobs
for each row execute function app_private.social_media_generator_render_media_manifest_set();

create or replace function public.pd_social_media_render_worker_claim()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job app_social_media.render_jobs%rowtype;
  v_token uuid;
  v_environment text := app_private.platform_release_environment();
begin
  if v_environment not in ('DEV', 'PROD') then
    raise exception 'SOCIAL_MEDIA_RENDER_ENVIRONMENT_INVALID' using errcode = '55000';
  end if;
  select job.* into v_job
  from app_social_media.render_jobs as job
  where ((job.render_status = 'QUEUED' and job.available_at <= pg_catalog.now())
      or (job.render_status = 'PROCESSING' and job.claim_expires_at < pg_catalog.now()))
    and job.attempt_count < job.max_attempts
  order by job.available_at, job.created_at, job.id
  for update skip locked limit 1;
  if not found then
    return pg_catalog.jsonb_build_object('claimed', false);
  end if;
  v_token := extensions.gen_random_uuid();
  update app_social_media.render_jobs as job
  set render_status = 'PROCESSING', attempt_count = job.attempt_count + 1,
      claim_token = v_token, claimed_at = pg_catalog.now(),
      claim_expires_at = pg_catalog.now() + interval '10 minutes',
      last_render_error_code = null, updated_at = pg_catalog.now()
  where job.id = v_job.id returning job.* into v_job;
  return pg_catalog.jsonb_build_object('claimed', true, 'job', pg_catalog.jsonb_build_object(
    'jobId', v_job.id,
    'claimToken', v_job.claim_token,
    'environment', v_environment,
    'draftId', v_job.draft_id,
    'draftVersion', v_job.draft_version,
    'document', v_job.document,
    'bindingContext', v_job.binding_context,
    'mediaManifest', v_job.media_manifest,
    'compatibilityVersion', v_job.compatibility_version,
    'attemptCount', v_job.attempt_count,
    'maxAttempts', v_job.max_attempts,
    'claimExpiresAt', v_job.claim_expires_at
  ));
end;
$function$;

alter function app_private.pd_api_current_actions()
  rename to pd_api_current_actions_before_sm_media_library_v1;

create function app_private.pd_api_current_actions()
returns text[]
language sql
stable
security invoker
set search_path = ''
as $function$
  select app_private.pd_api_current_actions_before_sm_media_library_v1()
    || array[
      'social_media_generator_media_list',
      'social_media_generator_media_get',
      'social_media_generator_media_asset_authorize',
      'social_media_generator_media_upload_start',
      'social_media_generator_media_upload_get',
      'social_media_generator_media_archive'
    ]::text[];
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_sm_media_library_v1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
security invoker
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'social_media_generator_media_list' then 'READ'
    when 'social_media_generator_media_get' then 'READ'
    when 'social_media_generator_media_asset_authorize' then 'READ'
    when 'social_media_generator_media_upload_start' then 'USER_MUTATION'
    when 'social_media_generator_media_upload_get' then 'READ'
    when 'social_media_generator_media_archive' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_sm_media_library_v1(p_action)
  end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_sm_media_library_v1;

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
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  case v_action
    when 'social_media_generator_media_list' then
      return app_private.api_social_media_generator_media_list(v_payload);
    when 'social_media_generator_media_get' then
      return app_private.api_social_media_generator_media_get(v_payload);
    when 'social_media_generator_media_asset_authorize' then
      return app_private.api_social_media_generator_media_asset_authorize(v_payload);
    when 'social_media_generator_media_upload_start' then
      return app_private.api_social_media_generator_media_upload_start(v_payload);
    when 'social_media_generator_media_upload_get' then
      return app_private.api_social_media_generator_media_upload_get(v_payload);
    when 'social_media_generator_media_archive' then
      return app_private.api_social_media_generator_media_archive(v_payload);
    else
      return app_private.pd_api_dispatch_current_before_sm_media_library_v1(
        p_action, p_payload
      );
  end case;
end;
$function$;

revoke all on function
  app_private.social_media_generator_media_json(uuid, uuid),
  app_private.social_media_generator_upload_json(uuid, uuid),
  app_private.api_social_media_generator_media_list(jsonb),
  app_private.api_social_media_generator_media_get(jsonb),
  app_private.api_social_media_generator_media_asset_authorize(jsonb),
  app_private.api_social_media_generator_media_upload_start(jsonb),
  app_private.api_social_media_generator_media_upload_get(jsonb),
  app_private.api_social_media_generator_media_archive(jsonb),
  app_private.social_media_generator_library_refs_valid(jsonb),
  app_private.social_media_generator_build_media_manifest(jsonb, uuid),
  app_private.social_media_generator_render_media_manifest_set(),
  app_private.pd_api_current_actions_before_sm_media_library_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_media_library_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_media_library_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  app_private.social_media_generator_media_json(uuid, uuid),
  app_private.social_media_generator_upload_json(uuid, uuid),
  app_private.api_social_media_generator_media_list(jsonb),
  app_private.api_social_media_generator_media_get(jsonb),
  app_private.api_social_media_generator_media_asset_authorize(jsonb),
  app_private.api_social_media_generator_media_upload_start(jsonb),
  app_private.api_social_media_generator_media_upload_get(jsonb),
  app_private.api_social_media_generator_media_archive(jsonb),
  app_private.social_media_generator_library_refs_valid(jsonb),
  app_private.social_media_generator_build_media_manifest(jsonb, uuid),
  app_private.social_media_generator_render_media_manifest_set(),
  app_private.pd_api_current_actions_before_sm_media_library_v1(),
  app_private.pd_api_current_actions(),
  app_private.platform_action_classification_before_sm_media_library_v1(text),
  app_private.platform_action_classification(text),
  app_private.pd_api_dispatch_current_before_sm_media_library_v1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb)
to postgres;

revoke all on function
  public.pd_social_media_library_upload_queue(uuid, text, text, bigint, text, integer, integer),
  public.pd_social_media_library_worker_claim(),
  public.pd_social_media_library_worker_heartbeat(uuid, uuid),
  public.pd_social_media_library_worker_complete(uuid, uuid, boolean, text, jsonb),
  public.pd_social_media_render_worker_claim()
from public, anon, authenticated, service_role;

grant execute on function
  public.pd_social_media_library_upload_queue(uuid, text, text, bigint, text, integer, integer),
  public.pd_social_media_library_worker_claim(),
  public.pd_social_media_library_worker_heartbeat(uuid, uuid),
  public.pd_social_media_library_worker_complete(uuid, uuid, boolean, text, jsonb),
  public.pd_social_media_render_worker_claim()
to service_role;

commit;
