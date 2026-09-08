import {
  call,
  empty,
  errorPanel,
  escapeAttr,
  escapeHtml,
  hasCapability,
  runWrite,
  showToast,
  uploadM340Template
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

const NEXTCLOUD_PUBLIC_HOST = "cloud.plaerrdeifl.de";

function nextcloudShareToken(value) {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== NEXTCLOUD_PUBLIC_HOST || url.port || url.search || url.hash) return "";
    const match = /^\/s\/([A-Za-z0-9]{8,128})(?:\/download)?\/?$/.exec(url.pathname);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function artifactShareToken(artifact) {
  return nextcloudShareToken(artifact?.shareUrl) || nextcloudShareToken(artifact?.downloadUrl);
}

function publicDavUrl(artifact) {
  const token = artifactShareToken(artifact);
  return token ? `https://${NEXTCLOUD_PUBLIC_HOST}/public.php/dav/files/${encodeURIComponent(token)}` : "";
}

function safeFlyerFilename(value, fallback = "flyer.png") {
  const candidate = String(value || fallback)
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return candidate && /^[^<>:"|?*]+\.png$/i.test(candidate) ? candidate : fallback;
}

function contentDispositionFilename(value) {
  const header = String(value || "");
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)?.[1]?.trim().replace(/^"|"$/g, "");
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fallback to the plain filename parameter below.
    }
  }
  const plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(header);
  return String(plain?.[1] || plain?.[2] || "").trim();
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
      .filter(item => artifactShareToken(item))
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
    if (!artifactShareToken(artifact)) {
      return `<span class="button small secondary disabled" aria-disabled="true">${escapeHtml(label)}</span>`;
    }
    return `<button class="button small primary" type="button"
      data-m340-flyer-download
      data-m340-share-url="${escapeAttr(artifact?.shareUrl || "")}"
      data-m340-download-url="${escapeAttr(artifact?.downloadUrl || "")}"
      data-m340-filename="${escapeAttr(artifact?.filename || `${kind.toLowerCase()}.png`)}"
      data-m340-bytes="${escapeAttr(String(artifact?.bytes || ""))}">${escapeHtml(label)}</button>`;
  }).join("")}</div>`;
}

async function fetchFlyerArtifact(artifact) {
  const url = publicDavUrl(artifact);
  if (!url) throw new Error("M340_FLYER_SHARE_INVALID");

  const response = await fetch(url, {
    method: "GET",
    credentials: "omit",
    redirect: "follow"
  });
  if (!response.ok) throw new Error("M340_FLYER_FETCH_FAILED");

  const contentType = String(response.headers.get("Content-Type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "image/png") throw new Error("M340_FLYER_TYPE_INVALID");

  const blob = await response.blob();
  if (blob.type && blob.type.toLowerCase() !== "image/png") throw new Error("M340_FLYER_BLOB_INVALID");

  const expectedBytes = Number(artifact?.bytes);
  if (Number.isFinite(expectedBytes) && expectedBytes > 0 && blob.size !== expectedBytes) {
    throw new Error("M340_FLYER_SIZE_MISMATCH");
  }

  const responseName = contentDispositionFilename(response.headers.get("Content-Disposition"));
  const fallbackName = safeFlyerFilename(artifact?.filename, "flyer.png");
  return {
    blob,
    filename: safeFlyerFilename(responseName, fallbackName)
  };
}

function downloadFlyerBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  let started = false;
  try {
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    started = true;
  } finally {
    anchor.remove();
    if (started) {
      globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } else {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

async function deliverFlyerArtifact(artifact, label) {
  const { blob, filename } = await fetchFlyerArtifact(artifact);
  if (typeof File === "function" && typeof navigator?.share === "function" && typeof navigator?.canShare === "function") {
    const file = new File([blob], filename, { type: "image/png" });
    let canShareFiles = false;
    try {
      canShareFiles = navigator.canShare({ files: [file] });
    } catch {
      canShareFiles = false;
    }
    if (canShareFiles) {
      try {
        await navigator.share({ files: [file], title: label });
        return "shared";
      } catch (error) {
        if (error?.name === "AbortError") return "cancelled";
        // iOS can lose transient activation while fetching; use the download fallback.
      }
    }
  }

  downloadFlyerBlob(blob, filename);
  return "downloaded";
}

function templateStatus(template) {
  if (String(template?.source || "SERVER_DEFAULT") !== "CUSTOM") return "Standardvorlage";
  return template?.filename ? `Eigene Vorlage · ${template.filename}` : "Eigene Vorlage";
}

function renderPublishingSettings(model) {
  const tripLabel = model?.settings?.tripLabel || { enabled: true, text: "FANBUSFAHRT" };
  const templates = asArray(model?.templates);
  return `<section class="v4-m325-workspace-section m340-publishing-settings" aria-labelledby="m340PublishingSettingsTitle">
    <div class="m340-publishing-section-head"><div><h3 id="m340PublishingSettingsTitle">Flyer-Einstellungen</h3><p>Gilt für neu gestartete Flyer-Erstellungen.</p></div></div>
    <form class="m340-publishing-label-form" data-m340-label-form>
      <div class="m340-publishing-label-copy">
        <strong>Zusatzzeile</strong>
        <small>Text und Brush unter dem Zielort gemeinsam ein- oder ausblenden.</small>
      </div>
      <label class="m340-publishing-toggle"><input type="checkbox" name="tripLabelEnabled"${tripLabel?.enabled !== false ? " checked" : ""}><span>Anzeigen</span></label>
      <label class="m340-publishing-label-input"><span>Text</span><input type="text" name="tripLabelText" maxlength="32" required value="${escapeAttr(tripLabel?.text || "FANBUSFAHRT")}"></label>
      <button class="button small secondary" type="submit">Speichern</button>
    </form>
    <div class="m340-publishing-template-list" aria-label="Flyer-Vorlagen">
      ${templates.map(template => `<article class="m340-publishing-template-row" data-m340-template="${escapeAttr(template?.kind || "")}">
        <div><strong>${escapeHtml(template?.label || template?.kind || "Vorlage")}</strong><small>${escapeHtml(templateStatus(template))}</small></div>
        <div class="m340-publishing-template-actions">
          <label class="button small secondary m340-publishing-template-upload">SVG ersetzen<input type="file" accept=".svg,image/svg+xml" data-m340-template-file="${escapeAttr(template?.kind || "")}" hidden></label>
          ${template?.canRollback ? `<button class="button small ghost" type="button" data-m340-template-rollback="${escapeAttr(template.kind)}">Vorherige Vorlage</button>` : ""}
          ${template?.canReset ? `<button class="button small ghost" type="button" data-m340-template-reset="${escapeAttr(template.kind)}">Standard verwenden</button>` : ""}
        </div>
      </article>`).join("")}
    </div>
  </section>`;
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
    ${renderPublishingSettings(model)}
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

  panel.querySelector("[data-m340-label-form]")?.addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const tripLabelEnabled = Boolean(form.elements.tripLabelEnabled?.checked);
    const tripLabelText = String(form.elements.tripLabelText?.value || "").trim().replace(/\s+/g, " ");
    if (!tripLabelText || tripLabelText.length > 32) {
      showToast("Bitte einen Text mit höchstens 32 Zeichen eingeben.", "error", 5000);
      return;
    }
    if (button) button.disabled = true;
    try {
      await runWrite(
        () => call("fanbus_publishing_output_settings_update", { tripLabelEnabled, tripLabelText }),
        "Flyer-Einstellungen wurden gespeichert."
      );
      await refresh();
    } catch (error) {
      showToast(error?.message || "Flyer-Einstellungen konnten nicht gespeichert werden.", "error", 6000);
      if (button) button.disabled = false;
    }
  });

  panel.querySelectorAll("[data-m340-template-file]").forEach(input => {
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      const kind = input.dataset.m340TemplateFile || "";
      input.value = "";
      if (!file || !kind) return;
      if (!/\.svg$/i.test(file.name) || file.size < 1000 || file.size > 5 * 1024 * 1024) {
        showToast("Bitte eine SVG-Datei bis maximal 5 MiB auswählen.", "error", 5000);
        return;
      }
      const row = input.closest("[data-m340-template]");
      row?.setAttribute("aria-busy", "true");
      try {
        await uploadM340Template(kind, file);
        showToast("SVG-Vorlage wurde geprüft und aktiviert.", "success", 4500);
        await refresh();
      } catch (error) {
        showToast(error?.message || "SVG-Vorlage konnte nicht ersetzt werden.", "error", 6500);
        row?.removeAttribute("aria-busy");
      }
    });
  });

  panel.querySelectorAll("[data-m340-template-rollback]").forEach(button => {
    button.addEventListener("click", async () => {
      const kind = button.dataset.m340TemplateRollback || "";
      if (!kind) return;
      button.disabled = true;
      try {
        await runWrite(() => call("fanbus_publishing_template_rollback", { kind }), "Vorherige Vorlage wurde aktiviert.");
        await refresh();
      } catch (error) {
        showToast(error?.message || "Vorlage konnte nicht zurückgesetzt werden.", "error", 6000);
        button.disabled = false;
      }
    });
  });

  panel.querySelectorAll("[data-m340-template-reset]").forEach(button => {
    button.addEventListener("click", async () => {
      const kind = button.dataset.m340TemplateReset || "";
      if (!kind) return;
      button.disabled = true;
      try {
        await runWrite(() => call("fanbus_publishing_template_reset", { kind }), "Standardvorlage wurde aktiviert.");
        await refresh();
      } catch (error) {
        showToast(error?.message || "Standardvorlage konnte nicht aktiviert werden.", "error", 6000);
        button.disabled = false;
      }
    });
  });

  panel.querySelectorAll("[data-m340-flyer-download]").forEach(button => {
    button.addEventListener("click", async () => {
      const label = button.textContent?.trim() || "Flyer";
      const artifact = {
        shareUrl: button.dataset.m340ShareUrl || "",
        downloadUrl: button.dataset.m340DownloadUrl || "",
        filename: button.dataset.m340Filename || "flyer.png",
        bytes: Number(button.dataset.m340Bytes || 0)
      };
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.textContent = "Lädt …";
      try {
        await deliverFlyerArtifact(artifact, label);
      } catch {
        showToast("Flyer konnte nicht geladen werden. Bitte erneut versuchen.", "error", 5000);
      } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.textContent = label;
      }
    });
  });

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
