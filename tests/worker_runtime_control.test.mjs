import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(resolve(root, path), "utf8");

test("Liveticker exposes manual worker control and blocks graphics until ready", async () => {
  const html = await read("liveticker/index.html");
  const js = await read("js/liveticker-graphics-inline.js");
  assert.match(html, /id="graphicWorkerToggle"/);
  assert.match(html, /id="graphicWorkerStatus"/);
  assert.match(js, /worker_runtime_status/);
  assert.match(js, /worker_runtime_set/);
  assert.match(js, /LIVETICKER_GRAPHICS/);
  assert.match(js, /Boolean\(workerRuntime\?\.ready\)/);
  assert.match(js, /Worker deaktiviert – Grafik-Erstellung derzeit nicht möglich\./);
  const fullRefresh = js.match(/function scheduleFullRefresh\([\s\S]*?\n}\n/);
  assert.ok(fullRefresh, "scheduleFullRefresh must exist");
  assert.doesNotMatch(fullRefresh[0], /clearWorkerRefreshTimer\(\)/);
});


test("Liveticker game mode keeps the live workflow compact and one-tap", async () => {
  const html = await read("liveticker/index.html");
  const engine = await read("js/liveticker-engine-v4.js");
  const graphics = await read("js/liveticker-graphics-inline.js");
  const storage = await read("js/liveticker-game-storage.js");
  const support = await read("js/liveticker-v5-support.js");
  assert.match(html, /id="submitButton"[^>]*aria-label="Speichern und kopieren"/);
  assert.match(html, /💾 📋/);
  assert.match(html, /id="tickerOutputPreview"/);
  assert.match(html, /id="editOutputButton"[^>]*>✏️<\/button>/);
  assert.match(html, /id="saveOutputButton"[^>]*>✓<\/button>/);
  assert.match(html, /id="historyToggle"/);
  assert.match(html, /class="live-game-row"[\s\S]*class="score-top compact-score"[\s\S]*id="gameMinute"/);
  assert.match(html, /id="mightyScoreName"[^>]*>Heim<\/span>/);
  assert.match(html, /id="opponentScoreName"[^>]*>Gast<\/span>/);
  assert.match(html, /class="worker-status-bar"[\s\S]*id="graphicWorkerControl"/);
  assert.match(html, /class="segment-status-bar"[\s\S]*id="segmentLabel"/);
  assert.doesNotMatch(html, /class="segment-status-bar"[\s\S]*id="graphicWorkerControl"/);
  assert.match(html, /status-bar-tools\{[^}]*flex-wrap:wrap/);
  assert.match(html, /segment-status-bar\{[^}]*justify-content:center/);
  assert.match(html, /data-header-layout="split-status-period-r1"/);
  assert.match(html, /class="action-grid"[\s\S]*actionGoalMighty[\s\S]*actionPenalty[\s\S]*actionGoalOpponent/);
  assert.match(html, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(html, /id="assistDetails" class="assist-details"/);
  assert.match(html, /output-preview\{[^}]*overflow:visible/);
  assert.match(html, /input,select,textarea\{font-size:16px/);
  assert.match(html, /class="field opponent-field" hidden/);
  assert.doesNotMatch(html, /primary-output-wrap\{position:sticky/);
  assert.match(storage, /\.liveticker-sync-status\{display:block/);
  assert.match(storage, /liveticker-sync-status\[data-state="error"\]\{color:var\(--red\)\}/);
  assert.doesNotMatch(support, /<span class="label">Spielort<\/span>/);
  assert.match(html, /id="actionShootout"[\s\S]*Penalty-<br>schießen/);
  assert.match(support, /const available = \(Number\.parseInt\(minuteInput\.value \|\| "0", 10\) \|\| 0\) >= 60/);
  assert.match(support, /actionShootout\.disabled = !available/);
  assert.match(support, /shootoutLabel\.hidden = !available/);
  assert.match(support, /classList\.toggle\("shootout-available", available\)/);
  assert.match(engine, /ordered\.slice\(0, 5\)/);
  assert.match(engine, /data-expand=/);
  assert.match(engine, /void copyCurrentOutput\(\)/);
  assert.match(engine, /actionGoalOpponentLabel"\)\.innerHTML = '<span aria-hidden="true">🥅<\/span><span>Tor Gegner<\/span>'/);
  assert.match(html, /id="primaryOutputButton"/);
  assert.match(html, /class="live-control-label">Spielstand<\/span>/);
  assert.match(html, /class="live-control-label" for="gameMinute">Spielminute<\/label>/);
  assert.match(html, /\.compact-score\{height:50px;min-height:50px/);
  assert.doesNotMatch(html, />Was ist passiert\?</);
  assert.match(html, /<select id="goalPlayer"><option value="">Spieler wählen<\/option>/);
  assert.doesNotMatch(html, /id="addPenalty"/);
  assert.match(engine, /class="add-penalty" type="button">Hinzufügen<\/button>/);
  assert.match(engine, /querySelector\("\.add-penalty"\)\.addEventListener\("click"[\s\S]*createPenaltyRow\(\);[\s\S]*refreshDraftOutput\(\)/);
  assert.match(graphics, /function currentOutputKind\(\)/);
  assert.match(graphics, /BUTTONS\[kind\]\?\.click\(\)/);
  assert.match(html, /data-output-status="PERIOD_1"/);
  assert.match(html, /data-output-status="PERIOD_2"/);
  assert.match(html, /data-output-status="FINAL"/);
  const statusStripIndex = html.indexOf('id="outputStatusStrip"');
  const graphicsPanelIndex = html.indexOf('id="graphicsResultPanel"');
  const primaryOutputIndex = html.indexOf('id="primaryOutputWrap"');
  assert.ok(statusStripIndex >= 0 && graphicsPanelIndex > statusStripIndex && primaryOutputIndex > graphicsPanelIndex);
  assert.match(html, /id="graphicsResultPanel" class="summary-actions score-inline-output" hidden/);
  assert.match(graphics, /button\.disabled = !hasEvent/);
  assert.match(
    graphics,
    /outputStatusButtons\.forEach\(button => button\.addEventListener\("click", \(\) => \{[\s\S]*summaryTextFromOutput\(kind\);[\s\S]*openResults\(kind\);/
  );
  const outputStatusClick = graphics.match(/outputStatusButtons\.forEach\([\s\S]*?\n\}\)\);/)?.[0] || "";
  assert.doesNotMatch(outputStatusClick, /latestJob\(kind\)\?\.status !== "SUCCEEDED"/);
  assert.doesNotMatch(html, /Spiel schnell mittickern/);
});


test("Liveticker result panel shares cached Post/Story files synchronously with direct download fallback", async () => {
  const html = await read("liveticker/index.html");
  const graphics = await read("js/liveticker-graphics-inline.js");
  const auth = await read("js/liveticker-auth-bootstrap.js");
  assert.match(html, /connect-src[^;]*https:\/\/cloud\.plaerrdeifl\.de/);
  assert.match(html, /graphic-artifacts\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(graphics, /const baseLabel = artifact\.kind === "POST" \? "Post" : "Story"/);
  assert.match(graphics, /button\.disabled = waitingForNativeShare/);
  assert.match(graphics, /button\.textContent = waitingForNativeShare \? `\$\{baseLabel\} wird vorbereitet …` : baseLabel/);
  assert.match(graphics, /navigator\.canShare\(\{ files: \[file\] \}\)/);
  assert.match(graphics, /navigator\.share\(\{ files: \[file\], title: label \}\)/);
  assert.match(graphics, /const graphicArtifactCache = new Map\(\)/);
  assert.match(graphics, /prefetchGraphicArtifact\(artifact\)/);
  assert.match(graphics, /const prepared = cachedGraphicArtifact\(artifact\)/);
  assert.match(graphics, /globalThis\.location\.assign\(artifact\.downloadUrl\)/);
  const delivery = graphics.match(/function deliverGraphicArtifact\([\s\S]*?\n}\n/);
  assert.ok(delivery);
  assert.doesNotMatch(graphics, /async function deliverGraphicArtifact/);
  assert.doesNotMatch(delivery[0], /\bawait\b|\bfetch\s*\(|fetchGraphicArtifact\(/);
  const renderArtifacts = graphics.match(/function renderArtifacts\([\s\S]*?\n}\n/);
  assert.ok(renderArtifacts);
  assert.match(renderArtifacts[0], /button\.addEventListener\("click", \(\) =>/);
  assert.doesNotMatch(renderArtifacts[0], /\basync\b|\bawait\b|\bfetch\s*\(/);
  assert.match(graphics, /if \(error\?\.name === "AbortError"\) return "cancelled";\s*return downloadGraphicArtifact\(artifact\)/);
  assert.doesNotMatch(graphics, /downloadGraphicBlob|createObjectURL|window\.open\(|Fehler – erneut/);
  assert.match(graphics, /statusLine\.hidden = job\?\.status === "SUCCEEDED"/);
  assert.match(graphics, /const visible = Boolean\(kind\) && !resultsOpen/);
  assert.match(graphics, /primaryOutputWrap\.hidden = !visible/);
  assert.match(auth, /liveticker-graphics-inline\.js\?v=20260926-output-primary-action-r1/);
});

test("Fanbus Social Media exposes manual worker control and blocks flyer generation until ready", async () => {
  const js = await read("js/modules/m340-publishing.js");
  assert.match(js, /data-m340-worker-toggle/);
  assert.match(js, /worker_runtime_status/);
  assert.match(js, /worker_runtime_set/);
  assert.match(js, /FANBUS_PUBLISHING/);
  assert.match(js, /Boolean\(model\?\.workerRuntime\?\.ready\)/);
  assert.match(js, /Worker deaktiviert – Flyer-Erstellung derzeit nicht möglich\./);
});

test("worker runtimes keep legacy gateway hints but Liveticker DEV uses event-driven recovery", async () => {
  const migration = await read("supabase/migrations/20260909115912_worker_runtime_controls_r1.sql");
  const fanbusWorker = await read("workers/m340-publishing/worker.py");
  const livetickerWorker = await read("workers/liveticker-publishing/publishing_worker_dev.py");
  assert.match(migration, /'activePollSeconds',5,'disabledPollSeconds',60/);
  assert.match(fanbusWorker, /poll_seconds not in \(5, 60\)/);
  assert.match(fanbusWorker, /LAST_POLL_SECONDS = 60/);
  assert.match(livetickerWorker, /RECOVERY_SECONDS = 120/);
  assert.match(livetickerWorker, /RealtimeBroadcastClient/);
  assert.match(livetickerWorker, /scheduler\.wait\(RECOVERY_SECONDS\)/);
  assert.doesNotMatch(livetickerWorker, /sleep_seconds = 5|time\.sleep\(5\)/);
});


test("Liveticker exposes WA and WPP runtime controls beside the graphics control", async () => {
  const html = await read("liveticker/index.html");
  const runtime = await read("js/liveticker-runtime-controls.js");
  const publish = await read("js/liveticker-whatsapp-publish.js");
  const migration = await read("supabase/migrations/20260917192915_liveticker_whatsapp_runtime_controls_dev_r1.sql");
  const gateway = await read("supabase/functions/liveticker-whatsapp-worker/index.ts");
  const worker = await read("workers/liveticker-whatsapp/worker.mjs");

  assert.match(html, /id="graphicWorkerControl"[\s\S]*id="whatsappWorkerControl"[\s\S]*id="wppControl"/);
  assert.match(html, /id="whatsappWorkerStatus"/);
  assert.match(html, /id="wppStatus"/);
  assert.match(runtime, /LIVETICKER_WHATSAPP/);
  assert.match(runtime, /worker_runtime_status/);
  assert.match(runtime, /worker_runtime_set/);
  assert.match(runtime, /liveticker_wpp_runtime_status/);
  assert.doesNotMatch(runtime, /liveticker_wpp_runtime_set/);
  assert.match(runtime, /const WPP_CONTROL_OWNER = false/);
  assert.match(runtime, /Steuerung nur in PROD/);
  assert.match(runtime, /pd-liveticker-whatsapp-runtime/);
  assert.match(publish, /transportReady\(\)/);
  assert.match(publish, /WA ist ausgeschaltet/);
  assert.match(publish, /WPP ist nicht verbunden/);

  assert.match(migration, /'LIVETICKER_WHATSAPP'/);
  assert.match(migration, /create table app_private\.liveticker_wpp_runtime_control/);
  assert.match(migration, /pd_liveticker_wpp_runtime_control/);
  assert.match(migration, /pd_liveticker_whatsapp_worker_can_claim/);
  assert.match(migration, /liveticker_whatsapp_transport_assert_ready/);
  assert.match(migration, /WHATSAPP_WORKER_DISABLED_FROM_PORTAL/);
  assert.match(migration, /WPP_DISABLED_FROM_PORTAL/);
  assert.match(migration, /status = 'PENDING'/);
  assert.match(migration, /sticker_status = case when sticker_status = 'PENDING' then 'FAILED'/);
  assert.match(migration, /text_status = case when text_status = 'PENDING' then 'FAILED'/);

  assert.match(gateway, /value\.action === "control"/);
  assert.match(gateway, /pd_worker_runtime_control/);
  assert.match(gateway, /pd_liveticker_wpp_runtime_control/);
  assert.match(gateway, /pd_liveticker_whatsapp_worker_can_claim/);
  assert.match(worker, /api\/sessions\/\$\{encodeURIComponent\(WAHA_SESSION\)\}/);
  assert.match(worker, /\/start/);
  assert.match(worker, /\/stop/);
  assert.match(worker, /\/restart/);
  assert.match(worker, /action: "control"/);
  assert.match(worker, /RECOVERY_INTERVAL_MS[^\n]*"120000"/);
  assert.match(worker, /await refreshRuntimeControl\(reason\)/);
  assert.doesNotMatch(worker, /RUNTIME_CONTROL_INTERVAL_MS|setInterval\([^\n]*refreshRuntimeControl/);
});
