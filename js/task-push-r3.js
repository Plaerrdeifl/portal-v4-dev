import { api } from "./api.js";
import { auth } from "./auth.js";

const NOTIFICATION_PARAM = "notificationId";
const FANBUS_D073_VIEW_ACTIONS = new Set([
  "fanbus_registrations_list",
  "fanbus_buses_list"
]);
let badgeAuthUserId = "";
let badgeSyncRevision = 0;
let pendingPushDestination = null;
const fanbusAckInFlight = new Set();
const scopeAckInFlight = new Set();

function hashContext(hash = location.hash) {
  const value = String(hash || "#/dashboard");
  const normalized = value.startsWith("#/")
    ? value
    : `#/${value.replace(/^#?\/?/, "")}`;
  const query = normalized.includes("?")
    ? normalized.slice(normalized.indexOf("?") + 1)
    : "";
  const params = new URLSearchParams(query);
  const path = normalized.slice(2).split("?", 1)[0] || "dashboard";

  return {
    path,
    params,
    notificationId: params.get(NOTIFICATION_PARAM) || "",
    taskId: params.get("taskId") || ""
  };
}

function capturePushDestination(hash = location.hash) {
  const context = hashContext(hash);
  if (context.notificationId) {
    pendingPushDestination = {
      path: context.path,
      notificationId: context.notificationId,
      taskId: context.params.get("taskId") || "",
      applicationId: context.params.get("applicationId") || "",
      accessRequestId: context.params.get("accessRequest") || "",
      fanbusTripId: context.params.get("detail") || context.params.get("trip") || ""
    };
  }
  return context;
}

function removeNotificationParam() {
  const hash = String(location.hash || "");
  if (!hash.includes("?")) return;

  const path = hash.slice(0, hash.indexOf("?"));
  const params = new URLSearchParams(hash.slice(hash.indexOf("?") + 1));

  if (!params.has(NOTIFICATION_PARAM)) return;
  params.delete(NOTIFICATION_PARAM);

  const query = params.toString();
  history.replaceState(null, "", query ? `${path}?${query}` : path);
}

function currentAuthUserId(authState = auth.current()) {
  return authState?.authenticated === true
    ? String(authState.session?.user?.id || "")
    : "";
}

async function setLocalBadge(count) {
  const next = Math.max(0, Number(count || 0));

  if (next > 0 && "setAppBadge" in navigator) {
    await navigator.setAppBadge(next);
  } else if ("clearAppBadge" in navigator) {
    await navigator.clearAppBadge();
  }
}

async function applyAuthoritativeBadgeSnapshot(snapshot, userId) {
  if (!userId || currentAuthUserId() !== userId) return;

  await setLocalBadge(
    snapshot?.preferences?.badgeEnabled === false
      ? 0
      : Number(snapshot?.unreadNotificationCount || 0)
  );
}

async function synchronizeAuthoritativeBadge(authState = auth.current()) {
  const revision = ++badgeSyncRevision;
  const userId = currentAuthUserId(authState);

  if (userId !== badgeAuthUserId) {
    badgeAuthUserId = userId;
    await setLocalBadge(0);
  }

  if (
    authState?.authenticated !== true
    || authState?.status !== "ACTIVE"
    || !userId
  ) {
    return;
  }

  try {
    const snapshot = await api.call("push_snapshot");
    if (
      revision !== badgeSyncRevision
      || currentAuthUserId() !== userId
    ) {
      return;
    }

    await applyAuthoritativeBadgeSnapshot(snapshot, userId);
  } catch (error) {
    console.debug("App-Badge konnte nicht autoritativ synchronisiert werden", error);
  }
}

