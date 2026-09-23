import {
  call,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  loading,
  runWrite,
  showToast
} from "./common.js";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

let currentContext = null;
let currentRoot = null;
let detailSnapshot = null;
let searchTimer = null;

function clearPredictionToasts() {
  document.querySelectorAll("#toastRegion .toast[data-prediction-toast]").forEach(toast => toast.remove());
}

function markPredictionToast(duration = 2200) {
  const toasts = document.querySelectorAll("#toastRegion .toast");
  const toast = toasts[toasts.length - 1];
  if (!toast) return;
  toast.dataset.predictionToast = "";
  window.setTimeout(() => toast.remove(), duration);
}

async function runPredictionWrite(operation, successMessage, duration = 2200) {
  clearPredictionToasts();
  const result = await runWrite(operation, successMessage);
  markPredictionToast(duration);
  return result;
}

function showPredictionToast(message, type = "info", duration = 3200) {
  clearPredictionToasts();
  showToast(message, type, duration);
  markPredictionToast(duration);
}

function params() {
  const hash = String(location.hash || "");
  return new URLSearchParams(hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "");
}

function predictionUrl(extra = {}) {
  const query = new URLSearchParams({ view: "prediction", ...extra });
  return `#/bus-orga?${query}`;
}

function formatDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return String(value || "Termin offen");
  return DATE_FORMAT.format(new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

function formatTime(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ""));
  return match ? `${match[1]}:${match[2]} Uhr` : "Uhrzeit offen";
}

function statusLabel(status) {
  return { OPEN: "Offen", CLOSED: "Geschlossen", EVALUATED: "Beendet" }[status] || status;
}

function statusClass(status) {
  return status === "OPEN" ? "success" : status === "CLOSED" ? "warning" : "neutral";
}

function modeLabel(mode) {
  return mode === "TRIP" ? "Fanbusfahrt" : "Manuell";
}

function shell(content, title = "Tippspiel") {
  return `<div class="pd-prediction-page">
    <header class="pd-prediction-head">
      <button class="button small ghost" type="button" data-prediction-back>← Bus-Orga</button>
      <div><span>Bus-Orga</span><h2>${escapeHtml(title)}</h2></div>
    </header>
    ${content}
  </div>`;
}

function bindBack(target = "#/bus-orga") {
  currentRoot?.querySelector("[data-prediction-back]")?.addEventListener("click", () => {
    location.hash = target;
  });
}

function listCard(game) {
  const evaluated = game.status === "EVALUATED";
  const result = evaluated ? `${game.dogsGoals}:${game.opponentGoals}` : modeLabel(game.mode);
  return `<article class="pd-prediction-list-card">
    <button type="button" data-prediction-open="${escapeAttr(game.id)}">
      <span class="pd-prediction-list-main">
        <span class="pd-prediction-eyebrow">${escapeHtml(formatDate(game.eventDate))} · ${escapeHtml(result)}</span>
        <strong>${escapeHtml(game.displayTitle)}</strong>
        <small>${Number(game.participantCount || 0)} Teilnehmer · ${Number(game.tipCount || 0)} Tipps${evaluated ? ` · ${Number(game.winnerCount || 0)} Gewinner` : ""}</small>
      </span>
      <span class="pd-prediction-list-side"><span class="badge ${statusClass(game.status)}">${escapeHtml(statusLabel(game.status))}</span><span aria-hidden="true">›</span></span>
    </button>
  </article>`;
}

