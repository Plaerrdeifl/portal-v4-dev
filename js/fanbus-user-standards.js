import {
  call,
  escapeAttr,
  escapeHtml,
  runWrite,
  showToast
} from "./modules/common.js";

const BUS_PREFERENCES = new Set(["EGAL", "RUHIG", "PARTY"]);
const STANDARDS_PANEL_ID = "m327FanbusStandardsPanel";
const STANDARDS_STYLE_ID = "m327FanbusStandardsStyles";
const peopleBusDefaults = new Map();
let selfBusPreference = "EGAL";
let selfPreferenceLoaded = false;
let selfPreferenceLoading = false;
let scanScheduled = false;

function normalizeBusPreference(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return BUS_PREFERENCES.has(normalized) ? normalized : "EGAL";
}

function busPreferenceLabel(value) {
  return {
    EGAL: "Egal",
    RUHIG: "Ruhig",
    PARTY: "Party"
  }[normalizeBusPreference(value)];
}

function personChoiceKey(person) {
  const type = String(person?.personType || "");
  const id = type === "MEMBER" ? person?.memberId : person?.portalUserId;
  return type && id ? `${type}:${id}` : "";
}

function rememberPeopleDefaults(data) {
  for (const person of Array.isArray(data?.people) ? data.people : []) {
    const key = personChoiceKey(person);
    if (!key) continue;
    peopleBusDefaults.set(key, normalizeBusPreference(person?.defaultBusPreference));
  }
}

async function ensureSelfPreference() {
  if (selfPreferenceLoaded || selfPreferenceLoading) return;
  selfPreferenceLoading = true;
  try {
    const data = await call("fanbus_user_preference_get", {});
    selfBusPreference = normalizeBusPreference(data?.defaultBusPreference);
    selfPreferenceLoaded = true;
  } catch {
    // Ein optionaler Profilstandard darf den eigentlichen Anmeldeflow nicht blockieren.
  } finally {
    selfPreferenceLoading = false;
    scheduleScan();
  }
}

function bindPublicBusPreferenceSelect(select) {
  if (!(select instanceof HTMLSelectElement)) return;
  if (select.dataset.p300BusDefaultBound === "true") return;
  select.dataset.p300BusDefaultBound = "true";
  select.addEventListener("change", () => {
    if (select.dataset.p300BusDefaultApplying === "true") return;
    select.dataset.p300BusDefaultTouched = "true";
  });
}

function applyPublicSelfBusDefault() {
  const form = document.getElementById("m310PortalForm");
  const field = form?.querySelector('[data-m320-bus-preference="portal"]');
  const select = field?.querySelector('select[name="busPreference"]');
  if (!(field instanceof HTMLElement) || !(select instanceof HTMLSelectElement)) return;

  bindPublicBusPreferenceSelect(select);
  if (field.hidden || field.closest("[hidden]")) return;
  if (!selfPreferenceLoaded) {
    void ensureSelfPreference();
    return;
  }
  if (select.dataset.p300BusDefaultApplied === "true"
      || select.dataset.p300BusDefaultTouched === "true") return;

  const next = normalizeBusPreference(selfBusPreference);
  if (![...select.options].some(option => option.value === next)) return;

  select.dataset.p300BusDefaultApplying = "true";
  select.value = next;
  select.dispatchEvent(new Event("change", { bubbles: true }));
  delete select.dataset.p300BusDefaultApplying;
  select.dataset.p300BusDefaultApplied = "true";
}

