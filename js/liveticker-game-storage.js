const STATE_KEY = "plaerrdeifl.livetickerPrototype.v3";
const SELECTED_EVENT_KEY = "plaerrdeifl.livetickerPrototype.eventId";
const VENUE_KEY = "plaerrdeifl.livetickerPrototype.venue";
const CLIENT_KEY = "plaerrdeifl.livetickerPrototype.clientId";

let config = null;
let selectedGame = null;
let serverState = null;
let syncing = false;
let applyingRemote = false;
let pollTimer = null;

function runtimeConfig() {
  const value = window.PD_RUNTIME_CONFIG || {};
  if (!value.supabaseUrl || !value.supabasePublishableKey || value.environment !== "DEV") {
    throw new Error("DEV-Liveticker ist nicht korrekt konfiguriert.");
  }
  return value;
}

function clientId() {
  try {
    const existing = localStorage.getItem(CLIENT_KEY);
    if (existing) return existing;
    const created = typeof crypto?.randomUUID === "function"
      ? `dev-${crypto.randomUUID()}`
      : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(CLIENT_KEY, created);
    return created;
  } catch {
    return `dev-${Date.now()}`;
  }
}

async function rpc(name, body = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: config.supabasePublishableKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.hint || `RPC ${name} fehlgeschlagen.`);
    error.status = response.status;
    error.code = data?.code || "";
    throw error;
  }
  return data;
}

function normalizeState(raw) {
  return {
    eventId: raw?.eventId || raw?.event_id || "",
    revision: Number(raw?.revision || 0),
    minute: Math.max(1, Number(raw?.minute || 1)),
    history: Array.isArray(raw?.history) ? raw.history : []
  };
}

function writeEngineState(state) {
  const engineState = {
    opponentId: "erfurt",
    minute: state.minute,
    history: state.history
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(engineState));
}

function applyRemoteState(raw) {
  const next = normalizeState(raw);
  serverState = next;
  applyingRemote = true;
  try {
    writeEngineState(next);
  } finally {
    applyingRemote = false;
  }
  renderSyncStatus("Gespeichert", "success");
}

function historyMap(history) {
  return new Map((history || []).map(item => [item.id, item]));
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffChanges(localState) {
  const previous = historyMap(serverState?.history || []);
  const current = historyMap(localState.history || []);
  const upserts = [];
  const deletes = [];

  for (const [id, item] of current) {
    if (!previous.has(id) || !sameJson(previous.get(id), item)) upserts.push(item);
  }
  for (const id of previous.keys()) {
    if (!current.has(id)) deletes.push(id);
  }

  const changes = {};
  if (upserts.length) changes.upserts = upserts;
  if (deletes.length) changes.deletes = deletes;
  if (Number(localState.minute || 1) !== Number(serverState?.minute || 1)) changes.minute = Number(localState.minute || 1);
  return changes;
}

function hasChanges(changes) {
  return Object.keys(changes).length > 0;
}

async function syncLocalState(localState) {
  if (!selectedGame || syncing || applyingRemote || !serverState) return;
  const changes = diffChanges(localState);
  if (!hasChanges(changes)) return;

  syncing = true;
  renderSyncStatus("Speichert …", "pending");
  try {
    let result;
    try {
      result = await rpc("pd_public_liveticker_sync", {
        p_event_id: selectedGame.eventId,
        p_expected_revision: serverState.revision,
        p_changes: changes,
        p_client_id: clientId()
      });
    } catch (error) {
      if (error.code !== "40001") throw error;
      const fresh = await rpc("pd_public_liveticker_state", { p_event_id: selectedGame.eventId });
      serverState = normalizeState(fresh);
      const retryChanges = diffChanges(localState);
      if (!hasChanges(retryChanges)) {
        applyRemoteState(fresh);
        return;
      }
      result = await rpc("pd_public_liveticker_sync", {
        p_event_id: selectedGame.eventId,
        p_expected_revision: serverState.revision,
        p_changes: retryChanges,
        p_client_id: clientId()
      });
    }
    applyRemoteState(result);
  } catch (error) {
    console.error(error);
    renderSyncStatus("Speicherfehler", "error");
  } finally {
    syncing = false;
  }
}

function readEngineState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    return parsed && Array.isArray(parsed.history) ? parsed : null;
  } catch {
    return null;
  }
}

