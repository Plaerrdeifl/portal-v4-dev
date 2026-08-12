export const MAX_ICS_BYTES = 1024 * 1024;
export const SOURCE_TYPE = "ICS";
export const SOURCE_KEY = "ERV_BAYERNLIGA_2026_27";
export const SOURCE_LABEL = "ERV Bayernliga 2026/27";

const PLAUSIBLE_ICS_MIME_TYPES = new Set([
  "text/calendar",
  "text/ics",
  "text/x-vcalendar",
  "application/ics",
  "application/calendar",
  "application/x-ical",
  "application/vnd.ms-outlook"
]);
const GENERIC_UPLOAD_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream"
]);

const decoder = new TextDecoder("utf-8", { fatal: true });
const BERLIN_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23"
});
const SINGLE_VALUE_PROPERTIES = new Set([
  "UID", "DTSTART", "DTEND", "SUMMARY", "LOCATION", "DESCRIPTION",
  "STATUS", "LAST-MODIFIED", "SEQUENCE", "DTSTAMP"
]);
const REJECTED_EVENT_PROPERTIES = new Set(["RRULE", "RECURRENCE-ID", "EXDATE"]);

export class IcsValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IcsValidationError";
    this.code = code;
  }
}

export function plausibleIcsMimeType(value) {
  const normalized = String(value || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return GENERIC_UPLOAD_MIME_TYPES.has(normalized)
    || PLAUSIBLE_ICS_MIME_TYPES.has(normalized);
}

function reject(code, message) {
  throw new IcsValidationError(code, message);
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(bytes) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function unfoldLines(text) {
  if (text.includes("\r") && !text.includes("\r\n")) {
    reject("INVALID_LINE_ENDINGS", "Die ICS-Datei enthält ungültige Zeilenumbrüche.");
  }
  const normalized = text.replace(/\r\n/g, "\n");
  if (normalized.includes("\r")) {
    reject("INVALID_LINE_ENDINGS", "Die ICS-Datei enthält ungültige Zeilenumbrüche.");
  }

  const physical = normalized.split("\n");
  const logical = [];
  for (const line of physical) {
    if (/^[ \t]/.test(line)) {
      if (!logical.length) reject("INVALID_FOLD", "Die ICS-Faltung ist ungültig.");
      logical[logical.length - 1] += line.slice(1);
    } else {
      logical.push(line);
    }
  }
  while (logical.at(-1) === "") logical.pop();
  return logical;
}

function parseContentLine(line) {
  let separator = -1;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') quoted = !quoted;
    if (char === ":" && !quoted) {
      separator = index;
      break;
    }
  }
  if (separator < 1 || quoted) reject("INVALID_CONTENT_LINE", "Eine ICS-Inhaltszeile ist ungültig.");

  const head = line.slice(0, separator);
  const value = line.slice(separator + 1);
  const segments = head.split(";");
  const name = segments.shift().toUpperCase();
  if (!/^[A-Z0-9-]+$/.test(name)) reject("INVALID_PROPERTY", "Ein ICS-Feldname ist ungültig.");

  const params = {};
  for (const segment of segments) {
    const equals = segment.indexOf("=");
    if (equals < 1) reject("INVALID_PARAMETER", `Ein Parameter von ${name} ist ungültig.`);
    const key = segment.slice(0, equals).toUpperCase();
    let parameterValue = segment.slice(equals + 1);
    if (parameterValue.startsWith('"') || parameterValue.endsWith('"')) {
      if (!(parameterValue.startsWith('"') && parameterValue.endsWith('"'))) {
        reject("INVALID_PARAMETER", `Ein Parameter von ${name} ist ungültig.`);
      }
      parameterValue = parameterValue.slice(1, -1);
    }
    if (!key || Object.hasOwn(params, key) || !parameterValue) {
      reject("INVALID_PARAMETER", `Ein Parameter von ${name} ist ungültig.`);
    }
    params[key] = parameterValue;
  }
  return { name, params, value };
}

function unescapeText(value) {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\\") {
      result += value[index];
      continue;
    }
    const escaped = value[index + 1];
    if (escaped === "n" || escaped === "N") result += "\n";
    else if (escaped === ",") result += ",";
    else if (escaped === ";") result += ";";
    else if (escaped === "\\") result += "\\";
    else reject("INVALID_TEXT_ESCAPE", "Ein ICS-Textwert enthält eine ungültige Escape-Sequenz.");
    index += 1;
  }
  return result;
}

