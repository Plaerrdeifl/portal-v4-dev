import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

const [fanbuses, dates, finance, css, migration] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("js/modules/dates.js"),
  read("js/modules/fanclub.js"),
  read("css/app.css"),
  read("supabase/migrations/20260812223000_open_fanbus_registration_on_publish_m310_r1.sql")
]);

function cssRule(selector) {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `CSS-Selektor fehlt: ${selector}`);
  const openingBrace = css.indexOf("{", start);
  const closingBrace = css.indexOf("}", openingBrace);
  return css.slice(openingBrace + 1, closingBrace);
}

function cssRuleAfter(selector, marker) {
  const markerStart = css.indexOf(marker);
  assert.notEqual(markerStart, -1, `CSS-Marker fehlt: ${marker}`);
  const start = css.indexOf(selector, markerStart);
  assert.notEqual(start, -1, `CSS-Selektor nach Marker fehlt: ${selector}`);
  const openingBrace = css.indexOf("{", start);
  const closingBrace = css.indexOf("}", openingBrace);
  return css.slice(openingBrace + 1, closingBrace);
}

function assertTwoLineMobileTitle(selector) {
  const rule = cssRule(selector);
  assert.match(rule, /display:\s*-webkit-box/);
  assert.match(rule, /-webkit-box-orient:\s*vertical/);
  assert.match(rule, /-webkit-line-clamp:\s*2/);
  assert.match(rule, /white-space:\s*normal/);
  assert.match(rule, /text-overflow:\s*clip/);
  assert.match(rule, /overflow:\s*hidden/);
  assert.match(rule, /min-width:\s*0/);
  assert.doesNotMatch(rule, /white-space:\s*nowrap/);
  assert.doesNotMatch(rule, /text-overflow:\s*ellipsis/);
  assert.doesNotMatch(rule, /(?:^|;)\s*(?:height|max-height)\s*:/);
}

