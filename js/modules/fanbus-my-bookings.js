import {
  call,
  confirmAction,
  escapeAttr,
  escapeHtml,
  openDialog,
  showToast
} from "./common.js";

const DATE_TIME = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

let myBookings = { bookings: [], organizationContact: { emails: [], phones: [] } };
let loaded = false;
let loadingPromise = null;

function dateTime(value, fallback = "Noch nicht festgelegt") {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? `${DATE_TIME.format(date)} Uhr` : fallback;
}

function participantStatus(value) {
  return { ACTIVE: "Angemeldet", WAITLISTED: "Warteliste", CANCELLED: "Storniert" }[value] || value || "–";
}

function tripStatus(value) {
  return { DRAFT: "Entwurf", PUBLISHED: "Veröffentlicht", CLOSED: "Geschlossen", CANCELLED: "Abgesagt" }[value] || value || "–";
}

function preference(value) {
  return { EGAL: "Egal", RUHIG: "Ruhiger Bus", PARTY: "Partybus" }[value] || "Egal";
}

function contactMarkup(contact = myBookings.organizationContact) {
  const items = [
    ...(Array.isArray(contact?.emails) ? contact.emails.map(item => ({ ...item, kind: "E-Mail" })) : []),
    ...(Array.isArray(contact?.phones) ? contact.phones.map(item => ({ ...item, kind: "Telefon" })) : [])
  ].filter(item => String(item?.value || "").trim());
  const list = items.length ? `<ul>${items.map(item => {
    const label = escapeHtml(item.label || item.kind);
    const value = escapeHtml(item.value);
    const href = item.kind === "E-Mail"
      ? `mailto:${escapeAttr(item.value)}`
      : `tel:${escapeAttr(String(item.value).replace(/[^+0-9]/g, ""))}`;
    return `<li><span>${label}</span><a href="${href}">${value}</a></li>`;
  }).join("")}</ul>` : "";
  return `<section class="m327-contact-block"><strong>BUS_ORGA kontaktieren</strong><p>Bitte wende dich für weitere Änderungen an unsere BUS_ORGA.</p>${list}</section>`;
}

function readOnlyText(reason) {
  return {
    DRAFT: "Die Fahrt wird aktuell bearbeitet. Online-Änderungen sind nicht möglich.",
    CLOSED: "Die Fahrt ist geschlossen. Online-Änderungen sind nicht möglich.",
    CANCELLED: "Die Fahrt wurde abgesagt.",
    CUTOFF: "Die Online-Änderungsfrist ist abgelaufen."
  }[reason] || "Diese Buchung ist aktuell nur lesbar.";
}

function participantMarkup(booking, participant) {
  const detailed = !participant.redacted;
  const canAct = booking.trip?.canMutate
    && ["ACTIVE", "WAITLISTED"].includes(participant.status)
    && (booking.isCreator || participant.isSelf);
  return `<article class="m327-participant${participant.redacted ? " is-redacted" : ""}">
    <header><div><strong>${escapeHtml(`${participant.firstName || ""} ${participant.lastName || ""}`.trim())}</strong>
      ${participant.isSelf ? '<span class="badge neutral">Du</span>' : ""}
      ${participant.bookingRole === "PRIMARY" ? '<span class="badge neutral">Hauptperson</span>' : ""}
    </div><span class="badge ${participant.status === "ACTIVE" ? "success" : participant.status === "WAITLISTED" ? "warning" : "neutral"}">${escapeHtml(participantStatus(participant.status))}</span></header>
    ${detailed ? `<dl class="m327-participant-details">
      <div><dt>Zustieg</dt><dd>${escapeHtml(participant.boardingStopLabel || "Noch nicht festgelegt")}</dd></div>
      <div><dt>Buswunsch</dt><dd>${escapeHtml(preference(participant.busPreference))}</dd></div>
      <div><dt>Zugewiesener Bus</dt><dd>${escapeHtml(participant.assignedBusLabel || "Noch nicht zugewiesen")}</dd></div>
      ${participant.status === "WAITLISTED" ? `<div><dt>Wartelistenplatz</dt><dd>${Number(participant.waitlistPosition) || "–"}</dd></div>` : ""}
    </dl>` : '<p class="subtle">Für mitgebuchte Personen werden nur Name und Status angezeigt.</p>'}
    ${canAct ? `<footer class="m327-participant-actions">
      <button class="button small secondary" type="button" data-m327-edit="${escapeAttr(participant.id)}">Zustieg / Buswunsch</button>
      <button class="button small ghost" type="button" data-m327-cancel="${escapeAttr(participant.id)}">Stornieren</button>
    </footer>` : ""}
  </article>`;
}

