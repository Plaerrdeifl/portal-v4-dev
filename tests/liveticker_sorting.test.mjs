import assert from "node:assert/strict";
import test from "node:test";
import { formatFinalSummary, formatSegmentSummary, historyByMinute } from "../js/liveticker-engine-v4.js";

const opponent = { shortName: "Erfurt" };
const player = (number, name) => ({ number, name });

test("summary output re-sorts corrected goals by minute", () => {
  const history = [
    { id: "g12", type: "goal", team: "mighty", minute: 12, player: player("91", "Georg Pinsack"), assists: [] },
    { id: "g15", type: "goal", team: "mighty", minute: 15, player: player("19", "Kristers Donins"), assists: [] },
    { id: "g19", type: "goal", team: "mighty", minute: 19, player: player("69", "Lukas Krumpe"), assists: [] },
    { id: "g06", type: "goal", team: "mighty", minute: 6, player: player("2", "Lucas Kleider"), assists: [] }
  ];

  assert.deepEqual(historyByMinute(history).map(event => event.minute), [6, 12, 15, 19]);
  const output = formatSegmentSummary(history, "P1", opponent);
  const positions = ["6 Spielminute", "12 Spielminute", "15 Spielminute", "19 Spielminute"].map(value => output.indexOf(value));
  assert.ok(positions.every(position => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test("final WhatsApp summary sorts goals and penalties after edits", () => {
  const history = [
    { id: "p17", type: "penalty", minute: 17, penalties: [{ team: "mighty", player: player("19", "Kristers Donins"), duration: "2", reason: "Haken" }] },
    { id: "g18", type: "goal", team: "mighty", minute: 18, player: player("91", "Georg Pinsack"), assists: [] },
    { id: "p05", type: "penalty", minute: 5, penalties: [{ team: "mighty", player: player("2", "Lucas Kleider"), duration: "2", reason: "Halten" }] },
    { id: "g04", type: "goal", team: "mighty", minute: 4, player: player("2", "Lucas Kleider"), assists: [] }
  ];

  const output = formatFinalSummary(history, opponent);
  assert.ok(output.indexOf("4 Spielminute") < output.indexOf("18 Spielminute"));
  assert.ok(output.indexOf("5 Spielminute") < output.indexOf("17 Spielminute"));
});