test("M310 mobile card exposes one primary status without internal capacity values", () => {
  assert.match(fanbuses, /function mobileTripStatus\(trip\)/);
  assert.match(fanbuses, /if \(trip\.status === "DRAFT"\) return \{ label: "Entwurf"/);
  assert.match(fanbuses, /NOT_STARTED: \{ label: "Startet später"/);
  assert.match(fanbuses, /v4-m310-mobile-trip-meta[\s\S]+mobileTripStatusBadge\(trip\)/);
  assert.doesNotMatch(fanbuses, /v4-m310-mobile-trip[\s\S]{0,900}tripBadges\(trip\)/);
  const mobileStart = fanbuses.indexOf("function tripMobileList(items)");
  const mobileEnd = fanbuses.indexOf("function setStatus", mobileStart);
  const mobileList = fanbuses.slice(mobileStart, mobileEnd);
  assert.doesNotMatch(mobileList, /capacityLabel|Anmeldungen|Kapazität|activeRegistrationCount/);
  assertTwoLineMobileTitle("#m310FanbusList .v4-m310-mobile-trip-title");
  assert.match(css, /v4-m310-mobile-trip>\.v4-row-chevron/);
});

test("M310 registrations use compact operational records without empty cancellation metadata", () => {
  const start = fanbuses.indexOf("function registrationCard(registration, buses = [], readOnly = false)");
  const end = fanbuses.indexOf("async function cancelRegistrationFromActions", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const card = fanbuses.slice(start, end);

  assert.match(card, /class="v4-m310-registration-record\$\{canAct \? " v4-interactive-card" : ""\}"/);
  assert.doesNotMatch(card, /card entity-card|entity-head|meta-grid|meta-item|v4-card-actions/);
  assert.match(card, /class="badge \$\{registration\.status === "ACTIVE" \? "success" : "neutral"\}"/);
  assert.match(card, /sourceText\(registration\.source\)/);
  assert.match(card, /busPreferenceText\(registration\.busPreference\)/);
  assert.doesNotMatch(card, /registration\.email|v4-m310-registration-email/);
  assert.match(card, /formatBerlinDateTime\(registration\.registeredAt\)/);
  assert.match(card, /registration\.status === "CANCELLED" && registration\.cancelledAt/);
  assert.doesNotMatch(card, /cancelledAt\s*\|\|\s*"–"/);
  assert.match(card, /const canAct = !readOnly && registration\.status !== "CANCELLED"/);
  assert.match(card, /data-m320-open-registration/);
  assert.match(card, /role="button" tabindex="0"/);
  assert.match(card, /v4-m310-registration-chevron/);
  assert.doesNotMatch(card, /data-m320-edit-registration|data-m320-more-registration|data-m310-occupancy-assignment/);

  const cancellationStart = fanbuses.indexOf("async function cancelRegistrationFromActions");
  const cancellationEnd = fanbuses.indexOf("function busCategoryLabel", cancellationStart);
  const cancellation = fanbuses.slice(cancellationStart, cancellationEnd);
  assert.notEqual(cancellationStart, -1);
  assert.notEqual(cancellationEnd, -1);
  assert.match(cancellation, /call\("fanbus_registration_cancel", \{[\s\S]+id: registration\.id,[\s\S]+expectedRevision: Number\(registration\.revision\)/);
  assert.match(cancellation, /renderRegistrationsDialog\(registrationsDialog, trip, nextData\)/);
  assert.doesNotMatch(cancellation, /showRegistrationsDialog\(/);

  const registrationFlowEnd = fanbuses.indexOf("function manualPersonKey(person)", end);
  const registrationFlow = fanbuses.slice(end, registrationFlowEnd);
  assert.match(registrationFlow, /hasCapability\("fanbus\.registrations\.manage"\)/);

  const listRule = cssRule(".v4-m310-registration-list");
  const recordRule = cssRule(".v4-m310-registration-record");
  const toolbarActionsRule = cssRule(".v4-m310-registration-toolbar-actions");
  assert.match(listRule, /gap:\s*7px/);
  assert.match(listRule, /min-width:\s*0/);
  assert.match(listRule, /max-width:\s*100%/);
  assert.match(recordRule, /grid-template-columns:\s*minmax\(0,1\.2fr\)/);
  assert.match(recordRule, /min-width:\s*0/);
  assert.match(recordRule, /max-width:\s*100%/);
  assert.match(toolbarActionsRule, /display:\s*flex/);
  assert.match(toolbarActionsRule, /flex-wrap:\s*wrap/);
  assert.doesNotMatch(css, /\.v4-m310-registration-email\{/);
  assert.match(
    css,
    /@media\(max-width:620px\)\{[\s\S]{0,500}\.v4-m310-registration-record\{[^}]*grid-template-columns:minmax\(0,1fr\)[^}]*\}/
  );
});

test("M310 central editor keeps the registration window without the legacy meeting field", () => {
  const tripFormStart = fanbuses.indexOf("function tripForm(");
  const tripFormEnd = fanbuses.indexOf("function tripUpdatePayload", tripFormStart);
  const tripForm = fanbuses.slice(tripFormStart, tripFormEnd);
  assert.notEqual(tripFormStart, -1);
  assert.notEqual(tripFormEnd, -1);
  assert.doesNotMatch(tripForm, /Treffpunkt \/ Abfahrtsort|name="departureInfo"/);
  assert.match(fanbuses, /name="registrationOpensAt"/);
  assert.match(fanbuses, />Anmeldung beginnt/);
  assert.match(fanbuses, /function defaultRegistrationClosesInput\(departureAt\)/);
  assert.match(fanbuses, /Number\(match\[3\]\) - 3/);
  assert.match(fanbuses, /T20:00/);
  assert.match(fanbuses, /registrationOpensAt: values\.registrationOpensAt[\s\S]+berlinLocalToIso/);
});

test("M210 and M310 editors use the shared member and finance dialog contract", () => {
  const standardMarker = "/* Gemeinsamer kompakter Dialog */";
  const dialog = cssRuleAfter(".v4-dialog", standardMarker);
  const shell = cssRuleAfter(".v4-dialog-shell", standardMarker);
  const body = cssRuleAfter("#v4DialogBody", standardMarker);

  assert.doesNotMatch(css, /:has\(#m310TripEditorForm\)/);
  assert.doesNotMatch(
    css,
    /\.v4-smart-form>\.v4-field-mobile-full\s*,[\s\S]{0,120}\.v4-smart-form>\.v4-field-datetime/
  );
  assert.match(dialog, /width:\s*min\(720px,calc\(100vw - 24px\)\)!important/);
  assert.match(dialog, /max-height:\s*calc\(100dvh - 24px\)!important/);
  assert.match(shell, /display:\s*flex!important/);
  assert.match(shell, /flex-direction:\s*column!important/);
  assert.match(shell, /height:\s*auto!important/);
  assert.match(shell, /min-height:\s*0!important/);
  assert.match(shell, /max-height:\s*calc\(100dvh - 24px\)!important/);
  assert.match(body, /flex:\s*1 1 auto!important/);
  assert.match(body, /touch-action:\s*pan-y/);
  assert.match(body, /height:\s*auto!important/);
  assert.match(body, /min-height:\s*0!important/);
  assert.match(body, /overflow-x:\s*hidden!important/);
  assert.match(body, /overflow-y:\s*auto!important/);
  assert.doesNotMatch(body, /(?:^|;)\s*overflow:\s*auto!important/);
  assert.match(body, /padding:\s*13px 16px!important/);
  assert.match(css, /@media\(max-width:350px\)\{\.v4-smart-form>\*\{grid-column:1\/-1!important\}/);
});

test("cash, M210 and M310 retain their intended responsive smart-form tracks on iPhone", () => {
  assert.match(finance, /v4-field-seven">Konto<select[\s\S]+v4-field-five">Betrag/);
  assert.match(finance, /v4-field-five">Buchungsdatum[\s\S]+v4-field-seven">Zahlungsart/);

  assert.match(dates, /v4-field-five">Typ[\s\S]+v4-field-seven">Sichtbarkeit/);
  assert.match(dates, /v4-field-seven">Datum[\s\S]+v4-field-five">Uhrzeit/);
  assert.match(dates, /v4-field-seven">Enddatum[\s\S]+v4-field-five">Endzeit/);
  assert.match(
    dates,
    /v4-field-five" data-m210-game-field[\s\S]+Heim\/Auswärts[\s\S]+v4-field-seven" data-m210-game-field[\s\S]+Gegner/
  );
  assert.doesNotMatch(dates, /id="m210DateGameFields"|class="v4-field-full v4-form-pair"/);

  const tripFormStart = fanbuses.indexOf("function tripForm");
  const tripFormEnd = fanbuses.indexOf("function openTripEditor", tripFormStart);
  assert.notEqual(tripFormStart, -1, "Fahrteditor-Formular fehlt");
  assert.notEqual(tripFormEnd, -1, "Ende des Fahrteditor-Formulars fehlt");
  const tripFormSource = fanbuses.slice(tripFormStart, tripFormEnd);
  assert.match(tripFormSource, /<label>Abfahrt[\s\S]+name="departureTime" type="time"/);
  assert.doesNotMatch(tripFormSource, /name="capacity"/);
  assert.match(tripFormSource, /Fahrtpreis[\s\S]+Anmeldeschluss[\s\S]+Anmeldung beginnt/);
  assert.match(tripFormSource, /v4-m310-editor-fields/);

  assert.doesNotMatch(
    css,
    /@media\(max-width:430px\)[\s\S]{0,180}v4-field-(?:seven|five)[\s\S]{0,80}grid-column:span 6/
  );
  assert.match(css, /@media\(max-width:350px\)\{\.v4-smart-form>\*\{grid-column:1\/-1!important\}/);
});

test("shared smart-form controls shrink inside tracks including iOS date controls", () => {
  const workflowStart = css.indexOf("/* Kompakte Workflows R1");
  const workflow = css.slice(workflowStart, css.indexOf("/* V4 TASK HISTORY", workflowStart));

  assert.match(workflow, /grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  assert.match(workflow, /\.v4-smart-form input,\.v4-smart-form select,\.v4-smart-form textarea\{[^}]*box-sizing:border-box!important[^}]*width:100%!important[^}]*min-width:0!important[^}]*max-width:100%!important[^}]*\}/);
  assert.match(css, /input:is\(\[type="date"\],\[type="time"\],\[type="datetime-local"\]\)/);
  assert.doesNotMatch(css, /:has\(#m310TripEditorForm\)/);
});

test("M310 keeps an unsaved default auto-managed until the close field is edited", () => {
  assert.match(fanbuses, /let registrationClosesAutoManaged = !trip\.registrationClosesAt/);
  assert.match(
    fanbuses,
    /registrationCloses\?\.addEventListener\("input", disableRegistrationClosesAutoManagement\)/
  );
  assert.match(
    fanbuses,
    /registrationCloses\?\.addEventListener\("change", disableRegistrationClosesAutoManagement\)/
  );
  assert.match(
    fanbuses,
    /if \(!registrationCloses \|\| !registrationClosesAutoManaged \|\| !departure\.value\) return/
  );
  assert.match(
    fanbuses,
    /registrationCloses\.value = defaultRegistrationClosesInput\(departureIso\)/
  );
});

test("M310 publish sets the registration opening time on the server and published updates preserve it", () => {
  assert.match(migration, /v_published_at timestamptz;/);
  assert.doesNotMatch(migration, /v_published_at timestamptz := clock_timestamp\(\)/);
  const publishStart = migration.indexOf("create or replace function app_private.api_fanbus_trip_publish");
  const rowLock = migration.indexOf("for update", publishStart);
  const completeness = migration.indexOf(
    "Die Fanbusfahrt ist für die Veröffentlichung unvollständig.",
    publishStart
  );
  const publishedAt = migration.indexOf("v_published_at := clock_timestamp();", publishStart);
  assert.ok(rowLock !== -1 && completeness !== -1 && publishedAt > completeness && completeness > rowLock);
  assert.match(migration, /registration_opens_at = v_published_at/);
  assert.match(migration, /v_existing\.registration_closes_at <= v_published_at/);
  assert.match(migration, /when v_existing\.status = 'PUBLISHED' then v_existing\.registration_opens_at/);
  assert.match(migration, /require_capability\('fanbus\.manage'\)/);
  assert.match(migration, /v_existing\.status <> 'DRAFT'/);
  assert.match(migration, /v_expected_revision <> v_existing\.revision/);
  assert.match(migration, /'FANBUS_TRIP_PUBLISHED'/);
});

test("M210 mobile metadata is compact and home-away filtering composes with existing filters", () => {
  assert.match(dates, /let homeAwayFilter = "ALL"/);
  assert.match(dates, /event\.eventType === "GAME" \? homeAwayLabel\(event\.homeAway\) : typeLabel/);
  assert.doesNotMatch(dates, /event\.eventType === "GAME" && event\.homeAway \? ` ·/);
  assert.match(dates, /id="m210EventHomeAwayFilter"/);
  assert.match(dates, /matchesHomeAway = homeAwayFilter === "ALL"/);
  assert.match(dates, /matchesType && matchesVisibility && matchesHomeAway/);
  assertTwoLineMobileTitle(
    "#m210DatesList .v4-compact-record.v4-m210-mobile-event .v4-m210-mobile-event-title"
  );
});
