const MAX_ENTRIES = 60;
const SLOW_CLIENT_MS = 3000;
const entries = [];

function clone(value) {
  try { return JSON.parse(JSON.stringify(value)); }
  catch (error) { return value; }
}

function emit(entry) {
  window.dispatchEvent(new CustomEvent("pd-performance-entry", { detail: clone(entry) }));
}

export const performanceMonitor = Object.freeze({
  record({ action = "", clientDurationMs = 0, server = null, ok = true, error = "" } = {}) {
    const entry = {
      action: String(action || server?.functionName || ""),
      timestamp: new Date().toISOString(),
      clientDurationMs: Math.max(0, Math.round(Number(clientDurationMs) || 0)),
      serverDurationMs: Math.max(0, Math.round(Number(server?.durationMs) || 0)),
      slow: Number(clientDurationMs || 0) >= SLOW_CLIENT_MS || Boolean(server?.slow),
      ok: ok !== false,
      error: String(error || server?.error || ""),
      server: server || null
    };
    entries.unshift(entry);
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    emit(entry);
    return entry;
  },

  recent(limit = 25) {
    return entries.slice(0, Math.max(1, Number(limit) || 25)).map(clone);
  },

  summary() {
    const recent = this.recent(MAX_ENTRIES);
    const slow = recent.filter(item => item.slow);
    return {
      count: recent.length,
      slowCount: slow.length,
      averageClientMs: recent.length ? Math.round(recent.reduce((sum, item) => sum + item.clientDurationMs, 0) / recent.length) : 0,
      maximumClientMs: recent.length ? Math.max(...recent.map(item => item.clientDurationMs)) : 0,
      entries: recent
    };
  },

  clear() {
    entries.length = 0;
    emit({ action: "performance-clear", timestamp: new Date().toISOString(), ok: true });
  }
});

window.PlaerrdeiflPerformance = performanceMonitor;
