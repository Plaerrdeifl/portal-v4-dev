import {
  call,
  confirmAction,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  hasCapability,
  loading,
  openDialog,
  optionList,
  runWrite,
  showToast
} from "./common.js";

const EVENT_TYPES = [
  { value: "GAME", label: "Spiel" },
  { value: "FANCLUB", label: "Fanclub" },
  { value: "OTHER", label: "Sonstiges" }
];

const VISIBILITIES = [
  { value: "PUBLIC", label: "Öffentlich" },
  { value: "INTERNAL", label: "Intern" }
];

const HOME_AWAY = [
  { value: "HOME", label: "Heimspiel" },
  { value: "AWAY", label: "Auswärtsspiel" }
];

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

let snapshot = { events: [] };

function events() {
  return Array.isArray(snapshot?.events) ? snapshot.events : [];
}

function typeLabel(value) {
  return EVENT_TYPES.find(item => item.value === value)?.label
    || value
    || "Termin";
}

function visibilityLabel(value) {
  return VISIBILITIES.find(item => item.value === value)?.label
    || value
    || "–";
}

function homeAwayLabel(value) {
  return HOME_AWAY.find(item => item.value === value)?.label
    || value
    || "";
}

function formatCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return String(value || "–");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const localDate = new Date(year, month - 1, day, 12, 0, 0);

  if (
    Number.isNaN(localDate.getTime())
    || localDate.getFullYear() !== year
    || localDate.getMonth() !== month - 1
    || localDate.getDate() !== day
  ) {
    return String(value || "–");
  }

  return DATE_FORMAT.format(localDate);
}

