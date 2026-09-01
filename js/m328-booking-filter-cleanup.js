function isBookingsView() {
  const hash = String(location.hash || "");
  if (!hash.startsWith("#/bus-orga")) return false;
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get("view") === "bookings";
}

function ensureStyle() {
  if (document.getElementById("m328BookingFilterCleanupStyle")) return;
  const style = document.createElement("style");
  style.id = "m328BookingFilterCleanupStyle";
  style.textContent = `
    .m328-bookings-tools.m328-booking-filter-cleaned{overflow:visible!important}
    .m328-booking-filter-cleaned .m328-final-booking-tools-row{position:relative;overflow:visible;align-items:center!important;flex-direction:row!important}
    .m328-booking-filter-cleaned .m328-final-booking-filter{position:relative;flex:0 0 auto}
    .m328-booking-filter-cleaned .m328-final-booking-filter-body{position:absolute;z-index:30;right:0;top:calc(100% + 6px);width:min(220px,calc(100vw - 52px));min-width:0;margin:0;padding:9px;border:1px solid var(--line);border-radius:11px;background:var(--surface);box-shadow:0 10px 28px rgba(4,28,51,.14)}
    .m328-booking-filter-cleaned .m328-final-booking-filter-body select{width:100%;max-width:100%;min-width:0}
  `;
  document.head.appendChild(style);
}

function cleanupBookingFilter() {
  if (!isBookingsView()) return;
  ensureStyle();
  const tools = document.querySelector(".m328-bookings-tools");
  if (!tools) return;
  const finalFilter = tools.querySelector(".m328-final-booking-filter");
  if (!finalFilter) return;
  tools.querySelector(".m328-bookings-filter")?.remove();
  tools.classList.add("m328-booking-filter-cleaned");
}

let scheduled = false;
function scheduleCleanup() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    cleanupBookingFilter();
  });
}

window.addEventListener("hashchange", scheduleCleanup);
const observer = new MutationObserver(scheduleCleanup);
observer.observe(document.documentElement, { childList: true, subtree: true });
scheduleCleanup();

export function noop() {}
