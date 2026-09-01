const ACTION_LABELS = Object.freeze({
  ACCESS_REQUEST_APPROVED: "Zugangsantrag freigegeben",
  ACCESS_REQUEST_REJECTED: "Zugangsantrag abgelehnt",
  EVENT_CREATED: "Termin angelegt",
  EVENT_UPDATED: "Termin geändert",
  EVENT_DELETED: "Termin gelöscht",
  FANBUS_BUS_ASSIGNED: "Teilnehmer einem Bus zugeordnet",
  FANBUS_BUS_ASSIGNMENT_CHANGED: "Buszuordnung geändert",
  FANBUS_BUS_CREATED: "Bus angelegt",
  FANBUS_BUS_UPDATED: "Bus geändert",
  FANBUS_BUS_UPSERT: "Bus angelegt oder geändert",
  FANBUS_REGISTRATION_CREATED: "Teilnehmer angemeldet",
  FANBUS_REGISTRATION_UPDATED: "Teilnehmer geändert",
  FANBUS_REGISTRATION_CANCELLED: "Teilnehmer storniert",
  FANBUS_WAITLIST_PROMOTED: "Teilnehmer von der Warteliste übernommen",
  FANBUS_TRIP_CREATED: "Fanbusfahrt angelegt",
  FANBUS_TRIP_UPDATED: "Fanbusfahrt geändert",
  FANBUS_TRIP_PUBLISHED: "Fanbusfahrt veröffentlicht",
  FANBUS_TRIP_CLOSED: "Fanbusfahrt geschlossen",
  FANBUS_TRIP_CANCELLED: "Fanbusfahrt abgesagt",
  FINANCE_ACCOUNT_CREATED: "Finanzkonto angelegt",
  FINANCE_ACCOUNT_UPDATED: "Finanzkonto geändert",
  FINANCE_ACCOUNT_RETIRED: "Finanzkonto entfernt",
  MEMBERSHIP_APPLICATION_APPROVED: "Mitgliedsantrag freigegeben",
  MEMBERSHIP_APPLICATION_REJECTED: "Mitgliedsantrag abgelehnt",
  ROLE_CREATED: "Portalrolle angelegt",
  ROLE_UPDATED: "Portalrolle geändert",
  ROLE_DELETED: "Portalrolle gelöscht",
  TASK_CREATED: "Aufgabe angelegt",
  TASK_UPDATED: "Aufgabe geändert",
  TASK_ARCHIVED: "Aufgabe archiviert",
  TASK_RESTORED: "Aufgabe wiederhergestellt",
  TEAM_CREATED: "Team angelegt",
  TEAM_UPDATED: "Team geändert",
  TEAM_DELETED: "Team gelöscht",
  TEAM_MEMBER_UPDATED: "Teammitglied geändert",
  TEAM_MEMBER_REMOVED: "Teammitglied entfernt",
  USER_CREATED: "Benutzer angelegt",
  USER_UPDATED: "Benutzer geändert",
  USER_ACTIVATED: "Benutzer aktiviert",
  USER_DEACTIVATED: "Benutzer deaktiviert"
});

const ENTITY_LABELS = Object.freeze({
  access_request: "Zugangsantrag",
  audit_event: "Audit-Ereignis",
  event: "Termin",
  fanbus_boarding_stop: "Zustiegsort",
  fanbus_bus: "Fanbus",
  fanbus_registration: "Teilnehmer",
  fanbus_trip: "Fanbusfahrt",
  finance_account: "Finanzkonto",
  finance_entry: "Buchung",
  member: "Mitglied",
  membership_application: "Mitgliedsantrag",
  portal_role: "Portalrolle",
  role: "Portalrolle",
  task: "Aufgabe",
  team: "Team",
  team_member: "Teammitglied",
  user: "Benutzer"
});

const TOKEN_LABELS = Object.freeze({
  ACCESS: "Zugang",
  APPLICATION: "Antrag",
  BOARDING: "Zustieg",
  BUS: "Bus",
  FANBUS: "Fanbus",
  FINANCE: "Finanzen",
  MEMBER: "Mitglied",
  MEMBERSHIP: "Mitgliedschaft",
  REGISTRATION: "Teilnehmer",
  REQUEST: "Antrag",
  ROLE: "Rolle",
  TASK: "Aufgabe",
  TEAM: "Team",
  TRIP: "Fahrt",
  USER: "Benutzer"
});

const ACTION_SUFFIXES = Object.freeze({
  ACTIVATED: "aktiviert",
  ADDED: "hinzugefügt",
  APPROVED: "freigegeben",
  ARCHIVED: "archiviert",
  ASSIGNED: "zugeordnet",
  CANCELLED: "storniert",
  CLOSED: "geschlossen",
  CREATED: "angelegt",
  DEACTIVATED: "deaktiviert",
  DELETED: "gelöscht",
  PUBLISHED: "veröffentlicht",
  REJECTED: "abgelehnt",
  REMOVED: "entfernt",
  RESTORED: "wiederhergestellt",
  UPDATED: "geändert",
  UPSERT: "angelegt oder geändert"
});

function words(value) {
  return String(value || "")
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean);
}

function humanizeWords(tokens) {
  const label = tokens.map(token => {
    const upper = token.toUpperCase();
    if (TOKEN_LABELS[upper]) return TOKEN_LABELS[upper];
    const lower = token.toLocaleLowerCase("de-DE");
    return lower.charAt(0).toLocaleUpperCase("de-DE") + lower.slice(1);
  }).join(" ");
  return label || "Unbekannt";
}

export function auditActionLabel(value) {
  const key = String(value || "").trim().toUpperCase();
  if (!key) return "Unbekannte Aktion";
  if (ACTION_LABELS[key]) return ACTION_LABELS[key];

  const tokens = words(key);
  const suffix = ACTION_SUFFIXES[tokens.at(-1)];
  if (!suffix) return humanizeWords(tokens);
  return `${humanizeWords(tokens.slice(0, -1))} ${suffix}`;
}

export function auditEntityLabel(value) {
  const key = String(value || "").trim().toLocaleLowerCase("de-DE");
  return ENTITY_LABELS[key] || humanizeWords(words(key));
}

export function auditActor(event, users = []) {
  const actorUserId = String(event?.actorUserId || "").trim();
  if (!actorUserId) return { primary: "System", technical: "" };

  const user = users.find(item => String(item?.id || "") === actorUserId);
  const displayName = [user?.firstName, user?.lastName]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

  return {
    primary: displayName || "Unbekannter Benutzer",
    technical: actorUserId
  };
}
