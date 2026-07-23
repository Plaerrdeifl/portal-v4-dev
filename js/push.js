import { api } from "./api.js";
import { auth } from "./auth.js";

let dialog = null;
let snapshot = null;
let busy = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function notify(message, type = "info") {
  const region = document.getElementById("toastRegion");

  if (!region) {
    window.alert(message);
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  region.appendChild(toast);
  window.setTimeout(() => toast.remove(), type === "error" ? 5200 : 3800);
}

function supported() {
  return Boolean(
    "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
  );
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (
      navigator.platform === "MacIntel"
      && navigator.maxTouchPoints > 1
    );
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || navigator.standalone === true;
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding)
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
}

function deviceLabel() {
  const agent = navigator.userAgent;

  if (/iPhone/i.test(agent)) return "iPhone";
  if (/iPad/i.test(agent)) return "iPad";
  if (/Android/i.test(agent)) return "Android-Gerät";
  if (/Windows/i.test(agent)) return "Windows-PC";
  if (/Macintosh|Mac OS X/i.test(agent)) return "Mac";
  return "Webgerät";
}

async function currentSubscription() {
  if (!supported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function updateBadge(count = null) {
  if (!("setAppBadge" in navigator) || !auth.current().authenticated) return;

  try {
    let next = count;

    if (next === null) {
      const current = await api.call("push_snapshot");
      next = Number(current?.unreadNotificationCount || 0);
    }

    if (next > 0) await navigator.setAppBadge(next);
    else if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
  } catch {
    // Das Badge ist eine Ergänzung und darf den Portalbetrieb nicht stören.
  }
}

function ensureDialog() {
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = "pushSettingsDialog";
  dialog.className = "v4-dialog v4-push-dialog";
  dialog.innerHTML = `
    <div class="v4-dialog-shell">
      <header>
        <div class="v4-push-dialog-heading">
          <h2>Benachrichtigungen</h2>
        </div>
        <button
          class="icon-button"
          type="button"
          data-close-push-settings
          aria-label="Benachrichtigungseinstellungen schließen"
        >×</button>
      </header>
      <div id="pushSettingsBody" class="v4-push-scroll-region"></div>
    </div>
  `;

  document.body.appendChild(dialog);

  dialog.addEventListener("click", event => {
    if (
      event.target === dialog
      || event.target.closest("[data-close-push-settings]")
    ) {
      dialog.close();
    }
  });

  return dialog;
}

function permissionLabel(permission) {
  if (permission === "granted") return "Erlaubt";
  if (permission === "denied") return "Blockiert";
  return "Noch nicht entschieden";
}

function render() {
  const host = document.getElementById("pushSettingsBody");
  if (!host) return;

  const preferences = snapshot?.preferences || {};
  const permission = supported() ? Notification.permission : "unsupported";
  const iosInstallRequired = isIos() && !isStandalone();
  const devices = Number(snapshot?.activeDeviceCount || 0);
  const enabled =
    permission === "granted"
    && devices > 0
    && preferences.pushEnabled !== false;
  const quietHoursEnabled = Boolean(preferences.quietHoursEnabled);

  host.innerHTML = `
    <div class="v4-push-summary">
      <div>
        <span>Status</span>
        <strong>${enabled ? "Push aktiv" : "Push nicht aktiv"}</strong>
      </div>
      <div>
        <span>Berechtigung</span>
        <strong>${escapeHtml(
          permission === "unsupported"
            ? "Nicht unterstützt"
            : permissionLabel(permission)
        )}</strong>
      </div>
      <div>
        <span>Registrierte Geräte</span>
        <strong>${devices}</strong>
      </div>
    </div>

    ${iosInstallRequired ? `
      <div class="notice warning">
        <strong>Auf dem iPhone zuerst als App installieren</strong>
        <p>
          Öffne das Teilen-Menü in Safari, wähle „Zum Home-Bildschirm“
          und starte anschließend die installierte Plärrdeifl-App.
        </p>
      </div>
    ` : ""}

    ${permission === "denied" ? `
      <div class="notice error">
        <strong>Benachrichtigungen sind blockiert</strong>
        <p>
          Erlaube sie in den Geräte- beziehungsweise Browser-Einstellungen
          für die Plärrdeifl-App.
        </p>
      </div>
    ` : ""}

    <div class="v4-push-actions">
      <button
        class="button primary"
        type="button"
        data-enable-push
        ${busy || !supported() || iosInstallRequired || permission === "denied"
          ? "disabled"
          : ""}
      >
        ${enabled ? "Dieses Gerät aktualisieren" : "Push aktivieren"}
      </button>
      <button
        class="button secondary"
        type="button"
        data-send-push-test
        ${busy || !enabled ? "disabled" : ""}
      >
        Testmeldung senden
      </button>
      <button
        class="button danger"
        type="button"
        data-disable-push
        ${busy || !enabled ? "disabled" : ""}
      >
        Auf diesem Gerät deaktivieren
      </button>
    </div>

    <form id="pushPreferencesForm" class="v4-push-preferences">
      <input
        type="hidden"
        name="revision"
        value="${escapeHtml(preferences.revision || 1)}"
      >

      <h3>Welche Meldungen möchtest du erhalten?</h3>

      <label class="v4-switch-row">
        <span>
          <strong>Neue Aufgaben-Updates</strong>
          <small>Neue Verlaufs- und Fortschrittseinträge</small>
        </span>
        <input
          type="checkbox"
          name="taskUpdates"
          ${preferences.taskUpdates !== false ? "checked" : ""}
        >
      </label>

      <label class="v4-switch-row">
        <span>
          <strong>Statusänderungen</strong>
          <small>Offen, in Bearbeitung, wartet oder erledigt</small>
        </span>
        <input
          type="checkbox"
          name="taskStatus"
          ${preferences.taskStatus !== false ? "checked" : ""}
        >
      </label>

      <label class="v4-switch-row">
        <span>
          <strong>Aufgabenübertragungen</strong>
          <small>Anfrage, Annahme, Ablehnung und Rücknahme</small>
        </span>
        <input
          type="checkbox"
          name="taskTransfers"
          ${preferences.taskTransfers !== false ? "checked" : ""}
        >
      </label>

      <label class="v4-switch-row">
        <span>
          <strong>Wartefristen</strong>
          <small>Läuft innerhalb von 24 Stunden ab oder ist überschritten</small>
        </span>
        <input
          type="checkbox"
          name="waitingDeadlines"
          ${preferences.waitingDeadlines !== false ? "checked" : ""}
        >
      </label>

      <label class="v4-switch-row">
        <span>
          <strong>Zahl am App-Symbol</strong>
          <small>Anzahl ungelesener Portal-Meldungen</small>
        </span>
        <input
          type="checkbox"
          name="badgeEnabled"
          ${preferences.badgeEnabled !== false ? "checked" : ""}
        >
      </label>

      <label class="v4-switch-row">
        <span>
          <strong>Ruhezeit</strong>
          <small>Push wird nach Ende der Ruhezeit zugestellt</small>
        </span>
        <input
          type="checkbox"
          name="quietHoursEnabled"
          ${preferences.quietHoursEnabled ? "checked" : ""}
        >
      </label>

      <div class="v4-push-quiet-grid ${quietHoursEnabled ? "is-enabled" : "is-disabled"}">
        <label>Von
          <input
            type="time"
            name="quietStart"
            value="${escapeHtml(preferences.quietStart || "22:00")}"
          >
        </label>
        <label>Bis
          <input
            type="time"
            name="quietEnd"
            value="${escapeHtml(preferences.quietEnd || "07:00")}"
          >
        </label>
        <input
          type="hidden"
          name="timeZone"
          value="${escapeHtml(
            Intl.DateTimeFormat().resolvedOptions().timeZone
            || "Europe/Berlin"
          )}"
        >
      </div>

      <button
        class="button secondary"
        type="submit"
        ${busy ? "disabled" : ""}
      >
        Einstellungen speichern
      </button>
    </form>
  `;

  host.querySelector("[data-enable-push]")
    ?.addEventListener("click", enablePush);
  host.querySelector("[data-disable-push]")
    ?.addEventListener("click", disablePush);
  host.querySelector("[data-send-push-test]")
    ?.addEventListener("click", sendTest);
  host.querySelector("#pushPreferencesForm")
    ?.addEventListener("submit", savePreferences);

  const quietToggle = host.querySelector('input[name="quietHoursEnabled"]');
  const quietStart = host.querySelector('input[name="quietStart"]');
  const quietEnd = host.querySelector('input[name="quietEnd"]');
  const quietGrid = host.querySelector('.v4-push-quiet-grid');
  const syncQuietHoursInputs = () => {
    const active = Boolean(quietToggle?.checked);
    if (quietStart) {
      quietStart.readOnly = !active;
      quietStart.setAttribute('aria-disabled', String(!active));
      quietStart.tabIndex = active ? 0 : -1;
    }
    if (quietEnd) {
      quietEnd.readOnly = !active;
      quietEnd.setAttribute('aria-disabled', String(!active));
      quietEnd.tabIndex = active ? 0 : -1;
    }
    quietGrid?.classList.toggle('is-enabled', active);
    quietGrid?.classList.toggle('is-disabled', !active);
  };
  quietToggle?.addEventListener("change", syncQuietHoursInputs);
  syncQuietHoursInputs();
}

async function reload() {
  snapshot = await api.call("push_snapshot");
  await updateBadge(Number(snapshot?.unreadNotificationCount || 0));
  render();
}

async function enablePush() {
  if (busy || !supported()) return;
  busy = true;
  render();

  try {
    if (isIos() && !isStandalone()) {
      throw new Error(
        "Auf dem iPhone muss das Portal zuerst zum Home-Bildschirm hinzugefügt werden."
      );
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error("Benachrichtigungen wurden nicht erlaubt.");
    }

    if (!snapshot?.publicKey) {
      throw new Error("Öffentlicher Push-Schlüssel fehlt.");
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(snapshot.publicKey)
      });
    }

    const serialized = subscription.toJSON();

    snapshot = await api.call("save_push_subscription", {
      endpoint: serialized.endpoint,
      p256dh: serialized.keys?.p256dh || "",
      auth: serialized.keys?.auth || "",
      deviceLabel: deviceLabel(),
      userAgent: navigator.userAgent
    });

    notify("Push-Mitteilungen sind auf diesem Gerät aktiviert.", "success");
    await updateBadge(Number(snapshot?.unreadNotificationCount || 0));
  } catch (error) {
    notify(error?.message || "Push konnte nicht aktiviert werden.", "error");
  } finally {
    busy = false;
    render();
  }
}

