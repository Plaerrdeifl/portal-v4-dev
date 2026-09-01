let listenersBound = false;

function registrationRoot() {
  const root = document.getElementById("m328BusOrgaPage");
  return root?.querySelector(".m328-reg-surface") ? root : null;
}

function blurRegistrationField() {
  const root = registrationRoot();
  const active = document.activeElement;
  if (!root || !active || !root.contains(active)) return;
  if (!active.matches?.("input, textarea, select")) return;
  active.blur();
}

function splitTripMeta(value) {
  const parts = String(value || "")
    .split("·")
    .map(part => part.trim())
    .filter(Boolean);
  return {
    date: parts[0] || "",
    time: parts[1] || "",
    venue: parts.slice(2).join(" · ")
  };
}

function ensureStyle() {
  if (document.getElementById("m328RegistrationUxPolishStyle")) return;
  const style = document.createElement("style");
  style.id = "m328RegistrationUxPolishStyle";
  style.textContent = `
    .m328-reg-head .m328-reg-head-meta {
      display:block;
      margin-top:4px;
      color:var(--muted);
      font-size:.76rem;
      font-weight:700;
      letter-spacing:0;
      text-transform:none;
    }
    .m328-reg-combine-hint {
      margin:-2px 0 10px;
      color:var(--muted);
      font-size:.76rem;
      line-height:1.35;
    }
  `;
  document.head.appendChild(style);
}

function polishHeader(root) {
  const header = root.querySelector(".m328-reg-head");
  if (!header) return;
  const title = header.querySelector("h2");
  const meta = header.querySelector(".m328-reg-kicker");
  const trip = root.querySelector("#m328RegTrip");

  if (trip) {
    const tripMeta = splitTripMeta(trip.querySelector("span:last-child")?.textContent);
    if (title) title.textContent = tripMeta.venue ? `Anmeldung • ${tripMeta.venue}` : "Anmeldung";
    if (meta) {
      meta.textContent = [tripMeta.date, tripMeta.time].filter(Boolean).join(" · ");
      meta.classList.add("m328-reg-head-meta");
      title?.after(meta);
    }
    trip.remove();
    return;
  }

  meta?.classList.add("m328-reg-head-meta");
  if (title && meta) title.after(meta);
}

function polishCombineFlow(root) {
  const panel = root.querySelector(".m328-reg-panel");
  const heading = panel?.querySelector(".m328-reg-panel-head h3");
  const kicker = panel?.querySelector(".m328-reg-panel-head .m328-reg-kicker");
  const types = panel?.querySelector(".m328-reg-types");
  if (heading) heading.textContent = "Hinzufügen";
  if (kicker) kicker.textContent = "Sammelanmeldung";
  if (types && !panel.querySelector(".m328-reg-combine-hint")) {
    const hint = document.createElement("p");
    hint.className = "m328-reg-combine-hint";
    hint.textContent = "Einzelpersonen und Gruppen beliebig kombinieren. Alles wird unten gesammelt und gemeinsam gespeichert.";
    types.after(hint);
  }
}

function bindFocusGuards() {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("click", event => {
    if (!event.target?.closest?.("#m328BusOrgaPage [data-m328-reg-source]")) return;
    queueMicrotask(blurRegistrationField);
  });

  document.addEventListener("submit", event => {
    if (!event.target?.matches?.("#m328BusOrgaPage [data-m328-guest-form]")) return;
    queueMicrotask(blurRegistrationField);
  });
}

export function setupM328RegistrationUxPolish() {
  const root = registrationRoot();
  if (!root) return;
  ensureStyle();
  polishHeader(root);
  polishCombineFlow(root);
  bindFocusGuards();
  queueMicrotask(blurRegistrationField);
}
