import {
  call,
  errorPanel,
  escapeAttr,
  escapeHtml,
  loading,
  openDialog,
  optionList,
  runWrite,
  showToast
} from "./common.js";
import {
  LIVETICKER_TEMPLATE_CONTEXTS,
  LIVETICKER_TEMPLATE_VARIABLES,
  livetickerSafeTokenInsertionRange,
  planLivetickerProtectedEdit,
  templateToken,
  validateLivetickerTemplate
} from "../liveticker-output-templates.js?v=20260906-penalty3";

let snapshot = null;
let archiveSnapshot = null;
let templateSnapshot = null;
let currentTeamId = "";
let currentArchiveEventId = "";
let currentView = "teams";

const POSITION_LABELS = Object.freeze({
  GOALIE: "Tor",
  DEFENSE: "Verteidigung",
  FORWARD: "Sturm"
});

const OUTPUT_TEMPLATE_SECTIONS = Object.freeze([
  Object.freeze({
    key: "own",
    title: "Tore – Wir",
    description: "Ausgaben, wenn die Mighty Dogs treffen.",
    contexts: Object.freeze(["own"])
  }),
  Object.freeze({
    key: "own_penalty",
    title: "Strafen – Wir",
    description: "Ausgaben für eine oder mehrere Strafen der Mighty Dogs.",
    contexts: Object.freeze(["ownPenalty"])
  }),
  Object.freeze({
    key: "opponent",
    title: "Tore – Die anderen",
    description: "Ausgaben, wenn der Gegner trifft.",
    contexts: Object.freeze(["opponent"])
  }),
  Object.freeze({
    key: "opponent_penalty",
    title: "Strafen – Die anderen",
    description: "Ausgaben für eine oder mehrere Strafen des Gegners.",
    contexts: Object.freeze(["opponentPenalty"])
  })
]);

