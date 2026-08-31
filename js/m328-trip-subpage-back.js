import "./m329-contact-actions.js?v=20260831-m329-contact-actions1";

const SUBPAGE_VIEWS = new Set(["trip-edit", "registration"]);
const BACK_SELECTOR = "#m328TripEditBack,#m328TripEditLoadBack,#m328Reg3Back,#m328Reg3LoadBack";

function routeState(hash = location.hash) {
  const raw = String(hash || "");
  if (!raw.startsWith("#/bus-orga")) return null;
  const query = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : "";
  const params = new URLSearchParams(query);
  const view = params.get("view") || "";
  const tripId = params.get("trip") || "";
  return SUBPAGE_VIEWS.has(view) && tripId ? { view, tripId } : null;
}

function tripDetailHash(tripId) {
  return `#/bus-orga?${new URLSearchParams({ view: "trip-detail", trip: String(tripId || "") })}`;
}

function relabelBackButtons() {
  if (!routeState()) return;
  document.querySelectorAll(BACK_SELECTOR).forEach(button => {
    if (button.textContent !== "← Fahrt") button.textContent = "← Fahrt";
    if (button.getAttribute("aria-label") !== "Zur Fahrt zurück") {
      button.setAttribute("aria-label", "Zur Fahrt zurück");
    }
  });
}

let previousTripContext = routeState();

document.addEventListener("click", event => {
  const button = event.target instanceof Element ? event.target.closest(BACK_SELECTOR) : null;
  if (!button) return;
  const context = routeState();
  if (!context) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  location.hash = tripDetailHash(context.tripId);
}, true);

window.addEventListener("hashchange", () => {
  const nextContext = routeState();
  if (previousTripContext && location.hash === "#/bus-orga") {
    const target = tripDetailHash(previousTripContext.tripId);
    previousTripContext = null;
    location.hash = target;
    return;
  }
  previousTripContext = nextContext;
  queueMicrotask(relabelBackButtons);
});

const observer = new MutationObserver(relabelBackButtons);
observer.observe(document.documentElement, { childList: true, subtree: true });
relabelBackButtons();
