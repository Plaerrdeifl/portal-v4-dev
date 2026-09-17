-- Treat the Liveticker's expected-revision mismatch as an HTTP conflict.
--
-- PostgREST retries SQLSTATE 40001 because PostgreSQL reserves it for real
-- serialization failures.  The existing Liveticker implementation used that
-- code for a business-level optimistic-lock mismatch, which could therefore
-- amplify one stale browser state into many transactions.  These wrappers are
-- deliberately narrow: only LIVETICKER_STALE_REVISION is translated to the
-- documented PostgREST PT409 code.  Any genuine 40001 is re-raised unchanged.

alter function public.pd_public_liveticker_sync_before_whatsapp_channel_r1(
  uuid,
  integer,
  jsonb,
  text
) rename to pd_public_liveticker_sync_before_stale_revision_pt409_dev_r1;

revoke all on function public.pd_public_liveticker_sync_before_stale_revision_pt409_dev_r1(
  uuid,
  integer,
  jsonb,
  text
) from public, anon, authenticated, service_role;

create function public.pd_public_liveticker_sync_before_whatsapp_channel_r1(
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
  v_message text;
begin
  return public.pd_public_liveticker_sync_before_stale_revision_pt409_dev_r1(
    p_event_id,
    p_expected_revision,
    p_changes,
    p_client_id
  );
exception
  when sqlstate '40001' then
    get stacked diagnostics v_message = message_text;
    if v_message = 'LIVETICKER_STALE_REVISION' then
      raise sqlstate 'PT409' using message = v_message;
    end if;
    raise;
end;
$function$;

revoke all on function public.pd_public_liveticker_sync_before_whatsapp_channel_r1(
  uuid,
  integer,
  jsonb,
  text
) from public, anon, authenticated, service_role;

alter function public.pd_public_liveticker_complete(uuid, integer, text)
  rename to pd_public_liveticker_complete_before_stale_revision_pt409_r1;

revoke all on function public.pd_public_liveticker_complete_before_stale_revision_pt409_r1(
  uuid,
  integer,
  text
) from public, anon, authenticated, service_role;

create function public.pd_public_liveticker_complete(
  p_event_id uuid,
  p_expected_revision integer,
  p_client_id text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_message text;
begin
  return public.pd_public_liveticker_complete_before_stale_revision_pt409_r1(
    p_event_id,
    p_expected_revision,
    p_client_id
  );
exception
  when sqlstate '40001' then
    get stacked diagnostics v_message = message_text;
    if v_message = 'LIVETICKER_STALE_REVISION' then
      raise sqlstate 'PT409' using message = v_message;
    end if;
    raise;
end;
$function$;

revoke all on function public.pd_public_liveticker_complete(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.pd_public_liveticker_complete(uuid, integer, text)
  to authenticated;

comment on function public.pd_public_liveticker_sync_before_whatsapp_channel_r1(
  uuid,
  integer,
  jsonb,
  text
) is 'DEV bridge: maps only LIVETICKER_STALE_REVISION to PostgREST HTTP 409.';

comment on function public.pd_public_liveticker_complete(uuid, integer, text)
  is 'Completes a Liveticker game and reports stale revisions as PostgREST HTTP 409.';
