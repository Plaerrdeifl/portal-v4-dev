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

function artifactLabel(kind) {
  switch (String(kind || "").toUpperCase()) {
    case "QR": return "QR-Code";
    case "POST": return "Instagram Post";
    case "STORY": return "Instagram Story";
    case "LED": return "LED 16:9";
    default: return "Datei";
  }
}

function artifactDescription(kind) {
  switch (String(kind || "").toUpperCase()) {
    case "QR": return "Dauerhafter OnTour-QR-Code";
    case "POST": return "1080 × 1350 px";
    case "STORY": return "1080 × 1920 px";
    case "LED": return "1920 × 1080 px";
    default: return "Publishing-Datei";
  }
}

function artifactClass(kind) {
  const value = String(kind || "").toLowerCase();
  return ["qr", "post", "story", "led"].includes(value) ? `is-${value}` : "";
}

function validShareUrl(value) {
  return typeof value === "string"
    && /^https:\/\/cloud\.plaerrdeifl\.de\/s\/[A-Za-z0-9]{8,128}$/.test(value);
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

function renderArtifacts(manifest) {
  const artifacts = asArray(manifest?.artifacts).filter(artifact => validDownloadUrl(artifact?.downloadUrl));
  if (!artifacts.length) return "";

  return `<div class="m340-publishing-artifacts" aria-label="Erstellte Assets">${artifacts.map(artifact => {
    const label = artifactLabel(artifact?.kind);
    const shareUrl = validShareUrl(artifact?.shareUrl) ? artifact.shareUrl : "";
    const downloadUrl = artifact.downloadUrl;
    return `<article class="m340-publishing-asset-card ${escapeAttr(artifactClass(artifact?.kind))}">
      <button class="m340-publishing-asset-preview" type="button" data-m340-preview="${escapeAttr(downloadUrl)}" data-m340-preview-title="${escapeAttr(label)}" aria-label="${escapeAttr(`${label} vergrößern`)}">
        <img src="${escapeAttr(downloadUrl)}" alt="${escapeAttr(`${label} Vorschau`)}" loading="lazy">
        <span>Vorschau</span>
      </button>
      <div class="m340-publishing-asset-body">
        <div class="m340-publishing-asset-title"><strong>${escapeHtml(label)}</strong><small>${escapeHtml(artifactDescription(artifact?.kind))}</small></div>
        <div class="m340-publishing-asset-actions">
          <button class="button small secondary" type="button" data-m340-preview="${escapeAttr(downloadUrl)}" data-m340-preview-title="${escapeAttr(label)}">Vorschau</button>
          <a class="button small primary" href="${escapeAttr(downloadUrl)}" target="_blank" rel="noopener noreferrer">Download</a>
          ${shareUrl ? `<button class="button small secondary" type="button" data-m340-share="${escapeAttr(shareUrl)}" data-m340-share-title="${escapeAttr(label)}">Teilen</button>` : ""}
        </div>
      </div>
    </article>`;
  }).join("")}</div>`;
}

function renderGeneration(job, current = false) {
  const state = jobPresentation(job?.status);
  const artifacts = renderArtifacts(job?.resultManifest);
  return `<article class="m340-publishing-generation${current ? " is-current" : ""}">
    <header class="m340-publishing-generation-head">
      <div>
        <span>${escapeHtml(current ? "Aktuelle Assets" : "Ältere Generation")}</span>
        <strong>${escapeHtml(current ? "Neueste Generation" : formatDateTime(job?.createdAt))}</strong>
        ${current ? `<small>${escapeHtml(formatDateTime(job?.createdAt))}${job?.completedAt ? ` · abgeschlossen ${escapeHtml(formatDateTime(job.completedAt))}` : ""}</small>` : ""}
      </div>
      <div class="m340-publishing-history-badges"><span class="badge ${escapeAttr(state.className)}">${escapeHtml(state.label)}</span></div>
    </header>
    ${job?.lastErrorCode ? `<div class="notice error"><strong>${escapeHtml(job.lastErrorCode)}</strong></div>` : ""}
    ${artifacts || `<div class="m340-publishing-generation-wait"><strong>${escapeHtml(state.label)}</strong><small>${String(job?.status || "").toUpperCase() === "SUCCESS" ? "Für diese Generation sind keine direkten Portal-Downloads vorhanden." : "Die Dateien erscheinen hier automatisch, sobald die Erstellung abgeschlossen ist."}</small></div>`}
  </article>`;
}

function renderTripPublishing(trip, model) {
  const jobs = jobsForTrip(model, trip?.tripId);
  if (!jobs.length) {
    return `<section class="m340-publishing-assets-panel is-empty">
      <div><strong>Noch keine Assets erstellt</strong><small>Erzeuge Post, Story, LED und QR-Code gemeinsam mit einem Klick.</small></div>
    </section>`;
  }

  return `<section class="m340-publishing-assets-panel" aria-label="Publishing-Assets">
    ${renderGeneration(jobs[0], true)}
    ${jobs.length > 1 ? `<details class="m340-publishing-older"><summary><span>Ältere Generationen</span><small>${jobs.length - 1}</small></summary><div class="m340-publishing-older-list">${jobs.slice(1).map(job => renderGeneration(job)).join("")}</div></details>` : ""}
  </section>`;
}

function renderTripCard(trip, model) {
  const resolutionStatus = String(trip?.resolutionStatus || "MISSING_VENUE");
  const candidates = asArray(trip?.resolutionCandidates);
  const latest = trip?.lastJob;
  const job = latest ? jobPresentation(latest.status) : null;
  const tripJobs = jobsForTrip(model, trip?.tripId);
  const shortlink = trip?.shortlinkPath
    ? `${publicBase(model?.environment)}${trip.shortlinkPath}`
    : "";
  const actionLabel = tripJobs.length ? "Assets neu erzeugen" : "Finale Assets erstellen";

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
      <button class="button small primary" type="button" data-m340-enqueue="${escapeAttr(trip.tripId)}">${escapeHtml(actionLabel)}</button>
    </div>
    ${renderTripPublishing(trip, model)}` : resolutionStatus === "AMBIGUOUS" ? `<div class="notice warning m340-publishing-resolution-notice">
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
  return `<section class="v4-m325-workspace m340-publishing-workspace">
    <header class="v4-m325-workspace-header">
      <button class="button small secondary" type="button" data-m340-back>Zurück</button>
      <div>
        <span class="m340-publishing-kicker">Bus-Orga</span>
        <h2>Flyer &amp; Kurzlinks</h2>
        <p>Assets erzeugen, direkt prüfen, herunterladen und teilen.</p>
      </div>
    </header>
    ${renderMetrics(model)}
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingTripsTitle">
      <div class="m340-publishing-section-head"><div><h3 id="m340PublishingTripsTitle">Fanbus-Publishing</h3><p>Jede Fahrt hat ihren dauerhaften OnTour-Link und ihre eigenen Asset-Generationen.</p></div><span class="badge neutral">${escapeHtml(model?.environment || "–")}</span></div>
      <div class="m340-publishing-grid">${trips.length ? trips.map(trip => renderTripCard(trip, model)).join("") : empty("Keine veröffentlichte Fanbusfahrt verfügbar.")}</div>
    </section>
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingStatsTitle">
      <div class="m340-publishing-section-head"><div><h3 id="m340PublishingStatsTitle">Kurzlink-Statistik</h3><p>Ausschließlich anonyme Tagesaggregate, ohne IP, Cookies oder Geräteprofile.</p></div></div>
      ${renderDaily(model?.stats || {})}
    </section>
    <dialog class="m340-publishing-preview-dialog" data-m340-preview-dialog>
      <div class="m340-publishing-preview-shell">
        <header><strong data-m340-preview-heading>Vorschau</strong><button class="button small secondary" type="button" data-m340-preview-close>Schließen</button></header>
        <div class="m340-publishing-preview-stage"><img data-m340-preview-image alt="Asset-Vorschau"></div>
      </div>
    </dialog>
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

function bindPreviewAndShare(panel) {
  const dialog = panel.querySelector("[data-m340-preview-dialog]");
  const image = dialog?.querySelector("[data-m340-preview-image]");
  const heading = dialog?.querySelector("[data-m340-preview-heading]");

  panel.querySelectorAll("[data-m340-preview]").forEach(button => {
    button.addEventListener("click", () => {
      const url = button.dataset.m340Preview || "";
      if (!dialog || !image || !validDownloadUrl(url)) return;
      const title = button.dataset.m340PreviewTitle || "Vorschau";
      image.src = url;
      image.alt = `${title} Vorschau`;
      if (heading) heading.textContent = title;
      dialog.showModal();
    });
  });

  dialog?.querySelector("[data-m340-preview-close]")?.addEventListener("click", () => dialog.close());
  dialog?.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  dialog?.addEventListener("close", () => {
    if (image) image.removeAttribute("src");
  });

  panel.querySelectorAll("[data-m340-share]").forEach(button => {
    button.addEventListener("click", async () => {
      const url = button.dataset.m340Share || "";
      if (!validShareUrl(url)) return;
      const title = button.dataset.m340ShareTitle || "Fanbus-Asset";
      try {
        if (navigator.share) {
          await navigator.share({ title, url });
          return;
        }
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          showToast("Freigabelink wurde kopiert.", "success", 3000);
          return;
        }
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) {
        if (error?.name !== "AbortError") showToast("Teilen ist auf diesem Gerät nicht möglich.", "error", 4000);
      }
    });
  });
}

function bindWorkspace(panel, refresh) {
  panel.querySelector("[data-m340-back]")?.addEventListener("click", returnToBusOrga);
  bindPreviewAndShare(panel);

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
          "Asset-Erstellung wurde gestartet."
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

  let activeRefreshTimer = 0;
  const clearActiveRefresh = () => {
    if (activeRefreshTimer) window.clearTimeout(activeRefreshTimer);
    activeRefreshTimer = 0;
  };

  const refresh = async () => {
    clearActiveRefresh();
    try {
      const model = await loadOverview();
      if (!panel.isConnected) return;
      panel.innerHTML = workspaceMarkup(model);
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
