import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

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


test("DEV worker uses its isolated renderer path", () => {
  const source = readFileSync(resolve("workers/liveticker-publishing/publishing_worker_dev.py"), "utf8");
  assert.match(source, /DEV_RENDERER = DEV_ROOT \/ 'worker' \/ 'render_v1\.py'/);
  assert.match(source, /base\.RENDERER = DEV_RENDERER/);
});


test("Liveticker renderer centers both logos on the SVG template anchors at one fixed height", () => {
  const renderer = resolve("scripts/liveticker-renderer/render_v1.py");
  const source = String.raw`
import importlib.util, sys, tempfile
from pathlib import Path
import xml.etree.ElementTree as ET
spec=importlib.util.spec_from_file_location("liveticker_render_v1", sys.argv[1])
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.CURRENT_FORMAT="POST"
module.png_dims=lambda path:(300,150)
module.data_uri=lambda path:"data:image/png;base64,AA=="

def check(group_id, transform, x, y, width, height, expected_cx, expected_cy):
    root=ET.fromstring(f'<svg xmlns="http://www.w3.org/2000/svg"><g id="{group_id}" transform="{transform}"><image x="{x}" y="{y}" width="{width}" height="{height}" /></g></svg>')
    with tempfile.NamedTemporaryFile(suffix=".png") as handle:
        module.inject_logo(root,group_id,Path(handle.name))
    group=module.find(root,group_id)
    assert group.get("transform") is None
    image=list(group)[0]
    assert abs(float(image.get("height"))-200.0)<0.000001
    assert abs(float(image.get("width"))-400.0)<0.000001
    cx=float(image.get("x"))+float(image.get("width"))/2
    cy=float(image.get("y"))+float(image.get("height"))/2
    assert abs(cx-expected_cx)<0.00001,(cx,expected_cx)
    assert abs(cy-expected_cy)<0.00001,(cy,expected_cy)

check("logo_home","translate(-90,-51.43866)",167.25464,369.43866,231.48149,200,192.995385,418.0)
check("logo_away","matrix(1.8518519,0,0,1.8518519,-871.35819,-325.85931)",990.82343,347.68402,125,108,1079.24080516,418.00000564)
`;
  const result = spawnSync("python3", ["-c", source, renderer], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});


test("Liveticker renderer normalizes logo assets before rendering POST and STORY", () => {
  const source = readFileSync(resolve("scripts/liveticker-renderer/render_v1.py"), "utf8");
  const trimmer = readFileSync(resolve("scripts/liveticker-renderer/trim_logo.py"), "utf8");
  assert.match(source, /LOGO_HEIGHT=\{'POST':200\.0,'STORY':200\.0\}/);
  assert.match(source, /normalize_logo_assets\(state,out\)/);
  assert.match(source, /LOGO_TRIMMER/);
  assert.match(trimmer, /get_has_alpha\(\)/);
  assert.match(trimmer, /new_subpixbuf/);
});


test("Liveticker renderer vertically centers the visible goal block in the template goal area", () => {
  const renderer = resolve("scripts/liveticker-renderer/render_v1.py");
  const source = String.raw`
import importlib.util, sys
import xml.etree.ElementTree as ET
spec=importlib.util.spec_from_file_location("liveticker_render_v1", sys.argv[1])
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
root=ET.fromstring('<svg xmlns="http://www.w3.org/2000/svg"><text id="our_goals_heading" y="100">UNSERE TORE</text><text id="our_goals_line_1" y="150">A</text><text id="our_goals_line_2" y="200">B</text><text id="our_goals_line_3" y="250"></text><text id="our_goals_line_4" y="300"></text><text id="our_goals_line_5" y="350"></text><text id="our_goals_line_6" y="400"></text><text id="our_goals_line_7" y="450"></text><text id="our_goals_line_8" y="500"></text><text id="our_goals_line_9" y="550"></text><text id="our_goals_line_10" y="600"></text></svg>')
module.center_goal_block(root,["A","B"])
heading=float(module.find(root,"our_goals_heading").get("y"))
line1=float(module.find(root,"our_goals_line_1").get("y"))
line2=float(module.find(root,"our_goals_line_2").get("y"))
assert abs(((heading+line2)/2)-350.0)<0.000001,(heading,line2)
assert abs((line1-heading)-50.0)<0.000001
assert abs((line2-line1)-50.0)<0.000001
root2=ET.fromstring('<svg xmlns="http://www.w3.org/2000/svg"><text id="our_goals_heading" y="100">UNSERE TORE</text>'+''.join(f'<text id="our_goals_line_{i}" y="{100+i*50}"></text>' for i in range(1,11))+'</svg>')
module.center_goal_block(root2,[])
assert abs(float(module.find(root2,"our_goals_heading").get("y"))-350.0)<0.000001
`;
  const result = spawnSync("python3", ["-c", source, renderer], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
