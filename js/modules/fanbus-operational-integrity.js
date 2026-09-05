const CURRENT_STATUSES = new Set(["ACTIVE", "WAITLISTED"]);

export function isCurrentFanbusRegistration(registration) {
  return CURRENT_STATUSES.has(String(registration?.status || "").toUpperCase());
}

export function fanbusBookingKey(registration) {
  return String(registration?.bookingId || registration?.id || "");
}

export function fanbusPersonName(registration) {
  return `${registration?.firstName || ""} ${registration?.lastName || ""}`.trim() || "Unbenannte Person";
}

export function buildOperationalBookingContexts(registrations = []) {
  const grouped = new Map();
  for (const registration of registrations) {
    const key = fanbusBookingKey(registration);
    if (!key) continue;
    const group = grouped.get(key) || [];
    group.push(registration);
    grouped.set(key, group);
  }

  const contexts = new Map();
  for (const [key, group] of grouped) {
    const primary = group.find(item => item?.bookingRole === "PRIMARY") || group[0] || null;
    const current = group.filter(isCurrentFanbusRegistration);
    contexts.set(key, {
      count: current.length,
      historicalCount: group.length,
      cancelledCount: group.length - current.length,
      primaryName: fanbusPersonName(primary),
      current,
      all: group
    });
  }
  return contexts;
}

export function operationalBookingRoleLabel(registration, context) {
  if (!isCurrentFanbusRegistration(registration)) {
    return registration?.bookingRole === "COMPANION" ? "Mitfahrer" : "Einzelbuchung";
  }
  if (!context || context.count <= 1) return "Einzelbuchung";
  if (registration?.bookingRole === "COMPANION") {
    return `Mitfahrer · Gruppe ${context.primaryName}`;
  }
  return `Gruppenbuchung · ${context.count} Personen`;
}

export function operationalGroupLabel(context) {
  if (!context || context.count <= 1) return "";
  return `Gruppe ${context.primaryName} · ${context.count} Personen`;
}

export function operationalBookingCountLabel(context) {
  if (!context) return "0 Personen";
  if (context.count === 0 && context.cancelledCount > 0) {
    return `0 aktuell · ${context.cancelledCount} storniert`;
  }
  const current = `${context.count} ${context.count === 1 ? "Person" : "Personen"}`;
  return context.cancelledCount > 0
    ? `${current} · ${context.cancelledCount} storniert`
    : current;
}
