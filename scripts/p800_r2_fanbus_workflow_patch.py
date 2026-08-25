from pathlib import Path

ROOT = Path('.')
FANBUSES = ROOT / 'js/modules/fanbuses.js'
UX = ROOT / 'js/p800-r2-fanbus-ux.js'
PAGE = ROOT / 'pages/fanbuses.html'
TEST_U5 = ROOT / 'tests/p800_u5_fanbus_contract.test.mjs'
TEST_U51 = ROOT / 'tests/p800_u5_1_fanbus_polish_contract.test.mjs'
TEST_NEW = ROOT / 'tests/p800_r2_fanbus_workflow_ux.test.mjs'


def replace_between(source, start, end, replacement, label):
    a = source.find(start)
    if a < 0:
        raise RuntimeError(f'missing start marker: {label}: {start}')
    b = source.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f'missing end marker: {label}: {end}')
    return source[:a] + replacement.rstrip() + '\n\n' + source[b:]


def replace_once(source, old, new, label):
    if old not in source:
        raise RuntimeError(f'missing marker: {label}')
    if source.count(old) != 1:
        raise RuntimeError(f'non-unique marker ({source.count(old)}): {label}')
    return source.replace(old, new, 1)


source = FANBUSES.read_text()

# 1) Rare/dangerous actions only. Editing and stop master data move out of this block.
source = replace_between(
    source,
    'function tripManagementActions(trip) {',
    'function registrationWindowText(trip) {',
    r'''function tripManagementActions(trip) {
  const canManage = hasCapability("fanbus.manage") && trip.canManage !== false;
  const actions = [];

  if (!canManage || trip.status === "CANCELLED") return "";

  if (trip.status === "DRAFT") {
    actions.push(`<button class="button small primary" type="button" data-m310-publish="${escapeAttr(trip.id)}">Veröffentlichen</button>`);
    actions.push(`<button class="button small danger" type="button" data-m310-delete="${escapeAttr(trip.id)}">Entwurf löschen</button>`);
  }

  if (["DRAFT", "PUBLISHED"].includes(trip.status)) {
    actions.push(`<button class="button small ghost" type="button" data-m310-close="${escapeAttr(trip.id)}">Fahrt schließen</button>`);
  }

  if (trip.status === "CLOSED") {
    actions.push(`<button class="button small secondary" type="button" data-m310-reopen="${escapeAttr(trip.id)}">Wieder als Entwurf öffnen</button>`);
  }

  if (trip.canCancel === true) {
    actions.push(`<button class="button small danger" type="button" data-m330-cancel-trip="${escapeAttr(trip.id)}">Fahrt absagen</button>`);
  }

  return actions.join("");
}''',
    'tripManagementActions'
)

# 2) Direct work-area navigation. No per-trip gear.
source = replace_between(
    source,
    'function tripNavigation(trip) {',
    'function normalizedTripDetailStops(stops) {',
    r'''function tripNavigation(trip) {
  const canManage = hasCapability("fanbus.manage") && trip.canManage !== false;
  const operationsAccess = fanbusOperationsAccess(trip);
  const canEdit = canManage && ["DRAFT", "PUBLISHED"].includes(trip.status);
  const moreActions = tripManagementActions(trip);

  return `<nav class="v4-m310-trip-nav" aria-label="Arbeitsbereiche der Fanbusfahrt">
    ${operationsAccess.canManageRegistrations ? `<button class="button small secondary" type="button" data-m310-participants="${escapeAttr(trip.id)}">Teilnehmer</button>` : ""}
    ${canManage ? `<button class="button small secondary" type="button" data-m310-buses="${escapeAttr(trip.id)}">Busse</button>` : ""}
    ${operationsAccess.canRead ? `<button class="button small secondary" type="button" data-m325-operations="${escapeAttr(trip.id)}">Fahrtbetrieb</button>` : ""}
    ${canEdit ? `<button class="button small secondary" type="button" data-m310-edit-mode="${escapeAttr(trip.id)}">Bearbeiten</button>` : ""}
  </nav>
  ${moreActions ? `<details class="v4-m310-more-actions"><summary>Weitere Aktionen</summary><div class="v4-m310-trip-management" data-m310-trip-management>${moreActions}</div></details>` : ""}`;
}

function formatBerlinDateTimeCompact(value) {
  const localValue = toBerlinInputValue(value);
  if (!localValue) return "Noch nicht festgelegt";
  const [date, time] = localValue.split("T");
  return `${formatCalendarDate(date)} · ${time} Uhr`;
}

function tripRegistrationDeadlineMarkup(trip) {
  if (trip.status === "CANCELLED") return "";
  if (trip.registrationClosesAt) {
    return `<div class="v4-m325-trip-registration-deadline"><span>ANMELDESCHLUSS</span><strong>${escapeHtml(formatBerlinDateTimeCompact(trip.registrationClosesAt))}</strong></div>`;
  }
  return `<div class="v4-m325-trip-registration-deadline"><span>ANMELDESCHLUSS</span><strong>Noch nicht festgelegt</strong></div>`;
}''',
    'tripNavigation'
)

