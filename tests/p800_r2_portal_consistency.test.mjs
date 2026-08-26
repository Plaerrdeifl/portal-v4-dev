import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  auditActionLabel,
  auditActor,
  auditEntityLabel
} from "../js/modules/audit-labels.js";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");
const [fanbuses, common, dashboard, admin, teams, css] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("js/modules/common.js"),
  read("js/modules/dashboard.js"),
  read("js/modules/admin.js"),
  read("js/modules/teams.js"),
  read("css/app.css")
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing section: ${start}`);
  return source.slice(from, to);
}

test("bus management contains buses but no participant sublists", () => {
  const markup = section(fanbuses, "function occupancyMarkup", "function showOccupiedBusDeleteBlock");
  assert.match(markup, /bus\.label/);
  assert.match(markup, /busCategoryLabel\(bus\.category\)/);
  assert.match(markup, /bus\.occupancy \?\? bus\.occupied/);
  assert.match(markup, /Zustiege/);
  assert.doesNotMatch(markup, /participantRow|Teilnehmer \(|Ohne Bus|Warteliste/);
});

test("bus deletion uses the existing deactivation contract and explains occupied buses on demand", () => {
  const removal = section(fanbuses, "function showOccupiedBusDeleteBlock", "function openBusActions");
  assert.match(removal, /Dem Bus sind noch Teilnehmer zugeordnet/);
  assert.match(removal, /Bitte zuerst die Teilnehmer einem anderen Bus zuordnen/);
  assert.match(removal, /call\("fanbus_bus_upsert"/);
  assert.match(removal, /isActive: false/);
  assert.doesNotMatch(removal, /fanbus_bus_(?:delete|remove)/);
  assert.match(fanbuses, /allBuses\.filter\(bus => bus\.isActive !== false\)/);
});

test("participant overview omits email and opens the active record as one actionable card", () => {
  const card = section(fanbuses, "function registrationCard", "async function cancelRegistrationFromActions");
  assert.doesNotMatch(card, /registration\.email|type="email"|v4-m310-registration-email/);
  assert.match(card, /data-m320-open-registration/);
  assert.match(card, /role="button" tabindex="0"/);
  assert.match(card, /v4-m310-registration-chevron/);
  assert.doesNotMatch(card, /data-m320-edit-registration|data-m320-more-registration|data-m310-occupancy-assignment/);
  assert.match(card, /Buswunsch:/);
  assert.match(card, /busPreferenceText/);

  const edit = section(fanbuses, "async function openRegistrationEdit", "function bindRegistrationActions");
  assert.match(edit, />E-Mail<input/);
  assert.match(edit, />Buswunsch<select/);
});

test("participant actions bind the whole card and route edit assignment and more actions through detail", () => {
  const bindings = section(fanbuses, "function bindRegistrationActions", "function renderRegistrationsDialog");
  assert.match(bindings, /data-m320-open-registration/);
  assert.match(bindings, /openRegistrationDetail/);
  assert.match(bindings, /event\.key !== "Enter" && event\.key !== " "/);
  assert.doesNotMatch(bindings, /data-m320-edit-registration|data-m320-more-registration/);

  assert.match(fanbuses, /function openRegistrationDetail/);
  assert.match(fanbuses, /data-m320-detail-assignment/);
  assert.match(fanbuses, /data-m320-detail-edit/);
  assert.match(fanbuses, /data-m320-detail-more/);
  assert.match(fanbuses, /fanbus_bus_assignment_set/);
});

test("shared dialog closes by X backdrop Escape and navigation and restores focus", () => {
  assert.match(common, /event\.target === dialog \|\| event\.target\.closest\("\[data-v4-dialog-close\]"\)/);
  assert.match(common, /dialog\.addEventListener\("cancel"[\s\S]*event\.preventDefault\(\)[\s\S]*closeDialog\(dialog\)/);
  assert.match(common, /window\.addEventListener\("keydown"[\s\S]*event\.key !== "Escape"[\s\S]*closeDialog\(dialog\)/);
  assert.match(common, /window\.addEventListener\("hashchange"[\s\S]*closeAllDialogs\(\)/);
  assert.match(common, /returnTarget\.focus\(\{ preventScroll: true \}\)/);
  assert.match(common, /const dialogContexts = \[\]/);
});

test("long mobile dialogs use one bounded momentum-scrolling body", () => {
  assert.match(css, /#v4DialogBody\{[\s\S]*flex:1 1 auto!important;[\s\S]*min-height:0!important;[\s\S]*overflow-y:auto!important;[\s\S]*-webkit-overflow-scrolling:touch;[\s\S]*touch-action:pan-y;/);
  assert.match(css, /\.v4-dialog-shell\{[\s\S]*max-height:calc\(100dvh - 24px\)!important;[\s\S]*overflow:hidden!important;/);
  assert.doesNotMatch(
    section(css, "#v4DialogBody>.dialog-actions", ".v4-dialog .dialog-actions .button"),
    /safe-area-inset-bottom/
  );
});

test("single-target dashboard cards navigate as a whole card without bubbling twice", () => {
  assert.match(dashboard, /data-dashboard-route=/);
  assert.match(dashboard, /tabindex="0" role="button"/);
  assert.match(dashboard, /v4-dashboard-card-chevron/);
  assert.match(dashboard, /event\?\.target\?\.closest\?\.\("button, a, input, select, textarea, label"\)/);
  assert.match(dashboard, /event\.target !== card/);
  assert.match(dashboard, /navigate\(route, params\)/);
  assert.doesNotMatch(dashboard, /button link small v4-dashboard-open-module/);
});

test("audit resolves actor names and keeps UUID technical", () => {
  assert.deepEqual(
    auditActor(
      { actorUserId: "11111111-1111-1111-1111-111111111111" },
      [{ id: "11111111-1111-1111-1111-111111111111", firstName: "Anna", lastName: "Beispiel" }]
    ),
    { primary: "Anna Beispiel", technical: "11111111-1111-1111-1111-111111111111" }
  );
  assert.deepEqual(auditActor({}, []), { primary: "System", technical: "" });
  assert.match(admin, /auditActor\(event, users\)/);
  assert.match(admin, /v4-audit-technical-id/);
});

test("audit humanizes known and future action and entity codes", () => {
  assert.equal(auditActionLabel("FANBUS_BUS_ASSIGNED"), "Teilnehmer einem Bus zugeordnet");
  assert.equal(auditActionLabel("FANBUS_BUS_UPDATED"), "Bus geändert");
  assert.equal(auditActionLabel("USER_UPDATED"), "Benutzer geändert");
  assert.equal(auditActionLabel("FUTURE_WIDGET_CREATED"), "Future Widget angelegt");
  assert.equal(auditEntityLabel("fanbus_bus"), "Fanbus");
  assert.equal(auditEntityLabel("fanbus_registration"), "Teilnehmer");
  assert.doesNotMatch(section(admin, "function renderAudit", "function render"), /<code>\$\{escapeHtml\(event\.action\)/);
});

test("team members are compact actionable rows rather than permanent button walls", () => {
  const detail = section(teams, "function teamDetailMarkup", "function openTeamMemberActions");
  assert.match(detail, /teamMemberRow\(team, member\)/);
  assert.match(teams, /data-open-team-member/);
  assert.match(teams, /Fachfunktionen bearbeiten/);
  assert.match(teams, /Rolle bearbeiten/);
  assert.match(teams, /Aus Team entfernen/);
  assert.doesNotMatch(detail, /data-edit-team-functions|data-edit-team-member|data-remove-team-member/);
});

test("team delete warning exists only in the explicit delete context", () => {
  const detail = section(teams, "function teamDetailMarkup", "function openTeamMemberActions");
  const deletion = section(teams, "async function deleteTeam", "function openTeamArchive");
  assert.doesNotMatch(detail, /Team kann noch nicht gelöscht werden/);
  assert.match(detail, /Weitere Aktionen/);
  assert.match(deletion, /Team kann noch nicht gelöscht werden/);
  assert.match(deletion, /aktive und/);
  assert.match(deletion, /Archivierte Aufgaben anzeigen/);
});

test("global controls preserve smart-form, input-size and mobile touch contracts", () => {
  assert.match(css, /\.v4-smart-form\{[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)!important/);
  assert.match(css, /\.v4-smart-form>\.full\{[\s\S]*?grid-column:span 12!important/);
  assert.match(css, /\.v4-dialog input,[\s\S]*font-size:16px!important/);
  assert.match(css, /html\[data-portal-area="portal"\] \.button\.small\{[\s\S]*min-height:40px!important/);
  assert.match(css, /@media\(max-width:860px\)[\s\S]*\.v4-dialog \.button\.small\{[\s\S]*min-height:42px!important/);
});

test("Fanbus accordion remains inline with no detail modal or route", () => {
  const open = section(fanbuses, "function openTripDetailAtRecord", "async function hydrateTripDetailStops");
  assert.match(open, /dataset\.m310InlineTripDetail/);
  assert.match(open, /mobileCard\?\.append\(detail\)/);
  assert.match(open, /record\.insertAdjacentElement\("afterend", detail\)/);
  assert.doesNotMatch(open, /openDialog|showModal|location\.hash/);
  assert.match(fanbuses, /if \(openTripDetailId === trip\.id[\s\S]*closeInlineTripDetail\(\)/);
});
