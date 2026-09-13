import assert from "node:assert/strict";
import test from "node:test";
import {
  attachWhatsappPublishIntent,
  changedWhatsappActionIds
} from "../js/liveticker-whatsapp-publish.js";

test("existing action updates do not hide one newly added WhatsApp action", () => {
  const previous = [
    { id: "goal-1", type: "goal", minute: 10, scoreAfter: "1:0" }
  ];
  const state = {
    history: [
      { id: "goal-1", type: "goal", minute: 10, scoreAfter: "1:1" },
      { id: "penalty-1", type: "penalty", minute: 11, penalties: [] }
    ]
  };

  assert.deepEqual(changedWhatsappActionIds(previous, state.history), ["penalty-1"]);
  const result = attachWhatsappPublishIntent({
    previousHistory: previous,
    state,
    text: "Strafe",
    enabled: true
  });

  assert.equal(result.attached, true);
  assert.deepEqual(result.changedIds, ["penalty-1"]);
  assert.equal(state.history[0]._whatsapp, undefined);
  assert.deepEqual(state.history[1]._whatsapp, { publish: true, text: "Strafe" });
});

test("editing an existing action alone never creates a WhatsApp publish intent", () => {
  const previous = [{ id: "goal-1", type: "goal", minute: 10 }];
  const state = { history: [{ id: "goal-1", type: "goal", minute: 11 }] };

  assert.deepEqual(changedWhatsappActionIds(previous, state.history), []);
  const result = attachWhatsappPublishIntent({
    previousHistory: previous,
    state,
    text: "Korrektur",
    enabled: true
  });

  assert.equal(result.attached, false);
  assert.equal(result.reason, "ambiguous");
  assert.equal(state.history[0]._whatsapp, undefined);
});
