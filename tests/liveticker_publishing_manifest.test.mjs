import assert from "node:assert/strict";
import test from "node:test";

import {
  validManifest,
  validNextcloudManifestPath
} from "../supabase/functions/liveticker-publishing-worker/manifest.ts";

const artifact = (kind, path) => ({
  kind,
  filename: `${kind.toLowerCase()}.png`,
  nextcloudPath: path,
  sha256: "a".repeat(64),
  bytes: 1024,
  shareUrl: `https://cloud.plaerrdeifl.de/s/${kind}abc1234`,
  downloadUrl: `https://cloud.plaerrdeifl.de/s/${kind}abc1234/download`
});

const manifest = paths => ({
  schemaVersion: 1,
  graphicKind: "FINAL",
  artifacts: [
    artifact("POST", paths[0]),
    artifact("STORY", paths[1])
  ]
});

test("publishing manifest accepts only the current isolated Publishing root", () => {
  assert.equal(validNextcloudManifestPath("/Publishing/2026-09-12_Erfurt/Endstand_POST.png"), true);

  for (const path of [
    "/Liveticker/_DEV/Endstand_POST.png",
    "/Publishing",
    "/Publishing-Evil/Endstand_POST.png",
    "/Publishing/../secret.png",
    "/Publishing/game\\secret.png",
    "/Publishing/game/file.png?download=1",
    "/Publishing/game/file.png#fragment",
    "https://cloud.plaerrdeifl.de/Publishing/file.png"
  ]) {
    assert.equal(validNextcloudManifestPath(path), false, path);
  }
});

test("publishing manifest preserves all artifact integrity checks", () => {
  const valid = manifest([
    "/Publishing/2026-09-12_Erfurt/Endstand_POST.png",
    "/Publishing/2026-09-12_Erfurt/Endstand_STORY.png"
  ]);
  assert.equal(validManifest(valid), true);

  assert.equal(validManifest({ ...valid, artifacts: [valid.artifacts[0], valid.artifacts[0]] }), false);
  assert.equal(validManifest({
    ...valid,
    artifacts: [{ ...valid.artifacts[0], sha256: "invalid" }, valid.artifacts[1]]
  }), false);
  assert.equal(validManifest({
    ...valid,
    artifacts: [{ ...valid.artifacts[0], downloadUrl: "https://example.invalid" }, valid.artifacts[1]]
  }), false);
});
