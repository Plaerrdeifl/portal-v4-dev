import { api } from "./api.js";
import { auth } from "./auth.js";

let dialog = null;
let snapshot = null;
let busy = false;
let logoutRecoveryPromise = null;

const PD_PUSH_LOGOUT_RECOVERY_PREFIX = "pdPushLogoutRecovery:";

function recoveryMarkerKey(userId) {
  return `${PD_PUSH_LOGOUT_RECOVERY_PREFIX}${userId}`;
}

function hasLogoutRecoveryMarker(userId) {
  if (!userId) return false;
  try {
    return localStorage.getItem(recoveryMarkerKey(userId)) === "1";
  } catch {
    return false;
  }
}

function clearLogoutRecoveryMarker(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(recoveryMarkerKey(userId));
  } catch {
    // Lokaler Speicher ist optional und darf Push-Aktionen nicht blockieren.
  }
}

function currentUserId() {
  return auth.current().session?.user?.id || null;
}

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
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || navigator.standalone === true;
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
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
    // Das Badge ist rein ergänzend und darf den Portalbetrieb nicht stören.
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
        <div class="v4-push-dialog-heading"><h2>Benachrichtigungen</h2></div>
        <button class="icon-button" type="button" data-close-push-settings
          aria-label="Benachrichtigungseinstellungen schließen">×</button>
      </header>
      <div id="pushSettingsBody" class="v4-push-scroll-region"></div>
    </div>
  `;
  document.body.appendChild(dialog);
  dialog.addEventListener("click", event => {
    if (event.target === dialog || event.target.closest("[data-close-push-settings]")) {
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

function categoryRow({
  title,
  description,
  emailName,
  pushName,
  emailChecked,
  pushChecked,
  disabled = false,
  emailDisabled = disabled,
  pushDisabled = disabled
}) {
  return `
    <div class="v4-notification-category">
      <div class="v4-notification-category-copy">
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(description)}</small>
      </div>
      <label class="v4-switch-row v4-notification-channel">
        <span><strong>E-Mail</strong><small>Optionale E-Mails</small></span>
        <input type="checkbox" name="${escapeHtml(emailName)}"
          ${emailChecked ? "checked" : ""} ${emailDisabled ? "disabled" : ""}>
      </label>
      <label class="v4-switch-row v4-notification-channel">
        <span><strong>Push</strong><small>Auf registrierten Geräten</small></span>
        <input type="checkbox" name="${escapeHtml(pushName)}"
          ${pushChecked ? "checked" : ""} ${pushDisabled ? "disabled" : ""}>
      </label>
    </div>
  `;
}

function deviceMarkup(devices) {
  if (!devices.length) {
    return '<p class="subtle">Noch kein aktives Push-Gerät gespeichert.</p>';
  }

  return `<div class="v4-notification-devices">
    ${devices.map(device => `
      <div class="v4-switch-row">
        <span>
          <strong>${escapeHtml(device.deviceLabel || "Webgerät")}</strong>
          <small>Zuletzt gesehen: ${escapeHtml(
            device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString("de-DE") : "–"
          )}</small>
        </span>
        <button class="button small danger" type="button"
          data-remove-push-device="${escapeHtml(device.id)}" ${busy ? "disabled" : ""}>
          Entfernen
        </button>
      </div>
    `).join("")}
  </div>`;
}

function render() {
  const host = document.getElementById("pushSettingsBody");
  if (!host) return;

  const preferences = snapshot?.preferences || {};
  const permission = supported() ? Notification.permission : "unsupported";
  const iosInstallRequired = isIos() && !isStandalone();
  const devices = Number(snapshot?.activeDeviceCount || 0);
  const deviceList = Array.isArray(snapshot?.devices) ? snapshot.devices : [];
  const enabled = permission === "granted"
    && devices > 0
    && preferences.pushEnabled !== false;
  const quietHoursEnabled = Boolean(preferences.quietHoursEnabled);

  host.innerHTML = `
    <div class="notice">
      <strong>Pflichtnachrichten bleiben aktiv</strong>
      <p>
        Fachlich notwendige E-Mails – zum Beispiel zu Mitgliedsantrag, Portalzugang
        oder deiner Fanbus-Buchung – werden unabhängig von diesen optionalen
        Einstellungen versendet. Push bleibt immer freiwillig und benötigt deine
        Gerätefreigabe.
      </p>
    </div>

    <div class="v4-push-summary">
      <div><span>Status</span><strong>${enabled ? "Push aktiv" : "Push nicht aktiv"}</strong></div>
      <div>
        <span>Berechtigung</span>
        <strong>${escapeHtml(
          permission === "unsupported" ? "Nicht unterstützt" : permissionLabel(permission)
        )}</strong>
      </div>
      <div><span>Registrierte Geräte</span><strong>${devices}</strong></div>
    </div>

    ${iosInstallRequired ? `
      <div class="notice warning">
        <strong>Auf dem iPhone zuerst als App installieren</strong>
        <p>Öffne in Safari das Teilen-Menü, wähle „Zum Home-Bildschirm“ und starte
        anschließend die installierte Plärrdeifl-App.</p>
      </div>
    ` : ""}

    ${permission === "denied" ? `
      <div class="notice error">
        <strong>Benachrichtigungen sind blockiert</strong>
        <p>Erlaube sie in den Geräte- beziehungsweise Browser-Einstellungen
        für die Plärrdeifl-App.</p>
      </div>
    ` : ""}

    <div class="v4-push-actions">
      <button class="button primary" type="button" data-enable-push
        ${busy || !supported() || iosInstallRequired || permission === "denied" ? "disabled" : ""}>
        ${enabled ? "Dieses Gerät aktualisieren" : "Push aktivieren"}
      </button>
      <button class="button secondary" type="button" data-send-push-test
        ${busy || !enabled ? "disabled" : ""}>Testmeldung senden</button>
      <button class="button danger" type="button" data-disable-push
        ${busy || !enabled ? "disabled" : ""}>Auf diesem Gerät deaktivieren</button>
    </div>

    <form id="pushPreferencesForm" class="v4-push-preferences">
      <input type="hidden" name="revision" value="${escapeHtml(preferences.revision || 1)}">

      <h3>Optionale Meldungen nach Bereich</h3>
      ${categoryRow({
        title: "Konto & Mitgliedschaft",
        description: "Interne oder zusätzliche Meldungen zu Konto und Mitgliedschaft",
        emailName: "emailAccountMembership",
        pushName: "pushAccountMembership",
        emailChecked: preferences.emailAccountMembership === true,
        pushChecked: preferences.pushAccountMembership === true
      })}
      <details class="v4-history">
        <summary>Konto-Push genauer einstellen</summary>
        <label class="v4-switch-row">
          <span><strong>Neue Mitgliedsanträge</strong><small>Neue Anträge für zuständige Entscheider</small></span>
          <input type="checkbox" name="pushMembershipApplications"
            ${preferences.pushMembershipApplications !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Neue Portal-Freischaltungen</strong><small>Neue Zugangsprüfungen für zuständige Prüfer</small></span>
          <input type="checkbox" name="pushAccessRequests"
            ${preferences.pushAccessRequests !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Eigener Aufnahme-Status</strong><small>Zusätzlicher Push bei abgeschlossener Aufnahme</small></span>
          <input type="checkbox" name="pushOwnAccountStatus"
            ${preferences.pushOwnAccountStatus !== false ? "checked" : ""}>
        </label>
      </details>
      ${categoryRow({
        title: "Fanbus",
        description: "Zusätzliche interne Fanbus-Meldungen; Buchungsstatus bleibt Pflicht-E-Mail",
        emailName: "emailFanbus",
        pushName: "pushFanbus",
        emailChecked: preferences.emailFanbus === true,
        pushChecked: preferences.pushFanbus === true
      })}
      <details class="v4-history">
        <summary>Fanbus-Push genauer einstellen</summary>
        <label class="v4-switch-row">
          <span><strong>Neue Auswärtsfahrten</strong><small>Wenn eine neue Fanbusfahrt veröffentlicht wird</small></span>
          <input type="checkbox" name="pushFanbusNewTrips"
            ${preferences.pushFanbusNewTrips !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Eigene Buchungen</strong><small>Bestätigte eigene Fanbusbuchungen</small></span>
          <input type="checkbox" name="pushFanbusOwnBookings"
            ${preferences.pushFanbusOwnBookings !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Warteliste / Aufrückung</strong><small>Wartelistenstatus und frei gewordene Plätze</small></span>
          <input type="checkbox" name="pushFanbusWaitlist"
            ${preferences.pushFanbusWaitlist !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Eigene Stornierungen</strong><small>Stornierungen der eigenen Buchung</small></span>
          <input type="checkbox" name="pushFanbusCancellations"
            ${preferences.pushFanbusCancellations !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Fahrt abgesagt</strong><small>Wenn eine Fanbusfahrt vollständig abgesagt wird</small></span>
          <input type="checkbox" name="pushFanbusTripCancellations"
            ${preferences.pushFanbusTripCancellations !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Abfahrt & Zustiegszeiten</strong><small>Änderungen an Abfahrts- oder Zustiegszeiten</small></span>
          <input type="checkbox" name="pushFanbusTimes"
            ${preferences.pushFanbusTimes !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Zustiegsort</strong><small>Änderungen am eigenen hinterlegten Zustieg</small></span>
          <input type="checkbox" name="pushFanbusBoarding"
            ${preferences.pushFanbusBoarding !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Buszuordnung</strong><small>Wenn sich der zugewiesene Bus ändert</small></span>
          <input type="checkbox" name="pushFanbusBusAssignment"
            ${preferences.pushFanbusBusAssignment !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Preisänderungen</strong><small>Zusätzlicher Push bei geändertem Fahrtpreis</small></span>
          <input type="checkbox" name="pushFanbusPriceChanges"
            ${preferences.pushFanbusPriceChanges !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Neue Buchungen für BUS_ORGA</strong><small>Interne Meldung über neue Fanbusbuchungen</small></span>
          <input type="checkbox" name="pushFanbusOrgBookings"
            ${preferences.pushFanbusOrgBookings !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Stornierungen für BUS_ORGA</strong><small>Interne Meldung über Stornierungen</small></span>
          <input type="checkbox" name="pushFanbusOrgCancellations"
            ${preferences.pushFanbusOrgCancellations !== false ? "checked" : ""}>
        </label>
      </details>
      ${categoryRow({
        title: "Termine",
        description: "Optionale Push-Meldungen zu neuen oder geänderten Terminen",
        emailName: "emailDates",
        pushName: "pushDates",
        emailChecked: false,
        pushChecked: preferences.pushDates === true,
        emailDisabled: true
      })}
      <details class="v4-history">
        <summary>Termine-Push genauer einstellen</summary>
        <label class="v4-switch-row">
          <span><strong>Neue Termine</strong><small>Neue manuelle Termine oder neue Einträge aus dem Spielplanimport</small></span>
          <input type="checkbox" name="pushDatesNew"
            ${preferences.pushDatesNew !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Terminänderungen</strong><small>Relevante Änderungen; reine Beschreibungskorrekturen bleiben still</small></span>
          <input type="checkbox" name="pushDatesChanges"
            ${preferences.pushDatesChanges !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Entfernte Termine</strong><small>Wenn ein Termin aus dem Kalender entfernt wird</small></span>
          <input type="checkbox" name="pushDatesDeleted"
            ${preferences.pushDatesDeleted !== false ? "checked" : ""}>
        </label>
      </details>
      ${categoryRow({
        title: "Aufgaben",
        description: "Meldungen zu Aufgaben, für die du tatsächlich verantwortlich oder beteiligt bist",
        emailName: "emailTasks",
        pushName: "pushTasks",
        emailChecked: preferences.emailTasks === true,
        pushChecked: preferences.pushTasks !== false
      })}

      <details class="v4-history">
        <summary>Aufgaben-Push genauer einstellen</summary>
        <label class="v4-switch-row">
          <span><strong>Neue Aufgaben</strong><small>Dir neu zugewiesene Aufgaben</small></span>
          <input type="checkbox" name="newTasks"
            ${preferences.newTasks !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Neue Aufgaben-Updates</strong><small>Relevante Verlaufs- und Fortschrittseinträge</small></span>
          <input type="checkbox" name="taskUpdates"
            ${preferences.taskUpdates !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Statusänderungen</strong><small>Relevante Änderungen am Aufgabenstatus</small></span>
          <input type="checkbox" name="taskStatus"
            ${preferences.taskStatus !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Aufgabenübertragungen</strong><small>Relevante Übertragungsereignisse</small></span>
          <input type="checkbox" name="taskTransfers"
            ${preferences.taskTransfers !== false ? "checked" : ""}>
        </label>
        <label class="v4-switch-row">
          <span><strong>Wartefristen</strong><small>Bevorstehende oder überschrittene Wartefristen</small></span>
          <input type="checkbox" name="waitingDeadlines"
            ${preferences.waitingDeadlines !== false ? "checked" : ""}>
        </label>
      </details>

      <label class="v4-switch-row">
        <span><strong>Zahl am App-Symbol</strong><small>Anzahl ungelesener Portal-Meldungen</small></span>
        <input type="checkbox" name="badgeEnabled"
          ${preferences.badgeEnabled !== false ? "checked" : ""}>
      </label>

      <label class="v4-switch-row">
        <span><strong>Ruhezeit</strong><small>Optionale Push-Meldungen werden bis zum Ende der Ruhezeit zurückgestellt</small></span>
        <input type="checkbox" name="quietHoursEnabled"
          ${preferences.quietHoursEnabled ? "checked" : ""}>
      </label>

      <div class="v4-push-quiet-grid ${quietHoursEnabled ? "is-enabled" : "is-disabled"}">
        <label>Von
          <input type="time" name="quietStart"
            value="${escapeHtml(preferences.quietStart || "22:00")}">
        </label>
        <label>Bis
          <input type="time" name="quietEnd"
            value="${escapeHtml(preferences.quietEnd || "07:00")}">
        </label>
        <input type="hidden" name="timeZone" value="${escapeHtml(
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin"
        )}">
      </div>

      <button class="button secondary" type="submit" ${busy ? "disabled" : ""}>
        Einstellungen speichern
      </button>
    </form>

    <section class="v4-push-preferences">
      <h3>Globaler Push-Opt-out</h3>
      <p class="subtle">
        Deaktiviert Push vollständig und entfernt alle registrierten Geräte.
        Dies ist unabhängig von „Auf diesem Gerät deaktivieren“.
      </p>
      <button class="button danger" type="button" data-disable-push-globally
        ${busy || preferences.pushEnabled !== true ? "disabled" : ""}>Push vollständig deaktivieren</button>
    </section>

    <section class="v4-push-preferences">
      <h3>Aktive Push-Geräte</h3>
      <p class="subtle">Es werden nur Gerätebezeichnung und Zeitpunkte angezeigt – keine Push-Schlüssel oder Endpunkte.</p>
      ${deviceMarkup(deviceList)}
    </section>
  `;

  host.querySelector("[data-enable-push]")?.addEventListener("click", enablePush);
  host.querySelector("[data-disable-push]")?.addEventListener("click", disablePush);
  host.querySelector("[data-disable-push-globally]")?.addEventListener("click", disablePushGlobally);
  host.querySelector("[data-send-push-test]")?.addEventListener("click", sendTest);
  host.querySelector("#pushPreferencesForm")?.addEventListener("submit", savePreferences);
  host.querySelectorAll("[data-remove-push-device]").forEach(button => {
    button.addEventListener("click", () => removeDevice(button.dataset.removePushDevice));
  });

  const quietToggle = host.querySelector('input[name="quietHoursEnabled"]');
  const quietStart = host.querySelector('input[name="quietStart"]');
  const quietEnd = host.querySelector('input[name="quietEnd"]');
  const quietGrid = host.querySelector(".v4-push-quiet-grid");
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
    quietGrid?.classList.toggle("is-enabled", active);
    quietGrid?.classList.toggle("is-disabled", !active);
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
      throw new Error("Auf dem iPhone muss das Portal zuerst zum Home-Bildschirm hinzugefügt werden.");
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Benachrichtigungen wurden nicht erlaubt.");
    }
    if (!snapshot?.publicKey) throw new Error("Öffentlicher Push-Schlüssel fehlt.");

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
    clearLogoutRecoveryMarker(currentUserId());

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
    clearLogoutRecoveryMarker(currentUserId());
    const subscription = await currentSubscription();
    if (subscription) {
      await api.call("remove_push_subscription", { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }

    snapshot = await api.call("push_snapshot");
    if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
    notify("Push wurde auf diesem Gerät deaktiviert.", "success");
  } catch (error) {
    notify(error?.message || "Push konnte nicht deaktiviert werden.", "error");
  } finally {
    busy = false;
    render();
  }
}

async function disablePushGlobally() {
  if (busy || snapshot?.preferences?.pushEnabled !== true) return;
  busy = true;
  render();

  try {
    await api.call("save_notification_preferences", {
      revision: snapshot.preferences.revision,
      pushEnabled: false
    });

    try {
      const subscription = await currentSubscription();
      if (subscription) await subscription.unsubscribe();
    } catch {
      // Server-seitiger Opt-out ist maßgeblich; lokales Unsubscribe ist best effort.
    }

    try {
      if ("clearAppBadge" in navigator) await navigator.clearAppBadge();
    } catch {
      // Badge ist rein ergänzend.
    }

    clearLogoutRecoveryMarker(currentUserId());
    snapshot = await api.call("push_snapshot");
    notify("Push wurde auf allen Geräten vollständig deaktiviert.", "success");
  } catch (error) {
    notify(error?.message || "Push konnte nicht vollständig deaktiviert werden.", "error");
  } finally {
    busy = false;
    render();
  }
}

async function removeDevice(id) {
  if (busy || !id) return;
  busy = true;
  render();

  try {
    snapshot = await api.call("remove_push_subscription", { id });
    notify("Das Push-Gerät wurde deaktiviert.", "success");
  } catch (error) {
    notify(error?.message || "Das Gerät konnte nicht deaktiviert werden.", "error");
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
    notify("Testmeldung wurde ausgelöst. Die Zustellung kann einige Sekunden dauern.", "success");
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
      emailAccountMembership: form.elements.emailAccountMembership.checked,
      pushAccountMembership: form.elements.pushAccountMembership.checked,
      pushMembershipApplications: form.elements.pushMembershipApplications.checked,
      pushAccessRequests: form.elements.pushAccessRequests.checked,
      pushOwnAccountStatus: form.elements.pushOwnAccountStatus.checked,
      emailFanbus: form.elements.emailFanbus.checked,
      pushFanbus: form.elements.pushFanbus.checked,
      pushFanbusNewTrips: form.elements.pushFanbusNewTrips.checked,
      pushFanbusOwnBookings: form.elements.pushFanbusOwnBookings.checked,
      pushFanbusWaitlist: form.elements.pushFanbusWaitlist.checked,
      pushFanbusCancellations: form.elements.pushFanbusCancellations.checked,
      pushFanbusTripCancellations: form.elements.pushFanbusTripCancellations.checked,
      pushFanbusTimes: form.elements.pushFanbusTimes.checked,
      pushFanbusBoarding: form.elements.pushFanbusBoarding.checked,
      pushFanbusBusAssignment: form.elements.pushFanbusBusAssignment.checked,
      pushFanbusPriceChanges: form.elements.pushFanbusPriceChanges.checked,
      pushFanbusOrgBookings: form.elements.pushFanbusOrgBookings.checked,
      pushFanbusOrgCancellations: form.elements.pushFanbusOrgCancellations.checked,
      emailDates: false,
      pushDates: form.elements.pushDates.checked,
      pushDatesNew: form.elements.pushDatesNew.checked,
      pushDatesChanges: form.elements.pushDatesChanges.checked,
      pushDatesDeleted: form.elements.pushDatesDeleted.checked,
      emailTasks: form.elements.emailTasks.checked,
      pushTasks: form.elements.pushTasks.checked,
      newTasks: form.elements.newTasks.checked,
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

async function reconcileLogoutPush(authState = auth.current()) {
  if (logoutRecoveryPromise) return logoutRecoveryPromise;

  const userId = authState?.session?.user?.id || null;
  if (
    authState?.authenticated !== true
    || authState?.status !== "ACTIVE"
    || !supported()
    || !userId
    || !hasLogoutRecoveryMarker(userId)
  ) {
    return null;
  }

  logoutRecoveryPromise = (async () => {
    const recoverySnapshot = await api.call("push_snapshot");
    if (recoverySnapshot?.preferences?.pushEnabled !== true) {
      clearLogoutRecoveryMarker(userId);
      return;
    }

    if (isIos() && !isStandalone()) return;
    if (Notification.permission !== "granted") return;
    if (!recoverySnapshot?.publicKey) {
      throw new Error("PUSH_PUBLIC_KEY_MISSING");
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(recoverySnapshot.publicKey)
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
    clearLogoutRecoveryMarker(userId);
  })().catch(error => {
    console.warn("Push-Recovery nach Login konnte nicht abgeschlossen werden", error);
  }).finally(() => {
    logoutRecoveryPromise = null;
  });

  return logoutRecoveryPromise;
}

async function openSettings() {
  if (!auth.current().authenticated) {
    notify("Bitte melde dich zuerst an.", "error");
    return;
  }

  const currentDialog = ensureDialog();
  const host = document.getElementById("pushSettingsBody");
  if (host) {
    host.innerHTML = '<article class="card loading-card"><h3>Benachrichtigungen werden geladen …</h3></article>';
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
const __M020_R1_NOTIFICATION_PREFERENCES__ = true;
const __M020_R2_GRANULAR_NOTIFICATION_PREFERENCES__ = true;

window.setTimeout(() => {
  if (auth.current().authenticated) updateBadge();
}, 1500);

window.addEventListener("online", () => {
  if (auth.current().authenticated) updateBadge();
});

window.addEventListener("pd-auth-change", event => {
  void reconcileLogoutPush(event.detail);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && auth.current().authenticated) {
    updateBadge();
  }
});

navigator.serviceWorker?.addEventListener("message", event => {
  if (event.data?.type === "PUSH_BADGE") {
    updateBadge(Number(event.data.count || 0));
  }
});

const __V4_TASK_PUSH_DEEPLINK_WINDOWCLIENT_R1__ = true;

window.setInterval(() => {
  if (document.visibilityState === "visible" && auth.current().authenticated) {
    updateBadge();
  }
}, 60000);
