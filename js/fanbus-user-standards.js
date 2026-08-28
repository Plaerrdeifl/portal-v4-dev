import {
  call,
  escapeAttr,
  escapeHtml,
  openDialog,
  runWrite
} from "./modules/common.js";

const BUS_PREFERENCES = new Set(["EGAL", "RUHIG", "PARTY"]);
const peopleBusDefaults = new Map();
let selfBusPreference = "EGAL";
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

async function openFanbusStandards() {
  const preference = await call("fanbus_user_preference_get", {});
  const selectedBus = normalizeBusPreference(preference?.defaultBusPreference);
  const stops = Array.isArray(preference?.availableBoardingStops)
    ? preference.availableBoardingStops
    : [];

  openDialog({
    title: "Meine Fanbus-Standards",
    kicker: "Fanbus",
    submitLabel: "Standards speichern",
    body: `<form class="form-grid v4-smart-form" data-p300-fanbus-standards-form>
      <p class="subtle v4-field-full">Diese Vorgaben werden bei neuen Fanbus-Anmeldungen vorausgewählt. Der Buswunsch wird nur bei Fahrten mit aktivierter Buswahl verwendet; bei allen anderen Fahrten bleibt er unsichtbar und ohne Wirkung.</p>
      <label class="v4-field-half">Standard-Zustieg
        <select name="defaultBoardingStopId">
          <option value="">Kein Standard</option>
          ${stops.map(stop => `<option value="${escapeAttr(stop.id)}"${stop.id === preference?.defaultBoardingStopId ? " selected" : ""}>${escapeHtml(stop.label)}</option>`).join("")}
        </select>
      </label>
      <label class="v4-field-half">Standard-Buswunsch
        <select name="defaultBusPreference" required>${preferenceOptions(selectedBus)}</select>
      </label>
    </form>`,
    onSubmit: async values => {
      const payload = {
        defaultBoardingStopId: String(values.defaultBoardingStopId || "") || null,
        defaultBusPreference: normalizeBusPreference(values.defaultBusPreference)
      };
      if (Number(preference?.revision) > 0) {
        payload.expectedRevision = Number(preference.revision);
      }
      await runWrite(
        () => call("fanbus_user_preference_set", payload),
        "Fanbus-Standards gespeichert."
      );
    }
  });
}

function closeActionMenu() {
  const menu = document.getElementById("m310FanbusActionMenu");
  const toggle = document.getElementById("m310FanbusActionToggle");
  if (menu) menu.hidden = true;
  if (toggle) toggle.setAttribute("aria-expanded", "false");
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
      const message = error?.message || "Fanbus-Standards konnten nicht geladen werden.";
      window.dispatchEvent(new CustomEvent("pd-ui-toast", {
        detail: { message, type: "error" }
      }));
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
}

function scan() {
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
