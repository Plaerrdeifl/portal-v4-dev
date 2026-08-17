import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const readOptional = async relative => {
  try {
    return await read(relative);
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};
const integrationSource = async (targetPath, patchPath) => {
  const target = await readOptional(targetPath);
  if (target) return target;
  return read(patchPath);
};

const [
  migration,
  worker,
  push,
  auth,
  configIntegration,
  fanclubIntegration,
  membershipIntegration,
  adminIntegration,
  configPatch,
  fanclubPatch,
  membershipPatch,
  adminPatch,
  coreContractIntegration,
  m150EdgeIntegration,
  coreContractPatch,
  m150EdgePatch,
  m150CommunicationSql,
  m150ApplicationsSql,
  m150RetentionSql,
  correction6Integration
] = await Promise.all([
  read("supabase/migrations/20260816170000_add_central_notifications_m020_r1.sql"),
  read("supabase/functions/notification-dispatch/index.ts"),
  read("js/push.js"),
  read("js/auth.js"),
  integrationSource("supabase/config.toml", "patches/supabase-config-m020.patch"),
  integrationSource("js/modules/fanclub.js", "patches/fanclub-deeplink-m020.patch"),
  integrationSource("js/modules/membership-applications.js", "patches/membership-application-deeplink-m020.patch"),
  integrationSource("js/modules/admin.js", "patches/admin-access-request-deeplink-m020.patch"),
  readOptional("patches/supabase-config-m020.patch"),
  readOptional("patches/fanclub-deeplink-m020.patch"),
  readOptional("patches/membership-application-deeplink-m020.patch"),
  readOptional("patches/admin-access-request-deeplink-m020.patch"),
  integrationSource("tests/core_contract.test.mjs", "patches/core-contract-m020.patch"),
  integrationSource("tests/m150_membership_public_edge.test.mjs", "patches/m150-edge-config-m020.patch"),
  readOptional("patches/core-contract-m020.patch"),
  readOptional("patches/m150-edge-config-m020.patch"),
  read("supabase/tests/m150_membership_communication.sql"),
  read("supabase/tests/m150_membership_applications.sql"),
  read("supabase/tests/m150_membership_retention.sql"),
  readOptional("integration/apply_m020_correction6_repo_tests.py")
]);

test("M020 uses central event and delivery outbox with API-only RLS", () => {
  for (const table of ["notification_events", "notification_outbox"]) {
    assert.match(migration, new RegExp(`create table if not exists app_private\\.${table}`));
    assert.match(migration, new RegExp(`alter table app_private\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`alter table app_private\\.${table} force row level security`));
    assert.match(migration, new RegExp(`revoke all on app_private\\.${table} from public, anon, authenticated, service_role`));
  }
  assert.doesNotMatch(migration, /create policy\s+/i);
  assert.match(migration, /unique \(notification_type, event_key\)/);
  assert.match(migration, /unique \(event_id, channel, delivery_target_key\)/);
});

test("M020 is downstream and uses claim leases, bounded attempts and backoff", () => {
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /interval '10 minutes'/);
  assert.match(migration, /max_attempts integer not null default 5/);
  for (const delay of ["1 minute", "5 minutes", "30 minutes", "2 hours", "12 hours"]) {
    assert.match(migration, new RegExp(delay));
  }
  assert.match(migration, /status in \('PENDING','RETRY'\)/);
  assert.match(migration, /DELIVERY_EXPIRED/);
});

test("mandatory and optional preference modes stay separate", () => {
  assert.match(migration, /preference_mode text not null/);
  assert.match(migration, /'MANDATORY','OPTIONAL'/);
  for (const field of [
    "email_account_membership", "push_account_membership",
    "email_fanbus", "push_fanbus",
    "email_dates", "push_dates",
    "email_tasks", "push_tasks"
  ]) assert.match(migration, new RegExp(field));
  assert.match(push, /Pflichtnachrichten bleiben aktiv/);
  assert.match(push, /Push bleibt immer freiwillig/);
});

test("M150 keeps accepted trigger semantics and exact applicant-facing templates", () => {
  assert.match(migration, /MEMBERSHIP_APPLICATION_RECEIVED/);
  assert.match(migration, /MEMBERSHIP_APPLICATION_REJECTED/);
  assert.match(migration, /MEMBERSHIP_ADMISSION_COMPLETED/);
  assert.match(migration, /m150_enqueue_membership_email/);
  assert.match(migration, /rejection_applicant_notice/);
  assert.match(worker, /Dein Mitgliedsantrag bei den Plärrdeifl ist eingegangen/);
  assert.match(worker, /dein Mitgliedsantrag bei den Plärrdeifl wurde nicht angenommen/);
  assert.match(worker, /Der Aufnahmeprozess wurde erfolgreich abgeschlossen/);
  assert.doesNotMatch(worker, /decisionReasonInternal|decision_reason_internal|boardRoster|votes?/i);
});

test("fanbus creation is booking-group based and material changes only", () => {
  assert.match(migration, /new\.booking_role='PRIMARY'/);
  assert.match(migration, /fanbus-booking:'\|\|new\.booking_id::text\|\|':created'/);
  assert.match(migration, /FANBUS_WAITLIST_PROMOTED/);
  assert.match(migration, /FANBUS_REGISTRATION_CANCELLED/);
  assert.match(migration, /FANBUS_TRIP_DEPARTURE_CHANGED/);
  assert.match(migration, /FANBUS_BOARDING_TIME_CHANGED/);
  assert.match(migration, /FANBUS_SELECTED_BOARDING_STOP_CHANGED/);
  assert.doesNotMatch(migration, /FANBUS_CHECKIN|FANBUS_PAID|BUS_ASSIGNMENT|TRIP_CLOSED_NOTIFICATION/);
});

test("task recipients no longer derive from task visibility", () => {
  const taskFunction = migration.slice(
    migration.indexOf("create or replace function app_private.task_notification_queue"),
    migration.indexOf("create or replace function app_private.queue_task_created_push_r1")
  );
  assert.match(taskFunction, /notification_event_enqueue/);
  assert.doesNotMatch(taskFunction, /task_visible|visibility|notifications\s*\(/i);
  assert.match(migration, /values \(t\.assigned_user_id\), \(t\.created_by\)/);
});

test("push endpoint ownership cannot silently move between users", () => {
  const saveStart = migration.indexOf("create or replace function app_private.api_save_push_subscription");
  const saveEnd = migration.indexOf("create or replace function app_private.api_remove_push_subscription", saveStart);
  const block = migration.slice(saveStart, saveEnd);
  assert.match(block, /v_existing_user is distinct from v_user/);
  assert.match(block, /PUSH_SUBSCRIPTION_ENDPOINT_OWNED/);
  assert.match(block, /where app_portal\.push_subscriptions\.user_id=v_user/);
  assert.doesNotMatch(block, /set\s+user_id\s*=/i);
});

test("browser receives safe device metadata only", () => {
  const snapshotStart = migration.indexOf("create or replace function app_private.api_push_snapshot");
  const snapshotEnd = migration.indexOf("create or replace function app_private.api_save_notification_preferences", snapshotStart);
  const block = migration.slice(snapshotStart, snapshotEnd);
  assert.match(block, /'devices'/);
  assert.match(block, /'deviceLabel'/);
  assert.match(block, /'lastSeenAt'/);
  assert.doesNotMatch(block, /'endpoint'|'p256dh'|'auth'/);
  assert.match(push, /keine Push-Schlüssel oder Endpunkte/);
});

test("logout disables only the current browser subscription before signout", () => {
  const cleanup = auth.slice(
    auth.indexOf("async function deactivateCurrentPushSubscriptionForLogout"),
    auth.indexOf("export const auth")
  );
  assert.match(cleanup, /getSubscription/);
  assert.match(cleanup, /remove_push_subscription/);
  assert.match(cleanup, /subscription\.endpoint/);
  assert.match(cleanup, /subscription\.unsubscribe/);
  const logout = auth.slice(auth.indexOf("async logout()"), auth.indexOf("rememberPostLoginRoute"));
  assert.ok(logout.indexOf("deactivateCurrentPushSubscriptionForLogout") < logout.indexOf("client.auth.signOut"));
});

test("worker is server-only, secret authenticated and provider-neutral at browser boundary", () => {
  assert.match(worker, /request\.method !== "POST"/);
  assert.match(worker, /x-m020-notification-dispatch-secret/);
  assert.match(worker, /M020_NOTIFICATION_DISPATCH_SECRET/);
  assert.match(worker, /MIN_DISPATCH_SECRET_BYTES = 32/);
  assert.match(worker, /constantTimeSecretMatch/);
  assert.match(worker, /pd_notification_claim_batch/);
  assert.match(worker, /pd_notification_complete/);
  assert.match(worker, /Deno\.connectTls/);
  assert.match(worker, /npm:web-push@3\.6\.7/);
  assert.doesNotMatch(worker, /Access-Control-Allow|request\.method === "OPTIONS"/i);
  assert.doesNotMatch(worker, /console\./);
});

test("push provider status handling is bounded and removes gone devices", () => {
  assert.match(worker, /statusCode === 404 \|\| statusCode === 410/);
  assert.match(worker, /disablePushSubscription: true/);
  assert.match(worker, /statusCode === 408 \|\| statusCode === 429 \|\| statusCode >= 500/);
  assert.match(worker, /retryAfterSeconds/);
  assert.match(migration, /disablePushSubscription/);
});

test("quiet hours are applied server-side to central push deliveries", () => {
  assert.match(migration, /notification_push_ready_at/);
  assert.match(migration, /quiet_hours_enabled/);
  assert.match(migration, /next_attempt_at/);
  assert.match(migration, /at time zone v_zone/);
});

test("retention keeps M020 30/90 day bounds and preserves the M150 12-month business rule", () => {
  assert.match(migration, /now\(\)-interval '30 days'/);
  assert.match(migration, /now\(\)-interval '90 days'/);
  assert.match(migration, /delete from app_portal\.push_subscriptions/);
  const start = migration.indexOf("create or replace function app_private.m150_membership_retention_run");
  const end = migration.indexOf("-- M150: keep the existing, already accepted trigger timing", start);
  const block = migration.slice(start, end);
  assert.match(block, /v_cutoff timestamptz := clock_timestamp\(\) - interval '12 months'/);
  assert.match(block, /delete from app_fanclub\.membership_applications/);
  assert.match(block, /STALE_PENDING/);
  assert.match(block, /REJECTED_12_MONTHS/);
  assert.match(block, /WITHDRAWN_12_MONTHS/);
});

test("dispatch cron is inert without Vault configuration", () => {
  assert.match(migration, /pd_notification_dispatch_url/);
  assert.match(migration, /pd_notification_dispatch_secret/);
  assert.match(migration, /if coalesce\(v_url,''\)=''\s+or coalesce\(v_secret,''\)='' then\s+return null/s);
  assert.match(migration, /pd-notification-dispatch-m020-r1/);
  assert.match(migration, /'\* \* \* \* \*'/);
});

test("new Edge function uses explicit verify_jwt=false plus its own secret", () => {
  assert.match(configIntegration, /\[functions\.notification-dispatch\]/);
  assert.match(configIntegration, /verify_jwt = false/);
  assert.match(worker, /if \(!authenticated\) return errorResponse\(401\)/);
});

test("deep links preserve normal route authorization and only focus domain UI", () => {
  assert.match(fanclubIntegration, /applicationId/);
  assert.match(fanclubIntegration, /canViewMembershipApplications/);
  assert.match(membershipIntegration, /openApplicationDetail/);
  assert.match(adminIntegration, /accessRequest/);
  assert.match(adminIntegration, /snapshot\?\.canManageUsers/);
  assert.doesNotMatch([fanclubIntegration,membershipIntegration,adminIntegration].join("\n"), /bypass|service_role|permissionSet\.add/i);
});

test("access rejection never exposes the internal decision reason", () => {
  assert.doesNotMatch(worker, /decisionReason/);
  const start = migration.indexOf("'ACCESS_REQUEST_INTERNAL_NEW'");
  const end = migration.indexOf("elsif e.category='TASKS'", start);
  const accessBlock = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(accessBlock, /decisionReason|decision_reason/);
});

test("boarding-time changes notify a booking once when any participant uses the stop", () => {
  const start = migration.indexOf("'FANBUS_TRIP_DEPARTURE_CHANGED',\n    'FANBUS_BOARDING_TIME_CHANGED'");
  const end = migration.indexOf("  else\n    update app_private.notification_events", start);
  const stopBlock = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(stopBlock, /from app_modules\.fanbus_registrations affected/);
  assert.match(stopBlock, /join app_modules\.fanbus_registrations primary_reg/);
  assert.match(stopBlock, /affected\.trip_boarding_stop_id=stop_record\.id/);
  assert.match(stopBlock, /distinct on \(primary_reg\.booking_id\)/);
});


test("fanbus participant changes address the primary booking contact", () => {
  const start = migration.indexOf("'FANBUS_BOOKING_CREATED',");
  const end = migration.indexOf("elsif e.notification_type in (\n    'FANBUS_TRIP_DEPARTURE_CHANGED'", start);
  const fanbusBlock = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(fanbusBlock, /'firstName', contact\.first_name/);
  assert.match(fanbusBlock, /'affectedName', v_name/);
  assert.match(worker, /const affectedName = asString\(data\.affectedName/);
  assert.match(worker, /Der Wartelistenplatz für \${affectedName}/);
});

test("worker supports new Supabase secret keys without misusing them as bearer JWTs", () => {
  const headerStart = worker.indexOf("function rpcHeaders");
  const headerEnd = worker.indexOf("async function claimBatch", headerStart);
  const block = worker.slice(headerStart, headerEnd);
  assert.ok(headerStart >= 0 && headerEnd > headerStart);
  assert.match(block, /apikey:\s*secretKey/);
  assert.doesNotMatch(block, /Authorization|Bearer/);
});

test("event expansion retries survive PLpgSQL exception rollback and terminate after five attempts", () => {
  const start = migration.indexOf("create or replace function app_private.notification_expand_pending_events");
  const end = migration.indexOf("create or replace function public.pd_notification_claim_batch", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  const claimUpdate = block.indexOf("update app_private.notification_events");
  const protectedBegin = block.indexOf("    begin", claimUpdate);
  assert.ok(claimUpdate >= 0 && protectedBegin > claimUpdate, "attempt increment must occur before the exception subtransaction");
  assert.match(block, /attempt_count=attempt_count\+1/);
  assert.match(block, /case when attempt_count>=5 then 'FAILED' else 'PENDING' end/);
});

test("terminal outbox housekeeping refreshes parent event status for retention", () => {
  const expandStart = migration.indexOf("create or replace function app_private.notification_expand_event");
  const expandEnd = migration.indexOf("create or replace function app_private.notification_expand_pending_events", expandStart);
  const expandBlock = migration.slice(expandStart, expandEnd);
  assert.match(expandBlock, /notification_refresh_event_status\(e\.id\)/);

  const claimStart = migration.indexOf("create or replace function public.pd_notification_claim_batch");
  const claimEnd = migration.indexOf("create or replace function public.pd_notification_complete", claimStart);
  const claimBlock = migration.slice(claimStart, claimEnd);
  assert.match(claimBlock, /ne\.status='EXPANDED'/);
  assert.match(claimBlock, /not exists \(\s*select 1 from app_private\.notification_outbox o\s*where o\.event_id=ne\.id and o\.status in \('PENDING','PROCESSING','RETRY'\)/s);
  assert.match(claimBlock, /notification_refresh_event_status\(r\.id\)/);
});

test("push subscription validation matches the existing DEV database constraints", () => {
  const start = migration.indexOf("create or replace function app_private.api_save_push_subscription");
  const end = migration.indexOf("create or replace function app_private.api_remove_push_subscription", start);
  const block = migration.slice(start, end);
  assert.match(block, /length\(v_endpoint\) not between 20 and 4000/);
  assert.match(block, /length\(v_p256dh\) not between 20 and 500/);
  assert.match(block, /length\(v_auth\) not between 8 and 500/);
  assert.doesNotMatch(block, />4096|>1024/);
});


test("M020 preserves the legacy PUSH_TEST dispatcher gate", () => {
  assert.doesNotMatch(migration, /create or replace function app_private\.push_event_enabled/);
  assert.match(migration, /M020 projections are inserted with push_state='SKIPPED'/);
  const projectionStart = migration.indexOf("create or replace function app_private.notification_project_user");
  const projectionEnd = migration.indexOf("create or replace function app_private.notification_add_external_email", projectionStart);
  const projectionBlock = migration.slice(projectionStart, projectionEnd);
  assert.match(projectionBlock, /'SKIPPED'/);
});


test("task_notification_queue preserves the existing six-argument call contract", () => {
  const start = migration.indexOf("create or replace function app_private.task_notification_queue");
  const end = migration.indexOf("create or replace function app_private.queue_task_created_push_r1", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /p_target_user_id uuid default null/);
});


test("existing task-status push preference still covers TASK_WAITING", () => {
  const start = migration.indexOf("create or replace function app_private.notification_task_subtype_enabled");
  const end = migration.indexOf("create or replace function app_private.notification_preference_enabled", start);
  const block = migration.slice(start, end);
  assert.match(block, /p_event_type = 'TASK_WAITING' then coalesce\(np\.task_status, true\)/);
  assert.match(block, /p_event_type like 'TASK_STATUS_%' then coalesce\(np\.task_status, true\)/);
});


test("dispatch batch and provider timeout stay within the Edge request budget", () => {
  assert.match(worker, /const BATCH_LIMIT = 5;/);
  const pushStart = worker.indexOf("async function sendWithWebPush");
  const pushEnd = worker.indexOf("async function deliver", pushStart);
  const block = worker.slice(pushStart, pushEnd);
  assert.ok(pushStart >= 0 && pushEnd > pushStart);
  assert.match(block, /TTL:\s*86_400,\s*timeout:\s*PROVIDER_TIMEOUT_MS/);
});

test("auth replacement preserves the existing public bootstrap snapshot", () => {
  assert.match(auth, /user:\s*normalizedUser\(\),\s*bootstrap:\s*state\.bootstrap,\s*status:/s);
  assert.match(auth, /await deactivateCurrentPushSubscriptionForLogout\(\);/);
});


test("database HTTP dispatch timeout covers the bounded provider batch", () => {
  const start = migration.indexOf("create or replace function app_private.invoke_notification_dispatch");
  const end = migration.indexOf("create or replace function app_private.notification_retention_run", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /timeout_milliseconds:=120000/);
  assert.doesNotMatch(block, /timeout_milliseconds:=5000/);
});


test("fanbus organization function address also receives cancellation events", () => {
  const start = migration.indexOf("elsif e.notification_type='FANBUS_REGISTRATION_CANCELLED'");
  const end = migration.indexOf("    else", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /fanbusOrganization,emailEnabled/);
  assert.match(block, /'FUNCTION'/);
  assert.match(block, /'fanbus\.internal_cancelled'/);
});


test("logout cleanup cannot wait forever for serviceWorker.ready", () => {
  const start = auth.indexOf("async function deactivateCurrentPushSubscriptionForLogout");
  const end = auth.indexOf("export const auth", start);
  const block = auth.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /serviceWorker\.getRegistration\?\.\(\)/);
  assert.doesNotMatch(block, /serviceWorker\.ready/);
});


test("M020 in-app projections do not retain personal content beyond 30 days", () => {
  const start = migration.indexOf("create or replace function app_private.notification_retention_run");
  const end = migration.indexOf("-- M150:", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /delete from app_portal\.notifications\s+where event_key like 'm020:%'\s+and created_at < now\(\)-interval '30 days'/s);
  assert.match(block, /'projectionsDeleted',v_projections_deleted/);
});


test("fanbus emails are queued only when the booking contact has a valid email", () => {
  const start = migration.indexOf("elsif e.notification_type in (\n    'FANBUS_BOOKING_CREATED'");
  const end = migration.indexOf("  else\n    update app_private.notification_events", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  const contactGuards = block.match(/notification_email_is_valid\(contact\.email\)/g) || [];
  const rowGuards = block.match(/notification_email_is_valid\(r\.email\)/g) || [];
  assert.equal(contactGuards.length, 4);
  assert.equal(rowGuards.length, 2);
});


test("guest and manual fanbus email links do not point into authenticated portal routes", () => {
  const start = migration.indexOf("elsif e.notification_type in (\n    'FANBUS_BOOKING_CREATED'");
  const end = migration.indexOf("  else\n    update app_private.notification_events", start);
  const block = migration.slice(start, end);
  const guards = block.match(/case when (?:contact|r)\.portal_user_id is null then '' else v_route end/g) || [];
  assert.equal(guards.length, 6);
});


test("trip-time changes keep notifying bookings with active companions after primary cancellation", () => {
  const start = migration.indexOf("elsif e.notification_type in (\n    'FANBUS_TRIP_DEPARTURE_CHANGED'");
  const end = migration.indexOf("  else\n    update app_private.notification_events", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /from app_modules\.fanbus_registrations affected\s+join app_modules\.fanbus_registrations primary_reg/s);
  assert.match(block, /affected\.status in \('ACTIVE','WAITLISTED'\)/);
  assert.doesNotMatch(block, /primary_reg\.status in \('ACTIVE','WAITLISTED'\)/);
});



test("concurrent push endpoint ownership races fail closed", () => {
  const start = migration.indexOf("create or replace function app_private.api_save_push_subscription");
  const end = migration.indexOf("create or replace function app_private.api_remove_push_subscription", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /on conflict\(endpoint\) do update[\s\S]*where app_portal\.push_subscriptions\.user_id=v_user;/);
  assert.match(block, /if not found then[\s\S]*PUSH_SUBSCRIPTION_ENDPOINT_OWNED/);
});


test("fanbus booking-created events ignore impossible cancelled primary inserts", () => {
  const start = migration.indexOf("create or replace function app_private.m020_fanbus_registration_trigger");
  const end = migration.indexOf("create or replace function app_private.m020_fanbus_trip_trigger", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /tg_op='INSERT' and new\.booking_role='PRIMARY' and new\.status in \('ACTIVE','WAITLISTED'\)/);
});


test("existing repository contracts are extended for the M020 migration and Edge function", () => {
  assert.match(coreContractIntegration, /20260816170000_add_central_notifications_m020_r1\.sql/);
  assert.match(m150EdgeIntegration, /notification-dispatch/);
  assert.match(m150EdgeIntegration, /verify_jwt = false/);
  assert.match(auth, /if \(event === "INITIAL_SESSION"\) \{\s*return;\s*\}/);
  assert.match(push, /quietStart\.setAttribute\('aria-disabled', String\(!active\)\);/);
  assert.match(push, /quietEnd\.setAttribute\('aria-disabled', String\(!active\)\);/);
});

test("integration artifacts are valid both in package and integrated repository layouts", () => {
  const patches = [
    ["supabase-config", configPatch],
    ["fanclub", fanclubPatch],
    ["membership", membershipPatch],
    ["admin", adminPatch],
    ["core-contract", coreContractPatch],
    ["m150-edge-config", m150EdgePatch]
  ];

  if (patches.every(([, patch]) => patch)) {
    for (const [name, patch] of patches) {
      const badLines = patch.split("\n").filter(line => {
        if (!line) return false;
        if (line.startsWith("--- ") || line.startsWith("+++ ") || line.startsWith("@@ ")) return false;
        if (line.startsWith("\\ No newline at end of file")) return false;
        return ![" ", "+", "-"].includes(line[0]);
      });
      assert.deepEqual(badLines, [], `${name} patch contains malformed context lines`);
    }

    assert.match(adminPatch, /@@ -15,6 \+15,11 @@/);
    assert.match(adminPatch, /@@ -840,7 \+845,15 @@/);
    assert.match(fanclubPatch, /@@ -30,6 \+30,11 @@/);
    assert.match(fanclubPatch, /@@ -1787,6 \+1792,9 @@/);
    assert.match(membershipPatch, /@@ -78,7 \+78,12 @@/);
    assert.match(membershipPatch, /@@ -791,7 \+796,15 @@/);
    return;
  }

  assert.match(configIntegration, /\[functions\.notification-dispatch\]/);
  assert.match(fanclubIntegration, /applicationId/);
  assert.match(membershipIntegration, /openApplicationDetail/);
  assert.match(adminIntegration, /accessRequest/);
});


test("M150 retention blocks nonterminal central M020 work before purging applications", () => {
  const start = migration.indexOf("create or replace function app_private.m150_membership_retention_run");
  const end = migration.indexOf("-- M150: keep the existing, already accepted trigger timing", start);
  const block = migration.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /notification_events as pending_event[\s\S]*pending_event\.status in \('PENDING','PROCESSING','EXPANDED'\)/);
  assert.match(block, /notification_outbox as pending_outbox[\s\S]*pending_outbox\.status in \('PENDING','PROCESSING','RETRY'\)/);
  assert.match(block, /membership_application_email_outbox as sending_outbox[\s\S]*sending_outbox\.status = 'SENDING'/);
  assert.match(block, /for update of m020_outbox/);
});

test("M150 SQL regressions move lifecycle assertions to M020 while preserving explicit legacy drain fixtures", () => {
  if (correction6Integration) {
    assert.match(correction6Integration, /MEMBERSHIP_APPLICATION_RECEIVED/);
    assert.match(correction6Integration, /MEMBERSHIP_APPLICATION_REJECTED/);
    assert.match(correction6Integration, /MEMBERSHIP_ADMISSION_COMPLETED/);
    assert.match(correction6Integration, /Legacy-Drain-Fixture/);
    assert.match(correction6Integration, /Aktives zentrales M020-Event/);
    assert.match(correction6Integration, /EXPECTED_BLOBS/);
    assert.match(correction6Integration, /plan_transformations/);
    assert.match(correction6Integration, /write_transformations/);
  } else {
    assert.match(m150CommunicationSql, /MEMBERSHIP_APPLICATION_RECEIVED/);
    assert.match(m150CommunicationSql, /MEMBERSHIP_APPLICATION_REJECTED/);
    assert.match(m150CommunicationSql, /MEMBERSHIP_ADMISSION_COMPLETED/);
    assert.match(m150CommunicationSql, /Legacy-Drain-Fixture/);

    assert.match(m150ApplicationsSql, /MEMBERSHIP_APPLICATION_RECEIVED/);
    assert.match(m150ApplicationsSql, /app_private\.notification_events/);

    assert.match(m150RetentionSql, /Aktives zentrales M020-Event/);
    assert.match(m150RetentionSql, /event\.status = 'PROCESSING'/);
  }

  const enqueueStart = migration.indexOf("create or replace function app_private.m150_enqueue_membership_email");
  const enqueueEnd = migration.indexOf("create or replace function app_private.m020_membership_internal_new_trigger", enqueueStart);
  const enqueueBlock = migration.slice(enqueueStart, enqueueEnd);
  assert.doesNotMatch(enqueueBlock, /insert into app_private\.membership_application_email_outbox/);
});


test("Correction 6 scopes legacy drain handling and keeps integrated M150 contracts central-only", () => {
  if (correction6Integration) {
    assert.match(
      correction6Integration,
      /where status = 'PENDING';\n\n  update app_private\.membership_application_email_outbox\n  set available_at = now\(\)\n  where application_id = v_vote_app/
    );
    assert.match(correction6Integration, /planned = plan_transformations\(root\)/);
    assert.match(correction6Integration, /write_transformations\(root, planned\)/);

    const mainStart = correction6Integration.indexOf("def main() -> None:");
    const mainBlock = correction6Integration.slice(mainStart);

    assert.ok(mainStart >= 0);
    assert.ok(
      mainBlock.indexOf("plan_transformations(root)") <
      mainBlock.indexOf("write_transformations(root, planned)")
    );
  } else {
    assert.match(m150CommunicationSql, /Legacy-Drain-Fixture/);

    assert.match(
      m150CommunicationSql,
      /notification_type = 'MEMBERSHIP_APPLICATION_RECEIVED'/
    );

    assert.match(
      m150ApplicationsSql,
      /notification_type = 'MEMBERSHIP_APPLICATION_RECEIVED'/
    );

    assert.match(
      m150RetentionSql,
      /notification_type = 'MEMBERSHIP_APPLICATION_RECEIVED'/
    );

    assert.match(
      m150RetentionSql,
      /event\.status = 'PROCESSING'/
    );

    assert.doesNotMatch(
      m150RetentionSql,
      /v_sending_blocked[\s\S]{0,500}status = 'SENDING'/
    );
  }
});
