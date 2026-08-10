import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relativePath => fs.readFile(path.join(root, relativePath), "utf8");

const [moduleSource, pdfSource, fanclub, worker, router, fanclubPage, css, documentation] = await Promise.all([
  read("js/modules/membership-applications.js"),
  read("js/modules/membership-application-pdf.js"),
  read("js/modules/fanclub.js"),
  read("service-worker.js"),
  read("js/router.js"),
  read("pages/fanclub.html"),
  read("css/app.css"),
  read("docs/M150_R1_F1_3_INTERNAL_PORTAL.md")
]);

function sourceBlock(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Startmarker fehlt: ${start}`);
  assert.notEqual(to, -1, `Endmarker fehlt: ${end}`);
  return source.slice(from, to);
}

test("M150 F1.3 module exists and is integrated as a Fanclub tab", () => {
  assert.match(moduleSource, /export async function renderMembershipApplications/);
  assert.match(fanclub, /from "\.\/membership-applications\.js"/);
  assert.match(fanclub, /\["membership-applications", "Mitgliedsanträge"\]/);
  assert.match(fanclub, /renderMembershipApplications\(panel/);
  assert.match(fanclubPage, /id="fanclubTabs"/);
  assert.match(fanclubPage, /id="fanclubPanel"/);
  assert.doesNotMatch(router, /membership-applications|Mitgliedsanträge/);
});

test("tab visibility requires the current active member to hold a current office", () => {
  const visibility = sourceBlock(
    fanclub,
    "function canViewMembershipApplications()",
    "function memberStatusBadge"
  );

  assert.match(visibility, /auth\.current\(\)\.user/);
  assert.match(visibility, /user\?\.member/);
  assert.match(visibility, /!user \|\| !member/);
  assert.match(visibility, /member\.status !== "ACTIVE"/);
  assert.match(visibility, /snapshot\?\.offices/);
  assert.match(visibility, /office\.memberId/);
  assert.match(visibility, /member\.id/);
  assert.doesNotMatch(visibility, /portal\.admin|members\.manage|users\.manage|isAdmin|hasCapability/);
});

test("the module uses only the six accepted pd_api actions", () => {
  assert.match(moduleSource, /from "\.\/common\.js"/);
  assert.match(moduleSource, /\bcall\(/);
  assert.doesNotMatch(
    moduleSource,
    /getSupabaseClient|supabase-client|@supabase\/supabase-js|createClient|\.rpc\s*\(|(?:supabase(?:Client)?|client)\s*\.\s*from\s*\(/i
  );

  const calls = [...moduleSource.matchAll(/call\("([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(
    [...new Set(calls)].sort(),
    [
      "membership_application_convert",
      "membership_application_detail",
      "membership_application_manual_decide",
      "membership_application_vote",
      "membership_application_withdraw",
      "membership_applications_list"
    ].sort()
  );
});

test("list status, server order, and default local filter follow the contract", () => {
  for (const [status, label] of [
    ["PENDING", "Offen"],
    ["APPROVED", "Angenommen"],
    ["REJECTED", "Abgelehnt"],
    ["WITHDRAWN", "Zurückgezogen"]
  ]) {
    assert.match(moduleSource, new RegExp(`${status}: \\{ label: "${label}"`));
  }

  assert.match(moduleSource, /let statusFilter = "PENDING"/);
  assert.match(moduleSource, /<option value="ALL"/);
  assert.match(moduleSource, /applications\.filter\(/);
  assert.doesNotMatch(moduleSource, /applications\.sort\(|filteredApplications\(\)[\s\S]{0,120}\.sort\(/);
  assert.match(moduleSource, /application\.submittedAt/);
  assert.match(moduleSource, /yesVotes/);
  assert.match(moduleSource, /noVotes/);
  assert.match(moduleSource, /missingVotes/);
});

test("details are freshly loaded and cover person, application, decision, and vote state", () => {
  assert.match(moduleSource, /function loadApplicationDetail\(id\)[\s\S]*call\("membership_application_detail", \{ id \}\)/);
  assert.match(moduleSource, /async function openApplicationDetail\(id\)[\s\S]*await loadApplicationDetail\(id\)/);

  for (const field of [
    "firstName",
    "lastName",
    "birthDate",
    "email",
    "phone",
    "street",
    "houseNumber",
    "postalCode",
    "city",
    "submittedAt",
    "applicantMessage",
    "declarationVersion",
    "statutesVersion",
    "statutesReference",
    "declarationConfirmed",
    "statutesConfirmed",
    "decidedAt",
    "decisionMethod",
    "decisionReasonInternal",
    "applicantNotice"
  ]) {
    assert.match(moduleSource, new RegExp(`detail\\.${field}`));
  }

  assert.match(moduleSource, /Interner Entscheidungsgrund – nicht für den Antragsteller/);
  assert.match(moduleSource, /Separate Mitteilung an den Antragsteller/);
  assert.match(moduleSource, /Eigene Stimme/);
  assert.match(moduleSource, /Noch keine Stimme/);
});

test("PDF download is always offered and reauthorizes with a fresh matching detail", () => {
  assert.match(moduleSource, /from "\.\/membership-application-pdf\.js"/);
  const detailMarkup = sourceBlock(
    moduleSource,
    "function applicationDetailMarkup",
    "function bindDetailActions"
  );
  const binding = sourceBlock(
    moduleSource,
    "function bindDetailActions",
    "function showApplicationDetail"
  );

  assert.match(detailMarkup, />Antrag als PDF<\/button>/);
  assert.match(detailMarkup, /data-m150-download-pdf/);
  assert.equal((detailMarkup.match(/data-m150-download-pdf/g) || []).length, 1);

  const freshCallAt = binding.indexOf("await loadApplicationDetail(detail.id)");
  const idCheckAt = binding.indexOf("freshDetail?.id !== detail.id");
  const pdfAt = binding.indexOf("await downloadMembershipApplicationPdf(freshDetail)");
  assert.ok(freshCallAt >= 0);
  assert.ok(idCheckAt > freshCallAt);
  assert.ok(pdfAt > idCheckAt);
  assert.doesNotMatch(binding, /downloadMembershipApplicationPdf\(detail\)/);
  assert.match(binding, /catch \{[\s\S]*Der PDF-Download konnte nicht erstellt werden/);
  assert.match(binding, /finally \{[\s\S]*button\.disabled = false/);
});

test("PDF integration adds no data API, direct table, or finance action", () => {
  const combinedSource = `${moduleSource}\n${pdfSource}`;
  assert.doesNotMatch(
    combinedSource,
    /getSupabaseClient|supabase-client|@supabase\/supabase-js|createClient|\.rpc\s*\(|(?:supabase(?:Client)?|client)\s*\.\s*from\s*\(|fetch\s*\(|service_role|localStorage|sessionStorage|indexedDB|\bcaches\b/i
  );
  assert.doesNotMatch(combinedSource, /\b(?:finance|sepa|payment|contribution)\b/i);

  const calls = [...moduleSource.matchAll(/call\("([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(
    [...new Set(calls)].sort(),
    [
      "membership_application_convert",
      "membership_application_detail",
      "membership_application_manual_decide",
      "membership_application_vote",
      "membership_application_withdraw",
      "membership_applications_list"
    ].sort()
  );
});

test("voting is immutable, revision-aware, and requires the decisive NO reason", () => {
  const voting = sourceBlock(moduleSource, "async function handleVote", "function openManualDecision");
  assert.match(voting, /confirmAction\("Für die Aufnahme stimmen\?"/);
  assert.match(voting, /vote: "YES"[\s\S]*expectedRevision: detail\.revision/);
  assert.match(voting, /Number\(detail\.noVotes \|\| 0\) === 2/);
  assert.match(voting, /name="reasonInternal"[\s\S]*maxlength="4000" required/);
  assert.match(voting, /vote: "NO"[\s\S]*expectedRevision: detail\.revision[\s\S]*reasonInternal: values\.reasonInternal/);
  assert.doesNotMatch(moduleSource, /updateVote|deleteVote|vote_update|vote_delete/);
});

test("seven-day decisions use only the server flag and separate both texts", () => {
  assert.match(moduleSource, /detail\.sevenDayDecisionAvailable === true/);
  assert.match(moduleSource, /membership_application_manual_decide/);
  assert.match(moduleSource, /reasonInternal: values\.reasonInternal/);
  assert.match(moduleSource, /payload\.applicantNotice = values\.applicantNotice/);
  assert.match(moduleSource, /Mitteilung an Antragsteller \(optional\)/);
  assert.doesNotMatch(moduleSource, /new Date|Date\.now|setDate|setTime|86400000|\+\s*7/);
});

test("withdrawal is PENDING-only, confirmed, revision-safe, and field-minimal", () => {
  const actions = sourceBlock(
    moduleSource,
    "function detailActionsMarkup",
    "function applicationDetailMarkup"
  );
  const withdrawal = sourceBlock(
    moduleSource,
    "async function handleWithdraw",
    "async function handleVote"
  );

  assert.match(actions, /if \(detail\.status === "PENDING"\)[\s\S]*data-m150-withdraw/);
  assert.equal((actions.match(/data-m150-withdraw/g) || []).length, 1);
  assert.match(actions, /<h3>Antrag zurückgezogen<\/h3>/);
  assert.match(actions, /Nur verwenden, wenn der Antragsteller seinen Antrag außerhalb des Portals zurückgezogen hat\./);
  assert.match(actions, /kann in M150 R1 nicht rückgängig gemacht werden/);
  assert.match(actions, />Als zurückgezogen markieren<\/button>/);

  const confirmationAt = withdrawal.indexOf("await confirmAction(");
  const mutationAt = withdrawal.indexOf('call("membership_application_withdraw"');
  const mutationPayload = withdrawal.slice(mutationAt, withdrawal.indexOf("})", mutationAt) + 2);
  assert.ok(confirmationAt >= 0);
  assert.ok(mutationAt > confirmationAt);
  assert.match(withdrawal, /id: detail\.id,[\s\S]*expectedRevision: detail\.revision/);
  assert.match(withdrawal, /Der Antrag wurde als zurückgezogen markiert\./);
  assert.doesNotMatch(mutationPayload, /reasonInternal|applicantNotice|reason|message|email/i);
  assert.doesNotMatch(withdrawal, /fetch|getSupabaseClient|\.rpc\s*\(|\.from\s*\(/i);
});

test("withdrawal errors are user-friendly and refresh stale application state", () => {
  for (const code of [
    "M150_APPLICATION_ALREADY_WITHDRAWN",
    "M150_WITHDRAW_REQUIRES_PENDING",
    "M150_REVISION_CONFLICT"
  ]) {
    assert.match(moduleSource, new RegExp(code));
  }
  assert.match(moduleSource, /Der Antrag wurde bereits als zurückgezogen markiert\./);
  assert.match(moduleSource, /Nur offene Anträge können als zurückgezogen markiert werden\./);
  assert.match(moduleSource, /M150_APPLICATION_ALREADY_WITHDRAWN[\s\S]*M150_WITHDRAW_REQUIRES_PENDING/);
});

test("rejection communication keeps the internal reason and applicant notice separate", () => {
  const voting = sourceBlock(moduleSource, "async function handleVote", "function openManualDecision");
  const manual = sourceBlock(moduleSource, "function openManualDecision", "function comparisonMemberMarkup");
  const detail = sourceBlock(moduleSource, "function decisionMarkup", "function conversionMarkup");

  assert.match(moduleSource, /Intern – wird nicht an den Antragsteller gesendet\./);
  assert.match(moduleSource, /Optional – diese Mitteilung kann in der Ablehnungs-E-Mail verwendet werden\./);
  assert.match(voting, /name="reasonInternal"[\s\S]*maxlength="4000" required/);
  assert.match(voting, /name="applicantNotice"[\s\S]*maxlength="2000"/);
  assert.match(voting, /values\.applicantNotice \? \{ applicantNotice: values\.applicantNotice \} : \{\}/);
  assert.match(manual, /rejected \? `<label[\s\S]*name="applicantNotice"[\s\S]*maxlength="2000"/);
  assert.match(manual, /if \(rejected && values\.applicantNotice\) payload\.applicantNotice = values\.applicantNotice/);
  assert.match(detail, /detail\.status === "REJECTED" && detail\.applicantNotice/);
  assert.match(detail, /Separate Mitteilung an den Antragsteller/);
  assert.doesNotMatch(moduleSource, /applicantNotice\s*[:=]\s*(?:values\.)?reasonInternal/);
  assert.doesNotMatch(moduleSource, /reasonInternal\s*[:=]\s*(?:values\.)?applicantNotice/);
});

