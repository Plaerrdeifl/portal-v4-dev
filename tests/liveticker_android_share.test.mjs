import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = (await readFile(new URL("../js/liveticker-graphics-inline.js", import.meta.url), "utf8"))
  .replace('import { api } from "./api.js";', "");
const flush = () => new Promise(resolve => setImmediate(resolve));
const artifact = kind => ({
  kind,
  shareUrl: `https://cloud.plaerrdeifl.de/s/TestOnly${kind}`,
  downloadUrl: `https://cloud.plaerrdeifl.de/s/TestOnly${kind}/download`,
  sha256: "test-digest",
  bytes: 3,
  filename: `${kind.toLowerCase()}.png`
});

class Element {
  children = [];
  dataset = {};
  attributes = new Map();
  listeners = new Map();
  classList = { toggle() {} };
  disabled = false;
  get childElementCount() { return this.children.length; }
  replaceChildren() { this.children = []; }
  append(child) { this.children.push(child); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
}

async function harness(artifacts = [artifact("POST"), artifact("STORY")], status = "SUCCEEDED") {
  const box = new Element();
  const requests = [];
  const downloads = [];
  const shares = [];
  const errors = [];
  let clicking = false;
  let canShareFile;
  const snapshot = { jobs: [{ kind: "PERIOD_1", status, result: { artifacts } }] };
  const navigator = {
    canShare(data) {
      assert.deepEqual(Object.keys(data), ["files"]);
      assert.equal(data.files.length, 1);
      canShareFile = data.files[0];
      return true;
    },
    share(data) {
      assert.equal(clicking, true, "share must start before the original click returns");
      assert.equal(data.files[0], canShareFile);
      shares.push(data);
      return Promise.resolve();
    }
  };
  const sandbox = {
    URL, File, navigator,
    console: { error: (...args) => errors.push(args) },
    PD_LIVETICKER_GAME_CONTEXT: { eventId: "test-event" },
    api: { async call(action) {
      return action === "liveticker_graphics_status" ? snapshot : { ready: true, enabled: true };
    } },
    document: {
      getElementById: id => id === "inlineGraphicArtifacts" ? box : null,
      querySelectorAll: () => [],
      createElement: () => new Element()
    },
    window: { addEventListener() {}, setTimeout() { return 1; }, clearTimeout() {} },
    location: { assign: url => downloads.push(url) },
    fetch(url, options) {
      assert.equal(clicking, false, "click must never fetch an artifact");
      return new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }));
    }
  };
  // Execute the real module with mocked DOM/network APIs, including its actual click listeners.
  await runInNewContext(`(async () => { ${source}\nglobalThis.refreshGraphics = refreshStatusOnly; })()`, sandbox);
  return {
    box, requests, downloads, shares, errors, navigator, sandbox, snapshot,
    async prepare(index = 0, options = {}) {
      const headers = new Headers({ "Content-Type": "image/png", ...options.headers });
      requests[index].resolve({
        ok: options.ok ?? true,
        headers,
        blob: async () => new Blob([options.body ?? "png"], { type: options.blobType ?? "image/png" })
      });
      await flush();
    },
    click(index = 0) {
      const button = box.children[index];
      assert.equal(button.disabled, false);
      const listener = button.listeners.get("click");
      assert.equal(listener.constructor.name, "Function", "artifact click listener must not be async");
      clicking = true;
      try { listener(); } finally { clicking = false; }
      return button;
    }
  };
}

test("Post/Story prefetch is deduplicated and sharing starts inside the original click", async () => {
  const h = await harness();
  assert.deepEqual(h.box.children.map(button => button.textContent), ["Post", "Story"]);
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[0].url, "https://cloud.plaerrdeifl.de/public.php/dav/files/TestOnlyPOST");
  assert.equal(h.requests[0].options.credentials, "omit");
  await h.sandbox.refreshGraphics();
  assert.equal(h.requests.length, 2, "pending prefetch must not repeat on render");
  await h.prepare(0, { headers: { "Content-Disposition": 'attachment; filename="../../post.png"' } });
  await h.prepare(1);
  for (const [index, kind] of ["POST", "STORY"].entries()) {
    const button = h.click(index);
    assert.equal(h.shares.length, index + 1, "share must already have started synchronously");
    const shared = h.shares[index];
    assert.equal(shared.title, `1. Drittel · ${index === 0 ? "Post" : "Story"}`);
    assert.equal(shared.files[0].name, `${kind.toLowerCase()}.png`);
    assert.equal(shared.files[0].type, "image/png");
    assert.equal(await shared.files[0].text(), "png");
    await flush();
    assert.equal(button.disabled, false);
    assert.equal(button.attributes.has("aria-busy"), false);
    assert.equal(button.textContent, index === 0 ? "Post" : "Story");
  }
  await h.sandbox.refreshGraphics();
  assert.equal(h.requests.length, 2, "ready cache must survive rerendering");
  assert.deepEqual(h.downloads, []);
});

