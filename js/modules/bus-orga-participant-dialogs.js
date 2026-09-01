import {
  call,
  closeAllDialogs,
  confirmAction,
  escapeAttr,
  escapeHtml,
  hasCapability,
  openDialog,
  runWrite,
  showToast
} from "./common.js";
import {
  busPreferenceLabel,
  formatBoardingTime,
  formatDateTime,
  preferenceOptions,
  sourceLabel,
  statusLabel,
  tripVenue
} from "./bus-orga-workspace-base.js";

function participantDetailMarkup(state, registration) {
  const bus = state.buses.find(item => item.id === registration.busId);
  const occupancy = item => Number(item.occupancy ?? item.occupied ?? 0);
  const assignment = registration.status === "ACTIVE"
    ? `<label>Buszuordnung<select data-m328-participant-assignment><option value="">Nicht zugeordnet</option>${state.buses.filter(item => item.isActive !== false).map(item => `<option value="${escapeAttr(item.id)}"${item.id === registration.busId ? " selected" : ""}>${escapeHtml(`${item.label} · ${occupancy(item)}/${item.capacity}`)}</option>`).join("")}</select><small>Aktuell: ${escapeHtml(bus?.label || "Nicht zugeordnet")}</small></label>`
    : "";
  return `<div class="m328-dialog-facts">
      <div><span>Status</span><strong>${escapeHtml(statusLabel(registration.status))}</strong></div>
      <div><span>Quelle</span><strong>${escapeHtml(sourceLabel(registration.source))}</strong></div>
      <div><span>Buswunsch</span><strong>${escapeHtml(busPreferenceLabel(registration.busPreference))}</strong></div>
      <div><span>Angemeldet</span><strong>${escapeHtml(formatDateTime(registration.registeredAt))}</strong></div>
      ${registration.status === "WAITLISTED" ? `<div><span>Warteliste</span><strong>Position ${escapeHtml(registration.waitlistPosition || "–")}</strong></div>` : ""}
    </div>
    ${assignment}
    <div class="m328-dialog-actions">
      <button class="button secondary" type="button" data-m328-participant-edit>Bearbeiten</button>
      <button class="button secondary" type="button" data-m328-participant-more>Weitere Aktionen</button>
      ${registration.status === "WAITLISTED" && Number(registration.waitlistPosition) === 1 ? '<button class="button primary" type="button" data-m328-participant-promote>Promotion bestätigen</button>' : ""}
    </div>`;
}

export function openParticipantDetail(state, registration) {
  const dialog = openDialog({
    title: `${registration.firstName} ${registration.lastName}`,
    kicker: `${tripVenue(state.trip)} · Teilnehmer`,
    body: participantDetailMarkup(state, registration)
  });
  dialog.querySelector("[data-m328-participant-edit]")?.addEventListener("click", () => void openParticipantEdit(state, registration));
  dialog.querySelector("[data-m328-participant-more]")?.addEventListener("click", () => openParticipantMore(state, registration));
  dialog.querySelector("[data-m328-participant-promote]")?.addEventListener("click", async () => {
    try {
      await runWrite(() => call("fanbus_waitlist_promote", {
        id: registration.id,
        expectedRevision: Number(registration.revision)
      }), "Teilnehmer wurde von der Warteliste übernommen.");
      await state.refresh();
      closeAllDialogs();
    } catch (error) {
      showToast(error?.message || "Promotion ist derzeit nicht möglich.", "error", 5200);
    }
  });
  const assignment = dialog.querySelector("[data-m328-participant-assignment]");
  assignment?.addEventListener("change", async () => {
    assignment.disabled = true;
    try {
      await runWrite(() => call("fanbus_bus_assignment_set", {
        participantId: registration.id,
        busId: assignment.value || null
      }), "Buszuordnung gespeichert.");
      await state.refresh();
      closeAllDialogs();
    } catch (error) {
      assignment.disabled = false;
      showToast(error?.message || "Buszuordnung konnte nicht gespeichert werden.", "error", 5200);
    }
  });
}

