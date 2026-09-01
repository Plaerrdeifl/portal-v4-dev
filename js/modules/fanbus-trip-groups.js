const BERLIN_TIME_ZONE = "Europe/Berlin";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const BERLIN_DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function currentBerlinDate(now = new Date()) {
  const parts = Object.fromEntries(
    BERLIN_DATE_PARTS
      .formatToParts(now)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function compareTrips(left, right, direction) {
  const leftDate = DATE_PATTERN.test(String(left.trip?.eventDate || ""))
    ? String(left.trip.eventDate)
    : null;
  const rightDate = DATE_PATTERN.test(String(right.trip?.eventDate || ""))
    ? String(right.trip.eventDate)
    : null;

  if (leftDate && !rightDate) return -1;
  if (!leftDate && rightDate) return 1;
  if (leftDate !== rightDate) return direction * leftDate.localeCompare(rightDate);

  const leftTime = String(left.trip?.eventTime || "");
  const rightTime = String(right.trip?.eventTime || "");
  if (leftTime !== rightTime) return direction * leftTime.localeCompare(rightTime);

  return left.index - right.index;
}

function sortedTrips(items, direction) {
  return items
    .map((trip, index) => ({ trip, index }))
    .sort((left, right) => compareTrips(left, right, direction))
    .map(item => item.trip);
}

export function groupFanbusTrips(items, today = currentBerlinDate()) {
  const groups = { active: [], planned: [], history: [] };

  for (const trip of Array.isArray(items) ? items : []) {
    const eventDate = String(trip?.eventDate || "");
    const isPast = DATE_PATTERN.test(eventDate) && eventDate < today;

    if (trip?.status === "CANCELLED" || isPast) {
      groups.history.push(trip);
    } else if (trip?.status === "DRAFT") {
      groups.planned.push(trip);
    } else {
      groups.active.push(trip);
    }
  }

  return {
    active: sortedTrips(groups.active, 1),
    planned: sortedTrips(groups.planned, 1),
    history: sortedTrips(groups.history, -1)
  };
}