function applyManualPersonBusDefault(targetIndex, preference, attempt = 0) {
  const selector = `#m326ManualComposerForm select[data-m326-person-preference="${CSS.escape(String(targetIndex))}"]`;
  const select = document.querySelector(selector);
  if (select instanceof HTMLSelectElement) {
    const next = normalizeBusPreference(preference);
    if ([...select.options].some(option => option.value === next) && select.value !== next) {
      select.value = next;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return;
  }

  if (attempt >= 8) return;
  window.setTimeout(() => applyManualPersonBusDefault(targetIndex, preference, attempt + 1), 25);
}

function handleManualPersonChoice(event) {
  const button = event.target instanceof Element
    ? event.target.closest("[data-m326-choice]")
    : null;
  if (!(button instanceof HTMLElement)) return;

  const preference = peopleBusDefaults.get(String(button.dataset.m326Choice || ""));
  if (!preference) return;

  const targetIndex = document.querySelectorAll(
    "#m326ManualComposerForm [data-m326-composer-person]"
  ).length;
  window.setTimeout(() => applyManualPersonBusDefault(targetIndex, preference), 0);
}

function preferenceOptions(selected) {
  return ["EGAL", "RUHIG", "PARTY"].map(value => (
    `<option value="${value}"${value === selected ? " selected" : ""}>${busPreferenceLabel(value)}</option>`
  )).join("");
}

function closeActionMenu() {
  const menu = document.getElementById("m310FanbusActionMenu");
  const toggle = document.getElementById("m310FanbusActionToggle");
  if (menu) menu.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
}

function injectStandardsStyles() {
  if (document.getElementById(STANDARDS_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STANDARDS_STYLE_ID;
  style.textContent = `
    #${STANDARDS_PANEL_ID}{display:grid;gap:14px}
    #${STANDARDS_PANEL_ID} .m327-standards-head{display:flex;align-items:flex-start;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--line)}
    #${STANDARDS_PANEL_ID} .m327-standards-back{flex:0 0 auto;width:auto;min-height:38px;padding:7px 10px}
    #${STANDARDS_PANEL_ID} .m327-standards-head-copy{min-width:0}
    #${STANDARDS_PANEL_ID} .m327-standards-kicker{display:block;margin-bottom:2px;color:var(--muted);font-size:.68rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
    #${STANDARDS_PANEL_ID} .m327-standards-head h3{margin:0;font-size:1.25rem;line-height:1.15}
    #${STANDARDS_PANEL_ID} .m327-standards-head p{margin:4px 0 0;color:var(--muted);font-size:.82rem;line-height:1.35}
    #${STANDARDS_PANEL_ID} .m327-standards-card{display:grid;gap:12px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--surface,#fff)}
    #${STANDARDS_PANEL_ID} .m327-standards-note{margin:0;color:var(--muted);font-size:.82rem;line-height:1.4}
    #${STANDARDS_PANEL_ID} .m327-standards-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    #${STANDARDS_PANEL_ID} .m327-standards-field{display:grid;gap:5px;min-width:0;font-weight:800}
    #${STANDARDS_PANEL_ID} .m327-standards-field select{width:100%;min-width:0}
    #${STANDARDS_PANEL_ID} .m327-standards-actions{display:flex;justify-content:flex-end;padding-top:2px}
    #${STANDARDS_PANEL_ID} .m327-standards-actions .button{width:auto;min-width:180px}
    @media(max-width:620px){
      #${STANDARDS_PANEL_ID}{gap:10px}
      #${STANDARDS_PANEL_ID} .m327-standards-head{gap:9px;padding-bottom:10px}
      #${STANDARDS_PANEL_ID} .m327-standards-back{min-height:36px;padding:6px 9px;font-size:.78rem}
      #${STANDARDS_PANEL_ID} .m327-standards-head h3{font-size:1.08rem}
      #${STANDARDS_PANEL_ID} .m327-standards-head p{font-size:.76rem;line-height:1.3}
      #${STANDARDS_PANEL_ID} .m327-standards-card{gap:10px;padding:11px;border-radius:14px}
      #${STANDARDS_PANEL_ID} .m327-standards-note{font-size:.76rem}
      #${STANDARDS_PANEL_ID} .m327-standards-fields{grid-template-columns:1fr;gap:9px}
      #${STANDARDS_PANEL_ID} .m327-standards-field{font-size:.78rem}
      #${STANDARDS_PANEL_ID} .m327-standards-actions .button{width:100%;min-width:0}
    }
  `;
  document.head.append(style);
}

function restoreTripsPanel() {
  const panel = document.getElementById(STANDARDS_PANEL_ID);
  panel?.remove();
  const tripsPanel = document.getElementById("m327TripsPanel");
  if (tripsPanel instanceof HTMLElement) tripsPanel.hidden = false;
  const bookingsPanel = document.getElementById("m327MyBookingsPanel");
  if (bookingsPanel instanceof HTMLElement) bookingsPanel.hidden = true;
  document.getElementById("m310FanbusActionToggle")?.focus({ preventScroll: true });
}

function buildStandardsPanel(preference) {
  const selectedBus = normalizeBusPreference(preference?.defaultBusPreference);
  const stops = Array.isArray(preference?.availableBoardingStops)
    ? preference.availableBoardingStops
    : [];
  const panel = document.createElement("section");
  panel.id = STANDARDS_PANEL_ID;
  panel.className = "module-panel m327-fanbus-standards-panel";
  panel.setAttribute("aria-label", "Meine Fanbus-Standards");
  panel.innerHTML = `
    <div class="m327-standards-head">
      <button class="button small ghost m327-standards-back" type="button" data-m327-standards-back>← Zurück</button>
      <div class="m327-standards-head-copy">
        <span class="m327-standards-kicker">Fanbus</span>
        <h3>Meine Fanbus-Standards</h3>
        <p>Vorgaben für neue Fanbus-Anmeldungen festlegen</p>
      </div>
    </div>
    <form class="m327-standards-card" data-p300-fanbus-standards-form>
      <p class="m327-standards-note">Diese Werte werden bei neuen Anmeldungen vorausgewählt. Der Buswunsch wird nur bei Fahrten mit aktivierter Buswahl verwendet.</p>
      <div class="m327-standards-fields">
        <label class="m327-standards-field">Standard-Zustieg
          <select name="defaultBoardingStopId">
            <option value="">Kein Standard</option>
            ${stops.map(stop => `<option value="${escapeAttr(stop.id)}"${stop.id === preference?.defaultBoardingStopId ? " selected" : ""}>${escapeHtml(stop.label)}</option>`).join("")}
          </select>
        </label>
        <label class="m327-standards-field">Standard-Buswunsch
          <select name="defaultBusPreference" required>${preferenceOptions(selectedBus)}</select>
        </label>
      </div>
      <div class="m327-standards-actions">
        <button class="button primary" type="submit">Standards speichern</button>
      </div>
    </form>`;

  panel.querySelector("[data-m327-standards-back]")?.addEventListener("click", restoreTripsPanel);
  const form = panel.querySelector("[data-p300-fanbus-standards-form]");
  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!(form instanceof HTMLFormElement) || !form.reportValidity()) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    const values = Object.fromEntries(new FormData(form).entries());
    const payload = {
      defaultBoardingStopId: String(values.defaultBoardingStopId || "") || null,
      defaultBusPreference: normalizeBusPreference(values.defaultBusPreference)
    };
    if (Number(preference?.revision) > 0) payload.expectedRevision = Number(preference.revision);
    try {
      const result = await runWrite(
        () => call("fanbus_user_preference_set", payload),
        "Fanbus-Standards gespeichert."
      );
      preference.revision = result?.revision ?? preference.revision;
      preference.defaultBoardingStopId = result?.defaultBoardingStopId ?? payload.defaultBoardingStopId;
      preference.defaultBusPreference = result?.defaultBusPreference ?? payload.defaultBusPreference;
      selfBusPreference = normalizeBusPreference(preference.defaultBusPreference);
      selfPreferenceLoaded = true;
    } catch (error) {
      showToast(error?.message || "Fanbus-Standards konnten nicht gespeichert werden.", "error", 5200);
    } finally {
      if (submit instanceof HTMLButtonElement && submit.isConnected) submit.disabled = false;
    }
  });
  return panel;
}

