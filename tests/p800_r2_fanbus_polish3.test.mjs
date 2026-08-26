import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const [fanbuses, common, ux] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("js/modules/common.js"),
  read("js/p800-r2-fanbus-ux.js")
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

test("Polish 3 restores the defined publish flow through the existing CAS RPC", () => {
  const bindings = section(fanbuses, "function bindTripActions", "function fanbusMasterStopSettingsCard");
  const publish = section(fanbuses, "async function publishTrip", "async function reopenTrip");

  assert.match(bindings, /publishTrip\(trip, button\)/);
  assert.equal((fanbuses.match(/publishTrip\s*\(/g) || []).length, 2);
  assert.match(publish, /confirmAction\(/);
  assert.match(publish, /runTripWrite\(\s*button,\s*"fanbus_trip_publish",\s*trip,/s);
  assert.match(publish, /Fanbusfahrt wurde veröffentlicht\./);
  assert.doesNotMatch(publish, /call\("fanbus_trip_publish"/);
});

test("Polish 3 prevents stale async dialog submits from closing or re-enabling another context", () => {
  const dialog = section(common, "export function openDialog", "export function confirmAction");

  assert.match(dialog, /await onSubmit\(form \? formDataObject\(form\) : \{\}\);\s*if \(!dialog\.open \|\| dialog\.dataset\.v4DialogContext !== contextId\) return;\s*closeDialog/s);
  assert.match(dialog, /if \(dialog\.open\s*&& dialog\.dataset\.v4DialogContext === contextId\s*&& button\.isConnected\) \{\s*button\.disabled = false;\s*button\.textContent = original;/s);
});

test("Polish 3 guards participant child flows by logical dialog context", () => {
  const guard = section(fanbuses, "function isDialogContextCurrent", "async function cancelRegistrationFromActions");
  const cancel = section(fanbuses, "async function cancelRegistrationFromActions", "async function refreshRegistrationsAfterIdentity");
  const identitySearch = section(fanbuses, "function openRegistrationIdentitySearch", "async function loadRegistrationIdentitySuggestion");
  const detail = section(fanbuses, "function openRegistrationDetail", "function bindRegistrationActions");
  const picker = section(fanbuses, "function openManualPersonPicker", "function manualRegistrationForm");

  assert.match(guard, /dialog\?\.open/);
  assert.match(guard, /dialog\.dataset\.v4DialogContext === contextId/);
  assert.match(cancel, /isDialogContextCurrent\(actionsDialog, actionsContextId\)/);
  assert.match(cancel, /isDialogContextCurrent\(registrationsDialog, parentContextId\)/);
  assert.match(identitySearch, /sequence !== requestSequence\s*\|\| !isDialogContextCurrent\(dialog, searchContextId\)/s);
  assert.match(detail, /const detailContextId = dialog\.dataset\.v4DialogContext/);
  assert.match(detail, /isDialogContextCurrent\(dialog, detailContextId\)/);
  assert.match(picker, /const parentContextId = parentDialog\?\.dataset\.v4DialogContext/);
  assert.match(picker, /isDialogContextCurrent\(picker, pickerContextId\)/);
  assert.match(picker, /isDialogContextCurrent\(parentDialog, parentContextId\)/);
});

test("Polish 3 manual registration keeps person and guest identity modes mutually exclusive", () => {
  const form = section(fanbuses, "function manualRegistrationForm", "function syncManualRegistrationMode");
  const sync = section(fanbuses, "function syncManualRegistrationMode", "function bindManualConsentValidation");

  assert.match(form, /<option value="PERSON">Mitglied \/ Portaluser<\/option>/);
  assert.ok(form.indexOf("data-m310-manual-person") < form.indexOf("Zustiegsort"));
  assert.ok(form.indexOf("data-m310-manual-guest hidden>Vorname") < form.indexOf("Zustiegsort"));
  assert.match(sync, /personField\.hidden = isGuest/);
  assert.match(sync, /personInput\.disabled = isGuest/);
  assert.match(sync, /personButton\.disabled = isGuest/);
  assert.match(sync, /field\.hidden = !isGuest/);
  assert.match(sync, /input\.disabled = !isGuest/);
  assert.match(sync, /input\.required = isGuest && input\.name !== "email"/);
});

test("Polish 3 uses explicit consent validation instead of the browser-only required message", () => {
  const validation = section(fanbuses, "function bindManualConsentValidation", "function manualRegistrationError");
  const open = section(fanbuses, "async function openManualRegistration", "function showRegistrationsDialog");

  assert.match(validation, /setCustomValidity\(/);
  assert.match(validation, /Bitte Datenschutz und Teilnahmebedingungen bestätigen\./);
  assert.match(validation, /consent\.checked \? ""/);
  assert.match(open, /bindManualConsentValidation\(dialog\)/);
});

test("Polish 3 trip creation uses the portal picker with compact chronological date and venue labels", () => {
  const label = section(fanbuses, "function availableEventLabel", "function setTripCreateEvent");
  const picker = section(fanbuses, "function openAvailableEventPicker", "async function openTripCreate");
  const create = section(fanbuses, "async function openTripCreate", "function defaultRegistrationClosesInput");

  assert.match(label, /formatCalendarDate\(event\.eventDate\)/);
  assert.match(label, /event\.venue \|\| "Spielort noch offen"/);
  assert.doesNotMatch(label, /displayTitle|visibility/);
  assert.match(picker, /data-m310-event-result/);
  assert.match(create, /\.sort\(\(left, right\) => String\(left\.eventDate \|\| ""\)\.localeCompare\(String\(right\.eventDate \|\| ""\)\)\)/);
  assert.match(create, /<input name="eventId" type="hidden">/);
  assert.match(create, /data-m310-open-event-picker/);
  assert.doesNotMatch(create, /<select name="eventId"/);
  assert.match(create, /Bitte wähle einen Termin aus\./);
});

test("Polish 3 mobile editor keeps two-column layouts when they fit and stacks only on very narrow screens", () => {
  assert.match(ux, /\.v4-m310-editor-fields\{[^}]*column-gap:12px;[^}]*row-gap:9px;[^}]*min-width:0/);
  assert.match(ux, /\.v4-m310-trip-stop-editor-row\{[^}]*grid-template-columns:minmax\(0,1fr\) 104px auto;[^}]*gap:7px;[^}]*min-width:0;[^}]*padding:7px/);
  assert.match(ux, /box-sizing:border-box;width:100%;min-width:0/);
  assert.match(ux, /@media \(max-width:350px\)\{[\s\S]*\.v4-m310-editor-fields,\.v4-m310-trip-stop-editor-row,\.v4-m310-trip-default-stop\{grid-template-columns:1fr\}/);
  assert.doesNotMatch(ux, /MutationObserver/);
});

test("Polish 3 keeps away-only filtering, manual groups and automatic assignment outside this hotfix", () => {
  const create = section(fanbuses, "async function openTripCreate", "function defaultRegistrationClosesInput");
  const manual = section(fanbuses, "async function openManualRegistration", "function showRegistrationsDialog");

  assert.doesNotMatch(create, /homeAway|home_away|\bAWAY\b/);
  assert.match(manual, /fanbus_registration_create_manual/);
  assert.doesNotMatch(manual, /companions|\bCOMPANION\b/);
  assert.doesNotMatch(fanbuses, /fanbus_(?:auto|automatic).*assign/i);
});
