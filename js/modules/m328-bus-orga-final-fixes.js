import {
  call,
  confirmAction,
  runWrite,
  showToast
} from "./common.js";

let publishCaptureBound = false;

function routeParams() {
  const hash = String(location.hash || "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query);
}

function bindNativeTripCreateEntry() {
  const button = document.getElementById("m328CreateTrip");
  if (!(button instanceof HTMLButtonElement) || button.dataset.m328NativeCreate === "true") return;
  button.dataset.m328NativeCreate = "true";
  button.onclick = event => {
    event?.preventDefault?.();
    location.hash = "#/bus-orga?view=trip-create";
  };
}

function publishPreflight(trip) {
  if (!trip) return "Die Fanbusfahrt konnte nicht neu geladen werden.";
  if (trip.status !== "DRAFT") return "Nur ein Entwurf kann veröffentlicht werden.";
  if (trip.visibility && trip.visibility !== "PUBLIC") return "Der zugehörige Termin muss öffentlich sichtbar sein.";
  if (!trip.departureAt) return "Bitte zuerst die Abfahrt festlegen.";
  if (!trip.registrationClosesAt) return "Bitte zuerst den Anmeldeschluss festlegen.";
  if (trip.priceCents === null || trip.priceCents === undefined || Number(trip.priceCents) < 0) return "Bitte zuerst einen gültigen Fahrtpreis festlegen.";
  const capacity = Number(trip.effectiveCapacity ?? trip.capacity ?? 0);
  if (!(capacity > 0)) return "Bitte zuerst mindestens einen Bus mit Kapazität anlegen.";
  if (!String(trip.privacyReference || "").trim() || !String(trip.termsReference || "").trim()) {
    return "Datenschutz- oder Teilnahmebedingungen fehlen.";
  }
  const now = Date.now();
  const departure = new Date(trip.departureAt).getTime();
  const closes = new Date(trip.registrationClosesAt).getTime();
  if (!Number.isFinite(departure) || !Number.isFinite(closes) || departure <= now || closes <= now || closes > departure) {
    return "Abfahrt und Anmeldeschluss sind zeitlich nicht plausibel.";
  }
  return "";
}

async function publishFreshTrip(tripId) {
  const data = await call("fanbus_trips_list");
  const trip = (Array.isArray(data?.trips) ? data.trips : []).find(item => item.id === tripId);
  const issue = publishPreflight(trip);
  if (issue) {
    showToast(issue, "error", 5600);
    return;
  }

  const confirmed = await confirmAction(
    `Fanbusfahrt „${trip.displayTitle || trip.venue || "Fanbusfahrt"}“ veröffentlichen?`,
    { title: "Fanbusfahrt veröffentlichen", submitLabel: "Veröffentlichen" }
  );
  if (!confirmed) return;

  try {
    await runWrite(
      () => call("fanbus_trip_publish", {
        id: trip.id,
        expectedRevision: Number(trip.revision)
      }),
      "Fanbusfahrt wurde veröffentlicht."
    );
    const params = new URLSearchParams({
      view: "trip-detail",
      trip: String(trip.id),
      refresh: String(Date.now())
    });
    location.hash = `#/bus-orga?${params}`;
  } catch (error) {
    if (error?.code === "40001") {
      showToast("Die Fahrt wurde gerade erneut geändert. Die Ansicht wird aktualisiert.", "error", 5200);
      const params = new URLSearchParams({
        view: "trip-detail",
        trip: String(trip.id),
        refresh: String(Date.now())
      });
      location.hash = `#/bus-orga?${params}`;
      return;
    }
    showToast(error?.message || "Fanbusfahrt konnte nicht veröffentlicht werden.", "error", 5600);
  }
}

function bindFreshPublishCapture() {
  if (publishCaptureBound) return;
  publishCaptureBound = true;
  document.addEventListener("click", event => {
    const button = event.target instanceof Element
      ? event.target.closest('[data-m328-trip-menu-action="publish"]')
      : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const tripId = routeParams().get("trip") || "";
    if (!tripId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    button.closest("dialog")?.close?.();
    void publishFreshTrip(tripId);
  }, true);
}

export function setupM328BusOrgaFinalFixes() {
  bindNativeTripCreateEntry();
  bindFreshPublishCapture();
}

export function noop() {}
