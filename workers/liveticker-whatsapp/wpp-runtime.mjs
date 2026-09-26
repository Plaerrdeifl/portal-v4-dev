export const WPP_RECOVERY_COOLDOWN_MS = 120000;
export const WPP_RECONCILE_CONFIRM_MS = 1000;

function upper(value) {
  return String(value || "").trim().toUpperCase();
}

export function normalizeWppSnapshot(session) {
  const status = upper(session?.status) || "UNKNOWN";
  const engineState = upper(session?.engine?.state) || "UNKNOWN";
  let state = "ERROR";

  // The engine state is the authoritative connection signal. WAHA can retain
  // a stale outer STOPPED status while its in-memory WPP session is connected.
  if (engineState === "CONNECTED") state = "CONNECTED";
  else if (status === "STOPPED") state = "DISCONNECTED";
  else if (status === "STARTING" || status === "SCAN_QR_CODE") state = "CONNECTING";
  else if (status === "FAILED") state = "ERROR";

  return {
    state,
    status,
    engineState,
    inconsistent: engineState === "CONNECTED" && status !== "WORKING",
    error: null
  };
}

function errorText(error) {
  const data = error?.data;
  const details = [
    error?.message,
    typeof data === "string" ? data : data?.message,
    data?.error
  ];
  return details.filter(Boolean).join(" ").replace(/[\r\n\t]+/g, " ").slice(0, 800);
}

export function isWahaAlreadyRunningError(error) {
  return /\balready\s+(?:running|started)\b/i.test(errorText(error));
}

function isSettling(snapshot) {
  return snapshot?.state === "CONNECTED" || snapshot?.state === "CONNECTING";
}

export function createWppStateReconciler({
  readSnapshot,
  performAction,
  wait = delay => new Promise(resolve => setTimeout(resolve, delay)),
  now = () => Date.now(),
  recoveryCooldownMs = WPP_RECOVERY_COOLDOWN_MS,
  confirmDelayMs = WPP_RECONCILE_CONFIRM_MS,
  onEvent = () => {}
}) {
  if (typeof readSnapshot !== "function" || typeof performAction !== "function") {
    throw new TypeError("WPP reconciler requires readSnapshot and performAction");
  }

  let recoveryNotBefore = 0;
  let cooldownReportedFor = 0;
  let startPending = false;

  async function confirmedSnapshot() {
    let snapshot = await readSnapshot();
    if (isSettling(snapshot) || confirmDelayMs <= 0) return snapshot;
    await wait(confirmDelayMs);
    snapshot = await readSnapshot();
    return snapshot;
  }

  function healthy(snapshot, action = null) {
    recoveryNotBefore = 0;
    cooldownReportedFor = 0;
    if (snapshot?.state === "CONNECTED" || action === "restart" || action === "stop") startPending = false;
    return {
      snapshot,
      action,
      changed: Boolean(action),
      transitionPending: snapshot?.state === "CONNECTING",
      error: snapshot?.error || null,
      cooldownUntil: 0
    };
  }

  function failed(snapshot, error, action = null) {
    startPending = false;
    recoveryNotBefore = now() + recoveryCooldownMs;
    cooldownReportedFor = 0;
    const message = errorText(error) || snapshot?.error || "WAHA recovery did not reach a stable state";
    onEvent("wpp_recovery_failed", {
      action,
      state: snapshot?.state || "ERROR",
      error: message,
      retryAfterMs: recoveryCooldownMs
    });
    return {
      snapshot: { ...snapshot, state: snapshot?.state || "ERROR", error: message },
      action,
      changed: Boolean(action),
      transitionPending: false,
      error: message,
      cooldownUntil: recoveryNotBefore
    };
  }

  async function recover(reason) {
    startPending = false;
    onEvent("wpp_recovery_action", { action: "restart", reason });
    let actionError = null;
    try {
      await performAction("restart");
    } catch (error) {
      actionError = error;
    }

    const snapshot = await confirmedSnapshot();
    if (isSettling(snapshot)) {
      onEvent("wpp_recovery_succeeded", {
        state: snapshot.state,
        status: snapshot.status,
        engineState: snapshot.engineState
      });
      return healthy(snapshot, "restart");
    }
    return failed(snapshot, actionError, "restart");
  }

  async function reconcile(desiredConnected, initialSnapshot) {
    const snapshot = initialSnapshot || await readSnapshot();

    if (!desiredConnected) {
      if (snapshot.state !== "CONNECTED" && snapshot.state !== "CONNECTING") return healthy(snapshot);
      await performAction("stop");
      return healthy(await readSnapshot(), "stop");
    }

    if (snapshot.state === "CONNECTED") {
      if (snapshot.inconsistent) {
        onEvent("wpp_state_reconciled", {
          status: snapshot.status,
          engineState: snapshot.engineState,
          state: snapshot.state
        });
      }
      return healthy(snapshot);
    }
    if (snapshot.state === "CONNECTING") return healthy(snapshot);

    const currentTime = now();
    if (currentTime < recoveryNotBefore) {
      if (cooldownReportedFor !== recoveryNotBefore) {
        cooldownReportedFor = recoveryNotBefore;
        onEvent("wpp_recovery_cooldown", { retryAfterMs: recoveryNotBefore - currentTime });
      }
      const message = snapshot.error || "WAHA recovery cooldown active";
      return {
        snapshot: { ...snapshot, error: message },
        action: null,
        changed: false,
        transitionPending: false,
        error: message,
        cooldownUntil: recoveryNotBefore
      };
    }

    if (snapshot.state === "ERROR") {
      const confirmed = await confirmedSnapshot();
      if (isSettling(confirmed)) return healthy(confirmed);
      if (confirmed.state === "ERROR") return recover("state_error_confirmed");
    }

    if (startPending) {
      const confirmed = await confirmedSnapshot();
      if (isSettling(confirmed)) return healthy(confirmed);
      return recover("start_transition_regressed");
    }

    let startError = null;
    try {
      startPending = true;
      await performAction("start");
    } catch (error) {
      startError = error;
      onEvent(isWahaAlreadyRunningError(error) ? "wpp_start_conflict" : "wpp_start_error", {
        error: errorText(error) || "WAHA start failed"
      });
    }

    const afterStart = await confirmedSnapshot();
    if (isSettling(afterStart)) return healthy(afterStart, "start");

    const reason = isWahaAlreadyRunningError(startError)
      ? "already_running_inconsistent"
      : startError
        ? "start_failed_inconsistent"
        : "start_noop_inconsistent";
    return recover(reason);
  }

  return { reconcile };
}
