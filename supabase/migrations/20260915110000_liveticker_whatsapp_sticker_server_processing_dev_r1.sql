-- DEV only: authorize original image sources before server-side sticker normalization.

begin;

create or replace function app_private.api_liveticker_whatsapp_sticker_upload_authorize(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := app_private.liveticker_require_operator();
  v_name text := pg_catalog.btrim(coalesce(p_payload ->> 'name', ''));
  v_source_mime_type text := pg_catalog.btrim(coalesce(p_payload ->> 'sourceMimeType', ''));
  v_source_size bigint;
begin
  if p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or p_payload - array['name', 'sourceMimeType', 'sourceSize']::text[] <> '{}'::jsonb
     or pg_catalog.jsonb_typeof(p_payload -> 'sourceMimeType') <> 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'sourceSize') <> 'number' then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UPLOAD_INVALID' using errcode = '22023';
  end if;

  begin
    v_source_size := (p_payload ->> 'sourceSize')::bigint;
  exception when others then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UPLOAD_INVALID' using errcode = '22023';
  end;

  if app_private.platform_release_environment() is distinct from 'DEV'
     or char_length(v_name) not between 1 and 80
     or v_source_mime_type not in ('image/png', 'image/jpeg', 'image/webp')
     or v_source_size not between 1 and 5242880 then
    raise exception 'LIVETICKER_WHATSAPP_STICKER_UPLOAD_INVALID' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'actorId', v_actor,
    'environment', 'DEV',
    'name', v_name,
    'sourceMimeType', v_source_mime_type,
    'sourceSize', v_source_size
  );
end;
$function$;

commit;