# 3) Detail ordering: departure time only; deadline after stops.
source = replace_once(
    source,
    '<div class="full v4-m325-trip-travel"><div><span>Abfahrt</span><strong>${escapeHtml(formatBerlinDateTime(trip.departureAt))}</strong></div><div><span>Fahrtpreis</span><strong>${escapeHtml(formatMoney(trip.priceCents))}</strong></div></div>\n      <div class="full v4-m325-trip-registration-window"><strong>${escapeHtml(registrationWindowText(trip))}</strong></div>\n      ${tripDetailStopsMarkup(tripStops)}',
    '<div class="full v4-m325-trip-travel"><div><span>Abfahrt</span><strong>${escapeHtml(formatBerlinTime(trip.departureAt))}</strong></div><div><span>Fahrtpreis</span><strong>${escapeHtml(formatMoney(trip.priceCents))}</strong></div></div>\n      ${tripDetailStopsMarkup(tripStops)}\n      ${tripRegistrationDeadlineMarkup(trip)}',
    'trip detail ordering'
)

# 4) New sectioned editor using master stops + per-trip times.
source = replace_between(
    source,
    'function tripForm(trip) {',
    'function tripUpdatePayload(trip, values) {',
    r'''function tripStopMasterOptions(masterStops, selectedId = "") {
  return (Array.isArray(masterStops) ? masterStops : [])
    .map(stop => `<option value="${escapeAttr(stop.id)}"${stop.id === selectedId ? " selected" : ""}>${escapeHtml(stop.label || "Zustiegsort")}</option>`)
    .join("");
}

function tripStopEditorRow(trip, stop, masterStops, index, isNew = false) {
  const stopId = stop?.id || "";
  const boardingStopId = stop?.boardingStopId || "";
  const time = toBerlinTimeInputValue(stop?.departureAt) || defaultTripStopTime(trip);
  const position = Number(stop?.position || index + 1);
  const revision = stopId ? Number(stop?.revision || 0) : "";
  return `<div class="v4-m310-trip-stop-editor-row" data-m310-trip-stop-editor-row data-trip-stop-id="${escapeAttr(stopId)}" data-revision="${escapeAttr(revision)}" data-position="${escapeAttr(position)}" data-original-boarding-stop-id="${escapeAttr(boardingStopId)}" data-original-time="${escapeAttr(time)}" data-new="${isNew ? "true" : "false"}">
    <label>Zustiegsort
      <select data-m310-trip-stop-master required>
        <option value="">Bitte auswählen</option>
        ${tripStopMasterOptions(masterStops, boardingStopId)}
      </select>
    </label>
    <label>Uhrzeit
      <input data-m310-trip-stop-time type="time" step="60" required value="${escapeAttr(time)}">
    </label>
    <button class="button small ghost v4-m310-trip-stop-remove" type="button" data-m310-trip-stop-remove>${isNew ? "Entfernen" : "Entfernen"}</button>
  </div>`;
}

function tripForm(trip, tripStops = [], masterStops = []) {
  const required = trip.status === "PUBLISHED" ? "required" : "";
  const registrationClosesAt = toBerlinInputValue(trip.registrationClosesAt)
    || defaultRegistrationClosesInput(trip.departureAt);
  const activeStops = normalizedTripDetailStops(tripStops);
  const usedMasterIds = new Set(activeStops.map(stop => stop.boardingStopId).filter(Boolean));
  const selectableMasterStops = (Array.isArray(masterStops) ? masterStops : [])
    .filter(stop => stop?.isActive !== false || usedMasterIds.has(stop?.id))
    .sort((left, right) => Number(left?.position || 0) - Number(right?.position || 0));
  const openSince = trip.registrationOpensAt
    ? formatBerlinDateTimeCompact(trip.registrationOpensAt)
    : "Noch nicht festgelegt";

  return `<form id="m310TripEditorForm" class="v4-m310-trip-editor-form">
    <section class="v4-m310-editor-section">
      <h3>Fahrt</h3>
      <div class="v4-m310-editor-fields">
        <label>Abfahrt
          <input name="departureTime" type="time" step="60" value="${escapeAttr(toBerlinTimeInputValue(trip.departureAt))}" ${required}>
        </label>
        <label>Fahrtpreis
          <input name="price" inputmode="decimal" pattern="[0-9]+([,.][0-9]{1,2})?" value="${escapeAttr(centsToEuroInput(trip.priceCents))}" placeholder="25,00" ${required}>
        </label>
        <label class="v4-m310-editor-deadline">Anmeldeschluss
          <input name="registrationClosesAt" type="datetime-local" step="60" value="${escapeAttr(registrationClosesAt)}" ${required}>
        </label>
        ${trip.status === "DRAFT" ? `<label class="v4-m310-editor-open">Anmeldung beginnt
          <input name="registrationOpensAt" type="datetime-local" step="60" value="${escapeAttr(toBerlinInputValue(trip.registrationOpensAt))}">
        </label>` : `<div class="v4-m310-registration-open-info"><span>Anmeldung geöffnet seit</span><strong>${escapeHtml(openSince)}</strong></div>`}
        <label class="v4-m310-bus-preference-toggle">
          <input name="busPreferenceEnabled" type="checkbox"${trip.busPreferenceEnabled === true ? " checked" : ""}>
          <span>Buswunsch erlauben<small>Nur mit mindestens einem aktiven Party- und Ruhig-Bus.</small></span>
        </label>
      </div>
    </section>

    <section class="v4-m310-editor-section v4-m310-editor-stops">
      <div class="v4-m310-editor-section-heading">
        <div><h3>Zustiegsorte</h3><p class="subtle">Zentralen Zustiegsort auswählen und Uhrzeit für diese Fahrt festlegen.</p></div>
        <button class="button small secondary" type="button" data-m310-trip-stop-add>+ Zustiegsort</button>
      </div>
      <div class="v4-m310-trip-stop-editor-list" data-m310-trip-stop-editor-list>
        ${activeStops.map((stop, index) => tripStopEditorRow(trip, stop, selectableMasterStops, index)).join("")}
      </div>
      <template data-m310-trip-stop-template>${tripStopEditorRow(trip, null, selectableMasterStops, activeStops.length, true)}</template>
      <label class="v4-m310-trip-default-stop">Standard für diese Fahrt
        <select name="defaultBoardingStopId" data-m310-trip-default-stop>
          <option value="">Kein Standard</option>
          ${activeStops.map(stop => `<option value="${escapeAttr(stop.boardingStopId)}"${stop.boardingStopId === trip.defaultBoardingStopId ? " selected" : ""}>${escapeHtml(stop.label || "Zustiegsort")}</option>`).join("")}
        </select>
      </label>
    </section>
  </form>`;
}''',
    'tripForm'
)

