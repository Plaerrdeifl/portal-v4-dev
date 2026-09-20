import { auth } from "./auth.js";
import { getSupabaseClient } from "./supabase-client.js";
import { normalizeLivetickerTemplateSnapshot } from "./liveticker-output-templates.js?v=20260919-textsystem-v2";

const STATE_KEY = "plaerrdeifl.livetickerPrototype.v3";
const SELECTED_EVENT_KEY = "plaerrdeifl.livetickerPrototype.eventId";
const VENUE_KEY = "plaerrdeifl.livetickerPrototype.venue";
const CLIENT_KEY = "plaerrdeifl.livetickerPrototype.clientId";
const WHATSAPP_WAKE_TOPIC = "liveticker-whatsapp-jobs";
const SUPPORTED_ENVIRONMENTS = new Set(["DEV", "PROD"]);
const LIVETICKER_REVISION_CONFLICT_CODE = "PT409";
const SYNC_CIRCUIT_WINDOW_MS = 5000;
const SYNC_CIRCUIT_MAX_SAVES = 20;

let config = null;
let selectedGame = null;
let serverState = null;
let clientState = null;
let syncing = false;
let applyingRemote = false;
let pendingLocalState = null;
let pollTimer = null;
let templatePollTimer = null;
let completing = false;
let templateSignature = "";

function createSyncCircuitBreaker({ windowMs = SYNC_CIRCUIT_WINDOW_MS, maxSaves = SYNC_CIRCUIT_MAX_SAVES } = {}) {
  let timestamps = [];
  let open = false;
  return {
    register(now = Date.now()) {
      if (open) return true;
      const cutoff = Number(now) - windowMs;
      timestamps = timestamps.filter(timestamp => timestamp >= cutoff);
      timestamps.push(Number(now));
      if (timestamps.length > maxSaves) open = true;
      return open;
    },
    isOpen() {
      return open;
    },
    reset() {
      timestamps = [];
      open = false;
    }
  };
}

const syncCircuitBreaker = createSyncCircuitBreaker();

function runtimeConfig() {
  const value = window.PD_RUNTIME_CONFIG || {};
  const environment = String(value.environment || "").trim().toUpperCase();
  if (!value.supabaseUrl || !value.supabasePublishableKey || !SUPPORTED_ENVIRONMENTS.has(environment)) {
    throw new Error("Liveticker ist nicht korrekt konfiguriert.");
  }
  const badge = document.querySelector(".dev-badge");
  if (badge) badge.textContent = `${environment} · INTERN`;
  return { ...value, environment };
}