async function disablePush() {
  if (busy) return;
  busy = true;
  render();

  try {
    const subscription = await currentSubscription();

    if (subscription) {
      await api.call("remove_push_subscription", {
        endpoint: subscription.endpoint
      });
      await subscription.unsubscribe();
    }

    snapshot = await api.call("push_snapshot");

    if ("clearAppBadge" in navigator) {
      await navigator.clearAppBadge();
    }

    notify("Push wurde auf diesem Gerät deaktiviert.", "success");
  } catch (error) {
    notify(error?.message || "Push konnte nicht deaktiviert werden.", "error");
  } finally {
    busy = false;
    render();
  }
}

async function sendTest() {
  if (busy) return;
  busy = true;
  render();

  try {
    await api.call("create_push_test");
    notify(
      "Testmeldung wurde ausgelöst. Die Zustellung kann einige Sekunden dauern.",
      "success"
    );
  } catch (error) {
    notify(error?.message || "Testmeldung konnte nicht gesendet werden.", "error");
  } finally {
    busy = false;
    render();
  }
}

async function savePreferences(event) {
  event.preventDefault();
  if (busy) return;

  busy = true;
  render();

  try {
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());

    snapshot = await api.call("save_notification_preferences", {
      revision: values.revision,
      pushEnabled: Number(snapshot?.activeDeviceCount || 0) > 0,
      taskUpdates: form.elements.taskUpdates.checked,
      taskStatus: form.elements.taskStatus.checked,
      taskTransfers: form.elements.taskTransfers.checked,
      waitingDeadlines: form.elements.waitingDeadlines.checked,
      badgeEnabled: form.elements.badgeEnabled.checked,
      quietHoursEnabled: form.elements.quietHoursEnabled.checked,
      quietStart: values.quietStart,
      quietEnd: values.quietEnd,
      timeZone: values.timeZone
    });

    notify("Benachrichtigungseinstellungen wurden gespeichert.", "success");
    await updateBadge(
      snapshot?.preferences?.badgeEnabled === false
        ? 0
        : Number(snapshot?.unreadNotificationCount || 0)
    );
  } catch (error) {
    notify(error?.message || "Einstellungen konnten nicht gespeichert werden.", "error");
  } finally {
    busy = false;
    render();
  }
}