source = replace_once(
    source,
    '''function tripUpdatePayload(trip, values) {
  return {
    id: trip.id,
    expectedRevision: Number(trip.revision),
    departureAt: berlinLocalToIso(values.departureAt, "Die Abfahrt"),
    departureInfo: trip.departureInfo || null,
    registrationOpensAt: berlinLocalToIso(values.registrationOpensAt, "Der Anmeldestart"),
    registrationClosesAt: berlinLocalToIso(values.registrationClosesAt, "Das Anmeldeende"),
    priceCents: euroInputToCents(values.price),
    capacity: trip.capacity,
    defaultBoardingStopId: values.defaultBoardingStopId || null,
    busPreferenceEnabled: values.busPreferenceEnabled === "on",
    privacyReference: PRIVACY_REFERENCE,
    termsReference: TERMS_REFERENCE
  };
}''',
    '''function tripUpdatePayload(trip, values) {
  return {
    id: trip.id,
    expectedRevision: Number(trip.revision),
    departureAt: values.departureTime
      ? tripTimeToBerlinIso(trip, values.departureTime, "Die Abfahrt")
      : trip.departureAt || null,
    departureInfo: trip.departureInfo || null,
    registrationOpensAt: values.registrationOpensAt
      ? berlinLocalToIso(values.registrationOpensAt, "Der Anmeldestart")
      : trip.registrationOpensAt || null,
    registrationClosesAt: berlinLocalToIso(values.registrationClosesAt, "Das Anmeldeende"),
    priceCents: euroInputToCents(values.price),
    capacity: trip.capacity,
    defaultBoardingStopId: values.defaultBoardingStopId || null,
    busPreferenceEnabled: values.busPreferenceEnabled === "on",
    privacyReference: PRIVACY_REFERENCE,
    termsReference: TERMS_REFERENCE
  };
}''',
    'tripUpdatePayload'
)

# 5) Modernize standalone editor too, so no old desktop-form fallback survives.
source = replace_between(
    source,
    'async function openTripEditor(trip) {',
    'function availableEventLabel(event) {',
    r'''async function openTripEditor(trip) {
  let tripStops;
  let masterStops;
  try {
    const [loadedTripStops, masterData] = await Promise.all([
      loadTripDetailStops(trip),
      call("fanbus_boarding_stops_list")
    ]);
    tripStops = loadedTripStops;
    masterStops = Array.isArray(masterData?.stops) ? masterData.stops : [];
  } catch (error) {
    showToast(error?.message || "Zustiegsorte konnten nicht geladen werden.", "error", 5200);
    return;
  }

  const dialog = openDialog({
    title: "Fanbusfahrt bearbeiten",
    kicker: trip.displayTitle || "Fanbusfahrt",
    body: `<div class="v4-m310-trip-edit-mode">
      <div class="v4-m310-editor-context"><strong>${escapeHtml(trip.venue || trip.opponentName || trip.displayTitle || "Fanbusfahrt")}</strong><span>${escapeHtml(formatCalendarDate(trip.eventDate))} · ${escapeHtml(eventTimeLabel(trip.eventTime))}</span></div>
      ${tripForm(trip, tripStops, masterStops)}
      <div class="dialog-actions v4-detail-actions"><button class="button primary" type="submit" form="m310TripEditorForm">Änderungen speichern</button></div>
    </div>`
  });
  bindInlineTripEditor(dialog, trip, { tripStops, masterStops });
}''',
    'openTripEditor'
)

# 6) Inline editor is the primary edit experience.
source = replace_between(
    source,
    'function bindTripDetail(dialog, trip) {',
    'function restoreTripOverview(dialog, trip, tripStops = null) {',
    r'''async function openInlineTripEditor(dialog, trip) {
  let tripStops;
  let masterStops;
  try {
    const [loadedTripStops, masterData] = await Promise.all([
      loadTripDetailStops(trip),
      call("fanbus_boarding_stops_list")
    ]);
    tripStops = loadedTripStops;
    masterStops = Array.isArray(masterData?.stops) ? masterData.stops : [];
  } catch (error) {
    showToast(error?.message || "Zustiegsorte konnten nicht geladen werden.", "error", 5200);
    return;
  }

  dialog.dataset.m310TripMode = "edit";
  const body = dialog.querySelector("#v4DialogBody");
  if (!body) return;
  body.innerHTML = `<div class="v4-m310-trip-edit-mode">
    <div class="v4-m310-editor-context"><strong>${escapeHtml(trip.venue || trip.opponentName || trip.displayTitle || "Fanbusfahrt")}</strong><span>${escapeHtml(formatCalendarDate(trip.eventDate))} · ${escapeHtml(eventTimeLabel(trip.eventTime))}</span></div>
    <p class="subtle v4-m310-editor-context-note">Spieltermin, Gegner und Spielort werden im Terminmodul verwaltet.</p>
    ${tripForm(trip, tripStops, masterStops)}
    <div class="dialog-actions v4-detail-actions"><button class="button ghost" type="button" data-m310-cancel-edit>Abbrechen</button><button class="button primary" type="submit" form="m310TripEditorForm">Änderungen speichern</button></div>
  </div>`;
  bindInlineTripEditor(dialog, trip, { tripStops, masterStops });
}

function bindTripDetail(dialog, trip) {
  dialog.querySelector("[data-m310-edit-mode]")?.addEventListener("click", () => {
    void openInlineTripEditor(dialog, trip);
  });
  bindTripActions(dialog, [trip]);
}''',
    'bindTripDetail'
)