function renderSyncStatus(text, state = "success") {
  const node = document.querySelector("#livetickerSyncStatus");
  if (!node) return;
  node.textContent = text;
  node.dataset.state = state;
}

function formatGameLabel(game) {
  const date = new Date(`${game.eventDate}T12:00:00`);
  const dateLabel = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date);
  const time = String(game.eventTime || "").slice(0, 5);
  return `${dateLabel}${time ? ` · ${time}` : ""} · ${game.displayTitle}`;
}

function installGameSelector(games) {
  const gameMeta = document.querySelector(".game-meta");
  if (!gameMeta) return null;
  const field = document.createElement("div");
  field.className = "field liveticker-game-field";
  field.innerHTML = `<label class="label" for="gameSelect">Spiel</label><select id="gameSelect"></select><small id="livetickerSyncStatus" class="liveticker-sync-status" data-state="pending">Lädt …</small>`;
  gameMeta.parentNode.insertBefore(field, gameMeta);
  const select = field.querySelector("#gameSelect");
  games.forEach(game => select.append(new Option(formatGameLabel(game), game.eventId)));
  return select;
}

function installStyles() {
  const style = document.createElement("style");
  style.textContent = `.liveticker-game-field{margin-bottom:9px}.liveticker-sync-status{display:block;margin-top:5px;font-size:.72rem;font-weight:850;color:var(--muted)}.liveticker-sync-status[data-state="success"]{color:var(--green)}.liveticker-sync-status[data-state="error"]{color:var(--red)}.liveticker-sync-status[data-state="pending"]{color:#8a5900}`;
  document.head.append(style);
}

async function loadSelectedGame(game) {
  selectedGame = game;
  localStorage.setItem(SELECTED_EVENT_KEY, game.eventId);
  localStorage.setItem(VENUE_KEY, game.homeAway === "AWAY" ? "away" : "home");
  renderSyncStatus("Lädt …", "pending");
  const state = await rpc("pd_public_liveticker_state", { p_event_id: game.eventId });
  applyRemoteState(state);
}

async function poll() {
  if (!selectedGame || syncing || document.hidden) return;
  try {
    const fresh = await rpc("pd_public_liveticker_state", { p_event_id: selectedGame.eventId });
    const normalized = normalizeState(fresh);
    if (!serverState || normalized.revision !== serverState.revision) {
      applyRemoteState(fresh);
      window.location.reload();
    }
  } catch (error) {
    console.error(error);
    renderSyncStatus("Verbindung prüfen", "error");
  }
}

export async function prepareLivetickerGameStorage() {
  config = runtimeConfig();
  installStyles();
  const response = await rpc("pd_public_liveticker_games");
  const games = Array.isArray(response?.games) ? response.games : [];
  if (!games.length) throw new Error("Kein Liveticker-Spiel mit gepflegtem Gegner/Kader verfügbar.");

  const gameSelect = installGameSelector(games);
  const remembered = localStorage.getItem(SELECTED_EVENT_KEY);
  const chosen = games.find(game => game.eventId === remembered) || games[0];
  if (gameSelect) gameSelect.value = chosen.eventId;
  await loadSelectedGame(chosen);

  window.addEventListener("pd-liveticker-state-saved", event => {
    const localState = event.detail?.state || readEngineState();
    if (localState) queueMicrotask(() => syncLocalState(localState));
  });

  gameSelect?.addEventListener("change", async () => {
    const game = games.find(item => item.eventId === gameSelect.value);
    if (!game) return;
    await loadSelectedGame(game);
    window.location.reload();
  });

  pollTimer = window.setInterval(poll, 3000);
  window.addEventListener("pagehide", () => { if (pollTimer) clearInterval(pollTimer); }, { once: true });

  return { games, selectedGame: chosen, state: serverState };
}
