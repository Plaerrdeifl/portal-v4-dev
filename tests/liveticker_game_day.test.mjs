import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  activeGameDayStickers,
  deliveryComponentStatus,
  gameDayEditDraft,
  gameDayHeaderModel,
  gameDayTimeline,
  newActionId,
  periodFromMinute,
  savedGameDayActionId,
  scoreFromHistory
} from "../js/liveticker-game-day-core.js";
globalThis.window = { PD_RUNTIME_CONFIG: {} };
const {
  createWhatsappDeliveryRequest,
  createWhatsappStickerOnlyRequest
} = await import("../js/liveticker-whatsapp-stickers.js");

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const eventId = "11111111-1111-4111-8111-111111111111";
const stickerId = "22222222-2222-4222-8222-222222222222";
const opponentId = "33333333-3333-4333-8333-333333333333";

test("Spielmodus is an additive route and leaves the klassische Ansicht reachable", async () => {
  const [html, bootstrap, admin] = await Promise.all([
    read("liveticker/index.html"),
    read("js/liveticker-bootstrap.js"),
    read("js/modules/liveticker-admin.js")
  ]);
  assert.match(html, /href="\?mode=game-day"[^>]*>SPIELMODUS/);
  assert.match(html, /id="tickerApp"/);
  assert.match(html, /id="gameDayRoot" hidden/);
  assert.match(bootstrap, /import\("\.\/liveticker-game-day\.js\?v=/);
  const gameDay = await read("js/liveticker-game-day.js");
  assert.match(gameDay, /href="\.\.\/#\/liveticker"[^>]*>← Liveticker<\/a>/);
  assert.match(gameDay, /href="\.\/"[^>]*>Klassische Ansicht<\/a>/);
  assert.match(admin, /href="\.\/liveticker\/\?mode=game-day"/);
  assert.match(admin, /href="\.\/liveticker\/"/);
});

test("match header derives home/away score, period and minute from the existing model", () => {
  const history = [
    { id: "g1", type: "goal", team: "mighty" },
    { id: "g2", type: "goal", team: "mighty" },
    { id: "g3", type: "goal", team: "opponent" },
    { id: "p1", type: "penalty", team: "mighty" }
  ];
  assert.deepEqual(scoreFromHistory(history), { own: 2, opponent: 1 });
  assert.equal(periodFromMinute(43).label, "3. Drittel");
  assert.deepEqual(gameDayHeaderModel({
    state: { minute: 43, history },
    game: { homeAway: "AWAY", ownTeam: { shortName: "DOGS" }, opponentTeam: { shortName: "EVL" } }
  }), {
    homeName: "EVL",
    awayName: "DOGS",
    homeScore: 1,
    awayScore: 2,
    minute: 43,
    period: { code: "PERIOD_3", label: "3. Drittel" },
    completed: false
  });
});

test("active contextual stickers are filtered by category and current opponent", () => {
  const stickers = [
    { id: "our-goal", active: true, audience: "OUR_TEAM", category: "GOAL" },
    { id: "our-inactive", active: false, audience: "OUR_TEAM", category: "GOAL" },
    { id: "current-against", active: true, audience: "OPPONENT", opponentTeamId: opponentId, category: "AGAINST" },
    { id: "other-against", active: true, audience: "OPPONENT", opponentTeamId: eventId, category: "AGAINST" },
    { id: "general", active: true, audience: "GENERAL", category: "GENERAL" }
  ];
  assert.deepEqual(activeGameDayStickers(stickers, { audience: "OUR_TEAM", category: "GOAL", strictCategory: true }).map(item => item.id), ["our-goal"]);
  assert.deepEqual(activeGameDayStickers(stickers, { audience: "OPPONENT", opponentTeamId: opponentId, category: "AGAINST", strictCategory: true }).map(item => item.id), ["current-against"]);
  assert.deepEqual(activeGameDayStickers(stickers, { audience: "GENERAL" }).map(item => item.id), ["general"]);
});

test("delivery request capsules keep one idempotency key across retries", () => {
  const key = "44444444-4444-4444-8444-444444444444";
  const sticker = createWhatsappStickerOnlyRequest({ eventId, stickerId, idempotencyKey: key });
  const combined = createWhatsappDeliveryRequest({
    eventId,
    stickerId,
    message: "Tor für die Mighty Dogs",
    deliveryMode: "STICKER_THEN_TEXT",
    idempotencyKey: key
  });
  assert.equal(sticker.idempotencyKey, key);
  assert.equal(sticker.payload.idempotencyKey, key);
  assert.equal(combined.idempotencyKey, key);
  assert.equal(combined.payload.idempotencyKey, key);
  assert.equal(combined.payload.deliveryMode, "STICKER_THEN_TEXT");
  assert.throws(() => createWhatsappDeliveryRequest({ eventId, deliveryMode: "STICKER_ONLY", message: "Dummy" }), /Nur-Sticker/);
  assert.throws(() => createWhatsappDeliveryRequest({ eventId, deliveryMode: "TEXT_ONLY" }), /Nur-Text/);
});

test("game-day source implements sticker-now then structured action without a second sticker", async () => {
  const [source, storage] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("js/liveticker-game-storage.js")
  ]);
  assert.match(source, /data-open="goal">TOR/);
  assert.match(source, /STICKER JETZT SENDEN/);
  assert.match(source, /model\.draft\.deliveryId/);
  assert.match(source, /livetickerWhatsappStickerNone/);
  assert.match(source, /noSticker\.checked = true/);
  assert.match(source, /document\.querySelector\("#tickerForm"\)\?\.requestSubmit\(\)/);
  assert.match(source, /model\.pendingLinks\.set\(actionId, draft\.deliveryId\)/);
  assert.match(source, /linkWhatsappStickerDelivery\(\{ jobId, actionId \}\)/);
  assert.match(storage, /pd-liveticker-server-synced/);
});

