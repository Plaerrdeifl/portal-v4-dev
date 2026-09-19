import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
import { canonicalServerActionFingerprint, formatSegmentSummary, homeAwayScore } from "../js/liveticker-engine-v4.js";
import {
  renderLivetickerTemplate,
  validateLivetickerTemplate
} from "../js/liveticker-output-templates.js";
import {
  whatsappStickerActionContext,
  whatsappStickerActionMatches
} from "../js/liveticker-whatsapp-sticker-core.js";
import { settleSentStickerState } from "../js/liveticker-whatsapp-publish.js";

test("score is always rendered home : away independent of Mighty Dogs venue", () => {
  assert.deepEqual(
    homeAwayScore({ mighty: 1, opponent: 0 }, "HOME"),
    { home: 1, away: 0 }
  );
  assert.deepEqual(
    homeAwayScore({ mighty: 1, opponent: 0 }, "AWAY"),
    { home: 0, away: 1 }
  );
  assert.deepEqual(
    homeAwayScore({ mighty: 2, opponent: 3 }, "AWAY"),
    { home: 3, away: 2 }
  );
});

test("period summaries list goals cumulatively like the flyer", () => {
  const history = [
    {
      id: "g1",
      type: "goal",
      team: "mighty",
      minute: 3,
      player: { id: "p1", name: "Kevin Heckenberger", number: "10", position: "Sturm" },
      assists: [],
      style: "classic"
    },
    {
      id: "g2",
      type: "goal",
      team: "opponent",
      minute: 25,
      player: { id: "p2", name: "Luca Schneider", number: "21", position: "Sturm" },
      assists: [],
      style: "classic"
    },
    {
      id: "g3",
      type: "goal",
      team: "mighty",
      minute: 45,
      player: { id: "p3", name: "Tomas Cermak", number: "41", position: "Sturm" },
      assists: [],
      style: "classic"
    }
  ];
  const opponent = { shortName: "Chemnitz" };

  const p1 = formatSegmentSummary(history, "P1", opponent);
  assert.match(p1, /3 Spielminute/);
  assert.doesNotMatch(p1, /25 Spielminute/);
  assert.doesNotMatch(p1, /45 Spielminute/);

  const p2 = formatSegmentSummary(history, "P2", opponent);
  assert.match(p2, /3 Spielminute/);
  assert.match(p2, /25 Spielminute/);
  assert.doesNotMatch(p2, /45 Spielminute/);
  assert.match(p2, /\*Ende 2\. Drittel – 1:1\*/);

  const p3 = formatSegmentSummary(history, "P3", opponent);
  assert.match(p3, /3 Spielminute/);
  assert.match(p3, /25 Spielminute/);
  assert.match(p3, /45 Spielminute/);
  assert.match(p3, /\*Ende 3\. Drittel – 2:1\*/);
});

test("canonical score placeholder is valid while legacy team score placeholders remain compatible", () => {
  const own = "Spielminute {{minute}}\nNeuer Spielstand: {{score}}";
  const opponent = "Spielminute {{minute}}\nTor {{opponent_name}}\nNeuer Spielstand: {{score}}";
  const legacy = "Spielminute {{minute}}\n{{mighty_score}} : {{opponent_score}}";

  assert.equal(validateLivetickerTemplate(own, "own").valid, true);
  assert.equal(validateLivetickerTemplate(opponent, "opponent").valid, true);
  assert.equal(validateLivetickerTemplate(legacy, "own").valid, true);
  assert.equal(
    renderLivetickerTemplate(own, { minute: 23, score: "0 : 1" }),
    "Spielminute 23\nNeuer Spielstand: 0 : 1"
  );
});