test("the browser contains no mail delivery, provider, or WordPress integration", () => {
  assert.doesNotMatch(moduleSource, /wp_mail|wordpress|smtp|sendgrid|mailgun|resend|brevo|pg_net/i);
  assert.doesNotMatch(moduleSource, /membership_email_(?:claim|complete)|email_outbox|sendEmail|sendMail/i);
});

test("duplicate hints never perform or preselect an automatic association", () => {
  assert.match(moduleSource, /Hinweise – keine automatische Zuordnung/);
  assert.match(moduleSource, /wählen keinen Datensatz aus/);
  assert.doesNotMatch(moduleSource, /Identität bestätigt|automatisch erkannt/);
  assert.doesNotMatch(moduleSource, /<input[^>]+name="mode"[^>]+checked/);
  assert.match(moduleSource, /<option value="">Bitte bewusst auswählen<\/option>/);
  assert.doesNotMatch(moduleSource, /targetMemberId\s*=\s*(?:detail|item|match)/);
});

test("all three conversion modes are explicit and status-restricted", () => {
  assert.match(moduleSource, /value="NEW_MEMBER"/);
  assert.match(moduleSource, /value="REACTIVATE_EXISTING"/);
  assert.match(moduleSource, /value="RESOLVE_EXISTING_ACTIVE"/);
  assert.match(moduleSource, /mode === "REACTIVATE_EXISTING" \? "INACTIVE" : "ACTIVE"/);
  assert.match(moduleSource, /\.filter\(member => member\.status === status\)/);
  assert.match(moduleSource, /if \(values\.mode !== "NEW_MEMBER"\) payload\.targetMemberId = values\.targetMemberId/);
  assert.match(moduleSource, /Neues Mitglied wirklich anlegen/);
  assert.match(moduleSource, /Die vorhandenen Stammdaten werden durch die Wiederaufnahme nicht automatisch überschrieben/);
  assert.match(moduleSource, /Der bestehende Mitgliedsdatensatz wird nicht verändert/);
  assert.match(moduleSource, /Antrag angenommen – Mitglied noch nicht übernommen/);
  assert.match(moduleSource, /detail\.status === "APPROVED" && detail\.convertedAt == null/);
});

