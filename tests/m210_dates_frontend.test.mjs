import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("dates is an authenticated route directly after dashboard", async () => {
  const router = await read("js/router.js");
  const auth = await read("js/auth.js");

  assert.match(
    router,
    /dates:\s*\{[\s\S]*?title:\s*"Termine"[\s\S]*?page:\s*"dates\.html"[\s\S]*?icon:\s*"📅"/
  );
  assert.doesNotMatch(
    router,
    /const LEGACY[\s\S]*?dates:\s*\{\s*target:/
  );
  assert.match(
    router,
    /fixedAuthenticatedOrder\(\)[\s\S]*?"dashboard",\s*"dates",/
  );
  assert.match(
    auth,
    /\["dashboard",\s*"dates"\]\.includes\(key\)/
  );
  assert.doesNotMatch(auth, /dates[^\n]+(?:\.read|\.manage)/);
});

test("dates page is hydrated by the dedicated authenticated module", async () => {
  const pages = await read("js/pages.js");
  const html = await read("pages/dates.html");

  assert.match(pages, /dates:\s*"\.\/modules\/dates\.js"/);
  assert.match(
    pages,
    /key === "dates"[\s\S]{0,120}"\.\/modules\/dates\.js",\s*"hydrateDates"/
  );
  assert.doesNotMatch(
    pages,
    /\[[^\]]*"dates"[^\]]*\]\.includes\(key\)\) return/
  );

  assert.match(html, /id="m210DatesPage"/);
  assert.match(html, /id="m210AddEventButton"/);
  assert.match(html, /id="m210DatesList"/);
  assert.doesNotMatch(html, /public-page|publicDatesText/);
  assert.doesNotMatch(html, /Kommende Termine werden hier angekündigt/);
});

test("dates module uses the existing API and management helpers", async () => {
  const source = await read("js/modules/dates.js");

  for (const action of [
    "events_list",
    "event_create",
    "event_update",
    "event_delete"
  ]) {
    assert.match(source, new RegExp(`call\\(["']${action}["']`));
  }

  assert.match(source, /hasCapability\("events\.manage"\)/);
  assert.match(source, /payload\.expectedRevision\s*=\s*Number\(event\.revision\)/);
  assert.match(source, /expectedRevision:\s*Number\(event\.revision\)/);
  assert.match(source, /openDialog\(/);
  assert.match(source, /confirmAction\(/);
  assert.match(source, /runWrite\(/);
  assert.doesNotMatch(
    source,
    /getSupabaseClient|supabase\.rpc|\.rpc\(\s*["']pd_api/
  );
});

test("dates form and rendering preserve the M210 frontend contract", async () => {
  const source = await read("js/modules/dates.js");

  for (const value of [
    "GAME",
    "FANCLUB",
    "OTHER",
    "HOME",
    "AWAY",
    "PUBLIC",
    "INTERNAL"
  ]) {
    assert.match(source, new RegExp(`value:\\s*["']${value}["']`));
  }

  assert.match(source, /event\.displayTitle/);
  assert.doesNotMatch(source, /Mighty Dogs Schweinfurt/);
  assert.doesNotMatch(source, /\.sort\(/);
  assert.doesNotMatch(source, /toISOString\(\)/);
  assert.match(source, /context\.isCurrent/);
});