async function openParticipantEdit(state, registration) {
  try {
    const [operational, stopData] = await Promise.all([
      call("fanbus_registration_operational_detail", { participantId: registration.id }),
      call("fanbus_trip_boarding_stops_list", { tripId: state.trip.id })
    ]);
    const stops = Array.isArray(stopData?.stops) ? stopData.stops.filter(stop => stop.isActive !== false) : [];
    const linked = Boolean(registration.memberId || registration.portalUserId || registration.regularRiderId);
    const dialog = openDialog({
      title: "Teilnehmer bearbeiten",
      kicker: `${registration.firstName} ${registration.lastName}`,
      body: `<form class="form-grid v4-smart-form" data-m328-participant-edit-form>
        <label class="v4-field-half">Vorname<input name="firstName" maxlength="120" value="${escapeAttr(registration.firstName || "")}" required${linked ? " readonly" : ""}></label>
        <label class="v4-field-half">Nachname<input name="lastName" maxlength="120" value="${escapeAttr(registration.lastName || "")}" required${linked ? " readonly" : ""}></label>
        <label class="v4-field-full">E-Mail<input name="email" type="email" maxlength="320" value="${escapeAttr(registration.email || "")}"${linked ? " readonly" : ""}></label>
        <label class="v4-field-half">Buswunsch<select name="busPreference">${preferenceOptions(registration.busPreference)}</select></label>
        <label class="v4-field-half">Zustiegsort<select name="tripBoardingStopId"><option value="">Kein strukturierter Zustieg</option>${stops.map(stop => {
          const id = stop.tripBoardingStopId || stop.id;
          return `<option value="${escapeAttr(id)}"${id === operational.tripBoardingStopId ? " selected" : ""}>${escapeHtml(`${formatBoardingTime(stop.departureAt) || "Zeit offen"} · ${stop.label}`)}</option>`;
        }).join("")}</select></label>
        <label class="v4-field-full">Operativer Hinweis<textarea name="operationalNote" maxlength="240">${escapeHtml(operational.operationalNote || "")}</textarea></label>
        ${linked ? '<p class="subtle v4-field-full">Identitätsdaten verknüpfter Personen bleiben unverändert.</p>' : ""}
      </form>`,
      submitLabel: "Änderungen speichern",
      onSubmit: async values => {
        await runWrite(() => call("fanbus_registration_update_m325", {
          id: registration.id,
          expectedRevision: Number(registration.revision),
          firstName: linked ? registration.firstName : values.firstName,
          lastName: linked ? registration.lastName : values.lastName,
          email: linked ? registration.email : values.email,
          busPreference: values.busPreference,
          tripBoardingStopId: values.tripBoardingStopId || null,
          operationalNote: values.operationalNote || null
        }), "Teilnehmer wurde aktualisiert.");
        await state.refresh();
      }
    });
    return dialog;
  } catch (error) {
    showToast(error?.message || "Teilnehmer konnte nicht geladen werden.", "error", 5200);
    return null;
  }
}

function canManageParticipantIdentity(trip, registration) {
  const portalPrimary = registration.source === "PORTAL" && registration.bookingRole === "PRIMARY";
  return hasCapability("fanbus.participant_identity.manage")
    && ["PUBLISHED", "CLOSED"].includes(trip.status)
    && registration.status !== "CANCELLED"
    && !portalPrimary;
}