test("conversion result and required conflict messages are user-friendly", () => {
  assert.match(moduleSource, /NEW_MEMBER: "Neues Mitglied angelegt"/);
  assert.match(moduleSource, /REACTIVATE_EXISTING: "Bestehendes Mitglied reaktiviert"/);
  assert.match(moduleSource, /RESOLVE_EXISTING_ACTIVE: "Bestehendem aktiven Mitglied zugeordnet"/);
  assert.match(moduleSource, /M150_REACTIVATION_OFFICE_ASSIGNMENT_REQUIRES_REVIEW/);
  assert.match(moduleSource, /Die Amtszuordnung muss zuerst bewusst im Bereich ‚Vorstand‘ geklärt werden/);
  assert.match(moduleSource, /M150_REVISION_CONFLICT/);
  assert.match(moduleSource, /zwischenzeitlich geändert/);

  for (const code of [
    "M150_BOARD_INCOMPLETE",
    "M150_BOARD_SNAPSHOT_INCOMPLETE",
    "M150_BOARD_ROSTER_CHANGED",
    "M150_APPLICATION_ALREADY_CONVERTED",
    "M150_CONVERSION_REQUIRES_APPROVED",
    "M150_REACTIVATION_REQUIRES_INACTIVE_MEMBER",
    "M150_RESOLUTION_REQUIRES_ACTIVE_MEMBER",
    "M150_TARGET_MEMBER_NOT_FOUND"
  ]) {
    assert.match(moduleSource, new RegExp(code));
  }
});

