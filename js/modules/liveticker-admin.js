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

let snapshot = null;
let currentTeamId = "";

const POSITION_LABELS = Object.freeze({
  GOALIE: "Tor",
  DEFENSE: "Verteidigung",
  FORWARD: "Sturm"
});

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
    .v4-dialog .liveticker-admin-form select{
      width:100%!important;
      min-width:0!important;
      min-height:48px!important;
      padding:11px 12px!important;
      border:1px solid #aebdcd!important;
      border-radius:13px!important;
      background:#fff!important;
    }
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
    @media(max-width:430px){
      .v4-dialog .liveticker-admin-form{gap:12px!important}
      .v4-dialog .liveticker-admin-form input:not([type="checkbox"]),
      .v4-dialog .liveticker-admin-form select{min-height:50px!important}
      .v4-dialog .liveticker-admin-form .checkbox-row{min-height:48px!important}
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
      <div><span class="subtle">Liveticker-Team</span><h2>${escapeHtml(team.name)}</h2></div>
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

function render() {
  const toolbar = document.getElementById("livetickerRosterToolbar");
  const panel = document.getElementById("livetickerRosterPanel");
  if (!toolbar || !panel) return;

  const teams = snapshot?.teams || [];
  const currentTeam = teams.find(team => team.id === currentTeamId) || teams[0] || null;
  if (currentTeam && !currentTeamId) currentTeamId = currentTeam.id;

  toolbar.innerHTML = `<div class="v4-section-heading">
    <div><span class="subtle">Liveticker</span><h2>Teams & Kader</h2><p class="subtle">Zentrale Mannschaften und Spieler für den Spieltag.</p></div>
    <button class="button small primary" type="button" data-add-team>+ Team</button>
  </div>`;

  panel.innerHTML = teams.length
    ? `<div class="v4-team-layout">
        <div class="v4-team-list">${teams.map(teamListRow).join("")}</div>
        <div class="v4-team-detail-panel">${currentTeam ? teamDetail(currentTeam) : ""}</div>
      </div>`
    : '<div class="notice neutral">Noch keine Liveticker-Teams angelegt.</div>';

  toolbar.querySelector("[data-add-team]")?.addEventListener("click", () => openTeam());
  panel.querySelectorAll("[data-team-id]").forEach(button => {
    button.addEventListener("click", () => {
      currentTeamId = button.dataset.teamId || "";
      render();
    });
  });
  panel.querySelector("[data-edit-team]")?.addEventListener("click", () => currentTeam && openTeam(currentTeam));
  panel.querySelector("[data-add-player]")?.addEventListener("click", () => currentTeam && openPlayer(currentTeam));
  panel.querySelectorAll("[data-player-id]").forEach(button => {
    button.addEventListener("click", () => {
      if (!currentTeam) return;
      const player = (currentTeam.players || []).find(item => item.id === button.dataset.playerId);
      if (player) openPlayer(currentTeam, player);
    });
  });
}

export async function hydrateLivetickerAdmin(context = {}) {
  ensureLivetickerAdminStyles();
  const panel = document.getElementById("livetickerRosterPanel");
  if (panel) panel.innerHTML = loading("Teams und Kader werden geladen …");

  try {
    snapshot = await call("liveticker_teams_list");
    if (context.isCurrent && !context.isCurrent()) return;
    render();
  } catch (error) {
    if (context.isCurrent && !context.isCurrent()) return;
    if (panel) panel.innerHTML = errorPanel(error, "Liveticker-Teams konnten nicht geladen werden");
    showToast(error?.message || "Liveticker-Teams konnten nicht geladen werden.", "error", 6500);
  }
}

export function noop() {}
