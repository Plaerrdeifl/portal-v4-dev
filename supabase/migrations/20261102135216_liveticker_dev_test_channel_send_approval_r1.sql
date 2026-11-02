-- DEV operational approval: user explicitly authorized TEST only on 2026-11-02.
-- No messages are enqueued; the legacy MAIN channel remains unapproved.
begin;
set local lock_timeout = '5s';

do $dev_test_channel_approval$
declare
  v_environment text := app_private.platform_release_environment();
  v_mode text;
  v_test app_private.liveticker_whatsapp_channels%rowtype;
  v_main app_private.liveticker_whatsapp_channels%rowtype;
  v_updated app_private.liveticker_whatsapp_channels%rowtype;
begin
  if v_environment = 'PROD' then
    raise exception 'LIVETICKER_TEST_SEND_DEV_ONLY' using errcode = '55000';
  end if;
  if v_environment is distinct from 'DEV' then
    return; -- Local/other environments do not acquire a delivery approval.
  end if;

  select mode into v_mode
    from app_private.liveticker_whatsapp_routing_control
    where singleton = true for update;
  if v_mode is distinct from 'TEST' then
    raise exception 'LIVETICKER_TEST_SEND_ROUTING_NOT_TEST' using errcode = '55000';
  end if;

  -- Lock both channels; a concurrent administrative change cannot broaden
  -- the explicit TEST-only permission during this transaction.
  select * into v_main from app_private.liveticker_whatsapp_channels
    where code = 'MAIN' for update;
  select * into v_test from app_private.liveticker_whatsapp_channels
    where code = 'TEST' for update;

  if v_main.code is null or v_main.send_approved is distinct from false then
    raise exception 'LIVETICKER_MAIN_MUST_STAY_UNAPPROVED'
      using errcode = '55000';
  end if;
  if v_test.code is null or v_test.enabled is distinct from true
     or v_test.waha_channel_id is null then
    raise exception 'LIVETICKER_TEST_CHANNEL_NOT_CONFIGURED'
      using errcode = '55000';
  end if;

  if exists (
    select 1 from app_modules.liveticker_whatsapp_jobs
    where status not in ('SUCCEEDED', 'FAILED')
  ) or exists (
    select 1 from app_modules.liveticker_whatsapp_job_targets
    where status not in ('SUCCEEDED', 'FAILED')
  ) then
    raise exception 'LIVETICKER_TEST_SEND_PENDING_DELIVERY'
      using errcode = '55000';
  end if;

  if v_test.send_approved then
    return; -- Replay stays idempotent; no duplicate audit or revision.
  end if;

  update app_private.liveticker_whatsapp_channels
    set send_approved = true,
        updated_at = statement_timestamp(),
        updated_by = null, -- Chat approval, not a fabricated portal actor.
        revision = revision + 1
    where code = 'TEST' and send_approved = false
    returning * into v_updated;

  if v_updated.code is distinct from 'TEST' then
    raise exception 'LIVETICKER_TEST_SEND_UPDATE_FAILED' using errcode = '55000';
  end if;

  perform app_private.log_audit(
    null,
    'LIVETICKER_DEV_TEST_CHANNEL_SEND_APPROVED',
    'liveticker_whatsapp_channel',
    'TEST',
    jsonb_build_object('code', 'TEST',
                       'sendApproved', v_test.send_approved,
                       'revision', v_test.revision),
    jsonb_build_object('code', 'TEST',
                       'sendApproved', v_updated.send_approved,
                       'revision', v_updated.revision),
    jsonb_build_object('environment', 'DEV',
                       'source', 'explicit_user_approval_2026_11_02',
                       'mainChannelApproved', false,
                       'routingMode', v_mode)
  );
end;
$dev_test_channel_approval$;

commit;