function ensureLivetickerAdminStyles() {
  if (document.querySelector("style[data-liveticker-admin-styles]")) return;
  const style = document.createElement("style");
  style.dataset.livetickerAdminStyles = "true";
  style.textContent = `
    .v4-dialog .liveticker-admin-form{
      display:grid!important;
      grid-template-columns:minmax(0,1fr)!important;
      gap:14px!important;
      width:100%!important;
      margin:0!important;
    }
    .v4-dialog .liveticker-admin-form>label{
      grid-column:1/-1!important;
      min-width:0!important;
      width:100%!important;
      max-width:none!important;
      contain:none!important;
    }
    .v4-dialog .liveticker-admin-form>label:not(.checkbox-row){
      display:grid!important;
      gap:6px!important;
      font-size:.82rem!important;
      font-weight:850!important;
      line-height:1.2!important;
    }
    .v4-dialog .liveticker-admin-form input:not([type="checkbox"]),
    .v4-dialog .liveticker-admin-form select,
    .v4-dialog .liveticker-admin-form textarea{
      width:100%!important;
      min-width:0!important;
      min-height:48px!important;
      padding:11px 12px!important;
      border:1px solid #aebdcd!important;
      border-radius:13px!important;
      background:#fff!important;
    }
    .v4-dialog .liveticker-admin-form textarea{
      min-height:190px!important;
      resize:vertical!important;
      font:500 .86rem/1.48 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;
      white-space:pre-wrap!important;
    }
    .v4-dialog .liveticker-output-template-form input:not([type="checkbox"]),
    .v4-dialog .liveticker-output-template-form textarea{
      font-size:16px!important;
    }
    .liveticker-template-key{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:10px 12px;
      border:1px solid #d7e2ee;
      border-radius:12px;
      background:#f7faff;
      font-size:.8rem;
    }
    .liveticker-template-key code{font-weight:900;color:#244e78}
    .liveticker-template-variables{display:grid;gap:7px}
    .liveticker-template-variables strong{font-size:.78rem}
    .liveticker-variable-chips{display:flex;flex-wrap:wrap;gap:7px}
    .liveticker-variable-chip{
      min-height:38px;
      padding:7px 9px;
      border:1px solid #b9cce0;
      border-radius:10px;
      background:#f5f9fd;
      color:#123e68;
      font:800 .72rem/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    }
    .liveticker-variable-chip.is-required{border-color:#7daee0;background:#eaf4ff}
    .liveticker-template-help,.liveticker-template-validation{
      margin:0;
      color:#60748a;
      font-size:.72rem;
      line-height:1.4;
    }
    .liveticker-template-validation[data-valid="false"]{color:#a22832;font-weight:800}
    .liveticker-template-sections{display:grid;gap:14px}
    .liveticker-template-section{
      overflow:hidden;
      border:1px solid #d7e2ee;
      border-radius:16px;
      background:#fff;
    }
    .liveticker-template-section-head{
      display:grid;
      gap:4px;
      padding:13px 14px;
      border-bottom:1px solid #e3eaf2;
      background:#f7faff;
    }
    .liveticker-template-section-head h3{margin:0;font-size:1rem}
    .liveticker-template-section-head p{margin:0;color:#60748a;font-size:.75rem;line-height:1.4}
    .liveticker-template-section .v4-team-list{border:0!important;border-radius:0!important}
    .v4-dialog .liveticker-admin-form .checkbox-row{
      display:grid!important;
      grid-template-columns:32px minmax(0,1fr)!important;
      align-items:center!important;
      gap:12px!important;
      min-height:46px!important;
      padding:2px 0!important;
      font-size:.84rem!important;
      font-weight:850!important;
      line-height:1.25!important;
      cursor:pointer;
    }
    .v4-dialog .liveticker-admin-form .checkbox-row>input[type="checkbox"]{
      appearance:auto!important;
      -webkit-appearance:checkbox!important;
      width:24px!important;
      height:24px!important;
      min-width:24px!important;
      min-height:24px!important;
      max-width:24px!important;
      margin:0!important;
      padding:0!important;
      justify-self:start!important;
      accent-color:#176fce;
    }
    .v4-dialog .liveticker-admin-form .checkbox-row>span{
      min-width:0!important;
    }
    .liveticker-archive-score-card{
      display:grid;
      justify-items:center;
      gap:5px;
      padding:18px 14px;
      margin-bottom:14px;
      border:1px solid #d7e2ee;
      border-radius:16px;
      background:#f7faff;
      text-align:center;
    }
    .liveticker-archive-score-card strong{
      font-size:2rem;
      line-height:1;
      letter-spacing:-.04em;
    }
    .liveticker-archive-score-card small{
      color:#60748a;
      font-weight:800;
    }
    .liveticker-archive-facts{
      display:grid;
      gap:0;
      margin-bottom:14px;
      border:1px solid #d7e2ee;
      border-radius:14px;
      overflow:hidden;
    }
    .liveticker-archive-fact{
      display:flex;
      justify-content:space-between;
      gap:14px;
      padding:10px 12px;
      background:#fff;
      border-bottom:1px solid #e3eaf2;
      font-size:.82rem;
    }
    .liveticker-archive-fact:last-child{border-bottom:0}
    .liveticker-archive-fact span{color:#60748a}
    .liveticker-archive-fact strong{text-align:right}
    @media(max-width:430px){
      .v4-dialog .liveticker-admin-form{gap:12px!important}
      .v4-dialog .liveticker-admin-form input:not([type="checkbox"]),
      .v4-dialog .liveticker-admin-form select{min-height:50px!important}
      .v4-dialog .liveticker-admin-form textarea{min-height:220px!important}
      .v4-dialog .liveticker-admin-form .checkbox-row{min-height:48px!important}
      .liveticker-variable-chip{min-height:42px}
    }
  `;
  document.head.appendChild(style);
}

function normalizeCheckbox(values, name) {
  return { ...values, [name]: values[name] === "on" };
}

