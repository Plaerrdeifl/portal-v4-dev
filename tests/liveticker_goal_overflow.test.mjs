import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const renderer = resolve("scripts/liveticker-renderer/render_v1.py");

test("Liveticker keeps up to seven scorer lines at the template font size", () => {
  const source = String.raw`
import importlib.util, sys
import xml.etree.ElementTree as ET
spec=importlib.util.spec_from_file_location("liveticker_render_v1", sys.argv[1])
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.CURRENT_FORMAT="STORY"
root=ET.fromstring('<svg xmlns="http://www.w3.org/2000/svg"><text id="our_goals_heading">UNSERE TORE</text>'+''.join(f'<text id="our_goals_line_{i}" font-size="36px"></text>' for i in range(1,11))+'</svg>')
lines=[f"P{i}" for i in range(1,8)]
module.apply_goal_block(root,lines,"STORY")
assert module.goal_overflow_scale(7)==1.0
assert module.font_size_px(module.find(root,"our_goals_line_1"),36.0)==36.0
assert module.font_size_px(module.find(root,"our_goals_line_7"),36.0)==36.0
`;
  const result = spawnSync("python3", ["-c", source, renderer], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("Liveticker keeps scorer overflow in one column and scales it down after seven lines", () => {
  const source = String.raw`
import importlib.util, sys
import xml.etree.ElementTree as ET
spec=importlib.util.spec_from_file_location("liveticker_render_v1", sys.argv[1])
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.CURRENT_FORMAT="STORY"
root=ET.fromstring('<svg xmlns="http://www.w3.org/2000/svg"><text id="our_goals_heading">UNSERE TORE</text>'+''.join(f'<text id="our_goals_line_{i}" x="80" y="{700+i*48}" font-size="36px"></text>' for i in range(1,11))+'</svg>')
lines=[f"P{i}" for i in range(1,10)]
module.apply_goal_block(root,lines,"STORY")
assert module.MAX_GOAL_LINES==10
assert module.STANDARD_GOAL_LINES==7
assert module.goal_overflow_scale(8)<1.0
assert module.goal_overflow_scale(9)<module.goal_overflow_scale(8)
assert module.goal_overflow_scale(10)>=module.GOAL_OVERFLOW_MIN_SCALE
for i in range(1,10):
    element=module.find(root,f"our_goals_line_{i}")
    assert float(element.get("x"))==80.0
    assert module.font_size_px(element,36.0)<36.0
assert module.find(root,"our_goals_line_10").text in (None,"")
`;
  const result = spawnSync("python3", ["-c", source, renderer], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("Liveticker no longer truncates scorer lists at seven entries", () => {
  const source = String.raw`
import importlib.util, sys
spec=importlib.util.spec_from_file_location("liveticker_render_v1", sys.argv[1])
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
history=[]
for i in range(9):
    history.append({
        "type":"goal",
        "team":"mighty",
        "minute":i+1,
        "player":{"id":str(i),"number":str(10+i),"name":f"Player {i}"}
    })
lines=module.goal_lines(history,"PERIOD_1")
assert len(lines)==9, lines
assert lines[0].startswith("#10 ")
assert lines[-1].startswith("#18 ")
`;
  const result = spawnSync("python3", ["-c", source, renderer], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
