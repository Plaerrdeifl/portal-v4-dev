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

function publicBase(environment) {
  return environment === "DEV"
    ? "https://staging.plaerrdeifl.de"
    : "https://plaerrdeifl.de";
}

function jobPresentation(status) {
  switch (String(status || "").toUpperCase()) {
    case "SUCCESS": return { label: "Flyer bereit", className: "success" };
    case "PROCESSING": return { label: "Wird erstellt", className: "warning" };
    case "QUEUED": return { label: "Wartet", className: "warning" };
    case "FAILED": return { label: "Fehlgeschlagen", className: "danger" };
    default: return { label: "Noch nicht erstellt", className: "neutral" };
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

function validDownloadUrl(value) {
  return typeof value === "string"
    && /^https:\/\/cloud\.plaerrdeifl\.de\/s\/[A-Za-z0-9]{8,128}\/download$/.test(value);
}

function jobsForTrip(model, tripId) {
  return asArray(model?.jobs).filter(job => String(job?.tripId || "") === String(tripId || ""));
}

function hasActiveJobs(model) {
  return asArray(model?.jobs).some(job => ["QUEUED", "PROCESSING"].includes(String(job?.status || "").toUpperCase()));
}

function latestFlyerJob(model, tripId) {
  return jobsForTrip(model, tripId).find(job => {
    if (String(job?.status || "").toUpperCase() !== "SUCCESS") return false;
    const kinds = new Set(asArray(job?.resultManifest?.artifacts)
      .filter(item => validDownloadUrl(item?.downloadUrl))
      .map(item => String(item?.kind || "").toUpperCase()));
    return ["POST", "STORY", "LED"].every(kind => kinds.has(kind));
  }) || null;
}

function flyerButtons(job) {
  const artifacts = asArray(job?.resultManifest?.artifacts);
  const byKind = new Map(artifacts.map(item => [String(item?.kind || "").toUpperCase(), item]));
  const definitions = [
    ["POST", "Instagram Post"],
    ["STORY", "Instagram Story"],
    ["LED", "LED 16:9"]
  ];
  return `<div class="m340-publishing-flyer-buttons">${definitions.map(([kind, label]) => {
    const artifact = byKind.get(kind);
    if (!validDownloadUrl(artifact?.downloadUrl)) {
      return `<span class="button small secondary disabled" aria-disabled="true">${escapeHtml(label)}</span>`;
    }
    return `<a class="button small primary" href="${escapeAttr(artifact.downloadUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  }).join("")}</div>`;
}

function renderResolvedTrip(trip, model) {
  const latest = trip?.lastJob;
  const state = jobPresentation(latest?.status);
  const flyerJob = latestFlyerJob(model, trip?.tripId);
  const shortlink = `${publicBase(model?.environment)}${trip.shortlinkPath || ""}`;
  const actionLabel = flyerJob ? "Flyer neu erzeugen" : "Flyer erstellen";

  return `<article class="m340-publishing-trip-row" data-m340-trip="${escapeAttr(trip?.tripId || "")}">
    <header class="m340-publishing-trip-row-head">
      <div class="m340-publishing-trip-main">
        <span class="m340-publishing-kicker">${escapeHtml(formatCalendarDate(trip?.eventDate))}${trip?.eventTime ? ` · ${escapeHtml(String(trip.eventTime).slice(0, 5))}` : ""}</span>
        <h3>${escapeHtml(trip?.displayTitle || trip?.venue || "Fanbusfahrt")}</h3>
        ${trip?.venue ? `<p>${escapeHtml(trip.venue)}</p>` : ""}
      </div>
      <div class="m340-publishing-trip-stats" aria-label="Kurzlink-Statistik dieser Fahrt">
        <span><strong>${asCount(trip?.landingCount)}</strong><small>Aufrufe</small></span>
        <span><strong>${asCount(trip?.referralCount)}</strong><small>Weiterleitungen</small></span>
      </div>
      <div class="m340-publishing-trip-controls">
        <span class="badge ${escapeAttr(state.className)}">${escapeHtml(state.label)}</span>
        <button class="button small secondary" type="button" data-m340-enqueue="${escapeAttr(trip.tripId)}">${escapeHtml(actionLabel)}</button>
      </div>
    </header>
    <div class="m340-publishing-trip-link"><span>Kurzlink</span><a href="${escapeAttr(shortlink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortlink)}</a></div>
    <details class="m340-publishing-flyers">
      <summary><span>Flyer</span><small>Post · Story · LED</small></summary>
      <div class="m340-publishing-flyers-body">
        ${flyerJob ? flyerButtons(flyerJob) : `<p class="subtle">Für diese Fahrt liegen noch keine direkten Flyer-Downloads vor.</p>`}
      </div>
    </details>
    ${latest?.lastErrorCode ? `<div class="notice error"><strong>Letzter Fehler</strong><p>${escapeHtml(latest.lastErrorCode)}</p></div>` : ""}
  </article>`;
}

function renderTripCard(trip, model) {
  const resolutionStatus = String(trip?.resolutionStatus || "MISSING_VENUE");
  if (resolutionStatus === "RESOLVED") return renderResolvedTrip(trip, model);

  const candidates = asArray(trip?.resolutionCandidates);
  return `<article class="m340-publishing-trip-row" data-m340-trip="${escapeAttr(trip?.tripId || "")}">
    <header class="m340-publishing-trip-row-head">
      <div class="m340-publishing-trip-main">
        <span class="m340-publishing-kicker">${escapeHtml(formatCalendarDate(trip?.eventDate))}</span>
        <h3>${escapeHtml(trip?.displayTitle || trip?.venue || "Fanbusfahrt")}</h3>
      </div>
    </header>
    ${resolutionStatus === "AMBIGUOUS" ? `<div class="notice warning m340-publishing-resolution-notice">
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
    </div>` : `<div class="notice warning m340-publishing-resolution-notice"><div><strong>Veranstaltungsort fehlt</strong><small>Bitte den Veranstaltungsort beim Spieltermin ergänzen. Danach wird der Kurzlink automatisch vorbereitet.</small></div></div>`}
  </article>`;
}

function workspaceMarkup(model) {
  const trips = asArray(model?.trips);
  return `<section class="v4-m325-workspace m340-publishing-workspace">
    <header class="v4-m325-workspace-header">
      <button class="button small secondary" type="button" data-m340-back>Zurück</button>
      <div>
        <span class="m340-publishing-kicker">Bus-Orga</span>
        <h2>Flyer &amp; Kurzlinks</h2>
        <p>Veröffentlichte Fahrten, Kurzlink-Statistik und Flyer-Downloads.</p>
      </div>
    </header>
    ${renderMetrics(model)}
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingTripsTitle">
      <div class="m340-publishing-section-head"><div><h3 id="m340PublishingTripsTitle">Veröffentlichte Fahrten</h3><p>Flyer je Fahrt aufklappen und direkt herunterladen.</p></div><span class="badge neutral">${escapeHtml(model?.environment || "–")}</span></div>
      <div class="m340-publishing-grid">${trips.length ? trips.map(trip => renderTripCard(trip, model)).join("") : empty("Keine veröffentlichte Fanbusfahrt verfügbar.")}</div>
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
          "Flyer-Erstellung wurde gestartet."
        );
        await refresh();
      } catch (error) {
        showToast(error?.message || "Flyer konnten nicht gestartet werden.", "error", 6000);
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

  let activeRefreshTimer = 0;
  const clearActiveRefresh = () => {
    if (activeRefreshTimer) window.clearTimeout(activeRefreshTimer);
    activeRefreshTimer = 0;
  };

  const refresh = async () => {
    clearActiveRefresh();
    try {
      const openTrips = new Set([...panel.querySelectorAll("details.m340-publishing-flyers[open]")]
        .map(details => details.closest("[data-m340-trip]")?.dataset.m340Trip)
        .filter(Boolean));
      const model = await loadOverview();
      if (!panel.isConnected) return;
      panel.innerHTML = workspaceMarkup(model);
      openTrips.forEach(tripId => panel.querySelector(`[data-m340-trip="${CSS.escape(tripId)}"] details.m340-publishing-flyers`)?.setAttribute("open", ""));
      bindWorkspace(panel, refresh);
      if (hasActiveJobs(model)) {
        activeRefreshTimer = window.setTimeout(() => {
          activeRefreshTimer = 0;
          if (panel.isConnected) refresh();
        }, 2500);
      }
    } catch (error) {
      if (!panel.isConnected) return;
      panel.innerHTML = `<section class="v4-m325-workspace m340-publishing-workspace"><header class="v4-m325-workspace-header"><button class="button small secondary" type="button" data-m340-back>Zurück</button><div><span class="m340-publishing-kicker">Bus-Orga</span><h2>Flyer &amp; Kurzlinks</h2></div></header>${errorPanel(error, "Publishing-Daten konnten nicht geladen werden")}</section>`;
      panel.querySelector("[data-m340-back]")?.addEventListener("click", returnToBusOrga);
    }
  };

  await refresh();
}