function openParticipantMore(state, registration) {
  const canIdentity = canManageParticipantIdentity(state.trip, registration);
  const hasPortalIdentity = Boolean(registration.portalUserId);
  const body = `<div class="m328-dialog-actions">
      ${["ACTIVE", "WAITLISTED"].includes(registration.status) ? '<button class="button danger" type="button" data-m328-participant-cancel>Stornieren</button>' : ""}
    </div>
    ${canIdentity ? `<section class="m328-identity-actions"><h3>Portalidentität</h3>${hasPortalIdentity
      ? '<div class="m328-dialog-actions"><button class="button secondary" type="button" data-m328-identity-relink>Zuordnung ändern</button><button class="button secondary" type="button" data-m328-identity-unlink>Verknüpfung lösen</button></div>'
      : '<button class="button secondary" type="button" data-m328-identity-link>Mit Portaluser verknüpfen</button>'}</section>` : ""}`;
  const dialog = openDialog({
    title: "Weitere Aktionen",
    kicker: `${registration.firstName} ${registration.lastName}`,
    body: body || '<p class="subtle">Keine weiteren Aktionen verfügbar.</p>'
  });
  dialog.querySelector("[data-m328-participant-cancel]")?.addEventListener("click", async () => {
    const confirmed = await confirmAction(
      "Diesen bestätigten oder wartenden Teilnehmer wirklich stornieren?",
      { danger: true, title: "Anmeldung stornieren", submitLabel: "Stornieren" }
    );
    if (!confirmed) return;
    try {
      await runWrite(() => call("fanbus_registration_cancel", {
        id: registration.id,
        expectedRevision: Number(registration.revision)
      }), "Fanbus-Anmeldung wurde storniert.");
      await state.refresh();
      closeAllDialogs();
    } catch (error) {
      showToast(error?.message || "Die Anmeldung konnte nicht storniert werden.", "error", 5200);
    }
  });
  dialog.querySelector("[data-m328-identity-link]")?.addEventListener("click", () => openIdentitySearch(state, registration, "LINK"));
  dialog.querySelector("[data-m328-identity-relink]")?.addEventListener("click", () => openIdentitySearch(state, registration, "RELINK"));
  dialog.querySelector("[data-m328-identity-unlink]")?.addEventListener("click", async () => {
    const confirmed = await confirmAction(
      "Portaluser-Verknüpfung lösen? Der zuletzt gespeicherte Name bleibt erhalten.",
      { title: "Portaluser-Verknüpfung lösen", submitLabel: "Verknüpfung lösen" }
    );
    if (!confirmed) return;
    try {
      await runWrite(() => call("fanbus_registration_identity_unlink", {
        registrationId: registration.id,
        expectedRevision: Number(registration.revision)
      }), "Portaluser-Verknüpfung gelöst.");
      await state.refresh();
      closeAllDialogs();
    } catch (error) {
      showToast(error?.message || "Verknüpfung konnte nicht gelöst werden.", "error", 5200);
    }
  });
}

function openIdentitySearch(state, registration, mode) {
  const dialog = openDialog({
    title: mode === "RELINK" ? "Portaluser-Zuordnung ändern" : "Mit Portaluser verknüpfen",
    kicker: `${registration.firstName} ${registration.lastName}`,
    body: `<form class="form-grid v4-smart-form" data-m328-identity-search-form>
      <label class="v4-field-full">Portaluser suchen<input name="query" type="search" minlength="5" maxlength="120" autocomplete="off" placeholder="Name oder Namensanfang, mindestens 5 Zeichen"></label>
      <p class="subtle v4-field-full" data-m328-identity-search-status>Mindestens 5 Zeichen eingeben.</p>
      <div class="v4-field-full m328-identity-search-results" data-m328-identity-search-results></div>
    </form>`,
  });
  const form = dialog.querySelector("[data-m328-identity-search-form]");
  const input = form?.elements.query;
  const status = dialog.querySelector("[data-m328-identity-search-status]");
  const results = dialog.querySelector("[data-m328-identity-search-results]");
  let timer = 0;
  let requestId = 0;
  input?.addEventListener("input", () => {
    clearTimeout(timer);
    const query = input.value.trim();
    requestId += 1;
    const current = requestId;
    results.replaceChildren();
    if (query.length < 5) {
      status.textContent = "Mindestens 5 Zeichen eingeben.";
      return;
    }
    status.textContent = "Suche läuft …";
    timer = setTimeout(async () => {
      try {
        const data = await call("fanbus_registration_identity_search", { query });
        if (current !== requestId || !dialog.open) return;
        const people = Array.isArray(data?.people) ? data.people.slice(0, 8) : [];
        status.textContent = people.length ? `${people.length} Treffer` : "Keine aktiven Portaluser gefunden.";
        results.innerHTML = people.map(person => `<button class="button secondary" type="button" data-m328-identity-choice="${escapeAttr(person.portalUserId)}">${escapeHtml(person.displayName)}</button>`).join("");
        results.querySelectorAll("[data-m328-identity-choice]").forEach(button => {
          button.addEventListener("click", async () => {
            const action = mode === "RELINK" ? "fanbus_registration_identity_relink" : "fanbus_registration_identity_link";
            try {
              await runWrite(() => call(action, {
                registrationId: registration.id,
                expectedRevision: Number(registration.revision),
                portalUserId: button.dataset.m328IdentityChoice
              }), mode === "RELINK" ? "Portaluser-Zuordnung geändert." : "Portaluser verknüpft.");
              await state.refresh();
              closeAllDialogs();
            } catch (error) {
              showToast(error?.message || "Portaluser konnte nicht verknüpft werden.", "error", 5200);
            }
          });
        });
      } catch (error) {
        if (current === requestId && dialog.open) status.textContent = error?.message || "Portalusersuche fehlgeschlagen.";
      }
    }, 300);
  });
  input?.focus();
}
