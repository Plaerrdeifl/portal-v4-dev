<?php
/**
 * Plugin Name: Plärrdeifl Shop
 * Description: Plärrdeifl-specific WooCommerce integration layer.
 * Version: 0.2.0
 * Requires PHP: 8.3
 * Requires Plugins: woocommerce
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class PD_Shop_Plugin
{
    public const VERSION = '0.2.0';

    public const CUSTOMER_PUBLIC = 'PUBLIC';
    public const CUSTOMER_PORTAL = 'PORTAL';
    public const CUSTOMER_MEMBER = 'MEMBER';

    public const ORDER_STATUS_PICKUP_READY = 'wc-pd-pickup-ready';

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

        add_action('init', array(self::class, 'register_order_status'));
        add_action('wp_enqueue_scripts', array(self::class, 'enqueue_storefront_assets'));

        add_filter('wc_order_statuses', array(self::class, 'add_order_status'));

        add_filter(
            'bulk_actions-edit-shop_order',
            array(self::class, 'add_pickup_ready_bulk_action')
        );
        add_filter(
            'bulk_actions-woocommerce_page_wc-orders',
            array(self::class, 'add_pickup_ready_bulk_action')
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

    /**
     * Resolve the commercial customer class for this request.
     *
     * V1 deliberately defaults to PUBLIC. A later authenticated shop bridge
     * may supply PORTAL or MEMBER through the `pd_shop_customer_class` filter.
     * Authorization must remain server-side; browser-provided flags are not
     * accepted here.
     */
    public static function customer_class(): string
    {
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
}

add_action(
    'before_woocommerce_init',
    array(PD_Shop_Plugin::class, 'register_woocommerce_compatibility')
);
add_action('plugins_loaded', array(PD_Shop_Plugin::class, 'boot'), 20);
