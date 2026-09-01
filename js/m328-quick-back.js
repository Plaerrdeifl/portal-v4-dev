const BACK_SELECTOR = [
  "#m328BookingsBack",
  "#m328TripEditBack",
  "#m328TripEditLoadBack",
  "#m328Reg3Back",
  "#m328Reg3LoadBack",
  "[data-m328-workspace-back]",
  "[data-m328-workspace-load-back]"
].join(",");

function routeState() {
  const hash = String(location.hash || "");
  const [path, query = ""] = hash.split("?", 2);
  const params = new URLSearchParams(query);
  return {
    path,
    view: params.get("view") || "",
    tripId: params.get("trip") || "",
    from: params.get("from") || "",
    quick: params.get("quick") || ""
  };
}

function isQuickOrigin(route = routeState()) {
  return route.path === "#/bus-orga" && Boolean(route.view && route.tripId && route.from === "quick" && route.quick);
}

function quickSelectionHash(action) {
  return `#/bus-orga?${new URLSearchParams({ quick: String(action || "") })}`;
}

function ensureStyle() {
  if (document.getElementById("m328QuickBackStyle")) return;
  const style = document.createElement("style");
  style.id = "m328QuickBackStyle";
  style.textContent = `
    body.m328-quick-origin #m328BookingsBack,
    body.m328-quick-origin #m328TripEditBack,
    body.m328-quick-origin #m328TripEditLoadBack,
    body.m328-quick-origin #m328Reg3Back,
    body.m328-quick-origin #m328Reg3LoadBack,
    body.m328-quick-origin [data-m328-workspace-back],
    body.m328-quick-origin [data-m328-workspace-load-back]{font-size:0!important}
    body.m328-quick-origin #m328BookingsBack::after,
    body.m328-quick-origin #m328TripEditBack::after,
    body.m328-quick-origin #m328TripEditLoadBack::after,
    body.m328-quick-origin #m328Reg3Back::after,
    body.m328-quick-origin #m328Reg3LoadBack::after,
    body.m328-quick-origin [data-m328-workspace-back]::after,
    body.m328-quick-origin [data-m328-workspace-load-back]::after{content:"← Auswahl";font-size:.76rem;font-weight:inherit}
  `;
  document.head.appendChild(style);
}

function syncRouteClass() {
  ensureStyle();
  document.body.classList.toggle("m328-quick-origin", isQuickOrigin());
}

window.addEventListener("click", event => {
  const route = routeState();
  if (!isQuickOrigin(route)) return;
  const target = event.target instanceof Element ? event.target.closest(BACK_SELECTOR) : null;
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  location.hash = quickSelectionHash(route.quick);
}, true);

window.addEventListener("hashchange", syncRouteClass);
syncRouteClass();

export function noop() {}