function clientId() {
  const environmentPrefix = String(config?.environment || "DEV").toLowerCase();
  try {
    const existing = localStorage.getItem(CLIENT_KEY);
    if (existing?.startsWith(`${environmentPrefix}-`)) return existing;
    const created = typeof crypto?.randomUUID === "function"
      ? `${environmentPrefix}-${crypto.randomUUID()}`
      : `${environmentPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(CLIENT_KEY, created);
    return created;
  } catch {
    return `${environmentPrefix}-${Date.now()}`;
  }
}

function requireAuthorizedUser() {
  const state = auth.current();
  if (!state?.authenticated || state.status !== "ACTIVE" || !auth.hasCapability("liveticker.manage")) {
    throw new Error("Keine Berechtigung für den Liveticker.");
  }
}

async function bearerToken() {
  requireAuthorizedUser();
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !token) throw new Error("Anmeldung erforderlich.");
  return token;
}

async function rpc(name, body = {}) {
  const token = await bearerToken();
  const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: config.supabasePublishableKey,
      Authorization: `Bearer ${token}`,
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

function hasWhatsappPublishIntent(changes) {
  return Array.isArray(changes?.upserts)
    && changes.upserts.some(item => item?._whatsapp?.publish === true);
}

async function broadcastWhatsappWake() {
  const client = getSupabaseClient();
  const channel = client.channel(WHATSAPP_WAKE_TOPIC);
  try {
    await channel.httpSend("wake", {});
  } catch (error) {
    // The durable outbox is already committed. A failed wake only delays the
    // worker until its recovery poll; it must never turn a saved ticker action
    // into a visible save error for the operator.
    console.warn("WhatsApp-Worker konnte nicht sofort geweckt werden.", error);
  } finally {
    try {
      await client.removeChannel(channel);
    } catch {}
  }
}

function opponentKey(game) {
  return game?.opponentTeam?.id || `calendar:${game?.eventId || "opponent"}`;
}

function exposeGameContext(game) {
  if (!game) return;
  window.PD_LIVETICKER_GAME_CONTEXT = {
    eventId: game.eventId,
    homeAway: game.homeAway,
    ownTeam: game.ownTeam || null,
    opponentTeam: game.opponentTeam || null,
    opponentKey: opponentKey(game)
  };
}

function normalizeState(raw) {
  return {
    eventId: raw?.eventId || raw?.event_id || "",
    revision: Number(raw?.revision || 0),
    minute: Math.max(1, Number(raw?.minute || 1)),
    history: Array.isArray(raw?.history) ? raw.history : [],
    completedAt: raw?.completedAt || raw?.completed_at || null
  };
}

function writeEngineState(state) {
  exposeGameContext(selectedGame);
  const engineState = {
    opponentId: opponentKey(selectedGame),
    minute: state.minute,
    history: state.history
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(engineState));
}

function applyRemoteState(raw) {
  const next = normalizeState(raw);
  serverState = next;
  window.PD_LIVETICKER_SERVER_STATE = next;
  applyingRemote = true;
  try {
    writeEngineState(next);
    window.dispatchEvent(new CustomEvent("pd-liveticker-remote-state", {
      detail: { minute: next.minute, history: next.history }
    }));
  } finally {
    applyingRemote = false;
  }
  renderSyncStatus(next.completedAt ? "Abgeschlossen · archiviert" : "Gespeichert", "success");
}

function historyMap(history) {
  return new Map((history || []).map(item => [item.id, item]));
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function cleanSyncAction(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const clean = { ...item };
  delete clean._whatsapp;
  return clean;
}

function snapshotClientState(raw) {
  return {
    minute: Math.max(1, Number(raw?.minute || 1)),
    history: (Array.isArray(raw?.history) ? raw.history : []).map(item => JSON.parse(JSON.stringify(cleanSyncAction(item))))
  };
}

function diffChanges(localState, baseState = clientState || serverState) {
  const previous = historyMap(baseState?.history || []);
  const current = historyMap(localState.history || []);
  const upserts = [];
  const deletes = [];
  const deleteGuards = [];

  for (const [id, item] of current) {
    if (!previous.has(id) || !sameJson(previous.get(id), item)) upserts.push(item);
  }
  for (const [id, item] of previous) {
    if (!current.has(id)) {
      deletes.push(id);
      deleteGuards.push({ id, expected: cleanSyncAction(item) });
    }
  }

  const changes = {};
  if (upserts.length) changes.upserts = upserts;
  if (deletes.length) {
    changes.deletes = deletes;
    changes.deleteGuards = deleteGuards;
  }
  if (Number(localState.minute || 1) !== Number(baseState?.minute || 1)) changes.minute = Number(localState.minute || 1);
  return changes;
}

function rebaseChanges(intent, freshState) {
  const fresh = historyMap(freshState?.history || []);
  const changes = {};
  const upserts = (Array.isArray(intent?.upserts) ? intent.upserts : [])
    .filter(item => item?.id && (!fresh.has(item.id) || !sameJson(fresh.get(item.id), item)));
  const guardMap = new Map(
    (Array.isArray(intent?.deleteGuards) ? intent.deleteGuards : [])
      .filter(guard => guard?.id && guard?.expected)
      .map(guard => [guard.id, guard])
  );
  const deletes = (Array.isArray(intent?.deletes) ? intent.deletes : [])
    .filter(id => fresh.has(id) && guardMap.has(id));

  if (upserts.length) changes.upserts = upserts;
  if (deletes.length) {
    changes.deletes = deletes;
    changes.deleteGuards = deletes.map(id => guardMap.get(id));
  }
  if (Object.prototype.hasOwnProperty.call(intent || {}, "minute")
      && Number(intent.minute || 1) !== Number(freshState?.minute || 1)) {
    changes.minute = Number(intent.minute || 1);
  }
  return changes;
}

function hasChanges(changes) {
  return Object.keys(changes).length > 0;
}

async function syncLocalState(localState) {
  if (!selectedGame || applyingRemote || !serverState) return;
  if (syncing) {
    pendingLocalState = localState;
    return;
  }

  const changes = diffChanges(localState);
  if (!hasChanges(changes)) return;

  if (syncCircuitBreaker.register()) {
    pendingLocalState = null;
    renderSyncStatus("SYNC gestoppt · Seite neu laden", "error");
    window.dispatchEvent(new CustomEvent("pd-liveticker-sync-circuit-open", {
      detail: { eventId: selectedGame.eventId }
    }));
    return;
  }

  syncing = true;
  renderSyncStatus("Speichert …", "pending");
  try {
    let result;
    let wakeWhatsapp = hasWhatsappPublishIntent(changes);
    try {
      result = await rpc("pd_public_liveticker_sync", {
        p_event_id: selectedGame.eventId,
        p_expected_revision: serverState.revision,
        p_changes: changes,
        p_client_id: clientId()
      });
    } catch (error) {
      if (error.code !== LIVETICKER_REVISION_CONFLICT_CODE) throw error;
      const fresh = await rpc("pd_public_liveticker_state", { p_event_id: selectedGame.eventId });
      serverState = normalizeState(fresh);
      const retryChanges = rebaseChanges(changes, serverState);
      if (!hasChanges(retryChanges)) {
        applyRemoteState(fresh);
        clientState = snapshotClientState(normalizeState(fresh));
        return;
      }
      wakeWhatsapp = hasWhatsappPublishIntent(retryChanges);
      result = await rpc("pd_public_liveticker_sync", {
        p_event_id: selectedGame.eventId,
        p_expected_revision: serverState.revision,
        p_changes: retryChanges,
        p_client_id: clientId()
      });
    }
    applyRemoteState(result);
    clientState = snapshotClientState(normalizeState(result));
    if (wakeWhatsapp) void broadcastWhatsappWake();
    window.dispatchEvent(new CustomEvent("pd-liveticker-server-synced", {
      detail: { state: normalizeState(result), changes }
    }));
  } catch (error) {
    console.error(error);
    renderSyncStatus("Speicherfehler", "error");
    window.dispatchEvent(new CustomEvent("pd-liveticker-server-sync-error", {
      detail: { eventId: selectedGame.eventId, message: error?.message || "Speicherfehler" }
    }));
  } finally {
    syncing = false;
    const pending = pendingLocalState;
    pendingLocalState = null;
    if (pending) queueMicrotask(() => syncLocalState(pending));
  }
}

async function completeSelectedGame() {
  if (!selectedGame || !serverState || completing) return;
  completing = true;
  renderSyncStatus("Schließt ab …", "pending");
  try {
    let result;
    try {
      result = await rpc("pd_public_liveticker_complete", {
        p_event_id: selectedGame.eventId,
        p_expected_revision: serverState.revision,
        p_client_id: clientId()
      });
    } catch (error) {
      if (error.code !== LIVETICKER_REVISION_CONFLICT_CODE) throw error;
      const fresh = await rpc("pd_public_liveticker_state", { p_event_id: selectedGame.eventId });
      serverState = normalizeState(fresh);
      result = await rpc("pd_public_liveticker_complete", {
        p_event_id: selectedGame.eventId,
        p_expected_revision: serverState.revision,
        p_client_id: clientId()
      });
    }
    applyRemoteState(result);
  } catch (error) {
    console.error(error);
    renderSyncStatus("Abschluss nicht gespeichert", "error");
  } finally {
    completing = false;
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
  style.textContent = `.liveticker-game-field{margin-bottom:2px}.liveticker-sync-status{display:block;margin-top:5px;font-size:.72rem;font-weight:850}.liveticker-sync-status[data-state="pending"]{color:#526d86}.liveticker-sync-status[data-state="success"]{color:#087747}.liveticker-sync-status[data-state="error"]{color:var(--red)}`;
  document.head.append(style);
}

async function loadSelectedGame(game) {
  selectedGame = game;
  pendingLocalState = null;
  syncCircuitBreaker.reset();
  clientState = null;
  exposeGameContext(game);
  localStorage.setItem(SELECTED_EVENT_KEY, game.eventId);
  localStorage.setItem(VENUE_KEY, game.homeAway === "AWAY" ? "away" : "home");
  renderSyncStatus("Lädt …", "pending");
  const state = await rpc("pd_public_liveticker_state", { p_event_id: game.eventId });
  applyRemoteState(state);
  clientState = snapshotClientState(normalizeState(state));
}

async function poll() {
  if (!selectedGame || syncing || completing || pendingLocalState || document.hidden) return;
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

function applyOutputTemplates(raw) {
  const snapshot = normalizeLivetickerTemplateSnapshot(raw);
  const signature = JSON.stringify({
    legacy: snapshot.templates.map(template => [
      template.key, template.title, template.ownGoalTitle, template.ownPenaltyTitle,
      template.opponentGoalTitle, template.opponentPenaltyTitle, template.revision
    ]),
    variants: snapshot.variants.map(variant => [
      variant.id, variant.outputType, variant.name, variant.sortOrder,
      variant.active, variant.default, variant.revision
    ])
  });
  globalThis.PD_LIVETICKER_OUTPUT_TEMPLATES = snapshot;
  if (templateSignature && signature !== templateSignature) {
    window.dispatchEvent(new CustomEvent("pd-liveticker-output-templates-updated"));
  }
  templateSignature = signature;
}

async function pollOutputTemplates() {
  if (document.hidden) return;
  try {
    applyOutputTemplates(await rpc("pd_public_liveticker_templates"));
  } catch (error) {
    console.error(error);
  }
}

export async function prepareLivetickerGameStorage() {
  config = runtimeConfig();
  installStyles();
  const [response, rawTemplates] = await Promise.all([
    rpc("pd_public_liveticker_games"),
    rpc("pd_public_liveticker_templates")
  ]);
  applyOutputTemplates(rawTemplates);
  const games = Array.isArray(response?.games) ? response.games : [];
  if (!games.length) throw new Error("Keine Spiele im zentralen Kalender verfügbar.");

  const gameSelect = installGameSelector(games);
  const remembered = localStorage.getItem(SELECTED_EVENT_KEY);
  const chosen = games.find(game => game.eventId === remembered) || games[0];
  exposeGameContext(chosen);
  if (gameSelect) gameSelect.value = chosen.eventId;
  await loadSelectedGame(chosen);

  window.addEventListener("pd-liveticker-state-saved", event => {
    const localState = event.detail?.state || readEngineState();
    if (localState) queueMicrotask(() => syncLocalState(localState));
  });

  window.addEventListener("pd-api-after-call", event => {
    if ([
      "liveticker_whatsapp_sticker_enqueue",
      "liveticker_whatsapp_delivery_enqueue",
      "liveticker_whatsapp_delivery_retry"
    ].includes(event.detail?.action)) {
      void broadcastWhatsappWake();
    }
  });

  window.addEventListener("pd-liveticker-final-output-ready", event => {
    const eventId = String(event.detail?.eventId || "");
    if (!selectedGame || eventId !== selectedGame.eventId) return;
    queueMicrotask(() => completeSelectedGame());
  });

  gameSelect?.addEventListener("change", async () => {
    const game = games.find(item => item.eventId === gameSelect.value);
    if (!game) return;
    await loadSelectedGame(game);
    window.location.reload();
  });

  pollTimer = window.setInterval(poll, 3000);
  templatePollTimer = window.setInterval(pollOutputTemplates, 30000);
  window.addEventListener("pagehide", () => {
    if (pollTimer) clearInterval(pollTimer);
    if (templatePollTimer) clearInterval(templatePollTimer);
  }, { once: true });

  return { games, selectedGame: chosen, state: serverState };
}
