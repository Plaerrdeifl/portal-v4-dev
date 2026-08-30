import { api } from "./api.js";
import { auth } from "./auth.js";

const NOTIFICATION_PARAM = "notificationId";
const FANBUS_D073_VIEW_ACTIONS = new Set([
  "fanbus_registrations_list",
  "fanbus_buses_list"
]);
let pendingHashWork = null;
let lastPreparedTaskId = "";
let badgeAuthUserId = "";
let badgeSyncRevision = 0;
const fanbusAckInFlight = new Set();

function normalizedHashRoute(route = "#/dashboard") {
  const value = String(route || "#/dashboard").trim();
  if (value.startsWith("#/")) return value;
  return `#/${value.replace(/^#?\/?/, "")}`;
}

function routeWithNotification(route, notificationId = "") {
  const normalized = normalizedHashRoute(route);
  const [path, query = ""] = normalized.split("?", 2);
  const params = new URLSearchParams(query);
  const id = String(notificationId || "").trim();

  if (id) params.set(NOTIFICATION_PARAM, id);

  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

function hashContext() {
  const hash = String(location.hash || "");
  const query = hash.includes("?")
    ? hash.slice(hash.indexOf("?") + 1)
    : "";
  const params = new URLSearchParams(query);

  return {
    notificationId: params.get(NOTIFICATION_PARAM) || "",
    taskId: params.get("taskId") || ""
  };
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
      entityType: "fanbus_trip_operational",
      entityId: tripId
    });
    await applyAuthoritativeBadgeSnapshot(snapshot, userId);
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

  await synchronizeAuthoritativeBadge();
  return result;
}

async function prepareHashDestination({ forceRender = false } = {}) {
  if (pendingHashWork) return pendingHashWork;

  const context = hashContext();
  if (!context.notificationId && !context.taskId) return null;
  if (!context.notificationId && context.taskId === lastPreparedTaskId) return null;

  pendingHashWork = (async () => {
    await auth.initialize();

    if (!auth.current().authenticated) return null;

    await auth.refresh();
    await markNotificationRead(context);
    if (context.taskId) lastPreparedTaskId = context.taskId;
    removeNotificationParam();

    if (forceRender) {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }

    return context;
  })().catch(error => {
    console.error("Push-Ziel konnte nicht vollständig vorbereitet werden", error);
    return null;
  }).finally(() => {
    pendingHashWork = null;
  });

  return pendingHashWork;
}

async function openPushDestination(route, notificationId = "") {
  const next = routeWithNotification(route, notificationId);

  await auth.initialize();

  if (auth.current().authenticated) {
    await auth.refresh();
  }

  if (location.hash === next) {
    await prepareHashDestination({ forceRender: true });
    return;
  }

  location.hash = next;
  await prepareHashDestination();
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
      return;
    }

    if (event.data?.type !== "OPEN_PUSH_ROUTE") return;

    event.stopImmediatePropagation();
    void openPushDestination(
      event.data.route || "#/dashboard",
      event.data.notificationId || ""
    );
  },
  { capture: true }
);

document.addEventListener(
  "click",
  event => {
    void markTaskFromInteraction(event.target);
    normalizeSoon();
  },
  true
);

window.addEventListener("pd-api-state", normalizeSoon);
window.addEventListener("pd-api-after-call", event => {
  void acknowledgeFanbusD073(event.detail?.action, event.detail?.payload);
});
window.addEventListener("hashchange", normalizeSoon);

window.addEventListener("pd-auth-change", event => {
  void synchronizeAuthoritativeBadge(event.detail);

  if (!event.detail?.authenticated) return;
  void prepareHashDestination({ forceRender: true });
});

window.addEventListener("pageshow", () => {
  normalizeSoon();
  void synchronizeAuthoritativeBadge();
  void prepareHashDestination({ forceRender: true });
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  normalizeTransferUi();
  void synchronizeAuthoritativeBadge();
  void prepareHashDestination({ forceRender: true });
});

normalizeTransferUi();
void synchronizeAuthoritativeBadge();
void prepareHashDestination();