# 7) Stop-row behavior + combined save.
source = replace_between(
    source,
    'function bindInlineTripEditor(dialog, trip) {',
    'function tripTable(items) {',
    r'''function syncTripDefaultStopOptions(form, trip) {
  const select = form.querySelector("[data-m310-trip-default-stop]");
  if (!select) return;
  const current = select.value || trip.defaultBoardingStopId || "";
  const options = [];
  const seen = new Set();
  form.querySelectorAll("[data-m310-trip-stop-editor-row]").forEach(row => {
    if (row.dataset.removed === "true") return;
    const stopSelect = row.querySelector("[data-m310-trip-stop-master]");
    const id = stopSelect?.value || "";
    if (!id || seen.has(id)) return;
    seen.add(id);
    options.push({ id, label: stopSelect.selectedOptions?.[0]?.textContent?.trim() || "Zustiegsort" });
  });
  select.innerHTML = `<option value="">Kein Standard</option>${options.map(option => `<option value="${escapeAttr(option.id)}">${escapeHtml(option.label)}</option>`).join("")}`;
  select.value = seen.has(current) ? current : "";
}

function bindTripStopEditor(form, trip) {
  const list = form.querySelector("[data-m310-trip-stop-editor-list]");
  const template = form.querySelector("template[data-m310-trip-stop-template]");
  if (!list || !template) return;

  const bindRow = row => {
    const remove = row.querySelector("[data-m310-trip-stop-remove]");
    const stopSelect = row.querySelector("[data-m310-trip-stop-master]");
    remove?.addEventListener("click", () => {
      if (row.dataset.new === "true") {
        row.remove();
      } else {
        const removed = row.dataset.removed === "true";
        row.dataset.removed = removed ? "false" : "true";
        row.classList.toggle("is-removed", !removed);
        row.querySelectorAll("select,input").forEach(control => { control.disabled = !removed; });
        if (remove) remove.textContent = removed ? "Entfernen" : "Rückgängig";
      }
      syncTripDefaultStopOptions(form, trip);
    });
    stopSelect?.addEventListener("change", () => syncTripDefaultStopOptions(form, trip));
  };

  list.querySelectorAll("[data-m310-trip-stop-editor-row]").forEach(bindRow);
  form.querySelector("[data-m310-trip-stop-add]")?.addEventListener("click", () => {
    const fragment = template.content.cloneNode(true);
    const row = fragment.querySelector("[data-m310-trip-stop-editor-row]");
    if (!row) return;
    list.appendChild(fragment);
    bindRow(row);
    syncTripDefaultStopOptions(form, trip);
    row.querySelector("select")?.focus();
  });
  syncTripDefaultStopOptions(form, trip);
}

function collectTripStopEditorPlan(form, trip) {
  const rows = [...form.querySelectorAll("[data-m310-trip-stop-editor-row]")];
  const activeRows = rows.filter(row => row.dataset.removed !== "true");
  const selectedIds = activeRows.map(row => row.querySelector("[data-m310-trip-stop-master]")?.value || "");
  if (selectedIds.some(id => !id)) throw new Error("Bitte für jeden Zustieg einen zentralen Zustiegsort auswählen.");
  if (new Set(selectedIds).size !== selectedIds.length) throw new Error("Ein Zustiegsort kann pro Fahrt nur einmal verwendet werden.");

  let nextPosition = rows.reduce((max, row) => Math.max(max, Number(row.dataset.position || 0)), 0) + 1;
  const removals = [];
  const upserts = [];

  rows.forEach(row => {
    const id = row.dataset.tripStopId || null;
    const revision = id ? Number(row.dataset.revision || 0) : null;
    const removed = row.dataset.removed === "true";
    const select = row.querySelector("[data-m310-trip-stop-master]");
    const timeInput = row.querySelector("[data-m310-trip-stop-time]");
    const boardingStopId = select?.value || row.dataset.originalBoardingStopId || "";
    const time = timeInput?.value || row.dataset.originalTime || "";
    const position = id ? Number(row.dataset.position || 1) : nextPosition++;

    if (removed) {
      if (!id) return;
      removals.push({
        id,
        tripId: trip.id,
        boardingStopId: row.dataset.originalBoardingStopId,
        departureAt: tripTimeToBerlinIso(trip, row.dataset.originalTime, "Die Zustiegszeit"),
        position,
        isActive: false,
        expectedRevision: revision
      });
      return;
    }

    if (!time) throw new Error("Bitte für jeden Zustieg eine Uhrzeit angeben.");
    const originalMaster = row.dataset.originalBoardingStopId || "";
    const originalTime = row.dataset.originalTime || "";
    const changed = !id || boardingStopId !== originalMaster || time !== originalTime;
    if (!changed) return;

    upserts.push({
      id,
      tripId: trip.id,
      boardingStopId,
      departureAt: tripTimeToBerlinIso(trip, time, "Die Zustiegszeit"),
      position,
      isActive: true,
      expectedRevision: revision
    });
  });

  const defaultSelect = form.querySelector("[data-m310-trip-default-stop]");
  const defaultBoardingStopId = defaultSelect?.value || null;
  return { removals, upserts, defaultBoardingStopId };
}

function bindInlineTripEditor(dialog, trip) {
  const form = dialog.querySelector("#m310TripEditorForm");
  if (!form) return;
  bindTripEditorDateDefaults(form, trip);
  bindTripStopEditor(form, trip);

  dialog.querySelector("[data-m310-cancel-edit]")
    ?.addEventListener("click", () => restoreTripOverview(dialog, trip));

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = dialog.querySelector('[type="submit"][form="m310TripEditorForm"]');
    if (button) button.disabled = true;

    try {
      const values = Object.fromEntries(new FormData(form));
      const stopPlan = collectTripStopEditorPlan(form, trip);
      values.defaultBoardingStopId = stopPlan.defaultBoardingStopId || "";

      snapshot = await runWrite(async () => {
        const nextSnapshot = await call("fanbus_trip_update", tripUpdatePayload(trip, values));
        for (const payload of stopPlan.removals) {
          await call("fanbus_trip_boarding_stop_upsert", payload);
        }
        for (const payload of stopPlan.upserts) {
          await call("fanbus_trip_boarding_stop_upsert", payload);
        }
        return nextSnapshot;
      }, "Fanbusfahrt wurde aktualisiert.");

      render();
      const updated = trips().find(item => item.id === trip.id);
      if (updated) restoreTripOverview(dialog, updated);
      else dialog.close();
    } catch (error) {
      showToast(error?.message || "Fanbusfahrt konnte nicht aktualisiert werden.", "error", 5200);
      if (button?.isConnected) button.disabled = false;
    }
  });
}''',
    'bindInlineTripEditor'
)

