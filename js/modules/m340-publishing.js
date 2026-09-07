import {
  call,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  hasCapability,
  runWrite,
  showToast
} from "./common.js";

export const M340_PUBLISHING_CAPABILITY = "fanbus.publishing.manage";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0;
}

function formatCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return String(value || "–");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? String(value || "–") : DATE_FORMAT.format(date);
}

function formatDateTime(value) {
  if (!value) return "–";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : `${DATE_TIME_FORMAT.format(date)} Uhr`;
}

function publicBase(environment) {
  return environment === "DEV"
    ? "https://staging.plaerrdeifl.de"
    : "https://plaerrdeifl.de";
}

function jobPresentation(status) {
  switch (String(status || "").toUpperCase()) {
    case "SUCCESS": return { label: "Fertig", className: "success" };
    case "PROCESSING": return { label: "Wird erstellt", className: "warning" };
    case "QUEUED": return { label: "Wartet", className: "warning" };
    case "FAILED": return { label: "Fehlgeschlagen", className: "danger" };
    default: return { label: String(status || "Unbekannt"), className: "neutral" };
  }
}

function renderMetrics(model) {
  const resolvedTrips = asArray(model?.trips).filter(trip => trip?.resolutionStatus === "RESOLVED");
  const stats = model?.stats || {};
  const successfulJobs = asArray(model?.jobs).filter(job => job?.status === "SUCCESS").length;
  return `<div class="m340-publishing-metrics" aria-label="Publishing-Übersicht">
    <article><span>Bereite Fahrten</span><strong>${resolvedTrips.length}</strong></article>
    <article><span>Aufrufe</span><strong>${asCount(stats.landingCount)}</strong></article>
    <article><span>Weiterleitungen</span><strong>${asCount(stats.referralCount)}</strong></article>
    <article><span>Erstellungen</span><strong>${successfulJobs}</strong></article>
  </div>`;
}

function renderTripCard(trip, model) {
  const resolutionStatus = String(trip?.resolutionStatus || "MISSING_VENUE");
  const candidates = asArray(trip?.resolutionCandidates);
  const latest = trip?.lastJob;
  const job = latest ? jobPresentation(latest.status) : null;
  const shortlink = trip?.shortlinkPath
    ? `${publicBase(model?.environment)}${trip.shortlinkPath}`
    : "";

  return `<article class="m340-publishing-card" data-m340-trip="${escapeAttr(trip?.tripId || "")}">
    <header class="m340-publishing-card-head">
      <div>
        <span class="m340-publishing-kicker">${escapeHtml(formatCalendarDate(trip?.eventDate))} · ${escapeHtml(String(trip?.eventTime || "").slice(0, 5) || "Uhrzeit offen")}</span>
        <h3>${escapeHtml(trip?.displayTitle || "Fanbusfahrt")}</h3>
        <p>${escapeHtml(trip?.venue || "Kein Veranstaltungsort hinterlegt")}</p>
      </div>
      ${job ? `<span class="badge ${escapeAttr(job.className)}">${escapeHtml(job.label)}</span>` : ""}
    </header>
    ${resolutionStatus === "RESOLVED" ? `<div class="m340-publishing-shortlink">
      <span>Kurzlink</span>
      <a href="${escapeAttr(shortlink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortlink)}</a>
    </div>
    <div class="v4-row-actions m340-publishing-trip-actions">
      <button class="button small primary" type="button" data-m340-enqueue="${escapeAttr(trip.tripId)}">Flyer &amp; QR neu erstellen</button>
    </div>` : resolutionStatus === "AMBIGUOUS" ? `<div class="notice warning m340-publishing-resolution-notice">
      <div><strong>Kurzlink-Ziel prüfen</strong><small>Der Veranstaltungsort passt zu mehreren bekannten Zielen. Bitte einmalig das richtige Ziel auswählen.</small></div>
      <form class="m340-publishing-ambiguity-form" data-m340-ambiguity-form data-event-id="${escapeAttr(trip?.eventId || "")}">
        <label>Ziel
          <select name="placeId" required>
            <option value="">Bitte auswählen</option>
            ${candidates.map(candidate => `<option value="${escapeAttr(candidate.placeId)}">${escapeHtml(candidate.displayName || "Ziel")}</option>`).join("")}
          </select>
        </label>
        <button class="button small secondary" type="submit">Ziel übernehmen</button>
      </form>
    </div>` : `<div class="notice warning m340-publishing-resolution-notice">
      <div><strong>Veranstaltungsort fehlt</strong><small>Bitte den Veranstaltungsort beim Spieltermin ergänzen. Danach wird der Kurzlink automatisch vorbereitet.</small></div>
    </div>`}
    ${latest?.lastErrorCode ? `<div class="notice error"><strong>Letzter Fehler</strong><p>${escapeHtml(latest.lastErrorCode)}</p></div>` : ""}
  </article>`;
}

