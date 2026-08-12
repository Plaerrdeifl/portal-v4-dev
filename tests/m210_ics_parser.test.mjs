import assert from "node:assert/strict";
import test from "node:test";
import {
  IcsValidationError,
  MAX_ICS_BYTES,
  parseIcsFile,
  plausibleIcsMimeType
} from "../supabase/functions/m210-ics-import/ics-parser.js";

const encode = value => new TextEncoder().encode(value);

function event({
  uid = "game-1@example.test",
  start = "DTSTART;TZID=Europe/Berlin:20260920T180000",
  end = "DTEND;TZID=Europe/Berlin:20260920T203000",
  summary = "🏠 ERV Schweinfurt - Eisbären Würzburg",
  categories = "Heimspiel",
  status = "CONFIRMED",
  extra = ""
} = {}) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "DTSTAMP:20260811T100000Z",
    start,
    end,
    `SUMMARY:${summary}`,
    "LOCATION:Alpha\\, Arena",
    "DESCRIPTION:Gegner: Eisbären Würzburg\\nBitte pünktlich",
    `STATUS:${status}`,
    "LAST-MODIFIED:20260811T100000Z",
    "SEQUENCE:2",
    `CATEGORIES:${categories}`,
    extra,
    "END:VEVENT"
  ].filter(Boolean).join("\n");
}

function calendar(events, eol = "\n") {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ERV//Spielplan//DE",
    ...events,
    "END:VCALENDAR"
  ].join("\n").replaceAll("\n", eol);
}

async function rejectCode(source, code, filename = "spielplan.ics") {
  await assert.rejects(
    () => parseIcsFile(encode(source), filename),
    error => error instanceof IcsValidationError && error.code === code
  );
}

test("accepts plausible calendar and generic upload MIME types but rejects incompatible types", () => {
  for (const mimeType of [
    "text/calendar",
    "text/calendar; charset=utf-8",
    "TEXT/ICS",
    "application/ics",
    "application/vnd.ms-outlook",
    "application/octet-stream",
    "binary/octet-stream",
    ""
  ]) assert.equal(plausibleIcsMimeType(mimeType), true, mimeType || "empty MIME type");

  for (const mimeType of [
    "image/png",
    "application/pdf",
    "application/zip",
    "text/html"
  ]) assert.equal(plausibleIcsMimeType(mimeType), false, mimeType);
});

test("parses an ERV-like UTF-8 calendar with CRLF, folds, emoji, umlauts and escaped text", async () => {
  const folded = event({
    summary: "🏠 ERV Schweinfurt - Eisbären Würz\n burg"
  }).replace("Würz\n burg", "Würz\n burg");
  const result = await parseIcsFile(encode(`\ufeff${calendar([folded], "\r\n")}`), "ERV-Spielplan.ics");

  assert.equal(result.fileSize, encode(`\ufeff${calendar([folded], "\r\n")}`).byteLength);
  assert.match(result.fileSha256, /^[0-9a-f]{64}$/);
  assert.equal(result.sourceKey, "ERV_BAYERNLIGA_2026_27");
  assert.deepEqual(result.records, [{
    uid: "game-1@example.test",
    eventDate: "2026-09-20",
    eventTime: "18:00:00",
    endDate: "2026-09-20",
    endTime: "20:30:00",
    venue: "Alpha, Arena",
    homeAway: "HOME",
    opponentName: "Eisbären Würzburg"
  }]);
});

test("parses multiple VEVENTs and converts UTC Z deterministically to Europe/Berlin", async () => {
  const result = await parseIcsFile(encode(calendar([
    event(),
    event({
      uid: "game-2@example.test",
      start: "DTSTART:20261210T180000Z",
      end: "DTEND:20261210T203000Z",
      summary: "🚌 Höchstadt Alligators - ERV Schweinfurt",
      categories: "Auswärtsspiel"
    })
  ])), "schedule.ics");
  assert.equal(result.records.length, 2);
  assert.equal(result.records[1].eventTime, "19:00:00");
  assert.equal(result.records[1].homeAway, "AWAY");
  assert.equal(result.records[1].opponentName, "Höchstadt Alligators");
});

test("parses a complete 30-game ERV schedule with LF", async () => {
  const games = Array.from({ length: 30 }, (_, index) => event({
    uid: `game-${index + 1}@example.test`,
    summary: index % 2
      ? `🚌 Gegner ${index + 1} - ERV Schweinfurt`
      : `🏠 ERV Schweinfurt - Gegner ${index + 1}`,
    categories: index % 2 ? "Auswärtsspiel" : "Heimspiel"
  }));
  const result = await parseIcsFile(encode(calendar(games)), "30-spiele.ics");
  assert.equal(result.records.length, 30);
  assert.equal(new Set(result.records.map(record => record.uid)).size, 30);
});