test("stand-alone stickers remain available while after-the-fact sticker controls are absent", async () => {
  const [source, migration] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("supabase/migrations/20260916064314_liveticker_whatsapp_delivery_components_dev_r1.sql")
  ]);
  assert.match(source, /createWhatsappStickerOnlyRequest/);
  assert.match(source, /linkedActionId: null/);
  assert.doesNotMatch(source, /Sticker nachträglich hinzufügen|data-add-sticker-action|openStickerGallery/);
  const enqueue = migration.match(/create function app_private\.api_liveticker_whatsapp_sticker_enqueue[\s\S]+?\n\$function\$;/i)?.[0] || "";
  const link = migration.match(/create function app_private\.api_liveticker_whatsapp_delivery_link[\s\S]+?\n\$function\$;/i)?.[0] || "";
  assert.doesNotMatch(enqueue, /insert into app_modules\.liveticker_actions/i);
  assert.doesNotMatch(link, /text_status\s*=|message\s*=|insert into app_modules\.liveticker_whatsapp_jobs/i);
});

test("closing a structured action clears the complete open-action draft", async () => {
  const source = await read("js/liveticker-game-day.js");
  const reset = source.match(/function resetOpenAction\(\) \{[\s\S]+?\n  \}/)?.[0] || "";
  const close = source.match(/function closeSheet\(\) \{[\s\S]+?\n  \}/)?.[0] || "";
  assert.match(reset, /model\.draft = null/);
  assert.match(reset, /model\.request = null/);
  assert.match(reset, /model\.currentDeliveryId = ""/);
  assert.match(reset, /model\.selectedStickerId = ""/);
  assert.match(close, /\["goal", "against", "penalty"\]\.includes\(model\.sheet\)/);
  assert.match(close, /resetOpenAction\(\)/);
  assert.match(source, /if \(!model\.draft \|\| !\["goal", "against", "penalty"\]\.includes\(model\.draft\.kind\)\) return ""/);
});