# 8) Direct participant/bus actions.
source = replace_once(
    source,
    'function bindTripActions(panel, items) {\n  panel.querySelectorAll("[data-m310-occupancy]").forEach(button => {',
    '''function bindTripActions(panel, items) {
  panel.querySelectorAll("[data-m310-participants]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m310Participants);
      if (trip) void openRegistrations(trip, button);
    });
  });
  panel.querySelectorAll("[data-m310-buses]").forEach(button => {
    button.addEventListener("click", () => {
      const trip = items.find(item => item.id === button.dataset.m310Buses);
      if (trip) void openBuses(trip, button);
    });
  });
  panel.querySelectorAll("[data-m310-occupancy]").forEach(button => {''',
    'bind direct trip actions'
)

# 9) Global Fanbus settings workspace for central master stops.
settings_code = r'''function fanbusMasterStopSettingsCard(stop) {
  return `<article class="v4-m310-master-stop-card">
    <div><strong>${escapeHtml(stop.label || "Zustiegsort")}</strong>${stop.address ? `<small>${escapeHtml(stop.address)}</small>` : ""}</div>
    <span class="badge ${stop.isActive === false ? "neutral" : "success"}">${stop.isActive === false ? "Inaktiv" : "Aktiv"}</span>
    <button class="button small secondary" type="button" data-m310-master-stop-settings-edit="${escapeAttr(stop.id)}">Bearbeiten</button>
  </article>`;
}

function openFanbusMasterStopSettingsEditor(stop, stops, refresh) {
  const creating = !stop;
  const nextPosition = Math.max(0, ...(Array.isArray(stops) ? stops : []).map(item => Number(item?.position || 0))) + 1;
  const dialog = openDialog({
    title: creating ? "Zustiegsort anlegen" : "Zustiegsort bearbeiten",
    body: `<form class="form-grid v4-smart-form" data-m310-master-stop-settings-form>
      <label class="v4-field-full">Bezeichnung<input name="label" maxlength="160" required value="${escapeAttr(stop?.label || "")}"></label>
      <label class="v4-field-full">Adresse (optional)<input name="address" maxlength="240" value="${escapeAttr(stop?.address || "")}"></label>
      <label class="v4-field-full">Hinweis (optional)<textarea name="defaultNote" maxlength="240">${escapeHtml(stop?.defaultNote || "")}</textarea></label>
      <label class="v4-field-half">Reihenfolge<input name="position" type="number" min="1" step="1" required value="${escapeAttr(stop?.position || nextPosition)}"></label>
      <label class="v4-field-half v4-m310-master-stop-active"><input name="isActive" type="checkbox"${stop?.isActive === false ? "" : " checked"}><span>Aktiv</span></label>
      <div class="dialog-actions v4-detail-actions v4-field-full"><button class="button primary" type="submit">Speichern</button></div>
    </form>`
  });

  dialog.querySelector("[data-m310-master-stop-settings-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form));
    try {
      await runWrite(() => call("fanbus_boarding_stop_upsert", {
        id: stop?.id || null,
        expectedRevision: stop ? Number(stop.revision) : null,
        label: values.label,
        address: values.address || null,
        defaultNote: values.defaultNote || null,
        position: Number(values.position),
        isActive: values.isActive === "on"
      }), "Zustiegsort gespeichert.");
      dialog.close();
      void refresh();
    } catch (error) {
      showToast(error?.message || "Zustiegsort konnte nicht gespeichert werden.", "error", 5200);
    }
  });
}

async function renderFanbusSettingsWorkspace(panel, summary) {
  if (summary) summary.textContent = "";
  panel.innerHTML = workspaceLoading("Fanbus-Einstellungen", "Zentrale Zustiegsorte werden geladen …");
  panel.querySelector("[data-m325-back]")?.addEventListener("click", () => returnToFanbuses());

  try {
    const data = await call("fanbus_boarding_stops_list");
    const stops = Array.isArray(data?.stops) ? data.stops.slice().sort((a, b) => Number(a.position || 0) - Number(b.position || 0)) : [];
    const refresh = () => renderFanbusSettingsWorkspace(panel, summary);
    panel.innerHTML = `<section class="v4-m325-workspace v4-m310-fanbus-settings" data-m310-fanbus-settings>
      <header class="v4-m325-workspace-header">
        <button class="button small secondary" type="button" data-m310-settings-back>← Zurück</button>
        <div><h2>Fanbus-Einstellungen</h2><p>Zentrale Zustiegsorte einmalig pflegen. In einer Fahrt werden anschließend nur Zustiegsort und Uhrzeit gewählt.</p></div>
      </header>
      <div class="v4-m310-settings-section-heading"><div><h3>Zentrale Zustiegsorte</h3><p class="subtle">Diese Liste steht allen Fanbusfahrten zur Auswahl.</p></div><button class="button small primary" type="button" data-m310-master-stop-settings-add>+ Zustiegsort</button></div>
      <div class="v4-m310-master-stop-settings-list">${stops.length ? stops.map(fanbusMasterStopSettingsCard).join("") : '<p class="empty-state">Noch keine Zustiegsorte angelegt.</p>'}</div>
    </section>`;
    panel.querySelector("[data-m310-settings-back]")?.addEventListener("click", () => returnToFanbuses());
    panel.querySelector("[data-m310-master-stop-settings-add]")?.addEventListener("click", () => openFanbusMasterStopSettingsEditor(null, stops, refresh));
    panel.querySelectorAll("[data-m310-master-stop-settings-edit]").forEach(button => {
      button.addEventListener("click", () => openFanbusMasterStopSettingsEditor(stops.find(stop => stop.id === button.dataset.m310MasterStopSettingsEdit), stops, refresh));
    });
  } catch (error) {
    panel.innerHTML = errorPanel(error?.message || "Fanbus-Einstellungen konnten nicht geladen werden.");
    panel.querySelector("[data-m325-back]")?.addEventListener("click", () => returnToFanbuses());
  }
}

'''
source = replace_once(
    source,
    'async function openBoardingStops(trip) {',
    settings_code + 'async function openBoardingStops(trip) {',
    'settings workspace insertion'
)

