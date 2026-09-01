import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");
const [fanbuses, auth, app, install] = await Promise.all([
  read("js/modules/fanbuses.js"),
  read("js/auth.js"),
  read("js/app.js"),
  read("js/install.js")
]);

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `Startmarker fehlt: ${start}`);
  assert.ok(to > from, `Endmarker fehlt: ${end}`);
  return source.slice(from, to);
}

test("M326 group-member writes reload the authoritative live group workspace", () => {
  const memberEditor = section(
    fanbuses,
    "async function openPersonGroupMembers",
    "async function openPersonGroupDetailDialog"
  );
  const writeAt = memberEditor.indexOf('call("fanbus_person_group_members_replace"');
  const closeAt = memberEditor.indexOf("closeAllDialogs();", writeAt);
  const refreshAt = memberEditor.indexOf("await refresh();", closeAt);

  assert.ok(writeAt >= 0);
  assert.ok(closeAt > writeAt);
  assert.ok(refreshAt > closeAt);
  assert.doesNotMatch(memberEditor, /memberCount\s*(?:--|-=)|count\s*(?:--|-=)|location\.reload|setTimeout/);

  const workspace = section(
    fanbuses,
    "function refreshPersonGroupsWorkspace",
    "function operationEventLabel"
  );
  assert.match(workspace, /document\.getElementById\("m310FanbusList"\)/);
  assert.match(workspace, /return renderPersonGroupsWorkspace\(panel, summary\)/);
  assert.match(workspace, /const renderId = \+\+personGroupsRenderSequence/);
  assert.match(workspace, /call\("fanbus_person_groups_list", \{ includeInactive: true \}\)/);
  assert.match(workspace, /renderId !== personGroupsRenderSequence \|\| !panel\.isConnected/);
  assert.match(workspace, /groups\.map\(personGroupListCard\)/);
  assert.doesNotMatch(workspace, /memberCount\s*(?:--|-=)|location\.reload|setTimeout/);

  const card = section(
    fanbuses,
    "function personGroupListCard",
    "function personGroupDetailBody"
  );
  assert.match(card, /Number\(group\.memberCount \|\| 0\)/);
});

test("auth refreshes distinguish token churn from render-relevant portal changes", () => {
  assert.match(auth, /\["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"\]\.includes\(event\)/);
  assert.match(auth, /await refreshBootstrap\(\)/);
  assert.match(auth, /delete bootstrap\.serverTime/);
  assert.match(auth, /bootstrap\.permissions = \[\.\.\.bootstrap\.permissions\]\.sort\(\)/);
  assert.match(auth, /nextRenderFingerprint !== renderFingerprint[\s\S]*renderRevision \+= 1/);
  assert.match(auth, /renderRevision,/);

  const handler = section(
    app,
    "function handleAuthChange",
    "async function signInWithGoogleCredential"
  );
  assert.match(handler, /Number\(current\.renderRevision \|\| 0\)[\s\S]*!== lastAuthRenderRevision/);
  assert.match(handler, /if \(routeChanged \|\| renderRelevantChange\) \{\s*await renderRoute\(\);\s*return;\s*\}/);
  assert.match(handler, /updateConnectionChrome\(\);/);
  assert.doesNotMatch(handler, /updateChrome\(\)/);
});

test("relevant auth changes retain route enforcement and stale-render protection", () => {
  const render = section(
    app,
    "async function renderRoute",
    "function handleAuthChange"
  );
  assert.match(render, /const allowed = enforceRoute\(requested\)/);
  assert.match(render, /if \(allowed !== requested\)[\s\S]*replaceHash\("#\/" \+ allowed\)[\s\S]*return renderRoute\(\)/);
  assert.match(render, /const renderId = \+\+renderSequence/);
  assert.ok(render.indexOf("const renderId = ++renderSequence") < render.indexOf('if (allowed === "login")'));
  assert.ok((render.match(/renderId !== renderSequence/g) || []).length >= 3);

  const fingerprint = section(
    auth,
    "function currentRenderFingerprint",
    "function emit"
  );
  assert.match(fingerprint, /authenticated: Boolean\(state\.session\)/);
  assert.match(fingerprint, /sessionUser:/);
  assert.match(fingerprint, /bootstrap/);
});

test("explicit refresh, online recovery and explicit-only PWA reload remain intact", () => {
  const refresh = section(
    app,
    "async function refreshCurrentView",
    "async function logout"
  );
  assert.match(refresh, /explicitRefreshActive = true/);
  assert.match(refresh, /await auth\.refresh\(\)/);
  assert.match(refresh, /syncAuthRenderRevision\(\)/);
  assert.match(refresh, /await renderRoute\(\)/);
  assert.match(refresh, /finally \{\s*explicitRefreshActive = false/);
  assert.match(app, /window\.addEventListener\(\s*"online",\s*refreshCurrentView/);

  assert.match(install, /reloadAfterExplicitUpdate = true[\s\S]*SKIP_WAITING/);
  assert.match(install, /if \(!reloadAfterExplicitUpdate\) return;[\s\S]*location\.reload\(\)/);
  assert.equal((install.match(/location\.reload\(\)/g) || []).length, 1);
  assert.doesNotMatch(`${auth}\n${app}\n${fanbuses}`, /location\.reload\(\)/);
});

test("existing M326 child writes still discard stale dialog parents", () => {
  for (const [start, end] of [
    ["function openRegularRiderDialog", "function openRegularRiderLinkDialog"],
    ["function openRegularRiderLinkDialog", "function regularRiderListCard"],
    ["function openPersonGroupForm", "function openPersonGroupPicker"],
    ["async function openPersonGroupMembers", "async function openPersonGroupDetailDialog"]
  ]) {
    const flow = section(fanbuses, start, end);
    assert.match(flow, /closeAllDialogs\(\);\s*await refresh\(\);/);
  }
});