function splitTextList(value) {
  const parts = [];
  let current = "";
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      current += `\\${char}`;
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === ",") {
      parts.push(unescapeText(current).trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (escaped) reject("INVALID_TEXT_ESCAPE", "Ein ICS-Textwert endet mit einer ungültigen Escape-Sequenz.");
  parts.push(unescapeText(current).trim());
  return parts.filter(Boolean);
}

function validCalendarParts(year, month, day, hour, minute, second) {
  const value = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return value.getUTCFullYear() === year
    && value.getUTCMonth() === month - 1
    && value.getUTCDate() === day
    && value.getUTCHours() === hour
    && value.getUTCMinutes() === minute
    && value.getUTCSeconds() === second;
}

function partsInBerlin(date) {
  const parts = Object.fromEntries(
    BERLIN_FORMATTER.formatToParts(date)
      .filter(part => part.type !== "literal")
      .map(part => [part.type, Number(part.value)])
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second
  };
}

function sameParts(left, right) {
  return ["year", "month", "day", "hour", "minute", "second"]
    .every(key => left[key] === right[key]);
}

function berlinLocalToInstant(parts) {
  const naive = Date.UTC(
    parts.year, parts.month - 1, parts.day,
    parts.hour, parts.minute, parts.second
  );
  const candidates = [60, 120]
    .map(offsetMinutes => new Date(naive - offsetMinutes * 60_000))
    .filter(candidate => sameParts(partsInBerlin(candidate), parts));
  if (candidates.length !== 1) {
    reject(
      "NON_DETERMINISTIC_DST",
      "Ein Europe/Berlin-Zeitpunkt ist wegen einer DST-Umstellung nicht eindeutig gültig."
    );
  }
  return candidates[0];
}

function normalizedLocalFields(instant) {
  const parts = partsInBerlin(instant);
  const pad = value => String(value).padStart(2, "0");
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
  };
}

function parseDateTime(property, label) {
  if (!property) return null;
  const valueType = String(property.params.VALUE || "DATE-TIME").toUpperCase();
  if (valueType === "DATE" || /^\d{8}$/.test(property.value)) {
    reject("ALL_DAY_NOT_SUPPORTED", `${label} darf kein ganztägiger Termin sein.`);
  }
  if (valueType !== "DATE-TIME") reject("INVALID_DATETIME", `${label} hat einen ungültigen Werttyp.`);

  const utc = property.value.endsWith("Z");
  const raw = utc ? property.value.slice(0, -1) : property.value;
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(raw);
  if (!match) reject("INVALID_DATETIME", `${label} ist kein gültiger RFC5545-Zeitpunkt.`);
  const [, y, mo, d, h, mi, s] = match;
  const parts = {
    year: Number(y), month: Number(mo), day: Number(d),
    hour: Number(h), minute: Number(mi), second: Number(s)
  };
  if (!validCalendarParts(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second)) {
    reject("INVALID_DATETIME", `${label} enthält kein gültiges Datum.`);
  }

  const tzid = property.params.TZID;
  if (utc) {
    if (tzid) reject("INVALID_DATETIME", `${label} kombiniert UTC und TZID.`);
    return new Date(Date.UTC(
      parts.year, parts.month - 1, parts.day,
      parts.hour, parts.minute, parts.second
    ));
  }
  if (!tzid) reject("FLOATING_TIME_NOT_SUPPORTED", `${label} benötigt Europe/Berlin oder UTC.`);
  if (tzid !== "Europe/Berlin") reject("UNKNOWN_TZID", `${label} verwendet eine nicht unterstützte Zeitzone.`);
  return berlinLocalToInstant(parts);
}