# 10) Route + global action-menu entry.
source = replace_once(
    source,
    '  const companionButton = document.getElementById("m325CompanionListsButton");\n  if (!root || !toggle || !menu) return;',
    '  const companionButton = document.getElementById("m325CompanionListsButton");\n  const settingsButton = document.getElementById("m310FanbusSettingsButton");\n  if (!root || !toggle || !menu) return;',
    'settings menu button declaration'
)
source = replace_once(
    source,
    '''  if (companionButton) {
    companionButton.onclick = () => {
      close();
      window.location.hash = "#/fanbuses?view=companions";
    };
  }
  toggle.onclick = () => menu.hidden ? open() : close({ restoreFocus: true });''',
    '''  if (companionButton) {
    companionButton.onclick = () => {
      close();
      window.location.hash = "#/fanbuses?view=companions";
    };
  }
  if (settingsButton) {
    settingsButton.hidden = !canManage;
    settingsButton.onclick = canManage ? () => {
      close();
      window.location.hash = "#/fanbuses?view=settings";
    } : null;
  }
  toggle.onclick = () => menu.hidden ? open() : close({ restoreFocus: true });''',
    'settings menu binding'
)
source = replace_once(
    source,
    '''  if (routeQuery.get("view") === "companions") {
    setWorkspaceShell(true);
    void renderCompanionWorkspace(panel, summary, routeQuery.get("fromTrip"));
    return;
  }
  if (routeQuery.get("view") === "operations" && routeQuery.get("trip")) {''',
    '''  if (routeQuery.get("view") === "companions") {
    setWorkspaceShell(true);
    void renderCompanionWorkspace(panel, summary, routeQuery.get("fromTrip"));
    return;
  }
  if (routeQuery.get("view") === "settings") {
    if (!hasCapability("fanbus.manage")) {
      returnToFanbuses();
      return;
    }
    setWorkspaceShell(true);
    void renderFanbusSettingsWorkspace(panel, summary);
    return;
  }
  if (routeQuery.get("view") === "operations" && routeQuery.get("trip")) {''',
    'settings route'
)

FANBUSES.write_text(source)

# Page: global settings lives in the global action menu, not per trip.
page = PAGE.read_text()
page = replace_once(
    page,
    '              <button id="m325CompanionListsButton" type="button" role="menuitem">Meine Mitfahrer</button>\n              <button id="m310AddTripButton" type="button" role="menuitem" hidden>Fanbusfahrt anlegen</button>',
    '              <button id="m325CompanionListsButton" type="button" role="menuitem">Meine Mitfahrer</button>\n              <button id="m310FanbusSettingsButton" type="button" role="menuitem" hidden>Fanbus-Einstellungen</button>\n              <button id="m310AddTripButton" type="button" role="menuitem" hidden>Fanbusfahrt anlegen</button>',
    'fanbus settings menu item'
)
PAGE.write_text(page)