function teamForm(team = {}) {
  return `<form class="liveticker-admin-form">
    <input type="hidden" name="id" value="${escapeAttr(team.id || "")}">
    <label>Teamname<input name="name" required maxlength="160" placeholder="z. B. Mighty Dogs Schweinfurt" value="${escapeAttr(team.name || "")}"></label>
    <label>Kurzname<input name="shortName" required maxlength="60" placeholder="z. B. Mighty Dogs" value="${escapeAttr(team.shortName || "")}"></label>
    <label>Logo-URL<input name="logoUrl" type="url" inputmode="url" placeholder="https://…" value="${escapeAttr(team.logoUrl || "")}"></label>
    <label class="checkbox-row"><input name="homeClub" type="checkbox" ${team.homeClub ? "checked" : ""}><span>Unser Verein / Heimverein</span></label>
    <label class="checkbox-row"><input name="active" type="checkbox" ${team.active !== false ? "checked" : ""}><span>Team ist aktiv</span></label>
  </form>`;
}

function playerForm(team, player = {}) {
  return `<form class="liveticker-admin-form">
    <input type="hidden" name="id" value="${escapeAttr(player.id || "")}">
    <input type="hidden" name="teamId" value="${escapeAttr(team.id)}">
    <label>Trikotnummer<input name="number" maxlength="8" inputmode="numeric" placeholder="z. B. 84" value="${escapeAttr(player.number || "")}"></label>
    <label>Position<select name="position" required>${optionList([
      { value: "GOALIE", label: "Tor" },
      { value: "DEFENSE", label: "Verteidigung" },
      { value: "FORWARD", label: "Sturm" }
    ], player.position || "FORWARD")}</select></label>
    <label>Name<input name="name" required maxlength="160" placeholder="Vorname Nachname" value="${escapeAttr(player.name || "")}"></label>
    <label class="checkbox-row"><input name="active" type="checkbox" ${player.active !== false ? "checked" : ""}><span>Spieler ist aktiv</span></label>
  </form>`;
}

function templateVariables(contextKey) {
  const context = LIVETICKER_TEMPLATE_CONTEXTS[contextKey];
  const serverVariables = Array.isArray(templateSnapshot?.variables)
    ? templateSnapshot.variables
    : LIVETICKER_TEMPLATE_VARIABLES;
  return serverVariables.filter(variable => (variable.contexts || []).includes(contextKey)).map(variable => ({
    ...variable,
    required: context.required.includes(variable.key)
  }));
}

function variableControls(contextKey, target) {
  const context = LIVETICKER_TEMPLATE_CONTEXTS[contextKey];
  const variables = templateVariables(contextKey);
  return `<div class="liveticker-template-variables">
    <strong>Verfügbare Platzhalter für ${escapeHtml(context.label)} · * Pflicht</strong>
    <div class="liveticker-variable-chips">${variables.map(variable => `<button class="liveticker-variable-chip${variable.required ? " is-required" : ""}" type="button" data-insert-variable="${escapeAttr(variable.key)}" data-template-target="${escapeAttr(target)}" title="${escapeAttr(variable.label || variable.key)}">${escapeHtml(templateToken(variable.key))}${variable.required ? " *" : ""}</button>`).join("")}</div>
  </div>`;
}

function outputTemplateField(template, contextKey) {
  const context = LIVETICKER_TEMPLATE_CONTEXTS[contextKey];
  const helpId = `${contextKey}TemplateHelp`;
  return `<label>Ausgabetext · ${escapeHtml(context.label)}<textarea name="${escapeAttr(context.field)}" required maxlength="4000" aria-describedby="${escapeAttr(helpId)}">${escapeHtml(template[context.field] || "")}</textarea></label>
    ${variableControls(contextKey, context.field)}
    <p id="${escapeAttr(helpId)}" class="liveticker-template-help">Technische Namen sind geschützt. Rücktaste oder Entfernen löscht einen Platzhalter immer vollständig; unbekannte oder fehlende Pflichtplatzhalter werden nicht gespeichert.</p>
    <p class="liveticker-template-validation" data-template-validation="${escapeAttr(contextKey)}" data-valid="true"></p>`;
}