function bookingMarkup(booking) {
  const trip = booking.trip || {};
  const participants = Array.isArray(booking.participants) ? booking.participants : [];
  return `<article class="card m327-booking-card" data-m327-booking="${escapeAttr(booking.bookingId)}">
    <header class="m327-booking-head"><div><span class="m327-booking-kicker">${escapeHtml(dateTime(trip.departureAt))}</span>
      <h3>${escapeHtml(trip.title || "Fanbusfahrt")}</h3></div>
      <span class="badge ${trip.status === "PUBLISHED" ? "success" : trip.status === "CANCELLED" ? "danger" : "neutral"}">${escapeHtml(tripStatus(trip.status))}</span></header>
    <dl class="m327-booking-meta">
      <div><dt>Abfahrt</dt><dd>${escapeHtml(trip.departureInfo || dateTime(trip.departureAt))}</dd></div>
      <div><dt>Selfservice bis</dt><dd>${escapeHtml(dateTime(trip.selfServiceUntil))}</dd></div>
      <div><dt>Rolle</dt><dd>${booking.isCreator ? "Ersteller der Buchung" : "Mitgebuchte Person"}</dd></div>
    </dl>
    ${trip.canMutate ? "" : `<div class="notice warning m327-readonly-notice"><strong>Nur lesbar</strong><p>${escapeHtml(readOnlyText(trip.readOnlyReason))}</p>${contactMarkup()}</div>`}
    <section class="m327-participants" aria-label="Teilnehmer">${participants.map(item => participantMarkup(booking, item)).join("")}</section>
    ${booking.isCreator && trip.canMutate ? `<footer class="m327-booking-actions"><button class="button primary" type="button" data-m327-append="${escapeAttr(booking.bookingId)}">Mitfahrer hinzufügen</button></footer>` : ""}
  </article>`;
}

function render() {
  const target = document.getElementById("m327MyBookingsList");
  const summary = document.getElementById("m327MyBookingsSummary");
  const status = document.getElementById("m327MyBookingsStatus");
  if (!target) return;
  const bookings = Array.isArray(myBookings?.bookings) ? myBookings.bookings : [];
  const now = Date.now();
  const upcoming = bookings.filter(item => !item.trip?.departureAt || new Date(item.trip.departureAt).getTime() >= now);
  const history = bookings.filter(item => item.trip?.departureAt && new Date(item.trip.departureAt).getTime() < now);
  summary.textContent = bookings.length
    ? `${bookings.length} eigene ${bookings.length === 1 ? "Buchung" : "Buchungen"}`
    : "Noch keine eigenen Fanbus-Buchungen";
  status.textContent = "Aktuell";
  status.className = "status-pill success";
  target.innerHTML = bookings.length ? `
    <section class="m327-booking-group"><h3>Kommende Buchungen</h3>${upcoming.length ? upcoming.map(bookingMarkup).join("") : '<p class="subtle">Keine kommenden Buchungen.</p>'}</section>
    ${history.length ? `<details class="m327-booking-history"><summary>Vergangene Buchungen (${history.length})</summary><div class="m327-booking-group">${history.map(bookingMarkup).join("")}</div></details>` : ""}
  ` : '<div class="empty-state"><strong>Noch keine Buchung</strong><p>Deine eigenen Fanbus-Buchungen erscheinen hier – auch nach der Fahrt.</p></div>';
  bindActions(target);
}