async function openSettings() {
  if (!auth.current().authenticated) {
    notify("Bitte melde dich zuerst an.", "error");
    return;
  }

  const currentDialog = ensureDialog();
  const host = document.getElementById("pushSettingsBody");

  if (host) {
    host.innerHTML =
      '<article class="card loading-card"><h3>Benachrichtigungen werden geladen …</h3></article>';
  }

  if (!currentDialog.open) currentDialog.showModal();

  try {
    await reload();
  } catch (error) {
    if (host) {
      host.innerHTML = `
        <article class="card notice error">
          <strong>Einstellungen konnten nicht geladen werden</strong>
          <p>${escapeHtml(error?.message || error)}</p>
        </article>
      `;
    }
  }
}

window.plaerrdeiflPush = Object.freeze({
  openSettings,
  syncBadge: updateBadge
});

const __V4_PUSH_BADGE_QUIETTIME_FIX3_APPLIED__ = true;

window.setTimeout(() => {
  if (auth.current().authenticated) updateBadge();
}, 1500);

window.addEventListener("online", () => {
  if (auth.current().authenticated) updateBadge();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && auth.current().authenticated) {
    updateBadge();
  }
});

navigator.serviceWorker?.addEventListener("message", event => {
  if (event.data?.type === "OPEN_PUSH_ROUTE" && event.data.route) {
    window.location.hash = String(event.data.route).replace(/^#/, "");
  }

  if (event.data?.type === "PUSH_BADGE") {
    updateBadge(Number(event.data.count || 0));
  }
});

window.setInterval(() => {
  if (
    document.visibilityState === "visible"
    && auth.current().authenticated
  ) {
    updateBadge();
  }
}, 60000);