async function openFanbusStandards() {
  const surface = document.querySelector("#m310FanbusPage .v4-module-surface");
  const tripsPanel = document.getElementById("m327TripsPanel");
  if (!(surface instanceof HTMLElement) || !(tripsPanel instanceof HTMLElement)) {
    throw new Error("Fanbus-Bereich ist nicht verfügbar.");
  }

  const existing = document.getElementById(STANDARDS_PANEL_ID);
  if (existing) {
    tripsPanel.hidden = true;
    existing.hidden = false;
    return;
  }

  const preference = await call("fanbus_user_preference_get", {});
  const panel = buildStandardsPanel(preference || {});
  const bookingsPanel = document.getElementById("m327MyBookingsPanel");
  if (bookingsPanel instanceof HTMLElement) bookingsPanel.hidden = true;
  tripsPanel.hidden = true;
  surface.append(panel);
  panel.querySelector("select")?.focus({ preventScroll: true });
}

function bindStandardsButton() {
  const button = document.getElementById("m325UserFanbusStandardsButton");
  if (!(button instanceof HTMLButtonElement)
      || button.dataset.p300FanbusStandardsBound === "true") return;

  button.dataset.p300FanbusStandardsBound = "true";
  button.addEventListener("click", async () => {
    closeActionMenu();
    button.disabled = true;
    try {
      await openFanbusStandards();
    } catch (error) {
      showToast(
        error?.message || "Fanbus-Standards konnten nicht geladen werden.",
        "error",
        5200
      );
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
}

function scan() {
  injectStandardsStyles();
  bindStandardsButton();
  applyPublicSelfBusDefault();
}

function scheduleScan() {
  if (scanScheduled) return;
  scanScheduled = true;
  requestAnimationFrame(() => {
    scanScheduled = false;
    scan();
  });
}

window.addEventListener("pd-api-after-call", event => {
  const action = event.detail?.action;
  if (action === "fanbus_registration_people_list") {
    rememberPeopleDefaults(event.detail?.data);
  }
  if ([
    "fanbus_user_preference_get",
    "fanbus_user_preference_set",
    "fanbus_user_preference_delete"
  ].includes(action)) {
    selfBusPreference = normalizeBusPreference(event.detail?.data?.defaultBusPreference);
    selfPreferenceLoaded = true;
    scheduleScan();
  }
});

document.addEventListener("click", handleManualPersonChoice, true);
new MutationObserver(scheduleScan).observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["hidden"]
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleScan, { once: true });
} else {
  scheduleScan();
}