function one(event, name, required = false) {
  const properties = event.filter(property => property.name === name);
  if (properties.length > 1 && SINGLE_VALUE_PROPERTIES.has(name)) {
    reject("DUPLICATE_PROPERTY", `${name} darf in einem VEVENT nur einmal vorkommen.`);
  }
  if (required && properties.length !== 1) reject(`MISSING_${name}`, `${name} ist für jedes VEVENT erforderlich.`);
  return properties[0] || null;
}

function recognizeGame(summary, categories) {
  const home = categories.includes("Heimspiel");
  const away = categories.includes("Auswärtsspiel");
  if (home === away) reject("CONFLICTING_GAME_SIGNALS", "CATEGORIES muss genau Heimspiel oder Auswärtsspiel enthalten.");

  if (home) {
    const match = /^(?:🏠\s*)?ERV Schweinfurt\s+-\s+(.+)$/.exec(summary);
    const opponent = match?.[1]?.trim();
    if (!opponent) reject("INVALID_HOME_GAME", "Das Heimspiel-SUMMARY enthält keinen gültigen Gegner.");
    return { homeAway: "HOME", opponentName: opponent };
  }

  const match = /^(?:🚌\s*)?(.+?)\s+-\s+ERV Schweinfurt$/.exec(summary);
  const opponent = match?.[1]?.trim();
  if (!opponent) reject("INVALID_AWAY_GAME", "Das Auswärtsspiel-SUMMARY enthält keinen gültigen Gegner.");
  return { homeAway: "AWAY", opponentName: opponent };
}

function normalizeEvent(event, index) {
  for (const property of event) {
    if (REJECTED_EVENT_PROPERTIES.has(property.name)) {
      reject("RECURRENCE_NOT_SUPPORTED", `${property.name} wird in VEVENT nicht unterstützt.`);
    }
  }

  const uid = unescapeText(one(event, "UID", true).value).trim();
  if (!uid || uid.length > 512 || /[\u0000-\u001f\u007f]/.test(uid)) {
    reject("INVALID_UID", `VEVENT ${index + 1} enthält keine gültige UID.`);
  }
  const status = unescapeText(one(event, "STATUS", true).value).trim().toUpperCase();
  if (status !== "CONFIRMED") {
    reject("STATUS_NOT_SUPPORTED", `VEVENT ${index + 1} ist kein bestätigter Spieltermin.`);
  }

  const summary = unescapeText(one(event, "SUMMARY", true).value).trim();
  if (!summary) reject("MISSING_SUMMARY", `VEVENT ${index + 1} enthält kein SUMMARY.`);
  const description = one(event, "DESCRIPTION");
  if (description) unescapeText(description.value);
  const sequence = one(event, "SEQUENCE");
  if (sequence && !/^\d+$/.test(sequence.value)) {
    reject("INVALID_SEQUENCE", `VEVENT ${index + 1} enthält keine gültige SEQUENCE.`);
  }
  const lastModified = one(event, "LAST-MODIFIED");
  if (lastModified) parseDateTime(lastModified, "LAST-MODIFIED");
  const stamp = one(event, "DTSTAMP");
  if (stamp) parseDateTime(stamp, "DTSTAMP");
  const categories = event
    .filter(property => property.name === "CATEGORIES")
    .flatMap(property => splitTextList(property.value));
  const game = recognizeGame(summary, categories);

  const startInstant = parseDateTime(one(event, "DTSTART", true), "DTSTART");
  const endProperty = one(event, "DTEND");
  const endInstant = endProperty ? parseDateTime(endProperty, "DTEND") : null;
  if (endInstant && endInstant.getTime() <= startInstant.getTime()) {
    reject("INVALID_END", "DTEND muss nach DTSTART liegen.");
  }
  const start = normalizedLocalFields(startInstant);
  const end = endInstant ? normalizedLocalFields(endInstant) : null;
  const location = one(event, "LOCATION");
  const venue = location ? unescapeText(location.value).trim() || null : null;

  return {
    uid,
    eventDate: start.date,
    eventTime: start.time,
    endDate: end?.date || null,
    endTime: end?.time || null,
    venue,
    homeAway: game.homeAway,
    opponentName: game.opponentName
  };
}