async function renderList() {
  currentRoot.innerHTML = shell(`<section class="pd-prediction-toolbar">
    <div><span class="pd-prediction-eyebrow">Alle Spiele</span><h3>Tippspiele</h3></div>
    <button class="button primary" type="button" data-prediction-new>＋ Tippspiel</button>
  </section>
  <section data-prediction-create hidden></section>
  <section class="pd-prediction-list" data-prediction-list>${loading("Tippspiele werden geladen …")}</section>`);
  bindBack();
  const target = currentRoot.querySelector("[data-prediction-list]");
  try {
    const data = await call("fanbus_prediction_games_list");
    if (currentContext?.isCurrent && !currentContext.isCurrent()) return;
    const games = Array.isArray(data?.games) ? data.games : [];
    target.innerHTML = games.length ? games.map(listCard).join("") : empty("Noch kein Tippspiel angelegt.");
    target.querySelectorAll("[data-prediction-open]").forEach(button => {
      button.addEventListener("click", () => {
        location.hash = predictionUrl({ game: button.dataset.predictionOpen, screen: "capture" });
      });
    });
  } catch (error) {
    target.innerHTML = errorPanel(error, "Tippspiele konnten nicht geladen werden");
  }
  currentRoot.querySelector("[data-prediction-new]")?.addEventListener("click", renderCreate);
}

function gameOption(game) {
  const disabled = game.hasPredictionGame ? " disabled" : "";
  const suffix = game.hasPredictionGame ? " · bereits angelegt" : "";
  return `<option value="${escapeAttr(game.id)}"${disabled}>${escapeHtml(`${formatDate(game.eventDate)} · ${game.displayTitle}${suffix}`)}</option>`;
}

