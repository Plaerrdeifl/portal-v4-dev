import { auth } from "./auth.js";
import { phase3State } from "./modules/state.js";

let warmupPromise = null;
let warmupUserId = "";

function storeTaskBundle(value) {
  const meta = value?.meta || {};
  phase3State.set("tasks:mine", { tasks: value?.mine || [], meta });
  phase3State.set("tasks:board", { tasks: value?.board || [], meta });
  return value || { mine: [], board: [], meta: {} };
}

async function warmTasks() {
  if (!auth.canAccessRoute("tasks")) return null;
  if (phase3State.has("tasks:mine") && phase3State.has("tasks:board")) {
    return phase3State.get("tasks:bundle");
  }
  const bundle = await phase3State.once(
    "tasks:bundle",
    () => auth.call("apiListFanclubTasks", { status: "alle" })
  );
  return storeTaskBundle(bundle);
}

async function warmFanclub() {
  if (!auth.canAccessRoute("fanclub")) return null;
  return phase3State.once(
    "fanclub:overview",
    () => auth.call("apiListActiveMemberNames")
  );
}

async function warmTeams() {
  if (!auth.canAccessRoute("teams")) return null;
  return phase3State.once(
    "teams:overview",
    () => auth.call("apiListPortalTeams")
  );
}

async function warmAdmin() {
  if (!auth.canAccessRoute("admin")) return null;
  return phase3State.once(
    "admin:nameIntegrity",
    () => auth.call("apiGetNameIntegrityStatus")
  );
}

export function warmupAuthenticatedData() {
  if (!auth.isAuthenticated() || auth.requiresProfile() || auth.current().connectionPending) {
    return Promise.resolve({ results: {}, errors: {} });
  }

  const userId = String(auth.current().user?.userId || "");
  if (warmupPromise && warmupUserId === userId) return warmupPromise;
  warmupUserId = userId;

  async function settleJobs(jobs) {
    const entries = await Promise.allSettled(
      Object.entries(jobs).map(async ([id, promise]) => ({ id, value: await promise }))
    );
    const results = {};
    const errors = {};
    entries.forEach(entry => {
      if (entry.status === "fulfilled") {
        results[entry.value.id] = entry.value.value;
      } else {
        const message = String(entry.reason?.message || entry.reason || "Vorbereitung fehlgeschlagen");
        errors.unknown = errors.unknown ? `${errors.unknown}; ${message}` : message;
      }
    });
    return { results, errors };
  }

  // Aufgaben und Fanclub bilden die priorisierte erste Welle. Erst danach
  // folgen Teams und Administration, damit die gemessene langsame Aufgabenroute
  // nicht mit vier parallelen Apps-Script-Aufrufen konkurriert.
  warmupPromise = (async () => {
    const primary = await settleJobs({
      tasks: warmTasks(),
      fanclub: warmFanclub()
    });
    const secondary = await settleJobs({
      teams: warmTeams(),
      admin: warmAdmin()
    });
    return {
      results: { ...primary.results, ...secondary.results },
      errors: { ...primary.errors, ...secondary.errors }
    };
  })().finally(() => {
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
