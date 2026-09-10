import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const renderer = readFileSync("scripts/liveticker-renderer/render_v1.py", "utf8");
const migration = readFileSync("supabase/migrations/20260910112500_liveticker_unified_graphic_templates_r1.sql", "utf8");

const templateFiles = [
  ["assets/liveticker/templates/LT_post.svg", "0 0 1254 1254"],
  ["assets/liveticker/templates/LT_story.svg", "0 0 941 1672"]
];
const requiredIds = [
  "background_image", "headline", "period_label", "result_suffix",
  "logo_home", "logo_away", "home_score", "away_score", "our_goals_heading",
  ...Array.from({ length: 10 }, (_, index) => `our_goals_line_${index + 1}`)
];

test("supplied Liveticker POST and STORY SVGs satisfy the unified runtime contract", () => {
  for (const [path, viewBox] of templateFiles) {
    const svg = readFileSync(path, "utf8");
    assert.ok(statSync(path).size < 1024 * 1024);
    assert.match(svg, new RegExp(`viewBox=["']${viewBox}["']`));
    assert.match(svg, /data:image\/jpeg;base64,/);
    assert.doesNotMatch(svg, /<script\b/i);
    assert.doesNotMatch(svg, /javascript\s*:/i);
    for (const id of requiredIds) assert.match(svg, new RegExp(`id=["']${id}["']`), `${path} is missing ${id}`);
  }
});

test("renderer uses the same template shape for periods and final", () => {
  assert.match(renderer, /set_text\(root,'period_label','' if kind=='FINAL'/);
  assert.match(renderer, /set_text\(root,'result_suffix',suffix if kind=='FINAL' else ''\)/);
  assert.doesNotMatch(renderer, /set_text\(root,'subheadline'/);
  assert.doesNotMatch(renderer, /set_text\(root,'series_info'/);
  assert.match(renderer, /range\(1,11\)/);
  assert.match(renderer, />1048576/);
  assert.match(renderer, /startswith\('data:image\/'\)/);
  assert.match(renderer, /tspans=\[child for child in list\(e\)/);
});

test("database attaches one POST and one STORY template to every graphic kind", () => {
  assert.match(migration, /where t\.template_key in \('PERIOD_POST','PERIOD_STORY'\)/);
  assert.match(migration, /select \* into v_post from app_modules\.liveticker_graphic_templates where template_key='PERIOD_POST'/);
  assert.match(migration, /select \* into v_story from app_modules\.liveticker_graphic_templates where template_key='PERIOD_STORY'/);
  assert.doesNotMatch(migration, /if new\.graphic_kind='FINAL'/);
  for (const id of requiredIds) assert.match(migration, new RegExp(id));
});
