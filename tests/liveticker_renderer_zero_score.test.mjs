import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

test("Liveticker renderer preserves numeric zero score text", () => {
  const renderer = resolve("scripts/liveticker-renderer/render_v1.py");
  const source = `
import importlib.util, sys
import xml.etree.ElementTree as ET
spec=importlib.util.spec_from_file_location("liveticker_render_v1", sys.argv[1])
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
root=ET.fromstring('<svg xmlns="http://www.w3.org/2000/svg"><text id="home_score">x</text><text id="away_score">x</text></svg>')
module.set_text(root, "home_score", 0)
module.set_text(root, "away_score", 0)
assert module.find(root, "home_score").text == "0"
assert module.find(root, "away_score").text == "0"
`;
  const result = spawnSync("python3", ["-c", source, renderer], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