export async function parseIcsFile(bytes, originalFilename) {
  if (!(bytes instanceof Uint8Array)) reject("INVALID_FILE", "Die Datei konnte nicht gelesen werden.");
  if (bytes.byteLength > MAX_ICS_BYTES) reject("FILE_TOO_LARGE", "Die ICS-Datei darf höchstens 1 MiB groß sein.");
  if (bytes.byteLength === 0) reject("EMPTY_FILE", "Die ICS-Datei ist leer.");
  if (
    !/\.ics$/i.test(String(originalFilename || ""))
    || /[\\/\u0000-\u001f\u007f]/.test(String(originalFilename || ""))
  ) reject("INVALID_EXTENSION", "Es werden ausschließlich lokale .ics-Dateien akzeptiert.");

  let text;
  try {
    text = decoder.decode(bytes);
  } catch {
    reject("INVALID_UTF8", "Die ICS-Datei ist nicht gültig UTF-8-kodiert.");
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (/\u0000/.test(text)) reject("INVALID_TEXT", "Die ICS-Datei enthält ungültige Zeichen.");

  const lines = unfoldLines(text);
  if (lines[0] !== "BEGIN:VCALENDAR" || lines.at(-1) !== "END:VCALENDAR") {
    reject("INVALID_VCALENDAR", "Die Datei enthält keine gültige VCALENDAR-Struktur.");
  }

  const events = [];
  const calendarProperties = [];
  let currentEvent = null;
  let calendarDepth = 0;
  let timezoneDepth = 0;
  for (const line of lines) {
    const property = parseContentLine(line);
    if (property.name === "BEGIN") {
      const component = property.value.toUpperCase();
      if (component === "VCALENDAR") calendarDepth += 1;
      else if (component === "VTIMEZONE") timezoneDepth += 1;
      else if (component === "VEVENT") {
        if (currentEvent || calendarDepth !== 1 || timezoneDepth) reject("INVALID_VCALENDAR", "VEVENT ist ungültig verschachtelt.");
        currentEvent = [];
      } else if (currentEvent) reject("INVALID_VEVENT", "Unterkomponenten in VEVENT werden nicht unterstützt.");
      continue;
    }
    if (property.name === "END") {
      const component = property.value.toUpperCase();
      if (component === "VEVENT") {
        if (!currentEvent) reject("INVALID_VEVENT", "VEVENT wurde unerwartet beendet.");
        events.push(currentEvent);
        currentEvent = null;
      } else if (component === "VTIMEZONE") timezoneDepth -= 1;
      else if (component === "VCALENDAR") calendarDepth -= 1;
      if (calendarDepth < 0 || timezoneDepth < 0) reject("INVALID_VCALENDAR", "Die VCALENDAR-Struktur ist ungültig.");
      continue;
    }
    if (currentEvent) currentEvent.push(property);
    else if (calendarDepth === 1 && timezoneDepth === 0) calendarProperties.push(property);
  }
  if (currentEvent || calendarDepth !== 0 || timezoneDepth !== 0 || events.length === 0) {
    reject("INVALID_VCALENDAR", "Die VCALENDAR-Struktur ist unvollständig oder enthält keine VEVENTs.");
  }
  const versions = calendarProperties.filter(property => property.name === "VERSION");
  if (versions.length !== 1 || versions[0].value !== "2.0") {
    reject("INVALID_VCALENDAR", "VCALENDAR benötigt genau VERSION:2.0.");
  }

  const records = events.map(normalizeEvent);
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record.uid)) reject("DUPLICATE_UID", `UID ${record.uid} kommt mehrfach in der Datei vor.`);
    seen.add(record.uid);
  }

  return {
    sourceType: SOURCE_TYPE,
    sourceKey: SOURCE_KEY,
    sourceLabel: SOURCE_LABEL,
    originalFilename: String(originalFilename),
    fileSize: bytes.byteLength,
    fileSha256: await sha256Hex(bytes),
    records
  };
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function previewFingerprint(parsed, previewState) {
  const material = {
    fileSha256: parsed.fileSha256,
    sourceType: parsed.sourceType,
    sourceKey: parsed.sourceKey,
    records: parsed.records,
    state: previewState
  };
  return sha256Hex(new TextEncoder().encode(stableStringify(material)));
}
