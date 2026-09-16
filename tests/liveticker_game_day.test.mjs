import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  activeGameDayStickers,
  deliveryComponentStatus,
  gameDayHeaderModel,
  gameDayTimeline,
  newActionId,
  periodFromMinute,
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

test("Spieltagsmodus is an additive route and leaves the normal Liveticker reachable", async () => {
  const [html, bootstrap, admin] = await Promise.all([
    read("liveticker/index.html"),
    read("js/liveticker-bootstrap.js"),
    read("js/modules/liveticker-admin.js")
  ]);
  assert.match(html, /href="\?mode=game-day"[^>]*>Spieltagsmodus/);
  assert.match(html, /id="tickerApp"/);
  assert.match(html, /id="gameDayRoot" hidden/);
  assert.match(bootstrap, /import\("\.\/liveticker-game-day\.js\?v=/);
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

test("stand-alone and after-the-fact stickers never create or republish Liveticker actions", async () => {
  const [source, migration] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("supabase/migrations/20260916064314_liveticker_whatsapp_delivery_components_dev_r1.sql")
  ]);
  assert.match(source, /createWhatsappStickerOnlyRequest/);
  assert.match(source, /linkedActionId: linkedActionId \|\| null/);
  const enqueue = migration.match(/create function app_private\.api_liveticker_whatsapp_sticker_enqueue[\s\S]+?\n\$function\$;/i)?.[0] || "";
  const link = migration.match(/create function app_private\.api_liveticker_whatsapp_delivery_link[\s\S]+?\n\$function\$;/i)?.[0] || "";
  assert.doesNotMatch(enqueue, /insert into app_modules\.liveticker_actions/i);
  assert.doesNotMatch(link, /text_status\s*=|message\s*=|insert into app_modules\.liveticker_whatsapp_jobs/i);
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

test("component statuses and combined timeline remain separate", () => {
  assert.deepEqual(deliveryComponentStatus("SENT"), { label: "gesendet", tone: "success" });
  assert.deepEqual(deliveryComponentStatus("FAILED"), { label: "fehlgeschlagen", tone: "error" });
  const timeline = gameDayTimeline(
    [{ id: "goal-1", type: "goal", team: "mighty", minute: 9, createdAt: 10 }],
    [{ id: "job-1", deliveryMode: "STICKER_ONLY", linkedActionId: "goal-1", createdAt: "2026-09-16T10:00:00Z", stickerStatus: "SENT", textStatus: "NOT_REQUESTED" }]
  );
  assert.equal(timeline[0].kind, "delivery");
  assert.equal(timeline[0].actionId, "goal-1");
  assert.equal(newActionId([], [{ id: "goal-1" }]), "goal-1");
  assert.equal(newActionId([], [{ id: "a" }, { id: "b" }]), null);
});

test("mobile cockpit has large controls, three visual sticker groups and no obvious horizontal overflow", async () => {
  const [source, css] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("liveticker/game-day.css")
  ]);
  for (const action of ["TOR", "GEGENTOR", "STRAFE", "INFO", "STICKER", "VIDEOBEWEIS", "DRITTEL / SPIELSTATUS"]) {
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
  assert.match(source, /componentBadge\("Sticker", delivery\.stickerStatus\)/);
  assert.match(source, /componentBadge\("Text", delivery\.textStatus\)/);
  assert.match(source, /ANFRAGE SICHER ERNEUT SENDEN/);
  assert.doesNotMatch(source, /ALLES (?:NOCHMAL|ERNEUT) SENDEN/i);
  assert.doesNotMatch(source, /whatsapp_(?:sticker|text)_retry/);
});

test("metadata editor uses the existing team snapshot and no second sticker administration", async () => {
  const admin = await read("js/modules/liveticker-admin.js");
  assert.match(admin, /setWhatsappStickerMetadata/);
  assert.match(admin, /snapshot\?\.teams/);
  assert.match(admin, /value="OUR_TEAM"/);
  assert.match(admin, /value="OPPONENT"/);
  assert.match(admin, /value="GENERAL"/);
  assert.match(admin, /value="VIDEO_REVIEW"/);
});

test("game-day minute control reuses the native Liveticker minute state and delivery polling stays non-destructive", async () => {
  const [source, engine, css] = await Promise.all([
    read("js/liveticker-game-day.js"),
    read("js/liveticker-engine-v4.js"),
    read("liveticker/game-day.css")
  ]);
  assert.match(source, /id="gameDayCurrentMinute"/);
  assert.match(source, /data-game-minute-step="-1"/);
  assert.match(source, /data-game-minute-step="1"/);
  assert.match(source, /setNativeValue\("#gameMinute", minute\)/);
  assert.match(engine, /minuteInput\.addEventListener\("change", syncContext\)/);
  assert.match(engine, /Math\.max\(1, \(selectedMinute\(\) \|\| 1\) \+ Number\.parseInt\(button\.dataset\.minuteStep, 10\)\)/);
  assert.match(source, /const changed = await refreshDeliveries\(\);\s*if \(changed\) patchDeliveryUi\(\);/);
  assert.doesNotMatch(source, /await refreshDeliveries\(\);\s*renderMain\(\);\s*\}, 3000\)/);
  assert.match(css, /\.game-day-minute-control\{/);
  assert.match(css, /\.game-day-minute-button\{/);
  assert.match(css, /\.game-day-minute-input\{/);
});