function artifactLabel(kind) {
  switch (String(kind || "").toUpperCase()) {
    case "QR": return "QR-Code";
    case "POST": return "Post";
    case "STORY": return "Story";
    case "LED": return "LED";
    default: return "Datei";
  }
}

function renderArtifacts(manifest) {
  const artifacts = asArray(manifest?.artifacts);
  if (!artifacts.length) return "";
  const technicalRows = artifacts
    .filter(artifact => artifact?.nextcloudPath || artifact?.filename)
    .map(artifact => `<li><strong>${escapeHtml(artifactLabel(artifact?.kind))}:</strong> <code>${escapeHtml(artifact?.nextcloudPath || artifact?.filename || "")}</code></li>`)
    .join("");
  return `<div class="m340-publishing-artifacts" aria-label="Erstellte Dateien">${artifacts.map(artifact => `<div>
    <strong>${escapeHtml(artifactLabel(artifact?.kind))}</strong>
    <small>In Nextcloud gespeichert</small>
  </div>`).join("")}</div>
  ${technicalRows ? `<details class="m340-publishing-technical m340-publishing-file-details"><summary>Technische Dateiinformationen</summary><ul>${technicalRows}</ul></details>` : ""}`;
}

function renderJob(job, current = false) {
  const state = jobPresentation(job?.status);
  return `<article class="m340-publishing-history-item${current ? " is-current" : ""}">
    <div class="m340-publishing-history-head">
      <div><strong>${escapeHtml(job?.displayTitle || "Publishing")}</strong><small>${escapeHtml(formatDateTime(job?.createdAt))}</small></div>
      <div class="m340-publishing-history-badges">${current ? `<span class="badge neutral">Aktuell</span>` : ""}<span class="badge ${escapeAttr(state.className)}">${escapeHtml(state.label)}</span></div>
    </div>
    <p class="subtle">Versuch ${asCount(job?.attemptCount)}${job?.completedAt ? ` · abgeschlossen ${escapeHtml(formatDateTime(job.completedAt))}` : ""}</p>
    ${job?.lastErrorCode ? `<div class="notice error"><strong>${escapeHtml(job.lastErrorCode)}</strong></div>` : ""}
    ${renderArtifacts(job?.resultManifest)}
  </article>`;
}

function renderDaily(stats) {
  const rows = asArray(stats?.daily).filter(row => asCount(row?.landingCount) || asCount(row?.referralCount));
  if (!rows.length) return `<p class="subtle">In den letzten 30 Tagen wurden noch keine Kurzlink-Aufrufe erfasst.</p>`;
  return `<div class="m340-publishing-daily">${rows.slice().reverse().map(row => `<div>
    <span>${escapeHtml(formatCalendarDate(row?.day))}</span>
    <strong>${asCount(row?.landingCount)} Aufrufe</strong>
    <small>${asCount(row?.referralCount)} Weiterleitungen</small>
  </div>`).join("")}</div>`;
}