test("sticker plus text is one explicit outbox job with server-side ordering", async () => {
  const [source, migration, delivery] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("supabase/migrations/20260916064314_liveticker_whatsapp_delivery_components_dev_r1.sql"),
    read("workers/liveticker-whatsapp/delivery.mjs")
  ]);
  assert.match(source, /WHATSAPP_DELIVERY_MODES\.STICKER_THEN_TEXT/);
  assert.match(source, /createWhatsappDeliveryRequest/);
  assert.doesNotMatch(source, /sendStickerToWaha|sendTextToWaha|\/api\/sendSticker|\/api\/sendText/);
  assert.match(migration, /api_liveticker_whatsapp_delivery_enqueue/);
  assert.match(migration, /v_mode = 'STICKER_THEN_TEXT'/);
  assert.match(delivery, /await sendSticker\([\s\S]*await waitAfterSticker\([\s\S]*await sendText\(/);
});

test("component statuses and linked deliveries stay on their action", () => {
  assert.deepEqual(deliveryComponentStatus("PENDING"), { label: "WIRD GESENDET …", tone: "pending" });
  assert.deepEqual(deliveryComponentStatus("PENDING", { attemptCount: 2 }), { label: "WIRD ERNEUT VERSUCHT …", tone: "pending" });
  assert.deepEqual(deliveryComponentStatus("SENT"), { label: "GESENDET ✓", tone: "success" });
  assert.deepEqual(deliveryComponentStatus("FAILED"), { label: "FEHLGESCHLAGEN – MANUELL EINGREIFEN", tone: "error" });
  const timeline = gameDayTimeline(
    [{ id: "goal-1", type: "goal", team: "mighty", minute: 9 }],
    [{ id: "job-1", deliveryMode: "STICKER_ONLY", linkedActionId: "goal-1", createdAt: "2026-09-16T10:00:00Z", stickerStatus: "SENT", textStatus: "NOT_REQUESTED" }]
  );
  assert.equal(timeline[0].kind, "action");
  assert.equal(timeline[0].actionId, "goal-1");
  assert.equal(timeline[0].deliveries[0].id, "job-1");
  assert.equal(newActionId([], [{ id: "goal-1" }]), "goal-1");
  assert.equal(newActionId([], [{ id: "a" }, { id: "b" }]), null);
});

test("latest actions use stable history order even without timestamps", () => {
  const history = Array.from({ length: 12 }, (_, index) => ({
    id: `action-${index + 1}`,
    type: "goal",
    team: "mighty",
    minute: index + 1
  }));
  const deliveries = [
    { id: "linked", linkedActionId: "action-12", deliveryMode: "TEXT_ONLY", createdAt: "2026-09-17T18:00:00Z", textStatus: "SENT" },
    { id: "standalone", linkedActionId: null, deliveryMode: "STICKER_ONLY", createdAt: "2026-09-17T18:01:00Z", stickerStatus: "SENT" }
  ];
  const timeline = gameDayTimeline(history, deliveries);
  assert.deepEqual(timeline.slice(0, 3).map(item => item.actionId), ["action-12", "action-11", "action-10"]);
  assert.equal(timeline[0].deliveries[0].id, "linked");
  assert.equal(timeline.filter(item => item.id === "delivery:linked").length, 0);
  assert.equal(timeline.at(-1).id, "delivery:standalone");
});

test("game-day edit drafts cover goal, against and penalty without republishing", () => {
  assert.deepEqual(gameDayEditDraft({
    id: "our-goal",
    type: "goal",
    team: "mighty",
    minute: 20,
    player: { name: "Thomáš Pribyl" },
    assists: [{ name: "Assist Eins" }, { name: "Assist Zwei" }]
  }), {
    editingActionId: "our-goal",
    minute: 20,
    publishText: false,
    kind: "goal",
    scorer: "Thomáš Pribyl",
    assist1: "Assist Eins",
    assist2: "Assist Zwei"
  });
  assert.equal(gameDayEditDraft({ id: "against", type: "goal", team: "opponent", minute: 21 }).kind, "against");
  assert.deepEqual(gameDayEditDraft({
    id: "penalty",
    type: "penalty",
    minute: 22,
    penalties: [{ team: "opponent", player: { name: "Gegner" }, duration: "5", reason: "Check" }]
  }), {
    editingActionId: "penalty",
    minute: 22,
    publishText: false,
    kind: "penalty",
    team: "opponent",
    player: "Gegner",
    duration: "5",
    reason: "Check"
  });
});

test("saving an edit keeps the same action id and never creates a second entry", () => {
  const before = [{ id: "goal-1", type: "goal", minute: 20 }];
  const after = [{ id: "goal-1", type: "goal", minute: 21 }];
  assert.equal(savedGameDayActionId(before, after, "goal-1"), "goal-1");
  assert.equal(savedGameDayActionId(before, [...after, { id: "goal-2" }], "goal-1"), null);
  assert.equal(savedGameDayActionId(before, [], "goal-1"), null);
});

test("game-day edit and undo delegate to the classic engine controls", async () => {
  const [source, engine, publish] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("js/liveticker-engine-v4.js"),
    read("js/liveticker-whatsapp-publish.js")
  ]);
  assert.match(source, /classicHistoryControl\("edit", actionId\)/);
  assert.match(source, /editControl\.click\(\)/);
  assert.match(source, /classicHistoryControl\("delete", actionId\)/);
  assert.match(source, /deleteControl\.click\(\)/);
  assert.match(source, /model\.state = \{ \.\.\.readState\(\), completedAt:/);
  assert.match(source, /window\.addEventListener\("pd-liveticker-state-saved"/);
  assert.match(source, /savedGameDayActionId\(before, after\.history, draft\.editingActionId\)/);
  assert.match(source, /!draft\.editingActionId && draft\.deliveryId/);
  assert.match(source, /model\.draft\.editingActionId\s*\?\s*false/);
  assert.doesNotMatch(source, /model\.state\.history\s*=\s*model\.state\.history\.filter/);
  assert.match(engine, /state\.history\.splice\(index, 1, tickerEvent\)/);
  assert.match(engine, /window\.confirm\(`Aktion/);
  assert.match(engine, /state\.history = state\.history\.filter\(entry => entry\.id !== deleteId\)/);
  assert.match(publish, /filter\(item => item\?\.id && !previous\.has\(item\.id\)\)/);
});

test("mobile cockpit has large controls, three visual sticker groups and no obvious horizontal overflow", async () => {
  const [source, css] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("liveticker/game-day.css")
  ]);
  for (const action of ["TOR", "GEGENTOR", "STRAFE", "SONSTIGES"]) {
    assert.match(source, new RegExp(action.replace("/", "\\/")));
  }
  assert.match(source, /\["OUR_TEAM", "Unsere"\]/);
  assert.match(source, /\["OPPONENT", "Gegner"\]/);
  assert.match(source, /\["GENERAL", "Allgemein"\]/);
  assert.match(css, /min-height:82px/);
  assert.match(css, /overflow-x:hidden/);
  assert.match(css, /max-width:380px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
});

test("failed components are shown separately and unsafe all-components retry is absent", async () => {
  const source = await read("js/liveticker-game-day.js");
  assert.match(source, /componentBadge\("Sticker", delivery\.stickerStatus, delivery\)/);
  assert.match(source, /componentBadge\("Text", delivery\.textStatus, delivery\)/);
  assert.match(source, /ANFRAGE SICHER ERNEUT SENDEN/);
  assert.match(source, /data-retry-delivery/);
  assert.match(source, /retryWhatsappDelivery\(\{ eventId: game\.eventId, jobId \}\)/);
  assert.match(source, /\}, 1000\)/);
  assert.doesNotMatch(source, /ALLES (?:NOCHMAL|ERNEUT) SENDEN/i);
  assert.doesNotMatch(source, /whatsapp_(?:sticker|text)_retry/);
});

test("game-day history shows only three entries until explicitly expanded", async () => {
  const source = await read("js/liveticker-game-day.js");
  assert.match(source, /model\.historyExpanded \? timeline : timeline\.slice\(0, 3\)/);
  assert.match(source, /data-toggle-history/);
  assert.match(source, /Mehr anzeigen …/);
  assert.match(source, /Weniger anzeigen/);
  assert.match(source, /model\.historyExpanded = !model\.historyExpanded/);
});

test("flyer generator is collapsed by default and expands on demand", async () => {
  const source = await read("js/liveticker-game-day.js");
  assert.match(source, /flyersExpanded: false/);
  assert.match(source, />Flyer-Generator<\/span>/);
  assert.match(source, /data-toggle-flyers/);
  assert.match(source, /model\.flyersExpanded \? `<div class="game-day-flyer-actions">/);
  assert.doesNotMatch(source, /<h2>Flyer<\/h2>/);
});

test("game mode stays separate from the classic view and exposes only the four agreed actions", async () => {
  const [source, html, authBootstrap] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("liveticker/index.html"),
    read("js/liveticker-auth-bootstrap.js")
  ]);
  assert.match(source, /href="\.\.\/#\/liveticker"[^>]*>← Liveticker<\/a>/);
  assert.match(source, /href="\.\/"[^>]*>Klassische Ansicht<\/a>/);
  assert.match(html, />SPIELMODUS<\/a>/);
  assert.doesNotMatch(html, />PROD · INTERN</);
  assert.match(authBootstrap, /if \(app && !isGameMode\) app\.hidden = false/);
  assert.match(source, /data-open="misc">SONSTIGES/);
  assert.doesNotMatch(source, /VIDEOBEWEIS|DRITTEL \/ SPIELSTATUS|data-open="info"|data-open="video"|data-open="phase"/);
  assert.match(source, /<h2 id="gameDaySheetTitle">SONSTIGES<\/h2>/);
  assert.match(source, /Info \/ Text/);
  assert.match(source, /STICKER JETZT SENDEN/);
});