async function load({ force = false } = {}) {
  if (loaded && !force) return render();
  if (loadingPromise) return loadingPromise;
  const target = document.getElementById("m327MyBookingsList");
  const status = document.getElementById("m327MyBookingsStatus");
  if (target) target.innerHTML = '<div class="loading-card card"><strong>Eigene Buchungen werden geladen …</strong></div>';
  if (status) status.textContent = "Lädt";
  loadingPromise = call("fanbus_my_bookings_list", {}).then(data => {
    myBookings = data || { bookings: [] };
    loaded = true;
    render();
  }).catch(error => {
    if (target) target.innerHTML = `<div class="notice error"><strong>Laden fehlgeschlagen</strong><p>${escapeHtml(error?.message || "Eigene Buchungen konnten nicht geladen werden.")}</p></div>`;
    if (status) { status.textContent = "Fehler"; status.className = "status-pill error"; }
  }).finally(() => { loadingPromise = null; });
  return loadingPromise;
}

function findBooking(id) {
  return (myBookings?.bookings || []).find(item => item.bookingId === id);
}

function findParticipant(id) {
  for (const booking of myBookings?.bookings || []) {
    const participant = (booking.participants || []).find(item => item.id === id);
    if (participant) return { booking, participant };
  }
  return {};
}

function stopOptions(booking, selected) {
  return (booking.trip?.boardingStops || []).map(stop =>
    `<option value="${escapeAttr(stop.id)}"${stop.id === selected ? " selected" : ""}>${escapeHtml(stop.label)} · ${escapeHtml(dateTime(stop.departureAt))}</option>`
  ).join("");
}

function preferenceOptions(booking, selected) {
  const allowed = booking.trip?.allowedBusPreferences?.length
    ? booking.trip.allowedBusPreferences
    : ["EGAL"];
  return allowed.map(value => `<option value="${value}"${value === selected ? " selected" : ""}>${escapeHtml(preference(value))}</option>`).join("");
}

function openEdit(participantId) {
  const { booking, participant } = findParticipant(participantId);
  if (!booking || !participant) return;
  openDialog({
    kicker: booking.trip?.title || "Fanbusfahrt",
    title: `${participant.firstName} ${participant.lastName} bearbeiten`,
    body: `<form class="form-grid m327-edit-form">
      <label class="full">Zustieg<select name="tripBoardingStopId" required>${stopOptions(booking, participant.tripBoardingStopId)}</select></label>
      <label class="full">Buswunsch<select name="busPreference" required>${preferenceOptions(booking, participant.busPreference)}</select></label>
      ${participant.assignedBusLabel ? `<div class="notice full"><strong>Vorhandene Buszuordnung: ${escapeHtml(participant.assignedBusLabel)}</strong><p>Eine Änderung des Buswunsches ändert diese Buszuordnung nicht automatisch.</p></div>` : ""}
    </form>`,
    submitLabel: "Änderung speichern",
    onSubmit: async values => {
      await call("fanbus_selfservice_participant_update", {
        participantId: participant.id,
        expectedRevision: Number(participant.revision),
        tripBoardingStopId: values.tripBoardingStopId,
        busPreference: values.busPreference
      });
      loaded = false;
      await load({ force: true });
      showToast("Teilnahme aktualisiert.", "success", 4200);
    }
  });
}

async function cancelParticipant(participantId) {
  const { participant } = findParticipant(participantId);
  if (!participant) return;
  const confirmed = await confirmAction(
    `${participant.firstName} ${participant.lastName} wirklich stornieren?`,
    { title: "Teilnahme stornieren", submitLabel: "Teilnahme stornieren", danger: true }
  );
  if (!confirmed) return;
  try {
    await call("fanbus_selfservice_participant_cancel", {
      participantId: participant.id,
      expectedRevision: Number(participant.revision)
    });
    loaded = false;
    await load({ force: true });
    showToast("Teilnahme storniert.", "success", 4200);
  } catch (error) {
    showToast(error?.message || "Die Teilnahme konnte nicht storniert werden.", "error", 5200);
  }
}