# Scoped UX styles.
ux = UX.read_text()
style_marker = '    [data-m310-open-trip].is-expanded .v4-row-chevron{transform:rotate(90deg)}\n'
style_add = r'''    [data-m310-open-trip].is-expanded .v4-row-chevron{transform:rotate(90deg)}
    .v4-m325-trip-registration-deadline{display:grid;gap:3px;margin:16px 0 4px;padding-top:14px;border-top:1px solid var(--line,#d8e2ee)}
    .v4-m325-trip-registration-deadline>span{font-size:.78rem;font-weight:800;letter-spacing:.08em;color:var(--muted,#718096)}
    .v4-m325-trip-registration-deadline>strong{font-size:1rem}
    .v4-m310-trip-nav{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px;overflow:visible!important}
    .v4-m310-trip-nav .button{width:100%;min-width:0;white-space:normal!important}
    .v4-m310-more-actions{margin-top:12px;border-top:1px solid var(--line,#d8e2ee);padding-top:10px}
    .v4-m310-more-actions>summary{cursor:pointer;font-weight:700;color:var(--muted,#718096);list-style:none;padding:8px 2px}
    .v4-m310-more-actions>summary::-webkit-details-marker{display:none}
    .v4-m310-more-actions>summary::after{content:"›";float:right;transition:transform .15s ease}
    .v4-m310-more-actions[open]>summary::after{transform:rotate(90deg)}
    .v4-m310-more-actions .v4-m310-trip-management{display:flex;flex-wrap:wrap;gap:8px;padding:8px 0 0;border:0;background:transparent}
    .v4-m310-editor-context{display:grid;gap:3px;margin-bottom:4px}
    .v4-m310-editor-context>strong{font-size:1.05rem}
    .v4-m310-editor-context>span,.v4-m310-editor-context-note{color:var(--muted,#718096)}
    .v4-m310-trip-editor-form{display:grid;gap:16px;margin-top:14px}
    .v4-m310-editor-section{display:grid;gap:12px;padding:14px;border:1px solid var(--line,#d8e2ee);border-radius:14px;background:var(--surface,#fff)}
    .v4-m310-editor-section h3{margin:0}
    .v4-m310-editor-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .v4-m310-editor-fields>label,.v4-m310-trip-stop-editor-row>label,.v4-m310-trip-default-stop{display:grid;gap:6px;min-width:0;font-weight:700}
    .v4-m310-editor-fields input,.v4-m310-editor-fields select,.v4-m310-trip-stop-editor-row input,.v4-m310-trip-stop-editor-row select,.v4-m310-trip-default-stop select{width:100%;min-width:0}
    .v4-m310-editor-deadline,.v4-m310-editor-open,.v4-m310-registration-open-info,.v4-m310-bus-preference-toggle{grid-column:1/-1}
    .v4-m310-registration-open-info{display:grid;gap:3px;padding:10px 12px;border-radius:10px;background:var(--surface-soft,#f5f7fa)}
    .v4-m310-registration-open-info>span{font-size:.8rem;color:var(--muted,#718096)}
    .v4-m310-bus-preference-toggle{display:flex!important;align-items:flex-start;gap:10px;padding:10px 0}
    .v4-m310-bus-preference-toggle input{width:20px!important;min-width:20px!important;margin-top:2px}
    .v4-m310-bus-preference-toggle span{display:grid;gap:2px}
    .v4-m310-bus-preference-toggle small{font-weight:400;color:var(--muted,#718096)}
    .v4-m310-editor-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
    .v4-m310-editor-section-heading h3,.v4-m310-editor-section-heading p{margin:0}
    .v4-m310-trip-stop-editor-list{display:grid;gap:10px}
    .v4-m310-trip-stop-editor-row{display:grid;grid-template-columns:minmax(0,1fr) 112px auto;gap:8px;align-items:end;padding:10px;border:1px solid var(--line,#d8e2ee);border-radius:12px}
    .v4-m310-trip-stop-editor-row.is-removed{opacity:.65}
    .v4-m310-trip-stop-remove{min-height:44px}
    .v4-m310-trip-default-stop{margin-top:2px}
    .v4-m310-fanbus-settings{display:grid;gap:16px}
    .v4-m310-settings-section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .v4-m310-settings-section-heading h3,.v4-m310-settings-section-heading p{margin:0}
    .v4-m310-master-stop-settings-list{display:grid;gap:10px}
    .v4-m310-master-stop-card{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:12px;border:1px solid var(--line,#d8e2ee);border-radius:12px}
    .v4-m310-master-stop-card>div{display:grid;gap:2px;min-width:0}
    .v4-m310-master-stop-card small{color:var(--muted,#718096)}
    .v4-m310-master-stop-active{display:flex!important;align-items:center;gap:8px}
'''
if style_marker not in ux:
    raise RuntimeError('missing UX style marker')
