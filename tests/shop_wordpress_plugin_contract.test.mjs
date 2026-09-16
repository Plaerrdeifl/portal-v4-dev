import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = relative => fs.readFile(path.join(root, relative), "utf8");

const [plugin, css] = await Promise.all([
  read("wordpress/plugins/plaerrdeifl-shop/plaerrdeifl-shop.php"),
  read("wordpress/plugins/plaerrdeifl-shop/assets/plaerrdeifl-shop.css")
]);

test("shop plugin declares WooCommerce dependency and modern compatibility", () => {
  assert.match(plugin, /Plugin Name:\s*Plärrdeifl Shop/);
  assert.match(plugin, /Version:\s*0\.4\.0/);
  assert.match(plugin, /Requires Plugins:\s*woocommerce/);
  assert.match(plugin, /declare_compatibility\(\s*'custom_order_tables'/);
  assert.match(plugin, /declare_compatibility\(\s*'cart_checkout_blocks'/);
});

test("shop customer classification is prepared without trusting browser flags", () => {
  assert.match(plugin, /CUSTOMER_PUBLIC\s*=\s*'PUBLIC'/);
  assert.match(plugin, /CUSTOMER_PORTAL\s*=\s*'PORTAL'/);
  assert.match(plugin, /CUSTOMER_MEMBER\s*=\s*'MEMBER'/);
  assert.match(plugin, /apply_filters\(\s*'pd_shop_customer_class'/);
  assert.match(plugin, /return self::CUSTOMER_PUBLIC/);
  assert.doesNotMatch(plugin, /\$_(?:GET|POST|REQUEST|COOKIE)\s*\[/);
  assert.doesNotMatch(plugin, /member=true|portal=true/i);
});

test("shop persists customer class and pickup fulfillment on classic and Store API orders", () => {
  assert.match(plugin, /ORDER_META_CUSTOMER_CLASS\s*=\s*'_pd_customer_class'/);
  assert.match(plugin, /ORDER_META_FULFILLMENT\s*=\s*'_pd_fulfillment'/);
  assert.match(plugin, /PICKUP_FANSTAND_ICEDOME/);
  assert.match(plugin, /woocommerce_checkout_create_order/);
  assert.match(plugin, /woocommerce_store_api_checkout_update_order_meta/);
  assert.match(plugin, /update_meta_data\(\s*self::ORDER_META_CUSTOMER_CLASS/);
  assert.match(plugin, /update_meta_data\(\s*self::ORDER_META_FULFILLMENT/);
  assert.match(plugin, /Kundengruppe:/);
  assert.match(plugin, /Abholung am Fanstand im Icedome/);
});

test("shop is pickup-only and exposes exactly the two requested offline payment choices", () => {
  assert.match(plugin, /woocommerce_product_needs_shipping/);
  assert.match(plugin, /woocommerce_cart_needs_shipping/);
  assert.match(plugin, /woocommerce_cart_needs_shipping_address/);
  assert.match(plugin, /Barzahlung bei Abholung/);
  assert.match(plugin, /PayPal bei Abholung/);
  assert.match(plugin, /keine Online-Zahlung statt/);
  assert.match(plugin, /array\('cod', 'cheque'\)/);
  assert.match(plugin, /woocommerce_cod_process_payment_order_status/);
  assert.match(plugin, /=> 'on-hold'/);
  assert.doesNotMatch(plugin, /paypal\.com|client[_-]?id|paypal[_-]?sdk|oauth/i);
});

test("shop adds one update-safe pickup-ready WooCommerce order status", () => {
  assert.match(plugin, /ORDER_STATUS_PICKUP_READY\s*=\s*'wc-pd-pickup-ready'/);
  assert.match(plugin, /register_post_status\(/);
  assert.match(plugin, /'label'\s*=>\s*'Abholbereit'/);
  assert.match(plugin, /add_filter\(\s*'wc_order_statuses'/);
  assert.match(plugin, /mark_pd-pickup-ready/);
  assert.match(plugin, /bulk_actions-woocommerce_page_wc-orders/);
});

test("storefront CSS is scoped through WooCommerce pages and reuses theme tokens", () => {
  assert.match(plugin, /wp_enqueue_scripts/);
  assert.match(plugin, /is_woocommerce/);
  assert.match(plugin, /is_cart/);
  assert.match(plugin, /is_checkout/);
  assert.match(plugin, /is_account_page/);
  assert.match(plugin, /assets\/plaerrdeifl-shop\.css/);
  assert.match(css, /\.pd-shop-pickup-note/);
  assert.match(css, /var\(--accent, #208df2\)/);
  assert.match(css, /var\(--accent-light, #49adff\)/);
  assert.match(css, /var\(--surface,/);
  assert.match(css, /var\(--border,/);
  assert.match(css, /\.wc-block-cart/);
  assert.match(css, /\.wc-block-checkout/);
  assert.match(css, /@media \(max-width: 560px\)/);
});

test("shop foundation contains no environment secret, Supabase binding or invented discount", () => {
  assert.doesNotMatch(plugin, /service[_-]?role|SUPABASE_SERVICE_ROLE|M150_INTAKE_HMAC_SECRET/i);
  assert.doesNotMatch(plugin, /tpieykhhawszlzsoflnl|wplescvhlgctynkfwvrj/);
  assert.doesNotMatch(plugin, /percent|percentage|coupon|discount amount|rabatt.*[0-9]/i);
});
