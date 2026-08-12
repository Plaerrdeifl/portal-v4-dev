<?php
/**
 * Plugin Name: Plärrdeifl M150 Mitglied werden
 * Description: Öffentlicher Mitgliedsantrag mit Dokumentverwaltung und sicherem Servertransport.
 * Version: 1.0.0
 * Requires PHP: 8.3
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

final class PD_M150_Membership_Plugin
{
    private const VERSION = '1.0.0';
    private const OPTION_NAME = 'plaerrdeifl_m150_settings';
    private const SETTINGS_GROUP = 'plaerrdeifl_m150_settings_group';
    private const ADMIN_SLUG = 'plaerrdeifl-m150-membership';
    private const REST_NAMESPACE = 'plaerrdeifl/v1';
    private const REST_ROUTE = '/m150-membership-application';
    private const TURNSTILE_ACTION = 'm150_membership_application';
    private const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    private const RATE_LIMIT_ATTEMPTS = 6;
    private const RATE_LIMIT_TTL = 900;

    private static string $admin_page_hook = '';

    public static function boot(): void
    {
        add_shortcode('plaerrdeifl_mitglied_werden', array(self::class, 'render_shortcode'));
        add_action('rest_api_init', array(self::class, 'register_rest_route'));
        add_action('admin_menu', array(self::class, 'register_admin_page'));
        add_action('admin_init', array(self::class, 'register_settings'));
        add_action('admin_enqueue_scripts', array(self::class, 'enqueue_admin_assets'));
    }

    private static function default_settings(): array
    {
        return array(
            'privacy_page_id' => 0,
            'statutes_attachment_id' => 0,
            'minor_form_attachment_id' => 0,
            'declaration_version' => '',
            'statutes_version' => '',
            'statutes_reference' => '',
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
        self::$admin_page_hook = (string) add_options_page(
            'Dokumente & Einstellungen',
            'Mitglied werden',
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
            'pd_m150_documents',
            'Dokumente & Einstellungen',
            array(self::class, 'render_settings_intro'),
            self::ADMIN_SLUG
        );

        add_settings_field(
            'pd_m150_privacy_page',
            'Datenschutzseite',
            array(self::class, 'render_privacy_page_field'),
            self::ADMIN_SLUG,
            'pd_m150_documents'
        );

        self::add_pdf_field(
            'pd_m150_statutes_pdf',
            'Satzungs-PDF',
            'statutes_attachment_id'
        );
        self::add_pdf_field(
            'pd_m150_minor_pdf',
            'Papierantrag für Minderjährige',
            'minor_form_attachment_id'
        );

        self::add_text_field(
            'pd_m150_declaration_version',
            'Erklärungsversion',
            'declaration_version',
            80
        );
        self::add_text_field(
            'pd_m150_statutes_version',
            'Satzungsversion',
            'statutes_version',
            80
        );
        self::add_text_field(
            'pd_m150_statutes_reference',
            'Satzungsreferenz',
            'statutes_reference',
            500
        );
    }

    private static function add_pdf_field(string $id, string $label, string $key): void
    {
        add_settings_field(
            $id,
            $label,
            array(self::class, 'render_pdf_field'),
            self::ADMIN_SLUG,
            'pd_m150_documents',
            array('key' => $key, 'label' => $label)
        );
    }

    private static function add_text_field(
        string $id,
        string $label,
        string $key,
        int $maxlength
    ): void {
        add_settings_field(
            $id,
            $label,
            array(self::class, 'render_text_field'),
            self::ADMIN_SLUG,
            'pd_m150_documents',
            array('key' => $key, 'maxlength' => $maxlength)
        );
    }

    public static function render_settings_intro(): void
    {
        echo '<p>' . esc_html(
            'Hier werden ausschließlich öffentliche Dokumente und fachliche Versionswerte verwaltet.'
        ) . '</p>';
    }

    public static function render_privacy_page_field(): void
    {
        $settings = self::settings();
        wp_dropdown_pages(array(
            'name' => self::OPTION_NAME . '[privacy_page_id]',
            'id' => 'pd-m150-privacy-page-id',
            'selected' => absint($settings['privacy_page_id']),
            'show_option_none' => '— Veröffentlichte Seite auswählen —',
            'option_none_value' => '0',
            'post_status' => 'publish',
        ));
        echo '<p class="description">' . esc_html(
            'Die öffentliche URL wird dynamisch über die ausgewählte veröffentlichte WordPress-Seite ermittelt.'
        ) . '</p>';
    }

    public static function render_pdf_field(array $args): void
    {
        $key = isset($args['key']) ? (string) $args['key'] : '';
        $label = isset($args['label']) ? (string) $args['label'] : 'PDF';
        $settings = self::settings();
        $attachment_id = isset($settings[$key]) ? absint($settings[$key]) : 0;
        $url = self::pdf_attachment_url($attachment_id);
        $input_id = 'pd-m150-' . sanitize_html_class(str_replace('_', '-', $key));

        printf(
            '<div class="pd-m150-admin-media" data-pd-m150-media-field>'
            . '<input type="hidden" id="%1$s" name="%2$s[%3$s]" value="%4$d" data-pd-m150-media-id>'
            . '<button type="button" class="button pd-m150-media-select" data-pd-m150-target="%1$s" data-pd-m150-title="%5$s">%6$s</button> '
            . '<button type="button" class="button-link-delete pd-m150-media-remove" data-pd-m150-target="%1$s">%7$s</button>'
            . '<p class="pd-m150-admin-current" data-pd-m150-current%8$s><a href="%9$s" target="_blank" rel="noopener noreferrer">%10$s</a></p>'
            . '</div>',
            esc_attr($input_id),
            esc_attr(self::OPTION_NAME),
            esc_attr($key),
            $attachment_id,
            esc_attr($label . ' auswählen oder hochladen'),
            esc_html('PDF auswählen / ersetzen'),
            esc_html('Auswahl entfernen'),
            $url === null ? ' hidden' : '',
            $url === null ? '' : esc_url($url),
            esc_html('Aktuell konfigurierte PDF öffnen')
        );
        echo '<p class="description">' . esc_html(
            'Gespeichert wird nur die Attachment-ID. Zulässig sind ausschließlich PDF-Attachments.'
        ) . '</p>';
    }

    public static function render_text_field(array $args): void
    {
        $key = isset($args['key']) ? (string) $args['key'] : '';
        $maxlength = isset($args['maxlength']) ? absint($args['maxlength']) : 80;
        $settings = self::settings();
        $value = isset($settings[$key]) ? (string) $settings[$key] : '';

        printf(
            '<input class="regular-text" type="text" name="%1$s[%2$s]" value="%3$s" maxlength="%4$d" required>',
            esc_attr(self::OPTION_NAME),
            esc_attr($key),
            esc_attr($value),
            $maxlength
        );
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
            $input = array();
        }

        return array(
            'privacy_page_id' => self::validated_privacy_page_id(
                $input['privacy_page_id'] ?? 0
            ),
            'statutes_attachment_id' => self::validated_pdf_attachment_id(
                $input['statutes_attachment_id'] ?? 0
            ),
            'minor_form_attachment_id' => self::validated_pdf_attachment_id(
                $input['minor_form_attachment_id'] ?? 0
            ),
            'declaration_version' => self::sanitize_limited_text(
                $input['declaration_version'] ?? '',
                80
            ),
            'statutes_version' => self::sanitize_limited_text(
                $input['statutes_version'] ?? '',
                80
            ),
            'statutes_reference' => self::sanitize_limited_text(
                $input['statutes_reference'] ?? '',
                500
            ),
        );
    }

    private static function validated_pdf_attachment_id(mixed $value): int
    {
        $attachment_id = absint($value);
        if ($attachment_id === 0) {
            return 0;
        }

        $attachment = get_post($attachment_id);
        if (
            !$attachment instanceof WP_Post
            || $attachment->post_type !== 'attachment'
            || get_post_mime_type($attachment_id) !== 'application/pdf'
        ) {
            add_settings_error(
                self::OPTION_NAME,
                'pd_m150_invalid_pdf',
                'Es wurde nur ein gültiges PDF-Attachment übernommen.',
                'error'
            );
            return 0;
        }

        return $attachment_id;
    }

    private static function validated_privacy_page_id(mixed $value): int
    {
        $page_id = absint($value);
        if ($page_id === 0) {
            return 0;
        }

        $page = get_post($page_id);
        if (
            !$page instanceof WP_Post
            || $page->post_type !== 'page'
            || $page->post_status !== 'publish'
        ) {
            add_settings_error(
                self::OPTION_NAME,
                'pd_m150_invalid_privacy_page',
                'Es wurde nur eine veröffentlichte WordPress-Seite übernommen.',
                'error'
            );
            return 0;
        }

        return $page_id;
    }

    private static function sanitize_limited_text(mixed $value, int $maxlength): string
    {
        if (!is_string($value)) {
            return '';
        }
        $clean = trim(sanitize_text_field(wp_unslash($value)));
        return self::text_slice($clean, $maxlength);
    }

    private static function text_slice(string $value, int $maxlength): string
    {
        if (function_exists('mb_substr')) {
            return (string) mb_substr($value, 0, $maxlength, 'UTF-8');
        }
        return substr($value, 0, $maxlength);
    }

    private static function text_length(string $value): int
    {
        if (function_exists('mb_strlen')) {
            return (int) mb_strlen($value, 'UTF-8');
        }
        return strlen($value);
    }

    public static function render_admin_page(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html('Du hast keine Berechtigung für diese Einstellungen.'));
        }

        echo '<div class="wrap pd-m150-admin">';
        echo '<h1>' . esc_html('Dokumente & Einstellungen') . '</h1>';
        settings_errors(self::OPTION_NAME);
        echo '<form method="post" action="options.php">';
        settings_fields(self::SETTINGS_GROUP);
        do_settings_sections(self::ADMIN_SLUG);
        submit_button('Einstellungen speichern');
        echo '</form></div>';
    }

    public static function enqueue_admin_assets(string $hook_suffix): void
    {
        if ($hook_suffix !== self::$admin_page_hook) {
            return;
        }

        wp_enqueue_media();
        wp_enqueue_script(
            'pd-m150-membership-admin',
            plugins_url('assets/m150-membership-admin.js', __FILE__),
            array('jquery'),
            self::VERSION,
            true
        );
        wp_enqueue_style(
            'pd-m150-membership',
            plugins_url('assets/m150-membership.css', __FILE__),
            array(),
            self::VERSION
        );
    }

    private static function enqueue_public_assets(): void
    {
        wp_enqueue_style(
            'pd-m150-membership',
            plugins_url('assets/m150-membership.css', __FILE__),
            array(),
            self::VERSION
        );
        wp_enqueue_script(
            'pd-m150-membership-public',
            plugins_url('assets/m150-membership.js', __FILE__),
            array(),
            self::VERSION,
            true
        );
        wp_enqueue_script(
            'pd-m150-turnstile',
            'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=pdM150TurnstileReady&render=explicit',
            array('pd-m150-membership-public'),
            null,
            true
        );
        wp_script_add_data('pd-m150-turnstile', 'async', true);
        wp_script_add_data('pd-m150-turnstile', 'defer', true);
    }

    public static function render_shortcode(): string
    {
        $config = self::digital_configuration();
        if ($config === null) {
            return '<div class="pd-m150-unavailable" role="status">'
                . esc_html('Der digitale Mitgliedsantrag ist derzeit technisch nicht verfügbar.')
                . '</div>';
        }

        self::enqueue_public_assets();
        $minor_url = $config['minor_url'];

        ob_start();
        ?>
        <section class="pd-m150-membership" aria-labelledby="pd-m150-title">
            <h2 id="pd-m150-title">Mitglied werden</h2>
            <p>Der digitale Antrag ist ausschließlich für volljährige Antragsteller vorgesehen.</p>
            <p class="pd-m150-documents">
                <a href="<?php echo esc_url($config['privacy_url']); ?>" target="_blank" rel="noopener noreferrer">Datenschutzhinweise</a>
                <a href="<?php echo esc_url($config['statutes_url']); ?>" target="_blank" rel="noopener noreferrer">Satzung als PDF</a>
                <?php if (is_string($minor_url) && $minor_url !== '') : ?>
                    <a href="<?php echo esc_url($minor_url); ?>" target="_blank" rel="noopener noreferrer">Papierantrag für Minderjährige</a>
                <?php endif; ?>
            </p>
            <p class="pd-m150-privacy-note">
                Informationen zur Verarbeitung deiner Daten findest du in den verlinkten Datenschutzhinweisen.
            </p>
            <form
                class="pd-m150-form"
                data-pd-m150-form
                data-rest-url="<?php echo esc_url(rest_url(self::REST_NAMESPACE . self::REST_ROUTE)); ?>"
                data-minor-url="<?php echo is_string($minor_url) ? esc_url($minor_url) : ''; ?>"
            >
                <div class="pd-m150-grid">
                    <?php self::render_public_input('firstName', 'Vorname', 'text', 160, 'given-name'); ?>
                    <?php self::render_public_input('lastName', 'Nachname', 'text', 160, 'family-name'); ?>
                    <?php self::render_public_input('birthDate', 'Geburtsdatum', 'date', null, 'bday'); ?>
                    <?php self::render_public_input('email', 'E-Mail', 'email', 320, 'email'); ?>
                    <?php self::render_public_input('phone', 'Telefon', 'tel', 80, 'tel'); ?>
                    <?php self::render_public_input('street', 'Straße', 'text', 160, 'address-line1'); ?>
                    <?php self::render_public_input('houseNumber', 'Hausnummer', 'text', 40, 'address-line2'); ?>
                    <?php self::render_public_input('postalCode', 'Postleitzahl', 'text', 20, 'postal-code'); ?>
                    <?php self::render_public_input('city', 'Ort', 'text', 160, 'address-level2'); ?>
                </div>
                <label class="pd-m150-field pd-m150-field-wide">
                    <span>Nachricht an den Vorstand (optional)</span>
                    <textarea name="applicantMessage" maxlength="4000" rows="5"></textarea>
                </label>
                <label class="pd-m150-confirmation">
                    <input type="checkbox" name="declarationConfirmed" value="1" required>
                    <span>Ich beantrage die Aufnahme in den Fanclub Plärrdeifl. Mir ist bekannt, dass über die Aufnahme der Vorstand entscheidet und eine Mitgliedschaft nicht bereits durch das Absenden dieses Formulars entsteht.</span>
                </label>
                <label class="pd-m150-confirmation">
                    <input type="checkbox" name="statutesConfirmed" value="1" required>
                    <span>Ich habe die Satzung gelesen und bestätige sie als Grundlage meines Aufnahmeantrags.</span>
                </label>
                <div
                    class="pd-m150-turnstile"
                    data-pd-m150-turnstile
                    data-sitekey="<?php echo esc_attr($config['turnstile_site_key']); ?>"
                ></div>
                <button class="pd-m150-submit" type="submit">Mitgliedsantrag absenden</button>
                <div class="pd-m150-status" data-pd-m150-status role="status" aria-live="polite"></div>
            </form>
        </section>
        <?php
        return (string) ob_get_clean();
    }

    private static function render_public_input(
        string $name,
        string $label,
        string $type,
        ?int $maxlength,
        string $autocomplete
    ): void {
        printf(
            '<label class="pd-m150-field"><span>%1$s</span><input name="%2$s" type="%3$s" autocomplete="%4$s"%5$s required></label>',
            esc_html($label),
            esc_attr($name),
            esc_attr($type),
            esc_attr($autocomplete),
            $maxlength === null ? '' : ' maxlength="' . absint($maxlength) . '"'
        );
    }

    public static function register_rest_route(): void
    {
        register_rest_route(
            self::REST_NAMESPACE,
            self::REST_ROUTE,
            array(
                'methods' => WP_REST_Server::CREATABLE,
                'callback' => array(self::class, 'handle_submission'),
                'permission_callback' => '__return_true',
            )
        );
    }

    public static function handle_submission(WP_REST_Request $request): WP_REST_Response
    {
        if ($request->get_method() !== 'POST' || $request->get_query_params() !== array()) {
            return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
        }

        if (!self::consume_rate_limit()) {
            return self::error_response(
                429,
                'rate_limit',
                'Zu viele Versuche. Bitte versuche es später erneut.'
            );
        }

        $config = self::digital_configuration();
        if ($config === null) {
            return self::error_response(
                503,
                'technical',
                'Der Mitgliedsantrag ist derzeit technisch nicht möglich.'
            );
        }

        $input = self::validated_request_input($request);
        if ($input instanceof WP_REST_Response) {
            return $input;
        }

        $birth_date = self::parse_birth_date($input['birthDate']);
        if ($birth_date === null) {
            return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
        }

        $today = new DateTimeImmutable('today', new DateTimeZone('Europe/Berlin'));
        if ($birth_date > $today) {
            return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
        }
        if ($birth_date->modify('+18 years') > $today) {
            $extra = array('category' => 'minor');
            if (is_string($config['minor_url']) && $config['minor_url'] !== '') {
                $extra['minorFormUrl'] = $config['minor_url'];
            }
            return self::response(
                false,
                'Für Minderjährige ist ausschließlich der Papierweg vorgesehen.',
                400,
                $extra
            );
        }

        $idempotency_key = wp_generate_uuid4();
        $turnstile_result = self::verify_turnstile(
            $input['cf-turnstile-response'],
            $idempotency_key,
            $config['turnstile_secret']
        );
        if ($turnstile_result === 'transport_error') {
            return self::error_response(
                503,
                'technical',
                'Der Mitgliedsantrag ist derzeit technisch nicht möglich.'
            );
        }
        if ($turnstile_result !== 'valid') {
            return self::error_response(
                400,
                'security',
                'Bitte führe die Sicherheitsprüfung erneut durch.'
            );
        }

        $edge_payload = array(
            'firstName' => $input['firstName'],
            'lastName' => $input['lastName'],
            'birthDate' => $input['birthDate'],
            'email' => $input['email'],
            'phone' => $input['phone'],
            'street' => $input['street'],
            'houseNumber' => $input['houseNumber'],
            'postalCode' => $input['postalCode'],
            'city' => $input['city'],
            'applicantMessage' => $input['applicantMessage'],
            'declarationConfirmed' => true,
            'declarationVersion' => $config['settings']['declaration_version'],
            'statutesConfirmed' => true,
            'statutesVersion' => $config['settings']['statutes_version'],
            'statutesReference' => $config['settings']['statutes_reference'],
        );

        $raw_json = wp_json_encode(
            $edge_payload,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        if (!is_string($raw_json)) {
            return self::error_response(
                503,
                'technical',
                'Der Mitgliedsantrag ist derzeit technisch nicht möglich.'
            );
        }

        $body_hash = hash('sha256', $raw_json);
        $timestamp = (string) time();
        $signature_base = $timestamp . "\n"
            . $idempotency_key . "\n"
            . $body_hash;
        $signature = hash_hmac(
            'sha256',
            $signature_base,
            $config['hmac_secret']
        );

        $edge_response = self::send_edge_request(
            $config['edge_url'],
            $raw_json,
            $timestamp,
            $idempotency_key,
            $signature
        );
        if (is_wp_error($edge_response)) {
            return self::error_response(
                503,
                'technical',
                'Der Mitgliedsantrag ist derzeit technisch nicht möglich.'
            );
        }

        $edge_status = wp_remote_retrieve_response_code($edge_response);
        $edge_data = json_decode(wp_remote_retrieve_body($edge_response), true);
        if (
            $edge_status === 200
            && is_array($edge_data)
            && ($edge_data['ok'] ?? null) === true
        ) {
            return self::response(
                true,
                'Dein Mitgliedsantrag wurde entgegengenommen.',
                200
            );
        }

        if ($edge_status === 400) {
            return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
        }

        return self::error_response(
            503,
            'technical',
            'Der Mitgliedsantrag ist derzeit technisch nicht möglich.'
        );
    }

    private static function validated_request_input(
        WP_REST_Request $request
    ): array|WP_REST_Response {
        $input = $request->get_json_params();
        if (!is_array($input) || array_is_list($input)) {
            return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
        }

        $allowed_keys = array(
            'firstName',
            'lastName',
            'birthDate',
            'email',
            'phone',
            'street',
            'houseNumber',
            'postalCode',
            'city',
            'applicantMessage',
            'declarationConfirmed',
            'statutesConfirmed',
            'cf-turnstile-response',
        );
        $required_keys = array(
            'firstName',
            'lastName',
            'birthDate',
            'email',
            'phone',
            'street',
            'houseNumber',
            'postalCode',
            'city',
            'declarationConfirmed',
            'statutesConfirmed',
            'cf-turnstile-response',
        );

        if (array_diff(array_keys($input), $allowed_keys) !== array()) {
            return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
        }
        foreach ($required_keys as $required_key) {
            if (!array_key_exists($required_key, $input)) {
                return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
            }
        }

        $string_limits = array(
            'firstName' => 160,
            'lastName' => 160,
            'birthDate' => 10,
            'email' => 320,
            'phone' => 80,
            'street' => 160,
            'houseNumber' => 40,
            'postalCode' => 20,
            'city' => 160,
        );
        $clean = array();
        foreach ($string_limits as $key => $limit) {
            if (!isset($input[$key]) || !is_string($input[$key])) {
                return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
            }
            $value = trim(sanitize_text_field($input[$key]));
            if ($value === '' || self::text_length($value) > $limit) {
                return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
            }
            $clean[$key] = $value;
        }

        if (!is_email($clean['email'])) {
            return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
        }

        $message = $input['applicantMessage'] ?? null;
        if ($message !== null && !is_string($message)) {
            return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
        }
        $message = is_string($message) ? trim(sanitize_textarea_field($message)) : '';
        if (self::text_length($message) > 4000) {
            return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
        }
        $clean['applicantMessage'] = $message === '' ? null : $message;

        if (
            ($input['declarationConfirmed'] ?? null) !== true
            || ($input['statutesConfirmed'] ?? null) !== true
        ) {
            return self::error_response(400, 'input', 'Bitte prüfe deine Eingaben.');
        }
        $clean['declarationConfirmed'] = true;
        $clean['statutesConfirmed'] = true;

        $turnstile_token = $input['cf-turnstile-response'] ?? null;
        if (
            !is_string($turnstile_token)
            || $turnstile_token === ''
            || strlen($turnstile_token) > 2048
        ) {
            return self::error_response(
                400,
                'security',
                'Bitte führe die Sicherheitsprüfung erneut durch.'
            );
        }
        $clean['cf-turnstile-response'] = $turnstile_token;

        return $clean;
    }

    private static function parse_birth_date(string $value): ?DateTimeImmutable
    {
        if (!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/', $value)) {
            return null;
        }

        $timezone = new DateTimeZone('Europe/Berlin');
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value, $timezone);
        $errors = DateTimeImmutable::getLastErrors();
        if (
            !$date instanceof DateTimeImmutable
            || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))
            || $date->format('Y-m-d') !== $value
            || $date < new DateTimeImmutable('1900-01-01', $timezone)
        ) {
            return null;
        }

        return $date;
    }

    private static function consume_rate_limit(): bool
    {
        $remote_address = isset($_SERVER['REMOTE_ADDR'])
            ? (string) wp_unslash($_SERVER['REMOTE_ADDR'])
            : '';
        $source_hash = hash_hmac('sha256', $remote_address, wp_salt('nonce'));
        $transient_key = 'pd_m150_rate_' . $source_hash;
        $attempts = (int) get_transient($transient_key);

        if ($attempts >= self::RATE_LIMIT_ATTEMPTS) {
            return false;
        }

        set_transient($transient_key, $attempts + 1, self::RATE_LIMIT_TTL);
        return true;
    }

    private static function verify_turnstile(
        string $token,
        string $idempotency_key,
        string $secret
    ): string {
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $response = wp_remote_post(
                self::TURNSTILE_VERIFY_URL,
                array(
                    'timeout' => 10,
                    'body' => array(
                        'secret' => $secret,
                        'response' => $token,
                        'idempotency_key' => $idempotency_key,
                    ),
                )
            );

            if (is_wp_error($response)) {
                if ($attempt === 0) {
                    continue;
                }
                return 'transport_error';
            }

            if (wp_remote_retrieve_response_code($response) !== 200) {
                return 'transport_error';
            }

            $result = json_decode(wp_remote_retrieve_body($response), true);
            $expected_hostname = wp_parse_url(home_url(), PHP_URL_HOST);
            if (
                !is_array($result)
                || ($result['success'] ?? null) !== true
                || !is_string($result['action'] ?? null)
                || !hash_equals(self::TURNSTILE_ACTION, $result['action'])
                || !is_string($expected_hostname)
                || $expected_hostname === ''
                || !is_string($result['hostname'] ?? null)
                || !hash_equals($expected_hostname, $result['hostname'])
            ) {
                return 'invalid';
            }

            return 'valid';
        }

        return 'transport_error';
    }

    private static function send_edge_request(
        string $edge_url,
        string $raw_json,
        string $timestamp,
        string $idempotency_key,
        string $signature
    ): array|WP_Error {
        $response = new WP_Error('pd_m150_edge_unavailable');
        for ($attempt = 0; $attempt < 2; $attempt++) {
            $response = wp_remote_post(
                $edge_url,
                array(
                    'timeout' => 15,
                    'headers' => array(
                        'Content-Type' => 'application/json',
                        'X-M150-Timestamp' => $timestamp,
                        'X-M150-Idempotency-Key' => $idempotency_key,
                        'X-M150-Signature' => $signature,
                    ),
                    'body' => $raw_json,
                )
            );

            if (is_wp_error($response)) {
                if ($attempt === 0) {
                    continue;
                }
                return $response;
            }

            $status = wp_remote_retrieve_response_code($response);
            if ($status >= 500 && $attempt === 0) {
                continue;
            }

            return $response;
        }

        return $response;
    }

    private static function digital_configuration(): ?array
    {
        $required_constants = array(
            'PD_M150_EDGE_URL',
            'PD_M150_INTAKE_HMAC_SECRET',
            'PD_M150_TURNSTILE_SITE_KEY',
            'PD_M150_TURNSTILE_SECRET_KEY',
        );
        foreach ($required_constants as $constant_name) {
            if (!defined($constant_name)) {
                return null;
            }
        }

        $edge_url = trim((string) constant('PD_M150_EDGE_URL'));
        $hmac_secret = (string) constant('PD_M150_INTAKE_HMAC_SECRET');
        $turnstile_site_key = trim((string) constant('PD_M150_TURNSTILE_SITE_KEY'));
        $turnstile_secret = (string) constant('PD_M150_TURNSTILE_SECRET_KEY');
        if (
            $edge_url === ''
            || wp_http_validate_url($edge_url) === false
            || wp_parse_url($edge_url, PHP_URL_SCHEME) !== 'https'
            || strlen($hmac_secret) < 32
            || $turnstile_site_key === ''
            || $turnstile_secret === ''
        ) {
            return null;
        }

        $settings = self::settings();
        $privacy_url = self::privacy_page_url(absint($settings['privacy_page_id']));
        $statutes_url = self::pdf_attachment_url(absint(
            $settings['statutes_attachment_id']
        ));
        $minor_url = self::pdf_attachment_url(absint(
            $settings['minor_form_attachment_id']
        ));

        if (
            $privacy_url === null
            || $statutes_url === null
            || !self::valid_config_text($settings['declaration_version'], 80)
            || !self::valid_config_text($settings['statutes_version'], 80)
            || !self::valid_config_text($settings['statutes_reference'], 500)
        ) {
            return null;
        }

        return array(
            'edge_url' => $edge_url,
            'hmac_secret' => $hmac_secret,
            'turnstile_site_key' => $turnstile_site_key,
            'turnstile_secret' => $turnstile_secret,
            'privacy_url' => $privacy_url,
            'statutes_url' => $statutes_url,
            'minor_url' => $minor_url,
            'settings' => $settings,
        );
    }

    private static function valid_config_text(mixed $value, int $maxlength): bool
    {
        return is_string($value)
            && $value !== ''
            && self::text_length($value) <= $maxlength
            && sanitize_text_field($value) === $value;
    }

    private static function pdf_attachment_url(int $attachment_id): ?string
    {
        if ($attachment_id === 0) {
            return null;
        }
        $attachment = get_post($attachment_id);
        if (
            !$attachment instanceof WP_Post
            || $attachment->post_type !== 'attachment'
            || get_post_mime_type($attachment_id) !== 'application/pdf'
        ) {
            return null;
        }
        $url = wp_get_attachment_url($attachment_id);
        return is_string($url) && $url !== '' ? $url : null;
    }

    private static function privacy_page_url(int $page_id): ?string
    {
        if ($page_id === 0) {
            return null;
        }
        $page = get_post($page_id);
        if (
            !$page instanceof WP_Post
            || $page->post_type !== 'page'
            || $page->post_status !== 'publish'
        ) {
            return null;
        }
        $url = get_permalink($page_id);
        return is_string($url) && $url !== '' ? $url : null;
    }

    private static function error_response(
        int $status,
        string $category,
        string $message
    ): WP_REST_Response {
        return self::response(false, $message, $status, array('category' => $category));
    }

    private static function response(
        bool $ok,
        string $message,
        int $status,
        array $extra = array()
    ): WP_REST_Response {
        $response = new WP_REST_Response(
            array_merge(array('ok' => $ok, 'message' => $message), $extra),
            $status
        );
        $response->header('Cache-Control', 'no-store');
        return $response;
    }
}

PD_M150_Membership_Plugin::boot();
