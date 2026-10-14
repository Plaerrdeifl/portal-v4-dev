import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const worker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
const activeCache = "pd-portal-v4-fanbus-scope-exclusion-r1-20261014-shell";

function loadWorker() {
  const handlers = new Map();
  const deletedCaches = [];
  const cacheOpens = [];
  let clientsClaimed = 0;

  const cache = {
    addAll: async () => undefined,
    match: async () => undefined,
    put: async () => undefined
  };
  const context = {
    URL,
    URLSearchParams,
    Response,
    Set,
    Promise,
    console,
    fetch: async () => new Response("network"),
    caches: {
      open: async name => {
        cacheOpens.push(name);
        return cache;
      },
      keys: async () => [
        "pd-portal-v4-previous-shell",
        activeCache,
        "pd-fanbus-shell-v1",
        "unrelated-cache"
      ],
      delete: async name => {
        deletedCaches.push(name);
        return true;
      },
      match: async () => undefined
    },
    self: {
      location: { origin: "https://dev.plaerrdeifl.de" },
      clients: {
        claim: async () => {
          clientsClaimed += 1;
        }
      },
      addEventListener: (type, handler) => handlers.set(type, handler),
      skipWaiting: () => undefined
    }
  };

  runInNewContext(worker, context);
  return { cacheOpens, clientsClaimed: () => clientsClaimed, deletedCaches, handlers };
}

test("Portal worker leaves /fanbus and the complete Fanbus subtree untouched", () => {
  const fanbusGuard = worker.indexOf('url.pathname === "/fanbus"');
  const oauthGuard = worker.indexOf('url.pathname.startsWith("/oauth/")');
  const navigationHandler = worker.indexOf('if (request.mode === "navigate")');

  assert.notEqual(fanbusGuard, -1);
  assert.ok(fanbusGuard < oauthGuard);
  assert.ok(fanbusGuard < navigationHandler);

  const { cacheOpens, handlers } = loadWorker();
  const fetchHandler = handlers.get("fetch");
  assert.equal(typeof fetchHandler, "function");

  for (const path of [
    "/fanbus",
    "/fanbus/",
    "/fanbus/?from=portal",
    "/fanbus/runtime-config.js",
    "/fanbus/assets/app.js"
  ]) {
    let response;
    fetchHandler({
      request: {
        url: `https://dev.plaerrdeifl.de${path}`,
        method: "GET",
        mode: path.includes("assets") ? "cors" : "navigate",
        destination: path.includes("assets") ? "script" : "document"
      },
      respondWith: value => {
        response = value;
      }
    });
    assert.equal(response, undefined, `${path} must bypass the Portal worker`);
  }

  assert.deepEqual(cacheOpens, []);
});

test("Fanbus exclusion is path-precise and keeps Portal navigation handling", () => {
  const { handlers } = loadWorker();
  const fetchHandler = handlers.get("fetch");
  let response;

  fetchHandler({
    request: {
      url: "https://dev.plaerrdeifl.de/fanbus-info",
      method: "GET",
      mode: "navigate",
      destination: "document"
    },
    respondWith: value => {
      response = value;
    }
  });

  assert.ok(response instanceof Promise);
});

test("Portal cache rotation deletes stale Portal caches and preserves Fanbus caches", async () => {
  const { clientsClaimed, deletedCaches, handlers } = loadWorker();
  let activation;

  handlers.get("activate")({
    waitUntil: promise => {
      activation = promise;
    }
  });
  await activation;

  assert.deepEqual(deletedCaches, ["pd-portal-v4-previous-shell"]);
  assert.equal(clientsClaimed(), 1);
  assert.match(worker, /key\.startsWith\("pd-portal-"\)/);
  assert.doesNotMatch(worker, /pd-fanbus-/);
});
