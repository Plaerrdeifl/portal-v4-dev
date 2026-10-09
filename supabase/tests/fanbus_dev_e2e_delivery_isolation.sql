\set ON_ERROR_STOP on

begin;

select plan(1);

do $test$
declare
  v_e2e_user constant uuid := '00000000-0000-4555-8555-000000000042';
  v_other_user constant uuid := '00000000-0000-4555-8555-000000000043';
  v_event constant uuid := '00000000-0000-4555-8100-000000000042';
  v_trip constant uuid := '00000000-0000-4555-8200-000000000042';
  v_run uuid;
  v_isolated_event uuid;
  v_forged_event uuid;
  v_wrong_issuer_event uuid;
  v_after_close_event uuid;
  v_normal_event uuid;
  v_isolated_email uuid := extensions.gen_random_uuid();
  v_isolated_push uuid := extensions.gen_random_uuid();
  v_fallback_email uuid := extensions.gen_random_uuid();
  v_normal_email uuid := extensions.gen_random_uuid();
  v_existing_retry uuid := extensions.gen_random_uuid();
  v_claim_token uuid := extensions.gen_random_uuid();
  v_claims jsonb;
  v_second_claims jsonb;
  v_bad_payload jsonb;
  v_registration uuid := extensions.gen_random_uuid();
  v_booking uuid := extensions.gen_random_uuid();
  v_api_result jsonb;
  v_operator_event uuid;
