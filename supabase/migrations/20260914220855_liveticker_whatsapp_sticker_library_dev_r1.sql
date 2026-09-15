-- DEV only: managed WhatsApp sticker library and durable sticker references.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'liveticker-whatsapp-stickers',
  'liveticker-whatsapp-stickers',
  false,
  102400,
  array['image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table app_modules.liveticker_whatsapp_stickers (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  storage_path text not null unique,
  mime_type text not null default 'image/webp',
  active boolean not null default true,
  sort_order integer not null default 100,
  width integer not null,
  height integer not null,
  file_size integer not null,
  sha256 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references app_portal.users(id) on delete set null,
  updated_by uuid references app_portal.users(id) on delete set null,
  constraint liveticker_whatsapp_stickers_name_check
    check (char_length(btrim(name)) between 1 and 80),
  constraint liveticker_whatsapp_stickers_slug_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}$'),
  constraint liveticker_whatsapp_stickers_storage_path_check
    check (storage_path ~ '^stickers/dev/[0-9a-f-]{36}[.]webp$' and storage_path !~ '[?#\\]'),
  constraint liveticker_whatsapp_stickers_mime_check
    check (mime_type = 'image/webp'),
  constraint liveticker_whatsapp_stickers_sort_check
    check (sort_order between 0 and 9999),
  constraint liveticker_whatsapp_stickers_dimensions_check
    check (width = 512 and height = 512),
  constraint liveticker_whatsapp_stickers_size_check
    check (file_size between 1 and 102400),
  constraint liveticker_whatsapp_stickers_sha_check
    check (sha256 ~ '^[0-9a-f]{64}$')
);

create index liveticker_whatsapp_stickers_picker_idx
  on app_modules.liveticker_whatsapp_stickers(sort_order, name, id)
  where active;

alter table app_modules.liveticker_whatsapp_stickers enable row level security;
revoke all on table app_modules.liveticker_whatsapp_stickers
  from public, anon, authenticated, service_role;
grant select on table app_modules.liveticker_whatsapp_stickers to service_role;

alter table app_modules.liveticker_whatsapp_jobs
  add column sticker_id uuid
  references app_modules.liveticker_whatsapp_stickers(id) on delete restrict;

create index liveticker_whatsapp_jobs_sticker_idx
  on app_modules.liveticker_whatsapp_jobs(sticker_id)
  where sticker_id is not null;

create function app_private.api_liveticker_whatsapp_stickers_list(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_include_inactive boolean := coalesce((p_payload ->> 'includeInactive')::boolean, false);
begin
  perform app_private.liveticker_require_operator();
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['includeInactive']::text[] <> '{}'::jsonb
     or (p_payload ? 'includeInactive' and pg_catalog.jsonb_typeof(p_payload -> 'includeInactive') <> 'boolean') then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_LIST_INVALID' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'stickers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sticker.id,
        'name', sticker.name,
        'slug', sticker.slug,
        'mimeType', sticker.mime_type,
        'active', sticker.active,
        'sortOrder', sticker.sort_order,
        'width', sticker.width,
        'height', sticker.height,
        'fileSize', sticker.file_size,
        'createdAt', sticker.created_at,
        'updatedAt', sticker.updated_at
      ) order by sticker.sort_order, sticker.name, sticker.id)
      from app_modules.liveticker_whatsapp_stickers as sticker
      where v_include_inactive or sticker.active
    ), '[]'::jsonb)
  );
end;
$function$;

