import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const read = path => readFile(join(root, path), "utf8");

test("dates navigation hands off to the canonical standalone Events app", async () => {
  const router = await read("js/router.js");
  const app = await read("js/app.js");
  const auth = await read("js/auth.js");

  assert.match(
    router,
    /dates:\s*\{[\s\S]*?title:\s*"Termine"[\s\S]*?externalPath:\s*"\/events\/"[\s\S]*?icon:\s*"📅"/
  );
  assert.doesNotMatch(router, /dates:\s*\{[\s\S]*?page:\s*"dates\.html"/);
  assert.match(router, /fixedAuthenticatedOrder\(\)[\s\S]*?"dashboard",\s*"dates",/);
  assert.match(auth, /\["dashboard",\s*"dates"\]\.includes\(key\)/);
  assert.match(app, /new URL\(route\.externalPath, window\.location\.origin\)/);
  assert.match(app, /for \(const \[name, value\] of routeParams\(\)\)/);
  assert.match(app, /target\.searchParams\.append\(name, value\)/);
  assert.match(app, /window\.location\.assign\(target\.pathname \+ target\.search \+ target\.hash\)/);
});

test("legacy portal Events frontend is removed after the verified DEV cutover", async () => {
  await assert.rejects(access(join(root, "js/modules/dates.js")));
  await assert.rejects(access(join(root, "pages/dates.html")));

  const pages = await read("js/pages.js");
  const push = await read("js/task-push-r3.js");

  assert.doesNotMatch(pages, /modules\/dates\.js|hydrateDates/);
  assert.doesNotMatch(push, /m210DatesList/);
});

test("the deployed Events artifact remains traceable to the Events repository", async () => {
  const metadata = JSON.parse(await read("events/.pd-deployment.json"));
  assert.equal(metadata.sourceRepository, "Plaerrdeifl/events");
  assert.match(metadata.sourceCommit, /^[0-9a-f]{40}$/);
  assert.equal(metadata.sourceBuildArtifact, "events-dist");
  assert.match(metadata.sourceBuildSha256, /^[0-9a-f]{64}$/);
});
