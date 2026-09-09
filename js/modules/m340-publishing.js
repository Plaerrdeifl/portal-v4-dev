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

function jobPresentation(status) {
  switch (String(status || "").toUpperCase()) {
    case "SUCCESS": return { label: "Flyer bereit", className: "success" };
    case "PROCESSING": return { label: "Wird erstellt", className: "warning" };
    case "QUEUED": return { label: "Wartet", className: "warning" };
    case "FAILED": return { label: "Fehlgeschlagen", className: "danger" };
    default: return { label: "Noch nicht erstellt", className: "neutral" };
  }
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
    ["POST", "Post"],
    ["STORY", "Story"],
    ["LED", "LED"]
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

function generatorTripOptions(model, selectedTripId = "") {
  const trips = asArray(model?.trips).filter(trip => trip?.resolutionStatus === "RESOLVED");
  return `<option value="">Fahrt auswählen</option>${trips.map(trip => {
    const title = trip?.venue || trip?.displayTitle || "Fanbusfahrt";
    const date = formatCalendarDate(trip?.eventDate);
    return `<option value="${escapeAttr(trip?.tripId || "")}"${String(trip?.tripId || "") === String(selectedTripId || "") ? " selected" : ""}>${escapeHtml(`${date} · ${title}`)}</option>`;
  }).join("")}`;
}

function renderWorkerControl(model) {
  const worker = model?.workerRuntime || {};
  const state = String(worker?.state || "UNREACHABLE");
  const enabled = Boolean(worker?.enabled);
  const ready = Boolean(worker?.ready);
  const label = state === "ACTIVE" ? "AKTIV" : state === "STARTING" ? "WIRD AKTIVIERT …" : state === "UNREACHABLE" ? "NICHT ERREICHBAR" : "AUS";
  const hint = ready
    ? "Worker aktiv – Flyer werden spätestens nach wenigen Sekunden verarbeitet."
    : enabled
      ? "Worker wird aktiviert. Flyer-Erstellung ist bis zum nächsten Heartbeat gesperrt."
      : "Worker deaktiviert – Flyer-Erstellung derzeit nicht möglich.";
  return `<section class="v4-m325-workspace-section"><div class="m340-publishing-section-head"><div><h3>Flyer-Worker</h3><small>${escapeHtml(label)}</small></div><button class="button small secondary" type="button" data-m340-worker-toggle>${enabled ? "Ausschalten" : "Einschalten"}</button></div><p class="subtle">${escapeHtml(hint)}</p></section>`;
}

function renderFlyerGenerator(model, generator = {}) {
  const tripId = String(generator?.tripId || "");
  const saved = Boolean(generator?.saved && tripId);
  const enabled = Boolean(generator?.enabled);
  const text = String(generator?.text || "");
  const activeJob = tripId ? jobsForTrip(model, tripId).find(job => ["QUEUED", "PROCESSING"].includes(String(job?.status || "").toUpperCase())) : null;
  const workerReady = Boolean(model?.workerRuntime?.ready);
  return `<section class="v4-m325-workspace-section m340-generator" aria-labelledby="m340GeneratorTitle">
    <div class="m340-publishing-section-head"><h3 id="m340GeneratorTitle">Flyer-Generator</h3></div>
    <div class="m340-generator-body">
      <label class="m340-generator-trip"><span>Fahrt</span><select data-m340-generator-trip>${generatorTripOptions(model, tripId)}</select></label>
      ${tripId ? (saved ? `<div class="m340-generator-saved">
        <span class="m340-generator-saved-check" aria-label="Zusatzanzeige ${enabled ? "aktiviert" : "deaktiviert"}"><input type="checkbox" ${enabled ? "checked " : ""}disabled><span>Zusatzanzeige</span></span>
        ${enabled ? `<small>${escapeHtml(text)}</small>` : ""}
        <button class="button small ghost" type="button" data-m340-generator-change>Ändern</button>
      </div>
      <button class="button primary m340-generator-create" type="button" data-m340-generator-create${activeJob || !workerReady ? " disabled" : ""}>${activeJob ? "Wird erstellt …" : workerReady ? "Flyer generieren" : "Worker nicht aktiv"}</button>` : `<form class="m340-generator-config" data-m340-generator-config>
        <label class="m340-publishing-toggle"><input type="checkbox" name="tripLabelEnabled"${enabled ? " checked" : ""}><span>Zusatzanzeige</span></label>
        <label class="m340-generator-text"${enabled ? "" : " hidden"}><span>Text</span><input type="text" name="tripLabelText" maxlength="32" value="${escapeAttr(text)}"></label>
        <button class="button small secondary" type="submit">Speichern</button>
      </form>`) : ""}
    </div>
  </section>`;
}

function renderTemplateManagement(model) {
  const templates = asArray(model?.templates);
  return `<details class="v4-m325-workspace-section m340-template-management">
    <summary>Vorlagen verwalten</summary>
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
  </details>`;
}

function renderResolvedTrip(trip, model) {
  const latest = trip?.lastJob;
  const state = jobPresentation(latest?.status);
  const flyerJob = latestFlyerJob(model, trip?.tripId);
  const showState = ["QUEUED", "PROCESSING", "FAILED"].includes(String(latest?.status || "").toUpperCase());

  return `<article class="m340-publishing-trip-row" data-m340-trip="${escapeAttr(trip?.tripId || "")}">
    <header class="m340-publishing-trip-row-head">
      <div class="m340-publishing-trip-main">
        <span class="m340-publishing-kicker">${escapeHtml(formatCalendarDate(trip?.eventDate))}${trip?.eventTime ? ` · ${escapeHtml(String(trip.eventTime).slice(0, 5))}` : ""}</span>
        <h3>${escapeHtml(trip?.venue || trip?.displayTitle || "Fanbusfahrt")}</h3>
      </div>
      <div class="m340-publishing-trip-stats" aria-label="Kurzlink-Statistik dieser Fahrt">
        <span><strong>${asCount(trip?.landingCount)}</strong><small>Aufrufe</small></span>
        <span><strong>${asCount(trip?.referralCount)}</strong><small>Weiterleitungen</small></span>
      </div>
    </header>
    <details class="m340-publishing-flyers">
      <summary><span>Flyer</span>${showState ? `<small class="m340-flyer-state ${escapeAttr(state.className)}">${escapeHtml(state.label)}</small>` : ""}</summary>
      <div class="m340-publishing-flyers-body">
        ${flyerJob ? flyerButtons(flyerJob) : `<p class="subtle">Noch keine Flyer vorhanden.</p>`}
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
        <h3>${escapeHtml(trip?.venue || trip?.displayTitle || "Fanbusfahrt")}</h3>
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

function workspaceMarkup(model, generator) {
  const trips = asArray(model?.trips);
  return `<section class="v4-m325-workspace m340-publishing-workspace">
    <header class="v4-m325-workspace-header">
      <button class="button small secondary" type="button" data-m340-back>Zurück</button>
      <div><span class="m340-publishing-kicker">Bus-Orga</span><h2>Social Media</h2></div>
    </header>
    ${renderWorkerControl(model)}
    ${renderFlyerGenerator(model, generator)}
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingTripsTitle">
      <div class="m340-publishing-section-head"><h3 id="m340PublishingTripsTitle">Veröffentlichte Fahrten</h3></div>
      <div class="m340-publishing-grid">${trips.length ? trips.map(trip => renderTripCard(trip, model)).join("") : empty("Keine veröffentlichte Fanbusfahrt verfügbar.")}</div>
    </section>
    ${renderTemplateManagement(model)}
  </section>`;
}

async function loadOverview() {
  await call("fanbus_publishing_resolution_ensure", {});
  const [model, workerRuntime] = await Promise.all([
    call("fanbus_publishing_overview", {}),
    call("worker_runtime_status", { workerCode: "FANBUS_PUBLISHING" })
  ]);
  if (!model || typeof model !== "object") throw new Error("Publishing-Übersicht ist ungültig.");
  model.workerRuntime = workerRuntime;
  return model;
}

function returnToBusOrga() {
  window.location.hash = "#/bus-orga";
}

function bindWorkspace(panel, refresh, generator) {
  panel.querySelector("[data-m340-back]")?.addEventListener("click", returnToBusOrga);
  panel.querySelector("[data-m340-worker-toggle]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const status = await call("worker_runtime_status", { workerCode: "FANBUS_PUBLISHING" });
      await runWrite(
        () => call("worker_runtime_set", { workerCode: "FANBUS_PUBLISHING", enabled: !Boolean(status?.enabled) }),
        status?.enabled ? "Flyer-Worker wurde ausgeschaltet." : "Flyer-Worker wird aktiviert."
      );
      await refresh();
      if (!status?.enabled) window.setTimeout(() => panel.isConnected && refresh(), 2500);
    } catch (error) {
      showToast(error?.message || "Worker-Status konnte nicht geändert werden.", "error", 6000);
      button.disabled = false;
    }
  });

  const tripSelect = panel.querySelector("[data-m340-generator-trip]");
  tripSelect?.addEventListener("change", async () => {
    generator.tripId = String(tripSelect.value || "");
    generator.saved = false;
    generator.enabled = false;
    generator.text = "";
    await refresh();
  });

  const configForm = panel.querySelector("[data-m340-generator-config]");
  if (configForm) {
    const toggle = configForm.elements.tripLabelEnabled;
    const textLabel = configForm.querySelector(".m340-generator-text");
    const textInput = configForm.elements.tripLabelText;
    toggle?.addEventListener("change", () => {
      const enabled = Boolean(toggle.checked);
      textLabel?.toggleAttribute("hidden", !enabled);
      if (!enabled && textInput) textInput.value = "";
      if (enabled) textInput?.focus({ preventScroll: true });
    });
    configForm.addEventListener("submit", async event => {
      event.preventDefault();
      const enabled = Boolean(toggle?.checked);
      const text = String(textInput?.value || "").trim().replace(/\s+/g, " ");
      if (enabled && (!text || text.length > 32)) {
        showToast("Bitte einen Text mit höchstens 32 Zeichen eingeben.", "error", 5000);
        return;
      }
      generator.enabled = enabled;
      generator.text = enabled ? text : "";
      generator.saved = true;
      await refresh();
    });
  }

  panel.querySelector("[data-m340-generator-change]")?.addEventListener("click", async () => {
    generator.saved = false;
    await refresh();
  });

  panel.querySelector("[data-m340-generator-create]")?.addEventListener("click", async event => {
    const button = event.currentTarget;
    if (!generator.tripId || !generator.saved) return;
    button.disabled = true;
    try {
      await runWrite(
        () => call("fanbus_publishing_job_enqueue", {
          tripId: generator.tripId,
          tripLabelEnabled: Boolean(generator.enabled),
          tripLabelText: generator.enabled ? String(generator.text || "") : ""
        }),
        "Flyer-Erstellung wurde gestartet."
      );
      await refresh();
    } catch (error) {
      showToast(error?.message || "Flyer konnten nicht gestartet werden.", "error", 6000);
      button.disabled = false;
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

}

export async function renderM340PublishingWorkspace(panel, summary) {
  if (!hasCapability(M340_PUBLISHING_CAPABILITY)) {
    returnToBusOrga();
    return;
  }
  if (summary) summary.textContent = "";
  panel.innerHTML = `<section class="v4-m325-workspace m340-publishing-workspace"><header class="v4-m325-workspace-header"><button class="button small secondary" type="button" data-m340-back>Zurück</button><div><span class="m340-publishing-kicker">Bus-Orga</span><h2>Social Media</h2></div></header></section>`;
  panel.querySelector("[data-m340-back]")?.addEventListener("click", returnToBusOrga);

  const generator = { tripId: "", saved: false, enabled: false, text: "" };
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
      panel.innerHTML = workspaceMarkup(model, generator);
      openTrips.forEach(tripId => panel.querySelector(`[data-m340-trip="${CSS.escape(tripId)}"] details.m340-publishing-flyers`)?.setAttribute("open", ""));
      bindWorkspace(panel, refresh, generator);
      if (hasActiveJobs(model)) {
        activeRefreshTimer = window.setTimeout(() => {
          activeRefreshTimer = 0;
          if (panel.isConnected) refresh();
        }, 2500);
      }
    } catch (error) {
      if (!panel.isConnected) return;
      panel.innerHTML = `<section class="v4-m325-workspace m340-publishing-workspace"><header class="v4-m325-workspace-header"><button class="button small secondary" type="button" data-m340-back>Zurück</button><div><span class="m340-publishing-kicker">Bus-Orga</span><h2>Social Media</h2></div></header>${errorPanel(error, "Social-Media-Daten konnten nicht geladen werden")}</section>`;
      panel.querySelector("[data-m340-back]")?.addEventListener("click", returnToBusOrga);
    }
  };

  await refresh();
}