test("accepts RRULE inside VTIMEZONE but rejects recurrence fields inside VEVENT", async () => {
  const timezone = [
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Berlin",
    "BEGIN:STANDARD",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "END:STANDARD",
    "END:VTIMEZONE"
  ].join("\n");
  const valid = calendar([timezone, event()]);
  assert.equal((await parseIcsFile(encode(valid), "timezone.ics")).records.length, 1);

  for (const property of [
    "RRULE:FREQ=WEEKLY",
    "RECURRENCE-ID;TZID=Europe/Berlin:20260920T180000",
    "EXDATE;TZID=Europe/Berlin:20260927T180000"
  ]) {
    await rejectCode(calendar([event({ extra: property })]), "RECURRENCE_NOT_SUPPORTED");
  }
});

test("rejects unsupported or ambiguous date-time forms", async () => {
  await rejectCode(calendar([event({ start: "DTSTART:20260920T180000" })]), "FLOATING_TIME_NOT_SUPPORTED");
  await rejectCode(calendar([event({ start: "DTSTART;VALUE=DATE:20260920" })]), "ALL_DAY_NOT_SUPPORTED");
  await rejectCode(calendar([event({ start: "DTSTART;TZID=America/New_York:20260920T180000" })]), "UNKNOWN_TZID");
  await rejectCode(calendar([event({ start: "DTSTART;TZID=Europe/Berlin:20260230T180000" })]), "INVALID_DATETIME");
  await rejectCode(calendar([event({ start: "DTSTART;TZID=Europe/Berlin:20260329T023000" })]), "NON_DETERMINISTIC_DST");
  await rejectCode(calendar([event({ start: "DTSTART;TZID=Europe/Berlin:20261025T023000" })]), "NON_DETERMINISTIC_DST");
});

test("rejects invalid UID, status and ERV GAME classification", async () => {
  await rejectCode(calendar([event({ uid: "" })]), "INVALID_UID");
  await rejectCode(calendar([event().replace(/^UID:.*\n/m, "")]), "MISSING_UID");
  await rejectCode(calendar([event(), event()]), "DUPLICATE_UID");
  await rejectCode(calendar([event({ status: "CANCELLED" })]), "STATUS_NOT_SUPPORTED");
  await rejectCode(calendar([event({ status: "TENTATIVE" })]), "STATUS_NOT_SUPPORTED");
  await rejectCode(calendar([event({ categories: "Heimspiel,Auswärtsspiel" })]), "CONFLICTING_GAME_SIGNALS");
  await rejectCode(calendar([event({ summary: "ERV Schweinfurt - " })]), "INVALID_HOME_GAME");
  await rejectCode(calendar([event({ summary: "🚌 Gegner - ERV Schweinfurt", categories: "Heimspiel" })]), "INVALID_HOME_GAME");
  await rejectCode(
    calendar([event().replace("Bitte pünktlich", "Bitte\\x pünktlich")]),
    "INVALID_TEXT_ESCAPE"
  );
});

test("rejects invalid container, encoding, extension and size", async () => {
  await rejectCode("BEGIN:VEVENT\nEND:VEVENT", "INVALID_VCALENDAR");
  await rejectCode(calendar([event()]).replace("VERSION:2.0\n", ""), "INVALID_VCALENDAR");
  await rejectCode(calendar([event()]), "INVALID_EXTENSION", "schedule.txt");
  await rejectCode(calendar([event()]), "INVALID_EXTENSION", "C:\\tmp\\schedule.ics");
  await assert.rejects(
    () => parseIcsFile(new Uint8Array(MAX_ICS_BYTES + 1), "large.ics"),
    error => error instanceof IcsValidationError && error.code === "FILE_TOO_LARGE"
  );
  await assert.rejects(
    () => parseIcsFile(Uint8Array.from([0xff, 0xfe]), "invalid.ics"),
    error => error instanceof IcsValidationError && error.code === "INVALID_UTF8"
  );
});

test("never fetches URL or ATTACH resources contained in ICS", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    throw new Error("network must not be used");
  };
  try {
    const source = calendar([event({
      extra: "URL:https://invalid.example/game\nATTACH:https://invalid.example/file"
    })]);
    const result = await parseIcsFile(encode(source), "no-network.ics");
    assert.equal(result.records.length, 1);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