async function renderCreate() {
  const host = currentRoot.querySelector("[data-prediction-create]");
  if (!host) return;
  host.hidden = false;
  host.innerHTML = loading("Kalenderspiele werden geladen …");
  try {
    const data = await call("fanbus_prediction_options");
    const games = (Array.isArray(data?.games) ? data.games : []).filter(game => !game.hasPredictionGame);
    if (!games.length) {
      host.innerHTML = '<div class="notice">Für alle verfügbaren Kalenderspiele existiert bereits ein Tippspiel.</div>';
      return;
    }
    host.innerHTML = `<form class="pd-prediction-create-form" data-prediction-create-form novalidate>
      <div class="pd-prediction-section-head"><div><span class="pd-prediction-eyebrow">Neu</span><h3>Tippspiel anlegen</h3></div><button class="button small ghost" type="button" data-prediction-create-cancel>Schließen</button></div>
      <label>Spiel<select name="eventId" required>${games.map(gameOption).join("")}</select></label>
      <fieldset><legend>Modus</legend><div class="pd-prediction-mode-options">
        <label><input type="radio" name="mode" value="TRIP"> Fahrt verwenden</label>
        <label><input type="radio" name="mode" value="MANUAL"> Manuell</label>
      </div></fieldset>
      <label data-prediction-trip-field>Fahrt<select name="tripId"></select></label>
      <p class="pd-prediction-inline-error" data-prediction-create-error role="alert" hidden></p>
      <button class="button primary pd-prediction-main-action" type="submit">Tippspiel anlegen</button>
    </form>`;
    const form = host.querySelector("[data-prediction-create-form]");
    const eventSelect = form.elements.eventId;
    const tripSelect = form.elements.tripId;
    const tripField = host.querySelector("[data-prediction-trip-field]");
    const sync = () => {
      const game = games.find(item => item.id === eventSelect.value) || games[0];
      const trips = Array.isArray(game?.trips) ? game.trips : [];
      tripSelect.innerHTML = trips.map(trip => `<option value="${escapeAttr(trip.id)}">${escapeHtml(`${trip.label} · ${trip.status}`)}</option>`).join("");
      const tripRadio = form.querySelector('input[value="TRIP"]');
      const manualRadio = form.querySelector('input[value="MANUAL"]');
      tripRadio.disabled = !trips.length;
      if (trips.length) tripRadio.checked = true;
      else manualRadio.checked = true;
      tripField.hidden = !trips.length;
    };
    sync();
    eventSelect.addEventListener("change", sync);
    form.querySelectorAll('input[name="mode"]').forEach(input => input.addEventListener("change", () => {
      tripField.hidden = input.value === "MANUAL" && input.checked;
    }));
    host.querySelector("[data-prediction-create-cancel]").addEventListener("click", () => {
      host.hidden = true;
      host.replaceChildren();
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const errorNode = form.querySelector("[data-prediction-create-error]");
      const mode = form.querySelector('input[name="mode"]:checked')?.value || "MANUAL";
      submit.disabled = true;
      errorNode.hidden = true;
      try {
        const game = await runPredictionWrite(() => call("fanbus_prediction_game_create", {
          eventId: eventSelect.value,
          mode,
          tripId: mode === "TRIP" ? tripSelect.value : null
        }), "Tippspiel wurde angelegt.");
        location.hash = predictionUrl({ game: game.id, screen: "capture" });
      } catch (error) {
        errorNode.textContent = error?.message || "Tippspiel konnte nicht angelegt werden.";
        errorNode.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });
  } catch (error) {
    host.innerHTML = errorPanel(error, "Kalenderspiele konnten nicht geladen werden");
  }
}

function gameHeader(game, screen) {
  const screens = [
    ["capture", "Erfassen"],
    ["overview", "Übersicht"],
    ["evaluation", "Auswertung"]
  ];
  return `<section class="pd-prediction-game-head">
    <div class="pd-prediction-game-title"><span>${escapeHtml(formatDate(game.eventDate))} · ${escapeHtml(formatTime(game.eventTime))}</span><h3>${escapeHtml(game.displayTitle)}</h3><small>${escapeHtml(modeLabel(game.mode))}${game.mode === "TRIP" && game.tripLabel ? ` · ${escapeHtml(game.tripLabel)}` : ""}</small></div>
    <span class="badge ${statusClass(game.status)}">${escapeHtml(statusLabel(game.status))}</span>
  </section>
  <nav class="pd-prediction-tabs" aria-label="Tippspiel-Ansicht">${screens.map(([key, label]) => `<button type="button" class="${screen === key ? "is-active" : ""}" data-prediction-screen="${key}">${label}</button>`).join("")}</nav>`;
}

function bindGameNavigation(game) {
  bindBack(predictionUrl());
  currentRoot.querySelectorAll("[data-prediction-screen]").forEach(button => {
    button.addEventListener("click", () => {
      location.hash = predictionUrl({ game: game.id, screen: button.dataset.predictionScreen });
    });
  });
}

async function loadDetail(gameId) {
  detailSnapshot = await call("fanbus_prediction_game_detail", { gameId });
  return detailSnapshot;
}

function tipRows(tips = [], disabled = false) {
  const map = new Map((tips || []).map(tip => [Number(tip.number), tip]));
  return [1, 2, 3].map(number => {
    const tip = map.get(number) || {};
    return `<div class="pd-prediction-tip-row" data-tip-row="${number}">
      <span>Tipp ${number}${number === 1 ? " *" : ""}</span>
      <strong>Dogs</strong>
      <input name="dogs${number}" type="number" min="0" max="99" step="1" inputmode="numeric" autocomplete="off" aria-label="Dogs Tore Tipp ${number}" value="${tip.dogsGoals ?? ""}"${disabled ? " disabled" : ""}>
      <b aria-hidden="true">:</b>
      <input name="opponent${number}" type="number" min="0" max="99" step="1" inputmode="numeric" autocomplete="off" aria-label="Gegner Tore Tipp ${number}" value="${tip.opponentGoals ?? ""}"${disabled ? " disabled" : ""}>
      <strong>Gegner</strong>
      <small class="pd-prediction-field-error" data-tip-error></small>
    </div>`;
  }).join("");
}

function readTips(form) {
  const tips = [];
  let valid = true;
  const seen = new Set();
  form.querySelectorAll("[data-tip-row]").forEach((row, index) => {
    const dogs = row.querySelector(`[name="dogs${index + 1}"]`);
    const opponent = row.querySelector(`[name="opponent${index + 1}"]`);
    const error = row.querySelector("[data-tip-error]");
    error.textContent = "";
    row.classList.remove("has-error");
    const dogsRaw = dogs.value.trim();
    const opponentRaw = opponent.value.trim();
    if (!dogsRaw && !opponentRaw) {
      if (index === 0) {
        error.textContent = "Tipp 1 ist erforderlich.";
        row.classList.add("has-error");
        valid = false;
      }
      return;
    }
    const dogsGoals = Number(dogsRaw);
    const opponentGoals = Number(opponentRaw);
    if (!dogsRaw || !opponentRaw || !Number.isInteger(dogsGoals) || !Number.isInteger(opponentGoals) || dogsGoals < 0 || opponentGoals < 0 || dogsGoals > 99 || opponentGoals > 99) {
      error.textContent = "Beide Tore als ganze Zahl von 0 bis 99 eingeben.";
      row.classList.add("has-error");
      valid = false;
      return;
    }
    const key = `${dogsGoals}:${opponentGoals}`;
    if (seen.has(key)) {
      error.textContent = "Dieser Tipp ist bereits vorhanden.";
      row.classList.add("has-error");
      valid = false;
      return;
    }
    seen.add(key);
    tips.push({ dogsGoals, opponentGoals });
  });
  return valid ? tips : null;
}

function entryEditor(game, entry = {}, { manual = false } = {}) {
  const closed = game.status !== "OPEN";
  return `<form class="pd-prediction-entry-form" data-prediction-entry-form novalidate>
    <input type="hidden" name="participantId" value="${escapeAttr(entry.entryId || entry.id || "")}">
    <input type="hidden" name="registrationId" value="${escapeAttr(entry.registrationId || "")}">
    <input type="hidden" name="expectedRevision" value="${escapeAttr(entry.revision ?? "")}">
    <header><div><span class="pd-prediction-eyebrow">${manual ? "Person" : "Ausgewählt"}</span><h3>${escapeHtml(entry.name || "Neue Person")}</h3>${!manual ? `<small>${escapeHtml(entry.busLabel || "Noch keinem Bus zugeordnet")}</small>` : ""}</div><button class="button small ghost" type="button" data-prediction-entry-cancel>Abbrechen</button></header>
    ${manual ? `<label class="pd-prediction-name-field">Name<input name="manualName" type="text" maxlength="160" autocomplete="off" value="${escapeAttr(entry.name || "")}"${closed ? " disabled" : ""}><small data-name-error></small></label>` : ""}
    <div class="pd-prediction-tip-grid">${tipRows(entry.tips, closed)}</div>
    <p class="pd-prediction-inline-error" data-entry-error role="alert" hidden></p>
    ${closed ? '<div class="notice warning">Dieses Tippspiel ist geschlossen. Zum Ändern zuerst wieder öffnen.</div>' : '<button class="button primary pd-prediction-main-action" type="submit">Speichern</button>'}
  </form>`;
}

function participantResult(item) {
  const done = Number(item.tipCount || 0) > 0;
  return `<button class="pd-prediction-person-row${done ? " is-done" : ""}" type="button" data-prediction-person="${escapeAttr(item.registrationId)}">
    <span class="pd-prediction-person-state" aria-hidden="true">${done ? "✓" : ""}</span>
    <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.busLabel || "Ohne Bus")} · ${done ? `${Number(item.tipCount)} ${Number(item.tipCount) === 1 ? "Tipp" : "Tipps"}` : "noch kein Tipp"}</small></span>
    <span aria-hidden="true">›</span>
  </button>`;
}

async function searchParticipants(game, query = "") {
  const results = currentRoot.querySelector("[data-prediction-search-results]");
  if (!results) return;
  results.setAttribute("aria-busy", "true");
  try {
    const data = await call("fanbus_prediction_participants_search", { gameId: game.id, query });
    const people = Array.isArray(data?.participants) ? data.participants : [];
    results.innerHTML = people.length ? people.map(participantResult).join("") : empty("Keine passenden Fahrtteilnehmer gefunden.");
    results.querySelectorAll("[data-prediction-person]").forEach(button => {
      button.addEventListener("click", () => {
        const person = people.find(item => item.registrationId === button.dataset.predictionPerson);
        openEntryEditor(game, person, { manual: false });
      });
    });
  } catch (error) {
    results.innerHTML = errorPanel(error, "Teilnehmer konnten nicht geladen werden");
  } finally {
    results.removeAttribute("aria-busy");
  }
}

function bindEntryForm(game, entry, { manual = false } = {}) {
  const editor = currentRoot.querySelector("[data-prediction-editor]");
  const form = editor?.querySelector("[data-prediction-entry-form]");
  if (!form) return;
  form.querySelector("[data-prediction-entry-cancel]")?.addEventListener("click", () => {
    editor.hidden = true;
    editor.replaceChildren();
    currentRoot.querySelector("[data-prediction-search]")?.focus({ preventScroll: true });
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const tips = readTips(form);
    const errorNode = form.querySelector("[data-entry-error]");
    const manualName = manual ? form.elements.manualName.value.trim() : null;
    if (manual && !manualName) {
      form.querySelector("[data-name-error]").textContent = "Name ist erforderlich.";
      form.elements.manualName.focus();
      return;
    }
    if (!tips) return;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    errorNode.hidden = true;
    try {
      await runPredictionWrite(() => call("fanbus_prediction_entry_save", {
        gameId: game.id,
        participantId: form.elements.participantId.value || null,
        registrationId: form.elements.registrationId.value || null,
        expectedRevision: form.elements.expectedRevision.value || null,
        manualName,
        tips
      }), "Tipps gespeichert.", 1800);
      editor.hidden = true;
      editor.replaceChildren();
      detailSnapshot = await loadDetail(game.id);
      if (manual) {
        renderManualCapture(detailSnapshot.game, detailSnapshot.entries);
      } else {
        const search = currentRoot.querySelector("[data-prediction-search]");
        await searchParticipants(game, search?.value || "");
        search?.focus({ preventScroll: true });
        search?.select();
      }
    } catch (error) {
      errorNode.textContent = error?.message || "Tipps konnten nicht gespeichert werden.";
      errorNode.hidden = false;
      if (["PT409", "40001"].includes(error?.code)) {
        showPredictionToast("Der Eintrag wurde auf einem anderen Gerät geändert. Die aktuelle Version wird neu geladen.", "warning", 4200);
        detailSnapshot = await loadDetail(game.id).catch(() => detailSnapshot);
        const latestEntries = Array.isArray(detailSnapshot?.entries) ? detailSnapshot.entries : [];
        const latestEntry = latestEntries.find(item => (
          item.id === form.elements.participantId.value
          || item.registrationId === form.elements.registrationId.value
        ));
        if (manual) renderManualCapture(detailSnapshot.game, latestEntries);
        else renderTripCapture(detailSnapshot.game);
        if (latestEntry) openEntryEditor(detailSnapshot.game, latestEntry, { manual });
      }
    } finally {
      submit.disabled = false;
    }
  });
}

function openEntryEditor(game, entry, options) {
  const editor = currentRoot.querySelector("[data-prediction-editor]");
  editor.hidden = false;
  editor.innerHTML = entryEditor(game, entry, options);
  bindEntryForm(game, entry, options);
  requestAnimationFrame(() => {
    const target = options.manual ? editor.querySelector('[name="manualName"]') : editor.querySelector('[name="dogs1"]');
    target?.focus({ preventScroll: false });
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function entryListRow(entry) {
  return `<button class="pd-prediction-person-row is-done" type="button" data-prediction-entry="${escapeAttr(entry.id)}">
    <span class="pd-prediction-person-state" aria-hidden="true">✓</span><span><strong>${escapeHtml(entry.name)}</strong><small>${entry.busLabel ? `${escapeHtml(entry.busLabel)} · ` : ""}${Number(entry.tipCount)} ${Number(entry.tipCount) === 1 ? "Tipp" : "Tipps"}</small></span><span aria-hidden="true">›</span>
  </button>`;
}

function renderManualCapture(game, entries) {
  const capture = currentRoot.querySelector("[data-prediction-capture]");
  capture.innerHTML = `<section class="pd-prediction-capture-actions"><button class="button primary pd-prediction-main-action" type="button" data-prediction-manual-new${game.status !== "OPEN" ? " disabled" : ""}>＋ Person erfassen</button></section>
    <section data-prediction-editor hidden></section>
    <section class="pd-prediction-saved-list"><div class="pd-prediction-section-head"><div><span class="pd-prediction-eyebrow">Gespeichert</span><h3>${entries.length} Teilnehmer</h3></div></div><div>${entries.length ? entries.map(entryListRow).join("") : empty("Noch keine Tipps erfasst.")}</div></section>`;
  capture.querySelector("[data-prediction-manual-new]")?.addEventListener("click", () => openEntryEditor(game, {}, { manual: true }));
  capture.querySelectorAll("[data-prediction-entry]").forEach(button => {
    button.addEventListener("click", () => {
      const entry = entries.find(item => item.id === button.dataset.predictionEntry);
      openEntryEditor(game, entry, { manual: true });
    });
  });
}

function renderTripCapture(game) {
  const capture = currentRoot.querySelector("[data-prediction-capture]");
  capture.innerHTML = `<section class="pd-prediction-search-panel">
    <label for="pdPredictionSearch">Teilnehmer suchen …</label>
    <input id="pdPredictionSearch" data-prediction-search type="search" autocomplete="off" enterkeyhint="search" placeholder="Name eingeben …">
    <div class="pd-prediction-search-results" data-prediction-search-results aria-live="polite"></div>
  </section><section data-prediction-editor hidden></section>`;
  const search = capture.querySelector("[data-prediction-search]");
  search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => searchParticipants(game, search.value), 180);
  });
  searchParticipants(game, "");
  requestAnimationFrame(() => search.focus({ preventScroll: true }));
}

async function setStatus(game, status, button) {
  button.disabled = true;
  try {
    await runPredictionWrite(() => call("fanbus_prediction_status_set", {
      gameId: game.id,
      expectedRevision: game.revision,
      status
    }), status === "OPEN" ? "Tippspiel wieder geöffnet." : "Tippspiel geschlossen.");
    await renderGame(game.id, params().get("screen") || "capture");
  } catch (error) {
    showPredictionToast(error?.message || "Status konnte nicht geändert werden.", "error", 4200);
  } finally {
    button.disabled = false;
  }
}

function statusAction(game) {
  if (game.status === "EVALUATED") return "";
  const next = game.status === "OPEN" ? "CLOSED" : "OPEN";
  const label = game.status === "OPEN" ? "Tippspiel schließen" : "Tippspiel wieder öffnen";
  return `<button class="button ${game.status === "OPEN" ? "secondary" : "primary"}" type="button" data-prediction-status="${next}">${label}</button>`;
}

function overviewContent(game, entries) {
  return `<section class="pd-prediction-metrics"><span><strong>${Number(game.participantCount || 0)}</strong>Teilnehmer</span><span><strong>${Number(game.tipCount || 0)}</strong>Tipps</span><span><strong>${Number(game.winnerCount || 0)}</strong>Gewinner</span></section>
    <section class="pd-prediction-status-action">${statusAction(game)}</section>
    <section class="pd-prediction-saved-list"><div class="pd-prediction-section-head"><div><span class="pd-prediction-eyebrow">Erfasst</span><h3>Teilnehmer</h3></div></div><div>${entries.length ? entries.map(entryListRow).join("") : empty("Noch keine Tipps erfasst.")}</div></section>`;
}

function winnersList(winners) {
  return winners?.length ? `<div class="pd-prediction-winners">${winners.map(winner => `<div><span aria-hidden="true">✓</span><strong>${escapeHtml(winner.name)}</strong>${winner.busLabel ? `<small>${escapeHtml(winner.busLabel)}</small>` : ""}<b>${winner.tip.dogsGoals}:${winner.tip.opponentGoals}</b></div>`).join("")}</div>` : empty("Keine Gewinner für dieses Ergebnis.");
}

async function renderEvaluation(game) {
  const host = currentRoot.querySelector("[data-prediction-evaluation]");
  if (game.status === "OPEN") {
    host.innerHTML = '<div class="notice warning">Tippspiel zuerst schließen, bevor das Endergebnis erfasst wird.</div>';
    return;
  }
  if (game.status === "CLOSED") {
    const suggested = game.suggestedResult;
    host.innerHTML = `<form class="pd-prediction-result-form" data-prediction-result-form novalidate>
      <div class="pd-prediction-section-head"><div><span class="pd-prediction-eyebrow">Endergebnis</span><h3>Dogs zuerst</h3></div></div>
      ${suggested ? `<button class="button secondary" type="button" data-prediction-use-result>Liveticker übernehmen: ${Number(suggested.dogsGoals)}:${Number(suggested.opponentGoals)}</button>` : ""}
      <div class="pd-prediction-result-inputs"><strong>Dogs</strong><input name="dogsGoals" type="number" min="0" max="99" step="1" inputmode="numeric" required><b>:</b><input name="opponentGoals" type="number" min="0" max="99" step="1" inputmode="numeric" required><strong>Gegner</strong></div>
      <p class="pd-prediction-inline-error" data-result-error role="alert" hidden></p>
      <button class="button primary pd-prediction-main-action" type="submit">Ergebnis speichern & auswerten</button>
    </form>`;
    const form = host.querySelector("[data-prediction-result-form]");
    host.querySelector("[data-prediction-use-result]")?.addEventListener("click", () => {
      form.elements.dogsGoals.value = suggested.dogsGoals;
      form.elements.opponentGoals.value = suggested.opponentGoals;
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const dogsGoals = Number(form.elements.dogsGoals.value);
      const opponentGoals = Number(form.elements.opponentGoals.value);
      const errorNode = form.querySelector("[data-result-error]");
      if (!Number.isInteger(dogsGoals) || !Number.isInteger(opponentGoals) || dogsGoals < 0 || opponentGoals < 0 || dogsGoals > 99 || opponentGoals > 99) {
        errorNode.textContent = "Bitte beide Endstände als ganze Zahl von 0 bis 99 eingeben.";
        errorNode.hidden = false;
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        await runPredictionWrite(() => call("fanbus_prediction_result_set", {
          gameId: game.id,
          expectedRevision: game.revision,
          dogsGoals,
          opponentGoals
        }), "Tippspiel wurde ausgewertet.");
        await renderGame(game.id, "evaluation");
      } catch (error) {
        errorNode.textContent = error?.message || "Endergebnis konnte nicht gespeichert werden.";
        errorNode.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });
    return;
  }
  host.innerHTML = loading("Auswertung wird geladen …");
  try {
    const data = await call("fanbus_prediction_evaluation", { gameId: game.id });
    const overall = data?.overall || {};
    const buses = Array.isArray(data?.buses) ? data.buses : [];
    host.innerHTML = `<section class="pd-prediction-result-banner"><span>Endstand</span><strong>Dogs ${Number(game.dogsGoals)} : ${Number(game.opponentGoals)} Gegner</strong></section>
      <section class="pd-prediction-metrics"><span><strong>${Number(overall.participantCount || 0)}</strong>Teilnehmer</span><span><strong>${Number(overall.tipCount || 0)}</strong>Tipps</span><span><strong>${Number(overall.winnerCount || 0)}</strong>Gewinner</span></section>
      ${game.mode === "TRIP" && buses.length ? `<div class="pd-prediction-bus-tabs" role="tablist"><button class="is-active" type="button" data-bus-tab="overall">Gesamt</button>${buses.map((bus, index) => `<button type="button" data-bus-tab="${index}">${escapeHtml(bus.busLabel)}</button>`).join("")}</div>` : ""}
      <section data-bus-panel>${winnersList(overall.winners)}</section>`;
    const panel = host.querySelector("[data-bus-panel]");
    host.querySelectorAll("[data-bus-tab]").forEach(button => button.addEventListener("click", () => {
      host.querySelectorAll("[data-bus-tab]").forEach(item => item.classList.toggle("is-active", item === button));
      if (button.dataset.busTab === "overall") {
        panel.innerHTML = winnersList(overall.winners);
        return;
      }
      const bus = buses[Number(button.dataset.busTab)];
      panel.innerHTML = `<section class="pd-prediction-metrics is-bus"><span><strong>${Number(bus.participantCount || 0)}</strong>Teilnehmer</span><span><strong>${Number(bus.tipCount || 0)}</strong>Tipps</span><span><strong>${Number(bus.winnerCount || 0)}</strong>Gewinner</span></section>${winnersList(bus.winners)}`;
    }));
  } catch (error) {
    host.innerHTML = errorPanel(error, "Auswertung konnte nicht geladen werden");
  }
}

async function renderGame(gameId, screen = "capture") {
  currentRoot.innerHTML = shell(loading("Tippspiel wird geladen …"));
  bindBack(predictionUrl());
  try {
    const data = await loadDetail(gameId);
    if (currentContext?.isCurrent && !currentContext.isCurrent()) return;
    const game = data.game;
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const section = ["capture", "overview", "evaluation"].includes(screen) ? screen : "capture";
    currentRoot.innerHTML = shell(`${gameHeader(game, section)}<main data-prediction-capture ${section === "capture" ? "" : "hidden"}></main><main data-prediction-overview ${section === "overview" ? "" : "hidden"}></main><main data-prediction-evaluation ${section === "evaluation" ? "" : "hidden"}></main>`, "Tippspiel");
    bindGameNavigation(game);
    if (section === "capture") {
      if (game.mode === "TRIP") renderTripCapture(game);
      else renderManualCapture(game, entries);
      const requestedEntry = params().get("entry");
      const entry = requestedEntry ? entries.find(item => item.id === requestedEntry) : null;
      if (entry) openEntryEditor(game, entry, { manual: game.mode === "MANUAL" });
    } else if (section === "overview") {
      const host = currentRoot.querySelector("[data-prediction-overview]");
      host.innerHTML = overviewContent(game, entries);
      host.querySelector("[data-prediction-status]")?.addEventListener("click", event => setStatus(game, event.currentTarget.dataset.predictionStatus, event.currentTarget));
      host.querySelectorAll("[data-prediction-entry]").forEach(button => button.addEventListener("click", () => {
        location.hash = predictionUrl({ game: game.id, screen: "capture", entry: button.dataset.predictionEntry });
      }));
    } else {
      await renderEvaluation(game);
    }
  } catch (error) {
    currentRoot.innerHTML = shell(errorPanel(error, "Tippspiel konnte nicht geladen werden"));
    bindBack(predictionUrl());
  }
}

export async function hydrateBusOrgaPrediction(context = {}) {
  currentContext = context;
  currentRoot = document.getElementById("m328BusOrgaPage");
  if (!currentRoot) return;
  const route = params();
  const gameId = route.get("game");
  if (gameId) return renderGame(gameId, route.get("screen") || "capture");
  return renderList();
}

export function noop() {}
