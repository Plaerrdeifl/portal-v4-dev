import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

test("Liveticker exposes only the classic operator surface", async () => {
  const [html, auth, bootstrap, admin] = await Promise.all([
    read("liveticker/index.html"),
    read("js/liveticker-auth-bootstrap.js"),
    read("js/liveticker-bootstrap.js"),
    read("js/modules/liveticker-admin.js")
  ]);
  assert.doesNotMatch(html, /mode=game-day|SPIELMODUS|gameDayRoot|game-day\.css/i);
  assert.doesNotMatch(auth, /isGameMode|mode.*game-day|game-day/i);
  assert.doesNotMatch(bootstrap, /liveticker-game-day/i);
  assert.doesNotMatch(admin, /mode=game-day|Spielmodus|Klassische Ansicht/i);
  assert.match(admin, /href="\.\/liveticker\/"[^>]*>Liveticker ↗<\/a>/);
});

test("dedicated game-day implementation files are removed", async () => {
  for (const relative of [
    "js/liveticker-game-day.js",
    "js/liveticker-game-day-core.js",
    "liveticker/game-day.css",
    "tests/liveticker_game_day.test.mjs"
  ]) {
    await assert.rejects(fs.access(path.join(root, relative)));
  }
});