function guestRow(index, booking) {
  return `<fieldset class="m327-append-guest" data-m327-guest="${index}"><legend>Gast ${index + 1}</legend>
    <div class="form-grid"><label>Vorname<input name="guest_${index}_firstName" maxlength="160" required></label>
    <label>Nachname<input name="guest_${index}_lastName" maxlength="160" required></label>
    <label class="full">E-Mail (optional)<input name="guest_${index}_email" type="email" maxlength="320"></label>
    <label>Zustieg<select name="guest_${index}_tripBoardingStopId" required>${stopOptions(booking, "")}</select></label>
    <label>Buswunsch<select name="guest_${index}_busPreference">${preferenceOptions(booking, "EGAL")}</select></label></div>
    <button class="button small ghost" type="button" data-m327-remove-guest="${index}">Gast entfernen</button>
  </fieldset>`;
}

async function openAppend(bookingId) {
  const booking = findBooking(bookingId);
  if (!booking) return;
  let lists = [];
  try {
    const data = await call("fanbus_companion_lists_list", {});
    lists = Array.isArray(data?.lists) ? data.lists : [];
  } catch {
    lists = [];
  }
  let guestIndex = 0;
  let appendAttempt = null;
  const dialog = openDialog({
    kicker: booking.trip?.title || "Fanbusfahrt",
    title: "Mitfahrer hinzufügen",
    body: `<form class="m327-append-form">
      <section><h3>Aus Mitfahrerliste</h3>${lists.length ? lists.map(list => `<fieldset><legend>${escapeHtml(list.name)}</legend>${(list.members || []).map(member => `<label class="check-row"><input type="checkbox" name="template_${escapeAttr(member.id)}" data-template-member="${escapeAttr(member.id)}" data-list-id="${escapeAttr(list.id)}" data-display-name="${escapeAttr(`${member.firstName} ${member.lastName}`.trim())}"><span>${escapeHtml(`${member.firstName} ${member.lastName}`)}</span></label>`).join("") || '<p class="subtle">Liste ist leer.</p>'}</fieldset>`).join("") : '<p class="subtle">Keine gespeicherten Mitfahrer vorhanden.</p>'}</section>
      <section><div class="m327-append-heading"><h3>Gäste</h3><button class="button small secondary" type="button" data-m327-add-guest>Gast hinzufügen</button></div><div data-m327-guests></div></section>
      <div class="notice warning" data-m327-duplicate-preview hidden></div>
      <div class="notice"><strong>Hinweis</strong><p>Neue Teilnehmer bleiben in dieser bestehenden Buchung. Eine Buszuordnung erfolgt nicht automatisch.</p></div>
    </form>`,
    submitLabel: "Mitfahrer verbindlich hinzufügen",
    onSubmit: async () => {
      const form = dialog.querySelector("form");
      const templateControls = [...form.querySelectorAll("[data-template-member]:checked")];
      const guestCards = [...form.querySelectorAll("[data-m327-guest]")];
      const participants = [
        ...templateControls.map(control => ({
          templateMemberId: control.dataset.templateMember,
          busPreference: "EGAL"
        })),
        ...guestCards.map(card => {
          const index = card.dataset.m327Guest;
          return {
            firstName: form.elements.namedItem(`guest_${index}_firstName`)?.value.trim(),
            lastName: form.elements.namedItem(`guest_${index}_lastName`)?.value.trim(),
            email: form.elements.namedItem(`guest_${index}_email`)?.value.trim() || undefined,
            tripBoardingStopId: form.elements.namedItem(`guest_${index}_tripBoardingStopId`)?.value,
            busPreference: form.elements.namedItem(`guest_${index}_busPreference`)?.value || "EGAL"
          };
        })
      ];
      if (!participants.length) throw new Error("Wähle mindestens einen Mitfahrer oder füge einen Gast hinzu.");
      if (participants.length > 19) throw new Error("In einem Vorgang sind höchstens 19 neue Teilnehmer möglich.");
      if (templateControls.length) {
        const previewBox = form.querySelector("[data-m327-duplicate-preview]");
        const preview = await call("fanbus_companion_duplicate_preview", {
          tripId: booking.tripId,
          participants: templateControls.map(control => ({
            templateMemberId: control.dataset.templateMember
          }))
        });
        const conflicts = (Array.isArray(preview?.members) ? preview.members : [])
          .map((item, index) => ({ item, control: templateControls[index] }))
          .filter(({ item }) => item?.status !== "READY");
        if (conflicts.length) {
          const labels = {
            ALREADY_REGISTERED: "bereits für diese Fahrt angemeldet",
            CONFLICT: "steht im Konflikt mit einer bestehenden Auswahl",
            UNAVAILABLE: "aktuell nicht buchbar"
          };
          previewBox.hidden = false;
          previewBox.innerHTML = `<strong>Auswahl bitte prüfen</strong><ul>${conflicts.map(({ item, control }) => `<li>${escapeHtml(control?.dataset.displayName || "Mitfahrer")}: ${escapeHtml(labels[item.status] || "nicht buchbar")}</li>`).join("")}</ul>`;
          throw new Error("Die Auswahl enthält bereits angemeldete oder nicht buchbare Personen.");
        }
        previewBox.hidden = true;
        previewBox.replaceChildren();
      }
      const fingerprint = JSON.stringify(participants);
      if (appendAttempt?.fingerprint !== fingerprint) {
        appendAttempt = { fingerprint, idempotencyKey: crypto.randomUUID() };
      }
      const result = await call("fanbus_selfservice_booking_append", {
        bookingId: booking.bookingId,
        idempotencyKey: appendAttempt.idempotencyKey,
        participants
      });
      loaded = false;
      await load({ force: true });
      showToast(
        result?.status === "WAITLISTED"
          ? `${result.participantCount} Teilnehmer wurden gemeinsam auf die Warteliste gesetzt.`
          : `${result?.participantCount || participants.length} Teilnehmer wurden erfolgreich hinzugefügt.`,
        result?.status === "WAITLISTED" ? "warning" : "success",
        5200
      );
    }
  });
  const guests = dialog.querySelector("[data-m327-guests]");
  const bindRemove = () => guests.querySelectorAll("[data-m327-remove-guest]").forEach(button => {
    button.onclick = () => button.closest("[data-m327-guest]")?.remove();
  });
  dialog.querySelector("[data-m327-add-guest]")?.addEventListener("click", () => {
    guests.insertAdjacentHTML("beforeend", guestRow(guestIndex++, booking));
    bindRemove();
  });
}