begin
  insert into app_modules.events(
    id, event_type, title, event_date, event_time, visibility
  ) values (
    v_event, 'OTHER', 'Fanbus Slice 6 Testfahrt', current_date + 30,
    time '18:00', 'PUBLIC'
  );
  insert into app_modules.fanbus_trips(id, event_id, status)
  values (v_trip, v_event, 'DRAFT');

  if has_table_privilege('anon', 'app_private.dev_e2e_delivery_runs', 'SELECT')
     or has_table_privilege('authenticated', 'app_private.dev_e2e_delivery_runs', 'SELECT')
     or has_table_privilege('service_role', 'app_private.dev_e2e_delivery_runs', 'SELECT')
     or has_function_privilege('anon', 'app_private.dev_e2e_delivery_run_open(uuid,interval,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'app_private.dev_e2e_delivery_run_open(uuid,interval,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'app_private.dev_e2e_delivery_run_open(uuid,interval,text)', 'EXECUTE') then
    raise exception 'DEV E2E configuration is reachable outside postgres.';
  end if;

  delete from vault.secrets where name = 'pd_notification_dispatch_url';
  begin
    perform app_private.dev_e2e_delivery_run_open(
      v_e2e_user, interval '15 minutes', 'missing configuration rejection'
    );
    raise exception 'Missing DEV configuration unexpectedly opened a run.';
  exception when sqlstate '55000' then
    if sqlerrm <> 'DEV_E2E_ENVIRONMENT_INVALID' then raise; end if;
  end;

  perform vault.create_secret(
    'https://wplescvhlgctynkfwvrj.supabase.co/functions/v1/notification-dispatch',
    'pd_notification_dispatch_url',
    'test-only PROD rejection fixture'
  );
  begin
    perform app_private.dev_e2e_delivery_run_open(
      v_e2e_user, interval '15 minutes', 'production configuration rejection'
    );
    raise exception 'PROD configuration unexpectedly opened a run.';
  exception when sqlstate '55000' then
    if sqlerrm <> 'DEV_E2E_ENVIRONMENT_INVALID' then raise; end if;
  end;

  delete from vault.secrets where name = 'pd_notification_dispatch_url';
  perform vault.create_secret(
    'https://tpieykhhawszlzsoflnl.supabase.co/functions/v1/notification-dispatch',
    'pd_notification_dispatch_url',
    'test-only DEV fixture'
  );

  begin
    perform app_private.dev_e2e_delivery_run_open(
      v_other_user, interval '15 minutes', 'foreign actor rejection fixture'
    );
    raise exception 'Foreign actor unexpectedly opened a run.';
  exception when sqlstate '22023' then
    if sqlerrm <> 'DEV_E2E_ACTOR_INVALID' then raise; end if;
  end;

  v_run := app_private.dev_e2e_delivery_run_open(
    v_e2e_user, interval '15 minutes', 'Fanbus Slice 6 isolated acceptance'
  );

  perform pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_e2e_user,
      'role', 'authenticated',
      'iss', 'https://tpieykhhawszlzsoflnl.supabase.co/auth/v1',
      'devE2e', true,
      'foreignRunId', extensions.gen_random_uuid()
    )::text,
    true
  );
  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    v_e2e_user::text,
    true
  );

  -- Real operator boundary: JWT subject -> capability -> updated_by -> trigger.
  insert into auth.users(id,email) values (v_e2e_user,'operator-e2e@example.invalid');
  insert into app_portal.users(id,user_code,email,first_name,last_name,status,role_id)
  values (v_e2e_user,'U-ISOLATION-E2E','operator-e2e@example.invalid','E2E','Operator',
    'ACTIVE','00000000-0000-4000-8000-000000000001');
  update app_portal.settings set value=jsonb_set(value,'{mode}','"NORMAL"')
    where key='platform.mode';
  insert into app_modules.fanbus_bookings(id,trip_id,source)
    values (v_booking,v_trip,'MANUAL');
  perform set_config('app.m325_registration_context','[]',true);
  -- Historical creator deliberately differs from the current operator.
  insert into app_modules.fanbus_registrations(
    id,trip_id,booking_id,booking_role,participant_sequence,first_name,last_name,
    email,bus_preference,status,source,privacy_reference,terms_reference,
    privacy_accepted_at,terms_accepted_at
  ) values (v_registration,v_trip,v_booking,'PRIMARY',1,'Fixture','Passenger',
    'passenger@example.invalid','EGAL','ACTIVE','MANUAL','privacy','terms',now(),now());

  set local role authenticated;
  v_api_result := public.pd_api('fanbus_booking_operator_cancel',jsonb_build_object(
    'bookingId',v_booking,'participants',jsonb_build_array(
      jsonb_build_object('id',v_registration,'expectedRevision',1))
  ));
  reset role;
  if v_api_result->>'ok' is distinct from 'true' then
    raise exception 'Real operator API failed: %',v_api_result;
  end if;
  select id into v_operator_event from app_private.notification_events
    where notification_type='FANBUS_REGISTRATION_CANCELLED'
      and entity_id=v_registration::text;
  if v_operator_event is null or not exists (
    select 1 from app_private.notification_events where id=v_operator_event
      and actor_user_id=v_e2e_user and delivery_mode='DEV_E2E_ISOLATED'
      and dev_e2e_run_id=v_run
  ) then
    raise exception 'Operator cancellation lost JWT-subject provenance.';
  end if;
  perform app_private.notification_expand_event(v_operator_event);
  if not exists (select 1 from app_private.notification_outbox where event_id=v_operator_event)
     or exists (select 1 from app_private.notification_outbox
       where event_id=v_operator_event and
         (delivery_mode<>'DEV_E2E_ISOLATED' or dev_e2e_run_id<>v_run)) then
    raise exception 'Real operator event expansion lost isolation.';
  end if;

  v_isolated_event := app_private.notification_event_enqueue(
    'FANBUS_E2E_EMAIL_PUSH', 'FANBUS', 'fanbus-e2e:isolation',
    'FANBUS_E2E', 'fanbus_booking', extensions.gen_random_uuid()::text,
    v_e2e_user, '{"browserFlag":true,"deliveryMode":"DEV_E2E_ISOLATED"}'::jsonb, now()
  );

  select jsonb_build_object(
    'mode', event.delivery_mode,
    'run', event.dev_e2e_run_id
  ) into v_claims
  from app_private.notification_events as event
  where event.id = v_isolated_event;

  if v_claims <> jsonb_build_object('mode', 'DEV_E2E_ISOLATED', 'run', v_run) then
    raise exception 'Trusted DEV E2E event was not classified: %', v_claims;
  end if;

  update app_private.notification_events set status = 'EXPANDED'
  where id = v_isolated_event;

  insert into app_private.notification_outbox(
    id, event_id, notification_type, category, event_key,
    recipient_kind, recipient_address, channel, delivery_target_key,
    preference_mode, payload, deep_link
  ) values (
    v_isolated_email, v_isolated_event, 'FANBUS_E2E_EMAIL_PUSH', 'FANBUS',
    'fanbus-e2e:isolation', 'EXTERNAL_EMAIL', 'e2e@example.invalid', 'EMAIL',
    'e2e:email', 'MANDATORY', jsonb_build_object(
      'templateKey', 'fanbus.booking.active',
      'data', jsonb_build_object('tripId', v_trip)
    ), ''
  );

  insert into app_private.notification_outbox(
    id, event_id, notification_type, category, event_key,
    recipient_kind, channel, delivery_target_key, preference_mode,
    status, attempt_count, last_error_code, payload, deep_link
  ) values (
    v_isolated_push, v_isolated_event, 'FANBUS_E2E_EMAIL_PUSH', 'FANBUS',
    'fanbus-e2e:isolation', 'USER', 'PUSH', 'e2e:push', 'OPTIONAL',
    'RETRY', 2, 'PUSH_NETWORK', '{"title":"E2E"}'::jsonb, '#/fanbus'
  );

  if exists (
    select 1 from app_private.notification_outbox as outbox
    where outbox.id in (v_isolated_email, v_isolated_push)
      and (outbox.delivery_mode <> 'DEV_E2E_ISOLATED' or outbox.dev_e2e_run_id <> v_run)
  ) then
    raise exception 'Outbox did not inherit the immutable E2E context.';
  end if;

  -- Foreign actor IDs stay normal even with forged payload/JWT flags.
  v_forged_event := app_private.notification_event_enqueue(
    'FANBUS_E2E_FORGED', 'FANBUS', 'fanbus-e2e:forged',
    'FANBUS_E2E', 'fanbus_booking', extensions.gen_random_uuid()::text,
    v_other_user, '{"devE2e":true,"runId":"forged"}'::jsonb, now()
  );
  if (select delivery_mode from app_private.notification_events where id = v_forged_event) <> 'NORMAL' then
    raise exception 'Forged actor/payload activated isolation.';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_e2e_user,
      'role', 'authenticated',
      'iss', 'https://wplescvhlgctynkfwvrj.supabase.co/auth/v1'
    )::text,
    true
  );
  v_wrong_issuer_event := app_private.notification_event_enqueue(
    'FANBUS_E2E_WRONG_ISSUER', 'FANBUS', 'fanbus-e2e:wrong-issuer',
    'FANBUS_E2E', 'fanbus_booking', extensions.gen_random_uuid()::text,
    v_e2e_user, '{}'::jsonb, now()
  );
  if (select delivery_mode from app_private.notification_events where id = v_wrong_issuer_event) <> 'NORMAL' then
    raise exception 'PROD issuer activated DEV isolation.';
  end if;

  perform app_private.dev_e2e_delivery_run_close(v_run);

  -- Closing the run must not remove the marker from already-created work.
  v_claims := public.pd_notification_claim_batch(50);
  if jsonb_array_length(v_claims) <> 0 then
    raise exception 'Isolated delivery escaped to provider claims: %', v_claims;
  end if;
  if exists (
    select 1 from app_private.notification_outbox as outbox
    where outbox.id in (v_isolated_email, v_isolated_push)
      and (
        outbox.status <> 'SKIPPED'
        or outbox.last_error_code <> 'DEV_E2E_DELIVERY_ISOLATED'
        or outbox.sent_at is not null
        or outbox.provider_message_id is not null
        or outbox.claim_token is not null
      )
  ) then
    raise exception 'Isolated email/push did not reach the audit terminal state.';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_e2e_user,
      'role', 'authenticated',
      'iss', 'https://tpieykhhawszlzsoflnl.supabase.co/auth/v1'
    )::text,
    true
  );
  v_after_close_event := app_private.notification_event_enqueue(
    'FANBUS_E2E_AFTER_CLOSE', 'FANBUS', 'fanbus-e2e:after-close',
    'FANBUS_E2E', 'fanbus_booking', extensions.gen_random_uuid()::text,
    v_e2e_user, '{}'::jsonb, now()
  );
  if (select delivery_mode from app_private.notification_events where id = v_after_close_event) <> 'NORMAL' then
    raise exception 'Closed run still classifies new work.';
  end if;

  -- A real non-E2E item keeps normal claim semantics. A pre-existing future
  -- retry is untouched, including its historical provider error.
  v_normal_event := app_private.notification_event_enqueue(
    'FANBUS_REAL_NORMAL', 'FANBUS', 'fanbus-real:normal',
    'M020_TEST', 'fanbus_booking', extensions.gen_random_uuid()::text,
    v_other_user, '{}'::jsonb, now()
  );
  update app_private.notification_events set status = 'EXPANDED'
  where id = v_normal_event;

  insert into app_private.notification_outbox(
    id, event_id, notification_type, category, event_key,
    recipient_kind, recipient_address, channel, delivery_target_key,
    preference_mode, payload, deep_link
  ) values (
    v_normal_email, v_normal_event, 'FANBUS_REAL_NORMAL', 'FANBUS',
    'fanbus-real:normal', 'EXTERNAL_EMAIL', 'real@example.invalid', 'EMAIL',
    'real:email', 'MANDATORY', jsonb_build_object(
      'templateKey', 'fanbus.booking.active',
      'data', jsonb_build_object('tripId', v_trip)
    ), ''
  );

  insert into app_private.notification_outbox(
    id, event_id, notification_type, category, event_key,
    recipient_kind, recipient_address, channel, delivery_target_key,
    preference_mode, status, attempt_count, next_attempt_at, last_error_code,
    payload, deep_link
  ) values (
    v_existing_retry, v_normal_event, 'FANBUS_REAL_NORMAL', 'FANBUS',
    'fanbus-real:normal', 'EXTERNAL_EMAIL', 'retry@example.invalid', 'EMAIL',
    'real:future-retry', 'MANDATORY', 'RETRY', 3, now() + interval '1 day',
    'PROVIDER_SMTP_450', jsonb_build_object(
      'templateKey', 'fanbus.booking.active',
      'data', jsonb_build_object('tripId', v_trip)
    ), ''
  );

  v_claims := public.pd_notification_claim_batch(50);
  if jsonb_array_length(v_claims) <> 1
     or v_claims -> 0 ->> 'outboxId' <> v_normal_email::text
     or v_claims -> 0 ->> 'deliveryMode' <> 'NORMAL'
     or (v_claims -> 0 -> 'devE2eRunId') <> 'null'::jsonb then
    raise exception 'Normal provider claim semantics changed: %', v_claims;
  end if;

  v_second_claims := public.pd_notification_claim_batch(50);
  if jsonb_array_length(v_second_claims) <> 0 then
    raise exception 'Repeated/parallel-style claim duplicated work: %', v_second_claims;
  end if;

  if not exists (
    select 1 from app_private.notification_outbox as outbox
    where outbox.id = v_existing_retry
      and outbox.status = 'RETRY'
      and outbox.attempt_count = 3
      and outbox.last_error_code = 'PROVIDER_SMTP_450'
      and outbox.claim_token is null
  ) then
    raise exception 'Existing retry was silently changed.';
  end if;

  -- Dispatcher fallback: even a leased isolated row can only complete as the
  -- dedicated SKIPPED state, never SENT/FAILED/RETRY.
  insert into app_private.notification_outbox(
    id, event_id, notification_type, category, event_key,
    recipient_kind, recipient_address, channel, delivery_target_key,
    preference_mode, status, attempt_count, claim_token, claimed_at,
    claim_expires_at, payload, deep_link
  ) values (
    v_fallback_email, v_isolated_event, 'FANBUS_E2E_EMAIL_PUSH', 'FANBUS',
    'fanbus-e2e:isolation', 'EXTERNAL_EMAIL', 'fallback@example.invalid', 'EMAIL',
    'e2e:fallback', 'MANDATORY', 'PROCESSING', 1, v_claim_token, now(),
    now() + interval '10 minutes', jsonb_build_object(
      'templateKey', 'fanbus.booking.active',
      'data', jsonb_build_object('tripId', v_trip)
    ), ''
  );

  -- Missing/invalid terminal status must never enter normal delivery paths.
  for v_bad_payload in select value from jsonb_array_elements('[
    {"success":true,"providerMessageId":"forged-provider"},
    {"retryable":true},
    {"terminalStatus":"SENT","success":true},
    {"terminalStatus":"RETRY","retryable":true},
    {"terminalStatus":"FAILED"},
    {},
    {"terminalStatus":"SKIPPED","success":true,"errorCode":"DEV_E2E_DELIVERY_ISOLATED"}
  ]'::jsonb) loop
    begin
      perform public.pd_notification_complete(jsonb_build_object(
        'outboxId', v_fallback_email, 'claimToken', v_claim_token
      ) || v_bad_payload);
      raise exception 'Unsafe isolated completion accepted: %', v_bad_payload;
    exception when sqlstate '22023' then
      if sqlerrm <> 'M020_COMPLETE_TERMINAL_INVALID' then raise; end if;
    end;
    if not exists (
      select 1 from app_private.notification_outbox
      where id=v_fallback_email and status='PROCESSING'
        and claim_token=v_claim_token and sent_at is null
        and provider_message_id is null and delivery_mode='DEV_E2E_ISOLATED'
    ) then
      raise exception 'Rejected completion changed the isolated lease.';
    end if;
    -- Claim never returns a rejected isolated lease for another provider attempt.
    if jsonb_array_length(public.pd_notification_claim_batch(50)) <> 0 then
      raise exception 'Rejected isolation escaped to provider claims.';
    end if;
    if not exists (
      select 1 from app_private.notification_outbox where id=v_fallback_email
        and status='SKIPPED' and last_error_code='DEV_E2E_DELIVERY_ISOLATED'
        and sent_at is null and provider_message_id is null and claim_token is null
    ) then
      raise exception 'Rejected lease was not terminally isolated by claim.';
    end if;
    -- Recreate a leased state only inside the rollback-only postgres fixture.
    update app_private.notification_outbox
      set status='PROCESSING',claim_token=v_claim_token,claimed_at=now(),
          claim_expires_at=now()+interval '10 minutes'
      where id=v_fallback_email;
  end loop;

  begin
    perform public.pd_notification_complete(jsonb_build_object(
      'outboxId', v_fallback_email, 'claimToken', extensions.gen_random_uuid(),
      'terminalStatus','SKIPPED','errorCode','DEV_E2E_DELIVERY_ISOLATED'
    ));
    raise exception 'Wrong token accepted.';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'M020_COMPLETE_CLAIM_NOT_FOUND' then raise; end if;
  end;

  perform public.pd_notification_complete(jsonb_build_object(
    'outboxId', v_fallback_email,
    'claimToken', v_claim_token,
    'success', false,
    'retryable', false,
    'errorCode', 'DEV_E2E_DELIVERY_ISOLATED',
    'terminalStatus', 'SKIPPED'
  ));
  if not exists (
    select 1 from app_private.notification_outbox as outbox
    where outbox.id = v_fallback_email
      and outbox.status = 'SKIPPED'
      and outbox.last_error_code = 'DEV_E2E_DELIVERY_ISOLATED'
      and outbox.sent_at is null
      and outbox.provider_message_id is null
      and outbox.claim_token is null
  ) then
    raise exception 'Dispatcher fallback did not terminally isolate the row.';
  end if;

  begin
    perform public.pd_notification_complete(jsonb_build_object(
      'outboxId', v_normal_email,
      'claimToken', v_claims -> 0 ->> 'claimToken',
      'success', false,
      'retryable', false,
      'errorCode', 'DEV_E2E_DELIVERY_ISOLATED',
      'terminalStatus', 'SKIPPED'
    ));
    raise exception 'Normal row accepted an isolated terminal completion.';
  exception when sqlstate '22023' then
    if sqlerrm <> 'M020_COMPLETE_TERMINAL_INVALID' then raise; end if;
  end;
  perform public.pd_notification_complete(jsonb_build_object(
    'outboxId',v_normal_email,'claimToken',v_claims->0->>'claimToken',
    'success',true,'providerMessageId','normal-provider'
  ));
  if not exists (select 1 from app_private.notification_outbox
    where id=v_normal_email and status='SENT' and sent_at is not null
      and provider_message_id='normal-provider' and delivery_mode='NORMAL') then
    raise exception 'Normal success semantics changed.';
  end if;
  begin
    perform public.pd_notification_complete(jsonb_build_object(
      'outboxId',v_fallback_email,'claimToken',v_claim_token,
      'terminalStatus','SKIPPED','errorCode','DEV_E2E_DELIVERY_ISOLATED'
    ));
    raise exception 'Completed token replay accepted.';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'M020_COMPLETE_CLAIM_NOT_FOUND' then raise; end if;
  end;
end;
$test$;

select pass('Fanbus DEV E2E delivery isolation is trusted, terminal and provider-safe');

select * from finish();

rollback;
