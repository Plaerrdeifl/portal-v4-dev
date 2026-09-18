-- DEV only: rename and safely delete managed Liveticker WhatsApp stickers.

create or replace function app_private.api_liveticker_whatsapp_stickers_list(p_payload jsonb)
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

  return pg_catalog.jsonb_build_object(
    'stickers', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', sticker.id,
        'name', sticker.name,
        'slug', sticker.slug,
        'mimeType', sticker.mime_type,
        'active', sticker.active,
        'sortOrder', sticker.sort_order,
        'width', sticker.width,
        'height', sticker.height,
        'fileSize', sticker.file_size,
        'audience', sticker.audience,
        'opponentTeamId', sticker.opponent_team_id,
        'category', sticker.category,
        'canDelete', not exists (
          select 1 from app_modules.liveticker_whatsapp_jobs as job
          where job.sticker_id = sticker.id
        ),
        'createdAt', sticker.created_at,
        'updatedAt', sticker.updated_at
      ) order by sticker.sort_order, sticker.name, sticker.id)
      from app_modules.liveticker_whatsapp_stickers as sticker
      where v_include_inactive or sticker.active
    ), '[]'::jsonb)
  );
end;
$function$;

create function app_private.api_liveticker_whatsapp_sticker_rename(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_id uuid;
  v_name text := pg_catalog.btrim(coalesce(p_payload ->> 'name', ''));
  v_before app_modules.liveticker_whatsapp_stickers%rowtype;
  v_after app_modules.liveticker_whatsapp_stickers%rowtype;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['stickerId', 'name']::text[] <> '{}'::jsonb
     or not (p_payload ?& array['stickerId', 'name']::text[])
     or pg_catalog.jsonb_typeof(p_payload -> 'stickerId') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'name') <> 'string'
     or (p_payload ->> 'stickerId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or char_length(v_name) not between 1 and 80 then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_RENAME_INVALID' using errcode = '22023';
  end if;

  v_id := (p_payload ->> 'stickerId')::uuid;
  select * into v_before
  from app_modules.liveticker_whatsapp_stickers
  where id = v_id
  for update;
  if not found then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UNKNOWN' using errcode = 'P0002';
  end if;

  update app_modules.liveticker_whatsapp_stickers
  set name = v_name,
      updated_at = pg_catalog.now(),
      updated_by = v_actor
  where id = v_id
  returning * into v_after;

  perform app_private.log_audit(
    v_actor,
    'LIVETICKER_WHATSAPP_STICKER_RENAMED',
    'liveticker_whatsapp_sticker',
    v_id::text,
    pg_catalog.jsonb_build_object('name', v_before.name),
    pg_catalog.jsonb_build_object('name', v_after.name),
    pg_catalog.jsonb_build_object('source', 'portal')
  );

  return app_private.api_liveticker_whatsapp_stickers_list(
    pg_catalog.jsonb_build_object('includeInactive', true)
  );
end;
$function$;

create function app_private.api_liveticker_whatsapp_sticker_delete_authorize(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_id uuid;
  v_sticker app_modules.liveticker_whatsapp_stickers%rowtype;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['stickerId']::text[] <> '{}'::jsonb
     or not (p_payload ? 'stickerId')
     or pg_catalog.jsonb_typeof(p_payload -> 'stickerId') <> 'string'
     or (p_payload ->> 'stickerId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_DELETE_INVALID' using errcode = '22023';
  end if;

  v_id := (p_payload ->> 'stickerId')::uuid;
  select * into v_sticker
  from app_modules.liveticker_whatsapp_stickers
  where id = v_id;
  if not found then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UNKNOWN' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from app_modules.liveticker_whatsapp_jobs as job
    where job.sticker_id = v_id
  ) then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_IN_USE' using errcode = '55000';
  end if;

  return pg_catalog.jsonb_build_object(
    'actorId', v_actor,
    'environment', 'DEV',
    'stickerId', v_sticker.id,
    'storagePath', v_sticker.storage_path
  );
end;
$function$;

create function public.pd_liveticker_whatsapp_sticker_delete(
  p_actor uuid,
  p_sticker_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sticker app_modules.liveticker_whatsapp_stickers%rowtype;
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_actor is null
     or p_sticker_id is null then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_DELETE_INVALID' using errcode = '22023';
  end if;

  select * into v_sticker
  from app_modules.liveticker_whatsapp_stickers
  where id = p_sticker_id
  for update;
  if not found then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UNKNOWN' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from app_modules.liveticker_whatsapp_jobs as job
    where job.sticker_id = p_sticker_id
  ) then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_IN_USE' using errcode = '55000';
  end if;

  delete from app_modules.liveticker_whatsapp_stickers
  where id = p_sticker_id;

  perform app_private.log_audit(
    p_actor,
    'LIVETICKER_WHATSAPP_STICKER_DELETED',
    'liveticker_whatsapp_sticker',
    p_sticker_id::text,
    pg_catalog.jsonb_build_object(
      'name', v_sticker.name,
      'storagePath', v_sticker.storage_path,
      'active', v_sticker.active
    ),
    null,
    pg_catalog.jsonb_build_object('source', 'sticker-edge')
  );

  return pg_catalog.jsonb_build_object(
    'deleted', true,
    'stickerId', v_sticker.id,
    'storagePath', v_sticker.storage_path
  );
end;
$function$;

alter function app_private.pd_api_dispatch_current(text, jsonb)
  rename to pd_api_dispatch_current_before_whatsapp_sticker_admin_r1;

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
    when 'liveticker_whatsapp_sticker_rename' then
      return app_private.api_liveticker_whatsapp_sticker_rename(coalesce(p_payload, '{}'::jsonb));
    when 'liveticker_whatsapp_sticker_delete_authorize' then
      return app_private.api_liveticker_whatsapp_sticker_delete_authorize(coalesce(p_payload, '{}'::jsonb));
    else
      return app_private.pd_api_dispatch_current_before_whatsapp_sticker_admin_r1(p_action, p_payload);
  end case;
end;
$function$;

alter function app_private.platform_action_classification(text)
  rename to platform_action_classification_before_whatsapp_sticker_admin_r1;

create function app_private.platform_action_classification(p_action text)
returns text
language sql
stable
set search_path = ''
as $function$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')))
    when 'liveticker_whatsapp_sticker_rename' then 'USER_MUTATION'
    when 'liveticker_whatsapp_sticker_delete_authorize' then 'USER_MUTATION'
    else app_private.platform_action_classification_before_whatsapp_sticker_admin_r1(p_action)
  end;
$function$;

revoke all on function
  app_private.api_liveticker_whatsapp_sticker_rename(jsonb),
  app_private.api_liveticker_whatsapp_sticker_delete_authorize(jsonb),
  app_private.pd_api_dispatch_current_before_whatsapp_sticker_admin_r1(text, jsonb),
  app_private.platform_action_classification_before_whatsapp_sticker_admin_r1(text)
from public, anon, authenticated, service_role;

revoke all on function public.pd_liveticker_whatsapp_sticker_delete(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.pd_liveticker_whatsapp_sticker_delete(uuid, uuid)
  to service_role;
