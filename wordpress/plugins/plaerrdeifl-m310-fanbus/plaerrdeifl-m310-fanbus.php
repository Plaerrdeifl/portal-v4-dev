<?php
/**
 * Plugin Name: Plärrdeifl M310 Fanbusfahrten
 * Description: Öffentliche Anzeige der Fanbusfahrten mit Verlinkung zur zentralen Anmeldung.
 * Version: 1.0.4
 * Requires PHP: 8.3
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class PD_M310_Fanbus_Plugin
{
    private const VERSION = '1.0.4';
    private const OPTION_NAME = 'plaerrdeifl_m310_fanbus_settings';
    private const SETTINGS_GROUP = 'plaerrdeifl_m310_fanbus_settings_group';
    private const ADMIN_SLUG = 'plaerrdeifl-m310-fanbus';
    private const RPC_PATH = '/rest/v1/rpc/pd_public_fanbus_trips';
    private const STOPS_RPC_PATH = '/rest/v1/rpc/pd_public_fanbus_trip_boarding_stops';
    private const REQUEST_TIMEOUT = 8;
    private const MAX_RESPONSE_BYTES = 262144;
    private const MAX_URL_LENGTH = 2048;
    private const MAX_KEY_LENGTH = 2048;

    public static function boot(): void
    {
        add_shortcode('plaerrdeifl_fanbusfahrten', array(self::class, 'render_shortcode'));
        add_action('admin_menu', array(self::class, 'register_admin_page'));
        add_action('admin_init', array(self::class, 'register_settings'));
    }

    private static function default_settings(): array
    {
        return array(
            'supabase_url' => '',
            'publishable_key' => '',
            'portal_registration_url' => '',
        );
    }

    private static function settings(): array
    {
        $stored = get_option(self::OPTION_NAME, array());
        if (!is_array($stored)) {
            $stored = array();
        }

        return array_merge(self::default_settings(), array_intersect_key(
            $stored,
            self::default_settings()
        ));
    }

    public static function register_admin_page(): void
    {
        add_options_page(
            'Fanbusfahrten',
            'Fanbusfahrten',
            'manage_options',
            self::ADMIN_SLUG,
            array(self::class, 'render_admin_page')
        );
    }

    public static function register_settings(): void
    {
        register_setting(
            self::SETTINGS_GROUP,
            self::OPTION_NAME,
            array(
                'type' => 'array',
                'default' => self::default_settings(),
                'sanitize_callback' => array(self::class, 'sanitize_settings'),
                'show_in_rest' => false,
            )
        );

        add_settings_section(
            'pd_m310_connection',
            'Öffentliche Fanbus-Anbindung',
            array(self::class, 'render_settings_intro'),
            self::ADMIN_SLUG
        );

        self::add_settings_field(
            'pd_m310_supabase_url',
            'Supabase URL',
            'supabase_url',
            'url',
            'https://PROJECT.supabase.co'
        );
        self::add_settings_field(
            'pd_m310_publishable_key',
            'Supabase Publishable Key',
            'publishable_key',
            'text',
            'sb_publishable_…'
        );
        self::add_settings_field(
            'pd_m310_portal_registration_url',
            'Portal-Anmelde-URL',
            'portal_registration_url',
            'url',
            'https://portal.example.de/fanbus-anmeldung'
        );
    }

    private static function add_settings_field(
        string $id,
        string $label,
        string $key,
        string $type,
        string $placeholder
    ): void {
        add_settings_field(
            $id,
            $label,
            array(self::class, 'render_settings_field'),
            self::ADMIN_SLUG,
            'pd_m310_connection',
            array(
                'key' => $key,
                'type' => $type,
                'placeholder' => $placeholder,
            )
        );
    }

    public static function render_settings_intro(): void
    {
        echo '<p>' . esc_html(
            'WordPress lädt ausschließlich öffentliche Fanbusdaten und verlinkt zur zentralen Anmeldung.'
        ) . '</p>';
    }

    public static function render_settings_field(array $args): void
    {
        $key = isset($args['key']) ? (string) $args['key'] : '';
        $type = isset($args['type']) ? (string) $args['type'] : 'text';
        $placeholder = isset($args['placeholder']) ? (string) $args['placeholder'] : '';
        $settings = self::settings();
        $value = isset($settings[$key]) && is_string($settings[$key])
            ? $settings[$key]
            : '';

        printf(
            '<input class="regular-text code" type="%1$s" name="%2$s[%3$s]" value="%4$s" placeholder="%5$s" maxlength="%6$d" autocomplete="off" required>',
            esc_attr($type),
            esc_attr(self::OPTION_NAME),
            esc_attr($key),
            esc_attr($value),
            esc_attr($placeholder),
            $key === 'publishable_key' ? self::MAX_KEY_LENGTH : self::MAX_URL_LENGTH
        );

        if ($key === 'publishable_key') {
            echo '<p class="description">' . esc_html(
                'Nur den öffentlichen Publishable Key verwenden. Keinen Service-Role-Key eintragen.'
            ) . '</p>';
        }
    }

    public static function sanitize_settings(mixed $input): array
    {
        $current = self::settings();
        if (!current_user_can('manage_options')) {
            return $current;
        }

        $option_page = isset($_POST['option_page'])
            ? sanitize_key(wp_unslash((string) $_POST['option_page']))
            : '';
        if ($option_page !== self::SETTINGS_GROUP || !isset($_POST['_wpnonce'])) {
            return $current;
        }
        check_admin_referer(self::SETTINGS_GROUP . '-options');

        if (!is_array($input)) {
            add_settings_error(
                self::OPTION_NAME,
                'pd_m310_invalid_settings',
                'Die Fanbus-Einstellungen wurden nicht übernommen.',
                'error'
            );
            return $current;
        }

        $supabase_url = self::validated_supabase_url($input['supabase_url'] ?? null);
        $publishable_key = self::validated_publishable_key(
            $input['publishable_key'] ?? null
        );
        $portal_url = self::validated_portal_url(
            $input['portal_registration_url'] ?? null
        );

        if ($supabase_url === null) {
            self::settings_error(
                'pd_m310_invalid_supabase_url',
                'Die Supabase URL muss eine gültige absolute HTTPS-URL ohne Zugangsdaten, Query oder Fragment sein.'
            );
        }
        if ($publishable_key === null) {
            self::settings_error(
                'pd_m310_invalid_publishable_key',
                'Der Supabase Publishable Key ist ungültig.'
            );
        }
        if ($portal_url === null) {
            self::settings_error(
                'pd_m310_invalid_portal_url',
                'Die Portal-Anmelde-URL muss eine absolute HTTPS-URL zu /fanbus-anmeldung ohne Query oder Fragment sein.'
            );
        }

        return array(
            'supabase_url' => $supabase_url ?? $current['supabase_url'],
            'publishable_key' => $publishable_key ?? $current['publishable_key'],
            'portal_registration_url' => $portal_url ?? $current['portal_registration_url'],
        );
    }

    private static function settings_error(string $code, string $message): void
    {
        add_settings_error(self::OPTION_NAME, $code, $message, 'error');
    }

    private static function validated_supabase_url(mixed $value): ?string
    {
        return self::validated_https_url($value, false);
    }

    private static function validated_portal_url(mixed $value): ?string
    {
        $url = self::validated_https_url($value, true);
        if ($url === null) {
            return null;
        }

        $path = wp_parse_url($url, PHP_URL_PATH);
        if (
            !is_string($path)
            || !in_array(
                $path,
                array('/fanbus-anmeldung', '/fanbus-anmeldung.html'),
                true
            )
        ) {
            return null;
        }

        return $path === '/fanbus-anmeldung.html'
            ? substr($url, 0, -5)
            : $url;
    }

    private static function validated_https_url(mixed $value, bool $preserve_path): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $raw = trim(wp_unslash($value));
        if (
            $raw === ''
            || strlen($raw) > self::MAX_URL_LENGTH
            || str_contains($raw, '?')
            || str_contains($raw, '#')
            || wp_http_validate_url($raw) === false
        ) {
            return null;
        }

        $parts = wp_parse_url($raw);
        if (
            !is_array($parts)
            || strtolower((string) ($parts['scheme'] ?? '')) !== 'https'
            || !is_string($parts['host'] ?? null)
            || $parts['host'] === ''
            || isset($parts['user'])
            || isset($parts['pass'])
            || isset($parts['query'])
            || isset($parts['fragment'])
        ) {
            return null;
        }

        $normalized = esc_url_raw($raw, array('https'));
        if (!is_string($normalized) || $normalized === '') {
            return null;
        }
        $normalized = rtrim($normalized, '/');

        if (!$preserve_path) {
            return $normalized;
        }

        return $normalized;
    }

    private static function validated_publishable_key(mixed $value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $key = trim(wp_unslash($value));
        if (
            $key === ''
            || strlen($key) > self::MAX_KEY_LENGTH
            || preg_match('/[\x00-\x20\x7f]/', $key) === 1
        ) {
            return null;
        }

        return $key;
    }

    public static function render_admin_page(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html('Du hast keine Berechtigung für diese Einstellungen.'));
        }

        echo '<div class="wrap">';
        echo '<h1>' . esc_html('Fanbusfahrten') . '</h1>';
        settings_errors(self::OPTION_NAME);
        echo '<form method="post" action="options.php">';
        settings_fields(self::SETTINGS_GROUP);
        do_settings_sections(self::ADMIN_SLUG);
        submit_button('Einstellungen speichern');
        echo '</form></div>';
    }

    private static function enqueue_public_assets(): void
    {
        wp_enqueue_style(
            'pd-m310-fanbus',
            plugins_url('assets/m310-fanbus.css', __FILE__),
            array(),
            self::VERSION
        );
    }

    public static function render_shortcode(): string
    {
        self::enqueue_public_assets();
        $config = self::configuration();
        if ($config === null) {
            return self::unavailable_message();
        }

        $trips = self::load_public_trips($config);
        if ($trips === null) {
            return self::unavailable_message();
        }
        if ($trips === array()) {
            return '<div class="pd-m310-empty" role="status">'
                . esc_html('Aktuell sind keine Fanbusfahrten angekündigt.')
                . '</div>';
        }

        $heading_id = wp_unique_id('pd-m310-fanbus-title-');
        ob_start();
        ?>
        <section class="pd-m310-fanbus" aria-labelledby="<?php echo esc_attr($heading_id); ?>">
            <header class="pd-m310-header">
                <p class="pd-m310-eyebrow">Gemeinsam zum Spiel</p>
                <h2 id="<?php echo esc_attr($heading_id); ?>" class="pd-m310-heading">Fanbusfahrten</h2>
            </header>

            <div class="pd-m310-grid">
                <?php foreach ($trips as $trip) : ?>
                    <?php
                    $stops = self::load_public_trip_stops(
                        $config,
                        $trip['tripId']
                    );
                    self::render_trip(
                        $trip,
                        $config['portal_registration_url'],
                        $stops
                    );
                    ?>
                <?php endforeach; ?>
            </div>
        </section>
        <?php
        return (string) ob_get_clean();
    }

    private static function unavailable_message(): string
    {
        return '<div class="pd-m310-unavailable" role="status">'
            . esc_html('Die Fanbusfahrten können aktuell nicht geladen werden.')
            . '</div>';
    }

    private static function configuration(): ?array
    {
        $settings = self::settings();
        $supabase_url = self::validated_supabase_url($settings['supabase_url']);
        $publishable_key = self::validated_publishable_key($settings['publishable_key']);
        $portal_url = self::validated_portal_url($settings['portal_registration_url']);

        if ($supabase_url === null || $publishable_key === null || $portal_url === null) {
            return null;
        }

        return array(
            'supabase_url' => $supabase_url,
            'publishable_key' => $publishable_key,
            'portal_registration_url' => $portal_url,
        );
    }

    private static function load_public_trips(array $config): ?array
    {
        $response = wp_remote_post(
            $config['supabase_url'] . self::RPC_PATH,
            array(
                'timeout' => self::REQUEST_TIMEOUT,
                'redirection' => 0,
                'reject_unsafe_urls' => true,
                'limit_response_size' => self::MAX_RESPONSE_BYTES,
                'headers' => array(
                    'apikey' => $config['publishable_key'],
                    'Content-Type' => 'application/json',
                ),
                'body' => '{}',
            )
        );

        if (is_wp_error($response)) {
            return null;
        }

        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            return null;
        }

        try {
            $data = json_decode(
                wp_remote_retrieve_body($response),
                true,
                64,
                JSON_THROW_ON_ERROR
            );
        } catch (JsonException) {
            return null;
        }

        if (
            !is_array($data)
            || array_is_list($data)
            || array_keys($data) !== array('trips')
            || !is_array($data['trips'])
            || !array_is_list($data['trips'])
        ) {
            return null;
        }

        $trips = array();
        foreach ($data['trips'] as $raw_trip) {
            $trip = self::validated_trip($raw_trip);
            if ($trip === null) {
                return null;
            }
            $trips[] = $trip;
        }

        return $trips;
    }

    private static function load_public_trip_stops(
        array $config,
        string $trip_id
    ): ?array {
        if (!self::valid_uuid($trip_id)) {
            return null;
        }

        $body = wp_json_encode(array(
            'p_trip_id' => $trip_id,
        ));

        if (!is_string($body) || $body === '') {
            return null;
        }

        $response = wp_remote_post(
            $config['supabase_url'] . self::STOPS_RPC_PATH,
            array(
                'timeout' => self::REQUEST_TIMEOUT,
                'redirection' => 0,
                'reject_unsafe_urls' => true,
                'limit_response_size' => self::MAX_RESPONSE_BYTES,
                'headers' => array(
                    'apikey' => $config['publishable_key'],
                    'Content-Type' => 'application/json',
                ),
                'body' => $body,
            )
        );

        if (is_wp_error($response)) {
            return null;
        }

        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            return null;
        }

        try {
            $data = json_decode(
                wp_remote_retrieve_body($response),
                true,
                64,
                JSON_THROW_ON_ERROR
            );
        } catch (JsonException) {
            return null;
        }

        if (
            !is_array($data)
            || array_is_list($data)
            || array_keys($data) !== array('stops')
            || !is_array($data['stops'])
            || !array_is_list($data['stops'])
        ) {
            return null;
        }

        $stops = array();
        foreach ($data['stops'] as $raw_stop) {
            $stop = self::validated_stop($raw_stop);
            if ($stop === null) {
                return null;
            }
            $stops[] = $stop;
        }

        usort(
            $stops,
            static fn (array $left, array $right): int =>
                $left['position'] <=> $right['position']
        );

        return $stops;
    }

    private static function validated_stop(mixed $value): ?array
    {
        if (!is_array($value) || array_is_list($value)) {
            return null;
        }

        $required_keys = array(
            'tripBoardingStopId',
            'boardingStopId',
            'label',
            'address',
            'departureAt',
            'position',
            'tripNote',
        );

        if (array_diff($required_keys, array_keys($value)) !== array()) {
            return null;
        }

        if (
            !self::valid_uuid($value['tripBoardingStopId'])
            || !self::valid_uuid($value['boardingStopId'])
            || !self::valid_text($value['label'], 160)
            || !self::valid_optional_text($value['address'], 2000)
            || !self::valid_timestamp($value['departureAt'])
            || !is_int($value['position'])
            || $value['position'] <= 0
            || !self::valid_optional_text($value['tripNote'], 4000)
        ) {
            return null;
        }

        return array(
            'tripBoardingStopId' => $value['tripBoardingStopId'],
            'boardingStopId' => $value['boardingStopId'],
            'label' => trim($value['label']),
            'address' => is_string($value['address'])
                ? trim($value['address'])
                : null,
            'departureAt' => $value['departureAt'],
            'position' => $value['position'],
            'tripNote' => is_string($value['tripNote'])
                ? trim($value['tripNote'])
                : null,
        );
    }

    private static function validated_trip(mixed $value): ?array
    {
        if (!is_array($value) || array_is_list($value)) {
            return null;
        }

        $required_keys = array(
            'tripId',
            'eventType',
            'displayTitle',
            'eventDate',
            'eventTime',
            'venue',
            'departureAt',
            'departureInfo',
            'registrationOpensAt',
            'registrationClosesAt',
            'priceCents',
            'tripStatus',
            'registrationStatus',
            'cancellationReason',
            'cancelledAt',
        );

        if (array_diff($required_keys, array_keys($value)) !== array()) {
            return null;
        }

        if (
            !self::valid_uuid($value['tripId'])
            || !self::valid_text($value['eventType'], 80)
            || !self::valid_text($value['displayTitle'], 500)
            || !self::valid_calendar_date($value['eventDate'])
            || !self::valid_event_time($value['eventTime'])
            || !self::valid_optional_text($value['venue'], 500)
            || !self::valid_timestamp($value['departureAt'])
            || !self::valid_optional_text($value['departureInfo'], 4000)
            || !self::valid_timestamp($value['registrationOpensAt'])
            || !self::valid_timestamp($value['registrationClosesAt'])
            || !is_int($value['priceCents'])
            || $value['priceCents'] < 0
            || !is_string($value['tripStatus'])
            || !in_array($value['tripStatus'], array('PUBLISHED', 'CANCELLED'), true)
            || !is_string($value['registrationStatus'])
            || !in_array(
                $value['registrationStatus'],
                array(
                    'NOT_STARTED',
                    'OPEN',
                    'WAITLIST',
                    'FULL',
                    'CLOSED',
                    'CANCELLED',
                    'UNAVAILABLE',
                ),
                true
            )
            || !self::valid_optional_text($value['cancellationReason'], 240)
            || ($value['cancelledAt'] !== null && !self::valid_timestamp($value['cancelledAt']))
            || ($value['tripStatus'] === 'CANCELLED' && (
                $value['registrationStatus'] !== 'CANCELLED'
                || !self::valid_text($value['cancellationReason'], 240)
                || !self::valid_timestamp($value['cancelledAt'])
            ))
        ) {
            return null;
        }

        return array(
            'tripId' => $value['tripId'],
            'eventType' => $value['eventType'],
            'displayTitle' => trim($value['displayTitle']),
            'eventDate' => $value['eventDate'],
            'eventTime' => $value['eventTime'],
            'venue' => is_string($value['venue'])
                ? trim($value['venue'])
                : null,
            'departureAt' => $value['departureAt'],
            'registrationOpensAt' => $value['registrationOpensAt'],
            'registrationClosesAt' => $value['registrationClosesAt'],
            'priceCents' => $value['priceCents'],
            'tripStatus' => $value['tripStatus'],
            'registrationStatus' => $value['registrationStatus'],
            'cancellationReason' => is_string($value['cancellationReason'])
                ? trim($value['cancellationReason'])
                : null,
            'cancelledAt' => $value['cancelledAt'],
        );
    }

    private static function valid_uuid(mixed $value): bool
    {
        return is_string($value)
            && preg_match(
                '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
                $value
            ) === 1;
    }

    private static function valid_text(mixed $value, int $maxlength): bool
    {
        return is_string($value)
            && trim($value) !== ''
            && self::text_length($value) <= $maxlength;
    }

    private static function valid_optional_text(mixed $value, int $maxlength): bool
    {
        return $value === null
            || (is_string($value) && self::text_length($value) <= $maxlength);
    }

    private static function valid_calendar_date(mixed $value): bool
    {
        if (!is_string($value) || preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/', $value) !== 1) {
            return false;
        }

        $date = DateTimeImmutable::createFromFormat(
            '!Y-m-d',
            $value,
            new DateTimeZone('Europe/Berlin')
        );
        $errors = DateTimeImmutable::getLastErrors();
        return $date instanceof DateTimeImmutable
            && ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0))
            && $date->format('Y-m-d') === $value;
    }

    private static function valid_event_time(mixed $value): bool
    {
        return $value === null
            || (is_string($value)
                && preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,6})?)?$/', $value) === 1);
    }

    private static function valid_timestamp(mixed $value): bool
    {
        if (!is_string($value) || $value === '' || strlen($value) > 64) {
            return false;
        }

        try {
            new DateTimeImmutable($value);
            return true;
        } catch (Exception) {
            return false;
        }
    }

    private static function text_length(string $value): int
    {
        return function_exists('mb_strlen')
            ? (int) mb_strlen($value, 'UTF-8')
            : strlen($value);
    }

    private static function render_trip(
        array $trip,
        string $portal_url,
        ?array $stops
    ): void {
        $status = self::status_presentation($trip['registrationStatus']);
        $deep_link = add_query_arg('trip', $trip['tripId'], $portal_url);
        $button_label = in_array(
            $trip['registrationStatus'],
            array('OPEN', 'WAITLIST'),
            true
        )
            ? 'Jetzt anmelden'
            : 'Anmeldung ansehen';

        $has_event_time = is_string($trip['eventTime'])
            && trim($trip['eventTime']) !== '';
        ?>
        <details class="pd-m310-trip">
            <summary class="pd-m310-summary">
                <span class="pd-m310-summary-copy">
                    <span class="pd-m310-date">
                        <?php echo esc_html(self::format_event_date($trip['eventDate'])); ?>
                        <?php if ($has_event_time) : ?>
                            <span aria-hidden="true"> · </span>
                            <?php echo esc_html(self::format_event_time($trip['eventTime'])); ?>
                        <?php endif; ?>
                    </span>

                    <span class="pd-m310-title">
                        <?php echo esc_html($trip['displayTitle']); ?>
                    </span>

                    <?php if (is_string($trip['venue']) && $trip['venue'] !== '') : ?>
                        <span class="pd-m310-venue">
                            <?php echo esc_html($trip['venue']); ?>
                        </span>
                    <?php endif; ?>
                </span>

                <span class="pd-m310-status <?php echo esc_attr($status['class']); ?>">
                    <?php echo esc_html($status['label']); ?>
                </span>

                <span class="pd-m310-chevron" aria-hidden="true">›</span>
            </summary>

            <div class="pd-m310-detail">
                <dl class="pd-m310-meta">
                    <div class="pd-m310-meta-item">
                        <dt>Termin</dt>
                        <dd>
                            <?php echo esc_html(self::format_event_date($trip['eventDate'])); ?>
                            <?php if ($has_event_time) : ?>
                                <span aria-hidden="true"> · </span>
                                <?php echo esc_html(self::format_event_time($trip['eventTime'])); ?>
                            <?php endif; ?>
                        </dd>
                    </div>

                    <?php if (is_string($trip['venue']) && $trip['venue'] !== '') : ?>
                        <div class="pd-m310-meta-item">
                            <dt>Ort / Ziel</dt>
                            <dd><?php echo esc_html($trip['venue']); ?></dd>
                        </div>
                    <?php endif; ?>

                    <div class="pd-m310-meta-item">
                        <dt>Fanbus-Abfahrt</dt>
                        <dd><?php echo esc_html(self::format_timestamp($trip['departureAt'])); ?></dd>
                    </div>

                    <div class="pd-m310-meta-item">
                        <dt>Fahrtpreis</dt>
                        <dd><?php echo esc_html(self::format_price($trip['priceCents'])); ?></dd>
                    </div>

                </dl>

                <p class="pd-m310-registration-window">
                    <strong><?php echo esc_html(self::registration_window_text($trip)); ?></strong>
                </p>

                <?php if ($trip['tripStatus'] === 'CANCELLED') : ?>
                    <section class="pd-m310-cancellation" aria-label="Fahrtabsage">
                        <strong>Fahrt abgesagt</strong>
                        <p><?php echo esc_html($trip['cancellationReason']); ?></p>
                        <small>Abgesagt am <?php echo esc_html(self::format_timestamp($trip['cancelledAt'])); ?></small>
                    </section>
                <?php endif; ?>

                <section class="pd-m310-stops" aria-label="Zustiegsorte">
                    <h3 class="pd-m310-stops-heading">Zustiegsorte</h3>

                    <?php if ($stops === null) : ?>
                        <p class="pd-m310-stops-note">
                            Die Zustiegsorte können aktuell nicht geladen werden.
                        </p>
                    <?php elseif ($stops === array()) : ?>
                        <p class="pd-m310-stops-note">
                            Für diese Fahrt sind aktuell keine Zustiegsorte veröffentlicht.
                        </p>
                    <?php else : ?>
                        <ul class="pd-m310-stops-list">
                            <?php foreach ($stops as $stop) : ?>
                                <li class="pd-m310-stop">
                                    <div class="pd-m310-stop-head">
                                        <strong><?php echo esc_html($stop['label']); ?></strong>
                                        <span><?php echo esc_html(self::format_time($stop['departureAt'])); ?></span>
                                    </div>

                                    <?php if (is_string($stop['address']) && $stop['address'] !== '') : ?>
                                        <p><?php echo esc_html($stop['address']); ?></p>
                                    <?php endif; ?>

                                    <?php if (is_string($stop['tripNote']) && $stop['tripNote'] !== '') : ?>
                                        <p><?php echo esc_html($stop['tripNote']); ?></p>
                                    <?php endif; ?>
                                </li>
                            <?php endforeach; ?>
                        </ul>
                    <?php endif; ?>
                </section>

                <?php if (!in_array($trip['registrationStatus'], array('UNAVAILABLE', 'CANCELLED'), true)) : ?>
                    <a
                        class="pd-m310-link"
                        href="<?php echo esc_url($deep_link); ?>"
                        aria-label="<?php echo esc_attr($button_label . ': ' . $trip['displayTitle']); ?>"
                    ><?php echo esc_html($button_label); ?></a>
                <?php endif; ?>
            </div>
        </details>
        <?php
    }

    private static function status_presentation(string $status): array
    {
        return array(
            'NOT_STARTED' => array('label' => 'Startet später', 'class' => 'pd-m310-status-upcoming'),
            'OPEN' => array('label' => 'Offen', 'class' => 'pd-m310-status-open'),
            'FULL' => array('label' => 'Ausgebucht', 'class' => 'pd-m310-status-full'),
            'WAITLIST' => array('label' => 'Warteliste', 'class' => 'pd-m310-status-full'),
            'CLOSED' => array('label' => 'Geschlossen', 'class' => 'pd-m310-status-closed'),
            'CANCELLED' => array('label' => 'Fahrt abgesagt', 'class' => 'pd-m310-status-cancelled'),
            'UNAVAILABLE' => array('label' => 'Nicht verfügbar', 'class' => 'pd-m310-status-unavailable'),
        )[$status];
    }

    private static function registration_window_text(array $trip): string
    {
        if (in_array($trip['registrationStatus'], array('OPEN', 'WAITLIST'), true)) {
            return 'Anmeldeschluss: '
                . self::format_timestamp($trip['registrationClosesAt']);
        }

        if ($trip['registrationStatus'] === 'NOT_STARTED') {
            return 'Anmeldung ab '
                . self::format_timestamp($trip['registrationOpensAt']);
        }

        if ($trip['registrationStatus'] === 'CLOSED') {
            return 'Anmeldung geschlossen';
        }

        if ($trip['registrationStatus'] === 'CANCELLED') {
            return 'Fahrt abgesagt';
        }

        if ($trip['registrationStatus'] === 'FULL') {
            return 'Anmeldung ausgebucht';
        }

        return 'Anmeldung derzeit nicht verfügbar';
    }

    private static function format_event_date(string $value): string
    {
        $date = DateTimeImmutable::createFromFormat(
            '!Y-m-d',
            $value,
            new DateTimeZone('Europe/Berlin')
        );
        return $date instanceof DateTimeImmutable ? $date->format('d.m.Y') : '';
    }

    private static function format_event_time(?string $value): string
    {
        return is_string($value) && $value !== ''
            ? substr($value, 0, 5) . ' Uhr'
            : 'Uhrzeit noch offen';
    }

    private static function format_timestamp(string $value): string
    {
        try {
            return (new DateTimeImmutable($value))
                ->setTimezone(new DateTimeZone('Europe/Berlin'))
                ->format('d.m.Y, H:i \U\h\r');
        } catch (Exception) {
            return '';
        }
    }

    private static function format_time(string $value): string
    {
        try {
            return (new DateTimeImmutable($value))
                ->setTimezone(new DateTimeZone('Europe/Berlin'))
                ->format('H:i \U\h\r');
        } catch (Exception) {
            return '';
        }
    }

    private static function format_price(int $price_cents): string
    {
        $euros = intdiv($price_cents, 100);
        $cents = $price_cents % 100;
        return number_format($euros, 0, ',', '.')
            . ',' . str_pad((string) $cents, 2, '0', STR_PAD_LEFT)
            . ' €';
    }
}

PD_M310_Fanbus_Plugin::boot();