function timeValue(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}:${match[2]}` : "";
}

function timeLabel(value) {
  const time = timeValue(value);
  return time ? `${time} Uhr` : "Uhrzeit noch offen";
}

function endLabel(event) {
  const parts = [];

  if (event.endDate) {
    parts.push(formatCalendarDate(event.endDate));
  }

  if (event.endTime) {
    parts.push(timeLabel(event.endTime));
  }

  return parts.length ? `Ende: ${parts.join(" · ")}` : "";
}

function badges(event) {
  const labels = [
    `<span class="badge neutral">${escapeHtml(typeLabel(event.eventType))}</span>`,
    `<span class="badge ${event.visibility === "PUBLIC" ? "success" : "neutral"}">${escapeHtml(visibilityLabel(event.visibility))}</span>`
  ];

  if (event.eventType === "GAME" && event.homeAway) {
    labels.push(
      `<span class="badge warning">${escapeHtml(homeAwayLabel(event.homeAway))}</span>`
    );
  }

  return labels.join("");
}

function eventMeta(event) {
  const items = [];
  const end = endLabel(event);

  if (event.venue) {
    items.push(`<div class="meta-item"><small>Ort</small><strong>${escapeHtml(event.venue)}</strong></div>`);
  }

  if (end) {
    items.push(`<div class="meta-item"><small>Terminende</small><strong>${escapeHtml(end.replace(/^Ende:\s*/, ""))}</strong></div>`);
  }

  return items.length ? `<div class="meta-grid">${items.join("")}</div>` : "";
}

function eventActions(event, canManage) {
  if (!canManage || event.canManage === false) return "";

  return `<div class="v4-card-actions">
    <button class="button small secondary" type="button" data-m210-edit-event="${escapeAttr(event.id)}">Bearbeiten</button>
    <button class="button small danger" type="button" data-m210-delete-event="${escapeAttr(event.id)}">Löschen</button>
  </div>`;
}

function eventCard(event, canManage) {
  return `<article class="card entity-card m210-date-card" data-m210-event-id="${escapeAttr(event.id)}">
    <div class="entity-head">
      <div>
        <span class="subtle">${escapeHtml(formatCalendarDate(event.eventDate))} · ${escapeHtml(timeLabel(event.eventTime))}</span>
        <h3>${escapeHtml(event.displayTitle || "Termin")}</h3>
      </div>
      <div class="badge-stack">${badges(event)}</div>
    </div>
    ${eventMeta(event)}
    ${event.description ? `<p class="v4-preserve-lines">${escapeHtml(event.description)}</p>` : ""}
    ${eventActions(event, canManage)}
  </article>`;
}

function setStatus(label, type = "") {
  const status = document.getElementById("m210DatesStatus");
  if (!status) return;
  status.textContent = label;
  status.className = `status-pill${type ? ` ${type}` : ""}`;
}

function render() {
  const panel = document.getElementById("m210DatesList");
  const summary = document.getElementById("m210DatesSummary");
  const addButton = document.getElementById("m210AddEventButton");
  if (!panel) return;

  const items = events();
  const canManage = hasCapability("events.manage");

  if (addButton) {
    addButton.hidden = !canManage;
    addButton.onclick = canManage ? () => openEventEditor() : null;
  }

  if (summary) {
    summary.textContent = items.length === 1
      ? "1 kommender Termin"
      : `${items.length} kommende Termine`;
  }

  panel.innerHTML = items.length
    ? `<div id="m210DatesCards" class="v4-card-grid">${items.map(event => eventCard(event, canManage)).join("")}</div>`
    : empty("Aktuell sind keine kommenden Termine eingetragen.");

  panel.querySelectorAll("[data-m210-edit-event]").forEach(button => {
    button.addEventListener("click", () => {
      const event = items.find(item => item.id === button.dataset.m210EditEvent);
      if (event) openEventEditor(event);
    });
  });

  panel.querySelectorAll("[data-m210-delete-event]").forEach(button => {
    button.addEventListener("click", async () => {
      const event = items.find(item => item.id === button.dataset.m210DeleteEvent);
      if (event) await deleteEvent(event, button);
    });
  });

  setStatus("Aktuell", "success");
}

function eventForm(event = {}) {
  const eventType = event.eventType || "FANCLUB";
  const isGame = eventType === "GAME";

  return `<form id="m210DateForm" class="form-grid v4-smart-form">
    <label>Typ
      <select id="m210DateEventType" name="eventType" required>${optionList(EVENT_TYPES, eventType)}</select>
    </label>
    <label>Sichtbarkeit
      <select name="visibility" required>${optionList(VISIBILITIES, event.visibility || "PUBLIC")}</select>
    </label>
    <label id="m210DateTitleField" class="full" ${isGame ? "hidden" : ""}>Titel
      <input name="title" value="${escapeAttr(event.title || "")}" ${isGame ? "" : "required"}>
    </label>
    <label>Datum
      <input name="eventDate" type="date" required value="${escapeAttr(event.eventDate || "")}">
    </label>
    <label>Uhrzeit
      <input name="eventTime" type="time" value="${escapeAttr(timeValue(event.eventTime))}">
    </label>
    <label>Enddatum
      <input name="endDate" type="date" value="${escapeAttr(event.endDate || "")}">
    </label>
    <label>Endzeit
      <input name="endTime" type="time" value="${escapeAttr(timeValue(event.endTime))}">
    </label>
    <label class="full">Ort
      <input name="venue" value="${escapeAttr(event.venue || "")}">
    </label>
    <label class="full">Beschreibung
      <textarea name="description" rows="4">${escapeHtml(event.description || "")}</textarea>
    </label>
    <div id="m210DateGameFields" class="full form-grid" ${isGame ? "" : "hidden"}>
      <label>Heim/Auswärts
        <select name="homeAway" ${isGame ? "required" : ""}>${optionList(HOME_AWAY, event.homeAway || "HOME")}</select>
      </label>
      <label>Gegner
        <input name="opponentName" value="${escapeAttr(event.opponentName || "")}" ${isGame ? "required" : ""}>
      </label>
    </div>
  </form>`;
}

function syncEventTypeFields(dialog) {
  const form = dialog.querySelector("#m210DateForm");
  const typeSelect = form?.elements.namedItem("eventType");
  const titleField = dialog.querySelector("#m210DateTitleField");
  const titleInput = form?.elements.namedItem("title");
  const gameFields = dialog.querySelector("#m210DateGameFields");
  const homeAway = form?.elements.namedItem("homeAway");
  const opponentName = form?.elements.namedItem("opponentName");
  const isGame = typeSelect?.value === "GAME";

  if (titleField) titleField.hidden = isGame;
  if (gameFields) gameFields.hidden = !isGame;

  if (titleInput) {
    titleInput.required = !isGame;
    titleInput.disabled = isGame;
  }

  for (const field of [homeAway, opponentName]) {
    if (!field) continue;
    field.required = isGame;
    field.disabled = !isGame;
  }
}

function eventPayload(values) {
  const eventType = String(values.eventType || "").toUpperCase();
  const isGame = eventType === "GAME";

  return {
    eventType,
    title: isGame ? "" : String(values.title || "").trim(),
    eventDate: values.eventDate || "",
    eventTime: values.eventTime || "",
    endDate: values.endDate || "",
    endTime: values.endTime || "",
    venue: String(values.venue || "").trim(),
    description: values.description || "",
    visibility: values.visibility || "PUBLIC",
    homeAway: isGame ? values.homeAway || "" : "",
    opponentName: isGame ? String(values.opponentName || "").trim() : ""
  };
}

function openEventEditor(event = null) {
  const editing = Boolean(event?.id);
  const dialog = openDialog({
    title: editing ? "Termin bearbeiten" : "Termin hinzufügen",
    kicker: editing ? event.displayTitle || "Termin" : "Termine und Spieltage",
    body: eventForm(event || {}),
    submitLabel: editing ? "Änderungen speichern" : "Termin erstellen",
    onSubmit: async values => {
      const payload = eventPayload(values);

      if (editing) {
        payload.id = event.id;
        payload.expectedRevision = Number(event.revision);
        snapshot = await runWrite(
          () => call("event_update", payload),
          "Termin wurde aktualisiert."
        );
      } else {
        snapshot = await runWrite(
          () => call("event_create", payload),
          "Termin wurde erstellt."
        );
      }
      render();
    }
  });

  const typeSelect = dialog.querySelector("#m210DateEventType");
  typeSelect?.addEventListener("change", () => syncEventTypeFields(dialog));
  syncEventTypeFields(dialog);
}

async function deleteEvent(event, button) {
  const confirmed = await confirmAction(
    `Termin „${event.displayTitle || "Termin"}“ endgültig löschen?`,
    {
      danger: true,
      title: "Termin löschen",
      submitLabel: "Termin löschen"
    }
  );

  if (!confirmed) return;
  button.disabled = true;

  try {
    snapshot = await runWrite(
      () => call("event_delete", {
        id: event.id,
        expectedRevision: Number(event.revision)
      }),
      "Termin wurde gelöscht."
    );
    render();
  } catch (error) {
    showToast(error?.message || "Termin konnte nicht gelöscht werden.", "error", 5200);
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

export async function hydrateDates(context = {}) {
  const panel = document.getElementById("m210DatesList");
  const summary = document.getElementById("m210DatesSummary");
  if (!panel) return;

  panel.innerHTML = loading("Termine werden geladen …");
  if (summary) summary.textContent = "Termine werden geladen …";
  setStatus("Lädt");

  try {
    const nextSnapshot = await call("events_list");
    if (context.isCurrent && !context.isCurrent()) return;
    snapshot = nextSnapshot || { events: [] };
    render();
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    panel.innerHTML = errorPanel(error, "Termine konnten nicht geladen werden");
    if (summary) summary.textContent = "Laden fehlgeschlagen";
    setStatus("Fehler", "error");
  }
}

export function noop() {}
