<?php
/**
 * Plugin Name: Plärrdeifl Shop
 * Description: Plärrdeifl-specific WooCommerce integration layer.
 * Version: 0.6.1
 * Requires PHP: 8.3
 * Requires Plugins: woocommerce
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class PD_Shop_Plugin
{
    public const VERSION = '0.6.1';

    public const CUSTOMER_PUBLIC = 'PUBLIC';
    public const CUSTOMER_PORTAL = 'PORTAL';
    public const CUSTOMER_MEMBER = 'MEMBER';

    public const ORDER_STATUS_PICKUP_READY = 'wc-pd-pickup-ready';

    private const ORDER_META_CUSTOMER_CLASS = '_pd_customer_class';
    private const ORDER_META_FULFILLMENT = '_pd_fulfillment';
    private const ORDER_META_PORTAL_USER_ID = '_pd_portal_user_id';
    private const ORDER_META_MEMBER_ID = '_pd_member_id';
    private const SHOP_SETTINGS_OPTION = 'plaerrdeifl_shop_settings';
    private const FULFILLMENT_PICKUP_ICEDOME = 'PICKUP_FANSTAND_ICEDOME';
    private const SETUP_OPTION = 'pd_shop_setup_version';
    private const SETUP_VERSION = '2026-09-16-1';
    private const SESSION_COOKIE = 'pd_shop_session';
    private const SESSION_TTL_SECONDS = 900;

    private const CUSTOMER_CLASSES = array(
        self::CUSTOMER_PUBLIC,
        self::CUSTOMER_PORTAL,
        self::CUSTOMER_MEMBER,
    );

    public static function register_woocommerce_compatibility(): void
    {
        if (!class_exists('Automattic\\WooCommerce\\Utilities\\FeaturesUtil')) {
            return;
        }

        Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'custom_order_tables',
            __FILE__,
            true
        );
        Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'cart_checkout_blocks',
            __FILE__,
            true
        );
    }

    public static function boot(): void
    {
        if (!defined('WC_VERSION')) {
            add_action('admin_notices', array(self::class, 'render_missing_woocommerce_notice'));
            return;
        }

        add_action('init', array(self::class, 'apply_business_defaults'), 5);
        add_action('init', array(self::class, 'register_order_status'));
        add_action('wp_enqueue_scripts', array(self::class, 'enqueue_storefront_assets'));
        add_action('template_redirect', array(self::class, 'handle_portal_bridge'), 0);
        add_action('wp_head', array(self::class, 'render_embed_detection_script'), 1);
        add_filter('body_class', array(self::class, 'add_embedded_body_class'));
        add_action('template_redirect', array(self::class, 'enforce_member_only_frontend'), 1);

        add_filter('wc_order_statuses', array(self::class, 'add_order_status'));
        add_filter('woocommerce_product_needs_shipping', '__return_false', 1000, 2);
        add_filter('woocommerce_cart_needs_shipping', '__return_false', 1000);
        add_filter('woocommerce_cart_needs_shipping_address', '__return_false', 1000);
        add_filter(
            'woocommerce_available_payment_gateways',
            array(self::class, 'restrict_payment_gateways'),
            1000
        );
        add_filter(
            'woocommerce_cod_process_payment_order_status',
            static fn(): string => 'on-hold',
            1000
        );

        add_filter(
            'woocommerce_product_is_visible',
            array(self::class, 'restrict_product_visibility'),
            1000,
            2
        );
        add_filter(
            'wp_get_nav_menu_items',
            array(self::class, 'hide_shop_navigation_for_non_members'),
            1000,
            3
        );
        add_filter(
            'rest_pre_dispatch',
            array(self::class, 'block_shop_rest_for_non_members'),
            5,
            3
        );
        add_filter(
            'wp_sitemaps_post_types',
            array(self::class, 'remove_products_from_public_sitemap'),
            1000
        );

        add_filter(
            'bulk_actions-edit-shop_order',
            array(self::class, 'add_pickup_ready_bulk_action')
        );
        add_filter(
            'bulk_actions-woocommerce_page_wc-orders',
            array(self::class, 'add_pickup_ready_bulk_action')
        );

        add_action('woocommerce_before_shop_loop', array(self::class, 'render_pickup_notice'), 5);
        add_action('woocommerce_before_single_product', array(self::class, 'render_pickup_notice'), 5);
        add_action('woocommerce_before_cart', array(self::class, 'render_pickup_notice'), 5);
        add_action('woocommerce_before_checkout_form', array(self::class, 'render_pickup_notice'), 5);

        add_action(
            'woocommerce_checkout_create_order',
            array(self::class, 'stamp_order_context'),
            20,
            2
        );
        add_action(
            'woocommerce_store_api_checkout_update_order_meta',
            array(self::class, 'stamp_order_context_store_api'),
            20,
            1
        );
        add_action(
            'woocommerce_admin_order_data_after_billing_address',
            array(self::class, 'render_admin_order_context'),
            20,
            1
        );
    }

    public static function render_missing_woocommerce_notice(): void
    {
        if (!current_user_can('activate_plugins')) {
            return;
        }

        echo '<div class="notice notice-error"><p>'
            . esc_html('Plärrdeifl Shop benötigt ein aktives WooCommerce.')
            . '</p></div>';
    }

    public static function apply_business_defaults(): void
    {
        if ((string) get_option(self::SETUP_OPTION, '') === self::SETUP_VERSION) {
            return;
        }

        update_option('woocommerce_enable_guest_checkout', 'yes');

        $cod = get_option('woocommerce_cod_settings', array());
        if (!is_array($cod)) {
            $cod = array();
        }
        update_option('woocommerce_cod_settings', array_merge($cod, array(
            'enabled' => 'yes',
            'title' => 'Barzahlung bei Abholung',
            'description' => 'Du bezahlst bar bei der Abholung am Fanstand im Icedome.',
            'instructions' => 'Bitte bezahle bei der Abholung am Fanstand im Icedome.',
            'enable_for_virtual' => 'yes',
        )));

        $cheque = get_option('woocommerce_cheque_settings', array());
        if (!is_array($cheque)) {
            $cheque = array();
        }
        update_option('woocommerce_cheque_settings', array_merge($cheque, array(
            'enabled' => 'yes',
            'title' => 'PayPal bei Abholung',
            'description' => 'Du bezahlst per PayPal erst bei der Abholung am Fanstand im Icedome. Im Shop findet keine Online-Zahlung statt.',
            'instructions' => 'Die PayPal-Zahlung erfolgt bei der Abholung am Fanstand im Icedome.',
        )));

        $bacs = get_option('woocommerce_bacs_settings', array());
        if (!is_array($bacs)) {
            $bacs = array();
        }
        $bacs['enabled'] = 'no';
        update_option('woocommerce_bacs_settings', $bacs);

        update_option(self::SETUP_OPTION, self::SETUP_VERSION, false);
    }

    /** @return array{supabase_url:string,publishable_key:string,portal_origin:string}|null */
    private static function bridge_config(): ?array
    {
        $settings = get_option(self::SHOP_SETTINGS_OPTION, array());
        if (!is_array($settings)) {
            $settings = array();
        }

        $url = defined('PD_SHOP_SUPABASE_URL')
            ? (string) PD_SHOP_SUPABASE_URL
            : (string) ($settings['supabase_url'] ?? '');
        $key = defined('PD_SHOP_SUPABASE_PUBLISHABLE_KEY')
            ? (string) PD_SHOP_SUPABASE_PUBLISHABLE_KEY
            : (string) ($settings['publishable_key'] ?? '');
        $portal = defined('PD_SHOP_PORTAL_ORIGIN')
            ? (string) PD_SHOP_PORTAL_ORIGIN
            : (string) ($settings['portal_origin'] ?? '');

        $url = rtrim(esc_url_raw(trim($url)), '/');
        $key = trim($key);
        $portal_parts = wp_parse_url(trim($portal));
        $portal_origin = '';
        if (is_array($portal_parts) && isset($portal_parts['scheme'], $portal_parts['host'])) {
            $portal_origin = strtolower($portal_parts['scheme'] . '://' . $portal_parts['host']);
            if (isset($portal_parts['port'])) {
                $portal_origin .= ':' . (int) $portal_parts['port'];
            }
        }

        if (!str_starts_with($url, 'https://') || strlen($key) < 20 || $portal_origin === '') {
            return null;
        }

        return array(
            'supabase_url' => $url,
            'publishable_key' => $key,
            'portal_origin' => $portal_origin,
        );
    }

    public static function handle_portal_bridge(): void
    {
        if (!isset($_GET['pd_shop_bridge'])) {
            return;
        }

        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
            status_header(405);
            nocache_headers();
            exit('POST required');
        }

        $config = self::bridge_config();
        $origin = strtolower(trim((string) ($_SERVER['HTTP_ORIGIN'] ?? '')));
        if ($config === null || $origin === '' || !hash_equals($config['portal_origin'], $origin)) {
            status_header(403);
            nocache_headers();
            exit('Bridge origin rejected');
        }

        $access_token = trim((string) wp_unslash($_POST['pd_shop_access_token'] ?? ''));
        if (
            strlen($access_token) < 40
            || strlen($access_token) > 8192
            || preg_match('/\s/', $access_token)
        ) {
            status_header(403);
            nocache_headers();
            exit('Invalid portal token');
        }

        $identity = self::resolve_portal_identity($access_token, $config);
        if ($identity === null || $identity['customerClass'] !== self::CUSTOMER_MEMBER) {
            self::clear_shop_session();
            status_header(403);
            nocache_headers();
            exit('Shop nur für aktive Mitglieder.');
        }

        self::issue_shop_session($identity);
        nocache_headers();
        wp_safe_redirect(wc_get_page_permalink('shop'), 303);
        exit;
    }

    private static function valid_uuid(string $value): bool
    {
        return preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            $value
        ) === 1;
    }

    /**
     * @param array{supabase_url:string,publishable_key:string,portal_origin:string} $config
     * @return array{customerClass:string,userId:string,memberId:?string}|null
     */
    private static function resolve_portal_identity(string $access_token, array $config): ?array
    {
        $response = wp_remote_post(
            $config['supabase_url'] . '/rest/v1/rpc/pd_shop_identity',
            array(
                'timeout' => 12,
                'redirection' => 0,
                'headers' => array(
                    'apikey' => $config['publishable_key'],
                    'Authorization' => 'Bearer ' . $access_token,
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ),
                'body' => '{}',
            )
        );

        if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
            return null;
        }

        $identity = json_decode((string) wp_remote_retrieve_body($response), true);
        if (isset($identity[0]) && is_array($identity[0])) {
            $identity = $identity[0];
        }
        if (!is_array($identity)) {
            return null;
        }

        $user_id = trim((string) ($identity['portalUserId'] ?? ''));
        $class = strtoupper(trim((string) ($identity['customerClass'] ?? '')));
        $member_id = trim((string) ($identity['memberId'] ?? ''));

        if (!self::valid_uuid($user_id)
            || !in_array($class, array(self::CUSTOMER_PORTAL, self::CUSTOMER_MEMBER), true)
            || ($class === self::CUSTOMER_MEMBER && !self::valid_uuid($member_id))) {
            return null;
        }

        return array(
            'customerClass' => $class,
            'userId' => $user_id,
            'memberId' => self::valid_uuid($member_id) ? $member_id : null,
        );
    }

    /** @param array{customerClass:string,userId:string,memberId:?string} $identity */
    private static function issue_shop_session(array $identity): void
    {
        $payload = array(
            'v' => 1,
            'class' => $identity['customerClass'],
            'sub' => $identity['userId'],
            'member' => $identity['memberId'],
            'exp' => time() + self::SESSION_TTL_SECONDS,
        );
        $json = wp_json_encode($payload);
        if (!is_string($json)) {
            return;
        }
        $encoded = rtrim(strtr(base64_encode($json), '+/', '-_'), '=');
        $signature = hash_hmac('sha256', $encoded, self::session_signing_key());
        $value = $encoded . '.' . $signature;

        setcookie(self::SESSION_COOKIE, $value, array(
            'expires' => (int) $payload['exp'],
            'path' => '/',
            'secure' => is_ssl(),
            'httponly' => true,
            'samesite' => 'Lax',
        ));
        $_COOKIE[self::SESSION_COOKIE] = $value;
    }

    private static function clear_shop_session(): void
    {
        setcookie(self::SESSION_COOKIE, '', array(
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => is_ssl(),
            'httponly' => true,
            'samesite' => 'Lax',
        ));
        unset($_COOKIE[self::SESSION_COOKIE]);
    }

    private static function session_signing_key(): string
    {
        return wp_salt('auth') . '|pd-shop-session-v1';
    }

    /** @return array{class:string,sub:string,member:?string,exp:int}|null */
    private static function shop_session(): ?array
    {
        $raw = trim((string) ($_COOKIE[self::SESSION_COOKIE] ?? ''));
        if ($raw === '' || !str_contains($raw, '.')) {
            return null;
        }

        [$encoded, $signature] = explode('.', $raw, 2);
        if ($encoded === '' || !preg_match('/^[a-f0-9]{64}$/', $signature)) {
            return null;
        }

        $expected = hash_hmac('sha256', $encoded, self::session_signing_key());
        if (!hash_equals($expected, $signature)) {
            return null;
        }

        $base64 = strtr($encoded, '-_', '+/');
        $padding = strlen($base64) % 4;
        if ($padding !== 0) {
            $base64 .= str_repeat('=', 4 - $padding);
        }
        $decoded = base64_decode($base64, true);
        if (!is_string($decoded)) {
            return null;
        }

        $payload = json_decode($decoded, true);
        if (!is_array($payload)) {
            return null;
        }

        $class = strtoupper(trim((string) ($payload['class'] ?? '')));
        $sub = trim((string) ($payload['sub'] ?? ''));
        $member = trim((string) ($payload['member'] ?? ''));
        $exp = (int) ($payload['exp'] ?? 0);
        if (!in_array($class, self::CUSTOMER_CLASSES, true)
            || !self::valid_uuid($sub)
            || ($class === self::CUSTOMER_MEMBER && !self::valid_uuid($member))
            || $exp <= time()) {
            return null;
        }

        return array(
            'class' => $class,
            'sub' => $sub,
            'member' => self::valid_uuid($member) ? $member : null,
            'exp' => $exp,
        );
    }

    /** @param array<int,string> $classes @return array<int,string> */
    public static function add_embedded_body_class(array $classes): array
    {
        $destination = strtolower(trim((string) ($_SERVER['HTTP_SEC_FETCH_DEST'] ?? '')));
        if ($destination === 'iframe' && self::is_shop_surface()) {
            $classes[] = 'pd-shop-embedded';
        }
        return $classes;
    }

    public static function render_embed_detection_script(): void
    {
        if (!self::shop_access_allowed() || !self::is_shop_surface()) {
            return;
        }
        echo "<script>(function(){try{if(window.self!==window.top){document.documentElement.classList.add('pd-shop-embedded')}}catch(e){document.documentElement.classList.add('pd-shop-embedded')}})();</script>";
    }

    /**
     * Only active members may use or discover the shop.
     *
     * Access is granted by the signed Portal -> WordPress session.
     * Administrators with WooCommerce management rights retain a local bypass
     * for development. No browser membership flag grants access.
     */
    public static function shop_access_allowed(): bool
    {
        if (is_user_logged_in() && current_user_can('manage_woocommerce')) {
            return true;
        }

        $granted = apply_filters('pd_shop_member_access', false);
        if ($granted === true) {
            return true;
        }

        return self::customer_class() === self::CUSTOMER_MEMBER;
    }

    public static function enforce_member_only_frontend(): void
    {
        if (self::shop_access_allowed() || !self::is_shop_surface()) {
            return;
        }

        global $wp_query;
        if (is_object($wp_query)) {
            $wp_query->set_404();
        }

        status_header(404);
        nocache_headers();

        $template = get_404_template();
        if ($template) {
            include $template;
        }

        exit;
    }

    /**
     * @param bool $visible
     * @param int $product_id
     */
    public static function restrict_product_visibility(bool $visible, int $product_id): bool
    {
        if (!self::shop_access_allowed()) {
            return false;
        }

        return $visible;
    }

    /**
     * @param array<int,mixed> $items
     * @param mixed $menu
     * @param mixed $args
     * @return array<int,mixed>
     */
    public static function hide_shop_navigation_for_non_members(array $items, $menu, $args): array
    {
        if (self::shop_access_allowed()) {
            return $items;
        }

        $page_ids = array_filter(array_map('absint', array(
            get_option('woocommerce_shop_page_id'),
            get_option('woocommerce_cart_page_id'),
            get_option('woocommerce_checkout_page_id'),
            get_option('woocommerce_myaccount_page_id'),
        )));

        return array_values(array_filter($items, static function ($item) use ($page_ids): bool {
            if (!is_object($item)) {
                return true;
            }

            $object_id = isset($item->object_id) ? absint($item->object_id) : 0;
            if ($object_id > 0 && in_array($object_id, $page_ids, true)) {
                return false;
            }

            $url = isset($item->url) ? (string) $item->url : '';
            $path = strtolower((string) wp_parse_url($url, PHP_URL_PATH));

            foreach (array('/shop', '/cart', '/checkout', '/my-account', '/product/') as $blocked) {
                if ($path !== '' && str_starts_with($path, $blocked)) {
                    return false;
                }
            }

            return true;
        }));
    }

    /**
     * @param mixed $result
     * @param mixed $server
     * @param mixed $request
     * @return mixed
     */
    public static function block_shop_rest_for_non_members($result, $server, $request)
    {
        if (self::shop_access_allowed() || !is_object($request) || !method_exists($request, 'get_route')) {
            return $result;
        }

        $route = (string) $request->get_route();
        $blocked = str_starts_with($route, '/wc/store/')
            || str_starts_with($route, '/wp/v2/product')
            || str_starts_with($route, '/wp/v2/product_cat')
            || str_starts_with($route, '/wp/v2/product_tag');

        if (!$blocked) {
            return $result;
        }

        return new WP_Error(
            'pd_shop_members_only',
            'Shop nur für Mitglieder.',
            array('status' => 403)
        );
    }

    /**
     * @param array<string,mixed> $post_types
     * @return array<string,mixed>
     */
    public static function remove_products_from_public_sitemap(array $post_types): array
    {
        unset($post_types['product']);
        return $post_types;
    }

    /**
     * @param array<string,mixed> $gateways
     * @return array<string,mixed>
     */
    public static function restrict_payment_gateways(array $gateways): array
    {
        if (is_admin() && !wp_doing_ajax()) {
            return $gateways;
        }

        foreach (array_keys($gateways) as $gateway_id) {
            if (!in_array($gateway_id, array('cod', 'cheque'), true)) {
                unset($gateways[$gateway_id]);
            }
        }

        return $gateways;
    }

    public static function render_pickup_notice(): void
    {
        echo '<div class="pd-shop-pickup-note" role="note">'
            . '<strong>' . esc_html('Nur Abholung') . '</strong>'
            . '<span>' . esc_html('Kostenlose Abholung am Fanstand im Icedome. Kein Versand.') . '</span>'
            . '</div>';
    }

    public static function enqueue_storefront_assets(): void
    {
        if (!self::is_shop_surface()) {
            return;
        }

        $path = plugin_dir_path(__FILE__) . 'assets/plaerrdeifl-shop.css';
        $version = is_file($path) ? (string) filemtime($path) : self::VERSION;

        wp_enqueue_style(
            'plaerrdeifl-shop',
            plugins_url('assets/plaerrdeifl-shop.css', __FILE__),
            array(),
            $version
        );
    }

    private static function is_shop_surface(): bool
    {
        return (function_exists('is_woocommerce') && is_woocommerce())
            || (function_exists('is_shop') && is_shop())
            || (function_exists('is_product') && is_product())
            || (function_exists('is_product_category') && is_product_category())
            || (function_exists('is_product_tag') && is_product_tag())
            || (function_exists('is_cart') && is_cart())
            || (function_exists('is_checkout') && is_checkout())
            || (function_exists('is_account_page') && is_account_page());
    }

    public static function register_order_status(): void
    {
        register_post_status(
            self::ORDER_STATUS_PICKUP_READY,
            array(
                'label' => 'Abholbereit',
                'public' => true,
                'exclude_from_search' => false,
                'show_in_admin_all_list' => true,
                'show_in_admin_status_list' => true,
                'label_count' => _n_noop(
                    'Abholbereit <span class="count">(%s)</span>',
                    'Abholbereit <span class="count">(%s)</span>'
                ),
            )
        );
    }

    /**
     * @param array<string,string> $statuses
     * @return array<string,string>
     */
    public static function add_order_status(array $statuses): array
    {
        $result = array();
        $inserted = false;

        foreach ($statuses as $status => $label) {
            $result[$status] = $label;

            if ($status === 'wc-processing') {
                $result[self::ORDER_STATUS_PICKUP_READY] = 'Abholbereit';
                $inserted = true;
            }
        }

        if (!$inserted) {
            $result[self::ORDER_STATUS_PICKUP_READY] = 'Abholbereit';
        }

        return $result;
    }

    /**
     * @param array<string,string> $actions
     * @return array<string,string>
     */
    public static function add_pickup_ready_bulk_action(array $actions): array
    {
        $actions['mark_pd-pickup-ready'] = 'Status auf „Abholbereit“ setzen';
        return $actions;
    }

    public static function customer_class(): string
    {
        $session = self::shop_session();
        if ($session !== null) {
            return $session['class'];
        }

        $candidate = apply_filters(
            'pd_shop_customer_class',
            self::CUSTOMER_PUBLIC
        );

        if (!is_string($candidate)) {
            return self::CUSTOMER_PUBLIC;
        }

        $candidate = strtoupper(trim($candidate));

        return in_array($candidate, self::CUSTOMER_CLASSES, true)
            ? $candidate
            : self::CUSTOMER_PUBLIC;
    }

    /**
     * @param mixed $order
     * @param mixed $data
     */
    public static function stamp_order_context($order, $data = null): void
    {
        self::stamp_order_meta($order);
    }

    /** @param mixed $order */
    public static function stamp_order_context_store_api($order): void
    {
        self::stamp_order_meta($order);
    }

    /** @param mixed $order */
    private static function stamp_order_meta($order): void
    {
        if (!is_object($order) || !is_a($order, 'WC_Order')) {
            return;
        }

        $order->update_meta_data(
            self::ORDER_META_CUSTOMER_CLASS,
            self::customer_class()
        );
        $order->update_meta_data(
            self::ORDER_META_FULFILLMENT,
            self::FULFILLMENT_PICKUP_ICEDOME
        );

        $session = self::shop_session();
        if ($session !== null) {
            $order->update_meta_data(
                self::ORDER_META_PORTAL_USER_ID,
                $session['sub']
            );
            if (!empty($session['member'])) {
                $order->update_meta_data(
                    self::ORDER_META_MEMBER_ID,
                    $session['member']
                );
            }
        }
    }

    /** @param mixed $order */
    public static function render_admin_order_context($order): void
    {
        if (!is_object($order) || !is_a($order, 'WC_Order')) {
            return;
        }

        $stored = strtoupper(trim((string) $order->get_meta(
            self::ORDER_META_CUSTOMER_CLASS,
            true
        )));

        $label = match ($stored) {
            self::CUSTOMER_MEMBER => 'Mitglied',
            self::CUSTOMER_PORTAL => 'Portaluser',
            default => 'Öffentlich',
        };

        echo '<p><strong>' . esc_html('Kundengruppe:') . '</strong> '
            . esc_html($label)
            . '</p>';
        echo '<p><strong>' . esc_html('Übergabe:') . '</strong> '
            . esc_html('Abholung am Fanstand im Icedome')
            . '</p>';
    }
}

add_action(
    'before_woocommerce_init',
    array(PD_Shop_Plugin::class, 'register_woocommerce_compatibility')
);
add_action('plugins_loaded', array(PD_Shop_Plugin::class, 'boot'), 20);
