import { auth } from "./auth.js";
import { phase3State } from "./modules/state.js";

let warmupPromise = null;
let warmupUserId = "";

function applyBatchResult(id, value) {
  if (id === "fanclub") phase3State.set("fanclub:overview", value);
  if (id === "teams") phase3State.set("teams:overview", value);
  if (id === "admin") phase3State.set("admin:nameIntegrity", value);
  if (id === "tasks") {
    const meta = value?.meta || {};
    phase3State.set("tasks:mine", { tasks: value?.mine || [], meta });
    phase3State.set("tasks:board", { tasks: value?.board || [], meta });
  }
}

export function warmupAuthenticatedData() {
  if (!auth.isAuthenticated() || auth.requiresProfile() || auth.current().connectionPending) {
    return Promise.resolve({ results: {}, errors: {} });
  }

  const userId = String(auth.current().user?.userId || "");
  if (warmupPromise && warmupUserId === userId) return warmupPromise;
  warmupUserId = userId;

  const calls = [];
  if (auth.canAccessRoute("fanclub") && !phase3State.has("fanclub:overview")) {
    calls.push({ id: "fanclub", functionName: "apiListActiveMemberNames", args: [] });
  }
  if (auth.canAccessRoute("tasks") && !phase3State.has("tasks:mine")) {
    calls.push({ id: "tasks", functionName: "apiListFanclubTasks", args: [{ status: "alle" }] });
  }
  if (auth.canAccessRoute("teams") && !phase3State.has("teams:overview")) {
    calls.push({ id: "teams", functionName: "apiListPortalTeams", args: [] });
  }
  if (auth.canAccessRoute("admin") && !phase3State.has("admin:nameIntegrity")) {
    calls.push({ id: "admin", functionName: "apiGetNameIntegrityStatus", args: [] });
  }

  if (!calls.length) return Promise.resolve({ results: {}, errors: {} });

  warmupPromise = auth.readBatch(calls)
    .then(bundle => {
      Object.entries(bundle?.results || {}).forEach(([id, value]) => applyBatchResult(id, value));
      return bundle || { results: {}, errors: {} };
    })
    .catch(error => ({
      results: {},
      errors: { warmup: String(error?.message || error || "Vorbereitung fehlgeschlagen") }
    }))
    .finally(() => {
      window.setTimeout(() => {
        warmupPromise = null;
      }, 15000);
    });

  return warmupPromise;
}

export function resetWarmup() {
  warmupPromise = null;
  warmupUserId = "";
  phase3State.clear();
}