test("metadata editor uses the existing team snapshot and no second sticker administration", async () => {
  const admin = await read("js/modules/liveticker-admin.js");
  assert.match(admin, /setWhatsappStickerMetadata/);
  assert.match(admin, /snapshot\?\.teams/);
  assert.match(admin, /value="OUR_TEAM"/);
  assert.match(admin, /value="OPPONENT"/);
  assert.match(admin, /value="GENERAL"/);
  assert.doesNotMatch(admin, /value="VIDEO_REVIEW"|Videobeweis/);
  assert.match(admin, />Unsere \(Mighty Dogs\)<\/option>/);
  assert.match(admin, /data-opponent-team \$\{isOpponent \? "" : "hidden"\}/);
  assert.match(admin, /data-own-team \$\{isOurTeam \? "" : "hidden"\}/);
  assert.match(admin, /opponent\.hidden = value !== "OPPONENT"/);
  assert.match(admin, /ownTeam\.hidden = value !== "OUR_TEAM"/);
  assert.match(admin, /opponentTeamId: values\.audience === "OPPONENT" \? values\.opponentTeamId : null/);
});

test("game-day minute control reuses the native Liveticker minute state and delivery polling stays non-destructive", async () => {
  const [source, engine, css] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("js/liveticker-engine-v4.js"),
    read("liveticker/game-day.css")
  ]);
  assert.match(source, /id="gameDayCurrentMinute" class="minute-input"/);
  assert.match(source, /class="minute-button"[^>]*data-game-minute-step="-1"/);
  assert.match(source, /class="minute-button"[^>]*data-game-minute-step="1"/);
  assert.match(source, /setNativeValue\("#gameMinute", minute\)/);
  assert.match(engine, /minuteInput\.addEventListener\("change", syncContext\)/);
  assert.match(engine, /Math\.max\(1, \(selectedMinute\(\) \|\| 1\) \+ Number\.parseInt\(button\.dataset\.minuteStep, 10\)\)/);
  assert.match(source, /const changed = await refreshDeliveries\(\);\s*if \(changed\) patchDeliveryUi\(\);/);
  assert.doesNotMatch(source, /await refreshDeliveries\(\);\s*renderMain\(\);\s*\}, 3000\)/);
  assert.match(css, /\.game-day-native-minute-field\{/);
});



