import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const [auth, router, pages, shopModule, shopPage, plugin, index] = await Promise.all([
  read("js/auth.js"),
  read("js/router.js"),
  read("js/pages.js"),
  read("js/modules/shop.js"),
  read("pages/shop.html"),
  read("wordpress/plugins/plaerrdeifl-shop/plaerrdeifl-shop.php"),
  read("index.html")
]);

test("portal derives PUBLIC PORTAL MEMBER from authoritative bootstrap state", () => {
  assert.match(auth, /commercialCustomerClass/);
  assert.match(auth, /member\?\.status === "ACTIVE"/);
  assert.match(auth, /return "MEMBER"/);
  assert.match(auth, /return "PORTAL"/);
  assert.match(auth, /key === "shop"/);
});

test("shop route is an authenticated member-only app route", () => {
  assert.match(router, /shop:\s*\{/);
  assert.match(router, /page: "shop\.html"/);
  assert.match(pages, /key === "shop"/);
  assert.match(shopPage, /pdShopFrame/);
});

test("portal bridge posts the real access token and never uses member browser flags", () => {
  assert.match(shopModule, /name = "access_token"/);
  assert.match(shopModule, /form\.method = "POST"/);
  assert.match(shopModule, /state\.customerClass !== "MEMBER"/);
  assert.doesNotMatch(shopModule, /member=true|portal=true/i);
});

test("wordpress verifies portal token server-side through authenticated pd_api bootstrap", () => {
  assert.match(plugin, /Version:\s*0\.6\.0/);
  assert.match(plugin, /rest\/v1\/rpc\/pd_api/);
  assert.match(plugin, /'Authorization' => 'Bearer ' \. \$access_token/);
  assert.match(plugin, /'p_action' => 'bootstrap'/);
  assert.match(plugin, /member.*status.*ACTIVE/s);
  assert.match(plugin, /HTTP_ORIGIN/);
});

test("wordpress shop session is short-lived signed and HttpOnly", () => {
  assert.match(plugin, /SESSION_TTL_SECONDS = 900/);
  assert.match(plugin, /hash_hmac\('sha256'/);
  assert.match(plugin, /wp_salt\('auth'\)/);
  assert.match(plugin, /'httponly' => true/);
  assert.match(plugin, /'samesite' => 'Lax'/);
});

test("portal CSP allows only owned shop origins for frame and POST bridge", () => {
  assert.match(index, /frame-src[^;]*https:\/\/staging\.plaerrdeifl\.de[^;]*https:\/\/plaerrdeifl\.de/);
  assert.match(index, /form-action[^"]*https:\/\/staging\.plaerrdeifl\.de[^"]*https:\/\/plaerrdeifl\.de/);
});
