import {
  M328_PENDING_ACTION_KEY,
  M328_REGISTRATION_FLOW_KEY,
  isM328RegistrationFlow
} from "./m328-bus-orga-shell.js?v=20260829-m328-r1-flow2";

const MASK_ID = "m328RegistrationRouteMask";
const STYLE_ID = "m328RegistrationPreloadStyle";
let observer = null;
let listenersBound = false;
let syncQueued = false;

function clearRegistrationMarkers() {
  try {
    sessionStorage.removeItem(M328_PENDING_ACTION_KEY);
    sessionStorage.removeItem(M328_REGISTRATION_FLOW_KEY);
  } catch {
    // Die Marker steuern nur den UI-Übergang.
  }
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #v4Dialog.m328-registration-preparing {
      visibility:hidden !important;
    }

    .m328-registration-route-mask {
      position:fixed;
      inset:0;
      z-index:2147483000;
      display:flex;
      flex-direction:column;
      background:var(--bg);
      color:inherit;
    }

    .m328-registration-route-mask__head {
      display:flex;
      align-items:center;
      gap:12px;
      padding:calc(12px + env(safe-area-inset-top)) 16px 12px;
      border-bottom:1px solid var(--line);
      background:var(--bg);
    }

    .m328-registration-route-mask__back {
      width:auto;
      min-height:40px;
      padding:7px 10px;
    }

    .m328-registration-route-mask__copy {
      min-width:0;
    }

    .m328-registration-route-mask__copy span {
      display:block;
      color:var(--muted);
      font-size:.68rem;
      font-weight:800;
      letter-spacing:.05em;
      text-transform:uppercase;
    }

    .m328-registration-route-mask__copy strong {
      display:block;
      margin-top:2px;
      font-size:1.3rem;
      line-height:1.1;
    }

    .m328-registration-route-mask__body {
      width:min(100%,720px);
      margin:0 auto;
      padding:22px 16px calc(28px + env(safe-area-inset-bottom));
    }

    .m328-registration-route-mask__loading {
      padding:18px;
      border:1px solid var(--line);
      border-radius:15px;
      background:var(--surface);
    }

    .m328-registration-route-mask__loading strong,
    .m328-registration-route-mask__loading span {
      display:block;
    }

    .m328-registration-route-mask__loading span {
      margin-top:5px;
      color:var(--muted);
      font-size:.82rem;
      line-height:1.35;
    }
  `;
  document.head.appendChild(style);
}

function removeMask() {
  document.getElementById(MASK_ID)?.remove();
}

function ensureMask() {
  let mask = document.getElementById(MASK_ID);
  if (mask) return mask;

  mask = document.createElement("section");
  mask.id = MASK_ID;
  mask.className = "m328-registration-route-mask";
  mask.setAttribute("aria-live", "polite");
  mask.innerHTML = `
    <header class="m328-registration-route-mask__head">
      <button class="button small ghost m328-registration-route-mask__back" type="button" data-m328-registration-preload-back>← Bus-Orga</button>
      <div class="m328-registration-route-mask__copy">
        <span>Bus-Orga</span>
        <strong>Anmeldung</strong>
      </div>
    </header>
    <div class="m328-registration-route-mask__body">
      <div class="m328-registration-route-mask__loading">
        <strong>Anmeldung wird vorbereitet …</strong>
        <span>Personen, Stammfahrer, Gruppen und Zustiege werden geladen.</span>
      </div>
    </div>`;

  mask.querySelector("[data-m328-registration-preload-back]")?.addEventListener("click", () => {
    clearRegistrationMarkers();
    location.hash = "#/bus-orga";
  });
  document.body.appendChild(mask);
  return mask;
}

function sync() {
  const active = isM328RegistrationFlow();
  const dialog = document.getElementById("v4Dialog");

  if (!active) {
    dialog?.classList.remove("m328-registration-preparing");
    removeMask();
    return;
  }

  const composerReady = Boolean(dialog?.open && dialog.querySelector("#m326ManualComposerForm"));
  if (dialog?.open) {
    dialog.classList.toggle("m328-registration-preparing", !composerReady);
  }

  if (composerReady) {
    removeMask();
    return;
  }

  ensureMask();
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(() => {
    syncQueued = false;
    sync();
  });
}

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;
  window.addEventListener("hashchange", queueSync);
}

export function setupM328RegistrationPreload() {
  ensureStyle();
  bindListeners();
  if (!observer && document.body) {
    observer = new MutationObserver(queueSync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "class"] });
  }
  sync();
}
