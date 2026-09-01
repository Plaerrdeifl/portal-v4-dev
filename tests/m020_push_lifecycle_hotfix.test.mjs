import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [migration, actorProjectionMigration, push, auth, serviceWorker] = await Promise.all([
  read("supabase/migrations/20260823202816_m020_push_subscription_lifecycle_hotfix.sql"),
  read("supabase/migrations/20260824044603_m020_access_request_actor_projection_hotfix.sql"),
  read("js/push.js"),
  read("js/auth.js"),
  read("service-worker.js")
]);

function functionBlock(source, name, nextName = null) {
  const start = source.indexOf(`create or replace function app_private.${name}`);
  assert.ok(start >= 0, `${name} fehlt`);
  const end = nextName
    ? source.indexOf(`create or replace function app_private.${nextName}`, start)
    : source.length;
  assert.ok(end > start, `Ende von ${name} fehlt`);
  return source.slice(start, end);
}

function javascriptFunction(source, name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(`async function ${nextName}`, start);
  assert.ok(start >= 0 && end > start, `${name} konnte nicht isoliert werden`);
  return source.slice(start, end);
}

test("T01 remove_push_subscription verändert push_enabled nicht", () => {
  const block = functionBlock(
    migration,
    "api_remove_push_subscription",
    "api_save_push_subscription"
  );
  assert.match(block, /is_active\s*=\s*false/);
  assert.match(block, /disabled_at\s*=\s*coalesce\(disabled_at, now\(\)\)/);
  assert.doesNotMatch(block, /push_enabled|notification_preferences/);
  assert.match(block, /Geräte-Lifecycle und dauerhafte Benutzerpräferenz sind bewusst getrennt\./);
  assert.match(block, /Ein Logout oder das Entfernen eines einzelnen Geräts ist kein globaler Opt-out\./);
});

test("T02 save_push_subscription erhält Endpoint Ownership", () => {
  const block = functionBlock(
    migration,
    "api_save_push_subscription",
    "api_save_notification_preferences"
  );
  assert.match(block, /v_existing_user is distinct from v_user/);
  assert.match(block, /PUSH_SUBSCRIPTION_ENDPOINT_OWNED/);
  assert.match(block, /where app_portal\.push_subscriptions\.user_id = v_user/);
  assert.doesNotMatch(block, /set\s+user_id\s*=/i);
});

test("T03 Subscription-Save ändert Revision und updated_at nur beim Aktivieren", () => {
  const block = functionBlock(
    migration,
    "api_save_push_subscription",
    "api_save_notification_preferences"
  );
  assert.match(
    block,
    /revision\s*=\s*case\s+when app_portal\.notification_preferences\.push_enabled\s+then app_portal\.notification_preferences\.revision\s+else app_portal\.notification_preferences\.revision \+ 1\s+end/
  );
  assert.match(
    block,
    /updated_at\s*=\s*case\s+when app_portal\.notification_preferences\.push_enabled\s+then app_portal\.notification_preferences\.updated_at\s+else now\(\)\s+end/
  );
  assert.doesNotMatch(block, /where app_portal\.notification_preferences\.push_enabled = false/);
});

test("T04 explizites pushEnabled=false deaktiviert alle aktiven Server-Geräte", () => {
  const block = functionBlock(migration, "api_save_notification_preferences");
  const parse = block.indexOf("v_push_enabled_requested :=");
  const casCall = block.indexOf("api_save_notification_preferences_before_m330_r1");
  assert.match(block, /declare\s+v_push_enabled_requested boolean;/);
  assert.match(block, /p_payload \? 'pushEnabled'/);
  assert.match(block, /v_push_enabled_requested := \(p_payload ->> 'pushEnabled'\)::boolean/);
  assert.ok(parse >= 0 && parse < casCall);
  assert.match(block, /if v_push_enabled_requested is false then/);
  assert.match(block, /update app_portal\.push_subscriptions/);
  assert.match(block, /where user_id = auth\.uid\(\)\s+and is_active = true/);
  assert.match(block, /api_save_notification_preferences_before_m330_r1/);
  assert.match(block, /push_fanbus_trip_cancellations/);
});

test("T05 normales savePreferences sendet kein pushEnabled", () => {
  const block = javascriptFunction(push, "savePreferences", "reconcileLogoutPush");
  assert.match(block, /save_notification_preferences/);
  assert.doesNotMatch(block, /pushEnabled/);
});

test("T06 Logout setzt den usergebundenen Marker nur bei lokaler Subscription", () => {
  const cleanup = auth.slice(
    auth.indexOf("async function deactivateCurrentPushSubscriptionForLogout"),
    auth.indexOf("export const auth")
  );
  assert.match(auth, /PD_PUSH_LOGOUT_RECOVERY_PREFIX = "pdPushLogoutRecovery:"/);
  assert.match(cleanup, /state\.session\?\.user\?\.id/);
  assert.ok(cleanup.indexOf("if (!subscription) return") < cleanup.indexOf("localStorage.setItem"));
  assert.ok(cleanup.indexOf("localStorage.setItem") < cleanup.indexOf('api.call("remove_push_subscription"'));
  const logout = auth.slice(auth.indexOf("async logout()"), auth.indexOf("rememberPostLoginRoute"));
  assert.ok(logout.indexOf("deactivateCurrentPushSubscriptionForLogout") < logout.indexOf("client.auth.signOut"));
});