function outputTemplateForm(template, section) {
  return `<form class="liveticker-admin-form liveticker-output-template-form">
    <div class="liveticker-template-key"><span>Technischer Key · nicht editierbar</span><code>${escapeHtml(template.key)}</code></div>
    <label>Sichtbarer Titel<input name="title" required maxlength="60" value="${escapeAttr(template.title || "")}"></label>
    ${section.contexts.map(contextKey => outputTemplateField(template, contextKey)).join("")}
  </form>`;
}

function bindProtectedTemplateField(field) {
  let pendingFallback = null;

  field.addEventListener("beforeinput", event => {
    const plan = planLivetickerProtectedEdit(
      field.value,
      field.selectionStart,
      field.selectionEnd,
      event.inputType
    );
    if (plan.action === "allow") return;

    if (!event.cancelable) {
      pendingFallback = { plan, value: field.value };
      return;
    }

    event.preventDefault();
    if (plan.action === "delete") {
      field.setRangeText("", plan.start, plan.end, "end");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    field.setSelectionRange(plan.start, plan.end);
  });

  field.addEventListener("input", () => {
    if (!pendingFallback) return;
    const { plan, value } = pendingFallback;
    pendingFallback = null;
    field.value = plan.action === "delete"
      ? `${value.slice(0, plan.start)}${value.slice(plan.end)}`
      : value;
    field.setSelectionRange(plan.start, plan.start);
  });
}

function bindOutputTemplateForm(dialog, contextKeys) {
  const form = dialog.querySelector(".liveticker-output-template-form");
  if (!form) return;

  for (const contextKey of contextKeys) {
    const context = LIVETICKER_TEMPLATE_CONTEXTS[contextKey];
    const field = form.elements.namedItem(context.field);
    if (field instanceof HTMLTextAreaElement) bindProtectedTemplateField(field);
  }

  function validateField(contextKey) {
    const context = LIVETICKER_TEMPLATE_CONTEXTS[contextKey];
    const field = form.elements.namedItem(context.field);
    const message = form.querySelector(`[data-template-validation='${contextKey}']`);
    if (!(field instanceof HTMLTextAreaElement)) return;
    const result = validateLivetickerTemplate(field.value, contextKey);
    field.setCustomValidity(result.errors.join(" "));
    if (message) {
      message.dataset.valid = String(result.valid);
      message.textContent = result.valid ? "Alle Pflichtplatzhalter vorhanden." : result.errors.join(" ");
    }
  }

  for (const contextKey of contextKeys) {
    const context = LIVETICKER_TEMPLATE_CONTEXTS[contextKey];
    const field = form.elements.namedItem(context.field);
    field?.addEventListener("input", () => validateField(contextKey));
    validateField(contextKey);
  }

  form.querySelectorAll("[data-insert-variable]").forEach(button => {
    button.addEventListener("click", () => {
      const field = form.elements.namedItem(button.dataset.templateTarget || "");
      if (!(field instanceof HTMLTextAreaElement)) return;
      const token = templateToken(button.dataset.insertVariable || "");
      const range = livetickerSafeTokenInsertionRange(
        field.value,
        field.selectionStart,
        field.selectionEnd
      );
      field.setRangeText(token, range.start, range.end, "end");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.focus({ preventScroll: true });
    });
  });
}

function openOutputTemplate(template, section, optionNumber) {
  const dialog = openDialog({
    title: `${section.title} · Option ${optionNumber}`,
    kicker: `Liveticker · Editor · ${template.title || "Ausgabeoption"}`,
    body: outputTemplateForm(template, section),
    submitLabel: "Option speichern",
    onSubmit: async values => {
      const errors = section.contexts.flatMap(contextKey => {
        const context = LIVETICKER_TEMPLATE_CONTEXTS[contextKey];
        return validateLivetickerTemplate(values[context.field], contextKey).errors;
      });
      if (errors.length) throw new Error([...new Set(errors)].join(" "));

      const payload = {
        key: template.key,
        context: section.key,
        title: values.title,
        expectedRevision: template.revision
      };
      for (const contextKey of section.contexts) {
        const context = LIVETICKER_TEMPLATE_CONTEXTS[contextKey];
        payload[context.field] = values[context.field];
      }

      templateSnapshot = await runWrite(
        () => call("liveticker_output_template_save", payload),
        "Ausgabeoption wurde aktualisiert."
      );
      render();
    }
  });
  bindOutputTemplateForm(dialog, section.contexts);
}

function openTeam(team = null) {
  openDialog({
    title: team ? "Team bearbeiten" : "Team anlegen",
    kicker: "Liveticker · Teams",
    body: teamForm(team || {}),
    onSubmit: async values => {
      let payload = normalizeCheckbox(values, "homeClub");
      payload = normalizeCheckbox(payload, "active");
      if (team) payload.expectedRevision = team.revision;
      snapshot = await runWrite(
        () => call("liveticker_team_save", payload),
        team ? "Team wurde aktualisiert." : "Team wurde angelegt."
      );
      currentTeamId = payload.id || snapshot?.teams?.find(item => item.name === payload.name)?.id || currentTeamId;
      render();
    }
  });
}

function openPlayer(team, player = null) {
  openDialog({
    title: player ? "Spieler bearbeiten" : "Spieler hinzufügen",
    kicker: team.shortName || team.name,
    body: playerForm(team, player || {}),
    onSubmit: async values => {
      const payload = normalizeCheckbox(values, "active");
      if (player) payload.expectedRevision = player.revision;
      snapshot = await runWrite(
        () => call("liveticker_player_save", payload),
        player ? "Spieler wurde aktualisiert." : "Spieler wurde hinzugefügt."
      );
      currentTeamId = team.id;
      render();
    }
  });
}

function playerRow(team, player) {
  const number = player.number ? `#${escapeHtml(player.number)}` : "–";
  return `<button class="v4-team-member-row is-actionable" type="button" data-player-id="${escapeAttr(player.id)}">
    <span class="v4-team-member-copy">
      <strong>${number} ${escapeHtml(player.name)}</strong>
      <small>${escapeHtml(POSITION_LABELS[player.position] || player.position)}${player.active ? "" : " · inaktiv"}</small>
    </span>
    <span class="v4-row-chevron" aria-hidden="true">›</span>
  </button>`;
}

function groupPlayers(team, position) {
  const players = (team.players || []).filter(player => player.position === position);
  if (!players.length) return "";
  return `<section class="v4-team-detail-section">
    <h3>${escapeHtml(POSITION_LABELS[position])}</h3>
    <div class="v4-team-member-list">${players.map(player => playerRow(team, player)).join("")}</div>
  </section>`;
}

function teamListRow(team) {
  const activePlayers = (team.players || []).filter(player => player.active).length;
  return `<button class="v4-team-list-row" type="button" data-team-id="${escapeAttr(team.id)}">
    <span>
      <strong>${escapeHtml(team.shortName || team.name)}${team.homeClub ? " · 🏠" : ""}</strong>
      <small>${activePlayers} aktive Spieler${team.active ? "" : " · Team inaktiv"}</small>
    </span>
    <span class="v4-row-chevron" aria-hidden="true">›</span>
  </button>`;
}

function teamDetail(team) {
  return `<div class="v4-team-detail">
    <div class="v4-section-heading">
      <div><span class="subtle">Teamverwaltung</span><h2>Kader</h2></div>
      <div class="button-row">
        <button class="button small secondary" type="button" data-edit-team>Team bearbeiten</button>
        <button class="button small primary" type="button" data-add-player>+ Spieler</button>
      </div>
    </div>
    ${team.logoUrl ? `<p class="subtle">Logo: ${escapeHtml(team.logoUrl)}</p>` : ""}
    ${groupPlayers(team, "GOALIE")}
    ${groupPlayers(team, "DEFENSE")}
    ${groupPlayers(team, "FORWARD")}
    ${(team.players || []).length ? "" : '<div class="notice neutral">Noch keine Spieler angelegt.</div>'}
  </div>`;
}

function bindTeamDetail(panel, team) {
  panel.querySelector("[data-edit-team]")?.addEventListener("click", () => openTeam(team));
  panel.querySelector("[data-add-player]")?.addEventListener("click", () => openPlayer(team));
  panel.querySelectorAll("[data-player-id]").forEach(button => {
    button.addEventListener("click", () => {
      const player = (team.players || []).find(item => item.id === button.dataset.playerId);
      if (player) openPlayer(team, player);
    });
  });
}

function archiveDate(value) {
  if (!value) return "–";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function archiveCompletedAt(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function archiveScore(game) {
  const own = Number(game.ownScore || 0);
  const opponent = Number(game.opponentScore || 0);
  return game.homeAway === "AWAY" ? `${opponent}:${own}` : `${own}:${opponent}`;
}

function archiveScoreLabel(game) {
  const suffix = String(game.suffix || "").trim();
  return `${archiveScore(game)}${suffix ? ` ${suffix}` : ""}`;
}

function archiveRow(game) {
  return `<button class="v4-team-list-row" type="button" data-archive-event-id="${escapeAttr(game.eventId)}">
    <span>
      <strong>${escapeHtml(game.displayTitle || "Spiel")}</strong>
      <small>${escapeHtml(archiveDate(game.eventDate))} · Endstand ${escapeHtml(archiveScoreLabel(game))}</small>
    </span>
    <span class="v4-row-chevron" aria-hidden="true">›</span>
  </button>`;
}

function archiveDetail(game) {
  const venue = String(game.venue || "").trim() || "–";
  return `<div class="liveticker-archive-detail">
    <div class="liveticker-archive-score-card">
      <span class="subtle">Endstand</span>
      <strong>${escapeHtml(archiveScoreLabel(game))}</strong>
      <small>${escapeHtml(game.displayTitle || "Spiel")}</small>
    </div>
    <div class="liveticker-archive-facts">
      <div class="liveticker-archive-fact"><span>Spieltag</span><strong>${escapeHtml(archiveDate(game.eventDate))}</strong></div>
      <div class="liveticker-archive-fact"><span>Abgeschlossen</span><strong>${escapeHtml(archiveCompletedAt(game.completedAt))}</strong></div>
      <div class="liveticker-archive-fact"><span>Letzte Spielminute</span><strong>${escapeHtml(game.minute || 1)}</strong></div>
      <div class="liveticker-archive-fact"><span>Tore erfasst</span><strong>${escapeHtml(game.goalCount || 0)}</strong></div>
      <div class="liveticker-archive-fact"><span>Strafen erfasst</span><strong>${escapeHtml(game.penaltyCount || 0)}</strong></div>
      <div class="liveticker-archive-fact"><span>Spielort</span><strong>${escapeHtml(venue)}</strong></div>
    </div>
    <div class="button-row">
      <button class="button danger" type="button" data-reset-archive-game>Spiel zurücksetzen</button>
    </div>
  </div>`;
}

function confirmArchiveReset(game) {
  openDialog({
    title: "Spiel zurücksetzen?",
    kicker: game.displayTitle || "Liveticker · Archiv",
    body: `<div class="notice warning"><strong>Der gespeicherte Spielstand wird geleert.</strong><p>Tore, Strafen, Penaltyschießen und Spielminute werden zurückgesetzt. Das Kalenderspiel selbst bleibt bestehen und kann danach erneut getickert werden.</p></div>`,
    submitLabel: "Spiel zurücksetzen",
    danger: true,
    onSubmit: async () => {
      archiveSnapshot = await runWrite(
        () => call("liveticker_game_reset", {
          eventId: game.eventId,
          expectedRevision: game.revision
        }),
        "Spiel wurde zurückgesetzt."
      );
      currentArchiveEventId = "";
      render();
    }
  });
}

async function showArchive() {
  currentView = "archive";
  currentTeamId = "";
  currentArchiveEventId = "";
  archiveSnapshot = null;
  render();

  try {
    archiveSnapshot = await call("liveticker_archive_list");
    render();
  } catch (error) {
    const panel = document.getElementById("livetickerRosterPanel");
    if (panel) panel.innerHTML = errorPanel(error, "Spielarchiv konnte nicht geladen werden");
    showToast(error?.message || "Spielarchiv konnte nicht geladen werden.", "error", 6500);
  }
}

function renderArchive(toolbar, panel) {
  const games = archiveSnapshot?.games || [];
  const currentGame = currentArchiveEventId
    ? games.find(game => game.eventId === currentArchiveEventId) || null
    : null;

  if (currentArchiveEventId && !currentGame) currentArchiveEventId = "";

  if (currentGame) {
    toolbar.innerHTML = `<div class="v4-section-heading">
      <div><span class="subtle">Liveticker · Archiv</span><h2>${escapeHtml(currentGame.displayTitle || "Spiel")}</h2><p class="subtle">Abgeschlossenes Spiel ansehen oder zurücksetzen.</p></div>
      <button class="button small secondary" type="button" data-back-archive>← Archiv</button>
    </div>`;
    panel.innerHTML = archiveDetail(currentGame);
    toolbar.querySelector("[data-back-archive]")?.addEventListener("click", () => {
      currentArchiveEventId = "";
      render();
    });
    panel.querySelector("[data-reset-archive-game]")?.addEventListener("click", () => confirmArchiveReset(currentGame));
    return;
  }

  toolbar.innerHTML = `<div class="v4-section-heading">
    <div><span class="subtle">Liveticker</span><h2>Spielarchiv</h2><p class="subtle">Abgeschlossene Liveticker-Spiele.</p></div>
    <button class="button small secondary" type="button" data-back-teams>← Teams</button>
  </div>`;

  if (!archiveSnapshot) {
    panel.innerHTML = loading("Spielarchiv wird geladen …");
  } else {
    panel.innerHTML = games.length
      ? `<div class="v4-team-list">${games.map(archiveRow).join("")}</div>`
      : '<div class="notice neutral">Noch keine abgeschlossenen Spiele im Liveticker-Archiv.</div>';
  }

  toolbar.querySelector("[data-back-teams]")?.addEventListener("click", () => {
    currentView = "teams";
    currentArchiveEventId = "";
    render();
  });
  panel.querySelectorAll("[data-archive-event-id]").forEach(button => {
    button.addEventListener("click", () => {
      currentArchiveEventId = button.dataset.archiveEventId || "";
      render();
    });
  });
}

function outputTemplateRow(template, optionNumber, section) {
  return `<button class="v4-team-list-row" type="button" data-template-key="${escapeAttr(template.key)}" data-template-context="${escapeAttr(section.key)}">
    <span>
      <strong>Option ${escapeHtml(optionNumber)}</strong>
      <small>${escapeHtml(template.title)} · Technischer Key: ${escapeHtml(template.key)} · Version ${escapeHtml(template.revision)}</small>
    </span>
    <span class="v4-row-chevron" aria-hidden="true">›</span>
  </button>`;
}

function outputTemplateSection(section, templates) {
  return `<section class="liveticker-template-section" data-template-section="${escapeAttr(section.key)}">
    <div class="liveticker-template-section-head">
      <h3>${escapeHtml(section.title)}</h3>
      <p>${escapeHtml(section.description)}</p>
    </div>
    <div class="v4-team-list">${templates.map((template, index) => outputTemplateRow(template, index + 1, section)).join("")}</div>
  </section>`;
}

function renderOutputTemplates(toolbar, panel) {
  const templates = templateSnapshot?.templates || [];
  toolbar.innerHTML = `<div class="v4-section-heading">
    <div><span class="subtle">Liveticker · Editor</span><h2>Liveticker-Editor</h2><p class="subtle">Texte nach Ereignistyp und Option bearbeiten.</p></div>
    <button class="button small secondary" type="button" data-back-teams>← Teams</button>
  </div>`;
  panel.innerHTML = templates.length
    ? `<div class="liveticker-template-sections">${OUTPUT_TEMPLATE_SECTIONS.map(section => outputTemplateSection(section, templates)).join("")}</div>`
    : '<div class="notice warning">Keine Ausgabeoptionen verfügbar.</div>';

  toolbar.querySelector("[data-back-teams]")?.addEventListener("click", () => {
    currentView = "teams";
    render();
  });
  panel.querySelectorAll("[data-template-key]").forEach(button => {
    button.addEventListener("click", () => {
      const template = templates.find(item => item.key === button.dataset.templateKey);
      const section = OUTPUT_TEMPLATE_SECTIONS.find(item => item.key === button.dataset.templateContext);
      const optionNumber = templates.findIndex(item => item.key === button.dataset.templateKey) + 1;
      if (template && section && optionNumber > 0) openOutputTemplate(template, section, optionNumber);
    });
  });
}

function render() {
  const toolbar = document.getElementById("livetickerRosterToolbar");
  const panel = document.getElementById("livetickerRosterPanel");
  if (!toolbar || !panel) return;

  if (currentView === "archive") {
    renderArchive(toolbar, panel);
    return;
  }
  if (currentView === "templates") {
    renderOutputTemplates(toolbar, panel);
    return;
  }

  const teams = snapshot?.teams || [];
  const currentTeam = currentTeamId
    ? teams.find(team => team.id === currentTeamId) || null
    : null;

  if (currentTeamId && !currentTeam) currentTeamId = "";

  if (currentTeam) {
    toolbar.innerHTML = `<div class="v4-section-heading">
      <div><span class="subtle">Liveticker · Teams & Kader</span><h2>${escapeHtml(currentTeam.name)}</h2><p class="subtle">Mannschaft und Kader bearbeiten.</p></div>
      <button class="button small secondary" type="button" data-back-teams>← Zurück</button>
    </div>`;
    panel.innerHTML = teamDetail(currentTeam);

    toolbar.querySelector("[data-back-teams]")?.addEventListener("click", () => {
      currentTeamId = "";
      render();
    });
    bindTeamDetail(panel, currentTeam);
    return;
  }

  toolbar.innerHTML = `<div class="v4-section-heading">
    <div><span class="subtle">Liveticker</span><h2>Teams & Kader</h2><p class="subtle">Team auswählen oder neu anlegen.</p></div>
    <div class="button-row">
      <a class="button small secondary" href="./liveticker/" target="_blank" rel="noopener noreferrer">Ticker öffnen ↗</a>
      <button class="button small secondary" type="button" data-open-templates>Editor</button>
      <button class="button small secondary" type="button" data-open-archive>Archiv</button>
      <button class="button small primary" type="button" data-add-team>+ Team</button>
    </div>
  </div>`;

  panel.innerHTML = teams.length
    ? `<div class="v4-team-list">${teams.map(teamListRow).join("")}</div>`
    : '<div class="notice neutral">Noch keine Liveticker-Teams angelegt.</div>';

  toolbar.querySelector("[data-open-templates]")?.addEventListener("click", () => {
    currentView = "templates";
    currentTeamId = "";
    render();
  });
  toolbar.querySelector("[data-open-archive]")?.addEventListener("click", () => showArchive());
  toolbar.querySelector("[data-add-team]")?.addEventListener("click", () => openTeam());
  panel.querySelectorAll("[data-team-id]").forEach(button => {
    button.addEventListener("click", () => {
      currentTeamId = button.dataset.teamId || "";
      render();
    });
  });
}

export async function hydrateLivetickerAdmin(context = {}) {
  ensureLivetickerAdminStyles();
  currentView = "teams";
  currentTeamId = "";
  currentArchiveEventId = "";
  archiveSnapshot = null;
  templateSnapshot = null;
  const panel = document.getElementById("livetickerRosterPanel");
  if (panel) panel.innerHTML = loading("Liveticker-Verwaltung wird geladen …");

  try {
    [snapshot, templateSnapshot] = await Promise.all([
      call("liveticker_teams_list"),
      call("liveticker_output_templates_list")
    ]);
    if (context.isCurrent && !context.isCurrent()) return;
    render();
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    if (panel) panel.innerHTML = errorPanel(error, "Liveticker-Verwaltung konnte nicht geladen werden");
    showToast(error?.message || "Liveticker-Verwaltung konnte nicht geladen werden.", "error", 6500);
  }
}

export function noop() {}
