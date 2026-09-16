import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");
const [auth, router, pages, shopModule, shopPage, ordersModule, ordersPage, plugin, index] = await Promise.all([
  read("js/auth.js"),
  read("js/router.js"),
  read("js/pages.js"),
  read("js/modules/shop.js"),
  read("pages/shop.html"),
  read("js/modules/shop-orders.js"),
  read("pages/shop-orders.html"),
  read("wordpress/plugins/plaerrdeifl-shop/plaerrdeifl-shop.php"),
  read("index.html")
]);

test("portal derives PUBLIC PORTAL MEMBER from authoritative bootstrap state", () => {
  assert.match(auth, /commercialCustomerClass/);
  assert.match(auth, /member\?\.status === "ACTIVE"/);
  assert.match(auth, /return "MEMBER"/);
  assert.match(auth, /return "PORTAL"/);
  assert.match(auth, /\["shop", "shop-orders"\]\.includes\(key\)/);
});

test("shop route is an authenticated member-only app route", () => {
  assert.match(router, /shop:\s*\{/);
  assert.match(router, /page: "shop\.html"/);
  assert.match(pages, /key === "shop"/);
  assert.match(shopPage, /pdShopFrame/);
});

test("portal bridge posts the real access token and never uses member browser flags", () => {
  assert.match(shopModule, /name = "pd_shop_access_token"/);
  assert.match(shopModule, /form\.method = "POST"/);
  assert.match(shopModule, /state\.customerClass !== "MEMBER"/);
  assert.doesNotMatch(shopModule, /member=true|portal=true/i);
});

test("wordpress verifies portal token server-side through minimal authenticated shop identity RPC", () => {
  assert.match(plugin, /Version:\s*0\.7\.0/);
  assert.match(plugin, /rest\/v1\/rpc\/pd_shop_identity/);
  assert.match(plugin, /'Authorization' => 'Bearer ' \. \$access_token/);
  assert.match(plugin, /customerClass/);
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


test("shop route also requires a configured shop origin", () => {
  assert.match(auth, /Boolean\(CONFIG\.shop\?\.baseUrl\).*commercialCustomerClass\(\) === "MEMBER"/);
  assert.match(shopModule, /if \(!CONFIG\.shop\?\.baseUrl\)/);
  assert.match(shopModule, /Shop ist in dieser Umgebung noch nicht freigeschaltet/);
});


test("member order history is a protected native portal route", () => {
  assert.match(router, /"shop-orders":\s*\{/);
  assert.match(router, /page: "shop-orders\.html"/);
  assert.match(auth, /\["shop", "shop-orders"\]\.includes\(key\)/);
  assert.match(pages, /key === "shop-orders"/);
  assert.match(ordersPage, /Meine Bestellungen/);
  assert.match(ordersModule, /Authorization: `Bearer \$\{accessToken\}`/);
  assert.match(ordersModule, /\/wp-json\/plaerrdeifl-shop\/v1\/orders/);
});

test("orders API derives identity from bearer token and not from a requested user id", () => {
  assert.match(plugin, /register_rest_route\('plaerrdeifl-shop\/v1', '\/orders'/);
  assert.match(plugin, /get_header\('authorization'\)/);
  assert.match(plugin, /resolve_portal_identity\(\$access_token, \$config\)/);
  assert.match(plugin, /wc_get_orders\(/);
  assert.match(plugin, /ORDER_META_PORTAL_USER_ID/);
  assert.doesNotMatch(plugin, /\$request->get_param\([^)]*(?:user|member|portal)/i);
});

test("orders API returns minimal order data without customer PII", () => {
  for (const field of ["orderNumber", "createdAt", "statusLabel", "total", "currency", "fulfillmentLabel", "items", "quantity", "lineTotal"]) {
    assert.match(plugin, new RegExp(`'${field}'`));
  }
  assert.doesNotMatch(plugin, /get_billing_(?:email|phone|address|first_name|last_name)/i);
  assert.doesNotMatch(plugin, /get_shipping_(?:address|first_name|last_name|phone)/i);
});