create function app_private.api_liveticker_whatsapp_sticker_upload_authorize(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_name text := pg_catalog.btrim(coalesce(p_payload ->> 'name', ''));
  v_filename text := pg_catalog.btrim(coalesce(p_payload ->> 'filename', ''));
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['name', 'filename']::text[] <> '{}'::jsonb
     or char_length(v_name) not between 1 and 80
     or char_length(v_filename) not between 5 and 160
     or v_filename !~* '^[A-Za-z0-9ÄÖÜäöüß._ -]+[.](png|webp)$' then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UPLOAD_INVALID' using errcode = '22023';
  end if;
  return jsonb_build_object('actorId', v_actor, 'environment', 'DEV', 'name', v_name, 'filename', v_filename);
end;
$function$;

create function app_private.api_liveticker_whatsapp_sticker_asset_authorize(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_sticker app_modules.liveticker_whatsapp_stickers%rowtype;
begin
  perform app_private.liveticker_require_operator();
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['stickerId']::text[] <> '{}'::jsonb
     or pg_catalog.jsonb_typeof(p_payload -> 'stickerId') <> 'string'
     or (p_payload ->> 'stickerId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_ASSET_INVALID' using errcode = '22023';
  end if;
  v_id := (p_payload ->> 'stickerId')::uuid;
  select * into v_sticker from app_modules.liveticker_whatsapp_stickers where id = v_id;
  if not found then raise exception 'LIVETICKER_WHATSAPP_STICKER_UNKNOWN' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'id', v_sticker.id,
    'storagePath', v_sticker.storage_path,
    'mimeType', v_sticker.mime_type,
    'fileSize', v_sticker.file_size,
    'sha256', v_sticker.sha256
  );
end;
$function$;

create function app_private.api_liveticker_whatsapp_sticker_set_active(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_id uuid;
  v_active boolean;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['stickerId', 'active']::text[] <> '{}'::jsonb
     or pg_catalog.jsonb_typeof(p_payload -> 'stickerId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'active') <> 'boolean'
     or (p_payload ->> 'stickerId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UPDATE_INVALID' using errcode = '22023';
  end if;
  v_id := (p_payload ->> 'stickerId')::uuid;
  v_active := (p_payload ->> 'active')::boolean;
  update app_modules.liveticker_whatsapp_stickers
  set active = v_active, updated_at = now(), updated_by = v_actor
  where id = v_id;
  if not found then raise exception 'LIVETICKER_WHATSAPP_STICKER_UNKNOWN' using errcode = 'P0002'; end if;
  return app_private.api_liveticker_whatsapp_stickers_list(jsonb_build_object('includeInactive', true));
end;
$function$;

create function public.pd_liveticker_whatsapp_sticker_activate(
  p_actor uuid,
  p_sticker_id uuid,
  p_name text,
  p_slug text,
  p_storage_path text,
  p_mime_type text,
  p_sha256 text,
  p_file_size integer,
  p_width integer,
  p_height integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sort integer;
  v_sticker app_modules.liveticker_whatsapp_stickers%rowtype;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_actor is null
     or not app_private.has_capability(p_actor, 'liveticker.manage')
     or p_sticker_id is null
     or char_length(pg_catalog.btrim(coalesce(p_name, ''))) not between 1 and 80
     or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}$'
     or p_storage_path <> 'stickers/dev/' || p_sticker_id::text || '.webp'
     or p_mime_type <> 'image/webp'
     or p_sha256 !~ '^[0-9a-f]{64}$'
     or p_file_size not between 1 and 102400
     or p_width <> 512
     or p_height <> 512 then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_ACTIVATE_INVALID' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects as object
    where object.bucket_id = 'liveticker-whatsapp-stickers'
      and object.name = p_storage_path
  ) then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_OBJECT_MISSING' using errcode = 'P0002';
  end if;
  select least(coalesce(max(sort_order), 0) + 10, 9999) into v_sort
  from app_modules.liveticker_whatsapp_stickers;
  insert into app_modules.liveticker_whatsapp_stickers(
    id, name, slug, storage_path, mime_type, active, sort_order,
    width, height, file_size, sha256, created_by, updated_by
  ) values (
    p_sticker_id, pg_catalog.btrim(p_name), p_slug, p_storage_path, p_mime_type, true, v_sort,
    p_width, p_height, p_file_size, p_sha256, p_actor, p_actor
  ) returning * into v_sticker;
  return jsonb_build_object(
    'id', v_sticker.id,
    'name', v_sticker.name,
    'slug', v_sticker.slug,
    'mimeType', v_sticker.mime_type,
    'active', v_sticker.active,
    'sortOrder', v_sticker.sort_order,
    'width', v_sticker.width,
    'height', v_sticker.height,
    'fileSize', v_sticker.file_size,
    'createdAt', v_sticker.created_at,
    'updatedAt', v_sticker.updated_at
  );
end;
$function$;

create view public.pd_liveticker_whatsapp_stickers_worker
with (security_invoker = true)
as
select id, storage_path, mime_type, width, height, file_size, sha256
from app_modules.liveticker_whatsapp_stickers;

revoke all on table public.pd_liveticker_whatsapp_stickers_worker
  from public, anon, authenticated, service_role;
grant select on table public.pd_liveticker_whatsapp_stickers_worker to service_role;

create or replace view public.pd_liveticker_whatsapp_jobs_worker
with (security_invoker = true)
as
select
  id,
  event_id,
  client_action_id,
  publication_version,
  requested_by,
  message,
  status,
  attempt_count,
  next_attempt_at,
  claimed_at,
  worker_received_at,
  waha_sent_at,
  completed_at,
  waha_message_id,
  last_error,
  created_at,
  updated_at,
  sticker_id
from app_modules.liveticker_whatsapp_jobs;

revoke all on table public.pd_liveticker_whatsapp_jobs_worker
  from public, anon, authenticated, service_role;
grant select, update on table public.pd_liveticker_whatsapp_jobs_worker to service_role;

create or replace function public.pd_public_liveticker_sync(
  p_event_id uuid,
  p_expected_revision integer,
  p_changes jsonb,
  p_client_id text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_changes jsonb := p_changes;
  v_clean_upserts jsonb := '[]'::jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_item jsonb;
  v_candidate jsonb;
  v_marker jsonb;
  v_action_id text;
  v_message text;
  v_sticker_id uuid;
  v_result jsonb;
  v_actor uuid;
  v_exists boolean;
begin
  if p_changes is not null
     and jsonb_typeof(p_changes) = 'object'
     and p_changes ? 'upserts'
     and jsonb_typeof(p_changes -> 'upserts') = 'array' then
    for v_item in select value from jsonb_array_elements(p_changes -> 'upserts')
    loop
      if jsonb_typeof(v_item) = 'object' and v_item ? '_whatsapp' then
        v_marker := v_item -> '_whatsapp';
        v_sticker_id := null;
        if jsonb_typeof(v_marker) <> 'object'
           or v_marker - array['publish', 'text', 'stickerId'] <> '{}'::jsonb
           or jsonb_typeof(v_marker -> 'publish') <> 'boolean' then
          raise exception 'LIVETICKER_INVALID_WHATSAPP_PUBLISH' using errcode = '22023';
        end if;
        if (v_marker ->> 'publish')::boolean then
          if jsonb_typeof(v_marker -> 'text') <> 'string' then
            raise exception 'LIVETICKER_INVALID_WHATSAPP_TEXT' using errcode = '22023';
          end if;
          v_message := v_marker ->> 'text';
          if char_length(btrim(v_message)) not between 1 and 4000 then
            raise exception 'LIVETICKER_INVALID_WHATSAPP_TEXT' using errcode = '22023';
          end if;
          if v_marker ? 'stickerId' then
            if jsonb_typeof(v_marker -> 'stickerId') <> 'string'
               or (v_marker ->> 'stickerId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
              raise exception 'LIVETICKER_INVALID_WHATSAPP_STICKER' using errcode = '22023';
            end if;
            v_sticker_id := (v_marker ->> 'stickerId')::uuid;
            if not exists (
              select 1 from app_modules.liveticker_whatsapp_stickers as sticker
              where sticker.id = v_sticker_id and sticker.active
            ) then
              raise exception 'LIVETICKER_UNKNOWN_WHATSAPP_STICKER' using errcode = '22023';
            end if;
          end if;
          if jsonb_typeof(v_item -> 'id') = 'string' then
            v_action_id := v_item ->> 'id';
            select exists (
              select 1 from app_modules.liveticker_actions as action
              where action.event_id = p_event_id and action.client_action_id = v_action_id
            ) into v_exists;
            if not v_exists then
              v_candidates := v_candidates || jsonb_build_array(jsonb_build_object(
                'actionId', v_action_id,
                'message', v_message,
                'stickerId', v_sticker_id
              ));
            end if;
          end if;
        end if;
      end if;
      if jsonb_typeof(v_item) = 'object' then
        v_clean_upserts := v_clean_upserts || jsonb_build_array(v_item - '_whatsapp');
      else
        v_clean_upserts := v_clean_upserts || jsonb_build_array(v_item);
      end if;
    end loop;
    v_changes := jsonb_set(p_changes, '{upserts}', v_clean_upserts, false);
  end if;
  if jsonb_array_length(v_candidates) > 0 then
    v_actor := app_private.liveticker_require_operator();
  end if;
  v_result := public.pd_public_liveticker_sync_before_whatsapp_channel_r1(
    p_event_id, p_expected_revision, v_changes, p_client_id
  );
  if jsonb_array_length(v_candidates) > 0 then
    for v_candidate in select value from jsonb_array_elements(v_candidates)
    loop
      insert into app_modules.liveticker_whatsapp_jobs(
        event_id, client_action_id, publication_version, requested_by, message, sticker_id
      ) values (
        p_event_id,
        v_candidate ->> 'actionId',
        1,
        v_actor,
        v_candidate ->> 'message',
        nullif(v_candidate ->> 'stickerId', '')::uuid
      )
      on conflict (event_id, client_action_id, publication_version) do nothing;
    end loop;
  end if;
  return v_result;
end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_liveticker_whatsapp_stickers_r1;

create function app_private.pd_api_dispatch_current(p_action text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
begin
  case v_action
    when 'liveticker_whatsapp_stickers_list' then
      return app_private.api_liveticker_whatsapp_stickers_list(coalesce(p_payload, '{}'::jsonb));
    when 'liveticker_whatsapp_sticker_upload_authorize' then
      return app_private.api_liveticker_whatsapp_sticker_upload_authorize(coalesce(p_payload, '{}'::jsonb));
    when 'liveticker_whatsapp_sticker_asset_authorize' then
      return app_private.api_liveticker_whatsapp_sticker_asset_authorize(coalesce(p_payload, '{}'::jsonb));
    when 'liveticker_whatsapp_sticker_set_active' then
      return app_private.api_liveticker_whatsapp_sticker_set_active(coalesce(p_payload, '{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_liveticker_whatsapp_stickers_r1(p_action, p_payload);
  end case;
end;
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_liveticker_whatsapp_stickers_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'liveticker_whatsapp_stickers_list' then 'READ'
    when 'liveticker_whatsapp_sticker_upload_authorize' then 'READ'
    when 'liveticker_whatsapp_sticker_asset_authorize' then 'READ'
    when 'liveticker_whatsapp_sticker_set_active' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_liveticker_whatsapp_stickers_r1(p_action)
  end;
$function$;

revoke all on function
  app_private.api_liveticker_whatsapp_stickers_list(jsonb),
  app_private.api_liveticker_whatsapp_sticker_upload_authorize(jsonb),
  app_private.api_liveticker_whatsapp_sticker_asset_authorize(jsonb),
  app_private.api_liveticker_whatsapp_sticker_set_active(jsonb),
  app_private.pd_api_dispatch_current_before_liveticker_whatsapp_stickers_r1(text, jsonb),
  app_private.pd_api_dispatch_current(text, jsonb),
  app_private.platform_action_classification_before_liveticker_whatsapp_stickers_r1(text),
  app_private.platform_action_classification(text)
from public, anon, authenticated, service_role;

revoke all on function public.pd_liveticker_whatsapp_sticker_activate(
  uuid, uuid, text, text, text, text, text, integer, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function public.pd_liveticker_whatsapp_sticker_activate(
  uuid, uuid, text, text, text, text, text, integer, integer, integer
) to service_role;

revoke all on function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  to anon, authenticated;

commit;
