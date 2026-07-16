(() => {
  "use strict";

  const OVERLAY_ID = "authTransitionOverlay";
  const LOGIN_SLOT_ID = "googleSignInButton";
  const AUTHENTICATING_PATTERN = /Google-Konto.*Rechte.*geprüft|Rechte.*geprüft/i;
  let slotObserver = null;
  let observedSlot = null;

  function overlay() {
    let node = document.getElementById(OVERLAY_ID);
    if (node) return node;
    node = document.createElement("div");
    node.id = OVERLAY_ID;
    node.className = "app-splash auth-transition-overlay is-complete";
    node.setAttribute("aria-live", "polite");
    node.setAttribute("aria-busy", "false");
    node.setAttribute("aria-hidden", "true");
    node.innerHTML = `<div class="splash-logo-shell"><img src="./assets/icons/icon-512.png" alt="Schweinfurter Plärrdeifl Logo"></div>
      <div class="splash-wordmark" aria-label="Plärrdeifl Portal"><strong>Plärrdeifl</strong><span>PORTAL</span></div>
      <div class="splash-loading-dots" aria-label="Wird geladen"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="splash-status" role="status"><span id="authTransitionStatus">Google-Anmeldung wird geprüft …</span><small id="authTransitionDetail">Sitzung, Rechte und Zielseite werden geladen. Du bleibst im Portal.</small></div>`;
    document.body.appendChild(node);
    return node;
  }

  function setOverlayVisible(visible, detail = {}) {
    const node = overlay();
    if (!node) return;

    const status = node.querySelector("#authTransitionStatus");
    const description = node.querySelector("#authTransitionDetail");
    if (status && detail.message) status.textContent = String(detail.message);
    if (description && detail.detail) description.textContent = String(detail.detail);

    node.classList.toggle("is-complete", !visible);
    node.setAttribute("aria-busy", visible ? "true" : "false");
    node.setAttribute("aria-hidden", visible ? "false" : "true");
    document.documentElement.dataset.authTransitionState = visible ? "loading" : String(detail.state || "idle");
  }

  function isCredentialCheckActive(slot) {
    if (!slot || slot.getAttribute("aria-busy") !== "true") return false;
    return AUTHENTICATING_PATTERN.test(String(slot.dataset.status || ""));
  }

  function syncLoginSlot(slot) {
    if (!slot) return;
    const active = isCredentialCheckActive(slot);
    slot.classList.toggle("is-authenticating", active);
    if (active) {
      setOverlayVisible(true, {
        message: "Google-Anmeldung wird geprüft …",
        detail: "Sitzung, Rechte und Zielseite werden geladen. Du bleibst im Portal."
      });
    }
  }

  function observeLoginSlot() {
    const slot = document.getElementById(LOGIN_SLOT_ID);
    if (!slot || slot === observedSlot) return;
    if (slotObserver) slotObserver.disconnect();
    observedSlot = slot;
    slotObserver = new MutationObserver(() => syncLoginSlot(slot));
    slotObserver.observe(slot, { attributes: true, attributeFilter: ["aria-busy", "data-status"], childList: true });
    syncLoginSlot(slot);
  }

  function scanForLoginSlot() {
    observeLoginSlot();
    const view = document.getElementById("view");
    if (!view || view.dataset.corr2LoginObserver === "true") return;
    view.dataset.corr2LoginObserver = "true";
    new MutationObserver(observeLoginSlot).observe(view, { childList: true, subtree: true });
  }

  window.addEventListener("pd-auth-transition", event => {
    const detail = event.detail || {};
    const phase = String(detail.phase || "");
    if (phase === "start" || phase === "authenticated") {
      setOverlayVisible(true, detail);
      return;
    }
    if (phase === "end" || phase === "error" || phase === "cancel") {
      setOverlayVisible(false, { state: phase });
      observedSlot?.classList.remove("is-authenticating");
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scanForLoginSlot, { once: true });
  } else {
    scanForLoginSlot();
  }
})();