test("missing/pending cache immediately opens the direct download without fetching in the click", async () => {
  const h = await harness();
  h.click();
  assert.deepEqual(h.downloads, [artifact("POST").downloadUrl]);
  assert.equal(h.shares.length, 0);
  assert.equal(h.requests.length, 2);
});

for (const mode of ["no File", "no share", "no canShare", "canShare false", "canShare throws", "File throws", "share throws", "share rejects", "abort throws", "abort rejects"]) {
  test(`Android sharing handles ${mode}`, async () => {
    const h = await harness();
    await h.prepare();
    const failure = Object.assign(new Error("test share failure"), {
      name: mode.startsWith("abort") ? "AbortError" : "NotAllowedError"
    });
    if (mode === "no File") h.sandbox.File = undefined;
    if (mode === "no share") delete h.navigator.share;
    if (mode === "no canShare") delete h.navigator.canShare;
    if (mode === "canShare false") h.navigator.canShare = () => false;
    if (mode === "canShare throws") h.navigator.canShare = () => { throw failure; };
    if (mode === "File throws") h.sandbox.File = function () { throw failure; };
    if (mode === "share throws" || mode === "abort throws") h.navigator.share = () => { throw failure; };
    if (mode === "share rejects" || mode === "abort rejects") h.navigator.share = () => Promise.reject(failure);
    const button = h.click();
    await flush();
    assert.deepEqual(h.downloads, mode.startsWith("abort") ? [] : [artifact("POST").downloadUrl]);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, "Post");
    assert.equal(button.attributes.has("aria-busy"), false);
    assert.deepEqual(h.errors, []);
    assert.equal(h.requests.length, 2);
  });
}

for (const mode of ["network failure", "http failure", "wrong content type", "wrong blob type", "wrong size"]) {
  test(`prefetch ${mode} stays silent and leaves direct download available`, async () => {
    const h = await harness();
    if (mode === "network failure") {
      h.requests[0].reject(new Error("test fetch failure"));
      await flush();
    } else {
      await h.prepare(0, {
        ok: mode !== "http failure",
        headers: mode === "wrong content type" ? { "Content-Type": "text/html" } : {},
        blobType: mode === "wrong blob type" ? "text/html" : "image/png",
        body: mode === "wrong size" ? "too large" : "png"
      });
    }
    assert.deepEqual(h.errors, []);
    h.click();
    assert.deepEqual(h.downloads, [artifact("POST").downloadUrl]);
    assert.equal(h.shares.length, 0);
  });
}

test("only succeeded artifacts with matching allowed Nextcloud links are prefetched/rendered", async () => {
  const post = artifact("POST");
  const invalid = [
    { ...post, shareUrl: post.shareUrl.replace("cloud.plaerrdeifl.de", "example.invalid") },
    { ...post, downloadUrl: post.downloadUrl.replace("cloud.plaerrdeifl.de", "example.invalid") },
    { ...post, downloadUrl: artifact("STORY").downloadUrl },
    { ...post, shareUrl: "https://cloud.plaerrdeifl.de/s/short", downloadUrl: "https://cloud.plaerrdeifl.de/s/short/download" },
    { ...post, downloadUrl: `${post.downloadUrl}?extra=1` }
  ];
  const h = await harness(invalid);
  assert.equal(h.requests.length, 0);
  assert.equal(h.box.childElementCount, 0);
  const pending = await harness([post], "PROCESSING");
  assert.equal(pending.requests.length, 0);
  assert.equal(pending.box.childElementCount, 0);
});

test("cache invalidates changed URL, digest or size and evicts old entries", async () => {
  const post = artifact("POST");
  const h = await harness([post]);
  await h.prepare();
  for (const change of [{ sha256: "new-digest" }, { bytes: 4 }, {
    shareUrl: "https://cloud.plaerrdeifl.de/s/NewTestOnlyPOST",
    downloadUrl: "https://cloud.plaerrdeifl.de/s/NewTestOnlyPOST/download"
  }]) {
    const current = { ...post, ...change };
    h.snapshot.jobs[0].result.artifacts = [current];
    await h.sandbox.refreshGraphics();
    h.click();
    assert.equal(h.downloads.at(-1), current.downloadUrl);
    assert.equal(h.shares.length, 0);
    await flush();
  }
  assert.equal(h.requests.length, 4);
  for (let revision = 0; revision < 6; revision += 1) {
    h.snapshot.jobs[0].result.artifacts = [{ ...post, sha256: `revision-${revision}` }];
    await h.sandbox.refreshGraphics();
  }
  h.snapshot.jobs[0].result.artifacts = [post];
  await h.sandbox.refreshGraphics();
  assert.equal(h.requests.length, 11, "evicted artifact must be prefetched again");
  h.click();
  assert.equal(h.shares.length, 0);
  assert.equal(h.downloads.at(-1), post.downloadUrl);
});
