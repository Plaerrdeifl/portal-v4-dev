<?php
/**
 * Plugin Name: Plärrdeifl PD-Portal SSO
 * Description: Meldet berechtigte WordPress-Nutzer über die zentrale PD-Portal-Identität an.
 * Version: 0.1.0
 * Author: Schweinfurter Plärrdeifl
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const PD_PORTAL_SSO_META_SUBJECT = 'pd_portal_subject';
const PD_PORTAL_SSO_STATE_COOKIE = 'pd_portal_oauth_state';
const PD_PORTAL_SSO_TRANSIENT_PREFIX = 'pd_portal_oauth_';
const PD_PORTAL_SSO_SCOPE = 'openid email profile';

function pd_portal_sso_config() {
	$issuer = defined( 'PD_PORTAL_OAUTH_ISSUER' )
		? rtrim( (string) PD_PORTAL_OAUTH_ISSUER, '/' )
		: '';
	$client_id = defined( 'PD_PORTAL_OAUTH_CLIENT_ID' )
		? trim( (string) PD_PORTAL_OAUTH_CLIENT_ID )
		: '';
	$client_secret = defined( 'PD_PORTAL_OAUTH_CLIENT_SECRET' )
		? (string) PD_PORTAL_OAUTH_CLIENT_SECRET
		: '';

	if (
		'' === $issuer
		|| '' === $client_id
		|| '' === $client_secret
		|| 0 !== strpos( $issuer, 'https://' )
	) {
		return new WP_Error(
			'pd_portal_sso_not_configured',
			'PD-Portal SSO ist auf dieser WordPress-Instanz nicht vollständig konfiguriert.'
		);
	}

	return array(
		'issuer'        => $issuer,
		'client_id'     => $client_id,
		'client_secret' => $client_secret,
	);
}

function pd_portal_sso_callback_url() {
	return add_query_arg(
		array( 'action' => 'pd_portal_oauth_callback' ),
		admin_url( 'admin-post.php' )
	);
}

function pd_portal_sso_base64url( $value ) {
	return rtrim( strtr( base64_encode( $value ), '+/', '-_' ), '=' );
}

function pd_portal_sso_random_token( $bytes = 32 ) {
	return pd_portal_sso_base64url( random_bytes( $bytes ) );
}

function pd_portal_sso_state_transient_key( $state ) {
	return PD_PORTAL_SSO_TRANSIENT_PREFIX . hash( 'sha256', $state );
}

function pd_portal_sso_set_state_cookie( $state, $expires ) {
	setcookie(
		PD_PORTAL_SSO_STATE_COOKIE,
		$state,
		array(
			'expires'  => $expires,
			'path'     => COOKIEPATH ? COOKIEPATH : '/',
			'domain'   => COOKIE_DOMAIN,
			'secure'   => is_ssl(),
			'httponly' => true,
			'samesite' => 'Lax',
		)
	);
}

function pd_portal_sso_clear_state_cookie() {
	setcookie(
		PD_PORTAL_SSO_STATE_COOKIE,
		'',
		array(
			'expires'  => time() - HOUR_IN_SECONDS,
			'path'     => COOKIEPATH ? COOKIEPATH : '/',
			'domain'   => COOKIE_DOMAIN,
			'secure'   => is_ssl(),
			'httponly' => true,
			'samesite' => 'Lax',
		)
	);
}

function pd_portal_sso_render_login_button() {
	$config = pd_portal_sso_config();
	if ( is_wp_error( $config ) ) {
		return;
	}

	$url = add_query_arg(
		array( 'action' => 'pd-portal-sso' ),
		wp_login_url()
	);

	echo '<p style="margin-top:16px;text-align:center">';
	echo '<a class="button button-secondary button-large" style="width:100%;text-align:center" href="' . esc_url( $url ) . '">';
	echo esc_html__( 'Mit PD-Portal anmelden', 'plaerrdeifl-pd-portal-sso' );
	echo '</a></p>';
}
add_action( 'login_form', 'pd_portal_sso_render_login_button' );

function pd_portal_sso_start() {
	$config = pd_portal_sso_config();
	if ( is_wp_error( $config ) ) {
		wp_die( esc_html( $config->get_error_message() ), '', array( 'response' => 503 ) );
	}

	$state = pd_portal_sso_random_token( 32 );
	$nonce = pd_portal_sso_random_token( 32 );
	$verifier = pd_portal_sso_random_token( 48 );
	$challenge = pd_portal_sso_base64url( hash( 'sha256', $verifier, true ) );
	$expires = time() + 10 * MINUTE_IN_SECONDS;
	$redirect_to = isset( $_REQUEST['redirect_to'] )
		? wp_validate_redirect( wp_unslash( $_REQUEST['redirect_to'] ), admin_url() )
		: admin_url();

	set_transient(
		pd_portal_sso_state_transient_key( $state ),
		array(
			'verifier'    => $verifier,
			'nonce'       => $nonce,
			'redirect_to' => $redirect_to,
		),
		10 * MINUTE_IN_SECONDS
	);
	pd_portal_sso_set_state_cookie( $state, $expires );

	$authorization_url = add_query_arg(
		array(
			'response_type'         => 'code',
			'client_id'             => $config['client_id'],
			'redirect_uri'          => pd_portal_sso_callback_url(),
			'scope'                 => PD_PORTAL_SSO_SCOPE,
			'state'                 => $state,
			'nonce'                 => $nonce,
			'code_challenge'        => $challenge,
			'code_challenge_method' => 'S256',
		),
		$config['issuer'] . '/oauth/authorize'
	);

	wp_redirect( esc_url_raw( $authorization_url ), 302, 'PD-Portal OAuth' );
	exit;
}
add_action( 'login_form_pd-portal-sso', 'pd_portal_sso_start' );

function pd_portal_sso_exchange_code( $config, $code, $verifier ) {
	$response = wp_remote_post(
		$config['issuer'] . '/oauth/token',
		array(
			'timeout' => 15,
			'headers' => array(
				'Authorization' => 'Basic ' . base64_encode( $config['client_id'] . ':' . $config['client_secret'] ),
				'Content-Type'  => 'application/x-www-form-urlencoded',
			),
			'body'    => array(
				'grant_type'    => 'authorization_code',
				'code'          => $code,
				'redirect_uri'  => pd_portal_sso_callback_url(),
				'code_verifier' => $verifier,
			),
		)
	);

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	if ( 200 !== wp_remote_retrieve_response_code( $response ) ) {
		return new WP_Error( 'pd_portal_sso_token_failed', 'PD-Portal Token-Austausch fehlgeschlagen.' );
	}

	$data = json_decode( wp_remote_retrieve_body( $response ), true );
	$access_token = is_array( $data ) && isset( $data['access_token'] )
		? (string) $data['access_token']
		: '';

	if ( '' === $access_token ) {
		return new WP_Error( 'pd_portal_sso_token_missing', 'PD-Portal hat kein Zugriffstoken geliefert.' );
	}

	return $access_token;
}

function pd_portal_sso_fetch_userinfo( $config, $access_token ) {
	$response = wp_remote_get(
		$config['issuer'] . '/oauth/userinfo',
		array(
			'timeout' => 15,
			'headers' => array(
				'Authorization' => 'Bearer ' . $access_token,
				'Accept'        => 'application/json',
			),
		)
	);

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	if ( 200 !== wp_remote_retrieve_response_code( $response ) ) {
		return new WP_Error( 'pd_portal_sso_userinfo_failed', 'PD-Portal Benutzerinformationen konnten nicht geladen werden.' );
	}

	$data = json_decode( wp_remote_retrieve_body( $response ), true );
	if ( ! is_array( $data ) ) {
		return new WP_Error( 'pd_portal_sso_userinfo_invalid', 'PD-Portal Benutzerinformationen sind ungültig.' );
	}

	$subject = isset( $data['sub'] ) ? sanitize_text_field( (string) $data['sub'] ) : '';
	$email = isset( $data['email'] ) ? sanitize_email( (string) $data['email'] ) : '';
	$email_verified = isset( $data['email_verified'] ) && true === $data['email_verified'];
	$name = isset( $data['name'] ) ? sanitize_text_field( (string) $data['name'] ) : '';

	if ( '' === $subject || '' === $email || ! is_email( $email ) || ! $email_verified ) {
		return new WP_Error(
			'pd_portal_sso_identity_incomplete',
			'PD-Portal hat keine verifizierte, verwendbare Identität geliefert.'
		);
	}

	return array(
		'subject' => $subject,
		'email'   => $email,
		'name'    => $name,
	);
}

function pd_portal_sso_find_user_by_subject( $subject ) {
	$users = get_users(
		array(
			'number'     => 2,
			'meta_key'   => PD_PORTAL_SSO_META_SUBJECT,
			'meta_value' => $subject,
			'fields'     => 'all',
		)
	);

	if ( 1 === count( $users ) ) {
		return $users[0];
	}
	if ( count( $users ) > 1 ) {
		return new WP_Error( 'pd_portal_sso_duplicate_subject', 'Die PD-Portal-Identität ist mehrfach zugeordnet.' );
	}

	return null;
}

function pd_portal_sso_create_or_resolve_user( $identity ) {
	$existing = pd_portal_sso_find_user_by_subject( $identity['subject'] );
	if ( is_wp_error( $existing ) || $existing instanceof WP_User ) {
		return $existing;
	}

	$email_user = get_user_by( 'email', $identity['email'] );
	if ( $email_user instanceof WP_User ) {
		return new WP_Error(
			'pd_portal_sso_email_conflict',
			'Für diese E-Mail-Adresse existiert bereits ein nicht zugeordnetes WordPress-Konto.'
		);
	}

	$subject_slug = strtolower( preg_replace( '/[^a-z0-9]/i', '', $identity['subject'] ) );
	$login = 'pd_' . substr( $subject_slug, 0, 24 );
	if ( '' === $subject_slug ) {
		$login = 'pd_' . substr( hash( 'sha256', $identity['subject'] ), 0, 24 );
	}
	if ( username_exists( $login ) ) {
		$login .= '_' . substr( hash( 'sha256', $identity['subject'] ), 0, 8 );
	}

	$user_id = wp_insert_user(
		array(
			'user_login'   => $login,
			'user_email'   => $identity['email'],
			'display_name' => '' !== $identity['name'] ? $identity['name'] : $identity['email'],
			'user_pass'    => wp_generate_password( 64, true, true ),
			'role'         => 'author',
		)
	);

	if ( is_wp_error( $user_id ) ) {
		return $user_id;
	}

	update_user_meta( $user_id, PD_PORTAL_SSO_META_SUBJECT, $identity['subject'] );
	update_user_meta( $user_id, 'pd_portal_sso_managed', '1' );

	return get_user_by( 'id', $user_id );
}

function pd_portal_sso_callback() {
	$config = pd_portal_sso_config();
	if ( is_wp_error( $config ) ) {
		wp_die( esc_html( $config->get_error_message() ), '', array( 'response' => 503 ) );
	}

	$state = isset( $_GET['state'] ) ? sanitize_text_field( wp_unslash( $_GET['state'] ) ) : '';
	$code = isset( $_GET['code'] ) ? sanitize_text_field( wp_unslash( $_GET['code'] ) ) : '';
	$cookie_state = isset( $_COOKIE[ PD_PORTAL_SSO_STATE_COOKIE ] )
		? sanitize_text_field( wp_unslash( $_COOKIE[ PD_PORTAL_SSO_STATE_COOKIE ] ) )
		: '';

	if (
		'' === $state
		|| '' === $code
		|| '' === $cookie_state
		|| ! hash_equals( $cookie_state, $state )
	) {
		pd_portal_sso_clear_state_cookie();
		wp_die( 'Ungültige PD-Portal-Anmeldeantwort.', '', array( 'response' => 400 ) );
	}

	$key = pd_portal_sso_state_transient_key( $state );
	$pending = get_transient( $key );
	delete_transient( $key );
	pd_portal_sso_clear_state_cookie();

	if (
		! is_array( $pending )
		|| empty( $pending['verifier'] )
		|| empty( $pending['redirect_to'] )
	) {
		wp_die( 'Die PD-Portal-Anmeldung ist abgelaufen. Bitte erneut starten.', '', array( 'response' => 400 ) );
	}

	$access_token = pd_portal_sso_exchange_code( $config, $code, (string) $pending['verifier'] );
	if ( is_wp_error( $access_token ) ) {
		wp_die( esc_html( $access_token->get_error_message() ), '', array( 'response' => 502 ) );
	}

	$identity = pd_portal_sso_fetch_userinfo( $config, $access_token );
	if ( is_wp_error( $identity ) ) {
		wp_die( esc_html( $identity->get_error_message() ), '', array( 'response' => 403 ) );
	}

	$user = pd_portal_sso_create_or_resolve_user( $identity );
	if ( is_wp_error( $user ) ) {
		wp_die( esc_html( $user->get_error_message() ), '', array( 'response' => 403 ) );
	}

	wp_set_current_user( $user->ID );
	wp_set_auth_cookie( $user->ID, false, is_ssl() );
	do_action( 'wp_login', $user->user_login, $user );

	wp_safe_redirect( (string) $pending['redirect_to'] );
	exit;
}
add_action( 'admin_post_nopriv_pd_portal_oauth_callback', 'pd_portal_sso_callback' );
add_action( 'admin_post_pd_portal_oauth_callback', 'pd_portal_sso_callback' );

function pd_portal_sso_block_password_login( $user, $username, $password ) {
	if ( '' === (string) $username || '' === (string) $password ) {
		return $user;
	}

	$candidate = get_user_by( 'login', $username );
	if ( ! $candidate && is_email( $username ) ) {
		$candidate = get_user_by( 'email', $username );
	}

	if (
		$candidate instanceof WP_User
		&& '' !== (string) get_user_meta( $candidate->ID, PD_PORTAL_SSO_META_SUBJECT, true )
	) {
		return new WP_Error(
			'pd_portal_sso_required',
			'Dieses Konto wird über PD-Portal angemeldet. Bitte „Mit PD-Portal anmelden“ verwenden.'
		);
	}

	return $user;
}
add_filter( 'authenticate', 'pd_portal_sso_block_password_login', 30, 3 );