ux = ux.replace(style_marker, style_add, 1)
ux = replace_once(
    ux,
    '    @media (max-width:620px){\n      .p800-fanbus-filter-disclosure',
    '''    @media (max-width:620px){
      .v4-m310-editor-fields{grid-template-columns:1fr}
      .v4-m310-editor-deadline,.v4-m310-editor-open,.v4-m310-registration-open-info,.v4-m310-bus-preference-toggle{grid-column:auto}
      .v4-m310-editor-section{padding:12px}
      .v4-m310-editor-section-heading,.v4-m310-settings-section-heading{display:grid;grid-template-columns:1fr}
      .v4-m310-editor-section-heading .button,.v4-m310-settings-section-heading .button{width:100%}
      .v4-m310-trip-stop-editor-row{grid-template-columns:minmax(0,1fr) 108px}
      .v4-m310-trip-stop-remove{grid-column:1/-1;justify-self:end}
      .v4-m310-master-stop-card{grid-template-columns:minmax(0,1fr) auto}
      .v4-m310-master-stop-card>.button{grid-column:1/-1;width:100%}
      .p800-fanbus-filter-disclosure''',
    'mobile UX additions'
)
UX.write_text(ux)

# Update legacy contracts to the newly approved hierarchy.
test_u5 = TEST_U5.read_text()
test_u5 = replace_once(test_u5, '  assert.match(nav, />Belegung</);', '  assert.match(nav, />Teilnehmer</);\n  assert.match(nav, />Busse</);', 'U5 navigation test')
test_u5 = replace_once(test_u5, '  assert.match(fanbuses, /Anmeldeschluss:/);', '  assert.match(fanbuses, /ANMELDESCHLUSS/);', 'U5 deadline test')
TEST_U5.write_text(test_u5)

test_u51 = TEST_U51.read_text()
test_u51 = replace_once(
    test_u51,
    '''  const management = section(fanbuses, "function tripManagementActions", "function registrationWindowText");
  const form = section(fanbuses, "function tripForm", "function tripUpdatePayload");
  assert.match(management, /data-m310-edit-mode/);''',
    '''  const management = section(fanbuses, "function tripManagementActions", "function registrationWindowText");
  const navigation = section(fanbuses, "function tripNavigation", "function normalizedTripDetailStops");
  const form = section(fanbuses, "function tripForm", "function tripUpdatePayload");
  assert.doesNotMatch(management, /data-m310-edit-mode/);
  assert.match(navigation, /data-m310-edit-mode/);''',
    'U5.1 edit location test'
)
TEST_U51.write_text(test_u51)

TEST_NEW.write_text(r'''import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

test("P800-R2 Fanbus detail follows the approved information hierarchy", async () => {
  const fanbuses = await read("js/modules/fanbuses.js");
  const detail = section(fanbuses, "function tripDetailMarkup", "function openTripDetail");
  assert.match(detail, /formatBerlinTime\(trip\.departureAt\)/);
  assert.doesNotMatch(detail, /formatBerlinDateTime\(trip\.departureAt\)/);
  assert.ok(detail.indexOf("tripDetailStopsMarkup") < detail.indexOf("tripRegistrationDeadlineMarkup"));
  assert.match(fanbuses, /ANMELDESCHLUSS/);
});

test("P800-R2 trip navigation exposes direct work areas without a per-trip gear", async () => {
  const fanbuses = await read("js/modules/fanbuses.js");
  const nav = section(fanbuses, "function tripNavigation", "function normalizedTripDetailStops");
  assert.match(nav, /data-m310-participants/);
  assert.match(nav, />Teilnehmer</);
  assert.match(nav, /data-m310-buses/);
  assert.match(nav, />Busse</);
  assert.match(nav, />Fahrtbetrieb</);
  assert.match(nav, /data-m310-edit-mode/);
  assert.match(nav, />Weitere Aktionen</);
  assert.doesNotMatch(nav, /⚙️|data-m310-trip-settings/);
});

test("P800-R2 editor uses time-only departure and central stop selections", async () => {
  const fanbuses = await read("js/modules/fanbuses.js");
  const form = section(fanbuses, "function tripStopMasterOptions", "function tripUpdatePayload");
  assert.match(form, /name="departureTime" type="time"/);
  assert.match(form, /name="registrationClosesAt" type="datetime-local"/);
  assert.match(form, /data-m310-trip-stop-editor-row/);
  assert.match(form, /data-m310-trip-stop-master/);
  assert.match(form, /data-m310-trip-stop-time/);
  assert.match(form, /data-m310-trip-stop-add/);
  assert.match(fanbuses, /call\("fanbus_boarding_stops_list"\)/);
  assert.match(fanbuses, /call\("fanbus_trip_boarding_stop_upsert"/);
});

test("P800-R2 central boarding stops live in Fanbus settings", async () => {
  const [fanbuses, page] = await Promise.all([
    read("js/modules/fanbuses.js"),
    read("pages/fanbuses.html")
  ]);
  assert.match(page, /id="m310FanbusSettingsButton"/);
  assert.match(page, />Fanbus-Einstellungen</);
  assert.match(fanbuses, /view=settings/);
  assert.match(fanbuses, /function renderFanbusSettingsWorkspace/);
  assert.match(fanbuses, /Zentrale Zustiegsorte/);
  assert.doesNotMatch(section(fanbuses, "function tripManagementActions", "function registrationWindowText"), /Zustiegsstammdaten/);
});

test("P800-R2 workflow UX remains frontend-only and does not implement automatic assignment", async () => {
  const fanbuses = await read("js/modules/fanbuses.js");
  assert.doesNotMatch(fanbuses, /fanbus_(?:auto|automatic).*assign/i);
});
''')

print('P800_R2_FANBUS_WORKFLOW_PATCH_OK')