async function acknowledgeFanbusD073(action, payload = {}) {
  if (!FANBUS_D073_VIEW_ACTIONS.has(String(action || ""))) return;
  if (!auth.current().authenticated || !auth.isActive()) return;

  const tripId = String(payload?.tripId || "").trim();
  const userId = currentAuthUserId();
  if (!tripId || !userId) return;

  const key = `${userId}:${tripId}`;
  if (fanbusAckInFlight.has(key)) return;
  fanbusAckInFlight.add(key);

  try {
    const snapshot = await api.call("mark_notification_read", {
      notificationId: pendingNotificationForRoute("bus-orga"),
      entityType: "fanbus_trip_operational",
      entityId: tripId
    });
    await applyAuthoritativeBadgeSnapshot(snapshot, userId);
    clearPendingNotification("bus-orga");
  } catch (error) {
    console.debug("Fanbusmeldungen konnten nicht selektiv quittiert werden", error);
  } finally {
    fanbusAckInFlight.delete(key);
  }
}

async function markNotificationRead({ notificationId = "", taskId = "" } = {}) {
  if (!auth.current().authenticated || !auth.isActive()) return null;
  if (!notificationId && !taskId) return null;

  const result = await api.call("mark_notification_read", {
    notificationId,
    entityType: taskId ? "task" : "",
    entityId: taskId
  });

  await applyAuthoritativeBadgeSnapshot(result, currentAuthUserId());
  return result;
}

function pendingNotificationForRoute(path) {
  return pendingPushDestination?.path === path
    ? pendingPushDestination.notificationId
    : "";
}

function pendingDestinationForRoute(path) {
  return pendingPushDestination?.path === path
    ? pendingPushDestination
    : null;
}

function clearPendingNotification(path) {
  if (pendingPushDestination?.path === path) {
    pendingPushDestination = null;
    removeNotificationParam();
  }
}

function areaIsActive(path, selector) {
  if (hashContext().path !== path) return false;
  const area = document.querySelector(selector);
  return Boolean(area && !area.querySelector(".notice.error"));
}

async function acknowledgeScope(scope, path, entityId = "") {
  if (!auth.current().authenticated || !auth.isActive()) return;

  const notificationId = pendingNotificationForRoute(path);
  const userId = currentAuthUserId();
  const key = `${userId}:${scope}:${entityId}`;
  if (!userId || scopeAckInFlight.has(key)) return;
  scopeAckInFlight.add(key);

  try {
    const snapshot = await api.call("mark_notification_read", {
      notificationId,
      scope,
      entityId
    });
    await applyAuthoritativeBadgeSnapshot(snapshot, userId);
    clearPendingNotification(path);
  } catch (error) {
    console.debug("Benachrichtigungsbereich konnte nicht quittiert werden", error);
  } finally {
    scopeAckInFlight.delete(key);
  }
}

function hasItem(items, id) {
  return !id || (Array.isArray(items) && items.some(item => String(item?.id || "") === id));
}

function acknowledgeActivatedArea(action, data = null) {
  const context = hashContext();
  const pending = pendingDestinationForRoute(context.path);

  if (action === "dashboard" && areaIsActive("dashboard", "#dashboardWidgets")) {
    void acknowledgeScope("dashboard", "dashboard");
  } else if (action === "events_list" && areaIsActive("dates", "#m210DatesList")) {
    void acknowledgeScope("dates", "dates");
  } else if (
    action === "tasks_snapshot"
    && areaIsActive("tasks", "#tasksPanel")
    && hasItem(data?.tasks, pending?.taskId || "")
  ) {
    void acknowledgeScope("tasks", "tasks");
  } else if (
    action === "fanbus_trips_list"
    && areaIsActive("fanbuses", "#m310FanbusList")
    && hasItem(data?.trips, pending?.fanbusTripId || "")
  ) {
    void acknowledgeScope("fanbuses", "fanbuses");
  } else if (
    action === "membership_applications_list"
    && context.path === "fanclub"
    && document.querySelector('[data-tab="membership-applications"].active')
    && !pending?.applicationId
  ) {
    void acknowledgeScope("membership_applications", "fanclub");
  } else if (
    action === "membership_application_detail"
    && context.path === "fanclub"
    && pending?.applicationId
    && String(data?.application?.id || data?.id || "") === pending.applicationId
  ) {
    void acknowledgeScope("membership_applications", "fanclub");
  } else if (
    action === "admin_snapshot"
    && context.path === "admin"
    && document.querySelector('[data-admin-tab="requests"].active')
    && hasItem(data?.requests, pending?.accessRequestId || "")
  ) {
    void acknowledgeScope("access_requests", "admin");
  }
}

