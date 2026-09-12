import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const read = path => readFileSync(resolve(path), "utf8");

test("Liveticker admin can permanently delete a player with revision protection", () => {
  const admin = read("js/modules/liveticker-admin.js");
  const migration = read("supabase/migrations/20260912023000_liveticker_player_delete_r1.sql");
  assert.match(admin, /confirmAction/);
  assert.match(admin, /data-delete-player/);
  assert.match(admin, /call\("liveticker_player_delete",\{id:player\.id,expectedRevision:player\.revision\}\)/);
  assert.match(migration, /api_liveticker_player_delete/);
  assert.match(migration, /from app_modules\.liveticker_players[\s\S]*for update/);
  assert.match(migration, /v_expected<>v_old\.revision/);
  assert.match(migration, /delete from app_modules\.liveticker_players where id=v_id/);
  assert.match(migration, /when 'liveticker_player_delete' then 'USER_MUTATION'/);
});

test("Liveticker flyer hides the Unsere Tore block when there are no Dogs goal lines", () => {
  const renderer = resolve("scripts/liveticker-renderer/render_v1.py");
  const source = String.raw`
import importlib.util, sys
import xml.etree.ElementTree as ET
spec=importlib.util.spec_from_file_location("liveticker_render_v1", sys.argv[1])
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
root=ET.fromstring('<svg xmlns="http://www.w3.org/2000/svg"><text id="our_goals_heading" y="100">UNSERE TORE</text>'+''.join(f'<text id="our_goals_line_{i}" y="{100+i*50}">ALT</text>' for i in range(1,11))+'</svg>')
module.apply_goal_block(root,[],"STORY")
heading=module.find(root,"our_goals_heading")
assert (heading.text or '') == ''
assert float(heading.get('y')) == 100.0
assert (module.find(root,"our_goals_line_1").text or '') == ''
root2=ET.fromstring('<svg xmlns="http://www.w3.org/2000/svg"><text id="our_goals_heading" y="100"></text>'+''.join(f'<text id="our_goals_line_{i}" y="{100+i*50}"></text>' for i in range(1,11))+'</svg>')
module.apply_goal_block(root2,["#84 MUSTERMANN | 12'."],"POST")
assert module.find(root2,"our_goals_heading").text == 'UNSERE TORE'
assert module.find(root2,"our_goals_line_1").text == "#84 MUSTERMANN | 12'."
`;
  const result = spawnSync("python3", ["-c", source, renderer], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
