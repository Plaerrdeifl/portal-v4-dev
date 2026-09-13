-- Wrap the existing Liveticker sync RPC so transient WhatsApp metadata is
-- stripped before persistence and first-time actions are enqueued atomically.

alter function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  rename to pd_public_liveticker_sync_before_whatsapp_channel_r1;

revoke all on function public.pd_public_liveticker_sync_before_whatsapp_channel_r1(uuid, integer, jsonb, text)
  from public, anon, authenticated, service_role;

create function public.pd_public_liveticker_sync(
  p_event_id uuid,
  p_expected_revision integer,
  p_changes jsonb,
  p_client_id text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb := p_changes;
  v_clean_upserts jsonb := '[]'::jsonb;
  v_candidates jsonb := '[]'::jsonb;
  v_item jsonb;
  v_candidate jsonb;
  v_marker jsonb;
  v_action_id text;
  v_message text;
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

        if jsonb_typeof(v_marker) <> 'object'
           or v_marker - array['publish','text'] <> '{}'::jsonb
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

          if jsonb_typeof(v_item -> 'id') = 'string' then
            v_action_id := v_item ->> 'id';
            select exists (
              select 1
              from app_modules.liveticker_actions a
              where a.event_id = p_event_id
                and a.client_action_id = v_action_id
            ) into v_exists;

            if not v_exists then
              v_candidates := v_candidates || jsonb_build_array(
                jsonb_build_object('actionId', v_action_id, 'message', v_message)
              );
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
    p_event_id,
    p_expected_revision,
    v_changes,
    p_client_id
  );

  if jsonb_array_length(v_candidates) > 0 then
    for v_candidate in select value from jsonb_array_elements(v_candidates)
    loop
      insert into app_modules.liveticker_whatsapp_jobs(
        event_id,
        client_action_id,
        publication_version,
        requested_by,
        message
      ) values (
        p_event_id,
        v_candidate ->> 'actionId',
        1,
        v_actor,
        v_candidate ->> 'message'
      )
      on conflict (event_id, client_action_id, publication_version) do nothing;
    end loop;
  end if;

  return v_result;
end
$$;

revoke all on function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function public.pd_public_liveticker_sync(uuid, integer, jsonb, text)
  to anon, authenticated;
