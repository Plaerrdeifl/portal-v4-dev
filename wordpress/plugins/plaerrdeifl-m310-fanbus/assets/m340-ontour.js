(function () {
  "use strict";

  const config = window.PD_M340_ONTOUR;
  if (!config || typeof config.ajaxUrl !== "string" || typeof config.action !== "string") {
    return;
  }

  document.addEventListener("click", function (event) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest("a[data-pd-m340-referral]");
    if (!(link instanceof HTMLAnchorElement)) {
      return;
    }

    const slug = link.dataset.pdM340Slug;
    const tripId = link.dataset.pdM340TripId;
    if (!slug || !tripId) {
      return;
    }

    const body = new FormData();
    body.append("action", config.action);
    body.append("slug", slug);
    body.append("tripId", tripId);

    try {
      if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(config.ajaxUrl, body)) {
        return;
      }
    } catch (_error) {
      // The direct href remains authoritative even when telemetry is unavailable.
    }

    if (typeof window.fetch === "function") {
      window.fetch(config.ajaxUrl, {
        method: "POST",
        body,
        credentials: "omit",
        keepalive: true
      }).catch(function () {});
    }
  });
})();