function bindActions(target) {
  target.querySelectorAll("[data-m327-edit]").forEach(button =>
    button.addEventListener("click", () => openEdit(button.dataset.m327Edit)));
  target.querySelectorAll("[data-m327-cancel]").forEach(button =>
    button.addEventListener("click", () => void cancelParticipant(button.dataset.m327Cancel)));
  target.querySelectorAll("[data-m327-append]").forEach(button =>
    button.addEventListener("click", () => void openAppend(button.dataset.m327Append)));
}

export function setupFanbusMyBookings() {
  const tripsTab = document.getElementById("m327TripsTab");
  const bookingsTab = document.getElementById("m327MyBookingsTab");
  const tripsPanel = document.getElementById("m327TripsPanel");
  const bookingsPanel = document.getElementById("m327MyBookingsPanel");
  if (!tripsTab || !bookingsTab || tripsTab.dataset.m327Bound === "true") return;
  tripsTab.dataset.m327Bound = "true";
  const activate = my => {
    tripsTab.classList.toggle("active", !my);
    bookingsTab.classList.toggle("active", my);
    tripsTab.setAttribute("aria-selected", String(!my));
    bookingsTab.setAttribute("aria-selected", String(my));
    tripsPanel.hidden = my;
    bookingsPanel.hidden = !my;
    if (my) void load();
  };
  tripsTab.addEventListener("click", () => activate(false));
  bookingsTab.addEventListener("click", () => activate(true));
  if (new URLSearchParams(window.location.hash.split("?")[1] || "").has("myBookings")) activate(true);
}