test("writes always reload list and detail without retrying the write", () => {
  const refresh = sourceBlock(moduleSource, "async function refreshListAndDetail", "async function handleKnownError");
  const execute = sourceBlock(moduleSource, "async function executeWrite", "async function handleVote");
  assert.match(refresh, /Promise\.all\(\[[\s\S]*loadApplicationList\(\)[\s\S]*loadApplicationDetail\(id\)/);
  assert.match(execute, /await runWrite\(operation, successMessage\)/);
  assert.match(execute, /await refreshListAndDetail\(id, reopenDetail\)/);
  assert.doesNotMatch(execute, /operation\(\)[\s\S]*operation\(\)/);
});

test("fanclub owns and refreshes the member snapshot after conversion", () => {
  const fanclubRefresh = sourceBlock(
    fanclub,
    "async function refreshMembershipApplicationMembers()",
    "function renderAll()"
  );
  const conversion = sourceBlock(
    moduleSource,
    "async function executeConversionWrite",
    "async function handleVote"
  );

  assert.match(fanclub, /members: snapshot\?\.members \|\| \[\],[\s\S]*refreshMembers: refreshMembershipApplicationMembers/);
  assert.match(fanclubRefresh, /call\("fanclub_snapshot"\)/);
  assert.match(fanclubRefresh, /snapshot = refreshed/);
  assert.match(fanclubRefresh, /return snapshot\?\.members \|\| \[\]/);
  assert.match(fanclubRefresh, /snapshot = \{ \.\.\.snapshot, members: \[\] \}/);

  const writeAt = conversion.indexOf("await runWrite(operation, successMessage)");
  const fanclubRefreshAt = conversion.indexOf("await refreshFanclubMembers()");
  const membersReplaceAt = conversion.indexOf("memberSnapshot = Array.isArray(freshMembers)");
  const applicationsRefreshAt = conversion.indexOf("await refreshListAndDetail(id, false)");
  assert.ok(writeAt >= 0);
  assert.ok(fanclubRefreshAt > writeAt);
  assert.ok(membersReplaceAt > fanclubRefreshAt);
  assert.ok(applicationsRefreshAt > membersReplaceAt);
});

test("a post-conversion member refresh failure discards stale candidates without retrying conversion", () => {
  const conversion = sourceBlock(
    moduleSource,
    "async function executeConversionWrite",
    "async function handleVote"
  );
  assert.equal((conversion.match(/runWrite\(/g) || []).length, 1);
  assert.equal((conversion.match(/executeConversionWrite\(/g) || []).length, 1);
  assert.match(conversion, /catch \(refreshError\)[\s\S]*memberSnapshot = \[\]/);
  assert.match(conversion, /await refreshApplicationsAsAvailable\(id\)/);
  assert.match(conversion, /Das Mitglied wurde übernommen, aber die aktuelle Mitgliederliste konnte nicht neu geladen werden/);
  assert.doesNotMatch(conversion, /call\("membership_application_convert"/);
});

test("conversion target filters remain current and comparison does not invent leftOn", () => {
  const comparison = sourceBlock(
    moduleSource,
    "function comparisonMemberMarkup",
    "function targetMemberOptions"
  );
  assert.match(moduleSource, /mode === "REACTIVATE_EXISTING" \? "INACTIVE" : "ACTIVE"/);
  assert.match(moduleSource, /\.filter\(member => member\.status === status\)/);
  assert.doesNotMatch(comparison, /leftOn|Austritt/);
  assert.doesNotMatch(moduleSource, /<input[^>]+name="mode"[^>]+checked/);
  assert.match(moduleSource, /if \(values\.mode !== "NEW_MEMBER"\) payload\.targetMemberId = values\.targetMemberId/);
});

test("M150 UI does not add unrelated writes or browser-native dialogs", () => {
  assert.doesNotMatch(moduleSource, /window\.(?:alert|confirm|prompt)/);
  assert.doesNotMatch(moduleSource, /office_slots|save_offices|save_member|user_member_links/);
  assert.doesNotMatch(moduleSource, /\b(?:finance|sepa|payment|contribution)\b/i);
  assert.doesNotMatch(moduleSource, /portalaccount|Portalzugang freischalten|Rolle zuweisen|Amt zuweisen/i);
});

test("service worker cache and responsive M150 styling are extended", () => {
  assert.match(worker, /const CACHE_VERSION = "pd-portal-v4-m010-central-capabilities-r1-20260810"/);
  assert.match(worker, /const PREVIOUS_CACHE_VERSION = "pd-portal-v4-m150-withdrawn-r1-20260810"/);
  assert.match(worker, /"\.\/js\/modules\/membership-applications\.js"/);
  assert.match(worker, /"\.\/js\/modules\/membership-application-pdf\.js"/);
  assert.match(css, /M150 R1 F1\.3/);
  assert.match(css, /\.v4-m150-compact-row/);
  assert.match(css, /\.v4-m150-comparison/);
});

test("technical documentation records the F1.3 boundaries", () => {
  for (const phrase of [
    "Fanclub-Tab",
    "aktuellen aktiven Vorstandsmitglieder",
    "Server bleibt die Autoritätsgrenze",
    "dritte Nein-Stimme",
    "7-Tage-Manuellentscheidung",
    "keine automatische Zuordnung",
    "APPROVED ist noch kein Mitglied",
    "D-017",
    "Portalzugang",
    "Finance",
    "SEPA",
    "Public Submit"
  ]) {
    assert.match(documentation, new RegExp(phrase));
  }
});
