import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const [fanbuses, ux] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("js/p800-r2-fanbus-ux.js")
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

test("Polish 2 manual registration uses a portal person picker instead of a native long person select", () => {
  assert.match(fanbuses, /Teilnehmer hinzufügen/);
  assert.match(fanbuses, /<input name="personKey" type="hidden">/);
  assert.match(fanbuses, /data-m310-open-person-picker/);
  assert.doesNotMatch(fanbuses, /<select name="personKey"/);
  assert.match(fanbuses, /title: "Person auswählen"/);
  assert.match(fanbuses, /placeholder="Person suchen …"/);
});

test("Polish 2 person picker searches names and exposes compact member and portal filters without technical data", () => {
  const results = section(fanbuses, "function renderManualPersonPicker", "function openManualPersonPicker");
  const picker = section(fanbuses, "function openManualPersonPicker", "function manualRegistrationForm");

  assert.match(results, /manualPersonName\(person\)/);
  assert.match(results, /manualPersonTypeLabel\(person\)/);
  assert.match(results, /toLocaleLowerCase\("de-DE"\)/);
  assert.doesNotMatch(results, /person\.email|person\.memberId|person\.portalUserId|UUID/i);
  assert.match(picker, /data-m310-person-filter="ALL"[^>]*[\s\S]*>Alle<\/button>/);
  assert.match(picker, /data-m310-person-filter="MEMBER"[^>]*[\s\S]*>Mitglieder<\/button>/);
  assert.match(picker, /data-m310-person-filter="PORTAL_USER"[^>]*[\s\S]*>Portaluser<\/button>/);
});

test("Polish 2 deduplicates linked member and portal identities only through stable ids", () => {
  const key = section(fanbuses, "function manualPersonKey", "function manualPersonName");
  const dedupe = section(fanbuses, "function deduplicateManualPeople", "function manualPersonSelectionContent");

  assert.match(key, /personType === "MEMBER" \? person\.memberId : person\?\.portalUserId/);
  assert.match(dedupe, /linkedPortalUsers/);
  assert.match(dedupe, /person\?\.personType === "MEMBER" && person\.portalUserId/);
  assert.match(dedupe, /person\?\.personType === "PORTAL_USER"[\s\S]*linkedPortalUsers\.has\(person\.portalUserId\)/);
  assert.match(dedupe, /manualPersonKey\(person\)/);
  assert.doesNotMatch(dedupe, /firstName[^\n]*lastName[^\n]*(?:key|seen)/i);
});

test("Polish 2 picker selection closes the child and restores the parent form selection", () => {
  const picker = section(fanbuses, "function openManualPersonPicker", "function manualRegistrationForm");
  assert.match(picker, /const picker = openDialog\(/);
  assert.match(picker, /picker\.close\(\);[\s\S]*setManualRegistrationPerson\(parentDialog, person\)/);
  assert.match(fanbuses, /function setManualRegistrationPerson\(dialog, person\)/);
  assert.match(fanbuses, /manualPersonSelectionContent\(person\)/);
  assert.doesNotMatch(picker, /document\.createElement\(["']dialog["']\)|showModal\(\)/);
});

test("Polish 2 guest mode owns the editable identity fields and consent stays compact and required", () => {
  assert.match(fanbuses, /data-m310-manual-guest hidden>Vorname[\s\S]*name="firstName"[^>]*disabled/);
  assert.match(fanbuses, /data-m310-manual-guest hidden>Nachname[\s\S]*name="lastName"[^>]*disabled/);
  assert.match(fanbuses, /data-m310-manual-guest hidden>E-Mail \(optional\)[\s\S]*name="email"[^>]*disabled/);
  assert.match(fanbuses, /function syncManualRegistrationMode\(dialog\)[\s\S]*field\.hidden = !isGuest[\s\S]*input\.disabled = !isGuest[\s\S]*input\.required = isGuest && input\.name !== "email"/);
  assert.match(fanbuses, /consentConfirmed" type="checkbox" required/);
  assert.match(ux, /\.v4-m310-manual-consent\{[^}]*display:flex!important;[^}]*min-height:44px;[^}]*white-space:normal!important/);
});

test("Polish 2 active participant cards are one keyboard-accessible target while cancelled records stay read-only", () => {
  const card = section(fanbuses, "function registrationCard", "async function cancelRegistrationFromActions");
  const bindings = section(fanbuses, "function bindRegistrationActions", "function renderRegistrationsDialog");

  assert.match(card, /const canAct = !readOnly && registration\.status !== "CANCELLED"/);
  assert.match(card, /data-m320-open-registration/);
  assert.match(card, /role="button" tabindex="0"/);
  assert.match(card, /v4-m310-registration-chevron/);
  assert.doesNotMatch(card, /data-m320-edit-registration|data-m320-more-registration|data-m310-occupancy-assignment/);
  assert.match(bindings, /card\.addEventListener\("click", open\)/);
  assert.match(bindings, /card\.addEventListener\("keydown"/);
  assert.match(bindings, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(bindings, /if \(event\.repeat\) return/);
});

test("Polish 2 participant detail owns manual bus assignment edit and existing further actions", () => {
  assert.match(fanbuses, /function openRegistrationDetail\(/);
  assert.match(fanbuses, /data-m320-detail-assignment/);
  assert.match(fanbuses, /data-m320-detail-edit/);
  assert.match(fanbuses, /data-m320-detail-more/);
  assert.match(fanbuses, /fanbus_bus_assignment_set/);
  assert.match(fanbuses, /openRegistrationEdit\(trip, registration, registrationsDialog, \{[\s\S]*replaceCurrent: true/);
  assert.match(fanbuses, /openRegistrationActions\(trip, registration, registrationsDialog, \{[\s\S]*replaceCurrent: true/);
  assert.doesNotMatch(fanbuses, /fanbus_(?:auto|automatic).*assign/i);
});

test("Polish 2 keeps normal page scrolling while compacting the mobile trip stop editor", () => {
  assert.match(ux, /\[data-m310-inline-trip-body\]\{[^}]*max-height:none!important;[^}]*overflow:visible!important;[^}]*overscroll-behavior:auto!important;[^}]*touch-action:auto/);
  assert.match(ux, /\.v4-m310-editor-stops\{gap:8px;padding:10px\}/);
  assert.match(ux, /\.v4-m310-trip-stop-editor-row\{[^}]*grid-template-columns:minmax\(0,1fr\) 104px auto;[^}]*gap:7px;[^}]*min-width:0;[^}]*padding:7px/);
  assert.match(ux, /\.v4-m310-editor-stops \[data-m310-trip-stop-add\]\{min-height:42px;padding:7px 11px\}/);
  assert.match(ux, /\.v4-m310-trip-stop-remove\{min-height:42px;padding:7px 10px/);
  assert.match(ux, /\.v4-m310-trip-default-stop\{grid-template-columns:minmax\(120px,\.45fr\) minmax\(0,1fr\)/);
  assert.match(ux, /@media \(max-width:620px\)[\s\S]*\.v4-m310-trip-stop-editor-row\{grid-template-columns:minmax\(0,1fr\) 102px\}[\s\S]*\.v4-m310-trip-stop-remove\{grid-column:1\/-1;justify-self:end\}/);
  assert.match(ux, /@media \(max-width:350px\)\{[\s\S]*\.v4-m310-editor-fields,\.v4-m310-trip-stop-editor-row,\.v4-m310-trip-default-stop\{grid-template-columns:1fr\}/);
  assert.doesNotMatch(ux, /MutationObserver/);
});
