import {
  call,
  confirmAction,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  hasCapability,
  importIcs,
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

const ICS_PROFILE = Object.freeze({
  sourceKey: "ERV_BAYERNLIGA_2026_27",
  label: "ERV Bayernliga 2026/27"
});
const MAX_ICS_BYTES = 1024 * 1024;
const DIFF_LABELS = Object.freeze({
  eventDate: "Datum",
  eventTime: "Uhrzeit",
  endDate: "Enddatum",
  endTime: "Endzeit",
  venue: "Ort",
  homeAway: "Heim/Auswärts",
  opponentName: "Gegner"
});

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

let snapshot = { events: [] };
let searchQuery = "";
let typeFilter = "ALL";
let visibilityFilter = "ALL";

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

function visibleEvents() {
  const query = searchQuery.trim().toLocaleLowerCase("de-DE");

  return events().filter(event => {
    const matchesType = typeFilter === "ALL" || event.eventType === typeFilter;
    const matchesVisibility = visibilityFilter === "ALL"
      || event.visibility === visibilityFilter;
    const searchable = [
      event.displayTitle,
      event.title,
      event.opponentName,
      event.venue,
      event.eventType,
      typeLabel(event.eventType),
      event.homeAway,
      homeAwayLabel(event.homeAway)
    ].filter(Boolean).join(" ").toLocaleLowerCase("de-DE");

    return matchesType && matchesVisibility && (!query || searchable.includes(query));
  });
}

function eventDetailActions(event, canManage) {
  if (!canManage || event.canManage === false) return "";

  return `<div class="v4-detail-actions dialog-actions">
    <button class="button small secondary" type="button" data-m210-edit-event="${escapeAttr(event.id)}">Bearbeiten</button>
    <button class="button small danger" type="button" data-m210-delete-event="${escapeAttr(event.id)}">Löschen</button>
  </div>`;
}

function eventDetailMarkup(event, canManage) {
  return `<div>
    <div class="v4-detail-grid">
      <div><span>Datum</span><strong>${escapeHtml(formatCalendarDate(event.eventDate))}</strong></div>
      <div><span>Uhrzeit</span><strong>${escapeHtml(timeLabel(event.eventTime))}</strong></div>
      ${event.endDate ? `<div><span>Enddatum</span><strong>${escapeHtml(formatCalendarDate(event.endDate))}</strong></div>` : ""}
      ${event.endTime ? `<div><span>Endzeit</span><strong>${escapeHtml(timeLabel(event.endTime))}</strong></div>` : ""}
      <div><span>Typ</span><strong><span class="badge neutral">${escapeHtml(typeLabel(event.eventType))}</span></strong></div>
      <div><span>Sichtbarkeit</span><strong><span class="badge ${event.visibility === "PUBLIC" ? "success" : "neutral"}">${escapeHtml(visibilityLabel(event.visibility))}</span></strong></div>
      <div class="full"><span>Titel</span><strong>${escapeHtml(event.displayTitle || event.title || "Termin")}</strong></div>
      ${event.venue ? `<div class="full"><span>Ort</span><strong>${escapeHtml(event.venue)}</strong></div>` : ""}
      ${event.eventType === "GAME" && event.homeAway ? `<div><span>Heim/Auswärts</span><strong>${escapeHtml(homeAwayLabel(event.homeAway))}</strong></div>` : ""}
      ${event.eventType === "GAME" && event.opponentName ? `<div><span>Gegner</span><strong>${escapeHtml(event.opponentName)}</strong></div>` : ""}
      ${event.description ? `<div class="full"><span>Beschreibung</span><strong class="v4-preserve-lines">${escapeHtml(event.description)}</strong></div>` : ""}
    </div>
    ${eventDetailActions(event, canManage)}
  </div>`;
}

function openEventDetail(event) {
  const canManage = hasCapability("events.manage") && event.canManage !== false;
  const dialog = openDialog({
    title: event.displayTitle || event.title || "Termin",
    kicker: `${formatCalendarDate(event.eventDate)} · ${timeLabel(event.eventTime)}`,
    body: eventDetailMarkup(event, canManage)
  });

  dialog.querySelector("[data-m210-edit-event]")?.addEventListener("click", () => {
    openEventEditor(event);
  });
  dialog.querySelector("[data-m210-delete-event]")?.addEventListener("click", async clickEvent => {
    await deleteEvent(event, clickEvent.currentTarget);
  });
}

function eventTable(items) {
  return `<div class="v4-table-wrap v4-desktop-table">
    <table class="v4-table v4-compact-table">
      <thead><tr><th>Datum</th><th>Uhrzeit</th><th>Termin</th><th>Typ</th><th>Gegner</th><th>Heim/Auswärts</th><th>Sichtbarkeit</th><th></th></tr></thead>
      <tbody>${items.map(event => `<tr class="v4-interactive-row" tabindex="0" role="button" data-m210-open-event="${escapeAttr(event.id)}" aria-label="Details zu ${escapeAttr(event.displayTitle || event.title || "Termin")}">
        <td>${escapeHtml(formatCalendarDate(event.eventDate))}</td>
        <td>${escapeHtml(timeLabel(event.eventTime))}</td>
        <td><strong>${escapeHtml(event.displayTitle || event.title || "Termin")}</strong>${event.venue ? `<small>${escapeHtml(event.venue)}</small>` : ""}</td>
        <td><span class="badge neutral">${escapeHtml(typeLabel(event.eventType))}</span></td>
        <td>${escapeHtml(event.eventType === "GAME" ? event.opponentName || "–" : "–")}</td>
        <td>${escapeHtml(event.eventType === "GAME" ? homeAwayLabel(event.homeAway) || "–" : "–")}</td>
        <td><span class="badge ${event.visibility === "PUBLIC" ? "success" : "neutral"}">${escapeHtml(visibilityLabel(event.visibility))}</span></td>
        <td><span class="v4-row-chevron" aria-hidden="true">›</span></td>
      </tr>`).join("")}</tbody>
    </table>
  </div>`;
}

function eventMobileList(items) {
  return `<div class="v4-mobile-records v4-compact-record-list" aria-label="Termine">
    ${items.map(event => `<button class="v4-compact-record" type="button" data-m210-open-event="${escapeAttr(event.id)}">
      <span class="v4-compact-record-copy">
        <small>${escapeHtml(formatCalendarDate(event.eventDate))} · ${escapeHtml(timeLabel(event.eventTime))}</small>
        <strong>${escapeHtml(event.displayTitle || event.title || "Termin")}</strong>
        <span>${escapeHtml(typeLabel(event.eventType))}${event.eventType === "GAME" && event.homeAway ? ` · ${escapeHtml(homeAwayLabel(event.homeAway))}` : ""}</span>
      </span>
      <span class="v4-compact-record-end"><span class="badge ${event.visibility === "PUBLIC" ? "success" : "neutral"}">${escapeHtml(visibilityLabel(event.visibility))}</span></span>
      <span class="v4-row-chevron" aria-hidden="true">›</span>
    </button>`).join("")}
  </div>`;
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
  const importButton = document.getElementById("m210ImportScheduleButton");
  if (!panel) return;

  const allItems = events();
  const items = visibleEvents();
  const canManage = hasCapability("events.manage");

  if (addButton) {
    addButton.hidden = !canManage;
    addButton.onclick = canManage ? () => openEventEditor() : null;
  }

  if (importButton) {
    importButton.hidden = !canManage;
    importButton.onclick = canManage ? () => openIcsImport() : null;
  }

  if (summary) {
    summary.textContent = allItems.length === 1
      ? "1 kommender Termin"
      : `${allItems.length} kommende Termine`;
  }

  panel.innerHTML = `<div class="v4-list-filterbar">
    <label class="v4-compact-search">
      <span class="sr-only">Termine durchsuchen</span>
      <input id="m210EventSearch" type="search" placeholder="Termine durchsuchen …" autocomplete="off" value="${escapeAttr(searchQuery)}">
    </label>
    <label class="v4-filter-field">Typ
      <select id="m210EventTypeFilter">
        <option value="ALL" ${typeFilter === "ALL" ? "selected" : ""}>Alle</option>
        ${EVENT_TYPES.map(item => `<option value="${escapeAttr(item.value)}" ${typeFilter === item.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>
    </label>
    <label class="v4-filter-field">Sichtbarkeit
      <select id="m210EventVisibilityFilter">
        <option value="ALL" ${visibilityFilter === "ALL" ? "selected" : ""}>Alle</option>
        ${VISIBILITIES.map(item => `<option value="${escapeAttr(item.value)}" ${visibilityFilter === item.value ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
      </select>
    </label>
  </div>
  ${items.length
    ? `${eventTable(items)}${eventMobileList(items)}`
    : empty(allItems.length ? "Keine Termine entsprechen der Suche oder den gewählten Filtern." : "Aktuell sind keine kommenden Termine eingetragen.")}`;

  panel.querySelector("#m210EventSearch")?.addEventListener("input", inputEvent => {
    searchQuery = inputEvent.currentTarget.value;
    render();
    const search = document.getElementById("m210EventSearch");
    search?.focus({ preventScroll: true });
    search?.setSelectionRange(search.value.length, search.value.length);
  });
  panel.querySelector("#m210EventTypeFilter")?.addEventListener("change", changeEvent => {
    typeFilter = changeEvent.currentTarget.value;
    render();
  });
  panel.querySelector("#m210EventVisibilityFilter")?.addEventListener("change", changeEvent => {
    visibilityFilter = changeEvent.currentTarget.value;
    render();
  });

  panel.querySelectorAll("[data-m210-open-event]").forEach(record => {
    const open = () => {
      const event = allItems.find(item => item.id === record.dataset.m210OpenEvent);
      if (event) openEventDetail(event);
    };
    record.addEventListener("click", open);
    if (record.matches("tr")) {
      record.addEventListener("keydown", keyEvent => {
        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
        keyEvent.preventDefault();
        open();
      });
    }
  });

  setStatus("Aktuell", "success");
}

function eventForm(event = {}) {
  const eventType = event.eventType || "FANCLUB";
  const isGame = eventType === "GAME";

  return `<form id="m210DateForm" class="form-grid v4-smart-form">
    <label class="v4-field-half">Typ
      <select id="m210DateEventType" name="eventType" required>${optionList(EVENT_TYPES, eventType)}</select>
    </label>
    <label class="v4-field-half">Sichtbarkeit
      <select name="visibility" required>${optionList(VISIBILITIES, event.visibility || "PUBLIC")}</select>
    </label>
    <label id="m210DateTitleField" class="v4-field-full" ${isGame ? "hidden" : ""}>Titel
      <input name="title" value="${escapeAttr(event.title || "")}" ${isGame ? "" : "required"}>
    </label>
    <label class="v4-field-half v4-field-mobile-full">Datum
      <input name="eventDate" type="date" required value="${escapeAttr(event.eventDate || "")}">
    </label>
    <label class="v4-field-half v4-field-mobile-full">Uhrzeit
      <input name="eventTime" type="time" value="${escapeAttr(timeValue(event.eventTime))}">
    </label>
    <label class="v4-field-half v4-field-mobile-full">Enddatum
      <input name="endDate" type="date" value="${escapeAttr(event.endDate || "")}">
    </label>
    <label class="v4-field-half v4-field-mobile-full">Endzeit
      <input name="endTime" type="time" value="${escapeAttr(timeValue(event.endTime))}">
    </label>
    <label class="v4-field-full">Ort
      <input name="venue" value="${escapeAttr(event.venue || "")}">
    </label>
    <label class="v4-field-full">Beschreibung
      <textarea name="description" rows="3">${escapeHtml(event.description || "")}</textarea>
    </label>
    <div id="m210DateGameFields" class="v4-field-full v4-form-pair" ${isGame ? "" : "hidden"}>
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

function importValue(value) {
  if (value === null || value === undefined || value === "") return "–";
  if (value === "HOME") return "Heimspiel";
  if (value === "AWAY") return "Auswärtsspiel";
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return formatCalendarDate(value);
  if (/^\d{2}:\d{2}/.test(String(value))) return timeLabel(value);
  return String(value);
}

function importStatusBadge(status) {
  const labels = { NEW: "Neu", CHANGED: "Geändert", UNCHANGED: "Unverändert" };
  const classes = { NEW: "success", CHANGED: "warning", UNCHANGED: "neutral" };
  return `<span class="badge ${classes[status] || "neutral"}">${escapeHtml(labels[status] || status)}</span>`;
}

function importDiffs(item) {
  if (!Array.isArray(item.diffs) || !item.diffs.length) return "";
  return `<div class="meta-grid">${item.diffs.map(diff => `<div class="meta-item">
    <small>${escapeHtml(DIFF_LABELS[diff.field] || diff.field)}</small>
    <strong>${escapeHtml(importValue(diff.old))} → ${escapeHtml(importValue(diff.new))}</strong>
  </div>`).join("")}</div>`;
}

function previewMarkup(preview) {
  const summary = preview?.summary || {};
  const items = Array.isArray(preview?.items) ? preview.items : [];
  return `<div class="v4-heading-row v4-subheading-row">
    <div><h3>Importvorschau</h3><p class="subtle">${escapeHtml(preview?.sourceLabel || ICS_PROFILE.label)}</p></div>
    <span class="status-pill success">Analysiert</span>
  </div>
  <div class="meta-grid">
    <div class="meta-item"><small>Neu</small><strong>${escapeHtml(summary.new ?? 0)}</strong></div>
    <div class="meta-item"><small>Geändert</small><strong>${escapeHtml(summary.changed ?? 0)}</strong></div>
    <div class="meta-item"><small>Unverändert</small><strong>${escapeHtml(summary.unchanged ?? 0)}</strong></div>
  </div>
  <div class="v4-card-grid">${items.map(item => `<article class="card entity-card" data-m210-import-status="${escapeAttr(item.status)}">
    <div class="entity-head"><div><span class="subtle">${escapeHtml(formatCalendarDate(item.eventDate))} · ${escapeHtml(timeLabel(item.eventTime))}</span><h3>${escapeHtml(item.displayTitle || "Spiel")}</h3></div>${importStatusBadge(item.status)}</div>
    <div class="meta-grid">
      <div class="meta-item"><small>Ende</small><strong>${escapeHtml(item.endDate ? `${formatCalendarDate(item.endDate)} · ${timeLabel(item.endTime)}` : "–")}</strong></div>
      <div class="meta-item"><small>Ort</small><strong>${escapeHtml(item.venue || "–")}</strong></div>
      <div class="meta-item"><small>UID</small><strong>${escapeHtml(item.uid)}</strong></div>
    </div>
    ${importDiffs(item)}
  </article>`).join("")}</div>`;
}

function importResultMarkup(result) {
  const summary = result?.summary || {};
  return `<article class="card notice success">
    <strong>Spielplanimport abgeschlossen</strong>
    <p>${escapeHtml(summary.created ?? 0)} Termine wurden erstellt, ${escapeHtml(summary.updated ?? 0)} aktualisiert und ${escapeHtml(summary.unchanged ?? 0)} unverändert belassen.</p>
    <small>Importlauf: ${escapeHtml(result?.runId || "–")}</small>
  </article>`;
}

function openIcsImport() {
  let selectedFile = null;
  let preview = null;
  const dialog = openDialog({
    title: "Spielplan importieren",
    kicker: "ICS-Spielplanimport",
    body: `<form id="m210IcsImportForm" class="form-grid v4-smart-form">
      <label class="full">Importprofil
        <select name="sourceKey" required><option value="${escapeAttr(ICS_PROFILE.sourceKey)}">${escapeHtml(ICS_PROFILE.label)}</option></select>
      </label>
      <label class="full">ICS-Datei
        <input name="icsFile" type="file" accept=".ics,text/calendar" required>
      </label>
    </form>
    <div id="m210IcsImportStatus" class="notice" role="status">Wähle eine ICS-Datei mit höchstens 1 MiB aus.</div>
    <div id="m210IcsImportPreview"></div>
    <div class="dialog-actions">
      <button class="button ghost" type="button" data-v4-dialog-close>Schließen</button>
      <button id="m210IcsAnalyzeButton" class="button secondary" type="button">Analysieren</button>
      <button id="m210IcsConfirmButton" class="button primary" type="button" hidden>Import bestätigen</button>
    </div>`
  });
  const fileInput = dialog.querySelector('input[name="icsFile"]');
  const analyzeButton = dialog.querySelector("#m210IcsAnalyzeButton");
  const confirmButton = dialog.querySelector("#m210IcsConfirmButton");
  const status = dialog.querySelector("#m210IcsImportStatus");
  const previewPanel = dialog.querySelector("#m210IcsImportPreview");

  fileInput?.addEventListener("change", () => {
    selectedFile = fileInput.files?.[0] || null;
    preview = null;
    confirmButton.hidden = true;
    previewPanel.innerHTML = "";
    status.textContent = selectedFile ? `Ausgewählt: ${selectedFile.name}` : "Wähle eine ICS-Datei aus.";
  });

  analyzeButton?.addEventListener("click", async () => {
    selectedFile = fileInput?.files?.[0] || null;
    if (!selectedFile || !/\.ics$/i.test(selectedFile.name)) {
      status.textContent = "Bitte wähle eine .ics-Datei aus.";
      return;
    }
    if (selectedFile.size > MAX_ICS_BYTES) {
      status.textContent = "Die ICS-Datei darf höchstens 1 MiB groß sein.";
      return;
    }
    analyzeButton.disabled = true;
    confirmButton.hidden = true;
    status.textContent = "Die ICS-Datei wird serverseitig analysiert …";
    try {
      preview = await importIcs("preview", selectedFile, ICS_PROFILE.sourceKey);
      previewPanel.innerHTML = previewMarkup(preview);
      status.textContent = "Die Vorschau ist bereit. Prüfe alle Änderungen vor der Bestätigung.";
      confirmButton.disabled = false;
      confirmButton.hidden = false;
    } catch (error) {
      preview = null;
      previewPanel.innerHTML = "";
      status.textContent = error?.message || "Die ICS-Datei konnte nicht analysiert werden.";
    } finally {
      analyzeButton.disabled = false;
    }
  });

  confirmButton?.addEventListener("click", async () => {
    if (!selectedFile || !preview?.previewFingerprint) return;
    confirmButton.disabled = true;
    analyzeButton.disabled = true;
    status.textContent = "Der Import wird atomar bestätigt …";
    try {
      const result = await runWrite(
        () => importIcs(
          "confirm",
          selectedFile,
          ICS_PROFILE.sourceKey,
          preview.previewFingerprint
        ),
        "Der Spielplan wurde importiert."
      );
      preview = null;
      confirmButton.hidden = true;
      fileInput.disabled = true;
      previewPanel.innerHTML = importResultMarkup(result);
      status.textContent = "Der bestätigte Importlauf wurde protokolliert.";
      try {
        snapshot = await call("events_list");
        render();
      } catch (refreshError) {
        showToast(
          refreshError?.message || "Die Terminliste konnte nach dem Import nicht aktualisiert werden.",
          "error",
          5200
        );
      }
    } catch (error) {
      if (error?.code === "PREVIEW_STALE") {
        preview = null;
        confirmButton.hidden = true;
        status.textContent = "Die Vorschau ist nicht mehr aktuell. Analysiere die Datei erneut.";
      } else {
        status.textContent = error?.message || "Der Import konnte nicht bestätigt werden.";
        confirmButton.disabled = false;
      }
    } finally {
      if (!fileInput.disabled) analyzeButton.disabled = false;
    }
  });
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