test("T07 Reconcile reagiert auf pd-auth-change", () => {
  assert.match(
    push,
    /window\.addEventListener\("pd-auth-change", event => \{\s+void reconcileLogoutPush\(event\.detail\)/
  );
});

test("T08 Reconcile verlangt authenticated, ACTIVE und den exakten User-Marker", () => {
  const block = javascriptFunction(push, "reconcileLogoutPush", "openSettings");
  assert.match(block, /authState\?\.authenticated !== true/);
  assert.match(block, /authState\?\.status !== "ACTIVE"/);
  assert.match(block, /authState\?\.session\?\.user\?\.id/);
  assert.match(block, /hasLogoutRecoveryMarker\(userId\)/);
  assert.match(push, /recoveryMarkerKey\(userId\)/);
});

test("T09 Reconcile fordert niemals automatisch Notification-Permission an", () => {
  const block = javascriptFunction(push, "reconcileLogoutPush", "openSettings");
  assert.match(block, /Notification\.permission !== "granted"/);
  assert.doesNotMatch(block, /requestPermission/);
});

test("T10 Reconcile verwendet vorhandene Subscription oder subscribe bei granted", () => {
  const block = javascriptFunction(push, "reconcileLogoutPush", "openSettings");
  assert.match(block, /navigator\.serviceWorker\.ready/);
  assert.match(block, /pushManager\.getSubscription\(\)/);
  assert.match(block, /if \(!subscription\)[\s\S]*pushManager\.subscribe\(\{/);
  assert.match(block, /userVisibleOnly:\s*true/);
  assert.match(block, /applicationServerKey:/);
});

test("T11 Recovery-Marker fällt erst nach erfolgreichem Server-Save", () => {
  const block = javascriptFunction(push, "reconcileLogoutPush", "openSettings");
  const save = block.indexOf('api.call("save_push_subscription"');
  const clear = block.lastIndexOf("clearLogoutRecoveryMarker(userId)");
  assert.ok(save >= 0 && clear > save);
  assert.match(block, /\.catch\(error => \{[\s\S]*console\.warn/);
});

test("T12 bewusste Geräte-Deaktivierung entfernt den Recovery-Marker", () => {
  const block = javascriptFunction(push, "disablePush", "disablePushGlobally");
  assert.ok(block.indexOf("clearLogoutRecoveryMarker(currentUserId())") >= 0);
  assert.ok(
    block.indexOf("clearLogoutRecoveryMarker(currentUserId())")
      < block.indexOf('api.call("remove_push_subscription"')
  );
});

test("T13 globaler Opt-out ist klar von Geräte-Deaktivierung getrennt", () => {
  assert.match(push, />Auf diesem Gerät deaktivieren<\/button>/);
  assert.match(push, />Push vollständig deaktivieren<\/button>/);
  const block = javascriptFunction(push, "disablePushGlobally", "removeDevice");
  assert.match(block, /save_notification_preferences/);
  assert.match(block, /pushEnabled:\s*false/);
  assert.match(block, /subscription\.unsubscribe\(\)/);
  assert.match(block, /clearAppBadge/);
  assert.match(block, /clearLogoutRecoveryMarker/);
  assert.match(block, /snapshot = await api\.call\("push_snapshot"\)/);
});

test("T14 Hotfix ändert keine Fanbus-Empfängerlogik", () => {
  assert.doesNotMatch(migration, /fanbus\.internal_new|BUS_ORGA|ADMIN/);
  assert.doesNotMatch(migration, /notification_(add|expand|recipient|enqueue)/i);
});

test("T15 Service Worker benötigt keinen pushsubscriptionchange-Hotfix", () => {
  assert.doesNotMatch(serviceWorker, /pushsubscriptionchange/i);
  assert.doesNotMatch(migration, /service[ _-]?worker|pushsubscriptionchange/i);
});

test("T16 Auto-Reconcile auf iOS verlangt die Standalone-PWA", () => {
  const block = javascriptFunction(push, "reconcileLogoutPush", "openSettings");
  const iosGuard = block.indexOf("if (isIos() && !isStandalone()) return");
  const subscriptionRead = block.indexOf("navigator.serviceWorker.ready");
  const serverSave = block.indexOf('api.call("save_push_subscription"');
  assert.ok(iosGuard >= 0);
  assert.ok(iosGuard < subscriptionRead);
  assert.ok(iosGuard < serverSave);
  assert.doesNotMatch(block, /requestPermission/);
});

test("T17 erfolgreiches manuelles enablePush löscht den Marker erst nach Server-Save", () => {
  const block = javascriptFunction(push, "enablePush", "disablePush");
  const serverSave = block.indexOf('api.call("save_push_subscription"');
  const markerClear = block.indexOf("clearLogoutRecoveryMarker(currentUserId())");
  assert.ok(serverSave >= 0);
  assert.ok(markerClear > serverSave);
});

test("T18 Access-Request-Projektion nullt Nicht-Portal-Akteure und erhält Portaluser", () => {
  const block = functionBlock(actorProjectionMigration, "notification_project_user");
  assert.match(block, /v_actor_user_id uuid/);
  assert.match(
    block,
    /if p_event\.actor_user_id is not null\s+and exists \(\s+select 1\s+from app_portal\.users u\s+where u\.id = p_event\.actor_user_id\s+\) then/s
  );
  assert.match(block, /v_actor_user_id := p_event\.actor_user_id/);
  assert.match(block, /else\s+v_actor_user_id := null/);
  assert.match(
    block,
    /entity_id,\s+actor_user_id,\s+push_state[\s\S]*nullif\(p_event\.entity_id, ''\),\s+v_actor_user_id,\s+'SKIPPED'/
  );
  assert.match(block, /Non-portal actors remain on the event/);
});