function workspaceMarkup(model) {
  const trips = asArray(model?.trips);
  const jobs = asArray(model?.jobs);
  return `<section class="v4-m325-workspace m340-publishing-workspace">
    <header class="v4-m325-workspace-header">
      <button class="button small secondary" type="button" data-m340-back>Zurück</button>
      <div>
        <span class="m340-publishing-kicker">Bus-Orga</span>
        <h2>Flyer &amp; Kurzlinks</h2>
        <p>QR-Ziele, Flyer-Erstellung, Nextcloud-Ablage und anonyme Klickstatistik.</p>
      </div>
    </header>
    ${renderMetrics(model)}
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingTripsTitle">
      <div class="m340-publishing-section-head"><div><h3 id="m340PublishingTripsTitle">Fahrten veröffentlichen</h3><p>Dieser Kurzlink wird für QR-Code und Flyer verwendet.</p></div><span class="badge neutral">${escapeHtml(model?.environment || "–")}</span></div>
      <div class="m340-publishing-grid">${trips.length ? trips.map(trip => renderTripCard(trip, model)).join("") : empty("Keine veröffentlichte Fanbusfahrt verfügbar.")}</div>
    </section>
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingHistoryTitle">
      <div class="m340-publishing-section-head"><div><h3 id="m340PublishingHistoryTitle">Erstellungshistorie</h3><p>Die neueste Erstellung zuerst; ältere Generationen sind kompakt zusammengefasst.</p></div></div>
      <div class="m340-publishing-history">${jobs.length ? `${renderJob(jobs[0], true)}${jobs.length > 1 ? `<details class="m340-publishing-older"><summary><span>Ältere Generationen</span><small>${jobs.length - 1}</small></summary><div class="m340-publishing-older-list">${jobs.slice(1).map(job => renderJob(job)).join("")}</div></details>` : ""}` : empty("Noch keine Flyer-Erstellung vorhanden.")}</div>
    </section>
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingStatsTitle">
      <div class="m340-publishing-section-head"><div><h3 id="m340PublishingStatsTitle">Kurzlink-Statistik</h3><p>Ausschließlich anonyme Tagesaggregate, ohne IP, Cookies oder Geräteprofile.</p></div></div>
      ${renderDaily(model?.stats || {})}
    </section>
  </section>`;
}

async function loadOverview() {
  await call("fanbus_publishing_resolution_ensure", {});
  const model = await call("fanbus_publishing_overview", {});
  if (!model || typeof model !== "object") throw new Error("Publishing-Übersicht ist ungültig.");
  return model;
}

function returnToBusOrga() {
  window.location.hash = "#/bus-orga";
}

function bindWorkspace(panel, refresh) {
  panel.querySelector("[data-m340-back]")?.addEventListener("click", returnToBusOrga);

  panel.querySelectorAll("[data-m340-ambiguity-form]").forEach(form => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const eventId = form.dataset.eventId || "";
      const placeId = String(form.elements.placeId?.value || "");
      if (!eventId || !placeId) return;
      try {
        await runWrite(
          () => call("fanbus_publishing_resolution_choose", { eventId, placeId }),
          "Kurzlink-Ziel wurde übernommen."
        );
        await refresh();
      } catch (error) {
        showToast(error?.message || "Kurzlink-Ziel konnte nicht gespeichert werden.", "error", 6000);
      }
    });
  });

  panel.querySelectorAll("[data-m340-enqueue]").forEach(button => {
    button.addEventListener("click", async () => {
      const tripId = button.dataset.m340Enqueue || "";
      if (!tripId) return;
      button.disabled = true;
      try {
        await runWrite(
          () => call("fanbus_publishing_job_enqueue", { tripId }),
          "Flyer- und QR-Erstellung wurde gestartet."
        );
        await refresh();
      } catch (error) {
        showToast(error?.message || "Publishing-Job konnte nicht gestartet werden.", "error", 6000);
        button.disabled = false;
      }
    });
  });
}

export async function renderM340PublishingWorkspace(panel, summary) {
  if (!hasCapability(M340_PUBLISHING_CAPABILITY)) {
    returnToBusOrga();
    return;
  }
  if (summary) summary.textContent = "";
  panel.innerHTML = `<section class="v4-m325-workspace m340-publishing-workspace"><header class="v4-m325-workspace-header"><button class="button small secondary" type="button" data-m340-back>Zurück</button><div><span class="m340-publishing-kicker">Bus-Orga</span><h2>Flyer &amp; Kurzlinks</h2><p>Publishing-Daten werden geladen …</p></div></header></section>`;
  panel.querySelector("[data-m340-back]")?.addEventListener("click", returnToBusOrga);

  const refresh = async () => {
    try {
      const model = await loadOverview();
      if (!panel.isConnected) return;
      panel.innerHTML = workspaceMarkup(model);
      bindWorkspace(panel, refresh);
    } catch (error) {
      if (!panel.isConnected) return;
      panel.innerHTML = `<section class="v4-m325-workspace m340-publishing-workspace"><header class="v4-m325-workspace-header"><button class="button small secondary" type="button" data-m340-back>Zurück</button><div><span class="m340-publishing-kicker">Bus-Orga</span><h2>Flyer &amp; Kurzlinks</h2></div></header>${errorPanel(error, "Publishing-Daten konnten nicht geladen werden")}</section>`;
      panel.querySelector("[data-m340-back]")?.addEventListener("click", returnToBusOrga);
    }
  };

  await refresh();
}
