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

function normalizePlaceKey(value) {
  const normalized = String(value || "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized ? `v1:${normalized}` : "";
}

function normalizeSlug(value) {
  return normalizePlaceKey(value).replace(/^v1:/, "").slice(0, 48);
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
  const places = asArray(model?.places);
  const stats = model?.stats || {};
  const successfulJobs = asArray(model?.jobs).filter(job => job?.status === "SUCCESS").length;
  return `<div class="m340-publishing-metrics" aria-label="Publishing-Übersicht">
    <article><span>Kurzlinks</span><strong>${places.filter(place => place?.active !== false).length}</strong></article>
    <article><span>Aufrufe</span><strong>${asCount(stats.landingCount)}</strong></article>
    <article><span>Weiterleitungen</span><strong>${asCount(stats.referralCount)}</strong></article>
    <article><span>Erstellungen</span><strong>${successfulJobs}</strong></article>
  </div>`;
}

function compatiblePlaces(trip, places) {
  const key = normalizePlaceKey(trip?.venue);
  if (!key) return [];
  return asArray(places).filter(place =>
    place?.active !== false
    && asArray(place?.keys).some(item => item?.placeKey === key)
  );
}

function renderTripCard(trip, model) {
  const places = asArray(model?.places);
  const binding = trip?.place;
  const latest = trip?.lastJob;
  const job = latest ? jobPresentation(latest.status) : null;
  const compatible = compatiblePlaces(trip, places);
  const shortlink = binding?.shortlinkPath
    ? `${publicBase(model?.environment)}${binding.shortlinkPath}`
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
    ${binding ? `<div class="m340-publishing-shortlink">
      <span>Dauerhafter Kurzlink</span>
      <a href="${escapeAttr(shortlink)}" target="_blank" rel="noopener noreferrer">${escapeHtml(shortlink)}</a>
      <small>Ort: ${escapeHtml(binding.displayName || binding.slug || "–")} · ${escapeHtml(binding.boundPlaceKey || "")}</small>
    </div>
    <div class="v4-row-actions m340-publishing-trip-actions">
      <button class="button small primary" type="button" data-m340-enqueue="${escapeAttr(trip.tripId)}">Flyer &amp; QR neu erstellen</button>
    </div>` : `<div class="notice warning m340-publishing-unbound">
      <strong>Noch kein Kurzlink zugeordnet</strong>
      <p>Der Veranstaltungsort muss zuerst mit einem dauerhaften Publishing-Ort verbunden werden.</p>
      ${compatible.length ? `<form class="m340-publishing-bind-form" data-m340-bind-form data-event-id="${escapeAttr(trip?.eventId || "")}">
        <label>Passender Ort
          <select name="placeId" required>
            ${compatible.map(place => `<option value="${escapeAttr(place.id)}">${escapeHtml(place.displayName)} · /ontour/${escapeHtml(place.slug)}</option>`).join("")}
          </select>
        </label>
        <button class="button small secondary" type="submit">Ort zuordnen</button>
      </form>` : `<small>Kein vorhandener Ort besitzt den Venue-Key <code>${escapeHtml(normalizePlaceKey(trip?.venue) || "–")}</code>.</small>`}
    </div>`}
    ${latest?.lastErrorCode ? `<div class="notice error"><strong>Letzter Fehler</strong><p>${escapeHtml(latest.lastErrorCode)}</p></div>` : ""}
  </article>`;
}

function renderPlaceCard(place) {
  const keys = asArray(place?.keys);
  const url = `https://plaerrdeifl.de/ontour/${place?.slug || ""}`;
  return `<article class="m340-publishing-card m340-publishing-place-card" data-m340-place="${escapeAttr(place?.id || "")}">
    <header class="m340-publishing-card-head">
      <div>
        <span class="m340-publishing-kicker">Dauerhafter Ort</span>
        <h3>${escapeHtml(place?.displayName || place?.slug || "Ort")}</h3>
        <p><code>/ontour/${escapeHtml(place?.slug || "")}</code></p>
      </div>
      <span class="badge ${place?.active === false ? "neutral" : "success"}">${place?.active === false ? "Inaktiv" : "Aktiv"}</span>
    </header>
    <div class="m340-publishing-place-stats">
      <span>${asCount(place?.landingCount)} Aufrufe</span>
      <span>${asCount(place?.referralCount)} Weiterleitungen</span>
    </div>
    <div class="m340-publishing-shortlink"><span>Produktiver Zielpfad</span><code>${escapeHtml(url)}</code></div>
    <div class="m340-publishing-keys">
      <strong>Venue-Keys</strong>
      ${keys.length ? `<ul>${keys.map(key => `<li><code>${escapeHtml(key.placeKey || "")}</code>${key.sourceLabel ? ` <span>${escapeHtml(key.sourceLabel)}</span>` : ""}</li>`).join("")}</ul>` : `<p class="subtle">Noch kein Venue-Key hinterlegt.</p>`}
    </div>
    <form class="m340-publishing-key-form" data-m340-key-form data-place-id="${escapeAttr(place?.id || "")}">
      <label>Weiteren Veranstaltungsort zuordnen
        <input name="sourceLabel" maxlength="240" required placeholder="z. B. Landsberg am Lech">
      </label>
      <button class="button small secondary" type="submit">Venue-Key hinzufügen</button>
    </form>
  </article>`;
}

function renderArtifacts(manifest) {
  const artifacts = asArray(manifest?.artifacts);
  if (!artifacts.length) return "";
  return `<div class="m340-publishing-artifacts">${artifacts.map(artifact => `<div>
    <strong>${escapeHtml(artifact?.kind || "Datei")}</strong>
    <code>${escapeHtml(artifact?.nextcloudPath || artifact?.filename || "")}</code>
  </div>`).join("")}</div>`;
}

function renderJob(job) {
  const state = jobPresentation(job?.status);
  return `<article class="m340-publishing-history-item">
    <div class="m340-publishing-history-head">
      <div><strong>${escapeHtml(job?.placeDisplayName || job?.placeSlug || "Publishing")}</strong><small>${escapeHtml(formatDateTime(job?.createdAt))}</small></div>
      <span class="badge ${escapeAttr(state.className)}">${escapeHtml(state.label)}</span>
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
  const places = asArray(model?.places);
  const jobs = asArray(model?.jobs);
  return `<section class="v4-m325-workspace m340-publishing-workspace">
    <header class="v4-m325-workspace-header">
      <button class="button small secondary" type="button" data-m340-back>Zurück</button>
      <div>
        <span class="m340-publishing-kicker">Fanbus</span>
        <h2>Flyer &amp; Kurzlinks</h2>
        <p>QR-Ziele, Flyer-Erstellung, Nextcloud-Ablage und anonyme Klickstatistik.</p>
      </div>
    </header>
    ${renderMetrics(model)}
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingTripsTitle">
      <div class="m340-publishing-section-head"><div><h3 id="m340PublishingTripsTitle">Fahrten veröffentlichen</h3><p>Der QR-Code verwendet immer den dauerhaften Ortslink.</p></div><span class="badge neutral">${escapeHtml(model?.environment || "–")}</span></div>
      <div class="m340-publishing-grid">${trips.length ? trips.map(trip => renderTripCard(trip, model)).join("") : empty("Keine veröffentlichte Fanbusfahrt verfügbar.")}</div>
    </section>
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingPlacesTitle">
      <div class="m340-publishing-section-head"><div><h3 id="m340PublishingPlacesTitle">Orte &amp; Kurzlinks</h3><p>Ein Slug bleibt dauerhaft gesperrt und wird später nicht umbenannt.</p></div></div>
      <form class="form-grid v4-smart-form m340-publishing-create-place" data-m340-place-form>
        <label>Anzeigename<input name="displayName" maxlength="160" required placeholder="z. B. Landsberg"></label>
        <label>Slug<input name="slug" maxlength="48" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required placeholder="landsberg"></label>
        <div class="v4-detail-actions v4-field-full"><button class="button small secondary" type="submit">Dauerhaften Ort anlegen</button></div>
      </form>
      <div class="m340-publishing-grid">${places.length ? places.map(renderPlaceCard).join("") : empty("Noch keine Publishing-Orte vorhanden.")}</div>
    </section>
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingHistoryTitle">
      <div class="m340-publishing-section-head"><div><h3 id="m340PublishingHistoryTitle">Erstellungshistorie</h3><p>Die letzten 50 Publishing-Jobs dieser Umgebung.</p></div></div>
      <div class="m340-publishing-history">${jobs.length ? jobs.map(renderJob).join("") : empty("Noch keine Flyer-Erstellung vorhanden.")}</div>
    </section>
    <section class="v4-m325-workspace-section" aria-labelledby="m340PublishingStatsTitle">
      <div class="m340-publishing-section-head"><div><h3 id="m340PublishingStatsTitle">Kurzlink-Statistik</h3><p>Ausschließlich anonyme Tagesaggregate, ohne IP, Cookies oder Geräteprofile.</p></div></div>
      ${renderDaily(model?.stats || {})}
    </section>
  </section>`;
}

async function loadOverview() {
  const model = await call("fanbus_publishing_overview", {});
  if (!model || typeof model !== "object") throw new Error("Publishing-Übersicht ist ungültig.");
  return model;
}

function bindWorkspace(panel, model, refresh) {
  panel.querySelector("[data-m340-back]")?.addEventListener("click", () => {
    window.location.hash = "#/fanbuses";
  });

  const createForm = panel.querySelector("[data-m340-place-form]");
  createForm?.elements?.displayName?.addEventListener("input", event => {
    const slug = createForm.elements.slug;
    if (slug && !slug.dataset.m340Touched) slug.value = normalizeSlug(event.target.value);
  });
  createForm?.elements?.slug?.addEventListener("input", event => {
    event.target.dataset.m340Touched = "true";
  });
  createForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const displayName = String(createForm.elements.displayName?.value || "").trim();
    const slug = String(createForm.elements.slug?.value || "").trim();
    if (!displayName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      showToast("Bitte Anzeigename und gültigen Slug angeben.", "warning", 5200);
      return;
    }
    try {
      await runWrite(
        () => call("fanbus_publishing_place_create", { slug, displayName }),
        "Dauerhafter Publishing-Ort angelegt."
      );
      await refresh();
    } catch (error) {
      showToast(error?.message || "Publishing-Ort konnte nicht angelegt werden.", "error", 6000);
    }
  });

  panel.querySelectorAll("[data-m340-key-form]").forEach(form => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const placeId = form.dataset.placeId || "";
      const sourceLabel = String(form.elements.sourceLabel?.value || "").trim();
      if (!placeId || !sourceLabel) return;
      try {
        await runWrite(
          () => call("fanbus_publishing_place_key_add", { placeId, sourceLabel }),
          "Venue-Key hinzugefügt."
        );
        await refresh();
      } catch (error) {
        showToast(error?.message || "Venue-Key konnte nicht hinzugefügt werden.", "error", 6000);
      }
    });
  });

  panel.querySelectorAll("[data-m340-bind-form]").forEach(form => {
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const eventId = form.dataset.eventId || "";
      const placeId = String(form.elements.placeId?.value || "");
      if (!eventId || !placeId) return;
      try {
        await runWrite(
          () => call("fanbus_publishing_event_place_bind", { eventId, placeId }),
          "Fanbusfahrt mit dauerhaftem Ortslink verbunden."
        );
        await refresh();
      } catch (error) {
        showToast(error?.message || "Ortslink konnte nicht zugeordnet werden.", "error", 6000);
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
    window.location.hash = "#/fanbuses";
    return;
  }
  if (summary) summary.textContent = "";
  panel.innerHTML = `<section class="v4-m325-workspace m340-publishing-workspace"><header class="v4-m325-workspace-header"><button class="button small secondary" type="button" data-m340-back>Zurück</button><div><h2>Flyer &amp; Kurzlinks</h2><p>Publishing-Daten werden geladen …</p></div></header></section>`;
  panel.querySelector("[data-m340-back]")?.addEventListener("click", () => {
    window.location.hash = "#/fanbuses";
  });

  const refresh = async () => {
    try {
      const model = await loadOverview();
      if (!panel.isConnected) return;
      panel.innerHTML = workspaceMarkup(model);
      bindWorkspace(panel, model, refresh);
    } catch (error) {
      if (!panel.isConnected) return;
      panel.innerHTML = `<section class="v4-m325-workspace m340-publishing-workspace"><header class="v4-m325-workspace-header"><button class="button small secondary" type="button" data-m340-back>Zurück</button><div><h2>Flyer &amp; Kurzlinks</h2></div></header>${errorPanel(error, "Publishing-Daten konnten nicht geladen werden")}</section>`;
      panel.querySelector("[data-m340-back]")?.addEventListener("click", () => {
        window.location.hash = "#/fanbuses";
      });
    }
  };

  await refresh();
}