test("structured actions expose only their matching sticker category and penalty follows the selected team", async () => {
  const source = await read("js/liveticker-game-day.js");
  assert.match(source, /kind === "goal"[\s\S]*?audience: "OUR_TEAM", category: "GOAL"/);
  assert.match(source, /kind === "against"[\s\S]*?audience: "OPPONENT", category: "AGAINST"/);
  assert.match(source, /model\.draft\?\.team === "opponent" \? "OPPONENT" : "OUR_TEAM"[\s\S]*?category: "PENALTY"/);
  assert.match(source, /strictCategory: true/);
  assert.match(source, />Passende Sticker<\/h3>/);
  assert.doesNotMatch(source, /data-all-action-stickers|ALLE STICKER/);
  assert.match(source, /model\.selectedStickerId = "";\s*renderMain\(\);\s*}\s*}\);/);
});
test("game mode selects existing flyer contexts without enqueueing until explicit creation", async () => {
  const [source, graphics] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("js/liveticker-graphics-inline.js")
  ]);
  assert.match(source, /data-game-day-graphic="PERIOD_1">1\. DRITTEL/);
  assert.match(source, /data-game-day-graphic="PERIOD_2">2\. DRITTEL/);
  assert.match(source, /data-game-day-graphic="FINAL">SPIELENDE/);
  assert.match(source, /new CustomEvent\("pd-liveticker-graphics-open"/);
  assert.match(source, /detail: \{ kind: button\.dataset\.gameDayGraphic \}/);
  assert.doesNotMatch(source, /classicGraphicButton|period1OutputButton|period2OutputButton|finalOutputButton/);
  assert.match(source, /graphicResultPanel\.classList\.add\("game-day-graphic-results"\)/);
  assert.match(source, /document\.body\.append\(graphicResultPanel\)/);
  assert.match(graphics, /const KINDS = Object\.freeze\(\["PERIOD_1", "PERIOD_2", "FINAL"\]\)/);
  const openResults = graphics.match(/function openResults\(kind\) \{[\s\S]+?\n\}/)?.[0] || "";
  assert.match(openResults, /selectedArtifactKind = kind/);
  assert.match(openResults, /resultsOpen = true/);
  assert.doesNotMatch(openResults, /enqueue|\.click\(/);
  assert.match(graphics, /window\.addEventListener\("pd-liveticker-graphics-open"/);
  assert.match(graphics, /resultGenerateButton\?\.addEventListener\("click"[\s\S]+?BUTTONS\[kind\]\?\.click\(\)/);
  assert.match(graphics, /api\.call\("liveticker_graphics_enqueue", \{ eventId, kind \}\)/);
});