test("server acknowledgement fingerprint ignores object key order and transient WhatsApp metadata", () => {
  const local = {
    id: "c56efdce-fec4-4524-8a49-33f2847a0e55",
    type: "goal",
    team: "mighty",
    minute: 3,
    player: { id: "p1", name: "Kevin Heckenberger", number: "10", position: "Sturm" },
    assists: [],
    style: "emotional",
    _whatsapp: { publish: true, text: "ignored" }
  };
  const server = {
    id: "c56efdce-fec4-4524-8a49-33f2847a0e55",
    team: "mighty",
    type: "goal",
    style: "emotional",
    minute: 3,
    player: { position: "Sturm", number: "10", name: "Kevin Heckenberger", id: "p1" },
    assists: []
  };

  assert.equal(
    canonicalServerActionFingerprint(local),
    canonicalServerActionFingerprint(server)
  );
});

test("action sticker context matches only the intended saved action", () => {
  const ownGoal = whatsappStickerActionContext({ action: "GOAL_MIGHTY" });
  const opponentGoal = whatsappStickerActionContext({ action: "GOAL_OPPONENT" });
  const ownPenalty = whatsappStickerActionContext({ action: "PENALTY", penaltyTeams: ["mighty"] });

  assert.equal(whatsappStickerActionMatches(ownGoal, { type: "goal", team: "mighty" }), true);
  assert.equal(whatsappStickerActionMatches(ownGoal, { type: "goal", team: "opponent" }), false);
  assert.equal(whatsappStickerActionMatches(opponentGoal, { type: "goal", team: "opponent" }), true);
  assert.equal(
    whatsappStickerActionMatches(ownPenalty, {
      type: "penalty",
      penalties: [{ team: "mighty" }, { team: "mighty" }]
    }),
    true
  );
  assert.equal(
    whatsappStickerActionMatches(ownPenalty, {
      type: "penalty",
      penalties: [{ team: "mighty" }, { team: "opponent" }]
    }),
    false
  );
});

test("sent action sticker keeps the exact draft id and action context for later linking", () => {
  const expectedActionId = "11111111-1111-4111-8111-111111111111";
  const context = whatsappStickerActionContext({ action: "GOAL_MIGHTY" });
  const state = {
    selectedStickerId: "22222222-2222-4222-8222-222222222222",
    sourceAction: "GOAL_MIGHTY",
    expectedActionId,
    expectedActionContext: context,
    request: { id: "request-1" },
    deliveryId: "job-1",
    linkedActionId: "",
    requestError: "",
    busy: false,
    successMessage: "",
    sentStatusAcknowledged: false,
    sentStatusHidden: false,
    pendingActionDeliveryIds: [],
    pendingActionTargets: {}
  };

  assert.equal(
    settleSentStickerState(state, { id: "job-1", stickerStatus: "SENT" }),
    "ACTION_RELEASED"
  );
  assert.deepEqual(state.pendingActionDeliveryIds, ["job-1"]);
  assert.deepEqual(state.pendingActionTargets["job-1"], {
    actionId: expectedActionId,
    context
  });
});


test("leaving a saved penalty draft allocates a fresh id for the next action", async () => {
  const source = await readFile(resolve(root, "js/liveticker-engine-v4.js"), "utf8");
  assert.match(
    source,
    /function cancelEdit\(\) \{[\s\S]*editingId = null;[\s\S]*preservedPenaltyDraftId = null;[\s\S]*previewDraftId = uid\(\);/
  );
  assert.match(
    source,
    /preservedPenaltyDraftId && selectedAction\(\) !== "PENALTY"\) cancelEdit\(\)/
  );
});

test("save button stays locked until the exact action is acknowledged by the server", async () => {
  const source = await readFile(resolve(root, "js/liveticker-engine-v4.js"), "utf8");
  assert.match(source, /setPendingServerSave\(tickerEvent\);[\s\S]*completeTickerSubmitLifecycle/);
  assert.match(source, /if \(pendingServerActionId\)[\s\S]*Speichern läuft bereits/);
  assert.match(source, /serverActionFingerprint\(saved\) !== pendingServerActionFingerprint/);
  assert.match(source, /pd-liveticker-server-synced[\s\S]*confirmPendingServerSave/);
  assert.match(source, /pd-liveticker-server-sync-error[\s\S]*failPendingServerSave/);
  assert.match(source, /pd-liveticker-sync-circuit-open[\s\S]*failPendingServerSave/);
});