function normalizeTransferUi() {
  document.querySelectorAll(
    "[data-request-transfer], [data-accept-transfer], [data-reject-transfer], [data-cancel-transfer], .v4-task-transfer-notice"
  ).forEach(element => element.remove());

  document.querySelectorAll("[data-immediate-transfer]").forEach(button => {
    button.textContent = "Aufgabe übertragen";
    button.classList.remove("danger");
    button.classList.add("secondary");
    button.setAttribute("aria-label", "Aufgabe direkt übertragen");
  });

  document.querySelectorAll("dialog h2, dialog [data-dialog-title]").forEach(title => {
    if (title.textContent?.trim() === "Aufgabe sofort übertragen") {
      title.textContent = "Aufgabe übertragen";
    }
  });

  document.querySelectorAll('dialog button[type="submit"]').forEach(button => {
    if (button.textContent?.trim() === "Sofort übertragen") {
      button.textContent = "Aufgabe übertragen";
    }
  });

  const transferPreference = document
    .querySelector('input[name="taskTransfers"]')
    ?.closest("label");

  if (transferPreference) {
    const title = transferPreference.querySelector("strong");
    const description = transferPreference.querySelector("small");

    if (title) title.textContent = "Aufgabenübertragungen";
    if (description) {
      description.textContent = "Direkte Zuweisung einer Aufgabe an eine andere Person";
    }
  }
}

function normalizeSoon() {
  queueMicrotask(normalizeTransferUi);
  for (const delay of [0, 80, 250]) {
    window.setTimeout(normalizeTransferUi, delay);
  }
}

async function markTaskFromInteraction(target) {
  const button = target?.closest?.("[data-open-task]");
  const taskId = button?.dataset?.openTask || "";
  if (!taskId) return;

  try {
    await markNotificationRead({ taskId });
  } catch (error) {
    console.debug("Aufgabenmeldung konnte nicht als gelesen markiert werden", error);
  }
}

navigator.serviceWorker?.addEventListener(
  "message",
  event => {
    if (event.data?.type === "PUSH_STATE_CHANGED") {
      void synchronizeAuthoritativeBadge();

      if (String(event.data.eventType || "").startsWith("TASK_")) {
        void auth.refresh().catch(error => {
          console.debug("Aufgabennavigation konnte nicht aktualisiert werden", error);
        });
        normalizeSoon();
      }
    }
  },
  { capture: true }
);

document.addEventListener(
  "click",
  event => {
    void markTaskFromInteraction(event.target);
    if (event.target?.closest?.('[data-admin-tab="requests"]')) {
      window.setTimeout(() => {
        if (
          hashContext().path === "admin"
          && document.querySelector('[data-admin-tab="requests"].active')
          && areaIsActive("admin", "#adminPanel")
        ) {
          void acknowledgeScope("access_requests", "admin");
        }
      }, 0);
    }
    normalizeSoon();
  },
  true
);

window.addEventListener("pd-api-state", normalizeSoon);
window.addEventListener("pd-api-after-call", event => {
  void acknowledgeFanbusD073(event.detail?.action, event.detail?.payload);
  window.setTimeout(
    () => acknowledgeActivatedArea(
      event.detail?.action || "",
      event.detail?.data
    ),
    0
  );
});
window.addEventListener("hashchange", () => {
  capturePushDestination();
  normalizeSoon();
});

window.addEventListener("pd-auth-change", event => {
  void synchronizeAuthoritativeBadge(event.detail);
});

window.addEventListener("pageshow", () => {
  normalizeSoon();
  void synchronizeAuthoritativeBadge();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  normalizeTransferUi();
  void synchronizeAuthoritativeBadge();
});

capturePushDestination();
normalizeTransferUi();
void synchronizeAuthoritativeBadge();
