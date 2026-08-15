import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const section = (source, start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Start marker missing: ${start}`);
  assert.notEqual(to, -1, `End marker missing: ${end}`);
  return source.slice(from, to);
};

const [common, dates, fanbuses, fanclub, applications, tasks] = await Promise.all([
  read("js/modules/common.js"),
  read("js/modules/dates.js"),
  read("js/modules/fanbuses.js"),
  read("js/modules/fanclub.js"),
  read("js/modules/membership-applications.js"),
  read("js/modules/tasks.js")
]);

test("dialog confirmation cancel restores one existing parent context", () => {
  const confirm = section(common, "export function confirmAction", "export async function runWrite");
  assert.match(confirm, /preserveParentOnSubmit: true/);
  assert.match(confirm, /resolve\(false\)/);

  const cancellation = section(
    fanbuses,
    "function renderRegistrationsDialog",
    "function busForm"
  );
  assert.match(cancellation, /if \(!confirmed\) \{\s*return;\s*\}/);
  assert.doesNotMatch(cancellation, /if \(!confirmed\)[\s\S]{0,180}showRegistrationsDialog/);
  assert.doesNotMatch(cancellation, /renderRegistrationsDialog\(dialog, trip, data\)[\s\S]{0,180}if \(!confirmed\)/);
});

test("event edit restores authoritative updated detail and delete discards invalid detail", () => {
  const editor = section(dates, "function openEventEditor", "function importValue");
  assert.match(editor, /snapshot = await runWrite\([\s\S]*call\("event_update"/);
  assert.match(editor, /preserveParentOnSubmit: editing && Boolean\(parentDialog\)/);
  assert.match(editor, /const updated = events\(\)\.find\(item => item\.id === event\.id\)/);
  assert.match(editor, /renderEventDetailDialog\(parentDialog, updated\)/);

  const deletion = section(dates, "async function deleteEvent", "export async function hydrateDates");
  assert.match(deletion, /snapshot = await runWrite\([\s\S]*call\("event_delete"/);
  assert.match(deletion, /if \(detailDialog\?\.open\) detailDialog\.close\(\)/);
  assert.match(deletion, /if \(!confirmed\) return/);
});

test("participant edit and add preserve Fahrt to Belegung to Teilnehmer with fresh data", () => {
  const edit = section(fanbuses, "async function openRegistrationEdit", "function bindRegistrationActions");
  assert.match(edit, /preserveParentOnSubmit: true/);
  assert.match(edit, /const next = await call\("fanbus_registration_update_m325"/);
  assert.match(edit, /snapshot = await call\("fanbus_trips_list"\)/);
  assert.match(edit, /renderRegistrationsDialog\(registrationsDialog, trip, next\)/);
  assert.doesNotMatch(edit, /showRegistrationsDialog\(/);

  const add = section(fanbuses, "async function openManualRegistration", "function showRegistrationsDialog");
  assert.match(add, /preserveParentOnSubmit: true/);
  assert.match(add, /call\("fanbus_registrations_list", \{ tripId: trip\.id \}\)/);
  assert.match(add, /call\("fanbus_trips_list"\)/);
  assert.match(add, /renderRegistrationsDialog\(registrationsDialog, trip, nextData\)/);
  assert.doesNotMatch(add, /showRegistrationsDialog\(/);

  const participantParent = section(
    fanbuses,
    "function showRegistrationsDialog",
    "async function openBuses"
  );
  assert.match(participantParent, /afterDialogContextClose\(dialog/);
  assert.match(participantParent, /loadOccupancyInto\(occupancyParent, trip\)/);
});

test("confirmed participant cancellation updates in place without a duplicate dialog", () => {
  const registrations = section(fanbuses, "function renderRegistrationsDialog", "function busForm");
  assert.match(registrations, /const nextData = await runWrite\([\s\S]*fanbus_registration_cancel/);
  assert.match(registrations, /snapshot = await call\("fanbus_trips_list"\)/);
  assert.match(registrations, /renderRegistrationsDialog\(dialog, trip, nextData\)/);
  assert.doesNotMatch(registrations, /showRegistrationsDialog\(/);
});

test("bus writes refresh occupancy and the stored trip parent from server snapshots", () => {
  assert.match(fanbuses, /function reloadOccupancyAfterChild\([\s\S]*loadOccupancyInto\(parentDialog, trip\)/);
  assert.match(fanbuses, /afterDialogContextClose\(dialog, \(\) => refreshTripParent\(dialog, trip\.id\)\)/);
  assert.match(fanbuses, /async function refreshTripParent[\s\S]*call\("fanbus_trips_list"\)[\s\S]*restoreTripOverview\(dialog, updated\)/);
});

test("calendar fanbus link keyboard is isolated from row activation", () => {
  const bindings = section(dates, "function render()", "function eventForm");
  assert.match(bindings, /if \(keyEvent\.target !== record\) return/);
  assert.match(bindings, /querySelectorAll\("\.v4-m210-fanbus-link"\)/);
  assert.match(bindings, /keyEvent\.key !== " "[\s\S]*link\.click\(\)/);
});

test("optional fanbus calendar enrichment cannot fail successful event loading", () => {
  const hydrate = section(dates, "export async function hydrateDates", "export function noop");
  assert.match(hydrate, /call\("events_list"\)/);
  assert.match(hydrate, /call\("fanbus_trips_list"\)\.catch\(\(\) => \(\{ trips: \[\] \}\)\)/);
  assert.match(hydrate, /fanbusTrips = Array\.isArray\(fanbusSnapshot\?\.trips\) \? fanbusSnapshot\.trips : \[\]/);
});

test("audited fanclub, membership application and task writes refresh or discard their parents explicitly", () => {
  assert.match(fanclub, /function renderMemberDetailDialog/);
  assert.match(fanclub, /preserveParentOnSubmit: existing && Boolean\(parentDialog\)/);
  assert.match(fanclub, /call\("member_detail", \{ id: member\.id \}\)/);
  assert.match(fanclub, /function renderContributionDetailDialog/);
  assert.match(fanclub, /function renderFinanceAccountDetailDialog/);
  assert.match(fanclub, /function renderFinanceEntryDetailDialog/);
  assert.match(fanclub, /if \(!confirmed\) return false;[\s\S]*delete_finance_account/);
  assert.match(fanclub, /if \(await deleteFinanceAccount\(account\)\) dialog\.close\(\)/);

  assert.match(applications, /const dialog = activeDetailDialog\?\.open[\s\S]*activeDetailDialog/);
  assert.match(applications, /if \(reopenDetail && activeDetailId === id\) showApplicationDetail\(detail\)/);
  assert.match(applications, /if \(!reopenDetail && activeDetailId === id && activeDetailDialog\?\.open\)[\s\S]*activeDetailDialog\.close\(\)/);

  assert.match(tasks, /function renderTaskDetailDialog/);
  assert.match(tasks, /preserveParentOnSubmit: Boolean\(task && parentDialog\)/);
  assert.match(tasks, /snapshot = await call\("tasks_snapshot"\)/);
  assert.match(tasks, /function openPermanentDelete[\s\S]*delete_archived_task/);
  const permanentDelete = section(tasks, "function openPermanentDelete", "function taskAccess");
  assert.doesNotMatch(permanentDelete, /preserveParentOnSubmit: true/);
});
