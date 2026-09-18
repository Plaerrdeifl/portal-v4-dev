-- DEV only: portal delete becomes archive/soft-delete for managed WhatsApp stickers.

alter table app_modules.liveticker_whatsapp_stickers
  add column archived_at timestamptz,
  add column archived_by uuid references app_portal.users(id) on delete set null;

alter table app_modules.liveticker_whatsapp_stickers
  add constraint liveticker_whatsapp_stickers_archive_state_check
  check (archived_at is null or active = false);

drop index if exists app_modules.liveticker_whatsapp_stickers_picker_idx;
create index liveticker_whatsapp_stickers_picker_idx
  on app_modules.liveticker_whatsapp_stickers(sort_order, name, id)
  where active and archived_at is null;

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
        'canDelete', true,
        'createdAt', sticker.created_at,
        'updatedAt', sticker.updated_at
      ) order by sticker.sort_order, sticker.name, sticker.id)
      from app_modules.liveticker_whatsapp_stickers as sticker
      where sticker.archived_at is null
        and (v_include_inactive or sticker.active)
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function app_private.api_liveticker_whatsapp_sticker_delete_authorize(p_payload jsonb)
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
  where id = v_id
    and archived_at is null;
  if not found then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UNKNOWN' using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object(
    'actorId', v_actor,
    'environment', 'DEV',
    'stickerId', v_sticker.id,
    'storagePath', v_sticker.storage_path
  );
end;
$function$;

create or replace function public.pd_liveticker_whatsapp_sticker_delete(
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
  v_archived_at timestamptz := pg_catalog.statement_timestamp();
begin
  if app_private.platform_release_environment() is distinct from 'DEV'
     or p_actor is null
     or p_sticker_id is null then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_DELETE_INVALID' using errcode = '22023';
  end if;

  select * into v_sticker
  from app_modules.liveticker_whatsapp_stickers
  where id = p_sticker_id
    and archived_at is null
  for update;
  if not found then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UNKNOWN' using errcode = 'P0002';
  end if;

  update app_modules.liveticker_whatsapp_stickers
  set active = false,
      archived_at = v_archived_at,
      archived_by = p_actor,
      updated_at = v_archived_at,
      updated_by = p_actor
  where id = p_sticker_id
    and archived_at is null;

  perform app_private.log_audit(
    p_actor,
    'LIVETICKER_WHATSAPP_STICKER_ARCHIVED',
    'liveticker_whatsapp_sticker',
    p_sticker_id::text,
    pg_catalog.jsonb_build_object('name', v_sticker.name, 'active', v_sticker.active, 'archivedAt', null),
    pg_catalog.jsonb_build_object('name', v_sticker.name, 'active', false, 'archivedAt', v_archived_at),
    pg_catalog.jsonb_build_object('source', 'sticker-edge', 'assetRetained', true)
  );

  return pg_catalog.jsonb_build_object(
    'deleted', true,
    'archived', true,
    'stickerId', v_sticker.id,
    'assetRetained', true
  );
end;
$function$;

revoke all on function public.pd_liveticker_whatsapp_sticker_delete(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.pd_liveticker_whatsapp_sticker_delete(uuid, uuid)
  to service_role;
